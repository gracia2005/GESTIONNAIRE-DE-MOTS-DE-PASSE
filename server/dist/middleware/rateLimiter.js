"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Strict limiter for authentication attempts (Brute Force Protection)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: () => (process.env.ELECTRON_APP === 'true' ? 100 : 15), // Higher local threshold in standalone desktop mode
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Trop de tentatives de connexion ou d’enregistrement. Veuillez réessayer dans 15 minutes.',
    },
});
// General API limiter to prevent denial of service (DoS)
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: () => (process.env.ELECTRON_APP === 'true' ? 5000 : 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Trop de requêtes effectuées. Veuillez ralentir.',
    },
});
