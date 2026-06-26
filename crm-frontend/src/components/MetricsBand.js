import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Skeleton, Tooltip } from '@mui/material';
import api from '../api/axios';

// Compact 3-tile band: 📋 Leads | 💬 Messages | 📞 Calls
// Fetches from /api/meta/daily-metrics for the given date range / client.
// Also accepts pre-computed `data` prop to skip the fetch (e.g. Dashboard
// already has totals from dashboard-overview).
const MetricsBand = ({ from, to, clientId, data: propData, loading: propLoading }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (propData) return;
    setLoading(true);
    try {
      const params = { from, to };
      if (clientId) params.clientId = clientId;
      const res = await api.get('/meta/daily-metrics', { params });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, clientId, propData]);

  useEffect(() => { fetch(); }, [fetch]);

  const totals = propData || data?.totals || null;
  const isLoading = propLoading || loading;

  const tiles = [
    { emoji: '📋', label: 'Leads',    value: totals?.leads,    color: '#C08552', bg: '#C0855212' },
    { emoji: '💬', label: 'Messages', value: totals?.messages, color: '#1976d2', bg: '#1976d212' },
    { emoji: '📞', label: 'Calls',    value: totals?.calls,    color: '#2e7d32', bg: '#2e7d3212' },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {tiles.map(({ emoji, label, value, color, bg }) => (
        <Tooltip key={label} title={`Total ${label} (Meta) for selected period`} arrow>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 1.2,
            borderRadius: 2,
            bgcolor: bg,
            border: `1px solid ${color}30`,
            minWidth: 110,
            flex: '1 1 auto',
            maxWidth: 160,
          }}>
            <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>{emoji}</Typography>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color, lineHeight: 1.1 }}>
                {isLoading ? <Skeleton width={32} /> : (value ?? 0)}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {label}
              </Typography>
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};

export default MetricsBand;
