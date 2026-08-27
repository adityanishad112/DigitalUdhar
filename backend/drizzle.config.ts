import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config.
 *
 * We use the PostgreSQL dialect everywhere. Migrations are generated offline
 * from the schema (`npm run db:generate`) into ./drizzle and applied at
 * startup against PGlite (embedded Postgres) via src/db/migrate.ts.
 *
 * To target a real Postgres server later, set DATABASE_URL and the same
 * migrations apply unchanged.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
