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
  Payment as PaymentIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import api from '../api/axios';
import { useDataCache } from '../contexts/DataCacheContext';

const META_SYNC_API_URL = 'https://crmasdmanager20260420165826-b5eefne4ghf2e7b7.canadacentral-01.azurewebsites.net';

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
  const primaryColor = accentColor?.secondary || '#C08552';
  const secondaryColor = accentColor?.primary || '#3E2723';

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

  // Payment History tab state
  const [historyClient, setHistoryClient] = useState('');
  const [historyPlatform, setHistoryPlatform] = useState('all'); // 'all', 'meta', 'google'
  const [historyDateFrom, setHistoryDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [historyDateTo, setHistoryDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Meta sync state
  const [fetchingBalances, setFetchingBalances] = useState(false);

  // Use cached clients
  const { clients: cachedClients, clientsLoading, fetchClients } = useDataCache();
  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    if (cachedClients.length > 0) {
      const transformedClients = cachedClients.map(client => ({
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
      setLoading(false);
    }
  }, [cachedClients]);

  // Load existing fund entries for the selected date and initialize empty clients
  useEffect(() => {
    if (clients.length === 0) return;

    const loadExistingEntries = async () => {
      // Initialize all clients with empty data first
      const initialData = {};
      clients.forEach(client => {
        initialData[client._id] = {
          metaBalance: 0,
          googleBalance: 0,
          fundAdded: 0,
          metaAmount: 0,
          googleAmount: 0,
          metaPaymentMode: '',
          metaPaymentDetails: '',
          metaFundDate: '',
          googlePaymentMode: '',
          googlePaymentDetails: '',
          googleFundDate: '',
        };
      });

      try {
        // Fetch existing entries for this date
        const response = await api.get('/funds', {
          params: { dateFrom: selectedDate, dateTo: selectedDate, entryType: 'daily_fund' },
        });
        const entries = response.data?.data || response.data || [];

        // Populate saved data
        entries.forEach(entry => {
          const cId = entry.clientId;
          if (cId && initialData[cId]) {
            initialData[cId] = {
              metaBalance: entry.metaBalance || 0,
              googleBalance: entry.googleBalance || 0,
              fundAdded: entry.fundAdded ? 1 : 0,
              metaAmount: entry.metaAmount || 0,
              googleAmount: entry.googleAmount || 0,
              metaPaymentMode: entry.metaPaymentMode || '',
              metaPaymentDetails: entry.metaPaymentDetails || '',
              metaFundDate: entry.metaFundDate || '',
              googlePaymentMode: entry.googlePaymentMode || '',
              googlePaymentDetails: entry.googlePaymentDetails || '',
              googleFundDate: entry.googleFundDate || '',
            };
          }
        });
      } catch (error) {
        console.error('Error loading existing fund entries:', error);
      }

      setFundData(initialData);
    };

    loadExistingEntries();
  }, [clients, selectedDate]);

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
          metaFundDate: fund.metaFundDate || '',
          googlePaymentMode: fund.googlePaymentMode || '',
          googlePaymentDetails: fund.googlePaymentDetails || '',
          googleFundDate: fund.googleFundDate || '',
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

  // Fetch payment history data
  useEffect(() => {
    const fetchHistoryData = async () => {
      if (!historyClient || !historyDateFrom || !historyDateTo) {
        setHistoryData([]);
        return;
      }

      setHistoryLoading(true);
      try {
        const response = await api.get('/funds', {
          params: { dateFrom: historyDateFrom, dateTo: historyDateTo, entryType: 'daily_fund' },
        });
        const funds = response.data?.data || response.data || [];

        // Filter: only entries that have a fund date timestamp (actually saved to DB)
        let filtered = funds.filter(fund => fund.metaFundDate || fund.googleFundDate);

        // Filter by client if selected
        if (historyClient) {
          filtered = filtered.filter(fund => {
            const fClientId = fund.clientId?._id || fund.clientId;
            return fClientId === historyClient;
          });
        }

        // Build flat rows — one row per confirmed payment (only where fundDate exists)
        const rows = [];
        filtered.forEach(fund => {
          if ((historyPlatform === 'all' || historyPlatform === 'meta') && fund.metaFundDate && fund.metaAmount > 0) {
            rows.push({
              _id: fund._id + '-meta',
              clientName: fund.clientName || '',
              date: fund.date,
              platform: 'Meta',
              balance: fund.metaBalance || 0,
              amount: fund.metaAmount,
              paymentMode: fund.metaPaymentMode || '',
              paymentDetails: fund.metaPaymentDetails || '',
              fundAddedOn: fund.metaFundDate,
            });
          }
          if ((historyPlatform === 'all' || historyPlatform === 'google') && fund.googleFundDate && fund.googleAmount > 0) {
            rows.push({
              _id: fund._id + '-google',
              clientName: fund.clientName || '',
              date: fund.date,
              platform: 'Google',
              balance: fund.googleBalance || 0,
              amount: fund.googleAmount,
              paymentMode: fund.googlePaymentMode || '',
              paymentDetails: fund.googlePaymentDetails || '',
              fundAddedOn: fund.googleFundDate,
            });
          }
        });

        // Sort by date ascending to calculate cumulative totals
        rows.sort((a, b) => (a.date > b.date ? 1 : -1));
        // Day 1: Total = balance + amount. Day 2+: balance = prev total, total = balance + amount
        const prevTotals = {};
        rows.forEach(row => {
          const key = row.platform;
          if (prevTotals[key] !== undefined) {
            // Day 2+: carry forward previous total as balance
            row.balance = prevTotals[key];
          }
          // balance is from DB for day 1, or previous total for day 2+
          row.totalAmount = row.balance + row.amount;
          prevTotals[key] = row.totalAmount;
        });
        // Sort by date descending for display
        rows.sort((a, b) => (b.date > a.date ? 1 : -1));
        setHistoryData(rows);
      } catch (error) {
        console.error('Failed to fetch payment history:', error);
        setSnackbar({ open: true, message: 'Failed to fetch payment history', severity: 'error' });
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistoryData();
  }, [historyClient, historyDateFrom, historyDateTo, historyPlatform]);

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

  // Download payment history as Excel
  const handleDownloadHistory = () => {
    if (historyData.length === 0) return;
    const clientName = clients.find(c => c._id === historyClient)?.name || 'All';
    const rows = historyData.map(row => ({
      'Entry Date': new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      'Client': row.clientName,
      'Platform': row.platform,
      'Balance (₹)': row.balance,
      'Amount Added (₹)': row.amount,
      'Total Amount (₹)': row.totalAmount,
      'Payment Mode': row.paymentMode || '-',
      'Payment Details': row.paymentDetails || '-',
      'Fund Added On': row.fundAddedOn
        ? new Date(row.fundAddedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date(row.fundAddedOn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key]).length)) + 2,
    }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment History');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Payment_History_${clientName}_${historyDateFrom}_to_${historyDateTo}.xlsx`);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Fund Entry
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage campaign budgets and payment tracking
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => window.location.reload()}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Tabs */}
      <Card sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}>
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
              minHeight: 40,
              fontSize: '0.85rem',
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
          <Tab
            icon={<PaymentIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Payment History"
            sx={{ gap: 1 }}
          />
        </Tabs>
      </Card>

      {/* Daily Entry Tab */}
      {activeTab === 0 && (
        <>
          {/* Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, gap: 1.5, flexWrap: 'wrap' }}>
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
              <Box sx={{ px: 2, py: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      color: dailyEntryPlatformTab === 0 ? '#C08552' : 'text.secondary',
                      '&.Mui-selected': { color: '#C08552' },
                    }}
                  />
                  <Tab
                    label="Google"
                    sx={{
                      color: dailyEntryPlatformTab === 1 ? '#3E2723' : 'text.secondary',
                      '&.Mui-selected': { color: '#3E2723' },
                    }}
                  />
                </Tabs>
              </Box>
              {loading || fetchingBalances ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                  <CircularProgress size={40} sx={{ color: primaryColor, mb: 2 }} />
                  <Typography color="text.secondary">
                    {fetchingBalances ? 'Fetching balances from Meta & Google...' : 'Loading fund entries...'}
                  </Typography>
                </Box>
              ) : (
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb' }}>
                        <TableCell sx={{ fontWeight: 700, minWidth: 160, position: 'sticky', left: 0, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb', zIndex: 1 }}>
                          Client
                        </TableCell>
                        {dailyEntryPlatformTab === 0 ? (
                          <>
                            {/* META Columns */}
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#C08552', bgcolor: '#C0855210' }} align="center">
                              Meta Balance
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#C08552', bgcolor: '#C0855210' }} align="center">
                              Meta Amount
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#C08552', bgcolor: '#C0855210' }} align="center">
                              Meta Payment Mode
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 130, color: '#C08552', bgcolor: '#C0855210' }} align="center">
                              Meta Payment Details
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 100 }} align="center">
                              Action
                            </TableCell>
                          </>
                        ) : (
                          <>
                            {/* GOOGLE Columns */}
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#3E2723', bgcolor: '#3E272310' }} align="center">
                              Google Balance
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#3E2723', bgcolor: '#3E272310' }} align="center">
                              Google Amount
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#3E2723', bgcolor: '#3E272310' }} align="center">
                              Google Payment Mode
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, minWidth: 130, color: '#3E2723', bgcolor: '#3E272310' }} align="center">
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
                              bgcolor: (theme) => isLowBalance ? (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.12)' : '#fee2e2') : 'inherit',
                              '&:hover': {
                                bgcolor: (theme) => isLowBalance ? (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.18) !important' : '#fecaca !important') : undefined,
                              },
                            }}
                          >
                            {/* Client Name */}
                            <TableCell sx={{ position: 'sticky', left: 0, bgcolor: (theme) => isLowBalance ? (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.12)' : '#fee2e2') : (theme.palette.mode === 'dark' ? 'background.paper' : 'white'), zIndex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {client.name}
                              </Typography>
                            </TableCell>

                            {dailyEntryPlatformTab === 0 ? (
                              <>
                                {/* META COLUMNS */}
                                <TableCell align="center" sx={{ bgcolor: '#C0855208' }}>
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

                                <TableCell align="center" sx={{ bgcolor: '#C0855208' }}>
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
                                  {data.metaFundDate && (
                                    <Typography sx={{ fontSize: '0.65rem', color: '#C08552', mt: 0.5 }}>
                                      Added: {new Date(data.metaFundDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                                      {new Date(data.metaFundDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                  )}
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#C0855208' }}>
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

                                <TableCell align="center" sx={{ bgcolor: '#C0855208' }}>
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
                                      bgcolor: primaryColor,
                                      '&:hover': {
                                        bgcolor: secondaryColor,
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
                                <TableCell align="center" sx={{ bgcolor: '#3E272308' }}>
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

                                <TableCell align="center" sx={{ bgcolor: '#3E272308' }}>
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
                                  {data.googleFundDate && (
                                    <Typography sx={{ fontSize: '0.65rem', color: '#3E2723', mt: 0.5 }}>
                                      Added: {new Date(data.googleFundDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                                      {new Date(data.googleFundDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                  )}
                                </TableCell>

                                <TableCell align="center" sx={{ bgcolor: '#3E272308' }}>
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

                                <TableCell align="center" sx={{ bgcolor: '#3E272308' }}>
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
                                      bgcolor: primaryColor,
                                      '&:hover': {
                                        bgcolor: secondaryColor,
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
                          <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
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
          <Card sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Grid container spacing={1.5} alignItems="center">
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
            <Card sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography color="text.secondary">Please select a client to view fund summary</Typography>
            </Card>
          ) : (
            <>
              {/* Summary Table */}
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ px: 2, py: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                          color: summaryPlatformTab === 0 ? '#C08552' : 'text.secondary',
                          '&.Mui-selected': { color: '#C08552' },
                        }}
                      />
                      <Tab
                        label="Google"
                        sx={{
                          color: summaryPlatformTab === 1 ? '#3E2723' : 'text.secondary',
                          '&.Mui-selected': { color: '#3E2723' },
                        }}
                      />
                    </Tabs>
                  </Box>
                  {summaryLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                      <CircularProgress size={40} sx={{ color: primaryColor, mb: 2 }} />
                      <Typography color="text.secondary">Loading fund summary...</Typography>
                    </Box>
                  ) : (
                  <TableContainer sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb' }}>
                          <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Date</TableCell>
                          {summaryPlatformTab === 0 ? (
                            <>
                              {/* META Columns */}
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#C08552', bgcolor: '#C0855210' }} align="right">
                                Meta Balance
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#C08552', bgcolor: '#C0855210' }} align="right">
                                Meta Amount
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#C08552', bgcolor: '#C0855210' }} align="center">
                                Meta Mode
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#C08552', bgcolor: '#C0855210' }} align="center">
                                Meta Details
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 140, color: '#C08552', bgcolor: '#C0855210' }} align="center">
                                Fund Added On
                              </TableCell>
                            </>
                          ) : (
                            <>
                              {/* GOOGLE Columns */}
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#3E2723', bgcolor: '#3E272310' }} align="right">
                                Google Balance
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#3E2723', bgcolor: '#3E272310' }} align="right">
                                Google Amount
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 110, color: '#3E2723', bgcolor: '#3E272310' }} align="center">
                                Google Mode
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120, color: '#3E2723', bgcolor: '#3E272310' }} align="center">
                                Google Details
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 140, color: '#3E2723', bgcolor: '#3E272310' }} align="center">
                                Fund Added On
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
                              bgcolor: (theme) => isLowBalance ? (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.12)' : '#fee2e2') : 'inherit',
                              '&:hover': {
                                bgcolor: (theme) => isLowBalance ? (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.18) !important' : '#fecaca !important') : undefined,
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
                                <TableCell align="right" sx={{ bgcolor: '#C0855208' }}>
                                  ₹{row.metaBalance.toLocaleString()}
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#C0855208' }}>
                                  ₹{row.metaAmount.toLocaleString()}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#C0855208' }}>
                                  {row.metaPaymentMode && <Chip label={row.metaPaymentMode} size="small" variant="outlined" />}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#C0855208' }}>
                                  {row.metaPaymentDetails || '-'}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#C0855208' }}>
                                  {row.metaFundDate ? (
                                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                      {new Date(row.metaFundDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      {' '}
                                      <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                        {new Date(row.metaFundDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                      </Typography>
                                    </Typography>
                                  ) : '-'}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell align="right" sx={{ bgcolor: '#3E272308' }}>
                                  ₹{row.googleBalance.toLocaleString()}
                                </TableCell>
                                <TableCell align="right" sx={{ bgcolor: '#3E272308' }}>
                                  ₹{row.googleAmount.toLocaleString()}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#3E272308' }}>
                                  {row.googlePaymentMode && <Chip label={row.googlePaymentMode} size="small" variant="outlined" />}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#3E272308' }}>
                                  {row.googlePaymentDetails || '-'}
                                </TableCell>
                                <TableCell align="center" sx={{ bgcolor: '#3E272308' }}>
                                  {row.googleFundDate ? (
                                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                      {new Date(row.googleFundDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      {' '}
                                      <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                        {new Date(row.googleFundDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                      </Typography>
                                    </Typography>
                                  ) : '-'}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                          );
                        })}
                        {summaryData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
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

      {/* Payment History Tab */}
      {activeTab === 2 && (
        <>
          {/* Filters */}
          <Card sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Grid container spacing={1.5} alignItems="center">
                <Grid size={{ xs: 12, sm: 3 }}>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Select Client</InputLabel>
                    <Select
                      value={historyClient}
                      onChange={(e) => setHistoryClient(e.target.value)}
                      label="Select Client"
                    >
                      {clients.map(client => (
                        <MenuItem key={client._id} value={client._id}>{client.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Platform</InputLabel>
                    <Select
                      value={historyPlatform}
                      onChange={(e) => setHistoryPlatform(e.target.value)}
                      label="Platform"
                    >
                      <MenuItem value="all">All Platforms</MenuItem>
                      <MenuItem value="meta">Meta</MenuItem>
                      <MenuItem value="google">Google</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="From Date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
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
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="To Date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
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
                <Grid size={{ xs: 12, sm: 1 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Tooltip title="Download as Excel">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownloadHistory}
                        disabled={historyData.length === 0}
                        sx={{ textTransform: 'none', color: primaryColor, borderColor: primaryColor }}
                      >
                        Excel
                      </Button>
                    </span>
                  </Tooltip>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {!historyClient ? (
            <Card sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
              <Typography color="text.secondary">Please select a client to view payment history</Typography>
            </Card>
          ) : (
            /* Payment History Table */
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Payment History
                    <Chip
                      label={clients.find(c => c._id === historyClient)?.name || ''}
                      size="small"
                      color="primary"
                      sx={{ ml: 2 }}
                    />
                    <Chip
                      label={`${historyData.length} records`}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Box>
                {historyLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                    <CircularProgress size={40} sx={{ color: primaryColor, mb: 2 }} />
                    <Typography color="text.secondary">Loading payment history...</Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb' }}>
                          <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Entry Date</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Client Name</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 100 }} align="center">Platform</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 120 }} align="right">Balance</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 120 }} align="right">Amount Added</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 130 }} align="right">Total Amount</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 130 }} align="center">Payment Mode</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 150 }} align="center">Payment Details</TableCell>
                          <TableCell sx={{ fontWeight: 700, minWidth: 160 }} align="center">Fund Added On</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {historyData.map((row) => {
                          const platformColor = row.platform === 'Meta' ? '#C08552' : '#3E2723';
                          return (
                            <TableRow key={row._id} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {row.clientName || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={row.platform}
                                  size="small"
                                  sx={{
                                    bgcolor: `${platformColor}15`,
                                    color: platformColor,
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  ₹{row.balance.toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 600, color: platformColor }}>
                                  ₹{row.amount.toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                  ₹{row.totalAmount.toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {row.paymentMode ? (
                                  <Chip label={row.paymentMode} size="small" variant="outlined" />
                                ) : '-'}
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" color="text.secondary">
                                  {row.paymentDetails || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {row.fundAddedOn ? (
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                    {new Date(row.fundAddedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    {' '}
                                    <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                      {new Date(row.fundAddedOn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                  </Typography>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {historyData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                              <Typography color="text.secondary">
                                No payment records found for the selected filters.
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
