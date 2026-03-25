const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../middleware/authMiddleware');
const { OAuth2Client } = require('google-auth-library');
const AppError = require('../utils/appError');
const crypto = require('crypto');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);
const REFRESH_COOKIE_NAME = 'refreshToken';

const signAccessToken = (user) => jwt.sign(
  { id: user.id, username: user.username },
  SECRET_KEY,
  { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
);

const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
});

const createRefreshToken = (user) => jwt.sign(
  {
    sub: String(user.id),
    nonce: crypto.randomBytes(16).toString('hex'),
  },
  REFRESH_TOKEN_SECRET,
  { expiresIn: `${REFRESH_TOKEN_EXPIRES_DAYS}d` }
);

const issueSession = async (res, user) => {
  if (!REFRESH_TOKEN_SECRET) {
    throw new AppError(500, 'Refresh token secret is not configured.');
  }

  const refreshToken = createRefreshToken(user);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await authService.createRefreshTokenSession(user.id, refreshTokenHash, expiresAt);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());

  return {
    token: signAccessToken(user),
    user: { id: user.id, username: user.username },
  };
};


const register = async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const user = await authService.registerUser(username, password);
    const session = await issueSession(res, user);

    res.status(201).json(session);
  } catch (err) {
    if (err.message === 'Username already exists.') {
      return next(new AppError(400, err.message));
    }

    return next(err);
  }
};

const login = async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const user = await authService.loginUser(username, password);
    const session = await issueSession(res, user);

    res.json(session);
  } catch (err) {
    if (err.message === 'Invalid username or password.') {
      return next(new AppError(400, err.message));
    }

    return next(err);
  }
};

const googleLogin = async (req, res, next) => {
  const { credential } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    const user = await authService.oauthLogin(email, name);
    const session = await issueSession(res, user);

    res.json(session);
  } catch (err) {
    console.error('Google Auth Error:', err);
    return next(new AppError(401, 'Invalid Google token.'));
  }
};

const refresh = async (req, res, next) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!tokenFromCookie) {
    return next(new AppError(401, 'Refresh token is missing.'));
  }

  if (!REFRESH_TOKEN_SECRET) {
    return next(new AppError(500, 'Refresh token secret is not configured.'));
  }

  try {
    jwt.verify(tokenFromCookie, REFRESH_TOKEN_SECRET);

    const tokenHash = hashToken(tokenFromCookie);
    const session = await authService.getValidRefreshTokenSession(tokenHash);
    if (!session) {
      return next(new AppError(401, 'Refresh session is invalid or expired.'));
    }

    const user = await authService.getUserById(session.user_id);
    if (!user) {
      await authService.revokeRefreshTokenSession(tokenHash);
      res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
      return next(new AppError(401, 'Session user no longer exists.'));
    }

    await authService.revokeRefreshTokenSession(tokenHash);
    const nextSession = await issueSession(res, user);
    return res.json(nextSession);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
    return next(new AppError(401, 'Invalid or expired refresh token.'));
  }
};

const logout = async (req, res, next) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];

  try {
    if (tokenFromCookie) {
      await authService.revokeRefreshTokenSession(hashToken(tokenFromCookie));
    }

    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return next(err);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    await authService.revokeAllRefreshTokensForUser(req.user.id);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
    return res.json({ success: true, message: 'Logged out from all sessions.' });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  refresh,
  logout,
  logoutAll,
};

