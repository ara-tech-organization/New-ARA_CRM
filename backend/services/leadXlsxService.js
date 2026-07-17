/*
 * xlsx round-trip for the /client-portal/leads TELECALLING sheet.
 *
 * Read side  (parseTelecallingSheet):
 *   - Accepts the existing sheet layout: sheet named "TELECALLING",
 *     headers on row 2, data starting row 3. Falls back to header
 *     lookup by label when the operator uploads a resaved / re-tabbed
 *     file whose row structure has drifted.
 *   - Parses Excel date-serials + native Date cells → JS Date.
 *   - Normalises phones (strip +91, spaces, hyphens; keep last 10).
 *   - Cleans known dirty dropdown values:
 *       "HOT "         → "HOT"     (trailing whitespace)
 *       "DARMONT"      → "DARMANT" (spelling variant)
 *       "HOT , COLD"   → "HOT"     (combined values → first token)
 *       "RNR" / "SWITCHED OFF" / "WRONG NO" / "DUP" → canonical labels
 *   - Reports per-row "dirty" fixes and "skipped" rows (with reason)
 *     so the UI can toast a summary the operator can act on.
 *
 * Write side (buildTelecallingWorkbook):
 *   - Writes the exact 26 headers on row 2 with the sheet named
 *     "TELECALLING" so it drops straight back into the operator's
 *     existing workflow.
 *   - Row 1 is a title row ("GROHAIR · Telecalling · exported YYYY-
 *     MM-DD") so re-reading the file later still finds headers on row 2.
 *
 * Consumed by controllers/leadTelecallerController.js.
 */

import ExcelJS from 'exceljs';
import {
  SOURCE_ENUM, HAIR_OR_SKIN_ENUM, CALL_LABEL_ENUM, RESPONSE_LABEL_ENUM,
  APPOINTMENT_STATUS_ENUM, FOLLOWUP_CALL_LABEL_ENUM, STATUS_SHEET_ENUM,
} from '../models/Lead.js';

// ─── 26-column layout (spec-exact header labels) ─────────────────
// Order MUST match the sheet's column order — the write side emits
// headers in this order and the read side falls back to positional
// mapping when it can't find a header by label.
export const SHEET_COLUMNS = [
  { key: 'date',                  header: 'DATE',                                    kind: 'date',   width: 12 },
  { key: 'source_sheet',          header: 'SOURCE',                                  kind: 'source', width: 18 },
  { key: 'name',                  header: 'NAME',                                    kind: 'text',   width: 24 },
  { key: 'contact',               header: 'CONTACT',                                 kind: 'phone',  width: 14 },
  { key: 'lead_location',         header: 'LOCATION',                                kind: 'text',   width: 16 },
  { key: 'hair_or_skin',          header: 'HAIR/ SKIN',                              kind: 'hairSkin', width: 12 },
  { key: 'telecaller_name',       header: 'TELECALLER NAME',                         kind: 'text',   width: 16 },
  { key: 'first_call_date',       header: 'FIRST CALL DATE',                         kind: 'date',   width: 14 },
  { key: 'first_call_label',      header: 'CALL LABEL',                              kind: 'callLabel',     width: 16 },
  { key: 'response_label',        header: 'RESPONSE LABEL',                          kind: 'responseLabel', width: 18 },
  { key: 'remarks',               header: 'REMARKS',                                 kind: 'text',   width: 28 },
  { key: 'reminder_date',         header: 'REMINDER DATE',                           kind: 'date',   width: 14 },
  { key: 'appointment_status',    header: 'APPOINTMENT STATUS',                      kind: 'appointmentStatus', width: 24 },
  { key: 'appointment_date',      header: 'APPOINTMENT DATE',                        kind: 'date',   width: 14 },
  { key: 'appointment_booked_date', header: 'APPOINTMENT BOOKED DATE',               kind: 'date',   width: 16 },
  { key: 'follow_up_number',      header: 'FOLLOW-UP NUMBER',                        kind: 'text',   width: 14 },
  { key: 'follow_up_call_label',  header: 'FOLLOW-UP CALL LABEL',                    kind: 'followupCallLabel', width: 16 },
  { key: 'follow_up_date',        header: 'FOLLOW-UP DATE',                          kind: 'date',   width: 14 },
  { key: 'follow_up_remarks',     header: 'FOLLOW-UP REMARKS',                       kind: 'text',   width: 26 },
  { key: 'history_not_connected', header: 'FOLLOWUP HISTORY NOT CONNECTED CALLS',    kind: 'text',   width: 40 },
  { key: 'history_connected',     header: 'FOLLOWUP HISTORY CONNECTED CALLS',        kind: 'text',   width: 40 },
  { key: 'status_sheet',          header: 'STATUS',                                  kind: 'status', width: 14 },
  { key: 'consulted_date',        header: 'CONSULTED DATE',                          kind: 'date',   width: 14 },
  { key: 'treatment_booked_date', header: 'TREATMENT BOOKED DATE',                   kind: 'date',   width: 16 },
  { key: 'treatment_value',       header: 'TREATMENT VALUE',                         kind: 'number', width: 14 },
  { key: 'month',                 header: 'MONTH',                                   kind: 'text',   width: 12 },
];

// ─── Dropdown-value cleaners ─────────────────────────────────────
// Simple word-level canonicalisation — trims, uppercases, resolves
// known aliases, splits multi-token values on `,` / `/` and keeps the
// first token that maps to a valid enum member.
const upperTrim = (v) => String(v == null ? '' : v).trim().toUpperCase();
const firstToken = (v) => upperTrim(v).split(/[,\/]/)[0].trim();

const CALL_LABEL_ALIASES = {
  RNR: 'RNA',
  'RING NO ANSWER': 'RNA',
  'RING-NO-ANSWER': 'RNA',
  DUP: 'DUPLICATE',
  'WRONG NO': 'WRONG NUMBER',
  'WRONG NO.': 'WRONG NUMBER',
  SWITCHED_OFF: 'SWITCH OFF',
  'SWITCHED OFF': 'SWITCH OFF',
  'SWITCH-OFF': 'SWITCH OFF',
};
const RESPONSE_ALIASES = {
  DARMONT: 'DARMANT',
};

const cleanFromEnum = (enumList, aliases = {}) => (raw, dirty) => {
  if (raw === null || raw === undefined || raw === '') return '';
  const original = String(raw).trim();
  let token = firstToken(original);
  if (aliases[token]) { dirty.push({ from: original, to: aliases[token] }); token = aliases[token]; }
  else if (upperTrim(original) !== original) { dirty.push({ from: original, to: token }); }
  if (enumList.includes(token)) return token;
  // Not in enum → return '' (skip the field) and record the drop.
  dirty.push({ from: original, to: '', reason: 'not in enum' });
  return '';
};

const cleanSource         = cleanFromEnum(SOURCE_ENUM);
const cleanHairOrSkin     = cleanFromEnum(HAIR_OR_SKIN_ENUM);
const cleanCallLabel      = cleanFromEnum(CALL_LABEL_ENUM, CALL_LABEL_ALIASES);
const cleanResponseLabel  = cleanFromEnum(RESPONSE_LABEL_ENUM, RESPONSE_ALIASES);
const cleanApptStatus     = cleanFromEnum(APPOINTMENT_STATUS_ENUM);
const cleanFollowupCall   = cleanFromEnum(FOLLOWUP_CALL_LABEL_ENUM, CALL_LABEL_ALIASES);
const cleanStatus         = cleanFromEnum(STATUS_SHEET_ENUM);

// ─── Cell readers ────────────────────────────────────────────────
// ExcelJS surfaces cells with a `.value` that varies by type:
//   text / number → primitive
//   date          → JS Date
//   formula       → { result, formula }
//   rich text     → { richText: [...] }
// This unwraps to a plain scalar.
const readCellValue = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const v = cell.value;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.result !== undefined) return v.result;                // formula
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if (v.text !== undefined) return v.text;                    // hyperlink
    return '';
  }
  return v;
};

// Excel serial-date parser. ExcelJS usually surfaces dates as JS
// Date objects directly (based on the workbook's date1904 flag), but
// files re-saved by non-Excel apps sometimes leave numeric serials in
// place. Handle both.
const toDate = (v) => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // 25569 = days between 1899-12-30 and 1970-01-01. Excel treats
    // 1900 as a leap year (it isn't) so any date before Mar 1900 is
    // 1 day off; we don't care about pre-1900 leads.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(String(v));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Phone → 10-digit last-N.
const normaliseContact = (raw) => {
  if (raw == null) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  const trimmed = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return trimmed.length >= 10 ? trimmed.slice(-10) : '';
};

// ─── Header locator ───────────────────────────────────────────────
// Given a worksheet row, build a { headerLabel → columnNumber } map so
// subsequent data rows can index by label (resilient to column-order
// drift when the operator reshapes their copy of the sheet).
const buildHeaderIndex = (row) => {
  const idx = new Map();
  row.eachCell((cell, colNumber) => {
    const label = String(readCellValue(cell) || '').trim().toUpperCase();
    if (label) idx.set(label, colNumber);
  });
  return idx;
};

// ─── Main entry: parse the workbook buffer ───────────────────────
// Returns:
//   {
//     rows:    [{ patch, dirty: [...], row: <sheet-row-number> }],
//     skipped: [{ row, reason }],
//     sheetName: <the sheet that was parsed>,
//   }
// `patch` is a plain object matching the Lead-model field names —
// safe to spread into a `new Lead({ client, ...patch })`. Callers
// still have to run `runTelecallerAutomation` before saving so
// history / reminder rules kick in on imported rows too.
export const parseTelecallingSheet = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Prefer a sheet literally named "TELECALLING" (case-insensitive);
  // fall back to the first worksheet.
  let ws = wb.worksheets.find((w) => String(w.name || '').trim().toUpperCase() === 'TELECALLING');
  if (!ws) ws = wb.worksheets[0];
  if (!ws) throw new Error('The uploaded file has no worksheets.');

  // Spec: headers on row 2, data from row 3. But if row 2 has no
  // recognisable header, try row 1 (some operator copies drop the
  // title row).
  let headerRowNumber = 2;
  let headerIdx = buildHeaderIndex(ws.getRow(headerRowNumber));
  const expectedLabel = SHEET_COLUMNS[0].header.toUpperCase();
  if (!headerIdx.has(expectedLabel)) {
    const r1 = buildHeaderIndex(ws.getRow(1));
    if (r1.has(expectedLabel)) { headerRowNumber = 1; headerIdx = r1; }
  }
  if (!headerIdx.has(expectedLabel)) {
    throw new Error(`Could not find a "${expectedLabel}" header in row 1 or 2 of "${ws.name}".`);
  }

  const rows = [];
  const skipped = [];
  const lastRow = ws.actualRowCount || ws.rowCount;

  for (let r = headerRowNumber + 1; r <= lastRow; r += 1) {
    const row = ws.getRow(r);
    const dirty = [];
    const patch = {};

    // Helper: read a column by its schema key.
    const readByKey = (key) => {
      const col = SHEET_COLUMNS.find((c) => c.key === key);
      const colNum = col ? headerIdx.get(col.header.toUpperCase()) : undefined;
      if (!colNum) return '';
      return readCellValue(row.getCell(colNum));
    };

    // Skip completely-empty rows (Excel leaves formatted blank rows
    // at the bottom of many files).
    const isBlank = SHEET_COLUMNS.every((c) => {
      const v = readByKey(c.key);
      return v === '' || v === null || v === undefined;
    });
    if (isBlank) continue;

    // NAME required.
    const nameRaw = readByKey('name');
    const name = String(nameRaw || '').trim();
    if (!name) {
      skipped.push({ row: r, reason: 'name is required' });
      continue;
    }
    patch.name = name;

    // Dates
    patch.date                     = toDate(readByKey('date'));
    patch.first_call_date          = toDate(readByKey('first_call_date'));
    patch.reminder_date            = toDate(readByKey('reminder_date'));
    patch.appointment_date         = toDate(readByKey('appointment_date'));
    patch.appointment_booked_date  = toDate(readByKey('appointment_booked_date'));
    patch.consulted_date           = toDate(readByKey('consulted_date'));
    patch.treatment_booked_date    = toDate(readByKey('treatment_booked_date'));

    // Contact (normalised).
    const contactRaw = readByKey('contact');
    const contact = normaliseContact(contactRaw);
    if (contact) patch.contact = contact;
    else if (contactRaw && String(contactRaw).trim()) {
      dirty.push({ from: String(contactRaw), to: '', reason: 'phone < 10 digits' });
    }

    // Free-text
    patch.lead_location    = String(readByKey('lead_location') || '').trim();
    patch.telecaller_name  = String(readByKey('telecaller_name') || '').trim();
    patch.remarks          = String(readByKey('remarks') || '').trim();
    patch.follow_up_remarks_raw = String(readByKey('follow_up_remarks') || '').trim();

    // Numbers
    const tv = readByKey('treatment_value');
    patch.treatment_value = (tv === '' || tv == null) ? 0 : Number(tv) || 0;

    // Enums (cleaned)
    patch.source_sheet       = cleanSource(readByKey('source_sheet'), dirty);
    patch.hair_or_skin       = cleanHairOrSkin(readByKey('hair_or_skin'), dirty);
    patch.first_call_label   = cleanCallLabel(readByKey('first_call_label'), dirty);
    patch.response_label     = cleanResponseLabel(readByKey('response_label'), dirty);
    patch.appointment_status = cleanApptStatus(readByKey('appointment_status'), dirty);
    patch.status_sheet       = cleanStatus(readByKey('status_sheet'), dirty);

    // A pending follow-up row buffered from the sheet's cols 17-19.
    // We synthesise a follow_ups[] entry when the CALL LABEL is a
    // valid enum value — otherwise it becomes noise.
    const fuCall = cleanFollowupCall(readByKey('follow_up_call_label'), dirty);
    if (fuCall) {
      const fuDate = toDate(readByKey('follow_up_date')) || patch.date || new Date();
      patch.follow_ups = [{
        number: 1,
        date: fuDate,
        call_label: fuCall,
        remarks: patch.follow_up_remarks_raw,
        connected: fuCall === 'CONNECTED',
      }];
    }
    delete patch.follow_up_remarks_raw;   // never persisted verbatim

    // History cols are read-only in the UI but we accept them on
    // import so the operator's existing text survives round-trips.
    // The migration/runtime automation will rebuild them if new
    // follow_ups are appended.
    const hnc = String(readByKey('history_not_connected') || '').trim();
    const hc  = String(readByKey('history_connected') || '').trim();
    if (hnc) patch.history_not_connected = hnc;
    if (hc)  patch.history_connected     = hc;

    rows.push({ row: r, patch, dirty });
  }

  return { rows, skipped, sheetName: ws.name };
};

// ─── Write side ─────────────────────────────────────────────────
// Build a workbook that matches the sheet's shape exactly so the
// operator can drop the export back into their old flow.
export const buildTelecallingWorkbook = async (leads = [], meta = {}) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ARA Leadmatrix';
  wb.created = new Date();

  const ws = wb.addWorksheet('TELECALLING', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // Row 1 — title (spec places headers on row 2, so row 1 is free
  // text). Merged for readability.
  ws.mergeCells(1, 1, 1, SHEET_COLUMNS.length);
  const title = ws.getRow(1).getCell(1);
  title.value = `TELECALLING · ${meta.clientName || 'Client'} · exported ${new Date().toISOString().slice(0, 10)}`;
  title.font = { bold: true, color: { argb: 'FFF8FAFC' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  ws.getRow(1).height = 22;

  // Row 2 — headers
  const headerRow = ws.getRow(2);
  SHEET_COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3966' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    ws.getColumn(i + 1).width = c.width;
  });
  headerRow.height = 22;

  // Data rows (row 3 onwards).
  leads.forEach((lead, rowIdx) => {
    const row = ws.getRow(3 + rowIdx);
    SHEET_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = readLeadValueForWrite(lead, c);
      if (c.kind === 'date' && cell.value instanceof Date) {
        cell.numFmt = 'dd-mmm-yyyy';
      }
      if (c.kind === 'number') cell.numFmt = '#,##0';
    });
    // Duplicate row tint (matches the sheet's 🟧 convention).
    if (lead.is_duplicate) {
      SHEET_COLUMNS.forEach((_, i) => {
        row.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8CC' } };
      });
    }
  });

  return wb.xlsx.writeBuffer();
};

const readLeadValueForWrite = (lead, col) => {
  switch (col.key) {
    case 'follow_up_number':
      return `FOLLOW-UP ${Math.min((lead.follow_ups?.length || 0) + 1, 20)}`;
    case 'follow_up_call_label': {
      const last = lead.follow_ups?.[lead.follow_ups.length - 1];
      return last?.call_label || '';
    }
    case 'follow_up_date': {
      const last = lead.follow_ups?.[lead.follow_ups.length - 1];
      return last?.date ? new Date(last.date) : null;
    }
    case 'follow_up_remarks': {
      const last = lead.follow_ups?.[lead.follow_ups.length - 1];
      return last?.remarks || '';
    }
    case 'reminder_date':
      return lead.next_followup_date ? new Date(lead.next_followup_date) : null;
    case 'month': {
      const anchor = lead.date || lead.meta_created_time || lead.createdAt;
      return anchor ? new Date(anchor).toLocaleString('en-GB', { month: 'long' }) : '';
    }
    case 'contact':
      return lead.contact || lead.phone || '';
    default: {
      const v = lead[col.key];
      if (v == null) return '';
      if (col.kind === 'date') return v instanceof Date ? v : new Date(v);
      return v;
    }
  }
};
