import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Avatar, Button,
  TextField, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, InputAdornment, CircularProgress, Alert, Paper,
  Tabs, Tab,
  Tooltip as MuiTooltip,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  Google as GoogleIcon, Facebook as FacebookIcon, Search as SearchIcon,
  TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon, ShowChart as ShowChartIcon,
  Warning as WarningIcon, AccountBalanceWallet as WalletIcon,
  Refresh as RefreshIcon, Circle as CircleIcon, Campaign as CampaignIcon,
  OpenInNew as OpenInNewIcon,
  EmojiEvents as TrophyIcon, Savings as SavingsIcon,
  ReportProblem as ReportProblemIcon, Bolt as BoltIcon,
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

  // ── Comparison Spotlights ─────────────────────────────────────
  // Surface the "winners" and "concerns" in the current client list
  // so users can compare at a glance without scanning every row.
  // Each entry derives from filteredClients (Google) / filteredMetaClients (Meta).
  const googleSpotlights = useMemo(() => {
    const withCost = filteredClients.filter((c) => Number(c.totalCost) > 0);
    const withLeads = filteredClients.filter((c) => Number(c.totalConversions) > 0);
    const cpl = (c) => (Number(c.totalConversions) > 0 ? Number(c.totalCost) / Number(c.totalConversions) : 0);
    return {
      topSpender: [...withCost].sort((a, b) => (Number(b.totalCost) || 0) - (Number(a.totalCost) || 0))[0],
      topLeads: [...withLeads].sort((a, b) => (Number(b.totalConversions) || 0) - (Number(a.totalConversions) || 0))[0],
      bestCpl: [...withLeads].filter((c) => cpl(c) > 0).sort((a, b) => cpl(a) - cpl(b))[0],
      worstCpl: [...withLeads].filter((c) => cpl(c) > 0).sort((a, b) => cpl(b) - cpl(a))[0],
    };
  }, [filteredClients]);
  const metaSpotlights = useMemo(() => {
    const withSpend = filteredMetaClients.filter((c) => Number(c.spend) > 0);
    const withLeads = filteredMetaClients.filter((c) => Number(c.leads) > 0);
    const cpl = (c) => (Number(c.leads) > 0 ? Number(c.spend) / Number(c.leads) : 0);
    return {
      topSpender: [...withSpend].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0))[0],
      topLeads: [...withLeads].sort((a, b) => (Number(b.leads) || 0) - (Number(a.leads) || 0))[0],
      bestCpl: [...withLeads].filter((c) => cpl(c) > 0).sort((a, b) => cpl(a) - cpl(b))[0],
      worstCpl: [...withLeads].filter((c) => cpl(c) > 0).sort((a, b) => cpl(b) - cpl(a))[0],
    };
  }, [filteredMetaClients]);

  // Best/worst CPL ids — used to colour-code the table rows so the
  // user spots the extremes at a glance without sorting.
  const googleBestCplId = googleSpotlights.bestCpl?.clientId;
  const googleWorstCplId = googleSpotlights.worstCpl?.clientId;
  const metaBestCplId = metaSpotlights.bestCpl?.clientId;
  const metaWorstCplId = metaSpotlights.worstCpl?.clientId;

  // Sort state — single source for the table's order. Defaults rank
  // clients by cost (highest first) so the spend leaderboard reads
  // top-down on load.
  const [googleSortKey, setGoogleSortKey] = useState('totalCost');
  const [metaSortKey, setMetaSortKey] = useState('spend');

  const sortedGoogleClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      if (googleSortKey === 'cpl') {
        const cplA = a.totalConversions > 0 ? a.totalCost / a.totalConversions : Infinity;
        const cplB = b.totalConversions > 0 ? b.totalCost / b.totalConversions : Infinity;
        return cplA - cplB;
      }
      const av = Number(a[googleSortKey]) || 0;
      const bv = Number(b[googleSortKey]) || 0;
      return bv - av;
    });
  }, [filteredClients, googleSortKey]);

  const sortedMetaClients = useMemo(() => {
    return [...filteredMetaClients].sort((a, b) => {
      if (metaSortKey === 'cpl') {
        const cplA = a.leads > 0 ? a.spend / a.leads : Infinity;
        const cplB = b.leads > 0 ? b.spend / b.leads : Infinity;
        return cplA - cplB;
      }
      const av = Number(a[metaSortKey]) || 0;
      const bv = Number(b[metaSortKey]) || 0;
      return bv - av;
    });
  }, [filteredMetaClients, metaSortKey]);

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
        <MuiTooltip arrow title="Re-fetch the active platform's data">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={(tab === 0 ? loading : metaLoading) ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={tab === 0 ? fetchAnalytics : fetchMetaAnalytics}
              disabled={tab === 0 ? loading : metaLoading}
            >
              {(tab === 0 ? loading : metaLoading) ? 'Loading...' : 'Refresh'}
            </Button>
          </span>
        </MuiTooltip>
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
          <MuiTooltip arrow title="Compare Google Ads performance across clients">
            <Tab icon={<GoogleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Google Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </MuiTooltip>
          <MuiTooltip arrow title="Compare Meta (Facebook + Instagram) performance across clients">
            <Tab icon={<FacebookIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Meta Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </MuiTooltip>
        </Tabs>
      </Card>

      {/* GOOGLE ADS TAB */}
      {tab === 0 && (<>

      {/* Date filter */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
          <MuiTooltip arrow title="Start of the date range">
            <Box>
              <DatePicker
                label="From"
                value={dateFrom ? parseISO(dateFrom) : null}
                onChange={(d) => { if (d && isValidDate(d)) setDateFrom(fmtDateFn(d, 'yyyy-MM-dd')); }}
                format="dd/MM/yyyy"
                slotProps={{ textField: { size: 'small', placeholder: 'DD/MM/YYYY', sx: { minWidth: 160 } } }}
              />
            </Box>
          </MuiTooltip>
          <MuiTooltip arrow title="End of the date range">
            <Box>
              <DatePicker
                label="To"
                value={dateTo ? parseISO(dateTo) : null}
                onChange={(d) => { if (d && isValidDate(d)) setDateTo(fmtDateFn(d, 'yyyy-MM-dd')); }}
                format="dd/MM/yyyy"
                slotProps={{ textField: { size: 'small', placeholder: 'DD/MM/YYYY', sx: { minWidth: 160 } } }}
              />
            </Box>
          </MuiTooltip>
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
          {/* ── Performance Spotlights ─────────────────────────────
              Headline comparison cards — top spender, top leads,
              best CPL (cheapest), worst CPL (most expensive). Each
              card click-jumps to that client's ads detail page so
              users can dig in immediately. */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { key: 'spender', label: 'Top Spender', tip: 'Client with the highest ad spend in the range', client: googleSpotlights.topSpender, color: GOOGLE_GREEN, icon: <MoneyIcon />, metric: googleSpotlights.topSpender ? fmtINR(googleSpotlights.topSpender.totalCost) : '—', sub: 'spent' },
              { key: 'leads', label: 'Top Lead Generator', tip: 'Client converting the most leads', client: googleSpotlights.topLeads, color: '#10b981', icon: <BoltIcon />, metric: googleSpotlights.topLeads ? fmtNum(googleSpotlights.topLeads.totalConversions) : '—', sub: 'leads' },
              { key: 'bestCpl', label: 'Best CPL', tip: 'Client paying the least per lead', client: googleSpotlights.bestCpl, color: '#0e7c4a', icon: <SavingsIcon />, metric: googleSpotlights.bestCpl ? fmtINR(googleSpotlights.bestCpl.totalCost / googleSpotlights.bestCpl.totalConversions) : '—', sub: 'per lead' },
              { key: 'worstCpl', label: 'Worst CPL', tip: 'Client paying the most per lead — needs review', client: googleSpotlights.worstCpl, color: '#ef4444', icon: <ReportProblemIcon />, metric: googleSpotlights.worstCpl ? fmtINR(googleSpotlights.worstCpl.totalCost / googleSpotlights.worstCpl.totalConversions) : '—', sub: 'per lead' },
            ].map((s) => (
              <Grid key={s.key} size={{ xs: 6, md: 3 }}>
                <MuiTooltip arrow title={s.tip}>
                  <Card
                    variant="outlined"
                    onClick={() => s.client && navigate(`/client-ads/${s.client.clientId}`)}
                    sx={{
                      height: '100%', borderLeft: `4px solid ${s.color}`,
                      cursor: s.client ? 'pointer' : 'default',
                      opacity: s.client ? 1 : 0.6,
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      '&:hover': s.client ? { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' } : {},
                    }}
                  >
                    <CardContent sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${s.color}15`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {React.cloneElement(s.icon, { sx: { fontSize: 18 } })}
                        </Box>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</Typography>
                      </Box>
                      {s.client ? (
                        <>
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.client.googleAdsAccountName || s.client.clientName}>
                            {s.client.googleAdsAccountName || s.client.clientName}
                          </Typography>
                          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: s.color, lineHeight: 1.1, mt: 0.3 }}>
                            {s.metric} <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 600 }}>{s.sub}</Typography>
                          </Typography>
                        </>
                      ) : (
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>No data</Typography>
                      )}
                    </CardContent>
                  </Card>
                </MuiTooltip>
              </Grid>
            ))}
          </Grid>

          {/* Accounts Table */}
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.92rem' }}>All Linked Accounts</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Click a row to view detailed analytics</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                  <MuiTooltip arrow title="Re-rank the table by a chosen metric">
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel id="g-sort">Sort by</InputLabel>
                      <Select labelId="g-sort" label="Sort by" value={googleSortKey} onChange={(e) => setGoogleSortKey(e.target.value)}>
                        <MenuItem value="totalCost">Highest Spend</MenuItem>
                        <MenuItem value="totalConversions">Most Leads</MenuItem>
                        <MenuItem value="totalClicks">Most Clicks</MenuItem>
                        <MenuItem value="totalImpressions">Most Impressions</MenuItem>
                        <MenuItem value="cpl">Lowest CPL</MenuItem>
                      </Select>
                    </FormControl>
                  </MuiTooltip>
                  <Chip label={`${filteredClients.length} account${filteredClients.length !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: `${COPPER}15`, color: COPPER, fontWeight: 600 }} />
                </Box>
              </Box>

              <TableContainer>
                <Table size="small" sx={{ minWidth: 1200 }}>
                  <TableHead>
                    <TableRow>
                      <MuiTooltip arrow title="Client / ad account name"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }}>Account</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Google Ads Customer ID"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }}>Customer ID</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Account-level budget set in Google Ads"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">Budget</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Total funds loaded to date"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">Fund</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Remaining balance to spend"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">Available</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Times the ads were shown"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">Impressions</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Total ad clicks received"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">Clicks</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Click-through rate = clicks ÷ impressions"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">CTR</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Cost per click = cost ÷ clicks"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">CPC</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Total ad spend in the range"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">Cost</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Conversions reported by Google Ads"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">Conversions</TableCell></MuiTooltip>
                      <MuiTooltip arrow title="Cost per lead = cost ÷ conversions"><TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, cursor: 'help' }} align="right">CPL</TableCell></MuiTooltip>
                      <TableCell sx={{ bgcolor: `${GOOGLE_GREEN}10` }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedGoogleClients.map((c) => {
                      const utilization = c.totalBudget > 0 ? (c.totalCost / c.totalBudget) * 100 : 0;
                      // Tint rows for the cheapest / most expensive CPL
                      // so the extremes pop while scanning.
                      const isBest = c.clientId === googleBestCplId;
                      const isWorst = c.clientId === googleWorstCplId;
                      const rowTint = isBest
                        ? { bgcolor: '#10b98108', borderLeft: '3px solid #10b981' }
                        : isWorst
                          ? { bgcolor: '#ef444408', borderLeft: '3px solid #ef4444' }
                          : {};
                      return (
                        <TableRow
                          key={c.clientId}
                          hover
                          sx={{ cursor: 'pointer', ...rowTint }}
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
            <>
            {/* ── Meta Performance Spotlights ─────────────────────
                Same comparison cards as Google — top spender, top
                lead generator, best/worst CPL across the Meta-linked
                client list. */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                { key: 'spender', label: 'Top Spender', tip: 'Client with the highest Meta ad spend', client: metaSpotlights.topSpender, color: META_BLUE, icon: <MoneyIcon />, metric: metaSpotlights.topSpender ? fmtINR(metaSpotlights.topSpender.spend) : '—', sub: 'spent' },
                { key: 'leads', label: 'Top Lead Generator', tip: 'Client generating the most Meta leads', client: metaSpotlights.topLeads, color: '#10b981', icon: <BoltIcon />, metric: metaSpotlights.topLeads ? fmtNum(metaSpotlights.topLeads.leads) : '—', sub: 'leads' },
                { key: 'bestCpl', label: 'Best CPL', tip: 'Client paying the least per Meta lead', client: metaSpotlights.bestCpl, color: '#0e7c4a', icon: <SavingsIcon />, metric: metaSpotlights.bestCpl ? fmtINR(metaSpotlights.bestCpl.spend / metaSpotlights.bestCpl.leads) : '—', sub: 'per lead' },
                { key: 'worstCpl', label: 'Worst CPL', tip: 'Client paying the most per Meta lead — needs review', client: metaSpotlights.worstCpl, color: '#ef4444', icon: <ReportProblemIcon />, metric: metaSpotlights.worstCpl ? fmtINR(metaSpotlights.worstCpl.spend / metaSpotlights.worstCpl.leads) : '—', sub: 'per lead' },
              ].map((s) => (
                <Grid key={s.key} size={{ xs: 6, md: 3 }}>
                  <MuiTooltip arrow title={s.tip}>
                    <Card
                      variant="outlined"
                      onClick={() => s.client && navigate(`/client-ads/${s.client.clientId}`)}
                      sx={{
                        height: '100%', borderLeft: `4px solid ${s.color}`,
                        cursor: s.client ? 'pointer' : 'default',
                        opacity: s.client ? 1 : 0.6,
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        '&:hover': s.client ? { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' } : {},
                      }}
                    >
                      <CardContent sx={{ py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${s.color}15`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {React.cloneElement(s.icon, { sx: { fontSize: 18 } })}
                          </Box>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</Typography>
                        </Box>
                        {s.client ? (
                          <>
                            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.client.metaAccountName || s.client.clientName}>
                              {s.client.metaAccountName || s.client.clientName}
                            </Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: s.color, lineHeight: 1.1, mt: 0.3 }}>
                              {s.metric} <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 600 }}>{s.sub}</Typography>
                            </Typography>
                          </>
                        ) : (
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>No data</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </MuiTooltip>
                </Grid>
              ))}
            </Grid>

            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.92rem' }}>All Linked Meta Accounts</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Click a row to view detailed analytics</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                    <MuiTooltip arrow title="Re-rank the table by a chosen metric">
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id="m-sort">Sort by</InputLabel>
                        <Select labelId="m-sort" label="Sort by" value={metaSortKey} onChange={(e) => setMetaSortKey(e.target.value)}>
                          <MenuItem value="spend">Highest Spend</MenuItem>
                          <MenuItem value="leads">Most Leads</MenuItem>
                          <MenuItem value="clicks">Most Clicks</MenuItem>
                          <MenuItem value="reach">Highest Reach</MenuItem>
                          <MenuItem value="impressions">Most Impressions</MenuItem>
                          <MenuItem value="cpl">Lowest CPL</MenuItem>
                        </Select>
                      </FormControl>
                    </MuiTooltip>
                    <Chip label={`${filteredMetaClients.length} account${filteredMetaClients.length !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: `${META_BLUE}15`, color: META_BLUE, fontWeight: 600 }} />
                  </Box>
                </Box>

                <TableContainer>
                  <Table size="small" sx={{ minWidth: 1300 }}>
                    <TableHead>
                      <TableRow>
                        <MuiTooltip arrow title="Client / ad account name"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }}>Account</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Meta Ad Account ID"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }}>Ad Account ID</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Daily / account-level budget set in Meta"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Budget</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Total ad spend in the date range"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Spend</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Remaining ad account balance"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Available</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Unique users the ad reached"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Reach</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Total times the ad was shown"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Impressions</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Avg impressions per unique user"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Frequency</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Total clicks on the ad"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Clicks</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Click-through rate = clicks ÷ impressions"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">CTR</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Cost per click = spend ÷ clicks"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">CPC</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Cost per 1,000 impressions"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">CPM</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Form + WhatsApp leads in the range"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">Leads</TableCell></MuiTooltip>
                        <MuiTooltip arrow title="Cost per lead = spend ÷ leads"><TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, cursor: 'help' }} align="right">CPL</TableCell></MuiTooltip>
                        <TableCell sx={{ bgcolor: `${META_BLUE}10` }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedMetaClients.map((c) => {
                        const isBest = c.clientId === metaBestCplId;
                        const isWorst = c.clientId === metaWorstCplId;
                        const rowTint = isBest
                          ? { bgcolor: '#10b98108', borderLeft: '3px solid #10b981' }
                          : isWorst
                            ? { bgcolor: '#ef444408', borderLeft: '3px solid #ef4444' }
                            : {};
                        return (
                        <TableRow
                          key={c.clientId}
                          hover
                          sx={{ cursor: 'pointer', ...rowTint }}
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
            </>
          )}
        </>
      )}
    </Box>
    </LocalizationProvider>
  );
};

export default AdsDashboard;
