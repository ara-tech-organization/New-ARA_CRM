import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Grid, Card, CardContent, Typography, Box, CircularProgress,
  Chip, Avatar, Button, Divider, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert as MuiAlert,
  Tooltip,
} from '@mui/material';
import {
  Facebook, Google, People, Refresh as RefreshIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon,
  EmojiEvents as TrophyIcon,
  Savings as SavingsIcon,
  ReportProblem as ReportProblemIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import { PageLoader } from '../components/Loading';
import { ThemeContext } from '../contexts/ThemeContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { format as fmtDate, parseISO, isValid as isValidDate } from 'date-fns';
import {
  PieChart, Pie, Cell,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
const CLIENT_COLORS = ['#C08552', '#3E2723', '#C08552', '#3E2723', '#C08552', '#3E2723', '#C08552', '#3E2723', '#C08552', '#3E2723'];

// --- Client Performance Card — clickable, navigates to client ads detail page ---
const ClientCard = ({ client, data, color, dateStr, onClick, adsData, metaApi, adsLoading, metaLoading }) => {
  // Prefer live Meta API summary when available; fall back to DailyEntry tracking.
  const metaForm = metaApi?.form_leads != null ? metaApi.form_leads : (data.metaForm || 0);
  const metaWhats = metaApi?.whatsapp_leads != null ? metaApi.whatsapp_leads : (data.metaWhatsapp || 0);
  const metaSpent = metaApi?.spend != null ? metaApi.spend : (data.metaFund || 0);
  const metaCpl = metaApi?.cpl != null ? metaApi.cpl : (data.metaCPL || 0);
  const metaLeads = metaApi?.total_leads != null ? metaApi.total_leads : (metaForm + metaWhats);
  const googleLeads = (data.googleCall || 0) + (data.googleWebsite || 0);
  const totalLeads = metaLeads + googleLeads;
  const isLinked = client.googleAdsEnabled && adsData;
  // Meta ad-account balance from the dashboard-overview API. Anything
  // under ₹1,000 flags a red "Low Balance" chip in the header — pauses
  // are a real risk below that. `null` (not yet fetched) suppresses the
  // chip to avoid a false alarm before the API responds.
  const metaBalance = client.metaEnabled && metaApi?.available_balance != null
    ? Number(metaApi.available_balance)
    : null;
  const isLowBalance = metaBalance != null && metaBalance < 1000;

  const MetricBox = ({ value, label }) => (
    <Box sx={{ flex: 1, textAlign: 'center', py: 0.8, px: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1.5 }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );

  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 16px rgba(192, 133, 82, 0.25)',
          borderColor: color,
        },
      }}>
      {/* Colored header with client name */}
      <Box sx={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
        px: 2, py: 1.2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
          <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {client.name?.charAt(0)}
          </Avatar>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {client.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
          {isLowBalance && (
            <Chip
              label={`LOW BAL ₹${Math.round(metaBalance).toLocaleString('en-IN')}`}
              size="small"
              sx={{
                bgcolor: '#ef4444',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.62rem',
                height: 22,
                letterSpacing: 0.3,
                border: '1px solid #ffffff55',
                '& .MuiChip-label': { px: 0.9 },
              }}
              title={`Meta account balance ₹${metaBalance.toLocaleString('en-IN')} — below ₹1,000 threshold`}
            />
          )}
          <Chip label={dateStr} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
        </Box>
      </Box>

      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* META row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
            <Facebook sx={{ color: '#C08552', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, color: '#C08552', fontSize: '0.78rem' }}>META</Typography>
          </Box>
          <Box sx={{ display: 'flex', flex: 1, gap: 0.8, alignItems: 'center' }}>
            {client.metaEnabled && metaLoading && !metaApi ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'center', py: 0.5 }}>
                <CircularProgress size={14} sx={{ color: '#C08552' }} />
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Loading Meta data…</Typography>
              </Box>
            ) : (
              <>
                <MetricBox value={metaForm} label="Form" />
                <MetricBox value={metaWhats} label="WhatsApp" />
                <MetricBox value={`₹${Number(metaSpent).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} label="Spent" />
                <MetricBox value={`₹${Number(metaCpl).toFixed(0)}`} label="CPL" />
              </>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        {/* GOOGLE row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
            <Google sx={{ color: '#3E2723', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, color: '#3E2723', fontSize: '0.78rem' }}>GOOGLE</Typography>
          </Box>
          <Box sx={{ display: 'flex', flex: 1, gap: 0.8, alignItems: 'center' }}>
            {isLinked ? (() => {
              // Prefer the API's precomputed CTR / CPC; fall back to a
              // local derivation so the card still renders sensible
              // numbers if the summary endpoint doesn't include them.
              const clicks = Number(adsData.totalClicks) || 0;
              const impressions = Number(adsData.totalImpressions) || 0;
              const cost = Number(adsData.totalCost ?? adsData.fund ?? 0);
              const ctr = adsData.ctr != null
                ? Number(adsData.ctr)
                : (impressions > 0 ? (clicks / impressions) * 100 : 0);
              const cpc = adsData.cpc != null
                ? Number(adsData.cpc)
                : (clicks > 0 ? cost / clicks : 0);
              return (
                <>
                  <MetricBox value={`${ctr.toFixed(2)}%`} label="CTR" />
                  <MetricBox value={`₹${cpc.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} label="Avg CPC" />
                  <MetricBox value={clicks.toLocaleString()} label="Clicks" />
                  <MetricBox value={impressions.toLocaleString()} label="Impr." />
                </>
              );
            })() : client.googleAdsEnabled && adsLoading ? (
              // Linked but the analytics fetch is still in flight — show a
              // loader instead of the misleading "Not linked" message.
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'center', py: 0.5 }}>
                <CircularProgress size={14} sx={{ color: '#3E2723' }} />
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Loading Google data…</Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic', textAlign: 'center', width: '100%', py: 0.5 }}>
                Not linked to Google Ads
              </Typography>
            )}
          </Box>
        </Box>

        {/* Total bar at bottom */}
        {totalLeads > 0 && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Total Leads</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`Meta: ${metaLeads}`} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#C0855212', color: '#C08552', fontWeight: 600 }} />
              <Chip label={`Google: ${googleLeads}`} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#3E272312', color: '#3E2723', fontWeight: 600 }} />
              <Chip label={totalLeads} size="small" sx={{ height: 22, fontSize: '0.75rem', bgcolor: `${color}18`, color: color, fontWeight: 700 }} />
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { accentColor } = useContext(ThemeContext);
  const tealAccent = accentColor?.secondary || '#C08552';
  const { todayLeads, clients: cachedClients, todayLeadsLoading: leadsLoading, clientsLoading, refreshAll, fetchTodayLeads, fetchClients } = useDataCache();
  // Trigger fetches now that the cache no longer auto-loads on app mount.
  useEffect(() => {
    fetchTodayLeads();
    fetchClients();
  }, [fetchTodayLeads, fetchClients]);
  // Pull the logged-in user so the hero strip can address them by
  // name; fall back to "there" so the banner never reads "Welcome, "
  // with a blank trailer.
  const { user } = useSelector((state) => state.auth || {});

  // Auto-refresh today's data + clients ONCE per Dashboard mount so the
  // Client-wise Performance cards show fresh today's numbers without the
  // user having to click the Refresh button.
  //
  // Important: we deliberately use the empty-deps form with a
  // stable-ref pattern instead of `[fetchTodayLeads, fetchClients]`.
  // Those callbacks are recreated by `useDataCache` whenever the
  // underlying state changes (todayLeads / clients arrays update on
  // every fetch). Putting them in the dep array caused the effect to
  // fire on every fetch — so each successful fetch immediately kicked
  // off another one, and the page would never settle into a stable
  // state. Pinning the callbacks via refs keeps the effect to a single
  // boot-time call while still allowing the rest of the component to
  // call the latest version of the function on demand.
  const fetchTodayLeadsRef = useRef(fetchTodayLeads);
  const fetchClientsRef = useRef(fetchClients);
  fetchTodayLeadsRef.current = fetchTodayLeads;
  fetchClientsRef.current = fetchClients;
  useEffect(() => {
    fetchTodayLeadsRef.current(true);
    fetchClientsRef.current();
  }, []);

  const [clientSearch, setClientSearch] = useState('');

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(today);

  // Transform clients to simple format
  const clients = useMemo(() =>
    cachedClients.map(c => ({
      _id: c._id,
      name: c.clientName,
      status: c.status,
      googleAdsEnabled: c.googleAdsEnabled || c.google_ads_enabled,
      metaEnabled: c.meta_enabled || c.metaEnabled,
    })),
  [cachedClients]);

  // If the user picks today, use the eager today cache; otherwise fetch on demand.
  const [otherDateLeads, setOtherDateLeads] = useState([]);
  const [otherDateLoading, setOtherDateLoading] = useState(false);
  useEffect(() => {
    if (selectedDate === today) {
      setOtherDateLeads([]);
      return;
    }
    setOtherDateLoading(true);
    api.get('/leads', { params: { date: selectedDate, limit: 10000 } })
      .then(res => {
        const data = res.data?.data || res.data || [];
        setOtherDateLeads(Array.isArray(data) ? data : []);
      })
      .catch(() => setOtherDateLeads([]))
      .finally(() => setOtherDateLoading(false));
  }, [selectedDate, today]);

  const dateLeads = useMemo(
    () => (selectedDate === today ? todayLeads : otherDateLeads),
    [selectedDate, today, todayLeads, otherDateLeads]
  );

  // Fetch Google Ads summary for linked accounts (keyed by clientId)
  const [adsDataMap, setAdsDataMap] = useState({});
  const [adsLoading, setAdsLoading] = useState(false);
  useEffect(() => {
    const hasLinked = cachedClients.some(c => c.googleAdsEnabled || c.google_ads_enabled);
    if (!hasLinked) return;
    setAdsLoading(true);
    api.get('/analytics/clients', { params: { start_date: selectedDate, end_date: selectedDate } })
      .then(res => {
        const list = res.data?.clients || res.data?.data || res.data || [];
        const map = {};
        (Array.isArray(list) ? list : []).forEach(c => { if (c.clientId) map[c.clientId] = c; });
        setAdsDataMap(map);
      })
      .catch(() => {})
      .finally(() => setAdsLoading(false));
  }, [cachedClients, selectedDate]);

  // Fetch Meta Ads summary across all Meta-enabled clients in ONE call.
  // /meta/dashboard-overview aggregates server-side and returns the exact
  // snake_case shape the cards consume. Was previously one analytics call
  // per client (N+1) — see the AdsDashboard-style /meta/clients sibling.
  const [metaDataMap, setMetaDataMap] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);
  useEffect(() => {
    const metaClients = cachedClients.filter(c => c.meta_enabled || c.metaEnabled);
    if (metaClients.length === 0) { setMetaDataMap({}); return; }
    let cancelled = false;
    setMetaLoading(true);
    api.get('/meta/dashboard-overview', { params: { from: selectedDate, to: selectedDate } })
      .then(res => {
        if (cancelled) return;
        const list = res.data?.clients || [];
        const map = {};
        list.forEach(c => { if (c.clientId) map[String(c.clientId)] = c; });
        setMetaDataMap(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMetaLoading(false); });
    return () => { cancelled = true; };
  }, [cachedClients, selectedDate]);

  // Only block the page on essentials (clients list). Everything else loads progressively.
  const initialLoading = clientsLoading && cachedClients.length === 0;
  const loading = leadsLoading || clientsLoading || adsLoading || metaLoading || otherDateLoading;

  const dateByClient = useMemo(() => {
    const map = {};
    dateLeads.forEach(lead => {
      map[lead.clientId] = {
        metaForm: lead.metaFormLead || 0, metaWhatsapp: lead.metaWhatsappLead || 0,
        metaFund: lead.metaFund || 0, metaCPL: lead.metaCpl || 0,
        googleCall: lead.googleCallLead || 0, googleWebsite: lead.googleWebsiteLead || 0,
        googleFund: lead.googleFund || 0, googleCPL: lead.googleCpl || 0,
      };
    });
    return map;
  }, [dateLeads]);

  const emptyData = { metaForm: 0, metaWhatsapp: 0, metaFund: 0, metaCPL: 0, googleCall: 0, googleWebsite: 0, googleFund: 0, googleCPL: 0 };

  // Aggregated totals removed — used to drive the per-platform KPI
  // strip. The two per-client pie charts below carry that breakdown
  // now, so the rollup is unnecessary.

  // `clientsForDisplay` is the subset used by charts / spotlights /
  // ranked client lists. Dropped clients are EXCLUDED here so they
  // don't appear as data points anywhere on the page. The headline
  // KPI cards still count them (via the full `clients` array) so the
  // Inactive Clients card includes dropped — the team treats
  // dropped as a flavor of inactive for the count.
  const clientsForDisplay = useMemo(
    () => clients.filter((c) => c?.status !== 'dropped'),
    [clients]
  );

  // Client mix — used to fill the Total/Active KPI cards with the
  // breakdown of who is connected to which platform. Uses the display
  // list so dropped clients' platform connections don't inflate the
  // Meta / Google / Both chip counts.
  const clientMix = useMemo(() => {
    const metaCount = clientsForDisplay.filter(c => c.metaEnabled).length;
    const googleCount = clientsForDisplay.filter(c => c.googleAdsEnabled).length;
    const bothCount = clientsForDisplay.filter(c => c.metaEnabled && c.googleAdsEnabled).length;
    return { metaCount, googleCount, bothCount };
  }, [clientsForDisplay]);

  // Per-platform pie data — one slice per client whose platform-specific
  // lead count is > 0. Sorted descending so the largest slice anchors
  // the top-right and the labels read nicely. We use a copper-brown
  // alternating palette so the slices feel on-brand rather than
  // generic Recharts default colours.
  const PIE_COLORS = ['#C08552', '#8B1F2F', '#3E2723', '#A0522D', '#D2691E', '#7B3F00', '#B87333', '#5D4037', '#6F4E37', '#996633'];

  // Same fallback chain ClientCard uses: prefer live API counts, then
  // fall back to the DailyEntry tracking docs in dateByClient. Without
  // this the pies would always show 0 on days no one filled in a
  // DailyEntry, even though Meta itself returned leads.
  const metaPieData = useMemo(() => {
    return clientsForDisplay.map((c) => {
      const api = metaDataMap[c._id];
      const d = dateByClient[c._id] || emptyData;
      const value = api?.total_leads != null
        ? Number(api.total_leads) || 0
        : (api?.form_leads != null || api?.whatsapp_leads != null)
          ? (Number(api?.form_leads) || 0) + (Number(api?.whatsapp_leads) || 0)
          : (d.metaForm || 0) + (d.metaWhatsapp || 0);
      return { name: c.name, value };
    }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsForDisplay, dateByClient, metaDataMap]);

  const googlePieData = useMemo(() => {
    return clientsForDisplay.map((c) => {
      const ads = adsDataMap[c._id];
      const d = dateByClient[c._id] || emptyData;
      // /analytics/clients returns totalClicks/totalImpressions/totalCost
      // but NOT a "leads" field for Google — conversions are exposed
      // as totalConversions when tracking is set up. Fall through the
      // chain: explicit totalConversions → conversions → total_leads
      // → DailyEntry tracking (call + website lead counts).
      const apiVal = ads?.totalConversions != null
        ? Number(ads.totalConversions) || 0
        : ads?.conversions != null
          ? Number(ads.conversions) || 0
          : ads?.total_leads != null
            ? Number(ads.total_leads) || 0
            : null;
      const value = apiVal != null
        ? apiVal
        : (d.googleCall || 0) + (d.googleWebsite || 0);
      return { name: c.name, value };
    }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsForDisplay, dateByClient, adsDataMap]);

  // Top clients for table
  const topClients = useMemo(() => {
    return clientsForDisplay.map(c => {
      const d = dateByClient[c._id] || emptyData;
      const meta = (d.metaForm || 0) + (d.metaWhatsapp || 0);
      const google = (d.googleCall || 0) + (d.googleWebsite || 0);
      const total = meta + google;
      const spend = (d.metaFund || 0) + (d.googleFund || 0);
      return { name: c.name, meta, google, total, spend, cpl: total > 0 ? Math.round(spend / total) : 0 };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [clientsForDisplay, dateByClient]);

  if (initialLoading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'active').length;
  // Inactive Clients card bundles together everything that isn't active:
  // 'inactive' / 'pending' / 'suspended' AND 'dropped'. The team treats
  // dropped as a flavor of inactive for the headline count — they're
  // off the active book, the audit trail is the only difference.
  // `clientsForDisplay` (defined above) is the dropped-excluded subset
  // used by charts / spotlights / per-client lists below.
  const inactiveClients = clients.length - activeClients;
  const selDateObj = new Date(selectedDate + 'T00:00:00');
  const dateStr = selDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dateLong = selDateObj.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const isToday = selectedDate === today;

  // ── Today's Spotlights ──────────────────────────────────────────
  // Per-client analytical highlights — surface who's winning and
  // who needs intervention without showing aggregate totals.
  // Computed inline from the data we already fetch (metaDataMap +
  // adsDataMap + DailyEntry tracking).
  const clientStats = clients.map((c) => {
    const meta = metaDataMap[c._id];
    const ads = adsDataMap[c._id];
    const tracking = dateByClient[c._id] || emptyData;
    const metaLeads = meta?.total_leads != null
      ? Number(meta.total_leads) || 0
      : (meta?.form_leads != null || meta?.whatsapp_leads != null)
        ? (Number(meta?.form_leads) || 0) + (Number(meta?.whatsapp_leads) || 0)
        : (tracking.metaForm || 0) + (tracking.metaWhatsapp || 0);
    const googleLeads = ads?.totalConversions != null
      ? Number(ads.totalConversions) || 0
      : (tracking.googleCall || 0) + (tracking.googleWebsite || 0);
    const metaSpend = meta?.spend != null
      ? Number(meta.spend) || 0
      : Number(tracking.metaFund) || 0;
    const googleSpend = ads?.totalCost != null
      ? Number(ads.totalCost) || 0
      : Number(tracking.googleFund) || 0;
    const leads = metaLeads + googleLeads;
    const spend = metaSpend + googleSpend;
    const cpl = leads > 0 ? spend / leads : 0;
    return { id: c._id, name: c.name, leads, spend, cpl };
  });
  // Standout calculations — only consider clients with real activity
  // (leads or spend) so a quiet client doesn't accidentally win.
  const activeStats = clientStats.filter((c) => c.leads > 0 || c.spend > 0);
  const topPerformer = activeStats
    .slice().sort((a, b) => b.leads - a.leads)[0];
  const bestCpl = activeStats
    .filter((c) => c.cpl > 0)
    .slice().sort((a, b) => a.cpl - b.cpl)[0];
  // Needs review: highest CPL among those who got leads, OR a client
  // spending money with zero leads back (the worst case scenario).
  const zeroLeadSpender = activeStats
    .filter((c) => c.leads === 0 && c.spend > 0)
    .slice().sort((a, b) => b.spend - a.spend)[0];
  const worstCpl = activeStats
    .filter((c) => c.cpl > 0)
    .slice().sort((a, b) => b.cpl - a.cpl)[0];
  const needsReview = zeroLeadSpender || worstCpl;

  // ── Needs Attention list ─────────────────────────────────────────
  // Performance alerts only — anything balance-related now lives in the
  // dedicated Low Balance card below. Rule: Meta-linked client with
  // spend today but zero leads back.
  const attentionItems = clients.flatMap((c) => {
    const items = [];
    const meta = metaDataMap[c._id];
    const tracking = dateByClient[c._id] || emptyData;
    const metaLeadsToday = meta?.total_leads != null
      ? Number(meta.total_leads) || 0
      : (tracking.metaForm || 0) + (tracking.metaWhatsapp || 0);
    const metaSpendToday = meta?.spend != null
      ? Number(meta.spend) || 0
      : Number(tracking.metaFund) || 0;
    if (c.metaEnabled && metaSpendToday > 0 && metaLeadsToday === 0) {
      items.push({
        clientId: c._id,
        client: c.name,
        severity: 'warning',
        message: `${c.name} — Meta spend ₹${Math.round(metaSpendToday)} today but 0 leads`,
      });
    }
    return items;
  }).slice(0, 4);

  // ── Low Balance list ─────────────────────────────────────────────
  // Every Meta-linked client whose ad account balance is below ₹2,000.
  // Splits into two visual tiers in the card below:
  //   * Critical  — balance < ₹1,000. Red border + red badge. Ads are
  //                 at real risk of auto-pausing.
  //   * Watch     — ₹1,000 ≤ balance < ₹2,000. Amber border + amber
  //                 badge. Not urgent, but top-up soon.
  // Clients with balance = null (never synced) are excluded so we don't
  // spam the panel with false alarms before the first sync writes a
  // real value.
  const lowBalanceClients = clients
    .map((c) => {
      const bal = metaDataMap[c._id]?.available_balance;
      return {
        id: c._id,
        name: c.name,
        balance: bal != null ? Number(bal) : null,
        metaEnabled: !!c.metaEnabled,
      };
    })
    .filter((c) => c.metaEnabled && c.balance != null && c.balance < 2000)
    .sort((a, b) => a.balance - b.balance);

  // Greeting changes with the hour so it feels alive.
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
    <Box>
      {/* ── Welcome Hero Strip ─────────────────────────────────────
          Sets the tone for the page: personalised greeting on the
          left, controls on the right, and three inline mini-stats
          underneath so the "did today happen" check takes 1 second. */}
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          background: `linear-gradient(135deg, ${tealAccent}10 0%, ${tealAccent}05 50%, transparent 100%)`,
          borderLeft: `4px solid ${tealAccent}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap', gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', lineHeight: 1.1 }}>
                {greeting}, <Box component="span" sx={{ color: tealAccent }}>{userName}</Box>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                {isToday ? "Here's what's happening today" : 'Showing performance for'} — {dateLong}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {/* MUI X DatePicker in en-GB / dd-MM-yyyy. maxDate stops
                  future selections; state still stores ISO YYYY-MM-DD
                  so the rest of the page doesn't need to change. */}
              <Tooltip arrow title="Pick a date to view that day's performance">
                <Box>
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
                        placeholder: 'DD/MM/YYYY',
                        sx: { minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem', bgcolor: 'background.paper' } },
                      },
                    }}
                  />
                </Box>
              </Tooltip>
              {!isToday && (
                <Tooltip arrow title="Jump back to today's view">
                  <Button size="small" variant="outlined" onClick={() => setSelectedDate(today)}>Today</Button>
                </Tooltip>
              )}
              <Tooltip arrow title="Re-fetch latest data from the server">
                <Button
                  variant="contained" size="small"
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                  onClick={refreshAll}
                  disabled={loading}
                  sx={{ bgcolor: tealAccent, '&:hover': { bgcolor: tealAccent, filter: 'brightness(0.92)' } }}
                >
                  Refresh
                </Button>
              </Tooltip>
            </Box>
          </Box>

        </CardContent>
      </Card>

      {/* ── Low Balance (conditional) ──────────────────────────────
          Sits directly under the welcome hero so the ops team sees
          any ad accounts in the ₹0-₹2,000 band the moment they open
          the dashboard. Two visual tiers inside a single alert:
          CRITICAL (< ₹1,000, red) and WATCH (₹1,000-₹1,999, amber).
          Same interaction as the attention items alert — click a row
          to open that client's ads page. */}
      {lowBalanceClients.length > 0 && (() => {
        const criticalCount = lowBalanceClients.filter((c) => c.balance < 1000).length;
        const watchCount = lowBalanceClients.length - criticalCount;
        const alertSeverity = criticalCount > 0 ? 'error' : 'warning';
        const accentColor = criticalCount > 0 ? '#ef4444' : '#f59e0b';
        return (
          <MuiAlert
            severity={alertSeverity}
            icon={<WarningIcon />}
            sx={{
              mb: 2,
              borderLeft: `4px solid ${accentColor}`,
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8, flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                Low Balance —{' '}
                {criticalCount > 0 && (
                  <Box component="span" sx={{ color: '#ef4444' }}>
                    {criticalCount} critical{watchCount > 0 ? ' · ' : ''}
                  </Box>
                )}
                {watchCount > 0 && (
                  <Box component="span" sx={{ color: '#f59e0b' }}>
                    {watchCount} watch
                  </Box>
                )}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                Meta accounts under ₹2,000 · red = under ₹1,000 (auto-pause risk)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {lowBalanceClients.map((c) => {
                const isCritical = c.balance < 1000;
                const tierColor = isCritical ? '#ef4444' : '#f59e0b';
                const hoverBg = isCritical ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)';
                return (
                  <Box
                    key={c.id}
                    onClick={() => navigate(`/client-ads/${c.id}`)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      py: 0.5, px: 1, borderRadius: 1, cursor: 'pointer',
                      '&:hover': { bgcolor: hoverBg },
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tierColor, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.82rem', flex: 1, fontWeight: isCritical ? 600 : 400 }}>
                      {c.name} — Meta balance{' '}
                      <Box component="span" sx={{ color: tierColor, fontWeight: 700 }}>
                        ₹{Math.round(c.balance).toLocaleString('en-IN')}
                      </Box>
                      {isCritical && (
                        <Box component="span" sx={{ color: '#ef4444', fontWeight: 700 }}>
                          {' '}(below ₹1,000, ads may auto-pause)
                        </Box>
                      )}
                    </Typography>
                    <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </Box>
                );
              })}
            </Box>
          </MuiAlert>
        );
      })()}

      {/* ── Needs Attention (conditional) ──────────────────────────
          Only shows when at least one client meets an alert rule
          (e.g. Meta spending but no leads back). Saves "is anything
          on fire" from being a manual scan through every client card. */}
      {attentionItems.length > 0 && (
        <MuiAlert
          severity="warning"
          icon={<WarningIcon />}
          sx={{
            mb: 2,
            borderLeft: '4px solid #f59e0b',
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {attentionItems.length} client{attentionItems.length === 1 ? '' : 's'} need{attentionItems.length === 1 ? 's' : ''} attention
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              Click any item to open that client's ads page
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {attentionItems.map((item, i) => {
              const isError = item.severity === 'error';
              const dotColor = isError ? '#ef4444' : '#f59e0b';
              const hoverBg = isError ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)';
              return (
                <Box
                  key={i}
                  onClick={() => navigate(`/client-ads/${item.clientId}`)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    py: 0.5, px: 1, borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: hoverBg },
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.82rem', flex: 1, fontWeight: isError ? 600 : 400 }}>
                    {item.message}
                  </Typography>
                  <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </Box>
              );
            })}
          </Box>
        </MuiAlert>
      )}


      {/* ── Row 1: Headline KPIs (big cards) — Total Clients, Active
          Clients, Total Leads. Per-platform totals and spend used to
          live here as small cards but were dropped; the charts below
          already show the Meta vs Google split per client, so a flat
          "Meta Leads: N / Google Leads: N / Spend ₹" row was just
          repeating the same info less usefully. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip arrow placement="top" title="Every client on your books, with their platform mix">
          <Card variant="outlined" sx={{ borderLeft: `4px solid ${tealAccent}`, height: '100%', cursor: 'help' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: `${tealAccent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <People sx={{ color: tealAccent, fontSize: 30 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Clients
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.9rem', color: tealAccent, lineHeight: 1.1 }}>
                  {clients.length}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.2, mt: 0.5, flexWrap: 'wrap' }}>
                  <Tooltip arrow title="Clients with a linked Meta ad account"><Chip size="small" label={`Meta: ${clientMix.metaCount}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#C0855215', color: '#C08552', fontWeight: 600 }} /></Tooltip>
                  <Tooltip arrow title="Clients with a linked Google ad account"><Chip size="small" label={`Google: ${clientMix.googleCount}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#3E272315', color: '#3E2723', fontWeight: 600 }} /></Tooltip>
                  <Tooltip arrow title="Clients linked to both Meta and Google"><Chip size="small" label={`Both: ${clientMix.bothCount}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: `${tealAccent}15`, color: tealAccent, fontWeight: 600 }} /></Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip arrow placement="top" title="Clients currently in an Active status">
          <Card variant="outlined" sx={{ borderLeft: `4px solid #10b981`, height: '100%', cursor: 'help' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <People sx={{ color: '#10b981', fontSize: 30 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Active Clients
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.9rem', color: '#10b981', lineHeight: 1.1 }}>
                  {activeClients}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>
                  {clients.length > 0 ? `${Math.round((activeClients / clients.length) * 100)}% of total` : 'No clients yet'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Tooltip arrow placement="top" title="Clients paused or otherwise not Active (dropped clients are excluded entirely)">
          <Card variant="outlined" sx={{ borderLeft: `4px solid #C08552`, height: '100%', cursor: 'help' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: '#C0855215', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <People sx={{ color: '#C08552', fontSize: 30 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Inactive Clients
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.9rem', color: '#C08552', lineHeight: 1.1 }}>
                  {inactiveClients}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>
                  {clients.length > 0 ? `${Math.round((inactiveClients / clients.length) * 100)}% of total` : 'No inactive clients'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
          </Tooltip>
        </Grid>
      </Grid>

      {/* ── Today's Spotlights ─────────────────────────────────────
          Three analytical cards that surface the standout clients
          right now: who's generating the most leads, who's getting
          them cheapest, and who's burning spend without results.
          Each card is clickable and routes straight to that client's
          ads detail page so the user can act in one step. */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          {
            key: 'top',
            label: 'Top Performer Today',
            sub: 'Most leads received',
            tip: 'Client with the highest lead count today',
            icon: <TrophyIcon />,
            color: '#10b981',
            client: topPerformer,
            metric: topPerformer ? `${topPerformer.leads}` : '—',
            metricSub: topPerformer ? 'leads today' : 'No client active yet',
          },
          {
            key: 'cpl',
            label: 'Best Value Today',
            sub: 'Lowest cost per lead',
            tip: 'Client paying the least per lead today',
            icon: <SavingsIcon />,
            color: '#C08552',
            client: bestCpl,
            metric: bestCpl ? `₹${Math.round(bestCpl.cpl).toLocaleString('en-IN')}` : '—',
            metricSub: bestCpl ? `for ${bestCpl.leads} lead${bestCpl.leads === 1 ? '' : 's'}` : 'No spend data yet',
          },
          {
            key: 'review',
            label: 'Needs Review',
            sub: zeroLeadSpender ? 'Spending but no leads back' : 'Highest cost per lead',
            tip: 'Client losing money or paying the most per lead',
            icon: <ReportProblemIcon />,
            color: '#ef4444',
            client: needsReview,
            metric: needsReview
              ? (zeroLeadSpender
                  ? `₹${Math.round(zeroLeadSpender.spend).toLocaleString('en-IN')}`
                  : `₹${Math.round(needsReview.cpl).toLocaleString('en-IN')}`)
              : '—',
            metricSub: needsReview
              ? (zeroLeadSpender ? 'spent, 0 leads' : 'per lead')
              : 'Nothing to flag',
          },
        ].map((s) => (
          <Grid key={s.key} size={{ xs: 12, md: 4 }}>
            <Tooltip arrow placement="top" title={s.tip}>
            <Card
              variant="outlined"
              onClick={() => s.client && navigate(`/client-ads/${s.client.id}`)}
              sx={{
                height: '100%',
                borderLeft: `4px solid ${s.color}`,
                cursor: s.client ? 'pointer' : 'default',
                transition: 'transform 0.15s, box-shadow 0.15s',
                opacity: s.client ? 1 : 0.6,
                '&:hover': s.client
                  ? { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }
                  : {},
              }}
            >
              <CardContent sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.2 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 2,
                    bgcolor: `${s.color}15`, color: s.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {React.cloneElement(s.icon, { sx: { fontSize: 22 } })}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'text.primary', lineHeight: 1.1 }}>
                      {s.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                      {s.sub}
                    </Typography>
                  </Box>
                  {s.client && (
                    <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                  )}
                </Box>
                {s.client ? (
                  <>
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.client.name}>
                      {s.client.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: s.color, lineHeight: 1 }}>
                        {s.metric}
                      </Typography>
                      <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                        {s.metricSub}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: 'text.disabled' }}>
                      {s.metric}
                    </Typography>
                    <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                      {s.metricSub}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
            </Tooltip>
          </Grid>
        ))}
      </Grid>

      {/* ── Row 2: Per-platform donuts — Meta + Google, one slice per
          client. Layout: clean donut on the left with the total in the
          centre, ranked client list on the right (color dot, name,
          count, percentage). Old on-pie labels were unreadable with
          15+ clients; this layout scales cleanly. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            key: 'meta',
            title: 'Meta Leads by Client',
            sub: "Today's Meta leads split per client",
            tip: 'Share of today\'s Meta leads contributed by each client',
            data: metaPieData,
            icon: <Facebook sx={{ fontSize: 16, color: '#C08552' }} />,
            empty: 'No Meta leads today',
          },
          {
            key: 'google',
            title: 'Google Leads by Client',
            sub: "Today's Google leads split per client",
            tip: 'Share of today\'s Google leads contributed by each client',
            data: googlePieData,
            icon: <Google sx={{ fontSize: 16, color: '#3E2723' }} />,
            // Google leads aren't pulled live the way Meta forms are —
            // they come from either the Google Ads `totalConversions`
            // field (needs conversion tracking) or the Daily Entry
            // form (Google Call + Google Website). When both are
            // empty the pie has nothing to draw, so be explicit about
            // where the user would add data.
            empty: 'No Google leads tracked today — add via Daily Entry or set up Google Ads conversion tracking',
          },
        ].map((p) => {
          const total = p.data.reduce((s, x) => s + x.value, 0);
          // `p.data` is already filtered to clients with value > 0, so
          // its length is exactly the count of clients contributing
          // leads today — what the centre label and subtitle show.
          const clientCount = p.data.length;
          return (
            <Grid key={p.key} size={{ xs: 12, lg: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Tooltip arrow placement="top" title={p.tip}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3, cursor: 'help', width: 'fit-content' }}>
                      {p.icon}
                      <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{p.title}</Typography>
                    </Box>
                  </Tooltip>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1.5 }}>
                    {p.sub} · <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{clientCount} client{clientCount === 1 ? '' : 's'} with leads</Box>
                  </Typography>
                  {p.data.length > 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                      {/* Donut — fixed-width column so the right-side
                          list always has room to breathe. */}
                      <Box sx={{ position: 'relative', width: 220, height: 220, flexShrink: 0, mx: { xs: 'auto', sm: 0 } }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={p.data}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={62}
                              outerRadius={100}
                              paddingAngle={2}
                              stroke="none"
                            >
                              {p.data.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(v, n) => [`${v} lead${v === 1 ? '' : 's'}`, n]}
                              contentStyle={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', fontSize: '0.82rem' }}
                              // wrapperStyle lifts the tooltip above the absolutely-
                              // positioned center label below; without it the donut
                              // total ("58 LEADS") sits on top of the tooltip.
                              wrapperStyle={{ zIndex: 20 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Centre label — total leads, big and bold.
                            z-index: 1 sits above the SVG fill but below
                            the tooltip (wrapperStyle z-index 20). */}
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: '1.9rem', lineHeight: 1, color: 'text.primary' }}>
                            {clientCount}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mt: 0.3 }}>
                            {clientCount === 1 ? 'client' : 'clients'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Ranked client list — color dot, name (truncated),
                          count, % of total. Scrolls vertically when there
                          are more than ~8 clients so the card height stays
                          fixed. */}
                      <Box sx={{ flex: 1, minWidth: 0, maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                        {p.data.map((row, i) => {
                          const pct = total > 0 ? (row.value / total) * 100 : 0;
                          const color = PIE_COLORS[i % PIE_COLORS.length];
                          return (
                            <Box
                              key={row.name}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.2,
                                py: 0.6,
                                borderBottom: i === p.data.length - 1 ? 'none' : '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                              <Typography
                                sx={{
                                  flex: 1, minWidth: 0,
                                  fontSize: '0.78rem',
                                  fontWeight: 500,
                                  color: 'text.primary',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={row.name}
                              >
                                {row.name}
                              </Typography>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'text.primary', minWidth: 28, textAlign: 'right' }}>
                                {row.value}
                              </Typography>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', minWidth: 42, textAlign: 'right' }}>
                                {pct.toFixed(1)}%
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography sx={{ color: 'text.secondary' }}>{p.empty}</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Row 3: Client Performance Cards ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Client-wise Performance
          <Typography component="span" sx={{ fontSize: '0.78rem', color: 'text.secondary', ml: 1 }}>
            {clients.length} clients
          </Typography>
        </Typography>
        <TextField
          size="small"
          placeholder="Search clients..."
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> } }}
          sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' } }}
        />
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[...clients].filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase())).sort((a, b) => {
          const aLeads = dateByClient[a._id] ? ((dateByClient[a._id].metaForm || 0) + (dateByClient[a._id].metaWhatsapp || 0) + (dateByClient[a._id].googleCall || 0) + (dateByClient[a._id].googleWebsite || 0)) : 0;
          const bLeads = dateByClient[b._id] ? ((dateByClient[b._id].metaForm || 0) + (dateByClient[b._id].metaWhatsapp || 0) + (dateByClient[b._id].googleCall || 0) + (dateByClient[b._id].googleWebsite || 0)) : 0;
          return bLeads - aLeads;
        }).map((client, i) => (
          <Grid key={client._id} size={{ xs: 12, md: 6, lg: 4 }}>
            <ClientCard
              client={client}
              data={dateByClient[client._id] || emptyData}
              color={CLIENT_COLORS[i % CLIENT_COLORS.length]}
              dateStr={dateStr}
              onClick={() => navigate(`/client-ads/${client._id}`)}
              adsData={adsDataMap[client._id]}
              metaApi={metaDataMap[client._id]}
              adsLoading={adsLoading}
              metaLoading={metaLoading}
            />
          </Grid>
        ))}
        {clients.length === 0 && (
          <Grid size={12}>
            <Card><CardContent sx={{ textAlign: 'center', py: 4 }}><Typography color="text.secondary">No clients found</Typography></CardContent></Card>
          </Grid>
        )}
      </Grid>

      {/* ── Row 4: Top Performing Clients Table ── */}
      {topClients.length > 0 && (
        <Card>
          <CardContent>
            <Tooltip arrow placement="top-start" title="Top clients today, ranked by total leads">
              <Typography sx={{ fontWeight: 600, fontSize: '0.92rem', mb: 1.5, cursor: 'help', display: 'inline-block' }}>
                Top Performing Clients
                <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 1 }}>Ranked by today's leads</Typography>
              </Typography>
            </Tooltip>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Tooltip arrow title="Rank by total leads"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>#</TableCell></Tooltip>
                    <Tooltip arrow title="Client name"><TableCell sx={{ fontWeight: 600, cursor: 'help' }}>Client</TableCell></Tooltip>
                    <Tooltip arrow title="Meta leads today (Form + WhatsApp)"><TableCell sx={{ fontWeight: 600, color: '#C08552', cursor: 'help' }} align="right">Meta</TableCell></Tooltip>
                    <Tooltip arrow title="Google leads today (Call + Website)"><TableCell sx={{ fontWeight: 600, color: '#3E2723', cursor: 'help' }} align="right">Google</TableCell></Tooltip>
                    <Tooltip arrow title="All leads from this client today"><TableCell sx={{ fontWeight: 600, cursor: 'help' }} align="right">Total</TableCell></Tooltip>
                    <Tooltip arrow title="Total ad spend today (₹)"><TableCell sx={{ fontWeight: 600, cursor: 'help' }} align="right">Spend</TableCell></Tooltip>
                    <Tooltip arrow title="Cost per lead = spend ÷ leads"><TableCell sx={{ fontWeight: 600, cursor: 'help' }} align="right">CPL</TableCell></Tooltip>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topClients.map((c, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Chip label={i + 1} size="small" sx={{
                          height: 22, minWidth: 28, fontWeight: 700,
                          bgcolor: i === 0 ? '#ffd70025' : i === 1 ? '#c0c0c025' : i === 2 ? '#cd7f3225' : 'transparent',
                          color: i === 0 ? '#b8860b' : i === 1 ? '#808080' : i === 2 ? '#8b4513' : 'text.secondary',
                          border: i > 2 ? '1px solid' : 'none', borderColor: 'divider',
                        }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 26, height: 26, fontSize: '0.68rem', fontWeight: 700, bgcolor: CLIENT_COLORS[i % CLIENT_COLORS.length] }}>
                            {c.name?.charAt(0)}
                          </Avatar>
                          <Typography sx={{ fontWeight: 500 }}>{c.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#C08552', fontWeight: 600 }}>{c.meta}</TableCell>
                      <TableCell align="right" sx={{ color: '#3E2723', fontWeight: 600 }}>{c.google}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: tealAccent }}>{c.total}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>₹{c.spend.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: c.cpl > 500 ? '#ef4444' : '#10b981' }}>₹{c.cpl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
    </LocalizationProvider>
  );
};

export default Dashboard;
