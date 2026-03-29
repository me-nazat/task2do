import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Use environment variables with proper fallbacks
const databaseUrl = process.env.TURSO_DATABASE_URL === 'undefined' || !process.env.TURSO_DATABASE_URL
  ? 'file:local.db'
  : process.env.TURSO_DATABASE_URL;

const authToken = process.env.TURSO_AUTH_TOKEN === 'undefined'
  ? undefined
  : process.env.TURSO_AUTH_TOKEN;

// Log connection status in development
if (process.env.NODE_ENV !== 'production') {
  if (databaseUrl.startsWith('file:')) {
    console.warn('⚠️ Using local SQLite database');
  } else {
    console.log('✅ Connecting to Turso:', databaseUrl);
  }
}

// Create the Turso/LibSQL client
const client = createClient({
  url: databaseUrl,
  authToken: authToken,
});

export const db = drizzle(client, { schema });