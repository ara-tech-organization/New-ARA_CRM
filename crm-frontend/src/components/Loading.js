import { Box, Typography, keyframes, useTheme } from '@mui/material';
import LeadMatrixLoader from './LeadMatrixLoader';

// The two big loaders — `Loading` (default export, full-page) and
// `PageLoader` (inline page-content) — now both delegate to the
// branded LeadMatrixLoader so every "Loading dashboard…" /
// "Loading clients…" / "Loading reports…" screen uses the same
// orbital animation + Lead Matrix mark.
//
// We keep the existing `message` and `fullScreen` props so we don't
// have to touch the ~8 page-level callers; they just get a new look.
const Loading = ({ message = 'Loading...', fullScreen = true }) => (
  <LeadMatrixLoader message={message} fullScreen={fullScreen} />
);

// Page content loader — used by Dashboard, DailyLeadData, Clients,
// Leads, Reports, PersonalVault, ClientVault, ClientAdDetails on
// first-load. Renders the branded loader without the fixed overlay
// so the page header / sidebar stay visible behind it.
export const PageLoader = ({ message = 'Loading data...' }) => (
  <LeadMatrixLoader message={message} fullScreen={false} />
);

// Keyframes used by the skeleton-style helpers below. The fancy
// dot/spinner keyframes the old Loading used got removed with the
// component above — TableLoader / CardLoader still need shimmer +
// bounce so we keep just those two.
const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
`;
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// Table loader with rows skeleton
export const TableLoader = ({ rows = 5, message = 'Fetching records...' }) => {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.primary.light;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header skeleton */}
      <Box
        sx={{
          height: 48,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f9fafb',
          borderRadius: '8px 8px 0 0',
          mb: 0.5,
        }}
      />

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            height: 56,
            mb: 0.5,
            borderRadius: 1,
            background: theme.palette.mode === 'dark'
              ? `linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)`
              : 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 1.5s ease-in-out infinite`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}

      {/* Message */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  animation: `${bounce} 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// Card loader with pulse effect
export const CardLoader = ({ count = 4, message = 'Loading...' }) => {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.primary.light;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {Array.from({ length: count }).map((_, i) => (
          <Box
            key={i}
            sx={{
              flex: '1 1 200px',
              height: 120,
              borderRadius: 2,
              background: theme.palette.mode === 'dark'
                ? `linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)`
                : 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
              backgroundSize: '200% 100%',
              animation: `${shimmer} 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </Box>

      {/* Message */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  animation: `${bounce} 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Loading;
