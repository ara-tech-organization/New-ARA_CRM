import express from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  updateUserPermissions,
  changeUserPassword,
  getUserStats,
  getTeams,
  getRoles,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { registerValidation, updateUserValidation, idValidation } from '../utils/validators.js';

const router = express.Router();

// All routes are protected and require admin or superadmin role
router.use(protect);
router.use(authorize('superadmin', 'admin'));

router.route('/')
  .get(getUsers)
  .post(registerValidation, validate, createUser);

router.get('/stats', getUserStats);
router.get('/teams', getTeams);
router.get('/roles', getRoles);

router.route('/:id')
  .get(idValidation, validate, getUser)
  .put(idValidation, updateUserValidation, validate, updateUser)
  .delete(authorize('superadmin', 'admin'), idValidation, validate, deleteUser);

router.patch('/:id/toggle-status', idValidation, validate, toggleUserStatus);
router.patch('/:id/change-password', idValidation, validate, changeUserPassword);
// Both admin and superadmin can grant/revoke sidebar permissions.
router.patch('/:id/permissions', authorize('superadmin', 'admin'), idValidation, validate, updateUserPermissions);

export default router;
