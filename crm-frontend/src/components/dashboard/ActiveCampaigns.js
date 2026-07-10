import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, InputBase, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell,
  FormControl, Select, MenuItem, Tabs, Tab,
  TablePagination, Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon, Clear as ClearIcon,
  Facebook as MetaIcon, Google as GoogleIcon,
  Campaign as CampaignIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtINR, fmtNum } from './theme';

// ─────────────────────────────────────────────────────────────────
// Active Campaigns — real-time campaign monitoring panel with two
// tabs (Meta and Google), each rendering an independent table with
// search, sort, status filter, sticky header, pagination, and
// row-click expand.
//
// Campaign row shape (both tabs share it, `type` field is objective
// on Meta, campaign-type on Google — the parent maps this):
//
//   {
//     id, name, clientName, platform: 'meta' | 'google',
//     type,               // Objective (Meta) or Campaign Type (Google)
//     status,             // 'active' | 'paused'
//     leads,              // Today's leads
//     spend,              // Today's spend
//     cpl,                // Today's CPL
//     budget,             // Campaign daily budget (may be null)
//     createdAt,          // ISO string
//     updatedAt,          // ISO string — Last Sync
//     lastLeadAt,         // ISO string — most recent lead time
//   }
// ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { key: 'created', label: 'Newest first', get: (c) => new Date(c.createdAt || 0).getTime(), reverse: true },
  { key: 'leads', label: "Today's leads · most", get: (c) => c.leads || 0, reverse: true },
  { key: 'spend', label: "Today's spend · highest", get: (c) => c.spend || 0, reverse: true },
  { key: 'cpl', label: 'CPL · lowest', get: (c) => (c.cpl > 0 ? c.cpl : Infinity), reverse: false },
];

const applySort = (rows, key) => {
  const opt = SORT_OPTIONS.find((s) => s.key === key) || SORT_OPTIONS[0];
  return rows.slice().sort((a, b) => {
    const va = opt.get(a);
    const vb = opt.get(b);
    return opt.reverse ? vb - va : va - vb;
  });
};

// Live-status pill used in the table.
const LiveStatusPill = ({ status, leads }) => {
  // 🟢 Live & receiving leads · 🟡 Live but no leads · 🔴 Paused
  const isLive = String(status || '').toLowerCase() !== 'paused';
  const receivingLeads = isLive && (leads || 0) > 0;
  const cfg = !isLive
    ? { color: '#EF4444', bg: '#FDECEE', label: 'Paused' }
    : receivingLeads
    ? { color: '#059669', bg: '#DFF6E7', label: 'Live · Receiving' }
    : { color: '#B7791F', bg: '#FEF2E0', label: 'Live · No leads' };
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 0.9, py: 0.25, borderRadius: 999,
      bgcolor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}40`,
    }}>
      <CircleIcon sx={{ fontSize: 8 }} />
      <Typography sx={{
        fontSize: '0.66rem', fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.3px',
      }}>
        {cfg.label}
      </Typography>
    </Box>
  );
};

const CampaignsTable = ({ campaigns, platform, tone, onCampaignClick }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('created');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Status is no longer filterable from the UI — the status dot in
  // the campaign column still tells you live/paused at a glance.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = campaigns
      .filter((c) => c.platform === platform)
      .filter((c) => {
        if (!q) return true;
        return (
          String(c.name || '').toLowerCase().includes(q)
          || String(c.clientName || '').toLowerCase().includes(q)
        );
      });
    return applySort(rows, sortKey);
  }, [campaigns, platform, search, sortKey]);

  React.useEffect(() => { setPage(0); }, [search, sortKey, platform]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const liveCount = filtered.filter((c) => String(c.status || '').toLowerCase() !== 'paused').length;
  const receivingCount = filtered.filter((c) => (c.leads || 0) > 0 && String(c.status || '').toLowerCase() !== 'paused').length;

  return (
    <Box>
      {/* Summary strip — three headline metrics for this platform */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.4 }}>
        <SummaryPill label="Live now" value={liveCount} color={PALETTE.healthy} />
        <SummaryPill
          label={platform === 'google' ? 'Receiving conversions' : 'Receiving leads'}
          value={receivingCount}
          color={tone}
        />
        <SummaryPill label="Total shown" value={filtered.length} color={PALETTE.navy} />
      </Box>

      {/* Filter row */}
      <Box sx={{
        display: 'flex', gap: 1, flexWrap: 'wrap',
        alignItems: 'center', mb: 1.4,
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          bgcolor: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
          borderRadius: 1.4, px: 1.1, height: 38, flex: 1, minWidth: 220,
        }}>
          <SearchIcon sx={{ fontSize: 16, color: PALETTE.inkFaint }} />
          <InputBase
            fullWidth
            placeholder={`Search ${platform === 'meta' ? 'Meta' : 'Google'} campaign or client…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ fontSize: '0.85rem', color: PALETTE.ink }}
          />
          {search && (
            <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.3, color: PALETTE.inkFaint }}>
              <ClearIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Box>

        <FormControl size="small" sx={{ minWidth: 190 }}>
          <Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            sx={{ bgcolor: PALETTE.surface, fontSize: '0.8rem', fontWeight: 700 }}
          >
            {SORT_OPTIONS
              // Google has no CPL column, so drop the CPL sort option
              // there — showing a sort key with no visible column to
              // interpret is a UX trap.
              .filter((s) => !(platform === 'google' && s.key === 'cpl'))
              .map((s) => {
                // Relabel "Today's leads" → "Today's conversions" on
                // the Google tab; the underlying field is the same.
                const label = platform === 'google' && s.key === 'leads'
                  ? "Today's conversions · most"
                  : s.label;
                return (
                  <MenuItem key={s.key} value={s.key} sx={{ fontSize: '0.85rem' }}>
                    Sort · {label}
                  </MenuItem>
                );
              })}
          </Select>
        </FormControl>
      </Box>

      {/* Table.
          Column set is minimal by design: Campaign · Client · Leads/Conv
          · Spend · CPL (Meta only). No expand / no per-row drill-in —
          the parent dashboard already links each client to its detail
          page. Keeping it flat makes the widget legible at a glance. */}
      {(() => {
        // Declarative column list — header + body stay in lock-step and
        // the Meta/Google split is one array-edit away.
        const columns = platform === 'meta'
          ? [
              { key: 'campaign', align: 'left',  header: 'Campaign' },
              { key: 'client',   align: 'left',  header: 'Client' },
              { key: 'leads',    align: 'right', header: "Today's Leads" },
              { key: 'spend',    align: 'right', header: "Today's Spend" },
              { key: 'cpl',      align: 'right', header: 'CPL' },
            ]
          : [
              { key: 'campaign',    align: 'left',  header: 'Campaign' },
              { key: 'client',      align: 'left',  header: 'Client' },
              { key: 'conversions', align: 'right', header: 'Conversions' },
              { key: 'spend',       align: 'right', header: "Today's Spend" },
            ];
        const colSpan = columns.length;
        return (
      <Box sx={{
        bgcolor: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
        borderRadius: 1.5, overflow: 'hidden',
      }}>
        {/* overflowX keeps a wider-than-cell table inside its own
            scroll container instead of blowing out the parent grid
            cell (which would drag the whole page into a horizontal
            scroll). */}
        <Box sx={{ maxHeight: 460, overflowY: 'auto', overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align} sx={{ whiteSpace: 'nowrap' }}>
                    {col.header || ''}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} sx={{ py: 5, textAlign: 'center', color: PALETTE.inkFaint }}>
                    No campaigns match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((c) => {
                  const dotColor = String(c.status).toLowerCase() === 'paused'
                    ? '#EF4444'
                    : (c.leads || 0) > 0 ? '#10B981' : '#F59E0B';
                  // Clicking anywhere on the row jumps to the client
                  // detail page. Keyboard users get the same
                  // affordance via Enter / Space.
                  const openClient = () => onCampaignClick?.(c);
                  return (
                    <TableRow
                      key={c.id}
                      hover
                      onClick={onCampaignClick ? openClient : undefined}
                      onKeyDown={onCampaignClick ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClient(); }
                      } : undefined}
                      tabIndex={onCampaignClick ? 0 : undefined}
                      role={onCampaignClick ? 'button' : undefined}
                      sx={{ cursor: onCampaignClick ? 'pointer' : 'default' }}
                    >
                      <TableCell sx={{ fontWeight: 700, color: PALETTE.ink }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                          {/* Small status dot — live receiving (green) /
                              live no-leads (amber) / paused (red). */}
                          <Tooltip title={String(c.status).toLowerCase() === 'paused' ? 'Paused' : (c.leads || 0) > 0 ? 'Live · Receiving leads' : 'Live · No leads yet'}>
                            <Box sx={{
                              width: 8, height: 8, borderRadius: '50%',
                              bgcolor: dotColor,
                              flexShrink: 0,
                            }} />
                          </Tooltip>
                          {c.name}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: PALETTE.inkMuted }}>{c.clientName || '—'}</TableCell>
                      {platform === 'meta' ? (
                        <>
                          <TableCell align="right" sx={{ color: PALETTE.healthy, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtNum(c.leads)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: PALETTE.navy, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtINR(c.spend)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: c.cpl > 0 ? PALETTE.warning : PALETTE.inkFaint, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {c.cpl > 0 ? fmtINR(c.cpl) : '—'}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          {/* Google conversions map from the same
                              `leads` field the parent populates from
                              totalConversions — no separate field. */}
                          <TableCell align="right" sx={{ color: PALETTE.healthy, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtNum(c.leads)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: PALETTE.navy, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtINR(c.spend)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 15, 25, 50]}
          sx={{ borderTop: `1px solid ${PALETTE.border}` }}
        />
      </Box>
        );
      })()}
    </Box>
  );
};

const SummaryPill = ({ label, value, color }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1,
    bgcolor: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
    borderRadius: 1.4, px: 1.2, py: 0.9,
    borderLeft: `3px solid ${color}`,
  }}>
    <Box>
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px', color: PALETTE.inkFaint, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{
        fontWeight: 900, fontSize: '1.1rem', color,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {value}
      </Typography>
    </Box>
  </Box>
);

// `platform` prop, when set to 'meta' or 'google', locks this
// widget to a single platform and hides the internal tab switcher.
// The parent Dashboard uses this so its global Meta/Google toggle
// is the single source of truth — two switchers stacked would be
// confusing. Left unset, the widget renders both tabs (the legacy
// standalone behaviour, still handy if this component is embedded
// somewhere without a global toggle).
const ActiveCampaigns = ({ campaigns, platform: forcedPlatform, onCampaignClick }) => {
  const [tab, setTab] = useState(0); // 0 = Meta, 1 = Google

  const metaCount = campaigns.filter((c) => c.platform === 'meta').length;
  const googleCount = campaigns.filter((c) => c.platform === 'google').length;

  // Resolve the platform to render + a matching brand tone for the
  // header chip / status dots. tone is the brand colour of that
  // platform (Meta blue / Google green) — used to accent the count
  // pill in the header.
  const activePlatform = forcedPlatform || (tab === 0 ? 'meta' : 'google');
  const activeTone = activePlatform === 'meta' ? '#1877F2' : '#34A853';
  const activeCount = activePlatform === 'meta' ? metaCount : googleCount;

  return (
    <Box sx={{
      bgcolor: PALETTE.surface,
      borderRadius: `${RADIUS.card}px`,
      border: `1px solid ${PALETTE.border}`,
      boxShadow: SHADOW.card,
      p: 2,
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 1.5, flexWrap: 'wrap', mb: 1.6,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            bgcolor: PALETTE.gold, color: PALETTE.navy,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 14px ${PALETTE.gold}44`,
          }}>
            <CampaignIcon />
          </Box>
          <Box>
            <Typography sx={{
              fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.2px',
              color: PALETTE.gold, textTransform: 'uppercase', lineHeight: 1,
            }}>
              Active Campaigns
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: PALETTE.ink, mt: 0.2 }}>
              Real-time monitoring
            </Typography>
          </Box>
        </Box>

        {/* When the platform is forced by the parent Dashboard, we
            show a compact platform badge here (Meta / Google + count)
            instead of the tabs — makes the current view unambiguous
            without duplicating the toggle. */}
        {forcedPlatform && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.8,
            bgcolor: `${activeTone}12`,
            border: `1px solid ${activeTone}33`,
            borderRadius: 999, px: 1.4, py: 0.6,
          }}>
            {activePlatform === 'meta'
              ? <MetaIcon sx={{ fontSize: 16, color: activeTone }} />
              : <GoogleIcon sx={{ fontSize: 16, color: activeTone }} />}
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: activeTone }}>
              {activePlatform === 'meta' ? 'Meta' : 'Google'}
            </Typography>
            <Chip
              size="small"
              label={activeCount}
              sx={{
                height: 20, fontSize: '0.66rem', fontWeight: 800,
                bgcolor: '#fff', color: activeTone,
                border: `1px solid ${activeTone}33`,
              }}
            />
          </Box>
        )}
      </Box>

      {/* Tabs — only rendered when the widget is running in its
          standalone mode (no forcedPlatform from the parent). */}
      {!forcedPlatform && (
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            borderBottom: `1px solid ${PALETTE.border}`,
            mb: 1.6,
            '& .MuiTabs-indicator': { backgroundColor: PALETTE.gold, height: 3, borderRadius: 3 },
          }}
        >
          <Tab
            label={(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <MetaIcon sx={{ fontSize: 16, color: tab === 0 ? '#1877F2' : PALETTE.inkFaint }} />
                Meta Campaigns
                <Chip
                  size="small"
                  label={metaCount}
                  sx={{
                    height: 20, fontSize: '0.66rem', fontWeight: 800,
                    bgcolor: tab === 0 ? '#1877F218' : `${PALETTE.inkFaint}18`,
                    color: tab === 0 ? '#1877F2' : PALETTE.inkFaint,
                  }}
                />
              </Box>
            )}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          />
          <Tab
            label={(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <GoogleIcon sx={{ fontSize: 16, color: tab === 1 ? '#34A853' : PALETTE.inkFaint }} />
                Google Campaigns
                <Chip
                  size="small"
                  label={googleCount}
                  sx={{
                    height: 20, fontSize: '0.66rem', fontWeight: 800,
                    bgcolor: tab === 1 ? '#34A85318' : `${PALETTE.inkFaint}18`,
                    color: tab === 1 ? '#34A853' : PALETTE.inkFaint,
                  }}
                />
              </Box>
            )}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          />
        </Tabs>
      )}

      {/* Table body — driven by the resolved active platform whether
          it came from the internal tab state or a forcedPlatform. */}
      <CampaignsTable
        campaigns={campaigns}
        platform={activePlatform}
        tone={activeTone}
        onCampaignClick={onCampaignClick}
      />
    </Box>
  );
};

export default ActiveCampaigns;
