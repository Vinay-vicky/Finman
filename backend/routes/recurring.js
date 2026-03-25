const express = require('express');
const { z } = require('zod');
const recurringController = require('../controllers/recurringController');
const { authenticateToken } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();

const recurringSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  next_date: z.string().optional(),
  paused: z.coerce.boolean().optional(),
});

const recurringIdSchema = z.object({
  id: z.coerce.number().int().positive('Recurring transaction id must be a positive number.'),
});

router.use(authenticateToken);

router.get('/', recurringController.listRecurring);
router.post('/', validate(recurringSchema), recurringController.createRecurring);
router.put('/:id', validate(recurringIdSchema, 'params'), validate(recurringSchema), recurringController.updateRecurring);
router.delete('/:id', validate(recurringIdSchema, 'params'), recurringController.deleteRecurring);
router.post('/run-due', recurringController.runDue);

module.exports = router;
