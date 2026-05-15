import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Paper, FormControl, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell,
  CircularProgress, Alert, Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

// Monthly Abstract — the per-day grid view of the telecalling sheet.
// Mirrors the agency's Google Sheet layout: TOTAL row on top, one
// row per date in the selected month, columns grouped into Source /
// Lead Status / Calls / Appointments + Conversion bands.
//
// Props:
//   clientId:    Mongo _id
//   apiInstance: axios instance with portal/admin auth
const HEAD_BG = '#8B1F2F';      // maroon section banner
const SUB_BG = '#A03445';       // slightly lighter for column headers
const SOFT_BG = '#FFF4ED';      // cream row stripes
const TOTAL_BG = '#A03445';     // TOTAL row
const PURPLE_HL = '#E8D5E8';    // pink-purple highlights from the screenshot

const fmtMonthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const monthOptions = () => {
  // 12 months back from today + current month — matches the dropdown
  // feel of the spreadsheet ("Select the Month").
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 13; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    opts.push({ value: ym, label: fmtMonthLabel(ym) });
  }
  return opts;
};

// One column descriptor — used by both the header row and every body
// row. Keeping them in one list makes column reordering / hiding a
// single-line change.
const COLUMNS = [
  { key: 'whatsapp', label: 'WHATS APP', group: 'source' },
  { key: 'instagram', label: 'INSTAGRAM', group: 'source' },
  { key: 'facebook', label: 'FACEBOOK', group: 'source' },
  { key: 'google_lead', label: 'GOOGLE LEAD', group: 'source' },
  { key: 'justdial', label: 'JUSTDIAL', group: 'source' },
  { key: 'walk_in', label: 'WALK-IN', group: 'source' },
  { key: 'referral', label: 'REFERRAL', group: 'source' },
  { key: 'physical_marketing', label: 'PHYSICAL MARKETING', group: 'source' },
  { key: 'incall_google', label: 'INCALL GOOGLE', group: 'source' },
  { key: 'incall_fb', label: 'INCALL FB', group: 'source' },
  { key: 'incall_insta', label: 'INCALL INSTA', group: 'source' },
  { key: 'incall_self', label: 'INCALL SELF', group: 'source' },
  { key: 'total_leads', label: 'TOTAL LEADS', group: 'lead', bold: true },
  { key: 'connected', label: 'CONNECTED', group: 'lead' },
  { key: 'not_connected', label: 'NOT CONNECTED', group: 'lead' },
  { key: 'invalid_duplicate', label: 'INVALID/ DUPLICATE', group: 'lead' },
  { key: 'fresh_calls', label: 'FRESH CALLS', group: 'calls' },
  { key: 'callback_1', label: 'CALL BACK-1', group: 'calls' },
  { key: 'callback_2', label: 'CALL BACK-2', group: 'calls' },
  { key: 'callback_3', label: 'CALL BACK-3', group: 'calls' },
  { key: 'callback', label: 'CALL BACK', group: 'calls' },
  { key: 'total_calls', label: 'TOTAL CALLS', group: 'calls', bold: true, highlight: PURPLE_HL },
  { key: 'fresh_calls_connected', label: 'FRESH CALLS - CONNECTED', group: 'connected' },
  { key: 'callback_connected', label: 'CALL BACK - CONNECTED', group: 'connected' },
  { key: 'total_connected_calls', label: 'TOTAL CONNECTED CALLS', group: 'connected', bold: true, highlight: PURPLE_HL },
  { key: 'total_appointments', label: 'TOTAL APPOINTMENTS', group: 'appt' },
  { key: 'consulted', label: 'CONSULTED', group: 'appt' },
  { key: 'convert', label: 'CONVERT', group: 'appt' },
  { key: 'convert_value', label: 'CONVERT VALUE', group: 'appt' },
];

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

  // As with TelecallingReport, we put background + colour + borders on
  // the `style` prop (inline CSS, highest specificity) and leave the
  // typography / spacing on `sx`. This is the only reliable way I've
  // found to get the maroon banners to render under our MUI v5 theme.
  const headerStyle = {
    backgroundColor: HEAD_BG,
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
  const headerVerticalSx = {
    ...headerCellSx,
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    minWidth: 38,
    height: 110,
    py: 0.6,
  };

  const bodyCellStyle = {
    backgroundColor: '#fff',
    border: '1px solid #f0d4c4',
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
      <Paper variant="outlined" sx={{ p: 1.4, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', borderLeft: `3px solid ${HEAD_BG}` }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: HEAD_BG, display: 'flex', alignItems: 'center', gap: 1 }}>
            Monthly Abstract
            {bgRefreshing && <CircularProgress size={12} sx={{ color: HEAD_BG, opacity: 0.6 }} />}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            One row per day. Auto-refreshes every 30s as telecallers update the Leads table.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            {opts.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small" variant="outlined"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={fetchAbstract} disabled={loading}
        >
          Refresh
        </Button>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !data && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
          <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>Loading abstract…</Typography>
        </Box>
      )}

      {data && (
        <Paper variant="outlined" sx={{ overflow: 'auto', borderRadius: 1 }}>
          <Box sx={{ minWidth: 1700 }}>
            <Table size="small" sx={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <TableHead>
                {/* Banner row showing the month name + dropdown context */}
                <TableRow>
                  <TableCell
                    style={headerStyle}
                    sx={{ ...headerCellSx, py: 0.6, fontSize: '0.65rem', textAlign: 'left', pl: 1.2, width: 90, minWidth: 90 }}
                  >
                    SELECT THE MONTH
                  </TableCell>
                  <TableCell
                    colSpan={COLUMNS.length}
                    style={headerStyle}
                    sx={{ ...headerCellSx, py: 0.6, fontSize: '0.72rem', textAlign: 'left', pl: 1.2 }}
                  >
                    {fmtMonthLabel(data.month)}
                  </TableCell>
                </TableRow>
                {/* TOTAL row immediately under the banner — matches sheet */}
                <TableRow>
                  <TableCell
                    style={{ ...headerStyle, backgroundColor: TOTAL_BG }}
                    sx={{ ...headerCellSx, fontSize: '0.7rem' }}
                  >
                    TOTAL
                  </TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell
                      key={`tot-${c.key}`}
                      style={{ ...headerStyle, backgroundColor: TOTAL_BG }}
                      sx={{ ...headerCellSx, fontSize: '0.72rem', fontWeight: 800 }}
                    >
                      {Number(data.total?.[c.key] || 0).toLocaleString('en-IN')}
                    </TableCell>
                  ))}
                </TableRow>
                {/* Column headers — vertical text */}
                <TableRow>
                  <TableCell
                    style={{ ...headerStyle, backgroundColor: SUB_BG }}
                    sx={{ ...headerCellSx, fontSize: '0.68rem', py: 1.2 }}
                  >
                    DATE
                  </TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell
                      key={`h-${c.key}`}
                      style={{ ...headerStyle, backgroundColor: SUB_BG }}
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
                  // Friday-style banding to break visual monotony.
                  const bg = i % 2 === 0 ? '#fff' : SOFT_BG;
                  return (
                    <TableRow key={r.date}>
                      <TableCell
                        style={{ ...bodyCellStyle, backgroundColor: SOFT_BG, color: HEAD_BG }}
                        sx={{
                          ...bodyCellSx,
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dd}
                      </TableCell>
                      {COLUMNS.map((c) => {
                        const v = Number(r[c.key] || 0);
                        const cellBg = c.highlight && v > 0 ? c.highlight : bg;
                        return (
                          <TableCell
                            key={`${r.date}-${c.key}`}
                            style={{ ...bodyCellStyle, backgroundColor: cellBg, color: v === 0 ? '#9ca3af' : '#111' }}
                            sx={{
                              ...bodyCellSx,
                              fontWeight: c.bold ? 800 : 600,
                            }}
                          >
                            {c.key === 'convert_value'
                              ? (v > 0 ? v.toLocaleString('en-IN') : 0)
                              : v.toLocaleString('en-IN')}
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
