import { createClient } from "@libsql/client";

// Use environment variables with proper fallbacks
const databaseUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

// Log warnings for missing environment variables in development
if (process.env.NODE_ENV !== 'production' && !process.env.TURSO_DATABASE_URL) {
  console.warn('TURSO_DATABASE_URL is not set, falling back to local database');
}

// Create the Turso/LibSQL client
const client = createClient({
  url: databaseUrl,
  authToken: authToken,
});

export default client;
