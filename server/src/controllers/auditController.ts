import { Response, NextFunction } from 'express';
import { db } from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Non authentifié.' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const logs = await db.getAuditLogsByUserId(req.user.id, limit);

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
  } catch (error) {
    next(error);
  }
};
