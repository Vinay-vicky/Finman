const recurringService = require('../services/recurringService');
const AppError = require('../utils/appError');

const listRecurring = async (req, res, next) => {
  try {
    const items = await recurringService.listRecurring(req.user.id);
    res.json(items);
  } catch (err) {
    next(err);
  }
};

const createRecurring = async (req, res, next) => {
  try {
    const item = await recurringService.createRecurring(req.user.id, req.body);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
};

const updateRecurring = async (req, res, next) => {
  try {
    const item = await recurringService.updateRecurring(req.user.id, req.params.id, req.body);
    res.json(item);
  } catch (err) {
    if (err.message === 'Recurring transaction not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const deleteRecurring = async (req, res, next) => {
  try {
    await recurringService.deleteRecurring(req.user.id, req.params.id);
    res.json({ message: 'Recurring transaction deleted successfully.' });
  } catch (err) {
    if (err.message === 'Recurring transaction not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const runDue = async (req, res, next) => {
  try {
    const result = await recurringService.materializeDueRecurring(req.user.id, new Date());
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runDue,
};
