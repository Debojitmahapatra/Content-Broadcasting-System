import { body } from 'express-validator';

export const uploadContentValidator = [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('subject')
    .isIn(['Maths', 'Science', 'English', 'Social', 'Computers'])
    .withMessage('Subject must be one of: Maths, Science, English, Social, Computers.'),

  body('start_time')
    .notEmpty().withMessage('start_time is required.')
    .isISO8601().withMessage('start_time must be a valid ISO 8601 date.')
    .toDate(),

  body('end_time')
    .notEmpty().withMessage('end_time is required.')
    .isISO8601().withMessage('end_time must be a valid ISO 8601 date.')
    .toDate()
    // end_time must be after start_time
    .custom((end_time, { req }) => {
      const start = new Date(req.body.start_time);
      const end = new Date(end_time);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return true; // let isISO8601 handle it
      if (end <= start) {
        throw new Error('end_time must be after start_time.');
      }
      return true;
    })
    // end_time must be in the future
    .custom((end_time) => {
      if (new Date(end_time) <= new Date()) {
        throw new Error('end_time must be in the future.');
      }
      return true;
    }),
];
