/**
 * Scheduling Engine
 *
 * All timestamps are stored in UTC in the database.
 * currentTime is always a UTC Date object (new Date() is UTC by definition in Node.js).
 * No timezone conversion is needed server-side; clients receive UTC ISO strings and
 * convert to local time themselves.
 */

import db from '../models/index.js';
import logger from '../utils/logger.js';

const SUBJECTS = ['Maths', 'Science', 'English', 'Social', 'Computers'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a SubjectSchedule with all its ScheduleItems and their Content,
 * filtered to only approved content whose time window is active at `currentTime`.
 *
 * Time-window rules (all in UTC):
 *   - start_time <= currentTime  → content has started
 *   - end_time   >  currentTime  → content has not yet expired
 *   - start_time > end_time      → rejected at upload time (validator prevents this)
 *
 * @param {string} subject
 * @param {Date}   currentTime  - UTC Date
 * @returns {Promise<{ schedule: object|null, activeItems: object[] }>}
 */
async function fetchActiveItems(subject, currentTime) {
  const schedule = await db.SubjectSchedule.findOne({
    where: { subject },
    include: [
      {
        model: db.ScheduleItem,
        include: [
          {
            model: db.Content,
            where: { status: 'approved' },
            required: true,
          },
        ],
        required: false,
      },
    ],
  });

  if (!schedule || !schedule.ScheduleItems?.length) {
    logger.debug(`[schedulingEngine] No schedule or items found for subject "${subject}"`);
    return { schedule: null, activeItems: [] };
  }

  const now = currentTime.getTime();

  const activeItems = schedule.ScheduleItems.filter((item) => {
    const content = item.Content;

    // Guard: both time bounds must be present
    if (!content.start_time || !content.end_time) return false;

    const start = new Date(content.start_time).getTime();
    const end = new Date(content.end_time).getTime();

    // Content not yet started (future start_time)
    if (start > now) return false;

    // Content window has expired (end_time <= now)
    if (end <= now) return false;

    return true;
  });

  if (activeItems.length === 0) {
    logger.debug(`[schedulingEngine] All items for "${subject}" are outside their time window`);
  }

  return { schedule, activeItems };
}

/**
 * Core rotation algorithm — pure function, no I/O.
 *
 * Cycle layout (items sorted by rotation_order):
 *   totalCycle = Σ duration_minutes × 60  (seconds)
 *   offset     = ((elapsedSeconds % totalCycle) + totalCycle) % totalCycle
 *                ↑ double-modulo handles negative elapsed (clock skew)
 *
 * Walk items accumulating durations; the first slot that contains `offset` is active.
 *
 * @param {object[]} activeItems       - Already sorted by rotation_order
 * @param {Date}     scheduleCreatedAt - UTC anchor for the cycle
 * @param {Date}     currentTime       - UTC now
 * @returns {{ activeItem: object, remainingSeconds: number, offsetSeconds: number }}
 */
function resolveActiveItem(activeItems, scheduleCreatedAt, currentTime) {
  const sorted = [...activeItems].sort((a, b) => a.rotation_order - b.rotation_order);

  const totalCycleDuration = sorted.reduce(
    (sum, item) => sum + item.duration_minutes * 60,
    0
  );

  const elapsedMs = currentTime.getTime() - new Date(scheduleCreatedAt).getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  // Double-modulo ensures positive result even if elapsedSeconds is negative
  const offsetSeconds =
    ((elapsedSeconds % totalCycleDuration) + totalCycleDuration) % totalCycleDuration;

  let accumulated = 0;
  for (const item of sorted) {
    const slotDuration = item.duration_minutes * 60;
    if (offsetSeconds < accumulated + slotDuration) {
      const remainingSeconds = accumulated + slotDuration - offsetSeconds;
      return { activeItem: item, remainingSeconds, offsetSeconds };
    }
    accumulated += slotDuration;
  }

  // Fallback — should never be reached with a non-empty sorted array
  const first = sorted[0];
  return {
    activeItem: first,
    remainingSeconds: first.duration_minutes * 60,
    offsetSeconds,
  };
}

// ---------------------------------------------------------------------------
// Primary exports
// ---------------------------------------------------------------------------

/**
 * Returns the content that should currently be displayed for a given subject.
 *
 * Returns null for all "no content" scenarios:
 *   - Subject has no schedule
 *   - No approved content
 *   - All approved content is outside its time window (expired or future)
 *
 * @param {string} subject
 * @param {Date}   [currentTime=new Date()]  - UTC
 * @returns {Promise<{
 *   content: object,
 *   remainingSeconds: number,
 *   nextContent: object|null,
 *   scheduleItem: object,
 *   subject: string
 * }|null>}
 */
export async function getActiveContentForSubject(subject, currentTime = new Date()) {
  // Silently ignore invalid subjects — don't throw
  if (!SUBJECTS.includes(subject)) {
    logger.warn(`[schedulingEngine] Unknown subject requested: "${subject}"`);
    return null;
  }

  const { schedule, activeItems } = await fetchActiveItems(subject, currentTime);

  if (!schedule || activeItems.length === 0) return null;

  const sorted = [...activeItems].sort((a, b) => a.rotation_order - b.rotation_order);
  const { activeItem, remainingSeconds } = resolveActiveItem(
    sorted,
    schedule.created_at,
    currentTime
  );

  // Preview: next item in rotation (wraps around); null if only one item
  const currentIndex = sorted.findIndex((i) => i.id === activeItem.id);
  const nextItem = sorted[(currentIndex + 1) % sorted.length];
  const nextContent = nextItem && nextItem.id !== activeItem.id ? nextItem.Content : null;

  logger.debug(
    `[schedulingEngine] Active for "${subject}": content ${activeItem.Content.id}, ` +
    `remaining ${remainingSeconds}s`
  );

  return {
    content: activeItem.Content,
    remainingSeconds,
    nextContent,
    scheduleItem: activeItem,
    subject,
  };
}

/**
 * Aggregates active content across all (or a filtered) subjects.
 *
 * @param {string|null} [subjectFilter=null]
 * @returns {Promise<Array<{ subject: string, result: object|null }>>}
 */
export async function getCurrentContentForAllSubjects(subjectFilter = null) {
  const subjects = subjectFilter ? [subjectFilter] : SUBJECTS;
  const now = new Date();

  const results = await Promise.all(
    subjects.map(async (subject) => ({
      subject,
      result: await getActiveContentForSubject(subject, now),
    }))
  );

  return results.filter((r) => r.result !== null);
}

/**
 * Predicts the next time a specific content piece will become the active slot.
 *
 * @param {number} contentId
 * @returns {Promise<{
 *   nextActiveAt: Date,
 *   secondsUntilActive: number,
 *   durationSeconds: number
 * }|null>}
 */
export async function getNextContentTime(contentId) {
  const scheduleItem = await db.ScheduleItem.findOne({
    where: { content_id: contentId },
    include: [
      { model: db.SubjectSchedule },
      { model: db.Content, where: { status: 'approved' }, required: true },
    ],
  });

  if (!scheduleItem) return null;

  const schedule = scheduleItem.SubjectSchedule;
  const now = new Date();
  const { activeItems } = await fetchActiveItems(schedule.subject, now);

  if (activeItems.length === 0) return null;

  const sorted = [...activeItems].sort((a, b) => a.rotation_order - b.rotation_order);
  const { offsetSeconds } = resolveActiveItem(sorted, schedule.created_at, now);

  let accumulated = 0;
  const itemOffsets = sorted.map((item) => {
    const start = accumulated;
    accumulated += item.duration_minutes * 60;
    return { item, start, end: accumulated };
  });

  const totalCycle = accumulated;
  const target = itemOffsets.find((e) => e.item.content_id === contentId);
  if (!target) return null;

  let secondsUntilActive = target.start - offsetSeconds;
  if (secondsUntilActive <= 0) secondsUntilActive += totalCycle;

  const nextActiveAt = new Date(now.getTime() + secondsUntilActive * 1000);

  return {
    nextActiveAt,
    secondsUntilActive,
    durationSeconds: target.item.duration_minutes * 60,
  };
}
