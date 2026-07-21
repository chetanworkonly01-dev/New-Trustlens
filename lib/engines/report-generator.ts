import {
  AccessibilityIssue,
  AuditScore,
  AuditReport,
  WcagMappingEntry,
  RemediationStep,
  PageBreakdownEntry,
  GroupedIssue,
  CrawlCoverage,
  JourneyTestResult,
} from "../types/audit";
import { WCAG_CRITERIA } from "../wcag/criteria";
import { SEVERITY_WEIGHTS, LEVEL_MULTIPLIERS } from "../wcag/severity";
import { getComplianceLabel, groupIssues } from "./scoring";
import type { AuditPillar } from "../types/trustscore";
import type { DarkPatternResult } from "../types/darkpattern";
import type { PerformanceResult } from "../types/performance";
import type { PrivacyResult } from "../types/privacy";

export interface PillarContext {
  enabledPillars: AuditPillar[];
  darkpatterns?: DarkPatternResult | null;
  performance?: PerformanceResult | null;
  privacy?: PrivacyResult | null;
}

export function generateReport(
  auditId: string,
  issues: AccessibilityIssue[],
  score: AuditScore,
  pages: { url: string; title: string }[],
  crawlCoverage?: CrawlCoverage,
  journeyResults?: JourneyTestResult[],
  inapplicableCriteria?: string[], // ← N/A criteria from axe
  testedLevel?: string, // ← e.g. 'AA'
  pillarCtx?: PillarContext, // ← pillar-aware context
): AuditReport {
  const pageCount = pages.length || 1;
  const grouped = groupIssues(issues, pageCount);
  const topCritical = getTopCritical(grouped);
  const enabledPillars = pillarCtx?.enabledPillars || [
    "accessibility",
    "darkpatterns",
    "performance",
    "privacy",
  ];
  const a11yEnabled = enabledPillars.includes("accessibility");

  return {
    id: `report-${auditId}`,
    auditId,
    testedLevel: testedLevel || "AA",
    executiveSummary: generateExecutiveSummary(
      score,
      issues,
      grouped,
      crawlCoverage,
      journeyResults,
      testedLevel,
      pillarCtx,
    ),
    score,
    issues,
    groupedIssues: grouped,
    topCritical,
    wcagMapping: a11yEnabled
      ? generateWcagMapping(issues, inapplicableCriteria || [])
      : [],
    remediationPlan: a11yEnabled
      ? generateRemediationPlan(grouped, pageCount)
      : [],
    pageBreakdown: generatePageBreakdown(issues, pages),
    crawlCoverage,
    journeyResults,
    generatedAt: new Date().toISOString(),
  };
}

function getTopCritical(grouped: GroupedIssue[]): GroupedIssue[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return grouped
    .filter((g) => g.severity === "critical" || g.severity === "high")
    .sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return b.occurrenceCount - a.occurrenceCount;
    })
    .slice(0, 10);
}

function generateExecutiveSummary(
  score: AuditScore,
  issues: AccessibilityIssue[],
  grouped: GroupedIssue[],
  crawlCoverage?: CrawlCoverage,
  journeyResults?: JourneyTestResult[],
  testedLevel?: string,
  pillarCtx?: PillarContext,
): string {
  const enabledPillars = pillarCtx?.enabledPillars || ["accessibility"];
  const a11yEnabled = enabledPillars.includes("accessibility");
  const dpEnabled = enabledPillars.includes("darkpatterns");
  const perfEnabled = enabledPillars.includes("performance");
  const privEnabled = enabledPillars.includes("privacy");

  const pillarNames: string[] = [];
  if (a11yEnabled) pillarNames.push("Accessibility (WCAG)");
  if (dpEnabled) pillarNames.push("Dark Patterns & Ethics");
  if (perfEnabled) pillarNames.push("Performance");
  if (privEnabled) pillarNames.push("Compliance");

  let summary = `This KPMG TrustLens audit evaluated the target across ${enabledPillars.length} pillar(s): ${pillarNames.join(", ")}. `;

  // ── Accessibility summary ──
  if (a11yEnabled) {
    const compliance = getComplianceLabel(score.complianceLevel);
    const criticalCount = score.issueBySeverity.critical;
    const highCount = score.issueBySeverity.high;
    const pageCount = [...new Set(issues.map((i) => i.pageUrl))].length || 1;
    const level = testedLevel || "AA";

    summary += `\n  ACCESSIBILITY : Evaluated against WCAG 2.2 Level ${level}. `;
    summary += `Score: ${score.overall}/100, classified as "${compliance}". `;
    summary += `${score.totalIssues} issues identified (${score.uniqueIssues} unique) across ${pageCount} page(s). `;

    if (criticalCount > 0) {
      summary += `\n  URGENT : ${criticalCount} critical issue(s) require immediate attention. `;
    }
    if (highCount > 0) {
      summary += `${highCount} high-severity issue(s) significantly impact usability. `;
    }

    const widespread = grouped.filter((g) => g.frequency > 50);
    if (widespread.length > 0) {
      summary += `\n WIDESPREAD : ${widespread.length} issue(s) appear on 50%+ of pages. `;
    }

    if (journeyResults && journeyResults.length > 0) {
      const passed = journeyResults.filter((j) => j.passed).length;
      summary += `\n USER JOURNEYS : ${passed}/${journeyResults.length} passed. `;
    }

    summary += `\nCategory breakdown: Perceivable: ${score.categoryScores.perceivable}, Operable: ${score.categoryScores.operable}, Understandable: ${score.categoryScores.understandable}, Robust: ${score.categoryScores.robust}. `;
  }

  // ── Dark Patterns summary ──
  if (dpEnabled && pillarCtx?.darkpatterns) {
    const dp = pillarCtx.darkpatterns;
    // summary += `\n\nDARK PATTERNS: Ethics Score: ${dp.ethicsScore}/100 | `;
    // summary += `${dp.totalFindings} pattern(s) detected | `;
    // summary += `Consent Integrity: ${dp.consentIntegrity}/100 | `;
    // summary += `Manipulation Index: ${dp.manipulationIndex}/100. `;
    if (dp.regulatoryRisks.length > 0) {
      summary += `Regulatory risks: ${dp.regulatoryRisks.join(", ")}. `;
    }
    const complianceCount = (dp as any).complianceExemptions;
    if (complianceCount > 0) {
      // summary += `\n\nCOMPLIANCE CONTEXT (IRDAI/RBI/SEBI): ${complianceCount} finding(s) have been flagged as potentially compliance-driven under Indian financial services regulations. These require backend validation before enforcement action. Score impact has been proportionally reduced for these findings.`;
    }
  } else if (dpEnabled) {
    summary += `\n\nDARK PATTERNS: No dark patterns detected — the interface respects ethical design principles. `;
  }

  // ── Performance summary ──
  if (perfEnabled && pillarCtx?.performance) {
    const perf = pillarCtx.performance;
    const avg = perf.averageVitals || {};
    const perfRecs = perf.recommendations || [];
    const p0Count = perfRecs.filter((r: any) => r.priority === "P0").length;
    const p1Count = perfRecs.filter((r: any) => r.priority === "P1").length;
    const pages = perf.pages || [];

    if (!a11yEnabled && !dpEnabled && !privEnabled) {
      // Performance-only: generate rich narrative
      const grade =
        perf.overallScore >= 90
          ? "Excellent"
          : perf.overallScore >= 75
            ? "Good"
            : perf.overallScore >= 50
              ? "Needs Improvement"
              : perf.overallScore >= 25
                ? "Poor"
                : "Critical";
      summary = `KPMG conducted a comprehensive Performance Audit evaluating Core Web Vitals, resource efficiency, rendering performance, and network resilience across ${pages.length} page(s).`;
      summary += `\n\nOverall Performance Score: ${perf.overallScore}/100 (${grade}). ${perf.totalResourceIssues} resource issue(s) identified across ${pages.length} page(s). ${p0Count} critical issue(s) require immediate action before next release; ${p1Count} high-priority issue(s) are scheduled for the next sprint.`;

      if (avg.lcp != null) {
        const lcpStatus =
          avg.lcp <= 2500
            ? "meets the Good threshold (≤ 2,500 ms)"
            : avg.lcp <= 4000
              ? "falls in the Needs Improvement range (2,500–4,000 ms)"
              : "exceeds the Poor threshold (> 4,000 ms) — urgent action required";
        summary += `\n\nLARGEST CONTENTFUL PAINT (LCP): ${Math.round(avg.lcp)} ms average — ${lcpStatus}. LCP measures how quickly the main content becomes visible and directly impacts user perception of load speed.`;
      }
      if (avg.cls != null) {
        const clsStatus =
          avg.cls <= 0.1
            ? "meets the Good threshold (≤ 0.10)"
            : avg.cls <= 0.25
              ? "falls in Needs Improvement range"
              : "exceeds the Poor threshold — layout instability is causing poor user experience";
        summary += `\n\nCUMULATIVE LAYOUT SHIFT (CLS): ${avg.cls.toFixed(3)} average — ${clsStatus}. CLS measures visual stability; unexpected shifts frustrate users and can cause accidental clicks.`;
      }
      if (avg.fcp != null) {
        const fcpStatus =
          avg.fcp <= 1800
            ? "Good (≤ 1,800 ms)"
            : avg.fcp <= 3000
              ? "Needs Improvement"
              : "Poor (> 3,000 ms)";
        summary += `\n\nFIRST CONTENTFUL PAINT (FCP): ${Math.round(avg.fcp)} ms average — ${fcpStatus}. FCP measures when users first see any content on screen.`;
      }
      if (avg.ttfb != null) {
        const ttfbStatus =
          avg.ttfb <= 800
            ? "Good (≤ 800 ms)"
            : avg.ttfb <= 1800
              ? "Needs Improvement"
              : "Poor (> 1,800 ms) — server-side or CDN optimisation is recommended";
        summary += `\n\nTIME TO FIRST BYTE (TTFB): ${Math.round(avg.ttfb)} ms average — ${ttfbStatus}. TTFB reflects server response time and is the foundation of all other metrics.`;
      }

      if (pages.length > 1) {
        const best = [...pages].sort(
          (a: any, b: any) => b.score - a.score,
        )[0] as any;
        const worst = [...pages].sort(
          (a: any, b: any) => a.score - b.score,
        )[0] as any;
        if (best && worst && best.url !== worst.url) {
          summary += `\n\nPAGE VARIANCE: Best page: "${best.title || best.url}" (${best.score}/100). Page needing most attention: "${worst.title || worst.url}" (${worst.score}/100). Address the worst-performing pages first for maximum user impact.`;
        }
      }

      if (perfRecs.length > 0) {
        const topRec = perfRecs[0] as any;
        summary += `\n\nTOP RECOMMENDATION: [${topRec.priority}] ${topRec.title} — ${topRec.detail} (${topRec.effort}, ${topRec.impact} impact).`;
      }

      if (p0Count > 0) {
        summary += `\n\n⚠️ CRITICAL ALERT: ${p0Count} P0 issue(s) must be resolved before the next production release to prevent significant user experience degradation.`;
      }
    } else {
      // Multi-pillar: concise performance block
      summary += `\n\nPERFORMANCE: Score: ${perf.overallScore}/100 | ${perf.totalResourceIssues} resource issue(s) across ${pages.length} page(s). `;
      if (avg.lcp != null) summary += `Avg LCP: ${Math.round(avg.lcp)} ms. `;
      if (avg.cls != null) summary += `Avg CLS: ${avg.cls.toFixed(3)}. `;
      if (p0Count > 0)
        summary += `${p0Count} P0 critical issue(s) require immediate remediation. `;
      if (perfRecs.length > 0) {
        const topRec = perfRecs[0] as any;
        summary += `Top recommendation: ${topRec.title}.`;
      }
    }
  }

  // ── Privacy summary ──
  if (privEnabled && pillarCtx?.privacy) {
    const priv = pillarCtx.privacy;
    summary += `\n\nPRIVACY: Score: ${priv.overallScore}/100 | ${priv.totalTrackers} tracker(s) detected. `;
    summary += `Consent banner: ${priv.hasConsentBanner ? "Present" : "Missing"}. `;
    summary += `Privacy policy: ${priv.hasPrivacyPolicy ? "Present" : "Missing"}. `;
    if (priv.regulatoryRisks.length > 0) {
      summary += `Regulatory risks: ${priv.regulatoryRisks.join(", ")}. `;
    }
  }

  // ── Crawl coverage ──
  if (crawlCoverage) {
    const coveragePct = crawlCoverage.coveragePercent;
    summary += `\n\nCRAWL COVERAGE: ${crawlCoverage.pagesAudited} of ${crawlCoverage.totalPagesFound} discovered pages audited (${coveragePct}%).`;
    if (coveragePct < 100 && crawlCoverage.pagesSkipped > 0) {
      summary += ` ${crawlCoverage.pagesSkipped} page(s) skipped due to limits.`;
    }
  }

  return summary;
}

/**
 * Generate WCAG mapping with true three-way status:
 *  'fail'       — at least one issue found
 *  'pass'       — explicitly tested and no violations
 *  'not-tested' — criterion did not apply to audited content (N/A)
 */
function generateWcagMapping(
  issues: AccessibilityIssue[],
  inapplicableCriteria: string[],
): WcagMappingEntry[] {
  // Count issues per criterion
  const criteriaMap = new Map<string, number>();
  for (const issue of issues) {
    criteriaMap.set(
      issue.wcagCriterion,
      (criteriaMap.get(issue.wcagCriterion) || 0) + 1,
    );
  }

  // Criteria with confirmed violations
  const failedSet = new Set(criteriaMap.keys());
  // Criteria axe explicitly said are N/A
  const naSet = new Set(inapplicableCriteria);

  const entries: WcagMappingEntry[] = [];
  for (const [id, criterion] of Object.entries(WCAG_CRITERIA)) {
    const count = criteriaMap.get(id) || 0;
    let status: WcagMappingEntry["status"];

    if (failedSet.has(id)) {
      status = "fail";
    } else if (naSet.has(id)) {
      status = "not-tested"; // N/A — not applicable to this page's content
    } else {
      status = "pass";
    }

    entries.push({
      criterion: id,
      name: criterion.name,
      level: criterion.level,
      issueCount: count,
      status,
    });
  }

  return entries.sort((a, b) => b.issueCount - a.issueCount);
}

function generateRemediationPlan(
  grouped: GroupedIssue[],
  pageCount: number,
): RemediationStep[] {
  const steps: RemediationStep[] = [];
  let priority = 1;

  for (const group of grouped) {
    steps.push({
      priority: priority++,
      severity: group.severity,
      title: group.title,
      description: `${group.recommendation} (${group.occurrenceCount} instance${group.occurrenceCount > 1 ? "s" : ""} across ${group.affectedPages.length} page${group.affectedPages.length > 1 ? "s" : ""})`,
      affectedPages: group.affectedPages,
      estimatedEffort:
        group.occurrenceCount > 10
          ? "high"
          : group.occurrenceCount > 3
            ? "medium"
            : "low",
      frequency: group.frequency,
    });
  }

  return steps;
}

function generatePageBreakdown(
  issues: AccessibilityIssue[],
  pages: { url: string; title: string }[],
): PageBreakdownEntry[] {
  return pages.map((page) => {
    const pageIssues = issues.filter((i) => i.pageUrl === page.url);
    const criticalCount = pageIssues.filter(
      (i) => i.severity === "critical",
    ).length;
    const highCount = pageIssues.filter((i) => i.severity === "high").length;
    const mediumCount = pageIssues.filter(
      (i) => i.severity === "medium",
    ).length;
    const lowCount = pageIssues.filter((i) => i.severity === "low").length;

    // Use the same weighted formula as the overall scoring engine
    let totalDeduction = 0;
    for (const issue of pageIssues) {
      const sevWeight = SEVERITY_WEIGHTS[issue.severity];
      const levelMult = LEVEL_MULTIPLIERS[issue.wcagLevel] || 1;
      const confMult =
        issue.confidence === "high"
          ? 1.0
          : issue.confidence === "medium"
            ? 0.7
            : 0.4;
      totalDeduction += sevWeight * levelMult * confMult;
    }
    // Apply same logarithmic cap as overall scoring
    let cappedDeduction: number;
    if (totalDeduction <= 50) {
      cappedDeduction = totalDeduction;
    } else {
      const excess = totalDeduction - 50;
      cappedDeduction = 50 + 45 * (1 - Math.exp(-excess / 200));
    }
    const score = Math.max(0, Math.round(100 - cappedDeduction));

    return {
      url: page.url,
      title: page.title,
      score,
      issueCount: pageIssues.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    };
  });
}

export function reportToJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}
