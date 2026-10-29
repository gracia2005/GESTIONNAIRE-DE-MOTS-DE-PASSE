"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVaultItem = exports.updateVaultItem = exports.createVaultItem = exports.getVaultItems = void 0;
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const database_js_1 = require("../db/database.js");
const vaultItemSchema = zod_1.z.object({
    service_name_encrypted: zod_1.z.string().min(1),
    service_name_iv: zod_1.z.string().min(12).max(64),
    category: zod_1.z.enum(['social', 'emails', 'banks', 'work', 'studies', 'notes', 'other']).default('other'),
    encrypted_data: zod_1.z.string().min(1),
    data_iv: zod_1.z.string().min(12).max(64),
});
const getVaultItems = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const items = await database_js_1.db.getVaultItemsByUserId(req.user.id);
        res.json({
            success: true,
            items: items.map(item => ({
                id: item.id,
                service_name_encrypted: item.service_name_encrypted,
                service_name_iv: item.service_name_iv,
                category: item.category,
                encrypted_data: item.encrypted_data,
                data_iv: item.data_iv,
                created_at: item.created_at,
                updated_at: item.updated_at,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVaultItems = getVaultItems;
const createVaultItem = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const parsed = vaultItemSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }
        const { service_name_encrypted, service_name_iv, category, encrypted_data, data_iv } = parsed.data;
        const id = crypto_1.default.randomUUID();
        const now = new Date().toISOString();
        const newItem = {
            id,
            user_id: req.user.id,
            service_name_encrypted,
            service_name_iv,
            category,
            encrypted_data,
            data_iv,
            created_at: now,
            updated_at: now,
        };
        await database_js_1.db.createVaultItem(newItem);
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: req.user.id,
            event_type: 'VAULT_ITEM_CREATED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: `Ajout d'une nouvelle entrée chiffrée dans la catégorie [${category}].`,
            created_at: now,
        });
        res.status(201).json({
            success: true,
            item: {
                id: newItem.id,
                service_name_encrypted: newItem.service_name_encrypted,
                service_name_iv: newItem.service_name_iv,
                category: newItem.category,
                encrypted_data: newItem.encrypted_data,
                data_iv: newItem.data_iv,
                created_at: newItem.created_at,
                updated_at: newItem.updated_at,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createVaultItem = createVaultItem;
const updateVaultItem = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const { id } = req.params;
        const parsed = vaultItemSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }
        const updated = await database_js_1.db.updateVaultItem(id, req.user.id, {
            ...parsed.data,
            updated_at: new Date().toISOString(),
        });
        if (!updated) {
            res.status(404).json({ success: false, error: 'Entrée introuvable ou non autorisée.' });
            return;
        }
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: req.user.id,
            event_type: 'VAULT_ITEM_UPDATED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: `Mise à jour d'un identifiant chiffré (ID: ${id}).`,
            created_at: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: 'Identifiant mis à jour avec succès.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateVaultItem = updateVaultItem;
const deleteVaultItem = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Non authentifié.' });
            return;
        }
        const { id } = req.params;
        const deleted = await database_js_1.db.deleteVaultItem(id, req.user.id);
        if (!deleted) {
            res.status(404).json({ success: false, error: 'Entrée introuvable ou non autorisée.' });
            return;
        }
        await database_js_1.db.logAuditEvent({
            id: crypto_1.default.randomUUID(),
            user_id: req.user.id,
            event_type: 'VAULT_ITEM_DELETED',
            ip_address: req.ip || req.socket.remoteAddress,
            details: `Suppression d'un identifiant chiffré (ID: ${id}).`,
            created_at: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: 'Identifiant supprimé définitivement.',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteVaultItem = deleteVaultItem;
