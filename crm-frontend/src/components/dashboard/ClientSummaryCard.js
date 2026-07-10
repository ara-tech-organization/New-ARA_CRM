import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  Groups as ClientsIcon,
  Facebook as MetaIcon,
  Layers as BothIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtNum } from './theme';

// Compact top-right Client Summary. Four stat rows — Total / Meta /
// Google / Both — each individually clickable and opening the modal
// pre-filtered to that platform group.

const StatRow = ({ label, value, icon, tone, onClick }) => (
  <Box
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation(); onClick?.();
      }
    }}
    sx={{
      display: 'grid',
      gridTemplateColumns: '22px 1fr auto',
      alignItems: 'center', gap: 1,
      px: 0.9, py: 0.65,
      borderRadius: 1,
      cursor: 'pointer',
      transition: 'background 0.15s ease',
      '&:hover': { bgcolor: `${tone}10` },
      '&:focus-visible': { outline: `2px solid ${tone}`, outlineOffset: -1 },
    }}
  >
    <Box sx={{
      width: 22, height: 22, borderRadius: '50%',
      bgcolor: `${tone}18`, color: tone,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {React.cloneElement(icon, { sx: { fontSize: 13 } })}
    </Box>
    <Typography sx={{
      fontSize: '0.7rem', fontWeight: 700, color: PALETTE.inkMuted,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      {label}
    </Typography>
    <Typography sx={{
      fontWeight: 900, fontSize: '1rem', color: PALETTE.ink,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {fmtNum(value)}
    </Typography>
  </Box>
);

const ClientSummaryCard = ({
  totalClients, metaConnected, bothConnected,
  onOpenList,
}) => (
  <Box
    onClick={() => onOpenList?.('all')}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenList?.('all'); }
    }}
    sx={{
      position: 'relative',
      bgcolor: PALETTE.surface,
      borderRadius: `${RADIUS.card}px`,
      border: `1px solid ${PALETTE.border}`,
      boxShadow: SHADOW.card,
      px: 1.6, py: 1.2,
      cursor: 'pointer',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: SHADOW.cardHover,
        borderColor: `${PALETTE.gold}88`,
      },
      '&:focus-visible': {
        outline: `2px solid ${PALETTE.gold}`,
        outlineOffset: 2,
      },
    }}
  >
    <Box sx={{
      position: 'absolute', left: 0, top: 0, bottom: 0,
      width: 3, bgcolor: PALETTE.gold,
    }} />

    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.6 }}>
      <Box sx={{
        width: 26, height: 26, borderRadius: 1.2,
        bgcolor: `${PALETTE.gold}18`, color: PALETTE.goldDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ClientsIcon sx={{ fontSize: 14 }} />
      </Box>
      <Typography sx={{
        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '1.2px',
        color: PALETTE.gold, textTransform: 'uppercase',
      }}>
        Client Summary
      </Typography>
    </Box>

    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <StatRow
        label="Total"
        value={totalClients}
        icon={<ClientsIcon />}
        tone={PALETTE.navy}
        onClick={() => onOpenList?.('all')}
      />
      <StatRow
        label="Meta connected"
        value={metaConnected}
        icon={<MetaIcon />}
        tone="#1877F2"
        onClick={() => onOpenList?.('meta')}
      />
      <StatRow
        label="Both connected"
        value={bothConnected}
        icon={<BothIcon />}
        tone={PALETTE.goldDeep}
        onClick={() => onOpenList?.('both')}
      />
    </Box>

    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      pt: 0.6, mt: 0.3, borderTop: `1px dashed ${PALETTE.border}`,
      color: PALETTE.gold, fontWeight: 800, fontSize: '0.72rem',
    }}>
      Open list
      <ArrowIcon sx={{ fontSize: 13 }} />
    </Box>
  </Box>
);

export default ClientSummaryCard;
