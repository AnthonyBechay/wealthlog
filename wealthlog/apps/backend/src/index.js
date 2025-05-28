// src/index.js
require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression'); // Optimized compression
const rateLimit = require('express-rate-limit');
const fs = require("fs");
const path = require("path");

const app = express();
const { prisma } = require('./lib/prisma');

const PORT = process.env.PORT || 5000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

// Parse allowed origins from environment variable if needed
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

// ✅ OPTIMIZED: Smart compression - filter out small packages to save CPU
app.use(compression({
  level: 6, // Good balance between speed and compression
  threshold: 2048, // ✅ INCREASED: Only compress responses larger than 2KB (was 1KB)
  filter: (req, res) => {
    // ✅ ADDED: Smart filtering to avoid compressing small/already compressed content
    if (req.headers['x-no-compression']) {
      return false; // Don't compress if client requests no compression
    }
    
    // Get content type
    const contentType = res.getHeader('content-type') || '';
    
    // ✅ SKIP compression for already compressed formats (saves CPU)
    if (contentType.includes('image/') || 
        contentType.includes('video/') || 
        contentType.includes('audio/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/gzip') ||
        contentType.includes('application/x-rar') ||
        contentType.includes('application/pdf')) {
      return false;
    }
    
    // ✅ ONLY compress text-based content that benefits from compression
    return contentType.includes('text/') || 
           contentType.includes('application/json') || 
           contentType.includes('application/javascript') ||
           contentType.includes('application/xml') ||
           contentType.includes('text/css');
  }
}));

// Basic cors
app.use(cors({ origin: '*' }));

// Security middleware
app.use(helmet());

// IMPROVED: Better rate limiting with proper error messages
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// IMPROVED: JSON parsing with size limits for security
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));

// Ensure upload folders exist
const uploadDirs = [
  "uploads/tradeImages",
  "uploads/realEstate",
  "uploads/documents", 
  "uploads/profileImages",
  "uploads/temp"
];

uploadDirs.forEach(dir => {
  const uploadDir = path.join(process.cwd(), dir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
});

// IMPROVED: Serve static files with caching headers for better performance
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

// ADD: Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Import your routers
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const communityRouter = require('./routes/community');
const coachingRouter = require('./routes/coaching');
const accountRoutes = require('./routes/account/account.routes.js');
const transactionsRoutes = require('./routes/account/transactions.routes.js');
const settingsRouter = require('./routes/settings/settings.js');

const tradeRouter = require("./routes/trade/trade.routes.js");
const tradeFilterRouter = require("./routes/trade/filter.routes.js");

const mt5syncRouter = require('./routes/trade/mt5sync.routes.js');

// Real Estate routes
const realEstateRouter = require('./routes/realestate/realestate.routes.js');

const dashboardRouter = require('./routes/landing/dashboard.js');

// ✅ ATTACH ROUTERS WITH PROPER PREFIXES
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use("/trade", tradeRouter);
app.use("/tradeFilter", tradeFilterRouter);
app.use('/community', communityRouter);
app.use('/coaching', coachingRouter);
app.use('/account', accountRoutes);
app.use('/transactions', transactionsRoutes);

// ✅ FIXED: Settings router with proper prefix (not root)
app.use('/settings', settingsRouter);

app.use('/mt5sync', mt5syncRouter);

// Real Estate endpoints
app.use('/real-estate', realEstateRouter);

app.use('/dashboard', dashboardRouter);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 WealthLog API running on port ${PORT}`);
  console.log(`⚡ Compression: Smart filtering enabled (2KB+ threshold)`);
  console.log(`🛡️  Security: Helmet & Rate limiting active`);
  console.log(`📊 Monitoring: Health check available at /health`);
  console.log(`🏠 Real Estate: Endpoints available at /real-estate/*`);
  console.log(`⚙️  Settings: Endpoints available at /settings/*`);
});

// IMPROVED: Better 404 handler with more info
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// IMPROVED: Better error handler with environment-aware responses
app.use((err, req, res, next) => {
  console.error('Internal server error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});