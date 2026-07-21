/**
 * Site Profiler — classifies a site's business model from its URL + homepage signals.
 * Output is used to:
 *  1. Prime the AI analyzer with business context
 *  2. Select which dark pattern rules apply (e-commerce rules don't apply to SaaS landing pages)
 *  3. Weight findings by regulatory jurisdiction (FCA for fintech, CMA for subscriptions etc.)
 */

export type SiteProfile =
  | 'ecommerce'          // Amazon, ASOS — cart, product listings, checkout
  | 'saas-subscription'  // Notion, Spotify — plans, free trial, upgrade/cancel
  | 'fintech'            // Banks, trading apps — account opening, KYC, fees
  | 'media-news'         // BBC, Guardian — paywalls, cookie consent, newsletter
  | 'travel'             // Booking.com — dynamic pricing, urgency, hidden fees
  | 'marketplace'        // Airbnb, Upwork — two-sided, seller/buyer split
  | 'social'             // LinkedIn, Facebook — data harvesting, notifications
  | 'healthcare'         // NHS, pharmacy — sensitive data, clear consent required
  | 'education'          // Coursera — subscriptions, auto-enroll
  | 'government'         // Gov.uk — accessibility-first, no dark patterns
  | 'enterprise-b2b'     // Salesforce — form-gated content, account required
  | 'unknown';

export interface SiteProfileResult {
  profile: SiteProfile;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  /** Which dark pattern rule categories are most relevant for this profile */
  highRiskPatterns: string[];
  /** Applicable regulatory frameworks */
  regulations: string[];
}

// ── URL signal patterns per profile ──
const URL_SIGNALS: [SiteProfile, RegExp[]][] = [
  ['ecommerce',         [/\/(shop|store|cart|checkout|product|buy|order|basket|bag)/i, /amazon|flipkart|myntra|shopify|magento/i]],
  ['saas-subscription', [/\/(pricing|plans?|billing|upgrade|downgrade|cancel|subscribe)/i, /notion|spotify|slack|zoom|adobe|microsoft/i]],
  ['fintech',           [/\/(account|loan|mortgage|invest|trading|portfolio|transfer|kyc)/i, /bank|pay|finance|credit|fintec|trading/i]],
  ['media-news',        [/\/(article|news|paywall|subscribe|newsletter)/i, /guardian|bbc|times|reuters|bloomberg/i]],
  ['travel',            [/\/(flight|hotel|booking|itinerary|reservation|trip)/i, /booking|expedia|airbnb|makemytrip|goibibo/i]],
  ['marketplace',       [/\/(seller|buyer|listing|bid|gig|freelance)/i, /airbnb|upwork|fiverr|etsy|ebay/i]],
  ['social',            [/\/(feed|profile|connections|notifications|privacy-settings)/i, /linkedin|facebook|instagram|twitter|tiktok/i]],
  ['healthcare',        [/\/(appointment|prescription|health|medical|pharmacy)/i, /nhs|hospital|clinic|pharma|health/i]],
  ['education',         [/\/(course|lesson|enroll|certificate|quiz)/i, /coursera|udemy|byju|edx|khan/i]],
  ['government',        [/\/gov\.|\.gov\./, /gov\.uk|usa\.gov|india\.gov|mygov/i]],
  ['enterprise-b2b',    [/\/(demo|enterprise|solutions|contact-sales|request-a-quote)/i, /salesforce|hubspot|sap|oracle|b2b/i]],
];

const PROFILE_RISK_MAP: Record<SiteProfile, { patterns: string[]; regulations: string[] }> = {
  'ecommerce':         { patterns: ['sneak-into-basket', 'hidden-costs', 'fake-urgency', 'fake-scarcity', 'pre-ticked-checkboxes'], regulations: ['EU DSA Art. 25', 'FTC Act §5', 'Consumer Protection Act 2015', 'BIS Guidelines'] },
  'saas-subscription': { patterns: ['roach-motel', 'forced-continuity', 'hidden-costs', 'confirmshaming', 'trick-questions'], regulations: ['FTC Click-to-Cancel Rule', 'CMA Subscription Trap Guidelines', 'EU DSA Art. 25'] },
  'fintech':           { patterns: ['hidden-costs', 'trick-questions', 'privacy-zuckering', 'misleading-ads'], regulations: ['FCA Consumer Duty', 'RBI Master Directions', 'SEBI Guidelines', 'GDPR Art. 7'] },
  'media-news':        { patterns: ['confirmshaming', 'roach-motel', 'consent-walls', 'pre-ticked-checkboxes'], regulations: ['GDPR Art. 7', 'DPDPA 2023', 'ePrivacy Directive'] },
  'travel':            { patterns: ['hidden-costs', 'fake-urgency', 'fake-scarcity', 'disguised-ads'], regulations: ['EU Package Travel Directive', 'CMA Pricing Guidelines', 'FTC Act §5'] },
  'marketplace':       { patterns: ['disguised-ads', 'fake-scarcity', 'hidden-costs', 'social-proof-manipulation'], regulations: ['EU DSA Art. 25', 'CMA Digital Markets', 'FTC Act §5'] },
  'social':            { patterns: ['privacy-zuckering', 'trick-questions', 'roach-motel', 'confirmshaming'], regulations: ['GDPR Art. 25', 'DPDPA 2023', 'CCPA §1798.100'] },
  'healthcare':        { patterns: ['trick-questions', 'privacy-zuckering', 'hidden-costs'], regulations: ['HIPAA', 'DPDPA 2023 §9', 'GDPR Art. 9'] },
  'education':         { patterns: ['forced-continuity', 'roach-motel', 'confirmshaming'], regulations: ['FTC COPPA', 'EU DSA Art. 25', 'CMA Guidelines'] },
  'government':        { patterns: [], regulations: ['WCAG 2.2 AA', 'EN 301 549', 'Section 508', 'GDS Standards'] },
  'enterprise-b2b':    { patterns: ['trick-questions', 'hidden-costs', 'disguised-ads'], regulations: ['FTC Act §5', 'GDPR Art. 13'] },
  'unknown':           { patterns: ['hidden-costs', 'pre-ticked-checkboxes', 'fake-urgency', 'roach-motel'], regulations: ['EU DSA Art. 25', 'FTC Act §5'] },
};

export function classifySite(url: string, htmlSnippet?: string): SiteProfileResult {
  const signals: string[] = [];
  const scores: Partial<Record<SiteProfile, number>> = {};

  for (const [profile, patterns] of URL_SIGNALS) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        scores[profile] = (scores[profile] || 0) + 2;
        signals.push(`URL matches ${profile} pattern`);
      }
      if (htmlSnippet && pattern.test(htmlSnippet.substring(0, 5000))) {
        scores[profile] = (scores[profile] || 0) + 1;
        signals.push(`Page content matches ${profile} signals`);
      }
    }
  }

  // Find best match
  let best: SiteProfile = 'unknown';
  let bestScore = 0;
  for (const [p, s] of Object.entries(scores) as [SiteProfile, number][]) {
    if (s > bestScore) { bestScore = s; best = p; }
  }

  const confidence = bestScore >= 4 ? 'high' : bestScore >= 2 ? 'medium' : 'low';
  const risk = PROFILE_RISK_MAP[best];

  return {
    profile: best,
    confidence,
    signals: signals.slice(0, 5),
    highRiskPatterns: risk.patterns,
    regulations: risk.regulations,
  };
}
