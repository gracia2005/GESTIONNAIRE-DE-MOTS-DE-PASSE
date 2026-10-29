import rateLimit from 'express-rate-limit';

// Strict limiter for authentication attempts (Brute Force Protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Max 15 attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de tentatives de connexion ou d’enregistrement. Veuillez réessayer dans 15 minutes.',
  },
});

// General API limiter to prevent denial of service (DoS)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes effectuées. Veuillez ralentir.',
  },
});
