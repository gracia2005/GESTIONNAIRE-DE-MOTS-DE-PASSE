import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

const vaultItemSchema = z.object({
  service_name_encrypted: z.string().min(1),
  service_name_iv: z.string().min(12).max(64),
  category: z.enum(['social', 'emails', 'banks', 'work', 'studies', 'notes', 'other']).default('other'),
  encrypted_data: z.string().min(1),
  data_iv: z.string().min(12).max(64),
});

export const getVaultItems = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Non authentifié.' });
      return;
    }

    const items = await db.getVaultItemsByUserId(req.user.id);
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
  } catch (error) {
    next(error);
  }
};

export const createVaultItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    const id = crypto.randomUUID();
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

    await db.createVaultItem(newItem);

    await db.logAuditEvent({
      id: crypto.randomUUID(),
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
  } catch (error) {
    next(error);
  }
};

export const updateVaultItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    const updated = await db.updateVaultItem(id, req.user.id, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });

    if (!updated) {
      res.status(404).json({ success: false, error: 'Entrée introuvable ou non autorisée.' });
      return;
    }

    await db.logAuditEvent({
      id: crypto.randomUUID(),
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
  } catch (error) {
    next(error);
  }
};

export const deleteVaultItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Non authentifié.' });
      return;
    }

    const { id } = req.params;
    const deleted = await db.deleteVaultItem(id, req.user.id);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Entrée introuvable ou non autorisée.' });
      return;
    }

    await db.logAuditEvent({
      id: crypto.randomUUID(),
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
  } catch (error) {
    next(error);
  }
};
