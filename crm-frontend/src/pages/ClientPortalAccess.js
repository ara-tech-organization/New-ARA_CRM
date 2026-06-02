import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Chip, Alert, InputAdornment, Switch, CircularProgress, Avatar,
  Tooltip, Divider,
} from '@mui/material';
import {
  ManageAccounts as ManageAccountsIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Visibility, VisibilityOff,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Link as LinkIcon,
  PersonOff as PersonOffIcon,
  CheckCircle as CheckCircleIcon,
  AccountCircle as AccountCircleIcon,
  Lock as LockIcon,
  Mail as MailIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const SLATE = '#64748b';
const META = '#1877f2';
const GOOGLE = '#34a853';

// Used by the row avatar — picks a stable swatch from the client name
// so the same client always gets the same chip-coloured initial.
const AVATAR_SWATCHES = [
  '#C08552', '#3E2723', '#0ea5e9', '#7c3aed', '#10b981',
  '#f59e0b', '#ef4444', '#0891b2', '#db2777', '#475569',
];
const swatchFor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_SWATCHES[Math.abs(h) % AVATAR_SWATCHES.length];
};
const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

const ClientPortalAccess = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'pending' | 'integrated'
  const [editDialog, setEditDialog] = useState(null);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(null);
  const [savedPasswordLoading, setSavedPasswordLoading] = useState(false);
  const [savedPasswordOriginal, setSavedPasswordOriginal] = useState('');
  const [hasRecoverable, setHasRecoverable] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients?limit=10000');
      const data = res.data?.data || res.data || [];
      // Filter out dropped clients defensively — backend already does
      // this on its default `/clients` route, but the deployed version
      // may lag, so we also drop them here. Portal access never applies
      // to a dropped client anyway.
      const live = Array.isArray(data) ? data.filter((c) => c?.status !== 'dropped') : [];
      setClients(live);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  // Summary stats for the hero strip. Recomputed only when the client
  // list changes — search/filter don't affect these totals (those are
  // intentionally global counts, not "matches in current view").
  const stats = useMemo(() => {
    let withEmail = 0;
    let active = 0;
    let pending = 0;
    let bothLinked = 0;
    clients.forEach(c => {
      const hasEmail = !!c.portalEmail;
      if (hasEmail) withEmail += 1;
      if (c.portalEnabled) active += 1;
      if (!hasEmail) pending += 1;
      const g = c.google_ads_enabled || c.googleAdsEnabled;
      const m = c.meta_enabled || c.metaEnabled;
      if (g && m) bothLinked += 1;
    });
    return { total: clients.length, withEmail, active, pending, bothLinked };
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c => {
      const matchesSearch =
        !q ||
        c.clientName?.toLowerCase().includes(q) ||
        c.portalEmail?.toLowerCase().includes(q) ||
        c.place?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filter === 'active') return c.portalEnabled;
      if (filter === 'pending') return !c.portalEmail;
      if (filter === 'integrated') {
        const g = c.google_ads_enabled || c.googleAdsEnabled;
        const m = c.meta_enabled || c.metaEnabled;
        return g && m;
      }
      return true;
    });
  }, [clients, search, filter]);

  const openEdit = async (client) => {
    setEditDialog(client);
    setFormEmail(client.portalEmail || '');
    setFormPassword('');
    setFormEnabled(client.portalEnabled || false);
    setShowPassword(false);
    setMessage(null);
    setSavedPasswordOriginal('');
    setHasRecoverable(false);
    if (client.portalEmail) {
      setSavedPasswordLoading(true);
      try {
        const res = await api.get(`/clients/${client._id}/portal-credentials`);
        const data = res.data?.data || {};
        if (data.portalPassword) {
          setFormPassword(data.portalPassword);
          setSavedPasswordOriginal(data.portalPassword);
        }
        setHasRecoverable(!!data.hasRecoverable);
      } catch {
        // Quiet failure — 404 just means feature not deployed yet.
      } finally {
        setSavedPasswordLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!editDialog) return;
    if (!formEmail.trim()) {
      setMessage({ type: 'error', text: 'Email is required' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        portalEmail: formEmail.trim(),
        portalEnabled: formEnabled,
      };
      const typed = formPassword.trim();
      const passwordChanged = typed && typed !== savedPasswordOriginal;
      if (passwordChanged) {
        payload.portalPassword = typed;
      }
      await api.put(`/clients/${editDialog._id}`, payload);
      setMessage({ type: 'success', text: 'Portal access updated successfully' });
      setClients(prev => prev.map(c =>
        c._id === editDialog._id
          ? { ...c, portalEmail: payload.portalEmail, portalEnabled: payload.portalEnabled }
          : c
      ));
      if (passwordChanged) {
        try {
          const res = await api.get(`/clients/${editDialog._id}/portal-credentials`);
          const data = res.data?.data || {};
          if (data.portalPassword) {
            setFormPassword(data.portalPassword);
            setSavedPasswordOriginal(data.portalPassword);
          }
          setHasRecoverable(!!data.hasRecoverable);
        } catch {
          setSavedPasswordOriginal(typed);
          setHasRecoverable(true);
        }
      }
      setTimeout(() => setEditDialog(null), 1200);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.response?.data?.error || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const portalUrl = `${window.location.origin}/client-login`;

  // Small reusable stat tile for the hero. Keeps the markup compact
  // so the four-up layout reads consistently.
  const StatTile = ({ label, value, icon, color, hint }) => (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${color}18`, color,
          }}>
            {icon}
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4 }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'text.primary', lineHeight: 1.1 }}>
          {value}
        </Typography>
        {hint && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.3 }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  // Compact integration chip used in the table — pairs a tiny dot
  // with the platform name so admins can spot "linked vs not" at a
  // glance without parsing two separate Chips.
  const IntegrationDot = ({ linked, label, color }) => (
    <Tooltip arrow title={`${label} — ${linked ? 'Linked' : 'Not linked'}`}>
      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.6,
        px: 0.9, py: 0.3, borderRadius: 1,
        bgcolor: linked ? `${color}14` : '#f1f5f9',
        color: linked ? color : '#94a3b8',
        fontSize: '0.7rem', fontWeight: 700,
      }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: linked ? color : '#cbd5e1' }} />
        {label}
      </Box>
    </Tooltip>
  );

  return (
    <Box>
      {/* ── Hero Strip ─────────────────────────────────────────────
          Title + subtitle on the left, search on the right. Gradient
          + copper left-border matches the look of the Dashboard hero,
          so this page reads like part of the same product. */}
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          background: `linear-gradient(135deg, ${COPPER}12 0%, ${COPPER}05 50%, transparent 100%)`,
          borderLeft: `4px solid ${COPPER}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: COPPER, color: '#fff',
              }}>
                <ManageAccountsIcon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.1 }}>
                  Client Portal Access
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                  Manage login credentials and recovery for every client portal
                </Typography>
              </Box>
            </Box>
            <TextField
              size="small"
              placeholder="Search by name, email or place…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> } }}
              sx={{
                minWidth: 280, bgcolor: 'background.paper',
                '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* ── Summary stat tiles ─────────────────────────────────────
          Four-up KPI strip — surfaces "did we set portals up?" without
          asking the admin to scan the table. Numbers are global, not
          filtered, so the totals stay stable while filters change. */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <StatTile
          label="Total Clients"
          value={stats.total}
          icon={<AccountCircleIcon fontSize="small" />}
          color={BROWN}
          hint={`${stats.withEmail} with portal email`}
        />
        <StatTile
          label="Active Portals"
          value={stats.active}
          icon={<CheckCircleIcon fontSize="small" />}
          color={GREEN}
          hint="Login enabled"
        />
        <StatTile
          label="Pending Setup"
          value={stats.pending}
          icon={<PersonOffIcon fontSize="small" />}
          color={AMBER}
          hint="No portal email yet"
        />
        <StatTile
          label="Both Ads Linked"
          value={stats.bothLinked}
          icon={<LinkIcon fontSize="small" />}
          color={COPPER}
          hint="Google + Meta connected"
        />
      </Box>

      {/* ── Portal URL card ────────────────────────────────────────
          The login URL clients use. Includes both Copy and Open
          actions; the Open action is useful when admins want to QA
          the flow in an incognito tab. */}
      <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: `${COPPER}18`, color: COPPER,
            }}>
              <LinkIcon fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Client Login URL
              </Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, fontFamily: 'monospace', color: BROWN }}>
                {portalUrl}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip arrow title="Open the client login page in a new tab">
              <Button
                size="small" variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open(portalUrl, '_blank', 'noopener')}
              >
                Open
              </Button>
            </Tooltip>
            <Tooltip arrow title="Copy to clipboard">
              <Button
                size="small" variant="contained"
                startIcon={copied === 'url' ? <CheckIcon /> : <CopyIcon />}
                onClick={() => handleCopy(portalUrl, 'url')}
                sx={{
                  bgcolor: copied === 'url' ? GREEN : BROWN,
                  '&:hover': { bgcolor: copied === 'url' ? GREEN : COPPER },
                }}
              >
                {copied === 'url' ? 'Copied' : 'Copy URL'}
              </Button>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* ── Filter chips ───────────────────────────────────────────
          Quick narrowing — the table can show 100+ clients, so these
          chips let the admin focus on "needs setup" or "everything
          linked" in one click. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All', count: clients.length },
          { key: 'active', label: 'Active', count: stats.active },
          { key: 'pending', label: 'Pending setup', count: stats.pending },
          { key: 'integrated', label: 'Both ads linked', count: stats.bothLinked },
        ].map(opt => {
          const selected = filter === opt.key;
          return (
            <Chip
              key={opt.key}
              label={`${opt.label} · ${opt.count}`}
              size="small"
              onClick={() => setFilter(opt.key)}
              sx={{
                fontWeight: 700, fontSize: '0.74rem',
                bgcolor: selected ? BROWN : '#fff',
                color: selected ? '#fff' : 'text.primary',
                border: `1px solid ${selected ? BROWN : '#e2e8f0'}`,
                '&:hover': { bgcolor: selected ? BROWN : `${COPPER}14` },
              }}
            />
          );
        })}
        {filtered.length !== clients.length && (
          <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', ml: 0.5 }}>
            Showing {filtered.length} of {clients.length}
          </Typography>
        )}
      </Box>

      {/* ── Clients table ──────────────────────────────────────────
          Avatar + name stack on the left, then portal status, then
          integrations, then Manage. The avatar's deterministic colour
          gives the eye an anchor for scanning long lists. */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={32} sx={{ color: COPPER }} />
          <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: '0.85rem' }}>
            Loading clients…
          </Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Card variant="outlined" sx={{ py: 6, textAlign: 'center', borderRadius: 2 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%', mx: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${COPPER}14`, color: COPPER, mb: 1.5,
          }}>
            <SearchIcon />
          </Box>
          <Typography sx={{ fontWeight: 700, mb: 0.4 }}>No clients match this view</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            Try clearing the search or switching the filter chip.
          </Typography>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: `${COPPER}08` }}>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem', color: BROWN, textTransform: 'uppercase', letterSpacing: 0.3 }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem', color: BROWN, textTransform: 'uppercase', letterSpacing: 0.3 }}>Portal Email</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.78rem', color: BROWN, textTransform: 'uppercase', letterSpacing: 0.3 }}>Portal Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.78rem', color: BROWN, textTransform: 'uppercase', letterSpacing: 0.3 }}>Integrations</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.78rem', color: BROWN, textTransform: 'uppercase', letterSpacing: 0.3 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(c => {
                const g = c.google_ads_enabled || c.googleAdsEnabled;
                const m = c.meta_enabled || c.metaEnabled;
                const swatch = swatchFor(c.clientName || c._id);
                return (
                  <TableRow key={c._id} hover sx={{ '& td': { borderColor: '#f1f5f9' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar sx={{
                          width: 36, height: 36, fontSize: '0.78rem', fontWeight: 700,
                          bgcolor: swatch, color: '#fff',
                        }}>
                          {initials(c.clientName)}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
                            {c.clientName}
                          </Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                            {c.place || '—'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {c.portalEmail ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                            {c.portalEmail}
                          </Typography>
                          <Tooltip arrow title="Copy email">
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(c.portalEmail, `e-${c._id}`)}
                              sx={{ p: 0.3 }}
                            >
                              {copied === `e-${c._id}`
                                ? <CheckIcon sx={{ fontSize: 14, color: GREEN }} />
                                : <CopyIcon sx={{ fontSize: 14, color: SLATE }} />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontStyle: 'italic' }}>
                          Not set
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={c.portalEnabled ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.7rem', fontWeight: 700,
                          bgcolor: c.portalEnabled ? `${GREEN}18` : '#f1f5f9',
                          color: c.portalEnabled ? GREEN : '#94a3b8',
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                        <IntegrationDot linked={g} label="Google" color={GOOGLE} />
                        <IntegrationDot linked={m} label="Meta" color={META} />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                        onClick={() => openEdit(c)}
                        sx={{
                          fontSize: '0.74rem', fontWeight: 700, py: 0.3,
                          color: BROWN, borderColor: '#e2e8f0',
                          '&:hover': { borderColor: COPPER, bgcolor: `${COPPER}10` },
                        }}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Edit Dialog ────────────────────────────────────────────
          `key={editDialog?._id}` forces React to remount the Dialog
          (and every input inside) whenever a different client is
          selected. Without it, switching from Client A → B kept the
          rendered DOM nodes alive and Chrome's autofill cache painted
          the previous client's saved login on top. */}
      <Dialog
        key={editDialog?._id || 'none'}
        open={!!editDialog}
        onClose={() => !saving && setEditDialog(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
      >
        {editDialog && (
          <Box sx={{
            background: `linear-gradient(135deg, ${COPPER} 0%, ${BROWN} 100%)`,
            color: '#fff', px: 3, py: 2,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Avatar sx={{
              width: 40, height: 40, bgcolor: 'rgba(255,255,255,0.18)',
              color: '#fff', fontSize: '0.85rem', fontWeight: 800,
            }}>
              {initials(editDialog.clientName)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
                Portal Access
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                {editDialog.clientName}
              </Typography>
            </Box>
          </Box>
        )}
        <DialogContent sx={{ pt: 3 }}>
          {/* `autoComplete="off"` on the form prevents Chrome/Edge from
              auto-filling password-manager credentials based on URL +
              field shape. The hidden decoys absorb the autofill that
              browsers force onto the first email+password pair. */}
          <Box component="form" autoComplete="off" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <input type="text" name="fake-username" autoComplete="username" style={{ display: 'none' }} aria-hidden="true" />
            <input type="password" name="fake-password" autoComplete="new-password" style={{ display: 'none' }} aria-hidden="true" />

            <TextField
              fullWidth
              label="Portal Email"
              type="email"
              name="portal_email_field"
              autoComplete="off"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="client@example.com"
              required
              disabled={saving}
              inputProps={{ autoComplete: 'off' }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailIcon sx={{ fontSize: 18, color: SLATE }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              label="Portal Password"
              type={showPassword ? 'text' : 'password'}
              name="portal_password_field"
              autoComplete="new-password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder={
                savedPasswordLoading
                  ? 'Loading saved password…'
                  : (editDialog?.portalEmail ? 'Leave blank to keep current' : 'Set a password')
              }
              disabled={saving || savedPasswordLoading}
              helperText={
                savedPasswordLoading
                  ? 'Fetching from server…'
                  : editDialog?.portalEmail
                    ? (hasRecoverable
                        ? 'Showing the saved password — click 👁 to reveal, edit to change.'
                        : 'No recoverable copy on file. Type a new password to enable recovery for future use.')
                    : ' '
              }
              inputProps={{ autoComplete: 'new-password' }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ fontSize: 18, color: SLATE }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {hasRecoverable && formPassword === savedPasswordOriginal && savedPasswordOriginal && (
                        <Tooltip arrow title="Copy password">
                          <IconButton
                            size="small"
                            onClick={() => {
                              navigator.clipboard?.writeText(savedPasswordOriginal);
                              setCopied('password');
                              setTimeout(() => setCopied(null), 1500);
                            }}
                          >
                            {copied === 'password'
                              ? <CheckIcon sx={{ fontSize: 18, color: GREEN }} />
                              : <CopyIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip arrow title={showPassword ? 'Hide' : 'Reveal'}>
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Divider sx={{ my: 0.5 }} />

            {/* Enable toggle — frames the boolean as a labelled row
                with a one-line subtitle so the admin understands what
                turning it off does (revokes login, doesn't delete
                credentials). */}
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              p: 1.5, borderRadius: 1.5, bgcolor: '#f8fafc',
            }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  Enable Portal Access
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {formEnabled
                    ? 'Client can sign in with the email and password above.'
                    : 'Login is blocked. Credentials remain on file.'}
                </Typography>
              </Box>
              <Switch
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
                disabled={saving}
                sx={{
                  '& .Mui-checked': { color: GREEN },
                  '& .Mui-checked + .MuiSwitch-track': { bgcolor: GREEN },
                }}
              />
            </Box>

            {message && <Alert severity={message.type} sx={{ borderRadius: 1.5 }}>{message.text}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setEditDialog(null)} disabled={saving} sx={{ color: SLATE, fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formEmail.trim()}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{
              bgcolor: BROWN, fontWeight: 700,
              '&:hover': { bgcolor: BROWN, filter: 'brightness(0.92)' },
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientPortalAccess;
