import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const result = await db.run(sql`SELECT name FROM sqlite_master WHERE type='table'`);
    console.log('Tables in database:', result.rows);
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

main();
