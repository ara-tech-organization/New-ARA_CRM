import express from 'express';
import PersonalVault from '../models/PersonalVault.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/personal-vault/users -- must be before /:id routes
// Get user list for sharing dialog (admin/superadmin only)
router.get('/users', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email userID role')
      .sort({ name: 1 })
      .lean();

    const filtered = users.filter(u => u._id.toString() !== req.user._id.toString());

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// GET /api/personal-vault
// Admin/superadmin: returns entries they created
// Other users: returns entries shared with them
router.get('/', async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    let entries;

    if (role === 'superadmin' || role === 'admin') {
      entries = await PersonalVault.find({ createdBy: userId })
        .populate('sharedWith', 'name email userID role')
        .sort({ updatedAt: -1 });
    } else {
      entries = await PersonalVault.find({ sharedWith: userId })
        .populate('createdBy', 'name email')
        .sort({ updatedAt: -1 });
    }

    const decryptedEntries = entries.map(entry => {
      const obj = entry.toObject();
      try {
        obj.password = decrypt(obj.password);
      } catch (e) {
        obj.password = '***decryption error***';
      }
      return obj;
    });

    res.json({ success: true, data: decryptedEntries });
  } catch (error) {
    console.error('Error fetching personal vault:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch entries', error: error.message });
  }
});

// POST /api/personal-vault -- admin/superadmin only
router.post('/', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { title, category, username, password, url, notes } = req.body;

    if (!title || !username || !password) {
      return res.status(400).json({ success: false, message: 'Title, username, and password are required' });
    }

    const encryptedPassword = encrypt(password);

    const entry = new PersonalVault({
      title,
      category: category || 'Other',
      username,
      password: encryptedPassword,
      url: url || '',
      notes: notes || '',
      createdBy: req.user._id,
      sharedWith: [],
    });

    const savedEntry = await entry.save();
    const populated = await savedEntry.populate('sharedWith', 'name email userID role');

    const obj = populated.toObject();
    obj.password = password;

    res.status(201).json({ success: true, data: obj });
  } catch (error) {
    console.error('Error creating personal vault entry:', error);
    res.status(500).json({ success: false, message: 'Failed to create entry', error: error.message });
  }
});

// PUT /api/personal-vault/:id -- admin/superadmin only, must be owner
router.put('/:id', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const entry = await PersonalVault.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    if (entry.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this entry' });
    }

    const { title, category, username, password, url, notes } = req.body;

    if (title) entry.title = title;
    if (category) entry.category = category;
    if (username) entry.username = username;
    if (password) entry.password = encrypt(password);
    if (url !== undefined) entry.url = url;
    if (notes !== undefined) entry.notes = notes;

    const updated = await entry.save();
    const populated = await updated.populate('sharedWith', 'name email userID role');
    const obj = populated.toObject();
    try {
      obj.password = decrypt(obj.password);
    } catch (e) {
      obj.password = password || '';
    }

    res.json({ success: true, data: obj });
  } catch (error) {
    console.error('Error updating personal vault entry:', error);
    res.status(500).json({ success: false, message: 'Failed to update entry', error: error.message });
  }
});

// DELETE /api/personal-vault/:id -- admin/superadmin only, must be owner
router.delete('/:id', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const entry = await PersonalVault.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    if (entry.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this entry' });
    }

    const sharedUserIds = entry.sharedWith.map(id => id.toString());
    await entry.deleteOne();

    // Revoke 'personal-vault' permission from users who no longer have any shared entries
    for (const userId of sharedUserIds) {
      const otherSharedEntries = await PersonalVault.countDocuments({ sharedWith: userId });
      if (otherSharedEntries === 0) {
        await User.updateOne(
          { _id: userId },
          { $pull: { permissions: 'personal-vault' } }
        );
      }
    }

    res.json({ success: true, message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting personal vault entry:', error);
    res.status(500).json({ success: false, message: 'Failed to delete entry', error: error.message });
  }
});

// PATCH /api/personal-vault/:id/share -- update sharedWith array + auto-grant/revoke permission
router.patch('/:id/share', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const entry = await PersonalVault.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    if (entry.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to share this entry' });
    }

    const previousSharedWith = entry.sharedWith.map(id => id.toString());
    const { sharedWith } = req.body;
    const newSharedWith = sharedWith || [];
    entry.sharedWith = newSharedWith;

    const updated = await entry.save();
    const populated = await updated.populate('sharedWith', 'name email userID role');

    // Auto-grant 'personal-vault' permission to newly added users
    const addedUsers = newSharedWith.filter(id => !previousSharedWith.includes(id));
    if (addedUsers.length > 0) {
      await User.updateMany(
        { _id: { $in: addedUsers }, permissions: { $ne: 'personal-vault' } },
        { $push: { permissions: 'personal-vault' } }
      );
    }

    // Auto-revoke 'personal-vault' permission from removed users (only if they have no other shared entries)
    const removedUsers = previousSharedWith.filter(id => !newSharedWith.includes(id));
    for (const userId of removedUsers) {
      const otherSharedEntries = await PersonalVault.countDocuments({
        sharedWith: userId,
        _id: { $ne: entry._id },
      });
      if (otherSharedEntries === 0) {
        await User.updateOne(
          { _id: userId },
          { $pull: { permissions: 'personal-vault' } }
        );
      }
    }

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error sharing personal vault entry:', error);
    res.status(500).json({ success: false, message: 'Failed to share entry', error: error.message });
  }
});

export default router;
