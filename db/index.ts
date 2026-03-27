import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const rawUrl = process.env.TURSO_DATABASE_URL;
const databaseUrl = (rawUrl && rawUrl !== 'undefined') ? rawUrl : 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN === 'undefined' ? undefined : process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url: databaseUrl,
  authToken: authToken,
});

export const db = drizzle(client, { schema });
