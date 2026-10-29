import { Router } from 'express';
import {
  changeMasterKey,
  updateSettings,
  getActiveSessions,
  revokeSession,
  revokeOtherSessions,
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.post('/change-master-key', changeMasterKey);
router.put('/settings', updateSettings);
router.get('/sessions', getActiveSessions);
router.delete('/sessions/:id', revokeSession);
router.post('/sessions/revoke-others', revokeOtherSessions);

export default router;
