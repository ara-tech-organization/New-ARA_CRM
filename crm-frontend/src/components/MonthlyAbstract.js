import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Paper, FormControl, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell,
  CircularProgress, Alert, Button, Card, CardContent,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import EditIcon from '@mui/icons-material/Edit';

// Monthly Abstract — per-day grid view of the telecalling sheet.
// Layout mirrors the agency's working sheet: TOTAL row up top, one
// row per date below, columns grouped into Source / Lead Status /
// Calls / Appointments + Conversion.
//
// Props:
//   clientId:    Mongo _id
//   apiInstance: axios instance with portal/admin auth

// Software palette — same constants the EOD report and Client Portal
// Access page use, so the three reports read as one product.
const BROWN = '#3E2723';
const COPPER = '#C08552';
const CREAM = '#FFF4ED';
const BORDER = '#E8D5C4';
const SOFT_HL = '#FCE7C8';      // amber-cream highlight for emphasis columns
// Editable-cell paint — same warm yellow-cream the EOD report uses,
// plus a slightly warmer hover state. Pairs with a tiny ✏️ corner
// icon so the affordance still reads when the background washes
// out (printed reports, low-contrast monitors).
const EDITABLE_BG = '#FFF7D6';
const EDITABLE_BG_HOVER = '#FFEFA8';

const fmtMonthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const monthOptions = () => {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 13; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    opts.push({ value: ym, label: fmtMonthLabel(ym) });
  }
  return opts;
};

// All columns the grid *could* show. The displayed set is filtered at
// render time from the month TOTAL — any column the whole month has
// zero of is hidden so admins/clients aren't scanning past dead cells.
// `keepIfTotal` columns ignore that rule because their absence would
// make the layout confusing (e.g. TOTAL LEADS = 0 still tells a
// story).
const COLUMNS = [
  // ── Auto-fetched from Leads ────────────────────────────────────
  // WhatsApp / Instagram / Facebook are the only source channels the
  // Leads table accepts now (FB + IG come from Meta sync, WhatsApp is
  // manually added via the Add Lead dialog), so their counts flow in
  // from the Lead aggregation.
  { key: 'whatsapp', label: 'WHATS APP', group: 'source' },
  { key: 'instagram', label: 'INSTAGRAM', group: 'source' },
  { key: 'facebook', label: 'FACEBOOK', group: 'source' },
  // ── Fetched from the EOD report (read-only here) ──────────────
  // Telecallers type these counts into the EOD's Day Summary cells.
  // The Monthly Abstract is a report view of the same AbstractEntry
  // row, so they show up here automatically — no editing needed in
  // the grid.
  { key: 'google_lead', label: 'GOOGLE LEAD', group: 'source' },
  { key: 'justdial', label: 'JUSTDIAL', group: 'source' },
  { key: 'walk_in', label: 'WALK-IN', group: 'source' },
  { key: 'referral', label: 'REFERRAL', group: 'source' },
  { key: 'physical_marketing', label: 'PHYSICAL MARKETING', group: 'source' },
  // ── Editable only in the Abstract ─────────────────────────────
  // Incall sub-types don't have their own cells in the EOD (which
  // shows a single combined INCALL sum), so the Abstract is the only
  // surface telecallers can type these into.
  { key: 'incall_google', label: 'INCALL GOOGLE', group: 'source', editable: true },
  { key: 'incall_fb', label: 'INCALL FB', group: 'source', editable: true },
  { key: 'incall_insta', label: 'INCALL INSTA', group: 'source', editable: true },
  { key: 'incall_self', label: 'INCALL SELF', group: 'source', editable: true },
  { key: 'total_leads', label: 'TOTAL LEADS', group: 'lead', bold: true, keepIfTotal: true },
  { key: 'connected', label: 'CONNECTED', group: 'lead' },
  { key: 'not_connected', label: 'NOT CONNECTED', group: 'lead' },
  { key: 'invalid_duplicate', label: 'INVALID / DUPLICATE', group: 'lead' },
  { key: 'fresh_calls', label: 'FRESH CALLS', group: 'calls' },
  { key: 'callback_1', label: 'CALL BACK-1', group: 'calls' },
  { key: 'callback_2', label: 'CALL BACK-2', group: 'calls' },
  { key: 'callback_3', label: 'CALL BACK-3', group: 'calls' },
  { key: 'callback', label: 'CALL BACK', group: 'calls' },
  { key: 'total_calls', label: 'TOTAL CALLS', group: 'calls', bold: true, highlight: SOFT_HL, keepIfTotal: true },
  { key: 'fresh_calls_connected', label: 'FRESH CONNECTED', group: 'connected' },
  { key: 'callback_connected', label: 'CALLBACK CONNECTED', group: 'connected' },
  { key: 'total_connected_calls', label: 'CONNECTED CALLS', group: 'connected', bold: true, highlight: SOFT_HL, keepIfTotal: true },
  { key: 'total_appointments', label: 'APPOINTMENTS', group: 'appt', bold: true, keepIfTotal: true },
  { key: 'consulted', label: 'CONSULTED', group: 'appt' },
  { key: 'convert', label: 'CONVERT', group: 'appt' },
  // Read-only here — telecallers type Convert Value in the EOD
  // report's CONVERTED VALUE cell. The Abstract displays the saved
  // number for the same date.
  { key: 'convert_value', label: 'CONVERT VALUE', group: 'appt' },
];

// Inline number editor for the Convert Value column. Keeps its own
// draft string so partial typing ("12000.5") doesn't fight with the
// numeric parent state. Commits on blur or Enter; Escape reverts.
const EditableNumberCell = ({ initialValue, onCommit }) => {
  const [draft, setDraft] = useState(String(initialValue ?? 0));
  // Sync draft when the row value changes externally (auto-refresh).
  // Without this, a 30s refetch would not bubble back into a focused
  // input — but we only re-sync when the input isn't focused, so the
  // telecaller's in-progress typing is preserved.
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
      // Bad input — revert silently.
      setDraft(String(initialValue ?? 0));
      return;
    }
    if (num === Number(initialValue || 0)) return; // no change → no save
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
      title="Type a value and press Enter (or click away) to save"
      style={{
        width: '100%',
        height: '100%',
        padding: '6px 4px',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        textAlign: 'center',
        fontSize: '0.74rem',
        fontWeight: 700,
        fontFamily: 'inherit',
        color: '#111',
        cursor: 'text',
      }}
    />
  );
};

const MonthlyAbstract = ({ clientId, apiInstance }) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bgRefreshing, setBgRefreshing] = useState(false);
  const [error, setError] = useState('');

  const opts = useMemo(() => monthOptions(), []);

  // `silent: true` is used by the 30s auto-refresh timer so the grid
  // doesn't flash a spinner each cycle. Errors during a silent refresh
  // are swallowed (the previously-rendered data stays on screen).
  const fetchAbstract = useCallback(async ({ silent = false } = {}) => {
    if (!clientId || !apiInstance) return;
    if (silent) setBgRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await apiInstance.get(`/meta/client/${clientId}/monthly-abstract`, {
        params: { month },
      });
      setData(res.data || null);
    } catch (err) {
      console.error('monthly-abstract fetch failed', err);
      if (!silent) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load report');
        setData(null);
      }
    } finally {
      if (silent) setBgRefreshing(false); else setLoading(false);
    }
  }, [clientId, apiInstance, month]);

  useEffect(() => { fetchAbstract(); }, [fetchAbstract]);

  // 30s silent auto-refresh — keeps the grid in sync with telecaller
  // saves on the leads table without a manual click.
  const fetchRef = useRef(fetchAbstract);
  fetchRef.current = fetchAbstract;
  useEffect(() => {
    const id = setInterval(() => {
      fetchRef.current({ silent: true });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // All columns from the reference sheet are always shown. Auto-fetched
  // fields display the API value; editable fields (today only
  // `convert_value`) render an inline input the telecaller can type
  // into. `useMemo` is still helpful to keep the column array reference
  // stable across renders so the cells below don't keep their refs in
  // dependency arrays.
  const visibleColumns = useMemo(() => COLUMNS, []);

  // Local optimistic overrides — when the telecaller saves a cell, we
  // patch the value here so the table reflects it before the next
  // 30s auto-refetch lands. Keyed by `${date}::${field}`.
  const [overrides, setOverrides] = useState({});
  // Lightweight save-state map — same key, value 'saving' | 'ok' | 'err'.
  // Drives the small status flash on each cell.
  const [cellState, setCellState] = useState({});

  const saveCell = useCallback(async ({ date, field, value }) => {
    if (!clientId || !apiInstance) return;
    const k = `${date}::${field}`;
    setCellState((s) => ({ ...s, [k]: 'saving' }));
    try {
      await apiInstance.post(`/meta/client/${clientId}/monthly-abstract/cell`, {
        date, field, value,
      });
      setOverrides((o) => ({ ...o, [k]: value }));
      setCellState((s) => ({ ...s, [k]: 'ok' }));
      // Drop the success flash after a moment so the cell goes neutral.
      setTimeout(() => {
        setCellState((s) => {
          if (s[k] !== 'ok') return s;
          const next = { ...s };
          delete next[k];
          return next;
        });
      }, 1200);
    } catch (err) {
      console.error('saveCell failed', err);
      setCellState((s) => ({ ...s, [k]: 'err' }));
    }
  }, [clientId, apiInstance]);

  // We keep colour + border on the `style` prop (inline CSS, highest
  // specificity) so they survive any MUI theme override. Typography
  // and spacing stay on `sx` where they belong.
  const headerStyle = {
    backgroundColor: BROWN,
    color: '#fff',
    border: '1px solid #fff',
  };
  const headerCellSx = {
    fontWeight: 700,
    fontSize: '0.62rem',
    textAlign: 'center',
    py: 1.2,
    px: 0.6,
    whiteSpace: 'nowrap',
    lineHeight: 1.05,
    verticalAlign: 'middle',
    textTransform: 'uppercase',
  };
  // Vertical column header. Rotated text can render OUTSIDE the cell
  // box (rotate doesn't trigger layout reflow), so we clip with
  // `overflow: hidden` to keep long labels from bleeding into the
  // TOTAL row above. Height is generous so the longest label we ship
  // ("CALLBACK CONNECTED", 18 chars) renders without truncation.
  const headerVerticalSx = {
    ...headerCellSx,
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    minWidth: 38,
    height: 160,
    py: 0.8,
    px: 0.4,
    overflow: 'hidden',
    fontSize: '0.6rem',
    letterSpacing: 0.3,
  };

  const bodyCellStyle = {
    backgroundColor: '#fff',
    border: `1px solid ${BORDER}`,
  };
  const bodyCellSx = {
    fontSize: '0.74rem',
    textAlign: 'center',
    py: 0.4,
    px: 0.4,
    fontWeight: 600,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ── Hero strip ─────────────────────────────────────────────
          Copper gradient + brown accent so this report reads as part
          of the same product as the EOD report and the dashboards. */}
      <Card
        variant="outlined"
        sx={{
          background: `linear-gradient(135deg, ${COPPER}12 0%, ${COPPER}05 50%, transparent 100%)`,
          borderLeft: `4px solid ${BROWN}`,
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ py: 1.6, '&:last-child': { pb: 1.6 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: BROWN, color: '#fff',
              }}>
                <AssessmentIcon fontSize="small" />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: BROWN, display: 'flex', alignItems: 'center', gap: 1 }}>
                  Monthly Abstract
                  {bgRefreshing && <CircularProgress size={12} sx={{ color: BROWN, opacity: 0.6 }} />}
                </Typography>
                <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                  Report view — one row per day, auto-refreshes every 30s.
                  Edit source counts and Convert Value in the EOD report;
                  only{' '}
                  <Box component="span" sx={{ color: COPPER, fontWeight: 700 }}>
                    INCALL GOOGLE / FB / INSTA / SELF
                  </Box>{' '}
                  are editable here.
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 180, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  sx={{ fontSize: '0.85rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } }}
                >
                  {opts.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                size="small" variant="contained"
                startIcon={loading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <RefreshIcon />}
                onClick={fetchAbstract} disabled={loading}
                sx={{
                  bgcolor: BROWN, color: '#fff', textTransform: 'none', fontWeight: 700,
                  '&:hover': { bgcolor: BROWN, filter: 'brightness(1.1)' },
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Legend — same visual language as the EOD report so users
          carry a single mental model between the two views. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', px: 0.4 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600 }}>
          Legend:
        </Typography>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.6,
          px: 0.9, py: 0.3, borderRadius: 1,
          border: `1px solid ${BORDER}`, backgroundColor: EDITABLE_BG,
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
            Read-only — auto-fetched
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ borderRadius: 1.5 }}>{error}</Alert>}

      {loading && !data && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress sx={{ color: COPPER }} />
          <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>Loading abstract…</Typography>
        </Box>
      )}

      {data && visibleColumns.length === 0 && (
        <Card variant="outlined" sx={{ py: 5, textAlign: 'center', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, color: BROWN, mb: 0.4 }}>No activity this month</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            Nothing has been logged in the Leads table for {fmtMonthLabel(data.month)} yet.
          </Typography>
        </Card>
      )}

      {data && visibleColumns.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: 'auto', borderRadius: 2, borderColor: BORDER }}>
          <Box sx={{ minWidth: Math.max(900, 80 + visibleColumns.length * 56) }}>
            <Table size="small" sx={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <TableHead>
                {/* Banner row — month context */}
                <TableRow>
                  <TableCell
                    style={headerStyle}
                    sx={{ ...headerCellSx, py: 0.6, fontSize: '0.65rem', textAlign: 'left', pl: 1.2, width: 90, minWidth: 90 }}
                  >
                    Month
                  </TableCell>
                  <TableCell
                    colSpan={visibleColumns.length}
                    style={headerStyle}
                    sx={{ ...headerCellSx, py: 0.6, fontSize: '0.78rem', textAlign: 'left', pl: 1.2 }}
                  >
                    {fmtMonthLabel(data.month)}
                  </TableCell>
                </TableRow>
                {/* TOTAL row immediately under the banner — copper to
                    stand apart from the brown banner without losing
                    the "this is a header" weight. */}
                <TableRow>
                  <TableCell
                    style={{ ...headerStyle, backgroundColor: COPPER }}
                    sx={{ ...headerCellSx, fontSize: '0.72rem' }}
                  >
                    TOTAL
                  </TableCell>
                  {visibleColumns.map((c) => (
                    <TableCell
                      key={`tot-${c.key}`}
                      style={{ ...headerStyle, backgroundColor: COPPER }}
                      sx={{ ...headerCellSx, fontSize: '0.74rem', fontWeight: 800 }}
                    >
                      {Number(data.total?.[c.key] || 0).toLocaleString('en-IN')}
                    </TableCell>
                  ))}
                </TableRow>
                {/* Column headers — vertical text */}
                <TableRow>
                  <TableCell
                    style={{ ...headerStyle, backgroundColor: COPPER }}
                    sx={{ ...headerCellSx, fontSize: '0.68rem', py: 1.2 }}
                  >
                    DATE
                  </TableCell>
                  {visibleColumns.map((c) => (
                    <TableCell
                      key={`h-${c.key}`}
                      style={{ ...headerStyle, backgroundColor: COPPER }}
                      sx={headerVerticalSx}
                    >
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.rows || []).map((r, i) => {
                  const [, , day] = r.date.split('-');
                  const dd = `${day}-${r.date.slice(5, 7)}-${r.date.slice(0, 4)}`;
                  // Striped rows to keep the eye on the right date.
                  const bg = i % 2 === 0 ? '#fff' : CREAM;
                  return (
                    <TableRow key={r.date}>
                      <TableCell
                        style={{ ...bodyCellStyle, backgroundColor: CREAM, color: BROWN }}
                        sx={{
                          ...bodyCellSx,
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dd}
                      </TableCell>
                      {visibleColumns.map((c) => {
                        const overrideKey = `${r.date}::${c.key}`;
                        const overrideVal = overrides[overrideKey];
                        const v = overrideVal != null
                          ? Number(overrideVal)
                          : Number(r[c.key] || 0);
                        const state = cellState[overrideKey];
                        // Highlight cells: amber-cream for the "TOTAL ..."
                        // emphasis columns; brown flash for a successful
                        // save; red flash for a failed save. Editable
                        // cells use the cream `EDITABLE_BG` at rest so
                        // they look distinct from auto-fetched values.
                        let cellBg = c.highlight && v > 0 ? c.highlight : bg;
                        if (c.editable) cellBg = EDITABLE_BG;
                        if (state === 'ok') cellBg = '#d1fae5';
                        else if (state === 'err') cellBg = '#fee2e2';
                        else if (state === 'saving') cellBg = `${COPPER}22`;

                        if (c.editable) {
                          // Suppress the cream hover-tint while a save
                          // flash (saving/ok/err) is showing so the
                          // green/red feedback doesn't get overwritten
                          // the instant the cursor enters the cell.
                          const flashing = !!state;
                          return (
                            <TableCell
                              key={`${r.date}-${c.key}`}
                              style={{ ...bodyCellStyle, backgroundColor: cellBg }}
                              sx={{
                                ...bodyCellSx,
                                p: 0,
                                fontWeight: c.bold ? 800 : 600,
                                position: 'relative',
                                transition: 'background-color 0.15s',
                                ...(flashing ? {} : { '&:hover': { backgroundColor: EDITABLE_BG_HOVER } }),
                              }}
                            >
                              <EditableNumberCell
                                initialValue={v}
                                onCommit={(newVal) => saveCell({
                                  date: r.date, field: c.key, value: newVal,
                                })}
                              />
                              <EditIcon sx={{
                                position: 'absolute',
                                top: 1, right: 2,
                                fontSize: 10,
                                color: COPPER,
                                opacity: 0.55,
                                pointerEvents: 'none',
                              }} />
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell
                            key={`${r.date}-${c.key}`}
                            style={{ ...bodyCellStyle, backgroundColor: cellBg, color: v === 0 ? '#9ca3af' : '#111' }}
                            sx={{
                              ...bodyCellSx,
                              fontWeight: c.bold ? 800 : 600,
                            }}
                          >
                            {v.toLocaleString('en-IN')}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default MonthlyAbstract;
