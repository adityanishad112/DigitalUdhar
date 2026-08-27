import { createApp } from './app';
import { CONFIG } from './core/config';
import { logger } from './core/logger';
import { runMigrations } from './db/migrate';
import { seed } from './db/seed';
import { startWorkers } from './workers';

async function main() {
  logger.info(`Starting Digital Udhar API (${CONFIG.env})…`);

  // 1) Ensure the schema exists (PGlite migrates in-process).
  await runMigrations();
  logger.info('Migrations applied.');

  // 2) Load demo data in dev (idempotent).
  if (CONFIG.autoSeed) {
    await seed();
  }

  // 3) Background reminder / overdue sweeper.
  startWorkers();

  // 4) Serve.
  const app = createApp();
  const server = app.listen(CONFIG.port, () => {
    logger.info(`API listening on ${CONFIG.apiBaseUrl} (port ${CONFIG.port})`);
    logger.info(`Health: ${CONFIG.apiBaseUrl}/api/health`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down…`);
    server.close(() => process.exit(0));
    // Force-exit if connections linger.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal boot error', err);
  process.exit(1);
});
