import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Chip, Tooltip, Avatar, IconButton,
  InputBase, FormControl, Select, MenuItem,
} from '@mui/material';
import {
  Facebook as MetaIcon,
  Google as GoogleIcon,
  CheckCircleOutline as ConnectedIcon,
  ErrorOutline as StaleIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Insights as InsightsIcon,
  ViewAgenda as CardsIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtINR, fmtNum, balanceTier, TIER_META, timeAgo } from './theme';

// ─────────────────────────────────────────────────────────────────
// Client Overview — Client Intelligence Dashboard.
// Each client renders as a compact information-dense card that
// answers the PMM's core questions at a glance:
//   · Is this client performing well today?
//   · Are they burning spend without leads?
//   · Is the balance about to auto-pause the ads?
//   · How many campaigns are actually live?
// Cards expand to reveal per-campaign detail, recent activity, and
// quick actions (open report / refresh sync).
// ─────────────────────────────────────────────────────────────────

// ─── Performance classifier ──────────────────────────────────────
// Rough CPL threshold — beyond this, the client is spending but
// the cost-per-lead is bad enough to flag as "average" instead of
// "well". Meta lead-gen typically settles ₹200-500; Google search
// ₹500-1500 in our accounts. Adjust per platform for a fair read.
const cplThreshold = (platform) => (platform === 'google' ? 1500 : 500);

function classifyPerformance(c) {
  const spent = (c.spend || 0) > 0;
  const gotLeads = (c.leads || 0) > 0;
  const criticalBalance = c.balance != null && c.balance < 1000;
  if ((spent && !gotLeads) || criticalBalance) {
    return { key: 'attention', label: 'Needs Attention', color: '#B91C1C', bg: '#FEE2E2', dot: '#EF4444', edge: '#EF4444' };
  }
  if (gotLeads && spent) {
    const highCpl = c.cpl > 0 && c.cpl > cplThreshold(c.platform);
    return highCpl
      ? { key: 'avg',  label: 'Average',          color: '#92400E', bg: '#FEF3C7', dot: '#F59E0B', edge: '#F59E0B' }
      : { key: 'good', label: 'Performing Well',  color: '#15803D', bg: '#DCFCE7', dot: '#22C55E', edge: '#22C55E' };
  }
  return { key: 'idle', label: 'Idle · No spend today', color: '#475569', bg: '#F1F5F9', dot: '#94A3B8', edge: '#CBD5E1' };
}

// ─── Sort options ────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'leads',      label: 'Leads · most first',        get: (c) => c.leads || 0, dir: 'desc' },
  { key: 'spend',      label: 'Spend · highest',           get: (c) => c.spend || 0, dir: 'desc' },
  { key: 'cpl',        label: 'CPL · most efficient',      get: (c) => (c.cpl > 0 ? c.cpl : Infinity), dir: 'asc' },
  { key: 'balance',    label: 'Balance · lowest first',    get: (c) => (c.balance != null ? c.balance : Infinity), dir: 'asc' },
  { key: 'campaigns',  label: 'Active campaigns · most',   get: (c) => c.campaigns || 0, dir: 'desc' },
  { key: 'lastSync',   label: 'Recently synced',           get: (c) => new Date(c.lastSync || 0).getTime(), dir: 'desc' },
];

function sortRows(rows, sortKey) {
  const opt = SORT_OPTIONS.find((s) => s.key === sortKey) || SORT_OPTIONS[0];
  return rows.slice().sort((a, b) => {
    const va = opt.get(a); const vb = opt.get(b);
    return opt.dir === 'desc' ? vb - va : va - vb;
  });
}

// ─── Small helpers ───────────────────────────────────────────────
function initialsOf(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  return ((first[0] || '') + (parts.length > 1 ? (last[0] || '') : '')).toUpperCase() || '?';
}

// Connection freshness — stale after 6h, disconnected if never synced.
// Used to power the small "Connected / Stale / Never synced" pill.
function connectionState(lastSync) {
  if (!lastSync) return { key: 'never', label: 'Never synced', color: '#94A3B8' };
  const ageMin = (Date.now() - new Date(lastSync).getTime()) / 60000;
  if (ageMin > 6 * 60) return { key: 'stale', label: 'Stale', color: '#F59E0B' };
  return { key: 'ok', label: 'Connected', color: '#22C55E' };
}

// ─── Presentational bits ─────────────────────────────────────────
const PerformanceChip = ({ perf }) => (
  <Chip
    label={perf.label}
    size="small"
    icon={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: perf.dot, ml: 0.9 }} />}
    sx={{
      bgcolor: perf.bg, color: perf.color,
      fontWeight: 800, fontSize: '0.68rem',
      height: 22, letterSpacing: '0.02em',
      '& .MuiChip-icon': { color: perf.dot, order: 0, mr: 0.5 },
    }}
  />
);

const ConnectionBadge = ({ lastSync }) => {
  const s = connectionState(lastSync);
  const Icon = s.key === 'ok' ? ConnectedIcon : StaleIcon;
  return (
    <Tooltip arrow title={lastSync ? `Last sync ${timeAgo(lastSync)}` : 'No sync recorded'}>
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4,
        color: s.color, fontSize: '0.66rem', fontWeight: 700,
      }}>
        <Icon sx={{ fontSize: 12 }} />
        {s.label}
      </Box>
    </Tooltip>
  );
};

// Numeric cell for the list row — right-aligned tabular figures
// so column values line up down the page (Linear/Notion-style).
const NumCell = ({ value, tone, sub }) => (
  <Box sx={{ minWidth: 0, textAlign: 'right' }}>
    <Typography sx={{
      fontWeight: 800, fontSize: '0.9rem', color: tone || PALETTE.ink,
      fontVariantNumeric: 'tabular-nums', lineHeight: 1.15,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {value}
    </Typography>
    {sub && (
      <Typography sx={{
        fontSize: '0.62rem', color: PALETTE.inkFaint, mt: 0.05,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {sub}
      </Typography>
    )}
  </Box>
);

// ─── Row-layout column grid ──────────────────────────────────────
// Fixed template shared by the header + every row so numeric
// columns line up down the page (like a proper data table).
//   perf-edge | identity | Spend | Leads/Conv | CPL | Balance | Status
const ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '4px minmax(0, 1fr) 90px 90px 80px 100px 130px',
    md: '4px minmax(0, 1.6fr) 110px 110px 90px 120px 140px',
  },
  columnGap: 1.2,
  alignItems: 'center',
};

const HeaderCell = ({ children, align }) => (
  <Typography sx={{
    fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.9px',
    color: PALETTE.inkFaint, textTransform: 'uppercase',
    textAlign: align || 'left',
  }}>
    {children}
  </Typography>
);

const ListHeader = ({ platformLabel }) => (
  <Box sx={{
    ...ROW_GRID,
    px: 1.4, py: 0.9,
    bgcolor: PALETTE.ground,
    borderBottom: `1px solid ${PALETTE.border}`,
  }}>
    <Box />{/* spacer for the perf-edge column */}
    <HeaderCell>Client</HeaderCell>
    <HeaderCell align="right">Spend</HeaderCell>
    <HeaderCell align="right">{platformLabel}</HeaderCell>
    <HeaderCell align="right">CPL</HeaderCell>
    <HeaderCell align="right">Balance</HeaderCell>
    <HeaderCell>Status</HeaderCell>
  </Box>
);

// ─── Client row ──────────────────────────────────────────────────
// One horizontal row per client. Left edge is colour-coded by the
// client's performance classification so a scrollable list gives an
// instant read of who's healthy vs who needs attention. Clicking
// anywhere on the row jumps to the client's detail page.
const ClientRow = ({ client, onOpenClient, striped }) => {
  const tier = balanceTier(client.balance);
  const tierColor = tier ? TIER_META[tier].color : PALETTE.inkFaint;
  const tierLabel = tier ? TIER_META[tier].label : 'Unknown';
  const perf = client.perf;
  const platformLabel = client.platform === 'both' ? 'Meta + Google'
    : client.platform === 'meta' ? 'Meta' : 'Google';
  const leadsLabel = client.platform === 'google' ? 'conv' : 'leads';

  const openClient = () => onOpenClient?.(client);

  return (
    <Box sx={{
      borderBottom: `1px solid ${PALETTE.border}`,
      transition: 'background 0.15s ease',
      '&:hover': { bgcolor: `${perf.dot}0F` },
      bgcolor: striped ? PALETTE.ground : PALETTE.surface,
      '&:last-of-type': { borderBottom: 'none' },
    }}>
      <Box
        onClick={openClient}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClient(); }
        }}
        sx={{
          ...ROW_GRID,
          px: 1.4, py: 1.1,
          cursor: 'pointer',
          outline: 'none',
          '&:focus-visible': { boxShadow: `inset 0 0 0 2px ${PALETTE.navy}55` },
        }}
      >
        {/* Left perf-edge — thin coloured bar for at-a-glance state */}
        <Box sx={{
          width: 4, height: 40, borderRadius: 2, bgcolor: perf.edge,
          justifySelf: 'start',
        }} />

        {/* Identity — avatar + name + platform / connection subtitle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
          <Avatar
            sx={{
              width: 34, height: 34,
              bgcolor: `${perf.dot}20`, color: perf.color,
              fontWeight: 800, fontSize: '0.78rem',
              border: `1px solid ${perf.dot}33`,
              flexShrink: 0,
            }}
          >
            {initialsOf(client.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{
              fontWeight: 700, fontSize: '0.88rem', color: PALETTE.ink, lineHeight: 1.2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {client.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.15 }}>
              {client.platform === 'meta'
                ? <MetaIcon sx={{ fontSize: 11, color: '#1877F2' }} />
                : client.platform === 'google'
                ? <GoogleIcon sx={{ fontSize: 11, color: '#34A853' }} />
                : (
                  <>
                    <MetaIcon sx={{ fontSize: 11, color: '#1877F2' }} />
                    <GoogleIcon sx={{ fontSize: 11, color: '#34A853' }} />
                  </>
                )}
              <Typography sx={{
                fontSize: '0.62rem', fontWeight: 700, color: PALETTE.inkMuted,
                letterSpacing: '0.2px',
              }}>
                {platformLabel}
              </Typography>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: PALETTE.inkFaint }} />
              <ConnectionBadge lastSync={client.lastSync} />
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: PALETTE.inkFaint }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: PALETTE.inkMuted }}>
                {fmtNum(client.campaigns)} {client.campaigns === 1 ? 'campaign' : 'campaigns'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Numeric columns */}
        <NumCell value={fmtINR(client.spend)} tone={PALETTE.navy} />
        <NumCell
          value={fmtNum(client.leads)}
          sub={leadsLabel}
          tone={PALETTE.healthy}
        />
        <NumCell
          value={client.cpl > 0 ? fmtINR(client.cpl) : '—'}
          tone={client.cpl > 0 ? PALETTE.warning : PALETTE.inkFaint}
        />
        <NumCell
          value={client.balance != null ? fmtINR(client.balance) : '—'}
          sub={tier ? tierLabel.toLowerCase() : null}
          tone={tierColor}
        />

        {/* Status pill */}
        <Box>
          <PerformanceChip perf={perf} />
        </Box>
      </Box>
    </Box>
  );
};

// ─── Filter / search / sort toolbar ──────────────────────────────
const FilterBar = ({
  search, setSearch,
  perfFilter, setPerfFilter,
  balanceFilter, setBalanceFilter,
  sortKey, setSortKey,
  matched, total,
}) => (
  <Box sx={{
    display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center',
    bgcolor: PALETTE.surface,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 1.5,
    p: 1, mb: 1.4,
  }}>
    {/* Search */}
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.6,
      bgcolor: PALETTE.ground, border: `1px solid ${PALETTE.border}`,
      borderRadius: 1.2, px: 1.2, height: 36, flex: 1, minWidth: 220,
    }}>
      <SearchIcon sx={{ fontSize: 16, color: PALETTE.inkFaint }} />
      <InputBase
        fullWidth
        placeholder="Search client name…"
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

    <FormControl size="small" sx={{ minWidth: 170 }}>
      <Select
        value={perfFilter}
        onChange={(e) => setPerfFilter(e.target.value)}
        sx={{ bgcolor: PALETTE.surface, fontSize: '0.8rem', fontWeight: 700 }}
      >
        <MenuItem value="all" sx={{ fontSize: '0.85rem' }}>Performance · All</MenuItem>
        <MenuItem value="good" sx={{ fontSize: '0.85rem' }}>Performing Well</MenuItem>
        <MenuItem value="avg" sx={{ fontSize: '0.85rem' }}>Average</MenuItem>
        <MenuItem value="attention" sx={{ fontSize: '0.85rem' }}>Needs Attention</MenuItem>
        <MenuItem value="idle" sx={{ fontSize: '0.85rem' }}>Idle · No spend</MenuItem>
      </Select>
    </FormControl>

    <FormControl size="small" sx={{ minWidth: 170 }}>
      <Select
        value={balanceFilter}
        onChange={(e) => setBalanceFilter(e.target.value)}
        sx={{ bgcolor: PALETTE.surface, fontSize: '0.8rem', fontWeight: 700 }}
      >
        <MenuItem value="all" sx={{ fontSize: '0.85rem' }}>Balance · All</MenuItem>
        <MenuItem value="healthy" sx={{ fontSize: '0.85rem' }}>Healthy</MenuItem>
        <MenuItem value="warning" sx={{ fontSize: '0.85rem' }}>Low balance</MenuItem>
        <MenuItem value="critical" sx={{ fontSize: '0.85rem' }}>Critical</MenuItem>
      </Select>
    </FormControl>

    <FormControl size="small" sx={{ minWidth: 210 }}>
      <Select
        value={sortKey}
        onChange={(e) => setSortKey(e.target.value)}
        sx={{ bgcolor: PALETTE.surface, fontSize: '0.8rem', fontWeight: 700 }}
      >
        {SORT_OPTIONS.map((s) => (
          <MenuItem key={s.key} value={s.key} sx={{ fontSize: '0.85rem' }}>
            Sort · {s.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>

    <Typography sx={{
      fontSize: '0.72rem', fontWeight: 700, color: PALETTE.inkMuted,
      ml: 'auto', px: 0.8,
    }}>
      {matched} of {total}
    </Typography>
  </Box>
);

// ─── Main component ──────────────────────────────────────────────
// Clicking a row navigates to the client detail page via
// onOpenClient — there's no inline expand any more.
const ClientOverviewCards = ({ clients, onOpenClient }) => {
  const [search, setSearch] = useState('');
  const [perfFilter, setPerfFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [sortKey, setSortKey] = useState('leads');

  // Attach performance classification once so the filter + row
  // reuse the same object (avoids running the classifier twice per
  // client per render).
  const enriched = useMemo(() => (
    clients.map((c) => ({
      ...c,
      perf: classifyPerformance(c),
      tier: balanceTier(c.balance),
    }))
  ), [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = enriched.filter((c) => {
      if (q && !String(c.name || '').toLowerCase().includes(q)) return false;
      if (perfFilter !== 'all' && c.perf.key !== perfFilter) return false;
      if (balanceFilter !== 'all' && c.tier !== balanceFilter) return false;
      return true;
    });
    return sortRows(rows, sortKey);
  }, [enriched, search, perfFilter, balanceFilter, sortKey]);

  if (clients.length === 0) {
    return (
      <Box sx={{
        bgcolor: PALETTE.surface,
        borderRadius: `${RADIUS.card}px`,
        border: `1px dashed ${PALETTE.border}`,
        p: 4, textAlign: 'center',
      }}>
        <CardsIcon sx={{ fontSize: 32, color: PALETTE.inkFaint, mb: 1 }} />
        <Typography sx={{ color: PALETTE.inkMuted, fontSize: '0.9rem', fontWeight: 600 }}>
          No clients to show for this platform.
        </Typography>
        <Typography sx={{ color: PALETTE.inkFaint, fontSize: '0.78rem', mt: 0.3 }}>
          Connect a client to see their intelligence card here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <FilterBar
        search={search} setSearch={setSearch}
        perfFilter={perfFilter} setPerfFilter={setPerfFilter}
        balanceFilter={balanceFilter} setBalanceFilter={setBalanceFilter}
        sortKey={sortKey} setSortKey={setSortKey}
        matched={filtered.length} total={clients.length}
      />

      {filtered.length === 0 ? (
        <Box sx={{
          bgcolor: PALETTE.surface,
          borderRadius: `${RADIUS.card}px`,
          border: `1px dashed ${PALETTE.border}`,
          p: 4, textAlign: 'center',
        }}>
          <InsightsIcon sx={{ fontSize: 30, color: PALETTE.inkFaint, mb: 0.6 }} />
          <Typography sx={{ color: PALETTE.inkMuted, fontSize: '0.86rem', fontWeight: 700 }}>
            No clients match the current filters.
          </Typography>
          <Typography sx={{ color: PALETTE.inkFaint, fontSize: '0.76rem', mt: 0.3 }}>
            Clear a filter or adjust your search.
          </Typography>
        </Box>
      ) : (
        <Box sx={{
          bgcolor: PALETTE.surface,
          borderRadius: `${RADIUS.card}px`,
          border: `1px solid ${PALETTE.border}`,
          boxShadow: SHADOW.soft,
          overflow: 'hidden',
        }}>
          {/* Column-label row — pinned above the list. `leads / conv`
              label mirrors the majority platform of the visible set;
              on Meta view says "Leads", on Google says "Conv". */}
          <ListHeader
            platformLabel={
              filtered.every((c) => c.platform === 'google') ? 'Conv.' : 'Leads / Conv.'
            }
          />
          {filtered.map((c, i) => (
            <ClientRow
              key={c.id}
              client={c}
              onOpenClient={onOpenClient}
              striped={i % 2 === 1}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ClientOverviewCards;
