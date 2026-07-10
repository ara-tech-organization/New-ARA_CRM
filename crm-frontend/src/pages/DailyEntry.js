import React, { useState, useEffect, useMemo, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  InputAdornment,
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Tabs,
  Tab,
  Autocomplete,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  TrendingUp,
  CurrencyRupee,
  Campaign,
  People,
  Today as TodayIcon,
  History as HistoryIcon,
  CalendarToday as CalendarIcon,
  Sync as SyncIcon,
  CloudDownload as CloudDownloadIcon,
  CloudQueue as CloudQueueIcon,
} from '@mui/icons-material';
import dailyEntryApi from '../api/dailyEntryApi';
import { TableLoader } from '../components/Loading';
import api from '../api/axios';
import {
  fetchDailyEntries,
  fetchTodayStats,
  createDailyEntryAsync,
  updateDailyEntryAsync,
  deleteDailyEntryAsync,
  clearError,
} from '../store/slices/dailyEntrySlice';

const validationSchema = Yup.object({
  date: Yup.date().required('Date is required'),
  client: Yup.string().required('Client is required'),
  metaForm: Yup.number().min(0, 'Must be positive'),
  metaWhatsapp: Yup.number().min(0, 'Must be positive'),
  metaFund: Yup.number().min(0, 'Must be positive'),
  googleCall: Yup.number().min(0, 'Must be positive'),
  googleWebsite: Yup.number().min(0, 'Must be positive'),
  googleFund: Yup.number().min(0, 'Must be positive'),
});

const StatCard = ({ title, value, icon, color, loading }) => (
  <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icon, { sx: { color, fontSize: 24 } })}
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color }}>
            {loading ? <CircularProgress size={20} /> : value}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const DailyEntry = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#1F3966';
  const secondaryColor = accentColor?.primary || '#0F172A';

  const dispatch = useDispatch();

  // Redux state
  const { entries, todayStats, loading, error } = useSelector((state) => state.dailyEntry);

  // Main API clients state
  const [mainApiClients, setMainApiClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 = Current Date, 1 = Past Date
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [fetchingMetaData, setFetchingMetaData] = useState(false);
  const [metaSyncLoading, setMetaSyncLoading] = useState(false);
  const [metaDataMessage, setMetaDataMessage] = useState({ type: '', text: '' });

  // Fetch clients from main API and entries on mount
  useEffect(() => {
    const fetchMainApiClients = async () => {
      setClientsLoading(true);
      try {
        const response = await api.get('/clients');
        const raw = response.data.data || response.data || [];
        // Hide dropped clients — they shouldn't appear in any daily-entry
        // dropdown / list since they're no longer active. The backend
        // default already filters them out; this is belt-and-braces.
        const data = Array.isArray(raw) ? raw.filter((c) => c?.status !== 'dropped') : [];
        // Transform to match expected format
        const transformedClients = data.map(client => ({
          _id: client._id,
          name: client.clientName,
          company: client.company || '',
          accountID: client.accountID || client.accountId,
          customerID: client.customerID,
          status: client.status || 'active',
        }));
        setMainApiClients(transformedClients);
      } catch (error) {
        console.error('Error fetching clients from main API:', error);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchMainApiClients();
    dispatch(fetchDailyEntries({ limit: 100 }));
    dispatch(fetchTodayStats());
  }, [dispatch]);

  // Filter entries by selected date
  const filteredEntries = useMemo(() => {
    if (!filterDate) return entries;
    return entries.filter(entry => {
      const entryDate = new Date(entry.date).toISOString().split('T')[0];
      return entryDate === filterDate;
    });
  }, [entries, filterDate]);

  // Calculate stats for the selected date
  const dateStats = useMemo(() => {
    const totalLeads = filteredEntries.reduce((sum, entry) => sum + (entry.totalLeads || 0), 0);
    const totalSpend = filteredEntries.reduce((sum, entry) => sum + (entry.totalSpend || 0), 0);
    const uniqueClients = new Set(filteredEntries.map(entry => entry.clientId)).size;
    return {
      totalLeads,
      totalSpend,
      totalEntries: filteredEntries.length,
      activeClients: uniqueClients,
    };
  }, [filteredEntries]);

  const formik = useFormik({
    initialValues: {
      date: new Date().toISOString().split('T')[0],
      client: '',
      metaForm: 0,
      metaWhatsapp: 0,
      metaFund: 0,
      googleCall: 0,
      googleWebsite: 0,
      googleFund: 0,
      notes: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      try {
        if (editingEntry) {
          await dispatch(updateDailyEntryAsync({
            id: editingEntry._id,
            data: values
          })).unwrap();
          setSuccessMessage('Entry updated successfully!');
        } else {
          await dispatch(createDailyEntryAsync(values)).unwrap();
          setSuccessMessage('Entry added successfully!');
        }
        // Refresh stats after change
        dispatch(fetchTodayStats());
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        handleCloseDialog();
      } catch (err) {
        // Error is handled by Redux
      }
    },
  });

  const handleOpenDialog = (entry = null) => {
    if (entry) {
      setEditingEntry(entry);
      // Determine if this is a current date or past date entry for tab selection
      const entryDate = entry.date ? new Date(entry.date).toISOString().split('T')[0] : '';
      const today = new Date().toISOString().split('T')[0];
      setActiveTab(entryDate === today ? 0 : 1);
      formik.setValues({
        date: entryDate,
        client: entry.clientId || '',
        metaForm: entry.metaForm || 0,
        metaWhatsapp: entry.metaWhatsapp || 0,
        metaFund: entry.metaFund || 0,
        googleCall: entry.googleCall || 0,
        googleWebsite: entry.googleWebsite || 0,
        googleFund: entry.googleFund || 0,
        notes: entry.notes || '',
      });
    } else {
      setEditingEntry(null);
      setActiveTab(0); // Default to Current Date tab
      formik.resetForm();
    }
    setOpenDialog(true);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Update date based on tab
    if (newValue === 0) {
      // Current Date tab - set to today
      formik.setFieldValue('date', new Date().toISOString().split('T')[0]);
    } else {
      // Past Date tab - clear or set to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      formik.setFieldValue('date', yesterday.toISOString().split('T')[0]);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingEntry(null);
    setActiveTab(0);
    formik.resetForm();
    dispatch(clearError());
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await dispatch(deleteDailyEntryAsync(id)).unwrap();
        dispatch(fetchTodayStats());
        setSuccessMessage('Entry deleted successfully!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (err) {
        // Error is handled by Redux
      }
    }
  };

  const calculateCPL = (fund, leads) => {
    return leads > 0 ? (fund / leads).toFixed(2) : '0.00';
  };

  // Get client name by ID
  const getClientName = (entry) => {
    // First check if clientName is stored directly on the entry
    if (entry.clientName) return entry.clientName;
    // Fallback: look up in mainApiClients by clientId
    const client = mainApiClients.find(c => c._id === entry.clientId);
    return client?.name || 'Unknown';
  };

  // Fetch Meta data from synced leads collection
  const handleFetchMetaData = async () => {
    const clientId = formik.values.client;
    const date = formik.values.date;

    if (!clientId || !date) {
      setMetaDataMessage({ type: 'error', text: 'Please select a client and date first' });
      setTimeout(() => setMetaDataMessage({ type: '', text: '' }), 3000);
      return;
    }

    setFetchingMetaData(true);
    setMetaDataMessage({ type: '', text: '' });

    try {
      const response = await dailyEntryApi.getMetaLeadData(clientId, date);

      if (response.success && response.data) {
        // Auto-populate the Meta fields
        formik.setFieldValue('metaForm', response.data.metaForm || 0);
        formik.setFieldValue('metaWhatsapp', response.data.metaWhatsapp || 0);
        formik.setFieldValue('metaFund', response.data.metaFund || 0);

        setMetaDataMessage({
          type: 'success',
          text: `Meta data fetched successfully! (Synced: ${new Date(response.data.syncedAt).toLocaleString()})`
        });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to fetch Meta data';
      setMetaDataMessage({ type: 'error', text: errorMsg });
    } finally {
      setFetchingMetaData(false);
      setTimeout(() => setMetaDataMessage({ type: '', text: '' }), 5000);
    }
  };

  // Trigger Meta sync for today via CRM_AsdManager API
  const handleTriggerMetaSync = async () => {
    setMetaSyncLoading(true);
    setMetaDataMessage({ type: '', text: '' });

    try {
      const response = await dailyEntryApi.triggerMetaSync();

      if (response.success) {
        setMetaDataMessage({
          type: 'success',
          text: 'Meta sync completed! You can now fetch the latest data.'
        });

        // If client and date are selected, auto-fetch the data
        if (formik.values.client && formik.values.date) {
          setTimeout(() => handleFetchMetaData(), 1000);
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to trigger Meta sync';
      setMetaDataMessage({ type: 'error', text: errorMsg });
    } finally {
      setMetaSyncLoading(false);
      setTimeout(() => setMetaDataMessage({ type: '', text: '' }), 5000);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Daily Entry Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track daily leads and campaign performance
        </Typography>
      </Box>

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setShowSuccess(false)}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Quick Stats for Selected Date */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            title="Total Leads"
            value={dateStats.totalLeads}
            icon={<TrendingUp />}
            color={primaryColor}
            loading={loading}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            title="Total Spend"
            value={`₹${(dateStats.totalSpend || 0).toLocaleString('en-IN')}`}
            icon={<CurrencyRupee />}
            color="#1F3966"
            loading={loading}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            title="Total Entries"
            value={dateStats.totalEntries}
            icon={<Campaign />}
            color="#10b981"
            loading={loading}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            title="Clients"
            value={dateStats.activeClients}
            icon={<People />}
            color="#ef4444"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Filter and Add Entry Section */}
      <Card sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Daily Entries
              </Typography>
              <TextField
                type="date"
                size="small"
                label="Filter by Date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon sx={{ color: primaryColor }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 200 }}
              />
              <Chip
                label={`${filteredEntries.length} entries`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{
                bgcolor: primaryColor,
                '&:hover': {
                  bgcolor: secondaryColor,
                },
              }}
            >
              Add Lead Entry
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 0 }}>
          {loading && filteredEntries.length === 0 ? (
            <TableLoader rows={5} message="Loading entries..." />
          ) : (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Meta Form</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>WhatsApp</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Meta Fund</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Meta CPL</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Google Call</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Website</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Google Fund</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Google CPL</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">
                        No entries found for {new Date(filterDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Click "Add Lead Entry" to create one
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...filteredEntries]
                    .sort((a, b) => (a.client?.name || '').localeCompare(b.client?.name || ''))
                    .map((entry) => {
                      const metaLeads = (entry.metaForm || 0) + (entry.metaWhatsapp || 0);
                      const googleLeads = (entry.googleCall || 0) + (entry.googleWebsite || 0);
                      const metaCPL = entry.metaCPL?.toFixed(2) || calculateCPL(entry.metaFund || 0, metaLeads);
                      const googleCPL = entry.googleCPL?.toFixed(2) || calculateCPL(entry.googleFund || 0, googleLeads);

                      return (
                        <TableRow key={entry._id} hover>
                          <TableCell>
                            <Chip
                              label={new Date(entry.date).toLocaleDateString('en-GB')}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {getClientName(entry)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={entry.metaForm || 0}
                              size="small"
                              sx={{ bgcolor: `${primaryColor}15`, color: primaryColor, fontWeight: 700, minWidth: 45 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={entry.metaWhatsapp || 0}
                              size="small"
                              sx={{ bgcolor: '#0F172A15', color: '#0F172A', fontWeight: 700, minWidth: 45 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3966' }}>
                              ₹{(entry.metaFund || 0).toLocaleString('en-IN')}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444' }}>
                              ₹{metaCPL}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={entry.googleCall || 0}
                              size="small"
                              sx={{ bgcolor: '#0F172A15', color: '#0F172A', fontWeight: 700, minWidth: 45 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={entry.googleWebsite || 0}
                              size="small"
                              sx={{ bgcolor: '#1F396615', color: '#1F3966', fontWeight: 700, minWidth: 45 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3966' }}>
                              ₹{(entry.googleFund || 0).toLocaleString('en-IN')}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3966' }}>
                              ₹{googleCPL}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Edit">
                              <IconButton size="small" color="primary" onClick={() => handleOpenDialog(entry)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDelete(entry._id)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', borderBottom: 'none', pb: 0 }}>
          {editingEntry ? 'Edit Lead Entry' : 'Add Lead Entry'}
        </DialogTitle>

        {/* Tabs for Current Date / Past Date - only show when adding new entry */}
        {!editingEntry && (
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              px: 3,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 40,
              },
            }}
          >
            <Tab
              icon={<TodayIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Current Date Entry"
              sx={{ gap: 1 }}
            />
            <Tab
              icon={<HistoryIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Past Date Entry"
              sx={{ gap: 1 }}
            />
          </Tabs>
        )}

        <form onSubmit={formik.handleSubmit}>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={1.5}>
              {/* Client and Date Row */}
              <Grid size={{xs: 12, sm: 6}}>
                <FormControl
                  fullWidth
                  error={formik.touched.client && Boolean(formik.errors.client)}
                >
                  {/* Searchable client picker. Stores `client._id` in
                      Formik's `client` field — same value the old Select
                      wrote, so validation + submit stay untouched. */}
                  <Autocomplete
                    id="client"
                    fullWidth
                    value={mainApiClients.find((c) => c._id === formik.values.client) || null}
                    onChange={(_, opt) => {
                      formik.setFieldValue('client', opt?._id || '');
                    }}
                    onBlur={() => formik.setFieldTouched('client', true)}
                    options={mainApiClients}
                    getOptionLabel={(opt) =>
                      opt?.name
                        ? `${opt.name}${opt.company ? ` (${opt.company})` : ''}`
                        : ''
                    }
                    isOptionEqualToValue={(a, b) => a?._id === b?._id}
                    loading={clientsLoading}
                    loadingText="Loading clients from Main API…"
                    noOptionsText="No clients found"
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {option.name}{option.company ? ` (${option.company})` : ''}
                        <Chip label="Main API" size="small" sx={{ bgcolor: `${primaryColor}15`, color: primaryColor, fontSize: '0.65rem', height: 18 }} />
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Client *"
                        placeholder="Type to search…"
                        error={formik.touched.client && Boolean(formik.errors.client)}
                      />
                    )}
                  />
                  {formik.touched.client && formik.errors.client && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                      {formik.errors.client}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid size={{xs: 12, sm: 6}}>
                {/* Current Date Tab - Read-only date */}
                {activeTab === 0 && !editingEntry ? (
                  <TextField
                    fullWidth
                    type="date"
                    name="date"
                    label="Date (Today)"
                    value={formik.values.date}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      readOnly: true,
                      sx: { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }
                    }}
                    helperText="Current date is automatically selected"
                  />
                ) : (
                  /* Past Date Tab or Edit mode - Editable date picker */
                  <TextField
                    fullWidth
                    type="date"
                    name="date"
                    label={activeTab === 1 ? "Select Past Date" : "Date"}
                    value={formik.values.date}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.date && Boolean(formik.errors.date)}
                    helperText={
                      formik.touched.date && formik.errors.date
                        ? formik.errors.date
                        : activeTab === 1 && !editingEntry
                        ? "Select a past date for the entry"
                        : ""
                    }
                    InputLabelProps={{ shrink: true }}
                    inputProps={{
                      max: activeTab === 1 && !editingEntry
                        ? new Date(Date.now() - 86400000).toISOString().split('T')[0] // Yesterday
                        : undefined
                    }}
                  />
                )}
              </Grid>

              {/* Meta Section */}
              <Grid size={{xs: 12}}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Campaign sx={{ color: '#1F3966' }} />
                    META Leads
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Sync Meta data from Facebook API for today">
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={handleTriggerMetaSync}
                        disabled={metaSyncLoading}
                        startIcon={metaSyncLoading ? <CircularProgress size={16} /> : <SyncIcon />}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {metaSyncLoading ? 'Syncing...' : 'Sync Meta'}
                      </Button>
                    </Tooltip>
                    <Tooltip title="Fetch Meta data for selected client and date">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleFetchMetaData}
                        disabled={fetchingMetaData || !formik.values.client || !formik.values.date}
                        startIcon={fetchingMetaData ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon />}
                        sx={{
                          bgcolor: '#1F3966',
                          '&:hover': { bgcolor: '#15294D' },
                          fontSize: '0.75rem',
                        }}
                      >
                        {fetchingMetaData ? 'Fetching...' : 'Fetch Meta Data'}
                      </Button>
                    </Tooltip>
                  </Box>
                </Box>
                {metaDataMessage.text && (
                  <Alert severity={metaDataMessage.type || 'info'} sx={{ mb: 1 }}>
                    {metaDataMessage.text}
                  </Alert>
                )}
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <TextField
                  fullWidth
                  type="number"
                  name="metaForm"
                  label="Form Leads"
                  value={formik.values.metaForm}
                  onChange={formik.handleChange}
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <TextField
                  fullWidth
                  type="number"
                  name="metaWhatsapp"
                  label="WhatsApp Leads"
                  value={formik.values.metaWhatsapp}
                  onChange={formik.handleChange}
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <TextField
                  fullWidth
                  type="number"
                  name="metaFund"
                  label="Meta Fund (₹)"
                  value={formik.values.metaFund}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    inputProps: { min: 0, step: 0.01 }
                  }}
                />
              </Grid>
              <Grid size={{xs: 12}}>
                <Box sx={{ bgcolor: '#1F396615', p: 1.5, borderRadius: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3966' }}>
                    Meta Total Leads: {(parseInt(formik.values.metaForm) || 0) + (parseInt(formik.values.metaWhatsapp) || 0)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3966' }}>
                    Meta CPL: ₹{calculateCPL(formik.values.metaFund, (parseInt(formik.values.metaForm) || 0) + (parseInt(formik.values.metaWhatsapp) || 0))}
                  </Typography>
                </Box>
              </Grid>

              {/* Google Section */}
              <Grid size={{xs: 12}}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Campaign sx={{ color: '#1F3966' }} />
                  GOOGLE Leads
                </Typography>
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <TextField
                  fullWidth
                  type="number"
                  name="googleCall"
                  label="Call Leads"
                  value={formik.values.googleCall}
                  onChange={formik.handleChange}
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <TextField
                  fullWidth
                  type="number"
                  name="googleWebsite"
                  label="Website Leads"
                  value={formik.values.googleWebsite}
                  onChange={formik.handleChange}
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <TextField
                  fullWidth
                  type="number"
                  name="googleFund"
                  label="Google Fund (₹)"
                  value={formik.values.googleFund}
                  onChange={formik.handleChange}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    inputProps: { min: 0, step: 0.01 }
                  }}
                />
              </Grid>
              <Grid size={{xs: 12}}>
                <Box sx={{ bgcolor: '#1F396615', p: 1.5, borderRadius: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3966' }}>
                    Google Total Leads: {(parseInt(formik.values.googleCall) || 0) + (parseInt(formik.values.googleWebsite) || 0)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F3966' }}>
                    Google CPL: ₹{calculateCPL(formik.values.googleFund, (parseInt(formik.values.googleCall) || 0) + (parseInt(formik.values.googleWebsite) || 0))}
                  </Typography>
                </Box>
              </Grid>

              {/* Notes Section */}
              <Grid size={{xs: 12}}>
                <Divider sx={{ my: 1 }} />
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  name="notes"
                  label="Notes (Optional)"
                  value={formik.values.notes}
                  onChange={formik.handleChange}
                  placeholder="Add any notes or observations..."
                  sx={{ mt: 2 }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            <Button
              onClick={handleCloseDialog}
              variant="outlined"
              startIcon={<Cancel />}
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save />}
              disabled={loading}
              sx={{
                bgcolor: primaryColor,
                '&:hover': {
                  bgcolor: secondaryColor,
                },
                px: 3,
              }}
            >
              {editingEntry ? 'Update' : 'Save'} Entry
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default DailyEntry;
