import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, IconButton, Tooltip, Chip, TextField, MenuItem, Typography, CircularProgress,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AddIcon from '@mui/icons-material/Add';
import {
  SOURCE_OPTIONS, CALL_LABEL_OPTIONS, RESPONSE_LABEL_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS, FOLLOWUP_CALL_LABEL_OPTIONS, STATUS_SHEET_OPTIONS,
  HAIR_OR_SKIN_OPTIONS, FOLLOWUP_NUMBER_OPTIONS, STATUS_CHIP_STYLES,
} from '../../constants/telecallerSheet';

/*
 * TelecallerSheet — the /client-portal/leads Excel-style grid.
 *
 * 26 columns exactly matching the TELECALLING sheet of the GROHAIR
 * LEAD SHEET-TNJ-2025 spec. Native `<TextField select>` + `<input>`
 * cells give a spreadsheet feel with Tab/Enter cell navigation.
 *
 * Save model: **auto-save on cell blur**. When a cell loses focus and
 * its value has changed, we PATCH just that field to the API. Follow-
 * up sub-editing goes through a "log follow-up" bulk save (cols
 * 16-19 send as a single follow_ups[] push).
 *
 * Duplicate rows tint orange (`is_duplicate` OR contact matches another
 * row). Contact uniqueness is enforced server-side via the client-
 * scoped unique-partial index; the sheet just highlights.
 */

// ─── Colour tokens ────────────────────────────────────────────────
const HEADER_BG   = '#0F172A';
const HEADER_FG   = '#F8FAFC';
const ROW_ALT_BG  = '#FAFBFC';
const BORDER      = '#E2E8F0';
const DUPE_BG     = '#FFE8CC';     // spec: 🟧 orange for duplicate rows
const CELL_HOVER  = '#F1F5F9';
const CELL_FOCUS  = '#EEF2FF';
const OVERDUE_BG  = '#FEE2E2';     // red tint for overdue REMINDER DATE
const FRESH_BG    = '#DCFCE7';     // green tint for FRESH rows

// ─── Column definition — order + width + type MUST match the spec ─
const COLUMNS = [
  { key: 'row_actions',           label: '',                              width:  56, kind: 'actions',   readOnly: true },
  { key: 'date',                  label: 'DATE',                          width: 110, kind: 'date' },
  { key: 'source_sheet',          label: 'SOURCE',                        width: 150, kind: 'select', options: SOURCE_OPTIONS },
  { key: 'name',                  label: 'NAME',                          width: 180, kind: 'text', required: true },
  { key: 'contact',               label: 'CONTACT',                       width: 130, kind: 'phone' },
  // wrap: true tells the readOnly renderer to allow multi-line
  // wrapping for long addresses like "no460 1st b cross main road" —
  // ellipsis truncation loses the numerical part the telecaller needs.
  { key: 'lead_location',         label: 'LOCATION',                      width: 170, kind: 'text', wrap: true },
  { key: 'hair_or_skin',          label: 'HAIR/SKIN',                     width:  90, kind: 'select', options: HAIR_OR_SKIN_OPTIONS },
  { key: 'telecaller_name',       label: 'TELECALLER',                    width: 130, kind: 'text' },
  { key: 'first_call_date',       label: 'FIRST CALL DATE',               width: 130, kind: 'date',   readOnly: true },
  { key: 'first_call_label',      label: 'CALL LABEL',                    width: 140, kind: 'select', options: CALL_LABEL_OPTIONS },
  { key: 'response_label',        label: 'RESPONSE',                      width: 160, kind: 'select', options: RESPONSE_LABEL_OPTIONS },
  { key: 'remarks',               label: 'REMARKS',                       width: 200, kind: 'text' },
  { key: 'reminder_date',         label: 'REMINDER DATE',                 width: 130, kind: 'date' },
  { key: 'appointment_status',    label: 'APPT STATUS',                   width: 180, kind: 'select', options: APPOINTMENT_STATUS_OPTIONS },
  { key: 'appointment_date',      label: 'APPT DATE',                     width: 130, kind: 'date' },
  { key: 'appointment_booked_date', label: 'APPT BOOKED DATE',            width: 130, kind: 'date',   readOnly: true },
  { key: 'follow_up_number',      label: 'FU #',                          width:  80, kind: 'fu_number' },
  { key: 'follow_up_call_label',  label: 'FU CALL LABEL',                 width: 140, kind: 'select', options: FOLLOWUP_CALL_LABEL_OPTIONS },
  { key: 'follow_up_date',        label: 'FU DATE',                       width: 130, kind: 'date' },
  { key: 'follow_up_remarks',     label: 'FU REMARKS',                    width: 200, kind: 'text' },
  { key: 'history_not_connected', label: 'HISTORY NOT CONNECTED',         width: 220, kind: 'textarea', readOnly: true },
  { key: 'history_connected',     label: 'HISTORY CONNECTED',             width: 220, kind: 'textarea', readOnly: true },
  { key: 'status_sheet',          label: 'STATUS',                        width: 130, kind: 'status',   options: STATUS_SHEET_OPTIONS },
  { key: 'consulted_date',        label: 'CONSULTED DATE',                width: 130, kind: 'date' },
  { key: 'treatment_booked_date', label: 'TREATMENT BOOKED DATE',         width: 150, kind: 'date' },
  { key: 'treatment_value',       label: 'TREATMENT VALUE',               width: 130, kind: 'number' },
  { key: 'month',                 label: 'MONTH',                         width: 100, kind: 'text',     readOnly: true },
];

const TOTAL_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);

// ─── Small utilities ──────────────────────────────────────────────
const toDateInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  // yyyy-MM-dd for <input type="date">
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

// Normalise contact for both display and server (server re-normalises
// anyway — this keeps the UI feedback tight so the user sees what
// they'll actually persist).
const normaliseContact = (raw) => {
  if (raw == null) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  const trimmed = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return trimmed.length >= 10 ? trimmed.slice(-10) : trimmed;
};

// Meta `platform` enum → sheet SOURCE dropdown value. Used as the
// display fallback for Meta-sync leads whose `source_sheet` field
// wasn't touched by the migration yet.
const PLATFORM_TO_SOURCE = {
  whatsapp:  'WHATS APP',
  instagram: 'INSTAGRAM',
  facebook:  'FACEBOOK',
  messenger: 'FACEBOOK',
};

// Fish a location-ish answer out of Meta's raw_field_data payload
// (array of {name, values} OR flat {key: value} map). Preference
// order matches how humans read an address:
//   1. explicit city / town / place / location
//   2. street_address / address / area / locality  ← "Mahalakshmi layout"
//   3. first values-carrying key that looks address-ish
// Used only as the display fallback when the CRM's own
// `lead_location` field is empty.
const readLocationFromRaw = (rfd) => {
  if (!rfd) return '';
  const CITY_RE   = /(^|_)(city|town|place|location)(\?|$|_)/i;
  const STREET_RE = /(^|_)(street_address|address|street|area|locality|landmark)(\?|$|_)/i;
  const asString = (v) => (Array.isArray(v) ? v.join(', ') : String(v || ''));

  const scan = (entries) => {
    let cityHit = '', streetHit = '';
    for (const { key, value } of entries) {
      if (!cityHit   && CITY_RE.test(key))   cityHit   = asString(value);
      if (!streetHit && STREET_RE.test(key)) streetHit = asString(value);
    }
    return cityHit || streetHit;
  };

  if (Array.isArray(rfd)) {
    return scan(rfd
      .filter((e) => e?.name)
      .map((e) => ({ key: e.name, value: Array.isArray(e.values) ? e.values : e.value })));
  }
  if (typeof rfd === 'object') {
    return scan(Object.entries(rfd).map(([k, v]) => ({ key: k, value: v })));
  }
  return '';
};

// A lead is "synced" when it came from Meta's webhook / sync pipeline
// (it has a Meta-issued leadgen id). For those rows, NAME / SOURCE /
// CONTACT / LOCATION / DATE all originate from Meta's form
// submission — the telecaller shouldn't edit them (fixing a typo
// would silently diverge from Meta's audit record and confuse
// deduplication). Manually-added rows have no leadgen id and stay
// fully editable so the telecaller can key in walk-in / referral
// leads from scratch.
const isSyncedLead = (lead) => !!(lead && lead.meta_leadgen_id);

// Sheet columns whose values arrive from Meta on synced leads —
// locked read-only for those rows, editable for everyone else.
const SYNCED_LOCKED_COLS = new Set([
  'date', 'source_sheet', 'name', 'contact', 'lead_location',
]);

// Read the current display value from a lead for a given column.
// Fallbacks matter: Meta-sync leads store their SOURCE in `platform`,
// their CONTACT in `phone`, their DATE in `meta_created_time`, and
// their LOCATION inside `raw_field_data`. Reading through those
// aliases means the sheet works on day one for freshly-synced leads —
// without waiting for the migration script to run.
const readCell = (lead, col) => {
  switch (col.key) {
    case 'follow_up_number': {
      const n = (lead.follow_ups?.length || 0) + 1;
      return `FOLLOW-UP ${Math.min(n, 20)}`;
    }
    case 'follow_up_call_label':
      return lead._pendingFu?.call_label || '';
    case 'follow_up_date':
      return lead._pendingFu?.date || toDateInput(new Date());
    case 'follow_up_remarks':
      return lead._pendingFu?.remarks || '';
    case 'month': {
      const anchor = lead.date || lead.meta_created_time || lead.createdAt;
      return anchor ? new Date(anchor).toLocaleString('en-GB', { month: 'long' }) : '';
    }
    case 'date':
      // Sheet's own DATE field first; otherwise Meta's authoritative
      // form-submission time; otherwise ingestion timestamp.
      return lead.date || lead.meta_created_time || lead.createdAt || '';
    case 'source_sheet':
      // Explicit sheet value wins; otherwise infer from Meta platform.
      return lead.source_sheet || PLATFORM_TO_SOURCE[String(lead.platform || '').toLowerCase()] || '';
    case 'contact':
      // Prefer the normalised `contact`; otherwise normalise `phone`
      // on the fly so the value displays consistently as 10 digits.
      return lead.contact || normaliseContact(lead.phone);
    case 'lead_location':
      // Prefer telecaller-typed location; otherwise Meta form's city.
      return lead.lead_location || readLocationFromRaw(lead.raw_field_data);
    default:
      return lead[col.key] ?? '';
  }
};

// Detect duplicate rows so we can tint them orange. A row is duped
// when (a) `is_duplicate` was set explicitly OR (b) another row in the
// same page shares the same normalised contact.
const buildDuplicateSet = (leads) => {
  const bucket = new Map();
  leads.forEach((l) => {
    const c = normaliseContact(l.contact || l.phone);
    if (!c) return;
    bucket.set(c, (bucket.get(c) || 0) + 1);
  });
  const dupes = new Set();
  leads.forEach((l) => {
    const c = normaliseContact(l.contact || l.phone);
    if (l.is_duplicate || (c && bucket.get(c) > 1)) dupes.add(l._id);
  });
  return dupes;
};

// ─── Component ────────────────────────────────────────────────────
const TelecallerSheet = ({
  leads = [],
  loading = false,
  telecallerName = '',       // default value for col 7 on new rows (logged-in user)
  onSaveLead,                // (leadId, patch) => Promise<updatedLead>
  onAddLead,                 // (payload) => Promise<newLead>
  onDeleteLead,              // (leadId) => Promise<void>
  onError,                   // (msg) => void — page shows toast
  maxHeight = 'calc(100vh - 320px)',
}) => {
  const [savingCellKey, setSavingCellKey] = useState(null);
  const [rows, setRows] = useState(leads);
  const cellRefs = useRef({});   // `${rowIdx}:${colIdx}` → HTMLElement

  // Sync local rows when parent leads array changes. Keep any pending
  // follow-up scratch state (`_pendingFu`) attached to the same row
  // so the user's in-progress FU input doesn't get wiped by a refetch.
  useEffect(() => {
    setRows((prev) => leads.map((l) => {
      const existing = prev.find((r) => r._id === l._id);
      return existing?._pendingFu ? { ...l, _pendingFu: existing._pendingFu } : l;
    }));
  }, [leads]);

  const dupeIds = useMemo(() => buildDuplicateSet(rows), [rows]);

  // ─── Save a single field ───────────────────────────────────────
  const commitFieldEdit = useCallback(async (lead, col, value) => {
    const key = `${lead._id}:${col.key}`;
    setSavingCellKey(key);
    try {
      // Follow-up cells are special — they buffer into `_pendingFu`
      // until the CALL LABEL is chosen, then flush as a new follow_ups
      // entry alongside the running history append (server-side).
      if (col.key === 'follow_up_call_label') {
        const pending = { ...(lead._pendingFu || {}) };
        pending.call_label = value;
        pending.date = pending.date || toDateInput(new Date());
        pending.remarks = pending.remarks || '';
        pending.connected = String(value).toUpperCase() === 'CONNECTED';
        pending.number = (lead.follow_ups?.length || 0) + 1;
        if (!pending.call_label) return;
        const nextFollowUps = [
          ...(lead.follow_ups || []),
          {
            number: pending.number,
            date: pending.date,
            call_label: pending.call_label,
            remarks: pending.remarks,
            connected: pending.connected,
          },
        ];
        const updated = await onSaveLead(lead._id, { follow_ups: nextFollowUps });
        setRows((prev) => prev.map((r) =>
          r._id === lead._id ? { ...updated, _pendingFu: undefined } : r
        ));
        return;
      }
      if (col.key === 'follow_up_date' || col.key === 'follow_up_remarks') {
        // Just update the buffer — no server call until call label lands.
        setRows((prev) => prev.map((r) => r._id === lead._id
          ? { ...r, _pendingFu: { ...(r._pendingFu || {}), [col.key.replace('follow_up_', '')]: value } }
          : r));
        return;
      }
      if (col.key === 'follow_up_number') return; // virtual, read-only

      // Regular field save.
      let payload = { [col.key]: value };
      if (col.kind === 'phone') payload = { contact: normaliseContact(value) };
      if (col.kind === 'number') payload = { [col.key]: value === '' ? 0 : Number(value) };
      const updated = await onSaveLead(lead._id, payload);
      setRows((prev) => prev.map((r) =>
        r._id === lead._id ? { ...updated, _pendingFu: r._pendingFu } : r
      ));
    } catch (err) {
      onError?.(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setSavingCellKey(null);
    }
  }, [onSaveLead, onError]);

  // ─── Add a fresh blank row at the top ──────────────────────────
  const handleAddRow = useCallback(async () => {
    try {
      // `sheet_blank: true` tells the server to skip the strict name
      // and phone validation used by the legacy Add-WhatsApp-Lead
      // dialog. Walk-in / referral leads are captured live and the
      // telecaller fills the name + phone inline as the customer
      // gives them — a hard requirement blocks the flow.
      const created = await onAddLead({
        sheet_blank: true,
        name: '',
        phone: '',
        date: new Date(),
        telecaller_name: telecallerName || '',
        manual_source_type: 'walk_in',
      });
      if (created) setRows((prev) => [created, ...prev]);
    } catch (err) {
      onError?.(err?.response?.data?.message || err?.message || 'Add failed');
    }
  }, [onAddLead, onError, telecallerName]);

  const handleDeleteRow = useCallback(async (lead) => {
    if (!window.confirm(`Delete lead "${lead.name || lead.contact}" ?`)) return;
    try {
      await onDeleteLead(lead._id);
      setRows((prev) => prev.filter((r) => r._id !== lead._id));
    } catch (err) {
      onError?.(err?.response?.data?.message || err?.message || 'Delete failed');
    }
  }, [onDeleteLead, onError]);

  // ─── Keyboard nav: Tab / Shift+Tab / Enter / Arrow keys move ─
  // between cells. Uses data-cell-row / data-cell-col attributes on
  // wrapper divs so the sheet works regardless of which input type
  // (native input / select / textarea) is inside the cell.
  const focusCell = useCallback((rowIdx, colIdx) => {
    const target = cellRefs.current[`${rowIdx}:${colIdx}`];
    if (!target) return;
    // Find the first focusable element inside the wrapper (input/
    // select/textarea/button). Falls back to the wrapper itself.
    const input = target.querySelector('input, select, textarea, [role="button"]');
    (input || target).focus();
    if (input?.select) input.select();
  }, []);

  const handleCellKeyDown = useCallback((e, rowIdx, colIdx) => {
    const key = e.key;
    let handled = false;
    if (key === 'Tab') {
      // Let Shift+Tab flow naturally too — but explicit control lets
      // us wrap around at row edges.
      const next = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (next >= 0 && next < COLUMNS.length) {
        focusCell(rowIdx, next); handled = true;
      }
    } else if (key === 'Enter') {
      // Enter in a text/select cell → move down; Shift+Enter → up.
      const next = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
      if (next >= 0 && next < rows.length) { focusCell(next, colIdx); handled = true; }
    } else if (key === 'ArrowDown' && !e.altKey) {
      // Alt+ArrowDown is native "open select" — leave it alone.
      const tag = e.target.tagName;
      if (tag !== 'SELECT' && tag !== 'TEXTAREA') {
        if (rowIdx + 1 < rows.length) { focusCell(rowIdx + 1, colIdx); handled = true; }
      }
    } else if (key === 'ArrowUp' && !e.altKey) {
      const tag = e.target.tagName;
      if (tag !== 'SELECT' && tag !== 'TEXTAREA') {
        if (rowIdx - 1 >= 0) { focusCell(rowIdx - 1, colIdx); handled = true; }
      }
    }
    if (handled) e.preventDefault();
  }, [focusCell, rows.length]);

  // ─── Render a single cell ──────────────────────────────────────
  const renderCell = (lead, col, rowIdx, colIdx) => {
    const value = readCell(lead, col);
    const displayValue = value === null || value === undefined ? '' : String(value);
    const isSaving = savingCellKey === `${lead._id}:${col.key}`;
    // Effective readOnly = column-level readOnly OR (synced lead AND
    // this is one of the 5 Meta-owned columns). Meta-sync leads must
    // preserve NAME/SOURCE/CONTACT/LOCATION/DATE from the submission
    // record — editing them would silently diverge from Meta's audit
    // trail and break deduplication.
    const effReadOnly = col.readOnly || (isSyncedLead(lead) && SYNCED_LOCKED_COLS.has(col.key));
    const commonWrap = {
      ref: (el) => { if (el) cellRefs.current[`${rowIdx}:${colIdx}`] = el; },
      'data-cell-row': rowIdx,
      'data-cell-col': colIdx,
      onKeyDown: (e) => handleCellKeyDown(e, rowIdx, colIdx),
      sx: {
        px: 0.6, py: 0.4, minHeight: 32, fontSize: '0.78rem', width: '100%',
        display: 'flex', alignItems: 'center',
        outline: 'none',
        '&:focus-within': { bgcolor: CELL_FOCUS },
        opacity: isSaving ? 0.55 : 1,
        cursor: effReadOnly ? 'default' : 'text',
      },
      tabIndex: effReadOnly && col.kind !== 'actions' ? -1 : 0,
    };

    // Actions column: WhatsApp deep-link + delete
    if (col.kind === 'actions') {
      const wa = normaliseContact(lead.contact || lead.phone);
      return (
        <Box {...commonWrap}>
          {wa && (
            <Tooltip title={`WhatsApp ${wa}`}>
              <IconButton
                size="small"
                component="a"
                href={`https://wa.me/91${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ p: 0.25, color: '#25D366' }}
              >
                <WhatsAppIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete row">
            <IconButton
              size="small"
              onClick={() => handleDeleteRow(lead)}
              sx={{ p: 0.25, color: '#EF4444' }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      );
    }

    if (effReadOnly) {
      // Column-level readOnly (textarea / month / follow_up_number)
      // OR a Meta-locked column on a synced lead — display only. On
      // synced leads the cell also gets a soft slate background so it
      // reads visually distinct from editable fields and telecallers
      // don't waste a click trying to type into it.
      const display = col.kind === 'date' ? fmtDate(displayValue) : displayValue;
      const syncedLock = isSyncedLead(lead) && SYNCED_LOCKED_COLS.has(col.key);
      // Wrap behaviour — three modes:
      //   textarea (history columns)   → pre-line, no truncation
      //   col.wrap (location)          → normal wrap, word-break, no ellipsis
      //   everything else              → single line, ellipsis on overflow
      const wraps = col.kind === 'textarea' || col.wrap;
      return (
        <Box {...commonWrap}
          title={syncedLock ? 'Locked · came from Meta form submission' : (wraps ? displayValue : undefined)}
          sx={{
            ...commonWrap.sx,
            color: '#475569',
            whiteSpace: col.kind === 'textarea' ? 'pre-line' : (col.wrap ? 'normal' : 'nowrap'),
            overflow: 'hidden',
            textOverflow: wraps ? 'clip' : 'ellipsis',
            wordBreak: col.wrap ? 'break-word' : undefined,
            fontSize: col.kind === 'textarea' ? '0.7rem' : '0.78rem',
            lineHeight: col.kind === 'textarea' ? 1.25 : 1.35,
            // Let a wrapping cell grow the row height instead of
            // getting cropped — align its contents to the top so
            // multi-line rows read like a proper address block.
            alignItems: wraps ? 'flex-start' : 'center',
            py: wraps ? 0.5 : 0.4,
            ...(syncedLock && { bgcolor: '#F8FAFC', fontWeight: 500 }),
          }}
        >
          {display}
        </Box>
      );
    }

    // STATUS chip cell — coloured pill selector
    if (col.kind === 'status') {
      const style = STATUS_CHIP_STYLES[displayValue] || STATUS_CHIP_STYLES[''];
      return (
        <Box {...commonWrap}>
          <TextField
            select
            variant="standard"
            value={displayValue}
            onChange={(e) => commitFieldEdit(lead, col, e.target.value)}
            SelectProps={{ native: true }}
            InputProps={{ disableUnderline: true }}
            sx={{
              width: '100%',
              '& select': {
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                px: 0.6, py: 0.3, borderRadius: '10px',
                bgcolor: style.bg, color: style.color, border: `1px solid ${style.border}`,
                appearance: 'none',
              },
            }}
          >
            {col.options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
          </TextField>
        </Box>
      );
    }

    // SELECT cells — native <select> for spreadsheet feel + kbd support.
    if (col.kind === 'select') {
      return (
        <Box {...commonWrap}>
          <TextField
            select
            variant="standard"
            value={displayValue}
            onChange={(e) => commitFieldEdit(lead, col, e.target.value)}
            SelectProps={{ native: true }}
            InputProps={{ disableUnderline: true }}
            sx={{ width: '100%', '& select': { fontSize: '0.78rem', px: 0.5, py: 0.4 } }}
          >
            {col.options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
          </TextField>
        </Box>
      );
    }

    // DATE cell — native <input type="date">
    if (col.kind === 'date') {
      return (
        <Box {...commonWrap}>
          <input
            type="date"
            value={toDateInput(displayValue)}
            onChange={(e) => commitFieldEdit(lead, col, e.target.value || null)}
            style={{
              border: 'none', background: 'transparent', width: '100%',
              fontSize: '0.78rem', padding: '4px 2px', color: '#0F172A', outline: 'none',
            }}
          />
        </Box>
      );
    }

    // TEXT / PHONE / NUMBER — controlled native input, commit on blur.
    return (
      <Box {...commonWrap}>
        <BlurCommitInput
          value={displayValue}
          type={col.kind === 'number' ? 'number' : (col.kind === 'phone' ? 'tel' : 'text')}
          onCommit={(v) => commitFieldEdit(lead, col, v)}
          required={col.required}
        />
      </Box>
    );
  };

  return (
    <Box sx={{
      border: `1px solid ${BORDER}`, borderRadius: 1.5, overflow: 'hidden',
      bgcolor: '#fff',
    }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
        borderBottom: `1px solid ${BORDER}`, bgcolor: '#F8FAFC',
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A', flex: 1 }}>
          {rows.length} lead{rows.length === 1 ? '' : 's'}
        </Typography>
        <Tooltip title="Add a new row at the top of the sheet">
          <IconButton
            size="small"
            onClick={handleAddRow}
            sx={{
              bgcolor: '#1F3966', color: '#fff', borderRadius: 1,
              '&:hover': { bgcolor: '#15294D' },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Scroll container — vertical + horizontal. */}
      <Box sx={{
        overflow: 'auto', maxHeight,
        // Sticky header via position:sticky on the header row cells.
        '& .thead-cell': {
          position: 'sticky', top: 0, zIndex: 3,
          bgcolor: HEADER_BG, color: HEADER_FG,
          fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.5px',
          textTransform: 'uppercase', px: 0.8, py: 1,
          borderRight: `1px solid rgba(255,255,255,0.08)`,
          whiteSpace: 'nowrap',
        },
      }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: COLUMNS.map((c) => `${c.width}px`).join(' '), minWidth: TOTAL_WIDTH }}>
          {/* Header row */}
          {COLUMNS.map((c) => (
            <Box key={c.key} className="thead-cell">{c.label}</Box>
          ))}

          {/* Body */}
          {loading && rows.length === 0 && (
            <Box sx={{ gridColumn: `1 / span ${COLUMNS.length}`, py: 6, textAlign: 'center' }}>
              <CircularProgress size={22} />
            </Box>
          )}
          {!loading && rows.length === 0 && (
            <Box sx={{ gridColumn: `1 / span ${COLUMNS.length}`, py: 6, textAlign: 'center', color: '#94A3B8' }}>
              No leads yet. Click <strong>+</strong> above to add the first row.
            </Box>
          )}
          {rows.map((lead, rowIdx) => {
            const isDupe = dupeIds.has(lead._id);
            const isOverdue = lead.next_followup_date
              && new Date(lead.next_followup_date) < new Date()
              && !['CLOSED', 'DARMANT'].includes(lead.status_sheet);
            const isFresh = !lead.first_call_date;
            const rowBg = isDupe ? DUPE_BG
              : isOverdue ? OVERDUE_BG
              : isFresh ? FRESH_BG
              : (rowIdx % 2 === 0 ? '#fff' : ROW_ALT_BG);
            return (
              <React.Fragment key={lead._id}>
                {COLUMNS.map((col, colIdx) => (
                  <Box
                    key={col.key}
                    sx={{
                      bgcolor: rowBg,
                      borderBottom: `1px solid ${BORDER}`,
                      borderRight: `1px solid ${BORDER}`,
                      minHeight: 34, display: 'flex', alignItems: 'stretch',
                      '&:hover': { bgcolor: isDupe ? DUPE_BG : CELL_HOVER },
                    }}
                  >
                    {renderCell(lead, col, rowIdx, colIdx)}
                  </Box>
                ))}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>

      {/* Legend footer */}
      <Box sx={{
        px: 1.5, py: 0.8, borderTop: `1px solid ${BORDER}`, bgcolor: '#F8FAFC',
        display: 'flex', gap: 1.5, alignItems: 'center', fontSize: '0.68rem', color: '#64748B',
      }}>
        <LegendSwatch bg={DUPE_BG}    label="Duplicate contact" />
        <LegendSwatch bg={OVERDUE_BG} label="Reminder overdue" />
        <LegendSwatch bg={FRESH_BG}   label="Fresh · not called yet" />
        <Box sx={{ flex: 1 }} />
        <span>Tab / Shift-Tab · move column · Enter / Shift-Enter · move row</span>
      </Box>
    </Box>
  );
};

// ─── Text/number/phone commit-on-blur wrapper ────────────────────
// Keeps a local buffer so every keystroke doesn't PATCH the server.
// Fires onCommit(value) on blur AND on Enter (but only if the value
// actually changed).
const BlurCommitInput = ({ value, type = 'text', onCommit, required }) => {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => { setLocal(value ?? ''); }, [value]);
  const initial = useRef(value ?? '');
  useEffect(() => { initial.current = value ?? ''; }, [value]);

  const flush = () => {
    const v = local;
    if (String(v) === String(initial.current)) return;
    if (required && !String(v).trim()) return;   // don't save empty required fields
    onCommit(v);
  };

  return (
    <input
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={flush}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { flush(); }
        if (e.key === 'Escape') { setLocal(initial.current); e.currentTarget.blur(); }
      }}
      style={{
        border: 'none', background: 'transparent', width: '100%',
        fontSize: '0.78rem', padding: '4px 2px', color: '#0F172A', outline: 'none',
      }}
    />
  );
};

const LegendSwatch = ({ bg, label }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
    <Box sx={{ width: 10, height: 10, bgcolor: bg, border: `1px solid ${BORDER}`, borderRadius: 0.3 }} />
    <span>{label}</span>
  </Box>
);

export default TelecallerSheet;
