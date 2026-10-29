"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeOtherSessions = exports.revokeSession = exports.getActiveSessions = exports.updateSettings = exports.changeMasterKey = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const database_js_1 = require("../db/database.js");
const changeMasterKeySchema = zod_1.z.object({
    current_auth_hash: zod_1.z.string().min(32).max(128),
    new_auth_hash: zod_1.z.string().min(32).max(128),
    new_auth_salt: zod_1.z.string().min(16).max(128),
    new_vault_salt: zod_1.z.string().min(16).max(128),
    new_recovery_encrypted_vault_key: zod_1.z.string().optional(),
    new_recovery_key_iv: zod_1.z.string().optional(),
    re_encrypted_items: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        service_name_encrypted: zod_1.z.string().min(1),
        service_name_iv: zod_1.z.string().min(12).max(64),
        category: zod_1.z.string(),
        encrypted_data: zod_1.z.string().min(1),
        data_iv: zod_1.z.string().min(12).max(64),
    })).optional(),
});
const updateSettingsSchema = zod_1.z.object({
    auto_lock_minutes: zod_1.z.number().int().min(1).max(1440),
});
const changeMasterKey = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const parsed = changeMasterKeySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }
        const { current_auth_hash, new_auth_hash, new_auth_salt, new_vault_salt, new_recovery_encrypted_vault_key, new_recovery_key_iv, re_encrypted_items, } = parsed.data;
        // Verify current master password auth hash
        const isCurrentValid = await bcryptjs_1.default.compare(current_auth_hash, req.user.password_hash);
        if (!isCurrentValid) {
            res.status(401).json({ success: false, error: 'Le mot de passe maître actuel est incorrect.' });
            return;
        }
        const new_password_hash = await bcryptjs_1.default.hash(new_auth_hash, 12);
        // Update user record
        await database_js_1.db.updateUser(req.user.id, {
            password_hash: new_password_hash,
            auth_salt: new_auth_salt,
            vault_salt: new_vault_salt,
            recovery_encrypted_vault_key: new_recovery_encrypted_vault_key,
            recovery_key_iv: new_recovery_key_iv,
        });
        // Update re-encrypted items if provided
        if (re_encrypted_items && re_encrypted_items.length > 0) {
            for (const item of re_encrypted_items) {
                await database_js_1.db.updateVaultItem(item.id, req.user.id, {
                    service_name_encrypted: item.service_name_encrypted,
                    service_name_iv: item.service_name_iv,
                    category: item.category,
                    encrypted_data: item.encrypted_data,
                    data_iv: item.data_iv,
                });
            }
        }
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: req.user.id,
            event_type: 'MASTER_PASSWORD_CHANGED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: 'Changement du mot de passe maître et re-chiffrement complet du coffre effectué.',
            created_at: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: 'Mot de passe maître modifié et coffre re-chiffré avec succès.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.changeMasterKey = changeMasterKey;
const updateSettings = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const parsed = updateSettingsSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }
        await database_js_1.db.updateUser(req.user.id, {
            auto_lock_minutes: parsed.data.auto_lock_minutes,
        });
        res.json({
            success: true,
            message: 'Paramètres mis à jour avec succès.',
            auto_lock_minutes: parsed.data.auto_lock_minutes,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateSettings = updateSettings;
const getActiveSessions = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const sessions = await database_js_1.db.getSessionsByUserId(req.user.id);
        const formatted = sessions.map(s => ({
            id: s.id,
            user_agent: s.user_agent || 'Client inconnu',
            ip_address: s.ip_address || 'Inconnu',
            created_at: s.created_at,
            expires_at: s.expires_at,
            is_current: s.id === req.sessionId,
        }));
        res.json({
            success: true,
            sessions: formatted,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getActiveSessions = getActiveSessions;
const revokeSession = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ success: false, error: 'Identifiant de session manquant.' });
            return;
        }
        const session = await database_js_1.db.findSessionById(id);
        if (!session || session.user_id !== req.user.id) {
            res.status(404).json({ success: false, error: 'Session introuvable.' });
            return;
        }
        await database_js_1.db.deleteSession(id);
        const isCurrent = id === req.sessionId;
        if (isCurrent) {
            res.clearCookie('session_id');
        }
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: req.user.id,
            event_type: 'SESSION_REVOKED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: `Session révoquée: ${id.substring(0, 8)}... (${session.user_agent || 'App'})`,
            created_at: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: 'Session révoquée avec succès.',
            is_current: isCurrent,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.revokeSession = revokeSession;
const revokeOtherSessions = async (req, res, next) => {
    try {
        if (!req.user || !req.sessionId) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const revokedCount = await database_js_1.db.deleteOtherSessions(req.user.id, req.sessionId);
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: req.user.id,
            event_type: 'OTHER_SESSIONS_REVOKED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: `${revokedCount} session(s) distante(s) révoquée(s).`,
            created_at: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: 'Toutes les autres sessions ont été déconnectées.',
            revoked_count: revokedCount,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.revokeOtherSessions = revokeOtherSessions;
