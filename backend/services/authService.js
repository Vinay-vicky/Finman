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

module.exports = {
  registerUser,
  loginUser,
};
