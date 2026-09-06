import './core/context'; // load Express Request augmentation (req.user, req.merchantId)
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { CONFIG } from './core/config';
import { authenticate } from './middleware/auth';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';

import { authRouter } from './modules/auth/routes';
import { identityRouter } from './modules/identity/routes';
import { merchantsRouter } from './modules/merchants/routes';
import { qrRouter } from './modules/qr/routes';
import { udhaarRouter } from './modules/udhaar/routes';
import { paymentsRouter } from './modules/payments/routes';
import { adjustmentsRouter } from './modules/adjustments/routes';
import { disputesRouter } from './modules/disputes/routes';
import { notificationsRouter } from './modules/notifications/routes';
import { remindersRouter } from './modules/collections/routes';
import { reportsRouter } from './modules/reports/routes';
import { adminRouter } from './modules/admin/routes';
import { familyRouter } from './modules/family/routes';
import { receiptsRouter } from './modules/receipts/routes';
import { settlementsRouter } from './modules/settlements/routes';
import { demoRouter } from './modules/demo/routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: CONFIG.isProd ? [CONFIG.appBaseUrl] : true,
      credentials: true,
    }),
  );

  // Capture the raw body so the payment webhook can verify the HMAC signature
  // over the EXACT bytes the gateway signed — re-serialising JSON would break it.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );

  // Attach req.user when a valid Bearer token is present (non-rejecting).
  app.use(authenticate);
  app.use('/api', apiLimiter);

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'digital-udhar', env: CONFIG.env }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'digital-udhar', env: CONFIG.env }));

  app.use('/api/auth', authRouter);
  app.use('/api/identity', identityRouter);
  app.use('/api/merchants', merchantsRouter);
  app.use('/api/qr', qrRouter);
  app.use('/api/udhaar', udhaarRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/adjustments', adjustmentsRouter);
  app.use('/api/disputes', disputesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/reminders', remindersRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/receipts', receiptsRouter);
  app.use('/api/settlements', settlementsRouter);
  app.use('/api/family', familyRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/demo', demoRouter);

  // Single-service deploy: serve the built frontend from the same origin so the
  // SPA's relative `/api` calls stay same-origin (no CORS) and there is only one
  // service to run. Only active when a build exists — in dev, Vite serves the UI,
  // so this is skipped and API behaviour is unchanged. The API/health routes above
  // take precedence; every other GET falls back to index.html for client-side
  // routing (BrowserRouter), while unknown /api paths still get a JSON 404.
  const clientDist = process.env.FRONTEND_DIST
    ? path.resolve(process.env.FRONTEND_DIST)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
