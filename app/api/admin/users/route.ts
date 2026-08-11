import { NextResponse } from 'next/server';
import { getSessionFromCookiesAsync, getAllUsers, deleteNonAdminUser, updateUserRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookiesAsync(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromCookiesAsync(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId parameter is required.' }, { status: 400 });
    }

    if (!role || (role !== 'user' && role !== 'admin')) {
      return NextResponse.json({ error: 'Invalid role. Must be user or admin.' }, { status: 400 });
    }

    // Guard: Prevent active logged-in admin from demoting self
    if (userId === session.user.id && role !== 'admin') {
      return NextResponse.json({ error: 'You cannot demote your own active admin session.' }, { status: 403 });
    }

    const success = await updateUserRole(userId, role);
    if (success) {
      return NextResponse.json({ success: true, message: `Role updated to ${role}.` });
    } else {
      return NextResponse.json({ error: 'Failed to update user role in database.' }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromCookiesAsync(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID parameter (id) is required.' }, { status: 400 });
    }

    // Guard: Cannot delete self
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own active admin account.' }, { status: 403 });
    }

    const allUsers = await getAllUsers();
    const targetUser = allUsers.find((u) => u.id === userId);

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (targetUser.role === 'admin') {
      return NextResponse.json({ error: 'Admin accounts are protected and cannot be deleted.' }, { status: 403 });
    }

    const success = await deleteNonAdminUser(userId);
    if (success) {
      return NextResponse.json({ success: true, message: 'User deleted successfully.' });
    } else {
      return NextResponse.json({ error: 'Failed to delete user from database.' }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
