const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');

const SECRET_KEY = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  if (!SECRET_KEY) {
    return next(new AppError(500, 'Server authentication is not configured.'));
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    return next(new AppError(401, 'Access denied. No token provided.'));
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return next(new AppError(403, 'Invalid or expired token.'));
    }

    req.user = user;
    next();
  });
};

module.exports = { authenticateToken, SECRET_KEY };
