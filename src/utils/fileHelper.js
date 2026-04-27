/**
 * File storage helpers.
 * Centralises local disk deletion so swapping to S3 only requires changing this file.
 */

import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const UPLOAD_ROOT = 'uploads';

/**
 * Deletes a file from local disk given its stored file_url.
 * Silently no-ops if the file does not exist.
 *
 * @param {string} fileUrl - e.g. "uploads/1777213113596-863036245.jpeg"
 */
export function deleteLocalFile(fileUrl) {
  if (!fileUrl) return;
  try {
    // file_url is stored as "uploads/<filename>" — resolve relative to cwd
    const filePath = path.resolve(fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`[fileHelper] Deleted file: ${filePath}`);
    }
  } catch (err) {
    logger.warn(`[fileHelper] Could not delete file "${fileUrl}": ${err.message}`);
  }
}

/**
 * Stub for S3 deletion — replace body with AWS SDK call when migrating.
 *
 * @param {string} fileUrl - S3 object key or full URL
 */
export async function deleteS3File(fileUrl) {
  // TODO: const s3 = new S3Client({...});
  // await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: fileUrl }));
  logger.warn(`[fileHelper] S3 deletion not implemented for: ${fileUrl}`);
}

/**
 * Deletes a file from whichever storage backend is configured.
 * Set USE_S3=true in .env to route to S3.
 *
 * @param {string} fileUrl
 */
export async function deleteFile(fileUrl) {
  if (process.env.USE_S3 === 'true') {
    await deleteS3File(fileUrl);
  } else {
    deleteLocalFile(fileUrl);
  }
}
