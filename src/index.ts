// Main entry point for CPower dispatch server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('[STARTUP] Starting dispatch server...');
console.log('[STARTUP] Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  PWD: process.cwd()
});

const app = express();
const PORT = process.env.PORT || 3000;

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received, closing server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, closing server...');
  process.exit(0);
});

// Log all exits
process.on('exit', (code) => {
  console.log(`[EXIT] Process exiting with code: ${code}`);
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  console.log('[HEALTH] Health check requested');
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'dispatch-server',
    port: PORT,
    env: process.env.NODE_ENV
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'CPower Dispatch Automation Server',
    version: '1.0.0',
    port: PORT
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`[404] Not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
try {
  const server = app.listen(PORT, () => {
    console.log(`[SUCCESS] Dispatch server running on port ${PORT}`);
    console.log(`[SUCCESS] Health check available at http://localhost:${PORT}/health`);
  });
  
  server.on('error', (error) => {
    console.error('[SERVER ERROR]', error);
    process.exit(1);
  });
} catch (error) {
  console.error('[STARTUP ERROR]', error);
  process.exit(1);
}