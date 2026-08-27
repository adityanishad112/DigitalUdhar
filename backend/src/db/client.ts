import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';
import { CONFIG } from '../core/config';

/** Create a PGlite instance. Empty/"memory" dir → ephemeral in-memory DB. */
export function createPglite(dataDir?: string): PGlite {
  const dir = dataDir ?? CONFIG.db.pgliteDir;
  if (!dir || dir === 'memory' || dir === 'memory://') {
    return new PGlite();
  }
  // PGlite's own mkdir is non-recursive and skips when the dir already exists,
  // so ensure the full path (incl. parents) is present first.
  mkdirSync(dir, { recursive: true });
  return new PGlite(dir);
}

const client = createPglite();

export const db = drizzle(client, { schema });
export const pglite = client;
export { schema };

export type DB = typeof db;
/** The transaction handle passed to db.transaction(async (tx) => ...). */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
