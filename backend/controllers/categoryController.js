const categoryService = require('../services/categoryService');
const AppError = require('../utils/appError');

const listCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.listCategories(req.user.id, req.query.type);
    res.json(categories);
  } catch (err) {
    next(err);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.user.id, req.body);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.user.id, req.params.id, req.body);
    res.json(category);
  } catch (err) {
    if (err.message === 'Category not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    await categoryService.deleteCategory(req.user.id, req.params.id);
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    if (err.message === 'Category not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
