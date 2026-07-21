import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/engines/audit-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAudit(id);

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
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
