import { NextResponse } from 'next/server';
import { db } from '@/db';
import { toPublicDatabaseError } from '@/db/errors';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { ensureUserDriveFolder } from '@/lib/google-drive';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const lowerEmail = email.trim().toLowerCase();

  try {
    const result = await db.select().from(users).where(eq(users.email, lowerEmail)).limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = result[0];
    const passwordMatch = user.password ? await bcrypt.compare(password, user.password) : false;

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Extend session to 30 days for better persistence
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    (await cookies()).set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    try {
      await ensureUserDriveFolder({
        userId: user.id,
        name: user.name,
        email: user.email,
      });
    } catch (driveError) {
      console.error('Login Drive folder sync failed', {
        userId: user.id,
        email: user.email,
        error: driveError,
      });
    }

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err: any) {
    console.error('Login error:', err);
    const error = toPublicDatabaseError(err);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
}
