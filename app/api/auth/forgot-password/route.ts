import { NextResponse } from 'next/server';
import { generateResetToken } from '@/lib/auth';
import { z } from 'zod';

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = forgotSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { email } = result.data;

    const token = await generateResetToken(email);

    if (!token) {
      // Don't reveal whether user exists
      return NextResponse.json(
        { message: 'If an account exists with that email, a reset link has been sent.' },
        { status: 200 }
      );
    }

    // In development, return the token directly for testing
    // In production, send via email service
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth] Reset token for ${email}: ${token}`);
      return NextResponse.json({
        message: 'Reset token generated (development mode - check console)',
        resetToken: token, // Only in dev
      });
    }

    // TODO: Send email with reset link
    // await sendResetEmail(email, token);

    return NextResponse.json(
      { message: 'If an account exists with that email, a reset link has been sent.' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
