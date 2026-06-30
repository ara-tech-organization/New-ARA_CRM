import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Facebook as FacebookIcon,
  Link as LinkIcon,
  Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  PersonOff as PersonOffIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material';
import { MenuItem, Select, InputLabel, FormControl, Radio, RadioGroup, FormControlLabel, FormLabel, Stepper, Step, StepLabel, InputAdornment } from '@mui/material';
import { TableLoader, PageLoader } from '../components/Loading';
import { useDataCache } from '../contexts/DataCacheContext';
import userApi from '../api/userApi';

const Clients = () => {
  const navigate = useNavigate();
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#C08552';
  const secondaryColor = accentColor?.primary || '#3E2723';

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
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
  });

  // Edit Client Dialog state
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);

  // Drop Confirmation Dialog state — soft-deletes the client by
  // flipping status to 'dropped'. Captures the reason + timestamp;
  // re-onboarding restores the client without losing history.
  const [dropDialogOpen, setDropDialogOpen] = useState(false);
  const [clientToDrop, setClientToDrop] = useState(null);
  const [dropReason, setDropReason] = useState('');
  const [dropping, setDropping] = useState(false);
  const [dropError, setDropError] = useState('');
  // Re-onboard confirmation
  const [reonboardDialogOpen, setReonboardDialogOpen] = useState(false);
  const [clientToReonboard, setClientToReonboard] = useState(null);
  const [reonboarding, setReonboarding] = useState(false);

  // Hard-delete confirmation. Distinct from Drop — this REMOVES the
  // client document plus every linked record (DailyEntry, FundEntry,
  // ContentEntry, Lead, Vault) via the backend cascade. No
  // re-onboard path; once confirmed the client is gone everywhere.
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Shared cache invalidator. After a successful delete we clear the
  // global clients cache so Dashboard / Leads / Ads pages refetch on
  // their next render and never show the deleted client.
  const { invalidateClients } = useDataCache();

  // Meta Setup Dialog state
  const [metaSetupOpen, setMetaSetupOpen] = useState(false);
  const [metaSetupClient, setMetaSetupClient] = useState(null);
  const [metaStep, setMetaStep] = useState(0);
  const [metaAdAccountInput, setMetaAdAccountInput] = useState('');
  const [metaConfig, setMetaConfig] = useState(null);
  const [metaAvailablePages, setMetaAvailablePages] = useState([]);
  const [metaSelectedPageId, setMetaSelectedPageId] = useState('');
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaError, setMetaError] = useState('');

  // Google Ads Setup Dialog state — single-step (customer ID + name)
  // because the Google integration only needs an account association,
  // unlike Meta which has the additional Page subscription step.
  const [googleSetupOpen, setGoogleSetupOpen] = useState(false);
  const [googleSetupClient, setGoogleSetupClient] = useState(null);
  const [googleCustomerIdInput, setGoogleCustomerIdInput] = useState('');
  const [googleAccountNameInput, setGoogleAccountNameInput] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');

  // Fetch clients from main API.
  //
  // `?includeDropped=true` opts this page back into seeing soft-deleted
  // clients. The backend hides dropped clients by default (so they
  // disappear from Dashboard, Leads, Ads Comparison, Analytics, etc.),
  // but this management screen needs the full roster to support the
  // Re-onboard flow. Re-onboarding flips status back to 'active' and
  // the dropped client automatically reappears everywhere else.
  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clients?includeDropped=true&limit=10000');
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
        metaEnabled: client.meta_enabled || false,
        metaAdAccountId: client.meta_ad_account_id || '',
        metaAdAccountName: client.meta_ad_account_name || '',
        metaPages: client.meta_pages || [],
        status: client.status || 'active',
        onboardedDate: client.onboardDate || client.createdAt,
        removalReason: client.removalReason || '',
        links: client.links || [],
        createdAt: client.createdAt,
        team: client.team || '',
        assignedSMM: client.assignedSMM || '',
        assignedSME: client.assignedSME || '',
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
    // GST Number is optional on edit too — matches the Add flow.

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

  // Open the Drop dialog — soft-delete prompt that requires a reason.
  const handleOpenDrop = (client) => {
    setClientToDrop(client);
    setDropReason('');
    setDropError('');
    setDropDialogOpen(true);
  };

  // Open the Re-onboard confirmation — restores a dropped client.
  const handleOpenReonboard = (client) => {
    setClientToReonboard(client);
    setReonboardDialogOpen(true);
  };

  // ── Meta (Facebook) Setup ──
  const resetMetaState = () => {
    setMetaStep(0);
    setMetaAdAccountInput('');
    setMetaConfig(null);
    setMetaAvailablePages([]);
    setMetaSelectedPageId('');
    setMetaBusy(false);
    setMetaError('');
  };

  const handleOpenMetaSetup = async (client) => {
    resetMetaState();
    setMetaSetupClient(client);
    setMetaSetupOpen(true);
    setMetaBusy(true);
    try {
      const res = await api.get(`/meta/client/${client._id}/config`);
      const cfg = res.data?.config || res.data || {};
      setMetaConfig(cfg);
      setMetaAdAccountInput(cfg.meta_ad_account_id || '');
      // If ad account is already set, skip straight to page selection
      if (cfg.meta_ad_account_id) {
        setMetaStep(1);
        await loadAvailablePages(client._id);
      }
    } catch (err) {
      // 404 is fine — means config not yet created; start at step 0
      if (err.response?.status !== 404) {
        setMetaError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load Meta config');
      }
    } finally {
      setMetaBusy(false);
    }
  };

  const loadAvailablePages = async (clientId) => {
    try {
      const res = await api.get(`/meta/client/${clientId}/available-pages`);
      setMetaAvailablePages(res.data?.pages || res.data || []);
    } catch (err) {
      setMetaError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load available Pages');
    }
  };

  const handleSaveMetaConfig = async () => {
    const trimmed = metaAdAccountInput.trim();
    if (!/^act_\d+$/.test(trimmed)) {
      setMetaError('Ad Account ID must be in the format act_1234567890');
      return;
    }
    setMetaBusy(true);
    setMetaError('');
    try {
      const res = await api.put(`/meta/client/${metaSetupClient._id}/config`, {
        meta_enabled: true,
        meta_ad_account_id: trimmed,
      });
      const cfg = res.data?.config || res.data || {};
      setMetaConfig(cfg);
      setMetaStep(1);
      await loadAvailablePages(metaSetupClient._id);
    } catch (err) {
      setMetaError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save Meta config');
    } finally {
      setMetaBusy(false);
    }
  };

  const handleSubscribeAndLaunch = async () => {
    if (!metaSelectedPageId) {
      setMetaError('Select a Page to attach');
      return;
    }
    setMetaBusy(true);
    setMetaError('');
    try {
      await api.post(`/meta/client/${metaSetupClient._id}/pages/${metaSelectedPageId}/subscribe`);
      // Fire the initial sync in the background — don't await.
      // Meta pulls up to 90 days of history which can take several minutes.
      api.post(`/meta/sync/${metaSetupClient._id}`).catch((e) => {
        console.error('Background Meta sync error:', e);
      });
      const targetId = metaSetupClient._id;
      const targetName = metaSetupClient.name;
      // Persist "sync in progress" so the banner shows immediately on the
      // Client Ads page and survives a refresh mid-fetch.
      try { sessionStorage.setItem(`meta_sync_in_progress_${targetId}`, '1'); } catch (_) {}
      setSnackbar({
        open: true,
        message: `${targetName} connected. Meta is fetching up to 90 days of campaign, insights, and lead data in the background — this can take several minutes. Taking you to the client's Ads page now…`,
        severity: 'info',
      });
      setMetaSetupOpen(false);
      resetMetaState();
      setMetaSetupClient(null);
      navigate(`/client-ads/${targetId}`);
    } catch (err) {
      setMetaError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to subscribe Page');
      setMetaBusy(false);
    }
  };

  const handleCloseMetaSetup = () => {
    setMetaSetupOpen(false);
    setMetaSetupClient(null);
    resetMetaState();
    // Refresh clients so the green FB icon reflects the new integration state
    fetchClients();
  };

  // ── Google Ads Setup ──
  const resetGoogleState = () => {
    setGoogleCustomerIdInput('');
    setGoogleAccountNameInput('');
    setGoogleBusy(false);
    setGoogleError('');
  };

  const handleOpenGoogleSetup = (client) => {
    resetGoogleState();
    setGoogleSetupClient(client);
    // Pre-fill from existing association so the dialog acts as both
    // "connect" and "edit" in one place.
    setGoogleCustomerIdInput(client.googleCustomerId || '');
    setGoogleAccountNameInput(client.googleAdsAccountName || '');
    setGoogleSetupOpen(true);
  };

  const handleCloseGoogleSetup = () => {
    setGoogleSetupOpen(false);
    setGoogleSetupClient(null);
    resetGoogleState();
    // Refresh clients so the green G icon reflects the new state
    fetchClients();
  };

  const handleSaveGoogleConfig = async () => {
    // Strip dashes/spaces — Google shows IDs as 123-456-7890 in the UI but
    // the API needs the digits-only form.
    const trimmed = String(googleCustomerIdInput || '').replace(/[\s-]/g, '');
    if (!/^\d{8,12}$/.test(trimmed)) {
      setGoogleError('Customer ID must be 8–12 digits (e.g. 1234567890 or 123-456-7890).');
      return;
    }
    setGoogleBusy(true);
    setGoogleError('');
    try {
      await api.put(`/google-ads/client/${googleSetupClient._id}/associate`, {
        customerId: trimmed,
        accountName: googleAccountNameInput.trim(),
      });
      const targetId = googleSetupClient._id;
      const targetName = googleSetupClient.name;
      setSnackbar({
        open: true,
        message: `${targetName} connected to Google Ads. A background sync is fetching campaigns and metrics — this can take a few minutes. Taking you to the client's Ads page now…`,
        severity: 'info',
      });
      setGoogleSetupOpen(false);
      resetGoogleState();
      setGoogleSetupClient(null);
      fetchClients();
      navigate(`/client-ads/${targetId}`);
    } catch (err) {
      setGoogleError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to connect Google Ads');
      setGoogleBusy(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setGoogleBusy(true);
    setGoogleError('');
    try {
      await api.put(`/google-ads/client/${googleSetupClient._id}/enable`, { enabled: false });
      setSnackbar({
        open: true,
        message: `Google Ads disconnected from ${googleSetupClient.name}.`,
        severity: 'success',
      });
      handleCloseGoogleSetup();
    } catch (err) {
      setGoogleError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to disconnect Google Ads');
      setGoogleBusy(false);
    }
  };

  // Soft-delete (drop) the client. Backend keeps the row + every
  // related record so reonboarding restores the full history.
  const handleDropClient = async () => {
    if (!clientToDrop) return;
    const reason = dropReason.trim();
    if (!reason) {
      setDropError('A reason is required to drop a client.');
      return;
    }
    setDropping(true);
    setDropError('');
    try {
      await api.patch(`/clients/${clientToDrop._id}/drop`, { reason });
      setSnackbar({
        open: true,
        message: `${clientToDrop.clientName} dropped — record kept for re-onboarding.`,
        severity: 'success',
      });
      setDropDialogOpen(false);
      setClientToDrop(null);
      setDropReason('');
      fetchClients();
    } catch (error) {
      console.error('Error dropping client:', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to drop client';
      setDropError(msg);
    } finally {
      setDropping(false);
    }
  };

  // Re-onboard a dropped client — flips status back to active.
  // No data was deleted on drop so leads/entries/funds resurface as-is.
  const handleReonboardClient = async () => {
    if (!clientToReonboard) return;
    setReonboarding(true);
    try {
      await api.patch(`/clients/${clientToReonboard._id}/reonboard`);
      setSnackbar({
        open: true,
        message: `${clientToReonboard.clientName} re-onboarded — back on the active list.`,
        severity: 'success',
      });
      setReonboardDialogOpen(false);
      setClientToReonboard(null);
      fetchClients();
    } catch (error) {
      console.error('Error re-onboarding client:', error);
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to re-onboard client',
        severity: 'error',
      });
    } finally {
      setReonboarding(false);
    }
  };

  // Open the hard-delete confirmation. Available on every row,
  // including already-dropped clients — Drop is a soft pause, Delete
  // is the irreversible escape hatch when an entry was created by
  // mistake or the relationship has genuinely ended forever.
  const handleOpenDelete = (client) => {
    setClientToDelete(client);
    setDeleteError('');
    setDeleteDialogOpen(true);
  };

  const handleCloseDelete = () => {
    if (deleting) return; // prevent close mid-request
    setDeleteDialogOpen(false);
    setClientToDelete(null);
    setDeleteError('');
  };

  // Hard-delete a client — DELETE /api/clients/:id cascades to every
  // linked collection (DailyEntry, FundEntry, ContentEntry, Lead,
  // Vault) on the backend. After success we strip the row from local
  // state AND invalidate the shared clients cache so Dashboard / Leads
  // / Ads pages refetch on their next render.
  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/clients/${clientToDelete._id}`);
      // Remove from the page's local list immediately so the UI
      // updates without waiting for the refetch.
      setClients((prev) => prev.filter((c) => c._id !== clientToDelete._id));
      // Wipe the shared cache so every other page picks up the change.
      invalidateClients();
      setSnackbar({
        open: true,
        message: `${clientToDelete.clientName} deleted permanently.`,
        severity: 'success',
      });
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to delete client';
      setDeleteError(msg);
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
    // GST Number is optional — many clients onboard without one
    // (small businesses, freelancers). If filled it still trims +
    // saves; if empty it's stored as ''.

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
      case 'dropped': return 'error';
      default: return 'default';
    }
  };

  // Pretty-print a Date or ISO string for tooltips/dialogs.
  const fmtDateTime = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return String(d); }
  };

  // Filter clients by search query across common fields
  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const haystack = [
        c.name, c.clientID, c.place, c.organisationType, c.gstNumber, c.accountId,
        c.assignedSMM, c.assignedSME, c.team, c.status,
        c.googleCustomerId, c.metaAdAccountId, c.metaAdAccountName,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, searchQuery]);

  // Paginated clients (from filtered set)
  const paginatedClients = filteredClients.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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
          <Tooltip arrow title="Add a new client to the CRM">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddClientOpen(true)}
              sx={{
                // Lock the base + hover bg to primaryColor and just
                // darken via filter — using secondaryColor for hover
                // was painting white text onto a light theme colour
                // and making the label invisible.
                bgcolor: primaryColor,
                color: '#fff',
                '&:hover': {
                  bgcolor: primaryColor,
                  color: '#fff',
                  filter: 'brightness(0.92)',
                },
              }}
            >
              Add Client
            </Button>
          </Tooltip>
          <Tooltip arrow title="Re-fetch the client list from the server">
            <Button
              variant="outlined"
              startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={fetchClients}
              disabled={loading}
            >
              Refresh
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search by name, place, industry, GST, account ID, SMM/SME, team, Google/Meta ID…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setSearchQuery(''); setPage(0); }}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ maxWidth: 560, bgcolor: 'background.paper' }}
        />
        {searchQuery && (
          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
            {filteredClients.length} of {clients.length} clients match
          </Typography>
        )}
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Total Clients', value: clients.length, color: primaryColor, tip: 'Every client on your books' },
          { label: 'Active Clients', value: clients.filter(c => c.status === 'active').length, color: '#10b981', tip: 'Clients with an Active status' },
          // Inactive + Dropped are rolled into one card per the team's
          // mental model — both mean "this client isn't actively running
          // with us right now." Keeping them as separate tiles was extra
          // noise; the underlying status enum still distinguishes them
          // for audit purposes (drop_reason / drop_history live only on
          // dropped clients).
          { label: 'Dropped Clients', value: clients.filter(c => c.status === 'inactive' || c.status === 'dropped').length, color: '#C08552', tip: 'Clients that are no longer active — both Inactive (paused) and Dropped (soft-deleted with audit trail) are counted here' },
        ].map((s, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Tooltip arrow placement="top" title={s.tip}>
              <Card variant="outlined" sx={{ borderLeft: `3px solid ${s.color}`, cursor: 'help' }}>
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
            </Tooltip>
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
                  {/* Team / Assigned SMM / Assigned SME columns hidden
                      here per spec — fields stay in state + on the
                      backend so they're still editable from the Edit
                      dialog and queryable elsewhere. */}
                  <Tooltip arrow title="Short unique ID used in URLs and reports"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>Client ID</TableCell></Tooltip>
                  <Tooltip arrow title="Display name shown across the CRM"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>Name</TableCell></Tooltip>
                  <Tooltip arrow title="Client's business / vertical"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>Industry</TableCell></Tooltip>
                  <Tooltip arrow title="Client's primary location"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>Place</TableCell></Tooltip>
                  <Tooltip arrow title="Date this client was added to the CRM"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>Onboarded</TableCell></Tooltip>
                  <Tooltip arrow title="Active / Inactive / Pending / Dropped"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>Status</TableCell></Tooltip>
                  <Tooltip arrow title="View, edit, link Google/Meta, drop or re-onboard"><TableCell sx={{ fontWeight: 600, cursor: 'help' }} align="center">Actions</TableCell></Tooltip>
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
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        No clients match "{searchQuery}".
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
                      {/* Team / Assigned SMM / Assigned SME columns were
                          dropped from this table — values still live on
                          the client doc and surface in the Edit dialog. */}
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
                          <Tooltip title={
                            client.googleAdsEnabled
                              ? `Google Ads connected: ${client.googleAdsAccountName || client.googleCustomerId || ''}`
                              : 'Set up Google Ads integration'
                          }>
                            <IconButton
                              size="small"
                              sx={{ color: client.googleAdsEnabled ? '#10b981' : '#4285F4' }}
                              onClick={() => handleOpenGoogleSetup(client)}
                            >
                              <GoogleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={client.metaEnabled ? `Meta connected: ${client.metaAdAccountName || client.metaAdAccountId}` : 'Set up Meta (Facebook) integration'}>
                            <IconButton
                              size="small"
                              sx={{ color: client.metaEnabled ? '#10b981' : '#1877F2' }}
                              onClick={() => handleOpenMetaSetup(client)}
                            >
                              <FacebookIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Drop replaces Delete — keeps history,
                              requires a reason, and shows when. If
                              the client is already dropped, we swap
                              in a Re-onboard action instead so the
                              admin can bring them back. */}
                          {client.status === 'dropped' ? (
                            <Tooltip title={client.drop_reason ? `Dropped: ${client.drop_reason}` : 'Re-onboard Client'}>
                              <IconButton
                                size="small"
                                sx={{ color: '#10b981' }}
                                onClick={() => handleOpenReonboard(client)}
                              >
                                <RestoreIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Drop Client">
                              <IconButton
                                size="small"
                                sx={{ color: '#ef4444' }}
                                onClick={() => handleOpenDrop(client)}
                              >
                                <PersonOffIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {/* Hard delete — irreversible. Distinct icon
                              + dark-red colour so it can't be confused
                              with the Drop action above it. Available
                              regardless of status because mistakes can
                              also be made on dropped clients. */}
                          <Tooltip title="Delete Client (permanent)">
                            <IconButton
                              size="small"
                              sx={{ color: '#991b1b' }}
                              onClick={() => handleOpenDelete(client)}
                            >
                              <DeleteForeverIcon fontSize="small" />
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
            count={filteredClients.length}
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
                inputProps={{ maxLength: 200 }}
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
                inputProps={{ maxLength: 100 }}
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
                inputProps={{ maxLength: 100 }}
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
                inputProps={{ maxLength: 500 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="GST Number"
                name="gstNumber"
                value={newClient.gstNumber}
                onChange={handleInputChange}
                placeholder="Optional"
                inputProps={{ maxLength: 30 }}
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
            sx={{
              bgcolor: primaryColor,
              color: '#fff',
              '&:hover': { bgcolor: primaryColor, color: '#fff', filter: 'brightness(0.92)' },
            }}
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
                  inputProps={{ maxLength: 200 }}
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
                  inputProps={{ maxLength: 100 }}
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
                  inputProps={{ maxLength: 100 }}
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
                  inputProps={{ maxLength: 500 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="GST Number"
                  name="gstNumber"
                  value={editClient.gstNumber}
                  onChange={handleEditInputChange}
                  placeholder="Optional"
                  inputProps={{ maxLength: 30 }}
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

      {/* Drop Client Dialog — soft-delete with reason capture.
          Backend keeps the client + all related data so reonboarding
          restores the full history. */}
      <Dialog open={dropDialogOpen} onClose={() => !dropping && setDropDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, bgcolor: '#fef2f2', color: '#b91c1c' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonOffIcon />
            Drop {clientToDrop?.clientName || clientToDrop?.name}
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ mb: 1 }}>
            This client will be marked as <strong>dropped</strong> and hidden from the active list.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            All leads, daily entries, funds, vault credentials, and content are preserved. If they
            come back, just click <em>Re-onboard</em> on their row and the history is restored.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            required
            label="Reason for dropping"
            placeholder="e.g. Contract ended, paused campaigns, switched agency…"
            value={dropReason}
            onChange={(e) => setDropReason(e.target.value)}
            error={!!dropError && !dropReason.trim()}
            helperText={dropError || 'Required — saved on the client record for audit.'}
            disabled={dropping}
          />
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
            Drop timestamp will be recorded as <strong>{fmtDateTime(new Date())}</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setDropDialogOpen(false); setClientToDrop(null); }} disabled={dropping}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDropClient}
            disabled={dropping || !dropReason.trim()}
            startIcon={dropping ? <CircularProgress size={16} /> : <PersonOffIcon />}
            sx={{
              bgcolor: '#ef4444',
              color: '#fff',
              '&:hover': { bgcolor: '#ef4444', color: '#fff', filter: 'brightness(0.92)' },
            }}
          >
            {dropping ? 'Dropping…' : 'Drop Client'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Re-onboard Confirmation — for a previously dropped client.
          Shows the original drop reason + date so the admin knows
          what they're restoring. */}
      <Dialog open={reonboardDialogOpen} onClose={() => !reonboarding && setReonboardDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, bgcolor: '#f0fdf4', color: '#0e7c4a' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestoreIcon />
            Re-onboard {clientToReonboard?.clientName || clientToReonboard?.name}
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ mb: 1 }}>
            Bring this client back into the active list?
          </Typography>
          {clientToReonboard?.dropped_at && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1, border: '1px solid #fee2e2' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Previously dropped
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.3 }}>
                <strong>On:</strong> {fmtDateTime(clientToReonboard.dropped_at)}
              </Typography>
              {clientToReonboard?.drop_reason && (
                <Typography variant="body2">
                  <strong>Reason:</strong> {clientToReonboard.drop_reason}
                </Typography>
              )}
              {clientToReonboard?.dropped_by && (
                <Typography variant="body2">
                  <strong>By:</strong> {clientToReonboard.dropped_by}
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
            All previously stored data (leads, entries, funds, vault, content) will be available immediately.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setReonboardDialogOpen(false); setClientToReonboard(null); }} disabled={reonboarding}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleReonboardClient}
            disabled={reonboarding}
            startIcon={reonboarding ? <CircularProgress size={16} /> : <RestoreIcon />}
            sx={{
              bgcolor: '#10b981',
              color: '#fff',
              '&:hover': { bgcolor: '#10b981', color: '#fff', filter: 'brightness(0.92)' },
            }}
          >
            {reonboarding ? 'Re-onboarding…' : 'Re-onboard'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Hard Delete Confirmation ───────────────────────────────
          Simple yes/no on a destructive irreversible action. Wipes
          the client doc + every linked record via the backend cascade,
          then invalidates the shared clients cache so they vanish
          from every page. */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDelete}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2, fontWeight: 700, color: '#991b1b' }}>
          <DeleteForeverIcon sx={{ color: '#991b1b' }} />
          Delete Client Permanently
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
            This cannot be undone. Every lead, daily entry, fund entry,
            content entry, and vault record linked to this client will
            be deleted along with the client itself. Use{' '}
            <strong>Drop</strong> instead if there's any chance you'll
            re-onboard them later.
          </Alert>
          <Typography sx={{ fontSize: '0.92rem' }}>
            Delete{' '}
            <Box component="span" sx={{ fontWeight: 700 }}>
              {clientToDelete?.clientName}
            </Box>
            ?
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2, borderRadius: 1.5 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDelete} disabled={deleting} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteClient}
            disabled={deleting || !clientToDelete}
            startIcon={deleting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <DeleteForeverIcon />}
            sx={{
              bgcolor: '#991b1b', color: '#fff', fontWeight: 700,
              '&:hover': { bgcolor: '#991b1b', filter: 'brightness(1.1)' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)' },
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Meta (Facebook) Setup Dialog */}
      <Dialog open={metaSetupOpen} onClose={metaBusy ? undefined : handleCloseMetaSetup} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FacebookIcon sx={{ color: '#1877F2' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Meta Setup{metaSetupClient ? ` — ${metaSetupClient.name}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Connect a Facebook Ad Account and Page to this client
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stepper activeStep={metaStep} sx={{ mb: 3, mt: 1 }}>
            <Step><StepLabel>Ad Account</StepLabel></Step>
            <Step><StepLabel>Page & Launch</StepLabel></Step>
          </Stepper>

          {metaError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMetaError('')}>
              {metaError}
            </Alert>
          )}

          {metaStep === 0 && (
            <Box>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Enter the Meta Ad Account ID to attach to this client. Format: <code>act_1234567890</code>.
              </Typography>
              <TextField
                fullWidth
                label="Meta Ad Account ID"
                placeholder="act_967896905356867"
                value={metaAdAccountInput}
                onChange={(e) => setMetaAdAccountInput(e.target.value)}
                disabled={metaBusy}
                autoFocus
              />
              {metaConfig?.meta_ad_account_name && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                  Currently: {metaConfig.meta_ad_account_name} ({metaConfig.meta_ad_account_currency || '—'})
                </Typography>
              )}
            </Box>
          )}

          {metaStep === 1 && (
            <Box>
              <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ mb: 2 }}>
                Ad Account attached: <strong>{metaConfig?.meta_ad_account_name || metaConfig?.meta_ad_account_id}</strong>
                {metaConfig?.meta_ad_account_currency ? ` • ${metaConfig.meta_ad_account_currency}` : ''}
              </Alert>
              <FormLabel sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                Select the Facebook Page to subscribe
              </FormLabel>
              <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: 'text.secondary' }}>
                On launch, the data fetch will start in the background and can take a few minutes (up to 90 days of history). You'll be redirected to the client's Ads page immediately.
              </Typography>
              {metaBusy && metaAvailablePages.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={18} /> <Typography variant="body2">Loading Pages…</Typography>
                </Box>
              ) : metaAvailablePages.length === 0 ? (
                <Alert severity="warning">
                  No Pages available from this ad account's Business. Make sure the System User has access.
                </Alert>
              ) : (
                <RadioGroup value={metaSelectedPageId} onChange={(e) => setMetaSelectedPageId(e.target.value)}>
                  {metaAvailablePages.map((p) => (
                    <FormControlLabel
                      key={p.page_id || p.id}
                      value={p.page_id || p.id}
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {p.page_name || p.name}
                            {p.already_assigned && (
                              <Chip label="already attached" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {p.page_id || p.id}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </RadioGroup>
              )}
            </Box>
          )}

        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMetaSetup} disabled={metaBusy}>
            Cancel
          </Button>
          {metaStep === 0 && (
            <Button
              variant="contained"
              onClick={handleSaveMetaConfig}
              disabled={metaBusy || !metaAdAccountInput.trim()}
              startIcon={metaBusy ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{ bgcolor: '#1877F2', '&:hover': { bgcolor: '#1464d8' } }}
            >
              {metaBusy ? 'Saving…' : 'Save & Continue'}
            </Button>
          )}
          {metaStep === 1 && (
            <Button
              variant="contained"
              onClick={handleSubscribeAndLaunch}
              disabled={metaBusy || !metaSelectedPageId}
              startIcon={metaBusy ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}
              sx={{ bgcolor: '#1877F2', '&:hover': { bgcolor: '#1464d8' } }}
            >
              {metaBusy ? 'Finishing…' : 'Attach & Launch'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Google Ads Setup Dialog — mirror of the Meta dialog above, but
          single-step: Google only needs an account association (customer
          ID + name) before the background sync kicks off. */}
      <Dialog open={googleSetupOpen} onClose={googleBusy ? undefined : handleCloseGoogleSetup} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <GoogleIcon sx={{ color: '#4285F4' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Google Ads Setup{googleSetupClient ? ` — ${googleSetupClient.name}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {googleSetupClient?.googleAdsEnabled
                  ? 'Update or disconnect this client\'s Google Ads association'
                  : 'Connect a Google Ads customer account to this client'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {googleError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGoogleError('')}>
              {googleError}
            </Alert>
          )}

          {googleSetupClient?.googleAdsEnabled && (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ mb: 2 }}>
              Currently connected: <strong>{googleSetupClient.googleAdsAccountName || googleSetupClient.googleCustomerId || '—'}</strong>
            </Alert>
          )}

          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Enter the Google Ads Customer ID for this client. You can find it in the top-right of your Google Ads dashboard. Format: <code>123-456-7890</code> or <code>1234567890</code>.
          </Typography>
          <TextField
            fullWidth
            label="Google Ads Customer ID"
            placeholder="123-456-7890"
            value={googleCustomerIdInput}
            onChange={(e) => setGoogleCustomerIdInput(e.target.value)}
            disabled={googleBusy}
            autoFocus
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Account Name (optional)"
            placeholder="Ad Grohair Kovilambakkam"
            value={googleAccountNameInput}
            onChange={(e) => setGoogleAccountNameInput(e.target.value)}
            disabled={googleBusy}
            helperText="Friendly label shown on the Clients list and Ad details page."
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Box>
            {googleSetupClient?.googleAdsEnabled && (
              <Button
                color="error"
                onClick={handleDisconnectGoogle}
                disabled={googleBusy}
              >
                Disconnect
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={handleCloseGoogleSetup} disabled={googleBusy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveGoogleConfig}
              disabled={googleBusy || !googleCustomerIdInput.trim()}
              startIcon={googleBusy ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}
              sx={{ bgcolor: '#4285F4', '&:hover': { bgcolor: '#3367d6' } }}
            >
              {googleBusy ? 'Connecting…' : (googleSetupClient?.googleAdsEnabled ? 'Update & Sync' : 'Connect & Launch')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'info' ? 10000 : 4000}
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
