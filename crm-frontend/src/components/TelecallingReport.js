import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, TextField, Button, CircularProgress, Alert,
  Table, TableHead, TableBody, TableRow, TableCell, ClickAwayListener,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';

// EOD telecalling report. Renders the four sections from the team's
// Google Sheet: Day Target vs Achieved, Month Target vs Achieved,
// Appointment Status, and Day Summary (Leads Abstract + calls +
// appointments + conversion). Layout mirrors the spreadsheet 1:1 so
// the team can swap their sheet for this dashboard.
//
// Props:
//   clientId, apiInstance — as before.
//   clientName            — shown in the "TELECALLING REPORT - <name>"
//                           header. Optional; falls back to data from
//                           the API response.
//   onJumpToLeads(filter) — optional. When provided, clickable numbers
//                           call back with a filter object the parent
//                           page uses to switch tabs + pre-filter the
//                           leads table.
// Inline number editor used by every editable cell in the EOD report
// (Converted Value, Physical Marketing, …). Keeps its own draft string
// so partial typing doesn't fight numeric parent state; commits on
// blur or Enter, reverts on Escape. Borderless so it fills the cell
// without changing row height.
const EditableNumberInput = ({ initialValue, onCommit }) => {
  const [draft, setDraft] = useState(String(initialValue ?? 0));
  const inputRef = useRef(null);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(initialValue ?? 0));
    }
  }, [initialValue]);
  const commit = () => {
    const cleaned = draft.replace(/[^0-9.]/g, '');
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num < 0) {
      setDraft(String(initialValue ?? 0));
      return;
    }
    if (num === Number(initialValue || 0)) return;
    onCommit(num);
  };
  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        else if (e.key === 'Escape') {
          setDraft(String(initialValue ?? 0));
          e.currentTarget.blur();
        }
      }}
      inputMode="numeric"
      title="Type a value and press Enter (or click away) to save. Also shows up in the Monthly Abstract."
      style={{
        width: '100%',
        height: '100%',
        padding: '8px 6px',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        textAlign: 'center',
        fontSize: '0.85rem',
        fontWeight: 700,
        fontFamily: 'inherit',
        color: '#111',
        cursor: 'text',
      }}
    />
  );
};

// `telecallerOnly` (defaults false) is passed by the client portal —
// when true we drop every AbstractEntry manual input (the four targets,
// the manual source counts, INCALL combined, Converted Value) because
// those aren't filled in the Leads tab. What stays is everything that
// rolls up from per-lead entries the team makes in the Leads tab:
// the Appointment Status table, plus the Day Summary's auto-fetched
// rows (WhatsApp / Instagram / Facebook source counts, call activity,
// connected counts, consultation + conversion). Admin pages don't
// pass the prop so they see the full report as before.
const TelecallingReport = ({ clientId, apiInstance, clientName, onJumpToLeads, telecallerOnly = false }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [report, setReport] = useState(null);
  // Loading splits into two flavours: the initial blocking spinner
  // (`loading`) and the silent 30s background refresh (`bgRefreshing`)
  // which must NOT swap the existing UI for a spinner.
  const [loading, setLoading] = useState(false);
  const [bgRefreshing, setBgRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Inline edit state for the four target cells.
  const [editingTarget, setEditingTarget] = useState(null); // 'day_consult' | 'day_calls' | 'month_consult' | 'month_calls' | null
  const [targetDraft, setTargetDraft] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  // Generic manual-override state. Two parallel maps keyed by field
  // name — `manualOverrides` holds the optimistic value the telecaller
  // just typed (so the cell shows it before the next 30s refetch),
  // `cellState` drives the brief save-status flash. Today we use this
  // for `convert_value` and `physical_marketing`; adding a third
  // editable field is just a new EditableCell render below.
  const [manualOverrides, setManualOverrides] = useState({});
  const [cellState, setCellState] = useState({});

  // Reset both maps whenever the displayed date or fetched report
  // changes — otherwise the override from yesterday would still
  // appear on top of today's auto-fetched value.
  useEffect(() => {
    setManualOverrides({});
    setCellState({});
  }, [date, report?.date]);

  const saveCell = useCallback(async (field, newVal) => {
    if (!clientId || !apiInstance) return;
    setCellState((s) => ({ ...s, [field]: 'saving' }));
    try {
      await apiInstance.post(`/meta/client/${clientId}/monthly-abstract/cell`, {
        date,
        field,
        value: newVal,
      });
      setManualOverrides((o) => ({ ...o, [field]: newVal }));
      setCellState((s) => ({ ...s, [field]: 'ok' }));
      setTimeout(() => {
        setCellState((s) => {
          if (s[field] !== 'ok') return s;
          const next = { ...s }; delete next[field]; return next;
        });
      }, 1200);
    } catch (err) {
      console.error(`save ${field} failed`, err);
      setCellState((s) => ({ ...s, [field]: 'err' }));
    }
  }, [clientId, apiInstance, date]);

  // Tiny helper — translates the cell save state into a background
  // tint. Falls back to the editable-cell cream so the visual signal
  // ("this cell can be typed in") survives at rest.
  const editableCellBg = (field) => {
    const state = cellState[field];
    if (state === 'ok') return '#d1fae5';
    if (state === 'err') return '#fee2e2';
    if (state === 'saving') return `${COPPER}22`;
    return EDITABLE_BG;
  };

  // Shared renderer for every editable cell in the Day Summary. Wraps
  // the input with: a cream background, a faint ✏️ corner badge, and
  // a hover-tint so users can tell at a glance that the cell accepts
  // typing. The badge is `pointer-events: none` so it doesn't steal
  // clicks meant for the input.
  //
  // Hover-tint is suppressed while a save-state flash is showing
  // (saving / ok / err) so the green or red feedback doesn't get
  // overwritten with cream the instant the cursor crosses the cell.
  const renderEditableCell = (field, initial) => {
    const flashing = !!cellState[field];
    return (
      <TableCell
        style={{
          ...valueStyle,
          backgroundColor: editableCellBg(field),
        }}
        sx={{
          ...valueSx,
          p: 0,
          position: 'relative',
          transition: 'background-color 0.15s',
          ...(flashing ? {} : { '&:hover': { backgroundColor: EDITABLE_BG_HOVER } }),
        }}
      >
        <EditableNumberInput
          initialValue={initial}
          onCommit={(v) => saveCell(field, v)}
        />
        <EditIcon sx={{
          position: 'absolute',
          top: 2, right: 3,
          fontSize: 11,
          color: COPPER,
          opacity: 0.55,
          pointerEvents: 'none',
        }} />
      </TableCell>
    );
  };

  // Backwards-compat helper used by the source-bucket rows (which all
  // pull their fallback value from `leads_abstract[field]`).
  const renderEditableSourceCell = (field) => renderEditableCell(
    field,
    manualOverrides[field] != null
      ? manualOverrides[field]
      : (report?.day?.leads_abstract?.[field] || 0),
  );

  // `fetchReport` accepts `silent: true` so the 30s timer can refresh
  // numbers without making the whole panel look "loading".
  const fetchReport = useCallback(async ({ silent = false } = {}) => {
    if (!clientId || !apiInstance) return;
    if (silent) setBgRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await apiInstance.get(`/meta/client/${clientId}/telecalling-report`, {
        params: { date },
      });
      setReport(res.data || null);
    } catch (err) {
      console.error('telecalling-report fetch failed', err);
      // Don't blow away a working report on a silent-refresh failure
      // (transient network). Only surface the error on the initial load.
      if (!silent) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load report');
        setReport(null);
      }
    } finally {
      if (silent) setBgRefreshing(false); else setLoading(false);
    }
  }, [clientId, apiInstance, date]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // 30-second silent auto-refresh. The leads table writes to the same
  // collection this report aggregates — so any save by a telecaller
  // surfaces here within at most 30s without a manual refresh.
  const fetchRef = useRef(fetchReport);
  fetchRef.current = fetchReport;
  useEffect(() => {
    const id = setInterval(() => {
      // Don't background-refresh while the user is mid-edit on a target.
      if (editingTarget) return;
      fetchRef.current({ silent: true });
    }, 30000);
    return () => clearInterval(id);
  }, [editingTarget]);

  const startEditTarget = (key, currentValue) => {
    setEditingTarget(key);
    setTargetDraft(String(currentValue ?? 0));
  };
  const cancelEditTarget = () => {
    if (savingTarget) return;
    setEditingTarget(null);
    setTargetDraft('');
  };
  const saveEditTarget = async () => {
    if (!editingTarget || savingTarget) return;
    const n = Number(targetDraft);
    if (!Number.isFinite(n) || n < 0) {
      setError('Target must be a non-negative number');
      return;
    }
    setSavingTarget(true);
    try {
      const res = await apiInstance.put(
        `/meta/client/${clientId}/telecalling-targets`,
        { [editingTarget]: Math.round(n) },
        { timeout: 15000 }
      );
      const newTargets = res.data?.targets;
      if (newTargets) {
        // Patch the report in-place so we don't need a full re-fetch.
        setReport((prev) => {
          if (!prev) return prev;
          const next = { ...prev, targets: newTargets };
          if (next.day) {
            next.day = {
              ...next.day,
              target_consulted: { ...next.day.target_consulted, target: newTargets.day_consult },
              target_connected: { ...next.day.target_connected, target: newTargets.day_calls },
            };
          }
          if (next.month_target) {
            const consulted = next.month_target.consulted || {};
            const connected = next.month_target.connected || {};
            const pct = (achieved, target) =>
              target > 0 ? Math.round((achieved / target) * 100) : 0;
            next.month_target = {
              consulted: {
                ...consulted,
                target: newTargets.month_consult,
                achieved_pct: pct(consulted.achieved || 0, newTargets.month_consult),
                projection_pct: pct(consulted.projection || 0, newTargets.month_consult),
              },
              connected: {
                ...connected,
                target: newTargets.month_calls,
                achieved_pct: pct(connected.achieved || 0, newTargets.month_calls),
                projection_pct: pct(connected.projection || 0, newTargets.month_calls),
              },
            };
          }
          return next;
        });
      }
      setEditingTarget(null);
      setTargetDraft('');
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save target');
    } finally {
      setSavingTarget(false);
    }
  };

  // Software palette — brown banners, copper sub-banners, cream rows.
  // Red highlight stays red on purpose: it marks the worst metric
  // (Achieved / Projection %) and the warning colour reads instantly.
  const BROWN = '#3E2723';
  const COPPER = '#C08552';
  const CREAM = '#FFF4ED';
  const BORDER = '#E8D5C4';
  const RED_HL = '#D9534F';
  const RED_HL_BG = '#FBE4E2';
  // Editable-cell paint — a warm yellow-cream that's visibly different
  // from the regular white value cells, plus a slightly warmer hover
  // state. The corner ✏️ icon is rendered on top so the two signals
  // (colour + icon) reinforce each other and a colour-blind user
  // still sees the affordance.
  const EDITABLE_BG = '#FFF7D6';
  const EDITABLE_BG_HOVER = '#FFEFA8';

  // Inline editor for the target cells. Click the number → small text
  // input + tick/cross. Enter saves, Escape cancels, click-away saves.
  // The whole flow keeps the cell layout identical so the table
  // doesn't reflow while editing.
  const EditableTarget = ({ targetKey, value }) => {
    const isEditing = editingTarget === targetKey;
    if (!isEditing) {
      return (
        <Box
          onClick={() => startEditTarget(targetKey, value)}
          title="Click to edit target"
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5,
            cursor: 'pointer', px: 0.5, borderRadius: 0.5,
            '&:hover': { backgroundColor: 'rgba(192,133,82,0.12)' },
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.86rem' }}>{value ?? 0}</Typography>
          <EditIcon sx={{ fontSize: 12, color: BROWN, opacity: 0.55 }} />
        </Box>
      );
    }
    return (
      <ClickAwayListener onClickAway={() => saveEditTarget()}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
          <TextField
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveEditTarget(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancelEditTarget(); }
            }}
            autoFocus
            disabled={savingTarget}
            inputProps={{ inputMode: 'numeric', style: { padding: '2px 6px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, width: 56 } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0.5 } }}
          />
          {savingTarget && <CircularProgress size={12} />}
        </Box>
      </ClickAwayListener>
    );
  };

  // Clickable cell helper. When the parent gave us an onJumpToLeads
  // callback, render the number as a button; otherwise render plain
  // text.
  const Num = ({ value, filter, color, weight = 700, size = '0.86rem' }) => {
    const text = value ?? 0;
    if (!onJumpToLeads || !filter) {
      return (
        <Typography sx={{ fontWeight: weight, fontSize: size, color: color || 'text.primary' }}>
          {text}
        </Typography>
      );
    }
    return (
      <Box
        onClick={() => onJumpToLeads(filter)}
        sx={{
          fontWeight: weight, fontSize: size, color: color || 'inherit',
          cursor: 'pointer', display: 'inline-block',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {text}
      </Box>
    );
  };

  if (loading && !report) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CircularProgress />
        <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>Loading report…</Typography>
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!report) return <Alert severity="info">No telecalling data yet for the selected date.</Alert>;

  const datePretty = (() => {
    try { return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '-'); }
    catch { return date; }
  })();

  const displayName = (clientName || report.client_name || '').toUpperCase();

  // We split each cell style into two halves:
  //   * the `*Style` object goes to the `style` prop (inline CSS) and
  //     carries the COLOURS + BORDERS — inline style has the highest
  //     CSS specificity short of !important and reliably beats any
  //     theme override that was hiding the maroon banners.
  //   * the `*Sx` object goes to the `sx` prop and carries everything
  //     MUI's spacing scale handles (py, px) plus typography.
  const bannerStyle = {
    backgroundColor: BROWN,
    color: '#fff',
    borderBottom: '1px solid #fff',
    borderRight: '1px solid #fff',
  };
  const bannerSx = {
    fontWeight: 800,
    textAlign: 'center',
    fontSize: '0.72rem',
    letterSpacing: 0.3,
    py: 0.7,
    textTransform: 'uppercase',
    lineHeight: 1.1,
  };

  const subStyle = {
    backgroundColor: COPPER,
    color: '#fff',
    borderBottom: '1px solid #fff',
    borderRight: '1px solid #fff',
  };
  const subSx = {
    fontWeight: 700,
    textAlign: 'center',
    fontSize: '0.7rem',
    letterSpacing: 0.2,
    py: 0.6,
    textTransform: 'uppercase',
    lineHeight: 1.1,
  };

  const sectionTitleStyle = {
    backgroundColor: CREAM,
    color: BROWN,
    borderBottom: `2px solid ${BROWN}`,
  };
  const sectionTitleSx = {
    fontWeight: 800,
    textAlign: 'center',
    fontSize: '0.82rem',
    letterSpacing: 0.3,
    py: 0.9,
    textTransform: 'uppercase',
  };

  const labelStyle = {
    backgroundColor: CREAM,
    color: '#1a1a1a',
    border: `1px solid ${BORDER}`,
  };
  const labelSx = {
    fontWeight: 700,
    fontSize: '0.74rem',
    textAlign: 'center',
    py: 0.6,
    lineHeight: 1.15,
  };

  const valueStyle = {
    backgroundColor: '#fff',
    color: '#1a1a1a',
    border: `1px solid ${BORDER}`,
  };
  const valueSx = {
    fontWeight: 700,
    fontSize: '0.85rem',
    textAlign: 'center',
    py: 0.7,
  };

  const redHlStyle = {
    backgroundColor: RED_HL,
    color: '#fff',
    border: '1px solid #fff',
  };
  const redHlSx = {
    fontWeight: 800,
    fontSize: '0.95rem',
    textAlign: 'center',
    py: 0.7,
  };

  const redLabelStyle = {
    backgroundColor: RED_HL_BG,
    color: '#1a1a1a',
    border: '1px solid #fff',
  };
  const redLabelSx = {
    fontWeight: 800,
    fontSize: '0.7rem',
    textAlign: 'center',
    py: 0.55,
    textTransform: 'uppercase',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
      {/* Toolbar — title + date picker + refresh */}
      <Paper variant="outlined" sx={{ p: 1.2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', borderLeft: `3px solid ${BROWN}` }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: BROWN, display: 'flex', alignItems: 'center', gap: 1 }}>
            EOD Report
            {bgRefreshing && <CircularProgress size={12} sx={{ color: BROWN, opacity: 0.6 }} />}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Auto-refreshes every 30s · numbers update from the Leads table as telecallers save.
          </Typography>
        </Box>
        <TextField
          type="date" size="small" label="Report date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 170 }}
        />
        <Button
          size="small" variant="outlined"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={fetchReport} disabled={loading}
        >
          Refresh
        </Button>
      </Paper>

      {/* Legend — two small chips that teach the visual language used
          throughout the report so users know which cells they can
          click into vs which ones are auto-fetched. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', px: 0.4 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600 }}>
          Legend:
        </Typography>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.6,
          px: 0.9, py: 0.3, borderRadius: 1,
          border: `1px solid ${BORDER}`, backgroundColor: EDITABLE_BG,
          position: 'relative',
        }}>
          <EditIcon sx={{ fontSize: 12, color: COPPER, opacity: 0.8 }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: BROWN }}>
            Editable — click to type
          </Typography>
        </Box>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.6,
          px: 0.9, py: 0.3, borderRadius: 1,
          border: `1px solid ${BORDER}`, backgroundColor: '#fff',
        }}>
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: BORDER }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: BROWN }}>
            Read-only — auto-fetched from leads
          </Typography>
        </Box>
      </Box>

      {/* Header card — TELECALLING REPORT - <CLIENT>  |  DATE  |  DD-MM-YYYY */}
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
          <TableBody>
            <TableRow>
              <TableCell style={bannerStyle} sx={{ ...bannerSx, textAlign: 'left', pl: 2, width: '40%', fontSize: '0.85rem' }}>
                TELECALLING REPORT{displayName ? ` - ${displayName}` : ''}
              </TableCell>
              <TableCell style={bannerStyle} sx={{ ...bannerSx, width: '15%' }}>DATE</TableCell>
              <TableCell style={valueStyle} sx={{ ...valueSx, fontWeight: 800, color: BROWN, fontSize: '0.95rem' }}>
                {datePretty}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* ── Telecaller-only simplified view ─────────────────────────
          Client portal mode: render ONLY the values that aggregate
          from per-lead entries telecallers make in the Leads tab.
          Hidden: the four AbstractEntry targets, the manual source
          counts (Google Lead / JustDial / Walk-In / Referral /
          Physical Marketing), the combined INCALL cell, and
          Converted Value — none of those are entered against an
          individual lead.
          Shown: WhatsApp / Instagram / Facebook lead counts (derived
          from Lead.platform), call activity (first_call_date +
          follow_ups), connected breakdown (call labels), totals,
          consultation + conversion (response_label), and the
          Appointment Status table further below. */}
      {telecallerOnly && (
        <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
          <Table size="small" sx={{ borderCollapse: 'collapse' }}>
            <TableHead>
              <TableRow>
                <TableCell colSpan={6} style={sectionTitleStyle} sx={sectionTitleSx}>
                  TODAY · {datePretty}
                </TableCell>
              </TableRow>
              <TableHead>
              </TableHead>
            </TableHead>
            <TableBody>
              {/* Sources (auto from Lead.platform / Lead.manual_source_type) */}
              <TableRow>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>WhatsApp</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.whatsapp} filter={{ source: ['whatsapp'] }} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Fresh Calls</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.fresh} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Fresh · Connected</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.fresh_connected} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Instagram</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.instagram} filter={{ source: ['instagram'] }} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Call Backs</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.callback} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Call Back · Connected</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.callback_connected} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Facebook</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.facebook} filter={{ source: ['facebook'] }} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2, fontWeight: 800 }}>Total Calls</TableCell>
                <TableCell style={valueStyle} sx={{ ...valueSx, fontWeight: 800 }}><Num value={report.day.calls.total} weight={800} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2, fontWeight: 800 }}>Total Connected</TableCell>
                <TableCell style={valueStyle} sx={{ ...valueSx, fontWeight: 800 }}><Num value={report.day.calls.connected_total} filter={{ callLabel: ['CONNECTED'] }} weight={800} /></TableCell>
              </TableRow>
              {/* Lead totals + status (auto from response_label / call labels / is_duplicate) */}
              <TableRow>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2, fontWeight: 800 }}>Total Leads</TableCell>
                <TableCell style={valueStyle} sx={{ ...valueSx, fontWeight: 800 }}><Num value={report.day.leads_abstract.total} weight={800} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Connected</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.connected} filter={{ callLabel: ['CONNECTED'] }} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Not Connected</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.not_connected} filter={{ callLabel: ['NOT CONNECTED', 'DISCONNECTED', 'RNR', 'BUSY'] }} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Valid Leads</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.valid} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Connected %</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.connected_pct} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Valid Leads %</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.leads_abstract.valid_pct} /></TableCell>
              </TableRow>
              {/* Appointments + Consultation + Conversion (auto from
                  appointment_booked_date + response_label) */}
              <TableRow>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2, fontWeight: 800 }}>Total Appointments</TableCell>
                <TableCell style={{ ...valueStyle, backgroundColor: '#FCE7C8' }} sx={{ ...valueSx, fontWeight: 800 }}>
                  <Num value={report.day.appointments_booked} filter={{ appointment: ['APPOINTMENT BOOKED', 'RESCHEDULED', 'COMPLETED'] }} weight={800} />
                </TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Consulted</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.consultation.consulted} filter={{ response: ['CONSULTED'] }} /></TableCell>
                <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>Converted</TableCell>
                <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.consultation.converted} filter={{ response: ['TREATMENT BOOKED', 'CLOSED'] }} /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Appointment Status (also shown in telecallerOnly mode) ──
          Standalone table that lists booked vs visited vs rescheduled
          vs not-visited for yesterday + today + the next five days.
          Auto-fetched from Lead.appointment_status so the whole table
          reflects telecaller entries. */}
      {telecallerOnly && (
        <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
          <Table size="small" sx={{ borderCollapse: 'collapse' }}>
            <TableHead>
              <TableRow>
                <TableCell colSpan={3} style={sectionTitleStyle} sx={{ ...sectionTitleSx, textAlign: 'left', pl: 2 }}>
                  APPOINTMENT STATUS
                </TableCell>
                <TableCell colSpan={Math.max((report.appointment_status?.length || 0) - 2, 0)} style={sectionTitleStyle} sx={sectionTitleSx}>
                  FUTURE APPOINTMENTS
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={bannerStyle} sx={{ ...bannerSx, textAlign: 'left', pl: 2, width: 200 }}>Day</TableCell>
                {report.appointment_status.map((row) => (
                  <TableCell key={row.date} style={bannerStyle} sx={bannerSx}>
                    {row.offset === -1 ? 'Yesterday' : row.offset === 0 ? 'Today' : row.day_name}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell style={bannerStyle} sx={{ ...bannerSx, textAlign: 'left', pl: 2 }}>Date</TableCell>
                {report.appointment_status.map((row) => {
                  const [y, m, d] = (row.date || '').split('-');
                  const dd = (y && m && d) ? `${d}-${m}-${y}` : row.date;
                  return (
                    <TableCell key={`d-${row.date}`} style={bannerStyle} sx={bannerSx}>{dd}</TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell style={labelStyle} sx={labelSx}>Total Appointment Booked</TableCell>
                {report.appointment_status.map((row) => (
                  <TableCell key={`b-${row.date}`} style={valueStyle} sx={valueSx}>
                    <Num value={row.booked} filter={{ appointment: ['APPOINTMENT BOOKED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'] }} />
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell style={labelStyle} sx={labelSx}>Visited Appointments</TableCell>
                {report.appointment_status.map((row) => (
                  <TableCell key={`v-${row.date}`} style={valueStyle} sx={valueSx}>
                    <Num value={row.visited ?? 0} filter={{ appointment: ['COMPLETED'] }} color="#0e7c4a" />
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell style={labelStyle} sx={labelSx}>Rescheduled</TableCell>
                {report.appointment_status.map((row) => (
                  <TableCell key={`r-${row.date}`} style={valueStyle} sx={valueSx}>
                    <Num value={row.rescheduled ?? 0} filter={{ appointment: ['RESCHEDULED'] }} />
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell style={labelStyle} sx={labelSx}>Not Visited Appointments</TableCell>
                {report.appointment_status.map((row) => (
                  <TableCell key={`nv-${row.date}`} style={valueStyle} sx={valueSx}>
                    <Num value={row.not_visited ?? 0} color="#b91c1c" />
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Response breakdown (telecallerOnly) ─────────────────────
          One cell per Response dropdown value (HOT / WARM / COLD /
          CONSULTED / TREATMENT BOOKED / etc.) showing how many leads
          the telecaller marked at that response today. Anchored to
          `touchedToday` on the backend so the count reflects work
          done on this date, not the whole month. Each cell is also
          a Leads-table jump when onJumpToLeads is provided. */}
      {telecallerOnly && report?.day?.response_breakdown && (
        <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
          <Table size="small" sx={{ borderCollapse: 'collapse' }}>
            <TableHead>
              <TableRow>
                <TableCell colSpan={6} style={sectionTitleStyle} sx={sectionTitleSx}>
                  RESPONSE — WHAT THE TELECALLER PICKED ON EACH LEAD
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                ['HOT', 'WARM', 'COLD'],
                ['CONSULTED', 'TREATMENT BOOKED', 'CLOSED'],
                ['NOT INTERESTED', 'NOT REQUIRED', 'NOT ENQUIRED'],
                ['CTC', 'WILL CALL', 'DUPLICATE'],
              ].map((row, rowIdx) => (
                <TableRow key={`resp-row-${rowIdx}`}>
                  {row.flatMap((label) => {
                    const count = report.day.response_breakdown[label] || 0;
                    return [
                      <TableCell
                        key={`l-${label}`}
                        style={labelStyle}
                        sx={{ ...labelSx, textAlign: 'left', pl: 2 }}
                      >
                        {label}
                      </TableCell>,
                      <TableCell key={`v-${label}`} style={valueStyle} sx={valueSx}>
                        <Num value={count} filter={{ response: [label] }} />
                      </TableCell>,
                    ];
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Today's Leads — full detail per lead (telecallerOnly) ───
          Mirrors the Leads tab columns so the client/team can see
          exactly what the telecaller filled in for each lead worked
          today. Read-only here — editing still happens in the Leads
          tab. Scrolls horizontally on narrow screens. */}
      {telecallerOnly && Array.isArray(report?.day?.today_leads) && (
        <Paper variant="outlined" sx={{ overflow: 'auto', borderRadius: 1 }}>
          <Box sx={{ minWidth: 1500 }}>
            <Table size="small" sx={{ borderCollapse: 'collapse' }}>
              <TableHead>
                <TableRow>
                  <TableCell colSpan={15} style={sectionTitleStyle} sx={{ ...sectionTitleSx, textAlign: 'left', pl: 2 }}>
                    TODAY'S LEADS — {report.day.today_leads.length} {report.day.today_leads.length === 1 ? 'entry' : 'entries'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  {[
                    'Date', 'Source', 'Name', 'Contact', 'Location',
                    'Hair / Skin', 'First Call Date', 'Call Label',
                    'Response', 'Remarks', 'Next Follow-up', 'Status',
                    'Appt. Date', 'FU #', 'Latest / History',
                  ].map((h) => (
                    <TableCell key={h} style={{ ...bannerStyle, backgroundColor: COPPER }} sx={{ ...bannerSx, fontSize: '0.66rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {report.day.today_leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} style={valueStyle} sx={{ ...valueSx, color: 'text.secondary', fontStyle: 'italic', py: 2 }}>
                      No leads worked on this date yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.day.today_leads.map((l) => {
                    const fmtDate = (d) => {
                      if (!d) return '—';
                      try {
                        return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '-');
                      } catch { return '—'; }
                    };
                    const latest = l.latest_followup;
                    const latestText = latest
                      ? `${fmtDate(latest.date)} · ${latest.call_label || '—'}${latest.remarks ? ` · ${latest.remarks}` : ''}`
                      : '—';
                    return (
                      <TableRow key={l._id} sx={{ '&:nth-of-type(even)': { backgroundColor: CREAM } }}>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, whiteSpace: 'nowrap' }}>{fmtDate(l.date)}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, textTransform: 'uppercase' }}>{l.source || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, fontWeight: 700 }}>{l.name || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, fontFamily: 'monospace' }}>{l.phone || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1 }}>{l.lead_location || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1 }}>{l.lead_category || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, whiteSpace: 'nowrap' }}>{fmtDate(l.first_call_date)}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1 }}>{l.first_call_label || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, fontWeight: 700 }}>{l.response_label || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, maxWidth: 220, whiteSpace: 'normal' }}>{l.remarks || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, whiteSpace: 'nowrap' }}>{fmtDate(l.next_followup_date)}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1 }}>{l.appointment_status || '—'}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, whiteSpace: 'nowrap' }}>{fmtDate(l.appointment_date)}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'center', fontWeight: 700 }}>{l.fu_count}</TableCell>
                        <TableCell style={valueStyle} sx={{ ...valueSx, fontSize: '0.72rem', textAlign: 'left', pl: 1, maxWidth: 260, whiteSpace: 'normal' }}>{latestText}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {/* ── DAY TARGET VS ACHIEVED ───────────────────────────────── */}
      {!telecallerOnly && (
      <>
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
          <TableHead>
            <TableRow>
              <TableCell colSpan={6} style={sectionTitleStyle} sx={sectionTitleSx}>
                DAY TARGET VS ACHIEVED
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell rowSpan={2} style={bannerStyle} sx={{ ...bannerSx, width: 140 }}>Telecalling Report</TableCell>
              <TableCell colSpan={2} style={bannerStyle} sx={bannerSx}>Consulted Appointment</TableCell>
              <TableCell rowSpan={2} style={bannerStyle} sx={bannerSx}>Total Calls</TableCell>
              <TableCell colSpan={2} style={bannerStyle} sx={bannerSx}>Connected Calls</TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={subStyle} sx={subSx}>Target</TableCell>
              <TableCell style={subStyle} sx={subSx}>Achieved</TableCell>
              <TableCell style={subStyle} sx={subSx}>Target</TableCell>
              <TableCell style={subStyle} sx={subSx}>Achieved</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell style={labelStyle} sx={labelSx}>&nbsp;</TableCell>
              <TableCell style={{ ...valueStyle, backgroundColor: EDITABLE_BG }} sx={{ ...valueSx, position: 'relative', '&:hover': { backgroundColor: EDITABLE_BG_HOVER } }}>
                <EditableTarget targetKey="day_consult" value={report.day.target_consulted.target} />
              </TableCell>
              <TableCell style={redHlStyle} sx={redHlSx}>
                <Num value={report.day.target_consulted.achieved} filter={{ response: ['CONSULTED'] }} color="#fff" size="1rem" />
              </TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.target_calls} /></TableCell>
              <TableCell style={{ ...valueStyle, backgroundColor: EDITABLE_BG }} sx={{ ...valueSx, position: 'relative', '&:hover': { backgroundColor: EDITABLE_BG_HOVER } }}>
                <EditableTarget targetKey="day_calls" value={report.day.target_connected.target} />
              </TableCell>
              <TableCell style={redHlStyle} sx={redHlSx}>
                <Num value={report.day.target_connected.achieved} filter={{ callLabel: ['CONNECTED'] }} color="#fff" size="1rem" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* ── MONTH TARGET VS ACHIEVED ─────────────────────────────── */}
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
          <TableHead>
            <TableRow>
              <TableCell colSpan={7} style={sectionTitleStyle} sx={sectionTitleSx}>
                MONTH TARGET VS ACHIEVED
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell rowSpan={2} style={bannerStyle} sx={{ ...bannerSx, width: 140 }}>Telecalling Report</TableCell>
              <TableCell colSpan={3} style={bannerStyle} sx={bannerSx}>Consulted Appointment</TableCell>
              <TableCell colSpan={3} style={bannerStyle} sx={bannerSx}>Connected Calls</TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={subStyle} sx={subSx}>Target</TableCell>
              <TableCell style={subStyle} sx={subSx}>Achieved</TableCell>
              <TableCell style={subStyle} sx={subSx}>Projection</TableCell>
              <TableCell style={subStyle} sx={subSx}>Target</TableCell>
              <TableCell style={subStyle} sx={subSx}>Achieved</TableCell>
              <TableCell style={subStyle} sx={subSx}>Projection</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell style={labelStyle} sx={labelSx}>&nbsp;</TableCell>
              <TableCell style={{ ...valueStyle, backgroundColor: EDITABLE_BG }} sx={{ ...valueSx, position: 'relative', '&:hover': { backgroundColor: EDITABLE_BG_HOVER } }}>
                <EditableTarget targetKey="month_consult" value={report.month_target.consulted.target} />
              </TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.month_target.consulted.achieved} filter={{ response: ['CONSULTED'] }} /></TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.month_target.consulted.projection} /></TableCell>
              <TableCell style={{ ...valueStyle, backgroundColor: EDITABLE_BG }} sx={{ ...valueSx, position: 'relative', '&:hover': { backgroundColor: EDITABLE_BG_HOVER } }}>
                <EditableTarget targetKey="month_calls" value={report.month_target.connected.target} />
              </TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.month_target.connected.achieved} filter={{ callLabel: ['CONNECTED'] }} /></TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.month_target.connected.projection} /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={labelStyle} sx={labelSx}>Achieved %</TableCell>
              <TableCell colSpan={3} style={valueStyle} sx={valueSx}><Num value={report.month_target.consulted.achieved_pct} /></TableCell>
              <TableCell colSpan={3} style={valueStyle} sx={valueSx}><Num value={report.month_target.connected.achieved_pct} /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={redLabelStyle} sx={redLabelSx}>Projection %</TableCell>
              <TableCell colSpan={3} style={redHlStyle} sx={redHlSx}>
                <Num value={report.month_target.consulted.projection_pct} color="#fff" size="0.95rem" />
              </TableCell>
              <TableCell colSpan={3} style={redHlStyle} sx={redHlSx}>
                <Num value={report.month_target.connected.projection_pct} color="#fff" size="0.95rem" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* ── APPOINTMENT STATUS ───────────────────────────────────── */}
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
          <TableHead>
            {/* Top banner — splits into the section title + the "FUTURE
                APPOINTMENTS" group label exactly like the sheet. */}
            <TableRow>
              <TableCell colSpan={3} style={sectionTitleStyle} sx={{ ...sectionTitleSx, textAlign: 'left', pl: 2 }}>
                APPOINTMENT STATUS
              </TableCell>
              <TableCell colSpan={Math.max((report.appointment_status?.length || 0) - 2, 0)} style={sectionTitleStyle} sx={sectionTitleSx}>
                FUTURE APPOINTMENTS
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell style={bannerStyle} sx={{ ...bannerSx, textAlign: 'left', pl: 2, width: 200 }}>Day</TableCell>
              {report.appointment_status.map((row) => (
                <TableCell key={row.date} style={bannerStyle} sx={bannerSx}>
                  {row.offset === -1 ? 'Yesterday' : row.offset === 0 ? 'Today' : row.day_name}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell style={bannerStyle} sx={{ ...bannerSx, textAlign: 'left', pl: 2 }}>Date</TableCell>
              {report.appointment_status.map((row) => {
                const [y, m, d] = (row.date || '').split('-');
                const dd = (y && m && d) ? `${d}-${m}-${y}` : row.date;
                return (
                  <TableCell key={`d-${row.date}`} style={bannerStyle} sx={bannerSx}>
                    {dd}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell style={labelStyle} sx={labelSx}>Total Appointment Booked</TableCell>
              {report.appointment_status.map((row) => (
                <TableCell key={`b-${row.date}`} style={valueStyle} sx={valueSx}>
                  <Num value={row.booked} filter={{ appointment: ['APPOINTMENT BOOKED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'] }} />
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell style={labelStyle} sx={labelSx}>Visited Appointments</TableCell>
              {report.appointment_status.map((row) => (
                <TableCell key={`v-${row.date}`} style={valueStyle} sx={valueSx}>
                  <Num value={row.visited ?? 0} filter={{ appointment: ['COMPLETED'] }} color="#0e7c4a" />
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell style={labelStyle} sx={labelSx}>Rescheduled</TableCell>
              {report.appointment_status.map((row) => (
                <TableCell key={`r-${row.date}`} style={valueStyle} sx={valueSx}>
                  <Num value={row.rescheduled ?? 0} filter={{ appointment: ['RESCHEDULED'] }} />
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell style={labelStyle} sx={labelSx}>Not Visited Appointments</TableCell>
              {report.appointment_status.map((row) => (
                <TableCell key={`nv-${row.date}`} style={valueStyle} sx={valueSx}>
                  <Num value={row.not_visited ?? 0} color="#b91c1c" />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* ── DAY SUMMARY (the big three-quadrant section) ─────────── */}
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
          <TableHead>
            <TableRow>
              <TableCell colSpan={2} style={bannerStyle} sx={{ ...bannerSx, fontSize: '0.84rem', py: 0.9 }}>DAY SUMMARY</TableCell>
              <TableCell colSpan={4} style={{ ...bannerStyle, backgroundColor: COPPER }} sx={{ ...bannerSx, fontSize: '0.78rem', py: 0.9 }}>{datePretty}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={2} style={bannerStyle} sx={{ ...bannerSx, py: 0.6 }}>Leads Abstract</TableCell>
              <TableCell colSpan={2} style={bannerStyle} sx={{ ...bannerSx, py: 0.6 }}>Total Calls</TableCell>
              <TableCell colSpan={2} style={bannerStyle} sx={{ ...bannerSx, py: 0.6 }}>Total Connected Calls</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Row 1 — WhatsApp / Fresh Calls / Fresh Calls (connected) */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2, width: 180 }}>WHATS APP</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.whatsapp} filter={{ source: ['whatsapp'] }} />
              </TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2, width: 150 }}>FRESH CALLS</TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.fresh} /></TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2, width: 150 }}>FRESH CALLS</TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.fresh_connected} /></TableCell>
            </TableRow>
            {/* Row 2 — Instagram / Call Backs */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>INSTAGRAM</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.instagram} filter={{ source: ['instagram'] }} />
              </TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>CALL BACKS</TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.callback} /></TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>CALL BACKS</TableCell>
              <TableCell style={valueStyle} sx={valueSx}><Num value={report.day.calls.callback_connected} /></TableCell>
            </TableRow>
            {/* Row 3 — Facebook / Total / Total */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>FACEBOOK</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.facebook} filter={{ source: ['facebook'] }} />
              </TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>TOTAL</TableCell>
              <TableCell style={valueStyle} sx={{ ...valueSx, fontWeight: 800 }}>
                <Num value={report.day.calls.total} weight={800} />
              </TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>TOTAL</TableCell>
              <TableCell style={valueStyle} sx={{ ...valueSx, fontWeight: 800 }}>
                <Num value={report.day.calls.connected_total} filter={{ callLabel: ['CONNECTED'] }} weight={800} />
              </TableCell>
            </TableRow>
            {/* Row 4 — Google Lead / Total Leads / Total Appointments banner */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>GOOGLE LEAD</TableCell>
              {renderEditableSourceCell('google_lead')}
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>TOTAL LEADS</TableCell>
              <TableCell style={valueStyle} sx={{ ...valueSx, fontWeight: 800 }}>
                <Num value={report.day.leads_abstract.total} weight={800} />
              </TableCell>
              <TableCell colSpan={2} style={{ ...subStyle, backgroundColor: COPPER }} sx={{ ...subSx, fontWeight: 800 }}>
                TOTAL APPOINTMENTS BOOKED
              </TableCell>
            </TableRow>
            {/* Row 5 — Justdial / Valid Leads / Appointments value */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>JUSTDIAL</TableCell>
              {renderEditableSourceCell('justdial')}
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>VALID LEADS</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.valid} />
              </TableCell>
              <TableCell colSpan={2} style={{ ...valueStyle, backgroundColor: '#FCE7C8' }} sx={{ ...valueSx, fontSize: '1.05rem', fontWeight: 800 }}>
                <Num value={report.day.appointments_booked} filter={{ appointment: ['APPOINTMENT BOOKED', 'RESCHEDULED', 'COMPLETED'] }} weight={800} size="1rem" />
              </TableCell>
            </TableRow>
            {/* Row 6 — Walk-In / Connected Leads / Consultation banner */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>WALK-IN</TableCell>
              {renderEditableSourceCell('walk_in')}
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>CONNECTED LEADS</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.connected} filter={{ callLabel: ['CONNECTED'] }} />
              </TableCell>
              <TableCell colSpan={2} style={{ ...subStyle, backgroundColor: COPPER }} sx={{ ...subSx, fontWeight: 800 }}>
                CONSULTATION AND CONVERSION
              </TableCell>
            </TableRow>
            {/* Row 7 — Referral / Not Connected / Total Consultation */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>REFERRAL</TableCell>
              {renderEditableSourceCell('referral')}
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>NOT CONNECTED LEADS</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.not_connected} filter={{ callLabel: ['NOT CONNECTED', 'DISCONNECTED', 'RNR', 'BUSY'] }} />
              </TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>TOTAL CONSULTATION</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.consultation.consulted} filter={{ response: ['CONSULTED'] }} />
              </TableCell>
            </TableRow>
            {/* Row 8 — Physical Marketing / Connected % / Total Conversion */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>PHYSICAL MARKETING</TableCell>
              {renderEditableSourceCell('physical_marketing')}
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>CONNECTED %</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.connected_pct} />
              </TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>TOTAL CONVERSION</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.consultation.converted} filter={{ response: ['TREATMENT BOOKED', 'CLOSED'] }} />
              </TableCell>
            </TableRow>
            {/* Row 9 — Incall / Valid Leads % / Converted Value */}
            <TableRow>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>INCALL</TableCell>
              {/* Single editable cell. Saves to `incall_total` — when
                  set, overrides the sum of the four incall_* sub-types
                  for both views. If left alone, the cell shows the
                  running sum of whatever was typed in the Abstract. */}
              {renderEditableCell('incall_total', manualOverrides.incall_total != null
                ? manualOverrides.incall_total
                : (report?.day?.leads_abstract?.incall || 0))}
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>VALID LEADS %</TableCell>
              <TableCell style={valueStyle} sx={valueSx}>
                <Num value={report.day.leads_abstract.valid_pct} />
              </TableCell>
              <TableCell style={labelStyle} sx={{ ...labelSx, textAlign: 'left', pl: 2 }}>CONVERTED VALUE</TableCell>
              {/* Editable. Saves to AbstractEntry — the same row the
                  Monthly Abstract reads, so the two views stay in
                  lockstep across reloads. */}
              {renderEditableCell('convert_value', manualOverrides.convert_value != null
                ? manualOverrides.convert_value
                : (report.day.consultation.converted_value || 0))}
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
      </>
      )}

      {onJumpToLeads && !telecallerOnly && (
        <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Tip: click any underlined number to jump to the Leads table with that filter pre-applied.
        </Typography>
      )}
    </Box>
  );
};

export default TelecallingReport;
