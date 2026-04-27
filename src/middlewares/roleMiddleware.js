/**
 * Restrict access to specific roles.
 * Usage: restrictTo('principal', 'teacher')
 * Must be used after authMiddleware.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions.' });
    }
    next();
  };
};

export default restrictTo;
