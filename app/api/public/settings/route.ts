import { NextResponse } from 'next/server';
import { isSignupAllowed } from '@/lib/auth';

export async function GET() {
  try {
    const allowed = await isSignupAllowed();
    return NextResponse.json({ isSignupAllowed: allowed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
