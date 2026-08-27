import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { db, pglite, type DB } from './client';
import { logger } from '../core/logger';

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

export async function runMigrations(target: DB = db): Promise<void> {
  await migrate(target, { migrationsFolder });
}

// Allow running as a standalone script: `tsx src/db/migrate.ts`
const invokedDirectly =
  process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/db/migrate.ts');

if (invokedDirectly) {
  runMigrations()
    .then(async () => {
      logger.info('Migrations applied successfully');
      await pglite.close();
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}
