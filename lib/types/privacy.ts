// ============================================================
// KPMG TrustLens — Privacy & Compliance Types
// ============================================================

export type PrivacyRegulation = 'GDPR' | 'CCPA' | 'ePrivacy' | 'PECR' | 'LGPD' | 'IN-DPDPA' | 'IN-RBI';

export type PrivacyFindingCategory =
  | 'cookie-consent'         // Missing or broken consent mechanism
  | 'third-party-tracker'    // Unauthorized tracking scripts
  | 'data-collection'        // Excessive data collection
  | 'privacy-policy'         // Missing or inadequate privacy policy
  | 'mixed-content'          // HTTP resources on HTTPS page
  | 'data-storage'           // Excessive localStorage/sessionStorage
  | 'cross-origin'           // Unclassified cross-origin requests
  | 'consent-mechanism'      // Consent banner functionality issues
  | 'fingerprinting'         // Canvas/WebGL fingerprinting detection
  | 'security-header'        // Missing security headers (HSTS, CSP)
  | 'data-minimization';     // Excessive fields for purpose

export interface PrivacyFinding {
  id: string;
  category: PrivacyFindingCategory;
  title: string;
  description: string;
  pageUrl: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  regulation: PrivacyRegulation[];
  recommendation: string;
  evidence: {
    summary: string;
    details: string[];
  };
  /** Optional management response / owner acknowledgement notes (per-issue) */
  managementResponse?: import('./audit').ManagementResponseBlock;
}

// ── Cookie Classification ──
export type CookiePurpose = 'necessary' | 'analytics' | 'marketing' | 'functional' | 'unknown';

export interface CookieInfo {
  name: string;
  domain: string;
  path: string;
  purpose: CookiePurpose;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expires: string | null;
}

// ── Tracker Detection ──
export interface TrackerInfo {
  domain: string;
  company: string;
  category: 'analytics' | 'advertising' | 'social' | 'other';
  pageUrls: string[];
  requestCount: number;
}

// Known tracker domains for classification
export const KNOWN_TRACKERS: Record<string, { company: string; category: TrackerInfo['category'] }> = {
  'google-analytics.com':     { company: 'Google',    category: 'analytics' },
  'googletagmanager.com':     { company: 'Google',    category: 'analytics' },
  'analytics.google.com':     { company: 'Google',    category: 'analytics' },
  'doubleclick.net':          { company: 'Google',    category: 'advertising' },
  'googlesyndication.com':    { company: 'Google',    category: 'advertising' },
  'googleadservices.com':     { company: 'Google',    category: 'advertising' },
  'facebook.net':             { company: 'Meta',      category: 'social' },
  'facebook.com':             { company: 'Meta',      category: 'social' },
  'connect.facebook.net':     { company: 'Meta',      category: 'social' },
  'fbcdn.net':                { company: 'Meta',      category: 'social' },
  'hotjar.com':               { company: 'Hotjar',    category: 'analytics' },
  'clarity.ms':               { company: 'Microsoft', category: 'analytics' },
  'tiktok.com':               { company: 'TikTok',    category: 'advertising' },
  'analytics.tiktok.com':     { company: 'TikTok',    category: 'analytics' },
  'snap.com':                 { company: 'Snap',      category: 'advertising' },
  'twitter.com':              { company: 'X/Twitter', category: 'social' },
  'linkedin.com':             { company: 'LinkedIn',  category: 'social' },
  'ads-twitter.com':          { company: 'X/Twitter', category: 'advertising' },
  'criteo.com':               { company: 'Criteo',    category: 'advertising' },
  'amazon-adsystem.com':      { company: 'Amazon',    category: 'advertising' },
  'mixpanel.com':             { company: 'Mixpanel',  category: 'analytics' },
  'segment.io':               { company: 'Segment',   category: 'analytics' },
  'segment.com':              { company: 'Segment',   category: 'analytics' },
  'amplitude.com':            { company: 'Amplitude', category: 'analytics' },
  'heap.io':                  { company: 'Heap',      category: 'analytics' },
  'fullstory.com':            { company: 'FullStory', category: 'analytics' },
  'intercom.io':              { company: 'Intercom',  category: 'analytics' },
  'hubspot.com':              { company: 'HubSpot',   category: 'analytics' },
  'mouseflow.com':            { company: 'Mouseflow', category: 'analytics' },
  'newrelic.com':             { company: 'New Relic', category: 'analytics' },
  'sentry.io':                { company: 'Sentry',    category: 'analytics' },
};

// ── Aggregated Privacy Result ──
export interface PrivacyResult {
  findings: PrivacyFinding[];
  overallScore: number;                 // 0-100
  cookies: CookieInfo[];
  cookiesByPurpose: Record<CookiePurpose, number>;
  trackers: TrackerInfo[];
  totalTrackers: number;
  hasConsentBanner: boolean;
  hasPrivacyPolicy: boolean;
  hasMixedContent: boolean;
  regulatoryRisks: PrivacyRegulation[];
  findingsBySeverity: Record<string, number>;
  pagesScanned: number;
}
