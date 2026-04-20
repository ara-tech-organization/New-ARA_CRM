import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
} from '../controllers/authController.js';
import { clientLogin, getClientMe } from '../controllers/clientAuthController.js';
import { protect, protectClient, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { registerValidation, loginValidation } from '../utils/validators.js';

const router = express.Router();

// Public routes
router.post('/login', loginValidation, validate, login);
router.post('/client-login', clientLogin);

// Client portal routes
router.get('/client-me', protectClient, getClientMe);

// Protected routes
router.post('/register', protect, authorize('superadmin', 'admin'), registerValidation, validate, register);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/update-details', protect, updateDetails);
router.put('/update-password', protect, updatePassword);

export default router;
