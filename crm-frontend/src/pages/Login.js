import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../store/slices/authSlice';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  alpha,
  Stack,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock,
  Email,
  TrendingUp,
  People,
  Assessment,
  CheckCircle,
} from '@mui/icons-material';
import { ThemeContext } from '../contexts/ThemeContext';
import leadMatrixLogo from '../assets/Lead-Matrix-Logo.png';

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

// New palette. Kept as file-local constants so this page doesn't
// have to reach into the MUI theme for the poster / gradient panel.
const PRIMARY = '#1F3966';       // Signature Navy
const PRIMARY_DEEP = '#15294D';  // Deeper navy for hover / bolder accents
const ACCENT = '#F4B929';        // Signature Gold
const INK = '#0F172A';           // Slate ink for text
const INK_MUTED = '#475569';
const GROUND = '#F8FAFC';
const CARD_BORDER = '#E2E8F0';   // Slate-200 border

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // ThemeContext is now light-only; we still pull it so the toggle
  // path stays available if we bring dark mode back later.
  useContext(ThemeContext);
  const { loading: isLoading, error: authError, isAuthenticated } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (authError) {
      setError(authError);
      dispatch(clearError());
    }
  }, [authError, dispatch]);

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema,
    onSubmit: async (values) => {
      setError('');
      const result = await dispatch(loginUser({ email: values.email, password: values.password }));
      if (!result.error) navigate('/dashboard');
    },
  });

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', position: 'relative', bgcolor: GROUND }}>
      {/* Left poster — navy → slate gradient with gold accent glow.
          Hidden on small screens so mobile users get the plain form. */}
      <Box
        sx={{
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
        }}
      >
        {/* Ambient glows — soft gold + soft navy blur discs */}
        <Box sx={{ position: 'absolute', top: '-15%', right: '-10%', width: 380, height: 380, borderRadius: '50%', background: alpha(ACCENT, 0.28), filter: 'blur(100px)' }} />
        <Box sx={{ position: 'absolute', bottom: '-15%', left: '-10%', width: 320, height: 320, borderRadius: '50%', background: alpha(PRIMARY, 0.45), filter: 'blur(90px)' }} />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 500, textAlign: 'center' }}>
          <Box
            component="img"
            src={leadMatrixLogo}
            alt="Lead Matrix"
            sx={{
              width: '100%',
              maxWidth: 340,
              height: 'auto',
              mb: 4,
              mx: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))',
            }}
          />

          <Typography sx={{ fontSize: '0.95rem', color: alpha('#fff', 0.85), fontWeight: 500, mb: 4, letterSpacing: '0.02em' }}>
            The workspace for cosmetic &amp; dermatology ad operations.
          </Typography>

          <Stack spacing={1.6} alignItems="flex-start" sx={{ maxWidth: 400, mx: 'auto' }}>
            {[
              { icon: <People />,     text: 'Manage contacts &amp; leads effectively' },
              { icon: <TrendingUp />, text: 'Track sales &amp; revenue growth' },
              { icon: <Assessment />, text: 'Powerful analytics &amp; insights' },
              { icon: <CheckCircle/>, text: 'Automate workflows &amp; tasks' },
            ].map((feature, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 38, height: 38, borderRadius: '10px',
                    bgcolor: alpha('#fff', 0.14),
                    border: `1px solid ${alpha('#fff', 0.18)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  {React.cloneElement(feature.icon, { sx: { fontSize: 19 } })}
                </Box>
                <Typography sx={{ fontSize: '0.95rem', color: alpha('#fff', 0.94), fontWeight: 500 }}
                  dangerouslySetInnerHTML={{ __html: feature.text }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Right pane — sign-in card. On md+ this is a plain surface,
          on xs we still centre the same card without the poster. */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        p: { xs: 3, sm: 4, md: 6 }, bgcolor: GROUND,
      }}>
        <Box
          sx={{
            width: '100%', maxWidth: 460,
            bgcolor: '#fff',
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 3,
            p: { xs: 3, sm: 4 },
            boxShadow: '0 12px 40px rgba(15, 23, 42, 0.06)',
          }}
        >
          {/* Mobile logo — the desktop poster owns it on md+. */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3 }}>
            <Box
              component="img"
              src={leadMatrixLogo}
              alt="Lead Matrix"
              sx={{ width: '100%', maxWidth: 240, height: 'auto' }}
            />
          </Box>

          <Box sx={{ mb: 3.5 }}>
            <Typography sx={{
              fontSize: '1.75rem', fontWeight: 800, color: INK,
              letterSpacing: '-0.02em', mb: 0.5,
            }}>
              Welcome back
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', color: INK_MUTED }}>
              Sign in to continue to your workspace.
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2.5, borderRadius: 2,
                bgcolor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                '& .MuiAlert-icon': { color: '#EF4444', fontSize: 22 },
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={formik.handleSubmit}>
            <Stack spacing={2.2}>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: INK, mb: 0.8 }}>
                  Email address
                </Typography>
                <TextField
                  fullWidth
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputProps={{ maxLength: 254 }}
                  placeholder="you@company.com"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email sx={{ color: INK_MUTED, fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: '#fff',
                      transition: 'all 0.2s',
                      '& fieldset': { borderColor: CARD_BORDER },
                      '&:hover fieldset': { borderColor: '#CBD5E1' },
                      '&.Mui-focused fieldset': { borderColor: PRIMARY, borderWidth: 1 },
                      '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(PRIMARY, 0.14)}` },
                    },
                    '& .MuiOutlinedInput-input': { py: 1.4, fontSize: '0.95rem', color: INK },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: INK, mb: 0.8 }}>
                  Password
                </Typography>
                <TextField
                  fullWidth
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  inputProps={{ maxLength: 128 }}
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.password && Boolean(formik.errors.password)}
                  helperText={formik.touched.password && formik.errors.password}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: INK_MUTED, fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={isLoading}
                          sx={{
                            color: INK_MUTED,
                            '&:hover': { backgroundColor: alpha(PRIMARY, 0.08), color: PRIMARY },
                          }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: '#fff',
                      transition: 'all 0.2s',
                      '& fieldset': { borderColor: CARD_BORDER },
                      '&:hover fieldset': { borderColor: '#CBD5E1' },
                      '&.Mui-focused fieldset': { borderColor: PRIMARY, borderWidth: 1 },
                      '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(PRIMARY, 0.14)}` },
                    },
                    '& .MuiOutlinedInput-input': { py: 1.4, fontSize: '0.95rem', color: INK },
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isLoading}
                sx={{
                  py: 1.5, mt: 0.8,
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
                  '&:active': { transform: 'translateY(0)' },
                  '&:disabled': {
                    bgcolor: alpha(PRIMARY, 0.5),
                    color: '#fff',
                    boxShadow: 'none',
                  },
                }}
              >
                {isLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                    <Box
                      sx={{
                        width: 18, height: 18,
                        border: '2.5px solid rgba(255,255,255,0.35)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' },
                        },
                      }}
                    />
                    Signing in…
                  </Box>
                ) : (
                  'Sign in'
                )}
              </Button>
            </Stack>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.85rem', color: INK_MUTED }}>
              Don&rsquo;t have an account?{' '}
              <Typography
                component="span"
                sx={{
                  fontSize: '0.85rem',
                  color: PRIMARY, fontWeight: 700, cursor: 'pointer',
                  '&:hover': { color: PRIMARY_DEEP, textDecoration: 'underline' },
                }}
              >
                Contact administrator
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
