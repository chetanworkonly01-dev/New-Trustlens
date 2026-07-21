import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoFrames } from '@/lib/engines/vision-analyzer';
import { setAudit, getAudit } from '@/lib/store/audit-store';
import type { AuditResult } from '@/lib/types/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is required for video audits' }, { status: 400 });
    }

    const body = await request.json() as {
      frames: Array<{ base64: string; mimeType: string; timestampMs: number }>;
      pillars?: string[];
      filename?: string;
    };

    if (!body.frames || body.frames.length === 0) {
      return NextResponse.json({ error: 'No frames provided. Extract frames client-side before uploading.' }, { status: 400 });
    }
    if (body.frames.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 frames per video audit' }, { status: 400 });
    }

    const enabledPillars = (body.pillars || ['accessibility', 'darkpatterns', 'performance', 'privacy']) as any[];
    const auditId = crypto.randomUUID();

    const update = (partial: Partial<AuditResult>) => {
      const current = getAudit(auditId);
      if (current) setAudit(auditId, { ...current, ...partial } as AuditResult);
    };

    const initial: AuditResult = {
      id: auditId, status: 'scanning', progress: 10,
      progressMessage: `Video audit starting — ${body.frames.length} frame(s) queued for GPT-4o analysis…`,
      config: { type: 'website' as any, enabledPillars, crawlDepth: 0, maxPages: 1, includeAI: true, wcagLevels: ['A', 'AA'] },
      pages: [], issues: [], testResults: [], testLog: [], inapplicableCriteria: [],
      score: { overall: 0, categoryScores: { perceivable: 0, operable: 0, understandable: 0, robust: 0, pdf: 0 }, complianceLevel: 'non-compliant', totalIssues: 0, uniqueIssues: 0, issueBySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, issueByLevel: { A: 0, AA: 0, AAA: 0 }, testsRun: 0, testsPassed: 0, testsFailed: 0 },
      startedAt: new Date().toISOString(),
    };
    setAudit(auditId, initial);

    (async () => {
      try {
        update({ progress: 20, progressMessage: 'GPT-4o analysing video frames across selected pillars…' });
        const result = await analyzeVideoFrames(
          body.frames, enabledPillars,
          (entry) => update({ testLog: [...(getAudit(auditId)?.testLog || []), entry] }),
        );
        const sevCount = {
          critical: result.findings.filter(f => f.severity === 'critical').length,
          high:     result.findings.filter(f => f.severity === 'high').length,
          medium:   result.findings.filter(f => f.severity === 'medium').length,
          low:      result.findings.filter(f => f.severity === 'low').length,
        };
        update({
          status: 'complete', progress: 100,
          progressMessage: `Video audit complete — ${result.findings.length} finding(s) across ${body.frames.length} frame(s)`,
          score: { overall: result.overallScore, categoryScores: { perceivable: 0, operable: 0, understandable: 0, robust: 0, pdf: 0 }, complianceLevel: result.overallScore >= 80 ? 'aa-compliant' : result.overallScore >= 50 ? 'partially-compliant' : 'non-compliant', totalIssues: result.findings.length, uniqueIssues: result.findings.length, issueBySeverity: sevCount, issueByLevel: { A: 0, AA: 0, AAA: 0 }, testsRun: enabledPillars.length * body.frames.length, testsPassed: result.overallScore >= 70 ? enabledPillars.length : 0, testsFailed: result.findings.length > 0 ? 1 : 0 },
          report: { id: auditId, auditId, testedLevel: 'Vision', executiveSummary: `GPT-4o video frame analysis: ${result.findings.length} issue(s) across ${body.frames.length} frame(s) and ${enabledPillars.length} pillar(s). ${result.confidenceNote}`, score: {} as any, issues: [], groupedIssues: [], topCritical: [], wcagMapping: [], remediationPlan: [], pageBreakdown: [], generatedAt: new Date().toISOString() } as any,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        update({ status: 'error', error: err instanceof Error ? err.message : 'Video analysis failed' });
      }
    })();

    return NextResponse.json({ auditId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to start video audit' }, { status: 500 });
  }
}
