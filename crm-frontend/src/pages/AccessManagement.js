import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
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
  CircularProgress,
  MenuItem,
  IconButton,
  Snackbar,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Menu,
  Card,
  CardContent,
  Stack,
  Autocomplete,
  createFilterOptions,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility,
  VisibilityOff,
  Lock as LockIcon,
  Key as KeyIcon,
  PowerSettingsNew as PowerIcon,
  MoreVert as MoreVertIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  Dashboard as DashboardIcon,
  Insights as InsightsIcon,
  People as PeopleIcon,
  Leaderboard as LeaderboardIcon,
  Campaign as CampaignIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  ManageAccounts as ManageAccountsIcon,
  Shield as ShieldIcon,
  CheckBox as SelectAllIcon,
  ClearAll as ClearIcon,
  AutoAwesome as PresetIcon,
  AdminPanelSettings as AdminBadgeIcon,
} from '@mui/icons-material';
import userApi from '../api/userApi';

// Pages an admin can grant. Order, labels and icons mirror the sidebar
// in `MainLayout.js` 1:1 — that's the whole point: admins shouldn't
// have to mentally translate "Reports" → "Analytics" when granting
// access. Anything commented out in the sidebar is omitted here too.
// `adminOnly: true` marks pages the sidebar hides from non-admin roles
// even if the permission is granted (so the picker greys them out for
// SMM/PMM and saves admins from the misleading impression that they
// can give an SMM access to Client Portal by just ticking a box).
const availablePages = [
  { id: 'dashboard', name: 'Dashboard', Icon: DashboardIcon, hint: 'Home with KPI cards and client performance' },
  { id: 'daily-lead-data', name: 'Leads Check', Icon: InsightsIcon, hint: 'Daily/Weekly/Monthly lead breakdown per client' },
  { id: 'clients', name: 'Clients', Icon: PeopleIcon, hint: 'Add, edit and drop clients' },
  { id: 'leads', name: 'Total Leads', Icon: LeaderboardIcon, hint: 'Month-tabbed lead list with PDF/Excel export' },
  { id: 'ads-dashboard', name: 'Ads Comparison', Icon: CampaignIcon, hint: 'Side-by-side Meta + Google ad performance' },
  { id: 'reports', name: 'Analytics', Icon: ReportsIcon, hint: 'Analytics & Reports dashboard' },
  { id: 'settings', name: 'Settings', Icon: SettingsIcon, hint: 'Profile, avatar, and password' },
  { id: 'client-portal-access', name: 'Client Portal', Icon: ManageAccountsIcon, hint: 'Manage client portal logins', adminOnly: true },
];

// Default role suggestions the Role Autocomplete always shows, even
// when no user with that role exists yet. The list grows as admins
// type custom roles — those get persisted via the new user's `role`
// field and surfaced again by /api/users/roles. 'admin' stays in here
// because it's the only role that auto-grants every page.
const DEFAULT_ROLE_SUGGESTIONS = ['admin', 'PMM', 'SMM'];

// Stable colour palette for custom roles (anything outside the three
// built-ins). Each role name hashes to a fixed swatch so "Social
// Media Employee" always looks the same across the table, dialog
// chip, dropdown dot, and stat tile. The palette deliberately avoids:
//   - red (#ef4444)     — admin
//   - blue (#3b82f6)    — PMM
//   - sky (#0ea5e9)     — SMM
//   - slate (#94a3b8)   — inactive / disabled rows
//   - green (#10b981)   — active status
// so no custom role ever paints itself like a built-in or a state.
const CUSTOM_ROLE_SWATCHES = [
  '#a855f7',  // violet
  '#C68C0A',  // teal
  '#f97316',  // orange
  '#ec4899',  // pink
  '#f59e0b',  // amber
  '#6366f1',  // indigo
  '#dc2626',  // crimson — deeper red, distinguishable from admin red
  '#0891b2',  // cyan
  '#84cc16',  // lime
  '#7c3aed',  // deep purple
];
const swatchForRole = (role = '') => {
  let h = 0;
  for (let i = 0; i < role.length; i += 1) {
    h = (h * 31 + role.charCodeAt(i)) | 0;
  }
  return CUSTOM_ROLE_SWATCHES[Math.abs(h) % CUSTOM_ROLE_SWATCHES.length];
};

// MUI's `freeSolo` Autocomplete needs a custom filter to support the
// "+ Add new" suggestion at the bottom of the dropdown when the typed
// value doesn't match any existing option. We use it on both Role and
// Team pickers below.
const filterRoleOptions = createFilterOptions({
  trim: true,
  matchFrom: 'any',
});

// "Just enough to do their job" preset. Picks the four pages an SMM
// usually needs on day one — admins click this and tweak from there
// instead of ticking each box.
const COMMON_DEFAULTS = ['dashboard', 'daily-lead-data', 'clients', 'leads'];

const allPageIds = availablePages.map((page) => page.id);

// Pretty labels for the well-known roles. Anything not in this map
// (custom roles) renders the raw role string — which is what the
// admin typed, so it already reads correctly. `superadmin` is hidden
// from the picker on purpose: it's an internal seed role only.
const roleLabelMap = {
  admin: 'Admin',
  SMM: 'Social Media Manager',
  PMM: 'Performance Marketing Manager',
};
const labelForRole = (role) => roleLabelMap[role] || role || '—';

// Software palette — hardcoded so the page reads identically no matter
// which accent the user has set in the legacy ThemeContext. The light
// copper preset was painting the Add User button white-on-cream and
// hiding the label completely.
const COPPER = '#1F3966';
const BROWN = '#1F3966';

const AccessManagement = () => {
  const primaryColor = COPPER;
  const secondaryColor = BROWN;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'admin' | 'PMM' | 'SMM' | 'inactive'
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
  // Persisted custom roles from the server, plus any role typed in the
  // dialog this session that hasn't been saved yet. Combined into
  // `roleOptions` below for both Create and Edit dialogs.
  const [serverRoles, setServerRoles] = useState([]);

  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editUserData, setEditUserData] = useState(null);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Row 3-dot menu state (less-used actions tucked here so the row stays clean).
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuUser, setRowMenuUser] = useState(null);
  const openRowMenu = (event, user) => {
    setRowMenuAnchor(event.currentTarget);
    setRowMenuUser(user);
  };
  const closeRowMenu = () => {
    setRowMenuAnchor(null);
    setRowMenuUser(null);
  };

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'SMM',
    phone: '',
    department: '',
    team: '',
    permissions: COMMON_DEFAULTS,
  });

  useEffect(() => {
    fetchUsers();
    fetchTeams();
    fetchRoles();
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

  const fetchRoles = async () => {
    try {
      const response = await userApi.getRoles();
      setServerRoles(response.data || []);
    } catch (error) {
      // Soft-fail — the dialog falls back to DEFAULT_ROLE_SUGGESTIONS.
      console.error('Error fetching roles:', error);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Union of: built-in suggestions + roles persisted on the server +
  // any role already in use on a loaded user (covers the edge case
  // where a role was just typed and saved but /users/roles is cached).
  // De-duped + sorted for predictable display.
  const roleOptions = useMemo(() => {
    const set = new Set([
      ...DEFAULT_ROLE_SUGGESTIONS,
      ...serverRoles,
      ...users.map((u) => u.role).filter(Boolean),
    ]);
    // Hide the internal `superadmin` seed role from the picker — the
    // app still recognises it for full-access purposes, but admins
    // shouldn't be able to create more of them from the UI.
    set.delete('superadmin');
    return Array.from(set).sort((a, b) => {
      // Keep admin at the top so it's the easy default for full access.
      if (a === 'admin') return -1;
      if (b === 'admin') return 1;
      return a.localeCompare(b);
    });
  }, [serverRoles, users]);

  // Counts for the hero strip / role filter chips. Computed once
  // per `users` change instead of on every render.
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = total - active;
    const admin = users.filter((u) => u.role === 'admin').length;
    const pmm = users.filter((u) => u.role === 'PMM').length;
    const smm = users.filter((u) => u.role === 'SMM').length;
    return { total, active, inactive, admin, pmm, smm };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !q ||
        user.name?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q) ||
        user.userID?.toLowerCase().includes(q);
      if (!matchesQuery) return false;
      if (roleFilter === 'all') return true;
      if (roleFilter === 'inactive') return !user.isActive;
      return user.role === roleFilter;
    });
  }, [users, searchQuery, roleFilter]);

  const handleEditAccess = (user) => {
    setSelectedUser(user);
    setTempPermissions(user.permissions || []);
    setEditDialogOpen(true);
  };

  const handleTogglePermission = (pageId) => {
    setTempPermissions((prev) =>
      prev.includes(pageId) ? prev.filter((p) => p !== pageId) : [...prev, pageId]
    );
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
      const payload = normalizeForSubmit(newUser);
      const response = await userApi.createUser(payload);
      showSnackbar('User created successfully');
      setCreateDialogOpen(false);
      if (response.data) {
        setUsers((prev) => [response.data, ...prev]);
        // Keep the role / team dropdowns in sync with what was just
        // created — otherwise the admin would have to refresh the page
        // before the new value reappears in a later dialog.
        const r = response.data.role;
        if (r && !serverRoles.includes(r)) {
          setServerRoles((prev) => [...prev, r].sort());
        }
        const t = response.data.team;
        if (t && !teams.includes(t)) {
          setTeams((prev) => [...prev, t].sort());
        }
      } else {
        fetchUsers();
      }
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'SMM',
        phone: '',
        department: '',
        team: '',
        permissions: COMMON_DEFAULTS,
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
    // Team is no longer SMM-only — admins can create custom roles
    // that still belong to a team. So no auto-wipe on role change.
    setEditUserData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEditUser = async () => {
    try {
      setActionLoading(true);
      const { _id, ...updateData } = editUserData;
      const response = await userApi.updateUser(_id, updateData);
      setUsers((prev) =>
        prev.map((u) => (u._id === _id ? { ...u, ...response.data } : u))
      );
      // Mirror the same dropdown sync we do on create — if the edit
      // introduced a new role or team, surface it next time.
      const r = response.data?.role;
      if (r && !serverRoles.includes(r)) {
        setServerRoles((prev) => [...prev, r].sort());
      }
      const t = response.data?.team;
      if (t && !teams.includes(t)) {
        setTeams((prev) => [...prev, t].sort());
      }
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
    setNewUser((prev) => ({ ...prev, [field]: value }));
  };

  // Role commit handler — fires when the Autocomplete value is
  // FINALIZED (selecting a suggestion, pressing Enter, or picking the
  // "+ Create new role" item). Not on every keystroke — otherwise
  // typing "SMM" character-by-character would wipe permissions on the
  // intermediate "S"/"SM" values.
  const handleNewUserRoleCommit = (value) => {
    const v = (value || '').trim();
    if (v === 'admin') {
      setNewUser((prev) => ({ ...prev, role: v, permissions: allPageIds }));
      return;
    }
    const isKnown = roleOptions.includes(v);
    setNewUser((prev) => ({
      ...prev,
      role: v,
      permissions: isKnown ? prev.permissions : [],
    }));
  };

  // Right before sending to the server, normalize the role: if it's
  // something brand-new (not in roleOptions) the admin typed but
  // never committed, run the commit logic now so the final permission
  // set matches their visible role pick.
  const normalizeForSubmit = (draft) => {
    const role = (draft.role || '').trim();
    if (role === 'admin') {
      return { ...draft, role, permissions: allPageIds };
    }
    const isKnown = roleOptions.includes(role);
    return { ...draft, role, permissions: isKnown ? draft.permissions : [] };
  };

  const handleNewUserPermissionToggle = (pageId) => {
    if (newUser.role === 'admin') return;
    setNewUser((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(pageId)
        ? prev.permissions.filter((p) => p !== pageId)
        : [...prev.permissions, pageId],
    }));
  };

  // Built-in role colors. Everything outside this map is a custom
  // role the admin created — those get a deterministic swatch from
  // CUSTOM_ROLE_SWATCHES below, NOT the default slate. Earlier the
  // fallback was '#94a3b8' (slate), identical to the Inactive chip,
  // which made custom roles like "Social Media Employee" look
  // greyed-out as if they were deactivated.
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return '#ef4444';        // red — full access, loud on purpose
      case 'PMM':
        return '#3b82f6';        // blue — performance marketing
      case 'SMM':
        return '#0ea5e9';        // sky blue — social media manager
      default:
        return swatchForRole(role);
    }
  };

  // ── Reusable: stat tile for the hero strip ────────────────────
  const StatTile = ({ label, value, color, icon, hint, onClick, selected }) => (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        flex: 1,
        minWidth: 150,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        borderColor: selected ? color : undefined,
        borderWidth: selected ? 2 : 1,
        bgcolor: selected ? `${color}08` : undefined,
        '&:hover': onClick ? { borderColor: color, transform: 'translateY(-1px)' } : undefined,
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{
            width: 30, height: 30, borderRadius: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${color}18`, color,
          }}>
            {icon}
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4 }}>
            {label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.1 }}>
          {value}
        </Typography>
        {hint && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.3 }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  // ── Reusable: page permission picker ──────────────────────────
  // Card grid where each tile mirrors a sidebar entry (icon + label).
  // Clicking a tile toggles the permission. Admin-only pages are
  // disabled for non-admin roles with a tooltip explaining why.
  const PermissionGrid = ({ selectedIds, onToggle, currentRole, disabled = false }) => {
    const handleSelectAll = () => {
      if (disabled) return;
      const ids = availablePages
        .filter((p) => !p.adminOnly || currentRole === 'admin')
        .map((p) => p.id);
      ids.forEach((id) => {
        if (!selectedIds.includes(id)) onToggle(id);
      });
    };
    const handleClear = () => {
      if (disabled) return;
      selectedIds.forEach((id) => onToggle(id));
    };
    const handlePreset = () => {
      if (disabled) return;
      // First clear, then add defaults — diff approach avoids
      // toggling something already at the desired state.
      const toRemove = selectedIds.filter((id) => !COMMON_DEFAULTS.includes(id));
      const toAdd = COMMON_DEFAULTS.filter((id) => !selectedIds.includes(id));
      [...toRemove, ...toAdd].forEach((id) => onToggle(id));
    };

    return (
      <Box>
        {/* Quick-toggle row — Select all / Clear / Preset */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Button
            size="small" variant="outlined" disabled={disabled}
            startIcon={<SelectAllIcon sx={{ fontSize: 16 }} />}
            onClick={handleSelectAll}
            sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#E4EAF3', color: 'text.primary' }}
          >
            Select all
          </Button>
          <Button
            size="small" variant="outlined" disabled={disabled || selectedIds.length === 0}
            startIcon={<ClearIcon sx={{ fontSize: 16 }} />}
            onClick={handleClear}
            sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#E4EAF3', color: 'text.primary' }}
          >
            Clear
          </Button>
          <Tooltip arrow title="Dashboard + Leads Check + Clients + Total Leads — the usual SMM starting set.">
            <Button
              size="small" variant="outlined" disabled={disabled}
              startIcon={<PresetIcon sx={{ fontSize: 16 }} />}
              onClick={handlePreset}
              sx={{ textTransform: 'none', fontWeight: 600, borderColor: primaryColor, color: primaryColor }}
            >
              Common defaults
            </Button>
          </Tooltip>
          <Typography sx={{ ml: 'auto', fontSize: '0.78rem', color: 'text.secondary' }}>
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {selectedIds.length}
            </Box>{' '}
            of {availablePages.length} pages selected
          </Typography>
        </Box>

        {/* Page tile grid */}
        <Grid container spacing={1.2}>
          {availablePages.map((page) => {
            const checked = selectedIds.includes(page.id);
            const isAdminOnly = !!page.adminOnly;
            const lockedForRole = isAdminOnly && currentRole && currentRole !== 'admin';
            const Icon = page.Icon;
            const tile = (
              <Card
                variant="outlined"
                onClick={() => !disabled && !lockedForRole && onToggle(page.id)}
                sx={{
                  cursor: (disabled || lockedForRole) ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  borderRadius: 2,
                  borderColor: checked ? primaryColor : '#E4EAF3',
                  borderWidth: checked ? 2 : 1,
                  bgcolor: checked ? `${primaryColor}10` : '#fff',
                  transition: 'all 0.15s',
                  opacity: lockedForRole ? 0.5 : 1,
                  '&:hover': (disabled || lockedForRole) ? undefined : {
                    borderColor: primaryColor,
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  },
                }}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: checked ? primaryColor : '#f1f5f9',
                      color: checked ? '#fff' : '#64748b',
                      transition: 'all 0.15s',
                    }}>
                      <Icon fontSize="small" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.2 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.2 }}>
                          {page.name}
                        </Typography>
                        {isAdminOnly && (
                          <Tooltip arrow title="Only admin role can see this page even with the permission granted.">
                            <Chip
                              icon={<AdminBadgeIcon sx={{ fontSize: '12px !important', ml: '4px !important' }} />}
                              label="Admin"
                              size="small"
                              sx={{
                                height: 16, fontSize: '0.62rem', fontWeight: 700,
                                bgcolor: '#fef2f2', color: '#ef4444',
                                '& .MuiChip-label': { px: 0.6 },
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.3 }}>
                        {page.hint}
                      </Typography>
                    </Box>
                    <Box sx={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: checked ? primaryColor : 'transparent',
                      border: checked ? 'none' : '2px solid #cbd5e1',
                      transition: 'all 0.15s',
                    }}>
                      {checked && <CheckCircleIcon sx={{ fontSize: 18, color: '#fff' }} />}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
            return (
              <Grid size={{ xs: 12, sm: 6 }} key={page.id}>
                {lockedForRole ? (
                  <Tooltip arrow title="This page is only visible to admins. Assign the Admin role to grant access.">
                    <Box>{tile}</Box>
                  </Tooltip>
                ) : tile}
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: primaryColor }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Hero strip ───────────────────────────────────────────── */}
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          background: `linear-gradient(135deg, ${primaryColor}12 0%, ${primaryColor}05 50%, transparent 100%)`,
          borderLeft: `4px solid ${primaryColor}`,
        }}
      >
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: primaryColor, color: '#fff',
              }}>
                <ShieldIcon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.1 }}>
                  Access Management
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                  Manage who can sign in and which pages each person can see
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search name, email or ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  minWidth: 250, bgcolor: 'background.paper',
                  '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.85rem' },
                }}
              />
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{
                  bgcolor: BROWN,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 2.2,
                  boxShadow: '0 2px 6px rgba(62,39,35,0.25)',
                  '&:hover': { bgcolor: BROWN, color: '#fff', filter: 'brightness(1.08)' },
                }}
              >
                Add User
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ── Stat tiles (clickable as role filter chips) ──────────── */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <StatTile
          label="Total"
          value={stats.total}
          icon={<GroupIcon fontSize="small" />}
          color={secondaryColor}
          hint="All team members"
          onClick={() => setRoleFilter('all')}
          selected={roleFilter === 'all'}
        />
        <StatTile
          label="Admins"
          value={stats.admin}
          icon={<AdminBadgeIcon fontSize="small" />}
          color="#ef4444"
          hint="Full access"
          onClick={() => setRoleFilter('admin')}
          selected={roleFilter === 'admin'}
        />
        <StatTile
          label="PMM"
          value={stats.pmm}
          icon={<CampaignIcon fontSize="small" />}
          color="#3b82f6"
          hint="Performance marketing"
          onClick={() => setRoleFilter('PMM')}
          selected={roleFilter === 'PMM'}
        />
        <StatTile
          label="SMM"
          value={stats.smm}
          icon={<InsightsIcon fontSize="small" />}
          color="#0ea5e9"
          hint="Social media managers"
          onClick={() => setRoleFilter('SMM')}
          selected={roleFilter === 'SMM'}
        />
        <StatTile
          label="Inactive"
          value={stats.inactive}
          icon={<BlockIcon fontSize="small" />}
          color="#94a3b8"
          hint="Login disabled"
          onClick={() => setRoleFilter('inactive')}
          selected={roleFilter === 'inactive'}
        />
      </Box>

      {/* ── Users table ─────────────────────────────────────────── */}
      {filteredUsers.length === 0 ? (
        <Card variant="outlined" sx={{ py: 6, textAlign: 'center', borderRadius: 2 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%', mx: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${primaryColor}14`, color: primaryColor, mb: 1.5,
          }}>
            <SearchIcon />
          </Box>
          <Typography sx={{ fontWeight: 700, mb: 0.4 }}>
            {searchQuery || roleFilter !== 'all' ? 'No users match this view' : 'No users yet'}
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: searchQuery || roleFilter !== 'all' ? 0 : 2 }}>
            {searchQuery || roleFilter !== 'all'
              ? 'Try clearing the search or switching the filter chip.'
              : 'Add your first team member to get started.'}
          </Typography>
          {!searchQuery && roleFilter === 'all' && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{
                bgcolor: BROWN, color: '#fff', textTransform: 'none', fontWeight: 700,
                '&:hover': { bgcolor: BROWN, color: '#fff', filter: 'brightness(1.08)' },
              }}
            >
              Add User
            </Button>
          )}
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: `${primaryColor}08`, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 0.3, color: secondaryColor } }}>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Pages they can see</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => {
                const permCount = user.permissions?.length || 0;
                const visiblePages = user.role === 'admin'
                  ? availablePages
                  : availablePages.filter((p) => (user.permissions || []).includes(p.id));
                const permTooltip = user.role === 'admin'
                  ? 'Admins see every page automatically.'
                  : (permCount === 0
                      ? 'This user has no page access yet. Click Manage access to grant pages.'
                      : visiblePages.map((p) => p.name).join(', '));
                const roleColor = getRoleColor(user.role);

                return (
                  <TableRow key={user._id} hover sx={{ opacity: user.isActive ? 1 : 0.55, '& td': { borderColor: '#f1f5f9' } }}>
                    {/* User column */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Avatar sx={{
                          width: 36, height: 36,
                          bgcolor: user.isActive ? roleColor : 'grey.400',
                          fontSize: '0.95rem', fontWeight: 700,
                        }}>
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.2 }}>
                            {user.name}
                          </Typography>
                          <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={labelForRole(user.role)}
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.7rem', fontWeight: 700,
                          bgcolor: `${roleColor}18`, color: roleColor,
                        }}
                      />
                    </TableCell>

                    <TableCell>
                      {user.team ? (
                        <Chip
                          label={user.team.replace('SMM ', '')}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 22, borderColor: '#cbd5e1' }}
                        />
                      ) : (
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>—</Typography>
                      )}
                    </TableCell>

                    {/* Page access summary — for non-admin users we show up
                        to 3 page-icon chips so admins see at a glance WHAT
                        the user can reach, not just the count. */}
                    <TableCell>
                      <Tooltip title={permTooltip} arrow>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          {user.role === 'admin' ? (
                            <Chip
                              icon={<KeyIcon sx={{ fontSize: '13px !important' }} />}
                              label="All pages"
                              size="small"
                              sx={{
                                height: 22, fontSize: '0.7rem', fontWeight: 700,
                                bgcolor: '#fef2f2', color: '#ef4444',
                                '& .MuiChip-icon': { color: 'inherit' },
                              }}
                            />
                          ) : permCount === 0 ? (
                            <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled', fontStyle: 'italic' }}>
                              None
                            </Typography>
                          ) : (
                            <>
                              {visiblePages.slice(0, 3).map((p) => {
                                const Icon = p.Icon;
                                return (
                                  <Box key={p.id} sx={{
                                    display: 'inline-flex', alignItems: 'center', gap: 0.3,
                                    px: 0.7, py: 0.2, borderRadius: 1,
                                    bgcolor: `${primaryColor}14`, color: primaryColor,
                                    fontSize: '0.7rem', fontWeight: 700,
                                  }}>
                                    <Icon sx={{ fontSize: 12 }} />
                                    {p.name}
                                  </Box>
                                );
                              })}
                              {visiblePages.length > 3 && (
                                <Box sx={{
                                  px: 0.7, py: 0.2, borderRadius: 1,
                                  bgcolor: '#f1f5f9', color: '#64748b',
                                  fontSize: '0.7rem', fontWeight: 700,
                                }}>
                                  +{visiblePages.length - 3}
                                </Box>
                              )}
                            </>
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>

                    <TableCell>
                      <Chip
                        icon={user.isActive ? <CheckCircleIcon sx={{ fontSize: '14px !important' }} /> : <BlockIcon sx={{ fontSize: '14px !important' }} />}
                        label={user.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.7rem', fontWeight: 700,
                          bgcolor: user.isActive ? '#10b98118' : '#94a3b818',
                          color: user.isActive ? '#10b981' : '#64748b',
                          '& .MuiChip-icon': { color: 'inherit' },
                        }}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Box sx={{ display: 'inline-flex', gap: 0.4 }}>
                        <Tooltip title="Edit profile" arrow>
                          <IconButton size="small" onClick={() => handleOpenEditUser(user)} sx={{ color: primaryColor }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {user.role !== 'admin' && (
                          <Tooltip title="Manage page access" arrow>
                            <IconButton size="small" onClick={() => handleEditAccess(user)} sx={{ color: '#3b82f6' }}>
                              <KeyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="More" arrow>
                          <IconButton size="small" onClick={(e) => openRowMenu(e, user)} sx={{ color: 'text.secondary' }}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Row 3-dot menu ──────────────────────────────────────── */}
      <Menu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={closeRowMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            const user = rowMenuUser;
            closeRowMenu();
            if (!user) return;
            setPasswordUser(user);
            setNewPassword('');
            setShowNewPassword(false);
            setPasswordDialogOpen(true);
          }}
        >
          <LockIcon fontSize="small" sx={{ mr: 1.2, color: 'warning.main' }} />
          Reset password
        </MenuItem>
        <MenuItem
          onClick={() => {
            const user = rowMenuUser;
            closeRowMenu();
            if (!user) return;
            handleToggleUserStatus(user._id);
          }}
        >
          <PowerIcon
            fontSize="small"
            sx={{ mr: 1.2, color: rowMenuUser?.isActive ? 'error.main' : 'success.main' }}
          />
          {rowMenuUser?.isActive ? 'Deactivate user' : 'Activate user'}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            const user = rowMenuUser;
            closeRowMenu();
            if (!user) return;
            setUserToDelete(user);
            setDeleteDialogOpen(true);
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1.2 }} />
          Delete user
        </MenuItem>
      </Menu>

      {/* ── Create User Dialog ──────────────────────────────────── */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
      >
        <Box sx={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
          color: '#fff', px: 3, py: 2,
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }}>
            <PersonAddIcon />
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
              New team member
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
              Create User
            </Typography>
          </Box>
        </Box>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            {/* Profile section */}
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: secondaryColor, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Profile
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth size="small"
                    label="Full Name"
                    value={newUser.name}
                    onChange={(e) => handleNewUserChange('name', e.target.value)}
                    required
                    inputProps={{ maxLength: 50 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth size="small"
                    label="Email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => handleNewUserChange('email', e.target.value)}
                    required
                    inputProps={{ maxLength: 254 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth size="small"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => handleNewUserChange('password', e.target.value)}
                    required
                    autoComplete="new-password"
                    helperText="Minimum 6 characters"
                    inputProps={{ minLength: 6, maxLength: 128 }}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                              {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth size="small"
                    label="Phone"
                    value={newUser.phone}
                    onChange={(e) => handleNewUserChange('phone', e.target.value)}
                    inputProps={{ maxLength: 30 }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Role & Team */}
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: secondaryColor, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Role & Team
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={roleOptions}
                    value={newUser.role || ''}
                    onChange={(_, val) => {
                      // Strip the "+ Create new" sentinel prefix if the
                      // admin picked that suggestion from the dropdown.
                      const clean = typeof val === 'string' && val.startsWith('__add__') ? val.slice(7) : val;
                      handleNewUserRoleCommit(clean);
                    }}
                    onInputChange={(_, val, reason) => {
                      // Keep the role string in sync as the admin types
                      // so handleSave sees the latest value, but don't
                      // touch permissions here — that's the commit job.
                      if (reason === 'input') handleNewUserChange('role', val);
                    }}
                    filterOptions={(opts, params) => {
                      const filtered = filterRoleOptions(opts, params);
                      const v = params.inputValue.trim();
                      if (v && !opts.some((o) => o.toLowerCase() === v.toLowerCase())) {
                        filtered.push(`__add__${v}`);
                      }
                      return filtered;
                    }}
                    getOptionLabel={(opt) => {
                      if (typeof opt !== 'string') return '';
                      if (opt.startsWith('__add__')) return opt.slice(7);
                      return labelForRole(opt);
                    }}
                    renderOption={(props, option) => {
                      if (option.startsWith('__add__')) {
                        const val = option.slice(7);
                        return (
                          <li {...props} key={option} style={{ fontWeight: 600, color: COPPER }}>
                            + Create new role: <span style={{ marginLeft: 4 }}>"{val}"</span>
                          </li>
                        );
                      }
                      return (
                        <li {...props} key={option}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getRoleColor(option) }} />
                            {labelForRole(option)}
                          </Box>
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Role" required placeholder="Type to create a new role" />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth size="small"
                    label="Department"
                    value={newUser.department}
                    onChange={(e) => handleNewUserChange('department', e.target.value)}
                    inputProps={{ maxLength: 60 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    freeSolo
                    size="small"
                    options={teams}
                    value={newUser.team || ''}
                    onChange={(_, val) => {
                      const clean = typeof val === 'string' && val.startsWith('__add__') ? val.slice(7) : val;
                      handleNewUserChange('team', (clean || '').trim());
                    }}
                    onInputChange={(_, val, reason) => {
                      if (reason === 'input') handleNewUserChange('team', val);
                    }}
                    filterOptions={(opts, params) => {
                      const filtered = filterRoleOptions(opts, params);
                      const v = params.inputValue.trim();
                      if (v && !opts.some((o) => o.toLowerCase() === v.toLowerCase())) {
                        filtered.push(`__add__${v}`);
                      }
                      return filtered;
                    }}
                    getOptionLabel={(opt) => (typeof opt === 'string' ? (opt.startsWith('__add__') ? opt.slice(7) : opt) : '')}
                    renderOption={(props, option) => {
                      if (option.startsWith('__add__')) {
                        const val = option.slice(7);
                        return (
                          <li {...props} key={option} style={{ fontWeight: 600, color: COPPER }}>
                            + Create new team: <span style={{ marginLeft: 4 }}>"{val}"</span>
                          </li>
                        );
                      }
                      return <li {...props} key={option}>{option}</li>;
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Team" placeholder="Type to create a new team" />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Permissions */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: secondaryColor, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Page Access
                </Typography>
                <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                  These are the same pages they'll see in the sidebar
                </Typography>
              </Box>
              {newUser.role === 'admin' ? (
                <Alert severity="info" icon={<AdminBadgeIcon />} sx={{ borderRadius: 1.5 }}>
                  Admin users automatically get access to every page. No selection needed.
                </Alert>
              ) : (
                <PermissionGrid
                  selectedIds={newUser.permissions}
                  onToggle={handleNewUserPermissionToggle}
                  currentRole={newUser.role}
                />
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={!newUser.name || !newUser.email || !newUser.password || actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
            sx={{
              bgcolor: secondaryColor, color: '#fff', fontWeight: 700,
              '&:hover': { bgcolor: secondaryColor, filter: 'brightness(0.92)', color: '#fff' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)' },
            }}
          >
            {actionLoading ? 'Creating…' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Permissions Dialog ─────────────────────────────── */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
      >
        {selectedUser && (
          <Box sx={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            color: '#fff', px: 3, py: 2,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 800 }}>
              {selectedUser.name?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
                Page access
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                {selectedUser.name}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>
                {selectedUser.userID} · {labelForRole(selectedUser.role)}
              </Typography>
            </Box>
          </Box>
        )}
        <DialogContent sx={{ pt: 3 }}>
          {selectedUser && (
            <Box>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2 }}>
                Tick the pages this user should see in their sidebar. They'll be redirected away from anything not selected here.
              </Typography>
              <PermissionGrid
                selectedIds={tempPermissions}
                onToggle={handleTogglePermission}
                currentRole={selectedUser.role}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePermissions}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
            sx={{
              bgcolor: secondaryColor, color: '#fff', fontWeight: 700,
              '&:hover': { bgcolor: secondaryColor, filter: 'brightness(0.92)', color: '#fff' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)' },
            }}
          >
            {actionLoading ? 'Saving…' : 'Save Permissions'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit User Dialog ────────────────────────────────────── */}
      <Dialog
        open={editUserDialogOpen}
        onClose={() => setEditUserDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Edit User</DialogTitle>
        <DialogContent>
          {editUserData && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth size="small" label="Full Name" value={editUserData.name} onChange={(e) => handleEditUserChange('name', e.target.value)} required inputProps={{ maxLength: 50 }} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth size="small" label="Email" type="email" value={editUserData.email} onChange={(e) => handleEditUserChange('email', e.target.value)} required inputProps={{ maxLength: 254 }} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={roleOptions}
                  value={editUserData.role || ''}
                  onChange={(_, val) => {
                    const clean = typeof val === 'string' && val.startsWith('__add__') ? val.slice(7) : val;
                    handleEditUserChange('role', (clean || '').trim());
                  }}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') handleEditUserChange('role', val);
                  }}
                  filterOptions={(opts, params) => {
                    const filtered = filterRoleOptions(opts, params);
                    const v = params.inputValue.trim();
                    if (v && !opts.some((o) => o.toLowerCase() === v.toLowerCase())) {
                      filtered.push(`__add__${v}`);
                    }
                    return filtered;
                  }}
                  getOptionLabel={(opt) => {
                    if (typeof opt !== 'string') return '';
                    if (opt.startsWith('__add__')) return opt.slice(7);
                    return labelForRole(opt);
                  }}
                  renderOption={(props, option) => {
                    if (option.startsWith('__add__')) {
                      const val = option.slice(7);
                      return (
                        <li {...props} key={option} style={{ fontWeight: 600, color: COPPER }}>
                          + Create new role: <span style={{ marginLeft: 4 }}>"{val}"</span>
                        </li>
                      );
                    }
                    return (
                      <li {...props} key={option}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getRoleColor(option) }} />
                          {labelForRole(option)}
                        </Box>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Role" required placeholder="Type to create a new role" />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={teams}
                  value={editUserData.team || ''}
                  onChange={(_, val) => {
                    const clean = typeof val === 'string' && val.startsWith('__add__') ? val.slice(7) : val;
                    handleEditUserChange('team', (clean || '').trim());
                  }}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') handleEditUserChange('team', val);
                  }}
                  filterOptions={(opts, params) => {
                    const filtered = filterRoleOptions(opts, params);
                    const v = params.inputValue.trim();
                    if (v && !opts.some((o) => o.toLowerCase() === v.toLowerCase())) {
                      filtered.push(`__add__${v}`);
                    }
                    return filtered;
                  }}
                  getOptionLabel={(opt) => (typeof opt === 'string' ? (opt.startsWith('__add__') ? opt.slice(7) : opt) : '')}
                  renderOption={(props, option) => {
                    if (option.startsWith('__add__')) {
                      const val = option.slice(7);
                      return (
                        <li {...props} key={option} style={{ fontWeight: 600, color: COPPER }}>
                          + Create new team: <span style={{ marginLeft: 4 }}>"{val}"</span>
                        </li>
                      );
                    }
                    return <li {...props} key={option}>{option}</li>;
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Team" placeholder="Type to create a new team" />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth size="small" label="Phone" value={editUserData.phone} onChange={(e) => handleEditUserChange('phone', e.target.value)} inputProps={{ maxLength: 30 }} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth size="small" label="Department" value={editUserData.department} onChange={(e) => handleEditUserChange('department', e.target.value)} inputProps={{ maxLength: 60 }} />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditUserDialogOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEditUser}
            disabled={!editUserData?.name || !editUserData?.email || actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
            sx={{
              bgcolor: secondaryColor, color: '#fff', fontWeight: 700,
              '&:hover': { bgcolor: secondaryColor, filter: 'brightness(0.92)', color: '#fff' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)' },
            }}
          >
            {actionLoading ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteUser}
            disabled={actionLoading}
            sx={{ fontWeight: 700 }}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Change Password Dialog ──────────────────────────────── */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Change Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set a new password for <strong>{passwordUser?.name}</strong> ({passwordUser?.email})
          </Typography>
          <TextField
            fullWidth size="small"
            label="New Password"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Minimum 6 characters"
            autoComplete="new-password"
            inputProps={{ minLength: 6, maxLength: 128 }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end" size="small">
                      {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPasswordDialogOpen(false)} sx={{ color: 'text.secondary', fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={actionLoading || !newPassword || newPassword.length < 6}
            startIcon={actionLoading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
            sx={{
              bgcolor: secondaryColor, color: '#fff', fontWeight: 700,
              '&:hover': { bgcolor: secondaryColor, filter: 'brightness(0.92)', color: '#fff' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)' },
            }}
          >
            {actionLoading ? 'Changing…' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ────────────────────────────────────────────── */}
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
