import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { databaseConfig } from './config';
import * as schema from './schema';

if (process.env.NODE_ENV !== 'production') {
  if (databaseConfig.usingLocalFallback) {
    console.warn('⚠️ Using local SQLite fallback database');
  } else {
    console.log('✅ Connecting to Turso:', databaseConfig.url);
  }
}

export const tursoClient = createClient({
  url: databaseConfig.url,
  authToken: databaseConfig.authToken,
});

export const db = drizzle(tursoClient, { schema });
