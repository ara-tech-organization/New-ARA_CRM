import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Avatar, Button,
  TextField, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, InputAdornment, CircularProgress, Alert, Paper,
  Tabs, Tab,
} from '@mui/material';
import {
  Google as GoogleIcon, Facebook as FacebookIcon, Search as SearchIcon,
  TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon, ShowChart as ShowChartIcon,
  Warning as WarningIcon, AccountBalanceWallet as WalletIcon,
  Refresh as RefreshIcon, Circle as CircleIcon, Campaign as CampaignIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { format as fmtDateFn, parseISO, isValid as isValidDate } from 'date-fns';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const GOOGLE_GREEN = '#34a853';
const META_BLUE = '#1877f2';

const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtINR2 = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n ?? 0).toFixed(2)}%`;

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  // Prefer the full account name stored on the data point over the truncated X-axis label
  const title = payload[0]?.payload?.fullName || label;
  return (
    <Box sx={{ bgcolor: 'rgba(255,255,255,0.96)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2, px: 1.5, py: 1, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxWidth: 320 }}>
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, mb: 0.5, color: COPPER, wordBreak: 'break-word' }}>{title}</Typography>
      {payload.map((e, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}>
          <CircleIcon sx={{ fontSize: 7, color: e.color }} />
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{e.name}:</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
            {e.name?.toLowerCase().includes('spend') || e.name?.toLowerCase().includes('cost')
              ? fmtINR(e.value)
              : fmtNum(e.value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// KPI card with optional trend
const KpiCard = ({ label, value, color, icon, sublabel }) => (
  <Card variant="outlined" sx={{ borderLeft: `3px solid ${color}`, height: '100%' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon, { sx: { color, fontSize: 22 } })}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', color, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
        {sublabel && <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{sublabel}</Typography>}
      </Box>
    </CardContent>
  </Card>
);

const AdsDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0); // 0 = Google, 1 = Meta
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Meta multi-client comparison state — backend route uses
  // ?from=YYYY-MM-DD&to=YYYY-MM-DD (different param names than Google's
  // /analytics/clients which uses start_date/end_date — kept consistent
  // with the existing /api/meta/client/:id/analytics endpoint).
  const [metaClients, setMetaClients] = useState([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/analytics/clients', {
        params: { start_date: dateFrom, end_date: dateTo },
      });
      const data = res.data?.clients || res.data?.data || res.data || [];
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch ads analytics:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to fetch Google Ads data');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetaAnalytics = async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const res = await api.get('/meta/clients', {
        params: { from: dateFrom, to: dateTo },
      });
      const data = res.data?.clients || res.data?.data || res.data || [];
      setMetaClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch Meta ads analytics:', err);
      setMetaError(err.response?.data?.error || err.response?.data?.message || 'Failed to fetch Meta Ads data');
      setMetaClients([]);
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchMetaAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  // Filter by search
  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.clientName?.toLowerCase().includes(q) ||
      c.googleAdsAccountName?.toLowerCase().includes(q) ||
      c.googleAdsCustomerId?.includes(q)
    );
  }, [clients, searchQuery]);

  // Meta-side equivalent — match against client name, ad account name,
  // ad account ID, and the page name shown in the table.
  const filteredMetaClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return metaClients;
    return metaClients.filter(c =>
      c.clientName?.toLowerCase().includes(q) ||
      c.metaAccountName?.toLowerCase().includes(q) ||
      c.metaAdAccountId?.toLowerCase().includes(q) ||
      c.pageName?.toLowerCase().includes(q)
    );
  }, [metaClients, searchQuery]);


  // Grand totals
  const totals = useMemo(() => {
    const t = { impressions: 0, clicks: 0, cost: 0, conversions: 0, fund: 0, availableBalance: 0, budget: 0 };
    filteredClients.forEach(c => {
      t.impressions += c.totalImpressions || 0;
      t.clicks += c.totalClicks || 0;
      t.cost += c.totalCost || 0;
      t.conversions += c.totalConversions || 0;
      t.fund += c.fund || 0;
      t.availableBalance += c.availableBalance || 0;
      t.budget += c.totalBudget || 0;
    });
    t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    t.cpc = t.clicks > 0 ? t.cost / t.clicks : 0;
    t.cpl = t.conversions > 0 ? t.cost / t.conversions : 0;
    return t;
  }, [filteredClients]);

  // Chart data — clients sorted by cost
  const topByCost = useMemo(() =>
    [...filteredClients]
      .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
      .slice(0, 10)
      .map(c => {
        const full = c.googleAdsAccountName || c.clientName || '—';
        const short = full.length > 22 ? full.substring(0, 22) + '…' : full;
        return {
          name: short,
          fullName: full,
          cost: c.totalCost || 0,
          clicks: c.totalClicks || 0,
          impressions: c.totalImpressions || 0,
        };
      }),
  [filteredClients]);

  // Balance distribution (pie)
  const balancePie = useMemo(() => {
    const spent = totals.cost;
    const remaining = Math.max(totals.availableBalance - spent, 0);
    return [
      { name: 'Spent', value: spent, color: GOOGLE_GREEN },
      { name: 'Available', value: remaining, color: COPPER },
    ].filter(x => x.value > 0);
  }, [totals]);

  // Click types aggregation
  const clickTypesAgg = useMemo(() => {
    const agg = {};
    filteredClients.forEach(c => {
      if (c.clickTypes && typeof c.clickTypes === 'object') {
        Object.entries(c.clickTypes).forEach(([k, v]) => {
          agg[k] = (agg[k] || 0) + (Number(v) || 0);
        });
      }
    });
    return Object.entries(agg)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }));
  }, [filteredClients]);

  const currentColor = tab === 0 ? GOOGLE_GREEN : META_BLUE;
  const currentIcon = tab === 0 ? <GoogleIcon sx={{ fontSize: 28, color: GOOGLE_GREEN }} /> : <FacebookIcon sx={{ fontSize: 28, color: META_BLUE }} />;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {currentIcon}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{tab === 0 ? 'Google Ads Dashboard' : 'Meta Ads Dashboard'}</Typography>
            <Typography variant="body2" color="text.secondary">
              Performance analytics across all linked client accounts
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={(tab === 0 ? loading : metaLoading) ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={tab === 0 ? fetchAnalytics : fetchMetaAnalytics}
          disabled={tab === 0 ? loading : metaLoading}
        >
          {(tab === 0 ? loading : metaLoading) ? 'Loading...' : 'Refresh'}
        </Button>
      </Box>

      {/* Platform Tabs */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          sx={{
            px: 2,
            '& .MuiTabs-indicator': { bgcolor: currentColor, height: 3 },
            '& .Mui-selected': { color: `${currentColor} !important` },
          }}
        >
          <Tab icon={<GoogleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Google Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab icon={<FacebookIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Meta Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
        </Tabs>
      </Card>

      {/* GOOGLE ADS TAB */}
      {tab === 0 && (<>

      {/* Date filter */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
          <DatePicker
            label="From"
            value={dateFrom ? parseISO(dateFrom) : null}
            onChange={(d) => { if (d && isValidDate(d)) setDateFrom(fmtDateFn(d, 'yyyy-MM-dd')); }}
            format="dd/MM/yyyy"
            slotProps={{ textField: { size: 'small', placeholder: 'DD/MM/YYYY', sx: { minWidth: 160 } } }}
          />
          <DatePicker
            label="To"
            value={dateTo ? parseISO(dateTo) : null}
            onChange={(d) => { if (d && isValidDate(d)) setDateTo(fmtDateFn(d, 'yyyy-MM-dd')); }}
            format="dd/MM/yyyy"
            slotProps={{ textField: { size: 'small', placeholder: 'DD/MM/YYYY', sx: { minWidth: 160 } } }}
          />
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <Button size="small" variant="outlined" onClick={() => { const d = new Date().toISOString().split('T')[0]; setDateFrom(d); setDateTo(d); }}>Today</Button>
            <Button size="small" variant="outlined" onClick={() => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 6); setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]); }}>Last 7 Days</Button>
            <Button size="small" variant="outlined" onClick={() => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29); setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]); }}>Last 30 Days</Button>
            <Button size="small" variant="outlined" onClick={() => { const to = new Date(); const from = new Date(to.getFullYear(), to.getMonth(), 1); setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]); }}>This Month</Button>
          </Box>
          <TextField
            size="small" placeholder="Search account..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 220, ml: 'auto' }}
          />
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && clients.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress sx={{ color: GOOGLE_GREEN }} />
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading Google Ads data...</Typography>
        </Box>
      ) : filteredClients.length === 0 ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <GoogleIcon sx={{ fontSize: 48, color: COPPER, mb: 1 }} />
            <Typography sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>No Linked Accounts</Typography>
            <Typography variant="body2" color="text.secondary">
              No clients are linked to Google Ads yet. Open a client from the Dashboard to link their account.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Accounts Table */}
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.92rem' }}>All Linked Accounts</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Click a row to view detailed analytics</Typography>
                </Box>
                <Chip label={`${filteredClients.length} account${filteredClients.length !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: `${COPPER}15`, color: COPPER, fontWeight: 600 }} />
              </Box>

              <TableContainer>
                <Table size="small" sx={{ minWidth: 1200 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Account</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Customer ID</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Budget</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Fund</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Available</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Impressions</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Clicks</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">CTR</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">CPC</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Cost</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Conversions</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">CPL</TableCell>
                      <TableCell sx={{ bgcolor: `${GOOGLE_GREEN}10` }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredClients.map((c) => {
                      const utilization = c.totalBudget > 0 ? (c.totalCost / c.totalBudget) * 100 : 0;
                      return (
                        <TableRow
                          key={c.clientId}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/client-ads/${c.clientId}`)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', fontWeight: 700, bgcolor: COPPER }}>
                                {c.googleAdsAccountName?.charAt(0) || c.clientName?.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.googleAdsAccountName || c.clientName}</Typography>
                                {c.googleAdsAccountName && c.clientName !== c.googleAdsAccountName && (
                                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{c.clientName}</Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'text.secondary' }}>{c.googleAdsCustomerId}</TableCell>
                          <TableCell align="right">{fmtINR(c.totalBudget)}</TableCell>
                          <TableCell align="right">{fmtINR(c.fund)}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                              {c.availableBalance < 100 && <WarningIcon sx={{ fontSize: 14, color: '#ef4444' }} />}
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: c.availableBalance < 100 ? '#ef4444' : '#10b981' }}>
                                {fmtINR(c.availableBalance)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">{fmtNum(c.totalImpressions)}</TableCell>
                          <TableCell align="right">{fmtNum(c.totalClicks)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: BROWN }}>{fmtPct(c.ctr)}</TableCell>
                          <TableCell align="right">{fmtINR2(c.cpc)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: GOOGLE_GREEN }}>{fmtINR(c.totalCost)}</TableCell>
                          <TableCell align="right">{fmtNum(c.totalConversions)}</TableCell>
                          <TableCell align="right">
                            {c.cpl > 0 ? (
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: c.cpl > 500 ? '#ef4444' : '#10b981' }}>
                                {fmtINR(c.cpl)}
                              </Typography>
                            ) : '—'}
                          </TableCell>
                          <TableCell align="right">
                            <OpenInNewIcon sx={{ fontSize: 16, color: COPPER }} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Utilization bars below table for visual */}
              {filteredClients.length <= 8 && (
                <Box sx={{ mt: 3 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1.5, borderLeft: `3px solid ${COPPER}`, pl: 1.5 }}>
                    Budget Utilization per Account
                  </Typography>
                  <Grid container spacing={1.5}>
                    {filteredClients.map((c) => {
                      const pct = c.totalBudget > 0 ? Math.min((c.totalCost / c.totalBudget) * 100, 100) : 0;
                      return (
                        <Grid key={c.clientId} size={{ xs: 12, md: 6 }}>
                          <Paper variant="outlined" sx={{ p: 1.2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.googleAdsAccountName || c.clientName}</Typography>
                              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: pct > 90 ? '#ef4444' : GOOGLE_GREEN }}>
                                {fmtINR(c.totalCost)} / {fmtINR(c.totalBudget)}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{ height: 8, borderRadius: 4, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: pct > 90 ? '#ef4444' : GOOGLE_GREEN, borderRadius: 4 } }}
                            />
                            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.3 }}>{pct.toFixed(0)}% utilized</Typography>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      </>)}

      {/* META ADS TAB */}
      {tab === 1 && (
        <>
          {metaError && <Alert severity="error" sx={{ mb: 2 }}>{metaError}</Alert>}

          {/* Date filter */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
              <DatePicker
                label="From"
                value={dateFrom ? parseISO(dateFrom) : null}
                onChange={(d) => { if (d && isValidDate(d)) setDateFrom(fmtDateFn(d, 'yyyy-MM-dd')); }}
                format="dd/MM/yyyy"
                slotProps={{ textField: { size: 'small', placeholder: 'DD/MM/YYYY', sx: { minWidth: 160 } } }}
              />
              <DatePicker
                label="To"
                value={dateTo ? parseISO(dateTo) : null}
                onChange={(d) => { if (d && isValidDate(d)) setDateTo(fmtDateFn(d, 'yyyy-MM-dd')); }}
                format="dd/MM/yyyy"
                slotProps={{ textField: { size: 'small', placeholder: 'DD/MM/YYYY', sx: { minWidth: 160 } } }}
              />
              <Box sx={{ display: 'flex', gap: 0.8 }}>
                <Button size="small" variant="outlined" onClick={() => { const d = new Date().toISOString().split('T')[0]; setDateFrom(d); setDateTo(d); }}>Today</Button>
                <Button size="small" variant="outlined" onClick={() => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 6); setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]); }}>Last 7 Days</Button>
                <Button size="small" variant="outlined" onClick={() => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29); setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]); }}>Last 30 Days</Button>
              </Box>
              <TextField
                size="small" placeholder="Search account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ minWidth: 220, ml: 'auto' }}
              />
            </CardContent>
          </Card>

          {metaLoading && metaClients.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <CircularProgress sx={{ color: META_BLUE }} />
              <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading Meta Ads data...</Typography>
            </Box>
          ) : filteredMetaClients.length === 0 ? (
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <FacebookIcon sx={{ fontSize: 48, color: META_BLUE, mb: 1 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>No Linked Meta Accounts</Typography>
                <Typography variant="body2" color="text.secondary">
                  No clients are linked to Meta Ads yet. Open a client from the Dashboard and click the Facebook icon to connect.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.92rem' }}>All Linked Meta Accounts</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Click a row to view detailed analytics</Typography>
                  </Box>
                  <Chip label={`${filteredMetaClients.length} account${filteredMetaClients.length !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: `${META_BLUE}15`, color: META_BLUE, fontWeight: 600 }} />
                </Box>

                <TableContainer>
                  <Table size="small" sx={{ minWidth: 1300 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Account</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Ad Account ID</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Budget</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Spend</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Available</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Reach</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Impressions</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Frequency</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Clicks</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">CTR</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">CPC</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">CPM</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Leads</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">CPL</TableCell>
                        <TableCell sx={{ bgcolor: `${META_BLUE}10` }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredMetaClients.map((c) => (
                        <TableRow
                          key={c.clientId}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/client-ads/${c.clientId}`)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', fontWeight: 700, bgcolor: META_BLUE }}>
                                {c.metaAccountName?.charAt(0) || c.clientName?.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.metaAccountName || c.clientName}</Typography>
                                {c.pageName && (
                                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{c.pageName}</Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'text.secondary' }}>{c.metaAdAccountId}</TableCell>
                          <TableCell align="right">{fmtINR(c.totalBudget)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: META_BLUE }}>{fmtINR(c.spend)}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                              {c.availableBalance < 100 && <WarningIcon sx={{ fontSize: 14, color: '#ef4444' }} />}
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: c.availableBalance < 100 ? '#ef4444' : '#10b981' }}>
                                {fmtINR(c.availableBalance)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">{fmtNum(c.reach)}</TableCell>
                          <TableCell align="right">{fmtNum(c.impressions)}</TableCell>
                          <TableCell align="right">{c.frequency != null ? Number(c.frequency).toFixed(2) : '—'}</TableCell>
                          <TableCell align="right">{fmtNum(c.clicks)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: BROWN }}>{fmtPct(c.ctr)}</TableCell>
                          <TableCell align="right">{fmtINR2(c.cpc)}</TableCell>
                          <TableCell align="right">{fmtINR(c.cpm)}</TableCell>
                          <TableCell align="right">{fmtNum(c.leads)}</TableCell>
                          <TableCell align="right">
                            {c.cpl > 0 ? (
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: c.cpl > 500 ? '#ef4444' : '#10b981' }}>
                                {fmtINR(c.cpl)}
                              </Typography>
                            ) : '—'}
                          </TableCell>
                          <TableCell align="right">
                            <OpenInNewIcon sx={{ fontSize: 16, color: META_BLUE }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
    </LocalizationProvider>
  );
};

export default AdsDashboard;
