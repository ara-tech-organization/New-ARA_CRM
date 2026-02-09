import jwt from 'jsonwebtoken';

/**
 * Generate JWT access token
 * @param {string} id - User ID
 * @returns {string} JWT token
 */
export const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

/**
 * Generate JWT refresh token
 * @param {string} id - User ID
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '90d',
  });
};

/**
 * Send token response with cookie
 * @param {object} user - User object
 * @param {number} statusCode - HTTP status code
 * @param {object} res - Express response object
 */
export const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const options = {
    expires: new Date(
      Date.now() + (process.env.COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: true,        // MUST be true on Azure (HTTPS)
    sameSite: 'none',
  };

  res
    .status(statusCode)
    .cookie('token', accessToken, options)
    .json({
      success: true,
      user: {
        _id: user._id,
        userID: user.userID,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
      accessToken,
      refreshToken,
    });
};
