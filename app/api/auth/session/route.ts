import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function GET(request: Request) {
  const cookies = request.headers.get('cookie');
  const tokenMatch = cookies?.match(/auth-token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : undefined;

  const user = await verifySession(token);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
}
