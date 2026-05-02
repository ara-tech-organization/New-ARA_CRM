import { useState, useMemo, useEffect, useContext, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Grid,
  Chip,
  InputAdornment,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  PictureAsPdf as PdfIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { PageLoader } from '../components/Loading';
import { ThemeContext } from '../contexts/ThemeContext';
import { useDataCache } from '../contexts/DataCacheContext';
import api from '../api/axios';

const DailyLeadData = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#C08552';

  const today = new Date().toISOString().split('T')[0];
  const ymdRe = /^\d{4}-\d{2}-\d{2}$/;

  // URL is the source of truth for filters. /daily-lead-data → today, all clients;
  // /daily-lead-data?from=…&to=…&clientId=… → restored on refresh/share.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');
  const urlClient = searchParams.get('clientId');

  const dateFrom = ymdRe.test(urlFrom || '') ? urlFrom : today;
  const dateTo = ymdRe.test(urlTo || '') ? urlTo : today;
  const selectedClient = urlClient || 'all';

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Clients come from the shared cache (small, slow-changing list shared by other pages).
  const { clients: cachedClients, clientsLoading, fetchClients } = useDataCache();

  // Server-side aggregated entries — pre-shaped, pre-totaled.
  const [entries, setEntries] = useState([]);
  const [dailyTotals, setDailyTotals] = useState({
    metaForm: 0, metaWhatsapp: 0, metaFund: 0, metaTotalLeads: 0,
    googleCall: 0, googleWebsite: 0, googleFund: 0, googleTotalLeads: 0,
    totalLeads: 0, totalSpend: 0, entryCount: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const params = { from: dateFrom, to: dateTo };
      if (selectedClient && selectedClient !== 'all') params.clientId = selectedClient;
      if (force) params.refresh = 1;
      const res = await api.get('/leads/daily-by-client', { params });
      const data = res.data?.data || {};
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setDailyTotals(data.dailyTotals || dailyTotals);
    } catch (err) {
      console.error('Failed to fetch daily leads:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, selectedClient]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Filter helpers — selectedClient already enforced server-side.
  const filteredEntries = entries;

  // Tiny URL writers — replace=true to keep the back button clean.
  const updateUrl = useCallback((next) => {
    const merged = {
      from: next.from ?? dateFrom,
      to: next.to ?? dateTo,
      ...(next.clientId !== undefined
        ? (next.clientId && next.clientId !== 'all' ? { clientId: next.clientId } : {})
        : (selectedClient && selectedClient !== 'all' ? { clientId: selectedClient } : {})),
    };
    setSearchParams(merged, { replace: true });
  }, [dateFrom, dateTo, selectedClient, setSearchParams]);

  const handleFromChange = (e) => updateUrl({ from: e.target.value });
  const handleToChange = (e) => updateUrl({ to: e.target.value });
  const handleClientChange = (e) => updateUrl({ clientId: e.target.value });

  // Selected client name for PDF + chip.
  const selectedClientName = useMemo(() => {
    if (selectedClient === 'all') return 'All Clients';
    const client = cachedClients.find(c => c._id === selectedClient);
    return client?.clientName || 'Unknown Client';
  }, [selectedClient, cachedClients]);

  // Dropdown source = canonical /clients list, alpha-sorted.
  const clients = useMemo(() => {
    return [...(cachedClients || [])].sort((a, b) =>
      String(a.clientName || '').localeCompare(String(b.clientName || ''))
    );
  }, [cachedClients]);

  // Export to PDF using print
  const handleExportPDF = () => {
    const printStyles = `
      <style>
        @media print {
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: ${primaryColor}; color: white; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { color: #333; margin-bottom: 5px; }
          .header p { color: #666; }
          .totals-row { background-color: #f5f5f5; font-weight: bold; }
          .meta-col { background-color: #C0855210; }
          @page { size: landscape; margin: 10mm; }
        }
      </style>
    `;

    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const dateRangeText = dateFrom === dateTo
      ? formatDate(dateFrom)
      : `${formatDate(dateFrom)} to ${formatDate(dateTo)}`;

    const printHTML = `
      ${printStyles}
      <div class="header">
        <h1>Daily Lead Data Report</h1>
        <p>Client: ${selectedClientName}</p>
        <p>Date Range: ${dateRangeText}</p>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Date</th>
            <th class="meta-col">Meta Form</th>
            <th class="meta-col">Meta WhatsApp</th>
            <th class="meta-col">Meta Total</th>
            <th class="meta-col">Meta Fund (₹)</th>
            <th>Total Leads</th>
            <th>Total Spend (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${filteredEntries.map(entry => `
            <tr>
              <td>${entry.clientName || 'Unknown'}</td>
              <td>${new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td class="meta-col">${entry.metaForm || 0}</td>
              <td class="meta-col">${entry.metaWhatsapp || 0}</td>
              <td class="meta-col">${entry.metaTotalLeads || 0}</td>
              <td class="meta-col">₹${(entry.metaFund || 0).toLocaleString('en-IN')}</td>
              <td><strong>${entry.totalLeads || 0}</strong></td>
              <td><strong>₹${(entry.totalSpend || 0).toLocaleString('en-IN')}</strong></td>
            </tr>
          `).join('')}
          <tr class="totals-row">
            <td><strong>TOTAL</strong></td>
            <td></td>
            <td class="meta-col"><strong>${dailyTotals.metaForm}</strong></td>
            <td class="meta-col"><strong>${dailyTotals.metaWhatsapp}</strong></td>
            <td class="meta-col"><strong>${dailyTotals.metaTotalLeads}</strong></td>
            <td class="meta-col"><strong>₹${dailyTotals.metaFund.toLocaleString('en-IN')}</strong></td>
            <td><strong>${dailyTotals.totalLeads}</strong></td>
            <td><strong>₹${dailyTotals.totalSpend.toLocaleString('en-IN')}</strong></td>
          </tr>
        </tbody>
      </table>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Lead Data - ${dateRangeText}</title>
        </head>
        <body>
          ${printHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Show aesthetic loader during initial data fetch
  // Cold first-load: full-page loader (only when clients list is also empty,
  // which means we have no shell to render). After that, the in-card overlay
  // takes over.
  if (loading && entries.length === 0 && cachedClients.length === 0) {
    return <PageLoader message="Loading lead data..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Daily Lead Data
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            View daily lead data by date range
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />}
            onClick={() => fetchEntries(true)}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PdfIcon />}
            onClick={handleExportPDF}
            sx={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              },
            }}
            disabled={filteredEntries.length === 0}
          >
            Export to PDF
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={1.5} alignItems="center">
            <Grid size={{xs: 12, sm: 6, md: 3}}>
              <FormControl fullWidth>
                <InputLabel id="client-filter-label">Select Client</InputLabel>
                <Select
                  labelId="client-filter-label"
                  id="client-filter"
                  value={selectedClient}
                  label="Select Client"
                  onChange={handleClientChange}
                  startAdornment={
                    <InputAdornment position="start">
                      <BusinessIcon sx={{ color: primaryColor }} />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="all">All Clients</MenuItem>
                  {clientsLoading && clients.length === 0 ? (
                    <MenuItem disabled>Loading...</MenuItem>
                  ) : clients.length === 0 ? (
                    <MenuItem disabled>No clients found</MenuItem>
                  ) : (
                    clients.map((client) => (
                      <MenuItem key={client._id} value={client._id}>
                        {client.clientName}{client.place ? ` — ${client.place}` : ''}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{xs: 12, sm: 6, md: 2.5}}>
              <TextField
                fullWidth
                label="From Date"
                type="date"
                value={dateFrom}
                onChange={handleFromChange}
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarIcon sx={{ color: primaryColor }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
            <Grid size={{xs: 12, sm: 6, md: 2.5}}>
              <TextField
                fullWidth
                label="To Date"
                type="date"
                value={dateTo}
                onChange={handleToChange}
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarIcon sx={{ color: primaryColor }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
            <Grid size={{xs: 12, sm: 12, md: 4}}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={selectedClientName}
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  label={`${filteredEntries.length} Entries`}
                  variant="outlined"
                />
                <Chip
                  label={`Total Leads: ${dailyTotals.totalLeads}`}
                  sx={{ bgcolor: `${primaryColor}15`, color: primaryColor, fontWeight: 600 }}
                />
                <Chip
                  label={`Total Spend: ₹${dailyTotals.totalSpend.toLocaleString('en-IN')}`}
                  sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 600 }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent sx={{ p: 0, position: 'relative' }}>
          {/* Loading overlay — keep table visible (faded) while a new range loads. */}
          {loading && filteredEntries.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(2px)',
              }}
            >
              <CircularProgress size={36} sx={{ color: primaryColor }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Loading lead data…
              </Typography>
            </Box>
          )}

          {filteredEntries.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              {loading ? (
                <>
                  <CircularProgress size={32} sx={{ color: primaryColor, mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Loading lead data…
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h6" color="text.secondary">
                    No entries found for the selected date range
                    {selectedClient !== 'all' && ` and client`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {dateFrom === dateTo
                      ? `Date: ${new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                      : `From: ${new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – To: ${new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  </Typography>
                </>
              )}
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ opacity: loading ? 0.5 : 1, transition: 'opacity 150ms ease' }}>
              <Table sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#C0855210' }} align="center">Meta Form</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#C0855210' }} align="center">Meta WhatsApp</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#C0855210' }} align="center">Meta Total</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#C0855210' }} align="right">Meta Fund</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Total Leads</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Total Spend</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={`${entry.clientId}-${entry.date}`} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.clientName || 'Unknown Client'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#C0855205' }}>
                        <Chip
                          label={entry.metaForm || 0}
                          size="small"
                          sx={{ bgcolor: '#C0855215', color: '#C08552', fontWeight: 600, minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#C0855205' }}>
                        <Chip
                          label={entry.metaWhatsapp || 0}
                          size="small"
                          sx={{ bgcolor: '#3E272315', color: '#3E2723', fontWeight: 600, minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#C0855205' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#C08552' }}>
                          {entry.metaTotalLeads || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#C0855205' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ₹{(entry.metaFund || 0).toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={entry.totalLeads || 0}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 700, minWidth: 50 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981' }}>
                          ₹{(entry.totalSpend || 0).toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f9fafb' }}>
                    <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                    <TableCell></TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#C0855210' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#C08552' }}>
                        {dailyTotals.metaForm}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#C0855210' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#3E2723' }}>
                        {dailyTotals.metaWhatsapp}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#C0855210' }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#C08552' }}>
                        {dailyTotals.metaTotalLeads}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#C0855210' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        ₹{dailyTotals.metaFund.toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="h6" sx={{ fontWeight: 700, color: primaryColor }}>
                        {dailyTotals.totalLeads}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981' }}>
                        ₹{dailyTotals.totalSpend.toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

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

export default DailyLeadData;
