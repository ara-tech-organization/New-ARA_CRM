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
  Autocomplete,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  CalendarMonth,
  Facebook,
  WhatsApp,
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
import api from '../api/axios';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { format as fmtDate, parseISO, isValid as isValidDate } from 'date-fns';

// Reformat a YYYY-MM-DD string into DD/MM/YYYY for display. The
// native <input type="date"> always returns ISO; the helper text
// echoes the date in DD/MM/YYYY so the user sees an unambiguous
// format regardless of their browser locale.
const fmtDDMMYYYY = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

// Colors for different metrics
const METRIC_CONFIG = {
  metaForm: {
    color: '#C08552',
    label: 'Meta Form Leads',
    icon: <Facebook />,
    bgColor: '#C0855215',
  },
  metaWhatsapp: {
    color: '#3E2723',
    label: 'Meta WhatsApp Leads',
    icon: <WhatsApp />,
    bgColor: '#3E272315',
  },
  metaTotalLeads: {
    color: '#C08552',
    label: 'Total Meta Leads',
    icon: <Facebook />,
    bgColor: '#C0855215',
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
  const { clients: cachedClients } = useDataCache();

  // Transform cached client list to the simple shape this page needs.
  const clients = useMemo(() =>
    cachedClients.map(c => ({ _id: c._id, name: c.clientName })),
  [cachedClients]);

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

  // ────────────────────────────────────────────────────────────────────
  // Data fetch — Meta analytics. The previous version of this page
  // tried to derive entries from /api/leads but the Lead docs don't
  // carry the flat metaFormLead/metaWhatsappLead fields the JSX
  // expected, so every chart and stat rendered zero. We now hit
  // /api/meta/client/:id/analytics which already returns a daily_trend
  // array per client per date range, then map snake_case → camelCase
  // so the existing JSX needs no changes.
  // ────────────────────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [barAnalytics, setBarAnalytics] = useState(null);
  const loading = analyticsLoading;

  // Line-chart / stats / table fetch — uses the picked From/To dates.
  useEffect(() => {
    if (!selectedClient) {
      setAnalytics(null);
      return;
    }
    let cancelled = false;
    setAnalyticsLoading(true);
    api.get(`/meta/client/${selectedClient}/analytics`, {
      params: { from: fromDate, to: toDate },
    })
      .then((res) => {
        if (cancelled) return;
        setAnalytics(res.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Reports analytics fetch failed:', err);
        setAnalytics(null);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedClient, fromDate, toDate]);

  // Bar-chart fetch — uses the Last 1/3/6/12 Months toggle, which is a
  // wider range than the user's manually picked dates.
  const barRange = useMemo(() => {
    const today = new Date();
    const months = parseInt(monthFilter);
    const start = new Date(today);
    start.setMonth(start.getMonth() - months);
    return {
      start: start.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    };
  }, [monthFilter]);

  useEffect(() => {
    if (!selectedClient) {
      setBarAnalytics(null);
      return;
    }
    let cancelled = false;
    api.get(`/meta/client/${selectedClient}/analytics`, {
      params: { from: barRange.start, to: barRange.end },
    })
      .then((res) => {
        if (cancelled) return;
        setBarAnalytics(res.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Reports bar-chart fetch failed:', err);
        setBarAnalytics(null);
      })
      .finally(() => {});
    return () => { cancelled = true; };
  }, [selectedClient, barRange.start, barRange.end]);

  // Map the backend's daily_trend rows into the camelCase shape the
  // existing JSX (line chart, stats, table) consumes.
  const filteredEntries = useMemo(() => {
    const daily = analytics?.daily_trend || [];
    return daily.map((d) => ({
      date: d.date,                            // 'YYYY-MM-DD'
      metaForm: d.form_leads || 0,
      metaWhatsapp: d.whatsapp_leads || 0,
      metaTotalLeads: d.total_leads ?? ((d.form_leads || 0) + (d.whatsapp_leads || 0)),
      totalSpend: d.spend || 0,
    }));
  }, [analytics]);

  const fetchAllData = () => {
    // Force a refetch by toggling a no-op state via the existing
    // useEffects' deps — easiest is to bump the dates. Instead we
    // simply call the API again directly. Reuses both endpoints.
    if (!selectedClient) return;
    setAnalyticsLoading(true);
    Promise.all([
      api.get(`/meta/client/${selectedClient}/analytics`, { params: { from: fromDate, to: toDate } })
        .then((res) => setAnalytics(res.data || null))
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false)),
      api.get(`/meta/client/${selectedClient}/analytics`, { params: { from: barRange.start, to: barRange.end } })
        .then((res) => setBarAnalytics(res.data || null))
        .catch(() => {})
        .finally(() => {}),
    ]);
  };

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
      };
    });

    filteredEntries.forEach((entry) => {
      try {
        const dateStr = entry.date?.split('T')[0] || new Date(entry.date).toISOString().split('T')[0];
        if (dateMap[dateStr]) {
          dateMap[dateStr].metaForm += entry.metaForm || 0;
          dateMap[dateStr].metaWhatsapp += entry.metaWhatsapp || 0;
          dateMap[dateStr].metaTotalLeads += entry.metaTotalLeads || 0;
        }
      } catch {
        // Skip invalid dates
      }
    });

    return Object.values(dateMap);
  }, [filteredEntries, sortedDates]);

  // Bar chart entries — same camelCase mapping as the line chart but
  // sourced from the wider-range `barAnalytics` fetch.
  const barChartEntries = useMemo(() => {
    const daily = barAnalytics?.daily_trend || [];
    return daily.map((d) => ({
      date: d.date,
      metaForm: d.form_leads || 0,
      metaWhatsapp: d.whatsapp_leads || 0,
      metaTotalLeads: d.total_leads ?? ((d.form_leads || 0) + (d.whatsapp_leads || 0)),
      totalSpend: d.spend || 0,
    }));
  }, [barAnalytics]);

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
          };
        }

        monthMap[monthKey].metaForm += entry.metaForm || 0;
        monthMap[monthKey].metaWhatsapp += entry.metaWhatsapp || 0;
        monthMap[monthKey].metaTotalLeads += entry.metaTotalLeads || 0;
      } catch {
        // Skip invalid dates
      }
    });

    return Object.values(monthMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [barChartEntries]);

  // Calculate stats — Meta-only since Google reporting was removed.
  const stats = useMemo(() => {
    const metaTotalLeads = filteredEntries.reduce((sum, entry) => sum + (entry.metaTotalLeads || 0), 0);
    const totalSpend = filteredEntries.reduce((sum, entry) => sum + (entry.totalSpend || 0), 0);
    const avgCPL = metaTotalLeads > 0 ? totalSpend / metaTotalLeads : 0;

    return {
      metaTotalLeads,
      totalSpend,
      avgCPL,
      entriesCount: filteredEntries.length,
    };
  }, [filteredEntries]);

  // Table data — change column tracks day-over-day Meta total movement.
  const tableData = useMemo(() => {
    return lineChartData.map((item, index) => {
      const prevItem = index > 0 ? lineChartData[index - 1] : null;
      const change = prevItem ? item.metaTotalLeads - prevItem.metaTotalLeads : 0;
      return { ...item, change };
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
    // en-GB locale gives date-fns + the picker a DD/MM/YYYY default,
    // so the calendar shows day-first formatting throughout.
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
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
              {/* Searchable client picker — Autocomplete beats Select
                  once the client list grows past ~10 entries. Stores
                  the same client._id string the old Select wrote, so
                  every downstream filter / fetch keeps working. */}
              <Autocomplete
                fullWidth
                size="small"
                value={clients.find((c) => c._id === selectedClient) || null}
                onChange={(_, opt) => setSelectedClient(opt?._id || '')}
                options={clients}
                getOptionLabel={(opt) => opt?.name || ''}
                isOptionEqualToValue={(a, b) => a?._id === b?._id}
                renderInput={(params) => (
                  <TextField {...params} label="Select Client *" placeholder="Type to search…" />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              {/* MUI X DatePicker with en-GB locale + dd/MM/yyyy format
                  — the typed input AND the calendar popover both show
                  DD/MM/YYYY. State stays as ISO YYYY-MM-DD so downstream
                  fetches don't need any change. */}
              <DatePicker
                label="From Date"
                value={fromDate ? parseISO(fromDate) : null}
                onChange={(d) => setFromDate(d && isValidDate(d) ? fmtDate(d, 'yyyy-MM-dd') : '')}
                format="dd/MM/yyyy"
                slotProps={{
                  textField: { fullWidth: true, size: 'small', placeholder: 'DD/MM/YYYY' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <DatePicker
                label="To Date"
                value={toDate ? parseISO(toDate) : null}
                onChange={(d) => setToDate(d && isValidDate(d) ? fmtDate(d, 'yyyy-MM-dd') : '')}
                format="dd/MM/yyyy"
                slotProps={{
                  textField: { fullWidth: true, size: 'small', placeholder: 'DD/MM/YYYY' },
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && filteredEntries.length === 0 ? (
        <PageLoader message="Loading reports data..." />
      ) : !selectedClient ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Please select a client to view reports</Typography>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Meta Total Leads"
                value={stats.metaTotalLeads}
                icon={<Facebook />}
                color={METRIC_CONFIG.metaTotalLeads.color}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Total Spend"
                value={stats.totalSpend.toFixed(2)}
                prefix="₹"
                icon={<AttachMoney />}
                color="#9c27b0"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Average CPL"
                value={stats.avgCPL.toFixed(2)}
                prefix="₹"
                icon={<TrendingUp />}
                color="#ff9800"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
          </Grid>

          {/* Bar Charts Section */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2, mt: 4, flexWrap: 'wrap', gap: 1.5 }}>
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
                    <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f8fafc' }}>
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
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
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
    </LocalizationProvider>
  );
};

export default Reports;
