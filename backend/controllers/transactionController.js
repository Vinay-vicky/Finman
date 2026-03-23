const transactionService = require('../services/transactionService');
const { Parser } = require('json2csv');

const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await transactionService.getTransactions(userId, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const exportTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await transactionService.getAllTransactionsForExport(userId);
    
    const parser = new Parser();
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('transactions-export.csv');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const transaction = await transactionService.createTransaction(userId, req.body);
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    await transactionService.deleteTransaction(userId, id);
    res.json({ message: 'Transaction deleted successfully.', id: id });
  } catch (err) {
    if (err.message === 'Transaction not found or unauthorized.') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getTransactions,
  exportTransactions,
  createTransaction,
  deleteTransaction,
};
