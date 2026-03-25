const express = require('express');
const router = express.Router();
const { z } = require('zod');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticateToken } = require('../middleware/authMiddleware');

const credentialsSchema = z.object({
	username: z.string().trim().min(3, 'Username must be at least 3 characters.'),
	password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const googleSchema = z.object({
	credential: z.string().min(1, 'Google credential is required.'),
});

const sessionIdSchema = z.object({
	id: z.coerce.number().int().positive('Session id must be a positive number.'),
});

router.post('/register', validate(credentialsSchema), authController.register);
router.post('/login', validate(credentialsSchema), authController.login);
router.post('/google', validate(googleSchema), authController.googleLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/sessions', authenticateToken, authController.listSessions);
router.delete('/sessions/:id', authenticateToken, validate(sessionIdSchema, 'params'), authController.revokeSession);
router.post('/logout-all', authenticateToken, authController.logoutAll);

module.exports = router;
