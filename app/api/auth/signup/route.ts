import { NextResponse } from 'next/server';
import { db } from '@/db';
import { toPublicDatabaseError } from '@/db/errors';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  const lowerEmail = email.trim().toLowerCase();
  const userId = uuidv4();

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await db.insert(users).values({
      id: userId,
      name,
      email: lowerEmail,
      password: hashedPassword,
      createdAt: new Date(),
    });

    return NextResponse.json({ message: 'User created' });
  } catch (err: any) {
    console.error('Signup error:', err);
    if (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    const error = toPublicDatabaseError(err);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
}
