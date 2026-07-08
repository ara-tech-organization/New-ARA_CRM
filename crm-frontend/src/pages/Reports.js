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
  Tooltip as MuiTooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  CalendarMonth,
  Facebook,
  WhatsApp,
  Refresh as RefreshIcon,
  InfoOutlined as InfoOutlinedIcon,
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

// Now accepts an optional `tooltip` prop — when supplied, hovering
// anywhere on the card shows the explanation. Useful for the headline
// stat tiles where the title alone may not be self-explanatory.
// `change` is an optional period-over-period percentage — when set
// to a number, a coloured up/down badge renders beneath the value.
// `lowerIsBetter` flips the colour scheme (e.g. CPL going down is good).
const MetricCard = ({ title, value, icon, color, prefix = '', tooltip, change, lowerIsBetter, prevLabel }) => {
  const card = (
    <Card sx={{ height: '100%', cursor: tooltip ? 'help' : 'default', borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography color="text.secondary" variant="overline" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color }}>
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: 22, color } })}
          </Box>
        </Box>
        {/* Period-over-period change badge — green if better, red if worse. */}
        {change != null && (
          (() => {
            const isUp = change > 0;
            const goodDirection = lowerIsBetter ? !isUp : isUp;
            const isNeutral = change === 0;
            const badgeColor = isNeutral ? '#6b7280' : (goodDirection ? '#10b981' : '#ef4444');
            const arrow = isNeutral ? '·' : (isUp ? '▲' : '▼');
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.3,
                  px: 0.8, py: 0.2, borderRadius: 1,
                  bgcolor: `${badgeColor}15`, color: badgeColor,
                  fontSize: '0.72rem', fontWeight: 700,
                }}>
                  {arrow} {Math.abs(change)}%
                </Box>
                <Typography sx={{ fontSize: '0.66rem', color: 'text.secondary' }}>
                  vs prev period{prevLabel ? ` (${prevLabel})` : ''}
                </Typography>
              </Box>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
  if (!tooltip) return card;
  return (
    <MuiTooltip arrow placement="top" title={tooltip}>
      {card}
    </MuiTooltip>
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

// Compact stat tile used by the Google Ads overview strip.
// Left border in the metric's color + eyebrow label + tabular-nums
// value. Doubles as a "which metric matters" cue when scanning.
const SummaryTile = ({ label, value, color }) => (
  <Card variant="outlined" sx={{ borderLeft: `3px solid ${color}`, height: '100%' }}>
    <CardContent sx={{ py: 1.4, '&:last-child': { pb: 1.4 } }}>
      <Typography sx={{
        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.1px',
        color: '#8B7261', textTransform: 'uppercase', mb: 0.3,
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontWeight: 900, fontSize: '1.1rem', color,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

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
  const { clients: cachedClients, fetchClients } = useDataCache();
  useEffect(() => { fetchClients(); }, [fetchClients]);

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
  // chartTab: 0 = Daily Trends, 1 = Monthly Overview, 2 = Date-wise Table.
  // The three sections used to stack vertically — now they live behind
  // tabs so the page above the fold stays compact and readable.
  const [chartTab, setChartTab] = useState(0);

  // Apply a quick range preset (in days). Updates from/to in one go.
  const applyQuickRange = (kind) => {
    const today = new Date();
    const isoToday = today.toISOString().split('T')[0];
    if (kind === 'today') {
      setFromDate(isoToday); setToDate(isoToday); return;
    }
    if (kind === 'week') {
      const d = new Date(); d.setDate(today.getDate() - 6);
      setFromDate(d.toISOString().split('T')[0]); setToDate(isoToday); return;
    }
    if (kind === 'month') {
      const d = new Date(); d.setDate(today.getDate() - 29);
      setFromDate(d.toISOString().split('T')[0]); setToDate(isoToday); return;
    }
    if (kind === 'thisMonth') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(d.toISOString().split('T')[0]); setToDate(isoToday); return;
    }
    if (kind === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(end.toISOString().split('T')[0]);
    }
  };

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

  // ── Google Ads (per selected client) state ─────────────────────
  // Fetches the selected client's Google Ads performance for the
  // From/To range already picked at the top of the page. Uses the
  // same /analytics/client/:id endpoint the per-client detail page
  // uses, so the numbers exactly match what admins see there.
  const [googleData, setGoogleData] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMetric, setGoogleMetric] = useState('cost');
  const [googleChartTab, setGoogleChartTab] = useState(0); // 0=Daily Trends · 1=Date-wise Table
  useEffect(() => {
    if (!selectedClient || !fromDate || !toDate) {
      setGoogleData(null);
      return;
    }
    let cancelled = false;
    setGoogleLoading(true);
    api.get(`/analytics/client/${selectedClient}`, {
      params: { start_date: fromDate, end_date: toDate },
    })
      .then((res) => {
        if (cancelled) return;
        setGoogleData(res.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Reports Google Ads fetch failed:', err);
        setGoogleData(null);
      })
      .finally(() => { if (!cancelled) setGoogleLoading(false); });
    return () => { cancelled = true; };
  }, [selectedClient, fromDate, toDate]);

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

  // ── Period-over-period comparison ────────────────────────────────
  // Build the same stats for the equivalent range immediately before
  // the selected one (e.g. if current is the last 7 days, prev is the
  // 7 days before that). Source data is `barChartEntries` since it
  // spans a wider month-filter range than the current selection —
  // when the prev period falls inside that wider window, we get free
  // historical data without an extra fetch.
  const prevPeriodStats = useMemo(() => {
    if (!fromDate || !toDate || !barChartEntries || barChartEntries.length === 0) return null;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const dayMs = 24 * 3600 * 1000;
    const lenDays = Math.max(Math.round((end - start) / dayMs) + 1, 1);
    const prevEnd = new Date(start.getTime() - dayMs);
    const prevStart = new Date(prevEnd.getTime() - (lenDays - 1) * dayMs);
    const prevStartIso = prevStart.toISOString().split('T')[0];
    const prevEndIso = prevEnd.toISOString().split('T')[0];

    const prevRows = barChartEntries.filter((e) => {
      const d = e.date;
      return d >= prevStartIso && d <= prevEndIso;
    });
    // If no rows from the broader window fall into the prev period
    // (i.e. it's older than the monthFilter covers), don't show stale
    // comparisons — return null so badges hide.
    if (prevRows.length === 0) return null;

    const leads = prevRows.reduce((s, e) => s + (e.metaTotalLeads || 0), 0);
    const spend = prevRows.reduce((s, e) => s + (e.totalSpend || 0), 0);
    return {
      metaTotalLeads: leads,
      totalSpend: spend,
      avgCPL: leads > 0 ? spend / leads : 0,
      entriesCount: prevRows.length,
      label: `${prevStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → ${prevEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
    };
  }, [barChartEntries, fromDate, toDate]);

  // Helper: percentage change from prev → curr, capped & rounded.
  const pctChange = (curr, prev) => {
    if (!prev || prev === 0) return curr > 0 ? null : 0; // null = no baseline to compare
    return Math.round(((curr - prev) / prev) * 100);
  };

  // ── Best / Worst day insights ────────────────────────────────────
  // Pick the day in range with the most leads and the day with the
  // fewest (excluding zero-only days for "best"). Helps spot peaks
  // worth investigating.
  const bestWorstDay = useMemo(() => {
    if (!lineChartData || lineChartData.length === 0) return null;
    const withData = lineChartData.filter((d) => d.metaTotalLeads > 0);
    if (withData.length === 0) return null;
    const best = withData.reduce((a, b) => (b.metaTotalLeads > a.metaTotalLeads ? b : a));
    const worst = withData.reduce((a, b) => (b.metaTotalLeads < a.metaTotalLeads ? b : a));
    return { best, worst, same: best.date === worst.date };
  }, [lineChartData]);

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
      {/* ── Hero strip ────────────────────────────────────────────
          Sets the tone — gradient background, page title with
          one-line tooltip, current period summary, refresh button
          on the right. Mirrors the polished Dashboard hero so the
          two pages feel like siblings. */}
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          background: 'linear-gradient(135deg, #C0855215 0%, #C0855205 50%, transparent 100%)',
          borderLeft: '4px solid #C08552',
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#3E2723', lineHeight: 1.1 }}>
                  Analytics & Reports
                </Typography>
                <MuiTooltip
                  arrow placement="right"
                  title="Per-client analytics — pick a client + range, explore charts and the day-wise table"
                >
                  <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'help' }} />
                </MuiTooltip>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedClientName !== 'Select a Client'
                  ? <><Box component="span" sx={{ fontWeight: 600, color: '#C08552' }}>{selectedClientName}</Box> · {fromDate && toDate ? `${fmtDDMMYYYY(fromDate)} → ${fmtDDMMYYYY(toDate)}` : 'Pick a date range below'}</>
                  : 'Pick a client to start exploring performance'}
              </Typography>
            </Box>
            <MuiTooltip arrow title="Re-fetch the latest leads and analytics">
              <Button
                variant="contained"
                size="small"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                onClick={fetchAllData}
                disabled={loading}
                sx={{ bgcolor: '#C08552', color: '#fff', '&:hover': { bgcolor: '#C08552', filter: 'brightness(0.92)' } }}
              >
                Refresh
              </Button>
            </MuiTooltip>
          </Box>
        </CardContent>
      </Card>

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
              {/* MUI X DatePicker with en-GB locale + dd/MM/yyyy format.
                  `maxDate` is locked to today so future dates can't be
                  picked — no leads exist for the future, so allowing
                  them just yields blank reports. The "To" picker uses
                  the same ceiling. */}
              <DatePicker
                label="From Date"
                value={fromDate ? parseISO(fromDate) : null}
                onChange={(d) => setFromDate(d && isValidDate(d) ? fmtDate(d, 'yyyy-MM-dd') : '')}
                format="dd/MM/yyyy"
                maxDate={new Date()}
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
                maxDate={new Date()}
                // The To-date can also never precede the From-date.
                minDate={fromDate ? parseISO(fromDate) : undefined}
                slotProps={{
                  textField: { fullWidth: true, size: 'small', placeholder: 'DD/MM/YYYY' },
                }}
              />
            </Grid>
            {/* Quick range preset chips — save the user two clicks
                per common range. Click sets both From + To in one go. */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, mr: 0.5 }}>
                  Quick range:
                </Typography>
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'Last 7 Days' },
                  { key: 'month', label: 'Last 30 Days' },
                  { key: 'thisMonth', label: 'This Month' },
                  { key: 'lastMonth', label: 'Last Month' },
                ].map((p) => (
                  <Chip
                    key={p.key}
                    label={p.label}
                    size="small"
                    onClick={() => applyQuickRange(p.key)}
                    sx={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      bgcolor: '#C0855210',
                      color: '#C08552',
                      '&:hover': { bgcolor: '#C0855225' },
                    }}
                  />
                ))}
              </Box>
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
                tooltip="Sum of Meta Form + Meta WhatsApp leads across every day in the selected date range for this client."
                change={prevPeriodStats ? pctChange(stats.metaTotalLeads, prevPeriodStats.metaTotalLeads) : null}
                prevLabel={prevPeriodStats?.label}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Total Spend"
                value={stats.totalSpend.toFixed(2)}
                prefix="₹"
                icon={<AttachMoney />}
                color="#9c27b0"
                tooltip="Total ad spend across the selected date range — sum of every day's Meta Fund + Google Fund from Daily Lead Entry records."
                change={prevPeriodStats ? pctChange(stats.totalSpend, prevPeriodStats.totalSpend) : null}
                prevLabel={prevPeriodStats?.label}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Average CPL"
                value={stats.avgCPL.toFixed(2)}
                prefix="₹"
                icon={<TrendingUp />}
                color="#ff9800"
                tooltip="Average Cost Per Lead = Total Spend ÷ Total Leads for the selected range. Lower is better — tells you how much each lead is costing."
                change={prevPeriodStats ? pctChange(stats.avgCPL, prevPeriodStats.avgCPL) : null}
                prevLabel={prevPeriodStats?.label}
                lowerIsBetter
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MetricCard
                title="Total Entries"
                value={stats.entriesCount}
                icon={<CalendarMonth />}
                color="#4caf50"
                tooltip="Number of Daily Lead Entry records logged in the selected range. One entry per day per client — a low count means days were missed."
                change={prevPeriodStats ? pctChange(stats.entriesCount, prevPeriodStats.entriesCount) : null}
                prevLabel={prevPeriodStats?.label}
              />
            </Grid>
          </Grid>

          {/* ── Best / Worst Day Insights ──────────────────────────
              Auto-detected day spotlights so users immediately see
              which day to celebrate and which to investigate. */}
          {bestWorstDay && (
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderLeft: '4px solid #10b981', height: '100%' }}>
                  <CardContent sx={{ py: 1.8, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp sx={{ color: '#10b981', fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Best Day
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#10b981', lineHeight: 1.1 }}>
                        {bestWorstDay.best.date}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {bestWorstDay.best.metaTotalLeads} total leads ({bestWorstDay.best.metaForm} form + {bestWorstDay.best.metaWhatsapp} WhatsApp)
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderLeft: '4px solid #ef4444', height: '100%' }}>
                  <CardContent sx={{ py: 1.8, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#ef444415', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingDown sx={{ color: '#ef4444', fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Quietest Day
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#ef4444', lineHeight: 1.1 }}>
                        {bestWorstDay.worst.date}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {bestWorstDay.same ? 'Only day with activity in the range' : `${bestWorstDay.worst.metaTotalLeads} total leads (${bestWorstDay.worst.metaForm} form + ${bestWorstDay.worst.metaWhatsapp} WhatsApp)`}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* ── Section tabs — Daily Trends · Monthly Overview · Date Table */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <Tabs
              value={chartTab}
              onChange={(_, v) => setChartTab(v)}
              sx={{
                px: 2,
                '& .MuiTabs-indicator': { bgcolor: '#C08552', height: 3 },
                '& .Mui-selected': { color: '#C08552 !important' },
              }}
            >
              <Tab label="Daily Trends" sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label="Monthly Overview" sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label="Date-wise Table" sx={{ textTransform: 'none', fontWeight: 700 }} />
            </Tabs>
          </Card>

          {/* Line Charts Section — only visible on the Daily Trends tab */}
          {chartTab === 0 && (<>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.3 }}>
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
          </>)}

          {/* Bar Charts Section — Monthly Overview tab */}
          {chartTab === 1 && (<>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
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
          </>)}

          {/* Data Table — Date-wise Table tab */}
          {chartTab === 2 && (
          <Card>
            <CardContent>
              {/* Section title gets an inline info icon explaining what
                  the table holds + tiny tooltips on every column header
                  AND on each cell value so a fresh team member can
                  hover over any number to learn what it represents. */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedClientName} - Date-wise Performance
                </Typography>
                <MuiTooltip
                  arrow placement="right"
                  title="One row per day in the selected range. Numbers come from this client's Daily Lead Entries — Meta Form + Meta WhatsApp leads tracked manually each day. The Change column shows the day-over-day movement in Meta Total."
                >
                  <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
                </MuiTooltip>
              </Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        <MuiTooltip arrow title="Calendar date the leads were received on (DD/MM/YYYY).">
                          <Box component="span" sx={{ borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }}>
                            Date
                          </Box>
                        </MuiTooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.metaForm.color }} align="right">
                        <MuiTooltip arrow title="Meta Form Leads — leads that submitted the Facebook / Instagram lead-form on this day. Synced from the Daily Lead Entry record.">
                          <Box component="span" sx={{ borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }}>
                            Meta Form
                          </Box>
                        </MuiTooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.metaWhatsapp.color }} align="right">
                        <MuiTooltip arrow title="Meta WhatsApp Leads — conversations started via the WhatsApp click-to-chat ad on this day. Includes both auto-replies and human follow-ups.">
                          <Box component="span" sx={{ borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }}>
                            Meta WA
                          </Box>
                        </MuiTooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: METRIC_CONFIG.metaTotalLeads.color }} align="right">
                        <MuiTooltip arrow title="Meta Total = Meta Form + Meta WhatsApp leads for this day. The headline number to scan when you only want one figure per day.">
                          <Box component="span" sx={{ borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }}>
                            Meta Total
                          </Box>
                        </MuiTooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">
                        <MuiTooltip arrow title="Day-over-day movement in Meta Total compared to the previous row. Green ▲ means more leads today, red ▼ means fewer. Blank on the first row (no previous day to compare).">
                          <Box component="span" sx={{ borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }}>
                            Change
                          </Box>
                        </MuiTooltip>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableData.length > 0 ? (
                      tableData.map((row, index) => (
                        <TableRow key={index} hover>
                          <TableCell>
                            <MuiTooltip arrow title={`Performance for ${row.date}`}>
                              <Box component="span" sx={{ cursor: 'help' }}>{row.date}</Box>
                            </MuiTooltip>
                          </TableCell>
                          <TableCell align="right">
                            <MuiTooltip arrow title={`${row.metaForm} Meta Form lead${row.metaForm === 1 ? '' : 's'} on ${row.date}`}>
                              <Chip
                                label={row.metaForm}
                                size="small"
                                sx={{ bgcolor: METRIC_CONFIG.metaForm.bgColor, color: METRIC_CONFIG.metaForm.color, fontWeight: 600, cursor: 'help' }}
                              />
                            </MuiTooltip>
                          </TableCell>
                          <TableCell align="right">
                            <MuiTooltip arrow title={`${row.metaWhatsapp} Meta WhatsApp conversation${row.metaWhatsapp === 1 ? '' : 's'} on ${row.date}`}>
                              <Chip
                                label={row.metaWhatsapp}
                                size="small"
                                sx={{ bgcolor: METRIC_CONFIG.metaWhatsapp.bgColor, color: METRIC_CONFIG.metaWhatsapp.color, fontWeight: 600, cursor: 'help' }}
                              />
                            </MuiTooltip>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: METRIC_CONFIG.metaTotalLeads.color }}>
                            <MuiTooltip arrow title={`Total Meta leads on ${row.date}: ${row.metaForm} form + ${row.metaWhatsapp} WhatsApp = ${row.metaTotalLeads}`}>
                              <Box component="span" sx={{ cursor: 'help' }}>{row.metaTotalLeads}</Box>
                            </MuiTooltip>
                          </TableCell>
                          <TableCell align="center">
                            {row.change !== 0 && (
                              <MuiTooltip
                                arrow
                                title={row.change > 0
                                  ? `${row.change} more lead${row.change === 1 ? '' : 's'} than the previous day`
                                  : `${Math.abs(row.change)} fewer lead${Math.abs(row.change) === 1 ? '' : 's'} than the previous day`}
                              >
                                <Chip
                                  icon={row.change > 0 ? <TrendingUp sx={{ fontSize: 14 }} /> : <TrendingDown sx={{ fontSize: 14 }} />}
                                  label={`${row.change > 0 ? '+' : ''}${row.change}`}
                                  size="small"
                                  sx={{
                                    bgcolor: row.change > 0 ? '#10b98115' : '#ef444415',
                                    color: row.change > 0 ? '#10b981' : '#ef4444',
                                    fontWeight: 600,
                                    cursor: 'help',
                                    '& .MuiChip-icon': {
                                      color: row.change > 0 ? '#10b981' : '#ef4444',
                                    }
                                  }}
                                />
                              </MuiTooltip>
                            )}
                            {row.change === 0 && index > 0 && (
                              <MuiTooltip arrow title="No change — same Meta Total as the previous day">
                                <Typography variant="body2" color="text.secondary" sx={{ cursor: 'help' }}>-</Typography>
                              </MuiTooltip>
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
          )}
      {/* ── Google Ads (selected client + date range) ─────────────
          Mirrors the client picker and the From/To range at the top
          of the page. When no client is picked or the picked client
          isn't linked to Google Ads, the card shows a friendly empty
          state. Otherwise, four summary tiles + a daily performance
          chart with a metric toggle. */}
      {selectedClient && (() => {
        const GOOGLE_GREEN = '#34A853';
        const BROWN_C = '#3E2723';
        const CREAM_C = '#FFF4ED';
        const BORDER_C = '#E8D5C4';
        const summary = googleData?.summary || null;
        const dailyRaw = Array.isArray(googleData?.dailyMetrics) ? googleData.dailyMetrics : [];
        // Normalise the date to `YYYY-MM-DD` regardless of whether
        // the backend returns a raw ISO timestamp or a plain date.
        // Previously the ISO tail (`…T00:00:00.000Z`) leaked into
        // the X-axis label.
        const isoDay = (raw) => String(raw || '').slice(0, 10);
        // Aggregate multiple campaigns on the same date into one row
        // per date, so the trend chart plots a single line per metric.
        const byDate = {};
        dailyRaw.forEach((d) => {
          const dt = isoDay(d.date);
          if (!dt) return;
          if (!byDate[dt]) byDate[dt] = { date: dt, cost: 0, clicks: 0, impressions: 0, conversions: 0 };
          byDate[dt].cost += Number(d.cost) || 0;
          byDate[dt].clicks += Number(d.clicks) || 0;
          byDate[dt].impressions += Number(d.impressions) || 0;
          byDate[dt].conversions += Number(d.conversions) || 0;
        });
        // Nice "Jul 2" style labels via date-fns — matches the Meta
        // charts elsewhere on the page instead of raw ISO strings.
        const fmtShort = (iso) => {
          try {
            const d = parseISO(iso);
            return isValidDate(d) ? fmtDate(d, 'MMM d') : iso;
          } catch { return iso; }
        };
        const daily = Object.values(byDate)
          .map((d) => ({
            ...d,
            cpl: d.conversions > 0 ? Math.round((d.cost / d.conversions) * 100) / 100 : 0,
            dateLabel: fmtShort(d.date),
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const totalCost = summary?.totalCost ?? daily.reduce((s, d) => s + d.cost, 0);
        const totalClicks = summary?.totalClicks ?? daily.reduce((s, d) => s + d.clicks, 0);
        const totalConversions = summary?.totalConversions ?? daily.reduce((s, d) => s + d.conversions, 0);
        const cpl = totalConversions > 0 ? Math.round((totalCost / totalConversions) * 100) / 100 : 0;
        const hasData = daily.length > 0 || totalCost > 0 || totalClicks > 0;

        const METRICS = [
          { key: 'cost', label: 'Cost (₹)', short: 'Cost', color: GOOGLE_GREEN, isCurrency: true },
          { key: 'clicks', label: 'Clicks', short: 'Clicks', color: '#4285F4', isCurrency: false },
          { key: 'conversions', label: 'Conversions', short: 'Conv.', color: '#FBBC04', isCurrency: false },
          { key: 'cpl', label: 'Cost per Lead (₹)', short: 'CPL', color: '#EA4335', isCurrency: true },
        ];
        const active = METRICS.find((m) => m.key === googleMetric) || METRICS[0];
        const fmt = (v) => (active.isCurrency ? `₹${Number(v).toLocaleString('en-IN')}` : Number(v).toLocaleString('en-IN'));

        return (
          <Card variant="outlined" sx={{ mb: 2, borderColor: `${GOOGLE_GREEN}33` }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              {/* Header */}
              <Box sx={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 2, mb: 2,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 1.5,
                    bgcolor: GOOGLE_GREEN, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontWeight: 900, fontSize: '1rem',
                    boxShadow: `0 6px 16px ${GOOGLE_GREEN}44`,
                  }}>
                    G
                  </Box>
                  <Box>
                    <Typography sx={{
                      fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.4px',
                      color: GOOGLE_GREEN, textTransform: 'uppercase', lineHeight: 1, mb: 0.4,
                    }}>
                      Google Ads · Performance
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: BROWN_C, lineHeight: 1.15 }}>
                      {selectedClientName}
                    </Typography>
                    <Typography sx={{ fontSize: '0.76rem', color: `${BROWN_C}99`, mt: 0.3 }}>
                      {fromDate ? fmtDDMMYYYY(fromDate) : '—'} → {toDate ? fmtDDMMYYYY(toDate) : '—'}
                    </Typography>
                  </Box>
                </Box>

                {hasData && (
                  <ToggleButtonGroup
                    value={googleMetric}
                    exclusive
                    size="small"
                    onChange={(_, v) => v && setGoogleMetric(v)}
                    sx={{
                      bgcolor: '#fff',
                      '& .MuiToggleButton-root': {
                        border: `1px solid ${BORDER_C}`,
                        color: `${BROWN_C}AA`,
                        textTransform: 'none',
                        fontWeight: 700, fontSize: '0.76rem',
                        px: 1.4, py: 0.4,
                        '&.Mui-selected': {
                          bgcolor: GOOGLE_GREEN, color: '#fff',
                          '&:hover': { bgcolor: GOOGLE_GREEN, filter: 'brightness(1.08)' },
                        },
                      },
                    }}
                  >
                    {METRICS.map((m) => (
                      <ToggleButton key={m.key} value={m.key}>{m.short}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )}
              </Box>

              {/* Summary strip */}
              {hasData && (
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <SummaryTile label="Total Cost" value={`₹${totalCost.toLocaleString('en-IN')}`} color={GOOGLE_GREEN} />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <SummaryTile label="Total Clicks" value={totalClicks.toLocaleString('en-IN')} color="#4285F4" />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <SummaryTile label="Conversions" value={totalConversions.toLocaleString('en-IN', { maximumFractionDigits: 2 })} color="#FBBC04" />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <SummaryTile label="Cost per Lead" value={`₹${cpl.toLocaleString('en-IN')}`} color="#EA4335" />
                  </Grid>
                </Grid>
              )}

              {/* ── Best / Quietest Day (Google Ads) ────────────────
                  Ranked by conversions (leads-equivalent for Google).
                  Cost + CPL sit as the subtitle so the spotlight
                  answers "which day delivered the most for the money"
                  in one glance — same visual treatment as the Meta
                  Best/Quietest Day above but reading Google numbers. */}
              {(() => {
                const daysWithActivity = daily.filter((d) => (d.conversions || 0) > 0 || (d.cost || 0) > 0);
                if (daysWithActivity.length === 0) return null;
                const sortedByConv = [...daysWithActivity].sort((a, b) => (b.conversions || 0) - (a.conversions || 0));
                const best = sortedByConv[0];
                const worst = sortedByConv[sortedByConv.length - 1];
                const sameDay = best.date === worst.date;
                const bestConv = Number(best.conversions || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
                const worstConv = Number(worst.conversions || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
                return (
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Card variant="outlined" sx={{ borderLeft: '4px solid #10b981', height: '100%' }}>
                        <CardContent sx={{ py: 1.8, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp sx={{ color: '#10b981', fontSize: 24 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                              Best Day
                            </Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#10b981', lineHeight: 1.1 }}>
                              {best.dateLabel}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                              {bestConv} conversions (₹{Number(best.cost || 0).toLocaleString('en-IN')} spent{best.cpl > 0 ? ` · ₹${best.cpl.toLocaleString('en-IN')} CPL` : ''})
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Card variant="outlined" sx={{ borderLeft: '4px solid #ef4444', height: '100%' }}>
                        <CardContent sx={{ py: 1.8, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#ef444415', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingDown sx={{ color: '#ef4444', fontSize: 24 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                              Quietest Day
                            </Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: '#ef4444', lineHeight: 1.1 }}>
                              {worst.dateLabel}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                              {sameDay
                                ? 'Only day with activity in the range'
                                : `${worstConv} conversions (₹${Number(worst.cost || 0).toLocaleString('en-IN')} spent${worst.cpl > 0 ? ` · ₹${worst.cpl.toLocaleString('en-IN')} CPL` : ''})`}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                );
              })()}

              {/* Daily Trends / Date-wise Table — gated by shared
                  loading and empty states so both tabs benefit from
                  the same skeleton and "no data" fallback. */}
              {googleLoading && !hasData ? (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.6, py: 2, borderRadius: 1.5,
                  bgcolor: CREAM_C, border: `1px dashed ${BORDER_C}`,
                }}>
                  <CircularProgress size={18} sx={{ color: GOOGLE_GREEN }} />
                  <Typography sx={{ fontSize: '0.85rem', color: `${BROWN_C}AA`, fontWeight: 500 }}>
                    Fetching {selectedClientName}'s Google Ads data…
                  </Typography>
                </Box>
              ) : !hasData ? (
                <Box sx={{
                  textAlign: 'center', py: 5, px: 2,
                  bgcolor: CREAM_C, borderRadius: 1.5, border: `1px dashed ${BORDER_C}`,
                }}>
                  <Typography sx={{ fontWeight: 700, color: BROWN_C, mb: 0.4 }}>
                    No Google Ads data for this range
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: `${BROWN_C}88` }}>
                    Either this client isn't linked to Google Ads, or there was no ad activity between {fromDate ? fmtDDMMYYYY(fromDate) : '—'} and {toDate ? fmtDDMMYYYY(toDate) : '—'}.
                  </Typography>
                </Box>
              ) : (
                <>
                    {/* Two-tab strip — Daily Trends + Date-wise Table. */}
                    <Card variant="outlined" sx={{ mb: 2, borderColor: `${GOOGLE_GREEN}33` }}>
                      <Tabs
                        value={googleChartTab}
                        onChange={(_, v) => setGoogleChartTab(v)}
                        sx={{
                          px: 2,
                          '& .MuiTabs-indicator': { bgcolor: GOOGLE_GREEN, height: 3 },
                          '& .Mui-selected': { color: `${GOOGLE_GREEN} !important` },
                        }}
                      >
                        <Tab label="Daily Trends" sx={{ textTransform: 'none', fontWeight: 700 }} />
                        <Tab label="Date-wise Table" sx={{ textTransform: 'none', fontWeight: 700 }} />
                      </Tabs>
                    </Card>

                    {/* Tab 0 — Daily Trends (existing line chart) */}
                    {googleChartTab === 0 && (
                      <Box sx={{ width: '100%', height: 320, bgcolor: '#fff', borderRadius: 1.5, border: `1px solid ${BORDER_C}`, p: 1.5 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={daily}
                            margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={`${BROWN_C}18`} vertical={false} />
                            <XAxis
                              dataKey="dateLabel"
                              stroke={`${BROWN_C}88`}
                              tick={{ fill: `${BROWN_C}CC`, fontSize: 11 }}
                              interval="preserveStartEnd"
                              minTickGap={20}
                            />
                            <YAxis
                              stroke={`${BROWN_C}88`}
                              tick={{ fill: `${BROWN_C}CC`, fontSize: 11 }}
                              tickFormatter={(v) => (
                                active.isCurrency
                                  ? `₹${(v/1000).toFixed(v >= 100000 ? 0 : 1)}k`
                                  : v.toLocaleString('en-IN')
                              )}
                            />
                            <Tooltip
                              formatter={(v) => [fmt(v), active.label]}
                              contentStyle={{
                                background: '#fff',
                                border: `1px solid ${BORDER_C}`,
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              cursor={{ stroke: `${active.color}88`, strokeDasharray: '3 3' }}
                            />
                            <Line
                              type="monotone"
                              dataKey={active.key}
                              stroke={active.color}
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: active.color, strokeWidth: 0 }}
                              activeDot={{ r: 6, fill: active.color, stroke: '#fff', strokeWidth: 2 }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    )}

                    {/* Tab 1 — Date-wise Table (every day + change) */}
                    {googleChartTab === 1 && (
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420, overflow: 'auto' }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              {['Date', 'Cost', 'Clicks', 'Impressions', 'Conversions', 'CPL'].map((h) => (
                                <TableCell
                                  key={h}
                                  align={h === 'Date' ? 'left' : 'right'}
                                  sx={{
                                    bgcolor: CREAM_C, color: BROWN_C,
                                    fontWeight: 800, fontSize: '0.68rem',
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    borderBottom: `2px solid ${BORDER_C}`,
                                  }}
                                >
                                  {h}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {daily.map((r) => (
                              <TableRow key={r.date} hover>
                                <TableCell sx={{ fontWeight: 700, color: BROWN_C, fontSize: '0.82rem' }}>
                                  {r.dateLabel}
                                </TableCell>
                                <TableCell align="right" sx={{ color: GOOGLE_GREEN, fontWeight: 700, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                  ₹{r.cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="right" sx={{ color: BROWN_C, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                  {r.clicks.toLocaleString('en-IN')}
                                </TableCell>
                                <TableCell align="right" sx={{ color: BROWN_C, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                  {r.impressions.toLocaleString('en-IN')}
                                </TableCell>
                                <TableCell align="right" sx={{ color: BROWN_C, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                  {r.conversions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="right" sx={{ color: r.cpl > 0 ? '#EA4335' : `${BROWN_C}55`, fontWeight: 700, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                  {r.cpl > 0 ? `₹${r.cpl.toLocaleString('en-IN')}` : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Totals footer row */}
                            <TableRow sx={{ '& td': { borderTop: `2px solid ${BORDER_C}` } }}>
                              <TableCell sx={{ fontWeight: 800, color: BROWN_C, fontSize: '0.82rem' }}>
                                TOTAL
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: GOOGLE_GREEN, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                ₹{daily.reduce((s, d) => s + d.cost, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: BROWN_C, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                {daily.reduce((s, d) => s + d.clicks, 0).toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: BROWN_C, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                {daily.reduce((s, d) => s + d.impressions, 0).toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: BROWN_C, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                {daily.reduce((s, d) => s + d.conversions, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: '#EA4335', fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                                ₹{cpl.toLocaleString('en-IN')}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })()}

        </>
      )}
    </Box>
    </LocalizationProvider>
  );
};

export default Reports;
