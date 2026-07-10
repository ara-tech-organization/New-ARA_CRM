import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Savings as ValueIcon,
  ReportProblem as ReviewIcon,
  Facebook as MetaIcon,
  Google as GoogleIcon,
} from '@mui/icons-material';
import { PALETTE, RADIUS, SHADOW, fmtINR, fmtNum } from './theme';

// Three-panel Performance Insights — Top Performer, Best Value,
// Needs Review — each showing EVERY qualifying client (not just one).
// Metrics vary per section so the row layout adapts.

// Drop the shared "Advanced " prefix so more of the distinguishing
// location suffix ("Kaloor", "Krishnagiri") fits within the row width.
// Case-insensitive; only strips when present so non-Advanced names
// stay untouched.
const displayClientName = (name) => {
  const s = String(name || '').trim();
  return /^advanced\s+/i.test(s) ? s.replace(/^advanced\s+/i, '') : s;
};

const InsightRow = ({ rank, client, metrics, tone, onClick }) => {
  const clickable = typeof onClick === 'function';
  return (
    <Box
      onClick={clickable ? () => onClick(client) : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(client); }
      } : undefined}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? 'button' : undefined}
      sx={{
        display: 'grid',
        gridTemplateColumns: '22px 1fr auto',
        alignItems: 'center', gap: 1.2,
        px: 1.2, py: 0.9,
        borderRadius: 1,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
        outline: 'none',
        '&:hover': { bgcolor: `${tone}0A` },
        '&:focus-visible': { boxShadow: `inset 0 0 0 2px ${tone}55` },
      }}
    >
      {/* Rank badge */}
      <Box sx={{
        width: 22, height: 22, borderRadius: '50%',
        bgcolor: rank === 1 ? tone : `${tone}22`,
        color: rank === 1 ? '#fff' : tone,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.68rem', fontWeight: 900,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {rank}
      </Box>

      {/* Client identity */}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}>
          {client.platform === 'meta'
            ? <MetaIcon sx={{ fontSize: 12, color: '#1877F2' }} />
            : <GoogleIcon sx={{ fontSize: 12, color: '#34A853' }} />}
          <Typography sx={{
            fontSize: '0.62rem', fontWeight: 700, color: PALETTE.inkFaint,
            textTransform: 'uppercase', letterSpacing: '0.4px',
          }}>
            {client.platform === 'meta' ? 'Meta' : 'Google'}
          </Typography>
          {client.campaigns > 0 && (
            <Typography sx={{ fontSize: '0.62rem', color: PALETTE.inkFaint }}>
              · {client.campaigns} live
            </Typography>
          )}
        </Box>
        {/* Name wraps up to two lines with ellipsis so long suffixes
            like "Tiruvannamalai" don't get chopped mid-word. */}
        <Typography
          title={client.name}
          sx={{
            fontSize: '0.82rem', fontWeight: 700, color: PALETTE.ink, lineHeight: 1.2,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {displayClientName(client.name)}
        </Typography>
      </Box>

      {/* Metrics stack */}
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{
          fontWeight: 900, fontSize: '0.9rem', color: tone,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        }}>
          {metrics.headline}
        </Typography>
        <Typography sx={{
          fontSize: '0.66rem', color: PALETTE.inkMuted, mt: 0.15,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {metrics.detail}
        </Typography>
      </Box>
    </Box>
  );
};

const InsightPanel = ({
  eyebrow, title, subtitle, icon, tone,
  clients, buildMetrics, emptyMessage, onClientClick,
}) => (
  <Box sx={{
    bgcolor: PALETTE.surface,
    borderRadius: `${RADIUS.card}px`,
    border: `1px solid ${PALETTE.border}`,
    boxShadow: SHADOW.card,
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    minHeight: 320,
  }}>
    <Box sx={{
      px: 1.8, py: 1.3,
      borderBottom: `1px solid ${PALETTE.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: 1.2,
          bgcolor: `${tone}18`, color: tone,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon, { sx: { fontSize: 18 } })}
        </Box>
        <Box>
          <Typography sx={{
            fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1px',
            color: tone, textTransform: 'uppercase', lineHeight: 1,
          }}>
            {eyebrow}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: PALETTE.ink, lineHeight: 1.2, mt: 0.2 }}>
            {title}
          </Typography>
        </Box>
      </Box>
      <Chip
        label={clients.length}
        size="small"
        sx={{
          bgcolor: `${tone}18`, color: tone, fontWeight: 800,
          height: 22, minWidth: 28, fontSize: '0.72rem',
        }}
      />
    </Box>
    <Typography sx={{ fontSize: '0.72rem', color: PALETTE.inkMuted, px: 1.8, py: 0.8 }}>
      {subtitle}
    </Typography>
    <Box sx={{
      flex: 1, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 0.3,
      px: 0.6, pb: 0.8,
      maxHeight: 320,
    }}>
      {clients.length === 0 ? (
        <Box sx={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          px: 2, py: 3, textAlign: 'center',
          color: PALETTE.inkFaint, fontSize: '0.8rem',
        }}>
          {emptyMessage}
        </Box>
      ) : (
        clients.map((c, i) => (
          <InsightRow
            key={c.id}
            rank={i + 1}
            client={c}
            metrics={buildMetrics(c)}
            tone={tone}
            onClick={onClientClick}
          />
        ))
      )}
    </Box>
  </Box>
);

// ── Ranking helpers ─────────────────────────────────────────────
export const rankTopPerformers = (clients) => clients
  .filter((c) => (c.leads || 0) > 0)
  .slice().sort((a, b) => (b.leads || 0) - (a.leads || 0));

export const rankBestValue = (clients) => clients
  .filter((c) => (c.leads || 0) > 0 && (c.cpl || 0) > 0)
  .slice().sort((a, b) => (a.cpl || 0) - (b.cpl || 0));

export const rankNeedsReview = (clients) => clients
  .filter((c) => (c.spend || 0) > 0 && (c.leads || 0) === 0)
  .slice().sort((a, b) => (b.spend || 0) - (a.spend || 0));

// Small "all clear" banner used in place of the Needs-Review panel
// when nothing qualifies. Keeps the reassurance visible (every
// spender is producing) without wasting a full column on an empty
// state — the Top Performer + Best Value panels reflow to 2 cols.
const AllClearBanner = () => (
  <Box sx={{
    bgcolor: `${PALETTE.healthy}0F`,
    border: `1px solid ${PALETTE.healthy}33`,
    borderRadius: `${RADIUS.card}px`,
    px: 1.8, py: 1.2,
    display: 'flex', alignItems: 'center', gap: 1.2,
  }}>
    <Box sx={{
      width: 32, height: 32, borderRadius: '50%',
      bgcolor: `${PALETTE.healthy}22`, color: PALETTE.healthy,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <TrophyIcon sx={{ fontSize: 18 }} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{
        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1px',
        color: PALETTE.healthy, textTransform: 'uppercase',
      }}>
        All clear
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: PALETTE.ink, lineHeight: 1.2 }}>
        Every active spender is producing leads today.
      </Typography>
    </Box>
  </Box>
);

const PerformanceInsights = ({ clients, onClientClick }) => {
  const topPerformers = rankTopPerformers(clients);
  const bestValue = rankBestValue(clients);
  const needsReview = rankNeedsReview(clients);

  // If nothing qualifies for the Needs Review bucket, don't burn a
  // whole column on an empty panel. Reflow Top Performer + Best
  // Value into a 2-column grid and drop a compact "all clear"
  // banner underneath instead.
  const showReview = needsReview.length > 0;
  const cols = showReview ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: cols },
        gap: 1.4,
      }}>
        <InsightPanel
          eyebrow="Top Performer"
          title="Highest lead volume today"
          subtitle="Ranked by leads generated. Great candidates to increase budget on."
          icon={<TrophyIcon />}
          tone={PALETTE.gold}
          clients={topPerformers}
          emptyMessage="No leads recorded yet today."
          onClientClick={onClientClick}
          buildMetrics={(c) => ({
            headline: `${fmtNum(c.leads)} leads`,
            detail: `${fmtINR(c.spend)} spent · ${c.cpl > 0 ? fmtINR(c.cpl) + ' CPL' : '—'}`,
          })}
        />
        <InsightPanel
          eyebrow="Best Value"
          title="Lowest cost per lead"
          subtitle="These accounts convert cheapest — replicate their targeting."
          icon={<ValueIcon />}
          tone={PALETTE.healthy}
          clients={bestValue}
          emptyMessage="No CPL data available yet."
          onClientClick={onClientClick}
          buildMetrics={(c) => ({
            headline: fmtINR(c.cpl),
            detail: `${fmtNum(c.leads)} leads · ${fmtINR(c.spend)} spent`,
          })}
        />
        {showReview && (
          <InsightPanel
            eyebrow="Needs Review"
            title="Spending but no leads"
            subtitle="Money leaving with nothing coming back — investigate today."
            icon={<ReviewIcon />}
            tone={PALETTE.critical}
            clients={needsReview}
            emptyMessage="Nothing to review — every spender is producing."
            onClientClick={onClientClick}
            buildMetrics={(c) => ({
              headline: fmtINR(c.spend),
              detail: '0 leads · action needed',
            })}
          />
        )}
      </Box>
      {!showReview && <AllClearBanner />}
    </Box>
  );
};

export default PerformanceInsights;
