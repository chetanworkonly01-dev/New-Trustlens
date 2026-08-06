import { NextResponse } from "next/server";
import { getAllAuditsAsync } from "@/lib/store/audit-store";
import type { AuditResult } from "@/lib/types/audit";

export const dynamic = "force-dynamic";

type PillarResults = NonNullable<AuditResult["pillarResults"]>;

export async function GET() {
  const audits = await getAllAuditsAsync();
  const summary = audits.map((a) => {
    const pillars: string[] = (a.config as { enabledPillars?: string[] }).enabledPillars || [];
    const pillarResults = a.pillarResults as PillarResults | undefined;
    const perfResult = pillarResults?.performance as unknown as Record<string, unknown> | undefined;
    const dpResult = pillarResults?.darkpatterns as unknown as Record<string, unknown> | undefined;
    const privResult = pillarResults?.privacy as unknown as Record<string, unknown> | undefined;
    const isPerfOnly = pillars.length === 1 && pillars[0] === "performance";

    // Pillar-aware display score
    const displayScore =
      isPerfOnly && (perfResult?.overallScore != null)
        ? perfResult.overallScore as number
        : (a.trustScore?.overall ?? a.score.overall);

    // Pillar-aware issue count
    const perfIssues = (perfResult?.totalResourceIssues as number) ?? 0;
    const dpIssues = ((dpResult?.findings as unknown[] | undefined) ?? []).length;
    const privIssues = ((privResult?.findings as unknown[] | undefined) ?? []).length;
    const totalIssues: number =
      pillars.length > 0 && !pillars.includes("accessibility")
        ? perfIssues + dpIssues + privIssues
        : a.score.totalIssues + perfIssues + dpIssues + privIssues;

    // Per-pillar scores for the card
    const pillarScores: Record<string, number> = {};
    if (pillars.includes("accessibility") || pillars.length === 0) {
      pillarScores.accessibility = a.score.overall;
    }
    if (pillars.includes("performance") && perfResult?.overallScore != null) {
      pillarScores.performance = perfResult.overallScore as number;
    }
    if (pillars.includes("darkpatterns") && dpResult?.ethicsScore != null) {
      pillarScores.darkpatterns = dpResult.ethicsScore as number;
    }
    if (pillars.includes("privacy") && privResult?.overallScore != null) {
      pillarScores.privacy = privResult.overallScore as number;
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
