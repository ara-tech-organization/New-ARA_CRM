import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Tabs, Tab, Chip, IconButton,
  TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  InputAdornment, Tooltip, LinearProgress, Paper, Collapse,
} from '@mui/material';
import {
  Facebook as FacebookIcon, Google as GoogleIcon, Search as SearchIcon,
  Campaign as CampaignIcon, AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon, KeyboardArrowRight, KeyboardArrowDown,
  AccountBalanceWallet, ShowChart, Warning as WarningIcon,
} from '@mui/icons-material';

const COPPER = '#C08552';
const BROWN = '#3E2723';
const CREAM = '#FFF8F0';

// ───────── Mock Google Ads data (matches user's JSON schema) ─────────
const MOCK_GOOGLE_DATA = {
  clients: [
    {
      customer_id: '1234567890',
      account_name: 'ARA Discoveries Private Limited',
      currency: 'INR',
      time_zone: 'Asia/Kolkata',
      date_range: 'LAST_30_DAYS',
      billing: {
        billing_type: 'PREPAID',
        total_added_funds: 50000,
        total_spend: 22140,
        available_balance: 27860,
        low_balance_threshold: 5000,
        last_updated: '2026-04-15T10:00:00Z',
      },
      payments: [
        { payment_id: 'pay_001', amount: 30000, method: 'UPI', date: '2026-04-05' },
        { payment_id: 'pay_002', amount: 20000, method: 'Bank Transfer', date: '2026-04-10' },
      ],
      summary: { impressions: 25000, clicks: 1800, ctr: 7.2, avg_cpc: 12.3, cost: 22140, conversions: 120, cost_per_conversion: 184.5 },
      campaigns: [
        {
          campaign_id: '987654321', name: 'Hair Clinic Leads', status: 'ENABLED',
          budget: { amount: 500, delivery_method: 'STANDARD' },
          metrics: { impressions: 12000, clicks: 850, ctr: 7.08, avg_cpc: 12.5, cost: 10625, conversions: 65 },
          ad_groups: [
            {
              ad_group_id: 'ag001', name: 'Hair Transplant Chennai', status: 'ENABLED',
              metrics: { impressions: 5000, clicks: 400, ctr: 8.0, cost: 4800, conversions: 30 },
              ads: [
                { ad_id: 'ad001', type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', metrics: { impressions: 4000, clicks: 300, ctr: 7.5, cost: 3500, conversions: 20 } },
                { ad_id: 'ad002', type: 'RESPONSIVE_SEARCH_AD', status: 'PAUSED', metrics: { impressions: 1000, clicks: 100, ctr: 10.0, cost: 1300, conversions: 10 } },
              ],
            },
            {
              ad_group_id: 'ag002', name: 'Hair Treatment Madurai', status: 'ENABLED',
              metrics: { impressions: 3000, clicks: 200, ctr: 6.6, cost: 2500, conversions: 15 },
              ads: [
                { ad_id: 'ad003', type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', metrics: { impressions: 2500, clicks: 180, ctr: 7.2, cost: 2200, conversions: 12 } },
              ],
            },
          ],
        },
        {
          campaign_id: '987654322', name: 'Hair Loss Awareness', status: 'PAUSED',
          budget: { amount: 300, delivery_method: 'STANDARD' },
          metrics: { impressions: 8000, clicks: 600, ctr: 7.5, avg_cpc: 10.5, cost: 6300, conversions: 25 },
          ad_groups: [],
        },
      ],
    },
    {
      customer_id: '2222222222',
      account_name: 'ABC Dental Clinic',
      currency: 'INR',
      billing: { billing_type: 'PREPAID', total_added_funds: 30000, total_spend: 15000, available_balance: 15000, low_balance_threshold: 3000 },
      payments: [{ payment_id: 'pay_003', amount: 30000, method: 'Bank Transfer', date: '2026-04-12' }],
      summary: { impressions: 15000, clicks: 900, ctr: 6.0, avg_cpc: 16.6, cost: 15000, conversions: 70, cost_per_conversion: 214.2 },
      campaigns: [
        {
          campaign_id: '555555001', name: 'Dental Implants', status: 'ENABLED',
          budget: { amount: 400, delivery_method: 'STANDARD' },
          metrics: { impressions: 9000, clicks: 600, ctr: 6.6, avg_cpc: 15, cost: 9000, conversions: 45 },
          ad_groups: [],
        },
      ],
    },
  ],
};

// ───────── Utility formatters ─────────
const fmtNum = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const fmtPct = (n) => `${(n ?? 0).toFixed(2)}%`;

// Status chip
const StatusChip = ({ status }) => (
  <Chip
    label={status}
    size="small"
    sx={{
      height: 18,
      fontSize: '0.65rem',
      fontWeight: 600,
      bgcolor: status === 'ENABLED' ? '#10b98115' : '#f59e0b15',
      color: status === 'ENABLED' ? '#10b981' : '#f59e0b',
    }}
  />
);

// Reusable Excel-like cell
const cellSx = {
  border: '1px solid #C0855215',
  fontSize: '0.78rem',
  py: 0.6, px: 1,
  fontFamily: 'monospace',
};
const headerCellSx = {
  ...cellSx,
  backgroundColor: `${COPPER} !important`,
  color: '#FFFFFF !important',
  fontWeight: '700 !important',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  position: 'sticky',
  top: 0,
  zIndex: 2,
  borderBottom: `2px solid ${BROWN} !important`,
};

// ───────── Ad row (leaf level) ─────────
const AdRow = ({ ad }) => (
  <TableRow sx={{ bgcolor: '#FFFDFA' }}>
    <TableCell sx={{ ...cellSx, pl: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#94a3b8' }} />
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{ad.ad_id}</Typography>
        <Chip label="AD" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: '#E2E8F0', color: '#64748b' }} />
      </Box>
    </TableCell>
    <TableCell sx={cellSx}><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{ad.type}</Typography></TableCell>
    <TableCell sx={cellSx}><StatusChip status={ad.status} /></TableCell>
    <TableCell sx={cellSx} align="right">—</TableCell>
    <TableCell sx={cellSx} align="right">{fmtNum(ad.metrics?.impressions)}</TableCell>
    <TableCell sx={cellSx} align="right">{fmtNum(ad.metrics?.clicks)}</TableCell>
    <TableCell sx={cellSx} align="right">{fmtPct(ad.metrics?.ctr)}</TableCell>
    <TableCell sx={cellSx} align="right">{fmtINR(ad.metrics?.cost)}</TableCell>
    <TableCell sx={cellSx} align="right">{fmtNum(ad.metrics?.conversions)}</TableCell>
    <TableCell sx={cellSx} align="right">{ad.metrics?.conversions > 0 ? fmtINR(Math.round(ad.metrics.cost / ad.metrics.conversions)) : '—'}</TableCell>
  </TableRow>
);

// ───────── Ad Group row with expandable ads ─────────
const AdGroupRow = ({ adGroup }) => {
  const [open, setOpen] = useState(false);
  const hasAds = (adGroup.ads || []).length > 0;
  return (
    <>
      <TableRow sx={{ bgcolor: '#FEF7EC', '&:hover': { bgcolor: '#FCEED6' } }}>
        <TableCell sx={{ ...cellSx, pl: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setOpen(!open)} disabled={!hasAds} sx={{ p: 0.3 }}>
              {hasAds ? (open ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />) : null}
            </IconButton>
            <Chip label="AD GROUP" size="small" sx={{ height: 15, fontSize: '0.58rem', bgcolor: '#C0855225', color: COPPER, fontWeight: 700 }} />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>{adGroup.name}</Typography>
            {hasAds && <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>({adGroup.ads.length} ads)</Typography>}
          </Box>
        </TableCell>
        <TableCell sx={cellSx}>—</TableCell>
        <TableCell sx={cellSx}><StatusChip status={adGroup.status} /></TableCell>
        <TableCell sx={cellSx} align="right">—</TableCell>
        <TableCell sx={cellSx} align="right">{fmtNum(adGroup.metrics?.impressions)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtNum(adGroup.metrics?.clicks)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtPct(adGroup.metrics?.ctr)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtINR(adGroup.metrics?.cost)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtNum(adGroup.metrics?.conversions)}</TableCell>
        <TableCell sx={cellSx} align="right">{adGroup.metrics?.conversions > 0 ? fmtINR(Math.round(adGroup.metrics.cost / adGroup.metrics.conversions)) : '—'}</TableCell>
      </TableRow>
      {open && (adGroup.ads || []).map(ad => <AdRow key={ad.ad_id} ad={ad} />)}
    </>
  );
};

// ───────── Campaign row with expandable ad groups ─────────
const CampaignRow = ({ campaign }) => {
  const [open, setOpen] = useState(false);
  const hasGroups = (campaign.ad_groups || []).length > 0;
  return (
    <>
      <TableRow sx={{ bgcolor: '#FDF0E0', '&:hover': { bgcolor: '#FAE3C4' } }}>
        <TableCell sx={{ ...cellSx, pl: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setOpen(!open)} disabled={!hasGroups} sx={{ p: 0.3 }}>
              {hasGroups ? (open ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />) : null}
            </IconButton>
            <CampaignIcon sx={{ fontSize: 14, color: COPPER }} />
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{campaign.name}</Typography>
            {hasGroups && <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>({campaign.ad_groups.length} groups)</Typography>}
          </Box>
        </TableCell>
        <TableCell sx={cellSx}><Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{campaign.campaign_id}</Typography></TableCell>
        <TableCell sx={cellSx}><StatusChip status={campaign.status} /></TableCell>
        <TableCell sx={cellSx} align="right"><Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: COPPER }}>{fmtINR(campaign.budget?.amount)}/day</Typography></TableCell>
        <TableCell sx={cellSx} align="right">{fmtNum(campaign.metrics?.impressions)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtNum(campaign.metrics?.clicks)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtPct(campaign.metrics?.ctr)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtINR(campaign.metrics?.cost)}</TableCell>
        <TableCell sx={cellSx} align="right">{fmtNum(campaign.metrics?.conversions)}</TableCell>
        <TableCell sx={cellSx} align="right">{campaign.metrics?.conversions > 0 ? fmtINR(Math.round(campaign.metrics.cost / campaign.metrics.conversions)) : '—'}</TableCell>
      </TableRow>
      {open && (campaign.ad_groups || []).map(ag => <AdGroupRow key={ag.ad_group_id} adGroup={ag} />)}
    </>
  );
};

// ───────── Account row with expandable campaigns ─────────
const AccountRow = ({ client }) => {
  const [open, setOpen] = useState(false);
  const balancePercent = client.billing?.total_added_funds > 0
    ? (client.billing.available_balance / client.billing.total_added_funds) * 100
    : 0;
  const isLow = client.billing?.available_balance < client.billing?.low_balance_threshold;

  return (
    <>
      <TableRow sx={{ bgcolor: COPPER, '&:hover': { bgcolor: '#A56E40' } }}>
        <TableCell sx={{ ...cellSx, color: '#fff', fontWeight: 700, borderColor: '#fff2' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setOpen(!open)} sx={{ p: 0.3, color: '#fff' }}>
              {open ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
            </IconButton>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{client.account_name}</Typography>
            {isLow && (
              <Tooltip title="Low balance">
                <WarningIcon sx={{ fontSize: 16, color: '#fbbf24' }} />
              </Tooltip>
            )}
          </Box>
        </TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }}><Typography sx={{ fontSize: '0.7rem', color: '#fff', opacity: 0.85 }}>{client.customer_id}</Typography></TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }}>
          <Chip label={client.billing?.billing_type || 'PREPAID'} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }} />
        </TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }} align="right">
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>{fmtINR(client.billing?.available_balance)}</Typography>
        </TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }} align="right">{fmtNum(client.summary?.impressions)}</TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }} align="right">{fmtNum(client.summary?.clicks)}</TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }} align="right">{fmtPct(client.summary?.ctr)}</TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }} align="right">{fmtINR(client.summary?.cost)}</TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }} align="right">{fmtNum(client.summary?.conversions)}</TableCell>
        <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }} align="right">{fmtINR(client.summary?.cost_per_conversion)}</TableCell>
      </TableRow>

      {/* Billing detail row */}
      {open && (
        <TableRow>
          <TableCell colSpan={10} sx={{ p: 0, border: 'none', bgcolor: '#FAF3E8' }}>
            <Collapse in={open}>
              <Box sx={{ p: 2 }}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 1.2, borderLeft: `3px solid ${COPPER}` }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalanceWallet sx={{ fontSize: 20, color: COPPER }} />
                        <Box>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Total Added</Typography>
                          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: BROWN }}>{fmtINR(client.billing?.total_added_funds)}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 1.2, borderLeft: `3px solid ${BROWN}` }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShowChart sx={{ fontSize: 20, color: BROWN }} />
                        <Box>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Total Spent</Typography>
                          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: BROWN }}>{fmtINR(client.billing?.total_spend)}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 1.2, borderLeft: `3px solid ${isLow ? '#ef4444' : '#10b981'}` }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MoneyIcon sx={{ fontSize: 20, color: isLow ? '#ef4444' : '#10b981' }} />
                        <Box>
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>Available</Typography>
                          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: isLow ? '#ef4444' : '#10b981' }}>{fmtINR(client.billing?.available_balance)}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 1.2 }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', mb: 0.3 }}>Budget Usage</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={100 - balancePercent}
                        sx={{
                          height: 6, borderRadius: 3, bgcolor: '#E2E8F0',
                          '& .MuiLinearProgress-bar': { bgcolor: isLow ? '#ef4444' : COPPER, borderRadius: 3 },
                        }}
                      />
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.3 }}>{(100 - balancePercent).toFixed(1)}% spent</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      {open && (client.campaigns || []).map(c => <CampaignRow key={c.campaign_id} campaign={c} />)}
    </>
  );
};

const AdsDashboard = () => {
  const [tabValue, setTabValue] = useState(0); // 0 = Google, 1 = Meta
  const [searchQuery, setSearchQuery] = useState('');

  const googleClients = MOCK_GOOGLE_DATA.clients;

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return googleClients.filter(c =>
      c.account_name?.toLowerCase().includes(q) ||
      c.customer_id?.includes(q)
    );
  }, [googleClients, searchQuery]);

  // Grand totals
  const totals = useMemo(() => {
    const t = { impressions: 0, clicks: 0, cost: 0, conversions: 0, available: 0, funds: 0 };
    filteredClients.forEach(c => {
      t.impressions += c.summary?.impressions || 0;
      t.clicks += c.summary?.clicks || 0;
      t.cost += c.summary?.cost || 0;
      t.conversions += c.summary?.conversions || 0;
      t.available += c.billing?.available_balance || 0;
      t.funds += c.billing?.total_added_funds || 0;
    });
    t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    t.cpa = t.conversions > 0 ? t.cost / t.conversions : 0;
    return t;
  }, [filteredClients]);

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Client Ads Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Excel-style view of Google Ads &amp; Meta Ads performance — expand rows to drill down
        </Typography>
      </Box>

      {/* ── KPI Stats Row ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Total Clients', value: filteredClients.length, color: COPPER, icon: <TrendingUpIcon /> },
          { label: 'Impressions', value: fmtNum(totals.impressions), color: BROWN, icon: <ShowChart /> },
          { label: 'Clicks', value: fmtNum(totals.clicks), color: COPPER, icon: <TrendingUpIcon /> },
          { label: 'Avg CTR', value: fmtPct(totals.ctr), color: BROWN, icon: <ShowChart /> },
          { label: 'Total Spend', value: fmtINR(totals.cost), color: COPPER, icon: <MoneyIcon /> },
          { label: 'Available', value: fmtINR(totals.available), color: BROWN, icon: <AccountBalanceWallet /> },
        ].map((s, i) => (
          <Grid key={i} size={{ xs: 6, sm: 4, md: 2 }}>
            <Card variant="outlined" sx={{ borderLeft: `3px solid ${s.color}` }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, '&:last-child': { pb: 1 } }}>
                <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {React.cloneElement(s.icon, { sx: { color: s.color, fontSize: 17 } })}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: s.color, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Tabs + Search ── */}
      <Card variant="outlined" sx={{ mb: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Tabs
            value={tabValue}
            onChange={(e, v) => setTabValue(v)}
            sx={{
              '& .MuiTabs-indicator': { bgcolor: COPPER, height: 3 },
              '& .Mui-selected': { color: `${COPPER} !important` },
            }}
          >
            <Tab
              icon={<GoogleIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={`Google Ads (${googleClients.length})`}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
            <Tab
              icon={<FacebookIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label="Meta Ads"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
          </Tabs>
          <TextField
            size="small" placeholder="Search account or customer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 260, my: 1 }}
          />
        </Box>

        {/* ── Excel-style Table ── */}
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {tabValue === 0 ? (
            <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)', overflowX: 'auto' }}>
              <Table size="small" stickyHeader sx={{ minWidth: 1200 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...headerCellSx, minWidth: 320, left: 0, position: 'sticky', zIndex: 3 }}>Account / Campaign / Ad Group / Ad</TableCell>
                    <TableCell sx={headerCellSx}>ID</TableCell>
                    <TableCell sx={headerCellSx}>Status</TableCell>
                    <TableCell sx={headerCellSx} align="right">Balance / Budget</TableCell>
                    <TableCell sx={headerCellSx} align="right">Impressions</TableCell>
                    <TableCell sx={headerCellSx} align="right">Clicks</TableCell>
                    <TableCell sx={headerCellSx} align="right">CTR</TableCell>
                    <TableCell sx={headerCellSx} align="right">Cost</TableCell>
                    <TableCell sx={headerCellSx} align="right">Conversions</TableCell>
                    <TableCell sx={headerCellSx} align="right">Cost / Conv</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ ...cellSx, textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">No accounts found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map(c => <AccountRow key={c.customer_id} client={c} />)
                  )}

                  {/* Grand total row */}
                  {filteredClients.length > 0 && (
                    <TableRow sx={{ bgcolor: BROWN }}>
                      <TableCell sx={{ ...cellSx, color: '#fff', fontWeight: 700, borderColor: '#fff2' }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>GRAND TOTAL</Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }}>—</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2' }}>—</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2', fontWeight: 700 }} align="right">{fmtINR(totals.available)}</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2', fontWeight: 700 }} align="right">{fmtNum(totals.impressions)}</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2', fontWeight: 700 }} align="right">{fmtNum(totals.clicks)}</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2', fontWeight: 700 }} align="right">{fmtPct(totals.ctr)}</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2', fontWeight: 700 }} align="right">{fmtINR(totals.cost)}</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2', fontWeight: 700 }} align="right">{fmtNum(totals.conversions)}</TableCell>
                      <TableCell sx={{ ...cellSx, color: '#fff', borderColor: '#fff2', fontWeight: 700 }} align="right">{fmtINR(Math.round(totals.cpa))}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            // Meta tab placeholder
            <Box sx={{ py: 10, textAlign: 'center' }}>
              <FacebookIcon sx={{ fontSize: 48, color: COPPER, mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Meta Ads Integration Coming Soon</Typography>
              <Typography variant="body2" color="text.secondary">
                Once Meta Marketing API is connected, this tab will show the same Excel-style hierarchy:
                <br />Ad Accounts → Campaigns → Ad Sets → Ads
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>LEGEND:</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, bgcolor: COPPER, borderRadius: 0.5 }} />
          <Typography sx={{ fontSize: '0.72rem' }}>Account</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, bgcolor: '#FDF0E0', border: `1px solid ${COPPER}`, borderRadius: 0.5 }} />
          <Typography sx={{ fontSize: '0.72rem' }}>Campaign</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, bgcolor: '#FEF7EC', border: `1px solid ${COPPER}60`, borderRadius: 0.5 }} />
          <Typography sx={{ fontSize: '0.72rem' }}>Ad Group</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, bgcolor: '#FFFDFA', border: `1px solid #94a3b8`, borderRadius: 0.5 }} />
          <Typography sx={{ fontSize: '0.72rem' }}>Ad</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default AdsDashboard;
