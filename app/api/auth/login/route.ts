import { NextResponse } from 'next/server';
import client from '@/lib/turso';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const lowerEmail = email.trim().toLowerCase();

  try {
    const result = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [lowerEmail],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password as string);

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    (await cookies()).set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
