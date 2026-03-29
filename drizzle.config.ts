import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const databaseUrl = process.env.TURSO_DATABASE_URL === 'undefined' || !process.env.TURSO_DATABASE_URL
  ? 'file:local.db'
  : process.env.TURSO_DATABASE_URL;

const authToken = process.env.TURSO_AUTH_TOKEN === 'undefined'
  ? undefined
  : process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: databaseUrl,
    authToken: authToken,
  },
});
