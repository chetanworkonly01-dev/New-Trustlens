import { executeQuery } from '../db';
import { DarkPatternFinding } from '../types/darkpattern';

export interface DarkPatternFeedbackInput {
  domain: string;
  patternType: string;
  elementSelector: string;
  action: 'false_positive' | 'verified';
  reason?: string;
}

export interface LearnedRule {
  patternType: string;
  elementSelector: string;
}

// Clean & normalize domain name (e.g. "https://www.amazon.com/dp/123" -> "amazon.com")
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Record an auditor's feedback (e.g. False Positive or Verified Dark Pattern) into PostgreSQL
 */
export async function recordDarkPatternFeedback(input: DarkPatternFeedbackInput): Promise<boolean> {
  const cleanDomain = extractDomain(input.domain);

  if (process.env.DEV_BYPASS_DB === 'true') {
    console.log(`[DP Learning] Dev bypass: recorded ${input.action} for ${cleanDomain}`);
    return true;
  }

  try {
    await executeQuery(
      `INSERT INTO dark_pattern_learning (domain, pattern_type, element_selector, action, reason) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        cleanDomain,
        input.patternType,
        input.elementSelector,
        input.action,
        input.reason || null,
      ]
    );
    console.log(`[DP Learning] Recorded feedback: ${input.action} on ${cleanDomain} (${input.patternType})`);
    return true;
  } catch (err) {
    console.error('[DP Learning] Failed to record dark pattern feedback:', err);
    return false;
  }
}

/**
 * Fetch all learned false positive rules for a target domain or global rules ('*')
 */
export async function getLearnedFalsePositives(rawUrl: string): Promise<LearnedRule[]> {
  const domain = extractDomain(rawUrl);

  if (process.env.DEV_BYPASS_DB === 'true') {
    return [];
  }

  try {
    const rows = await executeQuery<{
      pattern_type: string;
      element_selector: string;
    }>(
      `SELECT DISTINCT pattern_type, element_selector 
       FROM dark_pattern_learning 
       WHERE (domain = $1 OR domain = '*') AND action = 'false_positive'`,
      [domain]
    );

    return rows.map((r) => ({
      patternType: r.pattern_type,
      elementSelector: r.element_selector,
    }));
  } catch (err) {
    console.error('[DP Learning] Failed to fetch learned false positives:', err);
    return [];
  }
}

/**
 * Filter out dark pattern issues that match previously learned false positives
 */
export async function filterDarkPatternsWithLearning(
  patterns: DarkPatternFinding[],
  rawUrl: string
): Promise<{ activePatterns: DarkPatternFinding[]; filteredCount: number }> {
  if (!patterns || patterns.length === 0) {
    return { activePatterns: [], filteredCount: 0 };
  }

  const falsePositives = await getLearnedFalsePositives(rawUrl);
  if (falsePositives.length === 0) {
    return { activePatterns: patterns, filteredCount: 0 };
  }

  const activePatterns: DarkPatternFinding[] = [];
  let filteredCount = 0;

  for (const pattern of patterns) {
    const patternType = (pattern.category || pattern.ruleId || '').toLowerCase();
    const element = (pattern.element || '').toLowerCase();

    // Check if matching any learned false positive
    const isLearnedFalsePositive = falsePositives.some((fp) => {
      const fpType = fp.patternType.toLowerCase();
      const fpElem = fp.elementSelector.toLowerCase();

      const typeMatch = fpType === '*' || patternType.includes(fpType) || fpType.includes(patternType);
      const elemMatch = fpElem === '*' || element.includes(fpElem) || fpElem.includes(element);

      return typeMatch && elemMatch;
    });

    if (isLearnedFalsePositive) {
      filteredCount++;
      console.log(`[DP Learning] Filtered out learned false positive: ${pattern.title} (${pattern.element})`);
    } else {
      activePatterns.push(pattern);
    }
  }

  return { activePatterns, filteredCount };
}
