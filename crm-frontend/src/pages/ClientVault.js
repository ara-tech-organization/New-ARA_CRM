import React, { useState, useMemo, useEffect, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import api from '../api/axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Chip,
  InputAdornment,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert,
  Stack,
  Paper,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Lock as LockIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Google as GoogleIcon,
  Email as EmailIcon,
  Language as WebsiteIcon,
  VpnKey as VpnKeyIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Security as SecurityIcon,
  Shield as ShieldIcon,
  WarningAmber as WarningIcon,
  CloudQueue as CloudQueueIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { CardLoader, PageLoader } from '../components/Loading';

const ClientVault = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.primary || '#6366F1';
  const secondaryColor = accentColor?.secondary || '#818CF8';

  // Main API state - only source of clients
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('All');
  const [showPasswords, setShowPasswords] = useState({});
  const [expandedPanel, setExpandedPanel] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Vault data - credentials stored in Main API
  const [vaultData, setVaultData] = useState([]);

  const [formData, setFormData] = useState({
    clientId: '',
    type: 'Facebook',
    username: '',
    password: '',
    url: '',
    notes: '',
  });

  // Fetch clients from main API
  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clients');
      const data = response.data.data || response.data;
      const transformedClients = data.map(client => ({
        _id: client._id,
        id: client._id,
        name: client.clientName,
      }));
      setClients(transformedClients);
    } catch (error) {
      console.error('Error fetching clients from main API:', error);
      setSnackbar({ open: true, message: 'Failed to fetch clients', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch vault credentials from main API
  const fetchVaultData = async () => {
    setVaultLoading(true);
    try {
      const response = await api.get('/vault');
      const data = response.data.data || response.data;
      // Transform to match expected format
      const transformedVault = data.map(item => ({
        id: item._id,
        _id: item._id,
        clientId: item.clientId,
        clientName: item.clientName,
        type: item.platform || item.type,
        username: item.username,
        password: item.password,
        url: item.url || '',
        notes: item.notes || '',
        lastUpdated: item.updatedAt ? item.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
      }));
      setVaultData(transformedVault);
    } catch (error) {
      console.error('Error fetching vault data from main API:', error);
      setSnackbar({ open: true, message: 'Failed to fetch vault credentials', severity: 'error' });
    } finally {
      setVaultLoading(false);
    }
  };

  // Fetch clients and vault data on mount
  useEffect(() => {
    fetchClients();
    fetchVaultData();
  }, []);

  // Get platform icon and color
  const getPlatformConfig = (type) => {
    const configs = {
      'Facebook': { icon: <FacebookIcon />, color: '#1877f2' },
      'Instagram': { icon: <InstagramIcon />, color: '#E4405F' },
      'Google Ads': { icon: <GoogleIcon />, color: '#4285f4' },
      'Email': { icon: <EmailIcon />, color: '#ea4335' },
      'Website': { icon: <WebsiteIcon />, color: '#10b981' },
      'Other': { icon: <VpnKeyIcon />, color: '#8b5cf6' },
    };
    return configs[type] || configs['Other'];
  };

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return { strength: 'none', color: '#94a3b8', label: 'No Password' };
    if (password.length < 8) return { strength: 'weak', color: '#ef4444', label: 'Weak' };
    if (password.length < 12) return { strength: 'medium', color: '#f59e0b', label: 'Medium' };
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { strength: 'medium', color: '#f59e0b', label: 'Medium' };
    }
    return { strength: 'strong', color: '#10b981', label: 'Strong' };
  };

  // Group credentials by client
  const groupedCredentials = useMemo(() => {
    const filtered = vaultData.filter(item => {
      const matchesSearch = item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient = selectedClient === 'All' || item.clientName === selectedClient;
      return matchesSearch && matchesClient;
    });

    const grouped = {};
    filtered.forEach(item => {
      if (!grouped[item.clientName]) {
        grouped[item.clientName] = [];
      }
      grouped[item.clientName].push(item);
    });
    return grouped;
  }, [vaultData, searchQuery, selectedClient]);

  const handleOpenDialog = (credential = null) => {
    if (credential) {
      setEditingCredential(credential);
      setFormData({
        clientId: credential.clientId,
        type: credential.type,
        username: credential.username,
        password: credential.password,
        url: credential.url,
        notes: credential.notes,
      });
    } else {
      setEditingCredential(null);
      setFormData({
        clientId: '',
        type: 'Facebook',
        username: '',
        password: '',
        url: '',
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCredential(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const selectedClientData = clients.find(c => c._id === formData.clientId || c.id === formData.clientId);

    const payload = {
      clientId: formData.clientId,
      clientName: selectedClientData?.name || 'Unknown Client',
      platform: formData.type,
      username: formData.username,
      password: formData.password,
      url: formData.url,
      notes: formData.notes,
    };

    try {
      if (editingCredential) {
        // Update existing credential
        await api.put(`/vault/${editingCredential._id}`, payload);
        setSnackbar({ open: true, message: 'Credential updated successfully!', severity: 'success' });
      } else {
        // Create new credential
        await api.post('/vault', payload);
        setSnackbar({ open: true, message: 'Credential added successfully!', severity: 'success' });
      }

      // Refresh vault data from API
      await fetchVaultData();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving credential:', error);
      setSnackbar({ open: true, message: error.message || 'Failed to save credential', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this credential?')) {
      try {
        await api.delete(`/vault/${id}`);
        setSnackbar({ open: true, message: 'Credential deleted successfully!', severity: 'success' });
        // Refresh vault data from API
        await fetchVaultData();
      } catch (error) {
        console.error('Error deleting credential:', error);
        setSnackbar({ open: true, message: 'Failed to delete credential', severity: 'error' });
      }
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  // Stats
  const stats = useMemo(() => {
    return {
      totalCredentials: vaultData.length,
      totalClients: Object.keys(groupedCredentials).length,
      weakPasswords: vaultData.filter(item => getPasswordStrength(item.password).strength === 'weak').length,
      recentlyUpdated: vaultData.filter(item => {
        const daysDiff = (new Date() - new Date(item.lastUpdated)) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      }).length,
    };
  }, [vaultData, groupedCredentials]);

  // Show aesthetic loader during initial data fetch
  if (vaultLoading && vaultData.length === 0) {
    return <PageLoader message="Loading vault credentials..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <ShieldIcon sx={{ fontSize: 22, color: primaryColor }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Client Vault
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Securely store and manage client credentials and access information
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchClients}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              fontWeight: 600,
              '&:hover': {
                background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
              },
            }}
          >
            Add Credential
          </Button>
        </Box>
      </Box>

      {/* Security Alert */}
      {stats.weakPasswords > 0 && (
        <Alert
          severity="warning"
          icon={<WarningIcon />}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" sx={{ fontWeight: 600 }}>
              Review
            </Button>
          }
        >
          You have {stats.weakPasswords} weak password(s) that should be updated for better security.
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card sx={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="caption" sx={{ fontWeight: 500, textTransform: 'uppercase' }}>
                    Total Credentials
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: primaryColor }}>
                    {stats.totalCredentials}
                  </Typography>
                </Box>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: `${primaryColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LockIcon sx={{ fontSize: 22, color: primaryColor }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card sx={{ background: 'linear-gradient(135deg, #10b98115 0%, #10b98105 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="caption" sx={{ fontWeight: 500, textTransform: 'uppercase' }}>
                    Clients Secured
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#10b981' }}>
                    {stats.totalClients}
                  </Typography>
                </Box>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SecurityIcon sx={{ fontSize: 22, color: '#10b981' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card sx={{ background: 'linear-gradient(135deg, #ef444415 0%, #ef444405 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="caption" sx={{ fontWeight: 500, textTransform: 'uppercase' }}>
                    Weak Passwords
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#ef4444' }}>
                    {stats.weakPasswords}
                  </Typography>
                </Box>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <WarningIcon sx={{ fontSize: 22, color: '#ef4444' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card sx={{ background: 'linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="caption" sx={{ fontWeight: 500, textTransform: 'uppercase' }}>
                    Recently Updated
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                    {stats.recentlyUpdated}
                  </Typography>
                </Box>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EditIcon sx={{ fontSize: 22, color: '#f59e0b' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{xs: 12, sm: 6, md: 5}}>
              <TextField
                fullWidth
                placeholder="Search credentials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{xs: 12, sm: 6, md: 4}}>
              <TextField
                fullWidth
                select
                label="Filter by Client"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <MenuItem value="All">All Clients</MenuItem>
                {clients.map((client) => (
                  <MenuItem key={client._id} value={client.name}>
                    {client.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{xs: 12, sm: 12, md: 3}}>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={`${Object.keys(groupedCredentials).length} Clients`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`${vaultData.filter(item => {
                    const matchesSearch = item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                         item.username.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesClient = selectedClient === 'All' || item.clientName === selectedClient;
                    return matchesSearch && matchesClient;
                  }).length} Credentials`}
                  color="secondary"
                  variant="outlined"
                />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Credentials List */}
      {loading ? (
        <CardLoader count={4} message="Loading clients..." />
      ) : (
      <Grid container spacing={1.5}>
        {Object.keys(groupedCredentials).length === 0 ? (
          <Grid size={{xs: 12}}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <LockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No credentials found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add your first credential to get started
              </Typography>
            </Paper>
          </Grid>
        ) : (
          Object.entries(groupedCredentials).map(([clientName, credentials]) => (
            <Grid size={{xs: 12}} key={clientName}>
              <Accordion
                expanded={expandedPanel === clientName}
                onChange={handleAccordionChange(clientName)}
                sx={{
                  boxShadow: 2,
                  '&:before': { display: 'none' },
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    background: `linear-gradient(135deg, ${primaryColor}10 0%, ${secondaryColor}10 100%)`,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${primaryColor}20 0%, ${secondaryColor}20 100%)`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                    <ShieldIcon sx={{ color: primaryColor }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {clientName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {credentials.length} credential{credentials.length !== 1 ? 's' : ''} stored
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={credentials.length}
                    size="small"
                    sx={{
                      bgcolor: `${primaryColor}20`,
                      color: primaryColor,
                      fontWeight: 600,
                      mr: 2,
                    }}
                  />
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <Grid container spacing={2} sx={{ p: 2 }}>
                    {credentials.map((credential) => {
                      const config = getPlatformConfig(credential.type);
                      const passwordStrength = getPasswordStrength(credential.password);

                      return (
                        <Grid size={{xs: 12, md: 6}} key={credential.id}>
                          <Card sx={{
                            height: '100%',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              boxShadow: 4,
                              transform: 'translateY(-2px)',
                            },
                          }}>
                            <CardContent>
                              {/* Header */}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Box
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: 2,
                                      bgcolor: `${config.color}20`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {React.cloneElement(config.icon, { sx: { color: config.color, fontSize: 24 } })}
                                  </Box>
                                  <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                      {credential.type}
                                    </Typography>
                                    <Chip
                                      label={passwordStrength.label}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.7rem',
                                        bgcolor: `${passwordStrength.color}20`,
                                        color: passwordStrength.color,
                                        fontWeight: 600,
                                      }}
                                    />
                                  </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Tooltip title="Edit">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenDialog(credential)}
                                      sx={{ color: primaryColor }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDelete(credential.id)}
                                      sx={{ color: '#ef4444' }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>

                              <Divider sx={{ mb: 2 }} />

                              {/* Username */}
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                  Username / Email
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                                    {credential.username}
                                  </Typography>
                                  <Tooltip title="Copy">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCopyToClipboard(credential.username)}
                                    >
                                      <CopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>

                              {/* Password */}
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                  Password
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                                    {showPasswords[credential.id] ? credential.password : '••••••••••••'}
                                  </Typography>
                                  <Tooltip title={showPasswords[credential.id] ? 'Hide' : 'Show'}>
                                    <IconButton
                                      size="small"
                                      onClick={() => togglePasswordVisibility(credential.id)}
                                    >
                                      {showPasswords[credential.id] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Copy">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCopyToClipboard(credential.password)}
                                    >
                                      <CopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>

                              {/* URL */}
                              {credential.url && (
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                    URL
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      mt: 0.5,
                                      color: primaryColor,
                                      cursor: 'pointer',
                                      '&:hover': { textDecoration: 'underline' },
                                    }}
                                    onClick={() => window.open(credential.url, '_blank')}
                                  >
                                    {credential.url}
                                  </Typography>
                                </Box>
                              )}

                              {/* Notes */}
                              {credential.notes && (
                                <Box sx={{ mb: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                    Notes
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {credential.notes}
                                  </Typography>
                                </Box>
                              )}

                              {/* Footer */}
                              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">
                                  Last updated: {new Date(credential.lastUpdated).toLocaleDateString('en-GB')}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          ))
        )}
      </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {editingCredential ? 'Edit Credential' : 'Add New Credential'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid size={{xs: 12}}>
                <TextField
                  fullWidth
                  select
                  label="Client"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  required
                >
                  {clients.map((client) => (
                    <MenuItem key={client._id} value={client._id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{xs: 12}}>
                <TextField
                  fullWidth
                  select
                  label="Platform / Type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <MenuItem value="Facebook">Facebook</MenuItem>
                  <MenuItem value="Instagram">Instagram</MenuItem>
                  <MenuItem value="Google Ads">Google Ads</MenuItem>
                  <MenuItem value="Email">Email</MenuItem>
                  <MenuItem value="Website">Website</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{xs: 12}}>
                <TextField
                  fullWidth
                  label="Username / Email"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {React.cloneElement(getPlatformConfig(formData.type).icon, { sx: { fontSize: 20 } })}
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{xs: 12}}>
                <TextField
                  fullWidth
                  label="Password"
                  type={showPasswords['dialog'] ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPasswords(prev => ({ ...prev, dialog: !prev.dialog }))}
                          edge="end"
                        >
                          {showPasswords['dialog'] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText={
                    <Chip
                      label={getPasswordStrength(formData.password).label}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: `${getPasswordStrength(formData.password).color}20`,
                        color: getPasswordStrength(formData.password).color,
                        fontWeight: 600,
                        mt: 0.5,
                      }}
                    />
                  }
                />
              </Grid>

              <Grid size={{xs: 12}}>
                <TextField
                  fullWidth
                  label="URL (Optional)"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com"
                />
              </Grid>

              <Grid size={{xs: 12}}>
                <TextField
                  fullWidth
                  label="Notes (Optional)"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional notes or information..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                fontWeight: 600,
                '&:hover': {
                  background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
                },
              }}
            >
              {saving ? 'Saving...' : (editingCredential ? 'Update Credential' : 'Add Credential')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ClientVault;
