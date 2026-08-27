import { rm } from 'node:fs/promises';
import path from 'node:path';
import { CONFIG } from '../core/config';
import { logger } from '../core/logger';

/**
 * Wipe the local PGlite data directory. On next boot migrations re-run and the
 * demo seed repopulates. Only meaningful for the on-disk dev database.
 */
async function reset() {
  const dir = CONFIG.db.pgliteDir;
  if (!dir || dir === 'memory' || dir.startsWith('memory://')) {
    logger.warn('Database is in-memory — nothing to reset.');
    return;
  }
  const abs = path.resolve(process.cwd(), dir);
  await rm(abs, { recursive: true, force: true });
  logger.info(`Removed database directory: ${abs}`);
  logger.info('Restart the server to re-migrate and re-seed.');
}

reset().catch((err) => {
  logger.error('Reset failed', err);
  process.exit(1);
});
