import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  Facebook as MetaIcon,
  Google as GoogleIcon,
  ArrowForwardIos as ArrowIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, TIER_META, fmtINR } from './theme';

// Tiered Balance Watch — three side-by-side columns (Critical /
// Warning / Healthy). Each column lists every client in that band
// with a compact row: platform badge, name, balance, campaigns.

const BalanceRow = ({ client, tone, onClick }) => (
  <Box
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
    }}
    sx={{
      display: 'grid',
      gridTemplateColumns: '20px 1fr auto',
      alignItems: 'center', gap: 1,
      px: 1, py: 0.9,
      borderRadius: 1,
      cursor: 'pointer',
      transition: 'background 0.15s ease',
      '&:hover': { bgcolor: `${tone}0A` },
      '&:focus-visible': { outline: `2px solid ${tone}`, outlineOffset: 2 },
    }}
  >
    <Box sx={{
      width: 20, height: 20, borderRadius: '50%',
      bgcolor: client.platform === 'meta' ? '#1877F215' : '#34A85315',
      color: client.platform === 'meta' ? '#1877F2' : '#34A853',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {client.platform === 'meta' ? <MetaIcon sx={{ fontSize: 12 }} /> : <GoogleIcon sx={{ fontSize: 12 }} />}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{
        fontSize: '0.8rem', fontWeight: 700, color: PALETTE.ink, lineHeight: 1.2,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {client.name}
      </Typography>
      <Typography sx={{ fontSize: '0.66rem', color: PALETTE.inkFaint, mt: 0.1 }}>
        {client.campaigns > 0 ? `${client.campaigns} campaigns` : 'No live campaigns'}
      </Typography>
    </Box>
    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
      <Typography sx={{
        fontWeight: 900, fontSize: '0.85rem', color: tone,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>
        {fmtINR(client.balance)}
      </Typography>
    </Box>
  </Box>
);

const TierColumn = ({ tierKey, clients, onClientClick }) => {
  const meta = TIER_META[tierKey];
  return (
    <Box sx={{
      bgcolor: PALETTE.surface,
      borderRadius: `${RADIUS.card}px`,
      border: `1px solid ${PALETTE.border}`,
      boxShadow: SHADOW.soft,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      minHeight: 260,
    }}>
      {/* Column header with tint band */}
      <Box sx={{
        px: 1.6, py: 1.2,
        bgcolor: meta.soft,
        borderBottom: `1px solid ${meta.color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.color }} />
          <Box>
            <Typography sx={{
              fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.8px',
              color: meta.color, textTransform: 'uppercase', lineHeight: 1,
            }}>
              {meta.label}
            </Typography>
            <Typography sx={{ fontSize: '0.66rem', color: PALETTE.inkMuted, mt: 0.15 }}>
              {meta.subtitle}
            </Typography>
          </Box>
        </Box>
        <Chip
          size="small"
          label={clients.length}
          sx={{
            bgcolor: meta.color, color: '#fff',
            fontWeight: 800, fontSize: '0.72rem',
            height: 22, minWidth: 28,
          }}
        />
      </Box>

      {/* Body */}
      <Box sx={{
        flex: 1,
        display: 'flex', flexDirection: 'column', gap: 0.3,
        p: 0.8,
        maxHeight: 260, overflowY: 'auto',
      }}>
        {clients.length === 0 ? (
          <Box sx={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: PALETTE.inkFaint, fontSize: '0.8rem', py: 3, textAlign: 'center',
          }}>
            {tierKey === 'critical' ? 'No accounts at risk 🎉'
              : tierKey === 'warning' ? 'No accounts in the watch band.'
              : 'No accounts here yet — sync to populate.'}
          </Box>
        ) : (
          clients.map((c) => (
            <BalanceRow key={c.id} client={c} tone={meta.color} onClick={() => onClientClick?.(c)} />
          ))
        )}
      </Box>
    </Box>
  );
};

const BalanceWatch = ({ clients, onClientClick, onViewAll }) => {
  const grouped = { critical: [], warning: [], healthy: [] };
  clients.forEach((c) => {
    if (c.tier && grouped[c.tier]) grouped[c.tier].push(c);
  });
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.balance - b.balance));
  const critCount = grouped.critical.length;

  return (
    <Box sx={{
      bgcolor: PALETTE.surface,
      borderRadius: `${RADIUS.card}px`,
      border: `1px solid ${PALETTE.border}`,
      boxShadow: SHADOW.card,
      p: 2,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 1.6, gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{
            fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1.2px',
            color: PALETTE.gold, textTransform: 'uppercase', mb: 0.4,
          }}>
            Balance Watch
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: PALETTE.ink, lineHeight: 1.15 }}>
            {clients.length} account{clients.length === 1 ? '' : 's'} monitored
            {critCount > 0 && (
              <Box component="span" sx={{ color: PALETTE.critical, ml: 1 }}>
                · {critCount} needs recharge now
              </Box>
            )}
          </Typography>
          <Typography sx={{ fontSize: '0.76rem', color: PALETTE.inkMuted, mt: 0.4 }}>
            Auto-pause risk under ₹1,000 · click a row to open that client
          </Typography>
        </Box>
        {onViewAll && (
          <Box
            onClick={onViewAll}
            role="button"
            tabIndex={0}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.6,
              cursor: 'pointer', px: 1.2, py: 0.6,
              borderRadius: 1, border: `1px solid ${PALETTE.border}`,
              color: PALETTE.navy,
              fontSize: '0.76rem', fontWeight: 700,
              transition: 'all 0.15s ease',
              '&:hover': { bgcolor: PALETTE.navySoft },
            }}
          >
            View all clients <ArrowIcon sx={{ fontSize: 12 }} />
          </Box>
        )}
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        gap: 1.4,
      }}>
        <TierColumn tierKey="critical" clients={grouped.critical} onClientClick={onClientClick} />
        <TierColumn tierKey="warning" clients={grouped.warning} onClientClick={onClientClick} />
        <TierColumn tierKey="healthy" clients={grouped.healthy} onClientClick={onClientClick} />
      </Box>
    </Box>
  );
};

export default BalanceWatch;
