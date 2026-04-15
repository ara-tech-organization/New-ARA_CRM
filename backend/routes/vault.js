import express from 'express';
import Vault from '../models/Vault.js';
import { protect } from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get all vault credentials
// @route   GET /api/vault
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { clientId } = req.query;

    const filter = {};
    if (clientId) {
      filter.clientId = clientId;
    }

    const vaultData = await Vault.find(filter).sort({ updatedAt: -1 });
    const decryptedData = vaultData.map(vault => {
      const obj = vault.toObject();
      try {
        obj.password = decrypt(obj.password);
      } catch (e) {
        obj.password = '***decryption error***';
      }
      return obj;
    });
    res.json(decryptedData);
  } catch (error) {
    console.error('Error fetching vault data:', error);
    res.status(500).json({ message: 'Failed to fetch vault credentials', error: error.message });
  }
});

// @desc    Get single vault credential
// @route   GET /api/vault/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const vault = await Vault.findById(req.params.id);

    if (!vault) {
      return res.status(404).json({ message: 'Vault credential not found' });
    }

    const obj = vault.toObject();
    try {
      obj.password = decrypt(obj.password);
    } catch (e) {
      obj.password = '***decryption error***';
    }
    res.json(obj);
  } catch (error) {
    console.error('Error fetching vault credential:', error);
    res.status(500).json({ message: 'Failed to fetch vault credential', error: error.message });
  }
});

// @desc    Create vault credential
// @route   POST /api/vault
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { clientId, clientName, platform, username, password, url, notes } = req.body;

    // Validate required fields
    if (!clientId || !clientName || !platform || !username || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const vault = new Vault({
      clientId,
      clientName,
      platform,
      username,
      password,
      url: url || '',
      notes: notes || '',
    });

    const savedVault = await vault.save();
    const obj = savedVault.toObject();
    try {
      obj.password = password; // Return the original password since it's just saved
    } catch (e) {
      obj.password = '***decryption error***';
    }
    res.status(201).json(obj);
  } catch (error) {
    console.error('Error creating vault credential:', error);
    res.status(500).json({ message: 'Failed to create vault credential', error: error.message });
  }
});

// @desc    Update vault credential
// @route   PUT /api/vault/:id
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { clientId, clientName, platform, username, password, url, notes } = req.body;

    const vault = await Vault.findById(req.params.id);

    if (!vault) {
      return res.status(404).json({ message: 'Vault credential not found' });
    }

    // Update fields
    vault.clientId = clientId || vault.clientId;
    vault.clientName = clientName || vault.clientName;
    vault.platform = platform || vault.platform;
    vault.username = username || vault.username;
    vault.password = password || vault.password;
    vault.url = url !== undefined ? url : vault.url;
    vault.notes = notes !== undefined ? notes : vault.notes;

    const updatedVault = await vault.save();
    const obj = updatedVault.toObject();
    try {
      obj.password = password || decrypt(obj.password); // If password was updated, return the new one, else decrypt the existing
    } catch (e) {
      obj.password = '***decryption error***';
    }
    res.json(obj);
  } catch (error) {
    console.error('Error updating vault credential:', error);
    res.status(500).json({ message: 'Failed to update vault credential', error: error.message });
  }
});

// @desc    Delete vault credential
// @route   DELETE /api/vault/:id
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const vault = await Vault.findById(req.params.id);

    if (!vault) {
      return res.status(404).json({ message: 'Vault credential not found' });
    }

    await vault.deleteOne();
    res.json({ message: 'Vault credential deleted successfully' });
  } catch (error) {
    console.error('Error deleting vault credential:', error);
    res.status(500).json({ message: 'Failed to delete vault credential', error: error.message });
  }
});

// @desc    Get vault credentials by client ID
// @route   GET /api/vault/client/:clientId
// @access  Private
router.get('/client/:clientId', async (req, res) => {
  try {
    const vaultData = await Vault.find({ clientId: req.params.clientId }).sort({ updatedAt: -1 });
    const decryptedData = vaultData.map(vault => {
      const obj = vault.toObject();
      try {
        obj.password = decrypt(obj.password);
      } catch (e) {
        obj.password = '***decryption error***';
      }
      return obj;
    });
    res.json(decryptedData);
  } catch (error) {
    console.error('Error fetching vault data for client:', error);
    res.status(500).json({ message: 'Failed to fetch vault credentials', error: error.message });
  }
});

export default router;
