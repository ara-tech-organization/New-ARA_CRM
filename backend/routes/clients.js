import express from 'express';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  updateClientStatus,
  getClientStats,
  dropClient,
  reonboardClient,
} from '../controllers/clientController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { clientValidation, idValidation, paginationValidation } from '../utils/validators.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';
import User from '../models/User.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Get SMM users for Assigned SMM/SME dropdowns — must be before /:id
router.get('/smm-users', checkPermission(PERMISSIONS.CLIENT_READ), async (req, res) => {
  try {
    const smmUsers = await User.find({ role: 'SMM', isActive: true })
      .select('name email userID team')
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, data: smmUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch SMM users' });
  }
});

router.route('/')
  .get(paginationValidation, validate, checkPermission(PERMISSIONS.CLIENT_READ), getClients)
  .post(clientValidation, validate, checkPermission(PERMISSIONS.CLIENT_CREATE), createClient);

router.get('/stats', checkPermission(PERMISSIONS.CLIENT_READ), getClientStats);

router.route('/:id')
  .get(idValidation, validate, checkPermission(PERMISSIONS.CLIENT_READ), getClient)
  .put(idValidation, validate, checkPermission(PERMISSIONS.CLIENT_UPDATE), updateClient)
  .delete(idValidation, validate, checkPermission(PERMISSIONS.CLIENT_DELETE), deleteClient);

router.patch('/:id/status', idValidation, validate, checkPermission(PERMISSIONS.CLIENT_UPDATE), updateClientStatus);

// Soft-delete + re-onboard flow. Drop requires CLIENT_DELETE (it's
// the destructive action people are used to), reonboard requires
// CLIENT_UPDATE since it's a status change.
router.patch('/:id/drop', idValidation, validate, checkPermission(PERMISSIONS.CLIENT_DELETE), dropClient);
router.patch('/:id/reonboard', idValidation, validate, checkPermission(PERMISSIONS.CLIENT_UPDATE), reonboardClient);

export default router;
