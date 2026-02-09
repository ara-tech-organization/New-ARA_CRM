import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Chip,
  IconButton,
  Avatar,
  Button,
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Assignment as AssignmentIcon,
  ArrowForward,
  Phone,
  Email,
  Language,
  Campaign,
  WhatsApp,
} from '@mui/icons-material';

const MetricCard = ({ title, value, subtitle, icon, color, gradient }) => (
  <Card
    sx={{
      height: '100%',
      background: gradient || `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
      borderLeft: `4px solid ${color}`,
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      },
    }}
  >
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography color="text.secondary" gutterBottom variant="overline" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="h2" component="div" sx={{ fontWeight: 700, color, mb: 1 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 3,
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 16px ${color}40`,
          }}
        >
          {React.cloneElement(icon, { sx: { color: 'white', fontSize: 32 } })}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const ChannelMetric = ({ label, value, color, icon }) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: 2,
      bgcolor: `${color}10`,
      border: `1px solid ${color}30`,
      textAlign: 'center',
      minWidth: 100,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
      {icon && React.cloneElement(icon, { sx: { fontSize: 16, color } })}
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
    <Typography variant="h6" sx={{ fontWeight: 700, color }}>
      {value}
    </Typography>
  </Box>
);

const ClientLeadCard = ({ client }) => (
  <Card
    sx={{
      border: '2px solid',
      borderColor: 'divider',
      borderRadius: 3,
      transition: 'all 0.3s ease',
      '&:hover': {
        borderColor: 'primary.main',
        boxShadow: 4,
        transform: 'translateY(-2px)',
      },
    }}
  >
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          {client.name}
        </Typography>
        <Chip label={client.date} size="small" color="primary" variant="outlined" />
      </Box>

      {/* Meta Channels */}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1 }}>
        META CHANNELS
      </Typography>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="Meta Form"
            value={client.channels.metaForm}
            color="#667eea"
            icon={<Campaign />}
          />
        </Grid>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="WhatsApp"
            value={client.channels.metaWhatsapp}
            color="#25D366"
            icon={<WhatsApp />}
          />
        </Grid>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="Meta Fund"
            value={`₹${client.channels.metaFund.toFixed(2)}`}
            color="#1877f2"
            icon={<MoneyIcon />}
          />
        </Grid>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="Meta CPL"
            value={`₹${client.channels.metaCPL.toFixed(2)}`}
            color="#ff6b6b"
            icon={<TrendingUpIcon />}
          />
        </Grid>
      </Grid>

      {/* Google Channels */}
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1 }}>
        GOOGLE CHANNELS
      </Typography>
      <Grid container spacing={1}>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="Google Call"
            value={client.channels.googleCall}
            color="#34a853"
            icon={<Phone />}
          />
        </Grid>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="Website"
            value={client.channels.googleWebsite}
            color="#4285f4"
            icon={<Language />}
          />
        </Grid>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="Google Fund"
            value={`₹${client.channels.googleFund.toFixed(2)}`}
            color="#fbbc04"
            icon={<MoneyIcon />}
          />
        </Grid>
        <Grid size={{xs: 6, sm: 3}}>
          <ChannelMetric
            label="Google CPL"
            value={`₹${client.channels.googleCPL.toFixed(2)}`}
            color="#ea4335"
            icon={<TrendingUpIcon />}
          />
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

const DashboardEnhanced = () => {
  const navigate = useNavigate();
  const { clients } = useSelector((state) => state.clients);
  const { leads } = useSelector((state) => state.leads);

  const activeClients = useMemo(() => {
    return clients.filter(client => client.status === 'Active');
  }, [clients]);

  const inactiveClients = useMemo(() => {
    return clients.filter(client => client.status === 'Inactive');
  }, [clients]);

  // Sample client lead data with channels (in real app, this would come from your backend)
  const clientLeadData = useMemo(() => {
    return [
      {
        id: 1,
        name: 'Advanced Grohair & Gloskin Chidambaram',
        date: '24/01/2026',
        channels: {
          metaForm: 8,
          metaWhatsapp: 11,
          metaFund: 1895.92,
          metaCPL: 236.99,
          googleCall: 0,
          googleWebsite: 0,
          googleFund: 0.00,
          googleCPL: 0.00,
        },
      },
      {
        id: 2,
        name: 'AdGlo Skin Clinic Namakkal',
        date: '24/01/2026',
        channels: {
          metaForm: 2,
          metaWhatsapp: 7,
          metaFund: 1255.64,
          metaCPL: 627.82,
          googleCall: 0,
          googleWebsite: 0,
          googleFund: 0.00,
          googleCPL: 0.00,
        },
      },
      {
        id: 3,
        name: 'Advanced Grohair & Gloskin Cantonment',
        date: '24/01/2026',
        channels: {
          metaForm: 0,
          metaWhatsapp: 0,
          metaFund: 0.00,
          metaCPL: 0.00,
          googleCall: 0,
          googleWebsite: 0,
          googleFund: 0.00,
          googleCPL: 0.00,
        },
      },
    ];
  }, []);

  const totalActiveChannels = useMemo(() => {
    return clientLeadData.reduce((sum, client) => {
      const activeChannels = Object.values(client.channels).filter(val => val > 0).length;
      return sum + activeChannels;
    }, 0);
  }, [clientLeadData]);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Dashboard Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Updated: {new Date().toLocaleString()}
        </Typography>
      </Box>

      {/* Top Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{xs: 12, sm: 6, md: 4}}>
          <MetricCard
            title="Total Active Clients"
            value={activeClients.length}
            subtitle="Currently engaged clients"
            icon={<PeopleIcon />}
            color="#8b5cf6"
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 4}}>
          <MetricCard
            title="Inactive Clients"
            value={inactiveClients.length}
            subtitle="Clients not active currently"
            icon={<PeopleIcon />}
            color="#ef4444"
            gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 4}}>
          <MetricCard
            title="Active Channels"
            value={totalActiveChannels}
            subtitle="Marketing channels in use"
            icon={<Campaign />}
            color="#f97316"
            gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
          />
        </Grid>
      </Grid>

      {/* Client Lead Summary Section */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Client Lead Summary
          </Typography>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
            {activeClients.length} Active Clients
          </Typography>
        </Box>
        <Button
          variant="contained"
          endIcon={<ArrowForward />}
          onClick={() => navigate('/clients')}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #65408b 100%)',
            },
          }}
        >
          View All Clients
        </Button>
      </Box>

      {/* Client Lead Cards */}
      <Grid container spacing={3}>
        {clientLeadData.map((client) => (
          <Grid size={{xs: 12}} key={client.id}>
            <ClientLeadCard client={client} />
          </Grid>
        ))}
      </Grid>

      {/* Channel Performance Summary */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          Channel Performance Overview
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{xs: 12, md: 6}}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Meta Channels
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Campaign sx={{ color: '#667eea' }} />
                      <Typography variant="body2">Meta Form Leads</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea' }}>
                      {clientLeadData.reduce((sum, c) => sum + c.channels.metaForm, 0)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WhatsApp sx={{ color: '#25D366' }} />
                      <Typography variant="body2">WhatsApp Leads</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#25D366' }}>
                      {clientLeadData.reduce((sum, c) => sum + c.channels.metaWhatsapp, 0)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MoneyIcon sx={{ color: '#1877f2' }} />
                      <Typography variant="body2">Total Meta Fund</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1877f2' }}>
                      ₹{clientLeadData.reduce((sum, c) => sum + c.channels.metaFund, 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{xs: 12, md: 6}}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Google Channels
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Phone sx={{ color: '#34a853' }} />
                      <Typography variant="body2">Google Call Leads</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#34a853' }}>
                      {clientLeadData.reduce((sum, c) => sum + c.channels.googleCall, 0)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Language sx={{ color: '#4285f4' }} />
                      <Typography variant="body2">Website Leads</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#4285f4' }}>
                      {clientLeadData.reduce((sum, c) => sum + c.channels.googleWebsite, 0)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MoneyIcon sx={{ color: '#fbbc04' }} />
                      <Typography variant="body2">Total Google Fund</Typography>
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#fbbc04' }}>
                      ₹{clientLeadData.reduce((sum, c) => sum + c.channels.googleFund, 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default DashboardEnhanced;
