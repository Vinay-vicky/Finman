const express = require('express');
const router = express.Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
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

const mobileOtpRequestSchema = z.object({
	mobileNumber: z.string().trim().min(8).max(20),
});

const mobileOtpVerifySchema = z.object({
	mobileNumber: z.string().trim().min(8).max(20),
	otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be a 6-digit code.'),
});

const otpLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 12,
	standardHeaders: true,
	legacyHeaders: false,
	message: 'Too many OTP attempts from this IP. Please try again later.',
});

router.post('/register', validate(credentialsSchema), authController.register);
router.post('/login', validate(credentialsSchema), authController.login);
router.post('/google', validate(googleSchema), authController.googleLogin);
router.post('/mobile/request-otp', otpLimiter, validate(mobileOtpRequestSchema), authController.requestMobileOtp);
router.post('/mobile/verify-otp', otpLimiter, validate(mobileOtpVerifySchema), authController.verifyMobileOtp);
router.get('/mobile/provider-health', authenticateToken, authController.getMobileOtpProviderHealth);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/sessions', authenticateToken, authController.listSessions);
router.delete('/sessions/:id', authenticateToken, validate(sessionIdSchema, 'params'), authController.revokeSession);
router.post('/logout-all', authenticateToken, authController.logoutAll);

module.exports = router;
