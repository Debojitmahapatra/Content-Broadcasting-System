import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../models/index.js';
import AppError from '../utils/AppError.js';
import { asyncWrapper } from '../middlewares/errorHandler.js';

const SALT_ROUNDS = 10;

export const register = asyncWrapper(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const existing = await db.User.findOne({ where: { email } });
  if (existing) return next(new AppError('Email already in use.', 409));

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await db.User.create({ name, email, password_hash, role });

  return res.status(201).json({
    message: 'User registered successfully.',
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

export const login = asyncWrapper(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await db.User.findOne({ where: { email } });
  if (!user) return next(new AppError('Invalid email or password.', 401));

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) return next(new AppError('Invalid email or password.', 401));

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({
    message: 'Login successful.',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});
