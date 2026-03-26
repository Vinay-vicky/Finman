const { db } = require('../database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const OTP_PEPPER = process.env.OTP_PEPPER || 'replace-this-otp-pepper';
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 5);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RATE_LIMIT_WINDOW_MINUTES = Number(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 15);
const OTP_RATE_LIMIT_MAX_REQUESTS = Number(process.env.OTP_RATE_LIMIT_MAX_REQUESTS || 3);

const normalizeMobileNumber = (mobile) => {
  const raw = String(mobile || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

const hashOtp = (mobileNumber, otp) => crypto
  .createHash('sha256')
  .update(`${mobileNumber}|${otp}|${OTP_PEPPER}`)
  .digest('hex');

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const registerUser = async (username, password) => {
  const existing = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
  if (existing.rows.length > 0) {
    throw new Error('Username already exists.');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const result = await db.execute({
    sql: 'INSERT INTO users (username, password) VALUES (?, ?)',
    args: [username, hashedPassword]
  });
  
  const insertId = Number(result.lastInsertRowid);
  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [insertId] });
  return userResult.rows[0];
};

const loginUser = async (username, password) => {
  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
  if (userResult.rows.length === 0) {
    throw new Error('Invalid username or password.');
  }

  const user = userResult.rows[0];
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new Error('Invalid username or password.');
  }

  return user;
};

const oauthLogin = async (email, name) => {
  const userResult = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [email] });
  if (userResult.rows.length > 0) {
    return userResult.rows[0];
  }
  
  // Register new Google user with a massive random unguessable password
  const randomPass = crypto.randomBytes(32).toString('hex');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(randomPass, salt);

  const result = await db.execute({
    sql: 'INSERT INTO users (username, password) VALUES (?, ?)',
    args: [email, hashedPassword]
  });
  
  const insertId = Number(result.lastInsertRowid);
  const newUser = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [insertId] });
  return newUser.rows[0];
};

const getUserById = async (userId) => {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
  return result.rows[0] || null;
};

const createRefreshTokenSession = async (userId, tokenHash, expiresAt, metadata = {}) => {
  await db.execute({
    sql: `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      userId,
      tokenHash,
      expiresAt,
      metadata.userAgent || null,
      metadata.ipAddress || null,
    ],
  });
};

const getValidRefreshTokenSession = async (tokenHash) => {
  const result = await db.execute({
    sql: `
      SELECT * FROM refresh_tokens
      WHERE token_hash = ?
        AND revoked_at IS NULL
        AND datetime(expires_at) > datetime('now')
      LIMIT 1
    `,
    args: [tokenHash],
  });

  return result.rows[0] || null;
};

const listRefreshTokenSessions = async (userId) => {
  const result = await db.execute({
    sql: `
      SELECT id, user_id, expires_at, revoked_at, createdAt, user_agent, ip_address
      FROM refresh_tokens
      WHERE user_id = ?
      ORDER BY createdAt DESC
    `,
    args: [userId],
  });

  return result.rows;
};

const revokeRefreshTokenSession = async (tokenHash) => {
  await db.execute({
    sql: `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
        AND revoked_at IS NULL
    `,
    args: [tokenHash],
  });
};

const revokeRefreshTokenSessionById = async (userId, sessionId) => {
  const result = await db.execute({
    sql: `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
        AND revoked_at IS NULL
    `,
    args: [sessionId, userId],
  });

  if (result.rowsAffected === 0) {
    throw new Error('Session not found or already revoked.');
  }
};

const revokeAllRefreshTokensForUser = async (userId) => {
  await db.execute({
    sql: `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND revoked_at IS NULL
    `,
    args: [userId],
  });
};

const getUserByMobileNumber = async (mobileNumber) => {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE mobile_number = ? LIMIT 1',
    args: [mobileNumber],
  });
  return result.rows[0] || null;
};

const createUserWithMobileNumber = async (mobileNumber) => {
  const randomPassword = crypto.randomBytes(32).toString('hex');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(randomPassword, salt);

  let username = `mobile_${mobileNumber.replace(/\D/g, '')}`;
  let suffix = 0;

  // Ensure username uniqueness without exposing mobile directly in conflicts.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = suffix === 0 ? username : `${username}_${suffix}`;
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE username = ? LIMIT 1', args: [candidate] });
    if (existing.rows.length === 0) {
      username = candidate;
      break;
    }
    suffix += 1;
  }

  const result = await db.execute({
    sql: 'INSERT INTO users (username, mobile_number, password) VALUES (?, ?, ?)',
    args: [username, mobileNumber, hashedPassword],
  });

  const insertId = Number(result.lastInsertRowid);
  const user = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [insertId] });
  return user.rows[0];
};

const getRecentOtpRequestCount = async (mobileNumber, purpose) => {
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS total
      FROM mobile_otp_codes
      WHERE mobile_number = ?
        AND purpose = ?
        AND datetime(createdAt) >= datetime('now', ?)
    `,
    args: [mobileNumber, purpose, `-${OTP_RATE_LIMIT_WINDOW_MINUTES} minutes`],
  });
  return Number(result.rows[0]?.total || 0);
};

const invalidateMobileOtpCodes = async (mobileNumber, purpose) => {
  await db.execute({
    sql: `
      UPDATE mobile_otp_codes
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE mobile_number = ?
        AND purpose = ?
        AND consumed_at IS NULL
        AND datetime(expires_at) > datetime('now')
    `,
    args: [mobileNumber, purpose],
  });
};

const createMobileOtpCode = async (mobileNumber, purpose, metadata = {}) => {
  const recentCount = await getRecentOtpRequestCount(mobileNumber, purpose);
  if (recentCount >= OTP_RATE_LIMIT_MAX_REQUESTS) {
    throw new Error('Too many OTP requests. Please try again later.');
  }

  await invalidateMobileOtpCodes(mobileNumber, purpose);

  const otp = generateOtp();
  const otpHash = hashOtp(mobileNumber, otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await db.execute({
    sql: `
      INSERT INTO mobile_otp_codes (mobile_number, purpose, otp_hash, attempts, max_attempts, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    `,
    args: [
      mobileNumber,
      purpose,
      otpHash,
      OTP_MAX_ATTEMPTS,
      expiresAt,
      metadata.ipAddress || null,
      metadata.userAgent || null,
    ],
  });

  return {
    otp,
    expiresAt,
    ttlMinutes: OTP_TTL_MINUTES,
  };
};

const getLatestActiveMobileOtpCode = async (mobileNumber, purpose) => {
  const result = await db.execute({
    sql: `
      SELECT *
      FROM mobile_otp_codes
      WHERE mobile_number = ?
        AND purpose = ?
        AND consumed_at IS NULL
        AND datetime(expires_at) > datetime('now')
      ORDER BY id DESC
      LIMIT 1
    `,
    args: [mobileNumber, purpose],
  });

  return result.rows[0] || null;
};

const incrementMobileOtpAttempt = async (otpId) => {
  await db.execute({
    sql: 'UPDATE mobile_otp_codes SET attempts = attempts + 1 WHERE id = ?',
    args: [otpId],
  });
};

const consumeMobileOtpCode = async (otpId) => {
  await db.execute({
    sql: 'UPDATE mobile_otp_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [otpId],
  });
};

const verifyMobileOtpCode = async (mobileNumber, otp, purpose = 'login') => {
  const latest = await getLatestActiveMobileOtpCode(mobileNumber, purpose);
  if (!latest) {
    throw new Error('OTP is invalid or expired.');
  }

  if (Number(latest.attempts || 0) >= Number(latest.max_attempts || OTP_MAX_ATTEMPTS)) {
    await consumeMobileOtpCode(latest.id);
    throw new Error('OTP attempts exceeded. Please request a new OTP.');
  }

  const incomingHash = hashOtp(mobileNumber, otp);
  const stored = String(latest.otp_hash || '');
  const a = Buffer.from(incomingHash, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) {
    await incrementMobileOtpAttempt(latest.id);
    const refreshed = await db.execute({ sql: 'SELECT attempts, max_attempts FROM mobile_otp_codes WHERE id = ?', args: [latest.id] });
    const attempts = Number(refreshed.rows[0]?.attempts || 0);
    const maxAttempts = Number(refreshed.rows[0]?.max_attempts || OTP_MAX_ATTEMPTS);
    if (attempts >= maxAttempts) {
      await consumeMobileOtpCode(latest.id);
      throw new Error('OTP attempts exceeded. Please request a new OTP.');
    }
    throw new Error('OTP is invalid or expired.');
  }

  await consumeMobileOtpCode(latest.id);
  return true;
};

const getOtpDeliveryMetrics = async () => {
  const result = await db.execute({
    sql: `
      SELECT
        MAX(createdAt) AS lastOtpIssuedAt,
        SUM(CASE WHEN datetime(createdAt) >= datetime('now', '-1 hour') THEN 1 ELSE 0 END) AS issuedLastHour,
        SUM(CASE WHEN consumed_at IS NOT NULL AND datetime(consumed_at) >= datetime('now', '-1 hour') THEN 1 ELSE 0 END) AS consumedLastHour,
        SUM(CASE WHEN consumed_at IS NULL AND datetime(expires_at) > datetime('now') THEN 1 ELSE 0 END) AS activeUnconsumed
      FROM mobile_otp_codes
    `,
    args: [],
  });

  return {
    lastOtpIssuedAt: result.rows[0]?.lastOtpIssuedAt || null,
    issuedLastHour: Number(result.rows[0]?.issuedLastHour || 0),
    consumedLastHour: Number(result.rows[0]?.consumedLastHour || 0),
    activeUnconsumed: Number(result.rows[0]?.activeUnconsumed || 0),
  };
};

module.exports = {
  registerUser,
  loginUser,
  oauthLogin,
  getUserById,
  getUserByMobileNumber,
  createUserWithMobileNumber,
  normalizeMobileNumber,
  createMobileOtpCode,
  verifyMobileOtpCode,
  getOtpDeliveryMetrics,
  createRefreshTokenSession,
  getValidRefreshTokenSession,
  listRefreshTokenSessions,
  revokeRefreshTokenSession,
  revokeRefreshTokenSessionById,
  revokeAllRefreshTokensForUser,
};
