// ============================================================
// KPMG TrustLens — Performance & Core Web Vitals Types
// ============================================================

export interface CoreWebVitals {
  lcp: number | null;     // Largest Contentful Paint (ms)
  cls: number | null;     // Cumulative Layout Shift (score)
  inp: number | null;     // Interaction to Next Paint (ms)
  ttfb: number | null;    // Time to First Byte (ms)
  tbt: number | null;     // Total Blocking Time (ms)
  fcp: number | null;     // First Contentful Paint (ms)
}

export type ResourceIssueType =
  | 'unoptimized-image'         // Large/uncompressed images
  | 'render-blocking-css'       // CSS blocking first paint
  | 'render-blocking-js'        // JS blocking first paint
  | 'no-lazy-loading'           // Images without lazy loading
  | 'large-bundle'              // Oversized JS bundles
  | 'no-compression'            // Missing gzip/brotli
  | 'no-caching'                // Missing cache headers
  | 'excessive-dom'             // Too many DOM nodes
  | 'excessive-requests'        // Too many HTTP requests
  // ── Network & Caching ──
  | 'missing-cache-headers'     // No Cache-Control/ETag
  | 'missing-compression'       // No gzip/brotli on text resources
  | 'http1-usage'               // Not using HTTP/2+
  | 'duplicate-requests'        // Same resource loaded multiple times
  // ── JS Execution ──
  | 'long-tasks'                // Main thread blocking > 50ms
  | 'sync-scripts'              // Missing async/defer on scripts
  | 'third-party-impact'        // Slow third-party JS (legacy aggregate)
  // ── Rendering ──
  | 'font-loading'              // FOUT/FOIT flash
  // ── Mobile ──
  | 'missing-viewport'          // Missing responsive viewport meta
  | 'small-touch-target'        // Interactive elements < 44px
  // ── Layer G: Auth Flow ──
  | 'auth-flow-slow'            // Login round-trip > 3s
  | 'auth-form-no-autocomplete' // Missing autocomplete attributes
  | 'otp-page-heavy'            // OTP/2FA page too heavy on mobile
  | 'post-login-redirect-slow'  // > 2s after auth to reach dashboard
  // ── Layer H: Interaction ──
  | 'interaction-lag'           // CTA response > 100ms
  | 'search-filter-lag'         // Search/filter results > 300ms
  // ── Layer I: Network Simulation ──
  | 'slow-on-3g'                // Score drops > 30 pts on Slow 3G
  | 'no-offline-fallback'       // No service worker / offline cache
  // ── Layer J: Third-Party Impact ──
  | 'third-party-slow'          // Individual 3P script load > 500ms
  | 'third-party-blocking'      // 3P script blocks main thread
  // ── Layer K: Architecture ──
  | 'missing-cdn'               // No CDN detected on static assets
  | 'outdated-http'             // Still on HTTP/1.1
  // ── Layer L: Technical SEO ──
  | 'missing-meta-tags'         // No title / meta description
  | 'missing-sitemap'           // No /sitemap.xml
  | 'no-structured-data'        // No JSON-LD / schema.org
  | 'missing-canonical'         // No canonical link
  | 'broken-links'              // 404 responses detected
  // ── Layer M: Front-end Best Practices ──
  | 'missing-preload'           // Key resources not preloaded
  | 'missing-prefetch'          // No next-page prefetch hints
  | 'no-service-worker'         // PWA / offline readiness missing
  // ── Layer M: UX Performance ──
  | 'no-loading-indicator'      // No spinner / progress during load
  | 'no-skeleton-screen'        // Blank content during data fetch
  | 'scroll-jank'               // Dropped frames during scroll
  | 'animation-jank'            // CSS animations below 60fps
  | 'form-response-lag'         // Input-to-feedback > 100ms
  | 'nav-response-lag'          // Nav click-to-DOM-change > 300ms
  | 'search-response-lag'       // Search query-to-results > 500ms
  | 'no-page-transition'        // SPA has no transition animation
  | 'layout-instability-on-interact'; // CLS triggered by user interaction

export interface ResourceIssue {
  type: ResourceIssueType;
  url: string;
  pageUrl: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  metrics?: Record<string, string | number>;
  businessImpact?: {
    bounceRateRisk: 'low' | 'medium' | 'high';
    conversionImpact: string;
    seoImpact: string;
    userExperienceImpact: string;
  };
  managementResponse?: import('./audit').ManagementResponseBlock;
}

export interface PagePerformance {
  url: string;
  title: string;
  vitals: CoreWebVitals;
  score: number;               // 0-100
  resourceIssues: ResourceIssue[];
  totalTransferSize: number;   // bytes
  totalRequests: number;
  domNodes: number;
  loadTime: number;            // ms
}

// Thresholds based on Google's Core Web Vitals guidelines
export const CWV_THRESHOLDS = {
  lcp:  { good: 2500, poor: 4000 },     // ms
  cls:  { good: 0.1,  poor: 0.25 },     // score
  inp:  { good: 200,  poor: 500 },      // ms
  ttfb: { good: 800,  poor: 1800 },     // ms
  tbt:  { good: 200,  poor: 600 },      // ms
  fcp:  { good: 1800, poor: 3000 },     // ms
} as const;

// ── Problem Context (client-reported performance issues) ─────────

export type PerformanceFlag =
  | 'perf-slow-load'        // "Site loads too slowly"
  | 'perf-login'            // "Login / authentication is slow or broken"
  | 'perf-otp'              // "OTP / 2FA page takes too long"
  | 'perf-mobile'           // "Poor mobile / 3G experience"
  | 'perf-timeout'          // "Pages hang or time out"
  | 'perf-checkout'         // "Checkout or payment flow is slow"
  | 'perf-search'           // "Search / filter is sluggish"
  | 'perf-calculator'       // "Calculator or form tool is unresponsive"
  | 'perf-pdf-download'     // "PDF / statement download hangs"
  | 'perf-session-expiry';  // "Session logs out too quickly"

export const PERF_FLAG_LABELS: Record<PerformanceFlag, string> = {
  'perf-slow-load':       'Site loads too slowly',
  'perf-login':           'Login / auth is slow or broken',
  'perf-otp':             'OTP / 2FA takes too long',
  'perf-mobile':          'Poor mobile / 3G experience',
  'perf-timeout':         'Pages hang or time out',
  'perf-checkout':        'Checkout / payment flow slow',
  'perf-search':          'Search / filter is sluggish',
  'perf-calculator':      'Calculator unresponsive',
  'perf-pdf-download':    'PDF / download hangs',
  'perf-session-expiry':  'Session logs out too fast',
};

export const PERF_FLAG_ICONS: Record<PerformanceFlag, string> = {
  'perf-slow-load':       '🐢',
  'perf-login':           '🔐',
  'perf-otp':             '🔢',
  'perf-mobile':          '📱',
  'perf-timeout':         '⏱️',
  'perf-checkout':        '💳',
  'perf-search':          '🔍',
  'perf-calculator':      '🧮',
  'perf-pdf-download':    '📄',
  'perf-session-expiry':  '⏰',
};

export interface PerformanceProblemContext {
  flags: PerformanceFlag[];
  freeText?: string;
  parsedAt?: string;
}

// ── Layer G: Auth Flow Timing ────────────────────────────────────

export interface AuthFlowResult {
  loginUrl: string;
  timeToFormMs: number | null;
  submitToResponseMs: number | null;
  responseToInteractiveMs: number | null;
  totalRoundTripMs: number | null;
  status: 'pass' | 'slow' | 'critical' | 'failed' | 'skipped';
  issues: ResourceIssue[];
  otpPageLoadMs?: number | null;
}

// ── Layer I: Network Simulation ──────────────────────────────────

export interface NetworkSimResult {
  preset: 'desktop' | 'fast-4g' | 'slow-4g' | 'fast-3g' | 'slow-3g';
  label: string;
  downloadMbps: number;
  latencyMs: number;
  lcp: number | null;
  fcp: number | null;
  ttfb: number | null;
  loadTimeMs: number | null;
  score: number | null;
}

// ── Client Issue Confirmation ────────────────────────────────────

export interface ConfirmedClientIssue {
  flag: PerformanceFlag;
  flagLabel: string;
  status: 'confirmed' | 'partial' | 'not-found';
  summary: string;
  evidence: string;
  /** Action item the team should take in response to this flag's verification result */
  recommendation: string;
}

// ── Layer J: Third-Party Impact ──────────────────────────────────

export type ThirdPartyCategory =
  | 'analytics'
  | 'marketing-tag'
  | 'chat-widget'
  | 'social'
  | 'external-api'
  | 'font'
  | 'video'
  | 'other';

export interface ThirdPartyImpact {
  url: string;
  domain: string;
  label: string;
  category: ThirdPartyCategory;
  loadTimeMs: number | null;
  transferSize: number;     // bytes
  blocking: boolean;        // blocks main thread
  async: boolean;           // has async/defer attribute
  recommendation: 'remove' | 'defer' | 'keep';
}

// ── Layer K: Technical Architecture ──────────────────────────────

export interface ArchitectureInfo {
  framework: string | null;        // 'Next.js', 'React', 'Angular', 'Vue', etc.
  cms: string | null;              // 'WordPress', 'Contentful', 'Drupal', etc.
  cdn: string | null;              // 'Cloudflare', 'Fastly', 'Akamai', 'AWS CloudFront'
  httpVersion: 'HTTP/1.1' | 'HTTP/2' | 'HTTP/3' | null;
  jsLibraries: string[];
  cssFrameworks: string[];
  hostingPlatform: string | null;  // 'Vercel', 'AWS', 'Azure', 'GCP', 'Railway', etc.
  hasServiceWorker: boolean;
  hasPwaManifest: boolean;
  hasResourceHints: boolean;       // preload / prefetch / preconnect
}

// ── Layer L: Technical SEO Readiness ─────────────────────────────

export interface SeoReadiness {
  hasMetaTitle: boolean;
  hasMetaDescription: boolean;
  hasRobotsTxt: boolean | null;    // null = fetch failed
  hasSitemap: boolean | null;      // null = fetch failed
  hasCanonical: boolean;
  hasStructuredData: boolean;
  hasOpenGraph: boolean;
  metaTitleLength: number | null;
  metaDescriptionLength: number | null;
  brokenLinks: string[];
  issues: SeoIssue[];
}

export interface SeoIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
  recommendation: string;
}

// ── Layer M: UX Performance ───────────────────────────────────────

export interface UXPerformanceResult {
  score: number;           // 0–100 weighted composite

  initialLoadExperience: {
    score: number;
    hasLoadingIndicator: boolean;
    hasSkeletonScreens: boolean;
    hasProgressiveLoading: boolean;
    timeToInteractiveMs: number | null;
  };

  visualStability: {
    score: number;
    clsDuringInteractionMs: number | null;
    layoutJankScore: 'none' | 'minor' | 'major';
  };

  responsiveness: {
    score: number;
    mobileUsabilityScore: number | null;
    navigationResponseMs: number | null;
    formResponseMs: number | null;
    searchResponseMs: number | null;
  };

  animationPerformance: {
    score: number;
    scrollJank: boolean;
    animationFps: number | null;
    pageTransitionMs: number | null;
    smoothnessScore: 'smooth' | 'minor-jank' | 'janky';
  };

  painPoints: UXPainPoint[];
  improvementOpportunities: UXImprovement[];
  issues: ResourceIssue[];  // mapped to standard ResourceIssue for report aggregation
}

export interface UXPainPoint {
  area: 'loading' | 'stability' | 'responsiveness' | 'animation' | 'mobile';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  userImpact: string;
}

export interface UXImprovement {
  area: string;
  recommendation: string;
  expectedUplift: string;
  effort: 'Quick (hours)' | 'Medium (days)' | 'Sprint (weeks)';
}

// ── AI Performance Report ─────────────────────────────────────────

export interface AIRecommendation {
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  description: string;
  rootCause: string;
  whyItMatters: string;
  businessImpact: string;
  recommendation: string;
  estimatedEffort: 'Quick (hours)' | 'Medium (days)' | 'Sprint (weeks)';
  expectedImprovement: string;
  sampleCode?: string;
  estimatedROI?: string;
  issueType?: ResourceIssueType;
}

export interface DevTicket {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  labels: string[];
  storyPoints: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
}

export interface AIPerformanceReport {
  executiveSummary: string;      // 3-sentence C-suite narrative
  developerSummary: string;      // technical root cause overview
  uxNarrative: string;           // plain-language UX pain point summary for PMs
  businessImpactNarrative: string;
  overallROI: string;            // aggregate ROI estimate
  recommendations: AIRecommendation[];
  devTickets: DevTicket[];
  generatedAt: string;
}

// ── Full Performance Result ──────────────────────────────────────

export interface PerformanceResult {
  pages: PagePerformance[];
  overallScore: number;
  averageVitals: CoreWebVitals;
  totalResourceIssues: number;
  resourceIssuesByType: Record<string, number>;
  recommendations: RecommendationItem[];
  // Page coverage breakdown — `pages.length` = basePagesAudited + targetedPagesAudited
  basePagesAudited?: number;      // pages from the site-wide crawl (bounded by config.maxPages)
  targetedPagesAudited?: number;  // extra pages added from client-reported problem flags (e.g. /login, /checkout)
  // Context-aware additions
  authFlow?: AuthFlowResult;
  networkSimulation?: NetworkSimResult[];
  clientReportedFlags?: PerformanceFlag[];
  confirmedClientIssues?: ConfirmedClientIssue[];
  // Enterprise layers
  thirdPartyImpact?: ThirdPartyImpact[];
  architecture?: ArchitectureInfo;
  seoReadiness?: SeoReadiness;
  uxPerformance?: UXPerformanceResult;
  aiReport?: AIPerformanceReport;
}

export interface RecommendationItem {
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  title: string;
  detail: string;
  effort: 'Quick (hours)' | 'Medium (days)' | 'Sprint (weeks)';
  impact: 'Critical' | 'High' | 'Medium' | 'Low';
  // Enterprise fields (populated by AI analyzer)
  rootCause?: string;
  whyItMatters?: string;
  businessImpact?: string;
  expectedImprovement?: string;
  sampleCode?: string;
  estimatedROI?: string;
  clientReported?: boolean;
  issueType?: ResourceIssueType;
}
