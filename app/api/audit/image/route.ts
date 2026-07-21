import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/engines/vision-analyzer';
import { setAudit, getAudit } from '@/lib/store/audit-store';
import type { AuditResult } from '@/lib/types/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is required for image audits' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const pillarsRaw = formData.get('pillars') as string || 'accessibility,darkpatterns,performance,privacy';
    const enabledPillars = pillarsRaw.split(',').filter(Boolean) as any[];

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG, WebP and GIF images are supported' }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 20MB' }, { status: 400 });

    const auditId = crypto.randomUUID();
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const update = (partial: Partial<AuditResult>) => {
      const current = getAudit(auditId);
      if (current) setAudit(auditId, { ...current, ...partial } as AuditResult);
    };

    const initial: AuditResult = {
      id: auditId, status: 'scanning', progress: 10,
      progressMessage: 'Uploading image for GPT-4o vision analysis…',
      config: { type: 'website' as any, enabledPillars, crawlDepth: 0, maxPages: 1, includeAI: true, wcagLevels: ['A', 'AA'] },
      pages: [], issues: [], testResults: [], testLog: [], inapplicableCriteria: [],
      score: { overall: 0, categoryScores: { perceivable: 0, operable: 0, understandable: 0, robust: 0, pdf: 0 }, complianceLevel: 'non-compliant', totalIssues: 0, uniqueIssues: 0, issueBySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, issueByLevel: { A: 0, AA: 0, AAA: 0 }, testsRun: 0, testsPassed: 0, testsFailed: 0 },
      startedAt: new Date().toISOString(),
    };
    setAudit(auditId, initial);

    (async () => {
      try {
        update({ progress: 30, progressMessage: 'GPT-4o analysing image across selected pillars…' });
        const result = await analyzeImage(base64, file.type, enabledPillars,
          (entry) => update({ testLog: [...(getAudit(auditId)?.testLog || []), entry] })
        );
        const sevCount = {
          critical: result.findings.filter(f => f.severity === 'critical').length,
          high:     result.findings.filter(f => f.severity === 'high').length,
          medium:   result.findings.filter(f => f.severity === 'medium').length,
          low:      result.findings.filter(f => f.severity === 'low').length,
        };
        update({
          status: 'complete', progress: 100,
          progressMessage: `Image audit complete — ${result.findings.length} finding(s) detected`,
          score: { overall: result.overallScore, categoryScores: { perceivable: 0, operable: 0, understandable: 0, robust: 0, pdf: 0 }, complianceLevel: result.overallScore >= 80 ? 'aa-compliant' : result.overallScore >= 50 ? 'partially-compliant' : 'non-compliant', totalIssues: result.findings.length, uniqueIssues: result.findings.length, issueBySeverity: sevCount, issueByLevel: { A: 0, AA: 0, AAA: 0 }, testsRun: enabledPillars.length, testsPassed: result.overallScore >= 70 ? enabledPillars.length : 0, testsFailed: result.findings.length > 0 ? 1 : 0 },
          report: { id: auditId, auditId, testedLevel: 'Vision', executiveSummary: `GPT-4o vision analysis detected ${result.findings.length} issue(s) across ${enabledPillars.length} pillar(s). ${result.confidenceNote}`, score: {} as any, issues: [], groupedIssues: [], topCritical: [], wcagMapping: [], remediationPlan: [], pageBreakdown: [], generatedAt: new Date().toISOString() } as any,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        update({ status: 'error', error: err instanceof Error ? err.message : 'Vision analysis failed' });
      }
    })();

    return NextResponse.json({ auditId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to start image audit' }, { status: 500 });
  }
}
