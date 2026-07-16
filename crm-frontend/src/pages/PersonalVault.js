import React, { useState, useMemo, useEffect, useContext } from 'react';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../contexts/ThemeContext';
import api from '../api/axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Chip,
  InputAdornment,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert,
  Stack,
  Paper,
  CircularProgress,
  Snackbar,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  Language as WebsiteIcon,
  VpnKey as VpnKeyIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Shield as ShieldIcon,
  WarningAmber as WarningIcon,
  Share as ShareIcon,
  AccountBalance as AccountBalanceIcon,
  Cloud as CloudIcon,
  Apps as AppsIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { PageLoader, CardLoader } from '../components/Loading';

const categories = ['Email', 'Social Media', 'Banking', 'Cloud Service', 'Website', 'App', 'Other'];

const getCategoryConfig = (category) => {
  const configs = {
    'Email': { icon: <EmailIcon />, color: '#1F3966' },
    'Social Media': { icon: <ShareIcon />, color: '#1F3966' },
    'Banking': { icon: <AccountBalanceIcon />, color: '#10b981' },
    'Cloud Service': { icon: <CloudIcon />, color: '#1F3966' },
    'Website': { icon: <WebsiteIcon />, color: '#1F3966' },
    'App': { icon: <AppsIcon />, color: '#1F3966' },
    'Other': { icon: <VpnKeyIcon />, color: '#1F3966' },
  };
  return configs[category] || configs['Other'];
};

const getPasswordStrength = (password) => {
  if (!password) return { strength: 'none', color: '#94a3b8', label: 'No Password' };
  if (password.length < 8) return { strength: 'weak', color: '#ef4444', label: 'Weak' };
  if (password.length < 12) return { strength: 'medium', color: '#1F3966', label: 'Medium' };
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return { strength: 'medium', color: '#1F3966', label: 'Medium' };
  }
  return { strength: 'strong', color: '#10b981', label: 'Strong' };
};

// Safe URL opener — see ClientVault.js for full rationale. Blocks
// javascript: / data: / vbscript: schemes (stored-XSS vector when a
// malicious credential URL is opened), forces noopener,noreferrer,
// and prepends http:// to schemeless input so "example.com" still
// works.
const safeOpenUrl = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return;
  let href = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    href = `http://${value}`;
  }
  const scheme = href.slice(0, href.indexOf(':')).toLowerCase();
  const allowed = ['http', 'https', 'mailto', 'tel'];
  if (!allowed.includes(scheme)) {
    console.warn(`safeOpenUrl: refusing scheme "${scheme}"`);
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
};

const PersonalVault = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.secondary || '#1F3966';
  const secondaryColor = accentColor?.primary || '#1F3966';
  const { user } = useSelector((state) => state.auth);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [sharingEntry, setSharingEntry] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showPasswords, setShowPasswords] = useState({});
  const [expandedPanel, setExpandedPanel] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    category: 'Other',
    username: '',
    password: '',
    url: '',
    notes: '',
  });

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const response = await api.get('/personal-vault');
      const data = response.data.data || response.data;
      setEntries(data);
    } catch (error) {
      console.error('Error fetching personal vault:', error);
      setSnackbar({ open: true, message: 'Failed to fetch vault entries', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for share dialog (admin only)
  const fetchUsers = async () => {
    try {
      const response = await api.get('/personal-vault/users');
      const data = response.data.data || response.data;
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchEntries();
    if (isAdmin) fetchUsers();
  }, []);

  // Group entries by category
  const groupedEntries = useMemo(() => {
    const filtered = entries.filter(item => {
      const matchesSearch =
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    const grouped = {};
    filtered.forEach(item => {
      const cat = item.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    return grouped;
  }, [entries, searchQuery, selectedCategory]);

  // Stats
  const stats = useMemo(() => {
    const uniqueCategories = new Set(entries.map(e => e.category));
    return {
      totalEntries: entries.length,
      categories: uniqueCategories.size,
      sharedEntries: entries.filter(e => e.sharedWith && e.sharedWith.length > 0).length,
      weakPasswords: entries.filter(e => getPasswordStrength(e.password).strength === 'weak').length,
    };
  }, [entries]);

  // Dialog handlers
  const handleOpenDialog = (entry = null) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        title: entry.title,
        category: entry.category,
        username: entry.username,
        password: entry.password,
        url: entry.url || '',
        notes: entry.notes || '',
      });
    } else {
      setEditingEntry(null);
      setFormData({ title: '', category: 'Other', username: '', password: '', url: '', notes: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingEntry(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingEntry) {
        await api.put(`/personal-vault/${editingEntry._id}`, formData);
        setSnackbar({ open: true, message: 'Entry updated successfully!', severity: 'success' });
      } else {
        await api.post('/personal-vault', formData);
        setSnackbar({ open: true, message: 'Entry added successfully!', severity: 'success' });
      }
      await fetchEntries();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving entry:', error);
      setSnackbar({ open: true, message: error.response?.data?.message || 'Failed to save entry', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (entry) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    try {
      await api.delete(`/personal-vault/${entryToDelete._id}`);
      setSnackbar({ open: true, message: 'Entry deleted successfully!', severity: 'success' });
      await fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      setSnackbar({ open: true, message: 'Failed to delete entry', severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    }
  };

  // Share dialog handlers
  const handleOpenShareDialog = (entry) => {
    setSharingEntry(entry);
    setSelectedUsers(entry.sharedWith?.map(u => u._id) || []);
    setOpenShareDialog(true);
  };

  const handleCloseShareDialog = () => {
    setOpenShareDialog(false);
    setSharingEntry(null);
    setSelectedUsers([]);
  };

  const handleToggleUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleShareSubmit = async () => {
    if (!sharingEntry) return;
    setSaving(true);
    try {
      await api.patch(`/personal-vault/${sharingEntry._id}/share`, { sharedWith: selectedUsers });
      setSnackbar({ open: true, message: 'Access updated successfully!', severity: 'success' });
      await fetchEntries();
      handleCloseShareDialog();
    } catch (error) {
      console.error('Error sharing entry:', error);
      setSnackbar({ open: true, message: 'Failed to update access', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Copied to clipboard!', severity: 'success' });
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  if (loading && entries.length === 0) {
    return <PageLoader message="Loading personal vault..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <LockIcon sx={{ fontSize: 22, color: primaryColor }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Personal Vault
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {isAdmin
              ? 'Securely store personal credentials and share access with team members'
              : 'Credentials shared with you by administrators'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchEntries}
            disabled={loading}
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                bgcolor: primaryColor,
                fontWeight: 600,
                '&:hover': {
                  bgcolor: secondaryColor,
                },
              }}
            >
              Add Entry
            </Button>
          )}
        </Box>
      </Box>

      {/* Weak Password Alert */}
      {stats.weakPasswords > 0 && isAdmin && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          You have {stats.weakPasswords} weak password(s) that should be updated for better security.
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Total Entries', value: stats.totalEntries, color: '#1F3966', icon: <LockIcon /> },
          { label: 'Categories', value: stats.categories, color: '#1F3966', icon: <FolderIcon /> },
          ...(isAdmin ? [{ label: 'Shared Entries', value: stats.sharedEntries, color: '#1F3966', icon: <PeopleIcon /> }] : []),
          { label: 'Weak Passwords', value: stats.weakPasswords, color: '#ef4444', icon: <WarningIcon /> },
        ].map((s, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ borderLeft: `3px solid ${s.color}` }}>
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

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6, md: 5 }}>
              <TextField
                fullWidth
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                fullWidth
                select
                label="Filter by Category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="All">All Categories</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 12, md: 3 }}>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={`${Object.keys(groupedEntries).length} Categories`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`${Object.values(groupedEntries).flat().length} Entries`}
                  color="secondary"
                  variant="outlined"
                />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Entries List */}
      {loading ? (
        <CardLoader count={4} message="Loading entries..." />
      ) : (
        <Grid container spacing={1.5}>
          {Object.keys(groupedEntries).length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <LockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No entries found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isAdmin ? 'Add your first entry to get started' : 'No credentials have been shared with you yet'}
                </Typography>
              </Paper>
            </Grid>
          ) : (
            Object.entries(groupedEntries).map(([category, catEntries]) => {
              const config = getCategoryConfig(category);
              return (
                <Grid size={{ xs: 12 }} key={category}>
                  <Accordion
                    expanded={expandedPanel === category}
                    onChange={handleAccordionChange(category)}
                    sx={{
                      boxShadow: 2,
                      '&:before': { display: 'none' },
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
                        '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f5f5f5' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${config.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {React.cloneElement(config.icon, { sx: { color: config.color, fontSize: 24 } })}
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {category}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {catEntries.length} entr{catEntries.length !== 1 ? 'ies' : 'y'} stored
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={catEntries.length}
                        size="small"
                        sx={{
                          bgcolor: `${config.color}20`,
                          color: config.color,
                          fontWeight: 600,
                          mr: 2,
                        }}
                      />
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <Grid container spacing={2} sx={{ p: 2 }}>
                        {catEntries.map((entry) => {
                          const passwordStrength = getPasswordStrength(entry.password);
                          const sharedCount = entry.sharedWith?.length || 0;

                          return (
                            <Grid size={{ xs: 12, md: 6 }} key={entry._id}>
                              <Card sx={{
                                height: '100%',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  boxShadow: 4,
                                  transform: 'translateY(-2px)',
                                },
                              }}>
                                <CardContent>
                                  {/* Header */}
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${config.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {React.cloneElement(config.icon, { sx: { color: config.color, fontSize: 24 } })}
                                      </Box>
                                      <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                          {entry.title}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                          <Chip
                                            label={passwordStrength.label}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              fontSize: '0.7rem',
                                              bgcolor: `${passwordStrength.color}20`,
                                              color: passwordStrength.color,
                                              fontWeight: 600,
                                            }}
                                          />
                                          {sharedCount > 0 && (
                                            <Chip
                                              icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                                              label={`${sharedCount} user${sharedCount !== 1 ? 's' : ''}`}
                                              size="small"
                                              sx={{
                                                height: 20,
                                                fontSize: '0.7rem',
                                                bgcolor: '#1F396620',
                                                color: '#1F3966',
                                                fontWeight: 600,
                                              }}
                                            />
                                          )}
                                        </Box>
                                      </Box>
                                    </Box>
                                    {isAdmin && (
                                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <Tooltip title="Share">
                                          <IconButton size="small" onClick={() => handleOpenShareDialog(entry)} sx={{ color: '#1F3966' }}>
                                            <PersonAddIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                          <IconButton size="small" onClick={() => handleOpenDialog(entry)} sx={{ color: primaryColor }}>
                                            <EditIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                          <IconButton size="small" onClick={() => handleDeleteClick(entry)} sx={{ color: '#ef4444' }}>
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    )}
                                  </Box>

                                  <Divider sx={{ mb: 2 }} />

                                  {/* Username */}
                                  <Box sx={{ mb: 2 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                      Username / Email
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                                        {entry.username}
                                      </Typography>
                                      <Tooltip title="Copy">
                                        <IconButton size="small" onClick={() => handleCopyToClipboard(entry.username)}>
                                          <CopyIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                  </Box>

                                  {/* Password */}
                                  <Box sx={{ mb: 2 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                      Password
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                                        {showPasswords[entry._id] ? entry.password : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                                      </Typography>
                                      <Tooltip title={showPasswords[entry._id] ? 'Hide' : 'Show'}>
                                        <IconButton size="small" onClick={() => togglePasswordVisibility(entry._id)}>
                                          {showPasswords[entry._id] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Copy">
                                        <IconButton size="small" onClick={() => handleCopyToClipboard(entry.password)}>
                                          <CopyIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Box>
                                  </Box>

                                  {/* URL */}
                                  {entry.url && (
                                    <Box sx={{ mb: 2 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                        URL
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          mt: 0.5,
                                          color: primaryColor,
                                          cursor: 'pointer',
                                          '&:hover': { textDecoration: 'underline' },
                                        }}
                                        onClick={() => safeOpenUrl(entry.url)}
                                      >
                                        {entry.url}
                                      </Typography>
                                    </Box>
                                  )}

                                  {/* Notes */}
                                  {entry.notes && (
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                        Notes
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {entry.notes}
                                      </Typography>
                                    </Box>
                                  )}

                                  {/* Footer */}
                                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="caption" color="text.secondary">
                                      Last updated: {new Date(entry.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </Typography>
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              );
            })
          )}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {editingEntry ? 'Edit Entry' : 'Add New Entry'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g. Gmail - Personal, Netflix, etc."
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  select
                  label="Category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Username / Email"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {React.cloneElement(getCategoryConfig(formData.category).icon, { sx: { fontSize: 20 } })}
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Password"
                  type={showPasswords['dialog'] ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPasswords(prev => ({ ...prev, dialog: !prev.dialog }))} edge="end">
                          {showPasswords['dialog'] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText={
                    <Chip
                      label={getPasswordStrength(formData.password).label}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: `${getPasswordStrength(formData.password).color}20`,
                        color: getPasswordStrength(formData.password).color,
                        fontWeight: 600,
                        mt: 0.5,
                      }}
                    />
                  }
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="URL (Optional)"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes (Optional)"
                  multiline
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional notes..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                bgcolor: primaryColor,
                fontWeight: 600,
                '&:hover': {
                  bgcolor: secondaryColor,
                },
              }}
            >
              {saving ? 'Saving...' : (editingEntry ? 'Update Entry' : 'Add Entry')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={openShareDialog} onClose={handleCloseShareDialog} maxWidth="sm" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonAddIcon sx={{ color: primaryColor }} />
            Share Access
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Select users who can view "{sharingEntry?.title}"
          </Typography>
        </DialogTitle>
        <DialogContent>
          {users.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No other users available to share with.
            </Typography>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {users.map((u) => (
                <ListItem key={u._id} disablePadding>
                  <ListItemButton onClick={() => handleToggleUser(u._id)} dense>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedUsers.includes(u._id)}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={u.name}
                      secondary={`${u.email} - ${u.role}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseShareDialog} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleShareSubmit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ShareIcon />}
            sx={{
              bgcolor: primaryColor,
              fontWeight: 600,
              '&:hover': {
                bgcolor: secondaryColor,
              },
            }}
          >
            {saving ? 'Saving...' : `Share with ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setEntryToDelete(null); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{entryToDelete?.title}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setEntryToDelete(null); }}>No</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>Yes, Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PersonalVault;
