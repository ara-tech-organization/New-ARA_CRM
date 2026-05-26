import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Card, CardContent, Typography, Button, Avatar, TextField,
  CircularProgress, Alert, LinearProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
  Facebook as FacebookIcon,
} from '@mui/icons-material';
import MetaLeadsTable from '../components/MetaLeadsTable';
import { exportLeadsToExcel, exportLeadsToPdf } from '../utils/metaLeadsExport';

// Dedicated full-page Leads dashboard for the client portal. Mounted
// at /client-portal/leads. Mirrors the auth + axios pattern of
// ClientPortalDashboard so the same login session works seamlessly.
//
// Navigated to either from the Home launcher (no state) or from the
// EOD report's click-through (location.state.filterPreset set).

const COPPER = '#C08552';
const BROWN = '#3E2723';
const CREAM = '#FFF8F0';
const META_BLUE = '#1877f2';

const API_URL = process.env.REACT_APP_API_URL
  || 'https://ara-crm-ads-hrarezggb7g7dxdy.southeastasia-01.azurewebsites.net/api';

const ClientPortalLeads = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [clientData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('clientData')); } catch { return null; }
  });
  const token = localStorage.getItem('clientToken');

  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter preset hand-off — when navigated from EOD click-through.
  // Cleared as soon as MetaLeadsTable consumes it so a refresh doesn't
  // re-apply it.
  const [filterPreset, setFilterPreset] = useState(
    location.state?.filterPreset || null
  );

  // Same axios pattern as ClientPortalDashboard — grace-window 401
  // handling, token attached automatically. Memoised so React doesn't
  // recreate it on every render.
  const clientApi = useMemo(() => {
    const REDIRECT_GRACE_MS = 800;
    let pendingTimer = null;
    const cancelPending = () => {
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
    };
    const instance = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });
    instance.interceptors.request.use((config) => {
      const t = localStorage.getItem('clientToken');
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    instance.interceptors.response.use((r) => {
      cancelPending();
      return r;
    }, (err) => {
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

  useEffect(() => {
    if (!token) navigate('/client-login');
  }, [token, navigate]);

  const fetchLeads = useCallback(async () => {
    const clientId = clientData?._id;
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientApi.get(`/meta/client/${clientId}/analytics`, {
        params: { from: dateFrom, to: dateTo },
      });
      setData(res.data || null);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to fetch leads'
      );
    } finally {
      setLoading(false);
    }
  }, [clientApi, clientData, dateFrom, dateTo]);

  useEffect(() => { if (token) fetchLeads(); }, [fetchLeads, token]);

  const handleSaveLead = async (leadId, payload) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired — please log in again.');
    const { data: resp } = await clientApi.put(
      `/meta/client/${clientId}/leads/${leadId}`,
      payload,
    );
    const updated = resp?.lead;
    if (updated) {
      setData((prev) => {
        if (!prev?.leads_in_range) return prev;
        const nextLeads = prev.leads_in_range.map((l) =>
          (l._id === leadId ? { ...l, ...updated } : l)
        );
        return { ...prev, leads_in_range: nextLeads };
      });
    }
    return updated;
  };

  const handleAddLead = async (payload) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired — please log in again.');
    const { data: resp } = await clientApi.post(
      `/meta/client/${clientId}/leads`,
      payload,
    );
    const created = resp?.lead;
    if (created) {
      setData((prev) => {
        if (!prev) return prev;
        return { ...prev, leads_in_range: [created, ...(prev.leads_in_range || [])] };
      });
    }
    return created;
  };

  const handleDeleteLead = async (leadId) => {
    const clientId = clientData?._id;
    if (!clientId) throw new Error('Client session expired — please log in again.');
    await clientApi.delete(
      `/meta/client/${clientId}/leads/${leadId}`,
    );
    setData((prev) => {
      if (!prev?.leads_in_range) return prev;
      return {
        ...prev,
        leads_in_range: prev.leads_in_range.filter((l) => l._id !== leadId),
      };
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientData');
    localStorage.removeItem('clientPortalUser');
    navigate('/client-login');
  };

  const displayName = clientData?.clientName || 'Client Portal';
  const leads = data?.leads_in_range || data?.recent_leads || [];
  const metaAccount = data?.meta_account;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: CREAM, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar — back arrow, client info, logout */}
      <Box sx={{ bgcolor: BROWN, color: 'white', px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/client-portal')}
            sx={{
              color: 'white', textTransform: 'none', whiteSpace: 'nowrap',
              flexShrink: 0, px: 1.2,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            Portal Home
          </Button>
          {/* sx numeric width/height = theme spacing OR percentage —
              use explicit pixel strings here so this stays a 1px line. */}
          <Box sx={{ width: '1px', height: '22px', bgcolor: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
          <Avatar sx={{ width: 32, height: 32, bgcolor: COPPER, fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
            {displayName?.charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </Typography>
            <Typography sx={{ fontSize: '0.66rem', opacity: 0.7, whiteSpace: 'nowrap' }}>Leads Dashboard</Typography>
          </Box>
        </Box>
        <Button
          variant="outlined" size="small" startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{
            color: 'white', borderColor: 'rgba(255,255,255,0.3)',
            whiteSpace: 'nowrap', flexShrink: 0,
            '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' },
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Content area — full width minus padding */}
      <Box sx={{ flex: 1, p: { xs: 1.5, md: 2.5 } }}>
        {/* Header strip — title + date range + actions */}
        <Card variant="outlined" sx={{ mb: 1.5, position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <LinearProgress
              sx={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                bgcolor: `${META_BLUE}20`,
                '& .MuiLinearProgress-bar': { bgcolor: META_BLUE },
              }}
            />
          )}
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: BROWN, borderLeft: `3px solid ${META_BLUE}`, pl: 1.2 }}>
                Leads ({leads.length})
              </Typography>
              <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary', pl: 1.4 }}>
                Every Meta + manual WhatsApp/Walk-In lead in the selected date range.
              </Typography>
            </Box>
            <TextField
              type="date" size="small" label="From" value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 150 }} disabled={loading}
            />
            <TextField
              type="date" size="small" label="To" value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 150 }} disabled={loading}
            />
            <Box sx={{ display: 'flex', gap: 0.6 }}>
              {(() => {
                const iso = (d) => d.toISOString().split('T')[0];
                const t = iso(new Date());
                const d7 = new Date(); d7.setDate(new Date().getDate() - 6);
                const d30 = new Date(); d30.setDate(new Date().getDate() - 29);
                const isT = dateFrom === t && dateTo === t;
                const is7 = dateFrom === iso(d7) && dateTo === t;
                const is30 = dateFrom === iso(d30) && dateTo === t;
                const aSx = { bgcolor: META_BLUE, color: '#fff', borderColor: META_BLUE, '&:hover': { bgcolor: '#0c5cb8' } };
                return (
                  <>
                    <Button size="small" variant={isT ? 'contained' : 'outlined'} disabled={loading} sx={isT ? aSx : undefined} onClick={() => { setDateFrom(t); setDateTo(t); }}>Today</Button>
                    <Button size="small" variant={is7 ? 'contained' : 'outlined'} disabled={loading} sx={is7 ? aSx : undefined} onClick={() => { setDateFrom(iso(d7)); setDateTo(t); }}>7 Days</Button>
                    <Button size="small" variant={is30 ? 'contained' : 'outlined'} disabled={loading} sx={is30 ? aSx : undefined} onClick={() => { setDateFrom(iso(d30)); setDateTo(t); }}>30 Days</Button>
                  </>
                );
              })()}
            </Box>
            <Button
              size="small" variant="outlined"
              startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={fetchLeads} disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              <Button
                size="small" variant="outlined"
                startIcon={<FileDownloadIcon sx={{ fontSize: 16 }} />}
                onClick={() => exportLeadsToExcel(leads, metaAccount, displayName)}
                disabled={!leads.length}
                sx={{ borderColor: '#10b981', color: '#10b981', '&:hover': { borderColor: '#0e9b6f', bgcolor: '#10b98110' } }}
              >
                Excel
              </Button>
              <Button
                size="small" variant="outlined"
                startIcon={<PdfIcon sx={{ fontSize: 16 }} />}
                onClick={() => exportLeadsToPdf(leads, metaAccount, displayName)}
                disabled={!leads.length}
                sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#dc2626', bgcolor: '#ef444410' } }}
              >
                PDF
              </Button>
            </Box>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        {loading && !data && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ color: META_BLUE }} />
            <Typography sx={{ mt: 2, color: 'text.secondary' }}>Fetching your leads…</Typography>
          </Box>
        )}

        {data && leads.length === 0 && !loading && (
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <FacebookIcon sx={{ fontSize: 48, color: META_BLUE, mb: 1 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
                No leads in this date range
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try widening the From/To dates above to see older lead submissions.
              </Typography>
            </CardContent>
          </Card>
        )}

        {data && leads.length > 0 && (
          <Box sx={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s' }}>
            <MetaLeadsTable
              leads={leads}
              metaAccount={metaAccount}
              // Full-page → leave height to grow naturally; cap so the
              // sticky header still works on tall monitors.
              maxHeight="calc(100vh - 260px)"
              onSaveLead={handleSaveLead}
              onAddLead={handleAddLead}
              onDeleteLead={handleDeleteLead}
              filterPreset={filterPreset}
              onFilterPresetConsumed={() => setFilterPreset(null)}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ClientPortalLeads;
