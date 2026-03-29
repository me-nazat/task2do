import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { databaseConfig } from './config';
import * as schema from './schema';

if (process.env.NODE_ENV !== 'production') {
  if (databaseConfig.isValid) {
    if (databaseConfig.usingLocalFallback) {
      console.warn('⚠️ Using local SQLite fallback database');
    } else {
      console.log('✅ Connecting to Turso:', databaseConfig.url);
    }
  } else {
    console.error('❌ Database configuration is invalid:', databaseConfig.error?.message);
  }
}

function createSafeClient() {
  if (!databaseConfig.isValid) {
    // Return a proxy that throws the configuration error when any method is called
    return new Proxy({} as any, {
      get() {
        throw databaseConfig.error || new Error('Database is not configured.');
      }
    });
  }

  return createClient({
    url: databaseConfig.url,
    authToken: databaseConfig.authToken,
  });
}

export const tursoClient = createSafeClient();

export const db = databaseConfig.isValid 
  ? drizzle(tursoClient, { schema })
  : new Proxy({} as any, {
      get() {
        throw databaseConfig.error || new Error('Database is not configured.');
      }
    });
