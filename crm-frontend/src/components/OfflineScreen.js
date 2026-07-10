import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import WifiIcon from '@mui/icons-material/Wifi';
import RefreshIcon from '@mui/icons-material/Refresh';
import leadMatrixLogo from '../assets/Lead-Matrix--02.png';

// Network Lost screen — shown when the browser reports it's lost the
// connection. Auto-retries every 4 seconds by pinging navigator.onLine
// and calls onRetry as soon as the browser reports the network is
// back. Explicit "Try again" button is available for impatient users.

const PRIMARY = '#1F3966';
const PRIMARY_DEEP = '#15294D';
const ACCENT = '#F4B929';
const INK = '#0F172A';
const INK_MUTED = '#475569';
const GROUND = '#F8FAFC';
const GROUND_TINT = '#F1F5F9';

const OfflineScreen = ({ onRetry }) => {
  const [autoRetrying, setAutoRetrying] = useState(false);
  const [onlineDetected, setOnlineDetected] = useState(false);

  // Poll navigator.onLine every 4s. As soon as it flips true, mark
  // "reconnected" and fire onRetry after a short delay so the user
  // sees the state briefly (feels less flickery).
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      setAutoRetrying(true);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setOnlineDetected(true);
        setTimeout(() => { if (!cancelled) onRetry?.(); }, 600);
        return;
      }
      setTimeout(() => setAutoRetrying(false), 900);
    };
    const id = setInterval(check, 4000);
    // Also listen for the browser's 'online' event for instant recovery.
    const onOnline = () => check();
    window.addEventListener('online', onOnline);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener('online', onOnline); };
  }, [onRetry]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: `radial-gradient(circle at 30% 20%, ${GROUND_TINT} 0%, ${GROUND} 60%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 3,
        textAlign: 'center',
      }}
    >
      <style>{`
        @keyframes off-pulse { 0%,100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.15); opacity: 0.3; } }
      `}</style>

      <Box
        component="img"
        src={leadMatrixLogo}
        alt="Lead Matrix"
        sx={{ height: 46, objectFit: 'contain', mb: 1 }}
      />

      {/* Icon disc with pulsing halo */}
      <Box sx={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          bgcolor: onlineDetected ? `${ACCENT}22` : `${PRIMARY}22`,
          animation: 'off-pulse 2s ease-in-out infinite',
        }} />
        <Box sx={{
          width: 76, height: 76, borderRadius: '50%',
          bgcolor: '#fff',
          border: `1px solid ${onlineDetected ? `${ACCENT}55` : `${PRIMARY}55`}`,
          boxShadow: `0 12px 32px ${(onlineDetected ? ACCENT : PRIMARY)}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: onlineDetected ? ACCENT : PRIMARY,
        }}>
          {onlineDetected ? <WifiIcon sx={{ fontSize: 36 }} /> : <WifiOffIcon sx={{ fontSize: 36 }} />}
        </Box>
      </Box>

      <Box sx={{ maxWidth: 480 }}>
        <Typography sx={{
          fontSize: '1.5rem', fontWeight: 800, color: INK,
          letterSpacing: '-0.01em', mb: 1,
        }}>
          {onlineDetected ? 'Back online' : 'You’re offline'}
        </Typography>
        <Typography sx={{ fontSize: '0.92rem', color: INK_MUTED, lineHeight: 1.55 }}>
          {onlineDetected
            ? 'Reconnecting to the workspace…'
            : 'Leadmatrix couldn’t reach the internet. We’ll retry automatically the moment your connection is back.'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1.8 }}>
          {autoRetrying && !onlineDetected && (
            <>
              <CircularProgress size={14} sx={{ color: PRIMARY }} />
              <Typography sx={{ fontSize: '0.78rem', color: INK_MUTED, fontWeight: 500 }}>
                Auto-retrying…
              </Typography>
            </>
          )}
        </Box>

        <Button
          onClick={onRetry}
          disabled={onlineDetected}
          startIcon={<RefreshIcon />}
          variant="contained"
          sx={{
            mt: 2.4,
            bgcolor: PRIMARY, color: '#fff', fontWeight: 800,
            px: 3, py: 1, borderRadius: 2,
            boxShadow: `0 6px 20px ${PRIMARY}44`,
            '&:hover': { bgcolor: PRIMARY_DEEP },
          }}
        >
          Try again
        </Button>
      </Box>
    </Box>
  );
};

export default OfflineScreen;
