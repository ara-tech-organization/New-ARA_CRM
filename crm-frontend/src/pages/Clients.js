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
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { MenuItem, Select, InputLabel, FormControl } from '@mui/material';
import { TableLoader, PageLoader } from '../components/Loading';

const Clients = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.primary || '#6366F1';
  const secondaryColor = accentColor?.secondary || '#818CF8';

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Main API state - only source of data
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

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
    onboardedDate: new Date().toISOString().split('T')[0],
    status: 'active',
  });

  // Edit Client Dialog state
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);

  // Delete Confirmation Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
        status: client.status || 'active',
        onboardedDate: client.onboardDate || client.createdAt,
        removalReason: client.removalReason || '',
        links: client.links || [],
        createdAt: client.createdAt,
      }));
      setClients(transformedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setSnackbar({ open: true, message: 'Failed to fetch clients', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
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
      onboardedDate: new Date().toISOString().split('T')[0],
      status: 'active',
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
      onboardedDate: client.onboardedDate ? new Date(client.onboardedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: client.status || 'active',
      removalReason: client.removalReason || '',
      links: client.links || [],
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
      setSnackbar({ open: true, message: 'Organisation Type is required', severity: 'error' });
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

      console.log('Sending edit payload:', payload);

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
      setSnackbar({ open: true, message: 'Organisation Type is required', severity: 'error' });
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

      console.log('Sending payload:', JSON.stringify(payload, null, 2));

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Clients Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchClients}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{xs: 12, sm: 6, md: 4}}>
          <Card sx={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="overline">
                Total Clients
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 600, color: primaryColor }}>
                {clients.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 4}}>
          <Card sx={{ background: 'linear-gradient(135deg, #2e7d3215 0%, #2e7d3205 100%)' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="overline">
                Active Clients
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                {clients.filter(c => c.status === 'active').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 4}}>
          <Card sx={{ background: 'linear-gradient(135deg, #ed6c0215 0%, #ed6c0205 100%)' }}>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="overline">
                Inactive Clients
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 600, color: '#ed6c02' }}>
                {clients.filter(c => c.status === 'inactive').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
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
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Client ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Organisation Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Place</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Onboarded</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon fontSize="small" color="action" />
                          {client.organisationType || '-'}
                        </Box>
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
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        {selectedClient && (
          <>
            <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem', bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {selectedClient.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedClient.organisationType} | {selectedClient.clientID}
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
                  <Typography variant="caption" color="text.secondary">Organisation Type</Typography>
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
              </Grid>
              <Alert severity="info" sx={{ mt: 2 }}>
                Data fetched from Main API
              </Alert>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setDetailsOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientOpen} onClose={() => setAddClientOpen(false)} maxWidth="sm" fullWidth>
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
                label="Organisation Type *"
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
      <Dialog open={editClientOpen} onClose={() => setEditClientOpen(false)} maxWidth="sm" fullWidth>
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
                  label="Organisation Type *"
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
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
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
