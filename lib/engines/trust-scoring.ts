// ============================================================
// KPMG TrustLens — Unified Trust Scoring Engine
// ============================================================

import type { AuditPillar, PillarScore, TrustScore, TrustLevel } from '../types/trustscore';
import { DEFAULT_PILLAR_WEIGHTS, getTrustLevel } from '../types/trustscore';
import type { DarkPatternResult } from '../types/darkpattern';
import type { PerformanceResult } from '../types/performance';
import type { PrivacyResult } from '../types/privacy';

interface AccessibilityScoreData {
  overall: number;
  totalIssues: number;
  uniqueIssues: number;
  issueBySeverity: Record<string, number>;
}

export function calculateTrustScore(
  accessibilityScore: AccessibilityScoreData | null,
  darkPatternResult: DarkPatternResult | null,
  performanceResult: PerformanceResult | null,
  privacyResult: PrivacyResult | null,
  enabledPillars: AuditPillar[],
  customWeights?: Partial<Record<AuditPillar, number>>
): TrustScore {
  const weights = { ...DEFAULT_PILLAR_WEIGHTS, ...customWeights };

  // Normalize weights for enabled pillars only
  const totalWeight = enabledPillars.reduce((sum, p) => sum + weights[p], 0);
  const normalizedWeights: Record<AuditPillar, number> = {} as any;
  for (const p of enabledPillars) {
    normalizedWeights[p] = totalWeight > 0 ? weights[p] / totalWeight : 0;
  }

  const pillarScores: Record<AuditPillar, PillarScore> = {} as any;

  // Accessibility pillar
  if (enabledPillars.includes('accessibility') && accessibilityScore) {
    pillarScores.accessibility = {
      pillar: 'accessibility',
      score: accessibilityScore.overall,
      weight: normalizedWeights.accessibility || 0,
      totalFindings: accessibilityScore.uniqueIssues,
      findingsBySeverity: accessibilityScore.issueBySeverity,
      status: getStatus(accessibilityScore.overall),
    };
  }

  // Dark patterns pillar
  if (enabledPillars.includes('darkpatterns') && darkPatternResult) {
    pillarScores.darkpatterns = {
      pillar: 'darkpatterns',
      score: darkPatternResult.ethicsScore,
      weight: normalizedWeights.darkpatterns || 0,
      totalFindings: darkPatternResult.totalFindings,
      findingsBySeverity: darkPatternResult.findingsBySeverity,
      status: getStatus(darkPatternResult.ethicsScore),
    };
  }

  // Performance pillar
  if (enabledPillars.includes('performance') && performanceResult) {
    pillarScores.performance = {
      pillar: 'performance',
      score: performanceResult.overallScore,
      weight: normalizedWeights.performance || 0,
      totalFindings: performanceResult.totalResourceIssues,
      findingsBySeverity: performanceResult.resourceIssuesByType as any,
      status: getStatus(performanceResult.overallScore),
    };
  }

  // Privacy pillar
  if (enabledPillars.includes('privacy') && privacyResult) {
    pillarScores.privacy = {
      pillar: 'privacy',
      score: privacyResult.overallScore,
      weight: normalizedWeights.privacy || 0,
      totalFindings: privacyResult.findings.length,
      findingsBySeverity: privacyResult.findingsBySeverity,
      status: getStatus(privacyResult.overallScore),
    };
  }

  // Calculate weighted overall score
  let overall = 0;
  for (const p of enabledPillars) {
    if (pillarScores[p]) {
      overall += pillarScores[p].score * (normalizedWeights[p] || 0);
    }
  }
  overall = Math.round(overall);

  return {
    overall,
    pillarScores,
    weights: normalizedWeights,
    trustLevel: getTrustLevel(overall),
    enabledPillars,
  };
}

function getStatus(score: number): 'pass' | 'warning' | 'fail' {
  if (score >= 80) return 'pass';
  if (score >= 50) return 'warning';
  return 'fail';
}
