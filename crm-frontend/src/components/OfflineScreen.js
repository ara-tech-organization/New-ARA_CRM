import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import leadMatrixLogo from '../assets/Lead-Matrix--02.png';

// OfflineScreen — full-screen overlay shown when the browser reports
// it has lost its network connection. Matches the brand palette so it
// doesn't feel like a system error. Includes a Retry button that
// triggers a hard reload — useful when the user's network is back but
// the React app hasn't re-fetched yet.

const COPPER = '#C08552';
const BROWN = '#3E2723';
const CREAM = '#FFF8F0';

const OfflineScreen = ({ onRetry }) => (
  <Box
    sx={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: `linear-gradient(135deg, ${CREAM} 0%, #FBEFE0 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      p: 3,
      textAlign: 'center',
    }}
  >
    {/* Brand mark at the top so the user knows this is still our app
        and not a generic browser error page. */}
    <Box
      component="img"
      src={leadMatrixLogo}
      alt="Lead Matrix"
      sx={{ height: 44, objectFit: 'contain', mb: 1 }}
    />

    <Box
      sx={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        bgcolor: '#fff',
        boxShadow: `0 6px 24px ${COPPER}33`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${COPPER}40`,
      }}
    >
      <WifiOffIcon sx={{ fontSize: 44, color: COPPER }} />
    </Box>

    <Box sx={{ maxWidth: 440 }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: BROWN, mb: 1 }}>
        You're offline
      </Typography>
      <Typography sx={{ fontSize: '0.92rem', color: 'text.secondary', lineHeight: 1.55 }}>
        Lead Matrix can't reach the network right now. Check your Wi-Fi or mobile data — the
        page will reconnect automatically once you're back online.
      </Typography>
    </Box>

    <Button
      variant="contained"
      startIcon={<RefreshIcon />}
      onClick={onRetry || (() => window.location.reload())}
      sx={{
        bgcolor: COPPER,
        color: '#fff',
        fontWeight: 700,
        textTransform: 'none',
        px: 3,
        py: 1,
        '&:hover': { bgcolor: COPPER, filter: 'brightness(0.92)' },
      }}
    >
      Retry connection
    </Button>

    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 1 }}>
      You can leave this tab open — we'll reconnect automatically.
    </Typography>
  </Box>
);

export default OfflineScreen;
