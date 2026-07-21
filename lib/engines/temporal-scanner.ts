// ============================================================
// KPMG TrustLens — Temporal Pattern Scanner (Gap 3)
// Detects dark patterns that only manifest over time or after
// interaction — invisible to a single DOM snapshot:
//
//   1. Countdown timers (text value decreases T0→T30)
//   2. Social proof inflation counters (value changes between polls)
//   3. Delayed urgency popups (appear after idle period)
//   4. Scroll-triggered urgency banners
//
// Strategy: 3-snapshot DOM poll at T=0s, T=15s, T=30s + scroll sim.
// ============================================================

import { BrowserContext } from 'playwright';
import type { TestLogEntry } from '../types/audit';

type ProgressFn = (entry: TestLogEntry) => void;

export interface TemporalFinding {
  id: string;
  pattern: 'countdown-timer' | 'social-proof-inflation' | 'delayed-urgency-popup' | 'scroll-triggered-urgency' | 'fake-stock-counter';
  title: string;
  description: string;
  element: string;       // outerHTML snippet
  t0Value: string;       // value at T=0
  t15Value?: string;     // value at T=15s
  t30Value: string;      // value at T=30s
  changed: boolean;
  changeDescription: string;
  severity: 'critical' | 'high' | 'medium';
  pageUrl: string;
  regulation: string[];
  developerFix: string;
  designerFix: string;
}

export interface TemporalScanResult {
  pageUrl: string;
  findings: TemporalFinding[];
  snapshotsTaken: number;
  scanDurationMs: number;
}

const log = (msg: string, onProgress?: ProgressFn) => onProgress?.({
  timestamp: new Date().toISOString(),
  testId: 'TEMPORAL-SCANNER', testName: 'Temporal Pattern Scanner',
  wcag: '', status: 'running', pillar: 'darkpatterns',
  message: msg, methodology: 'Temporal DOM Polling',
  phase: 'Temporal Pattern Detection',
});

// ── DOM snapshot extraction (runs inside page.evaluate) ──────────────────────
const SNAPSHOT_SCRIPT = `() => {
  const results = [];

  // 1. Countdown timers — elements with digit:digit pattern suggesting HH:MM:SS
  const countdownSelectors = [
    '[class*="countdown"]', '[class*="timer"]', '[id*="countdown"]', '[id*="timer"]',
    '[data-countdown]', '[data-timer]', '[class*="clock"]',
  ];
  for (const sel of countdownSelectors) {
    document.querySelectorAll(sel).forEach(el => {
      const text = el.textContent?.trim() || '';
      if (/\\d{1,2}[:\\-]\\d{2}/.test(text) || /\\d+\\s*(h|hr|hour|min|sec|s)/.test(text.toLowerCase())) {
        results.push({
          type: 'countdown',
          text,
          html: el.outerHTML.substring(0, 200),
          selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.toString().split(' ')[0] : ''),
        });
      }
    });
  }

  // 2. Social proof counters — "X people viewing", "X watching", "X bought"
  const socialProofPatterns = [
    /\\d+\\s*(people|person|user|viewer|customer|buyer)s?\\s*(viewing|watching|looking|browsing|bought|purchased)/i,
    /\\d+\\s*(sold|bought|purchased)\\s*in\\s*(the last|last|past)\\s*\\d+\\s*(hour|minute|day)/i,
    /\\d+\\s*left\\s*in\\s*(stock|inventory)/i,
    /currently viewing|people are watching|others are looking/i,
  ];
  const allText = document.body.innerText || '';
  const allNodes = document.querySelectorAll('*');
  allNodes.forEach(el => {
    if (el.children.length === 0) { // leaf nodes only
      const text = el.textContent?.trim() || '';
      for (const pattern of socialProofPatterns) {
        if (pattern.test(text) && text.length < 120) {
          results.push({
            type: 'social-proof',
            text,
            html: el.parentElement?.outerHTML?.substring(0, 200) || '',
            selector: el.tagName.toLowerCase(),
          });
          break;
        }
      }
    }
  });

  // 3. Urgency banners — visible above-fold elements with urgency language
  const urgencyKeywords = ['limited time', 'ends soon', 'expires', 'hurry', 'last chance', 'today only', 'flash sale', 'only left'];
  const viewportH = window.innerHeight;
  document.querySelectorAll('[class*="banner"], [class*="ribbon"], [class*="alert"], [class*="notice"], [role="alert"], [role="status"]').forEach(el => {
    const rect = el.getBoundingClientRect();
    const text = (el.textContent || '').toLowerCase();
    if (rect.top < viewportH && urgencyKeywords.some(k => text.includes(k))) {
      results.push({
        type: 'urgency-banner',
        text: el.textContent?.trim().substring(0, 150) || '',
        html: el.outerHTML.substring(0, 200),
        selector: el.tagName.toLowerCase() + (el.getAttribute('role') ? '[role="' + el.getAttribute('role') + '"]' : ''),
      });
    }
  });

  return results;
}`;

export async function runTemporalPatternScan(
  context: BrowserContext,
  pageUrl: string,
  onProgress?: ProgressFn,
): Promise<TemporalScanResult> {
  const startTime = Date.now();
  const findings: TemporalFinding[] = [];
  const page = await context.newPage();

  log(`━━━ Temporal Pattern Scanner: ${pageUrl} ━━━`, onProgress);

  try {
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // ── Snapshot T=0 ──────────────────────────────────────────
    log('  → T=0: capturing initial DOM state...', onProgress);
    const snap0 = await page.evaluate(new Function('return (' + SNAPSHOT_SCRIPT + ')()') as () => any[]).catch(() => [] as any[]);

    // Check for delayed popup: capture visible overlays at T=0
    const popupsAt0 = await page.evaluate(() => {
      const overlays = document.querySelectorAll('[class*="popup"], [class*="modal"], [class*="overlay"], [class*="dialog"], [role="dialog"]');
      return Array.from(overlays).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }).map(el => el.tagName + (el.className ? '.' + el.className.toString().split(' ')[0] : ''));
    }).catch(() => [] as string[]);

    // ── Wait 15s ──────────────────────────────────────────────
    log('  → Waiting 15s (monitoring for dynamic changes)...', onProgress);
    await page.waitForTimeout(15000);
    const snap15 = await page.evaluate(new Function('return (' + SNAPSHOT_SCRIPT + ')()') as () => any[]).catch(() => [] as any[]);

    // ── Scroll simulation (triggers scroll-based patterns) ────
    log('  → Simulating scroll behaviour...', onProgress);
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    }).catch(() => {});
    await page.waitForTimeout(2000);

    // ── Wait another 15s (T=30 total) ──────────────────────────
    log('  → T=30: capturing final DOM state...', onProgress);
    await page.waitForTimeout(13000);
    const snap30 = await page.evaluate(new Function('return (' + SNAPSHOT_SCRIPT + ')()') as () => any[]).catch(() => [] as any[]);

    // Check for NEW popups that appeared after idle (delayed urgency)
    const popupsAt30 = await page.evaluate(() => {
      const overlays = document.querySelectorAll('[class*="popup"], [class*="modal"], [class*="overlay"], [class*="dialog"], [role="dialog"]');
      return Array.from(overlays).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }).map(el => el.tagName + (el.className ? '.' + el.className.toString().split(' ')[0] : ''));
    }).catch(() => [] as string[]);

    // ── Analysis: Compare T=0 vs T=30 ────────────────────────
    let findingId = 0;

    // 1. Countdown timers — value changed (decreased)
    for (const item0 of snap0.filter((s: any) => s.type === 'countdown')) {
      const item30 = snap30.find((s: any) => s.type === 'countdown' && s.html.substring(0, 50) === item0.html.substring(0, 50));
      const changed = item30 && item30.text !== item0.text;
      const item15 = snap15.find((s: any) => s.type === 'countdown' && s.html.substring(0, 50) === item0.html.substring(0, 50));

      findings.push({
        id: `temp-${++findingId}`,
        pattern: 'countdown-timer',
        title: 'Live Countdown Timer — Artificial Urgency',
        description: `Countdown timer changes value over time, creating artificial urgency. Value at load: "${item0.text}" → at 30s: "${item30?.text || 'changed'}". This pattern exploits loss aversion and is prohibited under EU DSA Art. 25(1)(d) when not linked to a genuine, verifiable deadline.`,
        element: item0.html,
        t0Value: item0.text,
        t15Value: item15?.text,
        t30Value: item30?.text || 'element removed',
        changed: !!changed,
        changeDescription: changed
          ? `Timer value changed from "${item0.text}" to "${item30.text}" in 30 seconds`
          : `Timer element present at load — static value "${item0.text}"`,
        severity: 'critical',
        pageUrl,
        regulation: ['EU DSA Art. 25(1)(d)', 'FTC Act §5', 'ASA CAP Code 3.1'],
        developerFix: 'Remove countdown timer unless it reflects a genuine, server-verified deadline consistent across sessions and users. Store deadline in DB; countdown = deadline - now(). Never reset on refresh.',
        designerFix: 'Do not use red/orange countdown styling for artificial urgency. If a real deadline exists, display the date/time rather than a live countdown.',
      });
    }

    // 2. Social proof counters — value changed between polls
    for (const item0 of snap0.filter((s: any) => s.type === 'social-proof')) {
      const item30 = snap30.find((s: any) => s.type === 'social-proof' && s.html.substring(0, 50) === item0.html.substring(0, 50));
      const changed = item30 && item30.text !== item0.text;

      findings.push({
        id: `temp-${++findingId}`,
        pattern: 'social-proof-inflation',
        title: `Social Proof Counter${changed ? ' — Value Changes Over Time' : ' — Unverifiable Claim'}`,
        description: `Social proof element detected: "${item0.text}". ${changed ? `Counter changed from "${item0.text}" to "${item30?.text}" in 30 seconds — likely auto-incrementing.` : 'Counter is static but unverifiable — no source attribution.'} This exploits social conformity bias.`,
        element: item0.html,
        t0Value: item0.text,
        t30Value: item30?.text || item0.text,
        changed: !!changed,
        changeDescription: changed
          ? `Counter value changed: "${item0.text}" → "${item30?.text}" in 30s`
          : `Static unverifiable social proof claim: "${item0.text}"`,
        severity: changed ? 'critical' : 'high',
        pageUrl,
        regulation: ['FTC Endorsement Guides 16 CFR 255', 'EU DSA Art. 25', 'CMA Fake Reviews Guidance'],
        developerFix: 'Remove auto-incrementing counters. If showing real-time viewers, link to a transparent data source. For purchase counts, show verified historical data only.',
        designerFix: 'Do not style social proof counters in urgency colours (red/orange). Always display a data source. Never use round numbers without verification.',
      });
    }

    // 3. Delayed urgency popups — appeared AFTER T=0
    const newPopups = popupsAt30.filter(p => !popupsAt0.includes(p));
    for (const popup of newPopups) {
      findings.push({
        id: `temp-${++findingId}`,
        pattern: 'delayed-urgency-popup',
        title: 'Delayed Urgency Popup — Appeared After Page Idle',
        description: `A popup/modal appeared after ~30 seconds of page idle time (${popup}). Timed interruptions exploit inertia and distract from the user's task. Often used for newsletter capture, discount offers, or exit-intent urgency.`,
        element: popup,
        t0Value: 'not visible',
        t30Value: 'appeared',
        changed: true,
        changeDescription: `Popup ${popup} appeared after 30s idle — was not present at page load`,
        severity: 'high',
        pageUrl,
        regulation: ['EU DSA Art. 25', 'WCAG 2.2.4 Interruptions'],
        developerFix: 'Remove timed popups unless triggered by genuine user intent (exit-intent is borderline). Never auto-show urgency popups. Allow keyboard dismissal (Escape key). Add role="dialog" and aria-label.',
        designerFix: 'Do not use countdown timers or urgency copy inside delayed popups. If a popup is necessary, trigger it on user action only, not time-based idle.',
      });
    }

    // 4. Urgency banners found in any snapshot
    const urgencyBanners = [...snap0, ...snap30].filter((s: any) => s.type === 'urgency-banner');
    const seenBanners = new Set<string>();
    for (const banner of urgencyBanners) {
      const key = banner.html.substring(0, 60);
      if (seenBanners.has(key)) continue;
      seenBanners.add(key);

      findings.push({
        id: `temp-${++findingId}`,
        pattern: 'delayed-urgency-popup',
        title: 'Urgency Banner — Artificial Scarcity or Time Pressure',
        description: `Urgency language detected in above-fold banner element: "${banner.text.substring(0, 100)}". Urgency language exploits loss aversion and may constitute a dark pattern if the deadline or scarcity is unverifiable.`,
        element: banner.html,
        t0Value: banner.text,
        t30Value: banner.text,
        changed: false,
        changeDescription: 'Static urgency banner present at page load',
        severity: 'medium',
        pageUrl,
        regulation: ['EU DSA Art. 25(1)(d)', 'ASA CAP Code 3.1', 'FTC Act §5'],
        developerFix: 'Verify the urgency claim is real and server-consistent. Remove if it cannot be verified. Do not reset countdown on page refresh.',
        designerFix: 'Use neutral colours for urgency banners. Avoid red/orange for unverifiable deadlines. Pair urgency claims with verifiable proof.',
      });
    }

    const scanDurationMs = Date.now() - startTime;
    log(`  ✓ Temporal scan complete: ${findings.length} finding(s) in ${(scanDurationMs / 1000).toFixed(1)}s`, onProgress);

    return {
      pageUrl,
      findings,
      snapshotsTaken: 3,
      scanDurationMs,
    };

  } catch (err) {
    log(`  ⚠ Temporal scan failed: ${err instanceof Error ? err.message : 'unknown error'}`, onProgress);
    return { pageUrl, findings: [], snapshotsTaken: 0, scanDurationMs: Date.now() - startTime };
  } finally {
    await page.close();
  }
}
