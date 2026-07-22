import { BrowserContext } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { AccessibilityIssue, PageData } from '../types/audit';
import { getSeverityFromAxeImpact, getImpactDescription } from '../wcag/severity';
import { WCAG_CRITERIA } from '../wcag/criteria';
// uuid replaced with Node.js built-in
const uuidv4 = (): string => crypto.randomUUID();

interface AxeViolation {
  id: string;
  impact?: string;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeNode[];
}

interface AxeNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

const AXE_WCAG_TAG_MAP: Record<string, { criterion: string; name: string; level: 'A' | 'AA' | 'AAA' }> = {
  'wcag111': { criterion: '1.1.1', name: 'Non-text Content', level: 'A' },
  'wcag121': { criterion: '1.2.1', name: 'Audio-only and Video-only', level: 'A' },
  'wcag122': { criterion: '1.2.2', name: 'Captions (Prerecorded)', level: 'A' },
  'wcag125': { criterion: '1.2.5', name: 'Audio Description', level: 'AA' },
  'wcag131': { criterion: '1.3.1', name: 'Info and Relationships', level: 'A' },
  'wcag132': { criterion: '1.3.2', name: 'Meaningful Sequence', level: 'A' },
  'wcag133': { criterion: '1.3.3', name: 'Sensory Characteristics', level: 'A' },
  'wcag134': { criterion: '1.3.4', name: 'Orientation', level: 'AA' },
  'wcag135': { criterion: '1.3.5', name: 'Identify Input Purpose', level: 'AA' },
  'wcag141': { criterion: '1.4.1', name: 'Use of Color', level: 'A' },
  'wcag143': { criterion: '1.4.3', name: 'Contrast (Minimum)', level: 'AA' },
  'wcag145': { criterion: '1.4.5', name: 'Images of Text', level: 'AA' },
  'wcag1410': { criterion: '1.4.10', name: 'Reflow', level: 'AA' },
  'wcag1411': { criterion: '1.4.11', name: 'Non-text Contrast', level: 'AA' },
  'wcag1412': { criterion: '1.4.12', name: 'Text Spacing', level: 'AA' },
  'wcag1413': { criterion: '1.4.13', name: 'Content on Hover or Focus', level: 'AA' },
  'wcag211': { criterion: '2.1.1', name: 'Keyboard', level: 'A' },
  'wcag212': { criterion: '2.1.2', name: 'No Keyboard Trap', level: 'A' },
  'wcag214': { criterion: '2.1.4', name: 'Character Key Shortcuts', level: 'A' },
  'wcag221': { criterion: '2.2.1', name: 'Timing Adjustable', level: 'A' },
  'wcag222': { criterion: '2.2.2', name: 'Pause, Stop, Hide', level: 'A' },
  'wcag241': { criterion: '2.4.1', name: 'Bypass Blocks', level: 'A' },
  'wcag242': { criterion: '2.4.2', name: 'Page Titled', level: 'A' },
  'wcag243': { criterion: '2.4.3', name: 'Focus Order', level: 'A' },
  'wcag244': { criterion: '2.4.4', name: 'Link Purpose (In Context)', level: 'A' },
  'wcag245': { criterion: '2.4.5', name: 'Multiple Ways', level: 'AA' },
  'wcag246': { criterion: '2.4.6', name: 'Headings and Labels', level: 'AA' },
  'wcag247': { criterion: '2.4.7', name: 'Focus Visible', level: 'AA' },
  'wcag2411': { criterion: '2.4.11', name: 'Focus Not Obscured', level: 'AA' },
  'wcag253': { criterion: '2.5.3', name: 'Label in Name', level: 'A' },
  'wcag254': { criterion: '2.5.4', name: 'Motion Actuation', level: 'A' },
  'wcag257': { criterion: '2.5.7', name: 'Dragging Movements', level: 'AA' },
  'wcag258': { criterion: '2.5.8', name: 'Target Size (Minimum)', level: 'AA' },
  'wcag311': { criterion: '3.1.1', name: 'Language of Page', level: 'A' },
  'wcag312': { criterion: '3.1.2', name: 'Language of Parts', level: 'AA' },
  'wcag321': { criterion: '3.2.1', name: 'On Focus', level: 'A' },
  'wcag322': { criterion: '3.2.2', name: 'On Input', level: 'A' },
  'wcag324': { criterion: '3.2.4', name: 'Consistent Identification', level: 'AA' },
  'wcag326': { criterion: '3.2.6', name: 'Consistent Help', level: 'A' },
  'wcag331': { criterion: '3.3.1', name: 'Error Identification', level: 'A' },
  'wcag332': { criterion: '3.3.2', name: 'Labels or Instructions', level: 'A' },
  'wcag333': { criterion: '3.3.3', name: 'Error Suggestion', level: 'AA' },
  'wcag334': { criterion: '3.3.4', name: 'Error Prevention', level: 'AA' },
  'wcag337': { criterion: '3.3.7', name: 'Redundant Entry', level: 'A' },
  'wcag338': { criterion: '3.3.8', name: 'Accessible Authentication', level: 'AA' },
  'wcag412': { criterion: '4.1.2', name: 'Name, Role, Value', level: 'A' },
  'wcag413': { criterion: '4.1.3', name: 'Status Messages', level: 'AA' },
};

function mapAxeTagsToWcag(tags: string[]): { criterion: string; name: string; level: 'A' | 'AA' | 'AAA' } | null {
  for (const tag of tags) {
    const mapped = AXE_WCAG_TAG_MAP[tag];
    if (mapped) return mapped;
  }
  if (tags.some(t => t === 'wcag2aaa' || t === 'wcag21aaa' || t === 'wcag22aaa')) {
    return { criterion: 'general', name: 'WCAG AAA Best Practice', level: 'AAA' };
  }
  if (tags.some(t => t === 'wcag2aa' || t === 'wcag21aa' || t === 'wcag22aa')) {
    return { criterion: 'general', name: 'WCAG AA Requirement', level: 'AA' };
  }
  if (tags.some(t => t === 'wcag2a' || t === 'wcag21a' || t === 'wcag22a')) {
    return { criterion: 'general', name: 'WCAG A Requirement', level: 'A' };
  }
  return null;
}

function getCategoryFromCriterion(criterion: string): AccessibilityIssue['category'] {
  if (criterion.startsWith('1.')) return 'perceivable';
  if (criterion.startsWith('2.')) return 'operable';
  if (criterion.startsWith('3.')) return 'understandable';
  if (criterion.startsWith('4.')) return 'robust';
  return 'perceivable';
}

function getTestIdForAxeRule(ruleId: string, criterion: string): string {
  const prefix = criterion.startsWith('1.') ? 'P' :
                 criterion.startsWith('2.') ? 'O' :
                 criterion.startsWith('3.') ? 'U' : 'R';
  return `${prefix}-AXE-${ruleId}`;
}

/**
 * Determines if a WCAG criterion is applicable based on page content.
 * Returns true if the criterion SHOULD be tested for this page.
 */
function isCriterionApplicable(criterion: string, pageHints: PageApplicabilityHints): boolean {
  const mediaRelated = ['1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.2.6', '1.2.7', '1.2.8', '1.2.9'];
  const formRelated  = ['3.3.1', '3.3.2', '3.3.3', '3.3.4', '3.3.7', '3.3.8'];
  const timedContent = ['2.2.1', '2.2.2'];
  const motionContent= ['2.2.2', '2.3.1', '2.3.2', '2.3.3'];
  const multiPage    = ['2.4.5', '3.2.3', '3.2.4'];

  if (mediaRelated.includes(criterion) && !pageHints.hasMedia) return false;
  if (formRelated.includes(criterion) && !pageHints.hasForms) return false;
  if (timedContent.includes(criterion) && !pageHints.hasTimedContent) return false;
  if (motionContent.includes(criterion) && !pageHints.hasAnimation) return false;
  if (multiPage.includes(criterion) && pageHints.isSinglePage) return false;

  return true;
}

export interface PageApplicabilityHints {
  hasMedia: boolean;       // has video/audio elements
  hasForms: boolean;       // has form inputs
  hasTimedContent: boolean; // has countdown/auto-refresh
  hasAnimation: boolean;   // has auto-playing animations
  isSinglePage: boolean;   // only one page in the audit
}

export interface AxeScanResult {
  issues: AccessibilityIssue[];
  inapplicableCriteria: string[];   // WCAG criterion IDs that axe said are N/A
  passedCriteria: string[];          // criteria explicitly passed
  applicabilityHints: PageApplicabilityHints;
}

/**
 * Build the axe-core tag set for exactly the selected WCAG levels.
 * Each level maps to its own set of axe tags — no forced inheritance.
 * The orchestrator applies a final wcagLevel filter after all engines run,
 * so this controls what axe scans while the filter controls what's reported.
 */
function buildAxeTags(wcagLevels: ('A' | 'AA' | 'AAA')[]): string[] {
  const tags: string[] = [];
  if (wcagLevels.includes('A'))   tags.push('wcag2a',   'wcag21a',   'wcag22a');
  if (wcagLevels.includes('AA'))  tags.push('wcag2aa',  'wcag21aa',  'wcag22aa');
  if (wcagLevels.includes('AAA')) tags.push('wcag2aaa', 'wcag21aaa', 'wcag22aaa');
  if (tags.length === 0) tags.push('wcag2a', 'wcag21a', 'wcag22a'); // safety fallback
  tags.push('best-practice');
  return tags;
}

export async function scanWithAxe(
  context: BrowserContext,
  pageData: PageData,
  onProgress?: (message: string) => void,
  wcagLevels: ('A' | 'AA' | 'AAA')[] = ['A', 'AA']
): Promise<AxeScanResult> {
  const issues: AccessibilityIssue[] = [];
  const inapplicableCriteria: string[] = [];
  const passedCriteria: string[] = [];
  const page = await context.newPage();

  let applicabilityHints: PageApplicabilityHints = {
    hasMedia: false, hasForms: false,
    hasTimedContent: false, hasAnimation: false, isSinglePage: false
  };

  try {
    await page.goto(pageData.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Use networkidle with fallback for better rendering consistency
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    // Extra buffer for JS-rendered content
    await page.waitForTimeout(800);

    onProgress?.(`Scanning ${pageData.title} with axe-core...`);

    // Detect page content hints for applicability
    applicabilityHints = await page.evaluate(() => {
      return {
        hasMedia: document.querySelectorAll('video, audio, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0,
        hasForms: document.querySelectorAll('input:not([type="hidden"]), select, textarea').length > 0,
        hasTimedContent: !!(
          document.querySelector('[data-countdown], [class*="countdown"], [class*="timer"]') ||
          document.querySelector('meta[http-equiv="refresh"]')
        ),
        hasAnimation: document.querySelectorAll('[class*="animate"], [class*="carousel"], [class*="slider"], [class*="marquee"]').length > 0,
        isSinglePage: false,
      };
    });

    const results = await new AxeBuilder({ page })
      .withTags(buildAxeTags(wcagLevels))
      .analyze();

    // ── VIOLATIONS → Issues
    for (const violation of results.violations as AxeViolation[]) {
      const wcagMapping = mapAxeTagsToWcag(violation.tags);
      if (!wcagMapping) continue;

      const severity = getSeverityFromAxeImpact(violation.impact);

      for (const node of violation.nodes) {
        issues.push({
          id: uuidv4(),
          testId: getTestIdForAxeRule(violation.id, wcagMapping.criterion),
          title: violation.help,
          description: violation.description + (node.failureSummary ? ` — ${node.failureSummary}` : ''),
          element: node.target.join(' > '),
          elementHtml: node.html.substring(0, 500),
          pageUrl: pageData.url,
          wcagCriterion: wcagMapping.criterion,
          wcagName: wcagMapping.name,
          wcagLevel: wcagMapping.level,
          severity,
          impact: getImpactDescription(wcagMapping.criterion, severity),
          recommendation: generateAxeRecommendation(violation.id, violation.help),
          codeFix: generateAxeCodeFix(violation.id, node.html),
          category: getCategoryFromCriterion(wcagMapping.criterion),
          source: 'axe-core',
          confidence: 'high' as const
        });
      }
    }

    // ── INAPPLICABLE → N/A criteria (axe explicitly says "not applicable")
    for (const rule of results.inapplicable || []) {
      const wcagMapping = mapAxeTagsToWcag(rule.tags || []);
      if (wcagMapping && wcagMapping.criterion !== 'general') {
        if (!inapplicableCriteria.includes(wcagMapping.criterion)) {
          inapplicableCriteria.push(wcagMapping.criterion);
        }
      }
    }

    // ── PASSES → criteria with explicit pass evidence
    for (const rule of results.passes || []) {
      const wcagMapping = mapAxeTagsToWcag(rule.tags || []);
      if (wcagMapping && wcagMapping.criterion !== 'general') {
        if (!passedCriteria.includes(wcagMapping.criterion)) {
          passedCriteria.push(wcagMapping.criterion);
        }
      }
    }

  } catch (error) {
    console.error(`axe-core scan failed for ${pageData.url}:`, error);
  } finally {
    await page.close();
  }

  return { issues, inapplicableCriteria, passedCriteria, applicabilityHints };
}

function generateAxeRecommendation(ruleId: string, help: string): string {
  const recommendations: Record<string, string> = {
    'image-alt': 'Add descriptive alt text to the image element. Use alt="" for decorative images.',
    'color-contrast': 'Increase the contrast ratio between the foreground text and background color to meet the minimum 4.5:1 ratio for normal text or 3:1 for large text.',
    'label': 'Add a <label> element associated with the form input using the "for" attribute, or use aria-label/aria-labelledby.',
    'link-name': 'Add descriptive text content to the link, or use aria-label to describe its purpose.',
    'button-name': 'Add text content to the button, or use aria-label to describe its purpose.',
    'html-has-lang': 'Add a lang attribute to the <html> element specifying the page language (e.g., lang="en").',
    'document-title': 'Add a descriptive <title> element inside the <head> section.',
    'heading-order': 'Ensure headings follow a logical order (h1 → h2 → h3) without skipping levels.',
    'bypass': 'Add a "Skip to main content" link as the first focusable element on the page.',
    'aria-roles': 'Use valid ARIA role values. Remove or replace invalid roles with appropriate ones.',
    'aria-valid-attr': 'Remove invalid ARIA attributes or replace them with valid ones.',
    'aria-valid-attr-value': 'Provide valid values for ARIA attributes.',
    'tabindex': 'Avoid using tabindex values greater than 0. Use tabindex="0" or tabindex="-1" instead.',
    'region': 'Ensure all page content is contained within landmark regions (main, nav, header, footer, etc.).',
  };
  return recommendations[ruleId] || `Fix the issue: ${help}. Refer to WCAG guidelines for specific remediation steps.`;
}

function generateAxeCodeFix(ruleId: string, html: string): string {
  const fixes: Record<string, string> = {
    'image-alt': `<!-- Before -->\n${html}\n\n<!-- After -->\n${html.replace(/<img/, '<img alt="Descriptive text about the image"')}`,
    'html-has-lang': `<!-- Add lang attribute -->\n<html lang="en">`,
    'document-title': `<!-- Add inside <head> -->\n<title>Descriptive Page Title</title>`,
    'bypass': `<!-- Add as first element in <body> -->\n<a href="#main-content" class="skip-link">Skip to main content</a>`,
    'label': `<!-- Wrap input with label -->\n<label for="inputId">Label Text</label>\n<input id="inputId" type="text" />`,
    'button-name': `<!-- Add text or aria-label -->\n<button aria-label="Descriptive action">Action</button>`,
    'link-name': `<!-- Add descriptive text -->\n<a href="url">Descriptive Link Text</a>`,
  };
  return fixes[ruleId] || `// Review and fix the element:\n${html}`;
}
