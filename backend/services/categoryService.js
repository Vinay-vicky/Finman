const { db } = require('../database');

const listCategories = async (userId, type) => {
  let sql = 'SELECT * FROM categories WHERE user_id = ?';
  const args = [userId];

  if (type) {
    sql += ' AND type = ?';
    args.push(type);
  }

  sql += ' ORDER BY name ASC';
  const result = await db.execute({ sql, args });
  return result.rows;
};

const createCategory = async (userId, data) => {
  const result = await db.execute({
    sql: 'INSERT INTO categories (user_id, name, type, color) VALUES (?, ?, ?, ?)',
    args: [userId, data.name, data.type || null, data.color || '#10b981'],
  });

  const inserted = await db.execute({
    sql: 'SELECT * FROM categories WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  });

  return inserted.rows[0];
};

const updateCategory = async (userId, id, data) => {
  const result = await db.execute({
    sql: 'UPDATE categories SET name = ?, type = ?, color = ? WHERE id = ? AND user_id = ?',
    args: [data.name, data.type || null, data.color || '#10b981', id, userId],
  });

  if (result.rowsAffected === 0) {
    throw new Error('Category not found or unauthorized.');
  }

  const updated = await db.execute({ sql: 'SELECT * FROM categories WHERE id = ?', args: [id] });
  return updated.rows[0];
};

const deleteCategory = async (userId, id) => {
  const result = await db.execute({
    sql: 'DELETE FROM categories WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });

  if (result.rowsAffected === 0) {
    throw new Error('Category not found or unauthorized.');
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
