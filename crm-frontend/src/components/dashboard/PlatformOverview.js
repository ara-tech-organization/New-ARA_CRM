import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  Facebook as MetaIcon,
  Google as GoogleIcon,
  ArrowForwardIos as ArrowIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtINR, fmtCompactINR, fmtNum, balanceTier, TIER_META } from './theme';

// Two-column split view — Meta on the left, Google on the right.
// Each side has six summary tiles across the top and a scrollable
// list of that platform's clients underneath.

const StatTile = ({ label, value, tone, small }) => (
  <Box sx={{
    bgcolor: PALETTE.surface,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 1.4,
    p: 1,
  }}>
    <Typography sx={{
      fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.8px',
      color: PALETTE.inkFaint, textTransform: 'uppercase', mb: 0.3,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {label}
    </Typography>
    <Typography sx={{
      fontWeight: 900, fontSize: small ? '0.95rem' : '1.1rem',
      color: tone || PALETTE.ink,
      fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
    }}>
      {value}
    </Typography>
  </Box>
);

const ClientRow = ({ client, tone, onClick }) => {
  const tier = balanceTier(client.balance);
  const tierColor = tier ? TIER_META[tier].color : PALETTE.inkFaint;
  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center', gap: 1,
        px: 1.2, py: 0.9,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        '&:hover': { bgcolor: `${tone}0A` },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontSize: '0.82rem', fontWeight: 700, color: PALETTE.ink, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {client.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2, flexWrap: 'wrap' }}>
          {client.campaigns > 0 && (
            <Typography sx={{ fontSize: '0.66rem', color: PALETTE.inkFaint }}>
              {client.campaigns} campaigns
            </Typography>
          )}
          {tier && (
            <>
              {client.campaigns > 0 && (
                <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: PALETTE.inkFaint }} />
              )}
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tierColor }} />
                <Typography sx={{ fontSize: '0.66rem', color: tierColor, fontWeight: 700 }}>
                  {fmtINR(client.balance)}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{
          fontWeight: 800, fontSize: '0.85rem', color: tone,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        }}>
          {fmtINR(client.spend)}
        </Typography>
        <Typography sx={{ fontSize: '0.66rem', color: PALETTE.inkFaint, mt: 0.15 }}>
          {fmtNum(client.leads)} leads
        </Typography>
      </Box>
    </Box>
  );
};

const PlatformPanel = ({
  platform, tone, icon,
  connected, campaigns, spend, leads, avgCpl, activeCampaigns,
  clients, onClientClick, onOpenList,
}) => (
  <Box sx={{
    bgcolor: PALETTE.surface,
    borderRadius: `${RADIUS.card}px`,
    border: `1px solid ${PALETTE.border}`,
    boxShadow: SHADOW.card,
    p: 2,
    display: 'flex', flexDirection: 'column',
    minHeight: 360,
  }}>
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, mb: 1.4,
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: 1.2,
        bgcolor: tone, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 6px 14px ${tone}44`,
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 18 } })}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{
          fontSize: '0.66rem', fontWeight: 800, letterSpacing: '1px',
          color: tone, textTransform: 'uppercase', lineHeight: 1,
        }}>
          {platform} Overview
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: PALETTE.ink, lineHeight: 1.2, mt: 0.2 }}>
          {fmtNum(connected)} connected client{connected === 1 ? '' : 's'}
        </Typography>
      </Box>
      {onOpenList && (
        <Box
          onClick={onOpenList}
          role="button"
          tabIndex={0}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.4,
            cursor: 'pointer', px: 1, py: 0.5,
            borderRadius: 1, border: `1px solid ${PALETTE.border}`,
            color: PALETTE.inkMuted,
            fontSize: '0.7rem', fontWeight: 700,
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: PALETTE.ground, color: tone, borderColor: tone },
          }}
        >
          View all <ArrowIcon sx={{ fontSize: 10 }} />
        </Box>
      )}
    </Box>

    {/* Six stat tiles */}
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 0.8,
      mb: 1.6,
    }}>
      <StatTile label="Campaigns" value={fmtNum(campaigns)} />
      <StatTile label="Active" value={fmtNum(activeCampaigns)} tone={tone} />
      <StatTile label="Clients" value={fmtNum(connected)} />
      <StatTile label="Spend" value={fmtCompactINR(spend)} tone={PALETTE.navy} small />
      <StatTile label="Leads" value={fmtNum(leads)} tone={PALETTE.healthy} small />
      <StatTile label="Avg CPL" value={avgCpl > 0 ? fmtCompactINR(avgCpl) : '—'} tone={PALETTE.warning} small />
    </Box>

    {/* Client list */}
    <Box sx={{
      flex: 1,
      bgcolor: PALETTE.ground,
      borderRadius: 1.5,
      p: 0.6,
      maxHeight: 260, overflowY: 'auto',
    }}>
      {clients.length === 0 ? (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', minHeight: 120,
          color: PALETTE.inkFaint, fontSize: '0.82rem',
        }}>
          No {platform} clients connected yet.
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} tone={tone} onClick={() => onClientClick?.(c)} />
          ))}
        </Box>
      )}
    </Box>
  </Box>
);

const PlatformOverview = ({
  metaSummary, googleSummary,
  metaClients, googleClients,
  onClientClick, onOpenMetaList, onOpenGoogleList,
}) => (
  <Box sx={{
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
    gap: 1.4,
  }}>
    <PlatformPanel
      platform="Meta"
      tone="#1877F2"
      icon={<MetaIcon />}
      {...metaSummary}
      clients={metaClients}
      onClientClick={onClientClick}
      onOpenList={onOpenMetaList}
    />
    <PlatformPanel
      platform="Google"
      tone="#34A853"
      icon={<GoogleIcon />}
      {...googleSummary}
      clients={googleClients}
      onClientClick={onClientClick}
      onOpenList={onOpenGoogleList}
    />
  </Box>
);

export default PlatformOverview;
