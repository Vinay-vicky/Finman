const transactionService = require('../services/transactionService');
const { Parser } = require('json2csv');
const AppError = require('../utils/appError');

const getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await transactionService.getTransactions(userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const exportTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rows = await transactionService.getAllTransactionsForExport(userId, req.query);

    const parser = new Parser();
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('transactions-export.csv');
    return res.send(csv);
  } catch (err) {
    return next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const transaction = await transactionService.createTransaction(userId, req.body);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    const transaction = await transactionService.updateTransaction(userId, id, req.body);
    res.json(transaction);
  } catch (err) {
    if (err.message === 'Transaction not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }
    return next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    await transactionService.deleteTransaction(userId, id);
    res.json({ message: 'Transaction deleted successfully.', id: id });
  } catch (err) {
    if (err.message === 'Transaction not found or unauthorized.') {
      return next(new AppError(404, err.message));
    }

    return next(err);
  }
};

module.exports = {
  getTransactions,
  exportTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
