/*
 * Import / export handlers for the /client-portal/leads TELECALLING
 * sheet. Kept in a separate file so the already-2500-LOC
 * metaController.js doesn't grow further.
 *
 * Endpoints (wired in routes/meta.js):
 *   POST /api/meta/client/:clientId/leads/import   (multipart, field=file)
 *   GET  /api/meta/client/:clientId/leads/export
 *
 * Both routes share the same client-scoping check as the rest of the
 * meta tree — the clientId in the URL is the authoritative filter,
 * and Meta-portal tokens carry a matching clientId they can't cross.
 *
 * Import strategy:
 *   - Parse the xlsx (services/leadXlsxService.js) → { rows, skipped }.
 *   - For each row:
 *       · If `contact` matches an existing lead for this client, UPDATE
 *         that lead with the imported values (last-write-wins per
 *         field). Preserves history + follow_ups[] from the DB (the
 *         imported sheet may not have them, and losing them would
 *         wipe telecaller work).
 *       · Otherwise INSERT a new lead.
 *   - Run runTelecallerAutomation on every row before save so history
 *     append, reminder auto-suggest, DARMANT flip apply to imports too.
 *   - Report per-row outcome so the UI can show a friendly summary.
 *
 * Export strategy:
 *   - Query every lead for the client.
 *   - Write via buildTelecallingWorkbook (26 headers exact-match).
 *   - Stream as an .xlsx download named
 *     `telecalling-<clientName>-<yyyy-mm-dd>.xlsx`.
 */

import mongoose from 'mongoose';
import multer from 'multer';
import Lead from '../models/Lead.js';
import Client from '../models/Client.js';
import { runTelecallerAutomation } from '../lib/telecallerAutomation.js';
import { parseTelecallingSheet, buildTelecallingWorkbook } from '../services/leadXlsxService.js';

// In-memory multer — the file is small (a few hundred rows tops) and
// we don't need disk persistence.
export const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB safety cap
  fileFilter: (_req, file, cb) => {
    const ok = /\.xlsx$/i.test(file.originalname) ||
               file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    cb(ok ? null : new Error('Please upload an .xlsx file.'), ok);
  },
});

// ─── Shared client-loader (same shape as metaController) ────────
// Duplicated deliberately — pulling `loadClientOr404` out of
// metaController.js and into a shared lib would ripple through ~15
// other controllers. When we do that refactor, this call site will
// switch in one line.
const loadClientOr404 = async (req, res) => {
  const { clientId } = req.params;
  if (!mongoose.isValidObjectId(clientId)) {
    res.status(400).json({ success: false, message: 'Invalid clientId' });
    return null;
  }
  if (req.clientId && String(req.clientId) !== String(clientId)) {
    res.status(403).json({ success: false, message: 'Portal token cannot access another client' });
    return null;
  }
  const client = await Client.findById(clientId);
  if (!client) {
    res.status(404).json({ success: false, message: 'Client not found' });
    return null;
  }
  return client;
};

// ─── POST import ──────────────────────────────────────────────────
export const importLeadsXlsx = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: 'No file uploaded (multipart field: file).' });
  }

  let parsed;
  try {
    parsed = await parseTelecallingSheet(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ success: false, message: `Could not parse workbook: ${err.message}` });
  }

  const summary = {
    parsedRows: parsed.rows.length,
    inserted: 0,
    updated: 0,
    dirtyFixes: 0,
    skipped: parsed.skipped.slice(),
    errors: [],
    sheetName: parsed.sheetName,
  };

  // Pre-fetch every existing lead for this client keyed by normalised
  // contact so we can O(1) look up matches without one query per row.
  const existing = await Lead.find({ client: client._id, contact: { $ne: '' } })
    .select('_id contact follow_ups appointment_date')
    .lean();
  const byContact = new Map();
  existing.forEach((l) => {
    if (l.contact) byContact.set(l.contact, l);
  });

  for (const { row, patch, dirty } of parsed.rows) {
    if (dirty.length) summary.dirtyFixes += dirty.length;
    try {
      const match = patch.contact ? byContact.get(patch.contact) : null;
      if (match) {
        // UPDATE — hydrate the doc, apply patch, run automation, save.
        const doc = await Lead.findById(match._id);
        if (!doc) throw new Error('Existing lead vanished between prefetch and update');
        const prevFollowUpsLength = doc.follow_ups?.length || 0;
        const prevAppointmentDate = doc.appointment_date;
        Object.entries(patch).forEach(([k, v]) => {
          if (k === 'follow_ups') {
            // Append the imported follow-up (if any) rather than replacing
            // the doc's array — the DB is the source of truth for history.
            if (Array.isArray(v) && v.length) {
              doc.follow_ups.push({
                number: (doc.follow_ups?.length || 0) + 1,
                date: v[0].date,
                call_label: v[0].call_label,
                remarks: v[0].remarks,
                connected: v[0].connected,
              });
            }
          } else if (v !== undefined && v !== null && v !== '') {
            doc[k] = v;
          }
        });
        runTelecallerAutomation(doc, {
          prevFollowUpsLength,
          prevAppointmentDate,
          reminderExplicitlySet: !!patch.reminder_date,
        });
        await doc.save();
        summary.updated += 1;
      } else {
        // INSERT
        const doc = new Lead({
          client: client._id,
          // Lead schema requires email — synthesise a placeholder if
          // the imported row didn't carry one. Consistent with the
          // create-manual-lead path.
          email: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@placeholder.invalid`,
          source: 'meta',
          platform: 'unknown',
          manual_source_type: 'walk_in',   // safe default for imported rows
          meta_created_time: patch.date || new Date(),
          ...patch,
        });
        runTelecallerAutomation(doc, {
          prevFollowUpsLength: 0,
          prevAppointmentDate: null,
          reminderExplicitlySet: !!patch.reminder_date,
        });
        await doc.save();
        // Keep the byContact map warm so the next duplicate in the
        // same file updates rather than E11000s.
        if (doc.contact) byContact.set(doc.contact, { _id: doc._id, contact: doc.contact });
        summary.inserted += 1;
      }
    } catch (err) {
      summary.errors.push({ row, message: err.message });
    }
  }

  res.json({ success: true, summary });
};

// ─── GET export ───────────────────────────────────────────────────
export const exportLeadsXlsx = async (req, res) => {
  const client = await loadClientOr404(req, res);
  if (!client) return;

  const leads = await Lead.find({ client: client._id })
    .sort({ date: -1, meta_created_time: -1, createdAt: -1 })
    .lean({ virtuals: true });

  const buffer = await buildTelecallingWorkbook(leads, { clientName: client.clientName });

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = String(client.clientName || 'client').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',
    `attachment; filename="telecalling-${safeName}-${stamp}.xlsx"`);
  res.send(Buffer.from(buffer));
};
