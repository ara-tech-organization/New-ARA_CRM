import { createContext, useMemo, useEffect, useContext } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// ─────────────────────────────────────────────────────────────────
// Global identity — Navy + Gold.
// Every MUI-consuming screen picks these up through the palette
// below. Any component that reads `theme.palette.primary.main` gets
// deep navy automatically; `secondary.main` returns the signature
// gold. Inline hex values across the app map back to these tokens.
// ─────────────────────────────────────────────────────────────────
export const BRAND = {
  primary:     '#1F3966', // Signature Navy
  primaryDeep: '#15294D',
  primarySoft: '#E4EAF3',
  slate:       '#0F172A',
  slateSoft:   '#F1F5F9',
  accent:      '#F4B929', // Signature Gold
  accentDeep:  '#C68C0A',
  accentSoft:  '#FDF2C7',
  background:  '#F8FAFC',
  surface:     '#FFFFFF',
  border:      '#E2E8F0',
  borderStrong:'#CBD5E1',
  ink:         '#0F172A',
  inkMuted:    '#475569',
  inkFaint:    '#94A3B8',
  success:     '#22C55E',
  successSoft: '#DCFCE7',
  warning:     '#F59E0B',
  warningSoft: '#FEF3C7',
  danger:      '#EF4444',
  dangerSoft:  '#FEE2E2',
  info:        '#3B82F6',
  infoSoft:    '#E4EAF3',
};

// Back-compat shape (legacy consumers still read accentColor).
const brandColor = { primary: BRAND.primary, secondary: BRAND.accent, text: BRAND.slate };

export const ThemeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
  accentColor: brandColor,
});

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeContextProvider');
  }
  return context;
};

const getDesignTokens = () => ({
  palette: {
    mode: 'light',
    primary:   { main: BRAND.primary, light: '#3E5A8C', dark: BRAND.primaryDeep, contrastText: '#FFFFFF' },
    secondary: { main: BRAND.accent,  light: '#F7CB57', dark: BRAND.accentDeep,  contrastText: BRAND.ink },
    success:   { main: BRAND.success, light: '#4ADE80', dark: '#16A34A', contrastText: '#FFFFFF' },
    warning:   { main: BRAND.warning, light: '#FBBF24', dark: '#D97706', contrastText: '#FFFFFF' },
    error:     { main: BRAND.danger,  light: '#F87171', dark: '#DC2626', contrastText: '#FFFFFF' },
    info:      { main: BRAND.info,    light: '#60A5FA', dark: '#1D4ED8', contrastText: '#FFFFFF' },
    background:{ default: BRAND.background, paper: BRAND.surface },
    text:      { primary: BRAND.ink, secondary: BRAND.inkMuted, disabled: BRAND.inkFaint },
    divider:   'rgba(15, 23, 42, 0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    h1: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontSize: '1.2rem', fontWeight: 700 },
    h5: { fontSize: '1.05rem', fontWeight: 700 },
    h6: { fontSize: '0.92rem', fontWeight: 700 },
    body1: { fontSize: '0.9rem' },
    body2: { fontSize: '0.84rem' },
    caption: { fontSize: '0.75rem' },
    overline: { fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 700 },
    subtitle1: { fontSize: '0.95rem', fontWeight: 700 },
    subtitle2: { fontSize: '0.85rem', fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: BRAND.background,
          minHeight: '100vh',
          fontFeatureSettings: '"ss01", "cv11"',
        },
        '::selection': {
          backgroundColor: `${BRAND.primary}33`,
        },
        /* Scrollbar polish — same on every module */
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(15,23,42,0.14)', borderRadius: 999,
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 'rgba(15,23,42,0.24)',
        },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 10,
          padding: '7px 18px',
          fontSize: '0.85rem',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
        },
        contained: {
          backgroundColor: BRAND.primary,
          color: '#FFFFFF',
          boxShadow: `0 4px 12px ${BRAND.primary}33`,
          '&:hover': {
            backgroundColor: BRAND.primaryDeep,
            boxShadow: `0 8px 20px ${BRAND.primary}44`,
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: `${BRAND.primary}40`,
          color: BRAND.primary,
          '&:hover': { borderColor: BRAND.primary, backgroundColor: `${BRAND.primary}08` },
        },
        text: {
          color: BRAND.primary,
          '&:hover': { backgroundColor: `${BRAND.primary}08` },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: BRAND.surface,
          border: `1px solid ${BRAND.border}`,
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: BRAND.surface,
          border: `1px solid ${BRAND.border}`,
        },
        elevation0: { background: 'transparent', border: 'none' },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '18px 20px',
          '&:last-child': { paddingBottom: '18px' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: BRAND.surface,
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(15,23,42,0.20)',
          border: 'none',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { padding: '18px 24px', fontSize: '1.1rem', fontWeight: 800, color: BRAND.ink },
      },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '14px 24px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '14px 24px 18px' } } },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.primary },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: BRAND.primary, borderWidth: '1.5px',
            },
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${BRAND.primary}20` },
          },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.border },
          '& .MuiInputLabel-root.Mui-focused': { color: BRAND.primary },
        },
      },
    },
    MuiSelect: { styleOverrides: { outlined: { borderRadius: 10 } } },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '10px 14px', fontSize: '0.85rem',
          borderBottom: `1px solid ${BRAND.border}`,
        },
        head: {
          fontSize: '0.68rem', fontWeight: 800,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          color: BRAND.inkMuted, padding: '11px 14px',
          background: BRAND.background,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: BRAND.surface, borderRadius: 12,
          border: `1px solid ${BRAND.border}`,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: BRAND.background,
            borderBottom: `2px solid ${BRAND.border}`,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: '0.72rem', height: 24, borderRadius: 999 },
        sizeSmall: { height: 20, fontSize: '0.68rem' },
        colorPrimary:   { backgroundColor: BRAND.primarySoft, color: BRAND.primaryDeep },
        colorSecondary: { backgroundColor: BRAND.accentSoft,  color: BRAND.accentDeep },
        colorSuccess:   { backgroundColor: BRAND.successSoft, color: '#15803D' },
        colorWarning:   { backgroundColor: BRAND.warningSoft, color: '#B45309' },
        colorError:     { backgroundColor: BRAND.dangerSoft,  color: '#B91C1C' },
        colorInfo:      { backgroundColor: BRAND.infoSoft,    color: BRAND.primaryDeep },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: BRAND.primary,
            '& + .MuiSwitch-track': { backgroundColor: BRAND.primary },
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 700,
          borderColor: BRAND.border, color: BRAND.inkMuted,
          '&.Mui-selected': {
            backgroundColor: BRAND.primary, color: '#FFFFFF',
            '&:hover': { backgroundColor: BRAND.primaryDeep },
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: BRAND.accent, height: 3, borderRadius: 3 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 700, color: BRAND.inkMuted,
          '&.Mui-selected': { color: BRAND.ink },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, padding: '8px 14px', fontSize: '0.82rem', fontWeight: 500 },
        standardSuccess: { backgroundColor: BRAND.successSoft, color: '#166534' },
        standardWarning: { backgroundColor: BRAND.warningSoft, color: '#92400E' },
        standardError:   { backgroundColor: BRAND.dangerSoft,  color: '#991B1B' },
        standardInfo:    { backgroundColor: BRAND.infoSoft,    color: BRAND.primaryDeep },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: `${BRAND.surface} !important`,
          border: `1px solid ${BRAND.border} !important`,
          borderRadius: '12px !important',
          boxShadow: '0 12px 32px rgba(15,23,42,0.12) !important',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: `1px solid ${BRAND.border}`,
          boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.86rem', fontWeight: 500,
          '&.Mui-selected': {
            backgroundColor: `${BRAND.primary}0F`,
            '&:hover': { backgroundColor: `${BRAND.primary}18` },
          },
          '&:hover': { backgroundColor: `${BRAND.primary}08` },
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: { fontSize: '0.78rem', color: BRAND.inkMuted, minHeight: 46 },
        selectLabel: { fontSize: '0.78rem' },
        displayedRows: { fontSize: '0.78rem' },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          fontWeight: 700, borderRadius: 8,
          '&.Mui-selected': {
            backgroundColor: BRAND.primary, color: '#FFFFFF',
            '&:hover': { backgroundColor: BRAND.primaryDeep },
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(15,23,42,0.06)', borderRadius: 999 },
        bar: { backgroundColor: BRAND.primary },
      },
    },
    MuiCircularProgress: { styleOverrides: { colorPrimary: { color: BRAND.primary } } },
    MuiIconButton: {
      styleOverrides: {
        root: { transition: 'background 0.15s ease, color 0.15s ease' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: BRAND.slate,
          fontSize: '0.72rem', borderRadius: 8, padding: '6px 10px', fontWeight: 500,
        },
        arrow: { color: BRAND.slate },
      },
    },
    MuiCheckbox: {
      styleOverrides: { root: { '&.Mui-checked': { color: BRAND.primary } } },
    },
    MuiRadio: {
      styleOverrides: { root: { '&.Mui-checked': { color: BRAND.primary } } },
    },
  },
});

export const ThemeContextProvider = ({ children }) => {
  const mode = 'light';
  const accentColor = brandColor;

  useEffect(() => {
    try { localStorage.removeItem('themeMode'); } catch {}
    document.body.setAttribute('data-theme', 'light');
  }, []);

  const toggleTheme = () => {};

  const theme = useMemo(() => createTheme(getDesignTokens()), []);

  const contextValue = useMemo(() => ({ mode, toggleTheme, accentColor }), [accentColor]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
