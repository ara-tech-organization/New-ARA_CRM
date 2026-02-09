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
  Email as EmailIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Reply as ReplyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

const EmailCampaigns = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [campaigns, setCampaigns] = useState([
    {
      id: 1,
      name: 'Monthly Newsletter - January 2026',
      subject: 'New Hair Treatment Solutions for You',
      status: 'Sent',
      sent: 2450,
      delivered: 2398,
      opened: 1156,
      clicked: 348,
      replies: 45,
      openRate: 48.2,
      clickRate: 14.5,
      replyRate: 1.9,
      sentDate: '2026-01-15',
      segment: 'All Subscribers',
    },
    {
      id: 2,
      name: 'Promotional - Skin Care Special',
      subject: 'Limited Time: 20% Off Skin Treatments',
      status: 'Sent',
      sent: 1850,
      delivered: 1820,
      opened: 892,
      clicked: 267,
      replies: 32,
      openRate: 49.0,
      clickRate: 14.7,
      replyRate: 1.8,
      sentDate: '2026-01-20',
      segment: 'Active Clients',
    },
    {
      id: 3,
      name: 'Follow-up Campaign',
      subject: 'How did your treatment go?',
      status: 'Scheduled',
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replies: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      sentDate: '2026-01-25',
      segment: 'Recent Clients',
    },
  ]);

  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.delivered, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.opened, 0);
  const totalClicked = campaigns.reduce((sum, c) => sum + c.clicked, 0);
  const avgOpenRate = totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : 0;
  const avgClickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : 0;
  const sentCampaigns = campaigns.filter(c => c.status === 'Sent').length;

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      setCampaigns(campaigns.filter(c => c.id !== id));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Email Campaigns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your email marketing campaigns and newsletters
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #65408b 100%)',
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
              background: 'linear-gradient(135deg, #667eea15 0%, #667eea05 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
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
                    bgcolor: '#667eea20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <EmailIcon sx={{ fontSize: 28, color: '#667eea' }} />
                </Box>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: '#667eea' }}>
                {totalSent.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                Total Sent
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                {totalDelivered.toLocaleString()} delivered
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #10b98115 0%, #10b98105 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
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
                    bgcolor: '#10b98120',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MarkEmailReadIcon sx={{ fontSize: 28, color: '#10b981' }} />
                </Box>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: '#10b981' }}>
                {avgOpenRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                Open Rate
              </Typography>
              <LinearProgress
                variant="determinate"
                value={parseFloat(avgOpenRate)}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#dcfce7',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#10b981',
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
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
                    bgcolor: '#f59e0b20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ReplyIcon sx={{ fontSize: 28, color: '#f59e0b' }} />
                </Box>
                <Chip
                  icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                  label="+3.2%"
                  size="small"
                  sx={{
                    bgcolor: '#dcfce7',
                    color: '#166534',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: '#f59e0b' }}>
                {avgClickRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Click Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #6366f115 0%, #6366f105 100%)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
                transform: 'translateY(-4px)',
              },
            }}
          >
            <CardContent>
              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, color: '#6366f1' }}>
                {campaigns.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1.5 }}>
                Total Campaigns
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={`${sentCampaigns} Sent`}
                  size="small"
                  sx={{
                    bgcolor: '#dcfce7',
                    color: '#166534',
                    fontWeight: 600,
                  }}
                />
                <Chip
                  label={`${campaigns.length - sentCampaigns} Pending`}
                  size="small"
                  sx={{
                    bgcolor: '#fef3c7',
                    color: '#92400e',
                    fontWeight: 600,
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Campaigns Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            All Campaigns ({campaigns.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Campaign Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Sent</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Opened</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Clicked</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Open Rate</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Click Rate</TableCell>
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
                        {campaign.sentDate} • {campaign.segment}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300 }}>
                        {campaign.subject}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={campaign.status}
                        color={campaign.status === 'Sent' ? 'success' : 'warning'}
                        size="small"
                        icon={campaign.status === 'Scheduled' ? <ScheduleIcon sx={{ fontSize: 14 }} /> : undefined}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {campaign.sent.toLocaleString()}
                      </Typography>
                      {campaign.delivered > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {campaign.delivered.toLocaleString()} delivered
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#10b981' }}>
                        {campaign.opened.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#f59e0b' }}>
                        {campaign.clicked.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {campaign.openRate > 0 ? `${campaign.openRate.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {campaign.clickRate > 0 ? `${campaign.clickRate.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell align="center">
                      {campaign.status === 'Scheduled' && (
                        <Tooltip title="Send Now">
                          <IconButton size="small" color="primary" sx={{ mr: 0.5 }}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
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
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          Create New Email Campaign
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Campaign Name"
            margin="normal"
            placeholder="e.g., Monthly Newsletter - January"
          />
          <TextField
            fullWidth
            label="Email Subject"
            margin="normal"
            placeholder="Write a compelling subject line"
          />
          <TextField
            fullWidth
            select
            label="Recipient Segment"
            margin="normal"
            defaultValue="All Subscribers"
          >
            <MenuItem value="All Subscribers">All Subscribers</MenuItem>
            <MenuItem value="Active Clients">Active Clients</MenuItem>
            <MenuItem value="Inactive Clients">Inactive Clients</MenuItem>
            <MenuItem value="Recent Clients">Recent Clients</MenuItem>
            <MenuItem value="VIP Clients">VIP Clients</MenuItem>
          </TextField>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Email Content"
            margin="normal"
            placeholder="Write your email content here..."
          />
          <Grid container spacing={2}>
            <Grid size={{xs: 6}}>
              <TextField
                fullWidth
                label="Send Date"
                type="date"
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{xs: 6}}>
              <TextField
                fullWidth
                label="Send Time"
                type="time"
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Save as Draft
          </Button>
          <Button
            variant="contained"
            startIcon={<ScheduleIcon />}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #65408b 100%)',
              },
            }}
          >
            Schedule Campaign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailCampaigns;
