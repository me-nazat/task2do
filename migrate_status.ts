import { createClient } from '@libsql/client';

const client = createClient({
  url: "libsql://task2do-mewho.aws-ap-south-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1OTU3MDcsImlkIjoiMDE5ZDJlMjQtM2MwMS03NDFhLWI3NDItOGZiMmUxNDAyOWE0IiwicmlkIjoiMGI2YWRlZjktN2EzYy00ZWYwLTg2M2MtZjAxMGNiZGQ2N2YxIn0.Iroze7CzblF6vs62RqhrqamVHZRpln7Td0tw9cpV3Dj3lljpbMZwTtWGN-hi6VuFfLxb_ySxf1CwyHiHkf5JCg",
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
