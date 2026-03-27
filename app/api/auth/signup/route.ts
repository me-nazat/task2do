import { NextResponse } from 'next/server';
import client from '@/lib/turso';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  const lowerEmail = email.toLowerCase();
  const userId = uuidv4();

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Ensure table exists
    await client.execute({
      sql: 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE)',
      args: [],
    });

    // Attempt to add columns if they don't exist
    try {
      await client.execute({ sql: 'ALTER TABLE users ADD COLUMN password TEXT', args: [] });
    } catch (err: any) {}
    try {
      await client.execute({ sql: 'ALTER TABLE users ADD COLUMN created_at INTEGER', args: [] });
    } catch (err: any) {}

    await client.execute({
      sql: 'INSERT INTO users (id, name, email, password, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [userId, name, lowerEmail, hashedPassword, Date.now()],
    });

    return NextResponse.json({ message: 'User created' });
  } catch (err: any) {
    console.error('Signup error:', err);
    if (err.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
