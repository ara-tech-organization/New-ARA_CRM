import User from '../models/User.js';
import { sendTokenResponse } from '../utils/generateToken.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Private (Admin/Superadmin only)
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, department, permissions } = req.body;

  // Check if user already exists
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
  const user = await User.create({
    name,
    email,
    password,
    role: role || 'SMM',
    permissions: userPermissions,
    phone,
    department,
  });

  // Send token response
  sendTokenResponse(user, 201, res);
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password',
    });
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated. Please contact administrator.',
    });
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  // Update last login
  await user.updateLastLogin();

  // Send token response
  sendTokenResponse(user, 200, res);
});

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not found. Please login again.',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      userID: user.userID,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      phone: user.phone,
      department: user.department,
      profileImage: user.profileImage,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    },
  });
});

/**
 * @desc    Update user details
 * @route   PUT /api/auth/update-details
 * @access  Private
 */
export const updateDetails = asyncHandler(async (req, res) => {
  // Only allow-listed fields can be updated through this endpoint —
  // role / permissions / password come through separate routes.
  // `avatar` is the new profile-photo data URL (validated on the
  // frontend to be <= ~250KB before sending).
  const fieldsToUpdate = {};
  ['name', 'email', 'phone', 'department', 'avatar'].forEach((key) => {
    if (req.body[key] !== undefined) fieldsToUpdate[key] = req.body[key];
  });

  const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Update password
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
export const updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  if (!(await user.comparePassword(req.body.currentPassword))) {
    return res.status(401).json({
      success: false,
      message: 'Password is incorrect',
    });
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});
