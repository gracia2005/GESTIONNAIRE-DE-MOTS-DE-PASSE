"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const helmetConfig_js_1 = require("./middleware/helmetConfig.js");
const rateLimiter_js_1 = require("./middleware/rateLimiter.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const vaultRoutes_js_1 = __importDefault(require("./routes/vaultRoutes.js"));
const userRoutes_js_1 = __importDefault(require("./routes/userRoutes.js"));
const auditRoutes_js_1 = __importDefault(require("./routes/auditRoutes.js"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Security HTTP headers
app.use((0, helmetConfig_js_1.configureHelmet)());
// Cross-Origin Resource Sharing
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const loopbackOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || origin === clientUrl || loopbackOriginRegex.test(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Origine non autorisée par la politique CORS.'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-SecureVault-Client'],
}));
// Body parsers with payload size limits (protection against large payload DoS)
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
// Global API rate limiting
app.use('/api', rateLimiter_js_1.generalLimiter);
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
app.use('/api/auth', authRoutes_js_1.default);
app.use('/api/vault', vaultRoutes_js_1.default);
app.use('/api/user', userRoutes_js_1.default);
app.use('/api/audit', auditRoutes_js_1.default);
// Serve built client static assets when available (desktop standalone or unified production)
const candidateDistPaths = [
    process.env.CLIENT_DIST_PATH,
    path_1.default.resolve(__dirname, '../../client/dist'),
].filter((p) => Boolean(p));
const clientDistPath = candidateDistPaths.find((p) => fs_1.default.existsSync(path_1.default.join(p, 'index.html')));
if (clientDistPath && process.env.NODE_ENV !== 'test') {
    app.use(express_1.default.static(clientDistPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
    });
}
// Centralized error handler
app.use(errorHandler_js_1.errorHandler);
exports.default = app;
