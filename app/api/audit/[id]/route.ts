import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/engines/audit-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAudit(id);

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  // Base response — always safe to serialize
  const response: Record<string, unknown> = {
    id: audit.id,
    config: audit.config,
    status: audit.status,
    progress: audit.progress,
    progressMessage: audit.progressMessage,
    pages: audit.pages.map(p => ({ url: p.url, title: p.title, timestamp: p.timestamp })),
    issues: audit.issues,
    score: audit.score,
    crawlCoverage: audit.crawlCoverage,
    testResults: audit.testResults || [],
    testLog: audit.testLog || [],
    inapplicableCriteria: audit.inapplicableCriteria || [],
    startedAt: audit.startedAt,
    completedAt: audit.completedAt,
    error: audit.error,
  };

  // Only include heavy report/pillar data when audit is complete
  if (audit.status === 'complete') {
    response.report = audit.report;
    response.trustScore = audit.trustScore || undefined;
    response.pillarResults = audit.pillarResults || undefined;
  } else {
    // During in-progress, include a lightweight report stub if available
    response.report = audit.report ? {
      executiveSummary: audit.report.executiveSummary,
      testedLevel: audit.report.testedLevel,
    } : undefined;
  }

  return NextResponse.json(response);
}
