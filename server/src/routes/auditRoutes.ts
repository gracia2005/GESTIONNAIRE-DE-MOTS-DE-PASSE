import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/logs', getAuditLogs);

export default router;
