import express from 'express';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  updateClientStatus,
  getClientStats,
} from '../controllers/clientController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { clientValidation, idValidation, paginationValidation } from '../utils/validators.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(paginationValidation, validate, checkPermission(PERMISSIONS.CLIENT_READ), getClients)
  .post(clientValidation, validate, checkPermission(PERMISSIONS.CLIENT_CREATE), createClient);

router.get('/stats', checkPermission(PERMISSIONS.CLIENT_READ), getClientStats);

router.route('/:id')
  .get(idValidation, validate, checkPermission(PERMISSIONS.CLIENT_READ), getClient)
  .put(idValidation, validate, checkPermission(PERMISSIONS.CLIENT_UPDATE), updateClient)
  .delete(idValidation, validate, checkPermission(PERMISSIONS.CLIENT_DELETE), deleteClient);

router.patch('/:id/status', idValidation, validate, checkPermission(PERMISSIONS.CLIENT_UPDATE), updateClientStatus);

export default router;
