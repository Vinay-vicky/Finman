const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/summary', analyticsController.getSummary);
router.get('/charts/category', analyticsController.getCategoryCharts);

module.exports = router;
