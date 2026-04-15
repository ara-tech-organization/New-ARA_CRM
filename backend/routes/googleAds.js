import express from 'express';
import syncService from '../sync/syncService.js';
import Client from '../models/Client.js';
import Campaign from '../models/Campaign.js';

const router = express.Router();

// Manual sync for all clients
router.post('/sync', async (req, res) => {
  try {
    await syncService.manualSync();
    res.json({ message: 'Sync completed for all clients' });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual sync for specific client
router.post('/sync/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.google_ads_customer_id) {
      return res.status(400).json({ error: 'Client does not have Google Ads customer ID' });
    }

    await syncService.manualSync(clientId);
    res.json({ message: `Sync completed for client: ${client.clientName}` });
  } catch (error) {
    console.error('Client sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaigns for a client
router.get('/campaigns/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const campaigns = await Campaign.find({ client_id: clientId }).sort({ createdAt: -1 });

    res.json(campaigns);
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client's Google Ads customer ID
router.put('/client/:clientId/customer-id', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const client = await Client.findByIdAndUpdate(
      clientId,
      { google_ads_customer_id: customerId },
      { returnDocument: 'after' }
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Customer ID updated successfully', client });
  } catch (error) {
    console.error('Update customer ID error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enable/disable Google Ads for a client
router.put('/client/:clientId/enable', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean value' });
    }

    const client = await Client.findByIdAndUpdate(
      clientId,
      { google_ads_enabled: enabled },
      { returnDocument: 'after' }
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({
      message: `Google Ads ${enabled ? 'enabled' : 'disabled'} for client: ${client.clientName}`,
      client: {
        clientName: client.clientName,
        google_ads_enabled: client.google_ads_enabled,
        google_ads_customer_id: client.google_ads_customer_id
      }
    });
  } catch (error) {
    console.error('Enable/disable Google Ads error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;