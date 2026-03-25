const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/summary', analyticsController.getSummary);
router.get('/charts/category', analyticsController.getCategoryCharts);
router.get('/compare', analyticsController.getComparison);
router.get('/report', analyticsController.getReport);

module.exports = router;
