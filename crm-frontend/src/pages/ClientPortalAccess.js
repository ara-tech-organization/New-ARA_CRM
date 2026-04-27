import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Chip, Alert, InputAdornment, Switch, CircularProgress,
} from '@mui/material';
import {
  ManageAccounts as ManageAccountsIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Visibility, VisibilityOff,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const GREEN = '#10b981';

const ClientPortalAccess = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editDialog, setEditDialog] = useState(null); // client object or null
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients?limit=10000');
      const data = res.data?.data || res.data || [];
      setClients(Array.isArray(data) ? data : []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.clientName?.toLowerCase().includes(q) ||
      c.portalEmail?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const openEdit = (client) => {
    setEditDialog(client);
    setFormEmail(client.portalEmail || '');
    setFormPassword('');
    setFormEnabled(client.portalEnabled || false);
    setShowPassword(false);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!editDialog) return;
    if (!formEmail.trim()) {
      setMessage({ type: 'error', text: 'Email is required' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        portalEmail: formEmail.trim(),
        portalEnabled: formEnabled,
      };
      if (formPassword.trim()) {
        payload.portalPassword = formPassword.trim();
      }
      await api.put(`/clients/${editDialog._id}`, payload);
      setMessage({ type: 'success', text: 'Portal access updated successfully' });
      // Update local state
      setClients(prev => prev.map(c =>
        c._id === editDialog._id
          ? { ...c, portalEmail: payload.portalEmail, portalEnabled: payload.portalEnabled }
          : c
      ));
      setTimeout(() => setEditDialog(null), 800);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.response?.data?.error || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const portalUrl = `${window.location.origin}/client-login`;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ManageAccountsIcon sx={{ color: COPPER, fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Client Portal Access</Typography>
            <Typography variant="body2" color="text.secondary">Manage login credentials for client portal</Typography>
          </Box>
        </Box>
        <TextField
          size="small"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> } }}
          sx={{ minWidth: 240, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' } }}
        />
      </Box>

      {/* Portal URL info */}
      <Card variant="outlined" sx={{ mb: 2, borderLeft: `3px solid ${COPPER}` }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, py: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Client Login URL</Typography>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, fontFamily: 'monospace' }}>{portalUrl}</Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={copied === 'url' ? <CheckIcon /> : <CopyIcon />}
            onClick={() => handleCopy(portalUrl, 'url')}
            sx={copied === 'url' ? { borderColor: GREEN, color: GREEN } : undefined}
          >
            {copied === 'url' ? 'Copied!' : 'Copy URL'}
          </Button>
        </CardContent>
      </Card>

      {/* Clients Table */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress size={32} sx={{ color: COPPER }} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Client Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Place</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Portal Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Portal Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Google Ads</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Meta Ads</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c._id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{c.clientName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{c.place || '—'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.portalEmail || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={c.portalEnabled ? 'Active' : 'Inactive'}
                      size="small"
                      sx={{
                        height: 22, fontSize: '0.7rem', fontWeight: 600,
                        bgcolor: c.portalEnabled ? `${GREEN}15` : '#ef444415',
                        color: c.portalEnabled ? GREEN : '#ef4444',
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={c.google_ads_enabled || c.googleAdsEnabled ? 'Linked' : 'Not Linked'}
                      size="small"
                      sx={{
                        height: 22, fontSize: '0.7rem', fontWeight: 600,
                        bgcolor: (c.google_ads_enabled || c.googleAdsEnabled) ? '#34a85315' : '#9ca3af15',
                        color: (c.google_ads_enabled || c.googleAdsEnabled) ? '#34a853' : '#9ca3af',
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={c.meta_enabled || c.metaEnabled ? 'Linked' : 'Not Linked'}
                      size="small"
                      sx={{
                        height: 22, fontSize: '0.7rem', fontWeight: 600,
                        bgcolor: (c.meta_enabled || c.metaEnabled) ? '#1877f215' : '#9ca3af15',
                        color: (c.meta_enabled || c.metaEnabled) ? '#1877f2' : '#9ca3af',
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(c)} sx={{ color: COPPER }}>
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No clients found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onClose={() => !saving && setEditDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ManageAccountsIcon sx={{ color: COPPER }} />
          Portal Access — {editDialog?.clientName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            <TextField
              fullWidth
              label="Portal Email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="client@example.com"
              required
              disabled={saving}
            />
            <TextField
              fullWidth
              label="Portal Password"
              type={showPassword ? 'text' : 'password'}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder={editDialog?.portalEmail ? 'Leave blank to keep current' : 'Set a password'}
              disabled={saving}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600 }}>Enable Portal Access</Typography>
              <Switch
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
                disabled={saving}
                sx={{ '& .Mui-checked': { color: GREEN }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: GREEN } }}
              />
            </Box>
            {message && <Alert severity={message.type}>{message.text}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog(null)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formEmail.trim()}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: BROWN, '&:hover': { bgcolor: COPPER } }}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientPortalAccess;
