import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, IconButton, Tooltip, Button, Chip, MenuItem, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const META_BLUE = '#1877F2';
const INSTAGRAM_PINK = '#E4405F';
const DUPLICATE_BG = '#F3E8FF';      // soft purple — matches the spreadsheet's duplicate row
const TREATMENT_BG = '#E6F7E6';      // soft green — TREATMENT BOOKED rows
const CONSULTED_BG = '#E0F2FE';      // soft sky — CONSULTED rows

// Dropdown options — matching the labels in the source spreadsheet so the
// telecaller team can map values directly without re-learning vocabulary.
const CALL_LABEL_OPTIONS = [
  '', 'CONNECTED', 'NOT CONNECTED', 'DISCONNECTED', 'RNR', 'BUSY', 'INVALID',
];
const RESPONSE_LABEL_OPTIONS = [
  '', 'TREATMENT BOOKED', 'CONSULTED', 'WARM', 'HOT', 'COLD',
  'NOT INTERESTED', 'NOT REQUIRED', 'NOT ENQUIRED', 'CTC', 'WILL CALL',
  'DUPLICATE', 'CLOSED',
];
const APPOINTMENT_STATUS_OPTIONS = [
  '', 'APPOINTMENT BOOKED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED',
];
const CATEGORY_OPTIONS = ['', 'HAIR', 'SKIN'];

const REDUNDANT_KEYS = new Set([
  'full_name', 'fullname', 'name', 'first_name', 'last_name',
  'email', 'email_address',
  'phone', 'phone_number', 'mobile', 'mobile_number',
]);

const prettify = (k) => String(k || '')
  .replace(/\?+$/, '')
  .replace(/_/g, ' ')
  .trim()
  .replace(/\b\w/g, (c) => c.toUpperCase());

const extractFormEntries = (rfd) => {
  if (Array.isArray(rfd)) {
    return rfd
      .filter((e) => e?.name && !REDUNDANT_KEYS.has(String(e.name).toLowerCase()))
      .map((e) => ({
        label: prettify(e.name),
        value: Array.isArray(e?.values) ? e.values.join(', ') : (e?.value ?? ''),
      }));
  }
  if (rfd && typeof rfd === 'object') {
    return Object.entries(rfd)
      .filter(([k]) => !REDUNDANT_KEYS.has(k.toLowerCase()))
      .map(([k, v]) => ({
        label: prettify(k),
        value: Array.isArray(v) ? v.join(', ') : String(v ?? ''),
      }));
  }
  return [];
};

// Pull the "city" answer out of the Meta form payload so it can default
// the Location column. Meta returns either an array of {name, values}
// objects or a plain {key: value} map depending on the form version, so
// we cover both shapes. Match a few common phrasings (city / town / location).
const CITY_KEY_RE = /^(city|town|city_?name|location|where|place)\??$/i;
const extractCityFromForm = (rfd) => {
  if (!rfd) return '';
  const valueOf = (v) => Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v ?? '');
  if (Array.isArray(rfd)) {
    const hit = rfd.find((e) => e?.name && CITY_KEY_RE.test(String(e.name).trim()));
    if (!hit) return '';
    return Array.isArray(hit.values) ? hit.values.filter(Boolean).join(', ') : valueOf(hit.value);
  }
  if (typeof rfd === 'object') {
    const k = Object.keys(rfd).find((key) => CITY_KEY_RE.test(key.trim()));
    return k ? valueOf(rfd[k]) : '';
  }
  return '';
};

const fmtReceived = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

// ISO YYYY-MM-DD for <input type="date"> binding (browser native picker
// expects this exact format and ignores anything else).
const toDateInput = (v) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
};

// Per-lead snapshot of the editable fields. Kept on local state so each row
// edits in isolation and only POSTs when the user clicks Save.
const buildEditState = (lead) => ({
  is_duplicate: !!lead.is_duplicate,
  // Default to the city answer captured in the Meta form so the team
  // doesn't re-type values they already have. Once the user edits and
  // saves, the persisted value wins.
  lead_location: lead.lead_location || extractCityFromForm(lead.raw_field_data) || '',
  lead_category: lead.lead_category || '',
  telecaller_name: lead.telecaller_name || '',
  first_call_date: toDateInput(lead.first_call_date),
  first_call_label: lead.first_call_label || '',
  response_label: lead.response_label || '',
  remarks: lead.remarks || '',
  next_followup_date: toDateInput(lead.next_followup_date),
  appointment_status: lead.appointment_status || '',
  appointment_date: toDateInput(lead.appointment_date),
  appointment_booked_date: toDateInput(lead.appointment_booked_date),
  follow_ups: Array.isArray(lead.follow_ups)
    ? lead.follow_ups.map((f) => ({
        _id: f._id,
        number: f.number,
        date: toDateInput(f.date),
        call_label: f.call_label || '',
        remarks: f.remarks || '',
        connected: !!f.connected,
      }))
    : [],
});

// Style chips for the call/response labels — colored variants make the
// status scannable at a glance, matching the spreadsheet's color coding.
const labelChipColor = (label) => {
  const v = String(label || '').toUpperCase();
  if (!v) return null;
  if (v === 'CONNECTED') return { bg: '#DCFCE7', fg: '#15803D' };
  if (v === 'NOT CONNECTED' || v === 'DISCONNECTED') return { bg: '#FEE2E2', fg: '#B91C1C' };
  if (v === 'RNR' || v === 'BUSY') return { bg: '#FEF3C7', fg: '#A16207' };
  if (v === 'INVALID') return { bg: '#E5E7EB', fg: '#374151' };
  if (v === 'TREATMENT BOOKED' || v === 'APPOINTMENT BOOKED') return { bg: '#DCFCE7', fg: '#15803D' };
  if (v === 'CONSULTED') return { bg: '#DBEAFE', fg: '#1D4ED8' };
  if (v === 'WARM' || v === 'HOT') return { bg: '#FFEDD5', fg: '#C2410C' };
  if (v === 'NOT INTERESTED' || v === 'CLOSED' || v === 'CANCELLED') return { bg: '#FEE2E2', fg: '#B91C1C' };
  if (v === 'DUPLICATE') return { bg: DUPLICATE_BG, fg: '#7E22CE' };
  return { bg: '#F3F4F6', fg: '#374151' };
};

const headerCellSx = {
  fontWeight: 700,
  bgcolor: `${META_BLUE}10`,
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  whiteSpace: 'nowrap',
  py: 0.8,
};

// Group-header row sits above the data-header row to mirror the
// spreadsheet's "LEAD DETAILS / INITIAL CALL DETAILS / FOLLOW-UP STATUS"
// banner bands.
const groupHeaderSx = {
  fontWeight: 800,
  fontSize: '0.7rem',
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: '#fff',
  py: 0.6,
  borderRight: '1px solid rgba(255,255,255,0.3)',
};

const cellInputSx = {
  '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.6 },
  '& .MuiOutlinedInput-root': { borderRadius: 0.5 },
};

// Read-only Excel-style table view of Meta leads with inline CRM editing.
// Used by the inline sections of the admin (ClientAdDetails) and
// client-portal dashboards.
//
// Form-question answers render as a stacked label/value list inside a
// single "Form Responses" cell — keeps the table narrow regardless of
// how many questions a form has.
//
// Props:
//   leads:        array of Lead objects from /api/meta/client/:id/analytics
//   metaAccount:  the meta_account block (used for the Meta Account name)
//   maxHeight:    optional override for the scroll container height
//   onSaveLead:   async (leadId, payload) => updatedLead
//                 If omitted the table is purely read-only (no edit cells).
const MetaLeadsTable = ({ leads = [], metaAccount, maxHeight, onSaveLead }) => {
  const editable = typeof onSaveLead === 'function';

  // edits[leadId] holds the in-progress field state for a row.
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedFlash, setSavedFlash] = useState(null);

  // Re-seed edit state when the leads array changes (new fetch). We key by
  // _id so unrelated rows keep their in-flight edits across re-renders.
  useEffect(() => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const l of leads) {
        if (!next[l._id]) next[l._id] = buildEditState(l);
      }
      // Drop edits for leads that disappeared (e.g. range filter changed).
      const liveIds = new Set(leads.map((l) => l._id));
      for (const k of Object.keys(next)) if (!liveIds.has(k)) delete next[k];
      return next;
    });
  }, [leads]);

  const setField = (leadId, key, value) => {
    setEdits((prev) => ({
      ...prev,
      [leadId]: { ...prev[leadId], [key]: value },
    }));
  };

  const setFollowUp = (leadId, idx, key, value) => {
    setEdits((prev) => {
      const row = prev[leadId];
      if (!row) return prev;
      const list = row.follow_ups.slice();
      list[idx] = { ...list[idx], [key]: value };
      if (key === 'call_label') list[idx].connected = String(value).toUpperCase() === 'CONNECTED';
      return { ...prev, [leadId]: { ...row, follow_ups: list } };
    });
  };

  const addFollowUp = (leadId) => {
    setEdits((prev) => {
      const row = prev[leadId];
      if (!row) return prev;
      const next = row.follow_ups.slice();
      next.push({
        number: next.length + 1,
        date: '',
        call_label: '',
        remarks: '',
        connected: false,
      });
      return { ...prev, [leadId]: { ...row, follow_ups: next } };
    });
  };

  const removeFollowUp = (leadId, idx) => {
    setEdits((prev) => {
      const row = prev[leadId];
      if (!row) return prev;
      const next = row.follow_ups.filter((_, i) => i !== idx)
        .map((f, i) => ({ ...f, number: i + 1 }));
      return { ...prev, [leadId]: { ...row, follow_ups: next } };
    });
  };

  const handleSave = async (leadId) => {
    if (!editable) return;
    setSavingId(leadId);
    try {
      const payload = { ...edits[leadId] };
      // Send empty strings as null for date fields so backend stores nulls.
      ['first_call_date', 'next_followup_date', 'appointment_date', 'appointment_booked_date']
        .forEach((k) => { if (payload[k] === '') payload[k] = null; });
      payload.follow_ups = (payload.follow_ups || []).map((f) => ({
        number: f.number,
        date: f.date || null,
        call_label: f.call_label || '',
        remarks: f.remarks || '',
        connected: !!f.connected,
      }));
      await onSaveLead(leadId, payload);
      setSavedFlash(leadId);
      setTimeout(() => setSavedFlash((cur) => (cur === leadId ? null : cur)), 1800);
    } catch (err) {
      console.error('Save lead failed:', err);
      // Best-effort UX — surface the message via window.alert to avoid
      // pulling in a snackbar dep here. Pages that wrap the table can
      // intercept errors via the onSaveLead promise rejection.
      window.alert(err?.response?.data?.message || err?.message || 'Failed to save');
    } finally {
      setSavingId((cur) => (cur === leadId ? null : cur));
    }
  };

  // Column-span math for the grouping banner row above the field headers.
  // Form Name + Responses now sit inside the Lead Details band (between
  // Contact and Email) — the team wants the form context next to the
  // person, not parked at the end.
  // Lead Details = #, Date, Source, Name, Contact, Form Name,
  //                Form Responses, Email, Location, Hair/Skin, Telecaller (11)
  // Initial Call = First Call Date, Call Label, Response, Remarks (4)
  // Reminder = Next Follow-up (1)
  // Appointment = Status, Appt Date, Booked On (3)
  // Follow-up = FU#, Latest/History (2)
  const groups = useMemo(() => ({
    lead: 11,
    call: 4,
    reminder: 1,
    appointment: 3,
    followups: 2,
  }), []);

  if (leads.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">No leads to display.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: maxHeight || 'calc(100vh - 200px)', borderRadius: 0 }}>
      <Table size="small" stickyHeader sx={{ '& td, & th': { borderRight: '1px solid', borderColor: 'divider' } }}>
        <TableHead>
          {/* Group banner row — mirrors the spreadsheet's section bands */}
          <TableRow>
            <TableCell sx={{ ...groupHeaderSx, bgcolor: '#7C2D12' }} colSpan={groups.lead}>Lead Details</TableCell>
            <TableCell sx={{ ...groupHeaderSx, bgcolor: '#9A3412' }} colSpan={groups.call}>Initial Call Details</TableCell>
            <TableCell sx={{ ...groupHeaderSx, bgcolor: '#B45309' }} colSpan={groups.reminder}>Reminder</TableCell>
            <TableCell sx={{ ...groupHeaderSx, bgcolor: '#0E7490' }} colSpan={groups.appointment}>Appointment</TableCell>
            <TableCell sx={{ ...groupHeaderSx, bgcolor: '#7E22CE' }} colSpan={groups.followups}>Follow-up Status</TableCell>
            {editable && <TableCell sx={{ ...groupHeaderSx, bgcolor: '#1F2937' }}>Action</TableCell>}
          </TableRow>
          {/* Field header row */}
          <TableRow>
            {/* Lead Details — minWidth (not width) so columns can grow to fit
                content. The TableContainer scrolls horizontally if total
                width exceeds the viewport. */}
            <TableCell sx={{ ...headerCellSx, minWidth: 36 }}>#</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 130 }}>Date</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 110 }}>Source</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 160 }}>Name</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 140 }}>Contact</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 180 }}>Form Name</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 360 }}>Form Responses</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 240 }}>Email</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 150 }}>Location</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 120 }}>Hair / Skin</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 160 }}>Telecaller</TableCell>
            {/* Initial Call Details */}
            <TableCell sx={{ ...headerCellSx, minWidth: 150 }}>First Call Date</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 170 }}>Call Label</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 200 }}>Response</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 260 }}>Remarks</TableCell>
            {/* Reminder */}
            <TableCell sx={{ ...headerCellSx, minWidth: 160 }}>Next Follow-up</TableCell>
            {/* Appointment */}
            <TableCell sx={{ ...headerCellSx, minWidth: 200 }}>Status</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 160 }}>Appt. Date</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 160 }}>Booked On</TableCell>
            {/* Follow-up Status */}
            <TableCell sx={{ ...headerCellSx, minWidth: 90 }}>FU #</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 520 }}>Latest / History</TableCell>
            {editable && <TableCell sx={{ ...headerCellSx, minWidth: 120, position: 'sticky', right: 0, bgcolor: '#fff', zIndex: 3 }}>Save</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {leads.map((l, idx) => {
            const e = edits[l._id] || buildEditState(l);
            const isIG = String(l.platform).toLowerCase() === 'instagram';
            const platformColor = isIG ? INSTAGRAM_PINK : META_BLUE;
            const entries = extractFormEntries(l.raw_field_data);
            const followCount = (e.follow_ups || []).length;

            // Row-level color hint
            let rowBg = idx % 2 === 0 ? '#fff' : 'grey.50';
            if (e.is_duplicate || e.response_label === 'DUPLICATE') rowBg = DUPLICATE_BG;
            else if (e.response_label === 'TREATMENT BOOKED') rowBg = TREATMENT_BG;
            else if (e.response_label === 'CONSULTED') rowBg = CONSULTED_BG;

            const isSaving = savingId === l._id;
            const justSaved = savedFlash === l._id;

            return (
              <React.Fragment key={l._id || idx}>
                <TableRow hover sx={{ verticalAlign: 'top', bgcolor: rowBg }}>
                  {/* # */}
                  <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: 'monospace' }}>{idx + 1}</TableCell>
                  {/* Date (received) */}
                  <TableCell sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                    {fmtReceived(l.meta_created_time || l.createdAt)}
                  </TableCell>
                  {/* Source (platform chip) */}
                  <TableCell>
                    {l.platform ? (
                      <Chip
                        label={l.platform}
                        size="small"
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, textTransform: 'capitalize', bgcolor: `${platformColor}15`, color: platformColor }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>—</Typography>
                    )}
                  </TableCell>
                  {/* Name */}
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{l.name || '—'}</TableCell>
                  {/* Contact / phone */}
                  <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{l.phone || '—'}</TableCell>
                  {/* Form name */}
                  <TableCell sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{l.meta_form_name || '—'}</TableCell>
                  {/* Form responses (label/value pairs from raw_field_data) */}
                  <TableCell sx={{ minWidth: 360, py: 1 }}>
                    {entries.length === 0 ? (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>—</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                        {entries.map((q, i) => (
                          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', columnGap: 1.5, alignItems: 'baseline' }}>
                            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.3, wordBreak: 'break-word' }}>
                              {q.label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', wordBreak: 'break-word' }}>{q.value || '—'}</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  {/* Email — single line, column grows to fit. Container
                      scrolls horizontally if the address is unusually long. */}
                  <TableCell sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{l.email || '—'}</TableCell>
                  {/* Location (editable) */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        size="small" fullWidth variant="outlined"
                        value={e.lead_location}
                        onChange={(ev) => setField(l._id, 'lead_location', ev.target.value)}
                        sx={cellInputSx}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem' }}>{e.lead_location || '—'}</Typography>
                    )}
                  </TableCell>
                  {/* Hair / Skin (editable dropdown) */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        select size="small" fullWidth variant="outlined"
                        value={e.lead_category}
                        onChange={(ev) => setField(l._id, 'lead_category', ev.target.value)}
                        sx={cellInputSx}
                      >
                        {CATEGORY_OPTIONS.map((o) => <MenuItem key={o || '__none'} value={o}>{o || '—'}</MenuItem>)}
                      </TextField>
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem' }}>{e.lead_category || '—'}</Typography>
                    )}
                  </TableCell>
                  {/* Telecaller (editable free-text) */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        size="small" fullWidth variant="outlined"
                        value={e.telecaller_name}
                        onChange={(ev) => setField(l._id, 'telecaller_name', ev.target.value)}
                        sx={cellInputSx}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem' }}>{e.telecaller_name || '—'}</Typography>
                    )}
                  </TableCell>

                  {/* First Call Date */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        type="date" size="small" fullWidth variant="outlined"
                        value={e.first_call_date}
                        onChange={(ev) => setField(l._id, 'first_call_date', ev.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={cellInputSx}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem' }}>{e.first_call_date || '—'}</Typography>
                    )}
                  </TableCell>
                  {/* Call Label */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        select size="small" fullWidth variant="outlined"
                        value={e.first_call_label}
                        onChange={(ev) => setField(l._id, 'first_call_label', ev.target.value)}
                        sx={cellInputSx}
                      >
                        {CALL_LABEL_OPTIONS.map((o) => <MenuItem key={o || '__none'} value={o}>{o || '—'}</MenuItem>)}
                      </TextField>
                    ) : e.first_call_label ? (
                      <Chip label={e.first_call_label} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, ...(labelChipColor(e.first_call_label) ? { bgcolor: labelChipColor(e.first_call_label).bg, color: labelChipColor(e.first_call_label).fg } : {}) }} />
                    ) : <Typography sx={{ fontSize: '0.75rem' }}>—</Typography>}
                  </TableCell>
                  {/* Response Label */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        select size="small" fullWidth variant="outlined"
                        value={e.response_label}
                        onChange={(ev) => setField(l._id, 'response_label', ev.target.value)}
                        sx={cellInputSx}
                      >
                        {RESPONSE_LABEL_OPTIONS.map((o) => <MenuItem key={o || '__none'} value={o}>{o || '—'}</MenuItem>)}
                      </TextField>
                    ) : e.response_label ? (
                      <Chip label={e.response_label} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, ...(labelChipColor(e.response_label) ? { bgcolor: labelChipColor(e.response_label).bg, color: labelChipColor(e.response_label).fg } : {}) }} />
                    ) : <Typography sx={{ fontSize: '0.75rem' }}>—</Typography>}
                  </TableCell>
                  {/* Remarks */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        size="small" fullWidth variant="outlined" multiline maxRows={3}
                        value={e.remarks}
                        onChange={(ev) => setField(l._id, 'remarks', ev.target.value)}
                        sx={cellInputSx}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{e.remarks || '—'}</Typography>
                    )}
                  </TableCell>

                  {/* Next Follow-up */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        type="date" size="small" fullWidth variant="outlined"
                        value={e.next_followup_date}
                        onChange={(ev) => setField(l._id, 'next_followup_date', ev.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={cellInputSx}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem' }}>{e.next_followup_date || '—'}</Typography>
                    )}
                  </TableCell>

                  {/* Appointment Status */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        select size="small" fullWidth variant="outlined"
                        value={e.appointment_status}
                        onChange={(ev) => setField(l._id, 'appointment_status', ev.target.value)}
                        sx={cellInputSx}
                      >
                        {APPOINTMENT_STATUS_OPTIONS.map((o) => <MenuItem key={o || '__none'} value={o}>{o || '—'}</MenuItem>)}
                      </TextField>
                    ) : e.appointment_status ? (
                      <Chip label={e.appointment_status} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, ...(labelChipColor(e.appointment_status) ? { bgcolor: labelChipColor(e.appointment_status).bg, color: labelChipColor(e.appointment_status).fg } : {}) }} />
                    ) : <Typography sx={{ fontSize: '0.75rem' }}>—</Typography>}
                  </TableCell>
                  {/* Appt Date */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        type="date" size="small" fullWidth variant="outlined"
                        value={e.appointment_date}
                        onChange={(ev) => setField(l._id, 'appointment_date', ev.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={cellInputSx}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem' }}>{e.appointment_date || '—'}</Typography>
                    )}
                  </TableCell>
                  {/* Booked On */}
                  <TableCell>
                    {editable ? (
                      <TextField
                        type="date" size="small" fullWidth variant="outlined"
                        value={e.appointment_booked_date}
                        onChange={(ev) => setField(l._id, 'appointment_booked_date', ev.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={cellInputSx}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '0.75rem' }}>{e.appointment_booked_date || '—'}</Typography>
                    )}
                  </TableCell>

                  {/* Follow-up # — running count for the row */}
                  <TableCell>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      {followCount > 0 ? `FU-${followCount}` : '—'}
                    </Typography>
                  </TableCell>
                  {/* All follow-up attempts — always visible, stacked
                      editable mini-rows. The + icon at the bottom appends
                      a new attempt below the current ones, matching the
                      spreadsheet's Followup History column. */}
                  <TableCell sx={{ py: 0.6 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {(e.follow_ups || []).map((f, fi) => (
                        <Box
                          key={f._id || fi}
                          sx={{
                            display: 'grid',
                            // minmax keeps Remarks visible even when the
                            // parent column is squeezed — collapses to
                            // 140px floor instead of 0.
                            gridTemplateColumns: editable
                              ? '46px 130px 150px minmax(140px, 1fr) 36px'
                              : '46px 110px 130px minmax(140px, 1fr)',
                            columnGap: 0.6,
                            alignItems: 'center',
                            borderTop: fi > 0 ? '1px dashed' : 'none',
                            borderColor: 'divider',
                            pt: fi > 0 ? 0.5 : 0,
                          }}
                        >
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary' }}>
                            FU-{f.number}
                          </Typography>
                          {editable ? (
                            <TextField
                              type="date" size="small" fullWidth variant="outlined"
                              value={f.date}
                              onChange={(ev) => setFollowUp(l._id, fi, 'date', ev.target.value)}
                              InputLabelProps={{ shrink: true }}
                              sx={cellInputSx}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.7rem' }}>{f.date || '—'}</Typography>
                          )}
                          {editable ? (
                            <TextField
                              select size="small" fullWidth variant="outlined"
                              value={f.call_label}
                              onChange={(ev) => setFollowUp(l._id, fi, 'call_label', ev.target.value)}
                              sx={cellInputSx}
                            >
                              {CALL_LABEL_OPTIONS.map((o) => <MenuItem key={o || '__none'} value={o}>{o || '—'}</MenuItem>)}
                            </TextField>
                          ) : f.call_label ? (
                            <Chip
                              label={f.call_label}
                              size="small"
                              sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, bgcolor: labelChipColor(f.call_label)?.bg, color: labelChipColor(f.call_label)?.fg }}
                            />
                          ) : <Typography sx={{ fontSize: '0.7rem' }}>—</Typography>}
                          {editable ? (
                            <TextField
                              size="small" fullWidth variant="outlined"
                              placeholder="Remarks"
                              value={f.remarks}
                              onChange={(ev) => setFollowUp(l._id, fi, 'remarks', ev.target.value)}
                              sx={cellInputSx}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.7rem' }}>{f.remarks || '—'}</Typography>
                          )}
                          {editable && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <Tooltip title="Remove this follow-up">
                                <IconButton
                                  size="small"
                                  onClick={() => removeFollowUp(l._id, fi)}
                                  sx={{ p: 0.5, '&:hover': { bgcolor: '#FEE2E2' } }}
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 16, color: '#B91C1C' }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </Box>
                      ))}
                      {editable && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            borderTop: followCount > 0 ? '1px dashed' : 'none',
                            borderColor: 'divider',
                            pt: followCount > 0 ? 0.4 : 0,
                          }}
                        >
                          <Tooltip title="Add another follow-up">
                            <IconButton
                              size="small"
                              onClick={() => addFollowUp(l._id)}
                              sx={{
                                p: 0.3,
                                border: '1px dashed',
                                borderColor: 'divider',
                                borderRadius: '50%',
                                '&:hover': { bgcolor: `${META_BLUE}10`, borderColor: META_BLUE },
                              }}
                            >
                              <AddIcon sx={{ fontSize: 14, color: META_BLUE }} />
                            </IconButton>
                          </Tooltip>
                          {followCount === 0 && (
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', ml: 0.8 }}>
                              Add first follow-up
                            </Typography>
                          )}
                        </Box>
                      )}
                      {!editable && followCount === 0 && (
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                          No follow-ups yet
                        </Typography>
                      )}
                    </Box>
                  </TableCell>

                  {/* Save action */}
                  {editable && (
                    <TableCell sx={{ position: 'sticky', right: 0, bgcolor: rowBg, zIndex: 2 }}>
                      <Button
                        size="small"
                        variant={justSaved ? 'outlined' : 'contained'}
                        color={justSaved ? 'success' : 'primary'}
                        startIcon={isSaving ? <CircularProgress size={12} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                        onClick={() => handleSave(l._id)}
                        disabled={isSaving}
                        sx={{ fontSize: '0.65rem', py: 0.4, minWidth: 0 }}
                      >
                        {justSaved ? 'Saved' : (isSaving ? 'Saving' : 'Save')}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default MetaLeadsTable;
