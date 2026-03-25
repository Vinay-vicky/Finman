const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { z } = require('zod');
const validate = require('../middleware/validate');

const goalBodySchema = z.object({
	name: z.string().trim().min(1, 'Goal name is required.'),
	target_amount: z.number().positive('Target amount must be positive.'),
	current_amount: z.number().min(0, 'Current amount cannot be negative.').optional(),
	deadline: z.string().optional().nullable(),
});

const goalIdParamSchema = z.object({
	id: z.coerce.number().int().positive('Goal id must be a positive number.'),
});

router.use(authenticateToken);

router.get('/', goalController.getGoals);
router.post('/', validate(goalBodySchema), goalController.createGoal);
router.put('/:id', validate(goalIdParamSchema, 'params'), validate(goalBodySchema), goalController.updateGoal);
router.delete('/:id', validate(goalIdParamSchema, 'params'), goalController.deleteGoal);

module.exports = router;
