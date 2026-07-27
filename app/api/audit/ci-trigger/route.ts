// ============================================================
// KPMG TrustLens — CI/CD Performance Gate Endpoint
// POST /api/audit/ci-trigger
//
// Runs a lightweight performance-only audit against a URL and
// compares results against caller-supplied thresholds.
// Returns HTTP 200 on pass, 422 on threshold violation.
// Designed for use in GitHub Actions / Azure DevOps pipelines.
//
// Example body:
//   { "url": "https://example.com", "thresholds": { "score": 60, "lcp": 3000 } }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { crawlWebsite } from '@/lib/engines/crawler';
import { runPerformanceAudit } from '@/lib/engines/performance-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface CIThresholds {
  score?: number;               // minimum overall score (0-100), default 50
  lcp?: number;                 // max LCP in ms, default 4000
  cls?: number;                 // max CLS score, default 0.25
  inp?: number;                 // max INP in ms, default 500
  fcp?: number;                 // max FCP in ms, default 3000
  ttfb?: number;                // max TTFB in ms, default 1800
  tbt?: number;                 // max TBT in ms, default 600
  maxCriticalIssues?: number;   // max critical issues allowed, default 0
  maxHighIssues?: number;       // max high issues allowed, default 10
}

interface ThresholdViolation {
  metric: string;
  measured: number | null;
  threshold: number;
  status: 'fail';
}

export async function POST(request: NextRequest) {
  const startMs = Date.now();
  let browser: import('playwright').Browser | undefined;

  try {
    const body = await request.json();
    const { url, thresholds = {} } = body as { url: string; thresholds?: CIThresholds };

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        {
          error: 'url is required',
          hint: 'POST { "url": "https://example.com", "thresholds": { "score": 60, "lcp": 3000 } }',
        },
        { status: 400 },
      );
    }

    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const {
      score: minScore = 50,
      lcp: maxLcp = 4000,
      cls: maxCls = 0.25,
      inp: maxInp = 500,
      fcp: maxFcp = 3000,
      ttfb: maxTtfb = 1800,
      tbt: maxTbt = 600,
      maxCriticalIssues = 0,
      maxHighIssues = 10,
    } = thresholds;

    // Lightweight crawl: 1 page, depth 1
    const crawlResult = await crawlWebsite({
      url,
      maxPages: 1,
      crawlDepth: 1,
      onProgress: () => {},
    });
    browser = crawlResult.browser;

    const result = await runPerformanceAudit(
      crawlResult.context,
      crawlResult.pages,
      () => {},   // no-op onProgress for CI
    );

    const v = result.averageVitals;
    const allIssues = result.pages.flatMap(p => p.resourceIssues);
    const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
    const highCount = allIssues.filter(i => i.severity === 'high').length;

    const violations: ThresholdViolation[] = [];

    if (result.overallScore < minScore) {
      violations.push({ metric: 'score', measured: result.overallScore, threshold: minScore, status: 'fail' });
    }
    if (v.lcp !== null && v.lcp > maxLcp) {
      violations.push({ metric: 'lcp_ms', measured: v.lcp, threshold: maxLcp, status: 'fail' });
    }
    if (v.cls !== null && v.cls > maxCls) {
      violations.push({ metric: 'cls', measured: v.cls, threshold: maxCls, status: 'fail' });
    }
    if (v.inp !== null && v.inp > maxInp) {
      violations.push({ metric: 'inp_ms', measured: v.inp, threshold: maxInp, status: 'fail' });
    }
    if (v.fcp !== null && v.fcp > maxFcp) {
      violations.push({ metric: 'fcp_ms', measured: v.fcp, threshold: maxFcp, status: 'fail' });
    }
    if (v.ttfb !== null && v.ttfb > maxTtfb) {
      violations.push({ metric: 'ttfb_ms', measured: v.ttfb, threshold: maxTtfb, status: 'fail' });
    }
    if (v.tbt !== null && v.tbt > maxTbt) {
      violations.push({ metric: 'tbt_ms', measured: v.tbt, threshold: maxTbt, status: 'fail' });
    }
    if (criticalCount > maxCriticalIssues) {
      violations.push({ metric: 'critical_issues', measured: criticalCount, threshold: maxCriticalIssues, status: 'fail' });
    }
    if (highCount > maxHighIssues) {
      violations.push({ metric: 'high_issues', measured: highCount, threshold: maxHighIssues, status: 'fail' });
    }

    const passed = violations.length === 0;
    const durationMs = Date.now() - startMs;

    return NextResponse.json(
      {
        passed,
        url,
        durationMs,
        metrics: {
          score: result.overallScore,
          lcp_ms: v.lcp,
          cls: v.cls,
          inp_ms: v.inp,
          fcp_ms: v.fcp,
          ttfb_ms: v.ttfb,
          tbt_ms: v.tbt,
          critical_issues: criticalCount,
          high_issues: highCount,
          total_issues: allIssues.length,
        },
        thresholds: {
          score: minScore,
          lcp_ms: maxLcp,
          cls: maxCls,
          inp_ms: maxInp,
          fcp_ms: maxFcp,
          ttfb_ms: maxTtfb,
          tbt_ms: maxTbt,
          max_critical_issues: maxCriticalIssues,
          max_high_issues: maxHighIssues,
        },
        violations,
        summary: passed
          ? `PASS — All thresholds met. Score: ${result.overallScore}/100.`
          : `FAIL — ${violations.length} threshold(s) violated: ${violations.map(v => v.metric).join(', ')}.`,
      },
      { status: passed ? 200 : 422 },
    );

  } catch (err) {
    console.error('[ci-trigger] Error:', err);
    return NextResponse.json(
      { error: 'Audit execution failed', detail: (err as Error).message, durationMs: Date.now() - startMs },
      { status: 500 },
    );
  } finally {
    try { await browser?.close(); } catch {}
  }
}
