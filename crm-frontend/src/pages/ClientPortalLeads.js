import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Card, CardContent, Typography, Button, Avatar,
  CircularProgress, Alert, LinearProgress, Snackbar,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  UploadFile as UploadFileIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import TelecallerSheet from '../components/telecaller/TelecallerSheet';
import QueueChips, { matchBucket } from '../components/telecaller/QueueChips';
import TelecallerFilterBar, { applyFilters } from '../components/telecaller/TelecallerFilterBar';
import ImportLeadsDialog from '../components/telecaller/ImportLeadsDialog';

/*
 * Client portal Leads page. Retrofitted Jul 2026 into an Excel-style
 * telecaller sheet — spec at project doc "GROHAIR - LEAD SHEET-TNJ-2025".
 *
 * Data model:
 *   GET  /api/meta/client/:id/leads         → full history (no date filter)
 *   POST /api/meta/client/:id/leads         → add row (create)
 *   PUT  /api/meta/client/:id/leads/:id     → auto-save single cell
 *   DEL  /api/meta/client/:id/leads/:id     → delete row
 *
 * State:
 *   leads[]            — server-owned truth, refreshed via fetchLeads
 *   bucket             — active queue chip (default 'due')
 *   filters            — SOURCE / HAIR-SKIN / TELECALLER / STATUS / search
 *   snack              — one-off toast for save errors + confirmations
 *
 * TELECALLER NAME defaults to the logged-in portal user's name (per
 * spec: reuse existing auth context, no separate picker).
 */

const NAVY = '#1F3966';
const NAVY_DEEP = '#15294D';
const GROUND = '#F8FAFC';

const API_URL = process.env.REACT_APP_API_URL
  || 'https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api';

const ClientPortalLeads = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [clientData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('clientData')); } catch { return null; }
  });
  const [portalUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('clientPortalUser')); } catch { return null; }
  });
  const token = localStorage.getItem('clientToken');
  const telecallerName = portalUser?.name || '';

  // ─── Fetch state ────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── Sheet filters ──────────────────────────────────────────────
  const [bucket, setBucket] = useState(location.state?.filterPreset || 'due');
  const [filters, setFilters] = useState({
    source: '', hair_or_skin: '', telecaller: '', status: '', search: '',
  });

  // ─── Toast state (for save errors etc.) ─────────────────────────
  const [snack, setSnack] = useState({ open: false, severity: 'error', message: '' });
  const notify = useCallback((message, severity = 'error') => {
    setSnack({ open: true, message, severity });
  }, []);

  // ─── Axios instance — same 401-grace pattern as the rest of the
  // portal so a token expiry redirects cleanly to /client-login.
  const clientApi = useMemo(() => {
    const REDIRECT_GRACE_MS = 800;
    let pendingTimer = null;
    const cancelPending = () => { if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; } };
    const instance = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });
    instance.interceptors.request.use((config) => {
      const t = localStorage.getItem('clientToken');
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    instance.interceptors.response.use((r) => { cancelPending(); return r; }, (err) => {
      if (err.response?.status === 401) {
        const msg = (err.response?.data?.message || err.response?.data?.error || '').toLowerCase();
        const isTokenError =
          msg.includes('token') || msg.includes('jwt') || msg.includes('expired') ||
          msg.includes('not authorized') || msg.includes('unauthorized') ||
          msg.includes('account is deactivated') || msg.includes('portal user not found') ||
          msg.includes('portal access disabled') || msg.includes('login again');
        if (isTokenError && !pendingTimer) {
          pendingTimer = setTimeout(() => {
            pendingTimer = null;
            localStorage.removeItem('clientToken');
            localStorage.removeItem('clientData');
            localStorage.removeItem('clientPortalUser');
            window.location.replace('/client-login');
          }, REDIRECT_GRACE_MS);
        }
      }
      return Promise.reject(err);
    });
    return instance;
  }, []);

  useEffect(() => { if (!token) navigate('/client-login'); }, [token, navigate]);

  // ─── Full-history fetch ─────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    const clientId = clientData?._id;
    if (!clientId) return;
    setLoading(true); setError(null);
    try {
      const res = await clientApi.get(`/meta/client/${clientId}/leads`);
      setLeads(res.data?.leads || []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch leads');
    } finally { setLoading(false); }
  }, [clientApi, clientData]);

  useEffect(() => { if (token) fetchLeads(); }, [fetchLeads, token]);

  // ─── CRUD hooks handed down to the sheet ────────────────────────
  const handleSaveLead = useCallback(async (leadId, payload) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired.');
    const { data } = await clientApi.put(`/meta/client/${clientId}/leads/${leadId}`, payload);
    const updated = data?.lead;
    if (updated) setLeads((prev) => prev.map((l) => (l._id === leadId ? { ...l, ...updated } : l)));
    return updated;
  }, [clientApi, clientData]);

  const handleAddLead = useCallback(async (payload) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired.');
    const { data } = await clientApi.post(`/meta/client/${clientId}/leads`, payload);
    const created = data?.lead;
    if (created) setLeads((prev) => [created, ...prev]);
    return created;
  }, [clientApi, clientData]);

  const handleDeleteLead = useCallback(async (leadId) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired.');
    await clientApi.delete(`/meta/client/${clientId}/leads/${leadId}`);
    setLeads((prev) => prev.filter((l) => l._id !== leadId));
  }, [clientApi, clientData]);

  // ─── xlsx import / export ───────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Export uses the same axios instance so the client token rides
  // along with the request. `responseType: 'blob'` because the
  // response is a binary xlsx.
  const handleExport = useCallback(async () => {
    const clientId = clientData?._id;
    if (!clientId) return;
    setExporting(true);
    try {
      const res = await clientApi.get(`/meta/client/${clientId}/leads/export`, {
        responseType: 'blob',
      });
      // Trigger download from the returned blob.
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Prefer the server-provided filename when present in the header.
      const disp = res.headers?.['content-disposition'] || '';
      const m = /filename="([^"]+)"/.exec(disp);
      a.download = m ? m[1] : `telecalling-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('Export complete', 'success');
    } catch (err) {
      notify(err?.response?.data?.message || err?.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }, [clientApi, clientData, notify]);

  const handleImportDone = useCallback((summary) => {
    if (!summary) return;
    const parts = [];
    if (summary.inserted) parts.push(`${summary.inserted} inserted`);
    if (summary.updated)  parts.push(`${summary.updated} updated`);
    if (summary.dirtyFixes) parts.push(`${summary.dirtyFixes} value fixes`);
    if (summary.skipped?.length) parts.push(`${summary.skipped.length} skipped`);
    if (summary.errors?.length)  parts.push(`${summary.errors.length} errors`);
    notify(parts.join(' · ') || 'Import complete', summary.errors?.length ? 'warning' : 'success');
    // Refresh so the newly-imported rows show up in the sheet.
    fetchLeads();
  }, [notify, fetchLeads]);

  // ─── Derived: filtered + bucketed leads for the visible sheet ──
  const telecallerOptions = useMemo(() => {
    const s = new Set();
    leads.forEach((l) => { if (l.telecaller_name) s.add(l.telecaller_name); });
    return Array.from(s).sort();
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const withFilters = applyFilters(leads, filters);
    if (bucket === 'all') return withFilters;
    return withFilters.filter((l) => matchBucket(l).has(bucket));
  }, [leads, filters, bucket]);

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientData');
    localStorage.removeItem('clientPortalUser');
    navigate('/client-login');
  };

  const displayName = clientData?.clientName || 'Client Portal';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: GROUND, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar — same treatment as the rest of the portal */}
      <Box sx={{
        bgcolor: NAVY, color: 'white', px: 3, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Button
            size="small" startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/client-portal')}
            sx={{ color: 'white', textTransform: 'none', px: 1.2, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
          >
            Portal Home
          </Button>
          <Box sx={{ width: '1px', height: '22px', bgcolor: 'rgba(255,255,255,0.25)' }} />
          <Avatar sx={{ width: 32, height: 32, bgcolor: NAVY_DEEP, fontWeight: 700, fontSize: '0.9rem' }}>
            {displayName?.charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.1 }}>
              {displayName}
            </Typography>
            <Typography sx={{ fontSize: '0.66rem', opacity: 0.7 }}>
              Telecaller Sheet · {telecallerName || 'unassigned'}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined" size="small" startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}
        >
          Logout
        </Button>
      </Box>

      <Box sx={{ flex: 1, p: { xs: 1.5, md: 2.5 } }}>
        {/* Header strip — refresh + import/export placeholders (round 3) */}
        <Card variant="outlined" sx={{ mb: 1.5, position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: `${NAVY}20`, '& .MuiLinearProgress-bar': { bgcolor: NAVY } }} />
          )}
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: NAVY, borderLeft: `3px solid ${NAVY}`, pl: 1.2 }}>
                Leads Sheet
              </Typography>
              <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary', pl: 1.4 }}>
                Excel-style workspace · 26 columns · auto-save on blur · Tab / Enter navigates cells.
              </Typography>
            </Box>
            <Button
              size="small" variant="outlined"
              startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={fetchLeads} disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
            <Button
              size="small" variant="outlined"
              startIcon={<UploadFileIcon sx={{ fontSize: 16 }} />}
              onClick={() => setImportOpen(true)}
              disabled={loading}
              sx={{ borderColor: '#1F3966', color: '#1F3966', '&:hover': { borderColor: '#15294D', bgcolor: '#1F396610' } }}
            >
              Import
            </Button>
            <Button
              size="small" variant="outlined"
              startIcon={exporting ? <CircularProgress size={14} /> : <FileDownloadIcon sx={{ fontSize: 16 }} />}
              onClick={handleExport}
              disabled={loading || exporting || leads.length === 0}
              sx={{ borderColor: '#F4B929', color: '#B45309', '&:hover': { borderColor: '#C68C0A', bgcolor: '#F4B92910' } }}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        {/* Queue chips */}
        <Box sx={{ mb: 1 }}>
          <QueueChips leads={leads} activeBucket={bucket} onSelect={setBucket} />
        </Box>

        {/* Filter bar */}
        <Box sx={{ mb: 1.5 }}>
          <TelecallerFilterBar
            filters={filters}
            onChange={setFilters}
            telecallerOptions={telecallerOptions}
          />
        </Box>

        {/* The sheet */}
        <TelecallerSheet
          leads={visibleLeads}
          loading={loading}
          telecallerName={telecallerName}
          onSaveLead={handleSaveLead}
          onAddLead={handleAddLead}
          onDeleteLead={handleDeleteLead}
          onError={(msg) => notify(msg, 'error')}
        />
      </Box>

      <ImportLeadsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        clientApi={clientApi}
        clientId={clientData?._id}
        onDone={handleImportDone}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={4200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ fontWeight: 600 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ClientPortalLeads;
