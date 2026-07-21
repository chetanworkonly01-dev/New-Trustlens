// ============================================================
// KPMG TrustLens — Unified Trust Score Types
// ============================================================

import type { DarkPatternResult } from './darkpattern';
import type { PerformanceResult } from './performance';
import type { PrivacyResult } from './privacy';

// ── Audit Pillars ──
export type AuditPillar = 'accessibility' | 'darkpatterns' | 'performance' | 'privacy';

export const PILLAR_LABELS: Record<AuditPillar, string> = {
  accessibility: 'Accessibility',
  darkpatterns: 'Dark Patterns & Ethics',
  performance: 'Performance',
  privacy: 'Privacy & Compliance',
};

export const PILLAR_ICONS: Record<AuditPillar, string> = {
  accessibility: '♿',
  darkpatterns: '🕵️',
  performance: '⚡',
  privacy: '🔒',
};

export const PILLAR_COLORS: Record<AuditPillar, string> = {
  accessibility: '#0091DA',
  darkpatterns: '#9B59B6',
  performance: '#00BA8C',
  privacy: '#E67E22',
};

// ── Default Pillar Weights ──
export const DEFAULT_PILLAR_WEIGHTS: Record<AuditPillar, number> = {
  accessibility: 0.30,
  darkpatterns: 0.30,
  performance: 0.20,
  privacy: 0.20,
};

// ── Per-Pillar Score ──
export interface PillarScore {
  pillar: AuditPillar;
  score: number;            // 0-100
  weight: number;           // 0-1
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  status: 'pass' | 'warning' | 'fail';  // pass >= 80, warning >= 50, fail < 50
}

// ── Unified Trust Score ──
export interface TrustScore {
  overall: number;                                // 0-100 composite
  pillarScores: Record<AuditPillar, PillarScore>;
  weights: Record<AuditPillar, number>;
  trustLevel: TrustLevel;
  enabledPillars: AuditPillar[];
}

export type TrustLevel = 'trusted' | 'moderate' | 'at-risk' | 'critical';

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 80) return 'trusted';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'at-risk';
  return 'critical';
}

export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  trusted: 'Trusted',
  moderate: 'Moderate Risk',
  'at-risk': 'At Risk',
  critical: 'Critical Risk',
};

export const TRUST_LEVEL_COLORS: Record<TrustLevel, string> = {
  trusted: '#00BA8C',
  moderate: '#F0AB00',
  'at-risk': '#FF8533',
  critical: '#FF3356',
};

// ── Pillar Results Container ──
export interface PillarResults {
  darkpatterns?: DarkPatternResult;
  performance?: PerformanceResult;
  privacy?: PrivacyResult;
  // Accessibility uses existing AuditResult fields
}

// ── Pillar Configuration ──
export interface PillarConfig {
  enabledPillars: AuditPillar[];
  weights: Record<AuditPillar, number>;
  darkpatternOptions?: {
    aiClassification: boolean;   // Use GPT-4o for confirmshaming etc.
    journeyTests: boolean;       // Run interactive DP journey tests
  };
  performanceOptions?: {
    mobileEmulation: boolean;    // Test at mobile viewport
  };
  privacyOptions?: {
    checkTrackers: boolean;
    checkCookies: boolean;
    checkConsentBanner: boolean;
  };
}

export const DEFAULT_PILLAR_CONFIG: PillarConfig = {
  enabledPillars: ['accessibility', 'darkpatterns', 'performance', 'privacy'],
  weights: { ...DEFAULT_PILLAR_WEIGHTS },
  darkpatternOptions: { aiClassification: true, journeyTests: true },
  performanceOptions: { mobileEmulation: false },
  privacyOptions: { checkTrackers: true, checkCookies: true, checkConsentBanner: true },
};
