import React from 'react';
import {
  Box, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
} from '@mui/material';

const META_BLUE = '#1877F2';
const INSTAGRAM_PINK = '#E4405F';

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

const fmtReceived = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

// Read-only Excel-style table view of Meta leads. Used by the inline
// sections of the admin (ClientAdDetails) and client-portal dashboards.
//
// Form-question answers render as a stacked label/value list inside a
// single "Form Responses" cell — keeps the table narrow regardless of
// how many questions a form has.
//
// Props:
//   leads:        array of Lead objects from /api/meta/client/:id/analytics
//   metaAccount:  the meta_account block (used for the Meta Account name)
//   maxHeight:    optional override for the scroll container height
const MetaLeadsTable = ({ leads = [], metaAccount, maxHeight }) => {
  if (leads.length === 0) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">No leads to display.</Typography>
      </Box>
    );
  }

  const headerCellSx = {
    fontWeight: 700,
    bgcolor: `${META_BLUE}10`,
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    whiteSpace: 'nowrap',
  };

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: maxHeight || 'calc(100vh - 200px)', borderRadius: 0 }}>
      <Table size="small" stickyHeader sx={{ '& td, & th': { borderRight: '1px solid', borderColor: 'divider' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headerCellSx, width: 36 }}>#</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 110 }}>Received</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 130 }}>Meta Account</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 140 }}>Name</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 280 }}>Email</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 130 }}>Phone</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 90 }}>Platform</TableCell>
            <TableCell sx={{ ...headerCellSx, width: 160 }}>Form</TableCell>
            <TableCell sx={{ ...headerCellSx, minWidth: 520 }}>Form Responses</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {leads.map((l, idx) => {
            const isIG = String(l.platform).toLowerCase() === 'instagram';
            const platformColor = isIG ? INSTAGRAM_PINK : META_BLUE;
            const entries = extractFormEntries(l.raw_field_data);
            return (
              <TableRow key={l._id || idx} hover sx={{ verticalAlign: 'top', '&:nth-of-type(even)': { bgcolor: 'grey.50' } }}>
                <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: 'monospace' }}>{idx + 1}</TableCell>
                <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtReceived(l.meta_created_time || l.createdAt)}</TableCell>
                <TableCell sx={{ fontSize: '0.78rem' }}>{metaAccount?.name || '—'}</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{l.name || '—'}</TableCell>
                <TableCell sx={{ fontSize: '0.78rem', minWidth: 280, wordBreak: 'break-all' }}>{l.email || '—'}</TableCell>
                <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{l.phone || '—'}</TableCell>
                <TableCell>
                  {l.platform ? (
                    <Chip
                      label={l.platform}
                      size="small"
                      sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, textTransform: 'capitalize', bgcolor: `${platformColor}15`, color: platformColor }}
                    />
                  ) : '—'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.78rem' }}>{l.meta_form_name || '—'}</TableCell>
                <TableCell sx={{ minWidth: 520, py: 1.2 }}>
                  {entries.length === 0 ? (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>—</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                      {entries.map((e, i) => (
                        <Box
                          key={i}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '220px 1fr',
                            columnGap: 2,
                            alignItems: 'baseline',
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: 'text.secondary',
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                            }}
                          >
                            {e.label}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              color: 'text.primary',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                            }}
                          >
                            {e.value || '—'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default MetaLeadsTable;
