"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = void 0;
const database_js_1 = require("../db/database.js");
const getAuditLogs = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const logs = await database_js_1.db.getAuditLogsByUserId(req.user.id, limit);
        res.json({
            success: true,
            logs: logs.map(l => ({
                id: l.id,
                event_type: l.event_type,
                ip_address: l.ip_address,
                details: l.details,
                created_at: l.created_at,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAuditLogs = getAuditLogs;
