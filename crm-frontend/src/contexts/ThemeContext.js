import React, { createContext, useState, useMemo, useEffect, useContext } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Premium color palette
export const premiumColors = [
  { name: 'Royal Indigo', primary: '#6366F1', secondary: '#818CF8', text: '#FFFFFF' },
  { name: 'Ocean Blue', primary: '#0EA5E9', secondary: '#38BDF8', text: '#FFFFFF' },
  { name: 'Emerald', primary: '#10B981', secondary: '#34D399', text: '#FFFFFF' },
  { name: 'Sunset Orange', primary: '#F97316', secondary: '#FB923C', text: '#FFFFFF' },
  { name: 'Rose Pink', primary: '#EC4899', secondary: '#F472B6', text: '#FFFFFF' },
  { name: 'Purple Haze', primary: '#8B5CF6', secondary: '#A78BFA', text: '#FFFFFF' },
  { name: 'Crimson', primary: '#DC2626', secondary: '#EF4444', text: '#FFFFFF' },
  { name: 'Teal', primary: '#14B8A6', secondary: '#2DD4BF', text: '#FFFFFF' },
  { name: 'Amber Gold', primary: '#D97706', secondary: '#FBBF24', text: '#1F2937' },
  { name: 'Slate', primary: '#475569', secondary: '#64748B', text: '#FFFFFF' },
];

// Default accent color
const defaultAccentColor = premiumColors[0];

export const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
  accentColor: defaultAccentColor,
  setAccentColor: () => {},
  applyAccentColor: () => {},
  pendingAccentColor: defaultAccentColor,
  setPendingAccentColor: () => {},
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
          // Light mode colors with dynamic accent
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
          success: {
            main: '#10b981',
            light: '#34d399',
            dark: '#059669',
          },
          warning: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#d97706',
          },
          error: {
            main: '#ef4444',
            light: '#f87171',
            dark: '#dc2626',
          },
          info: {
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#2563eb',
          },
          background: {
            default: '#f8f9fa',
            paper: '#ffffff',
          },
          text: {
            primary: '#1f2937',
            secondary: '#6b7280',
          },
          divider: 'rgba(0, 0, 0, 0.08)',
        }
      : {
          // Dark mode colors with dynamic accent
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
          success: {
            main: '#34d399',
            light: '#6ee7b7',
            dark: '#10b981',
          },
          warning: {
            main: '#fbbf24',
            light: '#fcd34d',
            dark: '#f59e0b',
          },
          error: {
            main: '#f87171',
            light: '#fca5a5',
            dark: '#ef4444',
          },
          info: {
            main: '#60a5fa',
            light: '#93c5fd',
            dark: '#3b82f6',
          },
          background: {
            default: '#0f172a',
            paper: '#1e293b',
          },
          text: {
            primary: '#f1f5f9',
            secondary: '#cbd5e1',
          },
          divider: 'rgba(255, 255, 255, 0.08)',
        }),
  },
  typography: {
    fontFamily: '"Poppins", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700 },
    h2: { fontSize: '2rem', fontWeight: 700 },
    h3: { fontSize: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.5rem', fontWeight: 600 },
    h5: { fontSize: '1.25rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '8px 20px',
        },
        contained: {
          boxShadow: mode === 'light'
            ? `0 2px 8px ${accentColor.primary}40`
            : '0 2px 8px rgba(0, 0, 0, 0.4)',
          '&:hover': {
            boxShadow: mode === 'light'
              ? `0 4px 12px ${accentColor.primary}50`
              : '0 4px 12px rgba(0, 0, 0, 0.5)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: mode === 'light'
            ? '0px 2px 12px rgba(0,0,0,0.06)'
            : '0px 2px 12px rgba(0,0,0,0.4)',
          borderRadius: 12,
          border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: mode === 'light'
            ? '0px 2px 8px rgba(0,0,0,0.06)'
            : '0px 2px 8px rgba(0,0,0,0.4)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease',
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: mode === 'light' ? `${accentColor.primary}50` : `${accentColor.secondary}50`,
              },
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
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
  },
});

export const ThemeContextProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem('themeMode');
      if (savedMode === 'light' || savedMode === 'dark') {
        return savedMode;
      }
      return 'light';
    } catch (error) {
      console.error('Error loading theme from localStorage:', error);
      return 'light';
    }
  });

  const [accentColor, setAccentColor] = useState(() => {
    try {
      const savedAccent = localStorage.getItem('accentColor');
      if (savedAccent) {
        const parsed = JSON.parse(savedAccent);
        // Validate it's a valid accent color
        const found = premiumColors.find(c => c.name === parsed.name);
        if (found) return found;
      }
      return defaultAccentColor;
    } catch (error) {
      console.error('Error loading accent color from localStorage:', error);
      return defaultAccentColor;
    }
  });

  // Pending accent color for preview before applying
  const [pendingAccentColor, setPendingAccentColor] = useState(accentColor);

  useEffect(() => {
    try {
      localStorage.setItem('themeMode', mode);
      document.body.setAttribute('data-theme', mode);
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', mode === 'dark' ? '#0f172a' : accentColor.primary);
      }
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
  }, [mode, accentColor]);

  useEffect(() => {
    try {
      localStorage.setItem('accentColor', JSON.stringify(accentColor));
    } catch (error) {
      console.error('Error saving accent color to localStorage:', error);
    }
  }, [accentColor]);

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      return newMode;
    });
  };

  const applyAccentColor = () => {
    setAccentColor(pendingAccentColor);
  };

  const theme = useMemo(() => createTheme(getDesignTokens(mode, accentColor)), [mode, accentColor]);

  const contextValue = useMemo(() => ({
    mode,
    toggleTheme,
    accentColor,
    setAccentColor,
    applyAccentColor,
    pendingAccentColor,
    setPendingAccentColor,
  }), [mode, accentColor, pendingAccentColor]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
