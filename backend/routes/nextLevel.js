const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const controller = require('../controllers/nextLevelController');
const { z } = require('zod');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticateToken);

const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	search: z.string().trim().max(100).optional(),
	kind: z.enum(['asset', 'liability']).optional(),
	active: z.enum(['true', 'false']).optional(),
	dueWithinDays: z.coerce.number().int().min(1).max(365).optional(),
});

const idParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

const forecastQuerySchema = z.object({
	months: z.coerce.number().int().min(1).max(36).optional(),
});

const calendarQuerySchema = z.object({
	days: z.coerce.number().int().min(1).max(120).optional(),
});

const taxQuerySchema = z.object({
	year: z.coerce.number().int().min(2000).max(2100).optional(),
});

const autoCategoryQuerySchema = z.object({
	title: z.string().trim().min(1).max(200),
	amount: z.coerce.number().optional(),
});

const activityQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	action: z.enum(['create', 'update', 'delete', 'join']).optional(),
	entityType: z.enum(['networth', 'rule', 'bill', 'household']).optional(),
	from: z.string().optional(),
	to: z.string().optional(),
});

const netWorthUpsertSchema = z.object({
	id: z.coerce.number().int().positive().optional(),
	name: z.string().trim().min(1).max(100),
	kind: z.enum(['asset', 'liability']),
	value: z.coerce.number(),
	category: z.string().trim().max(50).optional().nullable(),
	as_of: z.string().optional().nullable(),
});

const scenarioSchema = z.object({
	monthlySavingsBoost: z.coerce.number().optional(),
	expenseCutPct: z.coerce.number().min(0).max(100).optional(),
	months: z.coerce.number().int().min(1).max(120).optional(),
});

const ruleSchema = z.object({
	id: z.coerce.number().int().positive().optional(),
	name: z.string().trim().min(1).max(100),
	field: z.enum(['title', 'category', 'amount', 'type']),
	operator: z.enum(['contains', 'equals', 'gt', 'lt']),
	value: z.union([z.string(), z.number()]),
	action_type: z.enum(['set_category', 'set_type', 'set_title']),
	action_value: z.union([z.string(), z.number()]),
	enabled: z.boolean().optional(),
});

const ruleSimSchema = z.object({
	title: z.string().trim().min(1).max(200),
	amount: z.coerce.number().nonnegative(),
	category: z.string().trim().min(1).max(50),
	type: z.enum(['income', 'expense']),
});

const billUpsertSchema = z.object({
	id: z.coerce.number().int().positive().optional(),
	name: z.string().trim().min(1).max(100),
	amount: z.coerce.number().positive(),
	due_day: z.coerce.number().int().min(1).max(31),
	category: z.string().trim().max(50).optional().nullable(),
	active: z.boolean().optional(),
});

const householdCreateSchema = z.object({
	name: z.string().trim().min(1).max(100),
});

const householdJoinSchema = z.object({
	inviteCode: z.string().trim().min(4).max(32),
});

const householdMemberRoleSchema = z.object({
	role: z.enum(['editor', 'viewer']),
});

const categoryFeedbackSchema = z.object({
	inputTitle: z.string().trim().min(1).max(200),
	suggestedCategory: z.string().trim().max(50).optional().nullable(),
	selectedCategory: z.string().trim().min(1).max(50),
	confidence: z.coerce.number().min(0).max(1).optional(),
	source: z.string().trim().max(50).optional(),
});

const reconcileSchema = z.object({
	sourceLabel: z.string().trim().max(100).optional(),
	rows: z.array(z.object({
		title: z.string().trim().min(1).max(200),
		amount: z.coerce.number(),
		type: z.enum(['income', 'expense']).optional(),
		category: z.string().trim().max(50).optional(),
		date: z.string().optional(),
	})).max(500),
});

const householdLimitSchema = z.object({
	monthlyLimit: z.coerce.number().min(0),
});

const householdApprovalCreateSchema = z.object({
	householdId: z.coerce.number().int().positive(),
	amount: z.coerce.number().positive(),
	title: z.string().trim().min(1).max(200),
	category: z.string().trim().max(50).optional(),
	note: z.string().trim().max(300).optional(),
});

const householdApprovalDecisionSchema = z.object({
	decision: z.enum(['approved', 'rejected']),
	note: z.string().trim().max(300).optional(),
});

const anomalyFeedbackSchema = z.object({
	transactionId: z.coerce.number().int().positive().optional(),
	titlePattern: z.string().trim().max(120).optional(),
	amount: z.coerce.number().optional(),
	action: z.enum(['expected', 'ignore']).default('expected'),
});

const receiptOcrSchema = z.object({
	rawText: z.string().trim().min(1).max(10000),
});

const whatIfScenarioSchema = z.object({
	months: z.coerce.number().int().min(1).max(36).optional(),
	sipIncrease: z.coerce.number().min(0).optional(),
	rentIncreasePct: z.coerce.number().min(0).max(100).optional(),
	oneTimeExpense: z.coerce.number().min(0).optional(),
});

const debtPlanSchema = z.object({
	strategy: z.enum(['snowball', 'avalanche']).optional(),
	extraPayment: z.coerce.number().min(0).optional(),
	debts: z.array(z.object({
		name: z.string().trim().min(1).max(100),
		balance: z.coerce.number().nonnegative(),
		apr: z.coerce.number().min(0).max(200),
		minPayment: z.coerce.number().nonnegative(),
	})).max(30).optional(),
});

const goalAutopilotRuleSchema = z.object({
	id: z.coerce.number().int().positive().optional(),
	goalId: z.coerce.number().int().positive().optional().nullable(),
	name: z.string().trim().min(1).max(100),
	ruleType: z.enum(['roundup', 'payday_percent', 'threshold_sweep']),
	ruleValue: z.coerce.number().min(0),
	enabled: z.boolean().optional(),
});

const approvalCommentSchema = z.object({
	comment: z.string().trim().min(1).max(500),
});

// 12-feature pack endpoints
router.get('/copilot/summary', controller.getCopilotSummary);
router.get('/cashflow/forecast', validate(forecastQuerySchema, 'query'), controller.getCashflowForecast);
router.post('/cashflow/what-if', validate(whatIfScenarioSchema), controller.simulateCashflowWhatIf);
router.get('/calendar/events', validate(calendarQuerySchema, 'query'), controller.getFinancialCalendar);
router.get('/transactions/anomalies', controller.getAnomalies);
router.post('/transactions/anomalies/feedback', validate(anomalyFeedbackSchema), controller.submitAnomalyFeedback);
router.get('/subscriptions/insights', controller.getSubscriptions);
router.post('/receipts/ocr', validate(receiptOcrSchema), controller.parseReceiptOcr);
router.post('/debt/payoff-plan', validate(debtPlanSchema), controller.getDebtPayoffPlan);

router.get('/networth', validate(paginationQuerySchema, 'query'), controller.listNetWorth);
router.post('/networth', validate(netWorthUpsertSchema), controller.upsertNetWorth);
router.delete('/networth/:id', validate(idParamSchema, 'params'), controller.deleteNetWorth);

router.post('/scenarios/evaluate', validate(scenarioSchema), controller.evaluateScenario);

router.get('/rules', validate(paginationQuerySchema, 'query'), controller.listRules);
router.post('/rules', validate(ruleSchema), controller.createRule);
router.delete('/rules/:id', validate(idParamSchema, 'params'), controller.deleteRule);
router.post('/rules/simulate', validate(ruleSimSchema), controller.simulateRules);

router.get('/bills', validate(paginationQuerySchema, 'query'), controller.listBills);
router.post('/bills', validate(billUpsertSchema), controller.upsertBill);
router.delete('/bills/:id', validate(idParamSchema, 'params'), controller.deleteBill);
router.get('/bills/upcoming', validate(paginationQuerySchema, 'query'), controller.getUpcomingBills);

router.get('/households', validate(paginationQuerySchema, 'query'), controller.listHouseholds);
router.get('/households/:id', validate(idParamSchema, 'params'), controller.getHousehold);
router.get('/households/:id/members', validate(idParamSchema, 'params'), controller.listHouseholdMembers);
router.patch('/households/:id/members/:memberId', validate(z.object({
	id: z.coerce.number().int().positive(),
	memberId: z.coerce.number().int().positive(),
}), 'params'), validate(householdMemberRoleSchema), controller.updateHouseholdMemberRole);
router.post('/households', validate(householdCreateSchema), controller.createHousehold);
router.post('/households/join', validate(householdJoinSchema), controller.joinHousehold);

router.get('/tax/summary', validate(taxQuerySchema, 'query'), controller.getTaxSummary);
router.get('/goals/optimizer', controller.getGoalOptimizer);
router.get('/goals/autopilot/rules', controller.listGoalAutopilotRules);
router.post('/goals/autopilot/rules', validate(goalAutopilotRuleSchema), controller.upsertGoalAutopilotRule);
router.delete('/goals/autopilot/rules/:id', validate(idParamSchema, 'params'), controller.deleteGoalAutopilotRule);
router.get('/goals/autopilot/projection', controller.projectGoalAutopilot);
router.get('/executive/brief', controller.getExecutiveBrief);
router.get('/reports/weekly-brief', controller.getWeeklyCfoBrief);
router.get('/health/score', controller.getFinancialHealthScore);
router.get('/autocategory/suggest', validate(autoCategoryQuerySchema, 'query'), controller.getAutoCategorySuggestions);
router.post('/autocategory/feedback', validate(categoryFeedbackSchema), controller.submitAutoCategoryFeedback);
router.post('/statements/reconcile', validate(reconcileSchema), controller.reconcileStatementRows);

router.get('/households/:id/limits', validate(idParamSchema, 'params'), controller.listHouseholdSpendingLimits);
router.put('/households/:id/limits/:memberId', validate(z.object({
	id: z.coerce.number().int().positive(),
	memberId: z.coerce.number().int().positive(),
}), 'params'), validate(householdLimitSchema), controller.setHouseholdSpendingLimit);

router.post('/households/approvals', validate(householdApprovalCreateSchema), controller.createHouseholdApprovalRequest);
router.get('/households/:id/approvals', validate(idParamSchema, 'params'), validate(z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }), 'query'), controller.listHouseholdApprovals);
router.patch('/households/approvals/:approvalId', validate(z.object({ approvalId: z.coerce.number().int().positive() }), 'params'), validate(householdApprovalDecisionSchema), controller.decideHouseholdApproval);
router.get('/households/approvals/:approvalId/comments', validate(z.object({ approvalId: z.coerce.number().int().positive() }), 'params'), controller.listApprovalComments);
router.post('/households/approvals/:approvalId/comments', validate(z.object({ approvalId: z.coerce.number().int().positive() }), 'params'), validate(approvalCommentSchema), controller.addApprovalComment);

router.get('/activity', validate(activityQuerySchema, 'query'), controller.listActivityTimeline);
router.get('/activity/export', validate(activityQuerySchema, 'query'), controller.exportActivityTimeline);
router.get('/activity/integrity', controller.verifyActivityIntegrity);

module.exports = router;
