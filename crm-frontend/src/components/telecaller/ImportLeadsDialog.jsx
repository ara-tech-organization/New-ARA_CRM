import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, LinearProgress, Alert, Divider, Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

/*
 * ImportLeadsDialog — file-picker → POST → summary panel.
 *
 * Server enforces the "headers on row 2, data from row 3" convention;
 * we just tell the user about it up-front so they know what to
 * upload. Multipart field name is `file` — must match the multer
 * config in leadTelecallerController.js.
 *
 * The summary we render is the shape returned by importLeadsXlsx:
 *   { parsedRows, inserted, updated, dirtyFixes, skipped[], errors[], sheetName }
 * Kept intentionally friendly — the operator won't debug JSON.
 */

const ImportLeadsDialog = ({ open, onClose, clientApi, clientId, onDone }) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  const reset = () => {
    setSelectedFile(null);
    setError(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (uploading) return;    // don't let the user close mid-upload
    reset();
    onClose?.();
  };

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setError('Please select an .xlsx file (Excel workbook).');
      return;
    }
    setSelectedFile(f);
    setError(null);
    setSummary(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      // axios auto-sets multipart boundary — do NOT force
      // Content-Type ourselves.
      const { data } = await clientApi.post(
        `/meta/client/${clientId}/leads/import`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setSummary(data?.summary || null);
      // Parent refreshes the sheet + toasts a short confirmation.
      onDone?.(data?.summary || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Import leads · xlsx</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Upload the existing TELECALLING sheet. Expected layout:
          <strong> title on row 1, headers on row 2, data from row 3.</strong>{' '}
          Phone numbers get normalised to 10 digits, dropdown values are cleaned
          (<code>HOT </code> → <code>HOT</code>, <code>DARMONT</code> → <code>DARMANT</code>, etc.),
          and rows matching an existing CONTACT are updated in place — no duplicates get created.
        </Typography>

        {/* File picker */}
        <Box
          onClick={() => !uploading && fileInputRef.current?.click()}
          sx={{
            border: '2px dashed #CBD5E1', borderRadius: 2, py: 3, textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            bgcolor: '#F8FAFC',
            '&:hover': { bgcolor: uploading ? '#F8FAFC' : '#EEF2FF', borderColor: '#1F3966' },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 40, color: '#1F3966', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
            {selectedFile ? selectedFile.name : 'Click to choose a .xlsx file'}
          </Typography>
          {selectedFile && (
            <Typography variant="caption" color="text.secondary">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </Typography>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFilePick}
            hidden
          />
        </Box>

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary">
              Parsing and upserting rows…
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}

        {summary && (
          <Box sx={{ mt: 2 }}>
            <Divider textAlign="left" sx={{ mb: 1 }}>Summary</Divider>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
              <Chip
                icon={<CheckCircleIcon />}
                label={`${summary.inserted} inserted`}
                sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700 }}
              />
              <Chip
                icon={<CheckCircleIcon />}
                label={`${summary.updated} updated`}
                sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }}
              />
              {summary.dirtyFixes > 0 && (
                <Chip
                  icon={<WarningAmberIcon />}
                  label={`${summary.dirtyFixes} value fixes`}
                  sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 700 }}
                />
              )}
              {summary.skipped?.length > 0 && (
                <Chip
                  icon={<ErrorOutlineIcon />}
                  label={`${summary.skipped.length} skipped`}
                  sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700 }}
                />
              )}
              {summary.errors?.length > 0 && (
                <Chip
                  icon={<ErrorOutlineIcon />}
                  label={`${summary.errors.length} errors`}
                  sx={{ bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700 }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Parsed from sheet <code>{summary.sheetName}</code> · {summary.parsedRows} data rows.
            </Typography>

            {(summary.skipped?.length > 0 || summary.errors?.length > 0) && (
              <Box sx={{ mt: 1.5, maxHeight: 200, overflow: 'auto', bgcolor: '#F8FAFC', borderRadius: 1, p: 1 }}>
                {summary.skipped?.map((s) => (
                  <Typography key={`s-${s.row}`} variant="caption" display="block" color="text.secondary">
                    Row {s.row} skipped — {s.reason}
                  </Typography>
                ))}
                {summary.errors?.map((e) => (
                  <Typography key={`e-${e.row}`} variant="caption" display="block" sx={{ color: '#B91C1C' }}>
                    Row {e.row} error — {e.message}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          {summary ? 'Close' : 'Cancel'}
        </Button>
        {!summary && (
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            sx={{ bgcolor: '#1F3966', '&:hover': { bgcolor: '#15294D' } }}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportLeadsDialog;
