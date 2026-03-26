const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../middleware/authMiddleware');
const { OAuth2Client } = require('google-auth-library');
const AppError = require('../utils/appError');
const crypto = require('crypto');
const otpDeliveryService = require('../services/otpDeliveryService');

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

const clearCookieOptions = () => {
  const { maxAge, ...options } = cookieOptions();
  return options;
};

const createRefreshToken = (user) => jwt.sign(
  {
    sub: String(user.id),
    nonce: crypto.randomBytes(16).toString('hex'),
  },
  REFRESH_TOKEN_SECRET,
  { expiresIn: `${REFRESH_TOKEN_EXPIRES_DAYS}d` }
);

const issueSession = async (req, res, user) => {
  if (!REFRESH_TOKEN_SECRET) {
    throw new AppError(500, 'Refresh token secret is not configured.');
  }

  const refreshToken = createRefreshToken(user);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await authService.createRefreshTokenSession(user.id, refreshTokenHash, expiresAt, {
    userAgent: req.get('user-agent') || null,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());

  return {
    token: signAccessToken(user),
    user: { id: user.id, username: user.username },
  };
};


const register = async (req, res, next) => {
  const { username, password, mobileNumber } = req.body;

  try {
    const normalizedMobile = mobileNumber ? authService.normalizeMobileNumber(mobileNumber) : null;
    const user = await authService.registerUser(username, password, normalizedMobile);
    const session = await issueSession(req, res, user);

    res.status(201).json(session);
  } catch (err) {
    if (err.message === 'Username already exists.' || err.message === 'Mobile number is already registered.') {
      return next(new AppError(400, err.message));
    }

    return next(err);
  }
};

const login = async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const user = await authService.loginUser(username, password);
    const session = await issueSession(req, res, user);

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
    const { email } = payload;

    const user = await authService.oauthLogin(email);
    const session = await issueSession(req, res, user);

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
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions());
      return next(new AppError(401, 'Session user no longer exists.'));
    }

    await authService.revokeRefreshTokenSession(tokenHash);
    const nextSession = await issueSession(req, res, user);
    return res.json(nextSession);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions());
    return next(new AppError(401, 'Invalid or expired refresh token.'));
  }
};

const logout = async (req, res, next) => {
  const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];

  try {
    if (tokenFromCookie) {
      await authService.revokeRefreshTokenSession(hashToken(tokenFromCookie));
    }

    res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions());
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return next(err);
  }
};

const listSessions = async (req, res, next) => {
  try {
    const sessions = await authService.listRefreshTokenSessions(req.user.id);
    const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    let currentSessionId = null;

    if (tokenFromCookie) {
      const tokenHash = hashToken(tokenFromCookie);
      const currentSession = await authService.getValidRefreshTokenSession(tokenHash);
      if (currentSession) {
        currentSessionId = currentSession.id;
      }
    }

    return res.json({ sessions, currentSessionId });
  } catch (err) {
    return next(err);
  }
};

const revokeSession = async (req, res, next) => {
  try {
    await authService.revokeRefreshTokenSessionById(req.user.id, req.params.id);
    return res.json({ success: true, message: 'Session revoked.' });
  } catch (err) {
    if (err.message === 'Session not found or already revoked.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    await authService.revokeAllRefreshTokensForUser(req.user.id);
    res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions());
    return res.json({ success: true, message: 'Logged out from all sessions.' });
  } catch (err) {
    return next(err);
  }
};

const requestMobileOtp = async (req, res, next) => {
  try {
    const mobileNumber = authService.normalizeMobileNumber(req.body?.mobileNumber);
    if (!mobileNumber) {
      return next(new AppError(400, 'Valid mobile number is required.'));
    }

    const otpInfo = await authService.createMobileOtpCode(mobileNumber, 'login', {
      userAgent: req.get('user-agent') || null,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    });

    const delivery = await otpDeliveryService.sendOtp({
      mobileNumber,
      otp: otpInfo.otp,
      ttlMinutes: otpInfo.ttlMinutes,
    });

    const response = {
      success: true,
      message: 'If the mobile number is valid, an OTP has been sent.',
      expiresAt: otpInfo.expiresAt,
      deliveryProvider: delivery.provider,
    };

    if (otpDeliveryService.shouldExposeDevOtp()) {
      response.devOtp = otpInfo.otp;
    }

    return res.json(response);
  } catch (err) {
    if (err.message === 'Too many OTP requests. Please try again later.') {
      return next(new AppError(429, err.message));
    }
    const lower = String(err.message || '').toLowerCase();
    if (lower.includes('twilio') || lower.includes('mock otp provider is disabled')) {
      return next(new AppError(503, err.message || 'OTP provider is currently unavailable. Please try again shortly.'));
    }
    return next(err);
  }
};

const verifyMobileOtp = async (req, res, next) => {
  try {
    const mobileNumber = authService.normalizeMobileNumber(req.body?.mobileNumber);
    const otp = String(req.body?.otp || '').trim();
    if (!mobileNumber || !otp) {
      return next(new AppError(400, 'Mobile number and OTP are required.'));
    }

    await authService.verifyMobileOtpCode(mobileNumber, otp, 'login');

    let user = await authService.getUserByMobileNumber(mobileNumber);
    if (!user) {
      user = await authService.createUserWithMobileNumber(mobileNumber);
    }

    const session = await issueSession(req, res, user);
    return res.json(session);
  } catch (err) {
    if (err.message === 'OTP is invalid or expired.' || err.message === 'OTP attempts exceeded. Please request a new OTP.') {
      return next(new AppError(400, err.message));
    }
    return next(err);
  }
};

const getMobileOtpProviderHealth = async (req, res, next) => {
  try {
    const health = otpDeliveryService.getProviderHealth();
    const metrics = await authService.getOtpDeliveryMetrics();
    return res.json({
      success: true,
      health: {
        ...health,
        metrics,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  requestMobileOtp,
  verifyMobileOtp,
  getMobileOtpProviderHealth,
  refresh,
  logout,
  listSessions,
  revokeSession,
  logoutAll,
};

