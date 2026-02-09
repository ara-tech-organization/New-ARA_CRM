import React, { useState, useEffect, useMemo, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
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
  Paper,
  Chip,
  Alert,
  Snackbar,
  InputAdornment,
  FormControl,
  Select,
  Tooltip,
  Tabs,
  Tab,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import {
  Save,
  DateRange,
  Edit as EditIcon,
  History,
  CalendarMonth,
  CloudDownload as CloudDownloadIcon,
  CloudQueue as CloudQueueIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../api/axios';

const META_SYNC_API_URL = 'https://crmasdmanager-amh2amgzd3e6dzc8.canadacentral-01.azurewebsites.net';

const paymentModes = ['Net Banking', 'QR Code', 'Card'];

// Get placeholder text based on payment mode
const getPaymentPlaceholder = (mode) => {
  switch (mode) {
    case 'Net Banking':
      return 'Enter Account No.';
    case 'QR Code':
      return 'Enter UPI ID';
    case 'Card':
      return 'Enter Card No.';
    default:
      return 'Enter details';
  }
};

const FundEntry = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.primary || '#6366F1';
  const secondaryColor = accentColor?.secondary || '#818CF8';

  const [activeTab, setActiveTab] = useState(0);
  const [dailyEntryPlatformTab, setDailyEntryPlatformTab] = useState(0); // 0 = Meta, 1 = Google
  const [summaryPlatformTab, setSummaryPlatformTab] = useState(0); // 0 = Meta, 1 = Google
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [fundData, setFundData] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Main API state - only source of data
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Summary tab state
  const [summaryClient, setSummaryClient] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [summaryData, setSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Meta sync state
  const [fetchingBalances, setFetchingBalances] = useState(false);

  // Fetch clients from main API
  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/clients');
      const data = response.data.data || response.data;
      // Transform to match expected format
      const transformedClients = data.map(client => ({
        _id: client._id,
        clientID: client.clientID || client._id.slice(-8).toUpperCase(),
        name: client.clientName,
        email: client.email || '-',
        phone: client.phone || '-',
        company: client.company || '-',
        accountID: client.accountID || client.accountId,
        customerID: client.customerID,
        status: client.status || 'active',
      }));
      setClients(transformedClients);
    } catch (error) {
      console.error('Error fetching clients from main API:', error);
      setSnackbar({ open: true, message: 'Failed to fetch clients from Main API', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
  }, []);

  // Initialize fund data when clients load
  useEffect(() => {
    if (clients.length > 0) {
      const initialData = {};
      clients.forEach(client => {
        if (!fundData[client._id]) {
          initialData[client._id] = {
            metaBalance: 0,
            googleBalance: 0,
            fundAdded: 0,
            metaAmount: 0,
            googleAmount: 0,
            metaPaymentMode: '',
            metaPaymentDetails: '',
            googlePaymentMode: '',
            googlePaymentDetails: '',
          };
        }
      });
      if (Object.keys(initialData).length > 0) {
        setFundData(prev => ({ ...prev, ...initialData }));
      }
    }
  }, [clients]);

  // Fetch summary data from main API when client/dates change
  useEffect(() => {
    const fetchSummaryData = async () => {
      if (!summaryClient || !dateFrom || !dateTo) {
        setSummaryData([]);
        return;
      }

      setSummaryLoading(true);
      try {
        // Fetch all funds from main API
        const response = await api.get('/funds');
        const funds = response.data.data || response.data;

        // Filter by client and date range
        const filteredFunds = funds.filter(fund => {
          const fundClientId = fund.clientId?._id || fund.clientId;
          const fundDate = fund.date;
          return fundClientId === summaryClient && fundDate >= dateFrom && fundDate <= dateTo;
        }).map(fund => ({
          _id: fund._id,
          date: fund.date,
          metaBalance: fund.metaBalance || 0,
          googleBalance: fund.googleBalance || 0,
          metaAmount: fund.metaAmount || 0,
          googleAmount: fund.googleAmount || 0,
          metaPaymentMode: fund.metaPaymentMode || '',
          metaPaymentDetails: fund.metaPaymentDetails || '',
          googlePaymentMode: fund.googlePaymentMode || '',
          googlePaymentDetails: fund.googlePaymentDetails || '',
          fundAdded: (fund.metaAmount || 0) + (fund.googleAmount || 0),
        }));

        setSummaryData(filteredFunds);
      } catch (error) {
        console.error('Failed to fetch summary data:', error);
        setSnackbar({ open: true, message: 'Failed to fetch fund summary', severity: 'error' });
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchSummaryData();
  }, [summaryClient, dateFrom, dateTo]);

  // Fetch Meta balances by triggering MetaSync API, then auto-populate from synced data
  const handleFetchBalances = async () => {
    setFetchingBalances(true);

    try {
      // Trigger MetaSync API to fetch fresh balances from Meta & Google
      setSnackbar({
        open: true,
        message: 'Syncing balances from Meta & Google...',
        severity: 'info'
      });

      const syncResponse = await fetch(`${META_SYNC_API_URL}/api/meta-sync/today`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!syncResponse.ok) {
        throw new Error(`MetaSync API returned status ${syncResponse.status}`);
      }

      const syncResult = await syncResponse.json();
      console.log('MetaSync result:', syncResult);

      // Get the results array from the sync response
      const syncResults = syncResult.Results || syncResult.results || [];

      // Create a map of client names to their sync data
      const clientSyncMap = {};
      syncResults.forEach(result => {
        if (result.client && !result.error) {
          const clientName = result.client?.toLowerCase().trim();
          clientSyncMap[clientName] = result;
        }
      });

      // Match with clients and update fund data with Meta/Google balances
      const updatedFundData = { ...fundData };
      let matchedCount = 0;

      clients.forEach(client => {
        const localClientName = client.name?.toLowerCase().trim();
        const matchedSync = clientSyncMap[localClientName];

        if (matchedSync) {
          updatedFundData[client._id] = {
            ...updatedFundData[client._id],
            metaBalance: matchedSync.metaBalance || 0,
            googleBalance: matchedSync.googleBalance || 0,
          };
          matchedCount++;
        }
      });

      setFundData(updatedFundData);
      setSnackbar({
        open: true,
        message: `Successfully fetched balances for ${matchedCount} clients from Meta!`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error fetching balances:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch balances from Meta',
        severity: 'error'
      });
    } finally {
      setFetchingBalances(false);
    }
  };

  // Handle input change for a specific client and field
  const handleInputChange = (clientId, field, value) => {
    setFundData(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        [field]: value,
      },
    }));
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    let totalMetaBalance = 0;
    let totalGoogleBalance = 0;
    let totalMetaAmount = 0;
    let totalGoogleAmount = 0;
    let totalFundAdded = 0;

    summaryData.forEach(data => {
      totalMetaBalance += data.metaBalance || 0;
      totalGoogleBalance += data.googleBalance || 0;
      totalMetaAmount += data.metaAmount || 0;
      totalGoogleAmount += data.googleAmount || 0;
      totalFundAdded += data.fundAdded || 0;
    });

    return {
      totalMetaBalance,
      totalGoogleBalance,
      totalMetaAmount,
      totalGoogleAmount,
      totalFundAdded,
      totalAmount: totalMetaAmount + totalGoogleAmount,
      entriesCount: summaryData.length,
    };
  }, [summaryData]);

  // Save single client fund entry to MAIN API
  const handleSaveEntry = async (clientId) => {
    const client = clients.find(c => c._id === clientId);
    const data = fundData[clientId] || {};

    if (!client) {
      setSnackbar({ open: true, message: 'Client not found', severity: 'error' });
      return;
    }

    try {
      const payload = {
        clientId: clientId,
        clientName: client.name,
        date: selectedDate,
        metaBalance: parseFloat(data.metaBalance) || 0,
        googleBalance: parseFloat(data.googleBalance) || 0,
        metaAmount: parseFloat(data.metaAmount) || 0,
        metaPaymentMode: data.metaPaymentMode || '',
        metaPaymentDetails: data.metaPaymentDetails || '',
        googleAmount: parseFloat(data.googleAmount) || 0,
        googlePaymentMode: data.googlePaymentMode || '',
        googlePaymentDetails: data.googlePaymentDetails || '',
      };

      await api.post('/funds', payload);

      setSnackbar({ open: true, message: `Fund entry saved for ${client.name}!`, severity: 'success' });
    } catch (error) {
      console.error('Error saving fund entry:', error);
      setSnackbar({ open: true, message: `Failed to save fund entry: ${error.message}`, severity: 'error' });
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Fund Entry
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage campaign budgets and payment tracking
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={fetchClients}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Tabs */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            px: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 600,
              textTransform: 'none',
              minHeight: 56,
              fontSize: '1rem',
            },
          }}
        >
          <Tab
            icon={<EditIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Daily Entry"
            sx={{ gap: 1 }}
          />
          <Tab
            icon={<History sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Fund Summary"
            sx={{ gap: 1 }}
          />
        </Tabs>
      </Card>

      {/* Daily Entry Tab */}
      {activeTab === 0 && (
        <>
          {/* Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3, gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              type="date"
              label="Entry Date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DateRange sx={{ fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 200 }}
            />
            <Tooltip title="Fetch Meta & Google balances from main API for all clients">
              <Button
                variant="outlined"
                color="primary"
                startIcon={fetchingBalances ? <CircularProgress size={18} /> : <CloudDownloadIcon />}
                onClick={handleFetchBalances}
                disabled={fetchingBalances}
                sx={{ px: 2 }}
              >
                {fetchingBalances ? 'Fetching...' : 'Fetch Balances'}
              </Button>
            </Tooltip>
          </Box>

          {/* Editable Table */}
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, py: 2, bgcolor: '#f9fafb', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Client Fund Entries
                  <Chip
                    label={new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    size="small"
                    color="primary"
                    sx={{ ml: 2 }}
                  />
                </Typography>
                <Tabs
                  value={dailyEntryPlatformTab}
                  onChange={(e, newValue) => setDailyEntryPlatformTab(newValue)}
                  sx={{
                    minHeight: 36,
                    '& .MuiTab-root': {
                      minHeight: 36,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      px: 2,
                    },
                  }}
                >
                  <Tab
                    label="Meta"
                    sx={{
                      color: dailyEntryPlatformTab === 0 ? '#1877f2' : 'text.secondary',
                      '&.Mui-selected': { color: '#1877f2' },
                    }}
                  />
                  <Tab
                    label="Google"
                    sx={{
                      color: dailyEntryPlatformTab === 1 ? '#34a853' : 'text.secondary',
                      '&.Mui-selected': { color: '#34a853' },
                    }}
                  />
                </Tabs>
              </Box>
              {loading || fetchingBalances ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={40} sx={{ color: primaryColor, mb: 2 }} />
                  <Typography color="text.secondary">
                    {fetchingBalances ? 'Fetching balances from Meta & Google...' : 'Loading fund entries...'}
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f9fafb' }}>
                        <TableCell sx={{ fontWeight: 700, minWidth: 160, position: 'sticky', left: 0, bgcolor: '#f9fafb', zIndex: 1 }}>
                          Client
                        </TableCell>
                        {dailyEntryPlatformTab === 0 ? (
                          <>
                            {/* META Columns */}
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#1877f2', bgcolor: '#1877f210' }} align="center">
                              Meta Balance
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#1877f2', bgcolor: '#1877f210' }} align="center">
                              Meta Amount
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#1877f2', bgcolor: '#1877f210' }} align="center">
                              Meta Payment Mode
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 130, color: '#1877f2', bgcolor: '#1877f210' }} align="center">
                              Meta Payment Details
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 100 }} align="center">
                              Action
                            </TableCell>
                          </>
                        ) : (
                          <>
                            {/* GOOGLE Columns */}
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#34a853', bgcolor: '#34a85310' }} align="center">
                              Google Balance
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#34a853', bgcolor: '#34a85310' }} align="center">
                              Google Amount
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#34a853', bgcolor: '#34a85310' }} align="center">
                              Google Payment Mode
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 130, color: '#34a853', bgcolor: '#34a85310' }} align="center">
                              Google Payment Details
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 100 }} align="center">
                              Action
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clients.map((client) => {
                        const data = fundData[client._id] || {};

                        const isLowBalance = (data.metaBalance || 0) < 1000;

                        return (
                          <TableRow
                            key={client._id}
                            hover
                            sx={{
                              bgcolor: isLowBalance ? '#fee2e2' : 'inherit',
                              '&:hover': {
                                bgcolor: isLowBalance ? '#fecaca !important' : undefined,
                              },
                            }}
                          >
                            {/* Client Name */}
                            <TableCell sx={{ position: 'sticky', left: 0, bgcolor: isLowBalance ? '#fee2e2' : 'white', zIndex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {client.name}
                              </Typography>
                            </TableCell>

                            {dailyEntryPlatformTab === 0 ? (
                              <>
                                {/* META COLUMNS */}
                                <TableCell align="center" sx={{ bgcolor: '#1877f208' }}>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={data.metaBalance || ''}
                                    onChange={(e) => handleInputChange(client._id, 'metaBalance', e.target.value)}
                                    InputProps={{
                                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                      inputProps: { min: 0, step: 0.01, style: { textAlign: 'right' } }
                                    }}
                                    sx={{ width: 110 }}
                                  />
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#1877f208' }}>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={data.metaAmount || ''}
                                    onChange={(e) => handleInputChange(client._id, 'metaAmount', e.target.value)}
                                    InputProps={{
                                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                      inputProps: { min: 0, step: 0.01, style: { textAlign: 'right' } }
                                    }}
                                    sx={{ width: 110 }}
                                  />
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#1877f208' }}>
                                  <FormControl size="small" sx={{ minWidth: 115 }}>
                                    <Select
                                      value={data.metaPaymentMode || ''}
                                      onChange={(e) => handleInputChange(client._id, 'metaPaymentMode', e.target.value)}
                                      displayEmpty
                                      sx={{ fontSize: '0.8rem' }}
                                    >
                                      <MenuItem value="" sx={{ fontSize: '0.8rem' }}>Select</MenuItem>
                                      {paymentModes.map(mode => (
                                        <MenuItem key={mode} value={mode} sx={{ fontSize: '0.8rem' }}>{mode}</MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#1877f208' }}>
                                  <TextField
                                    size="small"
                                    placeholder={getPaymentPlaceholder(data.metaPaymentMode)}
                                    value={data.metaPaymentDetails || ''}
                                    onChange={(e) => handleInputChange(client._id, 'metaPaymentDetails', e.target.value)}
                                    sx={{ width: 130 }}
                                    inputProps={{ style: { fontSize: '0.8rem' } }}
                                    disabled={!data.metaPaymentMode}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<Save sx={{ fontSize: 16 }} />}
                                    onClick={() => handleSaveEntry(client._id)}
                                    sx={{
                                      textTransform: 'none',
                                      fontSize: '0.75rem',
                                      py: 0.5,
                                      px: 1.5,
                                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                                      '&:hover': {
                                        background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
                                      },
                                    }}
                                  >
                                    Save
                                  </Button>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                {/* GOOGLE COLUMNS */}
                                <TableCell align="center" sx={{ bgcolor: '#34a85308' }}>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={data.googleBalance || ''}
                                    onChange={(e) => handleInputChange(client._id, 'googleBalance', e.target.value)}
                                    InputProps={{
                                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                      inputProps: { min: 0, step: 0.01, style: { textAlign: 'right' } }
                                    }}
                                    sx={{ width: 110 }}
                                  />
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#34a85308' }}>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={data.googleAmount || ''}
                                    onChange={(e) => handleInputChange(client._id, 'googleAmount', e.target.value)}
                                    InputProps={{
                                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                      inputProps: { min: 0, step: 0.01, style: { textAlign: 'right' } }
                                    }}
                                    sx={{ width: 110 }}
                                  />
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#34a85308' }}>
                                  <FormControl size="small" sx={{ minWidth: 115 }}>
                                    <Select
                                      value={data.googlePaymentMode || ''}
                                      onChange={(e) => handleInputChange(client._id, 'googlePaymentMode', e.target.value)}
                                      displayEmpty
                                      sx={{ fontSize: '0.8rem' }}
                                    >
                                      <MenuItem value="" sx={{ fontSize: '0.8rem' }}>Select</MenuItem>
                                      {paymentModes.map(mode => (
                                        <MenuItem key={mode} value={mode} sx={{ fontSize: '0.8rem' }}>{mode}</MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#34a85308' }}>
                                  <TextField
                                    size="small"
                                    placeholder={getPaymentPlaceholder(data.googlePaymentMode)}
                                    value={data.googlePaymentDetails || ''}
                                    onChange={(e) => handleInputChange(client._id, 'googlePaymentDetails', e.target.value)}
                                    sx={{ width: 130 }}
                                    inputProps={{ style: { fontSize: '0.8rem' } }}
                                    disabled={!data.googlePaymentMode}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<Save sx={{ fontSize: 16 }} />}
                                    onClick={() => handleSaveEntry(client._id)}
                                    sx={{
                                      textTransform: 'none',
                                      fontSize: '0.75rem',
                                      py: 0.5,
                                      px: 1.5,
                                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                                      '&:hover': {
                                        background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
                                      },
                                    }}
                                  >
                                    Save
                                  </Button>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                      {clients.length === 0 && !loading && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">
                              No clients found. Click "Refresh" to fetch from Main API.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Fund Summary Tab */}
      {activeTab === 1 && (
        <>
          {/* Filters */}
          <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Client</InputLabel>
                    <Select
                      value={summaryClient}
                      onChange={(e) => setSummaryClient(e.target.value)}
                      label="Select Client"
                    >
                      {clients.map(client => (
                        <MenuItem key={client._id} value={client._id}>{client.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="From Date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarMonth sx={{ fontSize: 20, color: primaryColor }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="To Date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarMonth sx={{ fontSize: 20, color: primaryColor }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {!summaryClient ? (
            <Card sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography color="text.secondary">Please select a client to view fund summary</Typography>
            </Card>
          ) : (
            <>
              {/* Summary Table */}
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 3, py: 2, bgcolor: '#f9fafb', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Fund History
                      <Chip
                        label={clients.find(c => c._id === summaryClient)?.name || ''}
                        size="small"
                        color="primary"
                        sx={{ ml: 2 }}
                      />
                      <Chip
                        label={`${new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Tabs
                      value={summaryPlatformTab}
                      onChange={(e, newValue) => setSummaryPlatformTab(newValue)}
                      sx={{
                        minHeight: 36,
                        '& .MuiTab-root': {
                          minHeight: 36,
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          px: 2,
                        },
                      }}
                    >
                      <Tab
                        label="Meta"
                        sx={{
                          color: summaryPlatformTab === 0 ? '#1877f2' : 'text.secondary',
                          '&.Mui-selected': { color: '#1877f2' },
                        }}
                      />
                      <Tab
                        label="Google"
                        sx={{
                          color: summaryPlatformTab === 1 ? '#34a853' : 'text.secondary',
                          '&.Mui-selected': { color: '#34a853' },
                        }}
                      />
                    </Tabs>
                  </Box>
                  {summaryLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                      <CircularProgress size={40} sx={{ color: primaryColor, mb: 2 }} />
                      <Typography color="text.secondary">Loading fund summary...</Typography>
                    </Box>
                  ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f9fafb' }}>
                          <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Date</TableCell>
                          {summaryPlatformTab === 0 ? (
                            <>
                              {/* META Columns */}
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#1877f2', bgcolor: '#1877f210' }} align="right">
                                Meta Balance
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#1877f2', bgcolor: '#1877f210' }} align="right">
                                Meta Amount
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#1877f2', bgcolor: '#1877f210' }} align="center">
                                Meta Mode
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#1877f2', bgcolor: '#1877f210' }} align="center">
                                Meta Details
                              </TableCell>
                            </>
                          ) : (
                            <>
                              {/* GOOGLE Columns */}
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#34a853', bgcolor: '#34a85310' }} align="right">
                                Google Balance
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#34a853', bgcolor: '#34a85310' }} align="right">
                                Google Amount
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#34a853', bgcolor: '#34a85310' }} align="center">
                                Google Mode
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#34a853', bgcolor: '#34a85310' }} align="center">
                                Google Details
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summaryData.map((row, index) => {
                          const isLowBalance = (row.metaBalance || 0) < 1000;
                          return (
                          <TableRow
                            key={index}
                            hover
                            sx={{
                              bgcolor: isLowBalance ? '#fee2e2' : 'inherit',
                              '&:hover': {
                                bgcolor: isLowBalance ? '#fecaca !important' : undefined,
                              },
                            }}
                          >
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </Typography>
                            </TableCell>
                            {summaryPlatformTab === 0 ? (
                              <>
                                <TableCell align="right" sx={{ bgcolor: '#1877f208' }}>
                                  ₹{row.metaBalance.toLocaleString()}
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#1877f208' }}>
                                  ₹{row.metaAmount.toLocaleString()}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#1877f208' }}>
                                  {row.metaPaymentMode && <Chip label={row.metaPaymentMode} size="small" variant="outlined" />}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#1877f208' }}>
                                  {row.metaPaymentDetails || '-'}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell align="right" sx={{ bgcolor: '#34a85308' }}>
                                  ₹{row.googleBalance.toLocaleString()}
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#34a85308' }}>
                                  ₹{row.googleAmount.toLocaleString()}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#34a85308' }}>
                                  {row.googlePaymentMode && <Chip label={row.googlePaymentMode} size="small" variant="outlined" />}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#34a85308' }}>
                                  {row.googlePaymentDetails || '-'}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                          );
                        })}
                        {summaryData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                              <Typography color="text.secondary">
                                No fund entries found for the selected date range.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
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

export default FundEntry;
