import path from 'path';
import db from '../models/index.js';
import AppError from '../utils/AppError.js';
import { asyncWrapper } from '../middlewares/errorHandler.js';
import { removeContentFromSchedule } from '../services/scheduleService.js';
import { deleteFile } from '../utils/fileHelper.js';
import { del } from '../services/cacheService.js';
import logger from '../utils/logger.js';

const UPLOAD_DIR_URL = 'uploads';

export const uploadContent = asyncWrapper(async (req, res, next) => {
  if (!req.file) return next(new AppError('File is required.', 400));

  const { title, description, subject, start_time, end_time } = req.body;
  const file_url = `${UPLOAD_DIR_URL}/${req.file.filename}`;

  const content = await db.Content.create({
    title,
    description,
    subject,
    file_url,
    file_type: path.extname(req.file.originalname).replace('.', ''),
    mimetype: req.file.mimetype,
    file_size: req.file.size,
    // Store as UTC — DB stores in UTC, clients send ISO 8601
    start_time: new Date(start_time),
    end_time: new Date(end_time),
    status: 'pending',
    uploaded_by: req.user.id,
  });

  logger.info(`Content ${content.id} uploaded by user ${req.user.id} (subject: ${subject})`);
  return res.status(201).json({ message: 'Content uploaded successfully.', content });
});

export const getMyContent = asyncWrapper(async (req, res) => {
  const contents = await db.Content.findAll({
    where: { uploaded_by: req.user.id },
    order: [['created_at', 'DESC']],
  });

  return res.json({ contents });
});

export const getContentById = asyncWrapper(async (req, res, next) => {
  const content = await db.Content.findByPk(req.params.id, {
    include: [
      { model: db.User, as: 'uploader', attributes: ['id', 'name', 'email'] },
      { model: db.User, as: 'approver', attributes: ['id', 'name', 'email'] },
    ],
  });

  if (!content) return next(new AppError('Content not found.', 404));

  return res.json({ content });
});

/**
 * Delete own content (teacher) or any content (principal).
 * - Removes from schedule if approved.
 * - Deletes the physical file from storage.
 * - Only pending/rejected content can be deleted by teachers.
 *   Principals can delete any content.
 */
export const deleteContent = asyncWrapper(async (req, res, next) => {
  const content = await db.Content.findByPk(req.params.id);
  if (!content) return next(new AppError('Content not found.', 404));

  const isPrincipal = req.user.role === 'principal';
  const isOwner = content.uploaded_by === req.user.id;

  if (!isPrincipal && !isOwner) {
    return next(new AppError('You do not have permission to delete this content.', 403));
  }

  // Teachers can only delete their own pending/rejected content
  if (!isPrincipal && content.status === 'approved') {
    return next(new AppError('Approved content cannot be deleted. Contact the principal.', 403));
  }

  const fileUrl = content.file_url;

  await db.sequelize.transaction(async (t) => {
    // Remove from schedule if it was approved
    if (content.status === 'approved') {
      await removeContentFromSchedule(content.id, t);
    }
    await content.destroy({ transaction: t });
  });

  // Delete physical file after DB transaction succeeds
  await deleteFile(fileUrl);

  // Invalidate cache
  await del(`broadcast:teacher:${content.uploaded_by}:*`);

  logger.info(`Content ${req.params.id} deleted by user ${req.user.id}`);
  return res.json({ message: 'Content deleted successfully.' });
});
