const analyticsService = require('../services/analyticsService');

const getSummary = async (req, res, next) => {
  try {
    const summary = await analyticsService.getSummary(req.user.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
};

const getCategoryCharts = async (req, res, next) => {
  try {
    const charts = await analyticsService.getCategoryCharts(req.user.id);
    res.json(charts);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSummary,
  getCategoryCharts,
};
