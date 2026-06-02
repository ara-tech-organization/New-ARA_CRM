import { body, param, query } from 'express-validator';

// User validation rules
export const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Role must be 2-30 characters'),
  // Free-text fields — kept permissive (we don't want to reject
  // international phone formats) but bounded so nothing absurdly
  // long ends up in the DB. Accept empty/missing.
  body('phone')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Phone must be at most 30 characters'),
  body('department')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Department must be at most 60 characters'),
  body('team')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Team must be at most 60 characters'),
  body('permissions')
    .optional()
    .isArray({ max: 30 })
    .withMessage('Permissions must be an array (max 30 entries)'),
  body('permissions.*')
    .optional()
    .isString()
    .isLength({ max: 60 })
    .withMessage('Each permission ID must be at most 60 characters'),
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('role')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Role must be 2-30 characters'),
  body('phone')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Phone must be at most 30 characters'),
  body('department')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Department must be at most 60 characters'),
  body('team')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Team must be at most 60 characters'),
];

// Client validation rules - matching main API schema
export const clientValidation = [
  body('clientName')
    .trim()
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Client name must be between 2 and 200 characters'),
  body('place').optional().trim(),
  body('organisationType').optional().trim(),
  body('address').optional().trim(),
  body('onboardDate').optional().isISO8601().withMessage('Invalid date format'),
  body('gstNumber').optional().trim(),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'suspended'])
    .withMessage('Invalid status'),
  body('accountID').optional().trim(),
  body('customerID').optional().trim(),
  body('removalReason').optional().trim(),
  body('links').optional().isArray().withMessage('Links must be an array'),
];

// Lead validation rules
export const leadValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('company').optional().trim(),
  body('source')
    .optional()
    .isIn(['meta', 'google', 'website', 'referral', 'direct', 'other'])
    .withMessage('Invalid source'),
  body('status')
    .optional()
    .isIn(['new', 'contacted', 'qualified', 'converted', 'lost'])
    .withMessage('Invalid status'),
  body('value')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Value must be a positive number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
];

// Fund Entry validation rules
export const fundEntryValidation = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Amount must be positive'),
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
];

// Daily Lead Data validation rules
export const dailyLeadDataValidation = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('metaData.formLeads')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Meta form leads must be a non-negative integer'),
  body('metaData.whatsAppLeads')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Meta WhatsApp leads must be a non-negative integer'),
  body('metaData.spend')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Meta spend must be a non-negative number'),
  body('googleData.callLeads')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Google call leads must be a non-negative integer'),
  body('googleData.websiteLeads')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Google website leads must be a non-negative integer'),
  body('googleData.spend')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Google spend must be a non-negative number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
];

// Client Vault validation rules
export const clientVaultValidation = [
  body('clientId')
    .notEmpty()
    .withMessage('Client ID is required')
    .isMongoId()
    .withMessage('Invalid client ID'),
  body('data')
    .notEmpty()
    .withMessage('Data is required')
    .isObject()
    .withMessage('Data must be an object'),
];

// ID parameter validation
export const idValidation = [
  param('id')
    .notEmpty()
    .withMessage('ID is required')
    .isMongoId()
    .withMessage('Invalid ID format'),
];

// Pagination validation
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Limit must be between 1 and 10000'),
];

// Date range validation
export const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
];
