import { Request, Response, NextFunction } from 'express';
import { db, UserRecord } from '../db/database.js';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  sessionId?: string;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.cookies?.session_id || (req.headers['x-session-id'] as string);

    if (!sessionId) {
      res.status(401).json({ success: false, error: 'Session non authentifiée ou expirée.' });
      return;
    }

    const session = await db.findSessionById(sessionId);
    if (!session) {
      res.clearCookie('session_id');
      res.status(401).json({ success: false, error: 'Session invalide ou expirée.' });
      return;
    }

    const user = await db.findUserById(session.user_id);
    if (!user) {
      await db.deleteSession(sessionId);
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
  } catch (error) {
    next(error);
  }
};
