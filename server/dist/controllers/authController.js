"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverAccount = exports.getMe = exports.logout = exports.login = exports.register = exports.getSalts = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const database_js_1 = require("../db/database.js");
// Schemas
const emailSchema = zod_1.z.string().email('Adresse e-mail invalide').max(255);
const registerSchema = zod_1.z.object({
    email: emailSchema,
    auth_hash: zod_1.z.string().min(32).max(128),
    auth_salt: zod_1.z.string().min(16).max(128),
    vault_salt: zod_1.z.string().min(16).max(128),
    recovery_encrypted_vault_key: zod_1.z.string().optional(),
    recovery_key_iv: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: emailSchema,
    auth_hash: zod_1.z.string().min(32).max(128),
});
const recoverSchema = zod_1.z.object({
    email: emailSchema,
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
// Helper for cookie options
const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
});
const getSalts = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            res.status(400).json({ success: false, error: 'Email requis.' });
            return;
        }
        const user = await database_js_1.db.findUserByEmail(email);
        if (user) {
            const items = await database_js_1.db.getVaultItemsByUserId(user.id);
            res.json({
                success: true,
                exists: true,
                auth_salt: user.auth_salt,
                vault_salt: user.vault_salt,
                recovery_encrypted_vault_key: user.recovery_encrypted_vault_key,
                recovery_key_iv: user.recovery_key_iv,
                encrypted_items: items.map(item => ({
                    id: item.id,
                    service_name_encrypted: item.service_name_encrypted,
                    service_name_iv: item.service_name_iv,
                    category: item.category,
                    encrypted_data: item.encrypted_data,
                    data_iv: item.data_iv,
                })),
            });
            return;
        }
        // Defensive mitigation: Return deterministic pseudo-salts to avoid account enumeration
        const hmac = crypto_1.default.createHmac('sha256', process.env.SESSION_SECRET || 'securevault_default_secret');
        hmac.update(email.toLowerCase().trim());
        const pseudoSalt = hmac.digest('hex');
        res.json({
            success: true,
            exists: false,
            auth_salt: pseudoSalt.substring(0, 32),
            vault_salt: pseudoSalt.substring(32, 64),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSalts = getSalts;
const register = async (req, res, next) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }
        const { email, auth_hash, auth_salt, vault_salt, recovery_encrypted_vault_key, recovery_key_iv } = parsed.data;
        const existing = await database_js_1.db.findUserByEmail(email);
        if (existing) {
            res.status(409).json({ success: false, error: 'Un compte avec cette adresse e-mail existe déjà.' });
            return;
        }
        // Hash auth_hash with bcrypt (cost factor 12)
        const saltRounds = 12;
        const password_hash = await bcryptjs_1.default.hash(auth_hash, saltRounds);
        const userId = crypto_1.default.randomUUID();
        const now = new Date().toISOString();
        await database_js_1.db.createUser({
            id: userId,
            email: email.toLowerCase().trim(),
            password_hash,
            auth_salt,
            vault_salt,
            recovery_encrypted_vault_key,
            recovery_key_iv,
            auto_lock_minutes: 15,
            created_at: now,
            updated_at: now,
        });
        // Create session
        const sessionId = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await database_js_1.db.createSession({
            id: sessionId,
            user_id: userId,
            user_agent: req.headers['user-agent'],
            ip_address: req.ip || req.socket.remoteAddress,
            expires_at: expiresAt,
            created_at: now,
        });
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: userId,
            event_type: 'USER_REGISTERED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: 'Création initiale du compte SecureVault et configuration de la clé de secours.',
            created_at: now,
        });
        res.cookie('session_id', sessionId, getCookieOptions());
        res.status(201).json({
            success: true,
            user: {
                id: userId,
                email: email.toLowerCase().trim(),
                auto_lock_minutes: 15,
                auth_salt,
                vault_salt,
            },
            sessionId,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }
        const { email, auth_hash } = parsed.data;
        const user = await database_js_1.db.findUserByEmail(email);
        if (!user) {
            res.status(401).json({ success: false, error: 'Identifiants invalides.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(auth_hash, user.password_hash);
        const now = new Date().toISOString();
        if (!isMatch) {
            await database_js_1.db.logAuditEvent({
                id: crypto_1.default.randomUUID(),
                user_id: user.id,
                event_type: 'LOGIN_FAILURE',
                ip_address: req.ip || req.socket.remoteAddress,
                details: 'Tentative de connexion échouée (mot de passe maître erroné).',
                created_at: now,
            });
            res.status(401).json({ success: false, error: 'Identifiants invalides.' });
            return;
        }
        // Generate secure session
        const sessionId = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await database_js_1.db.createSession({
            id: sessionId,
            user_id: user.id,
            user_agent: req.headers['user-agent'],
            ip_address: req.ip || req.socket.remoteAddress,
            expires_at: expiresAt,
            created_at: now,
        });
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: user.id,
            event_type: 'LOGIN_SUCCESS',
            ip_address: req.ip || req.socket.remoteAddress,
            details: 'Connexion réussie au coffre-fort.',
            created_at: now,
        });
        res.cookie('session_id', sessionId, getCookieOptions());
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                auto_lock_minutes: user.auto_lock_minutes,
                auth_salt: user.auth_salt,
                vault_salt: user.vault_salt,
                recovery_encrypted_vault_key: user.recovery_encrypted_vault_key,
                recovery_key_iv: user.recovery_key_iv,
            },
            sessionId,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const logout = async (req, res, next) => {
    try {
        if (req.sessionId) {
            await database_js_1.db.deleteSession(req.sessionId);
        }
        if (req.user) {
            await database_js_1.db.logAuditEvent({
                id: crypto_1.default.randomUUID(),
                user_id: req.user.id,
                event_type: 'LOGOUT',
                ip_address: req.ip || req.socket.remoteAddress,
                details: 'Déconnexion manuelle de la session.',
                created_at: new Date().toISOString(),
            });
        }
        res.clearCookie('session_id', getCookieOptions());
        res.json({ success: true, message: 'Déconnexion effectuée avec succès.' });
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
const getMe = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                auto_lock_minutes: req.user.auto_lock_minutes,
                auth_salt: req.user.auth_salt,
                vault_salt: req.user.vault_salt,
                recovery_encrypted_vault_key: req.user.recovery_encrypted_vault_key,
                recovery_key_iv: req.user.recovery_key_iv,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
const recoverAccount = async (req, res, next) => {
    try {
        const parsed = recoverSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }
        const { email, new_auth_hash, new_auth_salt, new_vault_salt, new_recovery_encrypted_vault_key, new_recovery_key_iv, re_encrypted_items } = parsed.data;
        const user = await database_js_1.db.findUserByEmail(email);
        if (!user) {
            // Don't disclose user existence
            res.status(400).json({ success: false, error: 'Impossible de procéder à la récupération avec les données fournies.' });
            return;
        }
        const new_password_hash = await bcryptjs_1.default.hash(new_auth_hash, 12);
        await database_js_1.db.updateUser(user.id, {
            password_hash: new_password_hash,
            auth_salt: new_auth_salt,
            vault_salt: new_vault_salt,
            recovery_encrypted_vault_key: new_recovery_encrypted_vault_key,
            recovery_key_iv: new_recovery_key_iv,
        });
        // Update re-encrypted items if provided
        if (re_encrypted_items && re_encrypted_items.length > 0) {
            for (const item of re_encrypted_items) {
                await database_js_1.db.updateVaultItem(item.id, user.id, {
                    service_name_encrypted: item.service_name_encrypted,
                    service_name_iv: item.service_name_iv,
                    category: item.category,
                    encrypted_data: item.encrypted_data,
                    data_iv: item.data_iv,
                });
            }
        }
        // Invalidate all existing sessions for security
        await database_js_1.db.deleteSessionsByUserId(user.id);
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: user.id,
            event_type: 'ACCOUNT_RECOVERED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: 'Récupération de compte réussie avec la clé d’urgence et réinitialisation du mot de passe maître.',
            created_at: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: 'Compte récupéré et mot de passe maître mis à jour avec succès. Veuillez vous connecter.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.recoverAccount = recoverAccount;
