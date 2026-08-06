import { NextResponse } from 'next/server';
import { getSessionFromCookiesAsync, setSignupAllowed } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookiesAsync(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isSignupAllowed } = await import('@/lib/auth');
    const allowed = await isSignupAllowed();

    return NextResponse.json({ isSignupAllowed: allowed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookiesAsync(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isSignupAllowed } = body;

    if (typeof isSignupAllowed !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body. isSignupAllowed must be a boolean.' },
        { status: 400 }
      );
    }

    await setSignupAllowed(isSignupAllowed);

    return NextResponse.json({ success: true, isSignupAllowed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
