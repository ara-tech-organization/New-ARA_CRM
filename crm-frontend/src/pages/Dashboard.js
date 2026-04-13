import React, { useEffect, useMemo, useState, useContext } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, CircularProgress,
  Chip, Avatar, Button, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Facebook, Google, People, Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon, Circle as CircleIcon,
} from '@mui/icons-material';
import { PageLoader } from '../components/Loading';
import { ThemeContext } from '../contexts/ThemeContext';
import { useDataCache } from '../contexts/DataCacheContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
const CLIENT_COLORS = ['#4A7CC9', '#3D8B8B', '#6E5BA7', '#B06882', '#4E8A6E', '#5A6B82', '#A07D4F', '#3E4A5C', '#3A7AB5', '#9A7083'];

// --- Custom Tooltip (shows full client name from payload) ---
const GlassTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  // Get the full client name from the data payload
  const fullName = payload[0]?.payload?.name || '';
  return (
    <Box sx={{ bgcolor: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2, px: 1.5, py: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160 }}>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 0.5, color: 'text.primary' }}>{fullName}</Typography>
      {payload.map((entry, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 0.3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CircleIcon sx={{ fontSize: 8, color: entry.color }} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{entry.name}</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
            {typeof entry.value === 'number' && entry.name?.includes('Fund') ? `₹${entry.value.toLocaleString()}` : entry.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// --- Client Performance Card (clean horizontal layout like DashboardPro but with glass) ---
const ClientCard = ({ client, data, color, todayStr }) => {
  const metaLeads = (data.metaForm || 0) + (data.metaWhatsapp || 0);
  const googleLeads = (data.googleCall || 0) + (data.googleWebsite || 0);
  const totalLeads = metaLeads + googleLeads;

  const MetricBox = ({ value, label }) => (
    <Box sx={{ flex: 1, textAlign: 'center', py: 0.8, px: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1.5 }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );

  return (
    <Card sx={{ height: '100%', overflow: 'hidden' }}>
      {/* Colored header with client name */}
      <Box sx={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
        px: 2, py: 1.2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(255,255,255,0.25)', fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
            {client.name?.charAt(0)}
          </Avatar>
          <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: 'white' }}>
            {client.name}
          </Typography>
        </Box>
        <Chip label={todayStr} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
      </Box>

      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* META row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
            <Facebook sx={{ color: '#1877f2', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, color: '#1877f2', fontSize: '0.78rem' }}>META</Typography>
          </Box>
          <Box sx={{ display: 'flex', flex: 1, gap: 0.8 }}>
            <MetricBox value={data.metaForm || 0} label="Form" />
            <MetricBox value={data.metaWhatsapp || 0} label="WhatsApp" />
            <MetricBox value={(data.metaFund || 0).toLocaleString()} label="Fund" />
            <MetricBox value={(data.metaCPL || 0).toFixed(0)} label="CPL" />
          </Box>
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        {/* GOOGLE row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
            <Google sx={{ color: '#34a853', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, color: '#34a853', fontSize: '0.78rem' }}>GOOGLE</Typography>
          </Box>
          <Box sx={{ display: 'flex', flex: 1, gap: 0.8 }}>
            <MetricBox value={data.googleCall || 0} label="Call" />
            <MetricBox value={data.googleWebsite || 0} label="Website" />
            <MetricBox value={(data.googleFund || 0).toLocaleString()} label="Fund" />
            <MetricBox value={(data.googleCPL || 0).toFixed(0)} label="CPL" />
          </Box>
        </Box>

        {/* Total bar at bottom */}
        {totalLeads > 0 && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Total Leads</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`Meta: ${metaLeads}`} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#1877f212', color: '#1877f2', fontWeight: 600 }} />
              <Chip label={`Google: ${googleLeads}`} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#34a85312', color: '#34a853', fontWeight: 600 }} />
              <Chip label={totalLeads} size="small" sx={{ height: 22, fontSize: '0.75rem', bgcolor: `${color}18`, color: color, fontWeight: 700 }} />
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.primary || '#4A7CC9';
  const { leads: cachedLeads, clients: cachedClients, leadsLoading, clientsLoading, refreshAll } = useDataCache();

  const loading = leadsLoading || clientsLoading;

  // Transform clients to simple format
  const clients = useMemo(() =>
    cachedClients.map(c => ({ _id: c._id, name: c.clientName, status: c.status })),
  [cachedClients]);

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const todayLeads = useMemo(() => cachedLeads.filter(l => l.date === today), [cachedLeads, today]);

  const todayByClient = useMemo(() => {
    const map = {};
    todayLeads.forEach(lead => {
      map[lead.clientId] = {
        metaForm: lead.metaFormLead || 0, metaWhatsapp: lead.metaWhatsappLead || 0,
        metaFund: lead.metaFund || 0, metaCPL: lead.metaCpl || 0,
        googleCall: lead.googleCallLead || 0, googleWebsite: lead.googleWebsiteLead || 0,
        googleFund: lead.googleFund || 0, googleCPL: lead.googleCpl || 0,
      };
    });
    return map;
  }, [todayLeads]);

  const emptyData = { metaForm: 0, metaWhatsapp: 0, metaFund: 0, metaCPL: 0, googleCall: 0, googleWebsite: 0, googleFund: 0, googleCPL: 0 };

  // Aggregated totals
  const totals = useMemo(() => {
    const t = { metaForm: 0, metaWhatsapp: 0, metaFund: 0, googleCall: 0, googleWebsite: 0, googleFund: 0 };
    todayLeads.forEach(l => {
      t.metaForm += l.metaFormLead || 0;
      t.metaWhatsapp += l.metaWhatsappLead || 0;
      t.metaFund += l.metaFund || 0;
      t.googleCall += l.googleCallLead || 0;
      t.googleWebsite += l.googleWebsiteLead || 0;
      t.googleFund += l.googleFund || 0;
    });
    t.metaLeads = t.metaForm + t.metaWhatsapp;
    t.googleLeads = t.googleCall + t.googleWebsite;
    t.totalLeads = t.metaLeads + t.googleLeads;
    t.totalSpend = t.metaFund + t.googleFund;
    return t;
  }, [todayLeads]);

  // Bar chart — clients with data
  const clientBarData = useMemo(() => {
    return clients.map(c => {
      const d = todayByClient[c._id] || emptyData;
      const meta = (d.metaForm || 0) + (d.metaWhatsapp || 0);
      const google = (d.googleCall || 0) + (d.googleWebsite || 0);
      // Short label for X-axis, full name for tooltip
      const short = c.name?.length > 12 ? c.name.substring(0, 12) + '…' : c.name;
      return { name: c.name, short, meta, google, total: meta + google };
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
  }, [clients, todayByClient]);

  // Top clients for table
  const topClients = useMemo(() => {
    return clients.map(c => {
      const d = todayByClient[c._id] || emptyData;
      const meta = (d.metaForm || 0) + (d.metaWhatsapp || 0);
      const google = (d.googleCall || 0) + (d.googleWebsite || 0);
      const total = meta + google;
      const spend = (d.metaFund || 0) + (d.googleFund || 0);
      return { name: c.name, meta, google, total, spend, cpl: total > 0 ? Math.round(spend / total) : 0 };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [clients, todayByClient]);

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'active').length;
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const todayLong = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Today's Client Performance — {todayLong}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={refreshAll} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {/* ── Row 1: Summary Stats ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Clients', value: clients.length, color: primaryColor, icon: <People /> },
          { label: 'Active Clients', value: activeClients, color: '#10b981', icon: <People /> },
          { label: 'Total Leads', value: totals.totalLeads, color: '#667eea', icon: <TrendingUpIcon /> },
          { label: 'Meta Leads', value: totals.metaLeads, color: '#1877f2', icon: <Facebook /> },
          { label: 'Google Leads', value: totals.googleLeads, color: '#34a853', icon: <Google /> },
          { label: 'Total Spend', value: `₹${totals.totalSpend.toLocaleString()}`, color: '#f59e0b', icon: <TrendingUpIcon /> },
        ].map((s, i) => (
          <Grid key={i} size={{ xs: 6, sm: 4, md: 2 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {React.cloneElement(s.icon, { sx: { color: s.color, fontSize: 22 } })}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.35rem', color: s.color, lineHeight: 1.2 }}>{s.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Row 2: Client Leads Bar Chart (full width) ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography sx={{ fontWeight: 600, fontSize: '0.92rem', mb: 0.5 }}>Client Leads — Meta vs Google</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>Today's performance by client</Typography>
          {clientBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={clientBarData} barGap={4} barSize={22} margin={{ left: 0, right: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                <XAxis dataKey="short" tick={{ fontSize: 10.5 }} tickLine={false} axisLine={false} angle={-40} textAnchor="end" height={80} interval={0} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <RechartsTooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: 4 }} />
                <Bar dataKey="meta" name="Meta Leads" fill="#1877f2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="google" name="Google Leads" fill="#34a853" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ color: 'text.secondary' }}>No leads data today</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: Client Performance Cards ── */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
        Client-wise Performance
        <Typography component="span" sx={{ fontSize: '0.78rem', color: 'text.secondary', ml: 1 }}>
          {clients.length} clients
        </Typography>
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[...clients].sort((a, b) => {
          const aLeads = todayByClient[a._id] ? ((todayByClient[a._id].metaForm || 0) + (todayByClient[a._id].metaWhatsapp || 0) + (todayByClient[a._id].googleCall || 0) + (todayByClient[a._id].googleWebsite || 0)) : 0;
          const bLeads = todayByClient[b._id] ? ((todayByClient[b._id].metaForm || 0) + (todayByClient[b._id].metaWhatsapp || 0) + (todayByClient[b._id].googleCall || 0) + (todayByClient[b._id].googleWebsite || 0)) : 0;
          return bLeads - aLeads;
        }).map((client, i) => (
          <Grid key={client._id} size={{ xs: 12, md: 6, lg: 4 }}>
            <ClientCard
              client={client}
              data={todayByClient[client._id] || emptyData}
              color={CLIENT_COLORS[i % CLIENT_COLORS.length]}
              todayStr={todayStr}
            />
          </Grid>
        ))}
        {clients.length === 0 && (
          <Grid size={12}>
            <Card><CardContent sx={{ textAlign: 'center', py: 4 }}><Typography color="text.secondary">No clients found</Typography></CardContent></Card>
          </Grid>
        )}
      </Grid>

      {/* ── Row 4: Top Performing Clients Table ── */}
      {topClients.length > 0 && (
        <Card>
          <CardContent>
            <Typography sx={{ fontWeight: 600, fontSize: '0.92rem', mb: 1.5 }}>
              Top Performing Clients
              <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 1 }}>Ranked by today's leads</Typography>
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1877f2' }} align="right">Meta</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#34a853' }} align="right">Google</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">Spend</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">CPL</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topClients.map((c, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Chip label={i + 1} size="small" sx={{
                          height: 22, minWidth: 28, fontWeight: 700,
                          bgcolor: i === 0 ? '#ffd70025' : i === 1 ? '#c0c0c025' : i === 2 ? '#cd7f3225' : 'transparent',
                          color: i === 0 ? '#b8860b' : i === 1 ? '#808080' : i === 2 ? '#8b4513' : 'text.secondary',
                          border: i > 2 ? '1px solid' : 'none', borderColor: 'divider',
                        }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 26, height: 26, fontSize: '0.68rem', fontWeight: 700, bgcolor: CLIENT_COLORS[i % CLIENT_COLORS.length] }}>
                            {c.name?.charAt(0)}
                          </Avatar>
                          <Typography sx={{ fontWeight: 500 }}>{c.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#1877f2', fontWeight: 600 }}>{c.meta}</TableCell>
                      <TableCell align="right" sx={{ color: '#34a853', fontWeight: 600 }}>{c.google}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: primaryColor }}>{c.total}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>₹{c.spend.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: c.cpl > 500 ? '#ef4444' : '#10b981' }}>₹{c.cpl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Dashboard;
