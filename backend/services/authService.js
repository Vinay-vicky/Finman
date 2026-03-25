const { db } = require('../database');
const bcrypt = require('bcrypt');

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
  const crypto = require('crypto');
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

const createRefreshTokenSession = async (userId, tokenHash, expiresAt) => {
  await db.execute({
    sql: 'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    args: [userId, tokenHash, expiresAt],
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

module.exports = {
  registerUser,
  loginUser,
  oauthLogin,
  getUserById,
  createRefreshTokenSession,
  getValidRefreshTokenSession,
  revokeRefreshTokenSession,
  revokeAllRefreshTokensForUser,
};
