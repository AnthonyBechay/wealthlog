require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require("fs");
const path = require("path");
const morgan = require('morgan'); // Pour le logging des requêtes
const compression = require('compression'); // Pour compresser les réponses

const app = express();
const { prisma } = require('./lib/prisma');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Parse allowed origins from environment variable
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Permettre les requêtes sans origine (comme les applications mobiles)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true // Pour supporter les cookies
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false
}));

// Compression pour réduire la taille des réponses
app.use(compression());

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting: limit each IP to 1000 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === 'production' ? 1000 : 10000, // Limites plus souples en développement
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Increase payload size limit for JSON bodies (useful for larger uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create necessary upload directories
const UPLOAD_DIRS = [
  path.join(process.cwd(), "uploads", "tradeImages"),
  path.join(process.cwd(), "uploads", "realEstate"),
  path.join(process.cwd(), "uploads", "profileImages"),
  path.join(process.cwd(), "uploads", "documents"),
  path.join(process.cwd(), "uploads", "temp")
];

UPLOAD_DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static files from /uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  maxAge: NODE_ENV === 'production' ? '1d' : 0 // Cache en production seulement
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: NODE_ENV });
});

// Import routers
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const communityRouter = require('./routes/community');
const coachingRouter = require('./routes/coaching');
const accountRoutes = require('./routes/account/account.routes.js');
const transactionsRoutes = require('./routes/account/transactions.routes.js');
const generalSettingsRouter = require('./routes/settings/generalSettings.routes.js');
const tradingSettingsRouter = require('./routes/settings/tradingSettings.routes.js');
const tradeRouter = require("./routes/trade/trade.routes.js");
const tradeFilterRouter = require("./routes/trade/filter.routes.js");
const mt5syncRouter = require('./routes/trade/mt5sync.routes.js');
const dashboardRouter = require('./routes/landing/dashboard.js');
const realEstateRouter = require('./routes/realEstate');

// API versioning - tous les endpoints sous /api/v1
const apiRouter = express.Router();
// Attach routers to API
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use("/trade", tradeRouter);
apiRouter.use("/trade-filter", tradeFilterRouter);
apiRouter.use('/community', communityRouter);
apiRouter.use('/coaching', coachingRouter);
apiRouter.use('/account', accountRoutes);
apiRouter.use('/transactions', transactionsRoutes);
apiRouter.use('/settings/general', generalSettingsRouter);
apiRouter.use('/settings/trading', tradingSettingsRouter);
apiRouter.use('/mt5sync', mt5syncRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/real-estate', realEstateRouter);

// Mount the API router
app.use('/api/v1', apiRouter);
// Support for legacy endpoints (non-versioned)
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use("/trade", tradeRouter);
app.use("/tradeFilter", tradeFilterRouter);
app.use('/community', communityRouter);
app.use('/coaching', coachingRouter);
app.use('/account', accountRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/generalSettings', generalSettingsRouter);
app.use('/tradingSettings', tradingSettingsRouter);
app.use('/mt5sync', mt5syncRouter);
app.use('/dashboard', dashboardRouter);
app.use('/real-estate', realEstateRouter);

// Error handling middleware
// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  res.status(statusCode).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('Gracefully shutting down...');
  
  try {
    // Close Prisma connection
    await prisma.$disconnect();
    console.log('Database connections closed.');
    
    // Exit process
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
const server = app.listen(PORT, () => {
  console.log(`
    🚀 WealthLog API running on port ${PORT}
    Environment: ${NODE_ENV}
    Time: ${new Date().toISOString()}
  `);
});

// Export for testing
module.exports = { app, server };