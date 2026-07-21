/**
 * Page Intent Classifier — scores each crawled page on a transactional intent scale.
 * Score 0–10:  0 = generic/nav, 10 = highest-value transactional surface.
 * Used by the dark pattern engine to:
 *  - Focus rule checks only on high-intent pages (reduces false positives on nav pages)
 *  - Sort pages so the most important ones are audited within the page cap
 *  - Label findings with page context ("found on checkout page" vs "found on about page")
 */

export type PageIntentLabel =
  | 'transactional-critical'  // checkout, payment, cancel — score 8-10
  | 'transactional-high'      // pricing, subscribe, cart — score 6-7
  | 'transactional-medium'    // account, settings, signup — score 4-5
  | 'informational'           // product listing, blog, about — score 2-3
  | 'navigational';           // homepage, nav pages, 404 — score 0-1

export interface PageIntentResult {
  url: string;
  score: number;            // 0–10
  label: PageIntentLabel;
  matchedSignals: string[];
}

// Ordered by descending score — first match wins
const INTENT_RULES: { pattern: RegExp; score: number; label: PageIntentLabel; signal: string }[] = [
  // ── Homepage (5) — always include; homepages have cookie banners, consent walls, urgency banners ──
  // Matches full URLs like https://example.com or https://example.com/ (no path) OR /home, /index.html
  { pattern: /^https?:\/\/[^/]+\/?$|\/home\/?$|\/index\.(?:html?|php|aspx?|cfm|jsp)$/i, score: 5, label: 'transactional-medium', signal: 'homepage — highest dark pattern density' },

  // ── Transactional Critical (8–10) ──
  { pattern: /\/(checkout|payment|pay|order-confirm|order-complete|purchase-complete)/i, score: 10, label: 'transactional-critical', signal: 'checkout/payment page' },
  { pattern: /\/(cancel|cancell?ation|unsubscribe|delete-account|close-account|deactivate)/i, score: 9,  label: 'transactional-critical', signal: 'cancellation/off-boarding page' },
  { pattern: /\/(billing|invoice|receipt|refund)/i,                                         score: 8,  label: 'transactional-critical', signal: 'billing/invoice page' },

  // ── Transactional High (6–7) — Insurance/BFSI product & purchase pages ──
  { pattern: /\/(get-quotes?|buy-online|buy-now|renew-policy|renew-now|apply-now|apply-online)/i, score: 8, label: 'transactional-critical', signal: 'insurance/BFSI buy/apply page' },
  { pattern: /\/(quotes?|premium-calculator|calculate|calculator|compare-plans?|compare-quotes?)/i, score: 7, label: 'transactional-high', signal: 'insurance quote/compare page' },
  { pattern: /\/(pricing|plans?|subscribe|subscription|upgrade|downgrade|get-started)/i,    score: 7,  label: 'transactional-high', signal: 'pricing/plans page' },
  { pattern: /\/(cart|basket|bag|add-to-cart)/i,                                            score: 7,  label: 'transactional-high', signal: 'cart/basket page' },
  { pattern: /\/(term-insurance|health-insurance|life-insurance|motor-insurance|car-insurance|bike-insurance|travel-insurance|home-insurance|critical-illness)/i, score: 6, label: 'transactional-high', signal: 'insurance product page' },
  { pattern: /\/(mutual-fund|mf|sip|stocks?|demat|trading|credit-card|personal-loan|home-loan|business-loan)/i, score: 6, label: 'transactional-high', signal: 'financial product page' },
  { pattern: /\/(insurance|policy|cover|coverage|enrol|enroll|nominee|rider|add-on)/i,      score: 6,  label: 'transactional-high', signal: 'insurance policy page' },
  { pattern: /\/(consent|cookie|cookie-settings|gdpr|ccpa|privacy-choices)/i,               score: 6,  label: 'transactional-high', signal: 'consent/cookie settings' },

  // ── Transactional Medium (4–5) ──
  { pattern: /\/(account|my-account|dashboard|profile|settings|preferences)/i,              score: 5,  label: 'transactional-medium', signal: 'account/dashboard page' },
  { pattern: /\/(signup|register|join|create-account|onboarding)/i,                         score: 5,  label: 'transactional-medium', signal: 'signup/registration page' },
  { pattern: /\/(login|sign-in|signin|auth|sso)/i,                                          score: 4,  label: 'transactional-medium', signal: 'login/auth page' },
  { pattern: /\/(notifications?|data-settings|privacy-settings|email-preferences)/i,        score: 4,  label: 'transactional-medium', signal: 'notification/privacy settings' },

  // ── Informational (2–3) ──
  { pattern: /\/(product|item|listing|search|category|collection|shop|store)/i,             score: 3,  label: 'informational', signal: 'product/listing page' },
  { pattern: /\/(blog|article|news|guide|help|faq|support|docs|documentation)/i,            score: 2,  label: 'informational', signal: 'content/support page' },

  // ── Navigational (0–1) ──
  { pattern: /\/(about|contact|careers|press|legal|terms|privacy-policy|sitemap)/i,         score: 1,  label: 'navigational', signal: 'static/legal page' },
];

// DOM signals that boost the score when found in HTML
const DOM_BOOST_SIGNALS: { pattern: RegExp; boost: number; signal: string }[] = [
  { pattern: /input\s+type=['"]?(?:credit-?card|card-?number|cvv|expiry)/i, boost: 3, signal: 'payment form detected' },
  { pattern: /<form[^>]*(?:checkout|payment|subscribe|cancel)/i,            boost: 2, signal: 'checkout/payment/cancel form' },
  { pattern: /(?:checkbox|radio)[^>]*checked/i,                              boost: 2, signal: 'pre-checked input detected' },
  { pattern: /(?:urgency|limited.time|only.*left|selling.fast)/i,           boost: 1, signal: 'urgency language in DOM' },
  { pattern: /(?:free.trial|cancel.anytime|no.commitment)/i,                 boost: 1, signal: 'subscription language in DOM' },
  // Insurance/BFSI DOM boosts
  { pattern: /(?:get.quote|buy.now|renew|premium|sum.assured|insured)/i,    boost: 2, signal: 'insurance transaction language in DOM' },
  { pattern: /(?:₹|rs\.?|inr)\s*[\d,]+/i,                                   boost: 1, signal: 'INR pricing detected' },
];

export function classifyPageIntent(url: string, html?: string): PageIntentResult {
  let score = 0;
  let label: PageIntentLabel = 'navigational';
  const matchedSignals: string[] = [];

  // URL-based classification
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(url)) {
      score = rule.score;
      label = rule.label;
      matchedSignals.push(rule.signal);
      break; // first match wins (rules ordered by score desc)
    }
  }

  // DOM-based boost (only if HTML provided)
  if (html) {
    const snippet = html.substring(0, 15000);
    for (const boost of DOM_BOOST_SIGNALS) {
      if (boost.pattern.test(snippet)) {
        score = Math.min(10, score + boost.boost);
        matchedSignals.push(boost.signal);
      }
    }
    // Re-classify label based on final score
    label = scoreToLabel(score);
  }

  return { url, score, label, matchedSignals };
}

function scoreToLabel(score: number): PageIntentLabel {
  if (score >= 8) return 'transactional-critical';
  if (score >= 6) return 'transactional-high';
  if (score >= 4) return 'transactional-medium';
  if (score >= 2) return 'informational';
  return 'navigational';
}

/**
 * Sort pages by intent score (highest first) — ensures dark pattern engine
 * always audits the most valuable pages within the page cap.
 */
export function sortByIntent(pages: { url: string; html?: string }[]): { url: string; html?: string; intentScore: number; intentLabel: PageIntentLabel }[] {
  return pages
    .map(p => {
      const result = classifyPageIntent(p.url, p.html);
      return { ...p, intentScore: result.score, intentLabel: result.label };
    })
    .sort((a, b) => b.intentScore - a.intentScore);
}

/**
 * Filter pages to only transactional ones — for dark pattern engine focused runs.
 * Falls back to all pages if no transactional pages found.
 */
export function getTransactionalPages<T extends { url: string; html?: string }>(pages: T[]): T[] {
  const transactional = pages.filter(p => {
    const result = classifyPageIntent(p.url, p.html);
    return result.score >= 3; // informational and above — includes product/listing pages (scarcity patterns) and homepage
  });
  return transactional.length > 0 ? transactional : pages;
}
