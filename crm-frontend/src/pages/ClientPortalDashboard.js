import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button, Avatar,
  TextField, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Alert, IconButton, Collapse,
  Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Snackbar,
} from '@mui/material';
import {
  Google as GoogleIcon, Facebook as FacebookIcon, Logout as LogoutIcon, Refresh as RefreshIcon,
  ShowChart as ShowChartIcon, TrendingUp as TrendingUpIcon,
  AccountBalanceWallet as WalletIcon, AttachMoney as MoneyIcon,
  Campaign as CampaignIcon, Warning as WarningIcon,
  KeyboardArrowDown as ArrowDownIcon, KeyboardArrowUp as ArrowUpIcon,
  People as PeopleIcon, Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
  FileDownload as FileDownloadIcon, PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { InputAdornment } from '@mui/material';
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
  // Logged-in portal user — drives RBAC. Telecallers see Meta Leads only;
  // admins see Google Ads / Meta Ads / Meta Leads / Users. Falls back to
  // 'admin' for legacy sessions that don't have a stored user (the
  // backend's protectClient does the same grandfathering).
  const [portalUser, setPortalUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('clientPortalUser')); } catch { return null; }
  });
  const role = portalUser?.role || 'admin';
  const isAdmin = role === 'admin';
  const isTelecaller = role === 'telecaller';

  const token = localStorage.getItem('clientToken');

  // Initial tab: telecallers go straight to Meta Leads (their only tab),
  // admins start on Google Ads.
  const [tab, setTab] = useState(isTelecaller ? 2 : 0);
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
    // Grace-window logout: a single transient 401 mid-refresh shouldn't
    // wipe the session. We schedule a redirect 800ms out and cancel it
    // if any later response succeeds — same pattern as agency axios.
    const REDIRECT_GRACE_MS = 800;
    let pendingTimer = null;
    const cancelPending = () => {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    };

    const instance = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });
    instance.interceptors.request.use(config => {
      const t = localStorage.getItem('clientToken');
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    instance.interceptors.response.use(r => {
      cancelPending();
      return r;
    }, err => {
      if (err.response?.status === 401) {
        // Only force-logout when the error message clearly identifies
        // a token problem. Generic 401s (transient backend hiccups,
        // race during refresh) should NOT wipe the client's session.
        const msg = (err.response?.data?.message || err.response?.data?.error || '').toLowerCase();
        const isTokenError =
          msg.includes('token') ||
          msg.includes('jwt') ||
          msg.includes('expired') ||
          msg.includes('not authorized') ||
          msg.includes('unauthorized') ||
          msg.includes('account is deactivated') ||
          msg.includes('portal user not found') ||
          msg.includes('portal access disabled') ||
          msg.includes('login again');
        if (isTokenError && !pendingTimer) {
          pendingTimer = setTimeout(() => {
            pendingTimer = null;
            localStorage.removeItem('clientToken');
            localStorage.removeItem('clientData');
            localStorage.removeItem('clientPortalUser');
            window.location.replace('/client-login');
          }, REDIRECT_GRACE_MS);
        }
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

  // Inline-edit save callback for MetaLeadsTable. PATCHes the lead via the
  // client-portal-friendly route added to /api/meta and patches the lead
  // in-place inside data.meta.leads_in_range so the table reflects the
  // server response without a full refetch.
  const handleSaveMetaLead = async (leadId, payload) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired — please log in again.');
    const { data: resp } = await clientApi.put(
      `/meta/client/${clientId}/leads/${leadId}`,
      payload,
      { timeout: 20000 }
    );
    const updated = resp?.lead;
    if (updated) {
      setData((prev) => {
        if (!prev?.meta?.leads_in_range) return prev;
        const nextLeads = prev.meta.leads_in_range.map((l) => (l._id === leadId ? { ...l, ...updated } : l));
        return { ...prev, meta: { ...prev.meta, leads_in_range: nextLeads } };
      });
    }
    return updated;
  };

  // Manual WhatsApp lead entry from the portal. POSTs through clientApi
  // (carries the portal token) and prepends the new lead to
  // data.meta.leads_in_range so the row appears immediately.
  const handleAddMetaLead = async (payload) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired — please log in again.');
    const { data: resp } = await clientApi.post(
      `/meta/client/${clientId}/leads`,
      payload,
      { timeout: 20000 }
    );
    const created = resp?.lead;
    if (created) {
      setData((prev) => {
        if (!prev) return prev;
        const meta = prev.meta || {};
        const nextLeads = [created, ...(meta.leads_in_range || [])];
        return { ...prev, meta: { ...meta, leads_in_range: nextLeads } };
      });
    }
    return created;
  };

  // Auto-select the tab that has data, once, on first load. If the client
  // has only Meta linked (no Google), jump them straight to the Meta tab
  // instead of making them see the "Google not linked" banner first.
  // If neither is linked, stay on Google so the banner explains why.
  const autoSwitchedRef = useRef(false);
  useEffect(() => {
    if (autoSwitchedRef.current) return;
    if (!data?.integrations) return;
    // Telecallers only have access to Meta Leads, so skip the auto-switch
    // logic entirely — they're already pinned to tab 2.
    if (isTelecaller) {
      autoSwitchedRef.current = true;
      return;
    }
    const { google_enabled, meta_enabled } = data.integrations;
    if (!google_enabled && meta_enabled) setTab(1);
    autoSwitchedRef.current = true;
  }, [data, isTelecaller]);

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientData');
    localStorage.removeItem('clientPortalUser');
    navigate('/client-login');
  };

  const clientInfo = data?.client;
  const summary = data?.summary;
  const billing = data?.client?.billing;
  const dateRange = data?.dateRange;
  // Mirrors the admin ClientAdDetails low-balance signal so the portal
  // billing card shows the same red-warning state when funds are running
  // low. Threshold can come from the billing record itself.
  const isLowBalance = !!(
    billing
    && billing.available_balance != null
    && billing.low_balance_threshold != null
    && billing.available_balance < billing.low_balance_threshold
  );
  const budgetPct = (billing && billing.total_added_funds > 0)
    ? (billing.total_spend / billing.total_added_funds) * 100
    : 0;
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
            {/* MUI <Tabs> uses each child's index as the value. Conditionally
                rendering tabs would shift indices — instead each <Tab> stays
                in place but is hidden via `display: 'none'` for roles that
                shouldn't see it. Telecallers: only Meta Leads. */}
            <Tab
              icon={<GoogleIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Google Ads"
              sx={{ textTransform: 'none', fontWeight: 600, display: isAdmin ? 'inline-flex' : 'none' }}
            />
            <Tab
              icon={<FacebookIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Meta Ads"
              sx={{ textTransform: 'none', fontWeight: 600, display: isAdmin ? 'inline-flex' : 'none' }}
            />
            <Tab
              icon={<FacebookIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Meta Leads"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab
              icon={<PeopleIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Users"
              sx={{ textTransform: 'none', fontWeight: 600, display: isAdmin ? 'inline-flex' : 'none' }}
            />
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
            {/* Account Info — mirrors the admin ClientAdDetails Google tab */}
            {clientInfo && (
              <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: `${GOOGLE_GREEN}06` }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Account Name</Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{clientInfo.googleAdsAccountName || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Customer ID</Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>{clientInfo.googleAdsCustomerId || '—'}</Typography>
                  </Grid>
                  {dateRange && (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Date Range</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {fmtDate(dateRange.start_date)} – {fmtDate(dateRange.end_date)}
                      </Typography>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Client Name</Typography>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{clientInfo.clientName || '—'}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Billing — mirrors the admin ClientAdDetails Google tab */}
            {billing && (
              <Card variant="outlined" sx={{ borderLeft: `3px solid ${GOOGLE_GREEN}`, mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Billing</Typography>
                    {billing.billing_type && (
                      <Chip label={billing.billing_type.toUpperCase()} size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: `${GOOGLE_GREEN}15`, color: GOOGLE_GREEN, fontWeight: 600 }} />
                    )}
                  </Box>
                  <Grid container spacing={1.5}>
                    {billing.total_added_funds != null && (
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Total Added</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: BROWN }}>{fmtINR(billing.total_added_funds)}</Typography>
                      </Grid>
                    )}
                    {billing.total_spend != null && (
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Total Spent</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: GOOGLE_GREEN }}>{fmtINR(billing.total_spend)}</Typography>
                      </Grid>
                    )}
                    {billing.available_balance != null && (
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Available</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: isLowBalance ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {fmtINR(billing.available_balance)}
                          {isLowBalance && <WarningIcon sx={{ fontSize: 14 }} />}
                        </Typography>
                      </Grid>
                    )}
                    {billing.total_added_funds > 0 && (
                      <Grid size={{ xs: 6, md: 3 }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Utilization</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={Math.min(budgetPct, 100)} sx={{ flex: 1, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: isLowBalance ? '#ef4444' : GOOGLE_GREEN } }} />
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: GOOGLE_GREEN }}>{budgetPct.toFixed(0)}%</Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Performance Summary header — matches admin layout */}
            {summary && (
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                Performance Summary
              </Typography>
            )}

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

            {/* Keywords — standalone, full-detail table mirroring the admin
                ClientAdDetails Google tab. Sits below Campaigns. */}
            {keywords.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                  Keywords ({keywords.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small" sx={{ minWidth: 1300 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Keyword</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Match Type</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Clicks</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Impr.</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">CTR</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Avg. CPC</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Cost</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Conversions</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Cost / Conv.</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Conv. Rate</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Quality Score</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Ad Relevance</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Landing Page Exp.</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...keywords].sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0)).map((kw, i) => {
                        const kwClicks = Number(kw.clicks) || 0;
                        const kwConv = Number(kw.conversions) || 0;
                        const kwCost = Number(kw.cost) || 0;
                        const kwCostPerConv = kwConv > 0 ? kwCost / kwConv : null;
                        const kwConvRate = kwClicks > 0 ? (kwConv / kwClicks) * 100 : null;
                        return (
                          <TableRow key={kw.criterion_id || i} hover>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{kw.keyword_text}</TableCell>
                            <TableCell><Chip label={kw.match_type} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} /></TableCell>
                            <TableCell>
                              <Chip label={kw.status} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: kw.status === 'ENABLED' ? '#10b98115' : '#ef444415', color: kw.status === 'ENABLED' ? '#10b981' : '#ef4444' }} />
                            </TableCell>
                            <TableCell align="right">{fmtNum(kwClicks)}</TableCell>
                            <TableCell align="right">{fmtNum(kw.impressions)}</TableCell>
                            <TableCell align="right">{fmtPct(kw.ctr)}</TableCell>
                            <TableCell align="right">{fmtINR(kw.cpc)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, color: GOOGLE_GREEN }}>{fmtINR(kwCost)}</TableCell>
                            <TableCell align="right">{fmtNum(kwConv)}</TableCell>
                            <TableCell align="right">{kwCostPerConv != null ? fmtINR(kwCostPerConv) : '—'}</TableCell>
                            <TableCell align="right">{kwConvRate != null ? fmtPct(kwConvRate) : '—'}</TableCell>
                            <TableCell align="right">{kw.quality_score ?? kw.qualityScore ?? '—'}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{kw.ad_relevance ?? kw.adRelevance ?? '—'}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{kw.landing_page_experience ?? kw.landingPageExperience ?? '—'}</TableCell>
                          </TableRow>
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
          // Slimmed Meta Ads tab — only billing + leads. Account info,
          // performance KPIs, campaigns, daily trend and lead forms have
          // been removed for the client-portal view (admins still see
          // the full picture on /client-ads/:id).
          const metaAccount = metaData?.meta_account;
          const metaBilling = metaData?.billing;
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

              {/* Billing — mirrors admin layout. Per client request the
                  Meta Ads tab is intentionally minimal: just billing +
                  the leads table below. Account info, Performance
                  Summary KPIs, Campaigns, Daily Trend, Lead Forms are
                  all hidden on the portal — clients only need to see
                  what they're paying and what's coming back as leads. */}
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

              {/* Leads — same MetaLeadsTable used on the Meta Leads tab,
                  pulled in here so the Meta Ads tab carries the data
                  clients actually need (billing + leads + form responses)
                  without the extra ad-management noise. */}
              {(() => {
                const portalLeads = (metaData?.leads_in_range?.length
                  ? metaData.leads_in_range
                  : (metaData?.recent_leads || []));
                if (portalLeads.length === 0) {
                  return (
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No leads in this date range</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Try widening the From/To dates above to see older lead submissions.
                        </Typography>
                      </CardContent>
                    </Card>
                  );
                }
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
                      <MetaLeadsTable
                        leads={portalLeads}
                        metaAccount={metaAccount}
                        maxHeight={520}
                        onSaveLead={handleSaveMetaLead}
                        onAddLead={handleAddMetaLead}
                      />
                    </Box>
                  </>
                );
              })()}

              </>)}
            </>
          );
        })()}

        {/* META LEADS TAB — leads + form responses for the selected date range.
            Reuses the same Meta analytics payload (`metaData`) the Meta Ads tab
            consumes; no extra fetch needed. The MetaLeadsTable component is the
            same one the admin ClientAdDetails page uses, so inline editing of
            CRM fields and the +Add Follow-up flow work identically here. */}
        {tab === 2 && (() => {
          const metaAccount = metaData?.meta_account;
          const portalLeads = (metaData?.leads_in_range?.length
            ? metaData.leads_in_range
            : (metaData?.recent_leads || []));
          const metaLinked = (data?.integrations?.meta_enabled === true)
            || (data?.integrations === undefined && metaData != null);

          if (loading && !metaData) {
            return (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CircularProgress size={40} sx={{ color: META_BLUE }} />
                <Typography sx={{ mt: 2, color: 'text.secondary' }}>Fetching your Meta leads...</Typography>
              </Box>
            );
          }

          if (!metaLinked) {
            return (
              <Alert
                severity="info"
                icon={<FacebookIcon sx={{ color: META_BLUE }} />}
                sx={{ mb: 2, borderLeft: `4px solid ${META_BLUE}` }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.3 }}>
                  Meta Ads is not linked for this account
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                  Your Meta lead form submissions will appear here once your agency connects your Meta Ads account.
                </Typography>
              </Alert>
            );
          }

          if (portalLeads.length === 0) {
            return (
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <FacebookIcon sx={{ fontSize: 48, color: META_BLUE, mb: 1 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>No leads in this date range</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try widening the From/To dates above to see older lead submissions.
                  </Typography>
                </CardContent>
              </Card>
            );
          }

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
                <MetaLeadsTable
                  leads={portalLeads}
                  metaAccount={metaAccount}
                  maxHeight={640}
                  onSaveLead={handleSaveMetaLead}
                  onAddLead={handleAddMetaLead}
                />
              </Box>
            </>
          );
        })()}

        {/* USERS TAB — admin only. Telecallers can't reach this tab via the
            UI (display:none on the <Tab>), but we still gate the body so
            anyone fiddling with state can't render it. */}
        {tab === 3 && isAdmin && (
          <UsersTabPanel
            clientApi={clientApi}
            currentUser={portalUser}
            onCurrentUserChange={(u) => {
              setPortalUser(u);
              localStorage.setItem('clientPortalUser', JSON.stringify(u));
            }}
          />
        )}
      </Box>
    </Box>
  );
};

// Inline component — kept in this file because it shares the clientApi
// instance and is only rendered from one place. Pull into its own file
// if it grows beyond ~200 lines.
const UsersTabPanel = ({ clientApi, currentUser, onCurrentUserChange }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);    // user object or null
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'telecaller' });
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientApi.get('/client-portal/users');
      setUsers(res.data?.users || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setForm({ username: '', email: '', password: '', role: 'telecaller' });
    setEditing(null);
    setShowPassword(false);
    setAddOpen(true);
  };

  const openEdit = (user) => {
    setForm({
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'telecaller',
    });
    setEditing(user);
    setShowPassword(false);
    setAddOpen(true);
  };

  const closeDialog = () => {
    if (busy) return;
    setAddOpen(false);
    setEditing(null);
    setShowPassword(false);
  };

  const handleSubmit = async () => {
    const username = form.username.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();
    const usernameRe = /^[a-z0-9._-]{3,60}$/;

    if (!username) {
      setSnack({ open: true, message: 'Username is required', severity: 'error' });
      return;
    }
    // Mirror the backend regex on both create and edit so users get an
    // instant error before the round-trip.
    if (!usernameRe.test(username)) {
      setSnack({
        open: true,
        message: 'Username: 3–60 chars, lowercase letters/digits/dot/underscore/hyphen only',
        severity: 'error',
      });
      return;
    }
    if (!editing && (!form.password || form.password.length < 6)) {
      setSnack({ open: true, message: 'Password must be at least 6 characters', severity: 'error' });
      return;
    }
    if (editing && form.password && form.password.length < 6) {
      setSnack({ open: true, message: 'Password must be at least 6 characters', severity: 'error' });
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        const payload = { role: form.role };
        // Send username/email only when they actually changed — the server
        // does its own no-op detection but this keeps the wire payload tidy.
        if (username !== (editing.username || '')) payload.username = username;
        if (email !== (editing.email || '')) payload.email = email;
        if (form.password) payload.password = form.password;
        const res = await clientApi.put(`/client-portal/users/${editing._id}`, payload);
        const updated = res.data?.user;
        // If the admin edited their own role / name / username, refresh
        // the cached currentUser so the dashboard's tab gating + login
        // identifier reflect the new values without a full reload.
        if (updated && currentUser && String(updated._id) === String(currentUser._id)) {
          onCurrentUserChange({ ...currentUser, ...updated });
        }
        setSnack({ open: true, message: 'User updated', severity: 'success' });
      } else {
        await clientApi.post('/client-portal/users', {
          username,
          email,                              // optional — server treats '' as unset
          password: form.password,
          role: form.role,
        });
        setSnack({ open: true, message: 'User created', severity: 'success' });
      }
      setAddOpen(false);
      setEditing(null);
      setShowPassword(false);
      fetchUsers();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.message || err.response?.data?.error || 'Save failed',
        severity: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await clientApi.put(`/client-portal/users/${user._id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.message || err.response?.data?.error || 'Update failed',
        severity: 'error',
      });
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete ${user.name} (${user.email})? This cannot be undone.`)) return;
    try {
      await clientApi.delete(`/client-portal/users/${user._id}`);
      setSnack({ open: true, message: 'User deleted', severity: 'success' });
      fetchUsers();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.message || err.response?.data?.error || 'Delete failed',
        severity: 'error',
      });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
            Portal Users
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', pl: 1.5 }}>
            Admins manage Google Ads, Meta Ads, Meta Leads & Users. Telecallers see only Meta Leads.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openAdd} sx={{ bgcolor: META_BLUE, '&:hover': { bgcolor: '#0c5cb8' } }}>
          Add User
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress sx={{ color: META_BLUE }} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10` }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    No users yet — click "Add User" to invite the first one.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const isSelf = currentUser && String(u._id) === String(currentUser._id);
                  return (
                    <TableRow key={u._id} hover>
                      <TableCell sx={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        {u.username}
                        {isSelf && <Chip label="You" size="small" sx={{ ml: 0.8, height: 18, fontSize: '0.6rem', bgcolor: `${META_BLUE}15`, color: META_BLUE }} />}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem' }}>{u.email || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={u.role}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            bgcolor: u.role === 'admin' ? `${META_BLUE}20` : '#10b98120',
                            color: u.role === 'admin' ? META_BLUE : '#10b981',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          sx={{
                            height: 22, fontSize: '0.7rem', fontWeight: 600,
                            bgcolor: u.isActive ? '#10b98115' : '#9ca3af15',
                            color: u.isActive ? '#10b981' : '#6b7280',
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => openEdit(u)} sx={{ minWidth: 0, mr: 0.5 }}>Edit</Button>
                        <Button size="small" onClick={() => handleToggleActive(u)} sx={{ minWidth: 0, mr: 0.5 }} disabled={isSelf}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="small" color="error" onClick={() => handleDelete(u)} sx={{ minWidth: 0 }} disabled={isSelf}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={addOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? `Edit ${editing.username}` : 'Add Portal User'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Username"
              fullWidth
              value={form.username}
              onChange={(e) =>
                // Auto-lowercase the input as the user types so they can't
                // accidentally create an unreachable login. Still hits the
                // server-side regex check on submit.
                setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))
              }
              disabled={busy}
              required
              autoFocus
              helperText="Lowercase letters, digits, . _ - only (3–60 chars). The telecaller will use this to log in."
            />
            <TextField
              label="Email (optional)"
              type="email"
              fullWidth
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={busy}
              helperText="Optional. Telecallers usually leave this blank."
            />
            <TextField
              label={editing ? 'New password (leave blank to keep current)' : 'Password'}
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              disabled={busy}
              helperText="Minimum 6 characters"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControl fullWidth disabled={busy}>
              <InputLabel id="role-label">Role</InputLabel>
              <Select
                labelId="role-label"
                value={form.role}
                label="Role"
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <MenuItem value="admin">Admin — full portal access</MenuItem>
                <MenuItem value="telecaller">Telecaller — Meta Leads only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: META_BLUE, '&:hover': { bgcolor: '#0c5cb8' } }}
          >
            {busy ? 'Saving…' : (editing ? 'Save Changes' : 'Create User')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ClientPortalDashboard;
