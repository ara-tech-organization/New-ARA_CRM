import React, { useMemo, useState } from 'react';
import {
  Box, Dialog, DialogContent, Typography, IconButton,
  InputBase, Table, TableHead, TableBody, TableRow, TableCell,
  ToggleButtonGroup, ToggleButton, Chip, TablePagination,
  FormControl, Select, MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon, Search as SearchIcon, Clear as ClearIcon,
  Facebook as MetaIcon, Google as GoogleIcon,
  Layers as BothIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtINR } from './theme';

// Modern client-list modal.
//
// Columns:
//   Client · Platform · Meta Balance · Google Balance · Campaigns
//   · Last Sync · Status
//
// Platform-conditional balances: a Meta-only row shows an em-dash in
// the Google column and vice versa. Both-platform rows fill both.
//
// Controls: search by name, filter by platform, sort by balance,
// sticky header, pagination.

const StatusPill = ({ status }) => {
  const isActive = String(status || '').toLowerCase() === 'active';
  const label = isActive ? 'Active' : (status || 'Inactive');
  const color = isActive ? PALETTE.healthy : PALETTE.inkFaint;
  return (
    <Chip
      size="small"
      label={label}
      sx={{
        height: 20, fontSize: '0.66rem', fontWeight: 700,
        bgcolor: `${color}18`, color,
        border: `1px solid ${color}45`,
        textTransform: 'capitalize',
      }}
    />
  );
};

const PlatformBadge = ({ platform }) => {
  const cfg = {
    meta: { icon: <MetaIcon sx={{ fontSize: 11 }} />, color: '#1877F2', label: 'Meta' },
    google: { icon: <GoogleIcon sx={{ fontSize: 11 }} />, color: '#34A853', label: 'Google' },
    both: { icon: <BothIcon sx={{ fontSize: 11 }} />, color: PALETTE.navy, label: 'Both' },
  }[platform] || { icon: null, color: PALETTE.inkFaint, label: '—' };
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.4,
      px: 0.8, py: 0.2, borderRadius: 0.8,
      bgcolor: `${cfg.color}12`, color: cfg.color,
      border: `1px solid ${cfg.color}45`,
    }}>
      {cfg.icon}
      <Typography sx={{
        fontSize: '0.68rem', fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.3px',
      }}>
        {cfg.label}
      </Typography>
    </Box>
  );
};

const BalanceCell = ({ balance, applicable }) => {
  if (!applicable) {
    return <Typography sx={{ fontSize: '0.8rem', color: PALETTE.inkFaint }}>—</Typography>;
  }
  const tone = balance == null
    ? PALETTE.inkFaint
    : balance < 1000 ? PALETTE.critical
    : balance < 2000 ? PALETTE.warning
    : PALETTE.healthy;
  if (balance == null) {
    return <Typography sx={{ fontSize: '0.8rem', color: PALETTE.inkFaint, fontStyle: 'italic' }}>Not synced</Typography>;
  }
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone }} />
      <Typography sx={{
        fontWeight: 800, fontSize: '0.82rem', color: tone,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtINR(balance)}
      </Typography>
    </Box>
  );
};

const SORT_OPTIONS = [
  { key: 'name', label: 'Client name (A→Z)' },
  { key: 'metaHigh', label: 'Meta balance · highest' },
  { key: 'metaLow', label: 'Meta balance · lowest' },
];

const applySort = (rows, key) => {
  const arr = rows.slice();
  const numOrInf = (v) => (v == null ? Infinity : v);
  const numOrNeg = (v) => (v == null ? -Infinity : v);
  switch (key) {
    case 'metaHigh': return arr.sort((a, b) => numOrNeg(b.metaBalance) - numOrNeg(a.metaBalance));
    case 'metaLow': return arr.sort((a, b) => numOrInf(a.metaBalance) - numOrInf(b.metaBalance));
    default: return arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }
};

const ClientListModal = ({ open, onClose, rows, defaultFilter = 'all' }) => {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState(defaultFilter); // all|meta|google|both
  const [sortKey, setSortKey] = useState('name');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // When the modal is re-opened with a different platform default
  // (e.g. clicking "Meta" then "Google"), snap the filter to match.
  React.useEffect(() => {
    if (open) {
      setPlatform(defaultFilter);
      setPage(0);
    }
  }, [open, defaultFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Filter semantics — Meta and Google are UNION filters (they show
    // every client where that platform is linked, including clients on
    // both platforms). Only "Both" is exclusive to clients on both.
    // Rationale: when someone clicks "Meta connected" in the summary
    // card they expect to see every Meta-linked client, not just the
    // Meta-only slice.
    const matchesPlatform = (r) => {
      if (platform === 'all') return true;
      if (platform === 'meta') return r.platform === 'meta' || r.platform === 'both';
      if (platform === 'google') return r.platform === 'google' || r.platform === 'both';
      if (platform === 'both') return r.platform === 'both';
      return true;
    };
    const f = rows.filter((r) => {
      if (q && !String(r.name || '').toLowerCase().includes(q)) return false;
      return matchesPlatform(r);
    });
    return applySort(f, sortKey);
  }, [rows, search, platform, sortKey]);

  // Reset page whenever the visible list shrinks below the current page.
  React.useEffect(() => {
    if (page * rowsPerPage >= filtered.length) setPage(0);
  }, [filtered.length, page, rowsPerPage]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  // Union counts to match the filter semantics above. Meta = every
  // Meta-linked client (meta-only + both), Google = every Google-linked
  // client. Both stays exclusive.
  const platformCounts = useMemo(() => ({
    all: rows.length,
    meta: rows.filter((r) => r.platform === 'meta' || r.platform === 'both').length,
    google: rows.filter((r) => r.platform === 'google' || r.platform === 'both').length,
    both: rows.filter((r) => r.platform === 'both').length,
  }), [rows]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: `${RADIUS.card}px`, boxShadow: SHADOW.cardHover, overflow: 'hidden' } } }}
    >
      {/* Compact header — the modal is denser than a full page so it
          doesn't waste vertical space on branding. */}
      <Box sx={{
        px: 2.5, py: 1.6,
        background: `linear-gradient(135deg, ${PALETTE.navy} 0%, ${PALETTE.navyDeep} 100%)`,
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.4px',
            color: PALETTE.gold, textTransform: 'uppercase', lineHeight: 1, mb: 0.3,
          }}>
            Connected Client Directory
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.2 }}>
            {rows.length} clients · {filtered.length} matching
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: '#fff', bgcolor: 'rgba(255,255,255,0.12)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 2, bgcolor: PALETTE.ground }}>
        {/* Controls row */}
        <Box sx={{
          display: 'flex', flexWrap: 'wrap', gap: 1,
          alignItems: 'center', mb: 1.4,
        }}>
          {/* Search */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            bgcolor: PALETTE.surface, border: `1px solid ${PALETTE.border}`,
            borderRadius: 1.4, px: 1.1, height: 38, flex: 1, minWidth: 220,
          }}>
            <SearchIcon sx={{ fontSize: 16, color: PALETTE.inkFaint }} />
            <InputBase
              fullWidth
              placeholder="Search client name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ fontSize: '0.86rem', color: PALETTE.ink }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.3, color: PALETTE.inkFaint }}>
                <ClearIcon sx={{ fontSize: 15 }} />
              </IconButton>
            )}
          </Box>

          {/* Platform filter */}
          <ToggleButtonGroup
            value={platform}
            exclusive
            size="small"
            onChange={(_, v) => v && setPlatform(v)}
            sx={{
              bgcolor: PALETTE.surface,
              '& .MuiToggleButton-root': {
                border: `1px solid ${PALETTE.border}`,
                color: PALETTE.inkMuted,
                textTransform: 'none',
                fontWeight: 700, fontSize: '0.74rem',
                px: 1.3, py: 0.4,
                '&.Mui-selected': {
                  bgcolor: PALETTE.navy, color: '#fff',
                  '&:hover': { bgcolor: PALETTE.navy },
                },
              },
            }}
          >
            <ToggleButton value="all">
              All <Box component="span" sx={{ ml: 0.6, opacity: 0.7 }}>{platformCounts.all}</Box>
            </ToggleButton>
            <ToggleButton value="meta">
              <MetaIcon sx={{ fontSize: 13, mr: 0.4 }} />
              Meta <Box component="span" sx={{ ml: 0.5, opacity: 0.7 }}>{platformCounts.meta}</Box>
            </ToggleButton>
            <ToggleButton value="google">
              <GoogleIcon sx={{ fontSize: 13, mr: 0.4 }} />
              Google <Box component="span" sx={{ ml: 0.5, opacity: 0.7 }}>{platformCounts.google}</Box>
            </ToggleButton>
            <ToggleButton value="both">
              <BothIcon sx={{ fontSize: 13, mr: 0.4 }} />
              Both <Box component="span" sx={{ ml: 0.5, opacity: 0.7 }}>{platformCounts.both}</Box>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Sort */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              sx={{
                bgcolor: PALETTE.surface,
                fontSize: '0.8rem', fontWeight: 700, color: PALETTE.ink,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: PALETTE.border },
              }}
            >
              {SORT_OPTIONS.map((s) => (
                <MenuItem key={s.key} value={s.key} sx={{ fontSize: '0.85rem' }}>
                  Sort · {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Table */}
        <Box sx={{
          bgcolor: PALETTE.surface,
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 1.5,
          overflow: 'hidden',
        }}>
          <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Client', 'Platform', 'Meta Balance', 'Status'].map((h) => (
                    <TableCell key={h} sx={{
                      bgcolor: PALETTE.ground,
                      color: PALETTE.inkMuted,
                      fontWeight: 800, fontSize: '0.64rem',
                      textTransform: 'uppercase', letterSpacing: '0.6px',
                      borderBottom: `2px solid ${PALETTE.border}`,
                    }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 4, textAlign: 'center', color: PALETTE.inkFaint }}>
                      No clients match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell sx={{ fontWeight: 700, color: PALETTE.ink, fontSize: '0.82rem' }}>
                        {r.name}
                      </TableCell>
                      <TableCell>
                        <PlatformBadge platform={r.platform} />
                      </TableCell>
                      <TableCell>
                        <BalanceCell
                          balance={r.metaBalance}
                          applicable={r.platform === 'meta' || r.platform === 'both'}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))
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
            sx={{
              borderTop: `1px solid ${PALETTE.border}`,
              '.MuiTablePagination-toolbar': { minHeight: 44 },
              '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                fontSize: '0.76rem', color: PALETTE.inkMuted,
              },
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ClientListModal;
