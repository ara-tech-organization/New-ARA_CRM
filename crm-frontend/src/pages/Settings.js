import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Chip,
  Tab,
  Tabs,
  Alert,
} from '@mui/material';
import {
  Person,
  Security,
} from '@mui/icons-material';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
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
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your account settings
        </Typography>
      </Box>

      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved successfully!
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Profile Card */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    margin: '0 auto',
                    mb: 1.5,
                    fontSize: '2rem',
                    bgcolor: 'primary.main',
                  }}
                >
                  {user?.name?.[0] || 'A'}
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {user?.name || 'Admin User'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {user?.email || 'admin@crm.com'}
                </Typography>
                <Chip label={user?.role || 'Administrator'} color="primary" size="small" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tabs */}
        <Grid size={{ xs: 12, md: 9 }}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
                <Tab icon={<Person />} label="Profile" iconPosition="start" />
                <Tab icon={<Security />} label="Security" iconPosition="start" />
              </Tabs>
            </Box>

            <CardContent>
              {/* Profile Tab */}
              <TabPanel value={tabValue} index={0}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Personal Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      defaultValue={user?.name || 'Admin User'}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Email"
                      defaultValue={user?.email || 'admin@crm.com'}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      defaultValue={user?.phone || ''}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Role"
                      defaultValue={user?.role || 'Administrator'}
                      disabled
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button variant="contained" onClick={handleSave}>
                      Save Changes
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>

              {/* Security Tab */}
              <TabPanel value={tabValue} index={1}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Change Password
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      type="password"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="New Password"
                      type="password"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      type="password"
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button variant="contained" onClick={handleSave}>
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
