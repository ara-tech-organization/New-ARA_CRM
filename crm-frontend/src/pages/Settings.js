import React, { useState, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Grid, Card, CardContent, Typography, TextField, Button,
  Avatar, Chip, Tab, Tabs, Alert, Divider, IconButton, CircularProgress,
  Snackbar, InputAdornment, Tooltip, LinearProgress,
} from '@mui/material';
import {
  Person as PersonIcon, Security as SecurityIcon,
  Phone as PhoneIcon, Business as BusinessIcon,
  PhotoCamera as PhotoCameraIcon, Delete as DeleteIcon,
  Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
  Mail as MailIcon, Badge as BadgeIcon, Check as CheckIcon,
  CalendarToday as CalendarIcon, InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import { loadUserFromStorage } from '../store/slices/authSlice';

const COPPER = '#1F3966';
const BROWN = '#1F3966';

// Max base64 size we'll send to the backend. The browser-side resize
// below keeps photos comfortably under this, but the check is here
// as a safety net for tiny weird files.
const MAX_AVATAR_BYTES = 250 * 1024;

// Resize an uploaded image to a square `size` × `size` canvas, then
// export as JPEG (small + lossy = perfect for an avatar) data URL.
const resizeImageToDataUrl = (file, size = 256) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Centre-crop the larger side so a portrait or landscape photo
      // doesn't get squashed into a square.
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Image could not be decoded'));
    img.src = e.target.result;
  };
  reader.onerror = () => reject(new Error('File could not be read'));
  reader.readAsDataURL(file);
});

const SectionHeader = ({ title, subtitle, icon }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, mb: 2 }}>
    <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: `${COPPER}15`, color: COPPER, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {React.cloneElement(icon, { sx: { fontSize: 20 } })}
    </Box>
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.1 }}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{subtitle}</Typography>}
    </Box>
  </Box>
);

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const Settings = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [tabValue, setTabValue] = useState(0);
  const [snack, setSnack] = useState({ open: false, severity: 'success', msg: '' });
  const notify = (severity, msg) => setSnack({ open: true, severity, msg });

  // ── Avatar state ──────────────────────────────────────────────
  const fileRef = useRef(null);
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [avatarBusy, setAvatarBusy] = useState(false);

  const handlePickFile = () => fileRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be picked again
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('error', 'Please pick an image file (PNG / JPG).');
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      if (dataUrl.length > MAX_AVATAR_BYTES * 1.4) {
        notify('error', 'Image is too large even after resizing — try a smaller photo.');
        return;
      }
      // Optimistic preview — flips to saved state after the PUT.
      setAvatar(dataUrl);
      const res = await api.put('/auth/update-details', { avatar: dataUrl });
      const fresh = res.data?.data;
      if (fresh) {
        localStorage.setItem('user', JSON.stringify(fresh));
        dispatch(loadUserFromStorage());
        notify('success', 'Profile photo updated.');
      }
    } catch (err) {
      notify('error', err?.response?.data?.message || err?.message || 'Could not upload photo');
      setAvatar(user?.avatar || '');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      const res = await api.put('/auth/update-details', { avatar: '' });
      const fresh = res.data?.data;
      if (fresh) {
        localStorage.setItem('user', JSON.stringify(fresh));
        dispatch(loadUserFromStorage());
      }
      setAvatar('');
      notify('success', 'Photo removed.');
    } catch (err) {
      notify('error', err?.response?.data?.message || 'Could not remove photo');
    } finally {
      setAvatarBusy(false);
    }
  };

  // ── Profile form ──────────────────────────────────────────────
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
  });
  const [profileBusy, setProfileBusy] = useState(false);
  const profileChanged = useMemo(() =>
    (profile.name || '') !== (user?.name || '')
    || (profile.email || '') !== (user?.email || '')
    || (profile.phone || '') !== (user?.phone || '')
    || (profile.department || '') !== (user?.department || ''),
  [profile, user]);

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) { notify('error', 'Name cannot be empty'); return; }
    if (!profile.email.trim()) { notify('error', 'Email cannot be empty'); return; }
    setProfileBusy(true);
    try {
      const res = await api.put('/auth/update-details', profile);
      const fresh = res.data?.data;
      if (fresh) {
        localStorage.setItem('user', JSON.stringify(fresh));
        dispatch(loadUserFromStorage());
      }
      notify('success', 'Profile saved.');
    } catch (err) {
      notify('error', err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setProfileBusy(false);
    }
  };

  // ── Password form ─────────────────────────────────────────────
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [pwdBusy, setPwdBusy] = useState(false);

  // Tiny strength meter — purely cosmetic but useful guidance.
  const pwdStrength = useMemo(() => {
    const p = pwd.next || '';
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p)) score += 1;
    if (/[a-z]/.test(p)) score += 1;
    if (/\d/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;
    const pct = (score / 5) * 100;
    const label = score >= 4 ? 'Strong' : score >= 3 ? 'Good' : score >= 2 ? 'Fair' : score >= 1 ? 'Weak' : 'Too short';
    const color = score >= 4 ? '#10b981' : score >= 3 ? '#22c55e' : score >= 2 ? '#f59e0b' : '#ef4444';
    return { pct, label, color };
  }, [pwd.next]);

  const handleUpdatePassword = async () => {
    if (!pwd.current) { notify('error', 'Enter your current password'); return; }
    if (!pwd.next || pwd.next.length < 6) { notify('error', 'New password must be at least 6 characters'); return; }
    if (pwd.next !== pwd.confirm) { notify('error', 'New password and confirmation do not match'); return; }
    setPwdBusy(true);
    try {
      await api.put('/auth/update-password', { currentPassword: pwd.current, newPassword: pwd.next });
      setPwd({ current: '', next: '', confirm: '' });
      notify('success', 'Password updated.');
    } catch (err) {
      notify('error', err?.response?.data?.message || err?.message || 'Password update failed');
    } finally {
      setPwdBusy(false);
    }
  };

  // Friendly summary stats for the sidebar card.
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <Box>
      {/* ── Hero strip ───────────────────────────────────────────── */}
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          background: `linear-gradient(135deg, ${COPPER}18 0%, ${COPPER}06 50%, transparent 100%)`,
          borderLeft: `4px solid ${COPPER}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', color: BROWN }}>Settings</Typography>
              <Tooltip arrow title="Manage your profile, photo, and password from one place">
                <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'help' }} />
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Signed in as <Box component="span" sx={{ fontWeight: 700, color: COPPER }}>{user?.name || 'Admin'}</Box> · {user?.role || 'Administrator'}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2.5}>
        {/* ── Profile sidebar ─────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              {/* Avatar with hover camera icon — click anywhere on the
                  avatar to pick a new photo. */}
              <Box sx={{ position: 'relative', width: 120, height: 120, mx: 'auto', mb: 1.5 }}>
                <Avatar
                  src={avatar || undefined}
                  sx={{
                    width: 120, height: 120, bgcolor: COPPER,
                    fontSize: '2.6rem', fontWeight: 700,
                    border: `3px solid ${COPPER}30`,
                    boxShadow: `0 4px 16px ${COPPER}33`,
                  }}
                >
                  {user?.name?.[0] || 'A'}
                </Avatar>
                <Tooltip arrow title="Upload a new photo">
                  <IconButton
                    onClick={handlePickFile}
                    disabled={avatarBusy}
                    sx={{
                      position: 'absolute', bottom: 0, right: 0,
                      bgcolor: COPPER, color: '#fff',
                      width: 36, height: 36,
                      boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                      '&:hover': { bgcolor: COPPER, filter: 'brightness(0.92)' },
                    }}
                  >
                    {avatarBusy ? <CircularProgress size={16} color="inherit" /> : <PhotoCameraIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </Tooltip>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFileChange}
                />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 700 }}>{user?.name || 'Admin User'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
                {user?.email || 'admin@crm.com'}
              </Typography>
              <Chip
                label={user?.role || 'Administrator'}
                size="small"
                sx={{ bgcolor: `${COPPER}15`, color: COPPER, fontWeight: 700, textTransform: 'capitalize' }}
              />

              {avatar && (
                <Box sx={{ mt: 1.5 }}>
                  <Button
                    size="small" startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                    onClick={handleRemoveAvatar} disabled={avatarBusy}
                    sx={{ color: '#ef4444', textTransform: 'none' }}
                  >
                    Remove photo
                  </Button>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ textAlign: 'left', px: 1, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BadgeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    <Box component="span" sx={{ color: 'text.secondary' }}>User ID:</Box>{' '}
                    <Box component="span" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{user?.userID || '—'}</Box>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">{user?.phone || <Box component="span" sx={{ color: 'text.disabled' }}>No phone</Box>}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">{user?.department || <Box component="span" sx={{ color: 'text.disabled' }}>No department</Box>}</Typography>
                </Box>
                {joinedDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      <Box component="span" sx={{ color: 'text.secondary' }}>Joined:</Box>{' '}
                      {joinedDate}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Photo guidelines card — small reassurance for non-technical users */}
          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mt: 2, fontSize: '0.78rem' }}>
            Photos are resized to 256×256 before upload, so any high-res image works fine. PNG / JPG only.
          </Alert>
        </Grid>

        {/* ── Tabs panel ──────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={tabValue}
                onChange={(e, v) => setTabValue(v)}
                sx={{
                  px: 2,
                  '& .MuiTabs-indicator': { bgcolor: COPPER, height: 3 },
                  '& .Mui-selected': { color: `${COPPER} !important` },
                }}
              >
                <Tab icon={<PersonIcon />} label="Profile" iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab icon={<SecurityIcon />} label="Security" iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
              </Tabs>
            </Box>
            <CardContent>
              {/* ── PROFILE TAB ───────────────────────────────────── */}
              <TabPanel value={tabValue} index={0}>
                <SectionHeader
                  title="Personal Information"
                  subtitle="Used across the CRM — sidebar, top bar, and any audit logs."
                  icon={<PersonIcon />}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth required
                      label="Full Name"
                      value={profile.name}
                      onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth required type="email"
                      label="Email"
                      value={profile.email}
                      onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><MailIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      placeholder="+91 98765 43210"
                      value={profile.phone}
                      onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Department"
                      placeholder="e.g. Operations, Sales"
                      value={profile.department}
                      onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Role"
                      value={user?.role || ''}
                      disabled
                      helperText="Role is managed by an administrator"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="User ID"
                      value={user?.userID || ''}
                      disabled
                      helperText="System-generated identifier"
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      {profileChanged && (
                        <Button onClick={() => setProfile({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', department: user?.department || '' })} disabled={profileBusy}>
                          Discard
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        onClick={handleSaveProfile}
                        disabled={!profileChanged || profileBusy}
                        startIcon={profileBusy ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                        sx={{ bgcolor: COPPER, color: '#fff', '&:hover': { bgcolor: COPPER, filter: 'brightness(0.92)' } }}
                      >
                        {profileBusy ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </TabPanel>

              {/* ── SECURITY TAB ──────────────────────────────────── */}
              <TabPanel value={tabValue} index={1}>
                <SectionHeader
                  title="Change Password"
                  subtitle="Strong passwords use a mix of upper, lower, digits, and symbols."
                  icon={<SecurityIcon />}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth label="Current Password"
                      type={showPwd.current ? 'text' : 'password'}
                      value={pwd.current}
                      onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowPwd((s) => ({ ...s, current: !s.current }))} tabIndex={-1}>
                              {showPwd.current ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth label="New Password"
                      type={showPwd.next ? 'text' : 'password'}
                      value={pwd.next}
                      onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowPwd((s) => ({ ...s, next: !s.next }))} tabIndex={-1}>
                              {showPwd.next ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    {pwd.next && (
                      <Box sx={{ mt: 0.8 }}>
                        <LinearProgress
                          variant="determinate"
                          value={pwdStrength.pct}
                          sx={{ height: 5, borderRadius: 2, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: pwdStrength.color } }}
                        />
                        <Typography sx={{ fontSize: '0.7rem', color: pwdStrength.color, fontWeight: 700, mt: 0.4 }}>
                          {pwdStrength.label}
                        </Typography>
                      </Box>
                    )}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth label="Confirm New Password"
                      type={showPwd.confirm ? 'text' : 'password'}
                      value={pwd.confirm}
                      onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                      error={!!pwd.confirm && pwd.confirm !== pwd.next}
                      helperText={pwd.confirm && pwd.confirm !== pwd.next ? "Doesn't match new password" : ' '}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))} tabIndex={-1}>
                              {showPwd.confirm ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info" sx={{ mb: 1, fontSize: '0.78rem' }}>
                      You'll stay signed in after a password change. Use a unique password not shared with other sites.
                    </Alert>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="contained"
                        onClick={handleUpdatePassword}
                        disabled={pwdBusy || !pwd.current || !pwd.next || pwd.next !== pwd.confirm}
                        startIcon={pwdBusy ? <CircularProgress size={16} color="inherit" /> : <SecurityIcon />}
                        sx={{ bgcolor: COPPER, color: '#fff', '&:hover': { bgcolor: COPPER, filter: 'brightness(0.92)' } }}
                      >
                        {pwdBusy ? 'Updating…' : 'Update Password'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
