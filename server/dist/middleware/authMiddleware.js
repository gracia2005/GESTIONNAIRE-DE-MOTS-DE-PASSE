"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const database_js_1 = require("../db/database.js");
const requireAuth = async (req, res, next) => {
    try {
        const sessionId = req.cookies?.session_id || req.headers['x-session-id'];
        if (!sessionId) {
            res.status(401).json({ success: false, error: 'Session non authentifiée ou expirée.' });
            return;
        }
        const session = await database_js_1.db.findSessionById(sessionId);
        if (!session) {
            res.clearCookie('session_id');
            res.status(401).json({ success: false, error: 'Session invalide ou expirée.' });
            return;
        }
        const user = await database_js_1.db.findUserById(session.user_id);
        if (!user) {
            await database_js_1.db.deleteSession(sessionId);
            res.clearCookie('session_id');
            res.status(401).json({ success: false, error: 'Utilisateur introuvable.' });
            return;
        }
        // CSRF Protection for state-changing HTTP methods
        const method = req.method.toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            const csrfHeader = req.headers['x-requested-with'] || req.headers['x-securevault-client'];
            if (!csrfHeader) {
                res.status(403).json({ success: false, error: 'En-tête de sécurité CSRF manquant.' });
                return;
            }
        }
        req.user = user;
        req.sessionId = session.id;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireAuth = requireAuth;
