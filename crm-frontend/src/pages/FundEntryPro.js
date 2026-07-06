import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  InputBase,
  Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CreditCard as CardIcon,
  QrCode2 as QrIcon,
  AccountBalance as BankIcon,
  Facebook as MetaIcon,
  Google as GoogleIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  Bolt as BoltIcon,
  ContentCopy as CopyIcon,
  ReceiptLong as ReceiptIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FileDownload as FileDownloadIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import { useDataCache } from '../contexts/DataCacheContext';

// ── Palette ────────────────────────────────────────────────────────
const BROWN = '#3E2723';
const COPPER = '#C08552';
const CREAM = '#FFF4ED';
const CREAM_DEEP = '#F7ECDF';
const BORDER = '#E8D5C4';
const SUCCESS = '#10B981';
const META_BLUE = '#1877F2';
const GOOGLE_GREEN = '#34A853';

const PLATFORMS = [
  { key: 'meta', label: 'Meta Ads', color: META_BLUE, icon: MetaIcon },
  { key: 'google', label: 'Google Ads', color: GOOGLE_GREEN, icon: GoogleIcon },
];

const METHODS = [
  { key: 'Card', label: 'Card', icon: CardIcon, hint: 'Debit / Credit card', placeholder: 'Card last 4 or ref no.' },
  { key: 'QR Code', label: 'QR Code', icon: QrIcon, hint: 'UPI / QR scan', placeholder: 'UPI ID or reference' },
  { key: 'Net Banking', label: 'Net Banking', icon: BankIcon, hint: 'Bank transfer', placeholder: 'Transaction ID' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtINR0 = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDatePretty = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};

const StepEyebrow = ({ n, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Box sx={{
      width: 22, height: 22, borderRadius: '50%',
      bgcolor: BROWN, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: '0.7rem',
      flexShrink: 0,
    }}>
      {n}
    </Box>
    <Typography sx={{
      fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.4px',
      color: BROWN, textTransform: 'uppercase',
    }}>
      {label}
    </Typography>
  </Box>
);

const FundEntryPro = () => {
  const { clients: cachedClients, fetchClients } = useDataCache();
  useEffect(() => { fetchClients(); }, [fetchClients]);

  const [client, setClient] = useState(null);
  const [date, setDate] = useState(todayISO());
  // Per-platform composer state. Either platform can be enabled
  // independently, so a single entry can log Meta only, Google only,
  // or both at once. The `enabled` flag drives the toggle; the other
  // three fields hold each platform's own amount/method/reference.
  const emptyPlatformState = { enabled: false, amount: '', method: null, details: '' };
  const [platformData, setPlatformData] = useState({
    meta: { ...emptyPlatformState },
    google: { ...emptyPlatformState },
  });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', ok: true });
  const [todayEntries, setTodayEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const clientOptions = useMemo(() => (
    (cachedClients || []).map((c) => ({
      id: c._id,
      name: c.clientName,
      place: c.place,
    }))
  ), [cachedClients]);

  const numericFor = (key) => Number((platformData[key].amount || '').toString().replace(/[^0-9.]/g, '')) || 0;
  const metaAmt = numericFor('meta');
  const googleAmt = numericFor('google');
  const totalAmt = metaAmt + googleAmt;

  // A platform is "ready" if enabled AND has a positive amount AND a
  // method. Save is allowed when the shared fields (client, date) are
  // set AND at least one enabled platform is fully ready.
  const platformReady = (key) => (
    platformData[key].enabled
    && numericFor(key) > 0
    && !!platformData[key].method
  );
  const anyEnabledReady = platformReady('meta') || platformReady('google');
  // Block save if a platform is enabled but not filled — surfaces
  // "half-filled" state as a UI reason for the disabled button.
  const enabledButUnfilled = (
    (platformData.meta.enabled && !platformReady('meta'))
    || (platformData.google.enabled && !platformReady('google'))
  );
  const canSave = client && date && anyEnabledReady && !enabledButUnfilled;

  const updatePlatform = (key, patch) => setPlatformData((prev) => ({
    ...prev,
    [key]: { ...prev[key], ...patch },
  }));

  const loadTodayEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res = await api.get('/funds', {
        params: { dateFrom: todayISO(), dateTo: todayISO(), entryType: 'daily_fund' },
      });
      const list = res.data?.data || res.data || [];
      setTodayEntries(Array.isArray(list) ? list : []);
    } catch {
      setTodayEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, []);
  useEffect(() => { loadTodayEntries(); }, [loadTodayEntries]);

  // ── History table state ─────────────────────────────────────────
  // Full log of fund entries in a date range. Meta and Google are
  // stored on the same document per (client, date), so each doc
  // may explode into 0, 1 or 2 rows in the table (one per platform
  // with a non-zero amount).
  const defaultFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  };
  const [histFrom, setHistFrom] = useState(defaultFrom);
  const [histTo, setHistTo] = useState(todayISO);
  const [histPlatformFilter, setHistPlatformFilter] = useState('all'); // 'all' | 'meta' | 'google'
  const [histSearch, setHistSearch] = useState('');
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/funds', {
        params: { dateFrom: histFrom, dateTo: histTo, entryType: 'daily_fund' },
      });
      const list = res.data?.data || res.data || [];
      setHistoryEntries(Array.isArray(list) ? list : []);
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [histFrom, histTo]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // One row per FundEntry doc — Meta and Google sit side-by-side in
  // the same row so a single client/date entry with both platforms
  // reads as one line, not two. Empty sides show a subtle dash.
  const historyRows = useMemo(() => {
    const rows = historyEntries
      .map((e) => {
        const metaAmount = Number(e.metaAmount) || 0;
        const googleAmount = Number(e.googleAmount) || 0;
        return {
          key: e._id,
          clientId: e.clientId,
          clientName: e.clientName || 'Client',
          date: e.date,
          // Prefer the platform-specific fund-added timestamp — if only
          // one platform was logged, use its timestamp; otherwise the
          // most recent of the two so the row sorts by "last touched".
          timestamp: (() => {
            const t1 = e.metaFundDate ? new Date(e.metaFundDate).getTime() : 0;
            const t2 = e.googleFundDate ? new Date(e.googleFundDate).getTime() : 0;
            const tu = e.updatedAt ? new Date(e.updatedAt).getTime() : 0;
            const tc = e.createdAt ? new Date(e.createdAt).getTime() : 0;
            return new Date(Math.max(t1, t2, tu, tc) || Date.now());
          })(),
          metaAmount,
          metaMethod: e.metaPaymentMode || '',
          metaDetails: e.metaPaymentDetails || '',
          googleAmount,
          googleMethod: e.googlePaymentMode || '',
          googleDetails: e.googlePaymentDetails || '',
        };
      })
      // Skip empty rows (edge case where both amounts were zeroed).
      .filter((r) => r.metaAmount > 0 || r.googleAmount > 0);

    const q = histSearch.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (histPlatformFilter === 'meta' && r.metaAmount <= 0) return false;
      if (histPlatformFilter === 'google' && r.googleAmount <= 0) return false;
      if (q && !r.clientName.toLowerCase().includes(q)) return false;
      return true;
    });

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return filtered;
  }, [historyEntries, histPlatformFilter, histSearch]);

  const historyTotals = useMemo(() => {
    const meta = historyRows.reduce((s, r) => s + r.metaAmount, 0);
    const google = historyRows.reduce((s, r) => s + r.googleAmount, 0);
    return { meta, google, total: meta + google, count: historyRows.length };
  }, [historyRows]);

  const exportHistoryCsv = () => {
    if (historyRows.length === 0) return;
    const esc = (v) => {
      const s = String(v ?? '');
      if (/^[=+\-@\s]/.test(s)) return `'${s.replace(/"/g, '""')}`;
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = [
      'Date', 'Day', 'Time', 'Client',
      'Meta Amount', 'Meta Method', 'Meta Reference',
      'Google Amount', 'Google Method', 'Google Reference',
      'Total',
    ];
    const rowsCsv = historyRows.map((r) => {
      const t = r.timestamp;
      const dateStr = t.toLocaleDateString('en-GB');
      const dayStr = t.toLocaleDateString('en-GB', { weekday: 'long' });
      const timeStr = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return [
        dateStr, dayStr, timeStr, r.clientName,
        r.metaAmount || '', r.metaMethod, r.metaDetails,
        r.googleAmount || '', r.googleMethod, r.googleDetails,
        r.metaAmount + r.googleAmount,
      ];
    });
    const csv = [header, ...rowsCsv].map((cols) => cols.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fund-entries_${histFrom}_to_${histTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setClient(null);
    setPlatformData({
      meta: { ...emptyPlatformState },
      google: { ...emptyPlatformState },
    });
    setDate(todayISO());
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const useMeta = platformReady('meta');
      const useGoogle = platformReady('google');
      const payload = {
        clientId: client.id,
        clientName: client.name,
        date,
        metaBalance: 0,
        googleBalance: 0,
        metaAmount: useMeta ? metaAmt : 0,
        metaPaymentMode: useMeta ? platformData.meta.method : '',
        metaPaymentDetails: useMeta ? platformData.meta.details : '',
        googleAmount: useGoogle ? googleAmt : 0,
        googlePaymentMode: useGoogle ? platformData.google.method : '',
        googlePaymentDetails: useGoogle ? platformData.google.details : '',
      };
      await api.post('/funds', payload);
      setSavedFlash({
        clientName: client.name,
        date,
        meta: useMeta ? { amount: metaAmt, method: platformData.meta.method } : null,
        google: useGoogle ? { amount: googleAmt, method: platformData.google.method } : null,
        total: (useMeta ? metaAmt : 0) + (useGoogle ? googleAmt : 0),
      });
      const savedFor = [useMeta && 'Meta', useGoogle && 'Google'].filter(Boolean).join(' + ');
      setSnack({ open: true, msg: `Fund entry saved (${savedFor})`, ok: true });
      resetForm();
      loadTodayEntries();
      loadHistory();
      setTimeout(() => setSavedFlash(null), 2500);
    } catch (err) {
      setSnack({
        open: true,
        msg: err?.response?.data?.message || err?.message || 'Failed to save',
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  };

  // Aggregate stats for the today feed
  const todayTotals = useMemo(() => {
    const meta = todayEntries.reduce((s, e) => s + (Number(e.metaAmount) || 0), 0);
    const google = todayEntries.reduce((s, e) => s + (Number(e.googleAmount) || 0), 0);
    return { count: todayEntries.length, meta, google, total: meta + google };
  }, [todayEntries]);

  return (
    <Box>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <Card variant="outlined" sx={{
        mb: 2.5,
        border: `1px solid ${BORDER}`,
        borderLeft: `5px solid ${COPPER}`,
        background: `linear-gradient(135deg, ${CREAM} 0%, #fff 60%)`,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Decorative blur — very light, brand-tinted */}
        <Box sx={{
          position: 'absolute', top: -50, right: -40,
          width: 220, height: 220, borderRadius: '50%',
          background: `radial-gradient(circle, ${COPPER}22 0%, transparent 70%)`,
          filter: 'blur(20px)', pointerEvents: 'none',
        }} />
        <CardContent sx={{ py: 2.5, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 1.5,
              bgcolor: BROWN, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 22px ${BROWN}44`,
            }}>
              <BoltIcon />
            </Box>
            <Box sx={{ flex: 1, minWidth: 260 }}>
              <Typography sx={{
                fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.6px',
                color: COPPER, textTransform: 'uppercase', lineHeight: 1, mb: 0.5,
              }}>
                Fund Entry
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.35rem', color: BROWN, lineHeight: 1.15 }}>
                Log a top-up to Meta or Google
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: `${BROWN}99`, mt: 0.4 }}>
                Client, date, platform, amount, and how it was paid — one entry at a time.
              </Typography>
            </Box>
            {/* Today's summary chip cluster */}
            <Box sx={{
              display: 'flex', gap: 1, flexWrap: 'wrap',
              alignItems: 'center',
              bgcolor: '#fff',
              border: `1px solid ${BORDER}`,
              borderRadius: 1.5,
              px: 1.6, py: 1,
            }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.8px', color: `${BROWN}99`, textTransform: 'uppercase' }}>
                  Today logged
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: BROWN, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                  {fmtINR0(todayTotals.total)}
                </Typography>
                <Typography sx={{ fontSize: '0.66rem', color: `${BROWN}77`, mt: 0.2 }}>
                  {todayTotals.count} {todayTotals.count === 1 ? 'entry' : 'entries'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── Composer + Receipt ──────────────────────────────────── */}
      <Grid container spacing={2.5}>
        {/* LEFT — Composer */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ borderColor: BORDER }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              {/* Step 1 — Client + Date on one row */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <StepEyebrow n={1} label="Which client" />
                  <Autocomplete
                    options={clientOptions}
                    value={client}
                    onChange={(_, v) => setClient(v)}
                    getOptionLabel={(o) => o?.name || ''}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Avatar sx={{ width: 26, height: 26, bgcolor: `${COPPER}22`, color: COPPER, fontSize: '0.75rem', fontWeight: 800 }}>
                          {option.name?.charAt(0)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>{option.name}</Typography>
                          {option.place && (
                            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{option.place}</Typography>
                          )}
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search client name…"
                        size="medium"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StepEyebrow n={2} label="When" />
                  <TextField
                    type="date"
                    fullWidth
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    inputProps={{ max: todayISO() }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2.5, borderColor: `${BROWN}12` }} />

              {/* Step 3 — Platforms (multi-select). Toggling a
                  platform reveals its own amount/method/reference
                  block below. Both can be enabled at once — one
                  fund entry, two platforms. */}
              <StepEyebrow n={3} label="Which platform(s)" />
              <Typography sx={{ fontSize: '0.72rem', color: `${BROWN}88`, mb: 1.2, mt: -0.4 }}>
                Turn on Meta, Google, or both. Each platform tracks its own amount and payment.
              </Typography>
              <Grid container spacing={1.5} sx={{ mb: 0.5 }}>
                {PLATFORMS.map((p) => {
                  const isActive = platformData[p.key].enabled;
                  const Icon = p.icon;
                  const toggle = () => updatePlatform(p.key, {
                    enabled: !isActive,
                    // If turning off, clear that platform's own inputs
                    // so the receipt / save reflects the toggle state.
                    ...(isActive ? { amount: '', method: null, details: '' } : {}),
                  });
                  return (
                    <Grid key={p.key} size={{ xs: 6 }}>
                      <Box
                        onClick={toggle}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isActive}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
                        }}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 2,
                          p: 1.6,
                          border: `2px solid ${isActive ? p.color : BORDER}`,
                          bgcolor: isActive ? `${p.color}0F` : '#fff',
                          boxShadow: isActive ? `0 8px 22px ${p.color}22` : 'none',
                          transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
                          display: 'flex', alignItems: 'center', gap: 1.4,
                          position: 'relative',
                          '&:hover': isActive ? {} : { borderColor: `${p.color}88`, transform: 'translateY(-2px)' },
                          '&:focus-visible': { outline: `2px solid ${p.color}`, outlineOffset: 2 },
                        }}
                      >
                        <Box sx={{
                          width: 40, height: 40, borderRadius: '50%',
                          bgcolor: isActive ? p.color : `${p.color}18`,
                          color: isActive ? '#fff' : p.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background-color 0.15s ease, color 0.15s ease',
                        }}>
                          <Icon />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', color: BROWN, lineHeight: 1.1 }}>
                            {p.label}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: `${BROWN}88`, mt: 0.2 }}>
                            {isActive ? 'On · tap to remove' : 'Tap to add'}
                          </Typography>
                        </Box>
                        <Box sx={{
                          width: 22, height: 22, borderRadius: 0.7,
                          border: `2px solid ${isActive ? p.color : `${BROWN}33`}`,
                          bgcolor: isActive ? p.color : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}>
                          {isActive && <CheckIcon sx={{ color: '#fff', fontSize: 16 }} />}
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>

              {/* If neither platform is enabled, nudge with an inline
                  hint instead of dead space. */}
              {!platformData.meta.enabled && !platformData.google.enabled && (
                <Box sx={{
                  mt: 2, p: 1.6,
                  borderRadius: 1.5,
                  bgcolor: CREAM, border: `1px dashed ${BORDER}`,
                  textAlign: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.82rem', color: `${BROWN}99`, fontWeight: 600 }}>
                    Pick at least one platform above to enter an amount.
                  </Typography>
                </Box>
              )}

              {/* Per-platform sections — one block for each enabled
                  platform, stacked vertically. Bordered in the
                  platform's own colour so the amount/method feel
                  scoped, not global. */}
              {PLATFORMS.map((p) => {
                if (!platformData[p.key].enabled) return null;
                const pAmt = numericFor(p.key);
                const pMethod = platformData[p.key].method;
                const pDetails = platformData[p.key].details;
                const activeM = METHODS.find((m) => m.key === pMethod);
                const Icon = p.icon;
                return (
                  <Box
                    key={p.key}
                    sx={{
                      mt: 2.5,
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${p.color}45`,
                      bgcolor: `${p.color}06`,
                      position: 'relative',
                    }}
                  >
                    {/* Section header — small platform badge + label */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Box sx={{
                        width: 26, height: 26, borderRadius: '50%',
                        bgcolor: p.color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon sx={{ fontSize: 15 }} />
                      </Box>
                      <Typography sx={{
                        fontSize: '0.68rem', fontWeight: 800, letterSpacing: '1.2px',
                        color: p.color, textTransform: 'uppercase',
                      }}>
                        {p.label} details
                      </Typography>
                    </Box>

                    {/* Amount input */}
                    <TextField
                      fullWidth
                      value={platformData[p.key].amount}
                      onChange={(e) => updatePlatform(p.key, { amount: e.target.value.replace(/[^0-9.]/g, '') })}
                      placeholder="0"
                      inputProps={{ inputMode: 'decimal' }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography sx={{ fontWeight: 900, fontSize: '1.35rem', color: p.color }}>₹</Typography>
                          </InputAdornment>
                        ),
                        sx: {
                          borderRadius: 1.5, bgcolor: '#fff',
                          fontSize: '1.35rem', fontWeight: 900, color: p.color,
                          fontVariantNumeric: 'tabular-nums',
                          '& input': { py: 1.3 },
                        },
                      }}
                      sx={{ mb: 1 }}
                    />

                    {/* Quick-amount chips scoped to this platform */}
                    <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mb: 2 }}>
                      {[1000, 2500, 5000, 10000, 25000].map((v) => (
                        <Chip
                          key={v}
                          label={`+ ${fmtINR0(v)}`}
                          onClick={() => updatePlatform(p.key, {
                            amount: String((pAmt || 0) + v),
                          })}
                          size="small"
                          sx={{
                            height: 24, fontSize: '0.7rem', fontWeight: 700,
                            bgcolor: `${p.color}12`, color: p.color,
                            border: `1px solid ${p.color}35`,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: `${p.color}22` },
                          }}
                        />
                      ))}
                      {pAmt > 0 && (
                        <Chip
                          label="Clear"
                          onClick={() => updatePlatform(p.key, { amount: '' })}
                          size="small"
                          sx={{
                            height: 24, fontSize: '0.7rem', fontWeight: 700,
                            bgcolor: '#fff', color: `${BROWN}AA`,
                            border: `1px solid ${BROWN}22`,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: `${BROWN}08` },
                          }}
                        />
                      )}
                    </Box>

                    {/* Payment method — compact chip-style row */}
                    <Typography sx={{
                      fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.8px',
                      color: `${BROWN}99`, textTransform: 'uppercase', mb: 0.8,
                    }}>
                      Paid with
                    </Typography>
                    <Grid container spacing={1}>
                      {METHODS.map((m) => {
                        const isActive = pMethod === m.key;
                        const MIcon = m.icon;
                        return (
                          <Grid key={m.key} size={{ xs: 12, sm: 4 }}>
                            <Box
                              onClick={() => updatePlatform(p.key, { method: m.key })}
                              tabIndex={0}
                              role="button"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updatePlatform(p.key, { method: m.key }); }
                              }}
                              sx={{
                                cursor: 'pointer',
                                borderRadius: 1.5,
                                px: 1.1, py: 0.9,
                                border: `2px solid ${isActive ? p.color : BORDER}`,
                                bgcolor: isActive ? '#fff' : '#fff',
                                boxShadow: isActive ? `0 4px 12px ${p.color}22` : 'none',
                                transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                                transition: 'all 0.15s ease',
                                display: 'flex', alignItems: 'center', gap: 0.8,
                                '&:hover': isActive ? {} : { borderColor: `${p.color}77` },
                                '&:focus-visible': { outline: `2px solid ${p.color}`, outlineOffset: 2 },
                              }}
                            >
                              <Box sx={{
                                width: 28, height: 28, borderRadius: '50%',
                                bgcolor: isActive ? p.color : `${p.color}18`,
                                color: isActive ? '#fff' : p.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <MIcon sx={{ fontSize: 16 }} />
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: BROWN, lineHeight: 1.1 }}>
                                  {m.label}
                                </Typography>
                                <Typography sx={{ fontSize: '0.62rem', color: `${BROWN}88`, mt: 0.15 }}>
                                  {m.hint}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>

                    {pMethod && (
                      <Box sx={{ mt: 1.6 }}>
                        <Typography sx={{
                          fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.8px',
                          color: `${BROWN}99`, textTransform: 'uppercase', mb: 0.5,
                        }}>
                          Reference (optional)
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          value={pDetails}
                          onChange={(e) => updatePlatform(p.key, { details: e.target.value })}
                          placeholder={activeM?.placeholder || 'Enter details'}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }}
                        />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT — Live receipt + today feed */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 88 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Receipt */}
            <Card
              variant="outlined"
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderColor: savedFlash ? SUCCESS : (
                  platformData.meta.enabled && !platformData.google.enabled ? META_BLUE
                    : (!platformData.meta.enabled && platformData.google.enabled ? GOOGLE_GREEN
                      : platformData.meta.enabled && platformData.google.enabled ? COPPER
                        : BORDER)
                ),
                borderWidth: 2,
                borderStyle: 'solid',
                background: savedFlash
                  ? `linear-gradient(180deg, ${SUCCESS}10 0%, #fff 60%)`
                  : `linear-gradient(180deg, ${CREAM} 0%, #fff 60%)`,
                transition: 'border-color 0.25s ease, background 0.25s ease',
              }}
            >
              {/* Ticket top perforation — decorative notches so the card
                  reads as a paper receipt. */}
              <Box sx={{
                position: 'absolute', top: -8, left: 0, right: 0, height: 16,
                background: (() => {
                  const c = savedFlash ? SUCCESS : (
                    platformData.meta.enabled && !platformData.google.enabled ? META_BLUE
                      : (!platformData.meta.enabled && platformData.google.enabled ? GOOGLE_GREEN
                        : COPPER)
                  );
                  return `radial-gradient(circle 8px at 24px 0, transparent 98%, ${c} 100%)`;
                })(),
                backgroundSize: '48px 100%',
                pointerEvents: 'none',
              }} />

              <CardContent sx={{ pt: 2.5, pb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ReceiptIcon sx={{ color: BROWN, fontSize: 20 }} />
                    <Typography sx={{
                      fontSize: '0.68rem', fontWeight: 800, letterSpacing: '1.4px',
                      color: BROWN, textTransform: 'uppercase',
                    }}>
                      {savedFlash ? 'Saved' : 'Live Receipt'}
                    </Typography>
                  </Box>
                  {savedFlash && (
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 0.6,
                      px: 1, py: 0.4, borderRadius: 1,
                      bgcolor: `${SUCCESS}18`, color: SUCCESS,
                      border: `1px solid ${SUCCESS}55`,
                    }}>
                      <CheckIcon sx={{ fontSize: 14 }} />
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800 }}>
                        Logged
                      </Typography>
                    </Box>
                  )}
                </Box>

                {(() => {
                  // Receipt values driven by either the just-saved
                  // flash payload or the live composer state.
                  const clientNameShown = savedFlash ? savedFlash.clientName : (client?.name || '—');
                  const dateShown = fmtDatePretty(savedFlash ? savedFlash.date : date) || '—';
                  const metaSlice = savedFlash
                    ? savedFlash.meta
                    : (platformData.meta.enabled && metaAmt > 0
                      ? { amount: metaAmt, method: platformData.meta.method }
                      : null);
                  const googleSlice = savedFlash
                    ? savedFlash.google
                    : (platformData.google.enabled && googleAmt > 0
                      ? { amount: googleAmt, method: platformData.google.method }
                      : null);
                  const totalShown = savedFlash ? savedFlash.total : totalAmt;
                  const hasBoth = metaSlice && googleSlice;
                  return (
                    <>
                      {/* Big total amount */}
                      <Box sx={{ textAlign: 'center', my: 1.5 }}>
                        <Typography sx={{
                          fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1px',
                          color: `${BROWN}88`, textTransform: 'uppercase', mb: 0.3,
                        }}>
                          {hasBoth ? 'Total' : 'Amount'}
                        </Typography>
                        <Typography sx={{
                          fontWeight: 900, fontSize: '2.4rem', lineHeight: 1,
                          color: savedFlash ? SUCCESS : (hasBoth ? BROWN
                            : (metaSlice ? META_BLUE
                              : (googleSlice ? GOOGLE_GREEN : `${BROWN}55`))),
                          fontVariantNumeric: 'tabular-nums',
                          transition: 'color 0.25s ease',
                        }}>
                          {fmtINR0(totalShown)}
                        </Typography>
                        {hasBoth && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2, mt: 0.7 }}>
                            <PlatformMini color={META_BLUE} icon={MetaIcon} amount={metaSlice.amount} />
                            <Typography sx={{ fontSize: '0.85rem', color: `${BROWN}55`, fontWeight: 700 }}>+</Typography>
                            <PlatformMini color={GOOGLE_GREEN} icon={GoogleIcon} amount={googleSlice.amount} />
                          </Box>
                        )}
                      </Box>

                      <ReceiptDash />

                      {/* Shared header rows */}
                      <ReceiptRow label="Client" value={clientNameShown} />
                      <ReceiptRow label="Date" value={dateShown} />

                      {/* Per-platform blocks. Rendered whenever the
                          user has an amount for that platform. */}
                      {metaSlice && (
                        <PlatformReceiptBlock
                          platform="meta"
                          amount={metaSlice.amount}
                          method={metaSlice.method}
                          showSubTotal={hasBoth}
                        />
                      )}
                      {googleSlice && (
                        <PlatformReceiptBlock
                          platform="google"
                          amount={googleSlice.amount}
                          method={googleSlice.method}
                          showSubTotal={hasBoth}
                        />
                      )}

                      {!metaSlice && !googleSlice && (
                        <Box sx={{ textAlign: 'center', py: 1.2 }}>
                          <Typography sx={{ fontSize: '0.75rem', color: `${BROWN}66`, fontStyle: 'italic' }}>
                            Turn on a platform and enter an amount to see it here.
                          </Typography>
                        </Box>
                      )}

                      <ReceiptDash />
                    </>
                  );
                })()}

                <Button
                  fullWidth
                  disabled={!canSave || saving}
                  onClick={handleSave}
                  startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckIcon />}
                  sx={{
                    mt: 1,
                    py: 1.3,
                    borderRadius: 1.5,
                    bgcolor: canSave ? BROWN : `${BROWN}22`,
                    color: canSave ? '#fff' : `${BROWN}88`,
                    fontWeight: 800, fontSize: '0.92rem',
                    textTransform: 'none', letterSpacing: '0.3px',
                    boxShadow: canSave ? `0 8px 20px ${BROWN}44` : 'none',
                    '&:hover': { bgcolor: canSave ? BROWN : `${BROWN}22`, filter: canSave ? 'brightness(1.1)' : 'none' },
                    '&.Mui-disabled': { color: `${BROWN}55` },
                  }}
                >
                  {saving ? 'Saving…' : (
                    canSave
                      ? `Log ${platformReady('meta') && platformReady('google') ? 'both entries' : 'this entry'}`
                      : (enabledButUnfilled ? 'Fill amount & method for every selected platform' : 'Pick a platform and enter an amount')
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Today feed */}
            <Card variant="outlined" sx={{ borderColor: BORDER }}>
              <CardContent sx={{ py: 1.8, '&:last-child': { pb: 1.8 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <HistoryIcon sx={{ color: BROWN, fontSize: 18 }} />
                    <Typography sx={{
                      fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.3px',
                      color: BROWN, textTransform: 'uppercase',
                    }}>
                      Today's entries
                    </Typography>
                  </Box>
                  <Tooltip title="Refresh">
                    <IconButton size="small" onClick={loadTodayEntries} disabled={entriesLoading}>
                      {entriesLoading ? <CircularProgress size={14} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>

                {todayEntries.length === 0 ? (
                  <Typography sx={{ fontSize: '0.78rem', color: `${BROWN}77`, py: 1.2 }}>
                    No fund entries logged yet today. Yours will appear here as you save.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9, maxHeight: 300, overflowY: 'auto' }}>
                    {todayEntries.map((e) => {
                      const isMeta = Number(e.metaAmount) > 0;
                      const p = PLATFORMS.find((x) => x.key === (isMeta ? 'meta' : 'google'));
                      const amt = isMeta ? Number(e.metaAmount) : Number(e.googleAmount);
                      const paymt = isMeta ? e.metaPaymentMode : e.googlePaymentMode;
                      const Icon = p?.icon;
                      return (
                        <Box key={e._id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          px: 1, py: 0.9, borderRadius: 1,
                          bgcolor: '#fff', border: `1px solid ${BORDER}`,
                        }}>
                          <Box sx={{
                            width: 26, height: 26, borderRadius: '50%',
                            bgcolor: `${p?.color || BROWN}18`,
                            color: p?.color || BROWN,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {Icon ? <Icon sx={{ fontSize: 14 }} /> : null}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: BROWN, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {e.clientName || 'Client'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.66rem', color: `${BROWN}88` }}>
                              {paymt || 'Method'} · {p?.label || 'Platform'}
                            </Typography>
                          </Box>
                          <Typography sx={{
                            fontWeight: 800, fontSize: '0.85rem',
                            color: p?.color || BROWN,
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0,
                          }}>
                            {fmtINR0(amt)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* ── History table ─────────────────────────────────────────
          Full fund-entry log across the chosen range. Each doc is
          exploded into up to two rows (Meta + Google) so both
          platforms are visible in the same feed, ordered newest-
          first by the actual fund-added timestamp. */}
      <Card variant="outlined" sx={{ mt: 3, borderColor: BORDER }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          {/* Header + filters */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography sx={{
                fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.4px',
                color: COPPER, textTransform: 'uppercase', lineHeight: 1, mb: 0.5,
              }}>
                Ledger
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: BROWN, lineHeight: 1.15 }}>
                Fund entries · {historyTotals.count} row{historyTotals.count === 1 ? '' : 's'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: META_BLUE }} />
                  <Typography sx={{ fontSize: '0.72rem', color: BROWN, fontWeight: 700 }}>
                    Meta {fmtINR0(historyTotals.meta)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: GOOGLE_GREEN }} />
                  <Typography sx={{ fontSize: '0.72rem', color: BROWN, fontWeight: 700 }}>
                    Google {fmtINR0(historyTotals.google)}
                  </Typography>
                </Box>
                <Box sx={{ width: '1px', height: '14px', bgcolor: `${BROWN}22` }} />
                <Typography sx={{ fontSize: '0.72rem', color: BROWN, fontWeight: 800 }}>
                  Total {fmtINR0(historyTotals.total)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                type="date"
                label="From"
                value={histFrom}
                onChange={(e) => setHistFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                value={histTo}
                onChange={(e) => setHistTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' } }}
              />
              <Tooltip title="Refresh">
                <IconButton
                  onClick={loadHistory}
                  disabled={historyLoading}
                  size="small"
                  sx={{
                    border: `1px solid ${BORDER}`, borderRadius: 1.5, bgcolor: '#fff',
                    color: BROWN, width: 36, height: 36,
                    '&:hover': { bgcolor: CREAM },
                  }}
                >
                  {historyLoading ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Export CSV">
                <span>
                  <IconButton
                    onClick={exportHistoryCsv}
                    disabled={historyRows.length === 0}
                    size="small"
                    sx={{
                      border: `1px solid ${BORDER}`, borderRadius: 1.5, bgcolor: '#fff',
                      color: BROWN, width: 36, height: 36,
                      '&:hover': { bgcolor: CREAM },
                    }}
                  >
                    <FileDownloadIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {/* Second filter row: platform toggle + client search */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.2, mb: 1.5 }}>
            <ToggleButtonGroup
              value={histPlatformFilter}
              exclusive
              size="small"
              onChange={(_, v) => v && setHistPlatformFilter(v)}
              sx={{
                bgcolor: '#fff',
                '& .MuiToggleButton-root': {
                  border: `1px solid ${BORDER}`,
                  color: `${BROWN}AA`,
                  textTransform: 'none',
                  fontWeight: 700, fontSize: '0.78rem',
                  px: 1.8, py: 0.5,
                  '&.Mui-selected': {
                    bgcolor: BROWN, color: '#fff',
                    '&:hover': { bgcolor: BROWN, filter: 'brightness(1.1)' },
                  },
                },
              }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="meta">
                <MetaIcon sx={{ fontSize: 14, mr: 0.5, color: histPlatformFilter === 'meta' ? '#fff' : META_BLUE }} />
                Meta
              </ToggleButton>
              <ToggleButton value="google">
                <GoogleIcon sx={{ fontSize: 14, mr: 0.5, color: histPlatformFilter === 'google' ? '#fff' : GOOGLE_GREEN }} />
                Google
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Client search inline */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.6,
              px: 1.2, height: 34,
              border: `1px solid ${BORDER}`, borderRadius: 1.5, bgcolor: '#fff',
              minWidth: 220, flexGrow: { xs: 1, sm: 0 },
            }}>
              <SearchIcon sx={{ fontSize: 16, color: COPPER, flexShrink: 0 }} />
              <InputBase
                fullWidth
                placeholder="Search client…"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                sx={{ fontSize: '0.82rem', color: BROWN, '& input::placeholder': { color: `${BROWN}77`, opacity: 1 } }}
              />
              {histSearch && (
                <IconButton size="small" onClick={() => setHistSearch('')} sx={{ p: 0.2, color: `${BROWN}88` }}>
                  <ClearIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Table */}
          {historyRows.length === 0 && !historyLoading ? (
            <Box sx={{
              textAlign: 'center', py: 6,
              bgcolor: CREAM, borderRadius: 2, border: `1px dashed ${BORDER}`,
            }}>
              <InboxIcon sx={{ fontSize: 40, color: COPPER, opacity: 0.6, mb: 1 }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: BROWN }}>
                No fund entries in this range
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: `${BROWN}88`, mt: 0.4 }}>
                Widen the date range or clear the filters to see more.
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{
              border: `1px solid ${BORDER}`, borderRadius: 2,
              maxHeight: 520, overflow: 'auto',
              bgcolor: '#fff',
            }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  {/* Two-row header: platform group headers on top,
                      per-platform column labels underneath. Meta and
                      Google get their own tinted column groups so the
                      side-by-side split reads at a glance. */}
                  <TableRow>
                    <TableCell rowSpan={2} sx={headCellSx}>Client</TableCell>
                    <TableCell rowSpan={2} sx={headCellSx}>Date & day</TableCell>
                    <TableCell rowSpan={2} sx={headCellSx}>Time</TableCell>
                    <TableCell colSpan={2} align="center" sx={{
                      ...headCellSx,
                      bgcolor: `${META_BLUE}12`, color: META_BLUE,
                      borderBottom: `2px solid ${META_BLUE}55`,
                    }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <MetaIcon sx={{ fontSize: 13 }} /> Meta
                      </Box>
                    </TableCell>
                    <TableCell colSpan={2} align="center" sx={{
                      ...headCellSx,
                      bgcolor: `${GOOGLE_GREEN}12`, color: GOOGLE_GREEN,
                      borderBottom: `2px solid ${GOOGLE_GREEN}55`,
                    }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <GoogleIcon sx={{ fontSize: 13 }} /> Google
                      </Box>
                    </TableCell>
                    <TableCell rowSpan={2} sx={{ ...headCellSx, textAlign: 'right' }}>Total</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ ...headCellSx, bgcolor: `${META_BLUE}08` }}>Amount</TableCell>
                    <TableCell sx={{ ...headCellSx, bgcolor: `${META_BLUE}08` }}>Paid by</TableCell>
                    <TableCell sx={{ ...headCellSx, bgcolor: `${GOOGLE_GREEN}08` }}>Amount</TableCell>
                    <TableCell sx={{ ...headCellSx, bgcolor: `${GOOGLE_GREEN}08` }}>Paid by</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historyRows.map((r) => {
                    const t = r.timestamp;
                    const dateStr = t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const dayStr = t.toLocaleDateString('en-GB', { weekday: 'short' });
                    const timeStr = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const rowTotal = r.metaAmount + r.googleAmount;
                    return (
                      <TableRow key={r.key} hover sx={{
                        '&:nth-of-type(even)': { bgcolor: `${CREAM}70` },
                        cursor: 'default',
                      }}>
                        {/* Client */}
                        <TableCell sx={{ py: 1.1, borderBottom: `1px solid ${BORDER}77` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
                            <Avatar sx={{ width: 26, height: 26, bgcolor: `${COPPER}22`, color: COPPER, fontSize: '0.72rem', fontWeight: 800 }}>
                              {r.clientName?.charAt(0)}
                            </Avatar>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: BROWN }}>
                              {r.clientName}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Date + day-of-week */}
                        <TableCell sx={{ py: 1.1, borderBottom: `1px solid ${BORDER}77` }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: BROWN, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                            {dateStr}
                          </Typography>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: COPPER, mt: 0.2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            {dayStr}
                          </Typography>
                        </TableCell>

                        {/* Time */}
                        <TableCell sx={{ py: 1.1, borderBottom: `1px solid ${BORDER}77` }}>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: BROWN, fontVariantNumeric: 'tabular-nums' }}>
                            {timeStr}
                          </Typography>
                        </TableCell>

                        {/* Meta group */}
                        <PlatformAmountCell amount={r.metaAmount} color={META_BLUE} />
                        <PlatformMethodCell method={r.metaMethod} details={r.metaDetails} color={META_BLUE} />

                        {/* Google group */}
                        <PlatformAmountCell amount={r.googleAmount} color={GOOGLE_GREEN} />
                        <PlatformMethodCell method={r.googleMethod} details={r.googleDetails} color={GOOGLE_GREEN} />

                        {/* Row total */}
                        <TableCell sx={{ py: 1.1, borderBottom: `1px solid ${BORDER}77`, textAlign: 'right' }}>
                          <Typography sx={{
                            fontSize: '0.92rem', fontWeight: 900, color: BROWN,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {fmtINR0(rowTotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        onClose={() => setSnack({ ...snack, open: false })}
        message={snack.msg}
        ContentProps={{
          sx: {
            bgcolor: snack.ok ? SUCCESS : '#ef4444',
            color: '#fff',
            fontWeight: 700,
            borderRadius: 1.5,
          },
        }}
      />
    </Box>
  );
};

const ReceiptRow = ({ label, value, chipColor }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.6 }}>
    <Typography sx={{ fontSize: '0.68rem', color: `${BROWN}88`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </Typography>
    {chipColor ? (
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4,
        px: 0.8, py: 0.2, borderRadius: 0.8,
        bgcolor: `${chipColor}12`,
        border: `1px solid ${chipColor}45`,
      }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: chipColor }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: chipColor }}>
          {value}
        </Typography>
      </Box>
    ) : (
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: BROWN, textAlign: 'right', maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </Typography>
    )}
  </Box>
);

// Shared header cell style for the ledger table — kept out of the
// component tree so the two header rows stay visually identical.
const headCellSx = {
  bgcolor: CREAM,
  color: BROWN,
  fontWeight: 800,
  fontSize: '0.66rem',
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  py: 1,
  borderBottom: `2px solid ${BORDER}`,
  whiteSpace: 'nowrap',
};

// A single "amount" cell inside a platform-tinted column. Shows a
// dash if the client didn't put money into this platform on this
// entry — visually clear when a row is one-platform-only.
const PlatformAmountCell = ({ amount, color }) => (
  <TableCell sx={{ py: 1.1, borderBottom: `1px solid ${BORDER}77`, bgcolor: `${color}05` }}>
    {amount > 0 ? (
      <Typography sx={{
        fontSize: '0.9rem', fontWeight: 900, color,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {fmtINR0(amount)}
      </Typography>
    ) : (
      <Typography sx={{ fontSize: '0.85rem', color: `${BROWN}33`, fontWeight: 500 }}>
        —
      </Typography>
    )}
  </TableCell>
);

// Payment-method cell — small colored pill with the method label
// (Card / QR Code / Net Banking). Empty state uses a dash so it
// aligns visually with the amount cells.
const PlatformMethodCell = ({ method, details, color }) => {
  const methodIcon = {
    'Card': CardIcon,
    'QR Code': QrIcon,
    'Net Banking': BankIcon,
  }[method];
  const MIcon = methodIcon;
  return (
    <TableCell sx={{ py: 1.1, borderBottom: `1px solid ${BORDER}77`, bgcolor: `${color}05` }}>
      {method ? (
        <Box>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5,
            px: 0.9, py: 0.3, borderRadius: 0.8,
            bgcolor: '#fff',
            border: `1px solid ${color}55`,
          }}>
            {MIcon && <MIcon sx={{ fontSize: 13, color }} />}
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color }}>
              {method}
            </Typography>
          </Box>
          {details && (
            <Typography
              title={details}
              sx={{
                fontSize: '0.66rem', color: `${BROWN}88`, mt: 0.35,
                fontFamily: 'monospace',
                maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {details}
            </Typography>
          )}
        </Box>
      ) : (
        <Typography sx={{ fontSize: '0.85rem', color: `${BROWN}33`, fontWeight: 500 }}>
          —
        </Typography>
      )}
    </TableCell>
  );
};

// Per-platform receipt block — shows a platform-tinted mini section
// inside the receipt with the platform label, method, and (optionally)
// a right-aligned per-platform sub-total when both platforms are used.
const PlatformReceiptBlock = ({ platform, amount, method, showSubTotal }) => {
  const p = PLATFORMS.find((x) => x.key === platform);
  if (!p) return null;
  const Icon = p.icon;
  return (
    <Box sx={{
      mt: 1, mb: 0.5,
      p: 1.2,
      borderRadius: 1,
      bgcolor: `${p.color}0c`,
      border: `1px solid ${p.color}30`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
          <Box sx={{
            width: 20, height: 20, borderRadius: '50%',
            bgcolor: p.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon sx={{ fontSize: 12 }} />
          </Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: p.color, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            {p.label}
          </Typography>
        </Box>
        {showSubTotal && (
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: p.color, fontVariantNumeric: 'tabular-nums' }}>
            {fmtINR0(amount)}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.6 }}>
        <Typography sx={{ fontSize: '0.66rem', color: `${BROWN}99`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Method
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: BROWN }}>
          {method || '—'}
        </Typography>
      </Box>
    </Box>
  );
};

// Small "₹X" chip used under the total when both platforms are logged
// on the same receipt — a compact reminder of the split.
const PlatformMini = ({ color, icon: Icon, amount }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center', gap: 0.5,
    px: 0.9, py: 0.3, borderRadius: 1,
    bgcolor: `${color}15`,
    border: `1px solid ${color}40`,
  }}>
    <Icon sx={{ fontSize: 12, color }} />
    <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
      {fmtINR0(amount)}
    </Typography>
  </Box>
);

const ReceiptDash = () => (
  <Box sx={{
    my: 1.4,
    height: 1,
    background: `repeating-linear-gradient(90deg, ${BROWN}30 0 6px, transparent 6px 12px)`,
  }} />
);

export default FundEntryPro;
