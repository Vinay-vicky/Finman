const express = require('express');
const { z } = require('zod');
const categoryController = require('../controllers/categoryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(50),
  type: z.enum(['income', 'expense']).optional(),
  color: z.string().trim().min(4).max(30).optional(),
});

const categoryIdSchema = z.object({
  id: z.coerce.number().int().positive('Category id must be a positive number.'),
});

const categoryQuerySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
});

router.use(authenticateToken);

router.get('/', validate(categoryQuerySchema, 'query'), categoryController.listCategories);
router.post('/', validate(categorySchema), categoryController.createCategory);
router.put('/:id', validate(categoryIdSchema, 'params'), validate(categorySchema), categoryController.updateCategory);
router.delete('/:id', validate(categoryIdSchema, 'params'), categoryController.deleteCategory);

module.exports = router;
