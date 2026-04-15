import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Grid, Card, CardContent, Typography, TextField, Button,
  Avatar, Chip, Tab, Tabs, Alert, Divider,
} from '@mui/material';
import { Person, Security, Phone as PhoneIcon, Business as BusinessIcon } from '@mui/icons-material';

const SectionHeader = ({ title }) => (
  <Box sx={{ borderLeft: '3px solid #C08552', pl: 1.5, mb: 2 }}>
    <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
  </Box>
);

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

const Settings = () => {
  const { user } = useSelector((state) => state.auth);
  const [tabValue, setTabValue] = useState(0);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Settings</Typography>
        <Typography variant="body2" color="text.secondary">Manage your account</Typography>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved successfully!</Alert>}

      <Grid container spacing={2.5}>
        {/* Profile Summary */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Avatar sx={{ width: 72, height: 72, mx: 'auto', mb: 1.5, bgcolor: '#C08552', fontSize: '1.8rem', fontWeight: 700 }}>
                {user?.name?.[0] || 'A'}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{user?.name || 'Admin User'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{user?.email || 'admin@crm.com'}</Typography>
              <Chip label={user?.role || 'Administrator'} size="small" sx={{ bgcolor: '#C0855212', color: '#C08552', fontWeight: 600 }} />
              <Divider sx={{ my: 2 }} />
              <Box sx={{ textAlign: 'left', px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{user?.phone || 'Not set'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">{user?.department || 'Not set'}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tabs */}
        <Grid size={{ xs: 12, md: 9 }}>
          <Card variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ '& .MuiTabs-indicator': { bgcolor: '#C08552' }, '& .Mui-selected': { color: '#C08552 !important' } }}>
                <Tab icon={<Person />} label="Profile" iconPosition="start" />
                <Tab icon={<Security />} label="Security" iconPosition="start" />
              </Tabs>
            </Box>
            <CardContent>
              <TabPanel value={tabValue} index={0}>
                <SectionHeader title="Personal Information" />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Full Name" defaultValue={user?.name || ''} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Email" defaultValue={user?.email || ''} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Phone Number" defaultValue={user?.phone || ''} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Role" defaultValue={user?.role || ''} disabled />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#C08552', '&:hover': { bgcolor: '#8B5E3C' } }}>
                      Save Changes
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <SectionHeader title="Change Password" />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Current Password" type="password" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="New Password" type="password" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth label="Confirm New Password" type="password" />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button variant="contained" onClick={handleSave} sx={{ bgcolor: '#C08552', '&:hover': { bgcolor: '#8B5E3C' } }}>
                      Update Password
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
