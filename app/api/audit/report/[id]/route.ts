import { NextRequest, NextResponse } from 'next/server';
import { getAuditAsync } from '@/lib/engines/audit-orchestrator';
import { getSessionFromCookiesAsync } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookiesAsync(request);
  const userId = session?.user?.id;

  const { id } = await params;
  const audit = await getAuditAsync(id);

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  if (userId && audit.config.userId && audit.config.userId !== userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (audit.status !== 'complete') {
    return NextResponse.json({ error: 'Audit not yet complete', status: audit.status }, { status: 202 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json';

  if (format === 'json') {
    return NextResponse.json(audit.report);
  }

  // Return full audit data for HTML rendering
  return NextResponse.json({
    report: audit.report,
    pages: audit.pages.map(p => ({ url: p.url, title: p.title })),
    config: audit.config
  });
}
