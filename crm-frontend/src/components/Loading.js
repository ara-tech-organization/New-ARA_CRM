import { Box, Typography, keyframes, useTheme } from '@mui/material';

// Keyframe animations
const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const bounce = keyframes`
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

// Full page loader with branded aesthetic
const Loading = ({ message = 'Loading...', fullScreen = true }) => {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.primary.light;

  if (fullScreen) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
          gap: 3,
        }}
      >
        {/* Animated Logo/Spinner */}
        <Box
          sx={{
            position: 'relative',
            width: 80,
            height: 80,
          }}
        >
          {/* Outer ring */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: primaryColor,
              borderRightColor: secondaryColor,
              animation: `${spin} 1s linear infinite`,
            }}
          />
          {/* Inner ring */}
          <Box
            sx={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: secondaryColor,
              borderRightColor: primaryColor,
              animation: `${spin} 0.8s linear infinite reverse`,
            }}
          />
          {/* Center dot */}
          <Box
            sx={{
              position: 'absolute',
              inset: 28,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              animation: `${pulse} 1.5s ease-in-out infinite`,
            }}
          />
        </Box>

        {/* Message */}
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.text.secondary,
            fontWeight: 500,
            letterSpacing: '0.5px',
          }}
        >
          {message}
        </Typography>

        {/* Shimmer bar */}
        <Box
          sx={{
            width: 200,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${theme.palette.divider} 25%, ${primaryColor} 50%, ${theme.palette.divider} 75%)`,
            backgroundSize: '200% 100%',
            animation: `${shimmer} 1.5s ease-in-out infinite`,
          }}
        />
      </Box>
    );
  }

  // Section loader (not full screen)
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 12,
              height: 12,
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
  );
};

// Page content loader with skeleton-like appearance
export const PageLoader = ({ message = 'Loading data...' }) => {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const secondaryColor = theme.palette.primary.light;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        gap: 3,
      }}
    >
      {/* Animated dots */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              animation: `${bounce} 1.4s ease-in-out infinite`,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </Box>

      {/* Message */}
      <Typography
        variant="body1"
        sx={{
          color: theme.palette.text.secondary,
          fontWeight: 500,
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};

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
