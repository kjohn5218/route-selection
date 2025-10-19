import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config();

// Import routes
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import routeRoutes from './routes/routes.js';
import employeeRoutes from './routes/employees.js';
import selectionRoutes from './routes/selections.js';
import periodRoutes from './routes/periods.js';
import assignmentRoutes from './routes/assignments.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'route-selection-api',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/selections', selectionRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Route Selection API server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;