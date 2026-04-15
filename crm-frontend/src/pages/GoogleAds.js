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
  Search as SearchIcon,
  Language as LanguageIcon,
  YouTube as YouTubeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';

const GoogleAds = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [campaigns, setCampaigns] = useState([
    {
      id: 1,
      name: 'Search - Hair Treatment Keywords',
      type: 'Search',
      status: 'Active',
      budget: 8000,
      spent: 5890.25,
      impressions: 245000,
      clicks: 5670,
      leads: 342,
      cpl: 17.22,
      ctr: 2.31,
      conversions: 312,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    },
    {
      id: 2,
      name: 'Display - Skin Clinic Awareness',
      type: 'Display',
      status: 'Active',
      budget: 4000,
      spent: 3250.00,
      impressions: 450000,
      clicks: 8900,
      leads: 245,
      cpl: 13.27,
      ctr: 1.98,
      conversions: 220,
      startDate: '2026-01-05',
      endDate: '2026-01-25',
    },
    {
      id: 3,
      name: 'YouTube - Video Campaign',
      type: 'Video',
      status: 'Paused',
      budget: 3000,
      spent: 1850.50,
      impressions: 180000,
      clicks: 3200,
      leads: 125,
      cpl: 14.80,
      ctr: 1.78,
      conversions: 108,
      startDate: '2026-01-10',
      endDate: '2026-01-20',
    },
  ]);

  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
  const avgCPL = totalLeads > 0 ? (totalSpent / totalLeads).toFixed(2) : 0;
  const conversionRate = totalLeads > 0 ? ((totalConversions / totalLeads) * 100).toFixed(1) : 0;
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

  const getCampaignTypeIcon = (type) => {
    switch (type) {
      case 'Search': return <SearchIcon sx={{ fontSize: 16, color: '#4285f4' }} />;
      case 'Display': return <LanguageIcon sx={{ fontSize: 16, color: '#ea4335' }} />;
      case 'Video': return <YouTubeIcon sx={{ fontSize: 16, color: '#ff0000' }} />;
      default: return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Google Ads Campaigns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your Search, Display, and Video campaigns
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            background: 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #3367d6 0%, #1765cc 100%)',
            },
          }}
        >
          Create Campaign
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #4285f415 0%, #4285f405 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(66, 133, 244, 0.3)',
                transform: 'translateY(-4px)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: '#4285f420',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 28, color: '#4285f4' }} />
                </Box>
                <Chip
                  icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                  label={`${activeCampaigns} Active`}
                  size="small"
                  sx={{
                    bgcolor: '#dcfce7',
                    color: '#166534',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: '#4285f4' }}>
                ₹{totalBudget.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Total Budget
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #ea433515 0%, #ea433505 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(234, 67, 53, 0.3)',
                transform: 'translateY(-4px)',
              },
            }}
          >
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                Total Spent
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, color: '#ea4335' }}>
                ₹{totalSpent.toLocaleString()}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(totalSpent / totalBudget) * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#fee2e2',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#ea4335',
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontWeight: 500 }}>
                {((totalSpent / totalBudget) * 100).toFixed(1)}% of budget used
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #34a85315 0%, #34a85305 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(52, 168, 83, 0.3)',
                transform: 'translateY(-4px)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: '#34a85320',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 28, color: '#34a853' }} />
                </Box>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: '#34a853' }}>
                {totalLeads}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                Total Leads
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                {totalConversions} conversions ({conversionRate}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #fbbc0415 0%, #fbbc0405 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(251, 188, 4, 0.3)',
                transform: 'translateY(-4px)',
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: '#fbbc0420',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingDownIcon sx={{ fontSize: 28, color: '#fbbc04' }} />
                </Box>
                <Chip
                  icon={<TrendingDownIcon sx={{ fontSize: 14 }} />}
                  label="-8.3%"
                  size="small"
                  sx={{
                    bgcolor: '#dcfce7',
                    color: '#166534',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: '#fbbc04' }}>
                ₹{avgCPL}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Avg Cost Per Lead
              </Typography>
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
                <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Campaign Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Budget</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Spent</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Leads</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">CPL</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Conv. Rate</TableCell>
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
                        {getCampaignTypeIcon(campaign.type)}
                        <Typography variant="body2">{campaign.type}</Typography>
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
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#34a853' }}>
                        {campaign.leads}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">₹{campaign.cpl.toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {((campaign.conversions / campaign.leads) * 100).toFixed(1)}%
                    </TableCell>
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
          Create New Google Ads Campaign
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Campaign Name"
            margin="normal"
            placeholder="e.g., Search Campaign - Hair Keywords"
          />
          <TextField
            fullWidth
            select
            label="Campaign Type"
            margin="normal"
            defaultValue="Search"
          >
            <MenuItem value="Search">Search</MenuItem>
            <MenuItem value="Display">Display</MenuItem>
            <MenuItem value="Video">Video (YouTube)</MenuItem>
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
              background: 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #3367d6 0%, #1765cc 100%)',
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

export default GoogleAds;
