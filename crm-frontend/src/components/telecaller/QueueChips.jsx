import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { NOT_CONNECTED_LABELS } from '../../constants/telecallerSheet';

/*
 * QueueChips — the 5 priority chips above the TelecallerSheet.
 *
 * Buckets (spec order — priority left-to-right):
 *   1. Due Today   — reminder_date ≤ today AND status_sheet ∉ {CLOSED, DARMANT}
 *                    (overdue rows tinted red inside the sheet already; the
 *                     chip shows the count and click-filters the grid)
 *   2. Fresh       — first_call_date is null (green tint in sheet)
 *   3. Retry       — LAST call attempt is BUSY / RNA / SWITCH OFF / NOT CONNECTED / DISCONNECTED
 *   4. Follow-up   — status_sheet ∈ {Follow-up, HOT, WARM}
 *   5. All Leads   — unfiltered
 *
 * Counts derived client-side from the full leads[] page — no extra
 * API call. Selecting a chip drives the parent's filter state so the
 * grid re-renders with the narrowed set.
 */

// Bucket definitions — kept in one place so both the count and the
// filter-apply function stay in sync.
export const QUEUE_BUCKETS = [
  { key: 'due',       label: 'Due Today',   tone: '#DC2626', bg: '#FEE2E2' },
  { key: 'fresh',     label: 'Fresh',       tone: '#16A34A', bg: '#DCFCE7' },
  { key: 'retry',     label: 'Retry',       tone: '#B45309', bg: '#FEF3C7' },
  { key: 'followup',  label: 'Follow-up',   tone: '#3730A3', bg: '#E0E7FF' },
  { key: 'all',       label: 'All Leads',   tone: '#0F172A', bg: '#E2E8F0' },
];

const isEndOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

// Exported so the parent page + FilterBar can compose narrowing.
// A single lead is fed in; returns the set of bucket keys it matches.
export const matchBucket = (lead, endOfToday = isEndOfToday()) => {
  const buckets = new Set(['all']);
  const status = String(lead.status_sheet || '').trim();
  const terminal = status === 'CLOSED' || status === 'DARMANT';

  const reminder = lead.next_followup_date ? new Date(lead.next_followup_date) : null;
  if (reminder && reminder <= endOfToday && !terminal) buckets.add('due');

  if (!lead.first_call_date) buckets.add('fresh');

  const lastFu = Array.isArray(lead.follow_ups) && lead.follow_ups.length
    ? lead.follow_ups[lead.follow_ups.length - 1]
    : null;
  const lastLabel = String(lastFu?.call_label || lead.first_call_label || '').toUpperCase();
  if (NOT_CONNECTED_LABELS.has(lastLabel)) buckets.add('retry');

  if (['Follow-up', 'HOT', 'WARM'].includes(status)) buckets.add('followup');

  return buckets;
};

const QueueChips = ({ leads = [], activeBucket = 'due', onSelect }) => {
  // Precompute count per bucket in a single pass so we don't loop the
  // leads[] N times.
  const counts = useMemo(() => {
    const eod = isEndOfToday();
    const tally = { due: 0, fresh: 0, retry: 0, followup: 0, all: leads.length };
    for (const l of leads) {
      const m = matchBucket(l, eod);
      if (m.has('due'))      tally.due      += 1;
      if (m.has('fresh'))    tally.fresh    += 1;
      if (m.has('retry'))    tally.retry    += 1;
      if (m.has('followup')) tally.followup += 1;
    }
    return tally;
  }, [leads]);

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {QUEUE_BUCKETS.map((b) => {
        const isActive = activeBucket === b.key;
        return (
          <Box
            key={b.key}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(b.key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(b.key); } }}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.8,
              px: 1.2, py: 0.6, borderRadius: 999,
              cursor: 'pointer', userSelect: 'none',
              bgcolor: isActive ? b.tone : b.bg,
              color: isActive ? '#fff' : b.tone,
              border: `1px solid ${b.tone}44`,
              fontSize: '0.78rem', fontWeight: 700,
              transition: 'all 0.15s ease',
              '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${b.tone}33` },
              '&:focus-visible': { outline: `2px solid ${b.tone}`, outlineOffset: 2 },
            }}
          >
            <span>{b.label}</span>
            <Box sx={{
              minWidth: 22, height: 20, px: 0.6, borderRadius: 999,
              bgcolor: isActive ? 'rgba(255,255,255,0.24)' : '#fff',
              color: isActive ? '#fff' : b.tone,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 800,
            }}>
              {counts[b.key]}
            </Box>
          </Box>
        );
      })}
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: '0.72rem', color: '#64748B', alignSelf: 'center' }}>
        Priority order: Due → Fresh → Retry → Follow-up → All
      </Typography>
    </Box>
  );
};

export default QueueChips;
