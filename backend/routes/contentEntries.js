import express from 'express';
import {
  getContentEntries,
  getContentEntriesByMonth,
  createContentEntry,
  updateContentEntry,
  deleteContentEntry,
} from '../controllers/contentEntryController.js';
import { protect } from '../middleware/auth.js';
import { checkPermission, PERMISSIONS } from '../middleware/permissions.js';
import User from '../models/User.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Get SMM users for Assigned SME dropdown — must be before /:id
router.get('/smm-users', checkPermission(PERMISSIONS.CONTENT_READ), async (req, res) => {
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

router
  .route('/')
  .get(checkPermission(PERMISSIONS.CONTENT_READ), getContentEntries)
  .post(checkPermission(PERMISSIONS.CONTENT_CREATE), createContentEntry);

// Calendar endpoint — must be before /:id
router.get('/calendar/:year/:month', checkPermission(PERMISSIONS.CONTENT_READ), getContentEntriesByMonth);

router
  .route('/:id')
  .put(checkPermission(PERMISSIONS.CONTENT_UPDATE), updateContentEntry)
  .delete(checkPermission(PERMISSIONS.CONTENT_DELETE), deleteContentEntry);

export default router;
