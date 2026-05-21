import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardContent, Typography, Box, CircularProgress,
  Chip, Avatar, Button, Divider, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Facebook, Google, People, Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import { PageLoader } from '../components/Loading';
import { ThemeContext } from '../contexts/ThemeContext';
import { useDataCache } from '../contexts/DataCacheContext';
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
            {client.name?.charAt(0)}
          </Avatar>
          <Typography sx={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 700, fontSize: '0.92rem', color: 'white' }}>
            {client.name}
          </Typography>
        </Box>
        <Chip label={dateStr} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
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

  // Fetch Meta Ads summary per Meta-enabled client (keyed by clientId)
  const [metaDataMap, setMetaDataMap] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);
  useEffect(() => {
    const metaClients = cachedClients.filter(c => c.meta_enabled || c.metaEnabled);
    if (metaClients.length === 0) { setMetaDataMap({}); return; }
    let cancelled = false;
    setMetaLoading(true);
    Promise.allSettled(
      metaClients.map(c =>
        api.get(`/meta/client/${c._id}/analytics`, { params: { from: selectedDate, to: selectedDate } })
          .then(res => ({ clientId: c._id, summary: res.data?.summary }))
      )
    ).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value?.summary) map[r.value.clientId] = r.value.summary;
      });
      setMetaDataMap(map);
    }).finally(() => { if (!cancelled) setMetaLoading(false); });
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

  // Client mix — used to fill the Total/Active KPI cards with the
  // breakdown of who is connected to which platform.
  const clientMix = useMemo(() => {
    const metaCount = clients.filter(c => c.metaEnabled).length;
    const googleCount = clients.filter(c => c.googleAdsEnabled).length;
    const bothCount = clients.filter(c => c.metaEnabled && c.googleAdsEnabled).length;
    return { metaCount, googleCount, bothCount };
  }, [clients]);

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
    return clients.map((c) => {
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
  }, [clients, dateByClient, metaDataMap]);

  const googlePieData = useMemo(() => {
    return clients.map((c) => {
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
  }, [clients, dateByClient, adsDataMap]);

  // Top clients for table
  const topClients = useMemo(() => {
    return clients.map(c => {
      const d = dateByClient[c._id] || emptyData;
      const meta = (d.metaForm || 0) + (d.metaWhatsapp || 0);
      const google = (d.googleCall || 0) + (d.googleWebsite || 0);
      const total = meta + google;
      const spend = (d.metaFund || 0) + (d.googleFund || 0);
      return { name: c.name, meta, google, total, spend, cpl: total > 0 ? Math.round(spend / total) : 0 };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [clients, dateByClient]);

  if (initialLoading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'active').length;
  const selDateObj = new Date(selectedDate + 'T00:00:00');
  const dateStr = selDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dateLong = selDateObj.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const isToday = selectedDate === today;

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            {isToday ? "Today's" : ''} Client Performance — {dateLong}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="date"
            size="small"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, input: { max: today } }}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' } }}
          />
          {!isToday && (
            <Button size="small" variant="outlined" onClick={() => setSelectedDate(today)}>Today</Button>
          )}
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={refreshAll} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* ── Row 1: Headline KPIs (big cards) — Total Clients, Active
          Clients, Total Leads. Per-platform totals and spend used to
          live here as small cards but were dropped; the charts below
          already show the Meta vs Google split per client, so a flat
          "Meta Leads: N / Google Leads: N / Spend ₹" row was just
          repeating the same info less usefully. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card variant="outlined" sx={{ borderLeft: `4px solid ${tealAccent}`, height: '100%' }}>
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
                  <Chip size="small" icon={<Facebook sx={{ fontSize: 13, color: '#C08552 !important' }} />} label={`Meta: ${clientMix.metaCount}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#C0855215', color: '#C08552', fontWeight: 600 }} />
                  <Chip size="small" icon={<Google sx={{ fontSize: 13, color: '#3E2723 !important' }} />} label={`Google: ${clientMix.googleCount}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#3E272315', color: '#3E2723', fontWeight: 600 }} />
                  <Chip size="small" label={`Both: ${clientMix.bothCount}`} sx={{ height: 22, fontSize: '0.7rem', bgcolor: `${tealAccent}15`, color: tealAccent, fontWeight: 600 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card variant="outlined" sx={{ borderLeft: `4px solid #10b981`, height: '100%' }}>
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
                  {clients.length > 0 ? `${Math.round((activeClients / clients.length) * 100)}% of total · ${clients.length - activeClients} inactive` : 'No clients yet'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
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
            data: metaPieData,
            icon: <Facebook sx={{ fontSize: 16, color: '#C08552' }} />,
            empty: 'No Meta leads today',
          },
          {
            key: 'google',
            title: 'Google Leads by Client',
            sub: "Today's Google leads split per client",
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
          return (
            <Grid key={p.key} size={{ xs: 12, lg: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                    {p.icon}
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{p.title}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1.5 }}>
                    {p.sub} · <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{total} total</Box>
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
                            {total}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mt: 0.3 }}>
                            leads
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
            <Typography sx={{ fontWeight: 600, fontSize: '0.92rem', mb: 1.5 }}>
              Top Performing Clients
              <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 1 }}>Ranked by today's leads</Typography>
            </Typography>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#C08552' }} align="right">Meta</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#3E2723' }} align="right">Google</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Spend</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">CPL</TableCell>
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
  );
};

export default Dashboard;
