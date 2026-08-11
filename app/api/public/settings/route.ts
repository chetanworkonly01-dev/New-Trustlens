import { NextResponse } from 'next/server';
import { isSignupAllowed, userCount } from '@/lib/auth';

export async function GET() {
  try {
    const allowed = await isSignupAllowed();
    const count = await userCount();
    return NextResponse.json({ 
      isSignupAllowed: allowed,
      isFirstAdmin: count === 0,
      userCount: count
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
