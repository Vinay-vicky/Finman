const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/authMiddleware');

const { z } = require('zod');
const validate = require('../middleware/validate');

const transactionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category is required"),
  date: z.string().optional()
});

const transactionIdSchema = z.object({
  id: z.coerce.number().int().positive('Transaction id must be a positive number.'),
});

const transactionQuerySchema = z.object({
  search: z.string().trim().max(100, 'Search term must be 100 characters or less.').optional(),
  category: z.string().trim().max(50, 'Category must be 50 characters or less.').optional(),
  type: z.enum(['income', 'expense']).optional(),
  sort: z.enum(['date', 'amount', 'title']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  paginate: z.enum(['true', 'false']).optional(),
});

router.use(authenticateToken); // Protect all transaction routes

router.get('/', validate(transactionQuerySchema, 'query'), transactionController.getTransactions);
router.get('/export', transactionController.exportTransactions);
router.post('/', validate(transactionSchema), transactionController.createTransaction);
router.put('/:id', validate(transactionIdSchema, 'params'), validate(transactionSchema), transactionController.updateTransaction);
router.delete('/:id', validate(transactionIdSchema, 'params'), transactionController.deleteTransaction);

module.exports = router;
