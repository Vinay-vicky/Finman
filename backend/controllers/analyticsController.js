const { Parser } = require('json2csv');
const analyticsService = require('../services/analyticsService');

const pickRange = (query) => ({
  from: query.from,
  to: query.to,
});

const getSummary = async (req, res, next) => {
  try {
    const summary = await analyticsService.getSummary(req.user.id, pickRange(req.query));
    res.json(summary);
  } catch (err) {
    next(err);
  }
};

const getCategoryCharts = async (req, res, next) => {
  try {
    const charts = await analyticsService.getCategoryCharts(req.user.id, pickRange(req.query));
    res.json(charts);
  } catch (err) {
    next(err);
  }
};

const getComparison = async (req, res, next) => {
  try {
    const comparison = await analyticsService.getComparison(req.user.id, pickRange(req.query));
    res.json(comparison);
  } catch (err) {
    next(err);
  }
};

const getReport = async (req, res, next) => {
  try {
    const report = await analyticsService.getReport(req.user.id, pickRange(req.query));

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse([
        {
          from: report.range.from || '',
          to: report.range.to || '',
          income: report.summary.income,
          expense: report.summary.expense,
          balance: report.summary.balance,
          topCategories: report.categories
            .slice(0, 5)
            .map((c) => `${c.name}: ${c.value}`)
            .join(' | '),
        },
      ]);

      res.header('Content-Type', 'text/csv');
      res.attachment('analytics-report.csv');
      return res.send(csv);
    }

    return res.json(report);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getSummary,
  getCategoryCharts,
  getComparison,
  getReport,
};
