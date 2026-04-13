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
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, department, permissions, team } = req.body;

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
      'clients',
      'client-vault',
      'fund-entry',
      'reports',
      'settings',
      'access-management',
    ];
  }

  // Create user
  try {
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'SMM',
      permissions: userPermissions,
      phone,
      department,
      team: role === 'SMM' ? (team || '') : '',
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
  let user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // If role is changed to admin, give all page permissions
  if (req.body.role === 'admin' && req.body.role !== user.role) {
    req.body.permissions = [
      'dashboard',
      'daily-entry',
      'daily-lead-data',
      'leads',
      'clients',
      'client-vault',
      'fund-entry',
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
