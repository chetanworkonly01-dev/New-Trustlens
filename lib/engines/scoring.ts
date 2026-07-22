import { AccessibilityIssue, AuditScore, GroupedIssue } from '../types/audit';
import { SEVERITY_WEIGHTS, LEVEL_MULTIPLIERS } from '../wcag/severity';

export function calculateScore(issues: AccessibilityIssue[], pageCount?: number): AuditScore {
  // Guard: if no issues AND no pages were actually crawled, this means
  // the crawl failed or was blocked — NOT a perfect score.
  if (issues.length === 0 && (!pageCount || pageCount === 0)) {
    return {
      overall: 0,
      categoryScores: { perceivable: 0, operable: 0, understandable: 0, robust: 0, pdf: 0 },
      complianceLevel: 'non-compliant',
      totalIssues: 0, uniqueIssues: 0,
      issueBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      issueByLevel: { A: 0, AA: 0, AAA: 0 },
      testsRun: 0, testsPassed: 0, testsFailed: 0
    };
  }

  // === DETERMINISTIC GROUPING ===
  // Group first so scoring and counts are per unique violation, not per DOM element.
  const sortedIssues = [...issues].sort((a, b) => {
    const k1 = `${a.testId}::${a.title}::${normalizeSelector(a.element)}::${a.pageUrl}`;
    const k2 = `${b.testId}::${b.title}::${normalizeSelector(b.element)}::${b.pageUrl}`;
    return k1.localeCompare(k2);
  });

  const grouped = groupIssues(sortedIssues, pageCount || 1);

  // Severity and level counts are per UNIQUE violation (one per group), not per instance.
  // "Touch target broken on 20 elements" is 1 high-severity violation, not 20.
  const issueBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const issueByLevel = { A: 0, AA: 0, AAA: 0 };
  const categoryIssues: Record<string, GroupedIssue[]> = {
    perceivable: [], operable: [], understandable: [], robust: [], pdf: []
  };

  for (const group of grouped) {
    issueBySeverity[group.severity]++;
    issueByLevel[group.wcagLevel]++;
    categoryIssues[group.category]?.push(group);
  }

  // === INSTANCE-AWARE SCORING ===
  // Each unique violation deducts once. A logarithmic instance multiplier
  // adds a small extra penalty when many elements are affected, but prevents
  // 20 touch-target elements from deducting 20x what 1 element would.
  // multiplier range: 1.0 (1 instance) → ~2.0 (100+ instances)
  let totalDeduction = 0;

  for (const group of grouped) {
    const sevWeight = SEVERITY_WEIGHTS[group.severity];
    const levelMult = LEVEL_MULTIPLIERS[group.wcagLevel] || 1;
    const confMult = group.confidence === 'high' ? 1.0 : group.confidence === 'medium' ? 0.7 : 0.4;
    // Log-scale instance multiplier: ln(count+1)/ln(2), capped at 2.0
    const instanceMult = Math.min(1.5, Math.log(group.occurrenceCount + 1) / Math.log(2));
    totalDeduction += sevWeight * levelMult * confMult * instanceMult;
  }

  // Frequency penalty: violations appearing across many pages of a multi-page site
  if (pageCount && pageCount > 1) {
    for (const group of grouped) {
      if (group.frequency > 50) {
        const extraPenalty = SEVERITY_WEIGHTS[group.severity] * (group.frequency / 100) * 2;
        totalDeduction += extraPenalty;
      }
    }
  }

  // Critical violation penalty (per unique critical violation, not per instance)
  if (issueBySeverity.critical > 3) {
    totalDeduction += (issueBySeverity.critical - 3) * 5;
  }

  // Journey test bonus
  const journeyIssues = issues.filter(i => i.source === 'journey-test');
  const journeyTestCount = new Set(journeyIssues.map(i => i.testId)).size;
  const journeyScore = journeyTestCount > 0 ? Math.max(0, 100 - journeyTestCount * 15) : undefined;

  // Cap deduction with logarithmic diminishing returns.
  // deduction  50 → score 50  |  100 → score 35  |  200 → score 20
  let cappedDeduction: number;
  if (totalDeduction <= 50) {
    cappedDeduction = totalDeduction;
  } else {
    const excess = totalDeduction - 50;
    cappedDeduction = 50 + 45 * (1 - Math.exp(-excess / 200));
  }

  const overall = Math.max(0, Math.round(100 - cappedDeduction));

  // Category scores based on grouped violations in each category
  const categoryScores = {
    perceivable:     calcCategoryScore(categoryIssues.perceivable),
    operable:        calcCategoryScore(categoryIssues.operable),
    understandable:  calcCategoryScore(categoryIssues.understandable),
    robust:          calcCategoryScore(categoryIssues.robust),
    pdf:             categoryIssues.pdf.length > 0 ? calcCategoryScore(categoryIssues.pdf) : 100
  };

  // Compliance level
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
    overall,
    categoryScores,
    complianceLevel,
    totalIssues: issues.length,
    uniqueIssues: grouped.length,
    issueBySeverity,
    issueByLevel,
    journeyScore,
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0
  };
}

function calcCategoryScore(groups: GroupedIssue[]): number {
  if (groups.length === 0) return 100;
  let deduction = 0;
  for (const group of groups) {
    const confMult = group.confidence === 'high' ? 1.0 : group.confidence === 'medium' ? 0.7 : 0.4;
    const instanceMult = Math.min(1.5, Math.log(group.occurrenceCount + 1) / Math.log(2));
    deduction += SEVERITY_WEIGHTS[group.severity] * (LEVEL_MULTIPLIERS[group.wcagLevel] || 1) * confMult * instanceMult;
  }
  const capped = deduction > 40 ? 40 + (deduction - 40) * 0.2 : deduction;
  return Math.max(0, Math.round(100 - capped));
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
