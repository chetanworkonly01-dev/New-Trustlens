import OpenAI from 'openai';
import { AccessibilityIssue, ConfidenceLevel } from '../types/audit';
// uuid replaced with Node.js built-in
const uuidv4 = (): string => crypto.randomUUID();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

interface AIAnalysisInput {
  pageUrl: string;
  pageTitle: string;
  htmlSnippet: string;
  /** Base64-encoded page screenshot for GPT-4o vision analysis */
  pageScreenshot?: string;
  existingIssues: AccessibilityIssue[];
  /** Site profile context for grounding AI findings */
  siteContext?: {
    profile?: string;    // e.g. 'ecommerce', 'saas-subscription'
    siteName?: string;
    aiDirection?: string; // auditor's custom instruction
  };
}

interface AIIssue {
  title: string;
  description: string;
  element: string;
  wcagCriterion: string;
  wcagName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
  codeFix?: string;
  confidence: 'high' | 'medium' | 'low';
  uxCategory?: string;
  whatISee?: string;       // chain-of-thought: describe before judging
  canDOMConfirm?: boolean; // true = this should be verifiable in HTML
}

export async function analyzeWithAI(input: AIAnalysisInput, onProgress?: (msg: string) => void): Promise<AccessibilityIssue[]> {
  if (!process.env.OPENAI_API_KEY) {
    onProgress?.('AI analysis skipped: No OpenAI API key configured.');
    return [];
  }

  onProgress?.(`AI analyzing ${input.pageTitle}...`);

  const truncatedHtml = input.htmlSnippet.substring(0, 12000);
  const existingSummary = input.existingIssues.slice(0, 20).map(i => `- ${i.title} (${i.wcagCriterion})`).join('\n');

  const siteCtx = input.siteContext;
  const siteContextBlock = siteCtx
    ? `SITE CONTEXT:\n- Business type: ${siteCtx.profile || 'unknown'}\n- Site: ${siteCtx.siteName || input.pageUrl}${siteCtx.aiDirection ? `\n- Auditor direction: "${siteCtx.aiDirection}"` : ''}`
    : '';

  const prompt = `You are an expert WCAG 2.2 accessibility auditor and UX researcher with 15 years of experience.
${siteContextBlock}

Page: ${input.pageTitle} (${input.pageUrl})

HTML (truncated):
\`\`\`html
${truncatedHtml}
\`\`\`

Already detected issues (DO NOT re-flag these):
${existingSummary || 'None yet'}

## CHAIN-OF-THOUGHT REQUIRED
For each issue: first describe "whatISee" (factual observation), then explain why it is a problem, then rate confidence.
Only report confidence "high" or "medium". Filter out all "low" confidence findings.

## FIND ISSUES AUTOMATED TOOLS MISS

### A. CONTEXTUAL ACCESSIBILITY
- Misleading alt text ("image.png", "photo", "IMG_001")
- Poor button/link labels that are confusing
- Missing landmarks for major page sections
- Complex widgets missing ARIA patterns (tabs, accordions, carousels)
- Improper ARIA usage (aria-hidden on focusable elements, conflicting roles)

### B. UX-LEVEL ACCESSIBILITY
- Unclear button labels ("Click here", "Submit", "Go")
- CTAs that blend with surrounding text (poor visual hierarchy)
- Cognitive overload (too many links, dense text without structure)
- Interactive elements that look non-interactive
- Inconsistent UI patterns (different button styles for same action)

Return a JSON object {"issues": [...]}. Each issue:
{
  "whatISee": "One factual observation sentence",
  "title": "Issue title",
  "description": "Detailed problem description",
  "element": "CSS selector or element description",
  "wcagCriterion": "X.X.X",
  "wcagName": "Criterion Name",
  "severity": "critical|high|medium|low",
  "recommendation": "Actionable fix",
  "codeFix": "Optional HTML/CSS snippet",
  "confidence": "high|medium",
  "canDOMConfirm": true/false,
  "uxCategory": "Optional category"
}

Return at most 8 issues not already in the existing list. Return {"issues": []} if none found.${input.pageScreenshot ? '\n\nA page screenshot is attached. Use it to detect VISUAL issues: contrast, focus indicators, tiny touch targets, truncated text, layout shifts.' : ''}`;

  try {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (input.pageScreenshot) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${input.pageScreenshot}`, detail: 'low' } }
        ]
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    }, { signal: controller.signal as any });

    clearTimeout(timeout);

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const aiIssues: AIIssue[] = parsed.issues || [];
    if (!Array.isArray(aiIssues)) return [];

    // Consistency enforcement: filter low confidence + fuzzy dedup against existing issues
    const existingTitlesLower = input.existingIssues.map(i => i.title.toLowerCase());
    const filtered = aiIssues.filter(ai => {
      if (ai.confidence === 'low') return false;
      const aiTitleLower = ai.title.toLowerCase();
      if (existingTitlesLower.some(t => {
        const overlap = aiTitleLower.split(' ').filter(w => w.length > 4 && t.includes(w)).length;
        return overlap >= 3;
      })) return false;
      return true;
    });

    const issues: AccessibilityIssue[] = filtered.map(ai => ({
      id: uuidv4(),
      testId: `AI-${ai.wcagCriterion?.replace(/\./g, '') || 'GEN'}`,
      title: ai.title,
      description: ai.description
        + (ai.whatISee ? ` [Observed: ${ai.whatISee}]` : '')
        + (ai.uxCategory ? ` [UX: ${ai.uxCategory}]` : ''),
      element: ai.element,
      pageUrl: input.pageUrl,
      wcagCriterion: ai.wcagCriterion || 'general',
      wcagName: ai.wcagName || 'AI-Detected Issue',
      wcagLevel: getLevel(ai.wcagCriterion),
      severity: ai.severity || 'medium',
      impact: `AI-detected: affects users relying on assistive technologies`,
      recommendation: ai.recommendation,
      codeFix: ai.codeFix,
      category: getCat(ai.wcagCriterion),
      source: 'ai-analysis' as const,
      confidence: mapConfidence(ai.confidence),
    }));

    onProgress?.(`AI found ${issues.length} additional issues (${issues.filter(i => i.confidence === 'high').length} high confidence).`);
    return issues;
  } catch (error) {
    console.error('AI analysis error:', error);
    onProgress?.('AI analysis failed, continuing with rule-based results.');
    return [];
  }
}

/**
 * Vision-based dark pattern detection — runs BEFORE DOM scan as primary detection pass.
 * Returns signals that the DOM engine then confirms or rejects.
 * Confidence "high" + DOM confirmation = verdict model.
 * Confidence "medium" + no DOM confirmation = signal model (unverifiable claim).
 */
export async function detectDarkPatternsWithVision(
  screenshot: string,
  pageUrl: string,
  siteContext?: { profile?: string; aiDirection?: string }
): Promise<Array<{
  signal: string;
  location: string;
  severity: 'critical' | 'high' | 'medium';
  requiresDOMConfirmation: boolean;
  confidence: 'high' | 'medium';
  category: string;
}>> {
  if (!process.env.OPENAI_API_KEY) return [];

  const directionBlock = siteContext?.aiDirection ? `\nAuditor focus: "${siteContext.aiDirection}"` : '';
  const profileBlock = siteContext?.profile ? `Site type: ${siteContext.profile}. ` : '';

  const visionPrompt = `You are an expert dark pattern auditor. ${profileBlock}${directionBlock}

Examine this page screenshot and identify OBSERVABLE dark pattern signals.

Check for:
1. ASYMMETRIC BUTTONS: Accept/agree button larger, brighter, or more prominent than reject/decline
2. LOW-CONTRAST DECLINE: Reject or close option is grey, small, or visually hidden
3. CONFIRMSHAMING: Decline uses guilt-tripping language ("No thanks, I hate savings")
4. COUNTDOWN TIMERS: Urgency indicators ("Offer expires in 00:23:14")
5. SCARCITY INDICATORS: "Only 2 left", "128 people viewing" — set requiresDOMConfirmation: true
6. PRE-SELECTED OPTIONS: Checkboxes or radio buttons appear pre-ticked
7. MISLEADING PRICING: Crossed-out prices, hidden fees in fine print
8. ROACH MOTEL: Visible asymmetry between subscribe (easy) and cancel (hard)

CHAIN-OF-THOUGHT: For each finding, describe exactly what you see (factual) then explain the pattern.

Return JSON: {"signals": [{"signal": "description", "location": "where on page", "severity": "critical|high|medium", "requiresDOMConfirmation": true/false, "confidence": "high|medium", "category": "pattern-type"}]}
Return {"signals": []} if none found.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: visionPrompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot}`, detail: 'high' } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    }, { signal: controller.signal as any });

    clearTimeout(timeout);

    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return (parsed.signals || []).filter((s: any) => s.confidence === 'high' || s.confidence === 'medium');
  } catch (error) {
    console.error('Vision dark pattern detection failed:', error);
    return [];
  }
}

/**
 * Validate and assign confidence to rule-based issues
 */
export function assignConfidence(issue: AccessibilityIssue): ConfidenceLevel {
  if (issue.source === 'axe-core') return 'high';
  if (issue.source === 'journey-test') return 'high';
  if (issue.source === 'custom-rule') {
    if (['P-01', 'P-03', 'U-01', 'O-04', 'O-07'].includes(issue.testId)) return 'high';
    if (['P-05', 'P-10', 'O-10'].includes(issue.testId)) return 'medium';
    return 'medium';
  }
  if (issue.source === 'pdf-analyzer') return 'high';
  return issue.confidence || 'medium';
}

function mapConfidence(raw?: string): ConfidenceLevel {
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return 'medium';
}

function getLevel(criterion?: string): 'A' | 'AA' | 'AAA' {
  if (!criterion) return 'A';
  const aaaCriteria = ['1.2.6','1.2.7','1.2.8','1.2.9','1.4.6','1.4.8','1.4.9','2.1.3','2.2.3','2.2.4','2.2.5','2.3.2','2.4.8','2.4.9','2.4.10','2.4.12','2.4.13','3.1.3','3.1.4','3.1.5','3.1.6','3.2.5','3.3.5','3.3.6','3.3.9'];
  const aaCriteria = ['1.2.4','1.2.5','1.3.5','1.4.3','1.4.4','1.4.5','1.4.10','1.4.11','1.4.12','1.4.13','2.4.5','2.4.6','2.4.7','2.4.11','2.5.7','2.5.8','3.1.2','3.2.3','3.2.4','3.3.3','3.3.4','3.3.8','4.1.3'];
  if (aaaCriteria.includes(criterion)) return 'AAA';
  if (aaCriteria.includes(criterion)) return 'AA';
  return 'A';
}

function getCat(criterion?: string): AccessibilityIssue['category'] {
  if (!criterion) return 'perceivable';
  if (criterion.startsWith('1.')) return 'perceivable';
  if (criterion.startsWith('2.')) return 'operable';
  if (criterion.startsWith('3.')) return 'understandable';
  return 'robust';
}
