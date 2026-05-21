import React from 'react';
import { Box, Typography } from '@mui/material';
import leadMatrixLogo from '../assets/Lead-Matrix-Logo.png';

// LeadMatrixLoader — branded loading state shown while the app
// boots / hydrates session / fetches its first payload. Matches the
// reference: a central brand badge with three orbiting dots and a
// soft cream→copper background gradient.
//
// Props:
//   message    — optional override for the line below the loader.
//                Defaults to "Loading your workspace…".
//   subMessage — small grey line for extra context.
//   fullScreen — when true (default) covers the whole viewport with
//                position:fixed. Set to false for in-page use where
//                the loader should fill its parent (e.g. inside a
//                Card or after the page header).

const COPPER = '#C08552';
const BROWN = '#3E2723';
const CREAM = '#FFF8F0';

const LeadMatrixLoader = ({
  message = 'Loading your workspace…',
  subMessage,
  fullScreen = true,
}) => (
  <Box
    sx={{
      // Two positioning modes — `fixed` for the boot curtain & route
      // transitions, plain (full-block) for inline placement so the
      // page header stays visible above it.
      ...(fullScreen
        ? { position: 'fixed', inset: 0, zIndex: 9999 }
        : { position: 'relative', width: '100%', minHeight: 480 }),
      bgcolor: CREAM,
      background: `linear-gradient(135deg, ${CREAM} 0%, #FBEFE0 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    }}
  >
    {/* CSS-only orbit. Three dots ride a 110px circle around a centred
        logo at three different speeds — clean and brand-safe. The
        keyframes live in a <style> tag so we don't have to touch
        global CSS. */}
    <style>{`
      @keyframes lmx-orbit-a { from { transform: rotate(0deg) translateX(55px) rotate(0deg); } to { transform: rotate(360deg) translateX(55px) rotate(-360deg); } }
      @keyframes lmx-orbit-b { from { transform: rotate(120deg) translateX(55px) rotate(-120deg); } to { transform: rotate(480deg) translateX(55px) rotate(-480deg); } }
      @keyframes lmx-orbit-c { from { transform: rotate(240deg) translateX(55px) rotate(-240deg); } to { transform: rotate(600deg) translateX(55px) rotate(-600deg); } }
      @keyframes lmx-pulse  { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
    `}</style>

    <Box
      sx={{
        position: 'relative',
        width: 140,
        height: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Faint guide circle the dots ride on */}
      <Box
        sx={{
          position: 'absolute',
          inset: 14,
          borderRadius: '50%',
          border: `1px dashed ${COPPER}50`,
        }}
      />

      {/* Centre badge — Lead Matrix logo on a copper tint */}
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: '#fff',
          boxShadow: `0 4px 20px ${COPPER}55`,
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
            width: 50,
            height: 50,
            objectFit: 'contain',
            objectPosition: 'left center',
            // Crop to the symbol side of the wordmark so the small disc
            // shows the icon, not the text.
            transform: 'scale(2.1)',
            transformOrigin: 'left center',
          }}
        />
      </Box>

      {/* Three orbiting dots. Each is absolutely positioned at the
          centre, then translated outward and rotated by its keyframe.
          Different sizes give the orbit visual rhythm. */}
      {[
        { sz: 12, color: COPPER, dur: 2.2, anim: 'lmx-orbit-a' },
        { sz: 8, color: BROWN, dur: 2.8, anim: 'lmx-orbit-b' },
        { sz: 6, color: `${COPPER}AA`, dur: 3.4, anim: 'lmx-orbit-c' },
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
            animation: `${d.anim} ${d.dur}s linear infinite`,
          }}
        />
      ))}
    </Box>

    <Box sx={{ textAlign: 'center' }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: BROWN, letterSpacing: 0.2 }}>
        {message}
      </Typography>
      {subMessage && (
        <Typography sx={{ fontWeight: 500, fontSize: '0.78rem', color: 'text.secondary', mt: 0.5 }}>
          {subMessage}
        </Typography>
      )}
    </Box>
  </Box>
);

export default LeadMatrixLoader;
