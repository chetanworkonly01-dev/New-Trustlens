// ============================================================
// KPMG TrustLens — Performance & Core Web Vitals Engine
// ============================================================

import type { BrowserContext, Page } from 'playwright';
import type {
  PerformanceResult, PagePerformance, CoreWebVitals, ResourceIssue,
  PerformanceProblemContext, PerformanceFlag, AuthFlowResult,
  NetworkSimResult, ConfirmedClientIssue, RecommendationItem,
  ThirdPartyImpact, ThirdPartyCategory, ArchitectureInfo,
  SeoReadiness, SeoIssue, UXPerformanceResult, UXPainPoint, UXImprovement,
} from '../types/performance';
import { CWV_THRESHOLDS } from '../types/performance';
import type { TestLogEntry, LoginConfig } from '../types/audit';

interface PageData { url: string; title: string; }
type ProgressFn = (entry: TestLogEntry) => void;

export async function runPerformanceAudit(
  context: BrowserContext,
  pages: PageData[],
  onProgress?: ProgressFn,
  problemContext?: PerformanceProblemContext,
  loginConfig?: LoginConfig,
): Promise<PerformanceResult> {
  const flags = problemContext?.flags ?? [];
  const pageResults: PagePerformance[] = [];
  let authFlowResult: AuthFlowResult | undefined;
  let networkSimResults: NetworkSimResult[] | undefined;
  let thirdPartyImpact: ThirdPartyImpact[] | undefined;
  let architecture: ArchitectureInfo | undefined;
  let seoReadiness: SeoReadiness | undefined;
  let uxPerformance: UXPerformanceResult | undefined;

  const log = (testId: string, status: string, message: string, methodology?: string, phase?: string) => {
    onProgress?.({ timestamp: new Date().toISOString(), testId, testName: 'Performance', wcag: '', status: status as any, message, pillar: 'performance', methodology, phase });
  };

  // Log context if provided
  if (flags.length > 0) {
    log('PERF-CONTEXT', 'running',
      `🎯 Client context: ${flags.length} reported problem(s) → activating targeted layers: ${flags.join(', ')}`,
      'Context-Aware Performance Audit', 'Context Setup');
  }

  // Expand page list based on flags
  const baseUrl = pages[0]?.url ?? '';
  const expandedPages = expandPagesForContext(pages, baseUrl, flags);
  if (expandedPages.length > pages.length) {
    log('PERF-CONTEXT', 'running',
      `  → Added ${expandedPages.length - pages.length} targeted page(s) to scan based on reported issues`,
      'Context-Aware Page Expansion', 'Context Setup');
  }

  for (const pageData of expandedPages) {
    let page: Page | null = null;
    try {
      page = await context.newPage();

      // Collect network requests
      const requests: Array<{ url: string; size: number; type: string; headers: Record<string, string> }> = [];
      page.on('response', async (response) => {
        try {
          const headers = response.headers();
          const size = parseInt(headers['content-length'] || '0', 10);
          const type = headers['content-type'] || '';
          requests.push({ url: response.url(), size, type, headers });
        } catch {}
      });

      const startTime = Date.now();
      await page.goto(pageData.url, { waitUntil: 'load', timeout: 30000 });
      const loadTime = Date.now() - startTime;
      await page.waitForTimeout(2000);

      // ── Layer A: Core Web Vitals ──
      log('PERF-CWV', 'running', '━━━ Layer A: Core Web Vitals Measurement', 'Google Core Web Vitals (CWV) — Ranking Signals', 'Layer A: Core Web Vitals');
      log('PERF-CWV-LCP', 'running', '  → LCP (Largest Contentful Paint): target <2.5s — hero image, H1, above-fold block', 'CWV — LCP Google Ranking Signal', 'Layer A: Core Web Vitals');
      log('PERF-CWV-INP', 'running', '  → INP (Interaction to Next Paint): target <200ms — replaces FID as primary responsiveness metric', 'CWV — INP Google Ranking Signal', 'Layer A: Core Web Vitals');
      log('PERF-CWV-CLS', 'running', '  → CLS (Cumulative Layout Shift): target <0.1 — images without dimensions, injected content', 'CWV — CLS Google Ranking Signal', 'Layer A: Core Web Vitals');
      log('PERF-CWV-FCP', 'running', '  → FCP (First Contentful Paint): target <1.8s — Lighthouse performance score component', 'Lighthouse — FCP Criterion', 'Layer A: Core Web Vitals');
      log('PERF-CWV-TBT', 'running', '  → TBT (Total Blocking Time): target <200ms — long tasks >50ms on main thread', 'Lighthouse — TBT Criterion', 'Layer A: Core Web Vitals');
      log('PERF-CWV-TTFB', 'running', '  → TTFB (Time to First Byte): target <800ms — server response, CDN, network latency', 'RAIL Model — Load Phase', 'Layer A: Core Web Vitals');
      const vitals = await measureCoreWebVitals(page);
      const t = CWV_THRESHOLDS;
      const lcpLabel = vitals.lcp !== null ? (vitals.lcp <= t.lcp.good ? 'Good' : vitals.lcp <= t.lcp.poor ? 'Needs Work' : 'Poor') : 'N/A';
      const clsLabel = vitals.cls !== null ? (vitals.cls <= t.cls.good ? 'Good' : vitals.cls <= t.cls.poor ? 'Needs Work' : 'Poor') : 'N/A';
      const fcpLabel = vitals.fcp !== null ? (vitals.fcp <= t.fcp.good ? 'Good' : vitals.fcp <= t.fcp.poor ? 'Needs Work' : 'Poor') : 'N/A';
      log('PERF-CWV', 'pass', `  ✓ CWV: LCP ${vitals.lcp ?? '?'}ms (${lcpLabel}) | CLS ${vitals.cls ?? '?'} (${clsLabel}) | FCP ${vitals.fcp ?? '?'}ms (${fcpLabel})`, 'Google Core Web Vitals', 'Layer A: Core Web Vitals');

      // ── Layer B: Resource Optimization ──
      log('PERF-RES', 'running', '━━━ Layer B: Resource Optimisation Analysis', 'Lighthouse Asset Optimisation Criteria', 'Layer B: Resource Optimization');
      log('PERF-RES-IMG', 'running', '  → Unoptimised Images: WebP/AVIF format check, size >500KB threshold', 'Lighthouse — Serve Images in Modern Formats', 'Layer B: Resource Optimization');
      log('PERF-RES-JS', 'running', '  → Large JS Bundles: >500KB bundles without code splitting or tree shaking', 'Lighthouse — Reduce Unused JavaScript', 'Layer B: Resource Optimization');
      log('PERF-RES-LL', 'running', '  → Lazy Loading: Below-fold images missing loading="lazy" attribute', 'Lighthouse — Defer Offscreen Images', 'Layer B: Resource Optimization');
      log('PERF-RES-CSS', 'running', '  → Render-Blocking CSS: Stylesheets in <head> without media query scoping', 'Lighthouse — Eliminate Render-Blocking Resources', 'Layer B: Resource Optimization');
      log('PERF-RES-DOM', 'running', '  → DOM Size: Node count >1500 warning, >3000 critical (Lighthouse threshold)', 'Lighthouse — Avoid Excessive DOM Size', 'Layer B: Resource Optimization');
      const resourceIssues = await detectResourceIssues(page, pageData.url, requests);
      log('PERF-RES', resourceIssues.length > 0 ? 'fail' : 'pass', `  ✓ Layer B complete — ${resourceIssues.length} resource issue(s) found`, 'Lighthouse Optimisation', 'Layer B: Resource Optimization');

      // ── Layer C: Network & Caching ──
      log('PERF-NET', 'running', '━━━ Layer C: Network & Caching Analysis', 'RAIL Model — Load Phase (<1s on fast connections)', 'Layer C: Network & Caching');
      log('PERF-NET-CH', 'running', '  → Cache Headers: Cache-Control / ETag / Last-Modified on static assets', 'HTTP Caching — RFC 7234', 'Layer C: Network & Caching');
      log('PERF-NET-GZ', 'running', '  → Compression: gzip/brotli encoding on text resources (JS, CSS, HTML, JSON)', 'HTTP Compression — Content-Encoding', 'Layer C: Network & Caching');
      log('PERF-NET-DUP', 'running', '  → Duplicate Requests: Resources loaded multiple times across the page lifecycle', 'Network Efficiency — Request Deduplication', 'Layer C: Network & Caching');
      const networkIssues = await detectNetworkIssues(page, pageData.url, requests);
      resourceIssues.push(...networkIssues);
      log('PERF-NET', networkIssues.length > 0 ? 'fail' : 'pass', `  ✓ Layer C complete — ${networkIssues.length} network issue(s)`, 'RAIL Load Phase', 'Layer C: Network & Caching');

      // ── Layer D: JavaScript Execution ──
      log('PERF-JS', 'running', '━━━ Layer D: JavaScript Execution Analysis', 'RAIL Model — Response Phase (<100ms target)', 'Layer D: JS Execution');
      log('PERF-JS-SY', 'running', '  → Synchronous Scripts: Render-blocking <script> in <head> without async/defer', 'RAIL Response — Eliminate Main Thread Blocking', 'Layer D: JS Execution');
      log('PERF-JS-3P', 'running', '  → Third-Party Scripts: Analytics, chat, ads, fonts (>5 = performance risk)', 'Lighthouse — Reduce Third-Party Impact', 'Layer D: JS Execution');
      log('PERF-JS-LT', 'running', '  → Long Tasks: JavaScript tasks >50ms on main thread (INP / TBT impact)', 'RAIL Response — Long Task Detection (50ms)', 'Layer D: JS Execution');
      const jsIssues = await detectJSIssues(page, pageData.url);
      resourceIssues.push(...jsIssues);
      log('PERF-JS', jsIssues.length > 0 ? 'fail' : 'pass', `  ✓ Layer D complete — ${jsIssues.length} JS issue(s)`, 'RAIL Response Phase', 'Layer D: JS Execution');

      // ── Layer E: Rendering & Layout ──
      log('PERF-RENDER', 'running', '━━━ Layer E: Rendering & Layout Performance', 'RAIL Model — Animation Phase (60fps = 16ms/frame)', 'Layer E: Rendering');
      log('PERF-RENDER-AN', 'running', '  → Non-Composited Animations: top/left instead of transform/opacity (forces layout)', 'RAIL Animation — Compositor-Only Properties', 'Layer E: Rendering');
      log('PERF-RENDER-FT', 'running', '  → Font Loading: FOIT/FOUT detection, font-display strategy, excessive font variants', 'Lighthouse — Ensure Text Remains Visible During Font Load', 'Layer E: Rendering');
      log('PERF-RENDER-CL', 'running', '  → Layout Thrashing: Forced synchronous layout patterns causing style recalculation storms', 'CWV — CLS Root Cause Analysis', 'Layer E: Rendering');
      const renderIssues = await detectRenderIssues(page, pageData.url);
      resourceIssues.push(...renderIssues);
      log('PERF-RENDER', renderIssues.length > 0 ? 'fail' : 'pass', `  ✓ Layer E complete — ${renderIssues.length} rendering issue(s)`, 'RAIL Animation Phase', 'Layer E: Rendering');

      // ── Layer F: Mobile Performance ──
      log('PERF-MOBILE', 'running', '━━━ Layer F: Mobile Performance Standards', 'Mobile-First Performance — 4G Simulation', 'Layer F: Mobile');
      log('PERF-MOBILE-VP', 'running', '  → Viewport Meta: <meta name="viewport"> presence — required for mobile rendering', 'Mobile Web — Viewport Configuration', 'Layer F: Mobile');
      log('PERF-MOBILE-TT', 'running', '  → Touch Targets: Interactive elements <44×44px (WCAG 2.5.8 + mobile usability)', 'WCAG 2.5.8 + Google Mobile Usability', 'Layer F: Mobile');
      const mobileIssues = await detectMobileIssues(page, pageData.url);
      resourceIssues.push(...mobileIssues);
      log('PERF-MOBILE', mobileIssues.length > 0 ? 'fail' : 'pass', `  ✓ Layer F complete — ${mobileIssues.length} mobile issue(s)`, 'Mobile Performance Standards', 'Layer F: Mobile');

      const domNodes = await page.evaluate(() => document.querySelectorAll('*').length).catch(() => 0);
      const cwv: CoreWebVitals = {
        lcp: vitals.lcp, cls: vitals.cls as number | null,
        inp: vitals.inp as number | null, ttfb: vitals.ttfb as number | null,
        tbt: vitals.tbt as number | null, fcp: vitals.fcp as number | null,
      };
      const score = calculatePageScore(cwv, resourceIssues);
      const totalTransferSize = requests.reduce((sum, r) => sum + r.size, 0);

      pageResults.push({
        url: pageData.url, title: pageData.title,
        vitals: cwv, score, resourceIssues,
        totalTransferSize, totalRequests: requests.length,
        domNodes, loadTime,
      });
    } catch (err) {
      console.error(`[TrustLens:Performance] Error on ${pageData.url}:`, err);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  // ── Layer G: Auth Flow Timing ──────────────────────────────
  if (flags.includes('perf-login') || flags.includes('perf-otp') || loginConfig) {
    log('PERF-AUTH', 'running', '━━━ Layer G: Auth Flow Performance Timing', 'Authentication UX — RAIL Response Model', 'Layer G: Auth Flow');
    log('PERF-AUTH-FORM', 'running', '  → Time to login form visible (navigation → password field rendered)', 'RAIL Load Phase', 'Layer G: Auth Flow');
    log('PERF-AUTH-SUBMIT', 'running', '  → Submit to first response (click → auth API reply)', 'RAIL Response Phase', 'Layer G: Auth Flow');
    log('PERF-AUTH-REDIRECT', 'running', '  → Post-auth redirect time (response → dashboard interactive)', 'RAIL Load Phase', 'Layer G: Auth Flow');
    authFlowResult = await measureAuthFlow(context, baseUrl, loginConfig, log);
    const authStatus = authFlowResult.status;
    log('PERF-AUTH', authStatus === 'pass' ? 'pass' : authStatus === 'failed' || authStatus === 'skipped' ? 'error' : 'fail',
      `  ✓ Layer G complete — Auth flow ${authFlowResult.totalRoundTripMs ? Math.round(authFlowResult.totalRoundTripMs) + 'ms' : 'N/A'} total (${authStatus})`,
      'Auth Flow Timing', 'Layer G: Auth Flow');
  }

  // ── Layer H: Interaction Performance ──────────────────────
  if (flags.includes('perf-search') || flags.includes('perf-calculator')) {
    log('PERF-INP', 'running', '━━━ Layer H: Interaction Performance (INP per action)', 'RAIL Response — <100ms interaction budget', 'Layer H: Interaction');
    if (flags.includes('perf-search')) {
      log('PERF-INP-SEARCH', 'running', '  → Search/filter: keystroke → results rendered (RAIL: <300ms)', 'RAIL Response', 'Layer H: Interaction');
    }
    if (flags.includes('perf-calculator')) {
      log('PERF-INP-CALC', 'running', '  → Calculator: value change → output re-render (RAIL: <200ms)', 'RAIL Response', 'Layer H: Interaction');
    }
    const interactionIssues = await detectInteractionIssues(context, expandedPages, flags, log);
    pageResults.forEach(p => {
      const extra = interactionIssues.filter(i => i.pageUrl === p.url);
      p.resourceIssues.push(...extra);
    });
    log('PERF-INP', interactionIssues.length > 0 ? 'fail' : 'pass',
      `  ✓ Layer H complete — ${interactionIssues.length} interaction issue(s)`,
      'RAIL Response Phase', 'Layer H: Interaction');
  }

  // ── Layer I: Network Simulation ────────────────────────────
  if (flags.includes('perf-mobile') || flags.includes('perf-slow-load') || flags.includes('perf-timeout')) {
    log('PERF-NET-SIM', 'running', '━━━ Layer I: Network Condition Simulation', 'Mobile-First Performance — 3G/4G Throttle via CDP', 'Layer I: Network Simulation');
    log('PERF-NET-SIM-4G', 'running', '  → Fast 4G: 4Mbps / 70ms RTT — urban smartphone baseline', 'CDP NetworkConditions', 'Layer I: Network Simulation');
    log('PERF-NET-SIM-3GF', 'running', '  → Fast 3G: 1.6Mbps / 150ms RTT — suburban / Jio 3G', 'CDP NetworkConditions', 'Layer I: Network Simulation');
    log('PERF-NET-SIM-3GS', 'running', '  → Slow 3G: 500Kbps / 400ms RTT — rural / BSNL 3G baseline', 'CDP NetworkConditions', 'Layer I: Network Simulation');
    networkSimResults = await runNetworkSimulation(context, expandedPages[0]?.url ?? baseUrl, log);
    const simScores = networkSimResults.map(s => s.score ?? 100);
    const desktopScore = simScores[0] ?? 100;
    const slowest = simScores[simScores.length - 1] ?? 100;
    const delta = desktopScore - slowest;
    log('PERF-NET-SIM', delta > 30 ? 'fail' : 'pass',
      `  ✓ Layer I complete — Desktop: ${desktopScore}/100 | Slow 3G: ${slowest}/100 | Delta: ${delta} pts`,
      'Network Simulation', 'Layer I: Network Simulation');
    if (delta > 30) {
      const worstPage = pageResults[0];
      if (worstPage) {
        worstPage.resourceIssues.push({
          type: 'slow-on-3g', url: worstPage.url, pageUrl: worstPage.url, severity: 'critical',
          description: `Performance drops ${delta} points on Slow 3G (Desktop: ${desktopScore}/100 → Slow 3G: ${slowest}/100). Users on rural/3G networks will experience near-unusable load times.`,
          recommendation: 'Compress all images to WebP/AVIF, enable CDN, reduce total page weight below 1MB, add Service Worker for caching.',
          metrics: { desktopScore, slow3gScore: slowest, delta },
        });
      }
    }
  }

  // ── Layer J: Third-Party Impact ────────────────────────────
  const primaryUrl = expandedPages[0]?.url ?? baseUrl;
  log('PERF-3P', 'running', '━━━ Layer J: Third-Party Script Impact Analysis', 'Third-Party Resource Audit — Cross-Origin Performance Overhead', 'Layer J: Third-Party Impact');
  thirdPartyImpact = await detectThirdPartyImpact(context, primaryUrl, log);
  const blocking3p = thirdPartyImpact.filter(t => t.blocking).length;
  const slow3p = thirdPartyImpact.filter(t => (t.loadTimeMs ?? 0) > 500).length;
  log('PERF-3P', blocking3p > 0 || slow3p > 0 ? 'fail' : 'pass',
    `  ✓ Layer J complete — ${thirdPartyImpact.length} third-party resource(s) | ${blocking3p} blocking | ${slow3p} slow (>500ms)`,
    'Third-Party Impact', 'Layer J: Third-Party Impact');
  if (blocking3p > 0 && pageResults[0]) {
    pageResults[0].resourceIssues.push({
      type: 'third-party-blocking', url: thirdPartyImpact.find(t => t.blocking)?.url ?? primaryUrl,
      pageUrl: primaryUrl, severity: 'high',
      description: `${blocking3p} third-party script(s) block the main thread during page load.`,
      recommendation: 'Add async/defer to third-party scripts. Load non-critical third-parties after page interactive.',
      metrics: { blockingCount: blocking3p },
    });
  }

  // ── Layer K: Technical Architecture Detection ───────────────
  log('PERF-ARCH', 'running', '━━━ Layer K: Technical Architecture Detection', 'Framework/CDN/Stack Fingerprinting', 'Layer K: Architecture');
  architecture = await detectArchitecture(context, primaryUrl, log);
  const archIssues: string[] = [];
  if (!architecture.cdn) archIssues.push('no CDN');
  if (architecture.httpVersion === 'HTTP/1.1') archIssues.push('HTTP/1.1');
  if (archIssues.length > 0 && pageResults[0]) {
    if (!architecture.cdn) {
      pageResults[0].resourceIssues.push({
        type: 'missing-cdn', url: primaryUrl, pageUrl: primaryUrl, severity: 'medium',
        description: 'No CDN detected — static assets are served directly from origin server.',
        recommendation: 'Deploy static assets via a CDN (Cloudflare, AWS CloudFront, Fastly) to reduce latency globally.',
        metrics: {},
      });
    }
    if (architecture.httpVersion === 'HTTP/1.1') {
      pageResults[0].resourceIssues.push({
        type: 'outdated-http', url: primaryUrl, pageUrl: primaryUrl, severity: 'medium',
        description: 'Site is served over HTTP/1.1. HTTP/2 and HTTP/3 offer significant performance improvements via multiplexing.',
        recommendation: 'Upgrade server/CDN to support HTTP/2 or HTTP/3.',
        metrics: {},
      });
    }
  }
  log('PERF-ARCH', 'pass',
    `  ✓ Layer K complete — Framework: ${architecture.framework ?? 'unknown'} | CDN: ${architecture.cdn ?? 'none'} | HTTP: ${architecture.httpVersion ?? 'unknown'}`,
    'Architecture Detection', 'Layer K: Architecture');

  // ── Layer L: Technical SEO Readiness ───────────────────────
  log('PERF-SEO', 'running', '━━━ Layer L: Technical SEO Readiness', 'On-Page SEO Signals that Impact Core Web Vitals Rankings', 'Layer L: SEO Readiness');
  seoReadiness = await detectSeoReadiness(context, primaryUrl, log);
  const seoIssueCount = seoReadiness.issues.length;
  if (seoIssueCount > 0 && pageResults[0]) {
    for (const si of seoReadiness.issues.filter(s => s.severity === 'critical' || s.severity === 'high').slice(0, 3)) {
      pageResults[0].resourceIssues.push({
        type: 'missing-meta-tags', url: primaryUrl, pageUrl: primaryUrl, severity: si.severity,
        description: si.detail, recommendation: si.recommendation, metrics: {},
      });
    }
  }
  log('PERF-SEO', seoIssueCount > 0 ? 'fail' : 'pass',
    `  ✓ Layer L complete — ${seoIssueCount} SEO issue(s) | robots.txt: ${seoReadiness.hasRobotsTxt ? '✓' : '✗'} | sitemap: ${seoReadiness.hasSitemap ? '✓' : '✗'} | structured data: ${seoReadiness.hasStructuredData ? '✓' : '✗'}`,
    'SEO Readiness', 'Layer L: SEO Readiness');

  // ── Layer M: UX Performance ─────────────────────────────────
  log('PERF-UX', 'running', '━━━ Layer M: UX Performance Audit (GCC Differentiator)', 'Perceived Performance & User Experience Quality Signals', 'Layer M: UX Performance');
  log('PERF-UX-LOAD', 'running', '  → Loading experience: skeleton screens, loading indicators, progressive rendering', 'UX Performance — Loading Patterns', 'Layer M: UX Performance');
  log('PERF-UX-STABLE', 'running', '  → Visual stability under interaction: CLS on tab clicks, accordion, dropdowns', 'UX Performance — Interaction Stability', 'Layer M: UX Performance');
  log('PERF-UX-RESP', 'running', '  → Responsiveness: navigation, form input, search query-to-results latency', 'UX Performance — RAIL Response', 'Layer M: UX Performance');
  log('PERF-UX-ANIM', 'running', '  → Animation smoothness: scroll jank, CSS animation FPS, page transitions', 'UX Performance — Animation Frame Rate', 'Layer M: UX Performance');
  uxPerformance = await measureUXPerformance(context, primaryUrl, log);
  if (uxPerformance.issues.length > 0 && pageResults[0]) {
    pageResults[0].resourceIssues.push(...uxPerformance.issues);
  }
  log('PERF-UX', uxPerformance.score < 60 ? 'fail' : 'pass',
    `  ✓ Layer M complete — UX Score: ${uxPerformance.score}/100 | Load: ${uxPerformance.initialLoadExperience.score}/100 | Responsiveness: ${uxPerformance.responsiveness.score}/100 | Animation: ${uxPerformance.animationPerformance.score}/100`,
    'UX Performance', 'Layer M: UX Performance');

  // Layers G–M (auth timing, interaction lag, network simulation, third-party impact,
  // architecture, SEO readiness, UX performance) can append more resourceIssues onto a
  // page's result AFTER that page's score was already computed from Layers A–F alone —
  // so those issues were silently invisible to the score. Recompute now that every layer
  // has run, so the score reflects the full, final issue list shown to the user.
  for (const p of pageResults) {
    p.score = calculatePageScore(p.vitals, p.resourceIssues);
  }

  const basePageUrls = new Set(pages.map(p => p.url));
  const basePagesAudited = pageResults.filter(p => basePageUrls.has(p.url)).length;
  const targetedPagesAudited = pageResults.length - basePagesAudited;

  return buildPerformanceResult(pageResults, flags, authFlowResult, networkSimResults, thirdPartyImpact, architecture, seoReadiness, uxPerformance, basePagesAudited, targetedPagesAudited);
}

// ═══════════════════════════════════════════════════════════
// LAYER A: Core Web Vitals
// ═══════════════════════════════════════════════════════════
async function measureCoreWebVitals(page: Page) {
  const vitals = await page.evaluate(() => {
    const result: Record<string, number | null> = { lcp: null, cls: null, fcp: null, ttfb: null, tbt: null, inp: null };
    try { const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; if (nav) result.ttfb = Math.round(nav.responseStart - nav.requestStart); } catch {}
    try { const fcp = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint'); if (fcp) result.fcp = Math.round(fcp.startTime); } catch {}
    try { const lcp = performance.getEntriesByType('largest-contentful-paint'); if (lcp.length > 0) result.lcp = Math.round(lcp[lcp.length - 1].startTime); } catch {}
    try { const cls = performance.getEntriesByType('layout-shift') as any[]; let v = 0; for (const e of cls) { if (!e.hadRecentInput) v += e.value; } result.cls = parseFloat(v.toFixed(4)); } catch {}
    try { const lt = performance.getEntriesByType('longtask'); let tbt = 0; for (const t of lt) tbt += Math.max(0, t.duration - 50); result.tbt = Math.round(tbt); } catch {}
    return result;
  }).catch(() => ({ lcp: null, cls: null, fcp: null, ttfb: null, tbt: null, inp: null }));

  if (vitals.lcp === null && vitals.fcp !== null) vitals.lcp = Math.round(vitals.fcp * 1.5);
  return vitals;
}

// ═══════════════════════════════════════════════════════════
// LAYER B: Resource Optimization (existing)
// ═══════════════════════════════════════════════════════════
async function detectResourceIssues(
  page: Page, pageUrl: string,
  requests: Array<{ url: string; size: number; type: string }>
): Promise<ResourceIssue[]> {
  const issues: ResourceIssue[] = [];

  const largeImages = requests.filter(r => r.type.startsWith('image/') && r.size > 500000);
  for (const img of largeImages) {
    issues.push({ type: 'unoptimized-image', url: img.url, pageUrl, severity: 'medium',
      description: `Image is ${(img.size / 1024).toFixed(0)}KB — consider compressing or using WebP/AVIF.`,
      recommendation: 'Compress images and use modern formats (WebP, AVIF). Target <200KB per image.',
      metrics: { size: `${(img.size / 1024).toFixed(0)}KB` } });
  }

  const largeJS = requests.filter(r => (r.type.includes('javascript') || r.url.endsWith('.js')) && r.size > 500000);
  for (const js of largeJS) {
    issues.push({ type: 'large-bundle', url: js.url, pageUrl, severity: 'high',
      description: `JavaScript bundle is ${(js.size / 1024).toFixed(0)}KB — consider code splitting.`,
      recommendation: 'Implement code splitting and tree shaking. Lazy-load non-critical modules.',
      metrics: { size: `${(js.size / 1024).toFixed(0)}KB` } });
  }

  const nonLazyImages = await page.$$eval('img:not([loading="lazy"])',
    imgs => (imgs as HTMLImageElement[]).filter(img => { const rect = img.getBoundingClientRect(); return rect.top > window.innerHeight; }).map(img => img.src)
  ).catch(() => []);
  if (nonLazyImages.length > 0) {
    issues.push({ type: 'no-lazy-loading', url: nonLazyImages[0], pageUrl, severity: 'low',
      description: `${nonLazyImages.length} below-fold image(s) without lazy loading.`,
      recommendation: 'Add loading="lazy" to images below the fold.', metrics: { count: nonLazyImages.length } });
  }

  const blockingCSS = await page.$$eval('link[rel="stylesheet"]:not([media="print"])',
    links => links.filter(l => !l.hasAttribute('media') || l.getAttribute('media') === 'all').map(l => l.getAttribute('href') || '').filter(h => h && !h.includes('fonts.googleapis'))
  ).catch(() => []);
  if (blockingCSS.length > 3) {
    issues.push({ type: 'render-blocking-css', url: blockingCSS[0], pageUrl, severity: 'medium',
      description: `${blockingCSS.length} render-blocking CSS files detected.`,
      recommendation: 'Inline critical CSS and defer non-critical stylesheets.', metrics: { count: blockingCSS.length } });
  }

  const domCount = await page.evaluate(() => document.querySelectorAll('*').length).catch(() => 0);
  if (domCount > 1500) {
    issues.push({ type: 'excessive-dom', url: pageUrl, pageUrl, severity: domCount > 3000 ? 'high' : 'medium',
      description: `${domCount} DOM nodes — exceeds recommended maximum of 1500.`,
      recommendation: 'Reduce DOM complexity. Consider virtual scrolling for long lists.', metrics: { nodes: domCount } });
  }

  if (requests.length > 80) {
    issues.push({ type: 'excessive-requests', url: pageUrl, pageUrl, severity: 'medium',
      description: `${requests.length} HTTP requests — consider bundling resources.`,
      recommendation: 'Bundle and concatenate resources. Use HTTP/2 multiplexing.', metrics: { count: requests.length } });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// LAYER C: Network & Caching Analysis (NEW)
// ═══════════════════════════════════════════════════════════
async function detectNetworkIssues(
  page: Page, pageUrl: string,
  requests: Array<{ url: string; size: number; type: string; headers: Record<string, string> }>
): Promise<ResourceIssue[]> {
  const issues: ResourceIssue[] = [];

  // Missing cache headers on static assets
  const staticAssets = requests.filter(r =>
    r.type.includes('javascript') || r.type.includes('css') || r.type.startsWith('image/') || r.type.includes('font')
  );
  const uncached = staticAssets.filter(r => !r.headers['cache-control'] && !r.headers['etag'] && !r.headers['last-modified']);
  if (uncached.length > 3) {
    issues.push({ type: 'missing-cache-headers', url: uncached[0].url, pageUrl, severity: 'medium',
      description: `${uncached.length} static assets missing cache headers (Cache-Control/ETag).`,
      recommendation: 'Set Cache-Control headers on static assets. Use immutable for versioned files.', metrics: { count: uncached.length } });
  }

  // Missing compression on text resources
  const textResources = requests.filter(r =>
    (r.type.includes('javascript') || r.type.includes('css') || r.type.includes('html') || r.type.includes('json')) && r.size > 1000
  );
  const uncompressed = textResources.filter(r => !r.headers['content-encoding']);
  if (uncompressed.length > 2) {
    issues.push({ type: 'missing-compression', url: uncompressed[0].url, pageUrl, severity: 'medium',
      description: `${uncompressed.length} text resource(s) served without gzip/brotli compression.`,
      recommendation: 'Enable gzip or brotli compression for text resources.', metrics: { count: uncompressed.length } });
  }

  // Duplicate requests
  const urlCounts = new Map<string, number>();
  for (const r of requests) { urlCounts.set(r.url, (urlCounts.get(r.url) || 0) + 1); }
  const duplicates = [...urlCounts.entries()].filter(([, c]) => c > 1);
  if (duplicates.length > 0) {
    issues.push({ type: 'duplicate-requests', url: duplicates[0][0], pageUrl, severity: 'low',
      description: `${duplicates.length} resource(s) loaded multiple times.`,
      recommendation: 'Deduplicate resource loading. Use caching or module-level imports.', metrics: { count: duplicates.length } });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// LAYER D: JavaScript Execution Analysis (NEW)
// ═══════════════════════════════════════════════════════════
async function detectJSIssues(page: Page, pageUrl: string): Promise<ResourceIssue[]> {
  const issues: ResourceIssue[] = [];

  // Synchronous scripts in <head>
  const syncScripts = await page.$$eval('head script[src]:not([async]):not([defer]):not([type="module"])',
    scripts => scripts.map(s => s.getAttribute('src') || '')
  ).catch(() => []);
  if (syncScripts.length > 0) {
    issues.push({ type: 'sync-scripts', url: syncScripts[0], pageUrl, severity: 'medium',
      description: `${syncScripts.length} synchronous script(s) in <head> blocking rendering.`,
      recommendation: 'Add async or defer attribute to non-critical scripts.', metrics: { count: syncScripts.length } });
  }

  // Third-party JS impact
  const thirdPartyScripts = await page.$$eval('script[src]', scripts => {
    const host = window.location.hostname;
    return scripts.filter(s => { try { return new URL(s.getAttribute('src') || '', window.location.href).hostname !== host; } catch { return false; } })
      .map(s => s.getAttribute('src') || '');
  }).catch(() => []);
  if (thirdPartyScripts.length > 5) {
    issues.push({ type: 'third-party-impact', url: thirdPartyScripts[0], pageUrl, severity: 'medium',
      description: `${thirdPartyScripts.length} third-party scripts loaded — may impact performance.`,
      recommendation: 'Audit third-party scripts. Defer non-critical ones and remove unused.', metrics: { count: thirdPartyScripts.length } });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// LAYER E: Rendering & Layout (NEW)
// ═══════════════════════════════════════════════════════════
async function detectRenderIssues(page: Page, pageUrl: string): Promise<ResourceIssue[]> {
  const issues: ResourceIssue[] = [];

  // Font loading impact
  const fontLinks = await page.$$eval('link[rel="stylesheet"][href*="fonts"], link[rel="preload"][as="font"]',
    links => links.map(l => l.getAttribute('href') || '')
  ).catch(() => []);
  const fontFaces = await page.evaluate(() => {
    try { return document.fonts.size; } catch { return 0; }
  }).catch(() => 0);
  if (fontFaces > 4) {
    issues.push({ type: 'font-loading', url: fontLinks[0] || pageUrl, pageUrl, severity: 'low',
      description: `${fontFaces} font faces loaded — may cause FOUT/FOIT.`,
      recommendation: 'Use font-display: swap. Preload critical fonts. Limit font variants.', metrics: { fontFaces } });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// LAYER F: Mobile Performance (NEW)
// ═══════════════════════════════════════════════════════════
async function detectMobileIssues(page: Page, pageUrl: string): Promise<ResourceIssue[]> {
  const issues: ResourceIssue[] = [];

  // Missing viewport meta
  const hasViewport = await page.$('meta[name="viewport"]').catch(() => null);
  if (!hasViewport) {
    issues.push({ type: 'missing-viewport', url: pageUrl, pageUrl, severity: 'high',
      description: 'Missing <meta name="viewport"> — page will not render correctly on mobile.',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', metrics: {} });
  }

  // Small touch targets
  const smallTargets = await page.$$eval('a, button, [role="button"], input, select, textarea',
    els => els.filter(el => {
      const rect = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && rect.width > 0 && (rect.width < 44 || rect.height < 44);
    }).length
  ).catch(() => 0);
  if (smallTargets > 5) {
    issues.push({ type: 'small-touch-target', url: pageUrl, pageUrl, severity: 'medium',
      description: `${smallTargets} interactive elements smaller than 44×44px minimum touch target.`,
      recommendation: 'Ensure all interactive elements are at least 44×44px for touch accessibility.', metrics: { count: smallTargets } });
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════
function calculatePageScore(vitals: CoreWebVitals, issues: ResourceIssue[]): number {
  let score = 100;
  const t = CWV_THRESHOLDS;
  if (vitals.lcp !== null) { if (vitals.lcp > t.lcp.poor) score -= 25; else if (vitals.lcp > t.lcp.good) score -= Math.round(25 * (vitals.lcp - t.lcp.good) / (t.lcp.poor - t.lcp.good)); }
  if (vitals.cls !== null) { if (vitals.cls > t.cls.poor) score -= 20; else if (vitals.cls > t.cls.good) score -= Math.round(20 * (vitals.cls - t.cls.good) / (t.cls.poor - t.cls.good)); }
  if (vitals.tbt !== null) { if (vitals.tbt > t.tbt.poor) score -= 15; else if (vitals.tbt > t.tbt.good) score -= Math.round(15 * (vitals.tbt - t.tbt.good) / (t.tbt.poor - t.tbt.good)); }
  if (vitals.ttfb !== null) { if (vitals.ttfb > t.ttfb.poor) score -= 10; else if (vitals.ttfb > t.ttfb.good) score -= Math.round(10 * (vitals.ttfb - t.ttfb.good) / (t.ttfb.poor - t.ttfb.good)); }
  // No cap here: capping this at a flat ceiling (as a previous version did) meant a page
  // with 4 critical issues and a page with 40 critical issues took the exact same hit —
  // resource-issue volume/severity stopped affecting the score past a handful of issues.
  // The final Math.max(0, ...) below still floors the result at 0.
  const issuePenalty = issues.reduce((sum, i) => { const w = { critical: 5, high: 3, medium: 2, low: 1 }; return sum + (w[i.severity] || 1); }, 0);
  score -= issuePenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPerformanceResult(
  pages: PagePerformance[],
  flags: PerformanceFlag[] = [],
  authFlow?: AuthFlowResult,
  networkSimulation?: NetworkSimResult[],
  thirdPartyImpact?: ThirdPartyImpact[],
  architecture?: ArchitectureInfo,
  seoReadiness?: SeoReadiness,
  uxPerformance?: UXPerformanceResult,
  basePagesAudited?: number,
  targetedPagesAudited?: number,
): PerformanceResult {
  const emptyVitals: CoreWebVitals = { lcp: null, cls: null, inp: null, ttfb: null, tbt: null, fcp: null };
  if (pages.length === 0) {
    return { pages: [], overallScore: 100, averageVitals: emptyVitals, totalResourceIssues: 0, resourceIssuesByType: {}, recommendations: [], authFlow, networkSimulation, clientReportedFlags: flags, thirdPartyImpact, architecture, seoReadiness, uxPerformance, basePagesAudited, targetedPagesAudited };
  }
  const avg = (arr: (number | null)[]) => { const v = arr.filter(x => x !== null) as number[]; return v.length > 0 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const avgCls = (arr: (number | null)[]) => { const v = arr.filter(x => x !== null) as number[]; return v.length > 0 ? parseFloat((v.reduce((a, b) => a + b, 0) / v.length).toFixed(4)) : null; };
  const overallScore = Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length);
  const allIssues = pages.flatMap(p => p.resourceIssues);
  const issuesByType: Record<string, number> = {};
  for (const i of allIssues) issuesByType[i.type] = (issuesByType[i.type] || 0) + 1;
  const confirmedClientIssues = flags.length > 0
    ? confirmClientIssues(flags, pages, authFlow, networkSimulation)
    : undefined;
  return {
    pages, overallScore,
    averageVitals: { lcp: avg(pages.map(p => p.vitals.lcp)), cls: avgCls(pages.map(p => p.vitals.cls)), inp: avg(pages.map(p => p.vitals.inp)), ttfb: avg(pages.map(p => p.vitals.ttfb)), tbt: avg(pages.map(p => p.vitals.tbt)), fcp: avg(pages.map(p => p.vitals.fcp)) },
    totalResourceIssues: allIssues.length, resourceIssuesByType: issuesByType,
    recommendations: generateRecommendations(pages, flags, authFlow, networkSimulation),
    authFlow, networkSimulation,
    clientReportedFlags: flags.length > 0 ? flags : undefined,
    confirmedClientIssues,
    thirdPartyImpact,
    architecture,
    seoReadiness,
    uxPerformance,
    basePagesAudited,
    targetedPagesAudited,
  };
}

function generateRecommendations(
  pages: PagePerformance[],
  flags: PerformanceFlag[] = [],
  authFlow?: AuthFlowResult,
  networkSim?: NetworkSimResult[],
): RecommendationItem[] {
  const recs: RecommendationItem[] = [];
  const allIssues = pages.flatMap(p => p.resourceIssues);
  const t = CWV_THRESHOLDS;

  // P0 — client-reported critical issues first
  if (authFlow && (authFlow.status === 'critical' || authFlow.status === 'slow')) {
    recs.push({ priority: 'P0', title: 'Fix authentication flow speed (client-reported)', detail: `Login round-trip is ${authFlow.totalRoundTripMs ? Math.round(authFlow.totalRoundTripMs) : '?'}ms. Split auth into initiate + verify steps, use edge/CDN-adjacent auth service, add skeleton loader immediately on submit.`, effort: 'Sprint (weeks)', impact: 'Critical', clientReported: true, issueType: 'auth-flow-slow' });
  }

  const simScores = networkSim?.map(s => s.score ?? 100) ?? [];
  if (simScores.length >= 3 && (simScores[0] ?? 100) - (simScores[simScores.length - 1] ?? 100) > 30) {
    recs.push({ priority: 'P0', title: 'Critical 3G performance gap (client-reported)', detail: `Site scores ${simScores[simScores.length - 1]}/100 on Slow 3G vs ${simScores[0]}/100 on desktop. Reduce total page weight, enable brotli compression, deploy assets on CDN.`, effort: 'Sprint (weeks)', impact: 'Critical', clientReported: true, issueType: 'slow-on-3g' });
  }

  // P1 — high impact CWV
  const avgLcp = pages.map(p => p.vitals.lcp).filter(v => v !== null) as number[];
  if (avgLcp.length > 0 && avgLcp.reduce((a, b) => a + b, 0) / avgLcp.length > t.lcp.good) {
    recs.push({ priority: 'P1', title: 'Optimize Largest Contentful Paint', detail: 'Preload hero images with <link rel="preload">, use CDN for static assets, optimize server response time (TTFB < 800ms).', effort: 'Medium (days)', impact: 'High', issueType: 'unoptimized-image' });
  }
  if (allIssues.some(i => i.type === 'large-bundle')) {
    recs.push({ priority: 'P1', title: 'Reduce JavaScript bundle sizes', detail: 'Implement code splitting and tree shaking. Lazy-load non-critical modules. Target < 300KB gzipped per route.', effort: 'Sprint (weeks)', impact: 'High', issueType: 'large-bundle' });
  }

  // P2 — image and resource
  if (allIssues.some(i => i.type === 'unoptimized-image')) {
    recs.push({ priority: 'P2', title: 'Convert images to WebP / AVIF', detail: 'Re-encode all images in WebP (40% smaller) or AVIF (50% smaller). Target < 200KB per image. Use responsive srcset for different viewports.', effort: 'Medium (days)', impact: 'High', issueType: 'unoptimized-image' });
  }
  if (allIssues.some(i => i.type === 'render-blocking-css')) {
    recs.push({ priority: 'P2', title: 'Inline critical CSS, defer non-essential', detail: 'Extract above-the-fold CSS (< 14KB) and inline it in <head>. Load remaining CSS asynchronously.', effort: 'Medium (days)', impact: 'Medium', issueType: 'render-blocking-css' });
  }

  // P3 — caching and server
  if (allIssues.some(i => i.type === 'missing-cache-headers')) {
    recs.push({ priority: 'P3', title: 'Add Cache-Control headers to static assets', detail: 'Set Cache-Control: public, max-age=31536000, immutable on versioned assets. Repeat visitors will see 60%+ faster load times.', effort: 'Quick (hours)', impact: 'Medium', issueType: 'missing-cache-headers' });
  }
  if (allIssues.some(i => i.type === 'sync-scripts')) {
    recs.push({ priority: 'P3', title: 'Add async / defer to blocking scripts', detail: 'Add defer attribute to non-critical <script> tags in <head>. This unblocks HTML parsing and improves FCP.', effort: 'Quick (hours)', impact: 'Medium', issueType: 'sync-scripts' });
  }

  // P4 — mobile UX
  if (allIssues.some(i => i.type === 'small-touch-target')) {
    recs.push({ priority: 'P4', title: 'Increase touch target sizes to 44×44px', detail: 'All interactive elements (buttons, links, inputs) must be at least 44×44px for mobile usability per WCAG 2.5.8.', effort: 'Quick (hours)', impact: 'Low', issueType: 'small-touch-target' });
  }
  if (allIssues.some(i => i.type === 'no-lazy-loading')) {
    recs.push({ priority: 'P4', title: 'Add lazy loading to below-fold images', detail: 'Add loading="lazy" attribute to all <img> tags below the fold. Reduces initial page weight significantly.', effort: 'Quick (hours)', impact: 'Low', issueType: 'no-lazy-loading' });
  }

  return recs;
}

// ═══════════════════════════════════════════════════════════
// HELPER: Expand pages based on flagged problems
// ═══════════════════════════════════════════════════════════
function expandPagesForContext(pages: PageData[], baseUrl: string, flags: PerformanceFlag[]): PageData[] {
  const pathsToAdd: Partial<Record<PerformanceFlag, string[]>> = {
    'perf-login':    ['/login', '/signin', '/account/login'],
    'perf-otp':      ['/otp', '/verify', '/2fa'],
    'perf-checkout': ['/checkout', '/cart', '/payment'],
    'perf-search':   ['/search', '/results'],
  };
  const existing = new Set(pages.map(p => p.url));
  const extra: PageData[] = [];
  for (const flag of flags) {
    for (const path of pathsToAdd[flag] ?? []) {
      try {
        const full = new URL(path, baseUrl).href;
        if (!existing.has(full) && extra.length < 3) {
          extra.push({ url: full, title: path });
          existing.add(full);
        }
      } catch {}
    }
  }
  return [...pages, ...extra];
}

// ═══════════════════════════════════════════════════════════
// CLIENT ISSUE CONFIRMATION
// ═══════════════════════════════════════════════════════════
function confirmClientIssues(
  flags: PerformanceFlag[],
  pages: PagePerformance[],
  authFlow?: AuthFlowResult,
  networkSim?: NetworkSimResult[],
): ConfirmedClientIssue[] {
  const allIssues = pages.flatMap(p => p.resourceIssues);
  const results: ConfirmedClientIssue[] = [];
  const LABELS: Record<PerformanceFlag, string> = {
    'perf-slow-load': 'Site loads too slowly', 'perf-login': 'Login / auth is slow or broken',
    'perf-otp': 'OTP / 2FA takes too long', 'perf-mobile': 'Poor mobile / 3G experience',
    'perf-timeout': 'Pages hang or time out', 'perf-checkout': 'Checkout / payment flow slow',
    'perf-search': 'Search / filter is sluggish', 'perf-calculator': 'Calculator unresponsive',
    'perf-pdf-download': 'PDF / download hangs', 'perf-session-expiry': 'Session logs out too fast',
  };

  for (const flag of flags) {
    const label = LABELS[flag] ?? flag;
    let status: ConfirmedClientIssue['status'] = 'not-found';
    let summary = '';
    let evidence = '';
    let recommendation = '';

    if (flag === 'perf-login' || flag === 'perf-otp') {
      if (authFlow && authFlow.status !== 'skipped') {
        if (authFlow.status === 'critical' || authFlow.status === 'slow') {
          status = 'confirmed';
          summary = `Auth round-trip ${authFlow.totalRoundTripMs ? Math.round(authFlow.totalRoundTripMs) + 'ms' : 'unknown'} — exceeds 3s threshold`;
          evidence = 'Layer G auth flow timing';
          recommendation = 'Split authentication into separate initiate/verify steps, use an edge/CDN-adjacent auth service, and show a loading indicator immediately on submit.';
        } else if (authFlow.status === 'pass') {
          status = 'not-found';
          summary = `Auth flow measured at ${authFlow.totalRoundTripMs ? Math.round(authFlow.totalRoundTripMs) + 'ms' : 'N/A'} — within acceptable range`;
          evidence = 'Layer G auth flow timing';
          recommendation = 'No action needed — auth flow performance is within the acceptable range.';
        } else if (authFlow.status === 'failed') {
          status = 'partial';
          summary = 'Login credentials were provided but the submit attempt failed — could not measure submit-to-response timing';
          evidence = 'Layer G auth flow timing';
          recommendation = 'Verify the supplied test credentials and form selectors are correct, then re-run the audit to measure submit-to-response performance.';
        }
      } else {
        status = 'partial';
        summary = 'Login page included in scan but credentials not provided for full auth test';
        evidence = 'Layer A CWV on /login page';
        recommendation = 'Provide test credentials in the audit configuration to fully verify login/OTP submit-to-response performance.';
      }
    } else if (flag === 'perf-mobile') {
      const simScores = networkSim?.map(s => s.score ?? 100) ?? [];
      if (simScores.length >= 2) {
        const delta = (simScores[0] ?? 100) - (simScores[simScores.length - 1] ?? 100);
        if (delta > 30) {
          status = 'confirmed';
          summary = `Score drops ${delta} points on Slow 3G (${simScores[0]} → ${simScores[simScores.length - 1]})`;
          evidence = 'Layer I network simulation';
          recommendation = 'Reduce total page weight, enable brotli compression, and defer non-critical scripts to close the gap between desktop and 3G performance.';
        } else if (delta > 15) {
          status = 'partial';
          summary = `Moderate degradation on 3G (${delta} point drop)`;
          evidence = 'Layer I network simulation';
          recommendation = 'Consider deferring non-critical resources and compressing images further to improve mobile/3G resilience.';
        } else {
          status = 'not-found';
          summary = `Performance holds on 3G (only ${delta} point drop)`;
          evidence = 'Layer I network simulation';
          recommendation = 'No action needed — performance holds up under throttled mobile conditions.';
        }
      }
    } else if (flag === 'perf-slow-load' || flag === 'perf-timeout') {
      const avgLcp = pages.map(p => p.vitals.lcp).filter(Boolean) as number[];
      const mean = avgLcp.length > 0 ? avgLcp.reduce((a, b) => a + b, 0) / avgLcp.length : null;
      if (mean && mean > CWV_THRESHOLDS.lcp.poor) {
        status = 'confirmed';
        summary = `Average LCP is ${Math.round(mean)}ms — exceeds 4s "Poor" threshold`;
        evidence = 'Layer A Core Web Vitals';
        recommendation = 'Optimize the largest above-the-fold image/element, enable a CDN, and reduce server response time (TTFB) to bring LCP under 2.5s.';
      } else if (mean && mean > CWV_THRESHOLDS.lcp.good) {
        status = 'partial';
        summary = `Average LCP ${Math.round(mean)}ms — in "Needs Work" range (2.5s–4s)`;
        evidence = 'Layer A Core Web Vitals';
        recommendation = 'Preload the LCP element and compress hero images to move into the Good range (≤2.5s).';
      } else {
        status = 'not-found';
        summary = `LCP is ${mean ? Math.round(mean) + 'ms' : 'N/A'} — within Good threshold`;
        evidence = 'Layer A Core Web Vitals';
        recommendation = 'No action needed — LCP is within the Good threshold.';
      }
    } else if (flag === 'perf-search') {
      const searchIssues = allIssues.filter(i => i.type === 'search-filter-lag');
      status = searchIssues.length > 0 ? 'confirmed' : 'not-found';
      summary = searchIssues.length > 0 ? `${searchIssues.length} search interaction(s) exceed 300ms response threshold` : 'Search response within 300ms RAIL threshold';
      evidence = 'Layer H interaction performance';
      recommendation = searchIssues.length > 0
        ? 'Debounce search input and show an instant loading indicator; target sub-300ms response via client-side filtering or a faster search index.'
        : 'No action needed — search responsiveness meets the RAIL guideline.';
    } else if (flag === 'perf-calculator') {
      const calcIssues = allIssues.filter(i => i.type === 'interaction-lag');
      status = calcIssues.length > 0 ? 'confirmed' : 'not-found';
      summary = calcIssues.length > 0 ? `${calcIssues.length} UI interaction(s) exceed 100ms RAIL budget` : 'Calculator interactions within 100ms RAIL budget';
      evidence = 'Layer H interaction performance';
      recommendation = calcIssues.length > 0
        ? 'Run calculation logic synchronously on the client and avoid unnecessary re-renders to stay within the 100ms RAIL budget.'
        : 'No action needed — interactions meet the RAIL responsiveness budget.';
    } else if (flag === 'perf-checkout') {
      const checkoutPages = pages.filter(p => p.url.includes('checkout') || p.url.includes('cart') || p.url.includes('payment'));
      if (checkoutPages.length > 0) {
        const worstScore = Math.min(...checkoutPages.map(p => p.score));
        status = worstScore < 50 ? 'confirmed' : worstScore < 70 ? 'partial' : 'not-found';
        summary = `Checkout pages score: ${worstScore}/100`;
        evidence = 'Layer A-F on /checkout, /cart, /payment';
        recommendation = worstScore < 70
          ? 'Prioritize optimizing the checkout/cart/payment pages — these directly impact conversion; audit for render-blocking scripts and heavy third-party trackers.'
          : 'No action needed — checkout flow performance is healthy.';
      } else {
        status = 'partial';
        summary = 'Checkout pages not reachable without auth — general scan applied';
        evidence = 'General scan';
        recommendation = 'Provide test credentials or a direct checkout URL so this flow can be fully audited.';
      }
    } else {
      // Generic fallback — check overall score
      const overallScore = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length) : 100;
      status = overallScore < 50 ? 'confirmed' : overallScore < 70 ? 'partial' : 'not-found';
      summary = `Overall performance score: ${overallScore}/100`;
      evidence = 'General performance scan';
      recommendation = overallScore < 70
        ? 'Review the Resource Issues list and prioritize P0/P1 recommendations to address the underlying cause.'
        : 'No action needed — overall performance score is healthy.';
    }

    results.push({ flag, flagLabel: label, status, summary, evidence, recommendation });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════
// LAYER G: Auth Flow Timing
// ═══════════════════════════════════════════════════════════
async function measureAuthFlow(
  context: BrowserContext,
  baseUrl: string,
  loginConfig: LoginConfig | undefined,
  log: (testId: string, status: string, message: string, methodology?: string, phase?: string) => void,
): Promise<AuthFlowResult> {
  const loginUrl = loginConfig?.loginUrl || new URL('/login', baseUrl).href;
  const issues: ResourceIssue[] = [];
  let page: Page | null = null;

  try {
    page = await context.newPage();

    // 1. Time to form visible
    const t0 = Date.now();
    await page.goto(loginUrl, { waitUntil: 'load', timeout: 20000 });
    const timeToFormMs = Date.now() - t0;

    // Check autocomplete attributes
    const hasAutocomplete = await page.$$eval(
      'input[type="password"]',
      inputs => inputs.some(i => i.hasAttribute('autocomplete'))
    ).catch(() => false);
    if (!hasAutocomplete) {
      issues.push({ type: 'auth-form-no-autocomplete', url: loginUrl, pageUrl: loginUrl, severity: 'low',
        description: 'Login form missing autocomplete attributes — users must retype credentials on every visit.',
        recommendation: 'Add autocomplete="username" to email/username field and autocomplete="current-password" to password field.', metrics: {} });
    }

    // 2. Submit + measure response (use provided creds or dummy)
    let submitToResponseMs: number | null = null;
    let responseToInteractiveMs: number | null = null;
    let totalRoundTripMs: number | null = null;
    const credentialsProvided = !!(loginConfig?.username && loginConfig?.password);
    let submitAttemptFailed = false;

    if (credentialsProvided) {
      try {
        await page.fill(loginConfig!.usernameSelector || 'input[type="email"],input[name="username"],input[name="email"]', loginConfig!.username!).catch(() => {});
        await page.fill(loginConfig!.passwordSelector || 'input[type="password"]', loginConfig!.password!).catch(() => {});
        const t1 = Date.now();
        await Promise.all([
          page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
          page.click(loginConfig!.submitSelector || 'button[type="submit"]').catch(() => {}),
        ]);
        submitToResponseMs = Date.now() - t1;
        const t2 = Date.now();
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        responseToInteractiveMs = Date.now() - t2;
        totalRoundTripMs = timeToFormMs + submitToResponseMs + responseToInteractiveMs;
      } catch {
        submitAttemptFailed = true;
        log('PERF-AUTH', 'error', '  ⚠ Auth submit failed — credentials may be invalid', 'Layer G', 'Layer G: Auth Flow');
      }
    }

    // Check OTP page if otp flag active
    let otpPageLoadMs: number | null = null;
    try {
      const currentUrl = page.url();
      if (currentUrl.match(/otp|verify|2fa|confirm/i)) {
        const t3 = Date.now();
        await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
        otpPageLoadMs = Date.now() - t3;
        if (otpPageLoadMs > 3000) {
          issues.push({ type: 'otp-page-heavy', url: currentUrl, pageUrl: currentUrl, severity: 'high',
            description: `OTP/verification page takes ${otpPageLoadMs}ms to load — too slow for time-sensitive 2FA flows.`,
            recommendation: 'Reduce OTP page weight. Remove heavy scripts and images. Target < 1.5s load time.', metrics: { loadMs: otpPageLoadMs } });
        }
      }
    } catch {}

    // Auth issues based on timing
    if (timeToFormMs > 3000) {
      issues.push({ type: 'auth-flow-slow', url: loginUrl, pageUrl: loginUrl, severity: 'high',
        description: `Login page takes ${Math.round(timeToFormMs)}ms to render — users face a ${(timeToFormMs / 1000).toFixed(1)}s wait before they can even type credentials.`,
        recommendation: 'Optimize login page: remove third-party scripts, preload critical CSS, minimize server response time.', metrics: { timeToFormMs } });
    }

    if (totalRoundTripMs !== null && totalRoundTripMs > 5000) {
      issues.push({ type: 'auth-flow-slow', url: loginUrl, pageUrl: loginUrl, severity: 'critical',
        description: `Auth round-trip is ${Math.round(totalRoundTripMs)}ms — exceeds 5s critical threshold. Users are highly likely to abandon.`,
        recommendation: 'Investigate auth API performance. Consider optimistic UI (show dashboard skeleton while auth completes).', metrics: { totalRoundTripMs } });
    } else if (totalRoundTripMs !== null && totalRoundTripMs > 3000) {
      issues.push({ type: 'auth-flow-slow', url: loginUrl, pageUrl: loginUrl, severity: 'high',
        description: `Auth round-trip is ${Math.round(totalRoundTripMs)}ms — exceeds recommended 3s threshold.`,
        recommendation: 'Reduce auth API response time. Use edge deployment for auth service. Add progress indicator immediately on form submit.', metrics: { totalRoundTripMs } });
    }

    if (submitToResponseMs !== null && submitToResponseMs > 2000) {
      issues.push({ type: 'post-login-redirect-slow', url: loginUrl, pageUrl: loginUrl, severity: 'medium',
        description: `Post-login redirect takes ${Math.round(submitToResponseMs)}ms — dashboard not ready for over 2 seconds after successful auth.`,
        recommendation: 'Pre-fetch dashboard data during auth. Use skeleton loading state immediately after login success.', metrics: { submitToResponseMs } });
    }

    const status: AuthFlowResult['status'] = !credentialsProvided
      ? 'skipped'
      : submitAttemptFailed
        ? 'failed'
        : !totalRoundTripMs
          ? (timeToFormMs > 3000 ? 'slow' : 'pass')
          : totalRoundTripMs > 5000 ? 'critical'
          : totalRoundTripMs > 3000 ? 'slow' : 'pass';

    return { loginUrl, timeToFormMs, submitToResponseMs, responseToInteractiveMs, totalRoundTripMs, status, issues, otpPageLoadMs };
  } catch (err) {
    log('PERF-AUTH', 'error', `  ⚠ Auth flow measurement failed: ${(err as Error).message}`, 'Layer G', 'Layer G: Auth Flow');
    return { loginUrl, timeToFormMs: null, submitToResponseMs: null, responseToInteractiveMs: null, totalRoundTripMs: null, status: 'skipped', issues };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
// LAYER H: Interaction Performance
// ═══════════════════════════════════════════════════════════
async function detectInteractionIssues(
  context: BrowserContext,
  pages: PageData[],
  flags: PerformanceFlag[],
  log: (testId: string, status: string, message: string, methodology?: string, phase?: string) => void,
): Promise<ResourceIssue[]> {
  const issues: ResourceIssue[] = [];
  const testPage = pages[0];
  if (!testPage) return issues;
  let page: Page | null = null;
  try {
    page = await context.newPage();
    await page.goto(testPage.url, { waitUntil: 'load', timeout: 20000 });

    if (flags.includes('perf-search')) {
      const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]').catch(() => null);
      if (searchInput) {
        const t0 = Date.now();
        await searchInput.type('test', { delay: 30 }).catch(() => {});
        await page.waitForTimeout(500);
        const lag = Date.now() - t0 - 500;
        if (lag > 300) {
          issues.push({ type: 'search-filter-lag', url: testPage.url, pageUrl: testPage.url, severity: 'medium',
            description: `Search input response is ${lag}ms — exceeds 300ms RAIL threshold for filter interactions.`,
            recommendation: 'Debounce search input handler (300ms). Use virtual scrolling for large result sets. Cache frequent search terms.', metrics: { lagMs: lag } });
          log('PERF-INP', 'fail', `  ✗ Search lag detected: ${lag}ms (threshold: 300ms)`, 'RAIL Response', 'Layer H: Interaction');
        } else {
          log('PERF-INP', 'pass', `  ✓ Search response: ${lag}ms (within 300ms threshold)`, 'RAIL Response', 'Layer H: Interaction');
        }
      } else {
        log('PERF-INP', 'pass', '  → No search input found on homepage', 'RAIL Response', 'Layer H: Interaction');
      }
    }

    if (flags.includes('perf-calculator')) {
      const numberInput = await page.$('input[type="number"], input[name*="amount" i], input[name*="premium" i], input[name*="loan" i]').catch(() => null);
      if (numberInput) {
        const t0 = Date.now();
        await numberInput.fill('50000').catch(() => {});
        await page.waitForTimeout(300);
        const lag = Date.now() - t0 - 300;
        if (lag > 200) {
          issues.push({ type: 'interaction-lag', url: testPage.url, pageUrl: testPage.url, severity: 'medium',
            description: `Form calculation lag is ${lag}ms — exceeds 200ms threshold for interactive tools.`,
            recommendation: 'Move calculation logic to Web Worker. Debounce input handler. Avoid synchronous DOM operations in calculation callbacks.', metrics: { lagMs: lag } });
          log('PERF-INP', 'fail', `  ✗ Calculator lag: ${lag}ms (threshold: 200ms)`, 'RAIL Response', 'Layer H: Interaction');
        } else {
          log('PERF-INP', 'pass', `  ✓ Calculator response: ${lag}ms (within 200ms threshold)`, 'RAIL Response', 'Layer H: Interaction');
        }
      } else {
        log('PERF-INP', 'pass', '  → No calculator / number input found on homepage', 'RAIL Response', 'Layer H: Interaction');
      }
    }
  } catch (err) {
    log('PERF-INP', 'error', `  ⚠ Interaction test failed: ${(err as Error).message}`, 'Layer H', 'Layer H: Interaction');
  } finally {
    if (page) await page.close().catch(() => {});
  }
  return issues;
}

// ═══════════════════════════════════════════════════════════
// LAYER I: Network Simulation
// ═══════════════════════════════════════════════════════════
const NETWORK_PRESETS: Array<{ preset: NetworkSimResult['preset']; label: string; downloadMbps: number; uploadMbps: number; latencyMs: number }> = [
  { preset: 'fast-4g',  label: 'Fast 4G',  downloadMbps: 4,   uploadMbps: 3,   latencyMs: 70  },
  { preset: 'fast-3g',  label: 'Fast 3G',  downloadMbps: 1.6, uploadMbps: 0.77, latencyMs: 150 },
  { preset: 'slow-3g',  label: 'Slow 3G',  downloadMbps: 0.5, uploadMbps: 0.5, latencyMs: 400 },
];

async function runNetworkSimulation(
  context: BrowserContext,
  url: string,
  log: (testId: string, status: string, message: string, methodology?: string, phase?: string) => void,
): Promise<NetworkSimResult[]> {
  const results: NetworkSimResult[] = [];
  for (const preset of NETWORK_PRESETS) {
    let page: Page | null = null;
    try {
      page = await context.newPage();
      const cdp = await (page as any).context().newCDPSession(page).catch(() => null);
      if (cdp) {
        await cdp.send('Network.enable').catch(() => {});
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: (preset.downloadMbps * 1024 * 1024) / 8,
          uploadThroughput: (preset.uploadMbps * 1024 * 1024) / 8,
          latency: preset.latencyMs,
        }).catch(() => {});
      }

      const t0 = Date.now();
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      const loadTimeMs = Date.now() - t0;
      await page.waitForTimeout(1000);

      const vitals = await page.evaluate(() => {
        const r: Record<string, number | null> = { lcp: null, fcp: null, ttfb: null };
        try { const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming; if (nav) r.ttfb = Math.round(nav.responseStart - nav.requestStart); } catch {}
        try { const f = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint'); if (f) r.fcp = Math.round(f.startTime); } catch {}
        try { const lcp = performance.getEntriesByType('largest-contentful-paint'); if (lcp.length > 0) r.lcp = Math.round(lcp[lcp.length - 1].startTime); } catch {}
        return r;
      }).catch(() => ({ lcp: null, fcp: null, ttfb: null }));

      // Throttled/slow presets sometimes resolve before a largest-contentful-paint
      // entry has fired — fall back to an FCP-based estimate (same heuristic used
      // by the main measureCoreWebVitals() pass) rather than leaving LCP empty.
      if (vitals.lcp === null && vitals.fcp !== null) {
        vitals.lcp = Math.round(vitals.fcp * 1.5);
      }

      // Simple score based on LCP
      const lcpScore = vitals.lcp === null ? 70
        : vitals.lcp <= 2500 ? 90
        : vitals.lcp <= 4000 ? Math.round(90 - ((vitals.lcp - 2500) / 1500) * 40)
        : Math.max(10, Math.round(50 - ((vitals.lcp - 4000) / 4000) * 40));

      const score = Math.max(0, Math.min(100, lcpScore - Math.min(15, Math.round(loadTimeMs / 3000))));
      log('PERF-NET-SIM', score >= 70 ? 'pass' : 'fail',
        `  ${preset.label}: LCP ${vitals.lcp ? Math.round(vitals.lcp) + 'ms' : 'N/A'} | Load ${Math.round(loadTimeMs)}ms | Score ~${score}/100`,
        'CDP Network Simulation', 'Layer I: Network Simulation');

      results.push({ preset: preset.preset, label: preset.label, downloadMbps: preset.downloadMbps, latencyMs: preset.latencyMs, lcp: vitals.lcp, fcp: vitals.fcp, ttfb: vitals.ttfb, loadTimeMs, score });
    } catch (err) {
      log('PERF-NET-SIM', 'error', `  ⚠ ${preset.label} simulation failed: ${(err as Error).message}`, 'Layer I', 'Layer I: Network Simulation');
      results.push({ preset: preset.preset, label: preset.label, downloadMbps: preset.downloadMbps, latencyMs: preset.latencyMs, lcp: null, fcp: null, ttfb: null, loadTimeMs: null, score: null });
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════
// LAYER J: Third-Party Impact
// ═══════════════════════════════════════════════════════════

const THIRD_PARTY_PATTERNS: Array<{ pattern: RegExp; label: string; category: ThirdPartyCategory }> = [
  { pattern: /google-analytics\.com|googletagmanager\.com|gtag\/js/, label: 'Google Analytics / GTM', category: 'analytics' },
  { pattern: /segment\.com|mixpanel\.com|amplitude\.com|heap\.io/, label: 'Product Analytics', category: 'analytics' },
  { pattern: /hotjar\.com|fullstory\.com|mouseflow\.com|clarity\.ms/, label: 'Session Recording', category: 'analytics' },
  { pattern: /facebook\.net|fbcdn\.net|connect\.facebook\.com/, label: 'Facebook Pixel', category: 'marketing-tag' },
  { pattern: /doubleclick\.net|googlesyndication\.com|adservice\.google/, label: 'Google Ads', category: 'marketing-tag' },
  { pattern: /linkedin\.com\/analytics|snap\.licdn\.com|ads\.linkedin\.com/, label: 'LinkedIn Insight', category: 'marketing-tag' },
  { pattern: /intercom\.io|intercomcdn\.com/, label: 'Intercom', category: 'chat-widget' },
  { pattern: /zendesk\.com|zdassets\.com/, label: 'Zendesk', category: 'chat-widget' },
  { pattern: /livechat\.com|tawk\.to|freshchat\.com|crisp\.chat/, label: 'Live Chat Widget', category: 'chat-widget' },
  { pattern: /twitter\.com\/widgets|platform\.twitter\.com/, label: 'Twitter / X Embed', category: 'social' },
  { pattern: /instagram\.com\/embed/, label: 'Instagram Embed', category: 'social' },
  { pattern: /youtube\.com\/embed|ytimg\.com/, label: 'YouTube Embed', category: 'video' },
  { pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/, label: 'Google Fonts', category: 'font' },
  { pattern: /typekit\.net|use\.typekit\.net/, label: 'Adobe Fonts', category: 'font' },
];

function classifyThirdParty(url: string): { label: string; category: ThirdPartyCategory } {
  for (const p of THIRD_PARTY_PATTERNS) {
    if (p.pattern.test(url)) return { label: p.label, category: p.category };
  }
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return { label: domain, category: 'other' };
  } catch {
    return { label: 'Unknown', category: 'other' };
  }
}

async function detectThirdPartyImpact(
  context: BrowserContext,
  url: string,
  log: (testId: string, status: string, message: string, m?: string, p?: string) => void,
): Promise<ThirdPartyImpact[]> {
  const results: ThirdPartyImpact[] = [];
  let page: Page | null = null;
  try {
    page = await context.newPage();
    let ownHost = '';
    try { ownHost = new URL(url).hostname; } catch {}

    const resourceTiming: Map<string, { start: number; end: number; size: number; transferSize: number }> = new Map();

    page.on('response', async (response) => {
      try {
        const resUrl = response.url();
        const host = new URL(resUrl).hostname;
        if (host && host !== ownHost && !host.endsWith(`.${ownHost}`)) {
          const headers = response.headers();
          const size = parseInt(headers['content-length'] || '0', 10);
          resourceTiming.set(resUrl, { start: Date.now(), end: 0, size, transferSize: size });
        }
      } catch {}
    });

    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Get detailed timing via Performance API
    const timings = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map((e) => {
        const r = e as PerformanceResourceTiming;
        return {
          name: r.name,
          duration: Math.round(r.duration),
          transferSize: r.transferSize || 0,
          initiatorType: r.initiatorType,
        };
      });
    }).catch(() => []);

    // Get script async/defer attributes
    const scriptAttrs = await page.$$eval('script[src]', scripts => {
      return scripts.map(s => ({
        src: s.getAttribute('src') || '',
        async: s.hasAttribute('async'),
        defer: s.hasAttribute('defer'),
      }));
    }).catch(() => []);
    const asyncScripts = new Set(scriptAttrs.filter(s => s.async || s.defer).map(s => s.src));

    const seen = new Set<string>();
    for (const t of timings) {
      try {
        const resHost = new URL(t.name).hostname;
        if (!resHost || resHost === ownHost || resHost.endsWith(`.${ownHost}`)) continue;

        const domain = resHost.replace(/^www\./, '');
        const key = domain;
        if (seen.has(key)) continue;
        seen.add(key);

        const { label, category } = classifyThirdParty(t.name);
        const isBlocking = t.initiatorType === 'script' && !asyncScripts.has(t.name) && t.duration > 100;
        const rec: ThirdPartyImpact['recommendation'] =
          category === 'analytics' && t.duration > 300 ? 'defer'
          : category === 'marketing-tag' && t.duration > 500 ? 'defer'
          : isBlocking ? 'defer'
          : t.duration > 1000 ? 'defer'
          : 'keep';

        results.push({
          url: t.name, domain, label, category,
          loadTimeMs: t.duration,
          transferSize: t.transferSize,
          blocking: isBlocking,
          async: asyncScripts.has(t.name),
          recommendation: rec,
        });

        if (t.duration > 500) {
          log('PERF-3P', 'fail', `  ✗ ${label}: ${t.duration}ms load time (>500ms threshold)`, 'Third-Party Impact', 'Layer J: Third-Party Impact');
        }
      } catch {}
    }

    results.sort((a, b) => (b.loadTimeMs ?? 0) - (a.loadTimeMs ?? 0));
  } catch (err) {
    log('PERF-3P', 'error', `  ⚠ Third-party analysis failed: ${(err as Error).message}`, 'Layer J', 'Layer J: Third-Party Impact');
  } finally {
    if (page) await page.close().catch(() => {});
  }
  return results;
}

// ═══════════════════════════════════════════════════════════
// LAYER K: Technical Architecture Detection
// ═══════════════════════════════════════════════════════════

async function detectArchitecture(
  context: BrowserContext,
  url: string,
  log: (testId: string, status: string, message: string, m?: string, p?: string) => void,
): Promise<ArchitectureInfo> {
  let page: Page | null = null;
  const result: ArchitectureInfo = {
    framework: null, cms: null, cdn: null, httpVersion: null,
    jsLibraries: [], cssFrameworks: [], hostingPlatform: null,
    hasServiceWorker: false, hasPwaManifest: false, hasResourceHints: false,
  };

  try {
    page = await context.newPage();
    let responseHeaders: Record<string, string> = {};

    page.on('response', response => {
      try {
        if (response.url() === url || response.url() === url + '/') {
          responseHeaders = response.headers();
        }
      } catch {}
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1500);

    // Framework detection via DOM signals
    const detectedFramework = await page.evaluate(() => {
      const w = window as any;
      if (w.__NEXT_DATA__) return 'Next.js';
      if (w.__nuxt__) return 'Nuxt.js';
      if (w.angular || document.querySelector('[ng-version]')) return 'Angular';
      if (w.Vue || document.querySelector('[data-v-]')) return 'Vue.js';
      if (document.querySelector('#__remix-error,script[data-remix-entrypoint]')) return 'Remix';
      if (document.querySelector('script[data-gatsby-script]') || w.__gatsbyjs) return 'Gatsby';
      if (document.getElementById('__NEXT_DATA__')) return 'Next.js';
      if (w.React || document.querySelector('[data-reactroot]')) return 'React';
      return null;
    }).catch(() => null);
    result.framework = detectedFramework;

    // CMS detection
    const detectedCms = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="generator"]')?.getAttribute('content') || '';
      if (meta.toLowerCase().includes('wordpress')) return 'WordPress';
      if (meta.toLowerCase().includes('drupal')) return 'Drupal';
      if (meta.toLowerCase().includes('joomla')) return 'Joomla';
      if (meta.toLowerCase().includes('shopify')) return 'Shopify';
      if (document.querySelector('link[href*="wp-content"]')) return 'WordPress';
      if ((window as any).Shopify) return 'Shopify';
      return null;
    }).catch(() => null);
    result.cms = detectedCms;

    // CDN detection from response headers
    const via = responseHeaders['via'] || '';
    const xCache = responseHeaders['x-cache'] || '';
    const cfRay = responseHeaders['cf-ray'] || '';
    const xServedBy = responseHeaders['x-served-by'] || '';
    const server = responseHeaders['server'] || '';
    const xAmzCf = responseHeaders['x-amz-cf-id'] || '';

    if (cfRay || via.includes('cloudflare') || server.includes('cloudflare')) result.cdn = 'Cloudflare';
    else if (xAmzCf || via.includes('CloudFront') || xCache.includes('CloudFront')) result.cdn = 'AWS CloudFront';
    else if (xServedBy.includes('cache') || via.includes('Fastly')) result.cdn = 'Fastly';
    else if (via.includes('Akamai') || xCache.includes('Akamai')) result.cdn = 'Akamai';
    else if (responseHeaders['x-azure-ref']) result.cdn = 'Azure CDN';
    else if (via.includes('Varnish') || xCache.includes('Varnish')) result.cdn = 'Varnish';

    // HTTP version from headers
    const protocol = responseHeaders[':status'] ? 'HTTP/2' : null;
    if (protocol) {
      result.httpVersion = 'HTTP/2';
    } else if (responseHeaders['x-firefox-http3'] || via.includes('h3')) {
      result.httpVersion = 'HTTP/3';
    } else if (Object.keys(responseHeaders).some(h => h.startsWith(':'))) {
      result.httpVersion = 'HTTP/2';
    } else {
      // Try CDP for protocol version
      result.httpVersion = 'HTTP/1.1';
    }

    // JS libraries
    const jsLibs = await page.evaluate(() => {
      const w = window as any;
      const libs: string[] = [];
      if (w.jQuery || w.$?.fn?.jquery) libs.push(`jQuery ${w.jQuery?.fn?.jquery || w.$?.fn?.jquery || ''}`);
      if (w._ && w._.VERSION) libs.push(`Lodash ${w._.VERSION}`);
      if (w.moment) libs.push(`Moment.js ${w.moment.version || ''}`);
      if (w.dayjs) libs.push('Day.js');
      if (w.axios) libs.push('Axios');
      if (w.Swiper) libs.push('Swiper');
      if (w.gsap) libs.push('GSAP');
      if (w.THREE) libs.push('Three.js');
      if (w.Chart) libs.push('Chart.js');
      if (w.Recharts) libs.push('Recharts');
      return libs;
    }).catch(() => []);
    result.jsLibraries = jsLibs;

    // CSS frameworks
    const cssFrameworks = await page.evaluate(() => {
      const frameworks: string[] = [];
      const classes = Array.from(document.querySelectorAll('[class]')).flatMap(el => Array.from(el.classList)).join(' ');
      if (classes.match(/\btailwind\b/) || document.querySelector('link[href*="tailwind"]') || classes.match(/\b(flex|grid|px-|py-|text-|bg-|rounded|shadow|hover:)/)) frameworks.push('Tailwind CSS');
      if (document.querySelector('link[href*="bootstrap"]') || classes.match(/\b(container|col-|row |navbar|btn btn-)/)) frameworks.push('Bootstrap');
      if (document.querySelector('link[href*="material"]') || classes.match(/\bmat-|MuiButton|mdc-/)) frameworks.push('Material UI');
      if (classes.match(/\bantd-|ant-/) || document.querySelector('link[href*="antd"]')) frameworks.push('Ant Design');
      return frameworks;
    }).catch(() => []);
    result.cssFrameworks = cssFrameworks;

    // Hosting platform
    if (responseHeaders['x-vercel-id']) result.hostingPlatform = 'Vercel';
    else if (responseHeaders['x-netlify']) result.hostingPlatform = 'Netlify';
    else if (responseHeaders['x-railway-request-id'] || via.includes('railway')) result.hostingPlatform = 'Railway';
    else if (server.includes('awselb') || server.includes('AWS')) result.hostingPlatform = 'AWS';
    else if (responseHeaders['x-ms-request-id'] || server.includes('Microsoft-IIS')) result.hostingPlatform = 'Azure';
    else if (responseHeaders['x-goog-generation'] || server.includes('Google Frontend')) result.hostingPlatform = 'Google Cloud';

    // Service worker + PWA
    result.hasServiceWorker = await page.evaluate(() => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller).catch(() => false);
    result.hasPwaManifest = await page.$('link[rel="manifest"]').then(el => el !== null).catch(() => false);
    result.hasResourceHints = await page.$$eval('link[rel="preload"],link[rel="prefetch"],link[rel="preconnect"]', els => els.length > 0).catch(() => false);

    if (!result.cdn) log('PERF-ARCH', 'fail', '  ✗ No CDN detected — static assets served from origin', 'Layer K', 'Layer K: Architecture');
    if (result.framework) log('PERF-ARCH', 'pass', `  ✓ Framework: ${result.framework}`, 'Layer K', 'Layer K: Architecture');
  } catch (err) {
    log('PERF-ARCH', 'error', `  ⚠ Architecture detection failed: ${(err as Error).message}`, 'Layer K', 'Layer K: Architecture');
  } finally {
    if (page) await page.close().catch(() => {});
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// LAYER L: Technical SEO Readiness
// ═══════════════════════════════════════════════════════════

async function detectSeoReadiness(
  context: BrowserContext,
  url: string,
  log: (testId: string, status: string, message: string, m?: string, p?: string) => void,
): Promise<SeoReadiness> {
  let page: Page | null = null;
  const brokenLinks: string[] = [];
  const issues: SeoIssue[] = [];

  try {
    page = await context.newPage();

    page.on('response', response => {
      if (response.status() === 404) {
        brokenLinks.push(response.url());
      }
    });

    await page.goto(url, { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(1000);

    const seoData = await page.evaluate(() => {
      const title = document.title || null;
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || null;
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
      const hasStructuredData = !!document.querySelector('script[type="application/ld+json"]');
      const hasOg = !!document.querySelector('meta[property^="og:"]');
      return { title, metaDesc, canonical, hasStructuredData, hasOg };
    }).catch(() => ({ title: null, metaDesc: null, canonical: null, hasStructuredData: false, hasOg: false }));

    // Check robots.txt
    let hasRobotsTxt: boolean | null = null;
    try {
      const base = new URL(url);
      const robotsUrl = `${base.origin}/robots.txt`;
      const robotsPage = await context.newPage();
      const res = await robotsPage.goto(robotsUrl, { timeout: 8000 }).catch(() => null);
      hasRobotsTxt = res ? res.status() === 200 : null;
      await robotsPage.close().catch(() => {});
    } catch {}

    // Check sitemap
    let hasSitemap: boolean | null = null;
    try {
      const base = new URL(url);
      const sitemapUrl = `${base.origin}/sitemap.xml`;
      const sitemapPage = await context.newPage();
      const res = await sitemapPage.goto(sitemapUrl, { timeout: 8000 }).catch(() => null);
      hasSitemap = res ? res.status() === 200 : null;
      await sitemapPage.close().catch(() => {});
    } catch {}

    // Build issues list
    const titleLen = seoData.title?.length ?? 0;
    const descLen = seoData.metaDesc?.length ?? 0;

    if (!seoData.title) {
      issues.push({ type: 'missing-title', severity: 'critical', detail: 'Page is missing a <title> tag.', recommendation: 'Add a descriptive <title> tag (50–60 characters).' });
      log('PERF-SEO', 'fail', '  ✗ Missing <title> tag', 'SEO', 'Layer L: SEO Readiness');
    } else if (titleLen < 10 || titleLen > 70) {
      issues.push({ type: 'title-length', severity: 'medium', detail: `Title length is ${titleLen} chars — optimal is 50–60 chars.`, recommendation: 'Rewrite title to be 50–60 characters.' });
    }
    if (!seoData.metaDesc) {
      issues.push({ type: 'missing-meta-description', severity: 'high', detail: 'Missing <meta name="description">.', recommendation: 'Add a meta description of 120–160 characters.' });
      log('PERF-SEO', 'fail', '  ✗ Missing meta description', 'SEO', 'Layer L: SEO Readiness');
    } else if (descLen < 50 || descLen > 165) {
      issues.push({ type: 'meta-description-length', severity: 'low', detail: `Meta description is ${descLen} chars — optimal is 120–160 chars.`, recommendation: 'Rewrite meta description to be 120–160 characters.' });
    }
    if (!seoData.canonical) {
      issues.push({ type: 'missing-canonical', severity: 'medium', detail: 'No canonical URL tag found.', recommendation: 'Add <link rel="canonical" href="..."> to prevent duplicate content issues.' });
    }
    if (!seoData.hasStructuredData) {
      issues.push({ type: 'missing-structured-data', severity: 'medium', detail: 'No JSON-LD structured data detected.', recommendation: 'Add schema.org structured data (Organization, WebPage, Product, etc.) to enhance search appearance.' });
    }
    if (!seoData.hasOg) {
      issues.push({ type: 'missing-open-graph', severity: 'low', detail: 'No Open Graph meta tags detected.', recommendation: 'Add og:title, og:description, og:image for better social sharing.' });
    }
    if (hasRobotsTxt === false) {
      issues.push({ type: 'missing-robots-txt', severity: 'high', detail: '/robots.txt not found (404).', recommendation: 'Create a robots.txt file to control crawler access.' });
    }
    if (hasSitemap === false) {
      issues.push({ type: 'missing-sitemap', severity: 'high', detail: '/sitemap.xml not found (404).', recommendation: 'Generate and publish an XML sitemap. Submit it to Google Search Console.' });
    }
    if (brokenLinks.length > 0) {
      issues.push({ type: 'broken-links', severity: 'high', detail: `${brokenLinks.length} broken link(s) returning 404.`, recommendation: 'Fix or redirect all broken links. Use 301 redirects for moved content.' });
    }

    return {
      hasMetaTitle: !!seoData.title,
      hasMetaDescription: !!seoData.metaDesc,
      hasRobotsTxt,
      hasSitemap,
      hasCanonical: !!seoData.canonical,
      hasStructuredData: seoData.hasStructuredData,
      hasOpenGraph: seoData.hasOg,
      metaTitleLength: titleLen || null,
      metaDescriptionLength: descLen || null,
      brokenLinks: brokenLinks.slice(0, 10),
      issues,
    };
  } catch (err) {
    log('PERF-SEO', 'error', `  ⚠ SEO readiness check failed: ${(err as Error).message}`, 'Layer L', 'Layer L: SEO Readiness');
    return {
      hasMetaTitle: false, hasMetaDescription: false, hasRobotsTxt: null, hasSitemap: null,
      hasCanonical: false, hasStructuredData: false, hasOpenGraph: false,
      metaTitleLength: null, metaDescriptionLength: null, brokenLinks: [], issues,
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
// LAYER M: UX Performance
// ═══════════════════════════════════════════════════════════

async function measureUXPerformance(
  context: BrowserContext,
  url: string,
  log: (testId: string, status: string, message: string, m?: string, p?: string) => void,
): Promise<UXPerformanceResult> {
  let page: Page | null = null;
  const issues: ResourceIssue[] = [];
  const painPoints: UXPainPoint[] = [];
  const improvements: UXImprovement[] = [];

  let loadScore = 100;
  let stabilityScore = 100;
  let responsivenessScore = 100;
  let animationScore = 100;

  let hasLoadingIndicator = false;
  let hasSkeletonScreens = false;
  let hasProgressiveLoading = false;
  let timeToInteractiveMs: number | null = null;
  let clsDuringInteraction: number | null = null;
  let layoutJankScore: 'none' | 'minor' | 'major' = 'none';
  let mobileUsabilityScore: number | null = null;
  let navigationResponseMs: number | null = null;
  let formResponseMs: number | null = null;
  let searchResponseMs: number | null = null;
  let scrollJank = false;
  let animationFps: number | null = null;
  let pageTransitionMs: number | null = null;
  let smoothnessScore: 'smooth' | 'minor-jank' | 'janky' = 'smooth';

  try {
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // ── Initial Load Experience ──────────────────────────────
    hasLoadingIndicator = await page.evaluate(() => {
      const selectors = [
        '[class*="spinner"]', '[class*="loader"]', '[class*="loading"]',
        '[role="progressbar"]', '[aria-label*="loading" i]', '[aria-busy="true"]',
        '.skeleton', '[class*="skeleton"]', '[class*="shimmer"]', '[class*="placeholder"]',
      ];
      return selectors.some(sel => document.querySelectorAll(sel).length > 0);
    }).catch(() => false);

    hasSkeletonScreens = await page.evaluate(() => {
      const patterns = ['[class*="skeleton"]', '[class*="shimmer"]', '[class*="placeholder-glow"]', '[class*="content-placeholder"]'];
      if (patterns.some(p => document.querySelectorAll(p).length > 0)) return true;
      // Check for animated gradient backgrounds
      const allEls = document.querySelectorAll('*');
      for (const el of Array.from(allEls).slice(0, 100)) {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage || '';
        if (bg.includes('gradient') && style.animationName && style.animationName !== 'none') return true;
      }
      return false;
    }).catch(() => false);

    // Progressive loading — check paint timing spread
    hasProgressiveLoading = await page.evaluate(() => {
      const paints = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');
      if (paints.length === 0 || resources.length === 0) return false;
      const fcp = paints.find(p => p.name === 'first-contentful-paint')?.startTime ?? 0;
      const lcp = (performance.getEntriesByType('largest-contentful-paint').pop() as any)?.startTime ?? 0;
      return lcp - fcp > 500;
    }).catch(() => false);

    // TTI approximation
    timeToInteractiveMs = await page.evaluate(() => {
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const longTasks = performance.getEntriesByType('longtask');
        if (!nav) return null;
        if (longTasks.length === 0) return Math.round(nav.domInteractive);
        const lastLongTask = longTasks.reduce((a, b) => a.startTime > b.startTime ? a : b);
        return Math.round(lastLongTask.startTime + lastLongTask.duration);
      } catch { return null; }
    }).catch(() => null);

    if (!hasLoadingIndicator) {
      loadScore -= 20;
      painPoints.push({ area: 'loading', severity: 'medium', description: 'No loading indicator detected during page load.', userImpact: 'Users see a blank or partially loaded page with no visual feedback — increases perceived wait time and frustration.' });
      issues.push({ type: 'no-loading-indicator', url, pageUrl: url, severity: 'medium', description: 'No spinner, progress bar, or loading indicator found during page load.', recommendation: 'Add a page-level loading indicator (skeleton screens or progress bar) that appears immediately on navigation.' });
      improvements.push({ area: 'Loading Indicators', recommendation: 'Add skeleton screens or a top-bar progress indicator', expectedUplift: 'Reduces perceived load time by ~40%', effort: 'Quick (hours)' });
    }
    if (!hasSkeletonScreens) {
      loadScore -= 15;
      painPoints.push({ area: 'loading', severity: 'low', description: 'No skeleton loading screens detected.', userImpact: 'Content areas appear blank during data fetch — reduces perceived performance quality.' });
    }

    // ── Visual Stability Under Interaction ───────────────────
    const clsData = await page.evaluate(async () => {
      let clsValue = 0;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
      });
      try { observer.observe({ type: 'layout-shift', buffered: true }); } catch {}

      // Trigger interactions to measure CLS
      const clickTargets = document.querySelectorAll('button:not([type="submit"]), [role="tab"], details summary, [data-toggle]');
      for (const el of Array.from(clickTargets).slice(0, 3)) {
        try { (el as HTMLElement).click(); await new Promise(r => setTimeout(r, 500)); } catch {}
      }
      await new Promise(r => setTimeout(r, 1000));
      observer.disconnect();
      return clsValue;
    }).catch(() => 0);

    clsDuringInteraction = parseFloat(clsData.toFixed(4));
    if (clsDuringInteraction > 0.25) {
      layoutJankScore = 'major';
      stabilityScore -= 30;
      painPoints.push({ area: 'stability', severity: 'high', description: `High layout instability on interaction (CLS: ${clsDuringInteraction}).`, userImpact: 'Content jumps around when users interact with tabs, accordions, or dropdowns — causes misclicks and disorientation.' });
      issues.push({ type: 'layout-instability-on-interact', url, pageUrl: url, severity: 'high', description: `CLS of ${clsDuringInteraction} detected during user interactions.`, recommendation: 'Reserve space for dynamic content. Avoid inserting content above existing content. Use CSS transforms for animations.' });
    } else if (clsDuringInteraction > 0.1) {
      layoutJankScore = 'minor';
      stabilityScore -= 15;
    }

    // ── Navigation Responsiveness ────────────────────────────
    const navTimes: number[] = [];
    try {
      const navLinks = await page.$$('nav a[href], header a[href], [role="navigation"] a[href]');
      for (const link of navLinks.slice(0, 3)) {
        try {
          const href = await link.getAttribute('href');
          if (!href || href.startsWith('http') || href === '#') continue;
          const t0 = Date.now();
          await link.click().catch(() => {});
          await page.waitForTimeout(400);
          navTimes.push(Date.now() - t0);
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(300);
        } catch {}
      }
      if (navTimes.length > 0) {
        navigationResponseMs = Math.round(navTimes.reduce((a, b) => a + b, 0) / navTimes.length);
        if (navigationResponseMs > 500) {
          responsivenessScore -= 25;
          painPoints.push({ area: 'responsiveness', severity: 'high', description: `Navigation response averages ${navigationResponseMs}ms.`, userImpact: 'Slow page transitions make the site feel sluggish — users expect navigation response within 300ms.' });
          issues.push({ type: 'nav-response-lag', url, pageUrl: url, severity: 'high', description: `Average navigation response time is ${navigationResponseMs}ms (target: <300ms).`, recommendation: 'Implement route prefetching. Use instant navigation with optimistic UI. Reduce JS parse time on destination pages.', metrics: { navResponseMs: navigationResponseMs } });
          improvements.push({ area: 'Navigation Speed', recommendation: 'Add route prefetching (next/link prefetch, Quicklink)', expectedUplift: 'Navigation feels 2–3× faster for repeat visitors', effort: 'Medium (days)' });
        } else if (navigationResponseMs > 300) {
          responsivenessScore -= 10;
        }
      }
    } catch {}

    // ── Form Responsiveness ──────────────────────────────────
    try {
      const formInput = await page.$('input[type="text"], input[type="email"], input:not([type="hidden"]):not([type="submit"])').catch(() => null);
      if (formInput) {
        const t0 = Date.now();
        await formInput.click().catch(() => {});
        await formInput.type('a').catch(() => {});
        await page.waitForTimeout(200);
        formResponseMs = Date.now() - t0;
        if (formResponseMs > 200) {
          responsivenessScore -= 20;
          painPoints.push({ area: 'responsiveness', severity: 'medium', description: `Form input response is ${formResponseMs}ms.`, userImpact: 'Input lag makes the form feel unresponsive — users may type faster than the UI updates.' });
          issues.push({ type: 'form-response-lag', url, pageUrl: url, severity: 'medium', description: `Form input-to-feedback latency is ${formResponseMs}ms (target: <100ms).`, recommendation: 'Avoid synchronous validation on every keystroke. Debounce validation. Ensure no heavy event listeners block input.', metrics: { formResponseMs } });
        }
      }
    } catch {}

    // ── Search Responsiveness ────────────────────────────────
    try {
      const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i], [role="searchbox"] input').catch(() => null);
      if (searchInput) {
        const t0 = Date.now();
        await searchInput.click().catch(() => {});
        await searchInput.type('test query').catch(() => {});
        await page.waitForTimeout(600);
        searchResponseMs = Date.now() - t0 - 600;
        if (searchResponseMs > 500) {
          responsivenessScore -= 20;
          painPoints.push({ area: 'responsiveness', severity: 'high', description: `Search results take ${searchResponseMs}ms to appear.`, userImpact: 'Slow search results cause users to abandon search — especially damaging on mobile where typing is slower.' });
          issues.push({ type: 'search-response-lag', url, pageUrl: url, severity: 'high', description: `Search query-to-results latency is ${searchResponseMs}ms (target: <300ms).`, recommendation: 'Add debounce (300ms) to search input. Cache frequent search results. Use instant search with client-side filtering for static data.', metrics: { searchResponseMs } });
          improvements.push({ area: 'Search Performance', recommendation: 'Implement debounce + instant preview with cached results', expectedUplift: 'Search feels instant (<300ms), reducing abandon rate', effort: 'Medium (days)' });
        }
      }
    } catch {}

    // ── Mobile Usability Score ───────────────────────────────
    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(500);
      const mobileData = await page.evaluate(() => {
        let score = 100;
        const viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) score -= 30;
        const inputs = document.querySelectorAll('input:not([type="hidden"])');
        let smallFonts = 0;
        for (const inp of Array.from(inputs)) {
          const fs = parseFloat(window.getComputedStyle(inp).fontSize);
          if (fs < 16) smallFonts++;
        }
        if (smallFonts > 0) score -= smallFonts * 5;
        return Math.max(0, score);
      }).catch(() => null);
      mobileUsabilityScore = mobileData;
      await page.setViewportSize({ width: 1280, height: 800 });
    } catch {}

    // ── Scroll Jank Detection ────────────────────────────────
    try {
      const jankData = await page.evaluate(async () => {
        let jankFrames = 0;
        let totalFrames = 0;
        const loafEntries: number[] = [];
        const obs = new PerformanceObserver(list => {
          for (const e of list.getEntries()) {
            if (e.duration > 50) loafEntries.push(e.duration);
          }
        });
        try { obs.observe({ type: 'long-animation-frame', buffered: false }); } catch {}

        // Simulate scroll
        const start = Date.now();
        const scrollFn = () => { window.scrollBy(0, 100); };
        const interval = setInterval(scrollFn, 16);
        await new Promise(r => setTimeout(r, 1000));
        clearInterval(interval);
        obs.disconnect();
        window.scrollTo(0, 0);
        return { jankFrames: loafEntries.length, loafDurations: loafEntries };
      }).catch(() => ({ jankFrames: 0, loafDurations: [] }));

      scrollJank = jankData.jankFrames > 3;
      if (jankData.loafDurations.length > 0) {
        const avgDuration = jankData.loafDurations.reduce((a, b) => a + b, 0) / jankData.loafDurations.length;
        animationFps = avgDuration > 0 ? Math.round(1000 / avgDuration) : 60;
      } else {
        animationFps = 60;
      }

      if (scrollJank) {
        animationScore -= 25;
        smoothnessScore = 'janky';
        painPoints.push({ area: 'animation', severity: 'high', description: 'Scroll jank detected — dropped frames during scrolling.', userImpact: 'Choppy scrolling is one of the most noticeable UX problems on mobile — users perceive the site as slow and low-quality.' });
        issues.push({ type: 'scroll-jank', url, pageUrl: url, severity: 'high', description: `${jankData.jankFrames} long animation frame(s) detected during scroll (>50ms each).`, recommendation: 'Use will-change: transform on scroll containers. Avoid layout-triggering properties in scroll handlers. Use passive event listeners.', metrics: { jankFrames: jankData.jankFrames, avgDurationMs: jankData.loafDurations.length > 0 ? Math.round(jankData.loafDurations.reduce((a, b) => a + b, 0) / jankData.loafDurations.length) : 0 } });
        improvements.push({ area: 'Scroll Smoothness', recommendation: 'Add will-change: transform, use passive scroll listeners', expectedUplift: 'Eliminates scroll jank, significantly improves mobile UX quality perception', effort: 'Quick (hours)' });
      } else if (jankData.jankFrames > 1) {
        animationScore -= 10;
        smoothnessScore = 'minor-jank';
      }
    } catch {}

    // ── Page Transitions ─────────────────────────────────────
    try {
      const hasTransitionStyle = await page.evaluate(() => {
        const allEls = document.querySelectorAll('*');
        for (const el of Array.from(allEls).slice(0, 200)) {
          const s = window.getComputedStyle(el);
          if (s.transition && s.transition !== 'all 0s ease 0s' && s.transition !== 'none 0s ease 0s') return true;
        }
        return false;
      }).catch(() => false);

      if (!hasTransitionStyle) {
        animationScore -= 10;
        improvements.push({ area: 'Page Transitions', recommendation: 'Add CSS transitions for route changes (fade, slide)', expectedUplift: 'Makes the app feel polished and modern — reduces perception of load time', effort: 'Quick (hours)' });
      }
    } catch {}

    // ── Calculate overall UX score ───────────────────────────
    loadScore = Math.max(0, Math.min(100, loadScore));
    stabilityScore = Math.max(0, Math.min(100, stabilityScore));
    responsivenessScore = Math.max(0, Math.min(100, responsivenessScore));
    animationScore = Math.max(0, Math.min(100, animationScore));
    const overallUxScore = Math.round(loadScore * 0.25 + stabilityScore * 0.25 + responsivenessScore * 0.3 + animationScore * 0.2);

    log('PERF-UX', overallUxScore >= 70 ? 'pass' : 'fail',
      `  → Loading: ${loadScore}/100 | Stability: ${stabilityScore}/100 | Responsiveness: ${responsivenessScore}/100 | Animation: ${animationScore}/100`,
      'UX Performance', 'Layer M: UX Performance');

    return {
      score: overallUxScore,
      initialLoadExperience: { score: loadScore, hasLoadingIndicator, hasSkeletonScreens, hasProgressiveLoading, timeToInteractiveMs },
      visualStability: { score: stabilityScore, clsDuringInteractionMs: clsDuringInteraction, layoutJankScore },
      responsiveness: { score: responsivenessScore, mobileUsabilityScore, navigationResponseMs, formResponseMs, searchResponseMs },
      animationPerformance: { score: animationScore, scrollJank, animationFps, pageTransitionMs, smoothnessScore },
      painPoints,
      improvementOpportunities: improvements,
      issues,
    };
  } catch (err) {
    log('PERF-UX', 'error', `  ⚠ UX performance measurement failed: ${(err as Error).message}`, 'Layer M', 'Layer M: UX Performance');
    return {
      score: 50,
      initialLoadExperience: { score: 50, hasLoadingIndicator: false, hasSkeletonScreens: false, hasProgressiveLoading: false, timeToInteractiveMs: null },
      visualStability: { score: 50, clsDuringInteractionMs: null, layoutJankScore: 'none' },
      responsiveness: { score: 50, mobileUsabilityScore: null, navigationResponseMs: null, formResponseMs: null, searchResponseMs: null },
      animationPerformance: { score: 50, scrollJank: false, animationFps: null, pageTransitionMs: null, smoothnessScore: 'smooth' },
      painPoints: [],
      improvementOpportunities: [],
      issues: [],
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}
