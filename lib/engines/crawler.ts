import { LoginConfig, PageData, SkippedPage } from '../types/audit';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

export interface CrawlOptions {
  url: string;
  maxPages: number;
  crawlDepth: number;
  loginConfig?: LoginConfig;
  onProgress?: (message: string, percent: number) => void;
  extraSeedUrls?: string[];
}

export interface CrawlResult {
  pages: PageData[];
  context: BrowserContext;
  browser: Browser;
  totalFound: number;        // all unique URLs discovered (before cap & skip)
  pagesSkipped: SkippedPage[];
  skippedPages: SkippedPage[];
  discoveryMethods: Record<string, number>;
}

// File extensions to skip
const SKIP_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|mp4|mp3|avi|mov|ico|woff|woff2|ttf|eot|webp|avif|xlsx|docx|pptx)$/i;
const SKIP_PATTERNS = [
  /mailto:/i, /tel:/i, /javascript:/i,
  /\/(wp-admin|wp-login|wp-json|api\/|_next\/|__next|cdn-cgi|static\/)/i,
  /\?utm_/i, /\?(print|share|email)=/i,
  /#$/,
];

// ── Transactional URL patterns — dark patterns live here ──
// Higher score = higher crawl priority for dark pattern auditing
const TRANSACTIONAL_PATTERNS: [RegExp, number][] = [
  [/\/(checkout|cart|basket|bag|order|purchase|buy)/i, 10],
  [/\/(pricing|plans?|subscribe|subscription|upgrade|downgrade)/i, 9],
  [/\/(cancel|cancell?ation|unsubscribe|delete-account|close-account)/i, 9],
  [/\/(payment|billing|invoice)/i, 8],
  [/\/(account|settings|profile|preferences)/i, 7],
  [/\/(consent|cookie|privacy-settings|gdpr)/i, 6],
  [/\/(signup|register|join|onboarding)/i, 5],
];

export function getTransactionalScore(url: string): number {
  for (const [pattern, score] of TRANSACTIONAL_PATTERNS) {
    if (pattern.test(url)) return score;
  }
  return 0;
}

// ── Realistic browser user-agents (rotated to avoid detection) ──
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

// Script injected before any page script runs — hides Playwright/webdriver signals
const STEALTH_INIT_SCRIPT = `
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // Fake plugins array
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  // Fake languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  // Spoof chrome runtime
  window.chrome = { runtime: {} };
  // Fake permissions
  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  }
`;

const CONCURRENCY = 3;

export async function crawlWebsite(options: CrawlOptions): Promise<CrawlResult> {
  const { url, maxPages, crawlDepth, loginConfig, onProgress } = options;

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1280,720',
      ]
    });
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('executable') || msg.includes('download') || msg.includes('playwright install')) {
      throw new Error('Playwright Chromium binaries not found. Please run "npx playwright install chromium" in your terminal to provision the browser.');
    }
    throw new Error(`Failed to launch browser: ${msg}`);
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent,
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    geolocation: { latitude: 19.076, longitude: 72.877 }, // Mumbai
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  // Inject stealth script before page JS runs — hides automation signals
  await context.addInitScript(STEALTH_INIT_SCRIPT);

  if (loginConfig) {
    onProgress?.('Performing login...', 5);
    await performLogin(context, loginConfig);
    onProgress?.('Login successful', 10);
  }

  const visitedUrls       = new Set<string>();   // normalised URLs we've already queued/crawled
  const allDiscoveredUrls = new Set<string>();   // every URL seen (for accurate totalFound)
  const pages: PageData[] = [];
  const skippedPages: SkippedPage[] = [];
  const discoveryMethods: Record<string, number> = {
    'seed-url': 0, 'navigation-menu': 0, 'footer-links': 0,
    'internal-links': 0, 'button-links': 0, 'sitemap': 0
  };

  const urlQueue: { url: string; depth: number; method: string }[] = [{ url, depth: 0, method: 'seed-url' }];
  const baseUrl = new URL(url);

  // Track everything we've ever seen (seed URL too)
  allDiscoveredUrls.add(normalizeUrl(url));

  if (options.extraSeedUrls) {
    for (const extraUrl of options.extraSeedUrls) {
      try {
        const absoluteUrl = new URL(extraUrl, url).href;
        const norm = normalizeUrl(absoluteUrl);
        allDiscoveredUrls.add(norm);
        if (!visitedUrls.has(norm)) {
          urlQueue.push({ url: absoluteUrl, depth: 0, method: 'seed-url' });
        }
      } catch (err) {
        console.warn('Invalid extra seed URL:', extraUrl, err);
      }
    }
  }

  onProgress?.('Starting deep crawl...', 12);

  // Try sitemap discovery
  const sitemapUrls = await discoverFromSitemap(context, baseUrl.origin);
  if (sitemapUrls.length > 0) {
    onProgress?.(`Found ${sitemapUrls.length} URLs from sitemap`, 14);
    for (const sUrl of sitemapUrls.slice(0, maxPages * 3)) {
      const norm = normalizeUrl(sUrl);
      allDiscoveredUrls.add(norm);   // count in totalFound even if we skip later
      if (!visitedUrls.has(norm)) {
        urlQueue.push({ url: sUrl, depth: 1, method: 'sitemap' });
      }
    }
  }

  while (urlQueue.length > 0 && pages.length < maxPages) {
    // Sort queue: transactional pages first (better dark pattern coverage)
    if (pages.length === 0 || pages.length % 5 === 0) {
      urlQueue.sort((a, b) => getTransactionalScore(b.url) - getTransactionalScore(a.url));
    }

    const batch: { url: string; depth: number; method: string }[] = [];

    // FIX Bug 4: Pull enough candidates to fill a batch of CONCURRENCY
    // We pull more than CONCURRENCY to account for skipped URLs
    while (batch.length < CONCURRENCY && urlQueue.length > 0 && (pages.length + batch.length) < maxPages) {
      const current = urlQueue.shift()!;
      const normalizedUrl = normalizeUrl(current.url);

      if (visitedUrls.has(normalizedUrl)) continue;

      // NEVER skip the seed URL (depth 0) — only skip discovered links
      if (current.depth > 0) {
        const skipReason = shouldSkipUrl(current.url, baseUrl.origin);
        if (skipReason) {
          // Skipped URLs do NOT count against maxPages — only add to skipped list
          skippedPages.push({ url: current.url, reason: skipReason });
          visitedUrls.add(normalizedUrl);
          allDiscoveredUrls.add(normalizedUrl);
          continue;
        }
      }

      visitedUrls.add(normalizedUrl);
      batch.push(current);
    }

    if (batch.length === 0) continue;

    const results = await Promise.allSettled(
      batch.map(item => crawlSinglePage(context, item, baseUrl, crawlDepth))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = batch[i];

      if (result.status === 'fulfilled' && result.value) {
        const { pageData, discoveredLinks } = result.value;
        pages.push(pageData);
        discoveryMethods[item.method] = (discoveryMethods[item.method] || 0) + 1;

        const progress = 15 + Math.round((pages.length / maxPages) * 35);
        onProgress?.(`Crawled ${pages.length}/${maxPages}: ${pageData.title || item.url}`, progress);

        // Queue discovered links + count them in totalFound
        if (item.depth < crawlDepth) {
          for (const link of discoveredLinks) {
            const norm = normalizeUrl(link.url);
            allDiscoveredUrls.add(norm);
            if (!visitedUrls.has(norm)) {
              urlQueue.push({ url: link.url, depth: item.depth + 1, method: link.method });
            }
          }
        }
      } else {
        // FIX Bug 4: Failed pages go to skippedPages but do NOT reduce maxPages cap
        // The while loop continues until pages.length === maxPages or queue is empty
        const errorMsg = result.status === 'rejected' ? result.reason?.message : 'Unknown error';
        skippedPages.push({ url: item.url, reason: `Crawl failed: ${errorMsg}` });
      }
    }
  }

  // Any URL still in queue that we didn't reach → skipped due to cap
  // Mark as visited while draining to prevent duplicate skippedPages entries
  // (queue can contain raw URL variants that normalize to the same URL)
  for (const remaining of urlQueue) {
    const norm = normalizeUrl(remaining.url);
    allDiscoveredUrls.add(norm);
    if (!visitedUrls.has(norm)) {
      visitedUrls.add(norm); // prevent duplicates for the same normalized URL
      skippedPages.push({ url: remaining.url, reason: 'Max page limit reached' });
    }
  }

  // totalFound = all unique URLs we became aware of (before any filtering/cap)
  const totalFound = allDiscoveredUrls.size;

  onProgress?.(`Crawl complete. ${pages.length} pages audited of ${totalFound} discovered.`, 50);

  return { pages, context, browser, totalFound, pagesSkipped: skippedPages, skippedPages, discoveryMethods };
}

interface DiscoveredLink { url: string; method: string; }

async function crawlSinglePage(
  context: BrowserContext,
  item: { url: string; depth: number },
  baseUrl: URL,
  maxDepth: number
): Promise<{ pageData: PageData; discoveredLinks: DiscoveredLink[] }> {

  // ── Strategy: Try HTTP fetch first (no browser fingerprint = bypasses most WAFs).
  // If it fails or returns a bot-challenge page, fall back to stealth Playwright.
  try {
    const httpResult = await httpFallbackCrawl(item.url, baseUrl, maxDepth);
    // Validate the HTML is a real page (not a Cloudflare/Akamai JS challenge)
    const lc = httpResult.pageData.html.toLowerCase();
    const isChallengePage =
      lc.includes('just a moment') ||
      lc.includes('enable javascript') ||
      lc.includes('checking your browser') ||
      lc.includes('cf-browser-verification') ||
      lc.includes('_cf_chl_') ||
      httpResult.pageData.html.length < 2000;

    if (!isChallengePage) {
      // HTTP crawl succeeded — enrich with a visual screenshot via two strategies:
      // 1. Try a real Playwright navigation (race-condition window before WAF kicks in)
      // 2. Fall back to CSS-injected setContent render
      httpResult.pageData.screenshot = await captureVisualScreenshot(
        context, item.url, httpResult.pageData.html
      );
      return httpResult;
    }
  } catch { /* HTTP failed — fall through to Playwright */ }

  // ── Playwright fallback: stealth headless browser ──
  const page = await context.newPage();
  try {
    await page.waitForTimeout(500 + Math.random() * 1500);

    const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

    const finalUrl = page.url();
    const statusCode = response?.status() ?? 200;

    const isBlocked = await page.evaluate(() => {
      const title = document.title.toLowerCase();
      const body = document.body?.innerText?.toLowerCase() || '';
      return (
        title.includes('access denied') ||
        title.includes('attention required') ||
        title.includes('just a moment') ||
        title.includes('security check') ||
        body.includes('enable javascript and cookies') ||
        body.includes('checking your browser') ||
        (document.querySelectorAll('*').length < 10 && body.length < 200)
      );
    }).catch(() => false);

    if (isBlocked || statusCode === 403 || statusCode === 429) {
      await page.close();
      throw new Error(`WAF blocked: HTTP ${statusCode}`);
    }

    await triggerLazyContent(page);

    const title = await page.title();
    const html = await page.content();

    let screenshot: string | undefined;
    try {
      const buffer = await page.screenshot({ fullPage: false, type: 'png', timeout: 10000 });
      screenshot = buffer.toString('base64');
    } catch { /* screenshot may fail on very large pages */ }

    const pageData: PageData = {
      url: finalUrl || item.url,
      title: title || 'Untitled Page',
      html,
      screenshot,
      timestamp: new Date().toISOString()
    };

    let discoveredLinks: DiscoveredLink[] = [];
    if (item.depth < maxDepth) {
      discoveredLinks = await discoverAllLinks(page, baseUrl.origin);
    }

    await page.close();
    return { pageData, discoveredLinks };
  } catch (error) {
    try { await page.close(); } catch { /* ignore */ }
    throw error;
  }
}

/**
 * Capture a visual screenshot for a page that was crawled via HTTP (no browser).
 *
 * Strategy 1 — Race-condition real capture:
 *   Navigate to the live URL with a short timeout. Most pages render their real UI
 *   within ~2s, before any WAF JS challenge fully loads. We screenshot at that window.
 *
 * Strategy 2 — CSS-injected setContent render (fallback):
 *   Load the cached HTML into Playwright, fetch and inline the page's external
 *   stylesheets so the render has the real brand colours, fonts and layout.
 *   Far closer to the real UI than bare unstyled HTML.
 *
 * Returns base64 PNG string, or undefined if both strategies fail.
 */
async function captureVisualScreenshot(
  context: BrowserContext,
  url: string,
  cachedHtml: string,
): Promise<string | undefined> {
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });

    // ── Strategy 1: Race-condition real navigation ──
    // Cloudflare fires its challenge at ~400-600ms. We screenshot at 350ms
    // (right after first paint) to capture the real styled UI before WAF intercepts.
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 4000 });
      await page.waitForTimeout(350); // first paint window — before WAF JS executes

      const isChallenge = await page.evaluate(() => {
        const t = document.title.toLowerCase();
        const b = document.body?.innerText?.toLowerCase() || '';
        return (
          t.includes('just a moment') || t.includes('attention required') ||
          t.includes('security check') || t.includes('access denied') ||
          b.includes('checking your browser') || b.includes('enable javascript and cookies') ||
          (document.querySelectorAll('*').length < 15)
        );
      }).catch(() => true);

      if (!isChallenge) {
        // Scroll past sticky nav so the hero/content area is visible
        await page.evaluate(() => window.scrollTo(0, 180)).catch(() => {});
        await page.waitForTimeout(200);
        const buf = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 85, timeout: 8000 });
        await page.close();
        return buf.toString('base64');
      }
    } catch { /* timed out or WAF — fall through to Strategy 2 */ }

    // ── Strategy 2: Fully-inlined CSS setContent render ──
    // CSS is fetched via Node.js and inlined as <style> text — no external browser fetches.
    // setContent @imports are blocked by CORS (no page origin); inline text bypasses that.
    const styledHtml = await injectExternalCSS(cachedHtml, url);
    await page.goto('about:blank', { timeout: 3000 }).catch(() => {});
    await page.setContent(styledHtml, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
    // CSS is already inlined — just allow layout reflow
    await page.waitForTimeout(800);
    // Collapse nav dropdowns and scroll to hero section
    await page.evaluate(() => {
      document.querySelectorAll('[class*="mega"],[class*="nav-drop"],[class*="dropdown-menu"],[class*="NavMenu"],[class*="main-nav"]').forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.getBoundingClientRect().height > 200) htmlEl.style.display = 'none';
      });
      window.scrollTo(0, 150);
    }).catch(() => {});
    await page.waitForTimeout(200);

    const buf = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 85, timeout: 8000 });
    await page.close();
    return buf.toString('base64');
  } catch {
    try { await page.close(); } catch { /* ignore */ }
    return undefined;
  }
}

/**
 * Fetch the site's external stylesheets via Node.js and inline them into the HTML.
 * This makes a Playwright setContent() render look like the real branded site
 * (correct fonts, colours, layout) instead of raw unstyled HTML.
 *
 * IMPORTANT: @import url() does NOT work inside setContent() — Chromium blocks external
 * resource loading from no-origin pages (CORS). We must fetch CSS via Node.js and inline
 * it as text so the browser has zero external fetches to make.
 */
async function injectExternalCSS(html: string, baseUrl: string): Promise<string> {
  // Extract <link rel="stylesheet" href="..."> URLs
  const cssUrls: string[] = [];
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const hrefRe = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) cssUrls.push(m[1]);
  while ((m = hrefRe.exec(html)) !== null) cssUrls.push(m[1]);

  const resolved = [...new Set(cssUrls)]
    .slice(0, 10)
    .map(u => { try { return new URL(u, baseUrl).href; } catch { return null; } })
    .filter((u): u is string => !!u && /^https?:\/\//.test(u));

  // Fetch every CSS file via Node.js (no size limit, no CORS restriction, direct CDN access)
  let combinedCss = '';
  for (const cssUrl of resolved) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(cssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/css,*/*',
          'Referer': baseUrl,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (res.ok) {
        const css = await res.text();
        // Fix relative url() paths inside this CSS file to absolute URLs
        const cssBase = new URL(cssUrl);
        const fixedCss = css.replace(
          /url\(['"]?(?!data:|https?:|#)([^'")]+)['"]?\)/gi,
          (match: string, relPath: string) => {
            try { return `url("${new URL(relPath.trim(), cssBase.href).href}")`; }
            catch { return match; }
          }
        );
        combinedCss += `\n/* === ${cssUrl} === */\n${fixedCss}\n`;
      }
    } catch { /* skip unreachable CSS files */ }
  }

  // Minimal fallback for any elements not covered by the fetched CSS
  const fallback = `
    body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;background:#fff;color:#111;}
    img{max-width:100%;height:auto;} a{color:#1a0dab;} *{box-sizing:border-box;}
  `;

  const injected = [
    // <base> tag resolves relative src= and href= attributes in the HTML
    `<base href="${baseUrl}">`,
    // Fully inlined CSS — no browser network fetches needed
    `<style>${combinedCss}\n${fallback}</style>`,
    // Collapse nav dropdowns that expand to fill viewport without JS
    `<script>
      document.addEventListener('DOMContentLoaded', function() {
        var toHide = document.querySelectorAll(
          '[class*="mega-"], [class*="nav-drop"], [class*="dropdown"]:not([class*="btn"]), ' +
          '[class*="subnav"], [id*="mega-menu"], [class*="NavMenu"], [class*="main-nav"]'
        );
        toHide.forEach(function(el) {
          var h = el.getBoundingClientRect().height;
          if (h > 200) el.style.display = 'none';
        });
      });
    </script>`,
  ].join('\n');

  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n${injected}`);
  }
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injected}\n</head>`);
  }
  return injected + '\n' + html;
}

/**
 * HTTP fallback crawler for WAF-protected sites.
 * Uses a realistic fetch with headers to retrieve HTML directly.
 * Cannot run JS, but provides structural HTML for accessibility analysis.
 */
async function httpFallbackCrawl(
  url: string,
  baseUrl: URL,
  maxDepth: number
): Promise<{ pageData: PageData; discoveredLinks: DiscoveredLink[] }> {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Extract title from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

  // Extract internal links — enhanced to find nav, footer, and transactional links
  const discoveredLinks: DiscoveredLink[] = [];
  if (maxDepth > 0) {
    const seen = new Set<string>();
    const addLink = (rawHref: string, method: string) => {
      try {
        const full = new URL(rawHref, url).href;
        if (full.startsWith(baseUrl.origin) && !seen.has(full) && !SKIP_EXTENSIONS.test(full)) {
          seen.add(full);
          // Transactional pages go first in discovered list
          if (getTransactionalScore(full) > 0) {
            discoveredLinks.unshift({ url: full, method });
          } else {
            discoveredLinks.push({ url: full, method });
          }
        }
      } catch { /* ignore */ }
    };
    // href attributes (standard links)
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      addLink(match[1], 'internal-links');
      if (discoveredLinks.length >= 150) break;
    }
    // data-href / data-url / data-link attributes (SPA-style)
    const dataHrefRegex = /data-(?:href|url|link)=["']([^"']+)["']/gi;
    while ((match = dataHrefRegex.exec(html)) !== null) addLink(match[1], 'button-links');
  }

  return {
    pageData: {
      url,
      title: title || 'Page',
      html,
      timestamp: new Date().toISOString(),
    },
    discoveredLinks,
  };
}

async function triggerLazyContent(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
      const scrollHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      let currentScroll = 0;
      const step = viewportHeight * 0.8;

      while (currentScroll < scrollHeight) {
        currentScroll += step;
        window.scrollTo(0, currentScroll);
        await delay(250);
        if (document.body.scrollHeight > scrollHeight) break;
      }
      window.scrollTo(0, 0);
      await delay(400);
    });
  } catch { /* ignore scroll errors */ }
}

async function discoverAllLinks(page: Page, baseOrigin: string): Promise<DiscoveredLink[]> {
  const links: DiscoveredLink[] = [];
  const seen = new Set<string>();

  const addLink = (url: string, method: string) => {
    if (!seen.has(url) && url.startsWith(baseOrigin) && !SKIP_EXTENSIONS.test(url)) {
      seen.add(url);
      links.push({ url, method });
    }
  };

  try {
    const discovered = await page.evaluate((origin: string) => {
      const result: { navLinks: string[]; footerLinks: string[]; internalLinks: string[]; buttonLinks: string[] } = {
        navLinks: [], footerLinks: [], internalLinks: [], buttonLinks: []
      };

      document.querySelectorAll('nav a[href], [role="navigation"] a[href], header a[href], .nav a[href], .navbar a[href], .menu a[href], .navigation a[href]')
        .forEach(el => { const href = (el as HTMLAnchorElement).href; if (href?.startsWith(origin)) result.navLinks.push(href); });

      document.querySelectorAll('footer a[href], [role="contentinfo"] a[href], .footer a[href]')
        .forEach(el => { const href = (el as HTMLAnchorElement).href; if (href?.startsWith(origin)) result.footerLinks.push(href); });

      document.querySelectorAll('a[href]')
        .forEach(el => { const href = (el as HTMLAnchorElement).href; if (href?.startsWith(origin) && !href.includes('#')) result.internalLinks.push(href); });

      document.querySelectorAll('button[data-href], [role="link"], [data-url], [data-link]')
        .forEach(el => {
          const href = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
          if (href) try { const full = new URL(href, origin).href; if (full.startsWith(origin)) result.buttonLinks.push(full); } catch {}
        });

      return result;
    }, baseOrigin);

    [...new Set(discovered.navLinks)].forEach(u => addLink(u, 'navigation-menu'));
    [...new Set(discovered.footerLinks)].forEach(u => addLink(u, 'footer-links'));
    [...new Set(discovered.internalLinks)].slice(0, 100).forEach(u => addLink(u, 'internal-links'));
    [...new Set(discovered.buttonLinks)].forEach(u => addLink(u, 'button-links'));
  } catch (error) {
    console.error('Link discovery error:', error);
  }

  return links;
}

async function discoverFromSitemap(context: BrowserContext, origin: string): Promise<string[]> {
  const urls: string[] = [];
  const page = await context.newPage();

  try {
    const sitemapUrls = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap/sitemap.xml`];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await page.goto(sitemapUrl, { timeout: 10000, waitUntil: 'domcontentloaded' });
        if (response?.ok()) {
          const content = await page.content();
          const locRegex = /<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi;
          let match;
          while ((match = locRegex.exec(content)) !== null) {
            const u = match[1].trim();
            if (u.startsWith(origin)) urls.push(u);
          }
          if (urls.length > 0) break;
        }
      } catch { /* sitemap not available */ }
    }
  } catch { /* ignore */ } finally {
    await page.close();
  }

  return [...new Set(urls)];
}

function shouldSkipUrl(url: string, baseOrigin: string): string | null {
  if (!url.startsWith(baseOrigin)) return 'External domain';
  if (SKIP_EXTENSIONS.test(url)) return 'Non-HTML resource';
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(url)) return `Matches skip pattern: ${pattern.source}`;
  }
  if (url.length > 500) return 'URL too long (likely generated)';
  return null;
}

async function performLogin(context: BrowserContext, config: LoginConfig): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.waitForSelector(config.usernameSelector, { timeout: 10000 });
    await page.fill(config.usernameSelector, config.username);
    await page.waitForSelector(config.passwordSelector, { timeout: 10000 });
    await page.fill(config.passwordSelector, config.password);
    if (config.otpSelector && config.otpValue) {
      await page.waitForSelector(config.otpSelector, { timeout: 5000 }).catch(() => {});
      if (await page.isVisible(config.otpSelector)) {
        await page.fill(config.otpSelector, config.otpValue);
      }
    }
    await page.click(config.submitSelector);
    await page.waitForTimeout(3000);
    if (config.successIndicator) {
      await page.waitForSelector(config.successIndicator, { timeout: 15000 });
    } else {
      await page.waitForLoadState('networkidle');
    }
    await context.storageState({ path: undefined });
  } finally {
    await page.close();
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    parsed.pathname = path;
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('ref');
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export async function closeCrawler(browser: Browser): Promise<void> {
  try { await browser.close(); } catch { /* ignore */ }
}
