const budgetService = require('../services/budgetService');

const getBudgets = async (req, res) => {
  try {
    const budgets = await budgetService.getBudgets(req.user.id);
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createBudget = async (req, res) => {
  try {
    const budget = await budgetService.createBudget(req.user.id, req.body);
    res.status(201).json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteBudget = async (req, res) => {
  try {
    await budgetService.deleteBudget(req.user.id, req.params.id);
    res.json({ message: 'Budget deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getBudgets,
  createBudget,
  deleteBudget,
};
