import React from 'react';
import {
  Box, TextField, MenuItem, InputAdornment, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import {
  SOURCE_OPTIONS, HAIR_OR_SKIN_OPTIONS, STATUS_SHEET_OPTIONS,
} from '../../constants/telecallerSheet';

/*
 * TelecallerFilterBar — narrows the sheet by SOURCE / HAIR-SKIN /
 * TELECALLER / STATUS + a free-text search (name or contact).
 *
 * Fully controlled — parent owns the filter state so it can also
 * compose with the QueueChips bucket filter.
 *
 * The TELECALLER dropdown pulls its option list from the leads
 * themselves (distinct telecaller_name values) so the sheet doesn't
 * need a separate Settings collection for a v1 3-5-user clinic.
 */

const CommonSelectSx = {
  minWidth: 130,
  '& .MuiInputBase-root': { height: 34, fontSize: '0.78rem' },
  '& .MuiInputLabel-root': { fontSize: '0.75rem' },
};

const TelecallerFilterBar = ({
  filters = { source: '', hair_or_skin: '', telecaller: '', status: '', search: '' },
  onChange,           // (patch) => void   — merges into filters
  telecallerOptions = [],
}) => {
  const set = (k) => (e) => onChange?.({ ...filters, [k]: e.target.value });

  return (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
      py: 1, px: 1.4, bgcolor: '#F8FAFC',
      border: '1px solid #E2E8F0', borderRadius: 1.5,
    }}>
      <TextField
        size="small" placeholder="Search name or phone…"
        value={filters.search}
        onChange={set('search')}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16, color: '#64748B' }} />
            </InputAdornment>
          ),
          endAdornment: filters.search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onChange?.({ ...filters, search: '' })}>
                <ClearIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </InputAdornment>
          ) : null,
          sx: { height: 34, fontSize: '0.78rem' },
        }}
        sx={{ flex: 1, minWidth: 220 }}
      />

      <TextField
        select size="small" label="Source"
        value={filters.source}
        onChange={set('source')}
        sx={CommonSelectSx}
      >
        <MenuItem value="">All sources</MenuItem>
        {SOURCE_OPTIONS.filter(Boolean).map((o) =>
          <MenuItem key={o} value={o} sx={{ fontSize: '0.78rem' }}>{o}</MenuItem>
        )}
      </TextField>

      <TextField
        select size="small" label="Hair / Skin"
        value={filters.hair_or_skin}
        onChange={set('hair_or_skin')}
        sx={{ ...CommonSelectSx, minWidth: 110 }}
      >
        <MenuItem value="">Both</MenuItem>
        {HAIR_OR_SKIN_OPTIONS.filter(Boolean).map((o) =>
          <MenuItem key={o} value={o} sx={{ fontSize: '0.78rem' }}>{o}</MenuItem>
        )}
      </TextField>

      <TextField
        select size="small" label="Telecaller"
        value={filters.telecaller}
        onChange={set('telecaller')}
        sx={CommonSelectSx}
      >
        <MenuItem value="">All telecallers</MenuItem>
        {telecallerOptions.map((o) =>
          <MenuItem key={o} value={o} sx={{ fontSize: '0.78rem' }}>{o}</MenuItem>
        )}
      </TextField>

      <TextField
        select size="small" label="Status"
        value={filters.status}
        onChange={set('status')}
        sx={CommonSelectSx}
      >
        <MenuItem value="">All statuses</MenuItem>
        {STATUS_SHEET_OPTIONS.filter(Boolean).map((o) =>
          <MenuItem key={o} value={o} sx={{ fontSize: '0.78rem' }}>{o}</MenuItem>
        )}
      </TextField>
    </Box>
  );
};

// Client-side filter — parent applies this to `leads` before feeding
// the sheet. Kept as a pure function alongside the component so unit
// tests + import paths can reuse the same logic.
export const applyFilters = (leads, filters) => {
  const q = String(filters.search || '').trim().toLowerCase();
  return leads.filter((l) => {
    if (filters.source && l.source_sheet !== filters.source) return false;
    if (filters.hair_or_skin && l.hair_or_skin !== filters.hair_or_skin) return false;
    if (filters.telecaller && l.telecaller_name !== filters.telecaller) return false;
    if (filters.status && l.status_sheet !== filters.status) return false;
    if (q) {
      const name = String(l.name || '').toLowerCase();
      const contact = String(l.contact || l.phone || '').toLowerCase();
      if (!name.includes(q) && !contact.includes(q)) return false;
    }
    return true;
  });
};

export default TelecallerFilterBar;
