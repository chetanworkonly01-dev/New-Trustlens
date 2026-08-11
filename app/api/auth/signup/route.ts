import { NextResponse } from 'next/server';
import { createUser, isSignupAllowed, userCount, setSignupAllowed } from '@/lib/auth';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const allowed = await isSignupAllowed();
    if (!allowed) {
      return NextResponse.json(
        { error: 'Sign up is currently disabled by system administrator.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { email, password, name } = result.data;
    const initialCount = await userCount();

    // Create user (first user automatically receives 'admin' role)
    const user = await createUser(email, password, name, 'user');

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // If initial admin bootstrap was created, lock signups by default for subsequent users
    if (initialCount === 0) {
      await setSignupAllowed(false);
    }

    // Auto-signin after signup with role in session payload
    const { createSession } = await import('@/lib/auth');
    const session = createSession({ 
      id: user.id, 
      email: user.email, 
      name: user.name || undefined,
      role: user.role 
    });

    const response = NextResponse.json({ success: true, user });
    
    // Set auth token as httpOnly cookie
    response.cookies.set('auth-token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
