import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Avatar, Button,
  Tabs, Tab, TextField, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton,
  Alert, Paper, CircularProgress, Collapse,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Facebook as FacebookIcon, Google as GoogleIcon,
  AccountBalanceWallet as WalletIcon, ShowChart as ShowChartIcon,
  Campaign as CampaignIcon, TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon, Refresh as RefreshIcon,
  Link as LinkIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material';
import { PageLoader } from '../components/Loading';
import { useDataCache } from '../contexts/DataCacheContext';
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
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

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
  const { clients, clientsLoading } = useDataCache();
  const [tab, setTab] = useState(0); // 0 = Google, 1 = Meta
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  // Inline Link-to-Google-Ads state (shown when client is not linked)
  const [linkCustomerId, setLinkCustomerId] = useState('');
  const [linkAccountName, setLinkAccountName] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState(null);

  // Find client in cache (may be undefined if cache hasn't loaded — that's OK, we still fetch)
  const client = useMemo(() => clients.find(c => c._id === clientId), [clients, clientId]);

  // Handler to link this client to a Google Ads account
  const handleLinkNow = async () => {
    if (!clientId || !linkCustomerId.trim() || !linkAccountName.trim()) return;
    setLinking(true);
    setLinkMessage(null);
    try {
      await api.put(`/google-ads/client/${clientId}/associate`, {
        customerId: linkCustomerId.trim(),
        accountName: linkAccountName.trim(),
      });
      setLinkMessage({ type: 'success', text: `Linked successfully! Fetching data...` });
      setLinkCustomerId('');
      setLinkAccountName('');
      setTimeout(() => { setLinkMessage(null); fetchGoogleAnalytics({ force: true }); }, 800);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to link account';
      setLinkMessage({ type: 'error', text: msg });
    } finally {
      setLinking(false);
    }
  };

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
        timeout: REQUEST_TIMEOUT_MS,
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
      } else if (err.code === 'ECONNABORTED' || lower.includes('timeout')) {
        setError('Request took too long. Please try again.');
      } else {
        console.error('Failed to fetch Google Ads analytics:', err);
        setError(serverMsg || 'Failed to fetch Google Ads data');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch analytics as soon as we have a clientId — don't wait for the cached client record
  useEffect(() => {
    if (tab === 0 && clientId) {
      fetchGoogleAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, clientId, dateFrom, dateTo]);

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
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={() => fetchGoogleAnalytics({ force: true })}
          disabled={loading || tab !== 0}
        >
          {loading ? 'Syncing...' : 'Refresh'}
        </Button>
      </Box>

      {/* Date Filter */}
      {tab === 0 && (
        <Card variant="outlined" sx={{ mb: 2, position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <LinearProgress
              sx={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 3,
                bgcolor: `${GOOGLE_GREEN}20`,
                '& .MuiLinearProgress-bar': { bgcolor: GOOGLE_GREEN },
              }}
            />
          )}
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
            <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }} disabled={loading} />
            <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }} disabled={loading} />
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
                  bgcolor: GOOGLE_GREEN,
                  color: '#fff',
                  borderColor: GOOGLE_GREEN,
                  '&:hover': { bgcolor: '#2c8f45', borderColor: '#2c8f45' },
                };
                return (
                  <>
                    <Button size="small" variant={isToday ? 'contained' : 'outlined'} disabled={loading} sx={isToday ? activeSx : undefined} onClick={() => { setDateFrom(today); setDateTo(today); }}>Today</Button>
                    <Button size="small" variant={is7 ? 'contained' : 'outlined'} disabled={loading} sx={is7 ? activeSx : undefined} onClick={() => { setDateFrom(iso(d7)); setDateTo(today); }}>Last 7 Days</Button>
                    <Button size="small" variant={is14 ? 'contained' : 'outlined'} disabled={loading} sx={is14 ? activeSx : undefined} onClick={() => { setDateFrom(iso(d14)); setDateTo(today); }}>Last 14 Days</Button>
                    <Button size="small" variant={is30 ? 'contained' : 'outlined'} disabled={loading} sx={is30 ? activeSx : undefined} onClick={() => { setDateFrom(iso(d30)); setDateTo(today); }}>Last 30 Days</Button>
                  </>
                );
              })()}
            </Box>
            {loading && (
              <Chip
                icon={<CircularProgress size={12} sx={{ color: `${GOOGLE_GREEN} !important` }} />}
                label="Fetching data..."
                size="small"
                sx={{ ml: 'auto', bgcolor: `${GOOGLE_GREEN}15`, color: GOOGLE_GREEN, fontWeight: 600, '& .MuiChip-icon': { ml: 1 } }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Card variant="outlined">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)}
            sx={{ px: 2, '& .MuiTabs-indicator': { bgcolor: currentColor, height: 3 }, '& .Mui-selected': { color: `${currentColor} !important` } }}>
            <Tab icon={<GoogleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Google Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab icon={<FacebookIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Meta Ads" sx={{ textTransform: 'none', fontWeight: 600 }} />
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

              {/* Inline Link-to-Google-Ads form (shown when client is not linked) */}
              {!loading && error && error.includes('not linked') && (
                <Paper variant="outlined" sx={{ p: 3, borderLeft: `4px solid ${GOOGLE_GREEN}`, bgcolor: `${GOOGLE_GREEN}04` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <GoogleIcon sx={{ color: GOOGLE_GREEN, fontSize: 24 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Link Google Ads Account</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    <strong>{displayName}</strong> is not yet linked to a Google Ads account. Enter the account details below to start viewing ad performance.
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 5 }}>
                      <TextField
                        fullWidth
                        label="Google Ads Customer ID"
                        value={linkCustomerId}
                        onChange={(e) => setLinkCustomerId(e.target.value)}
                        placeholder="e.g. 2000367396"
                        helperText="10-digit Customer ID (top-right of your Google Ads account)"
                        required
                        disabled={linking}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                      <TextField
                        fullWidth
                        label="Google Ads Account Name"
                        value={linkAccountName}
                        onChange={(e) => setLinkAccountName(e.target.value)}
                        placeholder="e.g. Ad Grohair & Gloskin Karaikudi"
                        helperText="The account name as it appears in Google Ads"
                        required
                        disabled={linking}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleLinkNow}
                        disabled={!linkCustomerId.trim() || !linkAccountName.trim() || linking}
                        startIcon={linking ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}
                        sx={{ bgcolor: GOOGLE_GREEN, '&:hover': { bgcolor: '#2c8f45' }, py: 1.5, mt: 0.5 }}
                      >
                        {linking ? 'Linking...' : 'Link & View'}
                      </Button>
                    </Grid>
                  </Grid>

                  {linkMessage && (
                    <Alert severity={linkMessage.type} sx={{ mt: 2 }}>
                      {linkMessage.text}
                    </Alert>
                  )}
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

          {/* META TAB */}
          {tab === 1 && (
            <Alert severity="info" icon={<FacebookIcon sx={{ color: META_BLUE }} />} sx={{ py: 3 }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Meta Ads API Integration Pending</Typography>
              <Typography variant="body2">
                Once the Meta Marketing API is connected, Meta Ads analytics will display here.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClientAdDetails;
