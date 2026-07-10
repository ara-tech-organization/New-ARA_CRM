import React from 'react';
import { Box, Typography } from '@mui/material';
import leadMatrixLogo from '../assets/Lead-Matrix-Logo.png';

// LeadMatrixLoader — branded loading state shown while the app boots
// / hydrates session / fetches its first payload. Refreshed for the
// Navy + Slate + Gold identity: soft off-white → indigo gradient
// ground, blue orbit ring, gold accent dot.
//
// Props:
//   message    — line below the loader ("Loading your workspace…")
//   subMessage — optional secondary line
//   fullScreen — true = fixed overlay; false = fills parent block

const PRIMARY = '#1F3966';
const PRIMARY_DEEP = '#15294D';
const ACCENT = '#F4B929';
const INK = '#0F172A';
const GROUND = '#F8FAFC';
const GROUND_TINT = '#F1F5F9';

const LeadMatrixLoader = ({
  message = 'Loading your workspace…',
  subMessage,
  fullScreen = true,
}) => (
  <Box
    sx={{
      ...(fullScreen
        ? { position: 'fixed', inset: 0, zIndex: 9999 }
        : { position: 'relative', width: '100%', minHeight: 480 }),
      bgcolor: GROUND,
      background: `radial-gradient(circle at 30% 20%, ${GROUND_TINT} 0%, ${GROUND} 60%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    }}
  >
    <style>{`
      @keyframes lmx-orbit-a { from { transform: rotate(0deg) translateX(58px) rotate(0deg); } to { transform: rotate(360deg) translateX(58px) rotate(-360deg); } }
      @keyframes lmx-orbit-b { from { transform: rotate(120deg) translateX(58px) rotate(-120deg); } to { transform: rotate(480deg) translateX(58px) rotate(-480deg); } }
      @keyframes lmx-orbit-c { from { transform: rotate(240deg) translateX(58px) rotate(-240deg); } to { transform: rotate(600deg) translateX(58px) rotate(-600deg); } }
      @keyframes lmx-pulse   { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
      @keyframes lmx-ring    { 0% { opacity: 0.7; transform: scale(1); } 100% { opacity: 0; transform: scale(1.35); } }
    `}</style>

    <Box
      sx={{
        position: 'relative',
        width: 160,
        height: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outer expanding ring — subtle radar sweep */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${PRIMARY}55`,
          animation: 'lmx-ring 1.8s ease-out infinite',
        }}
      />

      {/* Guide circle the dots ride on */}
      <Box
        sx={{
          position: 'absolute',
          inset: 20,
          borderRadius: '50%',
          border: `1px dashed ${PRIMARY}40`,
        }}
      />

      {/* Centre badge */}
      <Box
        sx={{
          width: 70,
          height: 70,
          borderRadius: '50%',
          bgcolor: '#fff',
          boxShadow: `0 12px 32px ${PRIMARY}44, 0 2px 6px ${PRIMARY}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'lmx-pulse 1.8s ease-in-out infinite',
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={leadMatrixLogo}
          alt="Lead Matrix"
          sx={{
            width: 54,
            height: 54,
            objectFit: 'contain',
            objectPosition: 'left center',
            transform: 'scale(2.1)',
            transformOrigin: 'left center',
          }}
        />
      </Box>

      {/* Three orbiting dots — navy, slate, gold accent */}
      {[
        { sz: 12, color: PRIMARY, dur: 2.2, anim: 'lmx-orbit-a' },
        { sz: 8,  color: INK,     dur: 2.8, anim: 'lmx-orbit-b' },
        { sz: 7,  color: ACCENT,  dur: 3.4, anim: 'lmx-orbit-c' },
      ].map((d, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: d.sz,
            height: d.sz,
            mt: `${-d.sz / 2}px`,
            ml: `${-d.sz / 2}px`,
            borderRadius: '50%',
            bgcolor: d.color,
            boxShadow: `0 0 12px ${d.color}66`,
            animation: `${d.anim} ${d.dur}s linear infinite`,
          }}
        />
      ))}
    </Box>

    <Box sx={{ textAlign: 'center', maxWidth: 360, px: 3 }}>
      <Typography sx={{
        fontWeight: 800, fontSize: '1rem', color: INK,
        letterSpacing: '-0.005em',
      }}>
        {message}
      </Typography>
      {subMessage && (
        <Typography sx={{
          fontWeight: 500, fontSize: '0.8rem',
          color: 'text.secondary', mt: 0.6,
        }}>
          {subMessage}
        </Typography>
      )}
    </Box>
  </Box>
);

export default LeadMatrixLoader;
