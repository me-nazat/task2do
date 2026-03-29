import * as dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'todo';");
    console.log('Column status added successfully.');
  } catch (error) {
    console.error('Error adding column:', error);
  }
}

main();
