import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import {
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon,
  Facebook,
  Google,
  Language,
  Phone,
  WhatsApp,
  Campaign,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { fetchClients } from '../store/slices/clientSlice';
import { PageLoader } from '../components/Loading';

// Stats Card with comparison
const StatsCard = ({ title, value, icon, color, bgColor, comparison, comparisonLabel }) => (
  <Card
    sx={{
      height: '100%',
      border: '1px solid',
      borderColor: 'divider',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      },
    }}
  >
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color, my: 1 }}>
            {value}
          </Typography>
          {comparison !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {comparison >= 0 ? (
                <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
              )}
              <Typography variant="caption" sx={{ color: comparison >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                {comparison >= 0 ? '+' : ''}{comparison} {comparisonLabel || 'vs yesterday'}
              </Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: bgColor || `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icon, { sx: { color, fontSize: 24 } })}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// Client Card for displaying individual client data
const ClientCard = ({ client, data }) => (
  <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
    <CardContent sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Avatar sx={{ bgcolor: '#667eea', width: 36, height: 36, fontSize: '0.9rem' }}>
          {client.name?.charAt(0) || 'C'}
        </Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {client.name}
        </Typography>
      </Box>
      <Grid container spacing={1.5}>
        {/* Meta Section */}
        <Grid size={6}>
          <Box sx={{ p: 1.5, bgcolor: '#1877f210', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: '#1877f2', fontWeight: 600 }}>Meta</Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Fund</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{(data?.metaFund || 0).toLocaleString()}</Typography>
            </Box>
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">CPL</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{(data?.metaCPL || 0).toFixed(2)}</Typography>
            </Box>
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Leads</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{data?.metaLeads || 0}</Typography>
            </Box>
          </Box>
        </Grid>
        {/* Google Section */}
        <Grid size={6}>
          <Box sx={{ p: 1.5, bgcolor: '#34a85310', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: '#34a853', fontWeight: 600 }}>Google</Typography>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Fund</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{(data?.googleFund || 0).toLocaleString()}</Typography>
            </Box>
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">CPL</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{(data?.googleCPL || 0).toFixed(2)}</Typography>
            </Box>
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Leads</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{data?.googleLeads || 0}</Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

// Lead Type Card with comparison
const LeadTypeCard = ({ title, value, comparison, icon, color }) => (
  <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
    <CardContent sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {React.cloneElement(icon, { sx: { color, fontSize: 18 } })}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color, mb: 0.5 }}>{value}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {comparison >= 0 ? (
          <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
        ) : (
          <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
        )}
        <Typography variant="caption" sx={{ color: comparison >= 0 ? 'success.main' : 'error.main', fontWeight: 500 }}>
          {comparison >= 0 ? '+' : ''}{comparison} vs yesterday
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { clients, loading } = useSelector((state) => state.clients);
  const { user } = useSelector((state) => state.auth);

  const [selectedClient, setSelectedClient] = useState('all');

  useEffect(() => {
    dispatch(fetchClients({ limit: 100 }));
  }, [dispatch]);

  // Mock data - replace with actual API calls
  const dashboardData = useMemo(() => {
    // This would come from API based on selectedClient
    return {
      totalLeads: 156,
      totalLeadsYesterday: 142,
      activeClients: clients.filter(c => c.status === 'Active').length || 12,
      metaLeads: 89,
      metaLeadsYesterday: 82,
      googleLeads: 67,
      googleLeadsYesterday: 60,
      metaFund: 125000,
      metaCPL: 245.50,
      googleFund: 98000,
      googleCPL: 312.75,
    };
  }, [clients, selectedClient]);

  // Client-wise data for current date
  const clientsData = useMemo(() => {
    return clients.map(client => ({
      client,
      data: {
        metaFund: Math.floor(Math.random() * 50000) + 10000,
        metaCPL: Math.random() * 300 + 100,
        metaLeads: Math.floor(Math.random() * 50) + 5,
        googleFund: Math.floor(Math.random() * 40000) + 8000,
        googleCPL: Math.random() * 400 + 150,
        googleLeads: Math.floor(Math.random() * 40) + 3,
      },
    }));
  }, [clients]);

  // Today's performance data for chart
  const todayPerformance = useMemo(() => {
    return [
      { hour: '9 AM', meta: 12, google: 8 },
      { hour: '10 AM', meta: 18, google: 12 },
      { hour: '11 AM', meta: 25, google: 18 },
      { hour: '12 PM', meta: 22, google: 15 },
      { hour: '1 PM', meta: 15, google: 10 },
      { hour: '2 PM', meta: 28, google: 22 },
      { hour: '3 PM', meta: 35, google: 28 },
      { hour: '4 PM', meta: 42, google: 32 },
      { hour: '5 PM', meta: 38, google: 30 },
      { hour: '6 PM', meta: 30, google: 25 },
    ];
  }, []);

  // Lead types data
  const leadTypesData = useMemo(() => ({
    metaForm: { value: 45, comparison: 8 },
    whatsApp: { value: 44, comparison: -3 },
    website: { value: 38, comparison: 12 },
    googleCall: { value: 29, comparison: 5 },
  }), []);

  // Channel performance data
  const channelPerformance = useMemo(() => [
    { channel: 'Facebook', leads: 45, spend: 35000, cpl: 778 },
    { channel: 'Instagram', leads: 44, spend: 28000, cpl: 636 },
    { channel: 'Google Search', leads: 38, spend: 42000, cpl: 1105 },
    { channel: 'Google Display', leads: 29, spend: 18000, cpl: 621 },
  ], []);

  // Client Analysis data (without ROI)
  const clientAnalysis = useMemo(() => {
    return clients.slice(0, 6).map(client => ({
      name: client.name?.substring(0, 10) || 'Client',
      metaLeads: Math.floor(Math.random() * 30) + 5,
      googleLeads: Math.floor(Math.random() * 25) + 3,
    }));
  }, [clients]);

  // Top performing clients
  const topPerformingClients = useMemo(() => {
    return clients.slice(0, 5).map((client, index) => ({
      rank: index + 1,
      name: client.name,
      totalLeads: Math.floor(Math.random() * 100) + 20,
      metaLeads: Math.floor(Math.random() * 60) + 10,
      googleLeads: Math.floor(Math.random() * 40) + 5,
      totalSpend: Math.floor(Math.random() * 100000) + 20000,
    }));
  }, [clients]);

  // Show loader during initial data fetch (loading OR no clients loaded yet)
  if (loading || clients.length === 0) {
    return <PageLoader message="Loading dashboard..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back, {user?.name || 'Admin'}! Here's today's overview.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Select Client</InputLabel>
          <Select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            label="Select Client"
          >
            <MenuItem value="all">All Clients</MenuItem>
            {clients.map(client => (
              <MenuItem key={client._id} value={client._id}>{client.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Main Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Total Leads"
            value={dashboardData.totalLeads}
            icon={<TrendingUpIcon />}
            color="#667eea"
            comparison={dashboardData.totalLeads - dashboardData.totalLeadsYesterday}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Active Clients"
            value={dashboardData.activeClients}
            icon={<PeopleIcon />}
            color="#10b981"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Meta Leads"
            value={dashboardData.metaLeads}
            icon={<Facebook />}
            color="#1877f2"
            comparison={dashboardData.metaLeads - dashboardData.metaLeadsYesterday}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Google Leads"
            value={dashboardData.googleLeads}
            icon={<Google />}
            color="#34a853"
            comparison={dashboardData.googleLeads - dashboardData.googleLeadsYesterday}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Meta Fund"
            value={`₹${dashboardData.metaFund.toLocaleString()}`}
            icon={<MoneyIcon />}
            color="#4267B2"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Meta CPL"
            value={`₹${dashboardData.metaCPL.toFixed(2)}`}
            icon={<Campaign />}
            color="#1877f2"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Google Fund"
            value={`₹${dashboardData.googleFund.toLocaleString()}`}
            icon={<MoneyIcon />}
            color="#ea4335"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3, lg: 1.5 }}>
          <StatsCard
            title="Google CPL"
            value={`₹${dashboardData.googleCPL.toFixed(2)}`}
            icon={<Campaign />}
            color="#34a853"
          />
        </Grid>
      </Grid>

      {/* All Clients Current Date Leads */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Today's Client Performance
            <Chip
              label={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              size="small"
              color="primary"
              sx={{ ml: 2 }}
            />
          </Typography>
          <Grid container spacing={2}>
            {clientsData.map(({ client, data }) => (
              <Grid key={client._id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <ClientCard client={client} data={data} />
              </Grid>
            ))}
            {clientsData.length === 0 && (
              <Grid size={12}>
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No clients found. Please add clients first.
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Meta and Google Today's Performance Chart */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Meta & Google Today's Performance
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={todayPerformance}>
              <defs>
                <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1877f2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1877f2" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34a853" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34a853" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="meta"
                name="Meta Leads"
                stroke="#1877f2"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMeta)"
              />
              <Area
                type="monotone"
                dataKey="google"
                name="Google Leads"
                stroke="#34a853"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorGoogle)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lead Types Compared to Yesterday */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LeadTypeCard
            title="Meta Form"
            value={leadTypesData.metaForm.value}
            comparison={leadTypesData.metaForm.comparison}
            icon={<Facebook />}
            color="#1877f2"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LeadTypeCard
            title="WhatsApp"
            value={leadTypesData.whatsApp.value}
            comparison={leadTypesData.whatsApp.comparison}
            icon={<WhatsApp />}
            color="#25D366"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LeadTypeCard
            title="Website"
            value={leadTypesData.website.value}
            comparison={leadTypesData.website.comparison}
            icon={<Language />}
            color="#ea4335"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LeadTypeCard
            title="Google Call"
            value={leadTypesData.googleCall.value}
            comparison={leadTypesData.googleCall.comparison}
            icon={<Phone />}
            color="#34a853"
          />
        </Grid>
      </Grid>

      {/* Channel Performance */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Channel Performance
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f9fafb' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Channel</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Leads</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Spend</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">CPL</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {channelPerformance.map((row) => (
                  <TableRow key={row.channel} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.channel.includes('Facebook') || row.channel.includes('Instagram') ? (
                          <Facebook sx={{ color: '#1877f2', fontSize: 20 }} />
                        ) : (
                          <Google sx={{ color: '#34a853', fontSize: 20 }} />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.channel}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">{row.leads}</TableCell>
                    <TableCell align="right">₹{row.spend.toLocaleString()}</TableCell>
                    <TableCell align="right">₹{row.cpl.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Client Analysis Bar Chart (without ROI) */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Client Analysis
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={clientAnalysis} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="metaLeads" name="Meta Leads" fill="#1877f2" radius={[4, 4, 0, 0]} />
              <Bar dataKey="googleLeads" name="Google Leads" fill="#34a853" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Performing Clients (without Actions and ROI) */}
      <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Top Performing Clients
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f9fafb' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total Leads</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1877f2' }} align="right">Meta Leads</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#34a853' }} align="right">Google Leads</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total Spend</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topPerformingClients.map((client) => (
                  <TableRow key={client.rank} hover>
                    <TableCell>
                      <Chip
                        label={`#${client.rank}`}
                        size="small"
                        sx={{
                          bgcolor: client.rank === 1 ? '#ffd700' : client.rank === 2 ? '#c0c0c0' : client.rank === 3 ? '#cd7f32' : '#f3f4f6',
                          color: client.rank <= 3 ? 'white' : 'text.primary',
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: '#667eea', fontSize: '0.75rem' }}>
                          {client.name?.charAt(0) || 'C'}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{client.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{client.totalLeads}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#1877f2' }}>{client.metaLeads}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#34a853' }}>{client.googleLeads}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{client.totalSpend.toLocaleString()}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {topPerformingClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No clients found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;
