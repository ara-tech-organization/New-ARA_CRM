// Shared design tokens for the redesigned PMM Dashboard. Keeping
// them here means every widget picks up the same palette, spacing
// scale, and elevation — so the page reads as one product.
//
// This palette is aligned with the app-wide brand system defined in
// `contexts/ThemeContext.js` (Navy + Gold). If you ever change one,
// change both.

export const PALETTE = {
  gold: '#F4B929',         // Signature gold accent
  goldDeep: '#C68C0A',
  goldSoft: '#FDF2C7',
  navy: '#1F3966',         // Signature navy primary
  navyDeep: '#15294D',
  navySoft: '#E4EAF3',
  ground: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  ink: '#0F172A',
  inkMuted: '#475569',
  inkFaint: '#94A3B8',
  // Semantic
  critical: '#EF4444',
  criticalSoft: '#FEE2E2',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  healthy: '#22C55E',
  healthySoft: '#DCFCE7',
  info: '#3B82F6',
  infoSoft: '#E4EAF3',
};

export const RADIUS = {
  card: 14,
  chip: 8,
  pill: 999,
};

export const SHADOW = {
  card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
  cardHover: '0 6px 20px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.06)',
  soft: '0 1px 3px rgba(15,23,42,0.06)',
};

// Utility to render a compact ₹ value ("₹2.5k", "₹1.2M").
export const fmtCompactINR = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

export const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

// Balance tier bucketing.
export const balanceTier = (bal) => {
  if (bal == null) return null;
  const v = Number(bal);
  if (v < 1000) return 'critical';
  if (v < 2000) return 'warning';
  return 'healthy';
};

export const TIER_META = {
  critical: {
    label: 'Critical',
    subtitle: 'Below ₹1,000',
    color: PALETTE.critical,
    soft: PALETTE.criticalSoft,
    icon: '●',
  },
  warning: {
    label: 'Warning',
    subtitle: '₹1,000 – ₹2,000',
    color: PALETTE.warning,
    soft: PALETTE.warningSoft,
    icon: '●',
  },
  healthy: {
    label: 'Healthy',
    subtitle: 'Above ₹2,000',
    color: PALETTE.healthy,
    soft: PALETTE.healthySoft,
    icon: '●',
  },
};

export const softShadow = SHADOW.card;

// Time-since helper used by the Recent Activity feed.
export const timeAgo = (input) => {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};
