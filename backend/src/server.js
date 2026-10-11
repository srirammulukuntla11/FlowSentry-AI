import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRoutes from './routes/health.routes.js';
import scanRoutes from './routes/scan.routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));

// Route mounting
app.use('/api', healthRoutes);
app.use('/api', scanRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`
    }
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Error] ${err.message}`, err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected server error occurred' 
        : err.message
    }
  });
});

// Start server only when executed directly as main module
let server;
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  server = app.listen(PORT, () => {
    console.log(`[FlowSentry API] Server running on http://localhost:${PORT}`);
    console.log(`[FlowSentry API] Health check at http://localhost:${PORT}/api/health`);
  });
}

export { app, server };
export default app;
