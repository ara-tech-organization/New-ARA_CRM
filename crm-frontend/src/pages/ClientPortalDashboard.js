import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button, Avatar,
  TextField, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Alert, IconButton, Collapse,
} from '@mui/material';
import {
  Google as GoogleIcon, Logout as LogoutIcon, Refresh as RefreshIcon,
  ShowChart as ShowChartIcon, TrendingUp as TrendingUpIcon,
  AccountBalanceWallet as WalletIcon, AttachMoney as MoneyIcon,
  Campaign as CampaignIcon, Warning as WarningIcon,
  KeyboardArrowDown as ArrowDownIcon, KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const CREAM = '#FFF8F0';
const GOOGLE_GREEN = '#34a853';

const API_URL = process.env.REACT_APP_API_URL || 'https://crm-new-eue2hubpd8hxfnbv.southeastasia-01.azurewebsites.net/api';

const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${Number(n ?? 0).toFixed(2)}%`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const KpiCard = ({ label, value, color, icon, sublabel }) => (
  <Card variant="outlined" sx={{ borderLeft: `3px solid ${color}`, height: '100%' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon, { sx: { color, fontSize: 20 } })}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color, lineHeight: 1.2 }}>{value}</Typography>
        {sublabel && <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{sublabel}</Typography>}
      </Box>
    </CardContent>
  </Card>
);

const ClientPortalDashboard = () => {
  const navigate = useNavigate();
  const [clientData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('clientData')); } catch { return null; }
  });
  const token = localStorage.getItem('clientToken');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [expandedCampaigns, setExpandedCampaigns] = useState({});

  const clientApi = useMemo(() => {
    const instance = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });
    instance.interceptors.request.use(config => {
      const t = localStorage.getItem('clientToken');
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    instance.interceptors.response.use(r => r, err => {
      if (err.response?.status === 401) {
        localStorage.removeItem('clientToken');
        localStorage.removeItem('clientData');
        window.location.replace('/client-login');
      }
      return Promise.reject(err);
    });
    return instance;
  }, []);

  useEffect(() => {
    if (!token) { navigate('/client-login'); return; }
  }, [token, navigate]);

  const fetchAnalytics = async () => {
    setLoading(true); setError(null);
    try {
      const res = await clientApi.get('/client-portal/analytics', {
        params: { start_date: dateFrom, end_date: dateTo },
        timeout: 10000,
      });
      setData(res.data || null);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to fetch data';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchAnalytics(); }, [dateFrom, dateTo]);

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientData');
    navigate('/client-login');
  };

  const clientInfo = data?.client;
  const summary = data?.summary;
  const billing = data?.client?.billing;
  const campaignMetrics = useMemo(
    () => [...(data?.campaignMetrics || [])].sort((a, b) => (Number(b?.cost) || 0) - (Number(a?.cost) || 0)),
    [data]
  );
  const keywords = data?.keywords || [];
  const dailyMetrics = data?.dailyMetrics || [];
  const displayName = clientData?.clientName || clientInfo?.clientName || 'Client Portal';

  const keywordsByCampaign = useMemo(() => {
    const map = {};
    keywords.forEach(kw => {
      const cid = kw.campaign_id;
      if (!map[cid]) map[cid] = [];
      map[cid].push(kw);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0)));
    return map;
  }, [keywords]);

  // Spike chart data
  const spikeChartData = useMemo(() => {
    const byDate = {};
    dailyMetrics.forEach(d => {
      const dt = d.date;
      if (!byDate[dt]) byDate[dt] = { date: dt, cost: 0, clicks: 0, impressions: 0, conversions: 0 };
      byDate[dt].cost += Number(d.cost) || 0;
      byDate[dt].clicks += Number(d.clicks) || 0;
      byDate[dt].impressions += Number(d.impressions) || 0;
      byDate[dt].conversions += Number(d.conversions) || 0;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      day: new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' }),
      datePart: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      cpc: d.clicks > 0 ? d.cost / d.clicks : 0,
      costPerConv: d.conversions > 0 ? d.cost / d.conversions : 0,
    }));
  }, [dailyMetrics]);

  const SpikeTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <Paper sx={{ p: 1.5, minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1, borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 }}>{d.day}, {fmtDate(d.date)}</Typography>
        {[
          { label: 'Clicks', value: fmtNum(d.clicks) },
          { label: 'Impressions', value: fmtNum(d.impressions) },
          { label: 'CPC', value: fmtINR(d.cpc) },
          { label: 'Conversions', value: fmtNum(d.conversions) },
          { label: 'Cost / Conv.', value: d.conversions > 0 ? fmtINR(d.costPerConv) : '—' },
        ].map((row, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, mb: 0.4 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{row.label}</Typography>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{row.value}</Typography>
          </Box>
        ))}
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Total Cost</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: GOOGLE_GREEN }}>{fmtINR(d.cost)}</Typography>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: CREAM }}>
      {/* Top Bar */}
      <Box sx={{ bgcolor: BROWN, color: 'white', px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: COPPER, fontWeight: 700, fontSize: '1rem' }}>
            {displayName?.charAt(0)}
          </Avatar>
          <Box>
            <Typography sx={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 700, fontSize: '1.1rem' }}>{displayName}</Typography>
            <Typography sx={{ fontSize: '0.7rem', opacity: 0.7 }}>Client Portal</Typography>
          </Box>
        </Box>
        <Button variant="outlined" size="small" startIcon={<LogoutIcon />} onClick={handleLogout}
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}>
          Logout
        </Button>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
        {/* Date Filter */}
        <Card variant="outlined" sx={{ mb: 2, position: 'relative', overflow: 'hidden' }}>
          {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: `${GOOGLE_GREEN}20`, '& .MuiLinearProgress-bar': { bgcolor: GOOGLE_GREEN } }} />}
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.secondary' }}>Date Range:</Typography>
            <TextField type="date" size="small" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} disabled={loading} />
            <TextField type="date" size="small" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} disabled={loading} />
            <Box sx={{ display: 'flex', gap: 0.8 }}>
              {(() => {
                const iso = (d) => d.toISOString().split('T')[0];
                const t = iso(new Date());
                const d7 = new Date(); d7.setDate(new Date().getDate() - 6);
                const d14 = new Date(); d14.setDate(new Date().getDate() - 13);
                const d30 = new Date(); d30.setDate(new Date().getDate() - 29);
                const isT = dateFrom === t && dateTo === t;
                const is7 = dateFrom === iso(d7) && dateTo === t;
                const is14 = dateFrom === iso(d14) && dateTo === t;
                const is30 = dateFrom === iso(d30) && dateTo === t;
                const aSx = { bgcolor: GOOGLE_GREEN, color: '#fff', borderColor: GOOGLE_GREEN, '&:hover': { bgcolor: '#2c8f45' } };
                return (
                  <>
                    <Button size="small" variant={isT ? 'contained' : 'outlined'} disabled={loading} sx={isT ? aSx : undefined} onClick={() => { setDateFrom(t); setDateTo(t); }}>Today</Button>
                    <Button size="small" variant={is7 ? 'contained' : 'outlined'} disabled={loading} sx={is7 ? aSx : undefined} onClick={() => { setDateFrom(iso(d7)); setDateTo(t); }}>7 Days</Button>
                    <Button size="small" variant={is14 ? 'contained' : 'outlined'} disabled={loading} sx={is14 ? aSx : undefined} onClick={() => { setDateFrom(iso(d14)); setDateTo(t); }}>14 Days</Button>
                    <Button size="small" variant={is30 ? 'contained' : 'outlined'} disabled={loading} sx={is30 ? aSx : undefined} onClick={() => { setDateFrom(iso(d30)); setDateTo(t); }}>30 Days</Button>
                  </>
                );
              })()}
            </Box>
            <Button size="small" variant="outlined" startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={fetchAnalytics} disabled={loading} sx={{ ml: 'auto' }}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && !data && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={40} sx={{ color: GOOGLE_GREEN }} />
            <Typography sx={{ mt: 2, color: 'text.secondary' }}>Fetching your ad performance...</Typography>
          </Box>
        )}

        {/* Error */}
        {!loading && error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Data */}
        {data && (
          <Box sx={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.2s' }}>
            {/* KPIs */}
            {summary && (
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {summary.totalImpressions != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Impressions" value={fmtNum(summary.totalImpressions)} color={GOOGLE_GREEN} icon={<ShowChartIcon />} /></Grid>}
                {summary.totalClicks != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Clicks" value={fmtNum(summary.totalClicks)} color={COPPER} icon={<TrendingUpIcon />} /></Grid>}
                {summary.ctr != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="CTR" value={fmtPct(summary.ctr)} color={BROWN} icon={<ShowChartIcon />} /></Grid>}
                {summary.cpc != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Avg CPC" value={fmtINR(summary.cpc)} color={COPPER} icon={<MoneyIcon />} /></Grid>}
                {summary.totalCost != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Total Cost" value={fmtINR(summary.totalCost)} color={GOOGLE_GREEN} icon={<WalletIcon />} /></Grid>}
                {summary.totalConversions != null && <Grid size={{ xs: 6, md: 2 }}><KpiCard label="Conversions" value={fmtNum(summary.totalConversions)} sublabel={summary.cpa ? `${fmtINR(summary.cpa)}/conv` : null} color={BROWN} icon={<CampaignIcon />} /></Grid>}
              </Grid>
            )}

            {/* Spike Chart */}
            {spikeChartData.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                  Campaign Performance
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={spikeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="cpSpikeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GOOGLE_GREEN} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={GOOGLE_GREEN} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f020" vertical={false} />
                      <XAxis dataKey="datePart" tickLine={false} axisLine={false} height={45}
                        tick={({ x, y, index }) => {
                          const row = spikeChartData[index];
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={12} textAnchor="middle" fontSize={10.5} fill="#555">{row?.datePart}</text>
                              <text x={0} y={0} dy={25} textAnchor="middle" fontSize={9} fill="#999">({row?.day})</text>
                            </g>
                          );
                        }}
                      />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `₹${v}`} />
                      <RechartsTooltip content={<SpikeTooltip />} />
                      <Area type="linear" dataKey="cost" stroke={GOOGLE_GREEN} fill="url(#cpSpikeGrad)" strokeWidth={2.5}
                        dot={{ r: 5, fill: GOOGLE_GREEN, stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: GOOGLE_GREEN, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>
              </>
            )}

            {/* Campaigns Table */}
            {campaignMetrics.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1, borderLeft: `3px solid ${GOOGLE_GREEN}`, pl: 1.5 }}>
                  Campaigns ({campaignMetrics.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10`, width: 40 }} />
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }}>Campaign</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Cost</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Clicks</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Impr.</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">CTR</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Avg. CPC</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: `${GOOGLE_GREEN}10` }} align="right">Conv.</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {campaignMetrics.map(c => {
                        const campKw = keywordsByCampaign[c.campaignId] || [];
                        const isExp = !!expandedCampaigns[c.campaignId];
                        return (
                          <React.Fragment key={c.campaignId}>
                            <TableRow hover sx={{ '& > *': { borderBottom: isExp ? 'none' : undefined } }}>
                              <TableCell sx={{ p: 0.5 }}>
                                {campKw.length > 0 && (
                                  <IconButton size="small" onClick={() => setExpandedCampaigns(p => ({ ...p, [c.campaignId]: !p[c.campaignId] }))}>
                                    {isExp ? <ArrowUpIcon sx={{ fontSize: 18 }} /> : <ArrowDownIcon sx={{ fontSize: 18 }} />}
                                  </IconButton>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                  <CampaignIcon sx={{ fontSize: 14, color: GOOGLE_GREEN }} />
                                  {c.campaignName}
                                  {campKw.length > 0 && <Chip label={`${campKw.length} keywords`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: `${GOOGLE_GREEN}12`, color: GOOGLE_GREEN, fontWeight: 600, ml: 0.5 }} />}
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: GOOGLE_GREEN }}>{fmtINR(c.cost)}</TableCell>
                              <TableCell align="right">{fmtNum(c.clicks)}</TableCell>
                              <TableCell align="right">{fmtNum(c.impressions)}</TableCell>
                              <TableCell align="right">{fmtPct(c.ctr)}</TableCell>
                              <TableCell align="right">{fmtINR(c.cpc)}</TableCell>
                              <TableCell align="right">{fmtNum(c.conversions)}</TableCell>
                            </TableRow>
                            {campKw.length > 0 && (
                              <TableRow>
                                <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                                  <Collapse in={isExp} timeout="auto" unmountOnExit>
                                    <Box sx={{ mx: 2, mb: 1.5, mt: 0.5 }}>
                                      <Table size="small" sx={{ bgcolor: `${GOOGLE_GREEN}04`, borderRadius: 1 }}>
                                        <TableHead>
                                          <TableRow>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Keyword</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }}>Match</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Clicks</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Impr.</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">CTR</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">CPC</TableCell>
                                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary' }} align="right">Cost</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {campKw.map((kw, ki) => (
                                            <TableRow key={kw.criterion_id || ki} hover>
                                              <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{kw.keyword_text}</TableCell>
                                              <TableCell><Chip label={kw.match_type} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} /></TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtNum(kw.clicks)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtNum(kw.impressions)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtPct(kw.ctr)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtINR(kw.cpc)}</TableCell>
                                              <TableCell align="right" sx={{ fontSize: '0.78rem', fontWeight: 600, color: GOOGLE_GREEN }}>{fmtINR(kw.cost)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {!summary && campaignMetrics.length === 0 && (
              <Alert severity="info">No data for the selected date range.</Alert>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ClientPortalDashboard;
