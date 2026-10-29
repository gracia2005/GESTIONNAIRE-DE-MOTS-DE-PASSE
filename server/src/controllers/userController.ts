import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

const changeMasterKeySchema = z.object({
  current_auth_hash: z.string().min(32).max(128),
  new_auth_hash: z.string().min(32).max(128),
  new_auth_salt: z.string().min(16).max(128),
  new_vault_salt: z.string().min(16).max(128),
  new_recovery_encrypted_vault_key: z.string().optional(),
  new_recovery_key_iv: z.string().optional(),
  re_encrypted_items: z.array(
    z.object({
      id: z.string().uuid(),
      service_name_encrypted: z.string().min(1),
      service_name_iv: z.string().min(12).max(64),
      category: z.string(),
      encrypted_data: z.string().min(1),
      data_iv: z.string().min(12).max(64),
    })
  ).optional(),
});

const updateSettingsSchema = z.object({
  auto_lock_minutes: z.number().int().min(1).max(1440),
});

export const changeMasterKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    const {
      current_auth_hash,
      new_auth_hash,
      new_auth_salt,
      new_vault_salt,
      new_recovery_encrypted_vault_key,
      new_recovery_key_iv,
      re_encrypted_items,
    } = parsed.data;

    // Verify current master password auth hash
    const isCurrentValid = await bcrypt.compare(current_auth_hash, req.user.password_hash);
    if (!isCurrentValid) {
      res.status(401).json({ success: false, error: 'Le mot de passe maître actuel est incorrect.' });
      return;
    }

    const new_password_hash = await bcrypt.hash(new_auth_hash, 12);

    // Update user record
    await db.updateUser(req.user.id, {
      password_hash: new_password_hash,
      auth_salt: new_auth_salt,
      vault_salt: new_vault_salt,
      recovery_encrypted_vault_key: new_recovery_encrypted_vault_key,
      recovery_key_iv: new_recovery_key_iv,
    });

    // Update re-encrypted items if provided
    if (re_encrypted_items && re_encrypted_items.length > 0) {
      for (const item of re_encrypted_items) {
        await db.updateVaultItem(item.id, req.user.id, {
          service_name_encrypted: item.service_name_encrypted,
          service_name_iv: item.service_name_iv,
          category: item.category,
          encrypted_data: item.encrypted_data,
          data_iv: item.data_iv,
        });
      }
    }

    await db.logAuditEvent({
      id: crypto.randomUUID(),
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
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    await db.updateUser(req.user.id, {
      auto_lock_minutes: parsed.data.auto_lock_minutes,
    });

    res.json({
      success: true,
      message: 'Paramètres mis à jour avec succès.',
      auto_lock_minutes: parsed.data.auto_lock_minutes,
    });
  } catch (error) {
    next(error);
  }
};

export const getActiveSessions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Non authentifié.' });
      return;
    }

    const sessions = await db.getSessionsByUserId(req.user.id);
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
  } catch (error) {
    next(error);
  }
};

export const revokeSession = async (
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
    if (!id) {
      res.status(400).json({ success: false, error: 'Identifiant de session manquant.' });
      return;
    }

    const session = await db.findSessionById(id);
    if (!session || session.user_id !== req.user.id) {
      res.status(404).json({ success: false, error: 'Session introuvable.' });
      return;
    }

    await db.deleteSession(id);

    const isCurrent = id === req.sessionId;
    if (isCurrent) {
      res.clearCookie('session_id');
    }

    await db.logAuditEvent({
      id: crypto.randomUUID(),
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
  } catch (error) {
    next(error);
  }
};

export const revokeOtherSessions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.sessionId) {
      res.status(401).json({ success: false, error: 'Non authentifié.' });
      return;
    }

    const revokedCount = await db.deleteOtherSessions(req.user.id, req.sessionId);

    await db.logAuditEvent({
      id: crypto.randomUUID(),
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
  } catch (error) {
    next(error);
  }
};
