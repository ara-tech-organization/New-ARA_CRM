import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Box, TextField, Button, Typography, Alert, InputAdornment, IconButton, Stack, alpha,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Person as PersonIcon } from '@mui/icons-material';
import leadMatrixLogo from '../assets/Lead-Matrix-Logo.png';

// Client portal sign-in. Same visual system as the internal Login
// page (poster panel + white card) so cosmetic/derm clients recognise
// the ARA workspace when they land here from a branded email link.

const PRIMARY = '#1F3966';
const PRIMARY_DEEP = '#15294D';
const ACCENT = '#F4B929';
const INK = '#0F172A';
const INK_MUTED = '#475569';
const GROUND = '#F8FAFC';
const CARD_BORDER = '#E2E8F0';

const ClientLogin = () => {
  const navigate = useNavigate();
  // Field is labelled "Username or email" — admins typically have
  // both, telecallers usually only a username assigned by their
  // client admin.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('clientToken');
    if (token) navigate('/client-portal');
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) { setError('Please enter username/email and password'); return; }
    setLoading(true);
    setError('');
    try {
      // Backend accepts username, email, or identifier — send all
      // three so a future field rename still works.
      const res = await api.post('/auth/client-login', {
        username: identifier,
        email: identifier,
        identifier,
        password,
      });
      localStorage.setItem('clientToken', res.data.accessToken);
      localStorage.setItem('clientData', JSON.stringify(res.data.client));
      if (res.data.user) {
        localStorage.setItem('clientPortalUser', JSON.stringify(res.data.user));
      }
      navigate('/client-portal');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: GROUND }}>
      {/* Left poster panel — navy → slate gradient with teal glow */}
      <Box sx={{
        flex: 1,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${PRIMARY_DEEP} 0%, ${INK} 100%)`,
        color: '#fff',
        p: 6,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: '-15%', right: '-10%', width: 380, height: 380, borderRadius: '50%', background: alpha(ACCENT, 0.28), filter: 'blur(100px)' }} />
        <Box sx={{ position: 'absolute', bottom: '-15%', left: '-10%', width: 320, height: 320, borderRadius: '50%', background: alpha(PRIMARY, 0.45), filter: 'blur(90px)' }} />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 500, textAlign: 'center' }}>
          <Box
            component="img"
            src={leadMatrixLogo}
            alt="Lead Matrix"
            sx={{ width: '100%', maxWidth: 340, height: 'auto', mb: 3, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))' }}
          />
          <Typography sx={{ fontSize: '0.98rem', color: alpha('#fff', 0.9), textAlign: 'center', maxWidth: 400, mb: 4, mx: 'auto' }}>
            Track every Meta and Google lead, manage telecaller follow-ups, and stay on top of campaign performance.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Live Leads', 'Campaign Metrics', 'Daily Trends', 'Performance Reports'].map(f => (
              <Box key={f} sx={{
                px: 1.8, py: 0.8,
                bgcolor: alpha('#fff', 0.12),
                border: `1px solid ${alpha('#fff', 0.18)}`,
                borderRadius: 999,
              }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff', letterSpacing: '0.01em' }}>{f}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Right sign-in card */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        p: { xs: 3, sm: 4, md: 6 },
      }}>
        <Box sx={{
          width: '100%', maxWidth: 440,
          bgcolor: '#fff',
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 3,
          p: { xs: 3, sm: 4 },
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.06)',
        }}>
          {/* Mobile-only logo — desktop shows it in the poster */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3 }}>
            <Box
              component="img"
              src={leadMatrixLogo}
              alt="Lead Matrix"
              sx={{ width: '100%', maxWidth: 240, height: 'auto' }}
            />
          </Box>

          <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', color: INK, letterSpacing: '-0.02em', mb: 0.5 }}>
            Welcome
          </Typography>
          <Typography sx={{ fontSize: '0.92rem', color: INK_MUTED, mb: 3 }}>
            Sign in to view your ad performance.
          </Typography>

          {error && (
            <Alert severity="error" sx={{
              mb: 2.5, borderRadius: 2,
              bgcolor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
              '& .MuiAlert-icon': { color: '#EF4444' },
            }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.2}>
              <TextField
                fullWidth
                label="Username or Email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="username or your@email.com"
                disabled={loading}
                helperText="Telecallers: enter the username your admin gave you."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: INK_MUTED, fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(PRIMARY, 0.14)}` },
                  },
                }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: INK_MUTED, fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        sx={{ color: INK_MUTED, '&:hover': { color: PRIMARY, bgcolor: alpha(PRIMARY, 0.08) } }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(PRIMARY, 0.14)}` },
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{
                  py: 1.5, mt: 0.5,
                  bgcolor: PRIMARY, color: '#fff',
                  fontWeight: 700, fontSize: '0.98rem',
                  textTransform: 'none', borderRadius: 2,
                  boxShadow: `0 8px 20px ${alpha(PRIMARY, 0.35)}`,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: PRIMARY_DEEP,
                    boxShadow: `0 10px 26px ${alpha(PRIMARY, 0.42)}`,
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': { bgcolor: alpha(PRIMARY, 0.5), color: '#fff' },
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </form>

          <Typography sx={{ mt: 3, textAlign: 'center', fontSize: '0.82rem', color: INK_MUTED }}>
            Credentials provided by your account manager.{' '}
            <Typography component="span" sx={{ fontSize: '0.82rem', color: PRIMARY, fontWeight: 700, cursor: 'pointer', '&:hover': { color: PRIMARY_DEEP, textDecoration: 'underline' } }}>
              Contact ARA Discoveries
            </Typography>{' '}for access.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ClientLogin;
