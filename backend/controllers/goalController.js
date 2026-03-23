const goalService = require('../services/goalService');

const getGoals = async (req, res) => {
  try {
    const goals = await goalService.getGoals(req.user.id);
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createGoal = async (req, res) => {
  try {
    const goal = await goalService.createGoal(req.user.id, req.body);
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateGoal = async (req, res) => {
  try {
    await goalService.updateGoal(req.user.id, req.params.id, req.body);
    res.json({ message: 'Goal updated' });
  } catch (err) {
    if (err.message === 'Goal not found or unauthorized.') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

const deleteGoal = async (req, res) => {
  try {
    await goalService.deleteGoal(req.user.id, req.params.id);
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    if (err.message === 'Goal not found or unauthorized.') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
};
