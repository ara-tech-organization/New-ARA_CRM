// Frontend mirror of backend/models/Lead.js enum constants.
// KEEP IN LOCKSTEP with the backend — if you add a value here, add it
// there too, otherwise the schema-level validator will reject writes
// the dropdown allowed.
//
// Consumed by:
//   - components/telecaller/TelecallerSheet.jsx  (dropdown OPTIONS)
//   - components/telecaller/TelecallerFilterBar.jsx (filter dropdowns)
//   - components/telecaller/QueueChips.jsx (bucket definitions)

export const SOURCE_OPTIONS = [
  '', 'WHATS APP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE LEAD', 'JUSTDIAL',
  'WALK-IN', 'REFFERAL', 'PHYSICAL MARKETING',
  'INCALL GOOGLE', 'INCALL FB', 'INCALL INSTA', 'INCALL SELF',
];

export const CALL_LABEL_OPTIONS = [
  '', 'CONNECTED', 'INVALID', 'BUSY', 'SWITCH OFF', 'WRONG NUMBER',
  'RNA', 'DUPLICATE', 'DISCONNECTED', 'NOT CONNECTED',
];

export const RESPONSE_LABEL_OPTIONS = [
  '', 'HOT', 'WARM', 'COLD', 'DARMANT', 'CLOSED',
  'APPOINTMENT BOOKED', 'REPEAT', 'INVALID',
];

export const APPOINTMENT_STATUS_OPTIONS = [
  '', 'APPOINTMENT BOOKED', 'APPOINTMENT BOOKED - VISITED',
  'APPOINTMENT BOOKED - NOT VISITED', 'APPOINTMENT RESCHEDULED',
];

export const FOLLOWUP_CALL_LABEL_OPTIONS = [
  '', 'CONNECTED', 'BUSY', 'SWITCH OFF', 'RNA',
  'DISCONNECTED', 'NOT CONNECTED',
];

export const STATUS_SHEET_OPTIONS = [
  '', 'HOT', 'WARM', 'COLD', 'DARMANT', 'CLOSED', 'Follow-up',
];

export const HAIR_OR_SKIN_OPTIONS = ['', 'HAIR', 'SKIN'];

// FOLLOW-UP NUMBER dropdown (col 16) — 1..20 as the sheet defines,
// though the underlying counter has no cap.
export const FOLLOWUP_NUMBER_OPTIONS = Array.from(
  { length: 20 },
  (_, i) => `FOLLOW-UP ${i + 1}`
);

// ─── Status chip colours ─────────────────────────────────────────
// Feeds the STATUS column pill (col 22) in the sheet + the queue
// chips. Kept in one place so the palette stays consistent across
// both surfaces.
export const STATUS_CHIP_STYLES = {
  HOT:       { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
  WARM:      { bg: '#FEF3C7', color: '#B45309', border: '#FCD34D' },
  COLD:      { bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' },
  CLOSED:    { bg: '#E2E8F0', color: '#475569', border: '#CBD5E1' },
  DARMANT:   { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  'Follow-up': { bg: '#E0E7FF', color: '#3730A3', border: '#A5B4FC' },
  '':        { bg: 'transparent', color: '#94A3B8', border: '#E2E8F0' },
};

// ─── Not-connected call labels ────────────────────────────────────
// Mirrors backend/models/Lead.js NOT_CONNECTED_LABELS. Used by the
// Retry queue chip and (client-side hint only) the reminder-suggest
// preview. Authoritative rules live server-side in telecallerAutomation.js.
export const NOT_CONNECTED_LABELS = new Set([
  'BUSY', 'SWITCH OFF', 'RNA', 'DISCONNECTED', 'NOT CONNECTED',
]);
