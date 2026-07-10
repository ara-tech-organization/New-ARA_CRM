import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  Groups as ClientsIcon,
  Facebook as MetaIcon,
  Google as GoogleIcon,
  Layers as BothIcon,
  OpenInFullOutlined as ExpandIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtCompactINR, fmtNum } from './theme';

// One consolidated "Total Clients" card. Shows the agency-wide total
// on the left, then three breakdown tiles inside — Meta / Google /
// Both — each with count and combined balance. Clicking anywhere on
// the card opens the full client list modal.

const BreakdownTile = ({ label, icon, count, balance, tone, note }) => (
  <Box sx={{
    bgcolor: PALETTE.surface,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 1.4,
    px: 1.6, py: 1.4,
    display: 'flex', flexDirection: 'column', gap: 0.4,
    minWidth: 0,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
      <Box sx={{
        width: 22, height: 22, borderRadius: '50%',
        bgcolor: `${tone}18`, color: tone,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 13 } })}
      </Box>
      <Typography sx={{
        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.9px',
        color: tone, textTransform: 'uppercase',
      }}>
        {label}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.6 }}>
      <Typography sx={{
        fontWeight: 900, fontSize: '1.35rem', color: PALETTE.ink,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>
        {fmtNum(count)}
      </Typography>
      <Typography sx={{ fontSize: '0.68rem', color: PALETTE.inkFaint, fontWeight: 600 }}>
        connected
      </Typography>
    </Box>
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.5,
      color: balance != null ? PALETTE.inkMuted : PALETTE.inkFaint,
      fontSize: '0.7rem', fontWeight: 700,
    }}>
      {balance != null ? (
        <>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: PALETTE.inkFaint }}>
            Balance
          </Typography>
          <Typography sx={{
            fontSize: '0.85rem', fontWeight: 800, color: tone,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtCompactINR(balance)}
          </Typography>
        </>
      ) : (
        <Typography sx={{ fontSize: '0.66rem', color: PALETTE.inkFaint, fontStyle: 'italic' }}>
          {note || 'Not tracked'}
        </Typography>
      )}
    </Box>
  </Box>
);

const KpiStrip = ({
  totalClients,
  metaConnected,
  googleConnected,
  bothConnected,
  metaBalanceTotal,
  bothBalanceTotal,
  onOpenAllClients,
}) => {
  return (
    <Box
      onClick={onOpenAllClients}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAllClients?.(); }
      }}
      sx={{
        position: 'relative',
        bgcolor: PALETTE.surface,
        borderRadius: `${RADIUS.card}px`,
        border: `1px solid ${PALETTE.border}`,
        boxShadow: SHADOW.card,
        p: 2,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        overflow: 'hidden',
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
      {/* Gold left rail */}
      <Box sx={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, bgcolor: PALETTE.gold,
      }} />

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'auto 1fr auto' },
        alignItems: 'center',
        gap: 2.5,
      }}>
        {/* Total counter */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: PALETTE.gold, color: PALETTE.navy,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 16px ${PALETTE.gold}44`,
            flexShrink: 0,
          }}>
            <ClientsIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{
              fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.4px',
              color: PALETTE.gold, textTransform: 'uppercase', lineHeight: 1, mb: 0.4,
            }}>
              Total Clients
            </Typography>
            <Typography sx={{
              fontWeight: 900, fontSize: '2rem', color: PALETTE.navy, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtNum(totalClients)}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: PALETTE.inkMuted, mt: 0.3 }}>
              agency accounts · tap for full list
            </Typography>
          </Box>
        </Box>

        {/* Three breakdown tiles */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.2,
          minWidth: 0,
        }}>
          <BreakdownTile
            label="Meta"
            icon={<MetaIcon />}
            count={metaConnected}
            balance={metaBalanceTotal}
            tone="#1877F2"
          />
          <BreakdownTile
            label="Google"
            icon={<GoogleIcon />}
            count={googleConnected}
            balance={null}
            tone="#34A853"
            note="Balance not tracked"
          />
          <BreakdownTile
            label="Both"
            icon={<BothIcon />}
            count={bothConnected}
            balance={bothBalanceTotal}
            tone={PALETTE.navy}
          />
        </Box>

        {/* Open-list affordance */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5,
          color: PALETTE.gold, fontWeight: 800, fontSize: '0.8rem',
          whiteSpace: 'nowrap',
        }}>
          Open list <ExpandIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
    </Box>
  );
};

export default KpiStrip;
