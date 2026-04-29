// Export helpers for the Meta Recent Leads table.
// Both the admin pages and the Client Portal use these so the Excel/PDF
// output stays identical across the app.
//
// Styling rules (Excel + PDF, kept in sync):
//   - Header row: solid Meta-blue fill, white bold text
//   - Platform cell: blue tint for Facebook, pink tint for Instagram
//   - Other cells: default formatting

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Brand palette — keep in sync with MetaLeadsTable.js
const META_BLUE_HEX = '1877F2';
const INSTAGRAM_PINK_HEX = 'E4405F';
const META_BLUE_TINT_HEX = 'D6E5FB'; // ~15% blue
const INSTAGRAM_PINK_TINT_HEX = 'FBD9E0'; // ~15% pink
const HEADER_FILL_HEX = '1877F2';
const HEADER_TEXT_HEX = 'FFFFFF';

// jsPDF takes RGB triplets, not hex
const HEX_TO_RGB = (hex) => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];

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

const fmtReceived = (fetchedAt) => {
  if (!fetchedAt) return '';
  try {
    return new Date(fetchedAt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(fetchedAt);
  }
};

const buildRowsAndColumns = (leads, metaAccount) => {
  const baseColumns = ['Received', 'Meta Account', 'Name', 'Email', 'Phone', 'Platform', 'Form'];
  const formColumnSet = new Set();
  const rows = leads.map((l) => {
    const entries = extractFormEntries(l.raw_field_data);
    const row = {
      Received: fmtReceived(metaAccount?.fetched_at),
      'Meta Account': metaAccount?.name || '',
      Name: l.name || '',
      Email: l.email || '',
      Phone: l.phone || '',
      Platform: l.platform || '',
      Form: l.meta_form_name || '',
    };
    entries.forEach((e) => {
      formColumnSet.add(e.label);
      row[e.label] = e.value;
    });
    return row;
  });
  const formColumns = Array.from(formColumnSet);
  const columns = [...baseColumns, ...formColumns];
  return { rows, columns };
};

const slugify = (s) => String(s || 'meta-leads')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60) || 'meta-leads';

// ---------- Excel ----------
export const exportLeadsToExcel = (leads, metaAccount, clientName) => {
  if (!leads || leads.length === 0) return false;
  const { rows, columns } = buildRowsAndColumns(leads, metaAccount);
  const platformIdx = columns.indexOf('Platform');

  // Build the sheet as an array-of-arrays of styled cells so we can apply
  // per-cell formatting. xlsx-js-style understands the `s` property.
  const headerRow = columns.map((col) => ({
    v: col,
    t: 's',
    s: {
      fill: { fgColor: { rgb: HEADER_FILL_HEX } },
      font: { bold: true, color: { rgb: HEADER_TEXT_HEX }, sz: 11 },
      alignment: { vertical: 'center', horizontal: 'left' },
      border: {
        top: { style: 'thin', color: { rgb: HEADER_FILL_HEX } },
        bottom: { style: 'thin', color: { rgb: HEADER_FILL_HEX } },
      },
    },
  }));

  const dataRows = rows.map((r) =>
    columns.map((col, ci) => {
      const value = r[col] ?? '';
      const cell = { v: String(value), t: 's' };
      if (ci === platformIdx && value) {
        const isIG = String(value).toLowerCase() === 'instagram';
        const fill = isIG ? INSTAGRAM_PINK_TINT_HEX : META_BLUE_TINT_HEX;
        const text = isIG ? INSTAGRAM_PINK_HEX : META_BLUE_HEX;
        cell.s = {
          fill: { fgColor: { rgb: fill } },
          font: { bold: true, color: { rgb: text } },
          alignment: { vertical: 'center', horizontal: 'center' },
        };
      }
      return cell;
    })
  );

  const aoa = [headerRow, ...dataRows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // Auto column widths capped at 60.
  sheet['!cols'] = columns.map((col) => {
    const maxLen = rows.reduce(
      (acc, r) => Math.max(acc, String(r[col] ?? '').length, col.length),
      col.length
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });
  // Slightly taller header row.
  sheet['!rows'] = [{ hpt: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Meta Leads');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(
    new Blob([out], { type: 'application/octet-stream' }),
    `meta-leads-${slugify(clientName)}-${stamp}.xlsx`
  );
  return true;
};

// ---------- PDF ----------
export const exportLeadsToPdf = (leads, metaAccount, clientName) => {
  if (!leads || leads.length === 0) return false;
  const { rows, columns } = buildRowsAndColumns(leads, metaAccount);
  const platformIdx = columns.indexOf('Platform');

  const headerFill = HEX_TO_RGB(HEADER_FILL_HEX);
  const headerText = HEX_TO_RGB(HEADER_TEXT_HEX);
  const fbFill = HEX_TO_RGB(META_BLUE_TINT_HEX);
  const fbText = HEX_TO_RGB(META_BLUE_HEX);
  const igFill = HEX_TO_RGB(INSTAGRAM_PINK_TINT_HEX);
  const igText = HEX_TO_RGB(INSTAGRAM_PINK_HEX);

  // Landscape A3 — Meta lead forms can have many custom fields.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Meta Leads — ${clientName || 'Client'}`, 40, 36);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Exported ${stamp}  ·  ${leads.length} lead(s)`, 40, 52);

  autoTable(doc, {
    startY: 70,
    head: [columns],
    body: rows.map((r) => columns.map((c) => r[c] ?? '')),
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
    headStyles: {
      fillColor: headerFill,
      textColor: headerText,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [247, 250, 253] },
    margin: { left: 30, right: 30 },
    didParseCell: (hookData) => {
      // Color the Platform column body cells (FB blue / IG pink).
      if (hookData.section !== 'body') return;
      if (hookData.column.index !== platformIdx) return;
      const value = String(hookData.cell.raw || '').toLowerCase();
      if (!value) return;
      if (value === 'instagram') {
        hookData.cell.styles.fillColor = igFill;
        hookData.cell.styles.textColor = igText;
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.halign = 'center';
      } else {
        hookData.cell.styles.fillColor = fbFill;
        hookData.cell.styles.textColor = fbText;
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.halign = 'center';
      }
    },
  });

  doc.save(`meta-leads-${slugify(clientName)}-${new Date().toISOString().slice(0, 10)}.pdf`);
  return true;
};
