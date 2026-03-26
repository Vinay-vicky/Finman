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

const taxQuerySchema = z.object({
	year: z.coerce.number().int().min(2000).max(2100).optional(),
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

// 12-feature pack endpoints
router.get('/copilot/summary', controller.getCopilotSummary);
router.get('/cashflow/forecast', validate(forecastQuerySchema, 'query'), controller.getCashflowForecast);
router.get('/transactions/anomalies', controller.getAnomalies);
router.get('/subscriptions/insights', controller.getSubscriptions);

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
router.post('/households', validate(householdCreateSchema), controller.createHousehold);
router.post('/households/join', validate(householdJoinSchema), controller.joinHousehold);

router.get('/tax/summary', validate(taxQuerySchema, 'query'), controller.getTaxSummary);
router.get('/goals/optimizer', controller.getGoalOptimizer);
router.get('/executive/brief', controller.getExecutiveBrief);
router.get('/activity', validate(activityQuerySchema, 'query'), controller.listActivityTimeline);
router.get('/activity/export', validate(activityQuerySchema, 'query'), controller.exportActivityTimeline);
router.get('/activity/integrity', controller.verifyActivityIntegrity);

module.exports = router;
