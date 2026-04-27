import db from '../models/index.js';
import AppError from '../utils/AppError.js';
import { asyncWrapper } from '../middlewares/errorHandler.js';
import { addContentToSchedule } from '../services/scheduleService.js';
import { del } from '../services/cacheService.js';
import logger from '../utils/logger.js';

export const getPendingContent = asyncWrapper(async (_req, res) => {
  const contents = await db.Content.findAll({
    where: { status: 'pending' },
    include: [
      { model: db.User, as: 'uploader', attributes: ['id', 'name', 'email'] },
    ],
    order: [['created_at', 'ASC']],
  });

  return res.json({ contents });
});

export const getAllContent = asyncWrapper(async (req, res, next) => {
  const { status } = req.query;

  const VALID_STATUSES = ['pending', 'approved', 'rejected'];

  if (status && !VALID_STATUSES.includes(status)) {
    return next(new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`, 400));
  }

  const where = status ? { status } : {};

  const contents = await db.Content.findAll({
    where,
    include: [
      { model: db.User, as: 'uploader', attributes: ['id', 'name', 'email'] },
      { model: db.User, as: 'approver', attributes: ['id', 'name', 'email'] },
    ],
    order: [['created_at', 'DESC']],
  });

  return res.json({ total: contents.length, status: status || 'all', contents });
});

export const approveContent = asyncWrapper(async (req, res, next) => {
  const { contentId } = req.params;

  const content = await db.Content.findByPk(contentId);
  if (!content) return next(new AppError('Content not found.', 404));

  if (content.status !== 'pending') {
    return next(new AppError(`Content has already been ${content.status}.`, 400));
  }

  // Security: principal cannot approve their own uploads
  if (content.uploaded_by === req.user.id) {
    return next(new AppError('You cannot approve content you uploaded.', 403));
  }

  // Use a transaction so approval + schedule update are atomic
  await db.sequelize.transaction(async (t) => {
    await content.update(
      { status: 'approved', approved_by: req.user.id, approved_at: new Date() },
      { transaction: t }
    );
    await addContentToSchedule(content.id, content.subject, t);
  });

  // Invalidate broadcast cache for the uploading teacher
  await del(`broadcast:teacher:${content.uploaded_by}:*`);

  logger.info(`Content ${content.id} approved by user ${req.user.id}`);
  return res.json({ message: 'Content approved successfully.', content });
});

export const rejectContent = asyncWrapper(async (req, res, next) => {
  const { contentId } = req.params;

  const content = await db.Content.findByPk(contentId);
  if (!content) return next(new AppError('Content not found.', 404));

  if (content.status !== 'pending') {
    return next(new AppError(`Content has already been ${content.status}.`, 400));
  }

  await content.update({
    status: 'rejected',
    rejection_reason: req.body.reason,
  });

  // Invalidate broadcast cache
  await del(`broadcast:teacher:${content.uploaded_by}:*`);

  logger.info(`Content ${content.id} rejected by user ${req.user.id}. Reason: ${req.body.reason}`);
  return res.json({ message: 'Content rejected successfully.', content });
});
