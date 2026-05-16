import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Paper,
  ToggleButton, ToggleButtonGroup, TextField, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  CircularProgress, Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

// LeadCheckPanel — per-client day-wise Meta Ads breakdown with a
// Daily / Weekly / Monthly toggle. One row per date showing the
// same KPI columns the Meta Ads tab summarises (spend, impressions,
// reach, clicks, CTR, CPC, CPM, leads, CPL) but split by day.
//
// Backed by /meta/client/:clientId/analytics — same payload the Meta
// Ads tab consumes; we just read its `daily_trend` array.
//
// Props:
//   clientId, apiInstance (axios instance with the right auth)

const META_BLUE = '#1877F2';
const SOFT_BG = '#F0F6FF';

const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n || 0).toFixed(2)}%`;

const LeadCheckPanel = ({ clientId, apiInstance }) => {
  const today = useMemo(() => new Date(), []);

  // Three quick presets. Custom is set when the user picks dates
  // manually below — the toggle deselects so it's clear what's active.
  const presets = useMemo(() => {
    const t = today;
    const todayIso = iso(t);
    const weekStart = new Date(t); weekStart.setDate(t.getDate() - 6);
    const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
    return {
      daily: { from: todayIso, to: todayIso },
      weekly: { from: iso(weekStart), to: todayIso },
      monthly: { from: iso(monthStart), to: todayIso },
    };
  }, [today]);

  const [range, setRange] = useState('weekly');
  const [customFrom, setCustomFrom] = useState(presets.weekly.from);
  const [customTo, setCustomTo] = useState(presets.weekly.to);
  const activeFrom = range === 'custom' ? customFrom : presets[range].from;
  const activeTo = range === 'custom' ? customTo : presets[range].to;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!clientId || !apiInstance) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiInstance.get(`/meta/client/${clientId}/analytics`, {
        params: { from: activeFrom, to: activeTo },
      });
      setData(res.data || null);
    } catch (err) {
      console.error('meta-ads day-wise fetch failed', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load Meta Ads breakdown');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, apiInstance, activeFrom, activeTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setPreset = (preset) => {
    if (!preset) return;
    setRange(preset);
    if (preset !== 'custom') {
      setCustomFrom(presets[preset].from);
      setCustomTo(presets[preset].to);
    }
  };

  const summary = data?.summary || null;

  // The backend's `daily_trend` is sorted ascending; flip it so the
  // most recent day shows up first, matching how operators scan EOD-style
  // reports in the wild.
  //
  // We also derive CTR / CPC / CPM / CPL per row in JS from spend /
  // impressions / clicks / total_leads. The backend computes these
  // server-side too, but older deployments don't have them — falling
  // back to a JS calc means the table is correct even before a
  // backend restart. Reach is a real data field with no fallback,
  // so it stays as-is.
  const displayRows = useMemo(() => {
    const arr = data?.daily_trend;
    if (!Array.isArray(arr)) return [];
    return [...arr].reverse().map((r) => {
      const impressions = Number(r.impressions) || 0;
      const clicks = Number(r.clicks) || 0;
      const spend = Number(r.spend) || 0;
      const totalLeads = Number(r.total_leads ?? r.leads) || 0;
      const ctr = Number(r.ctr);
      const cpc = Number(r.cpc);
      const cpm = Number(r.cpm);
      const cpl = Number(r.cpl);
      return {
        ...r,
        ctr: Number.isFinite(ctr) && ctr > 0 ? ctr
          : (impressions > 0 ? (clicks / impressions) * 100 : 0),
        cpc: Number.isFinite(cpc) && cpc > 0 ? cpc
          : (clicks > 0 ? spend / clicks : 0),
        cpm: Number.isFinite(cpm) && cpm > 0 ? cpm
          : (impressions > 0 ? (spend / impressions) * 1000 : 0),
        cpl: Number.isFinite(cpl) && cpl > 0 ? cpl
          : (totalLeads > 0 ? spend / totalLeads : 0),
      };
    });
  }, [data]);
  const rows = data?.daily_trend || [];

  const dayName = (dateStr) => {
    try { return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }); }
    catch { return ''; }
  };
  const datePretty = (dateStr) => {
    try { return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
    catch { return dateStr; }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Card variant="outlined" sx={{ borderLeft: `3px solid ${META_BLUE}` }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: META_BLUE }}>
              Lead Check · Meta Ads (Day-wise)
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              Per-day Meta Ads metrics for this client — spend, reach, impressions, clicks, CTR, CPC, CPM, and leads with CPL.
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={range === 'custom' ? null : range}
            exclusive
            size="small"
            onChange={(_, v) => setPreset(v)}
          >
            <ToggleButton value="daily" sx={{ textTransform: 'none', fontWeight: 600 }}>Daily</ToggleButton>
            <ToggleButton value="weekly" sx={{ textTransform: 'none', fontWeight: 600 }}>Weekly</ToggleButton>
            <ToggleButton value="monthly" sx={{ textTransform: 'none', fontWeight: 600 }}>Monthly</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            type="date" size="small" label="From"
            value={activeFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setRange('custom'); }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <TextField
            type="date" size="small" label="To"
            value={activeTo}
            onChange={(e) => { setCustomTo(e.target.value); setRange('custom'); }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <Button
            size="small" variant="outlined"
            startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={fetchData} disabled={loading}
          >
            Refresh
          </Button>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !data && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress sx={{ color: META_BLUE }} />
          <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>Loading Meta Ads breakdown…</Typography>
        </Box>
      )}

      {data && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            {/* Range summary chip strip — quick reconciliation against
                the Meta Ads tab's KPI grid above. Same numbers, just
                broken out per-day below. */}
            <Box sx={{ p: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
              <Chip
                label={`${rows.length} day${rows.length === 1 ? '' : 's'}`}
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              {summary && (
                <>
                  <Chip
                    label={`Total Spend: ${fmtINR(summary.spend)}`}
                    sx={{ bgcolor: `${META_BLUE}15`, color: META_BLUE, fontWeight: 700 }}
                  />
                  <Chip
                    label={`Impressions: ${fmt(summary.impressions)}`}
                    sx={{ bgcolor: '#7E22CE15', color: '#7E22CE', fontWeight: 700 }}
                  />
                  <Chip
                    label={`Clicks: ${fmt(summary.clicks)}`}
                    sx={{ bgcolor: '#F59E0B15', color: '#B45309', fontWeight: 700 }}
                  />
                  <Chip
                    label={`Leads: ${fmt(summary.total_leads ?? summary.leads ?? 0)}`}
                    sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700 }}
                  />
                </>
              )}
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s', border: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: SOFT_BG }}>
                    <TableCell sx={{ fontWeight: 800, color: META_BLUE }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: META_BLUE }} align="center">Day</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: META_BLUE }} align="right">Spend</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">Reach</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">Impressions</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">Clicks</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">CTR</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">CPC</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">CPM</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#0e7c4a' }} align="center">Form Leads</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#0e7c4a' }} align="center">WhatsApp</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#0e7c4a' }} align="center">Total Leads</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: META_BLUE }} align="right">CPL</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        No Meta Ads activity in the selected range
                      </TableCell>
                    </TableRow>
                  ) : displayRows.map((r) => (
                    <TableRow key={r.date} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{datePretty(r.date)}</TableCell>
                      <TableCell align="center" sx={{ color: 'text.secondary' }}>{dayName(r.date)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: META_BLUE }}>{fmtINR(r.spend)}</TableCell>
                      <TableCell align="right">{fmt(r.reach)}</TableCell>
                      <TableCell align="right">{fmt(r.impressions)}</TableCell>
                      <TableCell align="right">{fmt(r.clicks)}</TableCell>
                      <TableCell align="right">{fmtPct(r.ctr)}</TableCell>
                      <TableCell align="right">{fmtINR(r.cpc)}</TableCell>
                      <TableCell align="right">{fmtINR(r.cpm)}</TableCell>
                      <TableCell align="center">{fmt(r.form_leads)}</TableCell>
                      <TableCell align="center">{fmt(r.whatsapp_leads)}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: r.total_leads > 0 ? '#0e7c4a' : '#9ca3af' }}>
                        {fmt(r.total_leads)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: r.cpl > 0 ? META_BLUE : '#9ca3af' }}>
                        {r.cpl > 0 ? fmtINR(r.cpl) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {displayRows.length > 0 && (() => {
                    // Sum the visible day-rows so the TOTAL always
                    // reconciles with what's on screen — even if the
                    // backend hasn't been restarted yet and is still
                    // serving the old daily_trend without reach/ctr/
                    // cpc/cpm/cpl. CTR / CPC / CPM / CPL are derived
                    // from the summed totals (NOT averaged) so the
                    // math matches the KPI grid on the Meta Ads tab.
                    const sum = displayRows.reduce((acc, r) => {
                      acc.spend += Number(r.spend) || 0;
                      acc.reach += Number(r.reach) || 0;
                      acc.impressions += Number(r.impressions) || 0;
                      acc.clicks += Number(r.clicks) || 0;
                      acc.form_leads += Number(r.form_leads) || 0;
                      acc.whatsapp_leads += Number(r.whatsapp_leads) || 0;
                      acc.total_leads += Number(r.total_leads) || 0;
                      return acc;
                    }, { spend: 0, reach: 0, impressions: 0, clicks: 0, form_leads: 0, whatsapp_leads: 0, total_leads: 0 });

                    const ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
                    const cpc = sum.clicks > 0 ? sum.spend / sum.clicks : 0;
                    const cpm = sum.impressions > 0 ? (sum.spend / sum.impressions) * 1000 : 0;
                    const cpl = sum.total_leads > 0 ? sum.spend / sum.total_leads : 0;
                    return (
                      <TableRow sx={{ bgcolor: SOFT_BG }}>
                        <TableCell sx={{ fontWeight: 800, color: META_BLUE }}>TOTAL</TableCell>
                        <TableCell />
                        <TableCell align="right" sx={{ fontWeight: 800, color: META_BLUE }}>{fmtINR(sum.spend)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(sum.reach)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(sum.impressions)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(sum.clicks)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPct(ctr)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtINR(cpc)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtINR(cpm)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{fmt(sum.form_leads)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{fmt(sum.whatsapp_leads)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#0e7c4a' }}>{fmt(sum.total_leads)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: META_BLUE }}>
                          {cpl > 0 ? fmtINR(cpl) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default LeadCheckPanel;
