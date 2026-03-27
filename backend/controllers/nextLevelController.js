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

const submitAnomalyFeedback = async (req, res, next) => {
  try {
    const data = await nextLevelService.submitAnomalyFeedback(req.user.id, req.body || {});
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

const parseReceiptOcr = async (req, res, next) => {
  try {
    const data = await nextLevelService.parseReceiptOcr(req.user.id, req.body || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const simulateCashflowWhatIf = async (req, res, next) => {
  try {
    const data = await nextLevelService.simulateCashflowWhatIf(req.user.id, req.body || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getDebtPayoffPlan = async (req, res, next) => {
  try {
    const data = await nextLevelService.getDebtPayoffPlan(req.user.id, req.body || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getFinancialCalendar = async (req, res, next) => {
  try {
    const days = Number(req.query?.days || 45);
    const data = await nextLevelService.getFinancialCalendar(req.user.id, days);
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

const getHousehold = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return next(new AppError(400, 'Invalid household id.'));
    const data = await nextLevelService.getHouseholdById(req.user.id, id);
    if (!data) return next(new AppError(404, 'Household not found or inaccessible.'));
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const listHouseholdMembers = async (req, res, next) => {
  try {
    const householdId = Number(req.params.id);
    if (!householdId) return next(new AppError(400, 'Invalid household id.'));
    const data = await nextLevelService.listHouseholdMembers(req.user.id, householdId);
    res.json(data);
  } catch (err) {
    if (err.message === 'Household not found or inaccessible.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const updateHouseholdMemberRole = async (req, res, next) => {
  try {
    const householdId = Number(req.params.id);
    const memberUserId = Number(req.params.memberId);
    const role = req.body?.role;
    if (!householdId || !memberUserId || !role) {
      return next(new AppError(400, 'Invalid member role update payload.'));
    }

    const data = await nextLevelService.updateHouseholdMemberRole(req.user.id, householdId, memberUserId, role);
    res.json(data);
  } catch (err) {
    if (
      err.message === 'Household not found.'
      || err.message === 'Only household owner can manage member roles.'
      || err.message === 'Owner role cannot be changed.'
      || err.message === 'Household member not found.'
    ) {
      return next(new AppError(400, err.message));
    }
    return next(err);
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

const listGoalAutopilotRules = async (req, res, next) => {
  try {
    const data = await nextLevelService.listGoalAutopilotRules(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const upsertGoalAutopilotRule = async (req, res, next) => {
  try {
    const data = await nextLevelService.upsertGoalAutopilotRule(req.user.id, req.body || {});
    res.status(req.body?.id ? 200 : 201).json(data);
  } catch (err) {
    next(err);
  }
};

const deleteGoalAutopilotRule = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return next(new AppError(400, 'Invalid autopilot rule id.'));
    const data = await nextLevelService.deleteGoalAutopilotRule(req.user.id, id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const projectGoalAutopilot = async (req, res, next) => {
  try {
    const data = await nextLevelService.projectGoalAutopilot(req.user.id);
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

const getWeeklyCfoBrief = async (req, res, next) => {
  try {
    const data = await nextLevelService.getWeeklyCfoBrief(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getFinancialHealthScore = async (req, res, next) => {
  try {
    const data = await nextLevelService.getFinancialHealthScore(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getAutoCategorySuggestions = async (req, res, next) => {
  try {
    const title = req.query?.title || '';
    const amount = Number(req.query?.amount || 0);
    const data = await nextLevelService.getAutoCategorySuggestions(req.user.id, title, amount);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const submitAutoCategoryFeedback = async (req, res, next) => {
  try {
    const data = await nextLevelService.submitAutoCategoryFeedback(req.user.id, req.body || {});
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

const reconcileStatementRows = async (req, res, next) => {
  try {
    const data = await nextLevelService.reconcileStatementRows(req.user.id, req.body || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const setHouseholdSpendingLimit = async (req, res, next) => {
  try {
    const householdId = Number(req.params.id);
    const memberUserId = Number(req.params.memberId);
    const monthlyLimit = Number(req.body?.monthlyLimit || 0);
    const data = await nextLevelService.setHouseholdSpendingLimit(req.user.id, householdId, memberUserId, monthlyLimit);
    res.json(data);
  } catch (err) {
    if (err.message === 'Household not found or inaccessible.' || err.message === 'Only household owner can set spending limits.') {
      return next(new AppError(400, err.message));
    }
    return next(err);
  }
};

const listHouseholdSpendingLimits = async (req, res, next) => {
  try {
    const householdId = Number(req.params.id);
    const data = await nextLevelService.listHouseholdSpendingLimits(req.user.id, householdId);
    res.json(data);
  } catch (err) {
    if (err.message === 'Household not found or inaccessible.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const createHouseholdApprovalRequest = async (req, res, next) => {
  try {
    const data = await nextLevelService.createHouseholdApprovalRequest(req.user.id, req.body || {});
    res.status(201).json(data);
  } catch (err) {
    if (err.message === 'Household not found or inaccessible.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const listHouseholdApprovals = async (req, res, next) => {
  try {
    const householdId = Number(req.params.id);
    const status = String(req.query?.status || '').trim();
    const data = await nextLevelService.listHouseholdApprovals(req.user.id, householdId, status);
    res.json(data);
  } catch (err) {
    if (err.message === 'Household not found or inaccessible.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const decideHouseholdApproval = async (req, res, next) => {
  try {
    const approvalId = Number(req.params.approvalId);
    const decision = String(req.body?.decision || '').trim();
    const note = String(req.body?.note || '').trim();
    const data = await nextLevelService.decideHouseholdApproval(req.user.id, approvalId, decision, note);
    res.json(data);
  } catch (err) {
    if (
      err.message === 'Approval request not found.'
      || err.message === 'Approval request already decided.'
      || err.message === 'Household not found or inaccessible.'
      || err.message === 'Only household owner/editor can decide approvals.'
    ) {
      return next(new AppError(400, err.message));
    }
    return next(err);
  }
};

const listApprovalComments = async (req, res, next) => {
  try {
    const approvalId = Number(req.params.approvalId);
    const data = await nextLevelService.listApprovalComments(req.user.id, approvalId);
    res.json(data);
  } catch (err) {
    if (err.message === 'Approval request not found.' || err.message === 'Household not found or inaccessible.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const addApprovalComment = async (req, res, next) => {
  try {
    const approvalId = Number(req.params.approvalId);
    const comment = String(req.body?.comment || '').trim();
    if (!comment) return next(new AppError(400, 'Comment is required.'));
    const data = await nextLevelService.addApprovalComment(req.user.id, approvalId, comment);
    res.status(201).json(data);
  } catch (err) {
    if (err.message === 'Approval request not found.' || err.message === 'Household not found or inaccessible.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
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
  submitAnomalyFeedback,
  parseReceiptOcr,
  simulateCashflowWhatIf,
  getDebtPayoffPlan,
  getFinancialCalendar,
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
  getHousehold,
  listHouseholdMembers,
  updateHouseholdMemberRole,
  createHousehold,
  joinHousehold,
  getTaxSummary,
  getGoalOptimizer,
  listGoalAutopilotRules,
  upsertGoalAutopilotRule,
  deleteGoalAutopilotRule,
  projectGoalAutopilot,
  getExecutiveBrief,
  getWeeklyCfoBrief,
  getFinancialHealthScore,
  getAutoCategorySuggestions,
  submitAutoCategoryFeedback,
  reconcileStatementRows,
  setHouseholdSpendingLimit,
  listHouseholdSpendingLimits,
  createHouseholdApprovalRequest,
  listHouseholdApprovals,
  decideHouseholdApproval,
  listApprovalComments,
  addApprovalComment,
  listActivityTimeline,
  exportActivityTimeline,
  verifyActivityIntegrity,
};
