import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout, loadUserFromStorage } from '../store/slices/authSlice';
import api from '../api/axios';
import { ThemeContext } from '../contexts/ThemeContext';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Chip,
  useTheme,
  alpha,
  Collapse,
  InputBase,
  Paper,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AccountCircle,
  Logout,
  Settings as SettingsIcon,
  Assessment as ReportsIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandLess,
  ExpandMore,
  Star,
  DarkMode,
  LightMode,
  Task as TaskIcon,
  Insights as InsightsIcon,
  EditNote as EditNoteIcon,
  AccountBalance as AccountBalanceIcon,
  Shield as ShieldIcon,
  Leaderboard as LeaderboardIcon,
  Lock as LockIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';

// Map routes to permission IDs for access control
const routePermissions = {
  '/dashboard': 'dashboard',
  '/daily-entry': 'daily-entry',
  '/daily-lead-data': 'daily-lead-data',
  '/clients': 'clients',
  '/leads': 'leads',
  '/client-vault': 'client-vault',
  '/fund-entry': 'fund-entry',
  '/reports': 'reports',
  '/settings': 'settings',
  '/access-management': 'access-management',
  '/personal-vault': 'personal-vault',
  '/content-management': 'content-management',
};


const drawerWidth = 260;
const collapsedDrawerWidth = 72;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { mode: darkMode, toggleTheme, accentColor } = useContext(ThemeContext);
  const { user } = useSelector((state) => state.auth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const isDarkMode = darkMode === 'dark';

  // Get the accent colors
  const primaryColor = accentColor?.primary || '#6366F1';
  const secondaryColor = accentColor?.secondary || '#818CF8';

  // Check if user is super admin or admin (full access)
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'Super Admin';
  const isAdmin = user?.role === 'admin';
  const hasFullAccess = isSuperAdmin || isAdmin;

  // Silently refresh user permissions from server on mount
  useEffect(() => {
    const refreshUser = async () => {
      try {
        const response = await api.get('/auth/me');
        const freshUser = response.data.data;
        if (freshUser) {
          localStorage.setItem('user', JSON.stringify(freshUser));
          dispatch(loadUserFromStorage());
        }
      } catch {
        // Silently ignore - don't log out on failure
      }
    };
    refreshUser();
  }, [dispatch]);

  // Check permission on route change and redirect if not allowed
  useEffect(() => {
    if (!hasFullAccess && user) {
      const currentPath = location.pathname;
      const requiredPermission = routePermissions[currentPath];

      if (requiredPermission) {
        const hasPermission = user.permissions?.includes(requiredPermission);

        if (!hasPermission) {
          // Find first permitted route to redirect to
          const firstPermittedRoute = Object.entries(routePermissions).find(
            ([, permId]) => user.permissions?.includes(permId)
          );
          navigate(firstPermittedRoute ? firstPermittedRoute[0] : '/dashboard', { replace: true });
        }
      }
    }
  }, [location.pathname, hasFullAccess, user, navigate]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleSubmenuToggle = (text) => {
    setOpenSubmenu(prev => ({
      ...prev,
      [text]: !prev[text]
    }));
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotifOpen = (event) => {
    setNotifAnchor(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchor(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    handleMenuClose();
  };

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      badge: null,
      permissionId: 'dashboard'
    },
    {
      text: 'Daily Entry',
      icon: <EditNoteIcon />,
      path: '/daily-entry',
      badge: null,
      permissionId: 'daily-entry'
    },
    {
      text: 'Leads',
      icon: <InsightsIcon />,
      path: '/daily-lead-data',
      badge: null,
      permissionId: 'daily-lead-data'
    },
    {
      text: 'Clients',
      icon: <PeopleIcon />,
      path: '/clients',
      badge: null,
      permissionId: 'clients'
    },
    {
      text: 'Total Leads',
      icon: <LeaderboardIcon />,
      path: '/leads',
      badge: null,
      permissionId: 'leads'
    },
    {
      text: 'Client Vault',
      icon: <ShieldIcon />,
      path: '/client-vault',
      badge: null,
      permissionId: 'client-vault'
    },
    {
      text: 'Content',
      icon: <ArticleIcon />,
      path: '/content-management',
      badge: null,
      permissionId: 'content-management'
    },
    {
      text: 'Fund Entry',
      icon: <AccountBalanceIcon />,
      path: '/fund-entry',
      badge: null,
      permissionId: 'fund-entry'
    },
    {
      text: 'Reports',
      icon: <ReportsIcon />,
      path: '/reports',
      badge: null,
      permissionId: 'reports'
    },
    {
      text: 'Settings',
      icon: <SettingsIcon />,
      path: '/settings',
      badge: null,
      permissionId: 'settings'
    },
    {
      text: 'Personal Vault',
      icon: <LockIcon />,
      path: '/personal-vault',
      badge: null,
      permissionId: 'personal-vault'
    },
    {
      text: 'Access Management',
      icon: <ShieldIcon />,
      path: '/access-management',
      badge: null,
      permissionId: 'access-management',
      adminOnly: true
    },
  ];

  // Filter menu items based on user permissions
  const filteredMenuItems = menuItems.filter(item => {
    // Admin and superadmin have full access
    if (hasFullAccess) {
      return true;
    }
    // For adminOnly items, only admin/superadmin can see
    if (item.adminOnly) {
      return false;
    }
    // Check if user has permission for this menu item
    return user?.permissions?.includes(item.permissionId);
  });

  const todayLeads = [];

  const drawer = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: isDarkMode
        ? `linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(10, 15, 30, 0.92) 100%)`
        : `linear-gradient(180deg, ${primaryColor}E8 0%, ${primaryColor}D0 40%, ${secondaryColor}C8 100%)`,
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      position: 'relative',
      overflow: 'hidden',
      borderRight: isDarkMode
        ? '1px solid rgba(255,255,255,0.06)'
        : '1px solid rgba(255,255,255,0.2)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isDarkMode
          ? `radial-gradient(ellipse at top left, ${primaryColor}20 0%, transparent 50%), radial-gradient(ellipse at bottom right, ${secondaryColor}15 0%, transparent 50%)`
          : 'radial-gradient(ellipse at top left, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(255,255,255,0.08) 0%, transparent 50%)',
        pointerEvents: 'none',
      }
    }}>
      {/* Header with Logo and Collapse Button */}
      <Box sx={{ p: sidebarCollapsed ? 1.5 : 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              background: isDarkMode
                ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                : 'rgba(255, 255, 255, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.3rem',
              color: isDarkMode ? '#fff' : primaryColor,
              boxShadow: isDarkMode
                ? `0 4px 16px ${primaryColor}40`
                : '0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
              border: isDarkMode
                ? `1px solid ${primaryColor}40`
                : '1px solid rgba(255,255,255,0.5)',
              flexShrink: 0,
            }}
          >
            C
          </Box>
          {!sidebarCollapsed && (
            <Box sx={{ overflow: 'hidden' }}>
              <Typography sx={{ fontWeight: 700, color: 'white', lineHeight: 1.2, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>
                CRM Pro
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                ARA discover Pvt.Ltd
              </Typography>
            </Box>
          )}
        </Box>
        {!sidebarCollapsed && (
          <IconButton
            onClick={handleSidebarToggle}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              width: 32,
              height: 32,
            }}
            size="small"
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
        {sidebarCollapsed && (
          <IconButton
            onClick={handleSidebarToggle}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              width: 32,
              height: 32,
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
            }}
            size="small"
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* User Profile Card */}
      {!sidebarCollapsed && (
        <Box sx={{ px: 1.5, pb: 1.5, position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              background: isDarkMode
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(12px)',
              borderRadius: 2,
              p: 1.5,
              border: isDarkMode
                ? '1px solid rgba(255, 255, 255, 0.08)'
                : '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: isDarkMode
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.25)',
                transform: 'translateY(-2px)',
                boxShadow: isDarkMode
                  ? '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : '0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: isDarkMode ? primaryColor : 'white',
                  color: isDarkMode ? 'white' : primaryColor,
                  fontWeight: 600,
                  fontSize: '1rem',
                  border: isDarkMode
                    ? `2px solid ${primaryColor}80`
                    : '2px solid rgba(255,255,255,0.3)',
                }}
              >
                {user?.name?.[0] || 'A'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, color: 'white', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>
                  {user?.name || 'Admin User'}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>
                  {user?.role || 'Administrator'}
                </Typography>
              </Box>
            </Box>

          </Box>
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 1.5 }} />

      {/* Navigation Menu */}
      <List sx={{
        flex: 1,
        px: 1.5,
        py: 1,
        overflow: 'auto',
        position: 'relative',
        zIndex: 1,
        // Custom scrollbar styling
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.15) 100%)',
          borderRadius: '10px',
          '&:hover': {
            background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.25) 100%)',
          },
        },
      }}>
        {filteredMenuItems.map((item) => (
          <React.Fragment key={item.text}>
            <ListItem disablePadding sx={{ mb: 0.25 }}>
              <Tooltip title={sidebarCollapsed ? item.text : ''} placement="right">
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => {
                    if (item.subItems) {
                      handleSubmenuToggle(item.text);
                    } else {
                      navigate(item.path);
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    py: 1,
                    px: sidebarCollapsed ? 1.2 : 1.5,
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      background: isDarkMode
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(255, 255, 255, 0.18)',
                      transform: sidebarCollapsed ? 'scale(1.05)' : 'translateX(4px)',
                    },
                    '&.Mui-selected': {
                      background: isDarkMode
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(255, 255, 255, 0.28)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: isDarkMode
                        ? '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)'
                        : '0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.3)',
                      borderLeft: isDarkMode
                        ? '3px solid rgba(255,255,255,0.4)'
                        : '3px solid rgba(255,255,255,0.6)',
                      '&:hover': {
                        background: isDarkMode
                          ? 'rgba(255, 255, 255, 0.16)'
                          : 'rgba(255, 255, 255, 0.35)',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{
                    color: location.pathname === item.path
                      ? 'white'
                      : 'rgba(255,255,255,0.8)',
                    minWidth: sidebarCollapsed ? 0 : 36,
                    '& .MuiSvgIcon-root': {
                      fontSize: '1.25rem',
                    }
                  }}>
                    {item.badge && !sidebarCollapsed ? (
                      <Badge badgeContent={item.badge} color="error">
                        {item.icon}
                      </Badge>
                    ) : (
                      <Badge badgeContent={sidebarCollapsed && item.badge ? item.badge : 0} color="error">
                        {item.icon}
                      </Badge>
                    )}
                  </ListItemIcon>
                  {!sidebarCollapsed && (
                    <>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontWeight: location.pathname === item.path ? 600 : 500,
                          fontSize: '0.88rem',
                          color: 'white',
                        }}
                      />
                      {item.subItems && (
                        openSubmenu[item.text] ? <ExpandLess sx={{ color: 'white' }} /> : <ExpandMore sx={{ color: 'white' }} />
                      )}
                    </>
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>

            {/* Submenu Items */}
            {item.subItems && !sidebarCollapsed && (
              <Collapse in={openSubmenu[item.text]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.subItems.map((subItem) => (
                    <ListItemButton
                      key={subItem.text}
                      onClick={() => navigate(subItem.path)}
                      sx={{
                        pl: 5,
                        py: 1,
                        borderRadius: 2,
                        mb: 0.5,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          background: isDarkMode
                            ? `${primaryColor}15`
                            : 'rgba(255,255,255,0.1)',
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 30 }}>
                        {subItem.badge ? (
                          <Badge badgeContent={subItem.badge} color="error">
                            {subItem.icon}
                          </Badge>
                        ) : (
                          subItem.icon
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={subItem.text}
                        primaryTypographyProps={{
                          fontSize: '0.85rem',
                          color: 'rgba(255,255,255,0.9)',
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            )}
          </React.Fragment>
        ))}
      </List>

    </Box>
  );

  const currentDrawerWidth = sidebarCollapsed ? collapsedDrawerWidth : drawerWidth;

  return (
    <Box sx={{
      display: 'flex',
      '& *::-webkit-scrollbar': {
        width: '6px',
        height: '6px',
      },
      '& *::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '& *::-webkit-scrollbar-thumb': {
        background: isDarkMode
          ? 'rgba(255, 255, 255, 0.12)'
          : `${primaryColor}25`,
        borderRadius: '10px',
        '&:hover': {
          background: isDarkMode
            ? 'rgba(255, 255, 255, 0.22)'
            : `${primaryColor}40`,
        },
      },
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { sm: `${currentDrawerWidth}px` },
          bgcolor: isDarkMode
            ? 'rgba(15, 23, 42, 0.65)'
            : 'rgba(255, 255, 255, 0.55)',
          borderBottom: '1px solid',
          borderColor: isDarkMode
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: isDarkMode
            ? '0 4px 24px rgba(0, 0, 0, 0.2)'
            : '0 4px 24px rgba(0, 0, 0, 0.04), inset 0 -1px 0 rgba(255,255,255,0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' }, color: 'text.primary' }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {/* <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 1.5,
                px: 2.5,
                py: 1.25,
                bgcolor: isDarkMode
                  ? alpha(primaryColor, 0.12)
                  : alpha(primaryColor, 0.06),
                borderRadius: 2,
                border: isDarkMode
                  ? `1px solid ${primaryColor}25`
                  : `1px solid ${primaryColor}15`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: isDarkMode
                    ? alpha(primaryColor, 0.18)
                    : alpha(primaryColor, 0.1),
                  borderColor: isDarkMode
                    ? `${primaryColor}40`
                    : `${primaryColor}30`,
                },
              }}
            > */}
              {/* <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Search clients, leads...
              </Typography> */}
            {/* </Box> */}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton
                onClick={toggleTheme}
                sx={{
                  color: 'text.primary',
                  bgcolor: isDarkMode
                    ? `${primaryColor}20`
                    : `${primaryColor}12`,
                  '&:hover': {
                    bgcolor: isDarkMode
                      ? `${primaryColor}35`
                      : `${primaryColor}20`,
                  },
                }}
              >
                {isDarkMode ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications">
              <IconButton onClick={handleNotifOpen} sx={{ color: 'text.primary' }}>
                <Badge badgeContent={todayLeads.length} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2, ml: 2 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {user?.name || 'Admin User'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {user?.role || 'Administrator'}
                </Typography>
              </Box>
              <IconButton onClick={handleMenuOpen}>
                <Avatar sx={{
                  width: 40,
                  height: 40,
                  bgcolor: primaryColor,
                  color: 'white',
                }}>
                  {user?.name?.[0] || 'A'}
                </Avatar>
              </IconButton>
            </Box>
          </Box>

          <Menu
            anchorEl={notifAnchor}
            open={Boolean(notifAnchor)}
            onClose={handleNotifClose}
            slotProps={{
              paper: {
                sx: { width: 320, maxHeight: 400 },
              }
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Notifications
              </Typography>
            </Box>
            {todayLeads.slice(0, 5).map((lead) => (
              <MenuItem key={lead.id} onClick={handleNotifClose}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    New Lead: {lead.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {lead.company} - ${lead.value.toLocaleString()}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
            {todayLeads.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No new notifications
                </Typography>
              </Box>
            )}
          </Menu>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => { navigate('/settings'); handleMenuClose(); }}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              My Profile
            </MenuItem>
            <MenuItem onClick={() => { navigate('/settings'); handleMenuClose(); }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: currentDrawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, border: 'none' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
              border: 'none',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2 },
          width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
          minHeight: '100vh',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: isDarkMode
              ? 'rgba(255, 255, 255, 0.15)'
              : `${primaryColor}30`,
            borderRadius: '10px',
            '&:hover': {
              background: isDarkMode
                ? 'rgba(255, 255, 255, 0.25)'
                : `${primaryColor}50`,
            },
          },
          '&::-webkit-scrollbar-corner': {
            background: 'transparent',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ maxWidth: '1600px', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;
