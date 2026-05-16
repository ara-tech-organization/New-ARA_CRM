import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import MetaSyncRun from "./models/MetaSyncRun.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import clientRoutes from "./routes/clients.js";
import dailyEntryRoutes from "./routes/dailyEntries.js";
import fundEntryRoutes from "./routes/fundEntries.js";
import fundsRoutes from "./routes/funds.js";
import dailyLeadDataRoutes from "./routes/dailyLeadData.js";
import reportRoutes from "./routes/reports.js";
import leadRoutes from "./routes/leads.js";
import vaultRoutes from "./routes/vault.js";
import personalVaultRoutes from "./routes/personalVault.js";
import contentEntryRoutes from "./routes/contentEntries.js";
import metricsRoutes from "./routes/metrics.js";
import googleAdsRoutes from "./routes/googleAds.js";
import metaRoutes from "./routes/meta.js";
import analyticsRoutes from "./routes/analytics.js";
import paymentRoutes from "./routes/payments.js";
import billingRoutes from "./routes/billing.js";
import clientPortalRoutes from "./routes/clientPortal.js";
import { startSyncScheduler } from "./sync/scheduler.js";

// Load environment variables
dotenv.config();

// Connect to database, then clean up zombie sync runs left behind by previous
// crashes/restarts before the scheduler kicks off a new run. A run is "zombie"
// if it's still flagged running but hasn't been touched in 30+ minutes — that
// means the process died before its finally-block could mark it ended.
const ZOMBIE_RUN_THRESHOLD_MS = 30 * 60 * 1000;

const cleanupOrphanedSyncRuns = async () => {
  try {
    const cutoff = new Date(Date.now() - ZOMBIE_RUN_THRESHOLD_MS);
    const result = await MetaSyncRun.updateMany(
      { status: "running", duration_ms: 0, started_at: { $lt: cutoff } },
      {
        $set: { status: "failed", ended_at: new Date() },
        $push: {
          errors: {
            stage: "startup",
            message: "orphaned by restart — marked failed at boot",
            at: new Date(),
          },
        },
      },
    );
    if (result.modifiedCount > 0) {
      console.log(
        `[server] cleaned up ${result.modifiedCount} orphaned MetaSyncRun records`,
      );
    }
  } catch (err) {
    console.error("[server] orphaned sync-run cleanup failed:", err.message);
  }
};

connectDB()
  .then(cleanupOrphanedSyncRuns)
  .then(() => startSyncScheduler())
  .catch((err) => {
    console.error("[server] boot sequence failed:", err);
    process.exit(1);
  });

const app = express();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
  }),
);

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://crm.aradiscoveries.com",
  "https://leadmatrix.discovertechnologies.co",
  "http://localhost:3000",
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
// app.use('/api/', limiter);

// Body parser middleware.
// For Meta webhook verification we need the raw request body to compute
// HMAC-SHA256 against X-Hub-Signature-256. Capture it only for that path —
// the string copy is negligible but unnecessary elsewhere.
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      if (buf?.length && req.originalUrl?.startsWith("/api/meta/webhook")) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser middleware
app.use(cookieParser());

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/daily-entries", dailyEntryRoutes);
app.use("/api/fund-entries", fundEntryRoutes);
app.use("/api/funds", fundsRoutes);
app.use("/api/daily-lead-data", dailyLeadDataRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/vault", vaultRoutes);
app.use("/api/personal-vault", personalVaultRoutes);
app.use("/api/content-entries", contentEntryRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/google-ads", googleAdsRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/client-portal", clientPortalRoutes);

// Basic route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to CRM ARA API",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
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
    API URL: ${process.env.NODE_ENV === "production" ? "https://crm.aradiscoveries.com" : `http://localhost:${PORT}`}
    ==========================================
  `);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

export default app;
