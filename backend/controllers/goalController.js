const goalService = require('../services/goalService');
const AppError = require('../utils/appError');

const getGoals = async (req, res, next) => {
  try {
    const goals = await goalService.getGoals(req.user.id);
    res.json(goals);
  } catch (err) {
    next(err);
  }
};

const createGoal = async (req, res, next) => {
  try {
    const goal = await goalService.createGoal(req.user.id, req.body);
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
};

const updateGoal = async (req, res, next) => {
  try {
    await goalService.updateGoal(req.user.id, req.params.id, req.body);
    res.json({ message: 'Goal updated' });
  } catch (err) {
    if (err.message === 'Goal not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }

    return next(err);
  }
};

const deleteGoal = async (req, res, next) => {
  try {
    await goalService.deleteGoal(req.user.id, req.params.id);
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    if (err.message === 'Goal not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }

    return next(err);
  }
};

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
};
