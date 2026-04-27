// Export helpers for the Meta Recent Leads table.
// Both the admin ClientAdDetails page and the Client Portal use these so
// the Excel/PDF output stays identical.

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// Pull the form-response entries off a lead, hiding fields that already live
// in dedicated columns (Name / Email / Phone). Returns [{ label, value }].
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

// Build a flat row[] + a column[] list. Form-response keys become extra
// columns so the spreadsheet/PDF reads like a true grid (one cell = one
// value), not a JSON blob.
const buildRowsAndColumns = (leads, metaAccount) => {
  const baseColumns = ['Received', 'Meta Account', 'Name', 'Email', 'Phone', 'Platform', 'Form'];
  const formColumnSet = new Set();
  const enriched = leads.map((l) => {
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
  return { rows: enriched, columns };
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
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  // Auto column widths (cap at 60 chars so giant fields don't blow it up).
  sheet['!cols'] = columns.map((col) => {
    const maxLen = rows.reduce(
      (acc, r) => Math.max(acc, String(r[col] ?? '').length, col.length),
      col.length
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Meta Leads');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(new Blob([out], { type: 'application/octet-stream' }), `meta-leads-${slugify(clientName)}-${stamp}.xlsx`);
  return true;
};

// ---------- PDF ----------
export const exportLeadsToPdf = (leads, metaAccount, clientName) => {
  if (!leads || leads.length === 0) return false;
  const { rows, columns } = buildRowsAndColumns(leads, metaAccount);

  // Landscape A3 — Meta lead forms can have many custom fields, so we need width.
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
    headStyles: { fillColor: [24, 119, 242], textColor: 255, fontStyle: 'bold' }, // META_BLUE
    alternateRowStyles: { fillColor: [247, 250, 253] },
    margin: { left: 30, right: 30 },
  });

  doc.save(`meta-leads-${slugify(clientName)}-${new Date().toISOString().slice(0, 10)}.pdf`);
  return true;
};
