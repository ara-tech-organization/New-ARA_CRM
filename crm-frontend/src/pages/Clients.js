import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import api from '../api/axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Grid,
  Tooltip,
  Divider,
  LinearProgress,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Visibility as VisibilityIcon,
  CalendarMonth as CalendarIcon,
  CloudQueue as CloudQueueIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Google as GoogleIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { MenuItem, Select, InputLabel, FormControl } from '@mui/material';
import { TableLoader, PageLoader } from '../components/Loading';
import userApi from '../api/userApi';

const Clients = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#C08552';
  const secondaryColor = accentColor?.primary || '#3E2723';

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Main API state - only source of data
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // SMM users for Assigned SMM/SME dropdowns
  const [smmUsers, setSmmUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  // Add Client Dialog state
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState({
    clientName: '',
    place: '',
    organisationType: '',
    address: '',
    gstNumber: '',
    accountId: '',
    googleCustomerId: '',
    onboardedDate: new Date().toISOString().split('T')[0],
    status: 'active',
    team: '',
    assignedSMM: '',
    assignedSME: '',
    creativeCommitment: '',
    staticCommitment: '',
    motionCreative: '',
    notes: '',
  });

  // Edit Client Dialog state
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);

  // Delete Confirmation Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Merge Duplicates state
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [dupGroups, setDupGroups] = useState([]);
  const [mergeSelection, setMergeSelection] = useState({}); // { normalizedKey: keepId }
  const [merging, setMerging] = useState(false);

  // Fetch clients from main API
  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clients');
      const data = response.data.data || response.data;
      // Transform to match expected format
      const transformedClients = data.map(client => ({
        _id: client._id,
        clientID: client._id.slice(-8).toUpperCase(),
        name: client.clientName,
        place: client.place || '',
        organisationType: client.organisationType || '',
        address: client.address || '',
        gstNumber: client.gstNumber || '',
        accountId: client.accountId || '',
        // Backend uses snake_case: google_ads_customer_id + google_ads_enabled
        googleCustomerId: client.google_ads_customer_id || client.googleCustomerId || '',
        googleAdsEnabled: client.google_ads_enabled || false,
        status: client.status || 'active',
        onboardedDate: client.onboardDate || client.createdAt,
        removalReason: client.removalReason || '',
        links: client.links || [],
        createdAt: client.createdAt,
        team: client.team || '',
        assignedSMM: client.assignedSMM || '',
        assignedSME: client.assignedSME || '',
        creativeCommitment: client.creativeCommitment || '',
        staticCommitment: client.staticCommitment || '',
        motionCreative: client.motionCreative || '',
        notes: client.notes || '',
      }));
      setClients(transformedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setSnackbar({ open: true, message: 'Failed to fetch clients', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch SMM users for dropdowns
  const fetchSMMUsers = async () => {
    try {
      const response = await api.get('/clients/smm-users');
      setSmmUsers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching SMM users:', error);
    }
  };

  // Fetch teams from DB
  const fetchTeams = async () => {
    try {
      const response = await userApi.getTeams();
      setTeams(response.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  // Fetch clients, SMM users, and teams on mount
  useEffect(() => {
    fetchClients();
    fetchSMMUsers();
    fetchTeams();
  }, []);

  const handleViewDetails = (client) => {
    setSelectedClient(client);
    setDetailsOpen(true);
  };

  // Handle input change for new client form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewClient(prev => ({ ...prev, [name]: value }));
  };

  // Reset form
  const resetForm = () => {
    setNewClient({
      clientName: '',
      place: '',
      organisationType: '',
      address: '',
      gstNumber: '',
      accountId: '',
      googleCustomerId: '',
      onboardedDate: new Date().toISOString().split('T')[0],
      status: 'active',
      team: '',
      assignedSMM: '',
      assignedSME: '',
      creativeCommitment: '',
      staticCommitment: '',
      motionCreative: '',
      notes: '',
    });
  };

  // Handle edit input change
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditClient(prev => ({ ...prev, [name]: value }));
  };

  // Open edit dialog
  const handleOpenEdit = (client) => {
    setEditClient({
      _id: client._id,
      clientName: client.name || '',
      place: client.place || '',
      organisationType: client.organisationType || '',
      address: client.address || '',
      gstNumber: client.gstNumber || '',
      accountId: client.accountId || '',
      googleCustomerId: client.googleCustomerId || '',
      onboardedDate: client.onboardedDate ? new Date(client.onboardedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: client.status || 'active',
      removalReason: client.removalReason || '',
      links: client.links || [],
      team: client.team || '',
      assignedSMM: client.assignedSMM || '',
      assignedSME: client.assignedSME || '',
      creativeCommitment: client.creativeCommitment || '',
      staticCommitment: client.staticCommitment || '',
      motionCreative: client.motionCreative || '',
      notes: client.notes || '',
    });
    setEditClientOpen(true);
  };

  // Handle edit client submit
  const handleEditClient = async () => {
    // Validate all required fields
    if (!editClient.clientName.trim()) {
      setSnackbar({ open: true, message: 'Client name is required', severity: 'error' });
      return;
    }
    if (!editClient.place?.trim()) {
      setSnackbar({ open: true, message: 'Place is required', severity: 'error' });
      return;
    }
    if (!editClient.organisationType?.trim()) {
      setSnackbar({ open: true, message: 'Industry is required', severity: 'error' });
      return;
    }
    if (!editClient.address?.trim()) {
      setSnackbar({ open: true, message: 'Address is required', severity: 'error' });
      return;
    }
    if (!editClient.gstNumber?.trim()) {
      setSnackbar({ open: true, message: 'GST Number is required', severity: 'error' });
      return;
    }

    setSaving(true);
    try {
      // Build payload matching the main API schema exactly
      const payload = {
        clientName: editClient.clientName.trim(),
        place: editClient.place.trim(),
        organisationType: editClient.organisationType.trim(),
        address: editClient.address.trim(),
        onboardDate: editClient.onboardedDate ? new Date(editClient.onboardedDate).toISOString() : new Date().toISOString(),
        gstNumber: editClient.gstNumber.trim(),
        status: editClient.status || 'active',
        removalReason: editClient.removalReason || '',
        links: editClient.links || [],
        team: editClient.team || '',
        assignedSMM: editClient.assignedSMM || '',
        assignedSME: editClient.assignedSME || '',
        creativeCommitment: editClient.creativeCommitment?.trim() || '',
        staticCommitment: editClient.staticCommitment?.trim() || '',
        motionCreative: editClient.motionCreative?.trim() || '',
        notes: editClient.notes?.trim() || '',
      };

      // Add optional accountId only if provided (must contain only digits)
      if (editClient.accountId?.trim()) {
        const accountIdTrimmed = editClient.accountId.trim();
        if (!/^\d+$/.test(accountIdTrimmed)) {
          setSnackbar({ open: true, message: 'Account ID must contain only numbers', severity: 'error' });
          setSaving(false);
          return;
        }
        payload.accountId = accountIdTrimmed;
      }

      await api.put(`/clients/${editClient._id}`, payload);

      setSnackbar({ open: true, message: 'Client updated successfully!', severity: 'success' });
      setEditClientOpen(false);
      setEditClient(null);
      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      setSnackbar({ open: true, message: error.message || 'Failed to update client', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Open delete confirmation dialog
  const handleOpenDelete = (client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  // ── Detect & Merge Duplicates ──
  const handleOpenDuplicates = () => {
    // Group clients by normalized name (trimmed, lowercase, collapsed spaces)
    const normalize = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const buckets = {};
    clients.forEach(c => {
      const key = normalize(c.name);
      if (!key) return;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(c);
    });
    const dupes = Object.entries(buckets)
      .filter(([, arr]) => arr.length > 1)
      .map(([key, arr]) => ({ key, clients: arr }));

    if (dupes.length === 0) {
      setSnackbar({ open: true, message: 'No duplicate clients found', severity: 'info' });
      return;
    }

    // Default: pick the most-complete record (prefer googleAdsEnabled, then most non-empty fields)
    const scoreClient = (c) => {
      let score = 0;
      if (c.googleAdsEnabled) score += 100;
      ['place', 'organisationType', 'address', 'gstNumber', 'accountId', 'assignedSMM', 'assignedSME', 'team', 'creativeCommitment', 'staticCommitment', 'motionCreative', 'notes'].forEach(f => {
        if (c[f]) score += 1;
      });
      return score;
    };
    const defaults = {};
    dupes.forEach(({ key, clients: group }) => {
      const best = [...group].sort((a, b) => scoreClient(b) - scoreClient(a))[0];
      defaults[key] = best._id;
    });
    setMergeSelection(defaults);
    setDupGroups(dupes);
    setDupDialogOpen(true);
  };

  const handleMergeGroup = async (group, keepId) => {
    const keep = group.find(c => c._id === keepId);
    const dupes = group.filter(c => c._id !== keepId);
    if (!keep || dupes.length === 0) return;

    // Build merged payload — take keep's values, fill empty fields from dupes
    const mergedPayload = {
      clientName: keep.name,
      place: keep.place || dupes.find(d => d.place)?.place || '',
      organisationType: keep.organisationType || dupes.find(d => d.organisationType)?.organisationType || '',
      address: keep.address || dupes.find(d => d.address)?.address || '',
      gstNumber: keep.gstNumber || dupes.find(d => d.gstNumber)?.gstNumber || '',
      status: keep.status || 'active',
      team: keep.team || dupes.find(d => d.team)?.team || '',
      assignedSMM: keep.assignedSMM || dupes.find(d => d.assignedSMM)?.assignedSMM || '',
      assignedSME: keep.assignedSME || dupes.find(d => d.assignedSME)?.assignedSME || '',
      creativeCommitment: keep.creativeCommitment || dupes.find(d => d.creativeCommitment)?.creativeCommitment || '',
      staticCommitment: keep.staticCommitment || dupes.find(d => d.staticCommitment)?.staticCommitment || '',
      motionCreative: keep.motionCreative || dupes.find(d => d.motionCreative)?.motionCreative || '',
      notes: keep.notes || dupes.find(d => d.notes)?.notes || '',
    };
    if (keep.accountId || dupes.find(d => d.accountId)) {
      mergedPayload.accountId = keep.accountId || dupes.find(d => d.accountId)?.accountId || '';
    }

    // If keep isn't linked to Google Ads but a duplicate is, transfer the link
    if (!keep.googleAdsEnabled) {
      const linkedDupe = dupes.find(d => d.googleAdsEnabled && d.googleCustomerId);
      if (linkedDupe) {
        try {
          await api.put(`/google-ads/client/${keep._id}/associate`, {
            customerId: linkedDupe.googleCustomerId,
            accountName: linkedDupe.name,
          });
        } catch (err) {
          console.error('Failed to transfer Google Ads link:', err);
        }
      }
    }

    // Update kept record with merged fields
    await api.put(`/clients/${keep._id}`, mergedPayload);

    // Delete duplicates
    for (const d of dupes) {
      try {
        await api.delete(`/clients/${d._id}`);
      } catch (err) {
        console.error(`Failed to delete duplicate ${d._id}:`, err);
      }
    }
  };

  const handleMergeAll = async () => {
    setMerging(true);
    let mergedCount = 0;
    let errorCount = 0;
    try {
      for (const { key, clients: group } of dupGroups) {
        const keepId = mergeSelection[key];
        if (!keepId) continue;
        try {
          await handleMergeGroup(group, keepId);
          mergedCount++;
        } catch (err) {
          console.error(`Merge failed for group "${key}":`, err);
          errorCount++;
        }
      }
      setSnackbar({
        open: true,
        message: errorCount > 0
          ? `Merged ${mergedCount} group(s), ${errorCount} failed`
          : `Successfully merged ${mergedCount} duplicate group(s)`,
        severity: errorCount > 0 ? 'warning' : 'success',
      });
      setDupDialogOpen(false);
      setDupGroups([]);
      await fetchClients();
    } finally {
      setMerging(false);
    }
  };

  // Handle delete client
  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    setDeleting(true);
    try {
      await api.delete(`/clients/${clientToDelete._id}`);

      setSnackbar({ open: true, message: 'Client deleted successfully!', severity: 'success' });
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      setSnackbar({ open: true, message: error.message || 'Failed to delete client', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // Handle add client submit
  const handleAddClient = async () => {
    // Validate all required fields
    if (!newClient.clientName.trim()) {
      setSnackbar({ open: true, message: 'Client name is required', severity: 'error' });
      return;
    }
    if (!newClient.place.trim()) {
      setSnackbar({ open: true, message: 'Place is required', severity: 'error' });
      return;
    }
    if (!newClient.organisationType.trim()) {
      setSnackbar({ open: true, message: 'Industry is required', severity: 'error' });
      return;
    }
    if (!newClient.address.trim()) {
      setSnackbar({ open: true, message: 'Address is required', severity: 'error' });
      return;
    }
    if (!newClient.gstNumber.trim()) {
      setSnackbar({ open: true, message: 'GST Number is required', severity: 'error' });
      return;
    }

    setSaving(true);
    try {
      // Build payload matching the main API schema exactly
      const payload = {
        clientName: newClient.clientName.trim(),
        place: newClient.place.trim(),
        organisationType: newClient.organisationType.trim(),
        address: newClient.address.trim(),
        onboardDate: newClient.onboardedDate ? new Date(newClient.onboardedDate).toISOString() : new Date().toISOString(),
        gstNumber: newClient.gstNumber.trim(),
        team: newClient.team || '',
        assignedSMM: newClient.assignedSMM || '',
        assignedSME: newClient.assignedSME || '',
        creativeCommitment: newClient.creativeCommitment?.trim() || '',
        staticCommitment: newClient.staticCommitment?.trim() || '',
        motionCreative: newClient.motionCreative?.trim() || '',
        notes: newClient.notes?.trim() || '',
      };

      // Add optional accountId only if provided (must contain only digits)
      if (newClient.accountId?.trim()) {
        const accountIdTrimmed = newClient.accountId.trim();
        if (!/^\d+$/.test(accountIdTrimmed)) {
          setSnackbar({ open: true, message: 'Account ID must contain only numbers', severity: 'error' });
          setSaving(false);
          return;
        }
        payload.accountId = accountIdTrimmed;
      }


      const response = await api.post('/clients', payload);
      console.log('API Response:', response.data);

      setSnackbar({ open: true, message: 'Client added successfully!', severity: 'success' });
      setAddClientOpen(false);
      resetForm();
      fetchClients();
    } catch (error) {
      console.error('Error adding client:', error);
      setSnackbar({ open: true, message: error.message || 'Failed to add client', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'pending': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  // Paginated clients
  const paginatedClients = clients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Show aesthetic loader during initial data fetch
  if (loading && clients.length === 0) {
    return <PageLoader message="Loading clients..." />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Clients Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddClientOpen(true)}
            sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: secondaryColor } }}
          >
            Add Client
          </Button>
          <Button
            variant="outlined"
            startIcon={<LinkIcon />}
            onClick={handleOpenDuplicates}
            sx={{ borderColor: '#C08552', color: '#C08552' }}
          >
            Find Duplicates
          </Button>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchClients}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Total Clients', value: clients.length, color: primaryColor },
          { label: 'Active Clients', value: clients.filter(c => c.status === 'active').length, color: '#10b981' },
          { label: 'Inactive Clients', value: clients.filter(c => c.status === 'inactive').length, color: '#C08552' },
        ].map((s, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ borderLeft: `3px solid ${s.color}` }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BusinessIcon sx={{ color: s.color, fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
                  <Typography sx={{ fontWeight: 700, color: s.color, fontSize: '1.3rem', lineHeight: 1.2 }}>{s.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent>
          {loading ? (
            <TableLoader rows={5} message="Fetching clients..." />
          ) : (
          <>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Client ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Team</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Industry</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Assigned SMM</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Assigned SME</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Place</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Onboarded</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        No clients found. Click "Refresh" to fetch from Main API.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedClients.map((client) => (
                    <TableRow key={client._id} hover>
                      <TableCell>
                        <Chip
                          label={client.clientID}
                          size="small"
                          sx={{ bgcolor: `${primaryColor}15`, color: primaryColor, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {client.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {client.team ? (
                          <Chip label={client.team} size="small" color="success" variant="outlined" />
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon fontSize="small" color="action" />
                          {client.organisationType || '-'}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{client.assignedSMM || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{client.assignedSME || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{client.place || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarIcon sx={{ fontSize: 14 }} color="action" />
                          <Typography variant="body2">
                            {formatDate(client.onboardedDate)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={client.status}
                          color={getStatusColor(client.status)}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewDetails(client)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Client">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => handleOpenEdit(client)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {client.googleAdsEnabled && (
                            <Tooltip title={`Linked to Google Ads: ${client.googleCustomerId}`}>
                              <IconButton size="small" sx={{ color: '#10b981' }} disabled>
                                <GoogleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete Client">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleOpenDelete(client)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={clients.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
          </>
          )}
        </CardContent>
      </Card>

      {/* Client Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth fullScreen={false}>
        {selectedClient && (
          <>
            <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem', bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedClient.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedClient.organisationType || 'N/A'} | {selectedClient.clientID}
                  </Typography>
                </Box>
                <Chip
                  label={selectedClient.status}
                  color={getStatusColor(selectedClient.status)}
                  sx={{ textTransform: 'capitalize' }}
                />
              </Box>
            </DialogTitle>
            <Divider />
            <DialogContent>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Place</Typography>
                  <Typography variant="body2">{selectedClient.place || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Industry</Typography>
                  <Typography variant="body2">{selectedClient.organisationType || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 12}}>
                  <Typography variant="caption" color="text.secondary">Address</Typography>
                  <Typography variant="body2">{selectedClient.address || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">GST Number</Typography>
                  <Typography variant="body2">{selectedClient.gstNumber || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Onboarded Date</Typography>
                  <Typography variant="body2">{formatDate(selectedClient.onboardedDate)}</Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Account ID</Typography>
                  <Typography variant="body2">{selectedClient.accountId || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Google Ads Customer ID</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{selectedClient.googleCustomerId || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Team</Typography>
                  <Typography variant="body2">
                    {selectedClient.team ? (
                      <Chip label={selectedClient.team} size="small" color="success" variant="outlined" />
                    ) : '-'}
                  </Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Assigned SMM</Typography>
                  <Typography variant="body2">{selectedClient.assignedSMM || '-'}</Typography>
                </Grid>
                <Grid size={{xs: 6}}>
                  <Typography variant="caption" color="text.secondary">Assigned SME</Typography>
                  <Typography variant="body2">{selectedClient.assignedSME || '-'}</Typography>
                </Grid>
                {(selectedClient.creativeCommitment || selectedClient.staticCommitment || selectedClient.motionCreative) && (
                  <>
                    <Grid size={{xs: 12}}>
                      <Divider sx={{ my: 0.5 }} />
                    </Grid>
                    <Grid size={{xs: 4}}>
                      <Typography variant="caption" color="text.secondary">Creative Commitment</Typography>
                      <Typography variant="body2">{selectedClient.creativeCommitment || '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 4}}>
                      <Typography variant="caption" color="text.secondary">Static Commitment</Typography>
                      <Typography variant="body2">{selectedClient.staticCommitment || '-'}</Typography>
                    </Grid>
                    <Grid size={{xs: 4}}>
                      <Typography variant="caption" color="text.secondary">Motion Creative</Typography>
                      <Typography variant="body2">{selectedClient.motionCreative || '-'}</Typography>
                    </Grid>
                  </>
                )}
                {selectedClient.notes && (
                  <Grid size={{xs: 12}}>
                    <Typography variant="caption" color="text.secondary">Notes</Typography>
                    <Typography variant="body2">{selectedClient.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setDetailsOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientOpen} onClose={() => setAddClientOpen(false)} maxWidth="md" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon sx={{ color: primaryColor }} />
            Add New Client
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Client Name *"
                name="clientName"
                value={newClient.clientName}
                onChange={handleInputChange}
                placeholder="Enter client name"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Place *"
                name="place"
                value={newClient.place}
                onChange={handleInputChange}
                placeholder="City/Location"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Industry *"
                name="organisationType"
                value={newClient.organisationType}
                onChange={handleInputChange}
                placeholder="e.g., Aesthetic Clinic"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Address *"
                name="address"
                value={newClient.address}
                onChange={handleInputChange}
                placeholder="Full address"
                multiline
                rows={2}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="GST Number *"
                name="gstNumber"
                value={newClient.gstNumber}
                onChange={handleInputChange}
                placeholder="GST Number"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Account ID"
                name="accountId"
                value={newClient.accountId}
                onChange={handleInputChange}
                placeholder="Account ID (numbers only)"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Onboarded Date *"
                name="onboardedDate"
                type="date"
                value={newClient.onboardedDate}
                onChange={handleInputChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={newClient.status}
                  label="Status"
                  onChange={handleInputChange}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Team Assignment
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Team Name</InputLabel>
                <Select
                  name="team"
                  value={newClient.team}
                  label="Team Name"
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewClient(prev => ({ ...prev, team: val, assignedSMM: '', assignedSME: '' }));
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {teams.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Assigned SMM</InputLabel>
                <Select
                  name="assignedSMM"
                  value={newClient.assignedSMM}
                  label="Assigned SMM"
                  onChange={handleInputChange}
                >
                  <MenuItem value="">None</MenuItem>
                  {smmUsers.map(u => (
                    <MenuItem key={u._id || u.userID} value={u.name}>{u.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Assigned SME</InputLabel>
                <Select
                  name="assignedSME"
                  value={newClient.assignedSME}
                  label="Assigned SME"
                  onChange={handleInputChange}
                >
                  <MenuItem value="">None</MenuItem>
                  {smmUsers.map(u => (
                    <MenuItem key={u._id || u.userID} value={u.name}>{u.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Commitments & Notes
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Creative Commitment"
                name="creativeCommitment"
                value={newClient.creativeCommitment}
                onChange={handleInputChange}
                placeholder="e.g., 10 per month"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Static Commitment"
                name="staticCommitment"
                value={newClient.staticCommitment}
                onChange={handleInputChange}
                placeholder="e.g., 5 per month"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Motion Creative"
                name="motionCreative"
                value={newClient.motionCreative}
                onChange={handleInputChange}
                placeholder="e.g., 3 per month"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Notes"
                name="notes"
                value={newClient.notes}
                onChange={handleInputChange}
                placeholder="Additional notes..."
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setAddClientOpen(false); resetForm(); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddClient}
            disabled={saving || !newClient.clientName.trim()}
            startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
            sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: secondaryColor } }}
          >
            {saving ? 'Adding...' : 'Add Client'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editClientOpen} onClose={() => setEditClientOpen(false)} maxWidth="md" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ color: '#1976d2' }} />
            Edit Client
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          {editClient && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Client Name *"
                  name="clientName"
                  value={editClient.clientName}
                  onChange={handleEditInputChange}
                  placeholder="Enter client name"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Place *"
                  name="place"
                  value={editClient.place}
                  onChange={handleEditInputChange}
                  placeholder="City/Location"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Industry *"
                  name="organisationType"
                  value={editClient.organisationType}
                  onChange={handleEditInputChange}
                  placeholder="e.g., Aesthetic Clinic"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Address *"
                  name="address"
                  value={editClient.address}
                  onChange={handleEditInputChange}
                  placeholder="Full address"
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="GST Number *"
                  name="gstNumber"
                  value={editClient.gstNumber}
                  onChange={handleEditInputChange}
                  placeholder="GST Number"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Account ID"
                  name="accountId"
                  value={editClient.accountId}
                  onChange={handleEditInputChange}
                  placeholder="Account ID (numbers only)"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Onboarded Date *"
                  name="onboardedDate"
                  type="date"
                  value={editClient.onboardedDate}
                  onChange={handleEditInputChange}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={editClient.status}
                    label="Status"
                    onChange={handleEditInputChange}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="suspended">Suspended</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Team Assignment
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Team Name</InputLabel>
                  <Select
                    name="team"
                    value={editClient.team}
                    label="Team Name"
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditClient(prev => ({ ...prev, team: val, assignedSMM: '', assignedSME: '' }));
                    }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {teams.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Assigned SMM</InputLabel>
                  <Select
                    name="assignedSMM"
                    value={editClient.assignedSMM}
                    label="Assigned SMM"
                    onChange={handleEditInputChange}
                  >
                    <MenuItem value="">None</MenuItem>
                    {smmUsers.map(u => (
                      <MenuItem key={u._id || u.userID} value={u.name}>{u.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Assigned SME</InputLabel>
                  <Select
                    name="assignedSME"
                    value={editClient.assignedSME}
                    label="Assigned SME"
                    onChange={handleEditInputChange}
                  >
                    <MenuItem value="">None</MenuItem>
                    {smmUsers.map(u => (
                      <MenuItem key={u._id || u.userID} value={u.name}>{u.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Commitments & Notes
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Creative Commitment"
                  name="creativeCommitment"
                  value={editClient.creativeCommitment}
                  onChange={handleEditInputChange}
                  placeholder="e.g., 10 per month"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Static Commitment"
                  name="staticCommitment"
                  value={editClient.staticCommitment}
                  onChange={handleEditInputChange}
                  placeholder="e.g., 5 per month"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Motion Creative"
                  name="motionCreative"
                  value={editClient.motionCreative}
                  onChange={handleEditInputChange}
                  placeholder="e.g., 3 per month"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  name="notes"
                  value={editClient.notes}
                  onChange={handleEditInputChange}
                  placeholder="Additional notes..."
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setEditClientOpen(false); setEditClient(null); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditClient}
            disabled={saving || !editClient?.clientName?.trim()}
            startIcon={saving ? <CircularProgress size={16} /> : <EditIcon />}
            color="primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, bgcolor: 'error.50', color: 'error.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon />
            Confirm Delete
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Typography>
            Are you sure you want to delete client <strong>{clientToDelete?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setDeleteDialogOpen(false); setClientToDelete(null); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteClient}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Merge Duplicates Dialog */}
      <Dialog open={dupDialogOpen} onClose={() => !merging && setDupDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon sx={{ color: '#C08552' }} />
          Merge Duplicate Clients
          <Chip label={`${dupGroups.length} groups`} size="small" sx={{ ml: 'auto', bgcolor: '#C0855215', color: '#C08552' }} />
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Review before merging</Typography>
            <Typography sx={{ fontSize: '0.76rem' }}>
              For each group, select the record to KEEP. All other duplicates will be deleted and their non-empty fields will be merged into the kept record. Google Ads links transfer automatically.
            </Typography>
          </Alert>

          {dupGroups.map(({ key, clients: group }) => (
            <Paper key={key} variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
                {group[0].name}
                <Chip label={`${group.length} records`} size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem', bgcolor: '#ef444415', color: '#ef4444' }} />
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                {group.map((c) => {
                  const isKeep = mergeSelection[key] === c._id;
                  const fieldsFilled = ['place', 'organisationType', 'address', 'gstNumber', 'accountId', 'assignedSMM', 'assignedSME', 'team'].filter(f => c[f]).length;
                  return (
                    <Box
                      key={c._id}
                      onClick={() => setMergeSelection(prev => ({ ...prev, [key]: c._id }))}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2,
                        border: isKeep ? '2px solid #10b981' : '1px solid',
                        borderColor: isKeep ? '#10b981' : 'divider',
                        borderRadius: 1.5, cursor: 'pointer',
                        bgcolor: isKeep ? '#10b98110' : 'transparent',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: isKeep ? '#10b981' : '#C08552' },
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.secondary' }}>
                            {c._id}
                          </Typography>
                          {c.googleAdsEnabled && (
                            <Chip
                              icon={<GoogleIcon sx={{ fontSize: 11 }} />}
                              label={`Linked: ${c.googleCustomerId}`}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#10b98115', color: '#10b981', fontWeight: 600 }}
                            />
                          )}
                          <Chip
                            label={`${fieldsFilled} fields filled`}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#C0855215', color: '#C08552' }}
                          />
                          {c.status && (
                            <Chip label={c.status} size="small" sx={{ height: 18, fontSize: '0.65rem', textTransform: 'capitalize' }} />
                          )}
                        </Box>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                          {[c.team, c.assignedSME, c.place, c.organisationType].filter(Boolean).join(' • ') || 'No additional info'}
                        </Typography>
                      </Box>
                      {isKeep ? (
                        <Chip label="KEEP" size="small" sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 700, height: 22 }} />
                      ) : (
                        <Chip label="Delete" size="small" variant="outlined" sx={{ color: '#ef4444', borderColor: '#ef4444', height: 22 }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDupDialogOpen(false)} disabled={merging}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMergeAll}
            disabled={merging}
            startIcon={merging ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}
            sx={{ bgcolor: '#C08552', '&:hover': { bgcolor: '#8B5E3C' } }}
          >
            {merging ? 'Merging...' : `Merge ${dupGroups.length} Group(s)`}
          </Button>
        </DialogActions>
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

export default Clients;
