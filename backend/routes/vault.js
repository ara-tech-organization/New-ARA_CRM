import express from 'express';
import Vault from '../models/Vault.js';

const router = express.Router();

// @desc    Get all vault credentials
// @route   GET /api/vault
// @access  Public (for now - add auth middleware later)
router.get('/', async (req, res) => {
  try {
    const { clientId } = req.query;

    const filter = {};
    if (clientId) {
      filter.clientId = clientId;
    }

    const vaultData = await Vault.find(filter).sort({ updatedAt: -1 });
    res.json(vaultData);
  } catch (error) {
    console.error('Error fetching vault data:', error);
    res.status(500).json({ message: 'Failed to fetch vault credentials', error: error.message });
  }
});

// @desc    Get single vault credential
// @route   GET /api/vault/:id
// @access  Public (for now - add auth middleware later)
router.get('/:id', async (req, res) => {
  try {
    const vault = await Vault.findById(req.params.id);

    if (!vault) {
      return res.status(404).json({ message: 'Vault credential not found' });
    }

    res.json(vault);
  } catch (error) {
    console.error('Error fetching vault credential:', error);
    res.status(500).json({ message: 'Failed to fetch vault credential', error: error.message });
  }
});

// @desc    Create vault credential
// @route   POST /api/vault
// @access  Public (for now - add auth middleware later)
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
    res.status(201).json(savedVault);
  } catch (error) {
    console.error('Error creating vault credential:', error);
    res.status(500).json({ message: 'Failed to create vault credential', error: error.message });
  }
});

// @desc    Update vault credential
// @route   PUT /api/vault/:id
// @access  Public (for now - add auth middleware later)
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
    res.json(updatedVault);
  } catch (error) {
    console.error('Error updating vault credential:', error);
    res.status(500).json({ message: 'Failed to update vault credential', error: error.message });
  }
});

// @desc    Delete vault credential
// @route   DELETE /api/vault/:id
// @access  Public (for now - add auth middleware later)
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
// @access  Public (for now - add auth middleware later)
router.get('/client/:clientId', async (req, res) => {
  try {
    const vaultData = await Vault.find({ clientId: req.params.clientId }).sort({ updatedAt: -1 });
    res.json(vaultData);
  } catch (error) {
    console.error('Error fetching vault data for client:', error);
    res.status(500).json({ message: 'Failed to fetch vault credentials', error: error.message });
  }
});

export default router;
