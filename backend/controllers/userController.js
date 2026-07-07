import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private (Admin/Superadmin)
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, isActive } = req.query;

  // Build query
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { userID: { $regex: search, $options: 'i' } },
    ];
  }

  if (role) {
    query.role = role;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  // Execute query with pagination
  const users = await User.find(query)
    .select('-password')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  // Get total count
  const count = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: users.length,
    total: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: users,
  });
});

/**
 * @desc    Get single user
 * @route   GET /api/users/:id
 * @access  Private (Admin/Superadmin)
 */
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Create user
 * @route   POST /api/users
 * @access  Private (Admin/Superadmin)
 */
// Role names that the UI must NEVER be able to grant. Even though the
// role field is free-form (custom roles supported), this denylist keeps
// the top-privilege seed role off-limits to anything but a direct DB
// edit. Comparison is case-insensitive + trim so 'superadmin', ' SuperAdmin ',
// 'SUPERADMIN' all match.
const FORBIDDEN_ROLE_NAMES = new Set(['superadmin']);
const isForbiddenRole = (r) => FORBIDDEN_ROLE_NAMES.has(String(r || '').trim().toLowerCase());

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, department, permissions, team } = req.body;

  if (isForbiddenRole(role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${role}' cannot be assigned from the UI. Contact a database administrator.`,
    });
  }

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({
      success: false,
      message: 'User already exists',
    });
  }

  // Use provided permissions or default to dashboard access
  // For admin role, give all page access
  let userPermissions = permissions || ['dashboard'];
  if (role === 'admin') {
    userPermissions = [
      'dashboard',
      'daily-entry',
      'daily-lead-data',
      'leads',
      'ads-dashboard',
      'clients',
      'client-vault',
      'reports',
      'settings',
      'access-management',
    ];
  }

  // Create user
  try {
    // Team is decoupled from role now — admins can put a custom-role
    // user (e.g., "Designer") on a team. Stays an empty string when
    // the dialog didn't provide one.
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'SMM',
      permissions: userPermissions,
      phone,
      department,
      team: team || '',
    });

    // Return user without password
    const userResponse = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      data: userResponse,
    });
  } catch (error) {
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `A user with this ${field} already exists`,
      });
    }
    throw error;
  }
});

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private (Admin/Superadmin)
 */
export const updateUser = asyncHandler(async (req, res) => {
  // Same denylist as createUser — even on update we never allow
  // promotion to the privileged seed role from the UI.
  if (Object.prototype.hasOwnProperty.call(req.body, 'role') && isForbiddenRole(req.body.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.body.role}' cannot be assigned from the UI. Contact a database administrator.`,
    });
  }

  let user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Also block demoting/editing an existing superadmin from the UI —
  // an admin shouldn't be able to silently neuter the root role.
  if (String(user.role || '').toLowerCase() === 'superadmin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Only a superadmin can modify a superadmin account.',
    });
  }

  // If role is changed to admin, give all page permissions
  if (req.body.role === 'admin' && req.body.role !== user.role) {
    req.body.permissions = [
      'dashboard',
      'daily-entry',
      'daily-lead-data',
      'leads',
      'ads-dashboard',
      'clients',
      'client-vault',
      'reports',
      'settings',
      'access-management',
    ];
  }

  user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).select('-password');

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private (Superadmin only)
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Prevent deleting superadmin
  if (user.role === 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot delete superadmin user',
    });
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

/**
 * @desc    Toggle user active status
 * @route   PATCH /api/users/:id/toggle-status
 * @access  Private (Admin/Superadmin)
 */
export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  user.isActive = !user.isActive;
  await user.save();

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Change user password (by Admin)
 * @route   PATCH /api/users/:id/change-password
 * @access  Private (Admin/Superadmin)
 */
export const changeUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters',
    });
  }

  const user = await User.findById(req.params.id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: `Password changed successfully for ${user.name}`,
  });
});

/**
 * @desc    Update user permissions
 * @route   PATCH /api/users/:id/permissions
 * @access  Private (Superadmin only)
 */
export const updateUserPermissions = asyncHandler(async (req, res) => {
  const { permissions } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { permissions },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Get distinct teams from users
 * @route   GET /api/users/teams
 * @access  Private (Admin/Superadmin)
 */
export const getTeams = asyncHandler(async (req, res) => {
  const teams = await User.distinct('team', { team: { $ne: '' } });
  teams.sort();

  res.status(200).json({
    success: true,
    data: teams,
  });
});

/**
 * @desc    Get distinct roles from users. Powers the role Autocomplete
 *          on Access Management so admins see every role that's been
 *          created so far (built-ins + custom ones they typed in).
 * @route   GET /api/users/roles
 * @access  Private (Admin/Superadmin)
 */
export const getRoles = asyncHandler(async (req, res) => {
  const roles = await User.distinct('role', { role: { $nin: [null, ''] } });
  roles.sort();

  res.status(200).json({
    success: true,
    data: roles,
  });
});

/**
 * @desc    Get user stats
 * @route   GET /api/users/stats
 * @access  Private (Admin/Superadmin)
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const inactiveUsers = await User.countDocuments({ isActive: false });

  const usersByRole = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByRole,
    },
  });
});
