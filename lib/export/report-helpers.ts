// ============================================================
// KPMG TrustLens — Shared Export Naming/Scoring Helper
// Ensures DOCX, PDF, and PPTX generators (and the Final Report
// page) all derive the same audit-specific score, badge label,
// and headline from the pillars the user actually selected —
// instead of each generator hardcoding the accessibility-only
// `audit.score`.
// ============================================================

import type { AuditResult } from '../types/audit';
import type { PerformanceResult } from '../types/performance';
import type { DarkPatternFinding, EthicalPrinciple } from '../types/darkpattern';
import { PRINCIPLE_WEIGHTS } from '../types/darkpattern';


const PILLAR_LABEL: Record<string, string> = {
  accessibility: 'Accessibility',
  darkpatterns: 'Dark Patterns',
  performance: 'Performance',
  privacy: 'Privacy',
};

const WCAG_COMPLIANCE_LABEL: Record<string, string> = {
  'non-compliant': 'Non-Compliant',
  'partially-compliant': 'Partially Compliant',
  'aa-compliant': 'WCAG AA Compliant',
  'aaa-compliant': 'WCAG AAA Compliant',
};

export interface ReportDisplayInfo {
  /** The score to show on the cover/executive summary for this specific audit */
  score: number;
  /** Small badge label, e.g. "ACCESSIBILITY SCORE" or "ACCESSIBILITY + DARK PATTERNS SCORE" */
  badgeLabel: string;
  /** Title-case label for body tables, e.g. "Accessibility Score" or "Accessibility + Dark Patterns Score" */
  scoreLabel: string;
  /** Cover page headline, e.g. "Accessibility Audit Report" or "Accessibility & Dark Patterns Audit Report" */
  headline: string;
  /** Report title without "Report" suffix — used in body copy/section titles, e.g. "Accessibility Audit" */
  reportTitle: string;
  /** Status/compliance chip text appropriate to the pillar(s) audited — WCAG compliance level for
   *  accessibility-only, Good/Needs Improvement/At Risk for a single non-a11y pillar, or the combined
   *  trustLevel (Trusted/Moderate/At Risk/Critical) for multi-pillar audits. */
  statusLabel: string;
}

/**
 * Derives the display score/label/headline for a completed audit, based on
 * exactly which pillars the user selected — never a generic bucket name.
 * Single pillar → that pillar's own score. Multi-pillar → the combined
 * `trustScore` (already correctly weighted across pillars), with the badge
 * naming every selected pillar (falls back to "TrustLens 4-Pillar" only
 * when all 4 pillars are enabled, since listing all 4 is unreadable as a label).
 */
export function getReportDisplayInfo(audit: AuditResult): ReportDisplayInfo {
  const pillars: string[] = audit.config.enabledPillars?.length
    ? audit.config.enabledPillars
    : ['accessibility'];
  const names = pillars.map((p) => PILLAR_LABEL[p] ?? p);

  if (pillars.length === 1) {
    const pillar = pillars[0];
    const perfResult = audit.pillarResults?.performance;
    const dpResult = audit.pillarResults?.darkpatterns;
    const privResult = audit.pillarResults?.privacy;
    const score =
      pillar === 'performance'
        ? (perfResult?.overallScore ?? 0)
        : pillar === 'darkpatterns'
          ? (dpResult?.ethicsScore ?? 0)
          : pillar === 'privacy'
            ? (privResult?.overallScore ?? 0)
            : audit.score.overall;
    const statusLabel =
      pillar === 'accessibility'
        ? (WCAG_COMPLIANCE_LABEL[audit.score.complianceLevel] ?? audit.score.complianceLevel)
        : score >= 75 ? 'Good' : score >= 50 ? 'Needs Improvement' : 'At Risk';
    return {
      score,
      badgeLabel: `${names[0].toUpperCase()} SCORE`,
      scoreLabel: `${names[0]} Score`,
      headline: `${names[0]} Audit Report`,
      reportTitle: `${names[0]} Audit`,
      statusLabel,
    };
  }

  const joined = pillars.length === 4 ? null : names.join(' + ');
  const score = audit.trustScore?.overall ?? audit.score.overall;
  const statusLabel = audit.trustScore
    ? audit.trustScore.trustLevel.charAt(0).toUpperCase() + audit.trustScore.trustLevel.slice(1).replace('-', ' ')
    : 'Evaluated';
  return {
    score,
    badgeLabel: joined ? `${joined.toUpperCase()} SCORE` : 'TRUSTLENS 4-PILLAR SCORE',
    scoreLabel: joined ? `${joined} Score` : 'TrustLens 4-Pillar Score',
    headline: joined ? `${names.join(' & ')} Audit Report` : 'TrustLens 4-Pillar Audit Report',
    reportTitle: joined ? `${joined} Audit` : 'TrustLens 4-Pillar Audit',
    statusLabel,
  };
}

/**
 * Formats a performance pillar's page count for narrative/table display,
 * disclosing the crawled-vs-targeted breakdown whenever the performance
 * engine added extra pages based on client-reported problem flags
 * (see `expandPagesForContext` in `lib/engines/performance-engine.ts`).
 * Without this, "8 page(s)" reads as inconsistent with a "5 pages audited"
 * crawl-coverage figure shown elsewhere in the same document.
 */
export function formatPageCount(perfResult: {
  pages: unknown[];
  basePagesAudited?: number;
  targetedPagesAudited?: number;
} | null | undefined): string {
  if (!perfResult) return '0 page(s)';
  const total = perfResult.pages.length;
  if (perfResult.targetedPagesAudited && perfResult.targetedPagesAudited > 0) {
    return `${total} page(s) (${perfResult.basePagesAudited ?? 0} crawled + ${perfResult.targetedPagesAudited} targeted)`;
  }
  return `${total} page(s)`;
}

/**
 * Creates a sanitized copy of AuditResult for export (PDF/DOCX/PPTX)
 * by removing rejected false-positive findings and recalculating scores.
 */
export function sanitizeAuditForExport(audit: AuditResult): AuditResult {
  const cleanAudit: AuditResult = JSON.parse(JSON.stringify(audit));

  const dp = cleanAudit.pillarResults?.darkpatterns;
  if (dp && Array.isArray(dp.findings)) {
    const activeFindings = (dp.findings as DarkPatternFinding[]).filter(
      (f) => !f.rejected,
    );

    dp.findings = activeFindings;
    dp.totalFindings = activeFindings.length;

    // Recalculate severity breakdown
    const findingsBySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of activeFindings) {
      findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] || 0) + 1;
    }
    dp.findingsBySeverity = findingsBySeverity;

    // Recalculate principle scores
    const allPrinciples: EthicalPrinciple[] = [
      'informed-consent',
      'symmetry-of-choice',
      'transparency',
      'user-autonomy',
      'accessibility-clarity',
    ];
    const sevWeights: Record<string, number> = { critical: 15, high: 8, medium: 3, low: 1 };
    const principleScores = {} as Record<EthicalPrinciple, number>;

    for (const p of allPrinciples) {
      const pFindings = activeFindings.filter((f) => f.principle === p);
      let deduction = 0;
      for (const f of pFindings) {
        const confidenceMult = f.confidence === 'high' ? 1 : f.confidence === 'medium' ? 0.7 : 0;
        const exemptionFactor = (f as any).complianceExemption?.scoreReductionFactor ?? 1;
        deduction += sevWeights[f.severity] * confidenceMult * exemptionFactor;
      }
      principleScores[p] = Math.max(0, Math.round(100 - deduction));
    }
    dp.principleScores = principleScores;

    let weightedSum = 0, totalWeight = 0;
    for (const p of allPrinciples) {
      const w = PRINCIPLE_WEIGHTS[p];
      weightedSum += principleScores[p] * w;
      totalWeight += w;
    }
    dp.ethicsScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;
  }

  return cleanAudit;
}


