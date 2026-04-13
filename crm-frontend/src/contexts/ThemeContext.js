import { createContext, useState, useMemo, useEffect, useContext } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Fixed brand colors — professional navy + blue
const brandColor = { primary: '#2563EB', secondary: '#3B82F6', text: '#FFFFFF' };

export const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
  accentColor: brandColor,
});

// Hook to use theme context
export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeContextProvider');
  }
  return context;
};

// Function to lighten a hex color
const lightenColor = (hex, percent) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
};

// Function to darken a hex color
const darkenColor = (hex, percent) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (
    0x1000000 +
    (R > 0 ? R : 0) * 0x10000 +
    (G > 0 ? G : 0) * 0x100 +
    (B > 0 ? B : 0)
  ).toString(16).slice(1);
};

const getDesignTokens = (mode, accentColor) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          primary: {
            main: accentColor.primary,
            light: accentColor.secondary,
            dark: darkenColor(accentColor.primary, 15),
            contrastText: accentColor.text,
          },
          secondary: {
            main: accentColor.secondary,
            light: lightenColor(accentColor.secondary, 15),
            dark: accentColor.primary,
            contrastText: accentColor.text,
          },
          success: { main: '#10b981', light: '#34d399', dark: '#059669' },
          warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
          error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
          info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
          background: {
            default: 'transparent',
            paper: 'rgba(255, 255, 255, 0.55)',
          },
          text: { primary: '#1e293b', secondary: '#64748b' },
          divider: 'rgba(255, 255, 255, 0.4)',
        }
      : {
          primary: {
            main: accentColor.secondary,
            light: lightenColor(accentColor.secondary, 15),
            dark: accentColor.primary,
            contrastText: accentColor.text,
          },
          secondary: {
            main: lightenColor(accentColor.secondary, 10),
            light: lightenColor(accentColor.secondary, 20),
            dark: accentColor.secondary,
            contrastText: accentColor.text,
          },
          success: { main: '#34d399', light: '#6ee7b7', dark: '#10b981' },
          warning: { main: '#fbbf24', light: '#fcd34d', dark: '#f59e0b' },
          error: { main: '#f87171', light: '#fca5a5', dark: '#ef4444' },
          info: { main: '#60a5fa', light: '#93c5fd', dark: '#3b82f6' },
          background: {
            default: 'transparent',
            paper: 'rgba(15, 23, 42, 0.6)',
          },
          text: { primary: '#f1f5f9', secondary: '#94a3b8' },
          divider: 'rgba(255, 255, 255, 0.08)',
        }),
  },
  typography: {
    fontFamily: '"Poppins", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    h1: { fontSize: '2rem', fontWeight: 700 },
    h2: { fontSize: '1.65rem', fontWeight: 700 },
    h3: { fontSize: '1.4rem', fontWeight: 600 },
    h4: { fontSize: '1.2rem', fontWeight: 600 },
    h5: { fontSize: '1.05rem', fontWeight: 600 },
    h6: { fontSize: '0.92rem', fontWeight: 600 },
    body1: { fontSize: '0.9rem' },
    body2: { fontSize: '0.84rem' },
    caption: { fontSize: '0.75rem' },
    overline: { fontSize: '0.7rem' },
    subtitle1: { fontSize: '0.95rem', fontWeight: 600 },
    subtitle2: { fontSize: '0.85rem', fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: mode === 'light'
            ? `linear-gradient(135deg, ${lightenColor(accentColor.primary, 42)} 0%, #f0f4f8 25%, ${lightenColor(accentColor.secondary, 44)} 50%, #f8f0f4 75%, ${lightenColor(accentColor.primary, 46)} 100%)`
            : `linear-gradient(135deg, #0c1222 0%, ${darkenColor(accentColor.primary, 35)} 25%, #0f172a 50%, ${darkenColor(accentColor.secondary, 35)} 75%, #0c1222 100%)`,
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '6px 16px',
          fontSize: '0.84rem',
          transition: 'all 0.25s ease',
        },
        contained: {
          background: `linear-gradient(135deg, ${accentColor.primary} 0%, ${accentColor.secondary} 100%)`,
          boxShadow: `0 4px 15px ${accentColor.primary}30`,
          '&:hover': {
            background: `linear-gradient(135deg, ${darkenColor(accentColor.primary, 8)} 0%, ${accentColor.primary} 100%)`,
            boxShadow: `0 6px 20px ${accentColor.primary}40`,
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: mode === 'light'
            ? `${accentColor.primary}40`
            : `${accentColor.secondary}40`,
          backdropFilter: 'blur(8px)',
          background: mode === 'light'
            ? 'rgba(255, 255, 255, 0.4)'
            : 'rgba(255, 255, 255, 0.05)',
          '&:hover': {
            borderColor: accentColor.primary,
            background: mode === 'light'
              ? `${accentColor.primary}10`
              : `${accentColor.primary}15`,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: mode === 'light'
            ? 'rgba(255, 255, 255, 0.55)'
            : 'rgba(30, 41, 59, 0.50)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: mode === 'light'
            ? '1px solid rgba(255, 255, 255, 0.6)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12,
          boxShadow: mode === 'light'
            ? '0 2px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
            : '0 2px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
          transition: 'all 0.3s ease',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: mode === 'light'
            ? 'rgba(255, 255, 255, 0.50)'
            : 'rgba(30, 41, 59, 0.45)',
          backdropFilter: 'blur(12px) saturate(150%)',
          WebkitBackdropFilter: 'blur(12px) saturate(150%)',
          border: mode === 'light'
            ? '1px solid rgba(255, 255, 255, 0.5)'
            : '1px solid rgba(255, 255, 255, 0.06)',
        },
        elevation0: {
          background: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          border: 'none',
        },
        elevation1: {
          boxShadow: mode === 'light'
            ? '0 2px 12px rgba(0, 0, 0, 0.05)'
            : '0 2px 12px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: mode === 'light'
            ? 'rgba(255, 255, 255, 0.80)'
            : 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: mode === 'light'
            ? '1px solid rgba(255, 255, 255, 0.6)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 14,
          boxShadow: mode === 'light'
            ? '0 16px 40px rgba(0, 0, 0, 0.1)'
            : '0 16px 40px rgba(0, 0, 0, 0.45)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.25s ease',
            background: mode === 'light'
              ? 'rgba(255, 255, 255, 0.5)'
              : 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(8px)',
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: `${accentColor.primary}60`,
              },
            },
            '&.Mui-focused': {
              background: mode === 'light'
                ? 'rgba(255, 255, 255, 0.7)'
                : 'rgba(255, 255, 255, 0.07)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: accentColor.primary,
                borderWidth: '1.5px',
              },
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: mode === 'light'
              ? 'rgba(0, 0, 0, 0.1)'
              : 'rgba(255, 255, 255, 0.1)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '14px 16px',
          '&:last-child': { paddingBottom: '14px' },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '16px 22px',
          fontSize: '1.05rem',
          fontWeight: 600,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '12px 22px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 22px 16px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '7px 12px',
          fontSize: '0.84rem',
        },
        head: {
          fontSize: '0.78rem',
          fontWeight: 600,
          padding: '9px 12px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: '0.76rem',
          height: 26,
          backdropFilter: 'blur(8px)',
          border: mode === 'light'
            ? '1px solid rgba(255, 255, 255, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.08)',
        },
        sizeSmall: {
          height: 22,
          fontSize: '0.72rem',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          background: mode === 'light'
            ? 'rgba(255, 255, 255, 0.45)'
            : 'rgba(30, 41, 59, 0.40)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: mode === 'light'
            ? '1px solid rgba(255, 255, 255, 0.5)'
            : '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            background: mode === 'light'
              ? `${accentColor.primary}0A`
              : 'rgba(255, 255, 255, 0.03)',
            borderBottom: mode === 'light'
              ? '1px solid rgba(0, 0, 0, 0.06)'
              : '1px solid rgba(255, 255, 255, 0.06)',
            fontWeight: 600,
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: accentColor.primary,
            '& + .MuiSwitch-track': {
              backgroundColor: accentColor.primary,
            },
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: accentColor.primary,
          height: 3,
          borderRadius: 3,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            color: accentColor.primary,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(12px)',
          borderRadius: 8,
          padding: '4px 12px',
          fontSize: '0.8rem',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: mode === 'light'
            ? 'rgba(255, 255, 255, 0.82) !important'
            : 'rgba(30, 41, 59, 0.88) !important',
          backdropFilter: 'blur(20px) saturate(180%) !important',
          WebkitBackdropFilter: 'blur(20px) saturate(180%) !important',
          border: mode === 'light'
            ? '1px solid rgba(255, 255, 255, 0.5) !important'
            : '1px solid rgba(255, 255, 255, 0.08) !important',
          borderRadius: '14px !important',
          boxShadow: mode === 'light'
            ? '0 8px 32px rgba(0, 0, 0, 0.1) !important'
            : '0 8px 32px rgba(0, 0, 0, 0.4) !important',
        },
      },
    },
  },
});

export const ThemeContextProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('themeMode');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const accentColor = brandColor;

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    document.body.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleTheme = () => setMode(prev => prev === 'light' ? 'dark' : 'light');

  const theme = useMemo(() => createTheme(getDesignTokens(mode, accentColor)), [mode]);

  const contextValue = useMemo(() => ({
    mode,
    toggleTheme,
    accentColor,
  }), [mode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
