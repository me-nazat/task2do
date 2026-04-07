
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log('Testing connection to:', url);
  
  if (!url || !authToken) {
    console.error('Missing credentials in .env.local');
    process.exit(1);
  }

  const client = createClient({
    url,
    authToken,
  });

  try {
    const rs = await client.execute('SELECT 1');
    console.log('Connection successful!');
    console.log(JSON.stringify(rs, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Connection failed:', err.message);
    if (err.cause) {
      console.error('Cause:', err.cause);
    }
    process.exit(1);
  }
}

testConnection();
