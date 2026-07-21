import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/engines/audit-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAudit(id);

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
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
