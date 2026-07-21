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

  const issueBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const issueByLevel = { A: 0, AA: 0, AAA: 0 };
  const categoryIssues: Record<string, AccessibilityIssue[]> = {
    perceivable: [], operable: [], understandable: [], robust: [], pdf: []
  };

  for (const issue of issues) {
    issueBySeverity[issue.severity]++;
    issueByLevel[issue.wcagLevel]++;
    categoryIssues[issue.category]?.push(issue);
  }

  // === DETERMINISTIC GROUPING ===
  // Sort issues before grouping so the same set of issues always produces the same groups.
  const sortedIssues = [...issues].sort((a, b) => {
    const k1 = `${a.testId}::${a.title}::${normalizeSelector(a.element)}::${a.pageUrl}`;
    const k2 = `${b.testId}::${b.title}::${normalizeSelector(b.element)}::${b.pageUrl}`;
    return k1.localeCompare(k2);
  });

  const grouped = groupIssues(sortedIssues, pageCount || 1);

  // === ADVANCED SCORING ===
  let totalDeduction = 0;

  // 1. Base deduction per issue (sorted for determinism)
  for (const issue of sortedIssues) {
    const sevWeight = SEVERITY_WEIGHTS[issue.severity];
    const levelMult = LEVEL_MULTIPLIERS[issue.wcagLevel] || 1;
    const confMult = issue.confidence === 'high' ? 1.0 : issue.confidence === 'medium' ? 0.7 : 0.4;
    totalDeduction += sevWeight * levelMult * confMult;
  }

  // 2. Frequency penalty: issues appearing across many pages are penalized more
  if (pageCount && pageCount > 1) {
    for (const group of grouped) {
      if (group.frequency > 50) {
        const extraPenalty = SEVERITY_WEIGHTS[group.severity] * (group.frequency / 100) * 2;
        totalDeduction += extraPenalty;
      }
    }
  }

  // 3. Critical issue heavy penalty
  if (issueBySeverity.critical > 3) {
    totalDeduction += (issueBySeverity.critical - 3) * 5;
  }

  // 4. Journey test bonus
  const journeyIssues = issues.filter(i => i.source === 'journey-test');
  const journeyTestCount = new Set(journeyIssues.map(i => i.testId)).size;
  const journeyScore = journeyTestCount > 0 ? Math.max(0, 100 - journeyTestCount * 15) : undefined;

  // Cap deduction with logarithmic diminishing returns.
  // This prevents scores from collapsing to 0 for heavy sites while still
  // penalizing heavily. Examples:
  //   totalDeduction  50 → capped  50 → score 50
  //   totalDeduction 100 → capped  65 → score 35
  //   totalDeduction 500 → capped  85 → score 15
  //   totalDeduction 1000→ capped  91 → score  9
  let cappedDeduction: number;
  if (totalDeduction <= 50) {
    cappedDeduction = totalDeduction;
  } else {
    // Logarithmic curve: fast climb then slows, never exceeds ~95
    const excess = totalDeduction - 50;
    cappedDeduction = 50 + 45 * (1 - Math.exp(-excess / 200));
  }

  const overall = Math.max(0, Math.round(100 - cappedDeduction));

  // Category scores
  const categoryScores = {
    perceivable:     calcCategoryScore(categoryIssues.perceivable),
    operable:        calcCategoryScore(categoryIssues.operable),
    understandable:  calcCategoryScore(categoryIssues.understandable),
    robust:          calcCategoryScore(categoryIssues.robust),
    pdf:             categoryIssues.pdf.length > 0 ? calcCategoryScore(categoryIssues.pdf) : 100
  };

  // Compliance level — based on what was tested
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

function calcCategoryScore(issues: AccessibilityIssue[]): number {
  if (issues.length === 0) return 100;
  let deduction = 0;
  for (const issue of issues) {
    const confMult = issue.confidence === 'high' ? 1.0 : issue.confidence === 'medium' ? 0.7 : 0.4;
    deduction += SEVERITY_WEIGHTS[issue.severity] * (LEVEL_MULTIPLIERS[issue.wcagLevel] || 1) * confMult;
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
