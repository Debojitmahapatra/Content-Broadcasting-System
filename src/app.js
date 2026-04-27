import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';

import logger from './utils/logger.js';
import { globalErrorHandler } from './middlewares/errorHandler.js';
import { timeoutMiddleware, haltOnTimedout } from './middlewares/timeout.js';
import AppError from './utils/AppError.js';
import swaggerSpec from './swagger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// ── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());

// ── Request timeout (30 s default) ─────────────────────────────────────────
app.use(timeoutMiddleware);

// ── HTTP request logging ────────────────────────────────────────────────────
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (msg) => logger.http(msg.trim()) },
    // Skip health-check noise in production
    skip: (req) => process.env.NODE_ENV === 'production' && req.path === '/health',
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Swagger UI ───────────────────────────────────────────────────────────────
// Relax helmet's CSP only for the /api-docs route so Swagger UI assets load
app.use(
  '/api-docs',
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'GrubPac API Docs',
    swaggerOptions: { persistAuthorization: true },
  })
);

// Serve raw OpenAPI JSON for tooling (Postman import, code-gen, etc.)
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Static uploads ──────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ──────────────────────────────────────────────────────────────────
import authRoutes from './routes/authRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import broadcastRoutes from './routes/broadcastRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/approval', approvalRoutes);
app.use('/api/broadcast', broadcastRoutes);

// ── Halt timed-out requests before 404 handler ──────────────────────────────
app.use(haltOnTimedout);

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found.`, 404));
});

// ── Global error handler ────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
