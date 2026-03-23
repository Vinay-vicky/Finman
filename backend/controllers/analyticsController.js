const analyticsService = require('../services/analyticsService');

const getSummary = async (req, res) => {
  try {
    const summary = await analyticsService.getSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCategoryCharts = async (req, res) => {
  try {
    const charts = await analyticsService.getCategoryCharts(req.user.id);
    res.json(charts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getSummary,
  getCategoryCharts,
};
