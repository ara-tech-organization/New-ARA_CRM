import React, { useEffect, useMemo, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardContent, Typography, Box, CircularProgress,
  Chip, Avatar, Button, Divider, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Facebook, Google, People, Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon, Circle as CircleIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import api from '../api/axios';
import { PageLoader } from '../components/Loading';
import { ThemeContext } from '../contexts/ThemeContext';
import { useDataCache } from '../contexts/DataCacheContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
const CLIENT_COLORS = ['#C08552', '#3E2723', '#C08552', '#3E2723', '#C08552', '#3E2723', '#C08552', '#3E2723', '#C08552', '#3E2723'];

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

// --- Client Performance Card — clickable, navigates to client ads detail page ---
const ClientCard = ({ client, data, color, dateStr, onClick, adsData }) => {
  const metaLeads = (data.metaForm || 0) + (data.metaWhatsapp || 0);
  const googleLeads = (data.googleCall || 0) + (data.googleWebsite || 0);
  const totalLeads = metaLeads + googleLeads;
  const isLinked = client.googleAdsEnabled && adsData;

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
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 16px rgba(192, 133, 82, 0.25)',
          borderColor: color,
        },
      }}>
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
          <Typography sx={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 700, fontSize: '0.92rem', color: 'white' }}>
            {client.name}
          </Typography>
        </Box>
        <Chip label={dateStr} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
      </Box>

      <CardContent sx={{ px: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* META row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
            <Facebook sx={{ color: '#C08552', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, color: '#C08552', fontSize: '0.78rem' }}>META</Typography>
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
            <Google sx={{ color: '#3E2723', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, color: '#3E2723', fontSize: '0.78rem' }}>GOOGLE</Typography>
          </Box>
          <Box sx={{ display: 'flex', flex: 1, gap: 0.8, alignItems: 'center' }}>
            {isLinked ? (
              <>
                <MetricBox value={`${(adsData.totalClicks > 0 ? ((adsData.totalConversions || 0) / adsData.totalClicks * 100) : 0).toFixed(2)}%`} label="Conv. Rate" />
                <MetricBox value={`₹${(adsData.fund ?? adsData.totalCost ?? 0).toLocaleString()}`} label="Fund" />
                <MetricBox value={(adsData.totalClicks || 0).toLocaleString()} label="Clicks" />
                <MetricBox value={(adsData.totalImpressions || 0).toLocaleString()} label="Impr." />
              </>
            ) : (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic', textAlign: 'center', width: '100%', py: 0.5 }}>
                Not linked to Google Ads
              </Typography>
            )}
          </Box>
        </Box>

        {/* Total bar at bottom */}
        {totalLeads > 0 && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Total Leads</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`Meta: ${metaLeads}`} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#C0855212', color: '#C08552', fontWeight: 600 }} />
              <Chip label={`Google: ${googleLeads}`} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#3E272312', color: '#3E2723', fontWeight: 600 }} />
              <Chip label={totalLeads} size="small" sx={{ height: 22, fontSize: '0.75rem', bgcolor: `${color}18`, color: color, fontWeight: 700 }} />
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { accentColor } = useContext(ThemeContext);
  const tealAccent = accentColor?.secondary || '#C08552';
  const { todayLeads, clients: cachedClients, todayLeadsLoading: leadsLoading, clientsLoading, refreshAll } = useDataCache();

  const [clientSearch, setClientSearch] = useState('');

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState(today);

  // Transform clients to simple format
  const clients = useMemo(() =>
    cachedClients.map(c => ({ _id: c._id, name: c.clientName, status: c.status, googleAdsEnabled: c.googleAdsEnabled || c.google_ads_enabled })),
  [cachedClients]);

  // If the user picks today, use the eager today cache; otherwise fetch on demand.
  const [otherDateLeads, setOtherDateLeads] = useState([]);
  const [otherDateLoading, setOtherDateLoading] = useState(false);
  useEffect(() => {
    if (selectedDate === today) {
      setOtherDateLeads([]);
      return;
    }
    setOtherDateLoading(true);
    api.get('/leads', { params: { date: selectedDate, limit: 10000 } })
      .then(res => {
        const data = res.data?.data || res.data || [];
        setOtherDateLeads(Array.isArray(data) ? data : []);
      })
      .catch(() => setOtherDateLeads([]))
      .finally(() => setOtherDateLoading(false));
  }, [selectedDate, today]);

  const dateLeads = useMemo(
    () => (selectedDate === today ? todayLeads : otherDateLeads),
    [selectedDate, today, todayLeads, otherDateLeads]
  );

  // Fetch Google Ads summary for linked accounts (keyed by clientId)
  const [adsDataMap, setAdsDataMap] = useState({});
  const [adsLoading, setAdsLoading] = useState(false);
  useEffect(() => {
    const hasLinked = cachedClients.some(c => c.googleAdsEnabled || c.google_ads_enabled);
    if (!hasLinked) return;
    setAdsLoading(true);
    api.get('/analytics/clients', { params: { start_date: selectedDate, end_date: selectedDate } })
      .then(res => {
        const list = res.data?.clients || res.data?.data || res.data || [];
        const map = {};
        (Array.isArray(list) ? list : []).forEach(c => { if (c.clientId) map[c.clientId] = c; });
        setAdsDataMap(map);
      })
      .catch(() => {})
      .finally(() => setAdsLoading(false));
  }, [cachedClients, selectedDate]);

  const loading = leadsLoading || clientsLoading || adsLoading || otherDateLoading;

  const dateByClient = useMemo(() => {
    const map = {};
    dateLeads.forEach(lead => {
      map[lead.clientId] = {
        metaForm: lead.metaFormLead || 0, metaWhatsapp: lead.metaWhatsappLead || 0,
        metaFund: lead.metaFund || 0, metaCPL: lead.metaCpl || 0,
        googleCall: lead.googleCallLead || 0, googleWebsite: lead.googleWebsiteLead || 0,
        googleFund: lead.googleFund || 0, googleCPL: lead.googleCpl || 0,
      };
    });
    return map;
  }, [dateLeads]);

  const emptyData = { metaForm: 0, metaWhatsapp: 0, metaFund: 0, metaCPL: 0, googleCall: 0, googleWebsite: 0, googleFund: 0, googleCPL: 0 };

  // Aggregated totals
  const totals = useMemo(() => {
    const t = { metaForm: 0, metaWhatsapp: 0, metaFund: 0, googleCall: 0, googleWebsite: 0, googleFund: 0 };
    dateLeads.forEach(l => {
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
  }, [dateLeads]);

  // Bar chart — clients with data
  const clientBarData = useMemo(() => {
    return clients.map(c => {
      const d = dateByClient[c._id] || emptyData;
      const meta = (d.metaForm || 0) + (d.metaWhatsapp || 0);
      const google = (d.googleCall || 0) + (d.googleWebsite || 0);
      // Short label for X-axis, full name for tooltip
      const short = c.name?.length > 12 ? c.name.substring(0, 12) + '…' : c.name;
      return { name: c.name, short, meta, google, total: meta + google };
    }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
  }, [clients, dateByClient]);

  // Top clients for table
  const topClients = useMemo(() => {
    return clients.map(c => {
      const d = dateByClient[c._id] || emptyData;
      const meta = (d.metaForm || 0) + (d.metaWhatsapp || 0);
      const google = (d.googleCall || 0) + (d.googleWebsite || 0);
      const total = meta + google;
      const spend = (d.metaFund || 0) + (d.googleFund || 0);
      return { name: c.name, meta, google, total, spend, cpl: total > 0 ? Math.round(spend / total) : 0 };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [clients, dateByClient]);

  if (loading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const activeClients = clients.filter(c => c.status === 'Active' || c.status === 'active').length;
  const selDateObj = new Date(selectedDate + 'T00:00:00');
  const dateStr = selDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dateLong = selDateObj.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const isToday = selectedDate === today;

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            {isToday ? "Today's" : ''} Client Performance — {dateLong}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="date"
            size="small"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, input: { max: today } }}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' } }}
          />
          {!isToday && (
            <Button size="small" variant="outlined" onClick={() => setSelectedDate(today)}>Today</Button>
          )}
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={refreshAll} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* ── Row 1: Summary Stats ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Clients', value: clients.length, color: tealAccent, icon: <People /> },
          { label: 'Active Clients', value: activeClients, color: '#10b981', icon: <People /> },
          { label: 'Total Leads', value: totals.totalLeads, color: tealAccent, icon: <TrendingUpIcon /> },
          { label: 'Meta Leads', value: totals.metaLeads, color: '#C08552', icon: <Facebook /> },
          { label: 'Google Leads', value: totals.googleLeads, color: '#3E2723', icon: <Google /> },
          { label: 'Total Spend', value: `₹${totals.totalSpend.toLocaleString()}`, color: '#C08552', icon: <TrendingUpIcon /> },
        ].map((s, i) => (
          <Grid key={i} size={{ xs: 6, sm: 4, md: 2 }}>
            <Card variant="outlined" sx={{ height: '100%', borderLeft: `3px solid ${s.color}` }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {React.cloneElement(s.icon, { sx: { color: s.color, fontSize: 20 } })}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', color: s.color, lineHeight: 1.2 }}>{s.value}</Typography>
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
                <Bar dataKey="meta" name="Meta Leads" fill="#C08552" radius={[4, 4, 0, 0]} />
                <Bar dataKey="google" name="Google Leads" fill="#3E2723" radius={[4, 4, 0, 0]} />
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Client-wise Performance
          <Typography component="span" sx={{ fontSize: '0.78rem', color: 'text.secondary', ml: 1 }}>
            {clients.length} clients
          </Typography>
        </Typography>
        <TextField
          size="small"
          placeholder="Search clients..."
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> } }}
          sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' } }}
        />
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[...clients].filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase())).sort((a, b) => {
          const aLeads = dateByClient[a._id] ? ((dateByClient[a._id].metaForm || 0) + (dateByClient[a._id].metaWhatsapp || 0) + (dateByClient[a._id].googleCall || 0) + (dateByClient[a._id].googleWebsite || 0)) : 0;
          const bLeads = dateByClient[b._id] ? ((dateByClient[b._id].metaForm || 0) + (dateByClient[b._id].metaWhatsapp || 0) + (dateByClient[b._id].googleCall || 0) + (dateByClient[b._id].googleWebsite || 0)) : 0;
          return bLeads - aLeads;
        }).map((client, i) => (
          <Grid key={client._id} size={{ xs: 12, md: 6, lg: 4 }}>
            <ClientCard
              client={client}
              data={dateByClient[client._id] || emptyData}
              color={CLIENT_COLORS[i % CLIENT_COLORS.length]}
              dateStr={dateStr}
              onClick={() => navigate(`/client-ads/${client._id}`)}
              adsData={adsDataMap[client._id]}
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
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#C08552' }} align="right">Meta</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#3E2723' }} align="right">Google</TableCell>
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
                      <TableCell align="right" sx={{ color: '#C08552', fontWeight: 600 }}>{c.meta}</TableCell>
                      <TableCell align="right" sx={{ color: '#3E2723', fontWeight: 600 }}>{c.google}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: tealAccent }}>{c.total}</TableCell>
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
