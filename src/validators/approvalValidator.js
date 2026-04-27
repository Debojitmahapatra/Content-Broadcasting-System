import { body } from 'express-validator';

export const rejectValidator = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required.')
    .isLength({ min: 5 })
    .withMessage('Rejection reason must be at least 5 characters.'),
];
