import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Avatar, Button,
  Tabs, Tab, TextField, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Alert, Paper, CircularProgress, Collapse, Snackbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Facebook as FacebookIcon, Google as GoogleIcon,
  AccountBalanceWallet as WalletIcon, ShowChart as ShowChartIcon,
  Campaign as CampaignIcon, TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon, Refresh as RefreshIcon,
  Sync as SyncIcon,
  Link as LinkIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  People as PeopleIcon, Visibility as VisibilityIcon,
  Chat as ChatIcon, Groups as GroupsIcon,
  FileDownload as FileDownloadIcon, PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { PageLoader } from '../components/Loading';
import { useDataCache } from '../contexts/DataCacheContext';
import { exportLeadsToExcel, exportLeadsToPdf } from '../utils/metaLeadsExport';
import MetaLeadsTable from '../components/MetaLeadsTable';
import TelecallingReport from '../components/TelecallingReport';
import MonthlyAbstract from '../components/MonthlyAbstract';
import LeadCheckPanel from '../components/LeadCheckPanel';
import MetricsBand from '../components/MetricsBand';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const GOOGLE_GREEN = '#34a853';
const META_BLUE = '#1877f2';

// Module-level cache shared across mounts: key = `${clientId}_${from}_${to}`
// Value: { data, ts } — ts = epoch ms. TTL 5 min.
const analyticsCache = new Map();
const metaAnalyticsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n ?? 0).toFixed(2)}%`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

// KPI card
const KpiCard = ({ label, value, color, icon, sublabel }) => (
  <Card variant="outlined" sx={{ borderLeft: `3px solid ${color}`, height: '100%' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon, { sx: { color, fontSize: 20 } })}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
        {sublabel && <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{sublabel}</Typography>}
      </Box>
    </CardContent>
  </Card>
);

const ClientAdDetails = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { clients, clientsLoading, fetchClients } = useDataCache();
  useEffect(() => { fetchClients(); }, [fetchClients]);
  const [tab, setTab] = useState(0); // 0 = Google, 1 = Meta, 2 = EOD Report
  // Filter handoff from the EOD tab to the Meta Ads tab's leads table.
  // EOD clicks set this; MetaLeadsTable's onFilterPresetConsumed clears it.
  const [leadsFilterPreset, setLeadsFilterPreset] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metaData, setMetaData] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  // Meta resync state (fire-and-forget)
  const [resyncing, setResyncing] = useState(false);
  const [resyncSnack, setResyncSnack] = useState({ open: false, message: '', severity: 'info' });
  // Full-screen Meta leads view
  // Banner visibility — persists across reloads via sessionStorage so the user
  // still sees "sync in progress" if they refresh mid-fetch.
  const syncFlagKey = clientId ? `meta_sync_in_progress_${clientId}` : null;
  const [syncBannerVisible, setSyncBannerVisible] = useState(() => {
    if (!syncFlagKey) return false;
    return sessionStorage.getItem(syncFlagKey) === '1';
  });

  const raiseSyncBanner = () => {
    if (syncFlagKey) sessionStorage.setItem(syncFlagKey, '1');
    setSyncBannerVisible(true);
  };
  const clearSyncBanner = () => {
    if (syncFlagKey) sessionStorage.removeItem(syncFlagKey);
    setSyncBannerVisible(false);
  };

  const handleMetaResync = () => {
    if (!clientId) return;
    setResyncing(true);
    raiseSyncBanner();
    // Fire the full Meta sync in the background — don't await.
    // Meta pulls up to 90 days of campaign/insights/leads data, which can take several minutes.
    api.post(`/meta/sync/${clientId}`)
      .then(() => {
        setResyncSnack({
          open: true,
          message: 'Resync finished. Refreshing analytics…',
          severity: 'success',
        });
        clearSyncBanner();
        fetchMetaAnalytics({ force: true });
      })
      .catch((err) => {
        console.error('Meta resync error:', err);
        setResyncSnack({
          open: true,
          message: err.response?.data?.message || err.response?.data?.error || 'Resync failed. Try again in a moment.',
          severity: 'error',
        });
        clearSyncBanner();
      })
      .finally(() => {
        setResyncing(false);
      });
    setResyncSnack({
      open: true,
      message: 'Resync started. Meta is fetching up to 90 days of data — this can take a few minutes. You can keep using the page.',
      severity: 'info',
    });
  };

  // Find client in cache (may be undefined if cache hasn't loaded — that's OK, we still fetch)
  const client = useMemo(() => clients.find(c => c._id === clientId), [clients, clientId]);

  const fetchGoogleAnalytics = async ({ force = false } = {}) => {
    if (!clientId) return;
    const cacheKey = `${clientId}_${dateFrom}_${dateTo}`;
    const cached = analyticsCache.get(cacheKey);
    const hasFreshCache = cached && (Date.now() - cached.ts) < CACHE_TTL_MS;

    // Paint cached data instantly, then refetch in background (stale-while-revalidate)
    if (cached && !force) {
      setData(cached.data);
      setError(null);
    }
    // Only show the full loading state when we truly have nothing to show
    if (!cached || force) {
      setLoading(true);
    } else {
      setLoading(true); // still show progress bar, but keep cached data visible
    }
    if (!cached) setError(null);

    try {
      const res = await api.get(`/analytics/client/${clientId}`, {
        params: { start_date: dateFrom, end_date: dateTo },
      });
      const payload = res.data || null;
      setData(payload);
      setError(null);
      if (payload) analyticsCache.set(cacheKey, { data: payload, ts: Date.now() });
    } catch (err) {
      // If we already showed cached data, keep it — just log and move on
      if (hasFreshCache) {
        console.warn('Background refresh failed, keeping cached data:', err.message);
        return;
      }
      const body = err.response?.data || {};
      const serverMsg = body.error || body.message || err.message || '';
      const lower = serverMsg.toLowerCase();

      const notLinked =
        err.response?.status === 404 ||
        lower.includes('not have google ads') ||
        lower.includes('not linked') ||
        lower.includes('not associated') ||
        lower.includes('not enabled');

      if (notLinked) {
        console.info(`Client ${clientId} is not linked to Google Ads:`, serverMsg);
        setError('This client is not linked to a Google Ads account yet');
      } else {
        console.error('Failed to fetch Google Ads analytics:', err);
        setError(serverMsg || 'Failed to fetch Google Ads data');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetaAnalytics = async ({ force = false } = {}) => {
    if (!clientId) return;
    const today = new Date().toISOString().split('T')[0];
    const isToday = dateFrom === today && dateTo === today;
    const granularity = isToday ? 'hourly' : 'daily';
    const cacheKey = `${clientId}_${dateFrom}_${dateTo}_${granularity}`;
    const cached = metaAnalyticsCache.get(cacheKey);
    const hasFreshCache = cached && (Date.now() - cached.ts) < CACHE_TTL_MS;

    if (cached && !force) {
      setMetaData(cached.data);
      setMetaError(null);
    }
    setMetaLoading(true);
    if (!cached) setMetaError(null);

    try {
      const res = await api.get(`/meta/client/${clientId}/analytics`, {
        params: { from: dateFrom, to: dateTo, granularity },
      });
      const payload = res.data || null;
      setMetaData(payload);
      setMetaError(null);
      if (payload) metaAnalyticsCache.set(cacheKey, { data: payload, ts: Date.now() });
    } catch (err) {
      if (hasFreshCache) {
        console.warn('Meta background refresh failed, keeping cached data:', err.message);
        return;
      }
      const body = err.response?.data || {};
      const serverMsg = body.error || body.message || err.message || '';
      const lower = serverMsg.toLowerCase();
      const notLinked =
        err.response?.status === 404 ||
        lower.includes('not linked') ||
        lower.includes('not associated') ||
        lower.includes('no meta') ||
        lower.includes('not enabled');
      setMetaError(notLinked ? 'This client is not linked to a Meta ad account yet' : (serverMsg || 'Failed to fetch Meta Ads data'));
      setMetaData(null);
    } finally {
      setMetaLoading(false);
    }
  };

  // Inline-edit save callback for the CRM telecaller columns rendered by
  // MetaLeadsTable. PATCHes the lead via the meta-tree route (kept off
  // /api/leads/:id so the client portal can hit the same endpoint with its
  // clientToken) and patches the lead in metaData.leads_in_range so the
  // table reflects the server response without a full refetch.
  const handleSaveMetaLead = async (leadId, payload) => {
    if (!clientId) throw new Error('Missing clientId');
    const res = await api.put(`/meta/client/${clientId}/leads/${leadId}`, payload);
    const updated = res.data?.lead;
    if (updated) {
      setMetaData((prev) => {
        if (!prev?.leads_in_range) return prev;
        const nextLeads = prev.leads_in_range.map((l) => (l._id === leadId ? { ...l, ...updated } : l));
        return { ...prev, leads_in_range: nextLeads };
      });
    }
    return updated;
  };

  // Manual WhatsApp lead entry — POSTs to the same /meta/client/:id/leads
  // route used by the portal. The created row is prepended to
  // metaData.leads_in_range so the user sees it immediately without a
  // refetch. The row counts as a Meta-source lead with platform=whatsapp.
  const handleAddMetaLead = async (payload) => {
    if (!clientId) throw new Error('Missing clientId');
    const res = await api.post(`/meta/client/${clientId}/leads`, payload);
    const created = res.data?.lead;
    if (created) {
      setMetaData((prev) => {
        if (!prev) return { leads_in_range: [created] };
        const nextLeads = [created, ...(prev.leads_in_range || [])];
        return { ...prev, leads_in_range: nextLeads };
      });
    }
    return created;
  };

  // Delete a manual WhatsApp lead. The backend rejects deletion of
  // synced Meta-form rows with a 403, so the only thing reaching here
  // should be a manual entry — but the success path still patches by
  // _id so it'd be safe either way.
  const handleDeleteMetaLead = async (leadId) => {
    if (!clientId) throw new Error('Missing clientId');
    await api.delete(`/meta/client/${clientId}/leads/${leadId}`);
    setMetaData((prev) => {
      if (!prev?.leads_in_range) return prev;
      return {
        ...prev,
        leads_in_range: prev.leads_in_range.filter((l) => l._id !== leadId),
      };
    });
  };

  // Fetch analytics as soon as we have a clientId — don't wait for the cached client record
  useEffect(() => {
    if (tab === 0 && clientId) {
      fetchGoogleAnalytics();
    } else if (tab === 1 && clientId) {
      fetchMetaAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, clientId, dateFrom, dateTo]);

  // When the user lands here right after launching setup, the sync is running
  // server-side. We can't poll its status directly, but once Meta analytics
  // successfully returns non-empty data we know enough has landed in our DB
  // for the user to stop waiting — drop the banner.
  useEffect(() => {
    if (!syncBannerVisible) return;
    const hasMetaData = metaData && (
      (metaData.summary && Object.keys(metaData.summary).length) ||
      (Array.isArray(metaData.campaigns) && metaData.campaigns.length) ||
      (Array.isArray(metaData.daily_trend) && metaData.daily_trend.length)
    );
    if (hasMetaData) clearSyncBanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaData, syncBannerVisible]);

  // Derive a display name: prefer cached client, fall back to API response, else show the ID
  const displayName = client?.clientName || data?.client?.clientName || `Client ${clientId?.slice(-6)}`;
  const displayPlace = client?.place;
  const displayOrgType = client?.organisationType;
  const displayStatus = client?.status || 'active';

  // Expanded campaign rows (for keyword dropdown)
  const [expandedCampaigns, setExpandedCampaigns] = useState({});
  const toggleCampaign = (campaignId) => setExpandedCampaigns(prev => ({ ...prev, [campaignId]: !prev[campaignId] }));

  // Extract real API fields
  const clientInfo = data?.client;
  const billing = clientInfo?.billing;
  const summary = data?.summary;
  const dailyMetrics = data?.dailyMetrics || [];
  const keywords = data?.keywords || [];
  const campaignMetrics = useMemo(
    () => [...(data?.campaignMetrics || [])].sort((a, b) => (Number(b?.cost) || 0) - (Number(a?.cost) || 0)),
    [data]
  );
  // Group keywords by campaign_id for inline display
  const keywordsByCampaign = useMemo(() => {
    const map = {};
    keywords.forEach(kw => {
      const cid = kw.campaign_id;
      if (!map[cid]) map[cid] = [];
      map[cid].push(kw);
    });
    // Sort each group by cost descending
    Object.values(map).forEach(arr => arr.sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0)));
    return map;
  }, [keywords]);
  const dateRange = data?.dateRange;

  const hasAnyData = !!clientInfo;
  const isLowBalance = billing?.available_balance != null
    && billing?.low_balance_threshold != null
    && billing.available_balance < billing.low_balance_threshold;

  const budgetPct = billing?.total_added_funds > 0
    ? (billing.total_spend / billing.total_added_funds) * 100
    : 0;

  const currentColor = tab === 0 ? GOOGLE_GREEN : META_BLUE;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/dashboard')} size="small" sx={{ bgcolor: `${COPPER}15`, '&:hover': { bgcolor: `${COPPER}25` } }}>
          <ArrowBackIcon sx={{ color: COPPER }} />
        </IconButton>
        <Avatar sx={{ width: 42, height: 42, bgcolor: COPPER, fontWeight: 700, fontSize: '1.1rem' }}>
          {displayName?.charAt(0)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{displayName}</Typography>
          <Box sx={{ display: 'flex', gap: 0.8, mt: 0.3, flexWrap: 'wrap' }}>
            <Chip label={displayStatus} size="small" sx={{ height: 18, fontSize: '0.65rem', textTransform: 'capitalize', bgcolor: '#10b98115', color: '#10b981' }} />
            {displayPlace && <Chip label={displayPlace} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
            {displayOrgType && <Chip label={displayOrgType} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
            {clientInfo?.googleAdsAccountName && (
              <Chip
                icon={<GoogleIcon sx={{ fontSize: 12 }} />}
                label={clientInfo.googleAdsAccountName}
                size="small"
                sx={{ height: 20, fontSize: '0.68rem', bgcolor: `${GOOGLE_GREEN}15`, color: GOOGLE_GREEN, fontWeight: 600 }}
              />
            )}
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={(tab === 0 ? loading : metaLoading) ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={() => (tab === 0 ? fetchGoogleAnalytics({ force: true }) : fetchMetaAnalytics({ force: true }))}
          disabled={tab === 0 ? loading : metaLoading}
        >
          {(tab === 0 ? loading : metaLoading) ? 'Syncing...' : 'Refresh'}
        </Button>
        {tab === 1 && (
          <Button
            variant="contained"
            size="small"
            startIcon={resyncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
            onClick={handleMetaResync}
            disabled={resyncing}
            sx={{ bgcolor: META_BLUE, '&:hover': { bgcolor: '#0c5cb8' } }}
          >
            {resyncing ? 'Resyncing…' : 'Resync from Meta'}
          </Button>
        )}
      </Box>

      {/* Meta sync in-progress banner (persists across reloads via sessionStorage) */}
      {syncBannerVisible && (
        <Alert
          severity="info"
          icon={<CircularProgress size={20} sx={{ color: META_BLUE }} />}
          onClose={clearSyncBanner}
          sx={{
            mb: 2,
            borderLeft: `4px solid ${META_BLUE}`,
            bgcolor: `${META_BLUE}10`,
            '& .MuiAlert-icon': { alignItems: 'center' },
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.3 }}>
            Fetching Meta data in the background — this can take a few minutes
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            Meta is pulling up to 90 days of campaigns, ad sets, ads, daily insights, lead forms, and leads for this client.
            The page will refresh automatically once data starts arriving. You can keep using the app, switch tabs, or come back
            later — the sync continues on the server.
          </Typography>
        </Alert>
      )}

      {/* Date Filter (shared across tabs) */}
      {(() => {
        const activeLoading = tab === 0 ? loading : metaLoading;
        const accent = tab === 0 ? GOOGLE_GREEN : META_BLUE;
        const accentHover = tab === 0 ? '#2c8f45' : '#0c5cb8';
        return (
          <Card variant="outlined" sx={{ mb: 2, position: 'relative', overflow: 'hidden' }}>
            {activeLoading && (
              <LinearProgress
                sx={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 3,
                  bgcolor: `${accent}20`,
                  '& .MuiLinearProgress-bar': { bgcolor: accent },
                }}
              />
            )}
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
              <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }} disabled={activeLoading} />
              <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }} disabled={activeLoading} />
              <Box sx={{ display: 'flex', gap: 0.8 }}>
                {(() => {
                  const iso = (d) => d.toISOString().split('T')[0];
                  const today = iso(new Date());
                  const d7 = new Date(); d7.setDate(new Date().getDate() - 6);
                  const d14 = new Date(); d14.setDate(new Date().getDate() - 13);
                  const d30 = new Date(); d30.setDate(new Date().getDate() - 29);
                  const isToday = dateFrom === today && dateTo === today;
                  const is7 = dateFrom === iso(d7) && dateTo === today;
                  const is14 = dateFrom === iso(d14) && dateTo === today;
                  const is30 = dateFrom === iso(d30) && dateTo === today;
                  const activeSx = {
                    bgcolor: accent,
                    color: '#fff',
                    borderColor: accent,
                    '&:hover': { bgcolor: accentHover, borderColor: accentHover },
                  };
                  return (
                    <>
                      <Button size="small" variant={isToday ? 'contained' : 'outlined'} disabled={activeLoading} sx={isToday ? activeSx : undefined} onClick={() => { setDateFrom(today); setDateTo(today); }}>Today</Button>
                      <Button size="small" variant={is7 ? 'contained' : 'outlined'} disabled={activeLoading} sx={is7 ? activeSx : undefined} onClick={() => { setDateFrom(iso(d7)); setDateTo(today); }}>Last 7 Days</Button>
                      <Button size="small" variant={is14 ? 'contained' : 'outlined'} disabled={activeLoading} sx={is14 ? activeSx : undefined} onClick={() => { setDateFrom(iso(d14)); setDateTo(today); }}>Last 14 Days</Button>
                      <Button size="small" variant={is30 ? 'contained' : 'outlined'} disabled={activeLoading} sx={is30 ? activeSx : undefined} onClick={() => { setDateFrom(iso(d30)); setDateTo(today); }}>Last 30 Days</Button>
                    </>
                  );
                })()}
              </Box>
              {activeLoading && (
                <Chip
                  icon={<CircularProgress size={12} sx={{ color: `${accent} !important` }} />}
                  label="Fetching data..."
                  size="small"
                  sx={{ ml: 'auto', bgcolor: `${accent}15`, color: accent, fontWeight: 600, '& .MuiChip-icon': { ml: 1 } }}
                />
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Tabs */}
      <Card variant="outlined">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)}
            sx={{ px: 2, '& .MuiTabs-indicator': { bgcolor: currentColor, height: 3 }, '& .Mui-selected': { color: `${currentColor} !important` } }}>
            <Tab icon={<GoogleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Google Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
            {/* Label = the connected Facebook Page name when we have it,
                falling back to "Meta Ads" before sync / when no page is
                linked. Icon stays so the platform is still recognisable. */}
            <Tab
              icon={<FacebookIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={client?.meta_pages?.[0]?.page_name || 'Meta Ads'}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab label="EOD Report" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Lead Check" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
        </Box>

        <CardContent sx={{ px: 2, py: 2 }}>
          {/* GOOGLE TAB */}
          {tab === 0 && (
            <>
              {loading && !data && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <CircularProgress size={32} sx={{ color: GOOGLE_GREEN }} />
                  <Typography sx={{ mt: 2, color: 'text.secondary' }}>Fetching Google Ads data...</Typography>
                </Box>
              )}

              {!loading && error && !error.includes('not linked') && (
                <Alert severity="error" sx={{ py: 2 }}>
                  <Typography sx={{ fontWeight: 600 }}>{error}</Typography>
                </Alert>
              )}

              {/* Not-linked message — linking is now done from the Clients
                  list page (the "G" icon next to Facebook). This view just
                  points the user there instead of duplicating the form. */}
              {!loading && error && error.includes('not linked') && (
                <Paper variant="outlined" sx={{ p: 3, borderLeft: `4px solid ${GOOGLE_GREEN}`, bgcolor: `${GOOGLE_GREEN}04` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <GoogleIcon sx={{ color: GOOGLE_GREEN, fontSize: 24 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Google Ads not linked</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    <strong>{displayName}</strong> is not yet linked to a Google Ads account.
                    Open the Clients page and click the Google icon next to this client to connect an account.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/clients')}
                    startIcon={<LinkIcon />}
                    sx={{ bgcolor: GOOGLE_GREEN, '&:hover': { bgcolor: '#2c8f45' } }}
                  >
                    Go to Clients to Link
                  </Button>
                </Paper>
              )}

              {hasAnyData && (
                <Box sx={{ opacity: loading ? 0.55 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 0.2s ease' }}>
                  {/* Account Info */}
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

                  {/* Billing */}
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

                  {/* Performance Summary */}
                  {summary && (
                    <>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                        Performance Summary
                      </Typography>
                      <Grid container spacing={1.5} sx={{ mb: 2 }}>
                        {summary.totalImpressions != null && (
                          <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Impressions" value={fmtNum(summary.totalImpressions)} color={GOOGLE_GREEN} icon={<ShowChartIcon />} /></Grid>
                        )}
                        {summary.totalClicks != null && (
                          <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Clicks" value={fmtNum(summary.totalClicks)} color={COPPER} icon={<TrendingUpIcon />} /></Grid>
                        )}
                        {summary.ctr != null && (
                          <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CTR" value={fmtPct(summary.ctr)} color={BROWN} icon={<ShowChartIcon />} /></Grid>
                        )}
                        {summary.cpc != null && (
                          <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Avg CPC" value={fmtINR(summary.cpc)} color={COPPER} icon={<MoneyIcon />} /></Grid>
                        )}
                        {summary.totalCost != null && (
                          <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Total Cost" value={fmtINR(summary.totalCost)} color={GOOGLE_GREEN} icon={<WalletIcon />} /></Grid>
                        )}
                        {summary.totalConversions != null && (
                          <Grid size={{ xs: 6, md: 2 }}>
                            <KpiCard
                              label="Conversions"
                              value={fmtNum(summary.totalConversions)}
                              sublabel={summary.cpa ? `${fmtINR(summary.cpa)}/conv` : null}
                              color={BROWN}
                              icon={<CampaignIcon />}
                            />
                          </Grid>
                        )}
                      </Grid>

                    </>
                  )}

                  {/* Campaign Metrics */}
                  {campaignMetrics.length > 0 && (
                    <>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                        Campaigns ({campaignMetrics.length})
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small" sx={{ minWidth: 1200 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, width: 40 }} />
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Campaign</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Budget</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Cost</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Clicks</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Impr.</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">CTR</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Avg. CPC</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Conversions</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Cost / conv.</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Conv. rate</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Search impr. share</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Search lost IS (rank)</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Search lost top IS (budget)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {campaignMetrics.map(c => {
                              const conv = Number(c.conversions) || 0;
                              const clicks = Number(c.clicks) || 0;
                              const cost = Number(c.cost) || 0;
                              const costPerConv = conv > 0 ? cost / conv : null;
                              const convRate = clicks > 0 ? (conv / clicks) * 100 : null;
                              const budget = c.budget ?? c.dailyBudget ?? c.budgetAmount;
                              const searchIS = c.searchImpressionShare;
                              const lostISRank = c.searchRankLostImpressionShare ?? c.searchLostISRank;
                              const lostISBudget = c.searchBudgetLostImpressionShare ?? c.searchLostISBudget;
                              const campKeywords = keywordsByCampaign[c.campaignId] || [];
                              const isExpanded = !!expandedCampaigns[c.campaignId];
                              return (
                                <React.Fragment key={c.campaignId}>
                                  <TableRow hover sx={{ '& > *': { borderBottom: isExpanded ? 'none' : undefined } }}>
                                    <TableCell sx={{ width: 40, p: 0.5 }}>
                                      {campKeywords.length > 0 && (
                                        <IconButton size="small" onClick={() => toggleCampaign(c.campaignId)}>
                                          {isExpanded ? <ArrowUpIcon sx={{ fontSize: 18 }} /> : <ArrowDownIcon sx={{ fontSize: 18 }} />}
                                        </IconButton>
                                      )}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                        <CampaignIcon sx={{ fontSize: 14, color: GOOGLE_GREEN }} />
                                        {c.campaignName}
                                        {campKeywords.length > 0 && (
                                          <Chip label={`${campKeywords.length} keywords`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: `${GOOGLE_GREEN}12`, color: GOOGLE_GREEN, fontWeight: 600, ml: 0.5 }} />
                                        )}
                                      </Box>
                                    </TableCell>
                                    <TableCell align="right">{budget != null ? fmtINR(budget) : '—'}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, color: GOOGLE_GREEN }}>{fmtINR(cost)}</TableCell>
                                    <TableCell align="right">{fmtNum(clicks)}</TableCell>
                                    <TableCell align="right">{fmtNum(c.impressions)}</TableCell>
                                    <TableCell align="right">{fmtPct(c.ctr)}</TableCell>
                                    <TableCell align="right">{fmtINR(c.cpc)}</TableCell>
                                    <TableCell align="right">{fmtNum(conv)}</TableCell>
                                    <TableCell align="right">{costPerConv != null ? fmtINR(costPerConv) : '—'}</TableCell>
                                    <TableCell align="right">{convRate != null ? fmtPct(convRate) : '—'}</TableCell>
                                    <TableCell align="right">{searchIS != null ? fmtPct(searchIS) : '—'}</TableCell>
                                    <TableCell align="right">{lostISRank != null ? fmtPct(lostISRank) : '—'}</TableCell>
                                    <TableCell align="right">{lostISBudget != null ? fmtPct(lostISBudget) : '—'}</TableCell>
                                  </TableRow>
                                  {campKeywords.length > 0 && (
                                    <TableRow>
                                      <TableCell colSpan={14} sx={{ p: 0, border: 0 }}>
                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                          <Box sx={{ mx: 2, mb: 1.5, mt: 0.5 }}>
                                            <Table size="small" sx={{ bgcolor: `${GOOGLE_GREEN}04`, borderRadius: 1, overflow: 'hidden' }}>
                                              <TableHead>
                                                <TableRow>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Keyword</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Match Type</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Status</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Clicks</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Impr.</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">CTR</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Avg. CPC</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Cost</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Conv.</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Cost / Conv.</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Conv. Rate</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Quality Score</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Ad Relevance</TableCell>
                                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Landing Page Exp.</TableCell>
                                                </TableRow>
                                              </TableHead>
                                              <TableBody>
                                                {campKeywords.map((kw, ki) => {
                                                  const kwClicks = Number(kw.clicks) || 0;
                                                  const kwConv = Number(kw.conversions) || 0;
                                                  const kwCost = Number(kw.cost) || 0;
                                                  const kwCostPerConv = kwConv > 0 ? kwCost / kwConv : null;
                                                  const kwConvRate = kwClicks > 0 ? (kwConv / kwClicks) * 100 : null;
                                                  return (
                                                    <TableRow key={kw.criterion_id || ki} hover>
                                                      <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{kw.keyword_text}</TableCell>
                                                      <TableCell><Chip label={kw.match_type} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} /></TableCell>
                                                      <TableCell>
                                                        <Chip label={kw.status} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: kw.status === 'ENABLED' ? '#10b98115' : '#ef444415', color: kw.status === 'ENABLED' ? '#10b981' : '#ef4444' }} />
                                                      </TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtNum(kwClicks)}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtNum(kw.impressions)}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtPct(kw.ctr)}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtINR(kw.cpc)}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem', fontWeight: 600, color: GOOGLE_GREEN }}>{fmtINR(kwCost)}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtNum(kwConv)}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{kwCostPerConv != null ? fmtINR(kwCostPerConv) : '—'}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{kwConvRate != null ? fmtPct(kwConvRate) : '—'}</TableCell>
                                                      <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{kw.quality_score ?? kw.qualityScore ?? '—'}</TableCell>
                                                      <TableCell sx={{ fontSize: '0.75rem' }}>{kw.ad_relevance ?? kw.adRelevance ?? '—'}</TableCell>
                                                      <TableCell sx={{ fontSize: '0.75rem' }}>{kw.landing_page_experience ?? kw.landingPageExperience ?? '—'}</TableCell>
                                                    </TableRow>
                                                  );
                                                })}
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

                  {/* Keywords Table */}
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

                  {/* Campaign Performance Spike Chart */}
                  {dailyMetrics.length > 0 && (() => {
                    // Aggregate all campaigns per date into overall totals
                    const byDate = {};
                    dailyMetrics.forEach(d => {
                      const dt = d.date;
                      if (!byDate[dt]) byDate[dt] = { date: dt, cost: 0, clicks: 0, impressions: 0, conversions: 0 };
                      byDate[dt].cost += Number(d.cost) || 0;
                      byDate[dt].clicks += Number(d.clicks) || 0;
                      byDate[dt].impressions += Number(d.impressions) || 0;
                      byDate[dt].conversions += Number(d.conversions) || 0;
                    });
                    const chartRows = Object.values(byDate)
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map(d => ({
                        ...d,
                        day: new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' }),
                        datePart: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                        label: `${new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
                        cpc: d.clicks > 0 ? d.cost / d.clicks : 0,
                        costPerConv: d.conversions > 0 ? d.cost / d.conversions : 0,
                      }));

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
                      <>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, mt: 2, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                          Campaign Performance
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 1.5, opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartRows} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                              <defs>
                                <linearGradient id="spikeGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={GOOGLE_GREEN} stopOpacity={0.35} />
                                  <stop offset="95%" stopColor={GOOGLE_GREEN} stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                              <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                height={45}
                                tick={({ x, y, payload, index }) => {
                                  const row = chartRows[index];
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
                              <Area type="linear" dataKey="cost" name="Cost" stroke={GOOGLE_GREEN} fill="url(#spikeGrad)" strokeWidth={2.5} dot={{ r: 5, fill: GOOGLE_GREEN, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7, fill: GOOGLE_GREEN, stroke: '#fff', strokeWidth: 2 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Paper>
                      </>
                    );
                  })()}

                  {!summary && !billing && campaignMetrics.length === 0 && dailyMetrics.length === 0 && (
                    <Alert severity="info">No data returned for the selected date range.</Alert>
                  )}
                </Box>
              )}
            </>
          )}

          {/* META TAB — live Meta Marketing API data */}
          {tab === 1 && (() => {
            const metaBilling = metaData?.billing;
            const metaAccount = metaData?.meta_account;
            const metaSummary = metaData?.summary;
            const metaCampaigns = metaData?.campaigns || [];
            const metaDaily = [...(metaData?.daily_trend || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
            const metaLeadForms = metaData?.lead_forms || [];
            const metaLeadsInRange = metaData?.leads_in_range || [];
            const metaEntityCounts = metaData?.entity_counts || {};
            const metaRange = metaData?.range;
            const todaySpend = metaData?.today_spend ?? null;
            const metaCurrency = metaAccount?.currency || client?.meta_ad_account_currency || 'INR';
            const accountStatusMap = { 1: 'ACTIVE', 2: 'DISABLED', 3: 'UNSETTLED', 7: 'PENDING_RISK_REVIEW', 8: 'PENDING_SETTLEMENT', 9: 'IN_GRACE_PERIOD', 100: 'PENDING_CLOSURE', 101: 'CLOSED' };
            const accountStatusLabel = accountStatusMap[metaAccount?.account_status] || (metaAccount?.account_status != null ? `STATUS ${metaAccount.account_status}` : null);
            const isAccountActive = metaAccount?.account_status === 1;

            return (
              <>
                {metaLoading && !metaData && (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <CircularProgress size={32} sx={{ color: META_BLUE }} />
                    <Typography sx={{ mt: 2, color: 'text.secondary' }}>Fetching Meta Ads data...</Typography>
                  </Box>
                )}

                {!metaLoading && metaError && (
                  <Alert severity={metaError.includes('not linked') ? 'info' : 'error'} icon={<FacebookIcon sx={{ color: META_BLUE }} />} sx={{ mb: 2 }}>
                    {metaError}
                  </Alert>
                )}

                {metaData && (
                <Box sx={{ opacity: metaLoading ? 0.55 : 1, pointerEvents: metaLoading ? 'none' : 'auto', transition: 'opacity 0.2s ease' }}>
                {/* Ad Account info (from Client doc) + Analytics meta (range, entities) */}
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: `${META_BLUE}06` }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Page Name</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{client?.meta_pages?.[0]?.page_name || '—'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Ad Account</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{client?.meta_ad_account_name || '—'}</Typography>
                      {client?.meta_ad_account_id && (
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontFamily: 'monospace' }}>{client.meta_ad_account_id}</Typography>
                      )}
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Currency / Time Zone</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {client?.meta_ad_account_currency || '—'} · {client?.meta_ad_account_timezone || '—'}
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
                    <Grid size={{ xs: 12, sm: 6, md: 6 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Lifetime Entities</Typography>
                      <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                        <Chip label={`${metaEntityCounts.campaigns ?? 0} campaigns`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${META_BLUE}15`, color: META_BLUE, fontWeight: 600 }} />
                        <Chip label={`${metaEntityCounts.adsets ?? 0} ad sets`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${COPPER}15`, color: COPPER, fontWeight: 600 }} />
                        <Chip label={`${metaEntityCounts.ads ?? 0} ads`} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: `${BROWN}15`, color: BROWN, fontWeight: 600 }} />
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>

                {/* 3-metric summary band */}
                <Box sx={{ mb: 2 }}>
                  <MetricsBand from={dateFrom} to={dateTo} clientId={clientId} />
                </Box>

                {/* Billing — from meta_account (live ad-account numbers).
                    The backend's getClientAnalytics tries to verify the
                    ad account live with Meta on every request. If that
                    call fails (token expired, network blip, account
                    disabled) the response sets `meta_account.error` and
                    the live numbers (`balance`, `amount_spent`) come
                    back undefined. Render an inline alert in that case
                    so the user sees WHY the billing block is empty
                    instead of a confusingly blank card. */}
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
                      {metaAccount?.error ? (
                        <Alert severity="warning" sx={{ py: 0.5 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            Live billing not available
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem' }}>
                            Couldn't fetch the latest ad account balance from Meta:{' '}
                            <Box component="span" sx={{ fontFamily: 'monospace' }}>{metaAccount.error}</Box>
                          </Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>
                            Most common cause: the System User token expired. Try Resync from Meta or contact your account manager to refresh credentials.
                          </Typography>
                        </Alert>
                      ) : (
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 6, md: 2 }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Today's Spend</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>
                              {todaySpend != null ? fmtINR(todaySpend) : '—'}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 6, md: 2 }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Account Balance</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#f59e0b' }}>
                              {metaAccount?.available_balance != null ? fmtINR(metaAccount.available_balance) : '—'}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 6, md: 2 }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Lifetime Spent</Typography>
                            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: META_BLUE }}>
                              {metaAccount?.amount_spent != null ? fmtINR(metaAccount.amount_spent) : '—'}
                            </Typography>
                          </Grid>
                        </Grid>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Performance Summary */}
                {metaSummary && (
                  <>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                      Performance Summary
                    </Typography>
                    {/* Row 1 — Outcomes (spend + leads with paired CPL) */}
                    <Grid container spacing={1.5} sx={{ mb: 2 }}>
                      {metaSummary.spend != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Spend" value={fmtINR(metaSummary.spend)} color={META_BLUE} icon={<WalletIcon />} /></Grid>}
                      {metaSummary.total_leads != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Total Leads" value={fmtNum(metaSummary.total_leads)} color={META_BLUE} icon={<GroupsIcon />} sublabel={metaSummary.cpl != null ? `${fmtINR(metaSummary.cpl)}/lead` : null} /></Grid>}
                      {metaSummary.form_leads != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="📋 Leads" value={fmtNum(metaSummary.form_leads)} color={COPPER} icon={<GroupsIcon />} sublabel={metaSummary.cpl_form != null ? `${fmtINR(metaSummary.cpl_form)}/lead` : null} /></Grid>}
                      {metaSummary.whatsapp_leads != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="💬 Messages" value={fmtNum(metaSummary.whatsapp_leads)} color={BROWN} icon={<ChatIcon />} sublabel={metaSummary.cpl_whatsapp != null ? `${fmtINR(metaSummary.cpl_whatsapp)}/lead` : null} /></Grid>}
                      {metaSummary.calls != null && metaSummary.calls > 0 && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="📞 Calls" value={fmtNum(metaSummary.calls)} color="#2e7d32" icon={<PeopleIcon />} /></Grid>}
                      {metaSummary.cpl != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CPL (Overall)" value={fmtINR(metaSummary.cpl)} color={META_BLUE} icon={<MoneyIcon />} /></Grid>}
                      {metaSummary.reach != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Reach" value={fmtNum(metaSummary.reach)} color={COPPER} icon={<PeopleIcon />} /></Grid>}
                    </Grid>

                    {/* Row 2 — Engagement & efficiency */}
                    <Grid container spacing={1.5} sx={{ mb: 2 }}>
                      {metaSummary.impressions != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Impressions" value={fmtNum(metaSummary.impressions)} color={META_BLUE} icon={<VisibilityIcon />} /></Grid>}
                      {metaSummary.clicks != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Clicks" value={fmtNum(metaSummary.clicks)} color={COPPER} icon={<TrendingUpIcon />} /></Grid>}
                      {metaSummary.ctr != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CTR" value={fmtPct(metaSummary.ctr)} color={BROWN} icon={<ShowChartIcon />} /></Grid>}
                      {metaSummary.cpc != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CPC" value={fmtINR(metaSummary.cpc)} color={META_BLUE} icon={<MoneyIcon />} /></Grid>}
                      {metaSummary.cpm != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CPM" value={fmtINR(metaSummary.cpm)} color={COPPER} icon={<MoneyIcon />} /></Grid>}
                    </Grid>
                  </>
                )}

                {/* Campaigns */}
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
                            No campaign data for this range
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...metaCampaigns].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)).map(c => {
                          const effStatus = c.effective_status || c.status;
                          const isActive = effStatus === 'ACTIVE';
                          return (
                            <TableRow key={c.campaign_id} hover>
                              <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                  <CampaignIcon sx={{ fontSize: 14, color: META_BLUE }} />
                                  {c.name}
                                </Box>
                              </TableCell>
                              <TableCell>{c.objective ? <Chip label={c.objective} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} /> : '—'}</TableCell>
                              <TableCell>
                                <Chip label={effStatus || '—'} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: isActive ? '#10b98115' : '#ef444415', color: isActive ? '#10b981' : '#ef4444' }} />
                              </TableCell>
                              <TableCell align="right">{c.daily_budget != null ? fmtINR(c.daily_budget) : '—'}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: META_BLUE }}>{fmtINR(c.spend)}</TableCell>
                              <TableCell align="right">{fmtNum(c.impressions)}</TableCell>
                              <TableCell align="right">{fmtNum(c.clicks)}</TableCell>
                              <TableCell align="right">{fmtPct(c.ctr)}</TableCell>
                              <TableCell align="right">{fmtNum(c.leads)}</TableCell>
                              <TableCell align="right">{c.cpl != null && c.cpl > 0 ? fmtINR(c.cpl) : '—'}</TableCell>
                              <TableCell align="right">{fmtNum(c.messaging_conversations_started)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Daily / Hourly Trend Chart */}
                {metaDaily.length > 0 && (() => {
                  // Detect hourly data: either multiple rows sharing the same YYYY-MM-DD, or an `hour` field present, or ISO timestamps with time component.
                  const datesSeen = new Set(metaDaily.map(d => String(d.date).slice(0, 10)));
                  const hasHourField = metaDaily.some(d => d.hour != null);
                  const hasTimeComponent = metaDaily.some(d => String(d.date).includes('T') || String(d.date).includes(':'));
                  const isHourly = hasHourField || (metaDaily.length > 1 && datesSeen.size === 1) || hasTimeComponent;

                  const chartRows = metaDaily.map(d => {
                    const dt = new Date(d.date);
                    const hour = d.hour != null ? Number(d.hour) : dt.getHours();
                    return {
                      ...d,
                      day: dt.toLocaleDateString('en-GB', { weekday: 'short' }),
                      datePart: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                      hourPart: `${String(hour).padStart(2, '0')}:00`,
                      cpl: (Number(d.leads) || 0) > 0 ? (Number(d.spend) || 0) / Number(d.leads) : 0,
                    };
                  });
                  const MetaSpikeTooltip = ({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <Paper sx={{ p: 1.5, minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1, borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 }}>
                          {isHourly ? `${d.hourPart} · ${fmtDate(d.date)}` : `${d.day}, ${fmtDate(d.date)}`}
                        </Typography>
                        {[
                          { label: 'Spend', value: fmtINR(d.spend), color: META_BLUE },
                          { label: 'Impressions', value: fmtNum(d.impressions) },
                          { label: 'Clicks', value: fmtNum(d.clicks) },
                          { label: 'Leads', value: fmtNum(d.leads) },
                          { label: 'CPL', value: d.leads > 0 ? fmtINR(d.cpl) : '—' },
                        ].map((row, i) => (
                          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, mb: 0.4 }}>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{row.label}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: row.color }}>{row.value}</Typography>
                          </Box>
                        ))}
                      </Paper>
                    );
                  };
                  return (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                          Campaign Performance
                        </Typography>
                        {isHourly && (
                          <Chip label="Hourly" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: `${META_BLUE}15`, color: META_BLUE }} />
                        )}
                      </Box>
                      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={chartRows} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                            <defs>
                              <linearGradient id="metaSpikeGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={META_BLUE} stopOpacity={0.35} />
                                <stop offset="95%" stopColor={META_BLUE} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                            <XAxis
                              dataKey={isHourly ? 'hourPart' : 'datePart'}
                              tickLine={false}
                              axisLine={false}
                              height={45}
                              interval={isHourly ? Math.max(0, Math.floor(chartRows.length / 12) - 1) : 0}
                              tick={({ x, y, index }) => {
                                const row = chartRows[index];
                                if (isHourly) {
                                  return (
                                    <g transform={`translate(${x},${y})`}>
                                      <text x={0} y={0} dy={14} textAnchor="middle" fontSize={10.5} fill="#555">{row?.hourPart}</text>
                                    </g>
                                  );
                                }
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={10.5} fill="#555">{row?.datePart}</text>
                                    <text x={0} y={0} dy={25} textAnchor="middle" fontSize={9} fill="#999">({row?.day})</text>
                                  </g>
                                );
                              }}
                            />
                            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `₹${v}`} />
                            <RechartsTooltip content={<MetaSpikeTooltip />} />
                            <Area type="linear" dataKey="spend" stroke={META_BLUE} fill="url(#metaSpikeGrad)" strokeWidth={2.5} dot={{ r: 5, fill: META_BLUE, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7, fill: META_BLUE, stroke: '#fff', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Paper>
                    </>
                  );
                })()}

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
                          {[...metaLeadForms].sort((a, b) => (Number(b.leads_in_range) || 0) - (Number(a.leads_in_range) || 0)).map(f => {
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

                {/* Leads in Range */}
                {metaLeadsInRange.length > 0 && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', borderLeft: `3px solid ${META_BLUE}`, pl: 1.5 }}>
                        Leads ({metaLeadsInRange.length})
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<FileDownloadIcon sx={{ fontSize: 16 }} />}
                          onClick={() => exportLeadsToExcel(metaLeadsInRange, metaAccount, displayName)}
                          sx={{ borderColor: '#10b981', color: '#10b981', '&:hover': { borderColor: '#0e9b6f', bgcolor: '#10b98110' } }}
                        >
                          Excel
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PdfIcon sx={{ fontSize: 16 }} />}
                          onClick={() => exportLeadsToPdf(metaLeadsInRange, metaAccount, displayName)}
                          sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#dc2626', bgcolor: '#ef444410' } }}
                        >
                          PDF
                        </Button>
                      </Box>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <MetaLeadsTable
                        leads={metaLeadsInRange}
                        metaAccount={metaAccount}
                        maxHeight={600}
                        onSaveLead={handleSaveMetaLead}
                        onAddLead={handleAddMetaLead}
                        onDeleteLead={handleDeleteMetaLead}
                        filterPreset={leadsFilterPreset}
                        onFilterPresetConsumed={() => setLeadsFilterPreset(null)}
                      />
                    </Box>
                  </>
                )}

                {!metaSummary && !metaBilling && metaCampaigns.length === 0 && metaDaily.length === 0 && (
                  <Alert severity="info">No Meta data returned for the selected date range.</Alert>
                )}
                </Box>
                )}
              </>
            );
          })()}

          {/* EOD TAB — Daily snapshot + Monthly Abstract, toggled in-tab */}
          {tab === 2 && (
            <AdminEodReportPanel
              clientId={clientId}
              clientName={displayName}
              apiInstance={api}
              onJumpToLeads={(preset) => {
                setLeadsFilterPreset(preset);
                setTab(1);
              }}
            />
          )}

          {/* LEAD CHECK TAB — day-wise lead counts for this client,
              with Daily / Weekly / Monthly preset toggle plus a
              custom from/to range. */}
          {tab === 3 && (
            <LeadCheckPanel clientId={clientId} apiInstance={api} />
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={resyncSnack.open}
        autoHideDuration={resyncSnack.severity === 'info' ? 8000 : 5000}
        onClose={() => setResyncSnack({ ...resyncSnack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setResyncSnack({ ...resyncSnack, open: false })}
          severity={resyncSnack.severity}
          sx={{ width: '100%' }}
        >
          {resyncSnack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Admin EOD panel — Daily snapshot + Monthly Abstract toggle. Mirrors
// the portal's EodReportPanel; kept separate because the admin page
// uses the agency `api` instance instead of the portal's clientApi.
const AdminEodReportPanel = ({ clientId, clientName, apiInstance, onJumpToLeads }) => {
  const [view, setView] = useState('daily');
  const SELECTED = '#8B1F2F';

  const ToggleBtn = ({ value, label }) => {
    const active = view === value;
    return (
      <Button
        size="small"
        onClick={() => setView(value)}
        sx={{
          textTransform: 'none', fontWeight: 700, px: 2, py: 0.6,
          bgcolor: active ? SELECTED : '#fff',
          color: active ? '#fff' : SELECTED,
          border: `1px solid ${SELECTED}`,
          borderRadius: 1,
          minWidth: 110,
          '&:hover': {
            bgcolor: active ? SELECTED : `${SELECTED}10`,
            filter: active ? 'brightness(0.92)' : 'none',
          },
        }}
      >
        {label}
      </Button>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleBtn value="daily" label="Daily EOD" />
        <ToggleBtn value="monthly" label="Monthly Abstract" />
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', ml: 1 }}>
          {view === 'daily'
            ? 'Single-day snapshot — Day vs Target, Appointment Status, Day Summary.'
            : 'Per-day grid for the selected month — sources, calls, appointments, conversion.'}
        </Typography>
      </Box>

      {view === 'daily' ? (
        <TelecallingReport
          clientId={clientId}
          clientName={clientName}
          apiInstance={apiInstance}
          onJumpToLeads={onJumpToLeads}
        />
      ) : (
        <MonthlyAbstract
          clientId={clientId}
          apiInstance={apiInstance}
        />
      )}
    </Box>
  );
};

export default ClientAdDetails;
