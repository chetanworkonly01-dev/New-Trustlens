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

  // Always return full audit state so the UI can render in-progress and complete views
  return NextResponse.json({
    id: audit.id,
    status: audit.status,
    progress: audit.progress,
    progressMessage: audit.progressMessage,
    config: audit.config,
    pages: audit.pages.map(p => ({ url: p.url, title: p.title })),
    issues: audit.issues,
    score: audit.score,
    report: audit.report,
    crawlCoverage: audit.crawlCoverage,
    testResults: audit.testResults,
    testLog: audit.testLog,
    inapplicableCriteria: audit.inapplicableCriteria || [],
    startedAt: audit.startedAt,
    completedAt: audit.completedAt,
    error: audit.error,
    trustScore: audit.trustScore,
    pillarResults: audit.pillarResults,
  });
}
