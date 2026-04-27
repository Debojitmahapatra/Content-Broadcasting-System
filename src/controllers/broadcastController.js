import db from '../models/index.js';
import AppError from '../utils/AppError.js';
import { asyncWrapper } from '../middlewares/errorHandler.js';
import { getActiveContentForSubject } from '../services/schedulingEngine.js';
import { get, set, generateBroadcastCacheKey } from '../services/cacheService.js';
import logger from '../utils/logger.js';

const ALLOWED_SUBJECTS = ['Maths', 'Science', 'English', 'Social', 'Computers'];
const BROADCAST_CACHE_TTL = 10; // seconds

/**
 * GET /api/broadcast/live/:teacherId[?subject=<Subject>]
 *
 * Public endpoint — no auth required.
 *
 * Returns the currently active content for each subject the teacher has
 * approved content in. All "no content" scenarios return 200 with a message
 * rather than an error, so display screens never crash.
 *
 * Scenarios that return { message: 'No content available' }:
 *   - Teacher not found (404 — intentional, not a display-screen scenario)
 *   - Teacher has no content at all
 *   - Teacher has content but none is approved
 *   - All approved content is outside its time window (expired or future)
 *   - Schedule exists but all items filtered out
 *   - Invalid subject query param (silently ignored, falls back to all subjects)
 */
export const getLiveContent = asyncWrapper(async (req, res, next) => {
  const { teacherId } = req.params;
  // Silently ignore invalid subject values — don't error
  const subjectQuery =
    req.query.subject && ALLOWED_SUBJECTS.includes(req.query.subject)
      ? req.query.subject
      : null;

  // ── Cache check ──────────────────────────────────────────────────────────
  const cacheKey = generateBroadcastCacheKey(teacherId, subjectQuery);
  const cached = await get(cacheKey);
  if (cached) {
    logger.debug(`[broadcast] Cache hit for key: ${cacheKey}`);
    return res.json({ ...cached, fromCache: true });
  }

  // ── Teacher validation ───────────────────────────────────────────────────
  const teacher = await db.User.findOne({
    where: { id: teacherId, role: 'teacher' },
    attributes: ['id', 'name'],
  });
  if (!teacher) return next(new AppError('Teacher not found.', 404));

  // ── Fetch approved content ───────────────────────────────────────────────
  const whereClause = { uploaded_by: teacherId, status: 'approved' };
  if (subjectQuery) whereClause.subject = subjectQuery;

  const approvedContent = await db.Content.findAll({ where: whereClause });

  if (!approvedContent.length) {
    return res.json({ message: 'No content available' });
  }

  // ── Group by subject ─────────────────────────────────────────────────────
  const subjects = [...new Set(approvedContent.map((c) => c.subject))];

  const now = new Date();
  const activeContent = {};

  await Promise.all(
    subjects.map(async (subject) => {
      const result = await getActiveContentForSubject(subject, now);
      if (result) {
        activeContent[subject] = {
          content: result.content,
          remainingSeconds: result.remainingSeconds,
          nextContent: result.nextContent,
        };
      }
    })
  );

  // All approved content exists but none is within its time window
  if (!Object.keys(activeContent).length) {
    return res.json({ message: 'No content available' });
  }

  const payload = { teacherId, timestamp: now.toISOString(), activeContent };

  // ── Store in cache ───────────────────────────────────────────────────────
  await set(cacheKey, payload, BROADCAST_CACHE_TTL);

  return res.json(payload);
});
