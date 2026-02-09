import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import dailyEntryRoutes from './routes/dailyEntries.js';
import fundEntryRoutes from './routes/fundEntries.js';
import fundsRoutes from './routes/funds.js';
import dailyLeadDataRoutes from './routes/dailyLeadData.js';
import reportRoutes from './routes/reports.js';
import leadRoutes from './routes/leads.js';
import vaultRoutes from './routes/vault.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/daily-entries', dailyEntryRoutes);
app.use('/api/fund-entries', fundEntryRoutes);
app.use('/api/funds', fundsRoutes);
app.use('/api/daily-lead-data', dailyLeadDataRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/vault', vaultRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to CRM ARA API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Handle 404 routes
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
    ==========================================
    Server is running in ${process.env.NODE_ENV} mode
    Port: ${PORT}
    API URL: http://localhost:${PORT}
    ==========================================
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

export default app;
