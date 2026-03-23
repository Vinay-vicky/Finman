const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/authMiddleware');

const { z } = require('zod');
const validate = require('../middleware/validate');

const transactionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category is required"),
  date: z.string().optional()
});

router.use(authenticateToken); // Protect all transaction routes

router.get('/', transactionController.getTransactions);
router.get('/export', transactionController.exportTransactions);
router.post('/', validate(transactionSchema), transactionController.createTransaction);
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;
