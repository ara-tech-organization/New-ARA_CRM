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
  Tooltip,
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
  Lock as LockIcon,
  Key as KeyIcon,
  PowerSettingsNew as PowerIcon,
} from '@mui/icons-material';
import userApi from '../api/userApi';

// Available pages/screens in the system
const availablePages = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊' },
  // { id: 'daily-entry', name: 'Daily Entry', icon: '📝' },
  { id: 'daily-lead-data', name: 'Daily Lead Data', icon: '📈' },
  { id: 'leads', name: 'Leads Management', icon: '🎯' },
  { id: 'ads-dashboard', name: 'Ads Dashboard', icon: '📣' },
  { id: 'clients', name: 'Clients', icon: '👥' },
  // { id: 'client-vault', name: 'Client Vault', icon: '🔐' },
  // { id: 'content-management', name: 'Content Management', icon: '📋' },
  // { id: 'fund-entry', name: 'Fund Entry', icon: '💰' },
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
  const primaryColor = accentColor?.secondary || '#C08552';
  const secondaryColor = accentColor?.primary || '#3E2723';

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
  const [teams, setTeams] = useState([]);

  // Edit user state
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editUserData, setEditUserData] = useState(null);

  // Change password state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SMM',
    phone: '',
    department: '',
    team: '',
    permissions: ['dashboard'],
  });

  // Fetch users and teams on component mount
  useEffect(() => {
    fetchUsers();
    fetchTeams();
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

  const fetchTeams = async () => {
    try {
      const response = await userApi.getTeams();
      setTeams(response.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
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

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showSnackbar('Password must be at least 6 characters', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const response = await userApi.changeUserPassword(passwordUser._id, newPassword);
      showSnackbar(response.message || `Password changed for ${passwordUser.name}`);
      setPasswordDialogOpen(false);
      setPasswordUser(null);
      setNewPassword('');
      setShowNewPassword(false);
    } catch (error) {
      console.error('Error changing password:', error);
      showSnackbar(error.response?.data?.message || 'Failed to change password', 'error');
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
        team: '',
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

  const handleOpenEditUser = (user) => {
    setEditUserData({
      _id: user._id,
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'SMM',
      phone: user.phone || '',
      department: user.department || '',
      team: user.team || '',
    });
    setEditUserDialogOpen(true);
  };

  const handleEditUserChange = (field, value) => {
    if (field === 'role') {
      if (value !== 'SMM') {
        setEditUserData((prev) => ({ ...prev, [field]: value, team: '' }));
      } else {
        setEditUserData((prev) => ({ ...prev, [field]: value }));
      }
    } else {
      setEditUserData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSaveEditUser = async () => {
    try {
      setActionLoading(true);
      const { _id, ...updateData } = editUserData;
      const response = await userApi.updateUser(_id, updateData);
      setUsers((prev) =>
        prev.map((u) => (u._id === _id ? { ...u, ...response.data } : u))
      );
      setEditUserDialogOpen(false);
      showSnackbar('User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      showSnackbar(error.response?.data?.message || 'Failed to update user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNewUserChange = (field, value) => {
    if (field === 'role') {
      // If Admin is selected, automatically give all permissions
      if (value === 'admin') {
        setNewUser((prev) => ({ ...prev, [field]: value, permissions: allPageIds, team: '' }));
      } else if (value !== 'SMM') {
        setNewUser((prev) => ({ ...prev, [field]: value, team: '' }));
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
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
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
            bgcolor: primaryColor,
            '&:hover': { bgcolor: secondaryColor, color: 'white' },
          }}
        >
          Add New User
        </Button>
      </Box>

      {/* Stats Row */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Total Users', value: users.length, color: '#C08552', icon: <ShieldIcon /> },
          { label: 'Active Users', value: users.filter((u) => u.isActive).length, color: '#10b981', icon: <ShieldIcon /> },
          { label: 'Inactive Users', value: users.filter((u) => !u.isActive).length, color: '#C08552', icon: <ShieldIcon /> },
        ].map((s, i) => (
          <Grid key={i} size={{ xs: 12, sm: 4 }}>
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

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search by name, email, or User ID..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoComplete="off"
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 2 }}
      />

      {/* Users List */}
      <Grid container spacing={1.5}>
        {filteredUsers.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
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
                variant="outlined"
                sx={{
                  height: '100%',
                  overflow: 'hidden',
                  borderLeft: `3px solid ${user.isActive ? primaryColor : '#94a3b8'}`,
                  opacity: user.isActive ? 1 : 0.65,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: primaryColor },
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  {/* Top row: Avatar + Info + Status */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Avatar
                      sx={{
                        width: 42,
                        height: 42,
                        bgcolor: user.isActive ? primaryColor : 'grey.400',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                      }}
                    >
                      {user.name?.charAt(0) || 'U'}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.name}
                        </Typography>
                        {user.isActive ? (
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', flexShrink: 0 }} />
                        ) : (
                          <BlockIcon sx={{ fontSize: 16, color: 'error.main', flexShrink: 0 }} />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Info chips */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={user.userID}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 24 }}
                    />
                    <Chip
                      label={user.role}
                      size="small"
                      color={getRoleColor(user.role)}
                      sx={{ fontSize: '0.7rem', height: 24, fontWeight: 600 }}
                    />
                    {user.team && (
                      <Chip
                        label={user.team.replace('SMM ', '')}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 24 }}
                      />
                    )}
                    {user.role === 'admin' && (
                      <Chip
                        label="Full Access"
                        size="small"
                        color="warning"
                        sx={{ fontSize: '0.7rem', height: 24 }}
                      />
                    )}
                    {!user.isActive && (
                      <Chip
                        label="Inactive"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 24 }}
                      />
                    )}
                  </Box>

                  {/* Permissions bar (visual indicator) */}
                  {user.role !== 'admin' && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Access
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.permissions?.length || 0}/{availablePages.length}
                        </Typography>
                      </Box>
                      <Box sx={{ height: 4, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${((user.permissions?.length || 0) / availablePages.length) * 100}%`,
                            bgcolor: primaryColor,
                            borderRadius: 2,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                    </Box>
                  )}

                  <Divider sx={{ mb: 1.5 }} />

                  {/* Action buttons - icon style */}
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    <Tooltip title="Edit User">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditUser(user)}
                        sx={{
                          bgcolor: `${primaryColor}14`,
                          color: primaryColor,
                          '&:hover': { bgcolor: `${primaryColor}28` },
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {user.role !== 'admin' && (
                      <Tooltip title="Edit Access">
                        <IconButton
                          size="small"
                          onClick={() => handleEditAccess(user)}
                          sx={{
                            bgcolor: 'info.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'info.dark' },
                          }}
                        >
                          <KeyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Change Password">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setPasswordUser(user);
                          setNewPassword('');
                          setShowNewPassword(false);
                          setPasswordDialogOpen(true);
                        }}
                        sx={{
                          bgcolor: 'warning.main',
                          color: 'white',
                          '&:hover': { bgcolor: 'warning.dark' },
                        }}
                      >
                        <LockIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.isActive ? 'Deactivate' : 'Activate'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleUserStatus(user._id)}
                        disabled={actionLoading}
                        sx={{
                          bgcolor: user.isActive ? 'error.main' : 'success.main',
                          color: 'white',
                          '&:hover': { bgcolor: user.isActive ? 'error.dark' : 'success.dark' },
                          '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                        }}
                      >
                        <PowerIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete User">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                        sx={{
                          bgcolor: 'grey.200',
                          color: 'error.main',
                          '&:hover': { bgcolor: 'error.main', color: 'white' },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
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
                autoComplete="new-password"
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
            {newUser.role === 'SMM' && (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Team"
                  value={newUser.team}
                  onChange={(e) => handleNewUserChange('team', e.target.value)}
                >
                  <MenuItem value="">No Team</MenuItem>
                  {teams.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
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
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={!newUser.name || !newUser.email || !newUser.password || actionLoading}
            sx={{
              bgcolor: primaryColor,
              '&:hover': {
                bgcolor: secondaryColor,
              },
            }}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          Edit Access Permissions
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box>
              {/* User Info */}
              <Box
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
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
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSavePermissions}
            disabled={actionLoading}
            sx={{
              bgcolor: primaryColor,
              '&:hover': {
                bgcolor: secondaryColor,
              },
            }}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Save Permissions'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onClose={() => setEditUserDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
          Edit User
        </DialogTitle>
        <DialogContent>
          {editUserData && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={editUserData.name}
                  onChange={(e) => handleEditUserChange('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={editUserData.email}
                  onChange={(e) => handleEditUserChange('email', e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Role"
                  value={editUserData.role}
                  onChange={(e) => handleEditUserChange('role', e.target.value)}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {editUserData.role === 'SMM' && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    select
                    label="Team"
                    value={editUserData.team}
                    onChange={(e) => handleEditUserChange('team', e.target.value)}
                  >
                    <MenuItem value="">No Team</MenuItem>
                    {teams.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={editUserData.phone}
                  onChange={(e) => handleEditUserChange('phone', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Department"
                  value={editUserData.department}
                  onChange={(e) => handleEditUserChange('department', e.target.value)}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setEditUserDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEditUser}
            disabled={!editUserData?.name || !editUserData?.email || actionLoading}
            sx={{
              bgcolor: primaryColor,
              '&:hover': {
                bgcolor: secondaryColor,
              },
            }}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Save Changes'}
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

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="xs" fullWidth fullScreen={false}>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Change Password
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set a new password for <strong>{passwordUser?.name}</strong> ({passwordUser?.email})
          </Typography>
          <TextField
            fullWidth
            label="New Password"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Minimum 6 characters"
            autoComplete="new-password"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end">
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={actionLoading || !newPassword || newPassword.length < 6}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Change Password'}
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
