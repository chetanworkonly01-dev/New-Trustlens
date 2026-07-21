import { NextResponse } from 'next/server';
import { getAllAudits } from '@/lib/engines/audit-orchestrator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const audits = getAllAudits();
  const summary = audits.map(a => {
    const pillars: string[] = (a.config as any).enabledPillars || [];
    const perfResult = (a as any).pillarResults?.performance;
    const dpResult   = (a as any).pillarResults?.darkpatterns;
    const privResult = (a as any).pillarResults?.privacy;
    const isPerfOnly = pillars.length === 1 && pillars[0] === 'performance';

    // Pillar-aware display score
    const displayScore = isPerfOnly && perfResult?.overallScore != null
      ? perfResult.overallScore
      : a.trustScore?.overall ?? a.score.overall;

    // Pillar-aware issue count
    const perfIssues   = perfResult?.totalResourceIssues ?? 0;
    const dpIssues     = (dpResult?.findings ?? []).length;
    const privIssues   = (privResult?.findings ?? []).length;
    const totalIssues  = pillars.length > 0 && !pillars.includes('accessibility')
      ? perfIssues + dpIssues + privIssues
      : a.score.totalIssues + perfIssues + dpIssues + privIssues;

    // Per-pillar scores for the card
    const pillarScores: Record<string, number> = {};
    if (pillars.includes('accessibility') || pillars.length === 0) {
      pillarScores.accessibility = a.score.overall;
    }
    if (pillars.includes('performance') && perfResult?.overallScore != null) {
      pillarScores.performance = perfResult.overallScore;
    }
    if (pillars.includes('darkpatterns') && dpResult?.ethicsScore != null) {
      pillarScores.darkpatterns = dpResult.ethicsScore;
    }
    if (pillars.includes('privacy') && privResult?.overallScore != null) {
      pillarScores.privacy = privResult.overallScore;
    }

    return {
      id: a.id,
      status: a.status,
      config: {
        url: a.config.url,
        type: a.config.type,
        wcagLevels: a.config.wcagLevels,
        standard: a.config.standard,
        enabledPillars: pillars,
      },
      score: {
        overall: a.score.overall,
        complianceLevel: a.score.complianceLevel,
        totalIssues: a.score.totalIssues,
        testsRun: a.score.testsRun,
      },
      displayScore,
      totalIssues,
      pillarScores,
      trustScore: a.trustScore
        ? { overall: a.trustScore.overall, trustLevel: a.trustScore.trustLevel }
        : undefined,
      progress: a.progress,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      crawlCoverage: a.crawlCoverage
        ? {
            totalPagesFound: a.crawlCoverage.totalPagesFound,
            pagesAudited: a.crawlCoverage.pagesAudited,
            coveragePercent: a.crawlCoverage.coveragePercent,
          }
        : undefined,
    };
  });
  return NextResponse.json(summary);
}
