import React, { useState, useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ThemeContext, premiumColors } from '../contexts/ThemeContext';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Divider,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Tab,
  Tabs,
  Alert,
} from '@mui/material';
import {
  Person,
  Security,
  Notifications,
  Palette,
  Language,
  CloudUpload,
  Check as CheckIcon,
} from '@mui/icons-material';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const Settings = () => {
  const { user } = useSelector((state) => state.auth);
  const {
    mode,
    toggleTheme,
    accentColor,
    pendingAccentColor,
    setPendingAccentColor,
    applyAccentColor
  } = useContext(ThemeContext);
  const [tabValue, setTabValue] = useState(0);
  const [saved, setSaved] = useState(false);
  const [colorApplied, setColorApplied] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyReports: true,
    marketingEmails: false,
    language: 'English',
  });

  const isDarkMode = mode === 'dark';
  const hasColorChanges = pendingAccentColor.name !== accentColor.name;

  useEffect(() => {
    console.log('Current theme mode in Settings:', mode);
  }, [mode]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleToggle = (setting) => {
    setSettings({ ...settings, [setting]: !settings[setting] });
  };

  const handleApplyColor = () => {
    applyAccentColor();
    setColorApplied(true);
    setTimeout(() => setColorApplied(false), 3000);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your account settings and preferences
        </Typography>
      </Box>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}

      {colorApplied && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Theme color applied successfully! The new color is now active across the application.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{xs: 12, md: 3}}>
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Avatar
                  sx={{
                    width: 100,
                    height: 100,
                    margin: '0 auto',
                    mb: 2,
                    fontSize: '2.5rem',
                    bgcolor: 'primary.main',
                  }}
                >
                  {user?.name?.[0] || 'A'}
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {user?.name || 'Admin User'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {user?.email || 'admin@crm.com'}
                </Typography>
                <Chip label={user?.role || 'Administrator'} color="primary" size="small" />
              </Box>
              {/* <Divider sx={{ my: 2 }} /> */}
              {/* <Button
                fullWidth
                variant="outlined"
                startIcon={<CloudUpload />}
                sx={{ mb: 1 }}
              >
                Upload Photo
              </Button> */}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12, md: 9}}>
          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab icon={<Person />} label="Profile" iconPosition="start" />
                <Tab icon={<Security />} label="Security" iconPosition="start" />
                <Tab icon={<Notifications />} label="Notifications" iconPosition="start" />
                <Tab icon={<Palette />} label="Appearance" iconPosition="start" />
              </Tabs>
            </Box>

            <CardContent>
              <TabPanel value={tabValue} index={0}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Personal Information
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      defaultValue={user?.name || 'Admin User'}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                      fullWidth
                      label="Email"
                      defaultValue={user?.email || 'admin@crm.com'}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      defaultValue="+1 (555) 123-4567"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                      fullWidth
                      label="Job Title"
                      defaultValue={user?.role || 'Administrator'}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12}}>
                    <TextField
                      fullWidth
                      label="Bio"
                      multiline
                      rows={4}
                      defaultValue="Experienced CRM administrator with a passion for helping businesses grow."
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12}}>
                    <Button variant="contained" onClick={handleSave}>
                      Save Changes
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Security Settings
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{xs: 12}}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      type="password"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                      fullWidth
                      label="New Password"
                      type="password"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      type="password"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{xs: 12}}>
                    <Button variant="contained" onClick={handleSave}>
                      Update Password
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Notification Preferences
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Email Notifications"
                      secondary="Receive email updates about your account activity"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.emailNotifications}
                        onChange={() => handleToggle('emailNotifications')}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Push Notifications"
                      secondary="Get push notifications on your devices"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.pushNotifications}
                        onChange={() => handleToggle('pushNotifications')}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Weekly Reports"
                      secondary="Receive weekly performance reports"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.weeklyReports}
                        onChange={() => handleToggle('weeklyReports')}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Marketing Emails"
                      secondary="Receive updates about new features and tips"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.marketingEmails}
                        onChange={() => handleToggle('marketingEmails')}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
                <Box sx={{ mt: 3 }}>
                  <Button variant="contained" onClick={handleSave}>
                    Save Preferences
                  </Button>
                </Box>
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                  Appearance Settings
                </Typography>

                <Alert severity="info" sx={{ mb: 3 }}>
                  Select your preferred theme color and click "Apply Changes" to update the entire application.
                </Alert>

                <List>
                  <ListItem>
                    <ListItemText
                      primary="Dark Mode"
                      secondary={`Currently using ${isDarkMode ? 'dark' : 'light'} theme. Switch to ${isDarkMode ? 'light' : 'dark'} theme for better viewing.`}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={isDarkMode}
                        onChange={toggleTheme}
                        color="primary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Language"
                      secondary="Choose your preferred language"
                    />
                    <ListItemSecondaryAction>
                      <Chip label={settings.language} />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Accent Color
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Select a premium accent color to personalize your experience.
                </Typography>

                {/* Color Selection Grid */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                  {premiumColors.map((color) => (
                    <Box
                      key={color.name}
                      onClick={() => setPendingAccentColor(color)}
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${color.primary} 0%, ${color.secondary} 100%)`,
                        border: pendingAccentColor.name === color.name ? '3px solid' : '2px solid',
                        borderColor: pendingAccentColor.name === color.name ? (isDarkMode ? '#fff' : '#000') : 'divider',
                        boxShadow: pendingAccentColor.name === color.name ? 6 : 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: pendingAccentColor.name === color.name ? 'scale(1.1)' : 'scale(1)',
                        position: 'relative',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          boxShadow: 4,
                        },
                      }}
                    >
                      {pendingAccentColor.name === color.name && (
                        <CheckIcon sx={{ color: color.text, fontSize: '1.5rem' }} />
                      )}
                      {accentColor.name === color.name && pendingAccentColor.name !== color.name && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            bgcolor: 'background.paper',
                            px: 0.5,
                            borderRadius: 1,
                            fontSize: '0.6rem',
                            color: 'text.secondary',
                          }}
                        >
                          Current
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: pendingAccentColor.primary, fontWeight: 600 }}>
                    Selected: {pendingAccentColor.name}
                  </Typography>
                  {hasColorChanges && (
                    <Chip
                      label="Unsaved"
                      size="small"
                      color="warning"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Theme Preview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  See how your selected color looks in different UI elements.
                </Typography>

                {/* Live Theme Preview Card */}
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                    mb: 3,
                  }}
                >
                  {/* Header Preview */}
                  <Box
                    sx={{
                      background: `linear-gradient(135deg, ${pendingAccentColor.primary} 0%, ${pendingAccentColor.secondary} 100%)`,
                      borderRadius: 2,
                      p: 2,
                      mb: 3,
                    }}
                  >
                    <Typography variant="h6" sx={{ color: pendingAccentColor.text, fontWeight: 600 }}>
                      Dashboard Header
                    </Typography>
                    <Typography variant="body2" sx={{ color: pendingAccentColor.text, opacity: 0.9 }}>
                      Welcome back! Here's your overview.
                    </Typography>
                  </Box>

                  {/* Button Preview */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      sx={{
                        background: `linear-gradient(135deg, ${pendingAccentColor.primary} 0%, ${pendingAccentColor.secondary} 100%)`,
                        color: pendingAccentColor.text,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${pendingAccentColor.secondary} 0%, ${pendingAccentColor.primary} 100%)`,
                        },
                      }}
                    >
                      Primary Button
                    </Button>
                    <Button
                      variant="outlined"
                      sx={{
                        borderColor: pendingAccentColor.primary,
                        color: pendingAccentColor.primary,
                        '&:hover': {
                          borderColor: pendingAccentColor.secondary,
                          bgcolor: `${pendingAccentColor.primary}10`,
                        },
                      }}
                    >
                      Outlined Button
                    </Button>
                    <Chip
                      label="Status Badge"
                      sx={{
                        bgcolor: `${pendingAccentColor.primary}20`,
                        color: pendingAccentColor.primary,
                        fontWeight: 500,
                      }}
                    />
                  </Box>

                  {/* Stats Card Preview */}
                  <Grid container spacing={2}>
                    <Grid size={{xs: 6, sm: 3}}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${pendingAccentColor.primary}15 0%, ${pendingAccentColor.secondary}15 100%)`,
                          border: '1px solid',
                          borderColor: `${pendingAccentColor.primary}30`,
                        }}
                      >
                        <Typography variant="h5" sx={{ color: pendingAccentColor.primary, fontWeight: 700 }}>
                          2,543
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total Leads
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{xs: 6, sm: 3}}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${pendingAccentColor.primary}15 0%, ${pendingAccentColor.secondary}15 100%)`,
                          border: '1px solid',
                          borderColor: `${pendingAccentColor.primary}30`,
                        }}
                      >
                        <Typography variant="h5" sx={{ color: pendingAccentColor.primary, fontWeight: 700 }}>
                          $45.2K
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Revenue
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{xs: 6, sm: 3}}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${pendingAccentColor.primary}15 0%, ${pendingAccentColor.secondary}15 100%)`,
                          border: '1px solid',
                          borderColor: `${pendingAccentColor.primary}30`,
                        }}
                      >
                        <Typography variant="h5" sx={{ color: pendingAccentColor.primary, fontWeight: 700 }}>
                          89%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Conversion
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{xs: 6, sm: 3}}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          background: `linear-gradient(135deg, ${pendingAccentColor.primary}15 0%, ${pendingAccentColor.secondary}15 100%)`,
                          border: '1px solid',
                          borderColor: `${pendingAccentColor.primary}30`,
                        }}
                      >
                        <Typography variant="h5" sx={{ color: pendingAccentColor.primary, fontWeight: 700 }}>
                          156
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Active Clients
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                {/* Apply Changes Button */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={handleApplyColor}
                    disabled={!hasColorChanges}
                    startIcon={<CheckIcon />}
                    sx={{
                      background: hasColorChanges
                        ? `linear-gradient(135deg, ${pendingAccentColor.primary} 0%, ${pendingAccentColor.secondary} 100%)`
                        : undefined,
                      color: hasColorChanges ? pendingAccentColor.text : undefined,
                      '&:hover': {
                        background: hasColorChanges
                          ? `linear-gradient(135deg, ${pendingAccentColor.secondary} 0%, ${pendingAccentColor.primary} 100%)`
                          : undefined,
                      },
                      px: 4,
                      py: 1.2,
                    }}
                  >
                    Apply Changes
                  </Button>
                  {hasColorChanges && (
                    <Button
                      variant="outlined"
                      onClick={() => setPendingAccentColor(accentColor)}
                      sx={{ color: 'text.secondary', borderColor: 'divider' }}
                    >
                      Reset
                    </Button>
                  )}
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                  Your theme preference will be saved and persist across sessions.
                </Typography>
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
