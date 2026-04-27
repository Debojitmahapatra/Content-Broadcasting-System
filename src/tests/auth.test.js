/**
 * Auth Tests – register & login
 *
 * Run with: node --experimental-vm-modules node_modules/.bin/jest src/tests/auth.test.js
 * Or add to package.json scripts: "test": "jest --experimental-vm-modules"
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Minimal mocks — no real DB or HTTP server needed
// ---------------------------------------------------------------------------

// Mock db.User
const mockUser = {
  id: 1,
  name: 'Jane Teacher',
  email: 'teacher@school.com',
  password_hash: await bcrypt.hash('Password123!', 10),
  role: 'teacher',
};

const db = {
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
};

// Mock AppError
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 500 ? 'error' : 'fail';
  }
}

// Inline controller logic (mirrors authController.js without import side-effects)
const SALT_ROUNDS = 10;

async function register(req, res, next) {
  const { name, email, password, role } = req.body;
  const existing = await db.User.findOne({ where: { email } });
  if (existing) return next(new AppError('Email already in use.', 409));
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await db.User.create({ name, email, password_hash, role });
  return res.status(201).json({
    message: 'User registered successfully.',
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

async function login(req, res, next) {
  const { email, password } = req.body;
  const user = await db.User.findOne({ where: { email } });
  if (!user) return next(new AppError('Invalid email or password.', 401));
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) return next(new AppError('Invalid email or password.', 401));
  const token = jwt.sign({ id: user.id, role: user.role }, 'test_secret', { expiresIn: '7d' });
  return res.json({
    message: 'Login successful.',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth – register', () => {
  beforeEach(() => jest.clearAllMocks());

  test('registers a new user and returns 201', async () => {
    db.User.findOne.mockResolvedValue(null); // no existing user
    db.User.create.mockResolvedValue({ id: 2, name: 'Jane Teacher', email: 'teacher@school.com', role: 'teacher' });

    const req = { body: { name: 'Jane Teacher', email: 'teacher@school.com', password: 'Password123!', role: 'teacher' } };
    const res = mockRes();
    const next = jest.fn();

    await register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User registered successfully.' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 409 when email is already in use', async () => {
    db.User.findOne.mockResolvedValue(mockUser); // existing user

    const req = { body: { name: 'Jane', email: 'teacher@school.com', password: 'pass', role: 'teacher' } };
    const res = mockRes();
    const next = jest.fn();

    await register(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(res.json).not.toHaveBeenCalled();
  });

  test('hashes the password before storing', async () => {
    db.User.findOne.mockResolvedValue(null);
    let capturedHash = null;
    db.User.create.mockImplementation(async (data) => {
      capturedHash = data.password_hash;
      return { id: 3, ...data };
    });

    const req = { body: { name: 'Bob', email: 'bob@school.com', password: 'MySecret99', role: 'teacher' } };
    await register(req, mockRes(), jest.fn());

    expect(capturedHash).not.toBe('MySecret99');
    const isHashed = await bcrypt.compare('MySecret99', capturedHash);
    expect(isHashed).toBe(true);
  });
});

describe('Auth – login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns a JWT token on valid credentials', async () => {
    db.User.findOne.mockResolvedValue(mockUser);

    const req = { body: { email: 'teacher@school.com', password: 'Password123!' } };
    const res = mockRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Login successful.', token: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when user does not exist', async () => {
    db.User.findOne.mockResolvedValue(null);

    const req = { body: { email: 'nobody@school.com', password: 'pass' } };
    const res = mockRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('returns 401 on wrong password', async () => {
    db.User.findOne.mockResolvedValue(mockUser);

    const req = { body: { email: 'teacher@school.com', password: 'WrongPassword' } };
    const res = mockRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('JWT payload contains id and role', async () => {
    db.User.findOne.mockResolvedValue(mockUser);

    const req = { body: { email: 'teacher@school.com', password: 'Password123!' } };
    const res = mockRes();

    await login(req, res, jest.fn());

    const { token } = res.json.mock.calls[0][0];
    const decoded = jwt.verify(token, 'test_secret');
    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.role).toBe(mockUser.role);
  });
});
