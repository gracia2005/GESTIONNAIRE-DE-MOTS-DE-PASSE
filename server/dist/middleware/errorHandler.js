"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, _req, res, _next) => {
    // Safe logging: Never log query bodies with sensitive data
    console.error('[Error Logger]', {
        message: err.message,
        name: err.name,
        timestamp: new Date().toISOString(),
    });
    const statusCode = err.status || err.statusCode || 500;
    const isDev = process.env.NODE_ENV === 'development';
    res.status(statusCode).json({
        success: false,
        error: isDev ? err.message : 'Une erreur interne est survenue sur le serveur.',
    });
};
exports.errorHandler = errorHandler;
