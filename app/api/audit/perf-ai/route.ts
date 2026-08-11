import { NextRequest, NextResponse } from 'next/server';
import { getAuditAsync, setAuditAsync } from '@/lib/store/audit-store';
import { generateAIPerformanceReport } from '@/lib/engines/perf-ai-analyzer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const audit = await getAuditAsync(id);
    if (!audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }
    if (audit.status !== 'complete') {
      return NextResponse.json({ error: 'Audit is not yet complete' }, { status: 409 });
    }

    const perfResult = audit.pillarResults?.performance;
    if (!perfResult) {
      return NextResponse.json({ error: 'No performance data found in this audit' }, { status: 400 });
    }

    const url = audit.config?.url ?? '';
    const aiReport = await generateAIPerformanceReport(perfResult, url);

    // Attach AI report to the stored performance result
    const updatedPerfResult = { ...perfResult, aiReport };
    const updatedAudit = {
      ...audit,
      pillarResults: {
        ...audit.pillarResults,
        performance: updatedPerfResult,
      },
    };
    await setAuditAsync(id, updatedAudit);

    return NextResponse.json({ success: true, aiReport });
  } catch (err) {
    console.error('[perf-ai] Error:', err);
    return NextResponse.json({ error: 'AI analysis failed', detail: (err as Error).message }, { status: 500 });
  }
}
