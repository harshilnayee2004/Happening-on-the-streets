import http from 'node:http';
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
import { attachChatSocket } from './chatSocket.js';

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

function listenWithRetry(server) {
  let attempt = 0;
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 20) {
      attempt += 1;
      console.warn(`Port ${env.port} is busy, retry ${attempt}/20`);
      setTimeout(() => server.listen(env.port, env.host), 200);
      return;
    }
    console.error(`Could not start Hapstr API: ${err.message}`);
    process.exitCode = 1;
  };
  server.on('error', onError);
  server.on('listening', () => {
    console.log(`SQLite ready at ${env.databasePath}`);
    console.log(`Hapstr API listening on http://${env.host}:${env.port}`);
  });
  server.listen(env.port, env.host);
}

if (process.env.NODE_ENV !== 'test') {
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection (request not crashed):', err);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });
  const app = createApp();
  try {
    migrate();
  } catch (err) {
    console.error('Database did not open or migrate. Check DATABASE_PATH and disk permissions.');
    console.error(err);
    process.exit(1);
  }
  const server = http.createServer(app);
  attachChatSocket(server);
  listenWithRetry(server);
}
