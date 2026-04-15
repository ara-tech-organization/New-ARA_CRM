import { useEffect, useMemo, useState, useContext } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Avatar,
  Button,
} from '@mui/material';
import { Facebook, Google, People, GroupWork, Cloud as CloudIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { PageLoader } from '../components/Loading';
import { ThemeContext } from '../contexts/ThemeContext';
import api from '../api/axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Wide horizontal Client Performance Card
const ClientPerformanceCard = ({ client, data, primaryColor, secondaryColor }) => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        },
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Box
          sx={{
            bgcolor: primaryColor,
            px: 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'rgba(255,255,255,0.2)',
                fontSize: '0.9rem',
                fontWeight: 700,
              }}
            >
              {client.name?.charAt(0) || 'C'}
            </Avatar>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}
            >
              {client.name}
            </Typography>
          </Box>
          <Chip
            label={currentDate}
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        </Box>

        {/* Metrics Container */}
        <Box sx={{ p: 2.5 }}>
          {/* Meta Row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              pb: 2,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 80,
              }}
            >
              <Facebook sx={{ color: '#C08552', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#C08552' }}>
                META
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flex: 1, gap: 1 }}>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {data.metaForm || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  Form
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {data.metaWhatsapp || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  WhatsApp
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {(data.metaFund || 0).toFixed(0)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  Fund
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {(data.metaCPL || 0).toFixed(0)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  CPL
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Google Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 80,
              }}
            >
              <Google sx={{ color: '#3E2723', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#3E2723' }}>
                GOOGLE
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flex: 1, gap: 1 }}>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {data.googleCall || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  Call
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {data.googleWebsite || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  Website
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {(data.googleFund || 0).toFixed(0)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  Fund
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  px: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', lineHeight: 1.2 }}>
                  {(data.googleCPL || 0).toFixed(0)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                  CPL
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const DashboardPro = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#C08552';
  const secondaryColor = accentColor?.primary || '#3E2723';

  const [clients, setClients] = useState([]);
  const [todayLeads, setTodayLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get today's date string
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Fetch data from main API
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch clients and leads in parallel using axios with auth token
      const [clientsRes, leadsRes] = await Promise.all([
        api.get('/clients?limit=10000'),
        api.get('/leads?limit=10000'),
      ]);

      const clientsData = clientsRes.data.data || clientsRes.data;
      const leadsData = leadsRes.data.data || leadsRes.data;

      // Transform clients data
      const transformedClients = clientsData.map(c => ({
        _id: c._id,
        name: c.clientName,
        status: c.status,
      }));
      setClients(transformedClients);

      // Filter today's leads
      const todayLeadsData = leadsData.filter(lead => lead.date === today);
      setTodayLeads(todayLeadsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [today]);

  // Create a map of today's leads by client ID
  const todayEntriesByClient = useMemo(() => {
    const entriesMap = {};
    todayLeads.forEach((lead) => {
      entriesMap[lead.clientId] = {
        metaForm: lead.metaFormLead || 0,
        metaWhatsapp: lead.metaWhatsappLead || 0,
        metaFund: lead.metaFund || 0,
        metaCPL: lead.metaCpl || 0,
        googleCall: lead.googleCallLead || 0,
        googleWebsite: lead.googleWebsiteLead || 0,
        googleFund: lead.googleFund || 0,
        googleCPL: lead.googleCpl || 0,
      };
    });
    return entriesMap;
  }, [todayLeads]);

  // Create client performance data - use actual data from entries or default to 0
  const clientsPerformance = useMemo(() => {
    return clients.map((client) => {
      const entry = todayEntriesByClient[client._id];
      return {
        client,
        data: entry || {
          metaForm: 0,
          metaWhatsapp: 0,
          metaFund: 0,
          metaCPL: 0,
          googleCall: 0,
          googleWebsite: 0,
          googleFund: 0,
          googleCPL: 0,
        },
      };
    });
  }, [clients, todayEntriesByClient]);

  // Prepare chart data from backend entries
  const chartData = useMemo(() => {
    return clientsPerformance.map(({ client, data }) => ({
      name: client.name?.length > 12 ? client.name.substring(0, 12) + '...' : client.name,
      fullName: client.name,
      metaLeads: (data.metaForm || 0) + (data.metaWhatsapp || 0),
      googleLeads: (data.googleCall || 0) + (data.googleWebsite || 0),
      metaFund: data.metaFund || 0,
      googleFund: data.googleFund || 0,
    }));
  }, [clientsPerformance]);

  // Show aesthetic loader during initial data fetch
  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                bgcolor: primaryColor,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Dashboard
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Today's Client Performance - {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />}
          onClick={fetchDashboardData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Stats Cards - Total & Active Clients */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                bgcolor: primaryColor,
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                      Total Clients
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                      {clients.length}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <People sx={{ color: 'white', fontSize: 28 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                background: 'linear-gradient(135deg, #3E2723 0%, #1e8e3e 100%)',
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                      Active Clients
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                      {clients.filter(c => c.status === 'Active' || c.status === 'active').length}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GroupWork sx={{ color: 'white', fontSize: 28 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

      {/* Client Performance Cards - Wide Layout */}
      <>
          <Grid container spacing={3}>
            {clientsPerformance.map(({ client, data }) => (
              <Grid key={client._id} size={{ xs: 12, lg: 6 }}>
                <ClientPerformanceCard client={client} data={data} primaryColor={primaryColor} secondaryColor={secondaryColor} />
              </Grid>
            ))}
            {clients.length === 0 && (
              <Grid size={12}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                    borderRadius: 3,
                  }}
                >
                  <Typography color="text.secondary">
                    No clients found. Please add clients first.
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>

          {/* Bar Chart - Client Meta vs Google Tally */}
          {clients.length > 0 && (
            <Card
              sx={{
                mt: 4,
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    color: '#334155',
                  }}
                >
                  Client Performance - Meta vs Google (Today)
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: 12,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        padding: '12px 16px',
                      }}
                      labelFormatter={(label, payload) => {
                        // Show full client name in tooltip
                        if (payload && payload[0]) {
                          return payload[0].payload.fullName || label;
                        }
                        return label;
                      }}
                      formatter={(value, name) => {
                        const labels = {
                          metaLeads: 'Meta Leads',
                          googleLeads: 'Google Leads',
                          metaFund: 'Meta Fund',
                          googleFund: 'Google Fund',
                        };
                        return [value, labels[name] || name];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 20 }}
                      formatter={(value) => {
                        const labels = {
                          metaLeads: 'Meta Leads',
                          googleLeads: 'Google Leads',
                        };
                        return <span style={{ color: '#64748b', fontSize: 12 }}>{labels[value] || value}</span>;
                      }}
                    />
                    <Bar
                      dataKey="metaLeads"
                      fill="#C08552"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                    <Bar
                      dataKey="googleLeads"
                      fill="#3E2723"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
    </Box>
  );
};

export default DashboardPro;
