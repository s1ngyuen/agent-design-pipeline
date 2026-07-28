import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Migrations run against the DIRECT (unpooled) connection string, never the
// pooled DATABASE_URL the app uses at runtime — see README.md "Why two URLs".
export default {
  schema:  './src/db/schema.ts',
  out:     './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
} satisfies Config;
