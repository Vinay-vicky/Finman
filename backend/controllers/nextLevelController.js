const nextLevelService = require('../services/nextLevelService');
const AppError = require('../utils/appError');

const getCopilotSummary = async (req, res, next) => {
  try {
    const data = await nextLevelService.getCopilotSummary(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getCashflowForecast = async (req, res, next) => {
  try {
    const months = Number(req.query.months || 6);
    const data = await nextLevelService.getCashflowForecast(req.user.id, months);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getAnomalies = async (req, res, next) => {
  try {
    const data = await nextLevelService.getAnomalies(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getSubscriptions = async (req, res, next) => {
  try {
    const data = await nextLevelService.getSubscriptionsInsights(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const listNetWorth = async (req, res, next) => {
  try {
    const data = await nextLevelService.listNetWorthItems(req.user.id, req.query || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const upsertNetWorth = async (req, res, next) => {
  try {
    const item = await nextLevelService.upsertNetWorthItem(req.user.id, req.body);
    res.status(req.body?.id ? 200 : 201).json(item);
  } catch (err) {
    next(err);
  }
};

const deleteNetWorth = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return next(new AppError(400, 'Invalid net worth item id.'));
    const data = await nextLevelService.deleteNetWorthItem(req.user.id, id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const evaluateScenario = async (req, res, next) => {
  try {
    const data = await nextLevelService.evaluateScenario(req.user.id, req.body || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const listRules = async (req, res, next) => {
  try {
    const data = await nextLevelService.listRules(req.user.id, req.query || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const createRule = async (req, res, next) => {
  try {
    const data = await nextLevelService.createRule(req.user.id, req.body);
    res.status(req.body?.id ? 200 : 201).json(data);
  } catch (err) {
    next(err);
  }
};

const deleteRule = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return next(new AppError(400, 'Invalid rule id.'));
    const data = await nextLevelService.deleteRule(req.user.id, id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const simulateRules = async (req, res, next) => {
  try {
    const data = await nextLevelService.simulateRules(req.user.id, req.body || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const listBills = async (req, res, next) => {
  try {
    const data = await nextLevelService.listBills(req.user.id, req.query || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const upsertBill = async (req, res, next) => {
  try {
    const data = await nextLevelService.upsertBill(req.user.id, req.body || {});
    res.status(req.body?.id ? 200 : 201).json(data);
  } catch (err) {
    next(err);
  }
};

const deleteBill = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return next(new AppError(400, 'Invalid bill id.'));
    const data = await nextLevelService.deleteBill(req.user.id, id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getUpcomingBills = async (req, res, next) => {
  try {
    const data = await nextLevelService.getUpcomingBills(req.user.id, req.query || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const listHouseholds = async (req, res, next) => {
  try {
    const data = await nextLevelService.listHouseholds(req.user.id, req.query || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const createHousehold = async (req, res, next) => {
  try {
    const data = await nextLevelService.createHousehold(req.user.id, req.body || {});
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

const joinHousehold = async (req, res, next) => {
  try {
    const inviteCode = String(req.body?.inviteCode || '').trim();
    if (!inviteCode) return next(new AppError(400, 'Invite code is required.'));

    const data = await nextLevelService.joinHouseholdByInvite(req.user.id, inviteCode);
    if (!data) return next(new AppError(404, 'Household invite code not found.'));
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getTaxSummary = async (req, res, next) => {
  try {
    const year = req.query.year;
    const data = await nextLevelService.getTaxSummary(req.user.id, year);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getGoalOptimizer = async (req, res, next) => {
  try {
    const data = await nextLevelService.getGoalOptimizer(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getExecutiveBrief = async (req, res, next) => {
  try {
    const data = await nextLevelService.getExecutiveBrief(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const listActivityTimeline = async (req, res, next) => {
  try {
    const data = await nextLevelService.listActivityTimeline(req.user.id, req.query || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const exportActivityTimeline = async (req, res, next) => {
  try {
    const csv = await nextLevelService.exportActivityTimelineCsv(req.user.id, req.query || {});
    res.header('Content-Type', 'text/csv');
    res.attachment('activity-timeline.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

const verifyActivityIntegrity = async (req, res, next) => {
  try {
    const data = await nextLevelService.verifyActivityIntegrity(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCopilotSummary,
  getCashflowForecast,
  getAnomalies,
  getSubscriptions,
  listNetWorth,
  upsertNetWorth,
  deleteNetWorth,
  evaluateScenario,
  listRules,
  createRule,
  deleteRule,
  simulateRules,
  listBills,
  upsertBill,
  deleteBill,
  getUpcomingBills,
  listHouseholds,
  createHousehold,
  joinHousehold,
  getTaxSummary,
  getGoalOptimizer,
  getExecutiveBrief,
  listActivityTimeline,
  exportActivityTimeline,
  verifyActivityIntegrity,
};
