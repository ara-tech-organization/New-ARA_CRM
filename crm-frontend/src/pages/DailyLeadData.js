import { useState, useMemo, useEffect, useRef, useContext } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  PictureAsPdf as PdfIcon,
  Business as BusinessIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { TableLoader, PageLoader } from '../components/Loading';
import { ThemeContext } from '../contexts/ThemeContext';
import { useDataCache } from '../contexts/DataCacheContext';

const DailyLeadData = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.primary || '#6366F1';
  const secondaryColor = accentColor?.secondary || '#818CF8';

  const printRef = useRef();

  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const { leads: allCachedLeads, clients: cachedClients, leadsLoading: loading, clientsLoading, fetchLeads } = useDataCache();

  // Filter leads by date range from cache (no API call)
  const mainApiLeads = useMemo(() => {
    return allCachedLeads.filter(lead => {
      const leadDate = lead.date;
      return leadDate >= dateFrom && leadDate <= dateTo;
    });
  }, [allCachedLeads, dateFrom, dateTo]);

  const mainApiClients = cachedClients;

  const fetchLeadsForDateRange = () => fetchLeads(true);

  // Filter entries by client (date range already filtered from API)
  const filteredEntries = useMemo(() => {
    return mainApiLeads.filter(entry => {
      const matchesClient = selectedClient === 'all' || entry.clientId === selectedClient;
      return matchesClient;
    }).map(lead => ({
      _id: lead._id,
      date: lead.date,
      clientId: lead.clientId,
      clientName: lead.clientName,
      metaForm: lead.metaFormLead || 0,
      metaWhatsapp: lead.metaWhatsappLead || 0,
      metaFund: lead.metaFund || 0,
      metaCPL: lead.metaCpl || 0,
      metaTotalLeads: (lead.metaFormLead || 0) + (lead.metaWhatsappLead || 0),
      googleCall: lead.googleCallLead || 0,
      googleWebsite: lead.googleWebsiteLead || 0,
      googleFund: lead.googleFund || 0,
      googleCPL: lead.googleCpl || 0,
      googleTotalLeads: (lead.googleCallLead || 0) + (lead.googleWebsiteLead || 0),
      totalLeads: (lead.metaFormLead || 0) + (lead.metaWhatsappLead || 0) + (lead.googleCallLead || 0) + (lead.googleWebsiteLead || 0),
      totalSpend: (lead.metaFund || 0) + (lead.googleFund || 0),
    }));
  }, [mainApiLeads, selectedClient]);

  // Get selected client name for PDF
  const selectedClientName = useMemo(() => {
    if (selectedClient === 'all') return 'All Clients';
    const client = mainApiClients.find(c => c._id === selectedClient);
    return client?.clientName || 'Unknown Client';
  }, [selectedClient, mainApiClients]);

  // Get unique clients from leads for dropdown
  const clients = useMemo(() => {
    const clientMap = new Map();
    mainApiLeads.forEach(lead => {
      if (lead.clientId && !clientMap.has(lead.clientId)) {
        clientMap.set(lead.clientId, {
          _id: lead.clientId,
          name: lead.clientName,
        });
      }
    });
    return Array.from(clientMap.values());
  }, [mainApiLeads]);

  // Calculate totals for the selected date
  const dailyTotals = useMemo(() => {
    return filteredEntries.reduce((totals, entry) => ({
      metaForm: totals.metaForm + (entry.metaForm || 0),
      metaWhatsapp: totals.metaWhatsapp + (entry.metaWhatsapp || 0),
      metaFund: totals.metaFund + (entry.metaFund || 0),
      metaTotalLeads: totals.metaTotalLeads + (entry.metaTotalLeads || 0),
      googleCall: totals.googleCall + (entry.googleCall || 0),
      googleWebsite: totals.googleWebsite + (entry.googleWebsite || 0),
      googleFund: totals.googleFund + (entry.googleFund || 0),
      googleTotalLeads: totals.googleTotalLeads + (entry.googleTotalLeads || 0),
      totalLeads: totals.totalLeads + (entry.totalLeads || 0),
      totalSpend: totals.totalSpend + (entry.totalSpend || 0),
    }), {
      metaForm: 0,
      metaWhatsapp: 0,
      metaFund: 0,
      metaTotalLeads: 0,
      googleCall: 0,
      googleWebsite: 0,
      googleFund: 0,
      googleTotalLeads: 0,
      totalLeads: 0,
      totalSpend: 0,
    });
  }, [filteredEntries]);

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
          .meta-col { background-color: #1877f210; }
          .google-col { background-color: #34a85310; }
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
            <th class="google-col">Google Call</th>
            <th class="google-col">Google Website</th>
            <th class="google-col">Google Total</th>
            <th class="google-col">Google Fund (₹)</th>
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
              <td class="google-col">${entry.googleCall || 0}</td>
              <td class="google-col">${entry.googleWebsite || 0}</td>
              <td class="google-col">${entry.googleTotalLeads || 0}</td>
              <td class="google-col">₹${(entry.googleFund || 0).toLocaleString('en-IN')}</td>
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
            <td class="google-col"><strong>${dailyTotals.googleCall}</strong></td>
            <td class="google-col"><strong>${dailyTotals.googleWebsite}</strong></td>
            <td class="google-col"><strong>${dailyTotals.googleTotalLeads}</strong></td>
            <td class="google-col"><strong>₹${dailyTotals.googleFund.toLocaleString('en-IN')}</strong></td>
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
  if (loading && mainApiLeads.length === 0) {
    return <PageLoader message="Loading lead data..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
            onClick={fetchLeadsForDateRange}
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
                  onChange={(e) => setSelectedClient(e.target.value)}
                  startAdornment={
                    <InputAdornment position="start">
                      <BusinessIcon sx={{ color: primaryColor }} />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="all">All Clients</MenuItem>
                  {clientsLoading ? (
                    <MenuItem disabled>Loading...</MenuItem>
                  ) : (
                    clients.map((client) => (
                      <MenuItem key={client._id} value={client._id}>
                        {client.name} {client.company ? `(${client.company})` : ''}
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
                onChange={(e) => setDateFrom(e.target.value)}
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
                onChange={(e) => setDateTo(e.target.value)}
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
      <Card ref={printRef}>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <TableLoader rows={6} message="Loading lead data..." />
          ) : filteredEntries.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <Typography variant="h6" color="text.secondary">
                No entries found for the selected date range
                {selectedClient !== 'all' && ` and client`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {dateFrom === dateTo
                  ? `Date: ${new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : `From: ${new Date(dateFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - To: ${new Date(dateTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Add entries in the Daily Entry Management page
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table sx={{ minWidth: 1200 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#1877f210' }} align="center">Meta Form</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#1877f210' }} align="center">Meta WhatsApp</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#1877f210' }} align="center">Meta Total</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#1877f210' }} align="right">Meta Fund</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#34a85310' }} align="center">Google Call</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#34a85310' }} align="center">Google Website</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#34a85310' }} align="center">Google Total</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#34a85310' }} align="right">Google Fund</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Total Leads</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Total Spend</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry._id} hover>
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
                      <TableCell align="center" sx={{ bgcolor: '#1877f205' }}>
                        <Chip
                          label={entry.metaForm || 0}
                          size="small"
                          sx={{ bgcolor: '#1877f215', color: '#1877f2', fontWeight: 600, minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#1877f205' }}>
                        <Chip
                          label={entry.metaWhatsapp || 0}
                          size="small"
                          sx={{ bgcolor: '#25D36615', color: '#25D366', fontWeight: 600, minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#1877f205' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#1877f2' }}>
                          {entry.metaTotalLeads || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#1877f205' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ₹{(entry.metaFund || 0).toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#34a85305' }}>
                        <Chip
                          label={entry.googleCall || 0}
                          size="small"
                          sx={{ bgcolor: '#34a85315', color: '#34a853', fontWeight: 600, minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#34a85305' }}>
                        <Chip
                          label={entry.googleWebsite || 0}
                          size="small"
                          sx={{ bgcolor: '#4285f415', color: '#4285f4', fontWeight: 600, minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#34a85305' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#34a853' }}>
                          {entry.googleTotalLeads || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ bgcolor: '#34a85305' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          ₹{(entry.googleFund || 0).toLocaleString('en-IN')}
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
                  <TableRow sx={{ bgcolor: '#f9fafb' }}>
                    <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                    <TableCell></TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1877f210' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1877f2' }}>
                        {dailyTotals.metaForm}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1877f210' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#25D366' }}>
                        {dailyTotals.metaWhatsapp}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#1877f210' }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#1877f2' }}>
                        {dailyTotals.metaTotalLeads}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#1877f210' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        ₹{dailyTotals.metaFund.toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#34a85310' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#34a853' }}>
                        {dailyTotals.googleCall}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#34a85310' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#4285f4' }}>
                        {dailyTotals.googleWebsite}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: '#34a85310' }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#34a853' }}>
                        {dailyTotals.googleTotalLeads}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#34a85310' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        ₹{dailyTotals.googleFund.toLocaleString('en-IN')}
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
