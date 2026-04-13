import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  CalendarMonth,
  Facebook,
  Google,
  WhatsApp,
  Language,
  Phone,
  CloudQueue as CloudQueueIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageLoader } from '../components/Loading';
import { useDataCache } from '../contexts/DataCacheContext';

// Colors for different metrics
const METRIC_CONFIG = {
  metaForm: {
    color: '#1877f2',
    label: 'Meta Form Leads',
    icon: <Facebook />,
    bgColor: '#1877f215',
  },
  metaWhatsapp: {
    color: '#25D366',
    label: 'Meta WhatsApp Leads',
    icon: <WhatsApp />,
    bgColor: '#25D36615',
  },
  metaTotalLeads: {
    color: '#4267B2',
    label: 'Total Meta Leads',
    icon: <Facebook />,
    bgColor: '#4267B215',
  },
  googleWebsite: {
    color: '#ea4335',
    label: 'Google Website Leads',
    icon: <Language />,
    bgColor: '#ea433515',
  },
  googleCall: {
    color: '#34a853',
    label: 'Google Call Leads',
    icon: <Phone />,
    bgColor: '#34a85315',
  },
  googleTotalLeads: {
    color: '#4285f4',
    label: 'Total Google Leads',
    icon: <Google />,
    bgColor: '#4285f415',
  },
};

const MetricCard = ({ title, value, icon, color, prefix = '' }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography color="text.secondary" variant="overline" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color }}>
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: 22, color } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, metricKey }) => {
  if (active && payload && payload.length) {
    const config = METRIC_CONFIG[metricKey];
    return (
      <Paper sx={{ p: 2, boxShadow: 3, minWidth: 150 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: config.color }} />
          <Typography variant="body1" sx={{ fontWeight: 600, color: config.color }}>
            {config.label}: {payload[0].value}
          </Typography>
        </Box>
      </Paper>
    );
  }
  return null;
};

// Individual Line Chart Component
const MetricLineChart = ({ data, metricKey, title }) => {
  const config = METRIC_CONFIG[metricKey];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              bgcolor: config.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(config.icon, { sx: { fontSize: 20, color: config.color } })}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        </Box>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip metricKey={metricKey} />} />
              <Line
                type="monotone"
                dataKey={metricKey}
                stroke={config.color}
                strokeWidth={3}
                dot={{ r: 4, fill: config.color }}
                activeDot={{ r: 6, fill: config.color }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Individual Bar Chart Component
const MetricBarChart = ({ data, metricKey, title }) => {
  const config = METRIC_CONFIG[metricKey];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              bgcolor: config.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(config.icon, { sx: { fontSize: 20, color: config.color } })}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        </Box>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip metricKey={metricKey} />} />
              <Bar
                dataKey={metricKey}
                fill={config.color}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const Reports = () => {
  const { leads: cachedLeads, clients: cachedClients, leadsLoading: loading, refreshAll } = useDataCache();

  // Transform cached data to match expected formats
  const clients = useMemo(() =>
    cachedClients.map(c => ({ _id: c._id, name: c.clientName })),
  [cachedClients]);

  const entries = useMemo(() =>
    cachedLeads.map(lead => ({
      _id: lead._id,
      date: lead.date,
      client: lead.clientId,
      clientName: lead.clientName,
      metaForm: lead.metaFormLead || 0,
      metaWhatsapp: lead.metaWhatsappLead || 0,
      metaTotalLeads: (lead.metaFormLead || 0) + (lead.metaWhatsappLead || 0),
      googleWebsite: lead.googleWebsiteLead || 0,
      googleCall: lead.googleCallLead || 0,
      googleTotalLeads: (lead.googleCallLead || 0) + (lead.googleWebsiteLead || 0),
      totalLeads: (lead.metaFormLead || 0) + (lead.metaWhatsappLead || 0) + (lead.googleCallLead || 0) + (lead.googleWebsiteLead || 0),
      totalSpend: (lead.metaFund || 0) + (lead.googleFund || 0),
    })),
  [cachedLeads]);

  const fetchAllData = () => refreshAll();

  // Filter states
  const [selectedClient, setSelectedClient] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [monthFilter, setMonthFilter] = useState('1');

  // Auto-select first client when clients load
  useEffect(() => {
    if (clients.length > 0 && !selectedClient) {
      setSelectedClient(clients[0]._id);
    }
  }, [clients, selectedClient]);

  // Filter entries based on selected client and date range
  const filteredEntries = useMemo(() => {
    if (!selectedClient) return [];
    return entries.filter((entry) => {
      try {
        const entryDate = entry.date?.split('T')[0] || new Date(entry.date).toISOString().split('T')[0];
        const withinDateRange = entryDate >= fromDate && entryDate <= toDate;
        const clientId = entry.client?._id || entry.client;
        return clientId === selectedClient && withinDateRange;
      } catch {
        return false;
      }
    });
  }, [entries, selectedClient, fromDate, toDate]);

  // Get unique dates sorted
  const sortedDates = useMemo(() => {
    const dateSet = new Set();
    filteredEntries.forEach((entry) => {
      try {
        const dateStr = entry.date?.split('T')[0] || new Date(entry.date).toISOString().split('T')[0];
        dateSet.add(dateStr);
      } catch {
        // Skip invalid dates
      }
    });
    return Array.from(dateSet).sort();
  }, [filteredEntries]);

  // Prepare line chart data
  const lineChartData = useMemo(() => {
    const dateMap = {};
    sortedDates.forEach((date) => {
      dateMap[date] = {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        metaForm: 0,
        metaWhatsapp: 0,
        metaTotalLeads: 0,
        googleWebsite: 0,
        googleCall: 0,
        googleTotalLeads: 0,
      };
    });

    filteredEntries.forEach((entry) => {
      try {
        const dateStr = entry.date?.split('T')[0] || new Date(entry.date).toISOString().split('T')[0];
        if (dateMap[dateStr]) {
          dateMap[dateStr].metaForm += entry.metaForm || 0;
          dateMap[dateStr].metaWhatsapp += entry.metaWhatsapp || 0;
          dateMap[dateStr].metaTotalLeads += entry.metaTotalLeads || 0;
          dateMap[dateStr].googleWebsite += entry.googleWebsite || 0;
          dateMap[dateStr].googleCall += entry.googleCall || 0;
          dateMap[dateStr].googleTotalLeads += entry.googleTotalLeads || 0;
        }
      } catch {
        // Skip invalid dates
      }
    });

    return Object.values(dateMap);
  }, [filteredEntries, sortedDates]);

  // Calculate month range for bar chart
  const barChartDateRange = useMemo(() => {
    const today = new Date();
    const months = parseInt(monthFilter);
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);
    return {
      start: startDate.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    };
  }, [monthFilter]);

  // Filter entries for bar chart
  const barChartEntries = useMemo(() => {
    if (!selectedClient) return [];
    return entries.filter((entry) => {
      try {
        const entryDate = entry.date?.split('T')[0] || new Date(entry.date).toISOString().split('T')[0];
        const withinRange = entryDate >= barChartDateRange.start && entryDate <= barChartDateRange.end;
        const clientId = entry.client?._id || entry.client;
        return clientId === selectedClient && withinRange;
      } catch {
        return false;
      }
    });
  }, [entries, selectedClient, barChartDateRange]);

  // Prepare bar chart data - group by month
  const barChartData = useMemo(() => {
    const monthMap = {};

    barChartEntries.forEach((entry) => {
      try {
        const date = new Date(entry.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        if (!monthMap[monthKey]) {
          monthMap[monthKey] = {
            month: monthLabel,
            monthKey,
            metaForm: 0,
            metaWhatsapp: 0,
            metaTotalLeads: 0,
            googleWebsite: 0,
            googleCall: 0,
            googleTotalLeads: 0,
          };
        }

        monthMap[monthKey].metaForm += entry.metaForm || 0;
        monthMap[monthKey].metaWhatsapp += entry.metaWhatsapp || 0;
        monthMap[monthKey].metaTotalLeads += entry.metaTotalLeads || 0;
        monthMap[monthKey].googleWebsite += entry.googleWebsite || 0;
        monthMap[monthKey].googleCall += entry.googleCall || 0;
        monthMap[monthKey].googleTotalLeads += entry.googleTotalLeads || 0;
      } catch {
        // Skip invalid dates
      }
    });

    return Object.values(monthMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [barChartEntries]);

  // Calculate stats
  const stats = useMemo(() => {
    const metaTotalLeads = filteredEntries.reduce((sum, entry) => sum + (entry.metaTotalLeads || 0), 0);
    const googleTotalLeads = filteredEntries.reduce((sum, entry) => sum + (entry.googleTotalLeads || 0), 0);
    const totalLeads = metaTotalLeads + googleTotalLeads;
    const totalSpend = filteredEntries.reduce((sum, entry) => sum + (entry.totalSpend || 0), 0);
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;

    return {
      metaTotalLeads,
      googleTotalLeads,
      totalLeads,
      totalSpend,
      avgCPL,
      entriesCount: filteredEntries.length,
    };
  }, [filteredEntries]);

  // Table data
  const tableData = useMemo(() => {
    return lineChartData.map((item, index) => {
      const prevItem = index > 0 ? lineChartData[index - 1] : null;
      const totalLeads = item.metaTotalLeads + item.googleTotalLeads;
      const prevTotalLeads = prevItem ? prevItem.metaTotalLeads + prevItem.googleTotalLeads : 0;
      const change = prevItem ? totalLeads - prevTotalLeads : 0;

      return {
        ...item,
        totalLeads,
        change,
      };
    });
  }, [lineChartData]);

  const selectedClientName = useMemo(() => {
    return clients.find(c => c._id === selectedClient)?.name || 'Select a Client';
  }, [selectedClient, clients]);

  const handleMonthFilterChange = (event, newValue) => {
    if (newValue !== null) {
      setMonthFilter(newValue);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Analytics & Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track client lead performance with detailed metrics
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={fetchAllData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters Section */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Client *</InputLabel>
                <Select
                  value={selectedClient}
                  label="Select Client *"
                  onChange={(e) => setSelectedClient(e.target.value)}
                >
                  {clients.map((client) => (
                    <MenuItem key={client._id} value={client._id}>
                      {client.name}
                    </MenuItem>
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
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To Date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && entries.length === 0 ? (
        <PageLoader message="Loading reports data..." />
      ) : !selectedClient ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Please select a client to view reports</Typography>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <MetricCard
                title="Meta Total Leads"
                value={stats.metaTotalLeads}
                icon={<Facebook />}
                color={METRIC_CONFIG.metaTotalLeads.color}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <MetricCard
                title="Google Total Leads"
                value={stats.googleTotalLeads}
                icon={<Google />}
                color={METRIC_CONFIG.googleTotalLeads.color}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <MetricCard
                title="Total Spend"
                value={stats.totalSpend.toFixed(2)}
                prefix="₹"
                icon={<AttachMoney />}
                color="#9c27b0"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <MetricCard
                title="Average CPL"
                value={stats.avgCPL.toFixed(2)}
                prefix="₹"
                icon={<TrendingUp />}
                color="#ff9800"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
              <MetricCard
                title="Total Entries"
                value={stats.entriesCount}
                icon={<CalendarMonth />}
                color="#4caf50"
              />
            </Grid>
          </Grid>

          {/* Line Charts Section */}
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>
            Daily Lead Trends
            <Chip label={selectedClientName} size="small" sx={{ ml: 2 }} color="primary" />
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            View individual metrics over the selected date range
          </Typography>

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {/* Meta Form Leads */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricLineChart
                data={lineChartData}
                metricKey="metaForm"
                title="Meta Form Leads"
              />
            </Grid>
            {/* Meta WhatsApp Leads */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricLineChart
                data={lineChartData}
                metricKey="metaWhatsapp"
                title="Meta WhatsApp Leads"
              />
            </Grid>
            {/* Total Meta Leads */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricLineChart
                data={lineChartData}
                metricKey="metaTotalLeads"
                title="Total Meta Leads"
              />
            </Grid>
            {/* Google Website Leads */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricLineChart
                data={lineChartData}
                metricKey="googleWebsite"
                title="Google Website Leads"
              />
            </Grid>
            {/* Google Call Leads */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricLineChart
                data={lineChartData}
                metricKey="googleCall"
                title="Google Call Leads"
              />
            </Grid>
            {/* Total Google Leads */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricLineChart
                data={lineChartData}
                metricKey="googleTotalLeads"
                title="Total Google Leads"
              />
            </Grid>
          </Grid>

          {/* Bar Charts Section */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 4, flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Monthly Overview
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View monthly aggregated data for each metric
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={monthFilter}
              exclusive
              onChange={handleMonthFilterChange}
              size="small"
            >
              <ToggleButton value="1" sx={{ px: 2 }}>
                Last Month
              </ToggleButton>
              <ToggleButton value="3" sx={{ px: 2 }}>
                Last 3 Months
              </ToggleButton>
              <ToggleButton value="6" sx={{ px: 2 }}>
                Last 6 Months
              </ToggleButton>
              <ToggleButton value="12" sx={{ px: 2 }}>
                Last 12 Months
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {/* Meta Form Leads Bar */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricBarChart
                data={barChartData}
                metricKey="metaForm"
                title="Meta Form Leads"
              />
            </Grid>
            {/* Meta WhatsApp Leads Bar */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricBarChart
                data={barChartData}
                metricKey="metaWhatsapp"
                title="Meta WhatsApp Leads"
              />
            </Grid>
            {/* Total Meta Leads Bar */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricBarChart
                data={barChartData}
                metricKey="metaTotalLeads"
                title="Total Meta Leads"
              />
            </Grid>
            {/* Google Website Leads Bar */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricBarChart
                data={barChartData}
                metricKey="googleWebsite"
                title="Google Website Leads"
              />
            </Grid>
            {/* Google Call Leads Bar */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricBarChart
                data={barChartData}
                metricKey="googleCall"
                title="Google Call Leads"
              />
            </Grid>
            {/* Total Google Leads Bar */}
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricBarChart
                data={barChartData}
                metricKey="googleTotalLeads"
                title="Total Google Leads"
              />
            </Grid>
          </Grid>

          {/* Data Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {selectedClientName} - Date-wise Performance
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.metaForm.color }} align="right">
                        Meta Form
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.metaWhatsapp.color }} align="right">
                        Meta WA
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.metaTotalLeads.color }} align="right">
                        Meta Total
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.googleWebsite.color }} align="right">
                        Google Web
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.googleCall.color }} align="right">
                        Google Call
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.googleTotalLeads.color }} align="right">
                        Google Total
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Total
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">
                        Change
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableData.length > 0 ? (
                      tableData.map((row, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{row.date}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={row.metaForm}
                              size="small"
                              sx={{ bgcolor: METRIC_CONFIG.metaForm.bgColor, color: METRIC_CONFIG.metaForm.color, fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={row.metaWhatsapp}
                              size="small"
                              sx={{ bgcolor: METRIC_CONFIG.metaWhatsapp.bgColor, color: METRIC_CONFIG.metaWhatsapp.color, fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: METRIC_CONFIG.metaTotalLeads.color }}>
                            {row.metaTotalLeads}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={row.googleWebsite}
                              size="small"
                              sx={{ bgcolor: METRIC_CONFIG.googleWebsite.bgColor, color: METRIC_CONFIG.googleWebsite.color, fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={row.googleCall}
                              size="small"
                              sx={{ bgcolor: METRIC_CONFIG.googleCall.bgColor, color: METRIC_CONFIG.googleCall.color, fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: METRIC_CONFIG.googleTotalLeads.color }}>
                            {row.googleTotalLeads}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {row.totalLeads}
                          </TableCell>
                          <TableCell align="center">
                            {row.change !== 0 && (
                              <Chip
                                icon={row.change > 0 ? <TrendingUp sx={{ fontSize: 14 }} /> : <TrendingDown sx={{ fontSize: 14 }} />}
                                label={`${row.change > 0 ? '+' : ''}${row.change}`}
                                size="small"
                                sx={{
                                  bgcolor: row.change > 0 ? '#10b98115' : '#ef444415',
                                  color: row.change > 0 ? '#10b981' : '#ef4444',
                                  fontWeight: 600,
                                  '& .MuiChip-icon': {
                                    color: row.change > 0 ? '#10b981' : '#ef4444',
                                  }
                                }}
                              />
                            )}
                            {row.change === 0 && index > 0 && (
                              <Typography variant="body2" color="text.secondary">-</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                          <Typography color="text.secondary">No data available for selected date range</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default Reports;
