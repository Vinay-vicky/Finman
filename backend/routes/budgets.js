const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

const budgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be positive"),
  month: z.string().min(6, "Month format YYYY-MM required")
});

router.get('/', budgetController.getBudgets);
router.post('/', validate(budgetSchema), budgetController.createBudget);
router.delete('/:id', budgetController.deleteBudget);

module.exports = router;
