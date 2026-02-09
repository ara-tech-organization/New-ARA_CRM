import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Switch,
  Avatar,
  Divider,
  Button,
  TextField,
  InputAdornment,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  MenuItem,
  IconButton,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Shield as ShieldIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import userApi from '../api/userApi';

// Available pages/screens in the system
const availablePages = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
  { id: 'daily-entry', name: 'Daily Entry', icon: '📝' },
  { id: 'daily-lead-data', name: 'Daily Lead Data', icon: '📈' },
  { id: 'leads', name: 'Leads Management', icon: '🎯' },
  { id: 'clients', name: 'Clients', icon: '👥' },
  { id: 'client-vault', name: 'Client Vault', icon: '🔐' },
  { id: 'fund-entry', name: 'Fund Entry', icon: '💰' },
  // { id: 'tasks', name: 'Tasks', icon: '✅' },
  { id: 'reports', name: 'Reports', icon: '📄' },
  { id: 'settings', name: 'Settings', icon: '⚙️' },
  { id: 'access-management', name: 'Access Management', icon: '🔑' },
];

const roles = [
  { value: 'SMM', label: 'SMM (Social Media Manager)' },
  { value: 'PMM', label: 'PMM (Performance Marketing Manager)' },
  { value: 'admin', label: 'Admin' },
];

// Get all page IDs for admin full access
const allPageIds = availablePages.map((page) => page.id);

const AccessManagement = () => {
  const { accentColor } = useContext(ThemeContext);
  const primaryColor = accentColor?.primary || '#6366F1';
  const secondaryColor = accentColor?.secondary || '#818CF8';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [tempPermissions, setTempPermissions] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [actionLoading, setActionLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SMM',
    phone: '',
    department: '',
    permissions: ['dashboard'],
  });

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userApi.getUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      showSnackbar('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.userID?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditAccess = (user) => {
    setSelectedUser(user);
    setTempPermissions(user.permissions || []);
    setEditDialogOpen(true);
  };

  const handleTogglePermission = (pageId) => {
    setTempPermissions((prev) => {
      if (prev.includes(pageId)) {
        return prev.filter((p) => p !== pageId);
      } else {
        return [...prev, pageId];
      }
    });
  };

  const handleSavePermissions = async () => {
    try {
      setActionLoading(true);
      await userApi.updatePermissions(selectedUser._id, tempPermissions);
      setUsers((prev) =>
        prev.map((user) =>
          user._id === selectedUser._id ? { ...user, permissions: tempPermissions } : user
        )
      );
      setEditDialogOpen(false);
      showSnackbar('Permissions updated successfully');
    } catch (error) {
      console.error('Error updating permissions:', error);
      showSnackbar(error.response?.data?.message || 'Failed to update permissions', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      setActionLoading(true);
      const response = await userApi.toggleUserStatus(userId);
      setUsers((prev) =>
        prev.map((user) =>
          user._id === userId ? { ...user, isActive: response.data.isActive } : user
        )
      );
      showSnackbar(`User ${response.data.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error toggling user status:', error);
      showSnackbar(error.response?.data?.message || 'Failed to toggle user status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setActionLoading(true);
      const response = await userApi.createUser(newUser);
      showSnackbar('User created successfully');
      setCreateDialogOpen(false);
      // Add the new user to the list immediately without fetching
      if (response.data) {
        setUsers((prev) => [response.data, ...prev]);
      } else {
        fetchUsers(); // Fallback to refresh the list
      }
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'SMM',
        phone: '',
        department: '',
        permissions: ['dashboard'],
      });
    } catch (error) {
      console.error('Error creating user:', error);
      showSnackbar(error.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setActionLoading(true);
      await userApi.deleteUser(userToDelete._id);
      setUsers((prev) => prev.filter((user) => user._id !== userToDelete._id));
      showSnackbar('User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      showSnackbar(error.response?.data?.message || 'Failed to delete user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNewUserChange = (field, value) => {
    if (field === 'role') {
      // If Admin is selected, automatically give all permissions
      if (value === 'admin') {
        setNewUser((prev) => ({ ...prev, [field]: value, permissions: allPageIds }));
      } else {
        setNewUser((prev) => ({ ...prev, [field]: value }));
      }
    } else {
      setNewUser((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleNewUserPermissionToggle = (pageId) => {
    // Don't allow permission changes for Admin role
    if (newUser.role === 'admin') return;

    setNewUser((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(pageId)
        ? prev.permissions.filter((p) => p !== pageId)
        : [...prev.permissions, pageId],
    }));
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'PMM':
        return 'primary';
      case 'SMM':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create users and control page access permissions based on their roles
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
            },
          }}
        >
          Add New User
        </Button>
      </Box>

      {/* Search and Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <TextField
            fullWidth
            placeholder="Search by name, email, or User ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.paper',
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  <ShieldIcon />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {users.filter((u) => u.isActive).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Users
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Users List */}
      <Grid container spacing={3}>
        {filteredUsers.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  {searchQuery ? 'No users found matching your search' : 'No users found. Create your first user!'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredUsers.map((user) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={user._id}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'light'
                        ? '0px 8px 24px rgba(0,0,0,0.12)'
                        : '0px 8px 24px rgba(0,0,0,0.6)',
                  },
                }}
              >
                <CardContent>
                  {/* User Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                    <Avatar
                      sx={{
                        width: 56,
                        height: 56,
                        bgcolor: 'primary.main',
                        fontSize: '1.5rem',
                        fontWeight: 600,
                      }}
                    >
                      {user.name?.charAt(0) || 'U'}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {user.name}
                        </Typography>
                        {user.isActive ? (
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                        ) : (
                          <BlockIcon sx={{ fontSize: 18, color: 'error.main' }} />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {user.email}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label={`ID: ${user.userID}`} size="small" variant="outlined" />
                        <Chip label={user.role} size="small" color={getRoleColor(user.role)} />
                      </Box>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Permissions Summary */}
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}
                    >
                      Page Access
                    </Typography>
                    {user.role === 'admin' ? (
                      <Chip
                        label="Full Access (All Pages)"
                        color="error"
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {availablePages.slice(0, 5).map((page) => {
                          const hasAccess = user.permissions?.includes(page.id);
                          return (
                            <Chip
                              key={page.id}
                              label={page.icon}
                              size="small"
                              sx={{
                                opacity: hasAccess ? 1 : 0.3,
                                bgcolor: hasAccess ? 'success.main' : 'action.disabledBackground',
                                color: hasAccess ? 'white' : 'text.disabled',
                              }}
                            />
                          );
                        })}
                        {(user.permissions?.length || 0) > 5 && (
                          <Chip label={`+${user.permissions.length - 5}`} size="small" />
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {user.role !== 'admin' && (
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditAccess(user)}
                        size="small"
                      >
                        Edit Access
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleToggleUserStatus(user._id)}
                      color={user.isActive ? 'error' : 'success'}
                      disabled={actionLoading}
                      fullWidth={user.role === 'admin'}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setUserToDelete(user);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          Create New User
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Full Name"
                value={newUser.name}
                onChange={(e) => handleNewUserChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newUser.email}
                onChange={(e) => handleNewUserChange('email', e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={newUser.password}
                onChange={(e) => handleNewUserChange('password', e.target.value)}
                required
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="Role"
                value={newUser.role}
                onChange={(e) => handleNewUserChange('role', e.target.value)}
              >
                {roles.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Phone"
                value={newUser.phone}
                onChange={(e) => handleNewUserChange('phone', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Department"
                value={newUser.department}
                onChange={(e) => handleNewUserChange('department', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, mt: 2 }}>
                Page Access Permissions
              </Typography>
              {newUser.role === 'admin' ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Admin users have full access to all pages automatically.
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {availablePages.map((page) => (
                    <Chip
                      key={page.id}
                      label={`${page.icon} ${page.name}`}
                      onClick={() => handleNewUserPermissionToggle(page.id)}
                      color={newUser.permissions.includes(page.id) ? 'primary' : 'default'}
                      variant={newUser.permissions.includes(page.id) ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={!newUser.name || !newUser.email || !newUser.password || actionLoading}
            sx={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
              },
            }}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          Edit Access Permissions
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box>
              {/* User Info */}
              <Box
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                  {selectedUser.name?.charAt(0) || 'U'}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {selectedUser.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    User ID: {selectedUser.userID} • {selectedUser.role}
                  </Typography>
                </Box>
              </Box>

              {/* Permissions List */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Select pages this user can access:
              </Typography>
              <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
                {availablePages.map((page, index) => (
                  <React.Fragment key={page.id}>
                    <ListItem
                      secondaryAction={
                        <Switch
                          checked={tempPermissions.includes(page.id)}
                          onChange={() => handleTogglePermission(page.id)}
                          color="primary"
                        />
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{page.icon}</span>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {page.name}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < availablePages.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              <Alert severity="info" sx={{ mt: 3 }}>
                User will only be able to access the selected pages after saving.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSavePermissions}
            disabled={actionLoading}
            sx={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
              },
            }}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Save Permissions'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user <strong>{userToDelete?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteUser}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AccessManagement;
