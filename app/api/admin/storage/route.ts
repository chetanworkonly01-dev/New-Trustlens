import { NextResponse } from 'next/server';
import { getSessionFromCookiesAsync } from '@/lib/auth';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromCookiesAsync(request);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    let usedBytes = 0;
    if (process.env.DEV_BYPASS_DB !== 'true') {
      try {
        const rows = await executeQuery<{ bytes: string }>(
          `SELECT pg_database_size(current_database()) as bytes`
        );
        if (rows.length > 0 && rows[0].bytes) {
          usedBytes = parseInt(rows[0].bytes, 10);
        }
      } catch (err) {
        console.error('[Admin Storage] Failed to fetch database size:', err);
      }
    }

    // Default limit: 512 MB (Neon Free Tier) or process.env.NEON_STORAGE_LIMIT_MB
    const limitMb = process.env.NEON_STORAGE_LIMIT_MB
      ? parseInt(process.env.NEON_STORAGE_LIMIT_MB, 10)
      : 512;
    const totalLimitBytes = limitMb * 1024 * 1024;

    const usedMb = usedBytes / (1024 * 1024);
    const formattedUsed = usedMb >= 1024
      ? `${(usedMb / 1024).toFixed(2)} GB`
      : `${usedMb.toFixed(2)} MB`;

    const formattedTotal = limitMb >= 1024
      ? `${(limitMb / 1024).toFixed(0)} GB`
      : `${limitMb} MB`;

    const usagePercent = Math.min(100, Math.max(0.1, Number(((usedBytes / totalLimitBytes) * 100).toFixed(1))));

    return NextResponse.json({
      usedBytes,
      formattedUsed,
      totalLimitBytes,
      formattedTotal,
      usagePercent,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
