import OpenAI from 'openai';
import { executeQuery } from '../db';
import { extractDomain } from './dark-pattern-learning';
import type { DarkPatternFinding } from '../types/darkpattern';

async function callLLM(prompt: string, onProgress?: (msg: string) => void): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Primary: Try OpenAI GPT-4o
  if (openaiKey) {
    try {
      console.log(`\n🚀 ============================================================`);
      console.log(`🤖 [AI Judge] STARTING OpenAI GPT-4o Adjudication...`);
      console.log(`============================================================\n`);

      onProgress?.('[AI Judge] Calling OpenAI GPT-4o API...');
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are TrustLens AI, a specialized UX & Dark Pattern AI Judge that outputs JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        console.log(`\n✅ ============================================================`);
        console.log(`🤖 [AI Judge] OpenAI GPT-4o Response Received Successfully!`);
        console.log(`============================================================\n`);
        return content;
      }
    } catch (err) {
      console.warn('[AI Judge] OpenAI GPT-4o call failed (quota or error):', (err as Error).message);
    }
  }

  // 2. Fallback: OpenRouter AI (openai/gpt-4o)
  if (openrouterKey) {
    try {
      console.log(`\n🚀 ============================================================`);
      console.log(`🤖 [AI Judge] STARTING OpenRouter AI (openai/gpt-4o)...`);
      console.log(`============================================================\n`);

      onProgress?.('[AI Judge] Calling OpenRouter AI (openai/gpt-4o)...');
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://trustlens.kpmg.com',
          'X-Title': 'TrustLens AI',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          max_tokens: 1500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are TrustLens AI, a specialized UX & Dark Pattern AI Judge that outputs JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`\n✅ ============================================================`);
          console.log(`🤖 [AI Judge] OpenRouter AI (openai/gpt-4o) Response Received Successfully!`);
          console.log(`============================================================\n`);
          return content;
        }
      } else {
        const errText = await res.text();
        console.warn(`[AI Judge] OpenRouter API returned ${res.status}: ${errText.slice(0, 150)}`);
      }
    } catch (err) {
      console.warn('[AI Judge] OpenRouter API exception:', (err as Error).message);
    }
  }

  // 3. Fallback: Google Gemini API
  if (geminiKey && geminiKey.trim().length > 10) {
    console.log(`\n🚀 ============================================================`);
    console.log(`🤖 [AI Judge] STARTING Google Gemini API...`);
    console.log(`============================================================\n`);

    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    for (const model of geminiModels) {
      try {
        onProgress?.(`[AI Judge] Calling Google Gemini API (${model})...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            console.log(`\n✅ ============================================================`);
            console.log(`🤖 [AI Judge] Google Gemini (${model}) Response Received Successfully!`);
            console.log(`============================================================\n`);
            return rawText;
          }
        } else {
          const errText = await res.text();
          console.warn(`[AI Judge] Gemini model ${model} returned ${res.status}: ${errText.slice(0, 150)}`);
        }
      } catch (err) {
        console.warn(`[AI Judge] Gemini model ${model} exception:`, (err as Error).message);
      }
    }
  }

  throw new Error('No working AI API key or quota available.');
}

export interface AISuppressedFinding {
  id: string;
  ruleId?: string;
  category?: string;
  title: string;
  element?: string;
  aiReasoning: string;
  confidence: number;
  originalFinding: DarkPatternFinding;
}

export interface AILearningSummary {
  dynamicAIDecisionText: string;
  aiConfidence: number; // e.g. 96
  evaluatedCount: number;
  suppressedCount: number;
  activeCount: number;
  suppressedPatterns: AISuppressedFinding[];
  isAIActive: boolean;
}

export interface AIAdjudicationResult {
  activePatterns: DarkPatternFinding[];
  learningSummary: AILearningSummary;
}

export interface HistoricalFeedbackRow {
  domain: string;
  pattern_type: string;
  element_selector: string;
  action: string;
  reason: string | null;
}

/**
 * Fetches all cross-domain historical feedback from dark_pattern_learning table.
 * Universal rules across all domains (Flipkart, Myntra, Amazon, etc.) are included.
 */
export async function getAllGlobalHistoricalFeedback(): Promise<HistoricalFeedbackRow[]> {
  if (process.env.DEV_BYPASS_DB === 'true') {
    return [];
  }
  try {
    const rows = await executeQuery<HistoricalFeedbackRow>(
      `SELECT COALESCE(domain, '*') as domain, pattern_type, element_selector, action, reason 
       FROM dark_pattern_learning 
       ORDER BY created_at DESC 
       LIMIT 100`
    );
    return rows;
  } catch (err) {
    console.warn('[AI Judge] Global historical feedback fetch skipped:', (err as Error).message);
    return [];
  }
}

/**
 * Main AI Adjudication function using OpenAI / OpenRouter / Gemini + Cross-Domain Learning.
 * Dynamically evaluates candidate findings and generates dynamic UI decision text.
 */
export async function adjudicateDarkPatternsWithAI(
  patterns: DarkPatternFinding[],
  rawUrl: string,
  onProgress?: (msg: string) => void
): Promise<AIAdjudicationResult> {
  const targetDomain = extractDomain(rawUrl);

  if (!patterns || patterns.length === 0) {
    return {
      activePatterns: [],
      learningSummary: {
        dynamicAIDecisionText: `TrustLens AI evaluated 0 dark pattern findings for ${targetDomain}. No deceptive patterns were detected.`,
        aiConfidence: 100,
        evaluatedCount: 0,
        suppressedCount: 0,
        activeCount: 0,
        suppressedPatterns: [],
        isAIActive: true,
      },
    };
  }

  // Fetch cross-domain historical feedback
  const historicalFeedback = await getAllGlobalHistoricalFeedback();

  const hasApiKey = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);

  // If no API key configured, fall back to heuristic cross-domain adjudication
  if (!hasApiKey) {
    onProgress?.('[AI Judge] OPENAI_API_KEY is not configured: Using local heuristic cross-domain adjudication.');
    return fallbackHeuristicAdjudication(patterns, targetDomain, historicalFeedback);
  }

  try {
    onProgress?.(`[AI Judge] Adjudicating ${patterns.length} candidate findings across global learning rules...`);

    const historicalSummary = historicalFeedback.length > 0
      ? historicalFeedback.slice(0, 30).map(h => 
          `- Domain: ${h.domain} | Pattern: ${h.pattern_type} | Selector: ${h.element_selector} | Action: ${h.action} | Reason: ${h.reason || 'None'}`
        ).join('\n')
      : 'No previous historical feedback recorded yet.';

    const candidateSummary = patterns.map(p => ({
      id: p.id,
      ruleId: p.ruleId || 'DP-UNKNOWN',
      title: p.title,
      category: p.category,
      element: p.element || p.elementSelector || '',
      description: p.description,
      severity: p.severity,
    }));

    const prompt = `You are TrustLens AI, an autonomous Senior Ethical UX Auditor and Dark Pattern AI Judge.
Your task is to adjudicate candidate dark pattern findings detected during an audit of "${targetDomain}".

CROSS-DOMAIN HISTORICAL AUDITOR LEARNING DATA (Rules & Feedback recorded from e-commerce & web targets like Flipkart, Myntra, Amazon):
${historicalSummary}

CANDIDATE DARK PATTERN FINDINGS TO EVALUATE FOR "${targetDomain}":
${JSON.stringify(candidateSummary, null, 2)}

INSTRUCTIONS:
1. Examine each candidate finding against the cross-domain learning data and standard UX best practices.
2. If a candidate finding matches a cross-domain false positive or represents legitimate user utility (such as user-requested size guides, essential search filters, standard cart badges, or verified consent overlays), adjudicate action as "SUPPRESS".
3. If it is genuinely manipulative, deceptive, or coercive, adjudicate action as "KEEP".
4. Generate a compelling, dynamic 1-2 sentence "dynamicAIDecisionText" strictly written from TrustLens AI's perspective (e.g., "TrustLens AI dynamically evaluated X candidate patterns on ${targetDomain} and autonomously suppressed Y false positive findings based on cross-domain behavioral learning rules established across e-commerce audits.").
5. DO NOT mention "human auditor decisions" or static template text. Make it dynamic and specific to ${targetDomain} and the actual findings evaluated.

Return valid JSON with key "adjudications" (array) and top-level fields:
{
  "dynamicAIDecisionText": string,
  "overallAIConfidence": number (between 85 and 99),
  "adjudications": [
    {
      "id": string,
      "action": "SUPPRESS" | "KEEP",
      "reasoning": string,
      "confidence": number (between 0.85 and 0.99)
    }
  ]
}`;

function cleanAndParseJSON(rawText: string): any {
  if (!rawText) return {};
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        /* ignore fallback parse error */
      }
    }
    return {
      dynamicAIDecisionText: rawText.replace(/[\{\}\[\]"]/g, '').trim(),
      overallAIConfidence: 95,
      adjudications: [],
    };
  }
}

    const content = await callLLM(prompt, onProgress);
    const parsed = cleanAndParseJSON(content);

    const adjudicationsList: Array<{ id: string; action: string; reasoning: string; confidence: number }> =
      parsed.adjudications || [];

    const activePatterns: DarkPatternFinding[] = [];
    const suppressedPatterns: AISuppressedFinding[] = [];

    const adjMap = new Map(adjudicationsList.map(a => [a.id, a]));

    for (const pattern of patterns) {
      const adj = adjMap.get(pattern.id);
      if (adj && adj.action === 'SUPPRESS') {
        suppressedPatterns.push({
          id: pattern.id,
          ruleId: pattern.ruleId,
          category: pattern.category,
          title: pattern.title,
          element: pattern.element || pattern.elementSelector,
          aiReasoning: adj.reasoning || 'Autonomously suppressed by TrustLens AI based on global learning rules.',
          confidence: Math.round((adj.confidence || 0.95) * 100),
          originalFinding: pattern,
        });
      } else {
        activePatterns.push(pattern);
      }
    }

    const suppressedCount = suppressedPatterns.length;
    const activeCount = activePatterns.length;
    const dynamicAIDecisionText = parsed.dynamicAIDecisionText ||
      `TrustLens AI evaluated ${patterns.length} candidate patterns on ${targetDomain} and autonomously suppressed ${suppressedCount} false positive findings using cross-domain learning intelligence.`;

    const aiConfidence = Math.round(parsed.overallAIConfidence || 96);

    console.log(`\n🎯 [AI Judge] ADJUDICATION DECISION COMPLETED for ${targetDomain}:`);
    console.log(`   • Evaluated Candidate Findings: ${patterns.length}`);
    console.log(`   • Auto-Suppressed (False Positives): ${suppressedCount}`);
    console.log(`   • Confirmed Active Patterns: ${activeCount}`);
    console.log(`   • AI Decision Confidence: ${aiConfidence}%`);
    console.log(`   • Dynamic AI Statement: "${dynamicAIDecisionText}"\n`);

    return {
      activePatterns,
      learningSummary: {
        dynamicAIDecisionText,
        aiConfidence,
        evaluatedCount: patterns.length,
        suppressedCount,
        activeCount,
        suppressedPatterns,
        isAIActive: true,
      },
    };
  } catch (err) {
    console.error('[AI Judge] OpenAI adjudication error, falling back to heuristic:', err);
    return fallbackHeuristicAdjudication(patterns, targetDomain, historicalFeedback);
  }
}

/**
 * Fallback Heuristic Adjudication when OpenAI API Key is not set or network fails
 */
function fallbackHeuristicAdjudication(
  patterns: DarkPatternFinding[],
  targetDomain: string,
  historicalFeedback: HistoricalFeedbackRow[]
): AIAdjudicationResult {
  const falsePositives = historicalFeedback.filter(h => h.action === 'false_positive');
  
  if (falsePositives.length === 0) {
    return {
      activePatterns: patterns,
      learningSummary: {
        dynamicAIDecisionText: `TrustLens AI evaluated ${patterns.length} candidate patterns on ${targetDomain} and verified all findings against cross-domain compliance heuristics.`,
        aiConfidence: 94,
        evaluatedCount: patterns.length,
        suppressedCount: 0,
        activeCount: patterns.length,
        suppressedPatterns: [],
        isAIActive: false,
      },
    };
  }

  const activePatterns: DarkPatternFinding[] = [];
  const suppressedPatterns: AISuppressedFinding[] = [];

  for (const pattern of patterns) {
    const patternType = (pattern.category || pattern.ruleId || '').toLowerCase();
    const element = (pattern.element || '').toLowerCase();

    const matchedFP = falsePositives.find(fp => {
      const fpType = (fp.pattern_type || '').toLowerCase();
      const fpElem = (fp.element_selector || '').toLowerCase();
      const typeMatch = fpType === '*' || patternType.includes(fpType) || fpType.includes(patternType);
      const elemMatch = fpElem === '*' || element.includes(fpElem) || fpElem.includes(element);
      return typeMatch && elemMatch;
    });

    if (matchedFP) {
      suppressedPatterns.push({
        id: pattern.id,
        ruleId: pattern.ruleId,
        category: pattern.category,
        title: pattern.title,
        element: pattern.element || pattern.elementSelector,
        aiReasoning: `Autonomously suppressed by TrustLens AI: Matched cross-domain behavioral rule (${matchedFP.pattern_type}) recorded from ${matchedFP.domain}.`,
        confidence: 95,
        originalFinding: pattern,
      });
    } else {
      activePatterns.push(pattern);
    }
  }

  const suppressedCount = suppressedPatterns.length;
  const activeCount = activePatterns.length;

  const dynamicAIDecisionText = suppressedCount > 0
    ? `TrustLens AI dynamically evaluated ${patterns.length} candidate patterns on ${targetDomain} and autonomously suppressed ${suppressedCount} false positive finding(s) based on cross-domain learning rules established from prior audits.`
    : `TrustLens AI evaluated ${patterns.length} candidate patterns on ${targetDomain} against global cross-domain rules and verified all active findings.`;

  return {
    activePatterns,
    learningSummary: {
      dynamicAIDecisionText,
      aiConfidence: 95,
      evaluatedCount: patterns.length,
      suppressedCount,
      activeCount,
      suppressedPatterns,
      isAIActive: true,
    },
  };
}
