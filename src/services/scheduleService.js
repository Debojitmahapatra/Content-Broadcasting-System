import SubjectSchedule from '../models/SubjectSchedule.js';
import ScheduleItem from '../models/ScheduleItem.js';
import Content from '../models/Content.js';
import logger from '../utils/logger.js';

/**
 * Appends a newly approved content item to the end of its subject's schedule.
 * Creates the SubjectSchedule row if it doesn't exist yet.
 * Accepts an optional Sequelize transaction for atomic approval flows.
 *
 * @param {number} contentId
 * @param {string} subject
 * @param {import('sequelize').Transaction|null} [transaction=null]
 * @returns {Promise<ScheduleItem>}
 */
export async function addContentToSchedule(contentId, subject, transaction = null) {
  const opts = transaction ? { transaction } : {};

  const [schedule] = await SubjectSchedule.findOrCreate({
    where: { subject },
    defaults: { subject },
    ...opts,
  });

  // Determine the next rotation_order (max + 1, or 1 if empty)
  const maxItem = await ScheduleItem.findOne({
    where: { schedule_id: schedule.id },
    order: [['rotation_order', 'DESC']],
    ...opts,
  });

  const nextOrder = maxItem ? maxItem.rotation_order + 1 : 1;

  const item = await ScheduleItem.create(
    {
      schedule_id: schedule.id,
      content_id: contentId,
      rotation_order: nextOrder,
      duration_minutes: 5,
    },
    opts
  );

  logger.info(`[scheduleService] Content ${contentId} added to "${subject}" schedule at order ${nextOrder}`);
  return item;
}

/**
 * Removes a content item from its schedule and compacts rotation_order gaps.
 * Accepts an optional Sequelize transaction.
 *
 * @param {number} contentId
 * @param {import('sequelize').Transaction|null} [transaction=null]
 * @returns {Promise<boolean|null>} true if removed, null if not found
 */
export async function removeContentFromSchedule(contentId, transaction = null) {
  const opts = transaction ? { transaction } : {};

  const item = await ScheduleItem.findOne({ where: { content_id: contentId }, ...opts });
  if (!item) return null;

  const { schedule_id, rotation_order: removedOrder } = item;
  await item.destroy(opts);

  // Compact: decrement rotation_order for all items that came after the removed one
  const laterItems = await ScheduleItem.findAll({
    where: { schedule_id },
    order: [['rotation_order', 'ASC']],
    ...opts,
  });

  for (const laterItem of laterItems) {
    if (laterItem.rotation_order > removedOrder) {
      await laterItem.update({ rotation_order: laterItem.rotation_order - 1 }, opts);
    }
  }

  logger.info(`[scheduleService] Content ${contentId} removed from schedule ${schedule_id}, order compacted`);
  return true;
}

/**
 * Rebuilds the full schedule for a subject from a list of approved content IDs.
 * Ordered by approved_at ascending.
 * Accepts an optional Sequelize transaction.
 *
 * @param {string}   subject
 * @param {number[]} approvedContentIds
 * @param {import('sequelize').Transaction|null} [transaction=null]
 */
export async function createOrUpdateSchedule(subject, approvedContentIds, transaction = null) {
  const opts = transaction ? { transaction } : {};

  const [schedule] = await SubjectSchedule.findOrCreate({
    where: { subject },
    defaults: { subject },
    ...opts,
  });

  const contents = await Content.findAll({
    where: { id: approvedContentIds, status: 'approved' },
    order: [['approved_at', 'ASC']],
    ...opts,
  });

  await ScheduleItem.destroy({ where: { schedule_id: schedule.id }, ...opts });

  const items = contents.map((content, index) => ({
    schedule_id: schedule.id,
    content_id: content.id,
    rotation_order: index + 1,
    duration_minutes: 5,
  }));

  if (items.length > 0) {
    await ScheduleItem.bulkCreate(items, opts);
  }

  return schedule;
}
