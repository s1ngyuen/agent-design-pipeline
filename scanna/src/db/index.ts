import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Instantiated once at module scope — import this singleton everywhere.
// Uses DATABASE_URL (the pooled connection string), safe to call per request
// from serverless functions. Never use pg.Pool (node-postgres) here — it
// doesn't behave safely across serverless invocations.
let _db: Db | null = null;

export function getDb(): Db {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

export { schema };
