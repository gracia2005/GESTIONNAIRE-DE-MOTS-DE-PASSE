"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_js_1 = require("../controllers/authController.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const router = (0, express_1.Router)();
// Public routes with brute-force rate limiter
router.post('/salts', rateLimiter_js_1.authLimiter, authController_js_1.getSalts);
router.post('/register', rateLimiter_js_1.authLimiter, authController_js_1.register);
router.post('/login', rateLimiter_js_1.authLimiter, authController_js_1.login);
router.post('/recover', rateLimiter_js_1.authLimiter, authController_js_1.recoverAccount);
// Protected routes
router.get('/me', authMiddleware_js_1.requireAuth, authController_js_1.getMe);
router.post('/logout', authMiddleware_js_1.requireAuth, authController_js_1.logout);
exports.default = router;
