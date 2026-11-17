import rateLimit from 'express-rate-limit';

// Strict limiter for authentication attempts (Brute Force Protection)
export const authLimiter = rateLimit({
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
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => (process.env.ELECTRON_APP === 'true' ? 5000 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes effectuées. Veuillez ralentir.',
  },
});
