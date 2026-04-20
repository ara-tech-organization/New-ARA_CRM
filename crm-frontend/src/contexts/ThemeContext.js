import { createContext, useState, useMemo, useEffect, useContext } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Fixed brand colors — warm cream + copper
const brandColor = { primary: '#FFF8F0', secondary: '#C08552', text: '#3E2723' };

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
            main: '#C08552',
            light: '#D4A574',
            dark: '#8B5E3C',
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: '#C08552',
            light: '#D4A574',
            dark: '#8B5E3C',
            contrastText: '#FFFFFF',
          },
          success: { main: '#10b981', light: '#34d399', dark: '#059669' },
          warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
          error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
          info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
          background: {
            default: '#FFF8F0',
            paper: '#FFFFFF',
          },
          text: { primary: '#3E2723', secondary: '#6D4C41' },
          divider: 'rgba(192, 133, 82, 0.15)',
        }
      : {
          primary: {
            main: '#D4A574',
            light: '#E0BB8F',
            dark: '#C08552',
            contrastText: '#1a1a1a',
          },
          secondary: {
            main: '#D4A574',
            light: '#E0BB8F',
            dark: '#C08552',
            contrastText: '#1a1a1a',
          },
          success: { main: '#34d399', light: '#6ee7b7', dark: '#10b981' },
          warning: { main: '#fbbf24', light: '#fcd34d', dark: '#f59e0b' },
          error: { main: '#f87171', light: '#fca5a5', dark: '#ef4444' },
          info: { main: '#60a5fa', light: '#93c5fd', dark: '#3b82f6' },
          background: {
            default: '#1C1410',
            paper: '#2A1F18',
          },
          text: { primary: '#FFF8F0', secondary: '#D4A574' },
          divider: 'rgba(208, 165, 116, 0.15)',
        }),
  },
  typography: {
    fontFamily: '"Poppins", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    h1: { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '2rem', fontWeight: 700 },
    h2: { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.65rem', fontWeight: 700 },
    h3: { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.4rem', fontWeight: 600 },
    h4: { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.2rem', fontWeight: 600 },
    h5: { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '1.05rem', fontWeight: 600 },
    h6: { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '0.92rem', fontWeight: 600 },
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
          background: mode === 'light' ? '#FFF8F0' : '#1C1410',
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
          backgroundColor: '#C08552',
          color: '#FFFFFF',
          boxShadow: '0 2px 8px rgba(192, 133, 82, 0.25)',
          '&:hover': {
            backgroundColor: '#8B5E3C',
            boxShadow: '0 4px 12px rgba(192, 133, 82, 0.35)',
          },
        },
        outlined: {
          borderColor: '#C0855240',
          color: '#C08552',
          '&:hover': {
            borderColor: '#C08552',
            backgroundColor: '#C0855208',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#2A1F18',
          border: mode === 'light' ? '1px solid #C0855215' : '1px solid rgba(208,165,116,0.1)',
          borderRadius: 10,
          boxShadow: mode === 'light' ? '0 1px 8px rgba(0,0,0,0.04)' : '0 1px 8px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#2A1F18',
          border: mode === 'light' ? '1px solid #C0855210' : '1px solid rgba(208,165,116,0.08)',
        },
        elevation0: { background: 'transparent', border: 'none' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#2A1F18',
          borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#C08552',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#C08552',
              borderWidth: '1.5px',
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
        },
        sizeSmall: { height: 22, fontSize: '0.72rem' },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#2A1F18',
          borderRadius: 8,
          border: mode === 'light' ? '1px solid #C0855210' : '1px solid rgba(208,165,116,0.08)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: mode === 'light' ? '#FFF8F0' : '#1C1410',
            borderBottom: mode === 'light' ? '1px solid #C0855215' : '1px solid rgba(208,165,116,0.1)',
            fontWeight: 600,
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#C08552',
            '& + .MuiSwitch-track': { backgroundColor: '#C08552' },
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: '#C08552', height: 3, borderRadius: 3 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { '&.Mui-selected': { color: '#C08552' } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '4px 12px', fontSize: '0.8rem' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'light' ? '#FFFFFF !important' : '#2A1F18 !important',
          border: mode === 'light' ? '1px solid #C0855215 !important' : '1px solid rgba(208,165,116,0.1) !important',
          borderRadius: '10px !important',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1) !important',
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
