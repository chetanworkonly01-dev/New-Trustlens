// ============================================================
// KPMG TrustLens — CTA Prominence Scorer (Gap 4)
// Measures relative visual weight between competing CTAs:
//   - Area ratio (button size)
//   - Font-size ratio
//   - WCAG contrast ratio per button
//   - Above/below-fold position
//   - Composite visual weight score
// Surfaces interface-interference + privacy-zuckering findings.
// ============================================================

import { Page } from 'playwright';
import type { TestLogEntry } from '../types/audit';

type ProgressFn = (entry: TestLogEntry) => void;

export interface CTAPair {
  primaryLabel: string;
  secondaryLabel: string;
  primaryArea: number;
  secondaryArea: number;
  areaRatio: number;
  primaryFontSize: number;
  secondaryFontSize: number;
  fontRatio: number;
  primaryContrast: number;
  secondaryContrast: number;
  primaryAboveFold: boolean;
  secondaryAboveFold: boolean;
  prominenceRatio: number; // composite score
  severity: 'critical' | 'high' | 'medium' | 'pass';
  patternType: 'interface-interference' | 'privacy-zuckering' | 'roach-motel';
  pageUrl: string;
  regulation: string[];
  developerFix: string;
  designerFix: string;
}

export interface CTAProminenceResult {
  pageUrl: string;
  pairs: CTAPair[];
  totalViolations: number;
  criticalCount: number;
  highCount: number;
}

// CTA pair patterns to search for — [primaryText, secondaryText, patternType]
const CTA_PAIR_PATTERNS: Array<{
  primary: string[];
  secondary: string[];
  patternType: CTAPair['patternType'];
  regulation: string[];
}> = [
  {
    primary: ['accept all', 'accept cookies', 'allow all', 'i agree', 'agree to all', 'accept'],
    secondary: ['reject all', 'reject', 'decline all', 'decline', 'refuse', 'manage preferences', 'manage cookies', 'necessary only', 'essential only'],
    patternType: 'interface-interference',
    regulation: [ 'EU DSA Art. 25', 'ePrivacy Directive'],
  },
  {
    primary: ['subscribe', 'start free', 'get started', 'sign up', 'join now', 'try free', 'start trial'],
    secondary: ['cancel', 'unsubscribe', 'cancel subscription', 'delete account', 'close account'],
    patternType: 'roach-motel',
    regulation: ['FTC Click-to-Cancel Rule', 'EU DSA Art. 25', 'CMA Subscription Guidelines'],
  },
  {
    primary: ['share with partners', 'personalised ads', 'allow tracking', 'enable all', 'opt in'],
    secondary: ['opt out', 'do not share', 'no tracking', 'limit sharing', 'manage data'],
    patternType: 'privacy-zuckering',
    regulation: [ 'CCPA', 'EU DSA Art. 25'],
  },
];

// WCAG contrast ratio calculation (relative luminance formula)
function wcagContrastRatio(hexFg: string, hexBg: string): number {
  const toLum = (hex: string): number => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const l1 = toLum(hexFg);
  const l2 = toLum(hexBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return parseFloat(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

// Convert rgb(r,g,b) string to hex
function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return '#808080';
  return '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

export async function scoreCTAHierarchy(
  page: Page,
  pageUrl: string,
  onProgress?: ProgressFn,
): Promise<CTAProminenceResult> {
  const pairs: CTAPair[] = [];

  const log = (msg: string) => onProgress?.({
    timestamp: new Date().toISOString(),
    testId: 'CTA-SCORER', testName: 'CTA Prominence Scorer',
    wcag: 'WCAG 1.4.3', status: 'running', pillar: 'darkpatterns',
    message: msg, methodology: 'CTA Visual Weight Analysis',
    phase: 'CTA Prominence Scoring',
  });

  log(`  → Scoring CTA prominence hierarchy on ${pageUrl}...`);

  const viewportHeight = await page.evaluate(() => window.innerHeight);

  for (const pattern of CTA_PAIR_PATTERNS) {
    // Find primary CTA on the page
    const primaryEl = await page.evaluate((labels: string[]) => {
      const els = Array.from(document.querySelectorAll('button, a, input[type="submit"], [role="button"]'));
      for (const el of els) {
        const text = (el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '').toLowerCase().trim();
        if (labels.some(l => text.includes(l))) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            label: el.textContent?.trim() || '',
            area: rect.width * rect.height,
            fontSize: parseFloat(style.fontSize) || 14,
            top: rect.top,
            color: style.color,
            background: style.backgroundColor,
          };
        }
      }
      return null;
    }, pattern.primary);

    if (!primaryEl) continue;

    // Find secondary CTA
    const secondaryEl = await page.evaluate((labels: string[]) => {
      const els = Array.from(document.querySelectorAll('button, a, input[type="submit"], [role="button"], span[onclick], div[onclick]'));
      for (const el of els) {
        const text = (el.textContent || el.getAttribute('value') || el.getAttribute('aria-label') || '').toLowerCase().trim();
        if (labels.some(l => text.includes(l))) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            label: el.textContent?.trim() || '',
            area: rect.width * rect.height,
            fontSize: parseFloat(style.fontSize) || 14,
            top: rect.top,
            color: style.color,
            background: style.backgroundColor,
          };
        }
      }
      return null;
    }, pattern.secondary);

    if (!secondaryEl) continue;

    // Calculate ratios
    const areaRatio = secondaryEl.area > 0 ? parseFloat((primaryEl.area / secondaryEl.area).toFixed(2)) : 99;
    const fontRatio = secondaryEl.fontSize > 0 ? parseFloat((primaryEl.fontSize / secondaryEl.fontSize).toFixed(2)) : 99;

    // Convert colours and calculate contrast
    const primaryHexFg = rgbToHex(primaryEl.color);
    const primaryHexBg = rgbToHex(primaryEl.background);
    const secondaryHexFg = rgbToHex(secondaryEl.color);
    const secondaryHexBg = rgbToHex(secondaryEl.background);

    const primaryContrast = wcagContrastRatio(primaryHexFg, primaryHexBg);
    const secondaryContrast = wcagContrastRatio(secondaryHexFg, secondaryHexBg);

    const primaryAboveFold = primaryEl.top < viewportHeight;
    const secondaryAboveFold = secondaryEl.top < viewportHeight;

    // Composite prominence ratio: area × font × position penalty
    const positionPenalty = !secondaryAboveFold && primaryAboveFold ? 1.5 : 1.0;
    const prominenceRatio = parseFloat((areaRatio * fontRatio * positionPenalty).toFixed(2));

    // Severity classification
    let severity: CTAPair['severity'] = 'pass';
    if (prominenceRatio >= 8 || (areaRatio >= 4 && !secondaryAboveFold)) severity = 'critical';
    else if (prominenceRatio >= 4 || areaRatio >= 2.5) severity = 'high';
    else if (prominenceRatio >= 2 || fontRatio >= 1.5) severity = 'medium';

    if (severity === 'pass') continue;

    pairs.push({
      primaryLabel: primaryEl.label,
      secondaryLabel: secondaryEl.label,
      primaryArea: Math.round(primaryEl.area),
      secondaryArea: Math.round(secondaryEl.area),
      areaRatio,
      primaryFontSize: primaryEl.fontSize,
      secondaryFontSize: secondaryEl.fontSize,
      fontRatio,
      primaryContrast,
      secondaryContrast,
      primaryAboveFold,
      secondaryAboveFold,
      prominenceRatio,
      severity,
      patternType: pattern.patternType,
      pageUrl,
      regulation: pattern.regulation,
      developerFix: `Set equal CSS dimensions and font-size for both "${primaryEl.label}" and "${secondaryEl.label}". Ensure secondary option is above the fold. Min contrast ratio 4.5:1 for both.`,
      designerFix: `Visual weight of "${primaryEl.label}" is ${prominenceRatio.toFixed(1)}× greater than "${secondaryEl.label}". Equalise button size, colour weight, and vertical position. Do not use muted grey for the secondary option.`,
    });

    log(`    ✓ CTA pair flagged: "${primaryEl.label}" vs "${secondaryEl.label}" — prominence ratio ${prominenceRatio}× (${severity})`);
  }

  const criticalCount = pairs.filter(p => p.severity === 'critical').length;
  const highCount = pairs.filter(p => p.severity === 'high').length;

  if (pairs.length > 0) {
    log(`  ✓ CTA prominence scoring: ${pairs.length} pair(s) flagged — ${criticalCount} critical, ${highCount} high`);
  } else {
    log(`  ✓ CTA prominence scoring: no asymmetric pairs detected`);
  }

  return { pageUrl, pairs, totalViolations: pairs.length, criticalCount, highCount };
}
