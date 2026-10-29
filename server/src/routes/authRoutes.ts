import { Router } from 'express';
import { getSalts, register, login, logout, getMe, recoverAccount } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public routes with brute-force rate limiter
router.post('/salts', authLimiter, getSalts);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/recover', authLimiter, recoverAccount);

// Protected routes
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);

export default router;
