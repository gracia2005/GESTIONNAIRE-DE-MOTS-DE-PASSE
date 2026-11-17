import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { configureHelmet } from './middleware/helmetConfig.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import vaultRoutes from './routes/vaultRoutes.js';
import userRoutes from './routes/userRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

dotenv.config();

const app = express();

// Security HTTP headers
app.use(configureHelmet());

// Cross-Origin Resource Sharing
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const loopbackOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === clientUrl || loopbackOriginRegex.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origine non autorisée par la politique CORS.'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-SecureVault-Client'],
  })
);

// Body parsers with payload size limits (protection against large payload DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Global API rate limiting
app.use('/api', generalLimiter);

// API Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SecureVault API',
    security_standard: 'Zero-Knowledge Client-Side Encryption',
    timestamp: new Date().toISOString(),
  });
});

// Desktop runtime status
app.get('/api/desktop-status', (_req, res) => {
  res.json({
    isDesktop: process.env.ELECTRON_APP === 'true',
    platform: process.platform,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/user', userRoutes);
app.use('/api/audit', auditRoutes);

// Serve built client static assets when available (desktop standalone or unified production)
const candidateDistPaths = [
  process.env.CLIENT_DIST_PATH,
  path.resolve(__dirname, '../../client/dist'),
].filter((p): p is string => Boolean(p));

const clientDistPath = candidateDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html')));

if (clientDistPath && process.env.NODE_ENV !== 'test') {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized error handler
app.use(errorHandler);

export default app;
