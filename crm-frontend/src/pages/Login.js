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
  LightMode,
  DarkMode,
  BusinessCenter,
  TrendingUp,
  People,
  Assessment,
  CheckCircle,
} from '@mui/icons-material';
import { ThemeContext } from '../contexts/ThemeContext';

const validationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { mode, toggleTheme } = useContext(ThemeContext);
  const { loading: isLoading, error: authError, isAuthenticated } = useSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Show auth errors
  useEffect(() => {
    if (authError) {
      setError(authError);
      dispatch(clearError());
    }
  }, [authError, dispatch]);

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setError('');
      const result = await dispatch(loginUser({ email: values.email, password: values.password }));
      if (!result.error) {
        navigate('/dashboard');
      }
    },
  });

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
        bgcolor: mode === 'light' ? 'grey.50' : 'grey.900',
      }}
    >
      {/* Theme Toggle Button */}
      <IconButton
        onClick={toggleTheme}
        sx={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 10,
          bgcolor: mode === 'light' ? 'white' : 'grey.800',
          boxShadow: 2,
          '&:hover': {
            bgcolor: mode === 'light' ? 'grey.100' : 'grey.700',
          },
        }}
      >
        {mode === 'light' ? <DarkMode /> : <LightMode />}
      </IconButton>

      {/* Left Side - Illustration & Branding */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          p: 6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <Box
          sx={{
            position: 'absolute',
            top: '-10%',
            right: '-5%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: alpha('#fff', 0.1),
            filter: 'blur(80px)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '-10%',
            left: '-5%',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            background: alpha('#fff', 0.1),
            filter: 'blur(80px)',
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: '500px', textAlign: 'center' }}>
          {/* CRM Illustration SVG */}
          <Box sx={{ mb: 4 }}>
            <svg
              viewBox="0 0 400 300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '100%', height: 'auto', maxWidth: '400px' }}
            >
              {/* Dashboard/Screen */}
              <rect x="50" y="40" width="300" height="180" rx="8" fill="white" fillOpacity="0.95" />
              <rect x="50" y="40" width="300" height="40" rx="8" fill="#667eea" />

              {/* Header dots */}
              <circle cx="70" cy="60" r="4" fill="white" fillOpacity="0.8" />
              <circle cx="85" cy="60" r="4" fill="white" fillOpacity="0.8" />
              <circle cx="100" cy="60" r="4" fill="white" fillOpacity="0.8" />

              {/* Chart/Analytics */}
              <rect x="70" y="100" width="120" height="100" rx="4" fill="#f0f4ff" />
              <path d="M 80 180 L 100 160 L 120 170 L 140 145 L 160 150 L 180 130" stroke="#667eea" strokeWidth="3" fill="none" />
              <circle cx="80" cy="180" r="4" fill="#667eea" />
              <circle cx="100" cy="160" r="4" fill="#667eea" />
              <circle cx="120" cy="170" r="4" fill="#667eea" />
              <circle cx="140" cy="145" r="4" fill="#667eea" />
              <circle cx="160" cy="150" r="4" fill="#667eea" />
              <circle cx="180" cy="130" r="4" fill="#667eea" />

              {/* Cards/Info boxes */}
              <rect x="210" y="100" width="120" height="45" rx="4" fill="#e8f0fe" />
              <rect x="210" y="155" width="120" height="45" rx="4" fill="#fce8f3" />

              {/* People/Users */}
              <circle cx="100" cy="250" r="20" fill="white" fillOpacity="0.9" />
              <circle cx="100" cy="245" r="7" fill="#667eea" />
              <path d="M 85 260 Q 100 255 115 260" fill="#667eea" />

              <circle cx="150" cy="250" r="20" fill="white" fillOpacity="0.9" />
              <circle cx="150" cy="245" r="7" fill="#764ba2" />
              <path d="M 135 260 Q 150 255 165 260" fill="#764ba2" />

              <circle cx="200" cy="250" r="20" fill="white" fillOpacity="0.9" />
              <circle cx="200" cy="245" r="7" fill="#667eea" />
              <path d="M 185 260 Q 200 255 215 260" fill="#667eea" />

              {/* Connection lines */}
              <path d="M 120 250 L 130 250" stroke="white" strokeWidth="2" strokeDasharray="4 2" />
              <path d="M 170 250 L 180 250" stroke="white" strokeWidth="2" strokeDasharray="4 2" />

              {/* Checkmark badge */}
              <circle cx="320" cy="50" r="25" fill="#10b981" />
              <path d="M 310 50 L 317 57 L 330 44" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>

          {/* Branding Text */}
          <Typography variant="h3" fontWeight={800} gutterBottom>
            CRM Pro
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.95, fontWeight: 400 }}>
            Streamline Your Customer Relationships
          </Typography>

          {/* Features */}
          <Stack spacing={2} alignItems="flex-start" sx={{ maxWidth: '400px', mx: 'auto' }}>
            {[
              { icon: <People />, text: 'Manage contacts & leads effectively' },
              { icon: <TrendingUp />, text: 'Track sales & revenue growth' },
              { icon: <Assessment />, text: 'Powerful analytics & insights' },
              { icon: <CheckCircle />, text: 'Automate workflows & tasks' },
            ].map((feature, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: alpha('#fff', 0.2),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {React.cloneElement(feature.icon, { sx: { fontSize: 20 } })}
                </Box>
                <Typography variant="body1">{feature.text}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* Right Side - Login Form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: { xs: 3, sm: 4, md: 6 },
          bgcolor: mode === 'light' ? 'white' : 'grey.900',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: '480px' }}>
          {/* Logo for mobile */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 5 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
              }}
            >
              <BusinessCenter sx={{ fontSize: 36 }} />
            </Box>
          </Box>

          {/* Header */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h3" fontWeight={800} gutterBottom sx={{ letterSpacing: '-0.5px' }}>
              Welcome Back
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
              Please sign in to your account to continue
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 2,
                '& .MuiAlert-icon': {
                  fontSize: 24,
                },
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={formik.handleSubmit}>
            <Stack spacing={3}>
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  gutterBottom
                  sx={{ mb: 1, color: 'text.primary' }}
                >
                  Email Address
                </Typography>
                <TextField
                  fullWidth
                  id="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email sx={{ color: 'action.active', fontSize: 22 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: mode === 'light' ? 'grey.50' : 'grey.800',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: mode === 'light' ? 'grey.100' : 'grey.750',
                      },
                      '&.Mui-focused': {
                        backgroundColor: mode === 'light' ? 'white' : 'grey.800',
                        boxShadow: `0 0 0 3px ${alpha('#667eea', 0.1)}`,
                      },
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 1.5,
                      fontSize: '1rem',
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  gutterBottom
                  sx={{ mb: 1, color: 'text.primary' }}
                >
                  Password
                </Typography>
                <TextField
                  fullWidth
                  id="password"
                  name="password"
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
                        <Lock sx={{ color: 'action.active', fontSize: 22 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={isLoading}
                          sx={{
                            '&:hover': {
                              backgroundColor: alpha('#667eea', 0.1),
                            },
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
                      backgroundColor: mode === 'light' ? 'grey.50' : 'grey.800',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: mode === 'light' ? 'grey.100' : 'grey.750',
                      },
                      '&.Mui-focused': {
                        backgroundColor: mode === 'light' ? 'white' : 'grey.800',
                        boxShadow: `0 0 0 3px ${alpha('#667eea', 0.1)}`,
                      },
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 1.5,
                      fontSize: '1rem',
                    },
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
                  py: 1.75,
                  mt: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  textTransform: 'none',
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.35)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                    boxShadow: '0 12px 32px rgba(102, 126, 234, 0.45)',
                    transform: 'translateY(-2px)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                    boxShadow: 'none',
                  },
                }}
              >
                {isLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' },
                        },
                      }}
                    />
                    Signing In...
                  </Box>
                ) : (
                  'Sign In'
                )}
              </Button>
            </Stack>
          </form>

          {/* Footer Text */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Typography
                component="span"
                variant="body2"
                sx={{
                  color: '#667eea',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                Contact Administrator
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
