import { createClient } from "@libsql/client";

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
    console.warn('⚠️ [Turso Lib] Using local SQLite database');
  } else {
    console.log('✅ [Turso Lib] Connecting to Turso:', databaseUrl);
  }
}

// Create the Turso/LibSQL client
const client = createClient({
  url: databaseUrl,
  authToken: authToken,
});

export default client;
