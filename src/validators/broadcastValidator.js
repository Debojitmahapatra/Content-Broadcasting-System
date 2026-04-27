import { param, query } from 'express-validator';

const ALLOWED_SUBJECTS = ['Maths', 'Science', 'English', 'Social', 'Computers'];

export const broadcastValidator = [
  // teacherId is an integer PK (model uses INTEGER autoIncrement, not UUID)
  param('teacherId')
    .notEmpty().withMessage('teacherId is required.')
    .isInt({ min: 1 }).withMessage('teacherId must be a valid positive integer.')
    .toInt(),

  // subject is optional; if provided it must be a known value
  query('subject')
    .optional()
    .isIn(ALLOWED_SUBJECTS)
    .withMessage(`subject must be one of: ${ALLOWED_SUBJECTS.join(', ')}.`),
];
