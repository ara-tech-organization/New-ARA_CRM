import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, Card, CardContent, Typography, Chip, CircularProgress, Snackbar, Alert, Tabs, Tab } from '@mui/material';
import {
  Refresh as RefreshIcon,
  CalendarMonth as DateIcon,
  DashboardOutlined as DashboardTabIcon,
  PeopleAltOutlined as ClientsTabIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { format as fmtDate, parseISO, isValid as isValidDate } from 'date-fns';
import { PageLoader } from '../components/Loading';
import { useDataCache } from '../contexts/DataCacheContext';
import api from '../api/axios';

import ClientSummaryCard from '../components/dashboard/ClientSummaryCard';
import BalanceWatch from '../components/dashboard/BalanceWatch';
import PerformanceInsights from '../components/dashboard/PerformanceInsights';
import ClientOverviewCards from '../components/dashboard/ClientOverviewCards';
import ClientListModal from '../components/dashboard/ClientListModal';
import { AlertsWidget, RecentActivity } from '../components/dashboard/SideWidgets';
import { PALETTE, RADIUS, SHADOW, balanceTier, fmtINR } from '../components/dashboard/theme';

// ─────────────────────────────────────────────────────────────────
// Performance Marketing Command Center — redesigned dashboard.
//
// Data flow overview:
//   1. Clients list comes from DataCacheContext (fetched once).
//   2. `/meta/dashboard-overview` per-day feeds spend / leads / cpl
//      / available_balance per client (Meta side).
//   3. `/meta/clients` (Ads Comparison endpoint) gives Meta ad-
//      account id + cached balance for the modal columns.
//   4. `/analytics/clients` per-day feeds Google spend / clicks /
//      conversions per client + Google customer id.
//
// From those four sources we derive:
//   - Balance Watch tiers
//   - Performance Insights rankings (Top Performer / Best Value /
//     Needs Review)
//   - Meta + Google platform summaries
//   - Client cards + expandable campaign detail
//   - Active Campaigns feed
//   - Recent Activity synthesis (from client createdAt + last sync
//     stamps)
//   - Smart Alerts (balance + spend-no-leads + campaign paused)
// ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  // Selected date drives per-day queries (defaults to today).
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  // Dashboard is Meta-only: Balance Watch, Performance Insights, and
  // Active Campaigns all filter to Meta. Google is intentionally not
  // surfaced here — clients working Google should open their client
  // detail page or the dedicated Ads Comparison module.
  const platform = 'meta';

  // Clients from cache
  const { clients: cachedClients, clientsLoading, fetchClients } = useDataCache();
  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Normalise the clients we care about (agency-facing "active" list,
  // dropped clients hidden).
  const clients = useMemo(() => (
    (cachedClients || [])
      .filter((c) => c.status !== 'dropped')
      .map((c) => ({
        _id: c._id,
        name: c.clientName,
        place: c.place,
        status: c.status || 'active',
        metaEnabled: !!c.meta_enabled,
        googleAdsEnabled: !!c.google_ads_enabled,
        createdAt: c.createdAt,
      }))
  ), [cachedClients]);

  // ── Meta dashboard-overview fetch ───────────────────────────────
  const [metaDataMap, setMetaDataMap] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);
  useEffect(() => {
    const metaClients = clients.filter((c) => c.metaEnabled);
    if (metaClients.length === 0) { setMetaDataMap({}); return; }
    let cancelled = false;
    setMetaLoading(true);
    api.get('/meta/dashboard-overview', { params: { from: selectedDate, to: selectedDate } })
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.clients || [];
        const map = {};
        list.forEach((c) => { if (c.clientId) map[String(c.clientId)] = c; });
        setMetaDataMap(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMetaLoading(false); });
    return () => { cancelled = true; };
  }, [clients, selectedDate]);

  // ── /meta/clients — for cached balances + ad-account IDs ────────
  const [metaAccountsMap, setMetaAccountsMap] = useState({});
  useEffect(() => {
    if (clients.length === 0) return;
    let cancelled = false;
    api.get('/meta/clients', { params: { from: selectedDate, to: selectedDate } })
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.clients || [];
        const map = {};
        list.forEach((c) => {
          if (c.clientId) map[String(c.clientId)] = c;
        });
        setMetaAccountsMap(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [clients, selectedDate]);

  // ── Google analytics/clients fetch ──────────────────────────────
  const [googleDataMap, setGoogleDataMap] = useState({});
  const [googleLoading, setGoogleLoading] = useState(false);
  useEffect(() => {
    const gClients = clients.filter((c) => c.googleAdsEnabled);
    if (gClients.length === 0) { setGoogleDataMap({}); return; }
    let cancelled = false;
    setGoogleLoading(true);
    api.get('/analytics/clients', { params: { start_date: selectedDate, end_date: selectedDate } })
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.clients || res.data?.data || res.data || [];
        const arr = Array.isArray(list) ? list : [];
        const map = {};
        arr.forEach((c) => { if (c.clientId) map[String(c.clientId)] = c; });
        setGoogleDataMap(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setGoogleLoading(false); });
    return () => { cancelled = true; };
  }, [clients, selectedDate]);

  const loading = clientsLoading || metaLoading || googleLoading;

  // ── Derive per-client "row" (used everywhere on the dashboard) ─
  // Each client can have Meta side + Google side. For sections that
  // are strictly per-platform (Balance Watch, Insights, etc.) we
  // emit a separate row per platform. For the Client Overview cards
  // we combine both into a single "both" row.
  const platformRows = useMemo(() => {
    const rows = [];
    clients.forEach((c) => {
      if (c.metaEnabled) {
        const m = metaDataMap[c._id] || {};
        const acc = metaAccountsMap[c._id] || {};
        rows.push({
          id: `${c._id}-meta`,
          clientId: c._id,
          name: c.name,
          status: c.status,
          platform: 'meta',
          spend: Number(m.spend) || 0,
          leads: Number(m.total_leads) || 0,
          cpl: Number(m.cpl) || 0,
          balance: m.available_balance != null ? Number(m.available_balance) : (acc.availableBalance != null ? Number(acc.availableBalance) : null),
          campaigns: Number(acc.activeCampaigns || acc.campaignsCount || acc.campaigns || 0),
          adAccount: acc.metaAdAccountId || '',
          lastSync: acc.fetched_at || acc.updatedAt || null,
        });
      }
      if (c.googleAdsEnabled) {
        const g = googleDataMap[c._id] || {};
        rows.push({
          id: `${c._id}-google`,
          clientId: c._id,
          name: c.name,
          status: c.status,
          platform: 'google',
          spend: Number(g.totalCost) || 0,
          leads: Number(g.totalConversions) || 0,
          cpl: Number(g.totalConversions) > 0 ? Number(g.totalCost) / Number(g.totalConversions) : 0,
          balance: null,
          campaigns: Number(g.activeCampaigns || g.campaignsCount || 0),
          customerId: g.googleAdsCustomerId || '',
          lastSync: g.updatedAt || null,
        });
      }
    });
    rows.forEach((r) => { r.tier = balanceTier(r.balance); });
    return rows;
  }, [clients, metaDataMap, metaAccountsMap, googleDataMap]);

  // Combined per-client rows for Client Overview cards.
  const combinedClientRows = useMemo(() => {
    return clients.map((c) => {
      const meta = platformRows.find((r) => r.clientId === c._id && r.platform === 'meta');
      const google = platformRows.find((r) => r.clientId === c._id && r.platform === 'google');
      const spend = (meta?.spend || 0) + (google?.spend || 0);
      const leads = (meta?.leads || 0) + (google?.leads || 0);
      const cpl = leads > 0 ? spend / leads : 0;
      const balance = meta?.balance ?? google?.balance ?? null;
      const campaigns = (meta?.campaigns || 0) + (google?.campaigns || 0);
      const lastSync = [meta?.lastSync, google?.lastSync].filter(Boolean).sort().pop() || null;
      return {
        id: c._id,
        name: c.name,
        status: c.status,
        platform: (c.metaEnabled && c.googleAdsEnabled) ? 'both' : (c.metaEnabled ? 'meta' : 'google'),
        spend, leads, cpl, balance, campaigns, lastSync,
        campaignDetails: [], // populated on expand — placeholder for now
      };
    });
  }, [clients, platformRows]);

  // ── Aggregates for KPI card ──────────────────────────────────
  // The KPI strip has been collapsed into a single Total Clients
  // card that shows the Meta / Google / Both connected breakdown
  // with cumulative Meta balance where applicable.
  const kpi = useMemo(() => {
    let metaConnected = 0;
    let googleConnected = 0;
    let bothConnected = 0;
    let metaBalanceTotal = 0;
    let bothBalanceTotal = 0;
    let metaBalanceCount = 0;
    let bothBalanceCount = 0;

    clients.forEach((c) => {
      const hasMeta = !!c.metaEnabled;
      const hasGoogle = !!c.googleAdsEnabled;
      if (hasMeta) metaConnected += 1;
      if (hasGoogle) googleConnected += 1;
      if (hasMeta && hasGoogle) bothConnected += 1;

      const metaRow = platformRows.find((r) => r.clientId === c._id && r.platform === 'meta');
      const bal = metaRow?.balance;
      if (bal != null) {
        if (hasMeta) { metaBalanceTotal += bal; metaBalanceCount += 1; }
        if (hasMeta && hasGoogle) { bothBalanceTotal += bal; bothBalanceCount += 1; }
      }
    });

    return {
      totalClients: clients.length,
      metaConnected,
      googleConnected,
      bothConnected,
      metaBalanceTotal: metaBalanceCount > 0 ? metaBalanceTotal : null,
      bothBalanceTotal: bothBalanceCount > 0 ? bothBalanceTotal : null,
    };
  }, [clients, platformRows]);



  // ── Balance Watch data ────────────────────────────────────────
  const balanceClients = useMemo(() => {
    return platformRows
      .filter((r) => r.balance != null)
      .map((r) => ({
        id: r.id,
        clientId: r.clientId,
        name: r.name,
        platform: r.platform,
        balance: r.balance,
        campaigns: r.campaigns,
        tier: r.tier,
      }));
  }, [platformRows]);

  // ── Alerts synthesis ─────────────────────────────────────────
  // Each alert carries a `platform` field so the platform toggle
  // above the widgets can filter alerts down to the active view.
  const alerts = useMemo(() => {
    const arr = [];
    platformRows.forEach((r) => {
      if (r.balance != null && r.balance < 1000) {
        arr.push({
          id: `bal-${r.id}`,
          platform: r.platform,
          text: `${r.name} — Meta balance ${fmtINR(r.balance)}, ads may auto-pause`,
          color: PALETTE.critical,
          clientId: r.clientId,
          rightText: fmtINR(r.balance),
        });
      } else if (r.balance != null && r.balance < 2000) {
        arr.push({
          id: `bal-${r.id}`,
          platform: r.platform,
          text: `${r.name} — balance in watch band`,
          color: PALETTE.warning,
          clientId: r.clientId,
          rightText: fmtINR(r.balance),
        });
      }
      if (r.spend > 0 && r.leads === 0) {
        arr.push({
          id: `zero-${r.id}`,
          platform: r.platform,
          text: `${r.name} spending on ${r.platform === 'meta' ? 'Meta' : 'Google'} but 0 leads back`,
          color: PALETTE.warning,
          clientId: r.clientId,
          rightText: fmtINR(r.spend),
        });
      }
    });
    // Sort critical first
    arr.sort((a, b) => (a.color === PALETTE.critical ? -1 : 1) - (b.color === PALETTE.critical ? -1 : 1));
    return arr.slice(0, 12);
  }, [platformRows]);

  // ── Recent Activity synthesis ────────────────────────────────
  const activity = useMemo(() => {
    const items = [];
    // Newest clients created
    clients
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .forEach((c) => {
        if (c.createdAt) {
          items.push({
            id: `create-${c._id}`,
            kind: 'client_connected',
            text: `${c.name} connected to the CRM`,
            at: c.createdAt,
          });
        }
      });
    // Latest Meta sync
    const metaLastSync = platformRows
      .filter((r) => r.platform === 'meta' && r.lastSync)
      .slice().sort((a, b) => new Date(b.lastSync) - new Date(a.lastSync))[0];
    if (metaLastSync) {
      items.push({
        id: `meta-sync-${metaLastSync.id}`,
        kind: 'meta_sync',
        text: `Meta sync completed for ${metaLastSync.name}`,
        at: metaLastSync.lastSync,
      });
    }
    // Latest Google sync
    const googleLastSync = platformRows
      .filter((r) => r.platform === 'google' && r.lastSync)
      .slice().sort((a, b) => new Date(b.lastSync) - new Date(a.lastSync))[0];
    if (googleLastSync) {
      items.push({
        id: `google-sync-${googleLastSync.id}`,
        kind: 'google_sync',
        text: `Google sync completed for ${googleLastSync.name}`,
        at: googleLastSync.lastSync,
      });
    }
    // Balance updates (any client whose live balance is populated)
    platformRows
      .filter((r) => r.balance != null && r.lastSync)
      .slice().sort((a, b) => new Date(b.lastSync) - new Date(a.lastSync))
      .slice(0, 4)
      .forEach((r) => {
        items.push({
          id: `bal-${r.id}`,
          kind: 'balance_updated',
          text: `${r.name} balance now ${fmtINR(r.balance)}`,
          at: r.lastSync,
        });
      });
    // Deduplicate + sort newest first
    const seen = new Set();
    return items
      .filter((i) => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [clients, platformRows]);

  // ─── Platform-filtered views ─────────────────────────────────
  // Everything below the toggle reads from these instead of the
  // full cross-platform data. Kept as separate memos so the source
  // of truth (platformRows / alerts) stays intact for the modal +
  // client-summary card, which show both platforms.
  const viewPlatformRows = useMemo(
    () => platformRows.filter((r) => r.platform === platform),
    [platformRows, platform],
  );
  const viewBalanceClients = useMemo(
    () => balanceClients.filter((r) => r.platform === platform),
    [balanceClients, platform],
  );
  const viewAlerts = useMemo(
    () => alerts.filter((a) => a.platform === platform),
    [alerts, platform],
  );
  // Per-client cards for the collapsible Client Overview section:
  // one row per client that's actually on the selected platform,
  // metrics narrowed to that platform only.
  const viewClientRows = useMemo(() => (
    viewPlatformRows.map((r) => ({
      id: r.clientId,
      name: r.name,
      status: r.status,
      platform: r.platform,
      spend: r.spend,
      leads: r.leads,
      cpl: r.cpl,
      balance: r.balance,
      campaigns: r.campaigns,
      lastSync: r.lastSync,
      campaignDetails: [],
    }))
  ), [viewPlatformRows]);


  // ── Modal + section state ────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState('all'); // all|meta|google|both
  // 0 = Overview (hero + balance + insights + campaigns + alerts)
  // 1 = Clients (the searchable Client Overview list)
  // Split into a proper tab because users kept missing the Client
  // Overview when it lived at the bottom as a collapsible section.
  const [dashboardTab, setDashboardTab] = useState(0);

  const openClientList = useCallback((filter = 'all') => {
    setModalFilter(filter);
    setModalOpen(true);
  }, []);

  // One row per client — each row carries both Meta and Google
  // balance columns so the modal can render an em-dash where a
  // platform isn't linked. Google balance stays null (not tracked)
  // for now — set it here when a Google balance source lands.
  const modalRows = useMemo(() => (
    clients.map((c) => {
      const meta = platformRows.find((r) => r.clientId === c._id && r.platform === 'meta');
      const google = platformRows.find((r) => r.clientId === c._id && r.platform === 'google');
      const platform = c.metaEnabled && c.googleAdsEnabled ? 'both'
        : c.metaEnabled ? 'meta'
        : c.googleAdsEnabled ? 'google' : '';
      return {
        id: c._id,
        name: c.name,
        status: c.status,
        platform,
        metaBalance: meta?.balance ?? null,
        googleBalance: null, // Google balance concept isn't tracked in the CRM yet
        campaigns: (meta?.campaigns || 0) + (google?.campaigns || 0),
        lastSync: [meta?.lastSync, google?.lastSync].filter(Boolean).sort().pop() || null,
      };
    })
  ), [clients, platformRows]);

  // ── Actions ──────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const showSnack = (message, severity = 'info') => setSnackbar({ open: true, message, severity });

  const handleRefresh = useCallback(() => {
    // Re-trigger fetches by touching selectedDate briefly.
    const stamp = selectedDate;
    setSelectedDate('');
    setTimeout(() => setSelectedDate(stamp), 40);
    showSnack('Dashboard refreshed', 'success');
  }, [selectedDate]);

  const openClientAds = (client) => {
    const id = client.clientId || client.id;
    if (id) navigate(`/client-ads/${id}`);
  };

  // Metadata for the hero strip
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = user?.name || user?.email?.split('@')[0] || 'there';
  const isToday = selectedDate === today;

  if (clientsLoading && cachedClients.length === 0) {
    return <PageLoader message="Loading dashboard…" />;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ bgcolor: PALETTE.ground, minHeight: '100vh', pb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>

          {/* ── Top strip: Hero (left, wide) + Client Summary (right, compact) ── */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
            gap: 1.4,
            alignItems: 'stretch',
          }}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: `${RADIUS.card}px`,
              border: `1px solid ${PALETTE.border}`,
              boxShadow: SHADOW.card,
              overflow: 'hidden',
              background: `linear-gradient(120deg, ${PALETTE.navy} 0%, ${PALETTE.navyDeep} 100%)`,
              color: '#fff',
              position: 'relative',
              // Stretches to match the ClientSummaryCard sibling on
              // wide viewports; contents are vertically centered so
              // the card doesn't feel top-heavy with empty space.
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Decorative gold gradient orb — kept subtle so it
                doesn't fight the content on the right side. */}
            <Box sx={{
              position: 'absolute', top: -50, right: -30,
              width: 180, height: 180, borderRadius: '50%',
              background: `radial-gradient(circle, ${PALETTE.gold}33 0%, transparent 65%)`,
              filter: 'blur(14px)', pointerEvents: 'none',
            }} />
            <CardContent sx={{
              py: 1.8, px: 2.2, position: 'relative',
              flex: 1,
              display: 'flex', alignItems: 'center',
              '&:last-child': { pb: 1.8 },
            }}>
              <Box sx={{
                width: '100%',
                display: 'flex', alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.2,
              }}>
                <Box>
                  <Typography sx={{
                    fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.6px',
                    color: PALETTE.gold, textTransform: 'uppercase', mb: 0.6,
                  }}>
                    Performance Marketing · Command Center
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', lineHeight: 1.1 }}>
                    {greeting}, <Box component="span" sx={{ color: PALETTE.gold }}>{userName}</Box>
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>
                    {isToday ? "Here's what's happening today" : 'Reviewing performance for'}
                    {' — '}{selectedDate ? fmtDate(parseISO(selectedDate), 'EEEE, dd MMM yyyy') : ''}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.6,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    borderRadius: 1.4, px: 1.2, py: 0.4,
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}>
                    <DateIcon sx={{ fontSize: 16, color: PALETTE.gold }} />
                    <DatePicker
                      value={selectedDate ? parseISO(selectedDate) : null}
                      onChange={(d) => {
                        if (!d || !isValidDate(d)) return;
                        const iso = fmtDate(d, 'yyyy-MM-dd');
                        setSelectedDate(iso > today ? today : iso);
                      }}
                      maxDate={parseISO(today)}
                      format="dd/MM/yyyy"
                      slotProps={{
                        textField: {
                          size: 'small',
                          variant: 'standard',
                          InputProps: { disableUnderline: true },
                          sx: {
                            width: 130,
                            // MUI's DatePicker sometimes renders the
                            // populated value through .MuiInputBase-input
                            // (or as a section span in the newer
                            // Field renderer). Cover every selector
                            // with !important so the value stays white
                            // against the navy hero background.
                            '& input, & .MuiInputBase-input, & .MuiPickersInputBase-input, & .MuiPickersInputBase-sectionsContainer, & .MuiPickersSectionList-root': {
                              color: '#fff !important',
                              WebkitTextFillColor: '#fff',
                              caretColor: '#fff',
                              fontWeight: 700,
                              fontSize: '0.86rem',
                              padding: '0 !important',
                            },
                            '& .MuiPickersSectionList-section': { color: '#fff !important' },
                            '& .MuiIconButton-root': { color: PALETTE.gold },
                          },
                        },
                      }}
                    />
                  </Box>
                  <Chip
                    label={loading ? 'Loading…' : 'Live'}
                    size="small"
                    icon={loading ? <CircularProgress size={12} sx={{ color: '#fff !important' }} /> : undefined}
                    sx={{
                      bgcolor: loading ? PALETTE.warning : PALETTE.healthy,
                      color: '#fff', fontWeight: 800, fontSize: '0.7rem',
                      height: 26, px: 0.6,
                    }}
                  />
                  <Box
                    onClick={handleRefresh}
                    role="button"
                    tabIndex={0}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.6,
                      cursor: 'pointer',
                      bgcolor: PALETTE.gold, color: PALETTE.navy,
                      borderRadius: 1.4, px: 1.4, height: 34,
                      fontWeight: 800, fontSize: '0.82rem',
                      boxShadow: `0 6px 16px ${PALETTE.gold}66`,
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: PALETTE.goldDeep, transform: 'translateY(-1px)' },
                    }}
                  >
                    <RefreshIcon sx={{ fontSize: 16 }} /> Refresh
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Compact Client Summary — right-side card in the top strip */}
          <ClientSummaryCard
            totalClients={kpi.totalClients}
            metaConnected={kpi.metaConnected}
            bothConnected={kpi.bothConnected}
            onOpenList={(filter) => openClientList(filter)}
          />
          </Box>

          {/* ── Section tabs — Overview vs Clients ───────────────
              Client Overview used to sit at the bottom as a collapsed
              card and most people missed it. Promoting it to a proper
              tab makes the "full client list" discoverable at a
              glance. */}
          <Box sx={{
            bgcolor: PALETTE.surface,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: `${RADIUS.card}px`,
            boxShadow: SHADOW.card,
            px: 0.5,
          }}>
            <Tabs
              value={dashboardTab}
              onChange={(_, v) => setDashboardTab(v)}
              sx={{
                minHeight: 44,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  minHeight: 44,
                  color: PALETTE.inkMuted,
                  gap: 0.6,
                },
                '& .Mui-selected': { color: PALETTE.navy },
                '& .MuiTabs-indicator': {
                  backgroundColor: PALETTE.gold, height: 3, borderRadius: 3,
                },
              }}
            >
              <Tab
                iconPosition="start"
                icon={<DashboardTabIcon sx={{ fontSize: 18 }} />}
                label="Overview"
              />
              <Tab
                iconPosition="start"
                icon={<ClientsTabIcon sx={{ fontSize: 18 }} />}
                label={`Clients · ${combinedClientRows.length}`}
              />
            </Tabs>
          </Box>

          {dashboardTab === 0 && (
            <>
              {/* ── Balance Watch (Meta ad-account balance tiers) ── */}
              <BalanceWatch
                clients={viewBalanceClients}
                onClientClick={openClientAds}
                onViewAll={() => openClientList('all')}
              />

              {/* ── Performance Insights ──────────────────────────── */}
              <PerformanceInsights
                clients={viewPlatformRows}
                onClientClick={openClientAds}
              />

              {/* ── Alerts + Recent Activity ────────────────────────
                  Previously the right-hand sidebar next to Active
                  Campaigns. With Campaigns removed we lay them out
                  side-by-side so they share the full row width. */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
                gap: 1.4,
                minWidth: 0,
              }}>
                <AlertsWidget alerts={viewAlerts} onAlertClick={openClientAds} />
                <RecentActivity items={activity} />
              </Box>
            </>
          )}

          {dashboardTab === 1 && (
            /* Client Overview is deliberately cross-platform — every
               client shows up once with Meta + Google metrics merged,
               independent of the Meta/Google filter that scopes the
               Overview tab's widgets. Managers use this list to see
               the entire book at once. */
            <ClientOverviewCards
              clients={combinedClientRows}
              onOpenClient={openClientAds}
            />
          )}

        </Box>

        {/* ── Modal ────────────────────────────────────────── */}
        <ClientListModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          rows={modalRows}
          defaultFilter={modalFilter}
        />

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3200}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            variant="filled"
            sx={{ fontWeight: 600 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default Dashboard;
