// ============================================================
// KPMG TrustLens — Performance Problem Parser (Claude AI)
// Maps free-text client complaints → PerformanceFlag[]
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type { PerformanceFlag } from '../types/performance';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FLAG_DESCRIPTIONS: Record<PerformanceFlag, string> = {
  'perf-slow-load':      'general slow page loading, long wait times, site feels heavy',
  'perf-login':          'login form slow, authentication broken, sign-in page issues, account access slow',
  'perf-otp':            'OTP code page slow, 2FA verification delay, one-time password timeout, SMS OTP wait',
  'perf-mobile':         'mobile site slow, 3G issues, bad on phone, mobile data, rural network, BSNL, Jio',
  'perf-timeout':        'pages hang, site freezes, timeout errors, requests not completing, browser spinning',
  'perf-checkout':       'payment page slow, checkout hangs, cart slow, order placement delay, payment gateway',
  'perf-search':         'search is slow, filter results delayed, autocomplete laggy, search bar unresponsive',
  'perf-calculator':     'EMI calculator slow, premium calculator unresponsive, quote tool laggy, form calculation delay',
  'perf-pdf-download':   'PDF takes too long, statement download hangs, document download slow, file download fails',
  'perf-session-expiry': 'session logs out too fast, kicked out unexpectedly, session timeout too short',
};

export async function parsePerfProblemText(text: string): Promise<{
  flags: PerformanceFlag[];
  confidence: Partial<Record<PerformanceFlag, number>>;
  reasoning: string;
}> {
  if (!text.trim()) return { flags: [], confidence: {}, reasoning: 'No text provided' };

  const flagList = Object.entries(FLAG_DESCRIPTIONS)
    .map(([flag, desc]) => `- ${flag}: ${desc}`)
    .join('\n');

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are a performance audit classifier for a web audit tool used by KPMG auditors.
Given a client problem description, identify which performance flags apply.
Return ONLY valid JSON with this shape:
{
  "flags": ["flag-id", ...],
  "confidence": { "flag-id": 0.0-1.0, ... },
  "reasoning": "one sentence"
}

Available flags:
${flagList}

Rules:
- Only include flags with confidence >= 0.5
- A description can match multiple flags
- If nothing matches, return empty flags array
- Do not invent new flags`,
      messages: [{ role: 'user', content: `Client complaint: "${text}"` }],
    });

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { flags: [], confidence: {}, reasoning: 'Parse failed' };

    const parsed = JSON.parse(jsonMatch[0]);
    const flags: PerformanceFlag[] = (parsed.flags || []).filter((f: string) => f in FLAG_DESCRIPTIONS);
    const confidence: Partial<Record<PerformanceFlag, number>> = {};
    for (const f of flags) {
      confidence[f as PerformanceFlag] = parsed.confidence?.[f] ?? 0.8;
    }
    return { flags, confidence, reasoning: parsed.reasoning || '' };
  } catch (err) {
    console.error('[ProblemParser] Error:', err);
    return { flags: [], confidence: {}, reasoning: 'AI parsing unavailable' };
  }
}
