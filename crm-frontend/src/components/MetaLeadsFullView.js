import React, { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogTitle, IconButton, Box, Button, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon, FileDownload as FileDownloadIcon, PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { exportLeadsToExcel, exportLeadsToPdf } from '../utils/metaLeadsExport';

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

const fmtReceived = (fetchedAt) => {
  if (!fetchedAt) return '—';
  try {
    return new Date(fetchedAt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const MetaLeadsFullView = ({ open, onClose, leads = [], metaAccount, clientName, loading = false }) => {
  // Build the union of every form-field key across all leads so the table
  // has a stable column for each field (even if some leads don't fill it).
  const { rowEntries, formColumns } = useMemo(() => {
    const allKeys = new Set();
    const rows = leads.map((l) => {
      const entries = extractFormEntries(l.raw_field_data);
      const map = {};
      entries.forEach((e) => {
        allKeys.add(e.label);
        map[e.label] = e.value;
      });
      return { lead: l, formMap: map };
    });
    return { rowEntries: rows, formColumns: Array.from(allKeys) };
  }, [leads]);

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle sx={{ bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Meta Leads — Full View
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {clientName || 'Client'} · {leads.length} lead{leads.length === 1 ? '' : 's'}
              {metaAccount?.name ? ` · ${metaAccount.name}` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon sx={{ fontSize: 16 }} />}
              onClick={() => exportLeadsToExcel(leads, metaAccount, clientName)}
              sx={{ borderColor: '#10b981', color: '#10b981', '&:hover': { borderColor: '#0e9b6f', bgcolor: '#10b98110' } }}
            >
              Excel
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PdfIcon sx={{ fontSize: 16 }} />}
              onClick={() => exportLeadsToPdf(leads, metaAccount, clientName)}
              sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#dc2626', bgcolor: '#ef444410' } }}
            >
              PDF
            </Button>
            <IconButton onClick={onClose} size="small" sx={{ ml: 1 }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: 'grey.50' }}>
        {loading ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: META_BLUE }} />
            <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading leads…</Typography>
          </Box>
        ) : leads.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No leads to display.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 90px)', borderRadius: 0 }}>
            <Table size="small" stickyHeader sx={{ '& td, & th': { borderRight: '1px solid', borderColor: 'divider' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>Received</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>Meta Account</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>Platform</TableCell>
                  <TableCell sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3 }}>Form</TableCell>
                  {formColumns.map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 700, bgcolor: `${META_BLUE}10`, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap', minWidth: 160 }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rowEntries.map(({ lead: l, formMap }, idx) => {
                  const isIG = String(l.platform).toLowerCase() === 'instagram';
                  const platformColor = isIG ? INSTAGRAM_PINK : META_BLUE;
                  return (
                    <TableRow key={l._id || idx} hover sx={{ '&:nth-of-type(even)': { bgcolor: 'grey.50' } }}>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: 'monospace' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{fmtReceived(metaAccount?.fetched_at)}</TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{metaAccount?.name || '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{l.name || '—'}</TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{l.email || '—'}</TableCell>
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
                      {formColumns.map((col) => (
                        <TableCell
                          key={col}
                          sx={{ fontSize: '0.78rem', minWidth: 160, maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}
                        >
                          {formMap[col] != null && formMap[col] !== '' ? formMap[col] : '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MetaLeadsFullView;
