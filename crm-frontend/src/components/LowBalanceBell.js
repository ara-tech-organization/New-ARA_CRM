import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Divider,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  ErrorOutline as ErrorOutlineIcon,
  WarningAmber as WarningAmberIcon,
  ArrowForwardIos as ArrowForwardIcon,
} from '@mui/icons-material';
import api from '../api/axios';

// Header notification bell for Meta ad account balances. Two tiers:
//   * CRITICAL — balance < ₹1,000 (red, "alert" severity)
//   * WARNING  — balance ₹1,000-1,999 (orange, "warning" severity)
// Reads from /api/meta/clients (batch, live on Azure). Auto-refreshes
// every 90 seconds so the bell stays honest without hammering the API.
// The badge count reflects total clients under ₹2,000; badge colour
// escalates to red the moment any critical account is present.

const CRIT = '#ef4444';
const WATCH = '#f59e0b';
const BROWN = '#0F172A';
const COPPER = '#1F3966';
const CREAM = '#F1F5F9';

const REFRESH_MS = 90_000;

const fmtINR0 = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const LowBalanceBell = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const today = new Date().toISOString().slice(0, 10);
      api.get('/meta/clients', { params: { from: today, to: today } })
        .then((res) => {
          if (cancelled) return;
          const list = Array.isArray(res.data?.clients) ? res.data.clients : [];
          setClients(
            list
              .filter((c) => c.availableBalance != null && Number(c.availableBalance) < 2000)
              .map((c) => ({
                id: c.clientId,
                name: c.clientName || c.metaAccountName || 'Client',
                balance: Number(c.availableBalance),
              }))
              .sort((a, b) => a.balance - b.balance),
          );
        })
        .catch(() => { /* silent — bell just stays empty */ });
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const { critical, warning } = useMemo(() => ({
    critical: clients.filter((c) => c.balance < 1000),
    warning: clients.filter((c) => c.balance >= 1000 && c.balance < 2000),
  }), [clients]);

  const total = critical.length + warning.length;
  const hasCritical = critical.length > 0;
  const activeColor = hasCritical ? CRIT : (warning.length > 0 ? WATCH : null);

  const openPopover = (e) => setAnchorEl(e.currentTarget);
  const closePopover = () => setAnchorEl(null);
  const goToClient = (id) => {
    closePopover();
    navigate(`/client-ads/${id}`);
  };

  return (
    <>
      <Tooltip
        title={
          total === 0
            ? 'No low-balance accounts'
            : `${total} account${total === 1 ? '' : 's'} need attention${hasCritical ? ' — critical' : ''}`
        }
      >
        {/* Wrapper span keeps the tooltip working even when the button
            is styled with a tinted background. */}
        <span>
          <IconButton
            onClick={openPopover}
            aria-label={`Low-balance notifications: ${total} account${total === 1 ? '' : 's'}`}
            sx={{
              color: activeColor || 'text.primary',
              bgcolor: activeColor ? `${activeColor}12` : 'transparent',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: activeColor ? `${activeColor}22` : 'action.hover',
              },
              // Pulse the bell when critical alerts exist. Uses a
              // container-scoped keyframe so it can't leak.
              '@keyframes lbBellPulse': {
                '0%,100%': { transform: 'rotate(0deg)' },
                '20%': { transform: 'rotate(-8deg)' },
                '40%': { transform: 'rotate(6deg)' },
                '60%': { transform: 'rotate(-4deg)' },
                '80%': { transform: 'rotate(2deg)' },
              },
              '@media (prefers-reduced-motion: reduce)': {
                '& .lb-bell-icon': { animation: 'none !important' },
              },
            }}
          >
            <Badge
              badgeContent={total}
              overlap="circular"
              max={99}
              invisible={total === 0}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: activeColor || 'grey.500',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.62rem',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  border: '2px solid',
                  borderColor: 'background.paper',
                },
              }}
            >
              {hasCritical ? (
                <NotificationsActiveIcon
                  className="lb-bell-icon"
                  sx={{ animation: 'lbBellPulse 1.6s ease-in-out infinite' }}
                />
              ) : (
                <NotificationsIcon />
              )}
            </Badge>
          </IconButton>
        </span>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={closePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 360,
              maxHeight: 520,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              boxShadow: '0 12px 32px rgba(62, 39, 35, 0.18)',
            },
          },
        }}
      >
        {/* Popover header */}
        <Box sx={{
          px: 2, py: 1.6,
          background: `linear-gradient(180deg, ${CREAM} 0%, #fff 100%)`,
          borderBottom: `1px solid ${BROWN}12`,
        }}>
          <Typography sx={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1.4px',
            color: COPPER, textTransform: 'uppercase', lineHeight: 1,
            mb: 0.5,
          }}>
            Notifications
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', color: BROWN, lineHeight: 1.2 }}>
            {total === 0 ? 'All accounts healthy' : 'Low-balance accounts'}
          </Typography>
          {total > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: 0.8 }}>
              {critical.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CRIT }} />
                  <Typography sx={{ fontSize: '0.72rem', color: CRIT, fontWeight: 700 }}>
                    {critical.length} alert · below ₹1K
                  </Typography>
                </Box>
              )}
              {warning.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: WATCH }} />
                  <Typography sx={{ fontSize: '0.72rem', color: WATCH, fontWeight: 700 }}>
                    {warning.length} warning · below ₹2K
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Scrollable body */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {total === 0 && (
            <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.86rem', color: `${BROWN}88`, fontWeight: 500 }}>
                Every Meta ad account currently has ₹2,000 or more.
              </Typography>
            </Box>
          )}

          {critical.length > 0 && (
            <NotificationGroup
              label="ALERT · Below ₹1,000"
              tone={CRIT}
              icon={<ErrorOutlineIcon sx={{ fontSize: 16, color: CRIT }} />}
              items={critical}
              onSelect={goToClient}
              severityCopy="Ads may auto-pause"
            />
          )}

          {critical.length > 0 && warning.length > 0 && (
            <Divider sx={{ borderColor: `${BROWN}0f` }} />
          )}

          {warning.length > 0 && (
            <NotificationGroup
              label="WARNING · Below ₹2,000"
              tone={WATCH}
              icon={<WarningAmberIcon sx={{ fontSize: 16, color: WATCH }} />}
              items={warning}
              onSelect={goToClient}
              severityCopy="Top up soon"
            />
          )}
        </Box>
      </Popover>
    </>
  );
};

const NotificationGroup = ({ label, tone, icon, items, onSelect, severityCopy }) => (
  <Box>
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 1,
      display: 'flex', alignItems: 'center', gap: 0.7,
      px: 2, py: 0.9,
      bgcolor: `${tone}0d`,
      borderBottom: `1px solid ${tone}22`,
    }}>
      {icon}
      <Typography sx={{
        fontSize: '0.65rem', fontWeight: 800, color: tone,
        letterSpacing: '0.6px', textTransform: 'uppercase',
      }}>
        {label}
      </Typography>
    </Box>

    {items.map((c) => (
      <Box
        key={c.id}
        onClick={() => onSelect(c.id)}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(c.id);
          }
        }}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          alignItems: 'center',
          gap: 1.2,
          px: 2, py: 1.2,
          cursor: 'pointer',
          borderBottom: `1px solid ${BROWN}08`,
          transition: 'background-color 0.15s ease',
          '&:hover': { bgcolor: `${tone}12` },
          '&:focus-visible': { outline: `2px solid ${tone}`, outlineOffset: -2 },
          '&:last-of-type': { borderBottom: 'none' },
        }}
      >
        <Box sx={{
          width: 30, height: 30, borderRadius: '50%',
          bgcolor: `${tone}18`,
          color: tone,
          border: `1px solid ${tone}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.82rem',
          flexShrink: 0,
        }}>
          {c.name?.charAt(0) || '?'}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 700, fontSize: '0.82rem', color: BROWN, lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {c.name}
          </Typography>
          <Typography sx={{ fontSize: '0.66rem', color: `${BROWN}88`, mt: 0.2 }}>
            {severityCopy}
          </Typography>
        </Box>
        <Typography sx={{
          fontWeight: 900, fontSize: '0.95rem', color: tone,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}>
          {fmtINR0(c.balance)}
        </Typography>
        <ArrowForwardIcon sx={{ fontSize: 12, color: `${BROWN}55`, flexShrink: 0 }} />
      </Box>
    ))}
  </Box>
);

export default LowBalanceBell;
