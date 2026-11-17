// ============================================================
// KPMG TrustLens — Consolidated Audit Merging Engine
// Combines multiple individual pillar/run audits for the same
// domain into a single unified AuditResult for report generation.
//
// Merge Sequence:
// 1. Accessibility (WCAG 1, WCAG 2, ...)
// 2. Dark Patterns & Ethics (DP 1, DP 2, ...)
// 3. Web Performance (Perf 1, Perf 2, ...)
// 4. Privacy & Compliance (Priv 1, Priv 2, ...)
// ============================================================

import {
  AuditResult,
  AccessibilityIssue,
  PageData,
  AuditScore,
  CrawlCoverage,
} from "../types/audit";
import {
  AuditPillar,
  TrustScore,
  DEFAULT_PILLAR_WEIGHTS,
} from "../types/trustscore";
import { calculateTrustScore } from "../engines/trust-scoring";
import { generateReport } from "../engines/report-generator";
import { extractDomain } from "../engines/dark-pattern-learning";
import type { DarkPatternFinding, DarkPatternResult } from "../types/darkpattern";
import type { PerformanceResult } from "../types/performance";
import type { PrivacyResult } from "../types/privacy";

/** Pillar sort priority */
const PILLAR_PRIORITY: Record<string, number> = {
  accessibility: 1,
  darkpatterns: 2,
  performance: 3,
  privacy: 4,
};

export interface ConsolidationMetadata {
  domain: string;
  sourceAuditCount: number;
  pillarBreakdown: {
    accessibilityCount: number;
    darkpatternsCount: number;
    performanceCount: number;
    privacyCount: number;
  };
  auditManifest: {
    id: string;
    pillars: string[];
    date: string;
    url: string;
    score: number;
  }[];
}

/**
 * Consolidates multiple AuditResult objects into a single cohesive AuditResult.
 */
export function consolidateAudits(sourceAudits: AuditResult[]): AuditResult {
  if (!sourceAudits || sourceAudits.length === 0) {
    throw new Error("No audits provided for consolidation.");
  }

  if (sourceAudits.length === 1) {
    return sourceAudits[0];
  }

  // 1. Sort audits according to required pillar priority and chronological run sequence
  // Order: WCAG (run 1, run 2...) -> Dark Pattern (run 1, run 2...) -> Performance -> Privacy
  const sortedAudits = [...sourceAudits].sort((a, b) => {
    const pA = getPrimaryPillar(a);
    const pB = getPrimaryPillar(b);
    const prioA = PILLAR_PRIORITY[pA] || 99;
    const prioB = PILLAR_PRIORITY[pB] || 99;

    if (prioA !== prioB) {
      return prioA - prioB;
    }
    // Same pillar: order chronologically (WCAG 1, WCAG 2...)
    return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
  });

  // Extract common target domain and URL
  const primaryUrl = sortedAudits[0].config?.url || "https://example.com";
  const domain = extractDomain(primaryUrl);

  // 2. Discover all enabled pillars across the audits
  const enabledPillarsSet = new Set<AuditPillar>();
  sortedAudits.forEach((audit) => {
    const pillars = (audit.config?.enabledPillars as AuditPillar[]) || [
      "accessibility",
    ];
    pillars.forEach((p) => {
      if (["accessibility", "darkpatterns", "performance", "privacy"].includes(p)) {
        enabledPillarsSet.add(p);
      }
    });
  });

  const enabledPillars: AuditPillar[] = Array.from(enabledPillarsSet).sort(
    (a, b) => (PILLAR_PRIORITY[a] || 99) - (PILLAR_PRIORITY[b] || 99)
  );

  // 3. Merge Pages and Crawl Coverage
  const pageMap = new Map<string, PageData>();
  sortedAudits.forEach((audit) => {
    (audit.pages || []).forEach((page) => {
      if (!pageMap.has(page.url)) {
        pageMap.set(page.url, page);
      }
    });
  });
  const mergedPages = Array.from(pageMap.values());

  const totalPagesAudited = Math.max(
    mergedPages.length,
    ...sortedAudits.map((a) => a.crawlCoverage?.pagesAudited || 0)
  );
  const totalPagesFound = Math.max(
    totalPagesAudited,
    ...sortedAudits.map((a) => a.crawlCoverage?.totalPagesFound || 0)
  );

  const mergedCoverage: CrawlCoverage = {
    totalPagesFound,
    pagesAudited: totalPagesAudited,
    pagesSkipped: 0,
    coveragePercent: totalPagesFound > 0 ? Math.round((totalPagesAudited / totalPagesFound) * 100) : 100,
    skippedPages: [],
    discoveryMethods: { direct: totalPagesAudited },
  };

  // 4. Merge Accessibility Issues (WCAG 1, WCAG 2...)
  const mergedIssues: AccessibilityIssue[] = [];
  const issueKeySet = new Set<string>();

  sortedAudits.forEach((audit, auditIdx) => {
    const isA11y = (audit.config?.enabledPillars || []).includes("accessibility") || !audit.config?.enabledPillars?.length;
    if (isA11y && Array.isArray(audit.issues)) {
      audit.issues.forEach((issue) => {
        // Tag issue to preserve distinct occurrence per audit run
        const uniqueKey = `${issue.id || issue.testId}-${issue.pageUrl}-${issue.element?.substring(0, 30)}`;
        if (!issueKeySet.has(uniqueKey)) {
          issueKeySet.add(uniqueKey);
          mergedIssues.push({
            ...issue,
            id: issue.id || `a11y-issue-${auditIdx}-${mergedIssues.length + 1}`,
          });
        }
      });
    }
  });

  // Calculate Accessibility Score totals
  const a11yAudits = sortedAudits.filter((a) =>
    (a.config?.enabledPillars || []).includes("accessibility") || !a.config?.enabledPillars?.length
  );

  let mergedA11yOverall = 0;
  if (a11yAudits.length > 0) {
    const totalA11y = a11yAudits.reduce((acc, a) => acc + (a.score?.overall ?? 0), 0);
    mergedA11yOverall = Math.round(totalA11y / a11yAudits.length);
  }

  const issueBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const issueByLevel = { A: 0, AA: 0, AAA: 0 };

  mergedIssues.forEach((issue) => {
    if (issue.severity && issueBySeverity[issue.severity] !== undefined) {
      issueBySeverity[issue.severity]++;
    }
    if (issue.wcagLevel && issueByLevel[issue.wcagLevel] !== undefined) {
      issueByLevel[issue.wcagLevel]++;
    }
  });

  const mergedA11yScore: AuditScore = {
    overall: mergedA11yOverall,
    categoryScores: {
      perceivable: mergedA11yOverall,
      operable: mergedA11yOverall,
      understandable: mergedA11yOverall,
      robust: mergedA11yOverall,
      pdf: 0,
    },
    complianceLevel:
      mergedA11yOverall >= 80
        ? "aa-compliant"
        : mergedA11yOverall >= 50
        ? "partially-compliant"
        : "non-compliant",
    totalIssues: mergedIssues.length,
    uniqueIssues: mergedIssues.length,
    issueBySeverity,
    issueByLevel,
    testsRun: a11yAudits.reduce((acc, a) => acc + (a.score?.testsRun || 0), 0) || mergedIssues.length * 2,
    testsPassed: a11yAudits.reduce((acc, a) => acc + (a.score?.testsPassed || 0), 0),
    testsFailed: mergedIssues.length,
  };

  // 5. Merge Dark Patterns
  let mergedDarkPatternResult: DarkPatternResult | null = null;
  const dpAudits = sortedAudits.filter(
    (a) => a.pillarResults?.darkpatterns || (a.config?.enabledPillars || []).includes("darkpatterns")
  );

  if (dpAudits.length > 0) {
    const allFindings: DarkPatternFinding[] = [];
    const dpFindingsSeen = new Set<string>();

    dpAudits.forEach((audit) => {
      const dp = audit.pillarResults?.darkpatterns;
      if (dp?.findings) {
        dp.findings.forEach((f) => {
          const key = `${f.ruleId}-${f.element?.substring(0, 30)}-${f.title}`;
          if (!dpFindingsSeen.has(key)) {
            dpFindingsSeen.add(key);
            allFindings.push(f);
          }
        });
      }
    });

    const totalEthics = dpAudits.reduce(
      (acc, a) => acc + (a.pillarResults?.darkpatterns?.ethicsScore ?? 100),
      0
    );
    const avgEthics = Math.round(totalEthics / dpAudits.length);

    mergedDarkPatternResult = {
      ethicsScore: avgEthics,
      totalFindings: allFindings.length,
      findings: allFindings,
      findingsBySeverity: {
        critical: allFindings.filter((f) => f.severity === "critical").length,
        high: allFindings.filter((f) => f.severity === "high").length,
        medium: allFindings.filter((f) => f.severity === "medium").length,
        low: allFindings.filter((f) => f.severity === "low").length,
      },
      principleScores: dpAudits[0]?.pillarResults?.darkpatterns?.principleScores || ({} as any),
      categoryBreakdown: dpAudits[0]?.pillarResults?.darkpatterns?.categoryBreakdown || ({} as any),
      consentIntegrity: dpAudits[0]?.pillarResults?.darkpatterns?.consentIntegrity ?? 100,
      choiceSymmetry: dpAudits[0]?.pillarResults?.darkpatterns?.choiceSymmetry ?? 100,
      manipulationIndex: dpAudits[0]?.pillarResults?.darkpatterns?.manipulationIndex ?? 0,
      pagesScanned: Math.max(...dpAudits.map((a) => a.pillarResults?.darkpatterns?.pagesScanned || 1)),
      regulatoryRisks: Array.from(new Set(dpAudits.flatMap((a) => a.pillarResults?.darkpatterns?.regulatoryRisks || []))),
    };
  }

  // 6. Merge Web Performance
  let mergedPerformanceResult: PerformanceResult | null = null;
  const perfAudits = sortedAudits.filter(
    (a) => a.pillarResults?.performance || (a.config?.enabledPillars || []).includes("performance")
  );

  if (perfAudits.length > 0) {
    const latestPerf = perfAudits[perfAudits.length - 1].pillarResults?.performance;
    const avgPerfScore = Math.round(
      perfAudits.reduce((acc, a) => acc + (a.pillarResults?.performance?.overallScore ?? 75), 0) /
        perfAudits.length
    );

    if (latestPerf) {
      mergedPerformanceResult = {
        ...latestPerf,
        overallScore: avgPerfScore,
      };
    }
  }

  // 7. Merge Privacy
  let mergedPrivacyResult: PrivacyResult | null = null;
  const privAudits = sortedAudits.filter(
    (a) => a.pillarResults?.privacy || (a.config?.enabledPillars || []).includes("privacy")
  );

  if (privAudits.length > 0) {
    const latestPriv = privAudits[privAudits.length - 1].pillarResults?.privacy;
    const avgPrivScore = Math.round(
      privAudits.reduce((acc, a) => acc + (a.pillarResults?.privacy?.overallScore ?? 80), 0) /
        privAudits.length
    );

    if (latestPriv) {
      mergedPrivacyResult = {
        ...latestPriv,
        overallScore: avgPrivScore,
      };
    }
  }

  // 8. Calculate Consolidated TrustScore
  const trustScore: TrustScore = calculateTrustScore(
    enabledPillars.includes("accessibility")
      ? {
          overall: mergedA11yScore.overall,
          totalIssues: mergedA11yScore.totalIssues,
          uniqueIssues: mergedA11yScore.uniqueIssues,
          issueBySeverity: mergedA11yScore.issueBySeverity,
        }
      : null,
    mergedDarkPatternResult,
    mergedPerformanceResult,
    mergedPrivacyResult,
    enabledPillars
  );

  // 9. Generate Synthesis Report
  const dates = sortedAudits.map((a) => new Date(a.startedAt).toLocaleDateString());
  const auditManifest = sortedAudits.map((a) => ({
    id: a.id,
    pillars: (a.config?.enabledPillars as string[]) || ["accessibility"],
    date: new Date(a.startedAt).toLocaleDateString(),
    url: a.config?.url || primaryUrl,
    score: a.trustScore?.overall ?? a.score?.overall ?? 0,
  }));

  const executiveSummary =
    `Consolidated Digital Trust Audit for ${domain}. Merged ${sortedAudits.length} assessments across ${enabledPillars.length} active pillars (${enabledPillars.join(", ")}). ` +
    `Evaluated ${mergedPages.length} unique page(s). Total issues identified: ${mergedIssues.length} Accessibility issues, ` +
    `${mergedDarkPatternResult ? mergedDarkPatternResult.totalFindings : 0} Dark Pattern indicators. ` +
    `Audit runs spanned from ${dates[0]} to ${dates[dates.length - 1]}.`;

  const report = generateReport(
    `consolidated-${domain.replace(/[^a-zA-Z0-9]/g, "-")}`,
    mergedIssues,
    mergedA11yScore,
    mergedPages.map((p) => ({ url: p.url, title: p.title || domain })),
    mergedCoverage,
    undefined,
    undefined,
    "AA",
    {
      enabledPillars,
      trustScore,
      darkpatterns: mergedDarkPatternResult,
      performance: mergedPerformanceResult,
      privacy: mergedPrivacyResult,
    }
  );

  report.executiveSummary = executiveSummary;
  report.trustScore = trustScore;
  report.pillarResults = {
    darkpatterns: mergedDarkPatternResult || undefined,
    performance: mergedPerformanceResult || undefined,
    privacy: mergedPrivacyResult || undefined,
  };

  const consolidatedId = `consolidated-${domain.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`;

  return {
    id: consolidatedId,
    config: {
      url: primaryUrl,
      type: "website",
      crawlDepth: Math.max(...sortedAudits.map((a) => a.config?.crawlDepth || 1)),
      maxPages: mergedPages.length,
      includeAI: sortedAudits.some((a) => a.config?.includeAI),
      wcagLevels: ["A", "AA"],
      standard: sortedAudits[0]?.config?.standard || "WCAG 2.2",
      enabledPillars,
    },
    status: "complete",
    progress: 100,
    progressMessage: `Consolidated report generated for ${domain} across ${sortedAudits.length} audits.`,
    pages: mergedPages,
    issues: mergedIssues,
    score: {
      ...mergedA11yScore,
      overall: trustScore.overall,
    },
    report,
    crawlCoverage: mergedCoverage,
    testResults: sortedAudits.flatMap((a) => a.testResults || []),
    testLog: [],
    inapplicableCriteria: [],
    startedAt: sortedAudits[0].startedAt,
    completedAt: new Date().toISOString(),
    trustScore,
    pillarResults: {
      darkpatterns: mergedDarkPatternResult || undefined,
      performance: mergedPerformanceResult || undefined,
      privacy: mergedPrivacyResult || undefined,
    },
  };
}

function getPrimaryPillar(audit: AuditResult): string {
  const pillars = (audit.config?.enabledPillars as string[]) || [];
  if (pillars.includes("accessibility") || pillars.length === 0) return "accessibility";
  if (pillars.includes("darkpatterns")) return "darkpatterns";
  if (pillars.includes("performance")) return "performance";
  if (pillars.includes("privacy")) return "privacy";
  return "accessibility";
}
