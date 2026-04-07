import 'server-only';

import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export interface AuthenticatedSession {
  userId: string;
  email: string | null;
  name: string | null;
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const token = (await cookies()).get('token')?.value;

  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as jwt.JwtPayload & {
      userId?: string;
      email?: string | null;
      name?: string | null;
    };

    if (!decoded.userId) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
    };
  } catch {
    return null;
  }
}
