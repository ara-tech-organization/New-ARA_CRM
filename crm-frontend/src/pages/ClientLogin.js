import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Box, TextField, Button, Typography, Alert, InputAdornment, IconButton, Stack,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Person as PersonIcon } from '@mui/icons-material';
import leadMatrixLogo from '../assets/Lead-Matrix-Logo.png';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const CREAM = '#FFF8F0';

const ClientLogin = () => {
  const navigate = useNavigate();
  // Field is labelled "Username or email" — admins typically have both,
  // telecallers usually only have a username assigned by the client admin.
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in as client, redirect
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
      // The backend accepts username, email, or a generic `identifier`.
      // We send all three so any future backend rename still works.
      const res = await api.post('/auth/client-login', {
        username: identifier,
        email: identifier,
        identifier,
        password,
      });
      localStorage.setItem('clientToken', res.data.accessToken);
      localStorage.setItem('clientData', JSON.stringify(res.data.client));
      // The portal user (with role) is now returned alongside the client.
      // Stored separately so the dashboard can gate tabs by role without
      // having to decode the JWT or refetch /client-me.
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
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: CREAM }}>
      {/* Left branding panel */}
      <Box sx={{
        flex: 1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', bgcolor: BROWN, color: 'white', p: 6,
      }}>
        <Box
          component="img"
          src={leadMatrixLogo}
          alt="Lead Matrix"
          sx={{
            width: '100%',
            maxWidth: 360,
            height: 'auto',
            mb: 3,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
          }}
        />
        <Typography sx={{ fontSize: '0.95rem', opacity: 0.85, textAlign: 'center', maxWidth: 400, mb: 4 }}>
          Track every Meta and Google lead, manage telecaller follow ups, and stay on top of campaign performance.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Live Leads', 'Campaign Metrics', 'Daily Trends', 'Performance Reports'].map(f => (
            <Box key={f} sx={{ px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{f}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right login form */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: { xs: 3, sm: 4, md: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 440 }}>
          {/* Mobile header */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 4 }}>
            <Box
              component="img"
              src={leadMatrixLogo}
              alt="Lead Matrix"
              sx={{
                width: '100%',
                maxWidth: 260,
                height: 'auto',
                filter: 'invert(15%) saturate(0%)',
              }}
            />
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: '1.8rem', mb: 0.5 }}>
            Welcome
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Sign in to view your ad performance
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              <TextField
                fullWidth label="Username or Email"
                value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                placeholder="username or your@email.com" disabled={loading}
                helperText="Telecallers: enter the username your admin gave you."
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'action.active', fontSize: 20 }} /></InputAdornment> }}
              />
              <TextField
                fullWidth label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password" disabled={loading}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock sx={{ color: 'action.active', fontSize: 20 }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit" variant="contained" size="large" fullWidth disabled={loading}
                sx={{ py: 1.5, bgcolor: BROWN, fontWeight: 700, fontSize: '1rem', textTransform: 'none', '&:hover': { bgcolor: COPPER } }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Stack>
          </form>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
            Credentials provided by your account manager.{' '}
            <Typography component="span" variant="body2" sx={{ color: COPPER, fontWeight: 600 }}>
              Contact ARA Discoveries
            </Typography>{' '}for access.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default ClientLogin;
