import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button, Avatar,
  TextField, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Alert, IconButton, Collapse,
  Tabs, Tab,
} from '@mui/material';
import {
  Google as GoogleIcon, Facebook as FacebookIcon, Logout as LogoutIcon, Refresh as RefreshIcon,
  ShowChart as ShowChartIcon, TrendingUp as TrendingUpIcon,
  AccountBalanceWallet as WalletIcon, AttachMoney as MoneyIcon,
  Campaign as CampaignIcon, Warning as WarningIcon,
  KeyboardArrowDown as ArrowDownIcon, KeyboardArrowUp as ArrowUpIcon,
  People as PeopleIcon, Visibility as VisibilityIcon,
  Groups as GroupsIcon, Chat as ChatIcon,
  FileDownload as FileDownloadIcon, PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { exportLeadsToExcel, exportLeadsToPdf } from '../utils/metaLeadsExport';
import MetaLeadsTable from '../components/MetaLeadsTable';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const CREAM = '#FFF8F0';
const GOOGLE_GREEN = '#34a853';
const META_BLUE = '#1877f2';

// Match the main CRM axios config: always point at the real backend
// (REACT_APP_API_URL from .env), falling back to the production host.
// Previously this used '/api' in dev mode, which required a proxy that
// doesn't exist — every call 404'd against localhost:3000.
const API_URL = process.env.REACT_APP_API_URL
  || 'https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api';

const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n ?? 0).toFixed(2)}%`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const KpiCard = ({ label, value, color, icon, sublabel }) => (
  <Card variant="outlined" sx={{ borderLeft: `3px solid ${color}`, height: '100%' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon, { sx: { color, fontSize: 20 } })}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color, lineHeight: 1.2 }}>{value}</Typography>
        {sublabel && <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{sublabel}</Typography>}
      </Box>
    </CardContent>
  </Card>
);

const ClientPortalDashboard = () => {
  const navigate = useNavigate();
  const [clientData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('clientData')); } catch { return null; }
  });
  const token = localStorage.getItem('clientToken');

  const [tab, setTab] = useState(0); // 0 = Google, 1 = Meta
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [expandedCampaigns, setExpandedCampaigns] = useState({});
  // Use the raw Meta analytics response directly — mirrors how the admin
  // ClientAdDetails page consumes it (snake_case, no renaming). Keeping
  // shapes identical means the portal and admin stay in sync if the API
  // grows fields.
  const metaData = data?.meta || null;

  const clientApi = useMemo(() => {
    const instance = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });
    instance.interceptors.request.use(config => {
      const t = localStorage.getItem('clientToken');
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    instance.interceptors.response.use(r => r, err => {
      if (err.response?.status === 401) {
        localStorage.removeItem('clientToken');
        localStorage.removeItem('clientData');
        window.location.replace('/client-login');
      }
      return Promise.reject(err);
    });
    return instance;
  }, []);

  useEffect(() => {
    if (!token) { navigate('/client-login'); return; }
  }, [token, navigate]);

  const fetchAnalytics = async () => {
    setLoading(true); setError(null);
    const clientId = clientData?._id;
    // Call both ad platforms DIRECTLY — same way the admin page does —
    // so we use each endpoint's own response as the source of truth for
    // "is this linked?". Skips the backend's internal proxy, which was
    // flaky on Azure (localhost loopback timeouts).
    const [googleRes, metaRes] = await Promise.allSettled([
      clientId
        ? clientApi.get(`/analytics/client/${clientId}`, {
            params: { start_date: dateFrom, end_date: dateTo },
            timeout: 20000,
          })
        : Promise.resolve(null),
      clientId
        ? clientApi.get(`/meta/client/${clientId}/analytics`, {
            params: { from: dateFrom, to: dateTo },
            timeout: 20000,
          })
        : Promise.resolve(null),
    ]);

    try {
      // Google: 200 with data → linked; 400 with "does not have Google Ads enabled" → not linked.
      let googleData = null;
      let googleLinked = false;
      if (googleRes.status === 'fulfilled' && googleRes.value) {
        googleData = googleRes.value.data || null;
        googleLinked = true;
      } else if (googleRes.status === 'rejected' && googleRes.reason?.response?.status === 400) {
        // 400 is the "not linked" signal from /api/analytics/client/:id
        googleLinked = false;
      } else if (googleRes.status === 'rejected') {
        // Network error / timeout / 5xx — treat as unknown, not "not linked"
        googleLinked = clientData?.googleAdsEnabled === true;
      }

      // Meta: the analytics endpoint returns 200 with an empty body even for
      // unlinked clients — so "response arrived" is NOT proof of linkage.
      // Primary signal is `meta_account.id` (set when the live verify against
      // Meta succeeded). Fallback: if the body has actual analytics data
      // (campaigns / leads / summary), treat Meta as linked even if the live
      // verify failed — covers the case where the backend can read the
      // synced DB rows but lacks a Meta access token to re-verify the
      // account live (e.g. running locally against the prod DB).
      const metaData = metaRes.status === 'fulfilled' && metaRes.value ? metaRes.value.data : null;
      const metaAccountVerified = !!(metaData?.meta_account?.id && !metaData.meta_account.error);
      const metaHasData = !!(
        (metaData?.campaigns?.length)
        || (metaData?.leads_in_range?.length)
        || (metaData?.lead_forms?.length)
        || (metaData?.summary && Object.keys(metaData.summary).length > 0)
      );
      const metaLinked = metaAccountVerified || metaHasData;

      const merged = {
        ...(googleData || {
          client: { _id: clientId, clientName: clientData?.clientName || '' },
          summary: {},
          campaignMetrics: [],
          keywords: [],
          dailyMetrics: [],
        }),
        integrations: { google_enabled: googleLinked, meta_enabled: metaLinked },
      };
      if (metaData) merged.meta = metaData;

      setData(merged);

      // Only surface a global error when BOTH direct calls failed with something
      // other than the clean "not linked" signal.
      const googleHardFail = googleRes.status === 'rejected' && googleRes.reason?.response?.status !== 400;
      const metaHardFail = metaRes.status === 'rejected';
      if (googleHardFail && metaHardFail) {
        setError(
          googleRes.reason?.response?.data?.message
          || googleRes.reason?.response?.data?.error
          || googleRes.reason?.message
          || 'Failed to fetch data'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchAnalytics(); }, [dateFrom, dateTo]);

  // Auto-select the tab that has data, once, on first load. If the client
  // has only Meta linked (no Google), jump them straight to the Meta tab
  // instead of making them see the "Google not linked" banner first.
  // If neither is linked, stay on Google so the banner explains why.
  const autoSwitchedRef = useRef(false);
  useEffect(() => {
    if (autoSwitchedRef.current) return;
    if (!data?.integrations) return;
    const { google_enabled, meta_enabled } = data.integrations;
    if (!google_enabled && meta_enabled) setTab(1);
    autoSwitchedRef.current = true;
  }, [data]);

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientData');
    navigate('/client-login');
  };

  const clientInfo = data?.client;
  const summary = data?.summary;
  const billing = data?.client?.billing;
  const campaignMetrics = useMemo(
    () => [...(data?.campaignMetrics || [])].sort((a, b) => (Number(b?.cost) || 0) - (Number(a?.cost) || 0)),
    [data]
  );
  const keywords = data?.keywords || [];
  const dailyMetrics = data?.dailyMetrics || [];
  const displayName = clientData?.clientName || clientInfo?.clientName || 'Client Portal';

  const keywordsByCampaign = useMemo(() => {
    const map = {};
    keywords.forEach(kw => {
      const cid = kw.campaign_id;
      if (!map[cid]) map[cid] = [];
      map[cid].push(kw);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0)));
    return map;
  }, [keywords]);

  // Spike chart data
  const spikeChartData = useMemo(() => {
    const byDate = {};
    dailyMetrics.forEach(d => {
      const dt = d.date;
      if (!byDate[dt]) byDate[dt] = { date: dt, cost: 0, clicks: 0, impressions: 0, conversions: 0 };
      byDate[dt].cost += Number(d.cost) || 0;
      byDate[dt].clicks += Number(d.clicks) || 0;
      byDate[dt].impressions += Number(d.impressions) || 0;
      byDate[dt].conversions += Number(d.conversions) || 0;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      day: new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' }),
      datePart: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      cpc: d.clicks > 0 ? d.cost / d.clicks : 0,
      costPerConv: d.conversions > 0 ? d.cost / d.conversions : 0,
    }));
  }, [dailyMetrics]);

  const SpikeTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <Paper sx={{ p: 1.5, minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1, borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 }}>{d.day}, {fmtDate(d.date)}</Typography>
        {[
          { label: 'Clicks', value: fmtNum(d.clicks) },
          { label: 'Impressions', value: fmtNum(d.impressions) },
          { label: 'CPC', value: fmtINR(d.cpc) },
          { label: 'Conversions', value: fmtNum(d.conversions) },
          { label: 'Cost / Conv.', value: d.conversions > 0 ? fmtINR(d.costPerConv) : '—' },
        ].map((row, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, mb: 0.4 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{row.label}</Typography>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{row.value}</Typography>
          </Box>
        ))}
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Total Cost</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: GOOGLE_GREEN }}>{fmtINR(d.cost)}</Typography>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: CREAM }}>
      {/* Top Bar */}
      <Box sx={{ bgcolor: BROWN, color: 'white', px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: COPPER, fontWeight: 700, fontSize: '1rem' }}>
            {displayName?.charAt(0)}
          </Avatar>
          <Box>
            <Typography sx={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 700, fontSize: '1.1rem' }}>{displayName}</Typography>
            <Typography sx={{ fontSize: '0.7rem', opacity: 0.7 }}>Client Portal</Typography>
          </Box>
        </Box>
        <Button variant="outlined" size="small" startIcon={<LogoutIcon />} onClick={handleLogout}
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}>
          Logout
        </Button>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
        {/* Platform Tabs */}
        <Card variant="outlined" sx={{ mb: 2 }}>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            sx={{
              px: 2,
              '& .MuiTabs-indicator': { bgcolor: tab === 0 ? GOOGLE_GREEN : META_BLUE, height: 3 },
              '& .Mui-selected': { color: `${tab === 0 ? GOOGLE_GREEN : META_BLUE} !important` },
            }}
          >
            <Tab icon={<GoogleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Google Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab icon={<FacebookIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Meta Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
        </Card>

        {/* GOOGLE ADS TAB */}
        {tab === 0 && (<>
        {/* Date Filter */}
        <Card variant="outlined" sx={{ mb: 2, position: 'relative', overflow: 'hidden' }}>
          {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: `${GOOGLE_GREEN}20`, '& .MuiLinearProgress-bar': { bgcolor: GOOGLE_GREEN } }} />}
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
            <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} disabled={loading} />
            <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} disabled={loading} />
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              {(() => {
                const iso = (d) => d.toISOString().split('T')[0];
                const t = iso(new Date());
                const d7 = new Date(); d7.setDate(new Date().getDate() - 6);
                const d14 = new Date(); d14.setDate(new Date().getDate() - 13);
                const d30 = new Date(); d30.setDate(new Date().getDate() - 29);
                const isT = dateFrom === t && dateTo === t;
                const is7 = dateFrom === iso(d7) && dateTo === t;
                const is14 = dateFrom === iso(d14) && dateTo === t;
                const is30 = dateFrom === iso(d30) && dateTo === t;
                const aSx = { bgcolor: GOOGLE_GREEN, color: '#fff', borderColor: GOOGLE_GREEN, '&:hover': { bgcolor: '#2c8f45' } };
                return (
                  <>
                    <Button size="small" variant={isT ? 'contained' : 'outlined'} disabled={loading} sx={isT ? aSx : undefined} onClick={() => { setDateFrom(t); setDateTo(t); }}>Today</Button>
                    <Button size="small" variant={is7 ? 'contained' : 'outlined'} disabled={loading} sx={is7 ? aSx : undefined} onClick={() => { setDateFrom(iso(d7)); setDateTo(t); }}>7 Days</Button>
                    <Button size="small" variant={is14 ? 'contained' : 'outlined'} disabled={loading} sx={is14 ? aSx : undefined} onClick={() => { setDateFrom(iso(d14)); setDateTo(t); }}>14 Days</Button>
                    <Button size="small" variant={is30 ? 'contained' : 'outlined'} disabled={loading} sx={is30 ? aSx : undefined} onClick={() => { setDateFrom(iso(d30)); setDateTo(t); }}>30 Days</Button>
                  </>
                );
              })()}
            </Box>
            <Button size="small" variant="outlined" startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={fetchAnalytics} disabled={loading} sx={{ ml: 'auto' }}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && !data && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ color: GOOGLE_GREEN }} />
            <Typography sx={{ mt: 2, color: 'text.secondary' }}>Fetching your ad performance...</Typography>
          </Box>
        )}

        {/* Error */}
        {!loading && error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Prefer the backend's authoritative flag, fall back to the
            login-time `clientData.googleAdsEnabled` so the banner works
            even if the backend hasn't been redeployed with the updated
            /client-portal/analytics response yet. */}
        {data && (() => {
          const googleEnabled = data.integrations?.google_enabled
            ?? clientData?.googleAdsEnabled;
          const googleLinked = googleEnabled === true;
          if (!googleLinked) {
            return (
              <Alert
                severity="info"
                icon={<GoogleIcon sx={{ color: GOOGLE_GREEN }} />}
                sx={{ mb: 2, borderLeft: `4px solid ${GOOGLE_GREEN}` }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.3 }}>
                  Google Ads is not linked for this account
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                  Your Google Ads performance will appear here once your agency connects your Google Ads account.
                  Please contact your account manager to set it up.
                </Typography>
              </Alert>
            );
          }
          return null;
        })()}

        {/* Data (only when Google is actually linked) */}
        {data && (data.integrations?.google_enabled ?? clientData?.googleAdsEnabled) === true && (
          <Box sx={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s' }}>
            {/* KPIs */}
            {summary && (
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {summary.totalImpressions != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Impressions" value={fmtNum(summary.totalImpressions)} color={GOOGLE_GREEN} icon={<ShowChartIcon />} /></Grid>}
                {summary.totalClicks != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Clicks" value={fmtNum(summary.totalClicks)} color={COPPER} icon={<TrendingUpIcon />} /></Grid>}
                {summary.ctr != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CTR" value={fmtPct(summary.ctr)} color={BROWN} icon={<ShowChartIcon />} /></Grid>}
                {summary.cpc != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Avg CPC" value={fmtINR(summary.cpc)} color={COPPER} icon={<MoneyIcon />} /></Grid>}
                {summary.totalCost != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Total Cost" value={fmtINR(summary.totalCost)} color={GOOGLE_GREEN} icon={<WalletIcon />} /></Grid>}
                {summary.totalConversions != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Conversions" value={fmtNum(summary.totalConversions)} sublabel={summary.cpa ? `${fmtINR(summary.cpa)}/conv` : null} color={BROWN} icon={<CampaignIcon />} /></Grid>}
              </Grid>
            )}

            {/* Spike Chart */}
            {spikeChartData.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                  Campaign Performance
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={spikeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="cpSpikeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GOOGLE_GREEN} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={GOOGLE_GREEN} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                      <XAxis dataKey="datePart" tickLine={false} axisLine={false} height={45}
                        tick={({ x, y, index }) => {
                          const row = spikeChartData[index];
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={12} textAnchor="middle" fontSize={10.5} fill="#555">{row?.datePart}</text>
                              <text x={0} y={0} dy={25} textAnchor="middle" fontSize={9} fill="#999">({row?.day})</text>
                            </g>
                          );
                        }}
                      />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `₹${v}`} />
                      <RechartsTooltip content={<SpikeTooltip />} />
                      <Area type="linear" dataKey="cost" stroke={GOOGLE_GREEN} fill="url(#cpSpikeGrad)" strokeWidth={2.5}
                        dot={{ r: 5, fill: GOOGLE_GREEN, stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: GOOGLE_GREEN, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>
              </>
            )}

            {/* Campaigns Table */}
            {campaignMetrics.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                  Campaigns ({campaignMetrics.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, width: 40 }} />
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Campaign</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Cost</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Clicks</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Impr.</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">CTR</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Avg. CPC</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Conv.</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {campaignMetrics.map(c => {
                        const campKw = keywordsByCampaign[c.campaignId] || [];
                        const isExp = !!expandedCampaigns[c.campaignId];
                        return (
                          <React.Fragment key={c.campaignId}>
                            <TableRow hover sx={{ '& > *': { borderBottom: isExp ? 'none' : undefined } }}>
                              <TableCell sx={{ p: 0.5 }}>
                                {campKw.length > 0 && (
                                  <IconButton size="small" onClick={() => setExpandedCampaigns(p => ({ ...p, [c.campaignId]: !p[c.campaignId] }))}>
                                    {isExp ? <ArrowUpIcon sx={{ fontSize: 18 }} /> : <ArrowDownIcon sx={{ fontSize: 18 }} />}
                                  </IconButton>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                  <CampaignIcon sx={{ fontSize: 14, color: GOOGLE_GREEN }} />
                                  {c.campaignName}
                                  {campKw.length > 0 && <Chip label={`${campKw.length} keywords`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: `${GOOGLE_GREEN}12`, color: GOOGLE_GREEN, fontWeight: 600, ml: 0.5 }} />}
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: GOOGLE_GREEN }}>{fmtINR(c.cost)}</TableCell>
                              <TableCell align="right">{fmtNum(c.clicks)}</TableCell>
                              <TableCell align="right">{fmtNum(c.impressions)}</TableCell>
                              <TableCell align="right">{fmtPct(c.ctr)}</TableCell>
                              <TableCell align="right">{fmtINR(c.cpc)}</TableCell>
                              <TableCell align="right">{fmtNum(c.conversions)}</TableCell>
                            </TableRow>
                            {campKw.length > 0 && (
                              <TableRow>
                                <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                                  <Collapse in={isExp} timeout="auto" unmountOnExit>
                                    <Box sx={{ mx: 2, mb: 1.5, mt: 0.5 }}>
                                      <Table size="small" sx={{ bgcolor: `${GOOGLE_GREEN}04`, borderRadius: 1 }}>
                                        <TableHead>
                                          <TableRow>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Keyword</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Match</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Clicks</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Impr.</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">CTR</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">CPC</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Cost</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {campKw.map((kw, ki) => (
                                            <TableRow key={kw.criterion_id || ki} hover>
                                              <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{kw.keyword_text}</TableCell>
                                              <TableCell><Chip label={kw.match_type} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} /></TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtNum(kw.clicks)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtNum(kw.impressions)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtPct(kw.ctr)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtINR(kw.cpc)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem', fontWeight: 600, color: GOOGLE_GREEN }}>{fmtINR(kw.cost)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {!summary && campaignMetrics.length === 0 && (
              <Alert severity="info">No data for the selected date range.</Alert>
            )}
          </Box>
        )}
        </>)}

        {/* META ADS TAB — mirrors the admin ClientAdDetails Meta tab exactly */}
        {tab === 1 && (() => {
          const metaAccount = metaData?.meta_account;
          const metaBilling = metaData?.billing;
          const metaSummary = metaData?.summary;
          const metaCampaigns = metaData?.campaigns || [];
          const metaDaily = metaData?.daily_trend || [];
          const metaLeadForms = metaData?.lead_forms || [];
          const metaLeadsInRange = metaData?.leads_in_range || [];
          const metaRange = metaData?.range;
          const metaEntityCounts = metaData?.entity_counts || {};
          const accountStatusLabel = metaAccount?.account_status === 1 ? 'Active'
            : metaAccount?.account_status === 2 ? 'Disabled'
            : metaAccount?.account_status === 3 ? 'Unsettled'
            : metaAccount?.account_status === 7 ? 'Pending Risk Review'
            : metaAccount?.account_status === 8 ? 'Pending Settlement'
            : metaAccount?.account_status === 9 ? 'In Grace Period'
            : metaAccount?.account_status === 100 ? 'Pending Closure'
            : metaAccount?.account_status === 101 ? 'Closed'
            : null;
          const isAccountActive = metaAccount?.account_status === 1;
          const isLowAccountBalance = metaAccount?.balance != null
            && metaBilling?.low_balance_threshold != null
            && metaAccount.balance < metaBilling.low_balance_threshold;

          // Prefer backend flag; fall back to "Meta analytics returned data".
          // Strict true-check so missing/undefined flag doesn't silently
          // hide the "not linked" banner.
          const metaEnabled = data?.integrations?.meta_enabled === true
            || (data?.integrations === undefined && metaData != null);

          return (
            <>
              {/* Not integrated — short-circuit: hide everything else. */}
              {!metaEnabled && (
                <Alert
                  severity="info"
                  icon={<FacebookIcon sx={{ color: META_BLUE }} />}
                  sx={{ mb: 2, borderLeft: `4px solid ${META_BLUE}` }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.3 }}>
                    Meta Ads is not linked for this account
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    Your Facebook / Instagram Ads performance will appear here once your agency connects your Meta Ad Account.
                    Please contact your account manager to set it up.
                  </Typography>
                </Alert>
              )}

              {/* Integrated but no data yet (sync still running or empty range). */}
              {metaEnabled && !metaData && (
                <Alert severity="info" icon={<FacebookIcon sx={{ color: META_BLUE }} />} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.3 }}>No Meta data yet</Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    Your Meta Ads are connected but no data has been fetched yet, or the selected date range has no activity.
                  </Typography>
                </Alert>
              )}

              {/* The rest of the tab is only rendered when Meta is linked. */}
              {metaEnabled && (<>
              {/* Date filter */}
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
                  <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
                  <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
                  <Box sx={{ display: 'flex', gap: 0.8 }}>
                    {(() => {
                      const iso = (d) => d.toISOString().split('T')[0];
                      const t = iso(new Date());
                      const d7 = new Date(); d7.setDate(new Date().getDate() - 6);
                      const d30 = new Date(); d30.setDate(new Date().getDate() - 29);
                      const aSx = { bgcolor: META_BLUE, color: '#fff', borderColor: META_BLUE, '&:hover': { bgcolor: '#0c5cb8' } };
                      const isT = dateFrom === t && dateTo === t;
                      const is7 = dateFrom === iso(d7) && dateTo === t;
                      const is30 = dateFrom === iso(d30) && dateTo === t;
                      return (
                        <>
                          <Button size="small" variant={isT ? 'contained' : 'outlined'} sx={isT ? aSx : undefined} onClick={() => { setDateFrom(t); setDateTo(t); }}>Today</Button>
                          <Button size="small" variant={is7 ? 'contained' : 'outlined'} sx={is7 ? aSx : undefined} onClick={() => { setDateFrom(iso(d7)); setDateTo(t); }}>7 Days</Button>
                          <Button size="small" variant={is30 ? 'contained' : 'outlined'} sx={is30 ? aSx : undefined} onClick={() => { setDateFrom(iso(d30)); setDateTo(t); }}>30 Days</Button>
                        </>
                      );
                    })()}
                  </Box>
                </CardContent>
              </Card>

              {/* Account info panel — mirrors admin layout */}
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: `${META_BLUE}06` }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Ad Account</Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{metaAccount?.name || '—'}</Typography>
                    {metaAccount?.id && (
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontFamily: 'monospace' }}>{metaAccount.id}</Typography>
                    )}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Currency / Time Zone</Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {metaAccount?.currency || '—'} · {metaAccount?.timezone_name || '—'}
                    </Typography>
                  </Grid>
                  {metaRange && (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Data Range</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {fmtDate(metaRange.from)} – {fmtDate(metaRange.to)}
                      </Typography>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Lifetime Entities</Typography>
                    <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                      <Chip label={`${metaEntityCounts.campaigns ?? 0} campaigns`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${META_BLUE}15`, color: META_BLUE, fontWeight: 600 }} />
                      <Chip label={`${metaEntityCounts.adsets ?? 0} ad sets`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${COPPER}15`, color: COPPER, fontWeight: 600 }} />
                      <Chip label={`${metaEntityCounts.ads ?? 0} ads`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${BROWN}15`, color: BROWN, fontWeight: 600 }} />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* Billing — mirrors admin layout */}
              {(metaAccount || metaBilling) && (
                <Card variant="outlined" sx={{ borderLeft: `3px solid ${META_BLUE}`, mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Billing</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {accountStatusLabel && (
                          <Chip
                            label={accountStatusLabel}
                            size="small"
                            sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600,
                              bgcolor: isAccountActive ? '#10b98115' : '#ef444415',
                              color: isAccountActive ? '#10b981' : '#ef4444' }}
                          />
                        )}
                        {metaAccount?.disable_reason > 0 && (
                          <Chip label={`Disable Reason ${metaAccount.disable_reason}`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: '#ef444415', color: '#ef4444' }} />
                        )}
                        {metaAccount?.fetched_at && (
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                            Fetched {new Date(metaAccount.fetched_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Grid container spacing={1.5}>
                      {metaAccount?.balance != null && (
                        <Grid size={{ xs: 6, md: 2 }}>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Ad Account Balance</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: isLowAccountBalance ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {fmtINR(metaAccount.balance)}
                            {isLowAccountBalance && <WarningIcon sx={{ fontSize: 14 }} />}
                          </Typography>
                        </Grid>
                      )}
                      {metaAccount?.amount_spent != null && (
                        <Grid size={{ xs: 6, md: 2 }}>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Lifetime Spent</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: META_BLUE }}>{fmtINR(metaAccount.amount_spent)}</Typography>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Performance Summary — admin two-row KPI layout */}
              {metaSummary && (
                <>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                    Performance Summary
                  </Typography>
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    {metaSummary.spend != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Spend" value={fmtINR(metaSummary.spend)} color={META_BLUE} icon={<WalletIcon />} /></Grid>}
                    {metaSummary.total_leads != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Total Leads" value={fmtNum(metaSummary.total_leads)} color={META_BLUE} icon={<GroupsIcon />} sublabel={metaSummary.cpl != null ? `${fmtINR(metaSummary.cpl)}/lead` : null} /></Grid>}
                    {metaSummary.form_leads != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Form Leads" value={fmtNum(metaSummary.form_leads)} color={COPPER} icon={<GroupsIcon />} sublabel={metaSummary.cpl_form != null ? `${fmtINR(metaSummary.cpl_form)}/lead` : null} /></Grid>}
                    {metaSummary.whatsapp_leads != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="WhatsApp Leads" value={fmtNum(metaSummary.whatsapp_leads)} color={BROWN} icon={<ChatIcon />} sublabel={metaSummary.cpl_whatsapp != null ? `${fmtINR(metaSummary.cpl_whatsapp)}/lead` : null} /></Grid>}
                    {metaSummary.cpl != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CPL (Overall)" value={fmtINR(metaSummary.cpl)} color={META_BLUE} icon={<MoneyIcon />} /></Grid>}
                    {metaSummary.reach != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Reach" value={fmtNum(metaSummary.reach)} color={COPPER} icon={<PeopleIcon />} /></Grid>}
                  </Grid>
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    {metaSummary.impressions != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Impressions" value={fmtNum(metaSummary.impressions)} color={META_BLUE} icon={<VisibilityIcon />} /></Grid>}
                    {metaSummary.clicks != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Clicks" value={fmtNum(metaSummary.clicks)} color={COPPER} icon={<TrendingUpIcon />} /></Grid>}
                    {metaSummary.ctr != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CTR" value={fmtPct(metaSummary.ctr)} color={BROWN} icon={<ShowChartIcon />} /></Grid>}
                    {metaSummary.cpc != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CPC" value={fmtINR(metaSummary.cpc)} color={META_BLUE} icon={<MoneyIcon />} /></Grid>}
                    {metaSummary.cpm != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CPM" value={fmtINR(metaSummary.cpm)} color={COPPER} icon={<MoneyIcon />} /></Grid>}
                  </Grid>
                </>
              )}

              {/* Campaigns — admin column set */}
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                Campaigns {metaCampaigns.length > 0 && `(${metaCampaigns.length})`}
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small" sx={{ minWidth: 1200 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Campaign</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Objective</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Daily Budget</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Spend</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Impr.</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Clicks</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">CTR</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Leads</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">CPL</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Messages</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metaCampaigns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                          No campaign data yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      metaCampaigns.map((c) => (
                        <TableRow key={c.campaign_id} hover>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <CampaignIcon sx={{ fontSize: 14, color: META_BLUE }} />
                              {c.name}
                            </Box>
                          </TableCell>
                          <TableCell><Chip label={c.objective} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} /></TableCell>
                          <TableCell><Chip label={c.status} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: c.status === 'ACTIVE' ? '#10b98115' : '#ef444415', color: c.status === 'ACTIVE' ? '#10b981' : '#ef4444' }} /></TableCell>
                          <TableCell align="right">{c.daily_budget != null ? fmtINR(c.daily_budget) : '—'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: META_BLUE }}>{fmtINR(c.spend)}</TableCell>
                          <TableCell align="right">{fmtNum(c.impressions)}</TableCell>
                          <TableCell align="right">{fmtNum(c.clicks)}</TableCell>
                          <TableCell align="right">{fmtPct(c.ctr)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtNum(c.total_leads ?? c.form_leads ?? 0)}</TableCell>
                          <TableCell align="right">{c.cpl != null ? fmtINR(c.cpl) : '—'}</TableCell>
                          <TableCell align="right">{fmtNum(c.messenger_leads ?? c.whatsapp_leads ?? 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Spike Chart */}
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                Campaign Performance
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                {metaDaily.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', fontStyle: 'italic' }}>
                      Daily spend chart will appear here once data is available
                    </Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={metaDaily} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="cpMetaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={META_BLUE} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={META_BLUE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `₹${v}`} />
                      <RechartsTooltip />
                      <Area type="linear" dataKey="spend" stroke={META_BLUE} fill="url(#cpMetaGrad)" strokeWidth={2.5} dot={{ r: 5, fill: META_BLUE, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Paper>

              {/* Lead Forms */}
              {metaLeadForms.length > 0 && (
                <>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                    Lead Forms ({metaLeadForms.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Form Name</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Leads in Range</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Page ID</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...metaLeadForms].sort((a, b) => (Number(b.leads_in_range) || 0) - (Number(a.leads_in_range) || 0)).map((f) => {
                          const isActive = f.status === 'ACTIVE';
                          return (
                            <TableRow key={f.form_id} hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{f.name}</TableCell>
                              <TableCell>
                                <Chip label={f.status || '—'} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: isActive ? '#10b98115' : '#ef444415', color: isActive ? '#10b981' : '#ef4444' }} />
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: META_BLUE }}>{fmtNum(f.leads_in_range)}</TableCell>
                              <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{f.page_id || '—'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Leads — inline Excel-like table (no Full View, no separate page) */}
              {(() => {
                const portalLeads = metaLeadsInRange.length ? metaLeadsInRange : (metaData?.recent_leads || []);
                if (portalLeads.length === 0) return null;
                return (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                          Leads ({portalLeads.length})
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', pl: 1.5 }}>
                          Every lead and form response in the selected date range.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<FileDownloadIcon sx={{ fontSize: 16 }} />}
                          onClick={() => exportLeadsToExcel(portalLeads, metaAccount, displayName)}
                          sx={{ borderColor: '#10b981', color: '#10b981', '&:hover': { borderColor: '#0e9b6f', bgcolor: '#10b98110' } }}
                        >
                          Excel
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PdfIcon sx={{ fontSize: 16 }} />}
                          onClick={() => exportLeadsToPdf(portalLeads, metaAccount, displayName)}
                          sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#dc2626', bgcolor: '#ef444410' } }}
                        >
                          PDF
                        </Button>
                      </Box>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <MetaLeadsTable leads={portalLeads} metaAccount={metaAccount} maxHeight={520} />
                    </Box>
                  </>
                );
              })()}
              </>)}
            </>
          );
        })()}
      </Box>
    </Box>
  );
};

export default ClientPortalDashboard;
