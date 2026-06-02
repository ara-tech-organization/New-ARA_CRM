import express from 'express';
import syncService from '../sync/syncService.js';
import { triggerClientSync } from '../sync/scheduler.js';
import Client from '../models/Client.js';
import Campaign from '../models/Campaign.js';
import googleAdsService from '../services/googleAdsService.js';
import mongoose from 'mongoose';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Google Ads sync + configuration are agency-side only and can move
// real data and money — require an authenticated admin token.
router.use(protect);
router.use(authorize('superadmin', 'admin'));

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

// Associate Google Ads customer ID with client
router.put('/client/:clientId/associate', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { customerId, accountName } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const client = await Client.findByIdAndUpdate(
      clientId,
      {
        google_ads_customer_id: customerId,
        google_ads_account_name: accountName || '',
        google_ads_enabled: true
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Kick off a background sync for just this client so their analytics
    // page has data ready quickly, without blocking this response.
    triggerClientSync(client._id);

    res.json({
      message: 'Google Ads account associated successfully',
      client: {
        _id: client._id,
        clientName: client.clientName,
        google_ads_customer_id: client.google_ads_customer_id,
        google_ads_account_name: client.google_ads_account_name,
        google_ads_enabled: client.google_ads_enabled
      }
    });
  } catch (error) {
    console.error('Associate Google Ads error:', error);
    if (error.code === 11000) {
      res.status(409).json({ error: 'Customer ID already associated with another client' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Bulk associate Google Ads customer IDs with clients
router.post('/clients/bulk-associate', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { associations } = req.body; // Array of { clientId, customerId, accountName }

    if (!Array.isArray(associations) || associations.length === 0) {
      return res.status(400).json({ error: 'associations array is required' });
    }

    const results = [];
    const errors = [];

    for (const association of associations) {
      const { clientId, customerId, accountName } = association;

      try {
        if (!clientId || !customerId) {
          errors.push({ clientId, error: 'clientId and customerId are required' });
          continue;
        }

        const client = await Client.findByIdAndUpdate(
          clientId,
          {
            google_ads_customer_id: customerId,
            google_ads_account_name: accountName || '',
            google_ads_enabled: true
          },
          { returnDocument: 'after', runValidators: true, session }
        );

        if (!client) {
          errors.push({ clientId, error: 'Client not found' });
          continue;
        }

        results.push({
          clientId,
          clientName: client.clientName,
          customerId: client.google_ads_customer_id,
          accountName: client.google_ads_account_name,
          status: 'success'
        });
      } catch (error) {
        console.error(`Bulk associate error for client ${clientId}:`, error);
        errors.push({ clientId, error: error.message });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: `Bulk association completed. ${results.length} successful, ${errors.length} errors`,
      results,
      errors
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Bulk associate transaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get clients without Google Ads association
router.get('/clients/unassociated', async (req, res) => {
  try {
    const clients = await Client.find({
      $or: [
        { google_ads_customer_id: '' },
        { google_ads_customer_id: { $exists: false } }
      ]
    }).select('clientName place organisationType accountID status').sort({ createdAt: -1 });

    res.json({
      count: clients.length,
      clients
    });
  } catch (error) {
    console.error('Get unassociated clients error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate Google Ads customer ID
router.post('/validate-customer-id', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const validation = await googleAdsService.validateCustomerId(customerId);
    res.json(validation);
  } catch (error) {
    console.error('Validate customer ID error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reload sync service configuration
router.post('/reload-sync', async (req, res) => {
  try {
    // Re-import and restart sync service with new configuration
    const { default: newSyncService } = await import('../sync/syncService.js');
    global.syncService = newSyncService;

    res.json({
      message: 'Sync service reloaded successfully',
      nextSyncIn: '15 minutes',
      frequency: 'Every 15 minutes',
      timestamp: new Date().toISOString(),
      note: 'Server restart may be needed for full effect'
    });
  } catch (error) {
    console.error('Reload sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync service status
router.get('/sync-status', (req, res) => {
  res.json({
    frequency: 'Every 15 minutes',
    nextSyncIn: '15 minutes (approximately)',
    lastSyncTime: new Date().toISOString(),
    status: 'Active',
    cronSchedule: '*/15 * * * *'
  });
});

export default router;