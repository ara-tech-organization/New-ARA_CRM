import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Paper, Chip,
  LinearProgress, CircularProgress, Alert, Button, Tooltip,
} from '@mui/material';
import {
  WhatsApp as WhatsAppIcon,
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  Google as GoogleIcon,
  Phone as PhoneIcon,
  PhoneInTalk as PhoneInTalkIcon,
  EventAvailable as AppointmentIcon,
  CheckCircle as CheckIcon,
  Group as LeadIcon,
  TrendingUp as TrendIcon,
  OpenInNew as OpenInNewIcon,
  Assessment as ReportIcon,
  Add as AddIcon,
} from '@mui/icons-material';

// PortalDashboardToday — the landing page for the client portal sidebar.
// Renders TODAY's snapshot from the telecalling-report endpoint
// (same source the EOD tab consumes) so the moment a telecaller saves
// a WhatsApp lead or a call response, it shows up here within 30s.
//
// Props:
//   clientId, apiInstance, displayName
//
// Layout:
//   row 1 — six KPI tiles (Total Leads / Connected / Appointments /
//           Consulted / Total Calls / Conversion).
//   row 2 — three source-breakdown cards (Meta, WhatsApp, Other) with
//           per-platform counts and a "view leads" jump.
//   row 3 — Response breakdown (badge grid) + Appointment status today.

// The client portal was dominated by navy primary — swapped this
// accent to the brand's gold secondary so header borders, buttons,
// progress bar, and mini highlight tiles carry the secondary colour
// and break up the navy-heavy shell above/around them.
const MAROON = '#F4B929';
// Ink for surfaces painted with MAROON where white text was used
// before. Gold + dark text keeps WCAG contrast readable.
const MAROON_INK = '#0F172A';

const SOURCE_CARDS = [
  // (label, key into leads_abstract, icon, accent colour)
  { key: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon, color: '#25D366' },
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon, color: '#E4405F' },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon, color: '#1877F2' },
  { key: 'google_lead', label: 'Google Lead', Icon: GoogleIcon, color: '#4285F4' },
];

const fmt = (n) => Number(n ?? 0).toLocaleString('en-IN');
const pct = (n) => `${Number(n ?? 0).toFixed(0)}%`;

// `change` is the day-over-day delta (today − yesterday). When set,
// a small coloured badge with ▲/▼/· appears below the metric.
// `lowerIsBetter` flips the colour scheme (e.g. for Not Connected,
// where down is good).
const KpiTile = ({ label, value, sub, color, Icon, onClick, change, lowerIsBetter }) => (
  <Card
    variant="outlined"
    onClick={onClick}
    sx={{
      height: '100%',
      borderLeft: `4px solid ${color}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.15s, box-shadow 0.15s',
      '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' } : {},
    }}
  >
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
      <Box sx={{
        width: 44, height: 44, borderRadius: 2,
        bgcolor: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon sx={{ color, fontSize: 22 }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color, lineHeight: 1.1 }}>
            {value}
          </Typography>
          {change != null && (() => {
            const up = change > 0;
            const flat = change === 0;
            const good = flat ? null : (lowerIsBetter ? !up : up);
            const bg = flat ? '#9ca3af' : (good ? '#10b981' : '#ef4444');
            const arrow = flat ? '·' : (up ? '▲' : '▼');
            return (
              <Tooltip arrow title={`${flat ? 'No change' : (up ? '+' + change : change)} vs yesterday`}>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.2,
                  px: 0.6, py: 0.1, borderRadius: 0.8,
                  bgcolor: `${bg}15`, color: bg,
                  fontSize: '0.7rem', fontWeight: 800, cursor: 'help',
                }}>
                  {arrow} {Math.abs(change)}
                </Box>
              </Tooltip>
            );
          })()}
        </Box>
        {sub && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            {sub}
          </Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const SourceCard = ({ label, count, Icon, color, onJump }) => (
  <Paper
    variant="outlined"
    onClick={() => onJump && onJump()}
    sx={{
      p: 1.5, height: '100%', cursor: onJump ? 'pointer' : 'default',
      transition: 'background-color 0.15s, border-color 0.15s',
      borderLeft: `3px solid ${color}`,
      '&:hover': onJump ? { backgroundColor: `${color}08`, borderColor: color } : {},
      display: 'flex', alignItems: 'center', gap: 1.2,
    }}
  >
    <Box sx={{
      width: 36, height: 36, borderRadius: 1.5,
      bgcolor: `${color}15`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon sx={{ color, fontSize: 20 }} />
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#111', lineHeight: 1.1 }}>
        {fmt(count)}
      </Typography>
    </Box>
    {onJump && <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
  </Paper>
);

const PortalDashboardToday = ({ clientId, apiInstance, displayName }) => {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [yesterdayReport, setYesterdayReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bgRefreshing, setBgRefreshing] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const todayPretty = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  // Time-of-day greeting so the hero feels alive — Good morning before
  // noon, afternoon up to 5pm, then evening.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const fetchReport = useCallback(async ({ silent = false } = {}) => {
    if (!clientId || !apiInstance) return;
    if (silent) setBgRefreshing(true); else setLoading(true);
    setError('');
    try {
      // Fetch today + yesterday in parallel — yesterday powers the
      // vs-yesterday comparison badges on the KPI tiles.
      const [todayRes, yRes] = await Promise.allSettled([
        apiInstance.get(`/meta/client/${clientId}/telecalling-report`, { params: { date: today } }),
        apiInstance.get(`/meta/client/${clientId}/telecalling-report`, { params: { date: yesterday } }),
      ]);
      if (todayRes.status === 'fulfilled') setReport(todayRes.value.data || null);
      else throw todayRes.reason;
      if (yRes.status === 'fulfilled') setYesterdayReport(yRes.value.data || null);
    } catch (err) {
      console.error('dashboard fetch failed', err);
      if (!silent) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard');
      }
    } finally {
      if (silent) setBgRefreshing(false); else setLoading(false);
    }
  }, [clientId, apiInstance, today, yesterday]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // 30s silent auto-refresh — keeps the dashboard live so a telecaller
  // adding a WhatsApp lead in the leads table surfaces here within 30s.
  const fetchRef = useRef(fetchReport);
  fetchRef.current = fetchReport;
  useEffect(() => {
    const id = setInterval(() => fetchRef.current({ silent: true }), 30000);
    return () => clearInterval(id);
  }, []);

  const jumpToLeads = (filterPreset) => {
    navigate('/client-portal/leads', filterPreset ? { state: { filterPreset } } : undefined);
  };

  if (loading && !report) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress sx={{ color: MAROON }} />
        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading today's snapshot…</Typography>
      </Box>
    );
  }

  if (error && !report) {
    return <Alert severity="error">{error}</Alert>;
  }

  const day = report?.day || {};
  const abstract = day.leads_abstract || {};
  const calls = day.calls || {};
  const consult = day.consultation || {};

  const totalLeads = abstract.total || 0;
  const connectedLeads = abstract.connected || 0;
  const notConnected = abstract.not_connected || 0;
  const connectedPct = abstract.connected_pct || 0;
  const appointmentsBooked = day.appointments_booked || 0;
  const totalCalls = calls.total || 0;
  const connectedCalls = calls.connected_total || 0;
  const consultedToday = consult.consulted || 0;
  const convertedToday = consult.converted || 0;

  // ── Yesterday comparison deltas ────────────────────────────────
  // Each delta is "today − yesterday"; the KpiTile renders it as a
  // ▲/▼ badge in green or red. Plain object (no useMemo) since this
  // sits *after* the early-return guards above and hooks must stay
  // in a stable order.
  const yDay = yesterdayReport?.day || null;
  const yAbs = yDay?.leads_abstract || {};
  const yCalls = yDay?.calls || {};
  const yConsult = yDay?.consultation || {};
  const deltas = yDay ? {
    totalLeads: totalLeads - (yAbs.total || 0),
    connectedLeads: connectedLeads - (yAbs.connected || 0),
    totalCalls: totalCalls - (yCalls.total || 0),
    appointmentsBooked: appointmentsBooked - (yDay.appointments_booked || 0),
    consultedToday: consultedToday - (yConsult.consulted || 0),
    convertedToday: convertedToday - (yConsult.converted || 0),
  } : {};

  // Yesterday + today from the appointment_status array, for the bottom strip.
  const appts = report?.appointment_status || [];
  const todayApptRow = appts.find((r) => r.offset === 0) || {};
  const futureAppts = appts.filter((r) => r.offset > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Hero strip — gradient banner with personalised greeting +
          live indicator + Refresh + quick action shortcuts to the
          three most common workflows (Open Leads, Add Lead, EOD). */}
      <Card
        variant="outlined"
        sx={{
          background: `linear-gradient(135deg, ${MAROON}15 0%, ${MAROON}05 50%, transparent 100%)`,
          borderLeft: `4px solid ${MAROON}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ minWidth: 220, flex: 1 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {greeting}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: MAROON, lineHeight: 1.1 }}>
                {displayName || 'Client Portal'}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mt: 0.3 }}>
                {todayPretty} · Here's how your day is shaping up
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Tooltip arrow title="The dashboard refreshes itself every 30 seconds">
                <Chip
                  icon={
                    bgRefreshing
                      ? <CircularProgress size={12} sx={{ color: '#10b981 !important' }} />
                      : <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981', mx: 0.5 }} />
                  }
                  label={bgRefreshing ? 'Refreshing…' : 'Live · auto-refresh 30s'}
                  size="small"
                  sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.72rem', height: 28, cursor: 'help' }}
                />
              </Tooltip>
              <Tooltip arrow title="Re-fetch the latest numbers now">
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => fetchReport()}
                  sx={{
                    // Gold background → dark text for contrast.
                    bgcolor: MAROON, color: MAROON_INK,
                    '&:hover': { bgcolor: MAROON, filter: 'brightness(0.92)' },
                  }}
                >
                  Refresh
                </Button>
              </Tooltip>
            </Box>
          </Box>

          {/* Quick action shortcuts */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            <Tooltip arrow title="Open the full leads table">
              <Button
                size="small"
                startIcon={<LeadIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/client-portal/leads')}
                sx={{
                  bgcolor: '#fff', color: MAROON, fontWeight: 700, textTransform: 'none',
                  border: `1px solid ${MAROON}30`,
                  '&:hover': { bgcolor: `${MAROON}08`, borderColor: MAROON },
                }}
              >
                Open Leads
              </Button>
            </Tooltip>
            <Tooltip arrow title="Add a new WhatsApp / manual lead">
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/client-portal/leads', { state: { openAdd: true } })}
                sx={{
                  bgcolor: '#fff', color: '#25D366', fontWeight: 700, textTransform: 'none',
                  border: '1px solid #25D36640',
                  '&:hover': { bgcolor: '#25D36608', borderColor: '#25D366' },
                }}
              >
                Add Lead
              </Button>
            </Tooltip>
            <Tooltip arrow title="View the EOD Report — full daily snapshot">
              <Button
                size="small"
                startIcon={<ReportIcon sx={{ fontSize: 16 }} />}
                onClick={() => {
                  // The EOD Report lives at tab 4 inside the portal shell.
                  // Going to /client-portal triggers the default tab (Dashboard)
                  // unless we hash; the parent page reads ?tab if present.
                  navigate('/client-portal?tab=4');
                }}
                sx={{
                  bgcolor: '#fff', color: '#B45309', fontWeight: 700, textTransform: 'none',
                  border: '1px solid #B4530940',
                  '&:hover': { bgcolor: '#B4530908', borderColor: '#B45309' },
                }}
              >
                EOD Report
              </Button>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Row 1 — six big KPI tiles */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <KpiTile
            label="Total Leads"
            value={fmt(totalLeads)}
            sub="today"
            color="#1877F2"
            Icon={LeadIcon}
            change={deltas.totalLeads}
            onClick={() => jumpToLeads()}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <KpiTile
            label="Connected"
            value={fmt(connectedLeads)}
            sub={`${pct(connectedPct)} of valid`}
            color="#10b981"
            Icon={CheckIcon}
            change={deltas.connectedLeads}
            onClick={() => jumpToLeads({ callLabel: ['CONNECTED'] })}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <KpiTile
            label="Total Calls"
            value={fmt(totalCalls)}
            sub={`${fmt(connectedCalls)} connected`}
            color="#7E22CE"
            Icon={PhoneIcon}
            change={deltas.totalCalls}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <KpiTile
            label="Appointments"
            value={fmt(appointmentsBooked)}
            sub="booked today"
            color="#F59E0B"
            Icon={AppointmentIcon}
            change={deltas.appointmentsBooked}
            onClick={() => jumpToLeads({ appointment: ['APPOINTMENT BOOKED', 'RESCHEDULED', 'COMPLETED'] })}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <KpiTile
            label="Consulted"
            value={fmt(consultedToday)}
            sub="today"
            color={MAROON}
            Icon={PhoneInTalkIcon}
            change={deltas.consultedToday}
            onClick={() => jumpToLeads({ response: ['CONSULTED'] })}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <KpiTile
            label="Conversions"
            value={fmt(convertedToday)}
            sub="treatment booked"
            color="#0e7c4a"
            Icon={TrendIcon}
            change={deltas.convertedToday}
            onClick={() => jumpToLeads({ response: ['TREATMENT BOOKED', 'CLOSED'] })}
          />
        </Grid>
      </Grid>

      {/* Row 2 — Lead sources today */}
      <Card variant="outlined">
        <CardContent sx={{ pt: 1.5, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: MAROON, borderLeft: `3px solid ${MAROON}`, pl: 1.2 }}>
              Leads by Source — Today
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              Click a source to filter the leads table
            </Typography>
          </Box>
          <Grid container spacing={1}>
            {SOURCE_CARDS.map((s) => (
              <Grid key={s.key} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                <SourceCard
                  label={s.label}
                  count={abstract[s.key]}
                  Icon={s.Icon}
                  color={s.color}
                  onJump={() => jumpToLeads({ source: [s.key] })}
                />
              </Grid>
            ))}
            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <SourceCard
                label="Walk-In / Referral"
                count={(abstract.walk_in || 0) + (abstract.referral || 0)}
                Icon={LeadIcon}
                color="#6B7280"
                onJump={() => jumpToLeads({ source: ['walk_in', 'referral'] })}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <SourceCard
                label="Incall"
                count={abstract.incall}
                Icon={PhoneIcon}
                color="#0EA5E9"
                onJump={() => jumpToLeads({ source: ['incall_google', 'incall_fb', 'incall_insta', 'incall_self'] })}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Row 3 — Two-column: Call breakdown + Appointment status */}
      <Grid container spacing={1.5}>
        {/* Call breakdown */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: MAROON, borderLeft: `3px solid ${MAROON}`, pl: 1.2, mb: 1.5 }}>
                Call Activity Today
              </Typography>
              <Grid container spacing={1}>
                <Grid size={6}>
                  <Box sx={{ p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>Fresh Calls</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#111' }}>{fmt(calls.fresh)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{fmt(calls.fresh_connected)} connected</Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ p: 1.5, bgcolor: '#F9FAFB', borderRadius: 1 }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>Call Backs</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#111' }}>{fmt(calls.callback)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{fmt(calls.callback_connected)} connected</Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ p: 1.5, bgcolor: '#10b98108', borderRadius: 1, border: '1px solid #10b98130' }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#0e7c4a', textTransform: 'uppercase' }}>Connected</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#10b981' }}>{fmt(connectedLeads)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>leads picked up</Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ p: 1.5, bgcolor: '#FEE2E208', borderRadius: 1, border: '1px solid #FEE2E2' }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Not Connected</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#b91c1c' }}>{fmt(notConnected)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>RNR / Busy / Disconnected</Typography>
                  </Box>
                </Grid>
              </Grid>
              {totalLeads > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Connect rate</Typography>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: MAROON }}>{pct(connectedPct)}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(connectedPct, 100)}
                    sx={{
                      height: 6, borderRadius: 3, bgcolor: '#F3F4F6',
                      '& .MuiLinearProgress-bar': { bgcolor: MAROON },
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Appointment status */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: MAROON, borderLeft: `3px solid ${MAROON}`, pl: 1.2, mb: 1.5 }}>
                Appointments
              </Typography>
              <Grid container spacing={1}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box sx={{ p: 1.5, bgcolor: '#FFF7ED', borderRadius: 1, border: '1px solid #F59E0B30' }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>Today</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#B45309' }}>{fmt(todayApptRow.booked)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                      {fmt(todayApptRow.visited || 0)} visited · {fmt(todayApptRow.not_visited || 0)} no-show
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box sx={{ p: 1.5, bgcolor: `${MAROON}08`, borderRadius: 1, border: `1px solid ${MAROON}20` }}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: MAROON, textTransform: 'uppercase' }}>Booked Today</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: MAROON }}>{fmt(appointmentsBooked)}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>across all dates</Typography>
                  </Box>
                </Grid>
              </Grid>

              {futureAppts.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.6 }}>
                    Upcoming
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                    {futureAppts.slice(0, 5).map((r) => (
                      <Box
                        key={r.date}
                        sx={{
                          p: 1, minWidth: 78, textAlign: 'center',
                          borderRadius: 1, border: '1px solid #E5E7EB',
                          bgcolor: r.booked > 0 ? '#F0FDF4' : '#fff',
                        }}
                      >
                        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                          {r.day_name?.slice(0, 3) || r.date.slice(8)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
                          {r.date.slice(8, 10)}/{r.date.slice(5, 7)}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: r.booked > 0 ? '#10b981' : '#9ca3af' }}>
                          {fmt(r.booked)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Footer hint */}
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textAlign: 'center', fontStyle: 'italic' }}>
        Numbers update automatically every 30 seconds as telecallers add leads, log calls, and book appointments.
      </Typography>
    </Box>
  );
};

export default PortalDashboardToday;
