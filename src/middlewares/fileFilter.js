import AppError from '../utils/AppError.js';

// Magic number signatures for allowed types
// First bytes of the file buffer identify the true format regardless of extension
const MAGIC_NUMBERS = {
  'image/jpeg': [
    [0xff, 0xd8, 0xff], // JPEG
  ],
  'image/png': [
    [0x89, 0x50, 0x4e, 0x47], // PNG
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39], // GIF89a
  ],
};

/**
 * Checks whether a buffer starts with the expected magic bytes for a MIME type.
 * @param {Buffer} buffer
 * @param {number[][]} signatures - Array of byte sequences to match against
 * @returns {boolean}
 */
function matchesMagicNumber(buffer, signatures) {
  return signatures.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

/**
 * Validates the uploaded file's true type by inspecting its magic numbers.
 * Multer must be configured with memoryStorage OR the file must be read before
 * this runs. When using diskStorage, req.file.buffer is not available —
 * in that case we fall back to trusting the mimetype (with a warning log).
 *
 * Also serves as a placeholder for virus scanning integration.
 * Replace the `virusScanPlaceholder` section with a real AV SDK call.
 */
export function validateFileContent(req, res, next) {
  if (!req.file) return next();

  const { mimetype, buffer, originalname } = req.file;

  // --- Virus scan placeholder -------------------------------------------
  // TODO: integrate ClamAV or similar SDK here
  // Example: await clamav.scanBuffer(buffer)
  // If infected: throw new AppError('File failed virus scan.', 400)
  // ----------------------------------------------------------------------

  // Magic number check (only possible when buffer is available)
  if (buffer) {
    const signatures = MAGIC_NUMBERS[mimetype];

    if (!signatures) {
      return next(new AppError(`File type '${mimetype}' is not allowed.`, 400));
    }

    if (!matchesMagicNumber(buffer, signatures)) {
      return next(
        new AppError(
          `File content does not match declared type '${mimetype}'. Possible spoofing attempt.`,
          400
        )
      );
    }
  } else {
    // diskStorage path — buffer unavailable, log and trust multer's fileFilter
    console.warn(
      `[fileFilter] Magic number check skipped for '${originalname}' (diskStorage). ` +
        'Switch to memoryStorage for full validation.'
    );
  }

  next();
}
