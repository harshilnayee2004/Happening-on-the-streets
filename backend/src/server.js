import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authMiddleware } from './middleware/auth.js';
import { rlsMiddleware } from './middleware/rls.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import buyerRoutes from './routes/buyer.routes.js';
import realtorRoutes from './routes/realtor.routes.js';
import referralRoutes from './routes/referral.routes.js';
import { migrate } from './services/dataAccess.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: env.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Token'],
  }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(authMiddleware);
  app.use(rlsMiddleware);
  app.use('/api/auth', authRoutes);
  app.use('/api/buyer', buyerRoutes);
  app.use('/api/realtor', realtorRoutes);
  app.use('/api/referral', referralRoutes);
  app.use(errorHandler);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  migrate();
  app.listen(env.port, '127.0.0.1', () => {
    console.log(`Hapstr API listening on http://127.0.0.1:${env.port}`);
  });
}
