import { AccessibilityIssue, AuditScore, GroupedIssue, ScoreBreakdown } from '../types/audit';
import { SEVERITY_WEIGHTS, SEVERITY_CAPS, LEVEL_MULTIPLIERS } from '../wcag/severity';

type SeverityTier = 'critical' | 'high' | 'medium' | 'low';

// Confidence multipliers — low-confidence findings are penalised less to
// avoid over-penalising detections that still need human review.
const CONF_MULT: Record<string, number> = { high: 1.0, medium: 0.8, low: 0.5 };

const EMPTY_BREAKDOWN = (): ScoreBreakdown => ({
  critical: { count: 0, rawDeduction: 0, deduction: 0, cap: SEVERITY_CAPS.critical },
  high:     { count: 0, rawDeduction: 0, deduction: 0, cap: SEVERITY_CAPS.high },
  medium:   { count: 0, rawDeduction: 0, deduction: 0, cap: SEVERITY_CAPS.medium },
  low:      { count: 0, rawDeduction: 0, deduction: 0, cap: SEVERITY_CAPS.low },
  instancePenalty: 0, frequencyPenalty: 0, totalDeduction: 0,
});

export function calculateScore(issues: AccessibilityIssue[], pageCount?: number): AuditScore {
  // Guard: crawl failed or was blocked — NOT a perfect score.
  if (issues.length === 0 && (!pageCount || pageCount === 0)) {
    return {
      overall: 0, grade: 'F',
      categoryScores: { perceivable: 0, operable: 0, understandable: 0, robust: 0, pdf: 0 },
      complianceLevel: 'non-compliant',
      totalIssues: 0, uniqueIssues: 0,
      issueBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      issueByLevel: { A: 0, AA: 0, AAA: 0 },
      testsRun: 0, testsPassed: 0, testsFailed: 0,
      scoreBreakdown: EMPTY_BREAKDOWN(),
    };
  }

  // === DETERMINISTIC GROUPING ===
  // Score and counts are per UNIQUE violation, not per DOM element.
  // "Missing alt on 20 images" = 1 unique critical violation, not 20.
  const sortedIssues = [...issues].sort((a, b) => {
    const k1 = `${a.testId}::${a.title}::${normalizeSelector(a.element)}::${a.pageUrl}`;
    const k2 = `${b.testId}::${b.title}::${normalizeSelector(b.element)}::${b.pageUrl}`;
    return k1.localeCompare(k2);
  });

  const grouped = groupIssues(sortedIssues, pageCount || 1);

  const issueBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const issueByLevel = { A: 0, AA: 0, AAA: 0 };
  const categoryIssues: Record<string, GroupedIssue[]> = {
    perceivable: [], operable: [], understandable: [], robust: [], pdf: []
  };
  const groupsBySeverity: Record<SeverityTier, GroupedIssue[]> = {
    critical: [], high: [], medium: [], low: []
  };

  for (const group of grouped) {
    issueBySeverity[group.severity]++;
    issueByLevel[group.wcagLevel]++;
    categoryIssues[group.category]?.push(group);
    groupsBySeverity[group.severity].push(group);
  }

  // === TIER-CAPPED DEDUCTION MODEL ===
  //
  // Each severity tier has a transparent maximum deduction so the score
  // remains interpretable no matter how many issues exist:
  //
  //   Critical barriers  8 pts/issue → cap 45 pts   (6+ critical → cap)
  //   High issues        3.5 pts/issue → cap 20 pts
  //   Moderate issues    1.5 pts/issue → cap 15 pts
  //   Low issues         0.4 pts/issue → cap  8 pts
  //
  // Level-A violations receive a 1.2× multiplier (more fundamental to access).
  // Low-confidence findings receive a 0.5× multiplier (awaiting human review).
  //
  // This means the score breakdown can be stated plainly in any report:
  //   "9 critical issues removed 45 of 100 points (cap reached). 4 high
  //    issues removed 14 points. Total deduction: 59 pts → Score: 41."

  const bd = EMPTY_BREAKDOWN();
  let totalDeduction = 0;

  for (const tier of ['critical', 'high', 'medium', 'low'] as SeverityTier[]) {
    const tierGroups = groupsBySeverity[tier];
    let raw = 0;
    for (const g of tierGroups) {
      const lm = LEVEL_MULTIPLIERS[g.wcagLevel] ?? 1.0;
      const cm = CONF_MULT[g.confidence] ?? 0.8;
      raw += SEVERITY_WEIGHTS[tier] * lm * cm;
    }
    const capped = Math.min(raw, SEVERITY_CAPS[tier]);
    bd[tier] = {
      count: tierGroups.length,
      rawDeduction: round1(raw),
      deduction: round1(capped),
      cap: SEVERITY_CAPS[tier],
    };
    totalDeduction += capped;
  }

  // Instance breadth penalty (max 5 pts): when the same issues each appear
  // across many DOM elements, the site has a systemic rather than isolated problem.
  const totalInstances = grouped.reduce((s, g) => s + g.occurrenceCount, 0);
  const avgOccurrences = grouped.length > 0 ? totalInstances / grouped.length : 0;
  const instancePenalty = avgOccurrences > 10
    ? Math.min(5, (avgOccurrences - 10) * 0.2)
    : 0;
  bd.instancePenalty = round1(instancePenalty);
  totalDeduction += instancePenalty;

  // Frequency penalty (max 5 pts): issues appearing across >50 % of pages
  // in a multi-page audit indicate site-wide rather than page-specific failures.
  let frequencyPenalty = 0;
  if (pageCount && pageCount > 1) {
    for (const g of grouped) {
      if (g.frequency > 50) {
        frequencyPenalty += SEVERITY_WEIGHTS[g.severity] * (g.frequency / 100) * 1.5;
      }
    }
    frequencyPenalty = Math.min(5, frequencyPenalty);
  }
  bd.frequencyPenalty = round1(frequencyPenalty);
  totalDeduction += frequencyPenalty;

  bd.totalDeduction = round1(totalDeduction);

  // Journey test score (independent channel — not folded into overall)
  const journeyIssues = issues.filter(i => i.source === 'journey-test');
  const journeyTestCount = new Set(journeyIssues.map(i => i.testId)).size;
  const journeyScore = journeyTestCount > 0 ? Math.max(0, 100 - journeyTestCount * 15) : undefined;

  // Floor at 5 so the scale never implies "zero accessibility" from issue count alone.
  const overall = Math.max(5, Math.min(100, Math.round(100 - totalDeduction)));
  const grade = overall >= 90 ? 'A' : overall >= 75 ? 'B' : overall >= 50 ? 'C' : overall >= 25 ? 'D' : 'F';

  const categoryScores = {
    perceivable:    calcCategoryScore(categoryIssues.perceivable),
    operable:       calcCategoryScore(categoryIssues.operable),
    understandable: calcCategoryScore(categoryIssues.understandable),
    robust:         calcCategoryScore(categoryIssues.robust),
    pdf:            categoryIssues.pdf.length > 0 ? calcCategoryScore(categoryIssues.pdf) : 100,
  };

  let complianceLevel: AuditScore['complianceLevel'];
  if (overall >= 90 && issueBySeverity.critical === 0) {
    complianceLevel = 'aaa-compliant';
  } else if (overall >= 75 && issueBySeverity.critical === 0) {
    complianceLevel = 'aa-compliant';
  } else if (overall >= 50) {
    complianceLevel = 'partially-compliant';
  } else {
    complianceLevel = 'non-compliant';
  }

  return {
    overall, grade,
    categoryScores,
    complianceLevel,
    totalIssues: issues.length,
    uniqueIssues: grouped.length,
    issueBySeverity,
    issueByLevel,
    journeyScore,
    scoreBreakdown: bd,
    testsRun: 0, testsPassed: 0, testsFailed: 0,
  };
}

function calcCategoryScore(groups: GroupedIssue[]): number {
  if (groups.length === 0) return 100;
  let deduction = 0;
  for (const g of groups) {
    const lm = LEVEL_MULTIPLIERS[g.wcagLevel] ?? 1.0;
    const cm = CONF_MULT[g.confidence] ?? 0.8;
    deduction += SEVERITY_WEIGHTS[g.severity] * lm * cm;
  }
  // Category scores use a gentler soft cap at 85 so individual categories
  // can still reach 0 when completely dominated by critical failures.
  const capped = Math.min(deduction, 85);
  return Math.max(0, Math.round(100 - capped));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Normalise a CSS selector so whitespace/case differences don't break deduplication.
 */
export function normalizeSelector(selector: string): string {
  return selector.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Group identical issues across pages for cleaner reporting.
 * Input MUST be pre-sorted for deterministic output.
 */
export function groupIssues(issues: AccessibilityIssue[], pageCount: number): GroupedIssue[] {
  const groups = new Map<string, GroupedIssue>();

  for (const issue of issues) {
    const key = `${issue.wcagCriterion}::${issue.title}`;

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.occurrenceCount++;
      if (!group.affectedPages.includes(issue.pageUrl)) {
        group.affectedPages.push(issue.pageUrl);
      }
      group.instances.push(issue);
      group.frequency = Math.round((group.affectedPages.length / pageCount) * 100);
    } else {
      groups.set(key, {
        issueKey: key,
        title: issue.title,
        testId: issue.testId,
        wcagCriterion: issue.wcagCriterion,
        wcagName: issue.wcagName,
        wcagLevel: issue.wcagLevel,
        severity: issue.severity,
        category: issue.category,
        description: issue.description,
        recommendation: issue.recommendation,
        codeFix: issue.codeFix,
        confidence: issue.confidence || 'medium',
        occurrenceCount: 1,
        affectedPages: [issue.pageUrl],
        frequency: Math.round((1 / pageCount) * 100),
        instances: [issue],
      });
    }
  }

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return Array.from(groups.values()).sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.frequency - a.frequency;
  });
}

export function getComplianceLabel(level: AuditScore['complianceLevel']): string {
  const labels: Record<string, string> = {
    'non-compliant':       'Non-Compliant',
    'partially-compliant': 'Partially Compliant',
    'aa-compliant':        'WCAG 2.2 AA Compliant',
    'aaa-compliant':       'WCAG 2.2 AAA Compliant'
  };
  return labels[level] || level;
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#00BA8C';
  if (score >= 75) return '#0091DA';
  if (score >= 50) return '#F0AB00';
  return '#E8002D';
}
