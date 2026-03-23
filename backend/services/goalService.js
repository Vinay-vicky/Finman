const { db } = require('../database');

const getGoals = async (userId) => {
  const result = await db.execute({ sql: 'SELECT * FROM goals WHERE user_id = ?', args: [userId] });
  return result.rows;
};

const createGoal = async (userId, data) => {
  const current_amount = data.current_amount || 0;
  const result = await db.execute({
    sql: 'INSERT INTO goals (user_id, name, target_amount, current_amount, deadline) VALUES (?, ?, ?, ?, ?)',
    args: [userId, data.name, data.target_amount, current_amount, data.deadline]
  });
  const newGoal = await db.execute({ sql: 'SELECT * FROM goals WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return newGoal.rows[0];
};

const updateGoal = async (userId, goalId, data) => {
  const result = await db.execute({
    sql: 'UPDATE goals SET name=?, target_amount=?, current_amount=?, deadline=? WHERE id=? AND user_id=?',
    args: [data.name, data.target_amount, data.current_amount, data.deadline, goalId, userId]
  });
  if (result.rowsAffected === 0) {
    throw new Error('Goal not found or unauthorized.');
  }
  const updatedGoal = await db.execute({ sql: 'SELECT * FROM goals WHERE id = ?', args: [goalId] });
  return updatedGoal.rows[0];
};

const deleteGoal = async (userId, goalId) => {
  const result = await db.execute({
    sql: 'DELETE FROM goals WHERE id = ? AND user_id = ?',
    args: [goalId, userId]
  });
  if (result.rowsAffected === 0) {
    throw new Error('Goal not found or unauthorized.');
  }
  return result;
};

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
};
