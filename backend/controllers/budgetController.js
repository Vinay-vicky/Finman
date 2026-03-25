const budgetService = require('../services/budgetService');
const AppError = require('../utils/appError');

const getBudgets = async (req, res, next) => {
  try {
    const budgets = await budgetService.getBudgets(req.user.id);
    res.json(budgets);
  } catch (err) {
    next(err);
  }
};

const createBudget = async (req, res, next) => {
  try {
    const budget = await budgetService.createBudget(req.user.id, req.body);
    res.status(201).json(budget);
  } catch (err) {
    next(err);
  }
};

const deleteBudget = async (req, res, next) => {
  try {
    await budgetService.deleteBudget(req.user.id, req.params.id);
    res.json({ message: 'Budget deleted', id: req.params.id });
  } catch (err) {
    if (err.message === 'Budget not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }

    return next(err);
  }
};

module.exports = {
  getBudgets,
  createBudget,
  deleteBudget,
};
