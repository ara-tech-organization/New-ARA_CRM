import React from 'react';
import { Box, Typography, Button, Tooltip, IconButton } from '@mui/material';
import {
  Notifications as BellIcon,
  History as HistoryIcon,
  Bolt as BoltIcon,
  Refresh as RefreshIcon,
  CloudDownload as SyncMetaIcon,
  CloudSync as SyncGoogleIcon,
  FileDownload as ExportIcon,
  Description as CsvIcon,
  Circle as DotIcon,
  Facebook as MetaIcon,
  Google as GoogleIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtINR, timeAgo } from './theme';

// ── Alerts widget ───────────────────────────────────────────────
export const AlertsWidget = ({ alerts, onAlertClick }) => (
  <Box sx={{
    bgcolor: PALETTE.surface,
    borderRadius: `${RADIUS.card}px`,
    border: `1px solid ${PALETTE.border}`,
    boxShadow: SHADOW.card,
    p: 1.8,
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.4 }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: 1.2,
        bgcolor: `${PALETTE.critical}18`, color: PALETTE.critical,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <BellIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.1px',
          color: PALETTE.critical, textTransform: 'uppercase', lineHeight: 1,
        }}>
          Smart Alerts
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: PALETTE.ink, mt: 0.2 }}>
          {alerts.length} active
        </Typography>
      </Box>
    </Box>
    {alerts.length === 0 ? (
      <Box sx={{
        py: 3, textAlign: 'center', color: PALETTE.inkFaint, fontSize: '0.85rem',
      }}>
        All clear — no alerts right now.
      </Box>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 320, overflowY: 'auto' }}>
        {alerts.map((a) => (
          <Box
            key={a.id}
            onClick={a.clientId ? () => onAlertClick?.(a) : undefined}
            role={a.clientId ? 'button' : undefined}
            tabIndex={a.clientId ? 0 : undefined}
            sx={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr auto',
              alignItems: 'center', gap: 1,
              px: 1, py: 0.9,
              borderRadius: 1,
              cursor: a.clientId ? 'pointer' : 'default',
              transition: 'background 0.15s ease',
              '&:hover': a.clientId ? { bgcolor: `${a.color}10` } : {},
            }}
          >
            <DotIcon sx={{ fontSize: 10, color: a.color }} />
            <Typography sx={{
              fontSize: '0.8rem', color: PALETTE.ink, lineHeight: 1.35,
            }}>
              {a.text}
            </Typography>
            {a.rightText && (
              <Typography sx={{
                fontSize: '0.72rem', color: a.color, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {a.rightText}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    )}
  </Box>
);

// ── Recent Activity widget ──────────────────────────────────────
const activityIcon = (kind) => {
  switch (kind) {
    case 'meta_sync': return { Icon: MetaIcon, color: '#1877F2' };
    case 'google_sync': return { Icon: GoogleIcon, color: '#34A853' };
    case 'client_connected': return { Icon: BoltIcon, color: PALETTE.gold };
    case 'balance_updated': return { Icon: BoltIcon, color: PALETTE.navy };
    case 'campaign_created': return { Icon: BoltIcon, color: PALETTE.healthy };
    case 'campaign_paused': return { Icon: BoltIcon, color: PALETTE.warning };
    default: return { Icon: BoltIcon, color: PALETTE.inkFaint };
  }
};

export const RecentActivity = ({ items }) => (
  <Box sx={{
    bgcolor: PALETTE.surface,
    borderRadius: `${RADIUS.card}px`,
    border: `1px solid ${PALETTE.border}`,
    boxShadow: SHADOW.card,
    p: 1.8,
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.4 }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: 1.2,
        bgcolor: `${PALETTE.navy}18`, color: PALETTE.navy,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <HistoryIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box>
        <Typography sx={{
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.1px',
          color: PALETTE.navy, textTransform: 'uppercase', lineHeight: 1,
        }}>
          Recent Activity
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: PALETTE.ink, mt: 0.2 }}>
          Latest {Math.min(items.length, 10)} events
        </Typography>
      </Box>
    </Box>
    {items.length === 0 ? (
      <Box sx={{ py: 3, textAlign: 'center', color: PALETTE.inkFaint, fontSize: '0.85rem' }}>
        No recent activity to show.
      </Box>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 320, overflowY: 'auto' }}>
        {items.slice(0, 12).map((it) => {
          const { Icon, color } = activityIcon(it.kind);
          return (
            <Box key={it.id} sx={{
              display: 'grid',
              gridTemplateColumns: '22px 1fr',
              gap: 1, alignItems: 'flex-start',
            }}>
              <Box sx={{
                width: 22, height: 22, borderRadius: '50%',
                bgcolor: `${color}18`, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mt: 0.15,
              }}>
                <Icon sx={{ fontSize: 12 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.82rem', color: PALETTE.ink, lineHeight: 1.35 }}>
                  {it.text}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: PALETTE.inkFaint, mt: 0.15 }}>
                  {it.at ? timeAgo(it.at) : ''}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    )}
  </Box>
);

// ── Quick Actions ───────────────────────────────────────────────
export const QuickActions = ({
  onSyncMeta, onSyncGoogle, onRefresh, onExport, onDownloadCsv,
  syncingMeta, syncingGoogle,
}) => {
  const ActionButton = ({ icon, label, tone, onClick, loading }) => (
    <Button
      onClick={onClick}
      disabled={loading}
      startIcon={React.cloneElement(icon, { sx: { fontSize: 16 } })}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        fontWeight: 700, fontSize: '0.82rem',
        color: PALETTE.ink,
        bgcolor: PALETTE.surface,
        border: `1px solid ${PALETTE.border}`,
        borderRadius: 1.4,
        px: 1.4, py: 1,
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: `${tone}10`,
          borderColor: tone,
          color: tone,
        },
      }}
    >
      {label}
    </Button>
  );

  return (
    <Box sx={{
      bgcolor: PALETTE.surface,
      borderRadius: `${RADIUS.card}px`,
      border: `1px solid ${PALETTE.border}`,
      boxShadow: SHADOW.card,
      p: 1.8,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.4 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: 1.2,
          bgcolor: `${PALETTE.gold}18`, color: PALETTE.gold,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BoltIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box>
          <Typography sx={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.1px',
            color: PALETTE.gold, textTransform: 'uppercase', lineHeight: 1,
          }}>
            Quick Actions
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: PALETTE.ink, mt: 0.2 }}>
            Shortcuts
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8 }}>
        <ActionButton
          icon={<SyncMetaIcon />}
          label={syncingMeta ? 'Syncing…' : 'Sync Meta'}
          tone="#1877F2"
          onClick={onSyncMeta}
          loading={syncingMeta}
        />
        <ActionButton
          icon={<SyncGoogleIcon />}
          label={syncingGoogle ? 'Syncing…' : 'Sync Google'}
          tone="#34A853"
          onClick={onSyncGoogle}
          loading={syncingGoogle}
        />
        <ActionButton
          icon={<RefreshIcon />}
          label="Refresh Dashboard"
          tone={PALETTE.navy}
          onClick={onRefresh}
        />
        <ActionButton
          icon={<ExportIcon />}
          label="Export Reports"
          tone={PALETTE.gold}
          onClick={onExport}
        />
        <Box sx={{ gridColumn: '1 / -1' }}>
          <ActionButton
            icon={<CsvIcon />}
            label="Download Client CSV"
            tone={PALETTE.navy}
            onClick={onDownloadCsv}
          />
        </Box>
      </Box>
    </Box>
  );
};
