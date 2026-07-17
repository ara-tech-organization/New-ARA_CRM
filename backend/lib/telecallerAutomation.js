/*
 * Telecaller-sheet automation rules — one source of truth for the
 * behaviour described in the /client-portal/leads spec.
 *
 * Consumed by:
 *   - controllers/metaController.js  → updateClientLead + createClientLead
 *     (runs BEFORE `lead.save()` so the persisted document already has
 *     stamped dates, appended history, and any DARMANT flip in place)
 *   - services/leadXlsx.js           → import path (round 3)
 *     (so an imported row gets the same auto-history + reminder rules
 *     as a row typed in the UI — no divergence)
 *   - scripts/migrateLeadTelecallerFields.js (indirectly, via the
 *     shared `rebuildHistory` shape)
 *
 * Design rule: NO mongoose calls in this file. Every function takes a
 * plain "lead-like" object (either a hydrated Mongoose doc or a POJO)
 * and mutates it in place. That way the import path can build a batch
 * of lead objects, run automation on each, and only then hand them to
 * Mongoose to insert.
 */

import {
  NOT_CONNECTED_LABELS,
  RESPONSE_LABEL_ENUM,
  CALL_LABEL_ENUM,
  STATUS_SHEET_ENUM,
} from '../models/Lead.js';

// ─── Small helpers ───────────────────────────────────────────────
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isSameCalendarDay = (a, b) => {
  if (!a || !b) return false;
  const x = new Date(a); const y = new Date(b);
  return x.getFullYear() === y.getFullYear()
    && x.getMonth() === y.getMonth()
    && x.getDate() === y.getDate();
};
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

// ─── Rule 1 · REMINDER DATE auto-suggest ─────────────────────────
// The user can always overwrite the suggestion; we only fill when the
// user hasn't manually set a reminder in the same save cycle.
//
// Rules (from spec):
//   BUSY               → today + 1 hour (same day)
//   RNA                → today, other half of the day (AM ↔ PM)
//   SWITCH OFF / NOT CONNECTED / DISCONNECTED → tomorrow
//   Response HOT       → +2 days
//   Response WARM      → +7 days
//   Response COLD      → +30 days
//   APPOINTMENT BOOKED → day BEFORE APPOINTMENT DATE (confirmation call)
//   CLOSED / INVALID / DUPLICATE / WRONG NUMBER → clear reminder
//
// Precedence when multiple labels change in one save: the appointment-
// booked-with-date rule wins (it's the most concrete), then the
// response bucket, then the call-label bucket. Terminal clears win
// over everything.
export const suggestReminderDate = ({
  callLabel = '',
  responseLabel = '',
  appointmentDate = null,
  now = new Date(),
} = {}) => {
  const cl = String(callLabel || '').toUpperCase().trim();
  const rl = String(responseLabel || '').toUpperCase().trim();

  // Terminal / negative labels — reminder is meaningless.
  if (['CLOSED', 'INVALID', 'DUPLICATE', 'WRONG NUMBER'].includes(cl)) return null;
  if (['CLOSED', 'INVALID'].includes(rl)) return null;

  // Confirmation call the day before the booked appointment.
  if (rl === 'APPOINTMENT BOOKED' && appointmentDate) {
    return addDays(new Date(appointmentDate), -1);
  }

  // Response-label buckets (long-tail reminders).
  if (rl === 'HOT')  return addDays(now, 2);
  if (rl === 'WARM') return addDays(now, 7);
  if (rl === 'COLD') return addDays(now, 30);

  // Call-label buckets (short-tail retries).
  if (cl === 'BUSY') {
    const t = new Date(now); t.setHours(t.getHours() + 1, 0, 0, 0);
    return t;
  }
  if (cl === 'RNA') {
    // Other half of today — AM slot → 15:00, PM slot → 10:00 tomorrow.
    const t = new Date(now);
    if (t.getHours() < 12) { t.setHours(15, 0, 0, 0); return t; }
    const tomorrow = addDays(t, 1); tomorrow.setHours(10, 0, 0, 0); return tomorrow;
  }
  if (['SWITCH OFF', 'NOT CONNECTED', 'DISCONNECTED'].includes(cl)) {
    const t = addDays(now, 1); t.setHours(10, 0, 0, 0); return t;
  }

  // No matching rule → return undefined so the caller knows not to
  // overwrite an existing reminder date the user typed.
  return undefined;
};

// ─── Rule 2 · History auto-append ─────────────────────────────────
// Format: `Attempt {n}: {YYYY-MM-DD} {LABEL} — {remarks}`
// Connected labels go to `history_connected` (col 21), everything
// else to `history_not_connected` (col 20). We prepend `\n` only when
// the target column already has content, so the first line doesn't
// start with a stray newline.
export const historyLineFor = (followUp) => {
  const n = followUp?.number || 1;
  const label = String(followUp?.call_label || '').toUpperCase();
  const remarks = String(followUp?.remarks || '').trim();
  return `Attempt ${n}: ${ymd(followUp?.date)} ${label} — ${remarks}`.trim();
};
export const appendHistoryLine = (lead, followUp) => {
  if (!followUp?.call_label) return;
  const line = historyLineFor(followUp);
  const isConnected = followUp.connected || String(followUp.call_label).toUpperCase() === 'CONNECTED';
  const key = isConnected ? 'history_connected' : 'history_not_connected';
  const current = String(lead[key] || '');
  lead[key] = current ? `${current}\n${line}` : line;
};

// Rebuild both history columns from scratch (used by the migration
// script and any code path that replaces the full follow_ups array).
// Kept co-located with `appendHistoryLine` so the format stays in sync.
export const rebuildHistoryFromFollowUps = (followUps = []) => {
  const connected = [];
  const notConnected = [];
  (followUps || []).forEach((f, i) => {
    if (!f?.call_label) return;
    const line = historyLineFor({ ...f, number: f.number || i + 1 });
    const isConnected = f.connected || String(f.call_label).toUpperCase() === 'CONNECTED';
    (isConnected ? connected : notConnected).push(line);
  });
  return {
    history_not_connected: notConnected.join('\n'),
    history_connected:     connected.join('\n'),
  };
};

// ─── Rule 3 · Attempt counter + DARMANT flag ─────────────────────
// FOLLOW-UP NUMBER is a virtual over `follow_ups.length` — no field
// to increment. This function only flips DARMANT when the tail of
// follow_ups[] is >= 5 not-connected attempts AND no CONNECTED entry
// exists in the whole history.
export const checkDarmantThreshold = (lead) => {
  const ups = Array.isArray(lead.follow_ups) ? lead.follow_ups : [];
  if (ups.length < 5) return false;
  const hasConnected = ups.some((f) =>
    f?.connected || String(f?.call_label || '').toUpperCase() === 'CONNECTED'
  );
  if (hasConnected) return false;
  const last5 = ups.slice(-5);
  const allNotConnected = last5.every((f) =>
    NOT_CONNECTED_LABELS.has(String(f?.call_label || '').toUpperCase())
  );
  return allNotConnected;
};

// ─── Rule 5 · Auto-stamps ─────────────────────────────────────────
// FIRST CALL DATE (col 8): stamped the first time CALL LABEL is set.
// APPOINTMENT BOOKED DATE (col 15): stamped when APPOINTMENT DATE is
// first filled.
export const applyAutoStamps = (lead, { now = new Date() } = {}) => {
  if (lead.first_call_label && !lead.first_call_date) {
    lead.first_call_date = now;
  }
  if (lead.appointment_date && !lead.appointment_booked_date) {
    lead.appointment_booked_date = now;
  }
};

// ─── Public entry — call BEFORE lead.save() ──────────────────────
// `prevFollowUpsLength` is the # of follow-ups the lead had BEFORE
// the current save. Anything past that index is treated as newly-
// logged and gets appended to history.
export const runTelecallerAutomation = (lead, opts = {}) => {
  const {
    prevFollowUpsLength = 0,
    prevAppointmentDate = null,
    reminderExplicitlySet = false,
    now = new Date(),
  } = opts;

  // 1) Auto-stamp first_call_date + appointment_booked_date.
  // Only overwrite booked_date when appointment_date genuinely
  // changed (avoids re-stamping on unrelated saves).
  if (lead.first_call_label && !lead.first_call_date) {
    lead.first_call_date = now;
  }
  const apptChanged = !isSameCalendarDay(lead.appointment_date, prevAppointmentDate);
  if (lead.appointment_date && apptChanged && !lead.appointment_booked_date) {
    lead.appointment_booked_date = now;
  }

  // 2) Append history for every follow-up newly added since the last
  // save. Guards against re-appending on an idempotent PUT that
  // resends the whole follow_ups array unchanged.
  if (Array.isArray(lead.follow_ups) && lead.follow_ups.length > prevFollowUpsLength) {
    const newOnes = lead.follow_ups.slice(prevFollowUpsLength);
    newOnes.forEach((f, idx) => {
      if (!f) return;
      // Backfill missing number so history reads correctly.
      f.number = f.number || (prevFollowUpsLength + idx + 1);
      appendHistoryLine(lead, f);
    });
  }

  // 3) Reminder auto-suggest — only when the user didn't manually
  // set one in the same save. Look at the LAST follow-up call label
  // for follow-up rows; fall back to first_call_label + response_label
  // for the initial call.
  if (!reminderExplicitlySet) {
    const lastUp = Array.isArray(lead.follow_ups) && lead.follow_ups.length
      ? lead.follow_ups[lead.follow_ups.length - 1]
      : null;
    const callLabel = lastUp?.call_label || lead.first_call_label || '';
    const suggestion = suggestReminderDate({
      callLabel,
      responseLabel: lead.response_label,
      appointmentDate: lead.appointment_date,
      now,
    });
    // null → explicit clear (CLOSED/INVALID/etc.)
    // undefined → no rule matched, leave existing value alone
    if (suggestion === null) {
      lead.next_followup_date = null;
    } else if (suggestion instanceof Date) {
      lead.next_followup_date = suggestion;
    }
  }

  // 4) DARMANT threshold — flip status_sheet only if we haven't
  // already flagged (so un-flagging in the UI sticks).
  if (!lead.darmant_flagged && checkDarmantThreshold(lead)) {
    lead.status_sheet = 'DARMANT';
    lead.darmant_flagged = true;
  }

  return lead;
};

// Small enum-membership check used by the controller when validating
// incoming PATCH fields. Rejects out-of-enum values with a nice error
// instead of leaning on Mongoose's schema-time validation (which
// throws mid-save and loses field-level detail).
export const enumOk = {
  callLabel:        (v) => v == null || v === '' || CALL_LABEL_ENUM.includes(v),
  responseLabel:    (v) => v == null || v === '' || RESPONSE_LABEL_ENUM.includes(v),
  statusSheet:      (v) => v == null || v === '' || STATUS_SHEET_ENUM.includes(v),
};
