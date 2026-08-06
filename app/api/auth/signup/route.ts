import { NextResponse } from 'next/server';
import { createUser, isSignupAllowed } from '@/lib/auth';
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
        { error: 'Sign up is currently disabled' },
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

    const user = await createUser(email, password, name, 'user');

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Auto-signin after signup
    const { createSession } = await import('@/lib/auth');
    const session = createSession({ id: user.id, email: user.email, name: user.name || undefined });

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
