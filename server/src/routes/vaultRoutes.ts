import { Router } from 'express';
import { getVaultItems, createVaultItem, updateVaultItem, deleteVaultItem } from '../controllers/vaultController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getVaultItems);
router.post('/', createVaultItem);
router.put('/:id', updateVaultItem);
router.delete('/:id', deleteVaultItem);

export default router;
