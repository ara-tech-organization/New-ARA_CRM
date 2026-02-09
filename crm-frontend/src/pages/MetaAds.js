import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  WhatsApp as WhatsAppIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';

const MetaAds = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [campaigns, setCampaigns] = useState([
    {
      id: 1,
      name: 'Hair Treatment Campaign - Jan 2026',
      platform: 'Facebook',
      status: 'Active',
      budget: 5000,
      spent: 3245.50,
      impressions: 125000,
      clicks: 3450,
      leads: 245,
      cpl: 13.25,
      ctr: 2.76,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    },
    {
      id: 2,
      name: 'Skin Clinic Awareness',
      platform: 'Instagram',
      status: 'Active',
      budget: 3000,
      spent: 2100.75,
      impressions: 89000,
      clicks: 2340,
      leads: 178,
      cpl: 11.80,
      ctr: 2.63,
      startDate: '2026-01-10',
      endDate: '2026-01-25',
    },
    {
      id: 3,
      name: 'WhatsApp Lead Gen',
      platform: 'WhatsApp',
      status: 'Paused',
      budget: 2000,
      spent: 1250.00,
      impressions: 45000,
      clicks: 1200,
      leads: 95,
      cpl: 13.16,
      ctr: 2.67,
      startDate: '2026-01-05',
      endDate: '2026-01-20',
    },
  ]);

  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);
  const avgCPL = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : 0;
  const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;

  const handleToggleStatus = (id) => {
    setCampaigns(campaigns.map(c =>
      c.id === id
        ? { ...c, status: c.status === 'Active' ? 'Paused' : 'Active' }
        : c
    ));
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      setCampaigns(campaigns.filter(c => c.id !== id));
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'Facebook': return <FacebookIcon sx={{ fontSize: 16, color: '#1877f2' }} />;
      case 'Instagram': return <InstagramIcon sx={{ fontSize: 16, color: '#E4405F' }} />;
      case 'WhatsApp': return <WhatsAppIcon sx={{ fontSize: 16, color: '#25D366' }} />;
      default: return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Meta Ads Campaigns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your Facebook, Instagram, and WhatsApp campaigns
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            background: 'linear-gradient(135deg, #1877f2 0%, #0d47a1 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #1665d8 0%, #0a3d91 100%)',
            },
          }}
        >
          Create Campaign
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 500 }}>
                    TOTAL BUDGET
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#1877f2' }}>
                    ₹{totalBudget.toLocaleString()}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Chip
                      icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                      label="Active"
                      size="small"
                      sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600 }}
                    />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 500 }}>
                TOTAL SPENT
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#ef4444' }}>
                ₹{totalSpent.toLocaleString()}
              </Typography>
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={(totalSpent / totalBudget) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: '#fee2e2',
                    '& .MuiLinearProgress-bar': { bgcolor: '#ef4444' }
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {((totalSpent / totalBudget) * 100).toFixed(1)}% of budget used
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 500 }}>
                TOTAL LEADS
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#10b981' }}>
                {totalLeads}
              </Typography>
              <Chip
                icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                label="+12.5% vs last month"
                size="small"
                sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600, mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 500 }}>
                AVG COST PER LEAD
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#f59e0b' }}>
                ₹{avgCPL}
              </Typography>
              <Chip
                icon={<TrendingDownIcon sx={{ fontSize: 14 }} />}
                label="-5.2% improvement"
                size="small"
                sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600, mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Campaigns Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Active Campaigns ({activeCampaigns})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Campaign Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Platform</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Budget</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Spent</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Leads</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">CPL</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">CTR</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {campaign.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {campaign.startDate} to {campaign.endDate}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getPlatformIcon(campaign.platform)}
                        <Typography variant="body2">{campaign.platform}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={campaign.status}
                        color={campaign.status === 'Active' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">₹{campaign.budget.toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        ₹{campaign.spent.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {((campaign.spent / campaign.budget) * 100).toFixed(0)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981' }}>
                        {campaign.leads}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">₹{campaign.cpl.toFixed(2)}</TableCell>
                    <TableCell align="right">{campaign.ctr.toFixed(2)}%</TableCell>
                    <TableCell align="center">
                      <Tooltip title={campaign.status === 'Active' ? 'Pause' : 'Resume'}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleStatus(campaign.id)}
                          sx={{ mr: 0.5 }}
                        >
                          {campaign.status === 'Active' ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" sx={{ mr: 0.5 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(campaign.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          Create New Meta Campaign
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Campaign Name"
            margin="normal"
            placeholder="e.g., Hair Treatment Campaign"
          />
          <TextField
            fullWidth
            select
            label="Platform"
            margin="normal"
            defaultValue="Facebook"
          >
            <MenuItem value="Facebook">Facebook</MenuItem>
            <MenuItem value="Instagram">Instagram</MenuItem>
            <MenuItem value="WhatsApp">WhatsApp</MenuItem>
          </TextField>
          <Grid container spacing={2}>
            <Grid size={{xs: 6}}>
              <TextField
                fullWidth
                label="Budget (₹)"
                type="number"
                margin="normal"
              />
            </Grid>
            <Grid size={{xs: 6}}>
              <TextField
                fullWidth
                select
                label="Status"
                margin="normal"
                defaultValue="Active"
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Paused">Paused</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{xs: 6}}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{xs: 6}}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #1877f2 0%, #0d47a1 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1665d8 0%, #0a3d91 100%)',
              },
            }}
          >
            Create Campaign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MetaAds;
