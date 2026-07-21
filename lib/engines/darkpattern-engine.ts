import type { BrowserContext, Page } from "playwright";
import type {
  DarkPatternFinding,
  DarkPatternResult,
  DarkPatternCategory,
  EthicalPrinciple,
  DarkPatternEvidence,
} from "../types/darkpattern";
import { PRINCIPLE_WEIGHTS } from "../types/darkpattern";
import {
  DARK_PATTERN_RULES,
  VISUAL_AI_RULES,
  URGENCY_PATTERNS,
  SOCIAL_PRESSURE_PATTERNS,
  CONFIRMSHAMING_PATTERNS,
  FEAR_LANGUAGE_PATTERNS,
  TRICK_QUESTION_PATTERNS,
  AUTO_RENEWAL_PATTERNS,
  DRIP_PRICING_PATTERNS,
  FAKE_REVIEW_PATTERNS,
  ANNUAL_BILLING_PATTERNS,
  SUBSCRIPTION_TRAP_PATTERNS,
  PLAN_ANCHORING_PATTERNS,
  COOKIE_CONSENT_PATTERNS,
  ASTERISK_PROMO_PATTERNS,
  CRORE_TRUST_PATTERNS,
  FAMILY_GUILT_PATTERNS,
} from "./darkpattern-rules";
import { applyComplianceExemptions } from "./compliance-exemptions";
import type { TestLogEntry } from "../types/audit";

interface PageData {
  url: string;
  title: string;
  html?: string;
  screenshot?: string;
}
type ProgressFn = (entry: TestLogEntry) => void;

// ── Bot/challenge page detection — returns true if the page content is a WAF challenge ──
function isBotChallengedPage(html: string): boolean {
  if (html.length < 3000) return true;
  const lc = html.toLowerCase();
  return (
    lc.includes("just a moment") ||
    lc.includes("checking your browser") ||
    lc.includes("cf-browser-verification") ||
    lc.includes("_cf_chl_") ||
    lc.includes("enable javascript and cookies") ||
    lc.includes("access denied") ||
    lc.includes("attention required") ||
    (lc.includes("<html") && !lc.includes("<body") && html.length < 5000)
  );
}

// ── Main Entry Point ──
export async function runDarkPatternAudit(
  context: BrowserContext,
  pages: PageData[],
  options: { aiClassification?: boolean; siteProfile?: string } = {},
  onProgress?: ProgressFn,
): Promise<DarkPatternResult> {
  const findings: DarkPatternFinding[] = [];
  let findingId = 0;
  const log = (
    testId: string,
    status: string,
    message: string,
    methodology?: string,
    phase?: string,
  ) => {
    onProgress?.({
      timestamp: new Date().toISOString(),
      testId,
      testName: "Dark Pattern",
      wcag: "",
      status: status as any,
      message,
      pillar: "darkpatterns",
      methodology,
      phase,
    });
  };

  // Deduplicate pages by hostname+pathname — query-param variants of the same page
  // (e.g. /?pb_source=google_brand vs /) would otherwise be scanned and reported twice.
  // Sort ascending by URL length first so the canonical (shorter) URL wins.
  const seenPathnames = new Set<string>();
  const dedupedPages = [...pages]
    .sort((a, b) => a.url.length - b.url.length)
    .filter((p) => {
      try {
        const u = new URL(p.url);
        const key = u.hostname + u.pathname.replace(/\/$/, "");
        if (seenPathnames.has(key)) return false;
        seenPathnames.add(key);
        return true;
      } catch {
        return true;
      }
    });

  for (const pageData of dedupedPages) {
    let page: Page | null = null;
    let pageScreenshotDataUrl: string | undefined;
    let usingCachedHtml = false;
    const screenshotTasks: (() => Promise<void>)[] = [];
    const pageDeadlineMs = Date.now() + 4 * 60 * 1000; // 4-minute hard cap per page
    try {
      page = await context.newPage();
      // 3-minute hard cap per page: guards against browser hangs, infinite evaluates,
      // heavy-page content() calls, and any phase that doesn't have its own timeout.
      await Promise.race([
        (async () => {
          // ── Navigate with bot-detection fallback ──
          try {
            await page.goto(pageData.url, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await page.waitForTimeout(2000);
            // Allow SPA hydration to complete — ensures React/Vue/Angular render dark pattern elements
            await page
              .waitForLoadState("networkidle", { timeout: 5000 })
              .catch(() => {});

            // Check if we got a bot challenge page
            const liveHtml = await Promise.race([
              page.content(),
              new Promise<string>((resolve) =>
                setTimeout(() => resolve(""), 5000),
              ),
            ]).catch(() => "");
            if (
              isBotChallengedPage(liveHtml) &&
              pageData.html &&
              !isBotChallengedPage(pageData.html)
            ) {
              log(
                "DP-BOT",
                "warn",
                `  ⚠ WAF/bot challenge detected on ${pageData.url} — falling back to pre-crawled HTML for NLP/DOM scan`,
                "Bot Detection Recovery",
                "Page Load",
              );
              await page
                .setContent(pageData.html, { waitUntil: "domcontentloaded" })
                .catch(() => {});
              usingCachedHtml = true;
            }
          } catch (navErr) {
            // Navigation failed — use cached HTML if available.
            // IMPORTANT: navigate to about:blank first to settle the execution context
            // before calling setContent — otherwise "Execution context was destroyed" error occurs.
            if (pageData.html && !isBotChallengedPage(pageData.html)) {
              log(
                "DP-BOT",
                "warn",
                `  ⚠ Navigation failed for ${pageData.url} (${(navErr as Error).message}) — using pre-crawled HTML`,
                "Bot Detection Recovery",
                "Page Load",
              );
              // Settle the context first, then inject the cached HTML
              await page
                .goto("about:blank", {
                  waitUntil: "domcontentloaded",
                  timeout: 5000,
                })
                .catch(() => {});
              await page
                .setContent(pageData.html, { waitUntil: "domcontentloaded" })
                .catch((e) => {
                  console.log(
                    `[TrustLens:BOT] setContent error after about:blank: ${e}`,
                  );
                });
              usingCachedHtml = true;
            } else {
              throw navErr; // no fallback — rethrow to catch block
            }
          }

          if (usingCachedHtml) {
            log(
              "DP-BOT",
              "pass",
              `  ✓ Using crawl-time HTML snapshot for pattern analysis (WAF evasion mode)`,
              "Bot Detection Recovery",
              "Page Load",
            );
          }

          // ── Capture baseline page screenshot for evidence fallback ──
          // For live pages: full-page screenshot captures all element positions accurately.
          // For setContent (WAF): inject the site's real external CSS before screenshotting
          // so the render has correct brand colours, fonts and layout — not bare HTML.
          try {
            if (usingCachedHtml) {
              await page
                .setViewportSize({ width: 1280, height: 900 })
                .catch(() => {});
              // Fetch site CSS via Node.js and inject it inline — proven to render real brand UI
              // (setContent @imports don't load due to CORS; inline text needs no browser fetches)
              await injectSiteCSS(
                page,
                pageData.html || "",
                pageData.url,
              ).catch(() => {});
              // Wait for layout reflow after CSS injection (CSS is already inlined — fast)
              await page.waitForTimeout(800);
              // Collapse any nav dropdowns that expand without JS, then scroll to hero section
              await page
                .evaluate(() => {
                  document
                    .querySelectorAll(
                      '[class*="mega"],[class*="nav-drop"],[class*="dropdown-menu"],[class*="NavMenu"],[class*="main-nav"]',
                    )
                    .forEach((el: Element) => {
                      const htmlEl = el as HTMLElement;
                      if (htmlEl.getBoundingClientRect().height > 200)
                        htmlEl.style.display = "none";
                    });
                  window.scrollTo(0, 150);
                })
                .catch(() => {});
              await page.waitForTimeout(200);
              const buf = await page.screenshot({ type: "jpeg", quality: 85 });
              pageScreenshotDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
            } else {
              const buf = await page.screenshot({
                fullPage: true,
                type: "jpeg",
                quality: 70,
              });
              pageScreenshotDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
            }
          } catch {
            /* screenshot optional — don't block scan */
          }

          // Prefer crawl-time screenshot (real browser) over Playwright render for evidence fallbacks.
          // For WAF/cached-HTML pages, pageData.screenshot is the only accurate visual representation.
          const crawlFallback: string | undefined = pageData.screenshot
            ? `data:image/png;base64,${pageData.screenshot}`
            : pageScreenshotDataUrl;

          // ── Phase 1: DOM & Code-Level Inspection ──
          log(
            "DP-DOM",
            "running",
            "━━━ Phase 1: DOM & Code-Level Inspection",
            "CCPA (12 Patterns)",
            "Phase 1: DOM Scan",
          );
          log(
            "DP-DOM-TQ",
            "running",
            "  → Trick Questions (CCPA #1): Pre-ticked opt-ins, double-negatives, misleading labels",
            "CCPA #1 — Trick Questions",
            "Phase 1: DOM Scan",
          );
          log(
            "DP-DOM-SB",
            "running",
            "  → Sneak into Basket (CCPA #2): Preselected add-ons, auto-added extras",
            "CCPA #2 — Sneak into Basket",
            "Phase 1: DOM Scan",
          );
          log(
            "DP-DOM-RM",
            "running",
            "  → Roach Motel (CCPA #3): Subscribe vs cancel/delete path depth ratio",
            "CCPA #3 — Roach Motel",
            "Phase 1: DOM Scan",
          );
          log(
            "DP-DOM-NG",
            "running",
            "  → Nagging (EU DSA Art. 25): Overlapping modals, repeated interruption gates",
            "EU DSA Art. 25 — Nagging / Obstruction",
            "Phase 1: DOM Scan",
          );
          log(
            "DP-DOM-FA",
            "running",
            "  → Forced Action (FTC §5): Login walls, mandatory registration blocking content",
            "FTC §5 — Deceptive Practices",
            "Phase 1: DOM Scan",
          );
          log(
            "DP-DOM-PZ",
            "running",
            "  →  Excessive form field data collection",
            " Art. 5 — Data Minimisation",
            "Phase 1: DOM Scan",
          );
          log(
            "DP-DOM-FC",
            "running",
            "  → Forced Continuity (CCPA #10): Auto-renewal without visible cancel path",
            "CCPA #10 — Forced Continuity",
            "Phase 1: DOM Scan",
          );
          const domFindings = await runDOMScans(page, pageData.url);
          for (const f of domFindings) {
            f.id = `dp-${++findingId}`;
            f.evidence.screenshotDataUrl = crawlFallback;
            screenshotTasks.push(() =>
              captureElementScreenshot(page!, f, crawlFallback, usingCachedHtml)
                .then((url) => {
                  if (url) f.evidence.screenshotDataUrl = url;
                })
                .catch(() => {}),
            );
            findings.push(f);
          }
          log(
            "DP-DOM",
            domFindings.length > 0 ? "fail" : "pass",
            `   Phase 1 complete — ${domFindings.length} finding(s) detected`,
            "CCPA Taxonomy",
            "Phase 1: DOM Scan",
          );

          // ── Phase 2: Visual UI Analysis ──
          log(
            "DP-VIS",
            "running",
            "━━━ Phase 2: Visual & Interface Interference Analysis",
            "EU DSA Art. 25 — Interface Interference",
            "Phase 2: Visual Scan",
          );
          log(
            "DP-VIS-AS",
            "running",
            "  → Button Asymmetry: Accept vs Reject size, prominence & click-area ratio",
            "EU DSA — Asymmetric Framing",
            "Phase 2: Visual Scan",
          );
          log(
            "DP-VIS-CC",
            "running",
            "  → Colour Weaponisation: High-contrast accept, washed-out / hidden reject",
            "Misdirection — Visual Design Exploitation",
            "Phase 2: Visual Scan",
          );
          log(
            "DP-VIS-SZ",
            "running",
            "  → Size Manipulation: Unwanted options smaller, greyed or outside scan path",
            "EU DSA — Visual Interference",
            "Phase 2: Visual Scan",
          );
          log(
            "DP-VIS-IM",
            "running",
            "  → Dismiss Target Size: Close/X button touch-target compliance (min 44×44px)",
            "WCAG 2.5.8 + ICO Guidance",
            "Phase 2: Visual Scan",
          );
          const visualFindings = await runVisualScans(page, pageData.url);
          for (const f of visualFindings) {
            f.id = `dp-${++findingId}`;
            f.evidence.screenshotDataUrl = crawlFallback;
            screenshotTasks.push(() =>
              captureElementScreenshot(page!, f, crawlFallback, usingCachedHtml)
                .then((url) => {
                  if (url) f.evidence.screenshotDataUrl = url;
                })
                .catch(() => {}),
            );
            findings.push(f);
          }
          log(
            "DP-VIS",
            visualFindings.length > 0 ? "fail" : "pass",
            `  ✓ Phase 2 complete — ${visualFindings.length} finding(s) detected`,
            "EU DSA Art. 25",
            "Phase 2: Visual Scan",
          );

          // ── Phase 3: Copy & Language (NLP) Analysis ──
          log(
            "DP-NLP",
            "running",
            "━━━ Phase 3: Copy & Language Pattern Analysis",
            "Cognitive Bias Exploitation Framework",
            "Phase 3: NLP Scan",
          );
          log(
            "DP-NLP-SU",
            "running",
            '  → Urgency/Scarcity (CCPA #12): Countdown timers, "Only N left!", false limited-time framing',
            "CCPA #12 — Urgency / Scarcity",
            "Phase 3: NLP Scan",
          );
          log(
            "DP-NLP-SP",
            "running",
            "  → Social Proof Manipulation: Fake real-time activity, unverifiable viewer counts",
            "Cognitive Bias — Social Proof Manipulation",
            "Phase 3: NLP Scan",
          );
          log(
            "DP-NLP-CS",
            "running",
            '  → Confirmshaming (CCPA #8): Guilt-inducing decline copy ("No thanks, I hate saving")',
            "CCPA #8 — Confirmshaming",
            "Phase 3: NLP Scan",
          );
          log(
            "DP-NLP-LA",
            "running",
            '  → Loss Aversion Framing: "Don\'t miss out", "Lose access to X" language patterns',
            "Cognitive Bias — Loss Aversion",
            "Phase 3: NLP Scan",
          );
          log(
            "DP-NLP-AB",
            "running",
            "  → Authority Bias: Fake trust badges, unverified award logos, fabricated accreditations",
            "Cognitive Bias — Authority Bias",
            "Phase 3: NLP Scan",
          );
          log(
            "DP-NLP-IN",
            "running",
            "  → India-Specific (IN-CPA/ASCI): Asterisk promos, crore-trust claims, family guilt framing",
            "IN-CPA Dark Pattern Guidelines 2023 + ASCI Guidelines",
            "Phase 3: NLP Scan",
          );
          const textFindings = await runTextPatternScans(
            page,
            pageData.url,
            usingCachedHtml ? pageData.html : undefined,
          );
          for (const f of textFindings) {
            f.id = `dp-${++findingId}`;
            f.evidence.screenshotDataUrl = crawlFallback;
            screenshotTasks.push(() =>
              captureElementScreenshot(page!, f, crawlFallback, usingCachedHtml)
                .then((url) => {
                  if (url) f.evidence.screenshotDataUrl = url;
                })
                .catch(() => {}),
            );
            findings.push(f);
          }
          log(
            "DP-NLP",
            textFindings.length > 0 ? "fail" : "pass",
            `  ✓ Phase 3 complete — ${textFindings.length} finding(s) detected`,
            "Cognitive Bias Framework",
            "Phase 3: NLP Scan",
          );

          // ── Phase 4: Deep Code Inspection ──
          log(
            "DP-DEEP",
            "running",
            "━━━ Phase 4: Deep Code & Behavioural Inspection",
            "FTC Enforcement Layer +  Art. 6",
            "Phase 4: Deep Code Scan",
          );
          log(
            "DP-DEEP-TK",
            "running",
            "  → Pre-Consent Tracking: Scripts firing before user interaction ( violation)",
            " Art. 6 — Lawful Basis Required",
            "Phase 4: Deep Code Scan",
          );
          log(
            "DP-DEEP-OV",
            "running",
            "  → Invisible Overlay Traps: Transparent click-jacking overlays (high z-index)",
            "FTC — Deceptive Interface Practices",
            "Phase 4: Deep Code Scan",
          );
          log(
            "DP-DEEP-CT",
            "running",
            "  → Fake Countdowns: setInterval-driven timers that reset on page refresh",
            "CCPA #12 — Manufactured Scarcity",
            "Phase 4: Deep Code Scan",
          );
          log(
            "DP-DEEP-AR",
            "running",
            "  → Auto-Renewal Detection: Recurring charge mentions without visible cancel instructions",
            "CCPA #10 — Forced Continuity",
            "Phase 4: Deep Code Scan",
          );
          log(
            "DP-DEEP-BU",
            "running",
            "  → Buried Cancellation: Unsubscribe/cancel links nested 3+ levels deep in navigation",
            "EU DSA Art. 25 — Obstruction",
            "Phase 4: Deep Code Scan",
          );
          const deepFindings = await runDeepCodeInspection(page, pageData.url);
          for (const f of deepFindings) {
            f.id = `dp-${++findingId}`;
            f.evidence.screenshotDataUrl = crawlFallback;
            screenshotTasks.push(() =>
              captureElementScreenshot(page!, f, crawlFallback, usingCachedHtml)
                .then((url) => {
                  if (url) f.evidence.screenshotDataUrl = url;
                })
                .catch(() => {}),
            );
            findings.push(f);
          }
          log(
            "DP-DEEP",
            deepFindings.length > 0 ? "fail" : "pass",
            `  ✓ Phase 4 complete — ${deepFindings.length} finding(s) detected`,
            "FTC +  Art. 6",
            "Phase 4: Deep Code Scan",
          );

          // ── Phase 5: Accessibility × Dark Pattern Cross-Mapping ──
          log(
            "DP-AX",
            "running",
            "━━━ Phase 5: Ethical Accessibility Cross-Mapping",
            "WCAG 2.2 + Dark Pattern Intersection",
            "Phase 5: A11Y Cross-Map",
          );
          log(
            "DP-AX-FT",
            "running",
            "  → Focus Trap in Consent Modal: Keyboard escape path blocked (WCAG 2.1.2)",
            "WCAG 2.1.2 — No Keyboard Trap",
            "Phase 5: A11Y Cross-Map",
          );
          log(
            "DP-AX-SR",
            "running",
            "  → Screen Reader Mismatch: Visible label vs aria-label deception check",
            "WCAG 4.1.2 — Name, Role, Value",
            "Phase 5: A11Y Cross-Map",
          );
          log(
            "DP-AX-LC",
            "running",
            "  → Low-Contrast Reject: Consent banner reject button contrast weaponisation",
            "WCAG 1.4.3 — Contrast Minimum",
            "Phase 5: A11Y Cross-Map",
          );
          const axFindings = await runA11yCrossMap(page, pageData.url);
          for (const f of axFindings) {
            f.id = `dp-${++findingId}`;
            f.evidence.screenshotDataUrl = crawlFallback;
            screenshotTasks.push(() =>
              captureElementScreenshot(page!, f, crawlFallback, usingCachedHtml)
                .then((url) => {
                  if (url) f.evidence.screenshotDataUrl = url;
                })
                .catch(() => {}),
            );
            findings.push(f);
          }
          log(
            "DP-AX",
            axFindings.length > 0 ? "fail" : "pass",
            `  ✓ Phase 5 complete — ${axFindings.length} finding(s) detected`,
            "WCAG + Dark Pattern Intersection",
            "Phase 5: A11Y Cross-Map",
          );

          // ── Phase 6: Interaction Flow (Ethical Friction Score) ──
          log(
            "DP-FLOW",
            "running",
            "━━━ Phase 6: Interaction Flow — Ethical Friction Score",
            "Ethical Friction Score (EFS) Methodology",
            "Phase 6: Flow Analysis",
          );
          log(
            "DP-FLOW-AS",
            "running",
            "  → Subscribe vs Cancel Symmetry: Entry CTA count vs exit CTA count ratio",
            "EFS — Choice Asymmetry Principle",
            "Phase 6: Flow Analysis",
          );
          log(
            "DP-FLOW-HP",
            "running",
            "  → Homepage Scan Simulation: First-impression CTA prominence & scan-path analysis",
            "Misdirection — Visual Hierarchy Bias",
            "Phase 6: Flow Analysis",
          );
          log(
            "DP-FLOW-MD",
            "running",
            "  → Misdirection (CCPA #5): Visual design drawing attention away from key information",
            "CCPA #5 — Misdirection",
            "Phase 6: Flow Analysis",
          );
          const flowFindings = await runInteractionFlowAnalysis(
            page,
            pageData.url,
          );
          for (const f of flowFindings) {
            f.id = `dp-${++findingId}`;
            f.evidence.screenshotDataUrl = crawlFallback;
            screenshotTasks.push(() =>
              captureElementScreenshot(page!, f, crawlFallback, usingCachedHtml)
                .then((url) => {
                  if (url) f.evidence.screenshotDataUrl = url;
                })
                .catch(() => {}),
            );
            findings.push(f);
          }
          log(
            "DP-FLOW",
            flowFindings.length > 0 ? "fail" : "pass",
            `  ✓ Phase 6 complete — ${flowFindings.length} finding(s) detected`,
            "Ethical Friction Score",
            "Phase 6: Flow Analysis",
          );

          // ── Phase 9: Cookie Consent Management Platform (CMP) Deep Audit ──
          log(
            "DP-CMP",
            "running",
            "━━━ Phase 9: Cookie Consent Management Platform Audit",
            "EDPB Guidelines 3/2022 + ICO Cookie Guidance",
            "Phase 9: CMP Audit",
          );
          log(
            "DP-CMP-RJ",
            "running",
            "  → Reject All Presence: Is Reject All on first screen? (EDPB equal ease requirement)",
            "EDPB Guidelines 3/2022",
            "Phase 9: CMP Audit",
          );
          log(
            "DP-CMP-PR",
            "running",
            "  → Pre-Enabled Categories: Marketing/analytics toggles enabled by default?",
            " Art. 7 — Explicit Opt-In Required",
            "Phase 9: CMP Audit",
          );
          log(
            "DP-CMP-LI",
            "running",
            "  → Legitimate Interest Abuse: Ad vendors pre-enabled under LI basis?",
            " Art. 6(1)(f) + EDPB Opinion 08/2023",
            "Phase 9: CMP Audit",
          );
          log(
            "DP-CMP-SC",
            "running",
            "  → Scroll/Browsing Consent: Implied consent via continued use?",
            " Recital 32 — Explicit Active Consent Required",
            "Phase 9: CMP Audit",
          );
          log(
            "DP-CMP-DO",
            "running",
            "  → DOM Order Bias: Accept placed before Reject in DOM structure?",
            "ICO Guidance — Neutral Option Ordering",
            "Phase 9: CMP Audit",
          );
          const cmpFindings = await runCookieConsentAudit(page, pageData.url);
          for (const f of cmpFindings) {
            f.id = `dp-${++findingId}`;
            f.evidence.screenshotDataUrl = crawlFallback;
            screenshotTasks.push(() =>
              captureElementScreenshot(page!, f, crawlFallback, usingCachedHtml)
                .then((url) => {
                  if (url) f.evidence.screenshotDataUrl = url;
                })
                .catch(() => {}),
            );
            findings.push(f);
          }
          log(
            "DP-CMP",
            cmpFindings.length > 0 ? "fail" : "pass",
            `  ✓ Phase 9 complete — ${cmpFindings.length} CMP finding(s) detected`,
            "EDPB +  Cookie Compliance",
            "Phase 9: CMP Audit",
          );

          // ── Flush element screenshots (sequential, 15s total budget) ──
          // Tasks share a single Playwright page object. Parallel DOM mutations cause
          // concurrent __tl_lbl__ banner overwrites → wrong labels in every screenshot.
          // Running sequentially eliminates the race at the cost of ~3s per finding max.
          {
            const taskDeadline = Date.now() + 15000;
            for (const task of screenshotTasks) {
              if (Date.now() >= taskDeadline) break;
              const remaining = Math.max(500, taskDeadline - Date.now());
              await Promise.race([
                task(),
                new Promise<void>((resolve) =>
                  setTimeout(resolve, Math.min(3000, remaining)),
                ),
              ]);
            }
          }

          // ── Phase 8: Visual AI Dark Pattern Analysis (Claude Vision) — always-on ──
          if (process.env.ANTHROPIC_API_KEY && Date.now() < pageDeadlineMs) {
            log(
              "DP-VISAI",
              "running",
              "━━━ Phase 8: Visual AI Dark Pattern Analysis",
              "Claude Vision — Visual Design Exploitation Detection",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-CA",
              "running",
              "  → Consent Asymmetry (DP-VIS-AI-01): Graphical Accept vs Reject visual weight imbalance",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-UG",
              "running",
              "  → Image-Based Urgency (DP-VIS-AI-02): Countdown graphics, scarcity badges rendered as images",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-VH",
              "running",
              "  → Visual Hierarchy Manipulation (DP-VIS-AI-03): Premium option dominance via design",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-EM",
              "running",
              "  → Emotional Imagery (DP-VIS-AI-04): Fear/FOMO photography as persuasion tool",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-DC",
              "running",
              "  → Disguised CTA (DP-VIS-AI-05): Sponsored content camouflaged as organic",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-DZ",
              "running",
              "  → Dead Zone Placement (DP-VIS-AI-06): Reject in F/Z-pattern blind spot",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-HC",
              "running",
              "  → Hidden Charges (DP-VIS-AI-07): Camouflaged price elements via colour/weight",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            log(
              "DP-VISAI-CS",
              "running",
              "  → Visual Confirmshaming (DP-VIS-AI-08): Decline option styled as broken/ashamed",
              "Claude Vision",
              "Phase 8: Visual AI Scan",
            );
            try {
              const visAiFindings = await runVisualAIDarkPatternPhase8(
                page,
                pageData.url,
              );
              for (const f of visAiFindings) {
                f.id = `dp-${++findingId}`;
                findings.push(f);
              }
              log(
                "DP-VISAI",
                visAiFindings.length > 0 ? "fail" : "pass",
                `  ✓ Phase 8 complete — ${visAiFindings.length} visual AI finding(s) detected`,
                "Claude Vision",
                "Phase 8: Visual AI Scan",
              );
            } catch (visErr) {
              log(
                "DP-VISAI",
                "warn",
                `  ⚠ Phase 8 skipped — ${visErr instanceof Error ? visErr.message : "Vision API unavailable"}`,
                "Claude Vision",
                "Phase 8: Visual AI Scan",
              );
            }
          }
        })(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("DP page-scan timed out (3min): " + pageData.url),
              ),
            3 * 60 * 1000,
          ),
        ),
      ]);
    } catch (err) {
      console.error(
        `[TrustLens:DarkPattern] Error scanning ${pageData.url}:`,
        err,
      );
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  // ── Phase 7: Regulatory Compliance Mapping ──
  log(
    "DP-REG",
    "running",
    "━━━ Phase 7: Regulatory & Legal Risk Mapping",
    "Multi-Regulation Compliance Framework",
    "Phase 7: Regulatory Mapping",
  );
  log(
    "DP-REG-FTC",
    "running",
    "  → FTC Enforcement: Section 5 deceptive practices coverage",
    "FTC §5 — Unfair or Deceptive Acts",
    "Phase 7: Regulatory Mapping",
  );
  log(
    "DP-REG-DSA",
    "running",
    "  → EU Digital Services Act: Art. 25 prohibited dark pattern clauses",
    "EU DSA Art. 25 — Prohibited Dark Patterns",
    "Phase 7: Regulatory Mapping",
  );
  log(
    "DP-REG-GD",
    "running",
    "  →  / ePrivacy: Consent dark patterns (ICO, CNIL enforcement guidance)",
    " + ePrivacy — Consent Integrity",
    "Phase 7: Regulatory Mapping",
  );
  log(
    "DP-REG-IN",
    "running",
    "  → IN-DPDPA 2023: India Digital Personal Data Protection Act mapping",
    "India DPDPA 2023 — Data Principal Rights",
    "Phase 7: Regulatory Mapping",
  );
  const regulationSet = new Set<string>();
  for (const f of findings) f.regulation.forEach((r) => regulationSet.add(r));
  log(
    "DP-REG",
    "pass",
    `  ✓ Phase 7 complete — Mapped to ${regulationSet.size} regulation(s): ${[...regulationSet].join(", ")}`,
    "Multi-Regulation Framework",
    "Phase 7: Regulatory Mapping",
  );

  // ── Compliance Exemption Pass (IRDAI / RBI / SEBI BFSI Context) ──
  log(
    "DP-COMP",
    "running",
    "━━━ Compliance Context Pass: IRDAI / RBI / SEBI Exemption Check",
    "Indian BFSI Regulatory Compliance Framework",
    "Compliance Exemption Pass",
  );
  log(
    "DP-COMP-UO",
    "running",
    "  → Urgency cues: Validating against legitimate campaign offer context (IRDAI/RBI marketing norms)",
    "IRDAI Protection of Policyholders Rules",
    "Compliance Exemption Pass",
  );
  log(
    "DP-COMP-MD",
    "running",
    "  → Mandatory disclosures: IRDAI/SEBI/RBI regulatory acknowledgment gates",
    "SEBI LODR + IRDAI Product Regulations",
    "Compliance Exemption Pass",
  );
  log(
    "DP-COMP-KY",
    "running",
    "  → KYC/auth gates: OTP, Aadhaar/PAN validation required under PMLA/RBI KYC norms",
    "RBI Master Direction on KYC (2016, updated 2023)",
    "Compliance Exemption Pass",
  );
  log(
    "DP-COMP-RD",
    "running",
    "  → Default selections: Insurance rider/product defaults per IRDAI structuring norms",
    "IRDAI (Non-Linked Insurance Products) Regulations, 2013",
    "Compliance Exemption Pass",
  );
  log(
    "DP-COMP-UW",
    "running",
    "  → Data capture gates: Underwriting/personalization requirements for quotes (RBI Digital Lending, 2022)",
    "RBI Master Direction on Digital Lending, 2022",
    "Compliance Exemption Pass",
  );
  const { totalExempted, byCategory } = applyComplianceExemptions(
    findings,
    options.siteProfile,
  );
  if (totalExempted > 0) {
    log(
      "DP-COMP",
      "warn",
      `  ⚠ ${totalExempted} finding(s) flagged as potentially compliance-driven — requires backend validation before enforcement action`,
      "BFSI Compliance Exemption Framework",
      "Compliance Exemption Pass",
    );
  } else {
    log(
      "DP-COMP",
      "pass",
      "  ✓ No compliance exemptions applicable (non-BFSI site or no exemptible patterns detected)",
      "BFSI Compliance Exemption Framework",
      "Compliance Exemption Pass",
    );
  }

  // Deduplicate: remove findings with identical ruleId + pageUrl + evidence summary
  // (prevents social-pressure and misdirection rules from inflating counts when same
  // text element is matched multiple times across scan phases)
  const seen = new Set<string>();
  const dedupedFindings = findings.filter((f) => {
    const key = `${f.ruleId}::${f.pageUrl}::${(f.evidence?.summary || "").slice(0, 120)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return buildResult(dedupedFindings, pages.length, totalExempted, byCategory);
}

// ═══════════════════════════════════════════════════════════
// ELEMENT-SPECIFIC SCREENSHOT CAPTURE
// Takes a contextual viewport screenshot scrolled to show the
// specific finding's element. Falls back to full-page screenshot.
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ELEMENT-PINPOINT SCREENSHOT
//
// Strategy (both modes):
//   1. Find the specific element via id / name / text locators
//   2. Scroll it into view
//   3. Inject a red highlight overlay directly onto the element
//   4. Take a CLIPPED screenshot — cropped to element + 100px padding
//      so the client sees exactly the problem area, not the whole page
//   5. Remove the overlay
//
// setContent (WAF) mode: minimal CSS is already injected on the page
//   so elements have real bounding boxes. We still follow the same
//   crop-to-element strategy. If no element is found, fall back to
//   a viewport screenshot of the CSS-styled page.
// ═══════════════════════════════════════════════════════════
/**
 * Fetch the site's real external CSS and inject it into a Playwright page that was
 * loaded via setContent() (WAF-blocked sites). This makes the rendering look like the
 * actual branded UI rather than bare unstyled HTML — dramatically improving screenshot
 * quality for clients and regulators reviewing the audit evidence.
 *
 * Fetches up to 5 stylesheets, each capped at 150 KB, with a 3 s timeout per file.
 */
async function injectSiteCSS(
  page: Page,
  html: string,
  baseUrl: string,
): Promise<void> {
  // ── APPROACH: Fetch CSS via Node.js and inline directly (proven fix) ──
  // setContent() cannot load @import externals due to no-page-origin CORS blocking.
  // Verified: PolicyBazaar home.css = 359KB (was silently dropped by old 150KB limit).
  // Node.js fetch → inline text → addStyleTag({ content }) bypasses all those limits.
  const cssUrls: string[] = [];
  const re1 =
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const re2 =
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) cssUrls.push(m[1]);
  while ((m = re2.exec(html)) !== null) cssUrls.push(m[1]);

  const resolved = [...new Set(cssUrls)]
    .slice(0, 10)
    .map((u) => {
      try {
        return new URL(u, baseUrl).href;
      } catch {
        return null;
      }
    })
    .filter((u): u is string => !!u && /^https?:\/\//.test(u));

  // Fetch each CSS file via Node.js (no size limit, no CORS, direct CDN access)
  let combinedCss = "";
  for (const cssUrl of resolved) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(cssUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/css,*/*",
          Referer: baseUrl,
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
            try {
              return `url("${new URL(relPath.trim(), cssBase.href).href}")`;
            } catch {
              return match;
            }
          },
        );
        combinedCss += `\n/* === ${cssUrl} === */\n${fixedCss}\n`;
      }
    } catch {
      /* skip unreachable CSS files */
    }
  }

  // Set <base href> so relative src= and href= attributes resolve correctly
  await page
    .evaluate((bUrl: string) => {
      if (!document.querySelector("base")) {
        const base = document.createElement("base");
        base.href = bUrl;
        document.head?.prepend(base);
      }
    }, baseUrl)
    .catch(() => {});

  // Inject all fetched CSS as a single inline style block (no external fetches by browser)
  if (combinedCss) {
    await page.addStyleTag({ content: combinedCss }).catch(() => {});
  }

  // Minimal fallback so unstyled elements remain legible
  await page
    .addStyleTag({
      content: `
    body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;background:#fff;color:#111;margin:0;}
    img{max-width:100%;height:auto;}a{color:#1a0dab;}*{box-sizing:border-box;}
  `,
    })
    .catch(() => {});

  // Collapse oversized nav dropdowns (they expand to fill viewport in raw HTML without JS)
  await page
    .evaluate(() => {
      document
        .querySelectorAll(
          '[class*="mega"],[class*="nav-drop"],[class*="dropdown-menu"],[class*="NavMenu"],[class*="main-nav"]',
        )
        .forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.getBoundingClientRect().height > 200)
            htmlEl.style.display = "none";
        });
    })
    .catch(() => {});
}

async function captureElementScreenshot(
  page: Page,
  finding: DarkPatternFinding,
  fallbackDataUrl?: string,
  usingCachedHtml?: boolean,
): Promise<string | undefined> {
  const TIMEOUT = 800;
  const PADDING = 100; // px of context around the element

  // Build locator candidates from most to least specific
  type LocatorFactory = () => ReturnType<Page["locator"]>;
  const candidates: LocatorFactory[] = [];

  const idMatch = finding.elementHtml?.match(/\bid="([^"]+)"/);
  if (idMatch)
    candidates.push(() => page.locator(`[id="${idMatch[1]}"]`).first());

  const nameMatch = finding.elementHtml?.match(/\bname="([^"]+)"/);
  if (nameMatch)
    candidates.push(() => page.locator(`[name="${nameMatch[1]}"]`).first());

  // Quoted evidence text — most useful for NLP findings ("Only 3 left!", trust claims, etc.)
  const qText = (finding.evidence?.summary || "").match(/"([^"]{5,120})"/)?.[1];
  if (qText)
    candidates.push(() => page.getByText(qText, { exact: false }).first());

  // Partial text from title as last resort
  const titleWords = (finding.title || "").split(" ").slice(0, 4).join(" ");
  if (titleWords.length > 8)
    candidates.push(() => page.getByText(titleWords, { exact: false }).first());

  try {
    for (const makeLocator of candidates) {
      try {
        const locator = makeLocator();
        const handle = await locator
          .elementHandle({ timeout: TIMEOUT })
          .catch(() => null);
        if (!handle) continue;

        // Scroll element to centre of viewport
        await handle.evaluate((el: Element) =>
          el.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "instant",
          }),
        );
        await page.waitForTimeout(200);

        // Get bounding box in PAGE coordinates
        const box = await handle.boundingBox();
        if (!box || box.width === 0) continue;

        // Viewport dimensions
        const vp = page.viewportSize() || { width: 1280, height: 900 };

        // ── Inject red highlight overlay on the element ──
        await page.evaluate(
          ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => {
            document.getElementById("__tl_hl__")?.remove();
            const div = document.createElement("div");
            div.id = "__tl_hl__";
            Object.assign(div.style, {
              position: "absolute",
              top: `${y - 3}px`,
              left: `${x - 3}px`,
              width: `${w + 6}px`,
              height: `${h + 6}px`,
              border: "3px solid #FF3356",
              borderRadius: "3px",
              background: "rgba(255,51,86,0.12)",
              zIndex: "2147483647",
              pointerEvents: "none",
              boxShadow:
                "0 0 0 3px rgba(255,51,86,0.35), inset 0 0 0 1px rgba(255,51,86,0.5)",
            });
            // Make sure body is position:relative so absolute coords work
            if (getComputedStyle(document.body).position === "static") {
              document.body.style.position = "relative";
            }
            document.body.appendChild(div);
          },
          { x: box.x, y: box.y, w: box.width, h: box.height },
        );

        // ── Clipped screenshot centred on the element ──
        const clipX = Math.max(0, box.x - PADDING);
        const clipY = Math.max(0, box.y - PADDING);
        const clipW = Math.min(vp.width, box.width + PADDING * 2);
        const clipH = Math.min(700, box.height + PADDING * 2);

        const buf = await page.screenshot({
          type: "jpeg",
          quality: 88,
          clip: { x: clipX, y: clipY, width: clipW, height: clipH },
        });

        // Clean up overlay
        await page
          .evaluate(() => document.getElementById("__tl_hl__")?.remove())
          .catch(() => {});

        return `data:image/jpeg;base64,${buf.toString("base64")}`;
      } catch {
        continue;
      }
    }

    // ── Fallback: element locators all failed ──
    if (usingCachedHtml) {
      // WAF/cached-HTML page: Playwright is rendering injected HTML, not the real site.
      // Return the crawl-time screenshot (real browser render) directly — no viewport crop.
      return fallbackDataUrl;
    }
    if (!fallbackDataUrl) {
      // Live page, no baseline at all: inject a label banner on the current viewport.
      const vp = page.viewportSize() || { width: 1280, height: 900 };
      const label = (finding.title || "Dark Pattern Detected").replace(
        /'/g,
        "\\'",
      );
      await page
        .evaluate((txt: string) => {
          document.getElementById("__tl_lbl__")?.remove();
          const el = document.createElement("div");
          el.id = "__tl_lbl__";
          Object.assign(el.style, {
            position: "fixed",
            top: "0",
            left: "0",
            right: "0",
            padding: "6px 14px",
            background: "rgba(232,0,45,0.92)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: "700",
            fontFamily: "sans-serif",
            zIndex: "2147483647",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          });
          el.textContent = `⚠ ${txt}`;
          document.body.prepend(el);
        }, label)
        .catch(() => {});
      const buf = await page.screenshot({
        type: "jpeg",
        quality: 80,
        clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 700) },
      });
      await page
        .evaluate(() => document.getElementById("__tl_lbl__")?.remove())
        .catch(() => {});
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  } catch {
    /* screenshots are non-blocking */
  }

  return fallbackDataUrl;
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: DOM-Level Scanning
// ═══════════════════════════════════════════════════════════
async function runDOMScans(
  page: Page,
  pageUrl: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  // DP-SN-01: Preselected checkboxes
  const preselected = await page
    .$$eval(
      'input[type="checkbox"][checked], input[type="checkbox"]:checked',
      (els) =>
        els.map((el) => ({
          html: el.outerHTML.substring(0, 200),
          name: el.getAttribute("name") || "",
          label:
            el.closest("label")?.textContent?.trim()?.substring(0, 100) || "",
          id: el.id || "",
        })),
    )
    .catch(() => []);

  for (const cb of preselected) {
    const isOptIn =
      /newsletter|marketing|subscribe|promo|offer|update|notify|consent|agree|opt/i.test(
        cb.name + cb.label + cb.id,
      );
    if (isOptIn) {
      findings.push(
        makeFinding("DP-SN-01", pageUrl, cb.html, {
          summary: `Preselected opt-in checkbox found: "${cb.label || cb.name}"`,
          details: [
            `Checkbox "${cb.label || cb.name}" is checked by default`,
            `Element: ${cb.html}`,
          ],
          measurements: { label: cb.label, name: cb.name },
        }),
      );
    }
  }

  // DP-SN-02: Preselected add-ons (radio/select defaults)
  const preselectedRadios = await page
    .$$eval(
      'input[type="radio"][checked], input[type="radio"]:checked',
      (els) =>
        els.map((el) => ({
          html: el.outerHTML.substring(0, 200),
          name: el.getAttribute("name") || "",
          label:
            el.closest("label")?.textContent?.trim()?.substring(0, 100) || "",
          value: el.getAttribute("value") || "",
        })),
    )
    .catch(() => []);

  for (const r of preselectedRadios) {
    if (
      /add-?on|extra|premium|upgrade|insurance|protect/i.test(
        r.label + r.value + r.name,
      )
    ) {
      findings.push(
        makeFinding("DP-SN-02", pageUrl, r.html, {
          summary: `Preselected add-on option: "${r.label}"`,
          details: [
            `Radio button "${r.label}" preselects an add-on`,
            `Element: ${r.html}`,
          ],
        }),
      );
    }
  }

  // DP-FA-01: Login/registration wall blocking content
  // Selector-based: class names, IDs, data attributes
  const loginWallByClass = await page
    .$$eval(
      '[class*="login-wall"], [class*="signup-wall"], [class*="registration-wall"], [class*="paywall"], [class*="gate"], [id*="login-modal"], [class*="auth-modal"], [data-testid*="paywall"], [data-testid*="login-gate"], [data-testid*="auth-wall"], [aria-label*="login required"], [aria-label*="sign in to"]',
      (els) =>
        els
          .filter((el) => {
            const style = window.getComputedStyle(el);
            return style.display !== "none" && style.visibility !== "hidden";
          })
          .map((el) => el.outerHTML.substring(0, 200)),
    )
    .catch(() => []);

  // Fallback: detect high-z-index fixed/absolute overlays containing login/subscribe copy
  const loginWallByPosition =
    loginWallByClass.length === 0
      ? await page
          .evaluate(() => {
            const results: string[] = [];
            const els = document.querySelectorAll(
              "div, section, aside, article",
            );
            for (const el of els) {
              const style = window.getComputedStyle(el);
              const zIndex = parseInt(style.zIndex || "0");
              if (
                zIndex >= 50 &&
                (style.position === "fixed" || style.position === "absolute") &&
                style.display !== "none" &&
                style.visibility !== "hidden"
              ) {
                const text = (el.textContent || "").toLowerCase();
                if (
                  /log.?in|sign.?in|sign.?up|create.?account|subscribe to read|continue reading/i.test(
                    text,
                  ) &&
                  /(button|input|form)/i.test(el.innerHTML)
                ) {
                  results.push(el.outerHTML.substring(0, 200));
                  if (results.length >= 2) break;
                }
              }
            }
            return results;
          })
          .catch(() => [] as string[])
      : [];

  const loginWall = [...loginWallByClass, ...loginWallByPosition];

  if (loginWall.length > 0) {
    findings.push(
      makeFinding("DP-FA-01", pageUrl, loginWall[0], {
        summary: "Login/registration wall detected blocking content access",
        details: [
          `${loginWall.length} blocking overlay(s) found`,
          `Element: ${loginWall[0]}`,
        ],
      }),
    );
  }

  // DP-FA-07: Phone number / mobile gate before product information
  // Detects single-field phone-only forms that gate price/quote access — common in Indian BFSI
  const phoneGateFound = await page
    .evaluate(() => {
      const phoneInputs = document.querySelectorAll(
        'input[type="tel"], input[name*="mobile"], input[name*="phone"], input[name*="mob"], ' +
          'input[placeholder*="mobile"], input[placeholder*="phone number"], input[placeholder*="enter mobile"], ' +
          'input[id*="mobile"], input[id*="phone"]',
      );
      for (const input of phoneInputs) {
        const style = window.getComputedStyle(input);
        if (style.display === "none" || style.visibility === "hidden") continue;
        // Check if this phone field is the primary/only required gate (form has 1-2 visible fields)
        const form =
          input.closest("form") ||
          input.closest('[class*="form"]') ||
          input.closest("section");
        if (!form) continue;
        const visibleInputs = form.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"])',
        );
        // Phone gate: 1 or 2 fields (phone + maybe name/DOB), leading to a quote/get-started CTA
        if (visibleInputs.length <= 2) {
          const formText = (form.textContent || "").toLowerCase();
          const isGating =
            /get\s*(a\s*)?(quote|price|plan|premium)|see\s*(plans?|quotes?|price)|compare\s*plans?|check\s*(premium|price)|start|proceed|continue|next/i.test(
              formText,
            );
          if (isGating) {
            return (
              (form as HTMLElement).outerHTML?.substring(0, 300) ||
              input.outerHTML.substring(0, 200)
            );
          }
        }
      }
      return null;
    })
    .catch(() => null);
  if (phoneGateFound) {
    findings.push(
      makeFinding("DP-FA-07", pageUrl, phoneGateFound, {
        summary:
          "Phone number gate: mobile required before price/quote information is shown",
        details: [
          "User must provide mobile number before accessing any product price or plan details",
          "Collects personal data as a condition of viewing publicly available product information",
          "Violates India DPDPA 2023 (data minimisation principle), IN-CPA Dark Pattern Guidelines 2023 (Forced Action category)",
          "RBI Digital Lending Guidelines 2022 require upfront disclosure before data collection in lending context",
        ],
      }),
    );
  }

  // DP-FA-03: App install prompt blocking content
  const appInstall = await page
    .$$eval(
      '[class*="app-install"], [class*="app-banner"], [class*="smart-banner"], [id*="app-install"]',
      (els) =>
        els
          .filter((el) => {
            const style = window.getComputedStyle(el);
            return style.display !== "none" && parseFloat(style.height) > 80;
          })
          .map((el) => el.outerHTML.substring(0, 200)),
    )
    .catch(() => []);

  if (appInstall.length > 0) {
    findings.push(
      makeFinding("DP-FA-03", pageUrl, appInstall[0], {
        summary: "Blocking app install prompt detected",
        details: [
          `Full-screen or large app install prompt found`,
          `Element: ${appInstall[0]}`,
        ],
      }),
    );
  }

  // DP-NG-01: Multiple overlapping modals
  const visibleModals = await page
    .$$eval(
      '[role="dialog"], [class*="modal"], [class*="popup"], [class*="overlay"]',
      (els) =>
        els.filter((el) => {
          const s = window.getComputedStyle(el);
          return (
            s.display !== "none" &&
            s.visibility !== "hidden" &&
            s.opacity !== "0"
          );
        }).length,
    )
    .catch(() => 0);

  if (visibleModals >= 2) {
    findings.push(
      makeFinding("DP-NG-01", pageUrl, "", {
        summary: `${visibleModals} overlapping modal dialogs detected simultaneously`,
        details: [
          `${visibleModals} visible modals/popups/overlays found at the same time`,
        ],
        measurements: { visibleModals },
      }),
    );
  }

  // DP-NG-02: Notification permission prompt detection
  const notifPrompt = await page
    .$$eval(
      '[class*="notification"], [class*="push-prompt"], [class*="enable-notif"]',
      (els) =>
        els
          .filter((el) => {
            const s = window.getComputedStyle(el);
            return (
              s.display !== "none" &&
              /notification|push|enable|allow/i.test(el.textContent || "")
            );
          })
          .map((el) => el.outerHTML.substring(0, 200)),
    )
    .catch(() => []);

  if (notifPrompt.length > 0) {
    findings.push(
      makeFinding("DP-NG-02", pageUrl, notifPrompt[0], {
        summary: "Notification permission prompt displayed on page load",
        details: [
          "Site prompts for notification permissions without prior user engagement",
        ],
      }),
    );
  }

  // DP-SU-01: Countdown timers — class-name selectors + text-content fallback for styled-components/Tailwind/CSS modules
  const countdowns: { html: string; text: string }[] = await page
    .$$eval(
      '[class*="countdown"], [class*="timer"], [class*="clock"], [data-countdown], [class*="time-left"], [id*="countdown"], [id*="timer"], [aria-label*="time"], [aria-label*="countdown"]',
      (els) =>
        els
          .filter((el) => {
            const s = window.getComputedStyle(el);
            return (
              s.display !== "none" &&
              el.textContent &&
              /\d+\s*[:\-]\s*\d+/.test(el.textContent)
            );
          })
          .map((el) => ({
            html: el.outerHTML.substring(0, 200),
            text: el.textContent?.trim()?.substring(0, 80) || "",
          })),
    )
    .catch(() => []);

  // Fallback: text-content scan for HH:MM:SS / MM:SS patterns (catches SPAs with no class-name hints)
  if (countdowns.length === 0) {
    const textCountdowns = await page
      .evaluate(() => {
        const results: { html: string; text: string }[] = [];
        const candidates = document.querySelectorAll(
          "div, span, p, strong, b, time",
        );
        for (const el of candidates) {
          const text = el.textContent?.trim() || "";
          if (
            /\b\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?\b/.test(text) &&
            text.length < 60
          ) {
            const style = window.getComputedStyle(el);
            if (style.display !== "none" && style.visibility !== "hidden") {
              results.push({
                html: el.outerHTML.substring(0, 200),
                text: text.substring(0, 80),
              });
              if (results.length >= 3) break;
            }
          }
        }
        return results;
      })
      .catch(() => [] as { html: string; text: string }[]);
    countdowns.push(...textCountdowns);
  }

  if (countdowns.length > 0) {
    findings.push(
      makeFinding("DP-SU-01", pageUrl, countdowns[0].html, {
        summary: `Countdown timer detected: "${countdowns[0].text}"`,
        details: countdowns.map((c) => `Timer: "${c.text}"`),
        measurements: { count: countdowns.length },
      }),
    );
  }

  // DP-OB-01/02: Missing unsubscribe/cancel/delete links
  const pageText = await page
    .evaluate(() => document.body?.textContent?.toLowerCase() || "")
    .catch(() => "");
  const hasSubscribe = /subscribe|sign.?up|create.?account|register|join/i.test(
    pageText,
  );
  const hasUnsubscribe =
    /unsubscribe|cancel|opt.?out|remove.?account|delete.?account|close.?account/i.test(
      pageText,
    );

  if (hasSubscribe && !hasUnsubscribe) {
    findings.push(
      makeFinding("DP-OB-01", pageUrl, "", {
        summary:
          "Subscribe/sign-up options found but no visible unsubscribe/cancel path",
        details: ["Page offers subscription but no visible way to reverse it"],
      }),
    );
  }

  // DP-SN-04: Hidden inputs with suspicious values
  const hiddenInputs = await page
    .$$eval('input[type="hidden"]', (els) =>
      els
        .filter((el) => {
          const name = el.getAttribute("name") || "";
          const val = el.getAttribute("value") || "";
          return (
            /opt|subscribe|marketing|consent|agree|newsletter|promo/i.test(
              name,
            ) && val
          );
        })
        .map((el) => ({
          name: el.getAttribute("name"),
          value: el.getAttribute("value"),
          html: el.outerHTML,
        })),
    )
    .catch(() => []);

  for (const h of hiddenInputs) {
    findings.push(
      makeFinding("DP-SN-04", pageUrl, h.html || "", {
        summary: `Hidden input "${h.name}" carries default value "${h.value}"`,
        details: [
          `Hidden field submits data without user awareness: ${h.name}=${h.value}`,
        ],
      }),
    );
  }

  // DP-PZ-01: Excessive data collection
  const formFields = await page
    .$$eval("form", (forms) =>
      forms.map((f) => {
        const inputs = f.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea',
        );
        return {
          action: f.getAttribute("action") || "",
          fieldCount: inputs.length,
          html: f.outerHTML.substring(0, 300),
          hasEmail: !!f.querySelector('[type="email"], [name*="email"]'),
          hasPhone: !!f.querySelector(
            '[type="tel"], [name*="phone"], [name*="mobile"]',
          ),
          hasAddress: !!f.querySelector(
            '[name*="address"], [name*="street"], [name*="city"]',
          ),
        };
      }),
    )
    .catch(() => []);

  for (const form of formFields) {
    if (
      form.hasEmail &&
      form.hasPhone &&
      form.fieldCount >= 6 &&
      !form.hasAddress
    ) {
      findings.push(
        makeFinding("DP-PZ-01", pageUrl, form.html, {
          summary: `Form collects ${form.fieldCount} fields including phone — potentially excessive for purpose`,
          details: [
            `Form with ${form.fieldCount} visible fields collects phone number and email`,
            "May exceed data minimization requirements",
          ],
          measurements: { fieldCount: form.fieldCount },
        }),
      );
    }
  }

  // DP-BS-01: Bait & Switch — link/button text vs actual destination mismatch
  const baitLinks = await page
    .$$eval("a[href]", (anchors) => {
      return (anchors as HTMLAnchorElement[])
        .filter((a) => {
          const text = (a.textContent || "").trim().toLowerCase();
          const href = a.href.toLowerCase();
          const visibleDest =
            /close|cancel|no thanks|dismiss|skip|decline/i.test(text);
          const actualDest =
            href &&
            !href.startsWith("javascript") &&
            !href.startsWith("#") &&
            !href.includes(window.location.hostname);
          return visibleDest && actualDest;
        })
        .map((a) => ({
          text: a.textContent?.trim().substring(0, 80) || "",
          href: a.href.substring(0, 150),
          html: a.outerHTML.substring(0, 200),
        }));
    })
    .catch(() => []);

  for (const l of baitLinks) {
    findings.push(
      makeFinding("DP-BS-01", pageUrl, l.html, {
        summary: `Bait & Switch: Dismissal link "${l.text}" redirects externally`,
        details: [
          `Visible text implies dismissal but href navigates externally: ${l.href}`,
        ],
        measurements: { text: l.text, href: l.href },
      }),
    );
  }

  // DP-DA-01: Disguised Ads — sponsored/promoted content lacking clear Ad label
  const sponsoredContent = await page
    .$$eval(
      '[class*="sponsor"], [class*="promoted"], [class*="ad-"], [class*="-ad"], [data-ad], [class*="native-ad"]',
      (els) =>
        els
          .filter((el) => {
            const s = window.getComputedStyle(el);
            if (s.display === "none" || s.visibility === "hidden") return false;
            const text = el.textContent?.toLowerCase() || "";
            const hasAdLabel =
              /\b(ad|ads|advertisement|sponsored|promoted)\b/i.test(text);
            return !hasAdLabel;
          })
          .map((el) => ({
            html: el.outerHTML.substring(0, 200),
            classes: el.className.substring(0, 100),
          })),
    )
    .catch(() => []);

  if (sponsoredContent.length > 0) {
    findings.push(
      makeFinding("DP-DA-01", pageUrl, sponsoredContent[0].html, {
        summary: `${sponsoredContent.length} sponsored/promoted element(s) without visible "Ad" or "Sponsored" label`,
        details: sponsoredContent.map((e) => `Class: ${e.classes}`),
        measurements: { count: sponsoredContent.length },
      }),
    );
  }

  // DP-FS-01: Friend Spam — contact harvesting, social invite flows
  const friendSpam = await page
    .$$eval('a, button, [role="button"]', (els) =>
      els
        .filter((el) => {
          const text = (el.textContent || "").trim();
          return /invite (friends?|contacts?)|import contacts|share with friends|refer .{0,20} earn|tell a friend/i.test(
            text,
          );
        })
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 80) || "",
          html: el.outerHTML.substring(0, 200),
        })),
    )
    .catch(() => []);

  for (const f of friendSpam) {
    findings.push(
      makeFinding("DP-FS-01", pageUrl, f.html, {
        summary: `Friend Spam / Contact Harvesting CTA: "${f.text}"`,
        details: [
          `Social invite or contact import CTA found: "${f.text}"`,
          "May access user contacts without granular consent",
        ],
      }),
    );
  }

  // DP-HC-01: Hidden Costs — price shown but tax/fee language suggests different total
  const hiddenCostSignals = await page
    .$$eval("*", (els) =>
      els
        .filter((el) => {
          if (el.children.length > 20) return false;
          const text = el.textContent || "";
          const hasPrice = /[\$£€₹¥₩₦₺₴₸]\s*[\d,]+|\d+[\d,]*\.\d{2}/.test(text);
          const hasFeeLanguage =
            /excl\.?\s*tax|plus\s*tax|before\s*tax|taxes?\s*not\s*included|additional\s*fees?|processing\s*fee|service\s*fee|booking\s*fee|GST\s*(extra|excluded|additional|not\s*included)|excl\.?\s*GST/i.test(
              text,
            );
          return hasPrice && hasFeeLanguage && text.length < 500;
        })
        .slice(0, 3)
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 200) || "",
          html: el.outerHTML.substring(0, 250),
        })),
    )
    .catch(() => []);

  for (const h of hiddenCostSignals) {
    findings.push(
      makeFinding("DP-HC-01", pageUrl, h.html, {
        summary: "Hidden Costs: Price shown excludes mandatory fees/tax",
        details: [
          `Text: "${h.text}"`,
          "Price displayed before mandatory fees/taxes are added",
        ],
      }),
    );
  }

  // DP-SP-01: Fake Social Proof — unverifiable real-time viewer/buyer counters
  const fakeSocialProof = await page
    .$$eval("*", (els) =>
      els
        .filter((el) => {
          if (el.children.length > 5) return false;
          const text = el.textContent || "";
          return (
            /\d+\s+(people|visitors?|users?|shoppers?|others?)\s+(are\s+)?(viewing|watching|looking at|browsing|buying|in their cart)/i.test(
              text,
            ) ||
            /only\s+\d+\s+left\s+in\s+stock/i.test(text) ||
            /\d+\s+sold in the last/i.test(text) ||
            /\d+\s+watching/i.test(text)
          );
        })
        .slice(0, 5)
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 120) || "",
          html: el.outerHTML.substring(0, 200),
        })),
    )
    .catch(() => []);

  for (const sp of fakeSocialProof) {
    findings.push(
      makeFinding("DP-SP-01", pageUrl, sp.html, {
        summary: `Fake Social Proof counter: "${sp.text}"`,
        details: [
          `Unverifiable real-time social proof signal: "${sp.text}"`,
          "Users cannot verify if these figures are real or manufactured",
        ],
      }),
    );
  }

  // ── Framework-managed preselected checkboxes (React/Vue/Angular — aria-checked) ──
  const ariaChecked = await page
    .$$eval(
      '[role="checkbox"][aria-checked="true"], [role="switch"][aria-checked="true"]',
      (els) =>
        els.map((el) => ({
          html: el.outerHTML.substring(0, 200),
          label:
            el.getAttribute("aria-label") ||
            el.textContent?.trim()?.substring(0, 100) ||
            "",
          id: el.id || "",
        })),
    )
    .catch(() => []);
  for (const cb of ariaChecked) {
    const isOptIn =
      /newsletter|marketing|subscribe|promo|offer|update|notify|consent|agree|opt|email|share|third.?party/i.test(
        cb.label + cb.id,
      );
    if (isOptIn) {
      findings.push(
        makeFinding("DP-SN-01", pageUrl, cb.html, {
          summary: `Framework-managed opt-in toggle pre-enabled: "${cb.label || cb.id}"`,
          details: [
            `aria-checked="true" on opt-in control — pre-enables without user action`,
            `Element: ${cb.html}`,
          ],
          measurements: { label: cb.label, detectedVia: "aria-checked" },
        }),
      );
    }
  }

  // ── DP-SN-08: Bundled consent — multiple purposes in one checkbox ──
  const bundledConsent = await page
    .$$eval('input[type="checkbox"], [role="checkbox"]', (els) =>
      els
        .filter((el) => {
          const label =
            el.closest("label")?.textContent ||
            el.getAttribute("aria-label") ||
            "";
          const consentTerms = (label.match(/\band\b|&|\+/gi) || []).length;
          const purposes = [
            "analytics",
            "marketing",
            "advertising",
            "third.party",
            "partner",
            "sharing",
            "personaliz",
          ];
          const matchCount = purposes.filter((p) =>
            new RegExp(p, "i").test(label),
          ).length;
          return consentTerms >= 1 && matchCount >= 2;
        })
        .map((el) => ({
          html: el.outerHTML.substring(0, 200),
          label:
            el.closest("label")?.textContent?.trim()?.substring(0, 150) || "",
        })),
    )
    .catch(() => []);
  for (const b of bundledConsent) {
    findings.push(
      makeFinding("DP-SN-08", pageUrl, b.html, {
        summary: `Bundled consent checkbox covers multiple purposes: "${b.label.substring(0, 80)}"`,
        details: [
          `Single checkbox bundles multiple consent purposes —  requires separate consent per purpose`,
          `Label: "${b.label}"`,
        ],
      }),
    );
  }

  // ── DP-FA-05: Consent wall blocking content ──
  const consentWall = await page
    .evaluate(() => {
      const banner = document.querySelector(
        '[class*="cookie"], [class*="consent"], [class*=""], [id*="consent"]',
      );
      if (!banner) return false;
      const s = window.getComputedStyle(banner);
      if (s.display === "none") return false;
      const overlays = document.querySelectorAll(
        '[class*="overlay"], [class*="backdrop"]',
      );
      return overlays.length > 0;
    })
    .catch(() => false);
  if (consentWall) {
    findings.push(
      makeFinding("DP-FA-05", pageUrl, "", {
        summary:
          "Consent wall detected — page content blocked unless user accepts data processing",
        details: [
          "Consent banner overlays main content, effectively denying access without acceptance",
          "Violates  Art. 7 — consent cannot be coerced by denial of service",
        ],
      }),
    );
  }

  // ── DP-FA-06: Forced social login — no email alternative ──
  const socialLoginOnly = await page
    .evaluate(() => {
      const hasSocial =
        document.querySelectorAll(
          '[class*="google-login"], [class*="facebook-login"], [class*="apple-login"], [data-provider], [class*="social-login"]',
        ).length > 0;
      const hasEmail = !!document.querySelector(
        'input[type="email"], input[name*="email"], input[type="text"][name*="user"]',
      );
      return hasSocial && !hasEmail;
    })
    .catch(() => false);
  if (socialLoginOnly) {
    findings.push(
      makeFinding("DP-FA-06", pageUrl, "", {
        summary:
          "Social login buttons present with no email/password alternative — forces third-party data sharing",
        details: [
          "No email or username alternative found",
          "Violates  Art. 7 — consent cannot be conditional on data sharing",
        ],
      }),
    );
  }

  // ── DP-OB-06: Phone-only cancellation ──
  const phoneOnlyCancel = await page
    .evaluate(() => {
      const body = (document.body?.textContent || "").toLowerCase();
      const hasPhoneCancel =
        /cancel.*call|call.*to cancel|phone.*to cancel|cancel.*by phone|cancel.*email us/i.test(
          body,
        );
      const hasOnlineCancel =
        /cancel.*online|cancel\s+my\s+(account|subscription)\s+here|click\s+to\s+cancel/i.test(
          body,
        );
      return hasPhoneCancel && !hasOnlineCancel;
    })
    .catch(() => false);
  if (phoneOnlyCancel) {
    findings.push(
      makeFinding("DP-OB-06", pageUrl, "", {
        summary:
          "Cancellation only via phone or email — no online option found",
        details: [
          "FTC Click-to-Cancel Rule 2024 requires online cancellation if signup was online",
          "Users must call or email — asymmetric friction with online subscribe",
        ],
      }),
    );
  }

  // ── DP-OB-07: No data export / portability option ──
  const hasDataExport = await page
    .evaluate(() => {
      const links = [...document.querySelectorAll("a, button")];
      return links.some((el) =>
        /download.*(my\s+)?data|export.*(my\s+)?data|data\s+portability|request.*my.*data/i.test(
          el.textContent || "",
        ),
      );
    })
    .catch(() => false);
  const hasAccountArea = await page
    .evaluate(() =>
      /account|settings|profile|dashboard/i.test(
        document.body?.textContent || "",
      ),
    )
    .catch(() => false);
  if (hasAccountArea && !hasDataExport) {
    findings.push(
      makeFinding("DP-OB-07", pageUrl, "", {
        summary:
          "Account area lacks data export option — potential  Art. 20 violation",
        details: [
          'No "Download my data" or "Export data" link found',
          " Art. 20 and India DPDPA mandate data portability on request",
        ],
      }),
    );
  }

  // ── DP-NG-04: Exit-intent popup ──
  const exitPopup = await page
    .evaluate(() => {
      const scripts = [...document.querySelectorAll("script:not([src])")];
      return scripts.some((s) =>
        /mouseleave|exit.?intent|beforeunload/i.test(s.textContent || ""),
      );
    })
    .catch(() => false);
  if (exitPopup) {
    findings.push(
      makeFinding("DP-NG-04", pageUrl, "", {
        summary:
          "Exit-intent popup script detected — intercepts user when leaving",
        details: [
          "JavaScript monitors for mouse leaving viewport and triggers a popup",
          "Often combined with confirmshaming or urgency messaging",
        ],
      }),
    );
  }

  // ── DP-SU-05: Flash sale / unverifiable time-limited deal ──
  const flashSaleEls = await page
    .$$eval("*", (els) =>
      els
        .filter((el) => {
          if (el.children.length > 10) return false;
          const text = el.textContent || "";
          return (
            /flash\s+sale|deals?\s+end\s+(soon|today|tonight)|today.?only\s+deal|limited.?time\s+offer/i.test(
              text,
            ) && text.length < 300
          );
        })
        .slice(0, 3)
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 150) || "",
          html: el.outerHTML.substring(0, 200),
        })),
    )
    .catch(() => []);
  for (const fs of flashSaleEls) {
    findings.push(
      makeFinding("DP-SU-05", pageUrl, fs.html, {
        summary: `Flash sale without verifiable end time: "${fs.text.substring(0, 80)}"`,
        details: [
          `Text: "${fs.text}"`,
          "End time not clearly stated or verifiable — may be manufactured urgency",
        ],
      }),
    );
  }

  // ── DP-SU-06: Fake "X people viewing" live counter ──
  const liveCounters = await page
    .$$eval("*", (els) =>
      els
        .filter((el) => {
          if (el.children.length > 5) return false;
          const text = el.textContent || "";
          return (
            /\d+\s+(people|others?|shoppers?)\s+(are\s+)?(viewing|watching|looking|in\s+their\s+cart)/i.test(
              text,
            ) ||
            /\d+\s+(bought|purchased|added)\s+(this\s+)?(today|in\s+the\s+last|this\s+hour)/i.test(
              text,
            ) ||
            // Indian insurance/fintech live counter variants
            /\d+\s+(people|customers?|users?)\s+(bought|purchased|took|renewed)\s+(this\s+)?(plan|policy|cover|insurance)\s+(today|this\s+week|this\s+month|in\s+the\s+last)/i.test(
              text,
            ) ||
            /\d+\s+plans?\s+(sold|bought|taken)\s+(today|this\s+(hour|week|month))/i.test(
              text,
            ) ||
            /\d+\s+(people|customers?)\s+are\s+(currently\s+)?(viewing|comparing|checking)\s+(this\s+)?(plan|policy|quote)/i.test(
              text,
            )
          );
        })
        .slice(0, 5)
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 120) || "",
          html: el.outerHTML.substring(0, 200),
        })),
    )
    .catch(() => []);
  for (const lc of liveCounters) {
    findings.push(
      makeFinding("DP-SU-06", pageUrl, lc.html, {
        summary: `Live social scarcity counter: "${lc.text.substring(0, 80)}"`,
        details: [
          `Real-time counter: "${lc.text}"`,
          "These counters are frequently fabricated — users cannot verify accuracy",
          "Violates FTC Act §5 deceptive practices",
        ],
      }),
    );
  }

  // ── DP-SP-03: Unverifiable "Best Seller" / "#1 Choice" badge ──
  const bestSellerBadges = await page
    .$$eval("*", (els) =>
      els
        .filter((el) => {
          if (el.children.length > 3) return false;
          const text = el.textContent?.trim() || "";
          return (
            /best.?seller|#1\s+(rated|choice|pick|selling)|editor.?s\s+choice|top\s+rated|award.?winning|most\s+(popular|loved|chosen)/i.test(
              text,
            ) ||
            // Indian fintech/insurance badge variants
            /\b(recommended|india'?s?\s+(no\.?\s*1|number\s+one)|claim\s+settled|highest\s+claim\s+settlement)\b/i.test(
              text,
            ) ||
            (/\d+[\d,]*\s*(cr(ore)?|lakh?)\s*(Indians?|customers?|families)\s*(trust|insured)/i.test(
              text,
            ) &&
              text.length < 120)
          );
        })
        .slice(0, 5)
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 80) || "",
          html: el.outerHTML.substring(0, 200),
        })),
    )
    .catch(() => []);
  for (const b of bestSellerBadges) {
    findings.push(
      makeFinding("DP-SP-03", pageUrl, b.html, {
        summary: `Unverifiable badge: "${b.text}"`,
        details: [
          `Badge text: "${b.text}"`,
          "No source or verification link found",
          "Violates FTC Endorsement Guides 16 CFR Part 255",
        ],
      }),
    );
  }

  // ── DP-MD-08: Strikethrough reference price ──
  const strikethroughPrices = await page
    .$$eval(
      's, del, [class*="original-price"], [class*="was-price"], [class*="old-price"], [class*="strikethrough"]',
      (els) =>
        els
          .filter((el) => {
            const s = window.getComputedStyle(el);
            return s.display !== "none" && /[\d,]+/.test(el.textContent || "");
          })
          .slice(0, 5)
          .map((el) => ({
            text: el.textContent?.trim().substring(0, 80) || "",
            html: el.outerHTML.substring(0, 200),
          })),
    )
    .catch(() => []);
  for (const sp of strikethroughPrices) {
    findings.push(
      makeFinding("DP-MD-08", pageUrl, sp.html, {
        summary: `Strikethrough "original" price "${sp.text}" — reference pricing may be fabricated`,
        details: [
          `Crossed-out price: "${sp.text}"`,
          'No evidence this item was sold at this "original" price',
          "Violates FTC Act §5 and UK Consumer Protection Regulations",
        ],
      }),
    );
  }

  // ── DP-MD-09: Asterisked / qualified promotional claim ──
  // Catches "Upto 91%* Off", "@₹10/day*", "From ₹X*", "Starting at X*"
  const asteriskedClaims = await page
    .$$eval(
      'h1, h2, h3, h4, title, [class*="hero"], [class*="headline"], [class*="banner"], [class*="promo"], [class*="offer"], [class*="badge"], meta[name="description"]',
      (els) =>
        els
          .filter((el) => {
            const text =
              el.tagName === "META"
                ? el.getAttribute("content") || ""
                : el.textContent || "";
            // Asterisk qualifier on a price/discount claim
            return (
              /(?:upto|up\s+to|from|starting\s+(at|from)|as\s+low\s+as|@|just)\s*[\$£€₹¥]?\s*[\d,]+[%₹$]?\s*(?:\/\s*\w+)?\s*\*/i.test(
                text,
              ) ||
              /[\d,]+\s*%\s*off\s*\*/i.test(text) ||
              /[\$£€₹]\s*[\d,.]+\s*(?:\/\s*\w+)?\s*\*/i.test(text)
            );
          })
          .map((el) => ({
            text:
              (el.tagName === "META"
                ? el.getAttribute("content")
                : el.textContent
              )
                ?.trim()
                .substring(0, 200) || "",
            html: el.outerHTML.substring(0, 250),
            tag: el.tagName.toLowerCase(),
          })),
    )
    .catch(() => [] as { text: string; html: string; tag: string }[]);
  for (const ac of asteriskedClaims) {
    findings.push(
      makeFinding("DP-MD-09", pageUrl, ac.html, {
        summary: `Asterisked promotional claim: "${ac.text.substring(0, 100)}"`,
        details: [
          `Claim: "${ac.text}"`,
          "Headline figure qualified by asterisk (*) — conditions buried in fine print",
          "Actual price most users pay is significantly higher than the headline number",
          "Violates India CPA Dark Pattern Guidelines 2023 (False Urgency / Basket Sneaking), ASCI Guidelines, and FTC Act §5",
        ],
        measurements: { tag: ac.tag },
      }),
    );
  }

  // ── DP-SP-04: Crore/lakh-scale unverifiable trust claim ──
  const croreTrustClaims = await page
    .$$eval("*", (els) =>
      els
        .filter((el) => {
          if (el.children.length > 5) return false;
          const text = el.textContent || "";
          return (
            /\d+[\d.,]*\s*(cr(ore)?|lakh?|lac|million)\s*\+?\s*(Indians?|customers?|families|people|policy\s*holders?|users?)/i.test(
              text,
            ) && text.length < 200
          );
        })
        .slice(0, 3)
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 120) || "",
          html: el.outerHTML.substring(0, 200),
        })),
    )
    .catch(() => []);
  for (const ct of croreTrustClaims) {
    findings.push(
      makeFinding("DP-SP-05", pageUrl, ct.html, {
        summary: `Unverifiable scale trust claim: "${ct.text.substring(0, 80)}"`,
        details: [
          `Claim: "${ct.text}"`,
          "No source, audit date, or methodology cited for this figure",
          "Violates ASCI Guidelines and India CPA Dark Pattern Guidelines 2023",
        ],
      }),
    );
  }

  // ── DP-PZ-03: Data sharing toggles enabled by default ──
  const sharingToggles = await page
    .$$eval(
      'input[type="checkbox"][checked], [role="checkbox"][aria-checked="true"]',
      (els) =>
        els
          .filter((el) => {
            const label =
              el.closest("label")?.textContent ||
              el.getAttribute("aria-label") ||
              "";
            return /share|third.?party|partner|advertis|personaliz|target/i.test(
              label,
            );
          })
          .map((el) => ({
            html: el.outerHTML.substring(0, 200),
            label:
              el.closest("label")?.textContent?.trim()?.substring(0, 120) || "",
          })),
    )
    .catch(() => []);
  for (const t of sharingToggles) {
    findings.push(
      makeFinding("DP-PZ-03", pageUrl, t.html, {
        summary: `Data sharing toggle pre-enabled: "${t.label.substring(0, 80)}"`,
        details: [
          `Pre-enabled toggle: "${t.label}"`,
          "Must opt-out not opt-in — violates  Art. 7",
        ],
      }),
    );
  }

  // ── DP-SN-09: Free trial auto-converts to paid ──
  const trialConversion = await page
    .evaluate(() => {
      const body = (document.body?.textContent || "").toLowerCase();
      const hasTrial =
        /free\s+(trial|month|period|access)|try\s+(free|for\s+free)/i.test(
          body,
        );
      const hasAutoConvert =
        /automatically?\s+(charged|billed|converts?)|after\s+(trial|free\s+period)/i.test(
          body,
        );
      const hasClearCancel = /cancel\s+before\s+|cancel\s+to\s+avoid/i.test(
        body,
      );
      return hasTrial && hasAutoConvert && !hasClearCancel;
    })
    .catch(() => false);
  if (trialConversion) {
    findings.push(
      makeFinding("DP-SN-09", pageUrl, "", {
        summary:
          "Free trial auto-converts to paid without clear pre-expiry cancellation instructions",
        details: [
          "Page mentions free trial with auto-conversion",
          "No clear cancel-before instructions found",
          "Violates FTC Click-to-Cancel Rule 2024 and EU Consumer Rights Directive Art. 6",
        ],
      }),
    );
  }

  // ── DP-PM-01: Annual billing obfuscation — price shown monthly but charged annually ──
  const annualBillingObfuscation = await page
    .evaluate(() => {
      const results: { text: string; html: string }[] = [];
      const els = document.querySelectorAll("*");
      for (const el of els) {
        if ((el as HTMLElement).offsetHeight === 0) continue; // skip hidden
        const text = el.textContent?.trim() || "";
        if (text.length < 300 && el.children.length <= 5) {
          // Pattern: monthly price + "billed annually" or "per year" context
          const hasMonthly = /[\$£€₹][\d.,]+\s*\/\s*mo(nth)?/i.test(text);
          const hasAnnualBilling =
            /billed\s+(annually|yearly)|per\s+(year|annum)|\/\s*year/i.test(
              text,
            );
          if (hasMonthly && hasAnnualBilling) {
            results.push({
              text: text.substring(0, 150),
              html: el.outerHTML.substring(0, 200),
            });
            if (results.length >= 3) break;
          }
        }
      }
      return results;
    })
    .catch(() => [] as { text: string; html: string }[]);
  for (const item of annualBillingObfuscation) {
    findings.push(
      makeFinding("DP-PM-01", pageUrl, item.html, {
        summary: `Billing obfuscation: monthly price shown for annual plan: "${item.text.substring(0, 80)}"`,
        details: [
          `Text: "${item.text}"`,
          "Monthly equivalent price is advertised but user is billed annually (full year upfront)",
          "Violates FTC Act §5 clear pricing — total charge must be prominently disclosed",
        ],
      }),
    );
  }

  // ── DP-PM-02: Plan anchoring — "Most Popular" / "Best Value" badge on recommended plan ──
  const planAnchoringBadges = await page
    .$$eval(
      '[class*="popular"], [class*="recommended"], [class*="best-value"], [class*="best_value"], [class*="featured-plan"], [class*="highlight"], [data-plan*="popular"], [data-tier*="recommended"]',
      (els) =>
        els
          .filter((el) => {
            const s = window.getComputedStyle(el);
            return s.display !== "none" && s.visibility !== "hidden";
          })
          .map((el) => ({
            text: el.textContent?.trim().substring(0, 150) || "",
            html: el.outerHTML.substring(0, 250),
            classes: el.className.substring(0, 100),
          })),
    )
    .catch(() => [] as { text: string; html: string; classes: string }[]);

  // Also text-content scan for pricing pages with anchoring copy
  const anchoringTextEls = await page
    .$$eval("*", (els) =>
      els
        .filter((el) => {
          if ((el as HTMLElement).children.length > 3) return false;
          const text = el.textContent?.trim() || "";
          return (
            text.length < 100 &&
            /most\s+popular|best\s+value|recommended|perfect\s+for\s+most|chosen\s+by\s+\d+%/i.test(
              text,
            )
          );
        })
        .slice(0, 5)
        .map((el) => ({
          text: el.textContent?.trim().substring(0, 100) || "",
          html: el.outerHTML.substring(0, 200),
          classes: el.className.substring(0, 100),
        })),
    )
    .catch(() => [] as { text: string; html: string; classes: string }[]);

  const allAnchoringEls = [...planAnchoringBadges, ...anchoringTextEls];
  if (allAnchoringEls.length > 0) {
    findings.push(
      makeFinding("DP-PM-02", pageUrl, allAnchoringEls[0].html, {
        summary: `Plan anchoring badge detected: "${allAnchoringEls[0].text.substring(0, 80)}"`,
        details: [
          ...allAnchoringEls.slice(0, 3).map((e) => `Badge/text: "${e.text}"`),
          "Exploits decoy effect and centre-stage bias to steer users toward premium plans",
          "EU DSA Art. 25(1)(a) prohibits interface manipulation that biases user choice",
        ],
        measurements: { count: allAnchoringEls.length },
      }),
    );
  }

  // ── DP-PM-03: Free trial + credit card required ──
  const trialCardRequired = await page
    .evaluate(() => {
      const body = (document.body?.textContent || "").toLowerCase();
      const hasFreeTrialCta =
        /start\s+(your\s+)?(free\s+trial|trial)|try\s+(for\s+)?free|free\s+trial/i.test(
          body,
        );
      const hasCardCapture = !!document.querySelector(
        'input[name*="card"], input[name*="credit"], input[name*="payment"], ' +
          'input[placeholder*="card"], input[placeholder*="credit card"], ' +
          '[class*="stripe"], [class*="braintree"], [class*="card-element"]',
      );
      const hasNoCreditCardMsg =
        /no\s+(credit\s+card|payment)\s+(required|needed)/i.test(body);
      return hasFreeTrialCta && hasCardCapture && !hasNoCreditCardMsg;
    })
    .catch(() => false);
  if (trialCardRequired) {
    findings.push(
      makeFinding("DP-PM-03", pageUrl, "", {
        summary:
          "Free trial requires credit card without clear conversion notice",
        details: [
          'Page offers "free trial" but captures payment details upfront',
          'No "no credit card required" reassurance found',
          "FTC Click-to-Cancel Rule 2024: trial must clearly disclose conversion price, date, and cancel method",
          "Users often forget to cancel and are auto-charged — a known subscription trap",
        ],
      }),
    );
  }

  // ── DP-PM-05: Phone-only cancellation (more robust than DP-OB-06) ──
  // Covered by DP-OB-06 above, but adding DP-PM-05 as pricing/subscription context
  const subscriptionPhoneCancel = await page
    .evaluate(() => {
      const body = (document.body?.textContent || "").toLowerCase();
      const hasSub = /subscri(be|ption|bing)|membership|plan|billing/i.test(
        body,
      );
      const hasPhoneCancel =
        /cancel.*call\s+us|call.*to\s+cancel|cancel.*by\s+(phone|calling)|cancel.*email\s+(us|to)/i.test(
          body,
        );
      const hasOnlineCancel =
        /cancel\s+(your\s+)?(account|subscription|plan|membership)\s+(online|here|below|from\s+your)/i.test(
          body,
        );
      return hasSub && hasPhoneCancel && !hasOnlineCancel;
    })
    .catch(() => false);
  if (subscriptionPhoneCancel) {
    findings.push(
      makeFinding("DP-PM-05", pageUrl, "", {
        summary:
          "Subscription cancellation requires phone or email — no online cancel option",
        details: [
          "Page mentions subscription/membership but cancellation requires calling or emailing",
          "FTC Click-to-Cancel Rule (2024): online signup must allow online cancellation",
          "This creates intentional friction — a classic Roach Motel dark pattern",
        ],
      }),
    );
  }

  // ── DP-PM-04: Drip pricing — mandatory fees revealed at checkout only ──
  const dripPricing = await page
    .evaluate(() => {
      const body = (document.body?.textContent || "").toLowerCase();
      // Only flag on checkout/payment/order pages — not on listing pages (reduces false positives)
      const isCheckoutPage =
        /checkout|payment|order\s+summary|place\s+order|review\s+order|book(ing)?|confirm\s+order/i.test(
          window.location.pathname + " " + document.title,
        );
      if (!isCheckoutPage) return null;
      const feePatterns = [
        /service\s+fee[:\s]+[\$£€₹][\d.]+/i,
        /convenience\s+(fee|charge)[:\s]+[\$£€₹][\d.]+/i,
        /booking\s+fee[:\s]+[\$£€₹][\d.]+/i,
        /processing\s+fee[:\s]+[\$£€₹][\d.]+/i,
        /platform\s+fee[:\s]+[\$£€₹][\d.]+/i,
        /environmental\s+(levy|surcharge|fee)[:\s]+[\$£€₹][\d.]+/i,
        /handling\s+(fee|charge)[:\s]+[\$£€₹][\d.]+/i,
      ];
      const matched: string[] = [];
      for (const p of feePatterns) {
        const m = body.match(p);
        if (m) matched.push(m[0].substring(0, 60));
      }
      return matched.length > 0 ? matched : null;
    })
    .catch(() => null);
  if (dripPricing && dripPricing.length > 0) {
    findings.push(
      makeFinding("DP-PM-04", pageUrl, "", {
        summary: `Drip pricing: ${dripPricing.length} mandatory fee(s) revealed at checkout`,
        details: [
          ...dripPricing.map((f) => `Fee detected: "${f}"`),
          "Mandatory fees not disclosed in initial pricing — only revealed at checkout",
          "FTC Act §5 and EU Omnibus Directive require full price disclosure upfront",
          "ACCC (Australia) and CMA (UK) have fined travel/entertainment sites for drip pricing",
        ],
      }),
    );
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════
// PHASE 2: Visual Asymmetry Detection
// ═══════════════════════════════════════════════════════════
async function runVisualScans(
  page: Page,
  pageUrl: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  // Detect cookie/consent banners and analyze button asymmetry
  const consentAnalysis = await page
    .evaluate(() => {
      const bannerSelectors = [
        '[class*="cookie"], [class*="consent"], [class*=""], [class*="privacy-banner"]',
        '[id*="cookie"], [id*="consent"], [id*=""]',
        '[class*="cc-banner"], [class*="cc-window"]',
        '[role="dialog"][class*="cookie"], [role="dialog"][class*="consent"]',
      ].join(", ");

      const banners = document.querySelectorAll(bannerSelectors);
      const results: Array<{
        bannerHtml: string;
        buttons: Array<{
          text: string;
          width: number;
          height: number;
          bgColor: string;
          color: string;
          opacity: number;
          fontSize: number;
          isAccept: boolean;
        }>;
      }> = [];

      banners.forEach((banner) => {
        const style = window.getComputedStyle(banner);
        if (style.display === "none" || style.visibility === "hidden") return;

        const buttons = banner.querySelectorAll(
          'button, a[role="button"], [class*="btn"]',
        );
        const btnData: Array<{
          text: string;
          width: number;
          height: number;
          bgColor: string;
          color: string;
          opacity: number;
          fontSize: number;
          isAccept: boolean;
        }> = [];

        buttons.forEach((btn) => {
          const rect = btn.getBoundingClientRect();
          const bs = window.getComputedStyle(btn);
          const text = btn.textContent?.trim() || "";
          const isAccept =
            /accept|agree|allow|ok|got\s*it|i\s*agree|yes|enable/i.test(text);
          btnData.push({
            text,
            width: rect.width,
            height: rect.height,
            bgColor: bs.backgroundColor,
            color: bs.color,
            opacity: parseFloat(bs.opacity),
            fontSize: parseFloat(bs.fontSize),
            isAccept,
          });
        });

        if (btnData.length >= 2) {
          results.push({
            bannerHtml: banner.outerHTML.substring(0, 300),
            buttons: btnData,
          });
        }
      });

      return results;
    })
    .catch(() => []);

  for (const banner of consentAnalysis) {
    const acceptBtns = banner.buttons.filter((b) => b.isAccept);
    const rejectBtns = banner.buttons.filter((b) => !b.isAccept);

    if (acceptBtns.length > 0 && rejectBtns.length > 0) {
      const accept = acceptBtns[0];
      const reject = rejectBtns[0];
      const acceptArea = accept.width * accept.height;
      const rejectArea = reject.width * reject.height;

      // DP-IF-01: Size asymmetry
      if (acceptArea > 0 && rejectArea > 0 && acceptArea / rejectArea > 2) {
        findings.push(
          makeFinding("DP-IF-01", pageUrl, banner.bannerHtml, {
            summary: `Accept button is ${(acceptArea / rejectArea).toFixed(1)}× larger than reject`,
            details: [
              `Accept: ${accept.width.toFixed(0)}×${accept.height.toFixed(0)}px ("${accept.text}")`,
              `Reject: ${reject.width.toFixed(0)}×${reject.height.toFixed(0)}px ("${reject.text}")`,
              `Area ratio: ${(acceptArea / rejectArea).toFixed(1)}:1`,
            ],
            measurements: {
              acceptWidth: Math.round(accept.width),
              acceptHeight: Math.round(accept.height),
              rejectWidth: Math.round(reject.width),
              rejectHeight: Math.round(reject.height),
              ratio: parseFloat((acceptArea / rejectArea).toFixed(1)),
            },
          }),
        );
      }

      // DP-IF-02: Color asymmetry (check if reject is transparent/muted)
      const rejectIsMuted =
        reject.opacity < 0.7 ||
        /transparent|rgba\(.*,\s*0[\.\d]*\)/i.test(reject.bgColor) ||
        reject.bgColor === "rgba(0, 0, 0, 0)";
      const acceptIsVibrant =
        !/transparent|rgba\(.*,\s*0[\.\d]*\)/i.test(accept.bgColor) &&
        accept.bgColor !== "rgba(0, 0, 0, 0)";

      if (acceptIsVibrant && rejectIsMuted) {
        findings.push(
          makeFinding("DP-IF-02", pageUrl, banner.bannerHtml, {
            summary:
              "Accept uses vibrant color while reject is transparent/muted",
            details: [
              `Accept bg: ${accept.bgColor} ("${accept.text}")`,
              `Reject bg: ${reject.bgColor} ("${reject.text}")`,
            ],
            measurements: {
              acceptBg: accept.bgColor,
              rejectBg: reject.bgColor,
            },
          }),
        );
      }

      // DP-IF-04: Tiny dismiss/reject button
      if (reject.width < 24 || reject.height < 24) {
        findings.push(
          makeFinding("DP-IF-04", pageUrl, banner.bannerHtml, {
            summary: `Reject/dismiss button is only ${reject.width.toFixed(0)}×${reject.height.toFixed(0)}px — hard to target`,
            details: [
              `Minimum recommended touch target: 44×44px`,
              `Found: ${reject.width.toFixed(0)}×${reject.height.toFixed(0)}px`,
            ],
            measurements: {
              width: Math.round(reject.width),
              height: Math.round(reject.height),
            },
          }),
        );
      }
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════
// PHASE 3: Text/NLP Pattern Detection
// ═══════════════════════════════════════════════════════════
async function runTextPatternScans(
  page: Page,
  pageUrl: string,
  rawHtml?: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  type TextEl = {
    text: string;
    tag: string;
    html: string;
    isButton: boolean;
    isLink: boolean;
  };
  let textElements: TextEl[] = [];

  // Fast path: when raw HTML is available (WAF evasion / setContent mode),
  // parse text directly in Node.js — avoids empty-DOM issues from setContent without CSS.
  if (rawHtml && rawHtml.length > 100) {
    // Cap at 600KB. Body text on heavy pages (PolicyBazaar term-insurance = 479KB) starts well
    // past the 200KB mark, so a 200KB cap misses all visible text and gives < 10 elements.
    // The O(n) bare-text regex below is provably linear — raising the cap is safe.
    const cappedHtml =
      rawHtml.length > 600_000 ? rawHtml.substring(0, 600_000) : rawHtml;

    // ONLY use bare-text extraction — the ONLY provably O(n) approach on arbitrary HTML.
    // DO NOT use [\s\S]*?, [^]*?, or any lazy quantifier across large inputs — exponential backtracking.
    // DO NOT try to strip <script>/<style> blocks before this — those replacements are also O(n²) worst-case.
    // ">([^<]{4,300})<" : [^<] = "not a <", can never backtrack exponentially.
    // Consequence: some JS/CSS text will slip through; dark pattern patterns are specific enough to not match it.
    const bareTextRe = />([^<]{4,300})</g;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = bareTextRe.exec(cappedHtml)) !== null) {
      const text = m[1]
        .replace(/&[a-z#0-9]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 4 || text.length > 400 || seen.has(text)) continue;
      // Skip obvious JS/CSS snippets (contain { } ; = which don't appear in natural language)
      if (
        /[{}=;]/.test(text) &&
        !/crore|lakh|trust|offer|limited|expires|only \d/i.test(text)
      )
        continue;
      seen.add(text);
      // Heuristic: look back up to 80 chars for the enclosing opening tag name
      const before = cappedHtml.substring(
        Math.max(0, m.index - 80),
        m.index + 1,
      );
      const tagHint =
        before
          .match(/<(a|button|h[1-6]|p|li|span|label|div|td)\b/i)?.[1]
          ?.toLowerCase() || "text";
      textElements.push({
        text: text.substring(0, 200),
        tag: tagHint,
        html: `<${tagHint}>${text.substring(0, 200)}</${tagHint}>`,
        isButton: tagHint === "button",
        isLink: tagHint === "a",
      });
    }

    // Also extract attribute values from <a>, <button>, <input> tags — safe with [^"] quantifier
    const attrRe =
      /<(?:a|button|input)\b[^>]*(?:value|placeholder|aria-label|title)="([^"]{4,150})"/gi;
    while ((m = attrRe.exec(cappedHtml)) !== null) {
      const text = m[1].replace(/\s+/g, " ").trim();
      if (!seen.has(text)) {
        seen.add(text);
        textElements.push({
          text: text.substring(0, 200),
          tag: "button",
          html: m[0].substring(0, 200),
          isButton: true,
          isLink: false,
        });
      }
    }
  }

  // Live-page path: only for truly-navigated pages (rawHtml not provided).
  // DO NOT use page.$$eval()  — no built-in timeout, hangs on heavy pages.
  // DO NOT use page.content() after page.setContent() — the browser V8 keeps executing JS and
  //   the CDP DOM.getOuterHTML command can block for minutes on 400KB+ React/Next.js pages.
  //   Our Promise.race timeout fires in Node.js but the dangling CDP request stalls later phases.
  // SAFE path: only call page.content() when rawHtml was NOT provided (live navigation, no setContent).
  if (textElements.length < 10 && !rawHtml) {
    try {
      const liveHtml = await Promise.race([
        page.content(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("content-timeout")), 5000),
        ),
      ]);
      if (liveHtml && liveHtml.length > 100) {
        const cappedLive =
          liveHtml.length > 600_000 ? liveHtml.substring(0, 600_000) : liveHtml;
        const bareTextRe2 = />([^<]{4,300})</g;
        let m2: RegExpExecArray | null;
        const seen2 = new Set<string>();
        const liveElements: TextEl[] = [];
        while ((m2 = bareTextRe2.exec(cappedLive)) !== null) {
          const text = m2[1]
            .replace(/&[a-z#0-9]+;/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (text.length < 4 || text.length > 400 || seen2.has(text)) continue;
          if (
            /[{}=;]/.test(text) &&
            !/crore|lakh|trust|offer|limited|expires|only \d/i.test(text)
          )
            continue;
          seen2.add(text);
          const before2 = cappedLive.substring(
            Math.max(0, m2.index - 80),
            m2.index + 1,
          );
          const tagHint2 =
            before2
              .match(/<(a|button|h[1-6]|p|li|span|label|div|td)\b/i)?.[1]
              ?.toLowerCase() || "text";
          liveElements.push({
            text: text.substring(0, 200),
            tag: tagHint2,
            html: `<${tagHint2}>${text.substring(0, 200)}</${tagHint2}>`,
            isButton: tagHint2 === "button",
            isLink: tagHint2 === "a",
          });
        }
        if (liveElements.length > textElements.length)
          textElements = liveElements;
      }
    } catch {
      // page.content() timed out or failed — proceed with empty textElements
    }
  }

  // DP-SU-02/03: Urgency/scarcity language
  for (const el of textElements) {
    for (const pattern of URGENCY_PATTERNS) {
      if (pattern.test(el.text)) {
        const ruleId = /\d+\s*(left|remaining|available)/i.test(el.text)
          ? "DP-SU-02"
          : "DP-SU-03";
        findings.push(
          makeFinding(ruleId, pageUrl, el.html, {
            summary: `Urgency/scarcity language detected: "${el.text.substring(0, 80)}"`,
            details: [
              `Text: "${el.text}"`,
              `Element: <${el.tag}>`,
              `Pattern matched: ${pattern.source}`,
            ],
          }),
        );
        break; // one match per element
      }
    }
  }

  // DP-SP-01/02: Social pressure
  for (const el of textElements) {
    for (const pattern of SOCIAL_PRESSURE_PATTERNS) {
      if (pattern.test(el.text)) {
        findings.push(
          makeFinding("DP-SP-01", pageUrl, el.html, {
            summary: `Social pressure messaging: "${el.text.substring(0, 80)}"`,
            details: [`Text: "${el.text}"`, `Pattern: ${pattern.source}`],
          }),
        );
        break;
      }
    }
  }

  // DP-CS-05: Family/dependant protection guilt framing (Indian insurance pattern)
  for (const el of textElements) {
    for (const pattern of FAMILY_GUILT_PATTERNS) {
      if (pattern.test(el.text)) {
        findings.push(
          makeFinding("DP-CS-05", pageUrl, el.html, {
            summary: `Family protection guilt framing: "${el.text.substring(0, 100)}"`,
            details: [
              `Text: "${el.text}"`,
              "Uses family safety as emotional lever to shame users who decline",
              "India CPA Dark Pattern Guidelines 2023 (Confirmshaming): prohibited notified dark pattern",
              "ASCI Guidelines: advertising must not exploit guilt or fear to deny rational choice",
            ],
          }),
        );
        break;
      }
    }
  }

  // DP-CS-01: Confirmshaming in button/link text (Western-style guilt language)
  for (const el of textElements) {
    // DP-CS-01: Classic Western confirmshaming — buttons/links only
    if (el.isButton || el.isLink) {
      for (const pattern of CONFIRMSHAMING_PATTERNS) {
        if (pattern.test(el.text)) {
          findings.push(
            makeFinding("DP-CS-01", pageUrl, el.html, {
              summary: `Confirmshaming language on ${el.isButton ? "button" : "link"}: "${el.text}"`,
              details: [
                `Text: "${el.text}"`,
                `This language shames users who choose to decline`,
              ],
            }),
          );
          break;
        }
      }
    }
  }

  // DP-CS-03: Fear-based language
  for (const el of textElements) {
    for (const pattern of FEAR_LANGUAGE_PATTERNS) {
      if (pattern.test(el.text)) {
        findings.push(
          makeFinding("DP-CS-03", pageUrl, el.html, {
            summary: `Fear-based language: "${el.text.substring(0, 80)}"`,
            details: [`Text: "${el.text}"`, `Pattern: ${pattern.source}`],
          }),
        );
        break;
      }
    }
  }

  // DP-MD-04: Trick questions (confusing checkbox wording)
  for (const el of textElements) {
    if (el.text.length > 10) {
      for (const pattern of TRICK_QUESTION_PATTERNS) {
        if (pattern.test(el.text)) {
          findings.push(
            makeFinding("DP-MD-04", pageUrl, el.html, {
              summary: `Confusing wording: "${el.text.substring(0, 80)}"`,
              details: [
                `Text: "${el.text}"`,
                `Double-negative or trick wording`,
              ],
            }),
          );
          break;
        }
      }
    }
  }

  // DP-PM-01: Annual billing obfuscation — NLP scan for text-based signals
  for (const el of textElements) {
    for (const pattern of ANNUAL_BILLING_PATTERNS) {
      if (pattern.test(el.text)) {
        findings.push(
          makeFinding("DP-PM-01", pageUrl, el.html, {
            summary: `Annual billing obfuscation: "${el.text.substring(0, 80)}"`,
            details: [
              `Text: "${el.text}"`,
              "Monthly price shown for annually-billed plan — true annual cost not prominently disclosed",
              "Violates FTC Act §5 — total charge must be clear before purchase",
            ],
          }),
        );
        break;
      }
    }
  }

  // DP-PM-02: Plan anchoring — NLP scan for "most popular / best value" copy
  for (const el of textElements) {
    for (const pattern of PLAN_ANCHORING_PATTERNS) {
      if (pattern.test(el.text)) {
        findings.push(
          makeFinding("DP-PM-02", pageUrl, el.html, {
            summary: `Plan anchoring copy: "${el.text.substring(0, 80)}"`,
            details: [
              `Text: "${el.text}"`,
              'Exploits decoy effect — "Most Popular" badge steers users toward premium options',
              "EU DSA Art. 25(1)(a) prohibits biasing user choice through interface design",
            ],
          }),
        );
        break;
      }
    }
  }

  // DP-PM-05: Subscription cancellation friction — NLP scan for phone/email cancel
  for (const el of textElements) {
    for (const pattern of SUBSCRIPTION_TRAP_PATTERNS) {
      if (pattern.test(el.text)) {
        findings.push(
          makeFinding("DP-PM-05", pageUrl, el.html, {
            summary: `Subscription trap language: "${el.text.substring(0, 80)}"`,
            details: [
              `Text: "${el.text}"`,
              "Cancellation friction or phone-only cancel detected in text",
              "FTC Click-to-Cancel Rule 2024 requires online cancel for online signups",
            ],
          }),
        );
        break;
      }
    }
  }

  // DP-CC-05: Cookie consent by scrolling/browsing — NLP scan
  for (const el of textElements) {
    for (const pattern of COOKIE_CONSENT_PATTERNS) {
      if (pattern.test(el.text)) {
        findings.push(
          makeFinding("DP-CC-05", pageUrl, el.html, {
            summary: `Implied consent via browsing: "${el.text.substring(0, 80)}"`,
            details: [
              `Text: "${el.text}"`,
              "Implies consent through continued browsing —  requires explicit opt-in",
              "CJEU Planet49 (Case C-673/17): scrolling/browsing does NOT constitute valid consent",
            ],
          }),
        );
        break;
      }
    }
  }

  // DP-MD-09: Asterisk/hash-qualified promotional claims (India-specific: "Upto X%*", "@₹X/day#")
  const seenAsteriskTexts = new Set<string>();
  for (const el of textElements) {
    if (seenAsteriskTexts.has(el.text)) continue;
    for (const pattern of ASTERISK_PROMO_PATTERNS) {
      if (pattern.test(el.text)) {
        seenAsteriskTexts.add(el.text);
        findings.push(
          makeFinding("DP-MD-09", pageUrl, el.html, {
            summary: `Asterisk-qualified promotional claim: "${el.text.substring(0, 100)}"`,
            details: [
              `Text: "${el.text}"`,
              "Headline discount/price is qualified by an asterisk or hash marker — conditions buried in fine print",
              "India CPA Dark Pattern Guidelines 2023: bait advertising / misleading claims",
              "ASCI Guidelines: unqualified superlatives and claims without substantiation are prohibited",
            ],
            measurements: { matchedPattern: pattern.source },
          }),
        );
        break;
      }
    }
  }

  // DP-SP-05: Crore/lakh-scale unverifiable trust claims (India-specific: "2 crore Indians trust us")
  const seenCroreTexts = new Set<string>();
  for (const el of textElements) {
    if (seenCroreTexts.has(el.text)) continue;
    for (const pattern of CRORE_TRUST_PATTERNS) {
      if (pattern.test(el.text)) {
        seenCroreTexts.add(el.text);
        findings.push(
          makeFinding("DP-SP-05", pageUrl, el.html, {
            summary: `Unverifiable crore-scale trust claim: "${el.text.substring(0, 100)}"`,
            details: [
              `Text: "${el.text}"`,
              "Scale figure (crore/lakh customers) displayed without verifiable source, audit date, or methodology",
              "ASCI Guidelines 2023: testimonials/statistics must be capable of substantiation",
              "IN-CPA Dark Pattern Guidelines 2023: social proof used to manufacture artificial authority",
            ],
            measurements: { matchedPattern: pattern.source },
          }),
        );
        break;
      }
    }
  }

  return findings;
}
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// AUDIENCE FIX MAP — per rule: CCPA taxonomy, DSA article,
// developer code fix, designer fix, effort estimate.
// Drives the Developer / Designer / Legal audience-toggle views.
// ═══════════════════════════════════════════════════════════
interface AudienceFixEntry {
  brignullPattern: string;
  brignullNumber: number;
  dsaArticle: string;
  developerFix: string;
  designerFix: string;
  legalSummary: string;
  estimatedEffort: "XS" | "S" | "M" | "L";
}
const RULE_AUDIENCE_MAP: Record<string, AudienceFixEntry> = {
  // ── Trick Questions / Sneaking (CCPA #1) ──
  "DP-SN-01": {
    brignullPattern: "Trick Questions",
    brignullNumber: 1,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      'Remove the checked attribute: <input type="checkbox"> (no checked). Under  Art. 7, opt-in must be a distinct affirmative action — not default state.',
    designerFix:
      'Default all consent toggles to OFF. Use neutral label copy ("I agree to marketing emails") with no visual bias toward acceptance.',
    legalSummary:
      "Pre-ticked opt-in violates  Art. 7(4) — consent must be freely given via unambiguous affirmative action. EU DSA Art. 25(1)(b) prohibits using default settings to bias choices.",
    estimatedEffort: "XS",
  },
  "DP-SN-02": {
    brignullPattern: "Sneak into Basket",
    brignullNumber: 2,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      'Change default radio/select to a neutral "None" or "No add-on" option. Never preselect a paid or data-sharing option.',
    designerFix:
      "Add-on options should default to unselected. Show add-ons in a clearly labelled optional section separate from the main flow.",
    legalSummary:
      "Pre-selected commercial add-ons constitute Sneak into Basket (CCPA). EU DSA Art. 25(1)(b) prohibits pre-ticked boxes for optional paid extras. FTC Act §5 unfair practice.",
    estimatedEffort: "XS",
  },
  "DP-SN-04": {
    brignullPattern: "Trick Questions",
    brignullNumber: 1,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      "Remove hidden inputs that carry default consent/opt-in values. Any consent submission must come from explicit user UI interaction.",
    designerFix:
      "Never use hidden fields to transmit consent decisions. All consent choices must be surfaced visibly to the user.",
    legalSummary:
      "Hidden form inputs carrying default consent values violate  Art. 7 — consent requires a clear affirmative act. ICO guidance explicitly prohibits this pattern.",
    estimatedEffort: "XS",
  },
  "DP-SN-08": {
    brignullPattern: "",
    brignullNumber: 6,
    dsaArticle: "Art. 25(2)(b)",
    developerFix:
      "Split bundled consent into separate checkboxes per purpose.  requires granular consent: analytics, marketing, and third-party sharing must each have their own control.",
    designerFix:
      "Design a consent matrix or accordion: one row per purpose. Each purpose must be independently toggleable with clear on/off state.",
    legalSummary:
      "Bundled consent violates  Art. 7(2) and Recital 43 — consent must be given separately for each purpose. CNIL and ICO enforcement has fined companies for this pattern.",
    estimatedEffort: "S",
  },
  "DP-SN-09": {
    brignullPattern: "Forced Continuity",
    brignullNumber: 10,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      "Add a pre-expiry email reminder with one-click cancel link. Display cancel deadline prominently at signup. Implement FTC Click-to-Cancel (16 CFR Part 425).",
    designerFix:
      "Show trial end date in dashboard permanently. Place cancel CTA in the primary navigation, not buried in settings.",
    legalSummary:
      "Auto-converting free trials without clear cancel instructions violate FTC Click-to-Cancel Rule 2024 and EU Consumer Rights Directive Art. 6. Potential for large-scale enforcement.",
    estimatedEffort: "M",
  },
  // ── Roach Motel / Obstruction (CCPA #3) ──
  "DP-OB-01": {
    brignullPattern: "Roach Motel",
    brignullNumber: 3,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      "Add a visible unsubscribe/cancel link to the footer and account settings. Ensure cancel flow ≤ same steps as subscribe.",
    designerFix:
      'Subscribe and cancel CTAs must be symmetric in placement and prominence. If "Subscribe" is in the hero, "Cancel" must be in settings with equivalent findability.',
    legalSummary:
      "Asymmetric subscribe/cancel paths constitute a Roach Motel (CCPA #3). EU DSA Art. 25(1)(c) prohibits making termination harder than subscription. FTC Click-to-Cancel Rule applies.",
    estimatedEffort: "M",
  },
  "DP-OB-04": {
    brignullPattern: "Roach Motel",
    brignullNumber: 3,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      "Remove multi-step confirmation dialogs on the cancel path. Cancel should complete in ≤ 2 steps from settings page.",
    designerFix:
      "Cancel flow should mirror the subscribe flow in step count. No retention offers should block or delay cancellation.",
    legalSummary:
      "Confirmation dialogs added exclusively to the cancel path are a Roach Motel pattern. EU DSA Art. 25(1)(c) and FTC Click-to-Cancel Rule 2024 require easy cancellation.",
    estimatedEffort: "S",
  },
  "DP-OB-06": {
    brignullPattern: "Roach Motel",
    brignullNumber: 3,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      "Implement an online cancellation endpoint. If signup is online, FTC 2024 mandates that cancellation is also possible online without calling or emailing.",
    designerFix:
      "Add a self-serve cancellation page accessible from account settings. Phone-only cancellation is a deliberate friction pattern.",
    legalSummary:
      "Phone/email-only cancellation violates FTC Click-to-Cancel Rule 2024 (16 CFR Part 425) — if signup was online, cancellation must also be online. CCPA and DSA Art. 25(1)(c) apply.",
    estimatedEffort: "M",
  },
  "DP-OB-07": {
    brignullPattern: "Obstruction",
    brignullNumber: 3,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      'Add a "Download my data" endpoint ( Art. 20 data portability). Expose via /account/settings/data-export with standard JSON/CSV format.',
    designerFix:
      'Add "Download my data" to the account settings page. Link to it from the privacy policy.',
    legalSummary:
      "Missing data portability violates  Art. 20 (EU) and India DPDPA 2023 §13 — users have the right to receive their personal data in machine-readable format.",
    estimatedEffort: "M",
  },
  // ── Nagging (CCPA #9) ──
  "DP-NG-01": {
    brignullPattern: "Nagging",
    brignullNumber: 9,
    dsaArticle: "Art. 25(1)(d)",
    developerFix:
      "Implement modal stacking prevention: use a global modal manager that allows only one modal to be active at a time.",
    designerFix:
      "One modal rule — never render multiple dialogs simultaneously. Queue dismissals and apply session memory to prevent re-showing dismissed modals.",
    legalSummary:
      "Overlapping modals constitute Nagging (CCPA #9). EU DSA Art. 25(1)(d) prohibits repeatedly requesting decisions. ICO guidance requires a single consent request per session.",
    estimatedEffort: "S",
  },
  "DP-NG-02": {
    brignullPattern: "Nagging",
    brignullNumber: 9,
    dsaArticle: "Art. 25(1)(d)",
    developerFix:
      "Gate notification prompts behind genuine user engagement (e.g., after 3+ purchases or explicit user request). Respect browser-level permission model.",
    designerFix:
      "Show notification opt-in as a non-blocking inline prompt after meaningful user engagement. Never show on page load.",
    legalSummary:
      'Aggressive push-permission prompts on page load violate the spirit of  Art. 5(1)(c) and the ICO\'s "privacy by design" principle. Pattern is explicitly named in DSA guidance.',
    estimatedEffort: "XS",
  },
  "DP-NG-04": {
    brignullPattern: "Nagging",
    brignullNumber: 9,
    dsaArticle: "Art. 25(1)(d)",
    developerFix:
      "Remove exit-intent listeners (mouseleave, beforeunload). If retention is needed, implement a value proposition page instead of an interrupt popup.",
    designerFix:
      "Replace exit-intent popups with a persistent value banner or homepage messaging. Do not intercept users who have decided to leave.",
    legalSummary:
      "Exit-intent popups intercept user autonomy at the point of decision. EU DSA Art. 25(1)(d) prohibits repeatedly disrupting user decision-making. FTC has cited exit-intent patterns in enforcement actions.",
    estimatedEffort: "XS",
  },
  // ── Forced Action (CCPA #5) ──
  "DP-FA-01": {
    brignullPattern: "Forced Action",
    brignullNumber: 5,
    dsaArticle: "Art. 25(3)(d)",
    developerFix:
      "Remove auth guards from public content endpoints. Implement progressive engagement — show teaser content, prompt login only for premium features.",
    designerFix:
      "Apply progressive disclosure: show value first, gate registration to deeper actions only. Use a soft CTA overlay rather than a blocking modal.",
    legalSummary:
      "Forced registration walls violate DSA Art. 25(3)(d) — users must not be required to create accounts to access publicly available services.  Art. 7(4) prohibits conditioning service access on consent.",
    estimatedEffort: "L",
  },
  "DP-FA-03": {
    brignullPattern: "Forced Action",
    brignullNumber: 5,
    dsaArticle: "Art. 25(3)(d)",
    developerFix:
      "Remove full-viewport app install banners. Use a native Smart App Banner (meta tag) instead — max 64px, dismissible, non-blocking.",
    designerFix:
      "Reduce app install prompt to a slim, dismissible top bar (≤48px). Never block page content. Apply only after user has spent >30 seconds on page.",
    legalSummary:
      "Full-viewport app install prompts that block content access are Forced Action patterns (CCPA #5). FTC §5 deceptive framing applies when content is withheld without genuine need.",
    estimatedEffort: "XS",
  },
  "DP-FA-05": {
    brignullPattern: "Forced Action",
    brignullNumber: 5,
    dsaArticle: "Art. 25(3)(d)",
    developerFix:
      "Remove the DOM backdrop/overlay on the consent banner. Users must be able to scroll and interact with the page without accepting cookies.",
    designerFix:
      "Use a non-blocking bottom banner for cookie consent. Never overlay page content. Accept and Reject must be equally prominent.",
    legalSummary:
      'Cookie walls that block content unless users accept are illegal under  Art. 7(4) — "take it or leave it" consent is not freely given. CNIL issued €60M fines for this exact pattern.',
    estimatedEffort: "S",
  },
  "DP-FA-06": {
    brignullPattern: "Forced Action",
    brignullNumber: 5,
    dsaArticle: "Art. 25(3)(d)",
    developerFix:
      "Add an email/password registration alternative alongside social login buttons. Social login must never be the only option.",
    designerFix:
      'Display email registration at same hierarchy level as social login. "Continue with email" should not be hidden below social buttons.',
    legalSummary:
      "Forced social login violates  Art. 7 — consent to third-party data sharing cannot be a condition of service access. EDPB guidance requires an alternative.",
    estimatedEffort: "S",
  },
  // ── Interface Interference (CCPA #12) ──
  "DP-IF-01": {
    brignullPattern: "Interface Interference",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      "Apply equal CSS classes to accept and reject buttons: same min-width, padding, border-radius. Example: `.consent-btn { min-width: 120px; padding: 10px 20px; font-size: 14px; }`",
    designerFix:
      "Consent button pair must share identical dimensions and visual weight. Use the same component instance — differentiate only by color (brand primary vs outlined).",
    legalSummary:
      "Accept:Reject size asymmetry >2:1 constitutes Interface Interference under DSA Art. 25(1)(a). ICO enforces this under UK . CNIL specifically measures button size ratios in audits.",
    estimatedEffort: "XS",
  },
  "DP-IF-02": {
    brignullPattern: "Interface Interference",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      "Remove transparent/muted styling from reject button. Reject must meet WCAG 1.4.3 AA contrast ratio (4.5:1). Add visible border if using ghost button style.",
    designerFix:
      "Both consent buttons must be equally visible. If accept uses a filled primary color, reject must use an outlined variant with matching contrast, not a muted/faded appearance.",
    legalSummary:
      'Color-based button asymmetry (accept prominent, reject muted) violates DSA Art. 25(1)(a) and WCAG 1.4.3. ICO guidance names "colour contrast manipulation" as an enforcement target.',
    estimatedEffort: "XS",
  },
  "DP-IF-04": {
    brignullPattern: "Interface Interference",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      "Set dismiss/reject button min touch target to 44×44px per WCAG 2.5.8. Add padding if needed: `.consent-reject { min-width: 44px; min-height: 44px; padding: 10px 16px; }`",
    designerFix:
      "All interactive consent controls must be ≥44×44px touch target. Tiny close/X buttons on consent banners fail WCAG 2.5.8 and are a deliberate friction pattern.",
    legalSummary:
      "Sub-44px dismiss targets violate WCAG 2.5.8 Success Criterion and EU DSA Art. 25(1)(a). This is a deliberate accessibility/dark pattern combination that regulators actively target.",
    estimatedEffort: "XS",
  },
  // ── Scarcity / Urgency (CCPA #11) ──
  "DP-SU-01": {
    brignullPattern: "False Urgency",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      "Bind countdown to a server-verified deadline from your API (e.g., deal_expires_at). Add validation: if(expired) remove timer element entirely. Never reset via setInterval.",
    designerFix:
      'Display countdown only when a real deadline exists. Show the specific date/time (e.g., "Ends 15 Jun 11:59 PM") not just a timer that could be fabricated.',
    legalSummary:
      'Countdown timers without verifiable deadlines violate DSA Art. 25(1)(e) and FTC Act §5. The FTC\'s "Click-to-Cancel" rule and dark patterns report explicitly target false urgency timers.',
    estimatedEffort: "S",
  },
  "DP-SU-02": {
    brignullPattern: "False Urgency",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      "Bind stock counts to live inventory API. If count cannot be verified in real-time, remove the element. Add audit trail: log stock display vs actual inventory.",
    designerFix:
      'Only show "X left in stock" when sourced from live inventory. Show the actual number with a verified timestamp.',
    legalSummary:
      'Unverifiable stock scarcity claims violate FTC Act §5 (deceptive practices) and UK CPR 2008. Several major retailers have been fined for fabricated "only X left" counters.',
    estimatedEffort: "S",
  },
  "DP-SU-03": {
    brignullPattern: "False Urgency",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      'Remove or verify all urgency language before production. If sale is permanent or regularly renewed, the "limited time" claim is deceptive under FTC guidelines.',
    designerFix:
      'Replace unverifiable urgency language with factual value propositions. "Our best price" is legal; "Deal ends in 2 hours" requires a real deadline.',
    legalSummary:
      'Generic urgency language ("limited time", "hurry") without verified deadlines violates FTC Act §5 and DSA Art. 25(1)(e). The FTC\'s 2022 dark patterns report lists this as a top enforcement priority.',
    estimatedEffort: "XS",
  },
  "DP-SU-05": {
    brignullPattern: "False Urgency",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      'Add an expires_at timestamp to flash sale data. Display specific end time. If no verified end time exists, do not show "flash sale" messaging.',
    designerFix:
      'Flash sale banners must show a precise, verified expiry date/time. Never use vague "ends soon" language. Tie expiry display to real backend data.',
    legalSummary:
      "Flash sales with unverifiable end times violate FTC Act §5. The FTC has issued warning letters to e-commerce retailers for fabricated flash sale timers.",
    estimatedEffort: "S",
  },
  "DP-SU-06": {
    brignullPattern: "Social Proof Inflation",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      "Bind viewer counter to a verified analytics source (e.g., Google Analytics real-time API). Add last_updated timestamp to the element. If unbindable, remove the element.",
    designerFix:
      'Show live counter only if connected to real-time verified data. Add a "verified" indicator. Never show rounded numbers like "100 people viewing".',
    legalSummary:
      "Fabricated real-time viewer counts violate FTC Act §5 (deceptive practices). The 2022 FTC dark patterns study specifically names fake social-proof counters as an enforcement priority.",
    estimatedEffort: "M",
  },
  // ── Social Pressure (CCPA #7) ──
  "DP-SP-01": {
    brignullPattern: "Social Proof",
    brignullNumber: 7,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      'Connect to a verified real-time data source for social proof metrics. Add data-verified="true" attribute and timestamp. If verification is impossible, remove the element.',
    designerFix:
      'Show source and timestamp for all social proof claims. "47 people bought this today (via verified analytics)" is acceptable; fabricated counters are not.',
    legalSummary:
      'Unverifiable social proof ("X people bought this") constitutes a deceptive practice under FTC Act §5 and DSA Art. 25(1)(e). Multiple retailers have received FTC warning letters.',
    estimatedEffort: "M",
  },
  "DP-SP-03": {
    brignullPattern: "Authority Bias",
    brignullNumber: 7,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      'Add a source reference link next to every badge: <a href="/award-source">Award source ↗</a>. Remove badges with no verifiable source.',
    designerFix:
      'Every trust badge must link to its source. Use a small "i" info icon with source tooltip. "Best Seller" claims must reference an auditable basis.',
    legalSummary:
      'Unverified "Best Seller" and "Award-Winning" badges constitute deceptive endorsements under FTC 16 CFR Part 255 (Endorsement Guides). The FTC requires disclosure of basis for all superlative claims.',
    estimatedEffort: "XS",
  },
  // ── Privacy Zuckering (CCPA #6) ──
  "DP-PZ-01": {
    brignullPattern: "",
    brignullNumber: 6,
    dsaArticle: "Art. 25(2)(b)",
    developerFix:
      "Audit each form field against its stated purpose. Remove fields not essential to core function. Apply  data minimisation (Art. 5(1)(c)): only collect what you use.",
    designerFix:
      "Reduce form to minimum viable fields for the stated purpose. Each removed field reduces abandonment and  liability. Group optional fields in a collapsible section.",
    legalSummary:
      "Excessive data collection violates Art. 5(1)(c) data minimisation principle and India DPDPA 2023 §6. The ICO regularly fines organisations for collecting phone numbers without legitimate need.",
    estimatedEffort: "M",
  },
  "DP-PZ-03": {
    brignullPattern: "",
    brignullNumber: 6,
    dsaArticle: "Art. 25(2)(b)",
    developerFix:
      "Change all data-sharing toggles to default OFF. Pre-enabled sharing toggles require explicit opt-in under  Art. 7. Review backend to ensure no data is shared before toggle is turned on.",
    designerFix:
      "Data sharing toggles must default to OFF. Show them in a dedicated Settings section with clear labels. Never bury them in a dense settings page.",
    legalSummary:
      "Pre-enabled data sharing toggles violate Art. 7 — consent must be an active, unambiguous affirmative act. CNIL (France) has issued multi-million euro fines for pre-checked data sharing.",
    estimatedEffort: "XS",
  },
  // ── Confirmshaming (CCPA #8) ──
  "DP-CS-01": {
    brignullPattern: "Confirmshaming",
    brignullNumber: 8,
    dsaArticle: "Art. 25(1)(f)",
    developerFix:
      'Replace shame-inducing decline copy with neutral text. Accepted formula: "Yes, subscribe me" / "No, thanks". Any text that makes declining feel morally wrong must be removed.',
    designerFix:
      "Decline copy must be factually neutral — never emotionally manipulative. Use a symmetry test: if the decline option feels shaming or self-deprecating, rewrite it.",
    legalSummary:
      "Confirmshaming (guilt-inducing decline options) violates DSA Art. 25(1)(f) and user autonomy principles. The UK ICO has cited confirmshaming in its dark patterns guidance as a deceptive design pattern.",
    estimatedEffort: "XS",
  },
  // ── Misdirection (CCPA #11) ──
  "DP-MD-08": {
    brignullPattern: "Misdirection",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      "Remove inflated reference prices unless the item was genuinely sold at that price within the past 30 days. Comply with the UK CPR 2008 and EU Omnibus Directive Art. 6a.",
    designerFix:
      'Show strikethrough prices only with a "was" label and previous price period. Never fabricate reference prices for visual urgency effect.',
    legalSummary:
      "Fabricated reference/strikethrough pricing violates the EU Omnibus Directive (2022), UK CPR 2008 Reg. 5, and FTC Act §5. Major retailers have been fined by national consumer protection authorities for fake reference prices.",
    estimatedEffort: "S",
  },
  // ── Disguised Ads ──
  "DP-DA-01": {
    brignullPattern: "Disguised Ads",
    brignullNumber: 4,
    dsaArticle: "Art. 26(2)",
    developerFix:
      'Add a visible "Sponsored" or "Ad" label to every paid placement element. Use aria-label="Sponsored content" for accessibility. Never use vague "promoted" wording without an "Ad" indicator.',
    designerFix:
      'Sponsored content must be visually distinct from editorial content — different background color, clear "Sponsored" label in consistent position.',
    legalSummary:
      "Disguised advertising violates DSA Art. 26(2) — all commercial content must be clearly identified as advertising. FTC Endorsement Guides require clear and conspicuous disclosure.",
    estimatedEffort: "XS",
  },
  // ── Hidden Costs ──
  "DP-HC-01": {
    brignullPattern: "Hidden Costs",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(g)",
    developerFix:
      "Display total price including all mandatory fees at first price display. Use price breakdown component: base + fees + tax = total. Never reveal the full price only at checkout.",
    designerFix:
      'Show the complete price on the product/service page — not just the base. Use a price breakdown tooltip if needed. "From £X" without fee disclosure is deceptive.',
    legalSummary:
      "Drip pricing (hidden fees revealed at checkout) violates EU Omnibus Directive Art. 6(1)(e), FTC Act §5, and UK CPR 2008. Several airlines and hotels have received enforcement action specifically for drip pricing.",
    estimatedEffort: "M",
  },
  // ── Bait & Switch ──
  "DP-BS-01": {
    brignullPattern: "Bait and Switch",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      'Fix misleading link destinations: if link text says "dismiss", destination must be a local dismiss action, not an external navigation. Audit all CTA links for text-destination alignment.',
    designerFix:
      "Every link/button must do exactly what its label says. Dismissal CTAs must dismiss — not navigate, subscribe, or redirect.",
    legalSummary:
      "Links that appear to dismiss but navigate externally constitute Bait and Switch (CCPA). FTC Act §5 deceptive practice. EU DSA Art. 25(1)(a) — interface manipulation of user choices.",
    estimatedEffort: "XS",
  },
  // ── Friend Spam ──
  "DP-FS-01": {
    brignullPattern: "Friend Spam",
    brignullNumber: 12,
    dsaArticle: "Art. 25(3)(d)",
    developerFix:
      "Implement granular permission for contact access. Show exactly which contacts will be contacted and what message they will receive before any action. Require explicit per-contact selection.",
    designerFix:
      "Contact harvesting flows must show a detailed preview: who will receive what message, with ability to deselect individual contacts. Never bulk-import and message without preview.",
    legalSummary:
      "Contact harvesting without granular consent violates Art. 6 and many national spam regulations. Multiple social networks have been fined hundreds of millions for Friend Spam patterns.",
    estimatedEffort: "L",
  },

  // ── Cookie Consent Manipulation (DP-CC) ──
  "DP-CC-01": {
    brignullPattern: "Interface Interference",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      'Add a "Reject All" button to the initial consent banner at the same hierarchy level as "Accept All". For OneTrust: ensure #onetrust-reject-all-handler is visible on the first screen without requiring the user to click "Manage Preferences".',
    designerFix:
      "Place Reject All and Accept All buttons side-by-side on the first screen with identical styling. Neither option should require extra steps. The banner layout must present both choices equally.",
    legalSummary:
      "EDPB Guidelines 3/2022 §2.1.3: refusing consent must be as easy as giving it. CJEU Planet49 (C-673/17) prohibits requiring more steps to refuse than to accept. ICO, CNIL, and DPC have fined companies for this pattern.",
    estimatedEffort: "S",
  },
  "DP-CC-02": {
    brignullPattern: "Trick Questions",
    brignullNumber: 1,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      "Set all non-essential cookie category toggles to OFF/unchecked by default in your CMP configuration. Marketing, analytics, and advertising categories must start disabled. Users must actively toggle them ON to consent.",
    designerFix:
      "Non-essential cookie toggles must be OFF by default. Use a clear visual OFF state (e.g., grey toggle) and require user to slide ON to consent. Never pre-populate with ON state.",
    legalSummary:
      "7 + Recital 32 prohibit pre-ticked consent. CNIL fined Google €150M and Meta €60M partly for this pattern. Consent must be freely given via unambiguous affirmative action — not opt-out.",
    estimatedEffort: "XS",
  },
  "DP-CC-03": {
    brignullPattern: "Roach Motel",
    brignullNumber: 3,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      'Add a top-level "Reject All" button to the primary banner that completes rejection in one click — no Manage Preferences required. Implement parity: Accept All = 1 click, Reject All = 1 click.',
    designerFix:
      'Consent banner must offer symmetrical one-click options: [Reject All] [Accept All]. Any "Manage Preferences" option is additional and must not be the only path to rejection.',
    legalSummary:
      "EDPB Guidelines 3/2022 explicitly require that refusing consent is as easy as giving it. Multi-step rejection vs single-step acceptance is a documented dark pattern enforced by CNIL (Cookie Banner cases, 2022).",
    estimatedEffort: "S",
  },
  "DP-CC-04": {
    brignullPattern: "Trick Questions",
    brignullNumber: 1,
    dsaArticle: "Art. 25(2)(b)",
    developerFix:
      'Remove all advertising/targeting vendors from the "Legitimate Interest" section of your CMP. LI cannot serve as legal basis for marketing. These must move to the explicit consent section and be OFF by default.',
    designerFix:
      'The "Legitimate Interest" section should only contain genuinely necessary processing (security, fraud prevention). Advertising and analytics must be in the explicit consent section with pre-disabled toggles.',
    legalSummary:
      " 6(1)(f) requires a balancing test — advertising rarely satisfies this. EDPB Opinion 08/2023 and Belgian APD IAB TCF enforcement (2022) established that LI cannot be used for advertising tracking.",
    estimatedEffort: "M",
  },
  "DP-CC-05": {
    brignullPattern: "Trick Questions",
    brignullNumber: 1,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      "Remove any text or script that implies consent through browsing/scrolling. Require an explicit button click on the consent banner. Never auto-close or auto-accept on scroll, timer, or page interaction.",
    designerFix:
      "Consent banners must persist until the user actively accepts or rejects. Do not auto-dismiss. Remove all copy that implies scrolling = consent. Add clear explicit [Accept] / [Reject] options.",
    legalSummary:
      'Recital 32 explicitly: "silence, pre-ticked boxes, or inactivity should not constitute consent." CJEU Planet49 (C-673/17): browsing or scrolling is NOT valid consent.',
    estimatedEffort: "XS",
  },
  "DP-CC-06": {
    brignullPattern: "Interface Interference",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      "Reorder DOM elements so Reject appears before or at the same position as Accept. In HTML: <button>Reject All</button> <button>Accept All</button>. Tab index should reach rejection option first or simultaneously.",
    designerFix:
      "Place Reject All and Accept All in neutral left-right order or alphabetical. For screen reader and keyboard users, the rejection option should be encountered no later than the acceptance option.",
    legalSummary:
      "DOM order bias creates accessibility-based dark pattern — screen reader users default to the first option encountered. ICO guidance and EDPB recommend neutral ordering for consent options.",
    estimatedEffort: "XS",
  },

  // ── Pricing Manipulation (DP-PM) ──
  "DP-PM-01": {
    brignullPattern: "Hidden Costs",
    brignullNumber: 4,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      'Display the full annual billing amount prominently alongside the monthly equivalent. Example: "£4/month — billed as £48/year". The annual charge must appear in the same font size as the monthly figure, not in grey fine print.',
    designerFix:
      "Pricing cards must show the actual billing amount and frequency prominently. Monthly equivalent is informational only — the true charge (annual) must be the primary displayed price.",
    legalSummary:
      "FTC Act §5 requires clear disclosure of total price including billing period. EU Consumer Rights Directive Art. 6(1)(e): total price including all charges must be disclosed before purchase. UK CPR 2008 Reg. 5 — misleading pricing.",
    estimatedEffort: "S",
  },
  "DP-PM-02": {
    brignullPattern: "Misdirection",
    brignullNumber: 5,
    dsaArticle: "Art. 25(1)(a)",
    developerFix:
      'Remove "Most Popular" or "Best Value" badges from pricing plans, or apply them based on genuine data. If used, all plans should have an equal badge or none. Avoid disproportionate visual size or highlight on the most expensive plan.',
    designerFix:
      'Apply equal visual weight to all pricing tiers. No plan should be visually "featured" without corresponding user-proven value. If a plan is genuinely most popular, provide a data citation.',
    legalSummary:
      'EU DSA Art. 25(1)(a) prohibits interface manipulation that biases user choices. "Most Popular" badges without verification exploit the decoy effect. FTC Act §5 — deceptive labeling without factual basis.',
    estimatedEffort: "S",
  },
  "DP-PM-03": {
    brignullPattern: "Forced Continuity",
    brignullNumber: 10,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      "On free trial signup pages: show a prominent notice of trial end date, conversion price, and one-click cancel link. Send a pre-expiry email reminder. Implement FTC Click-to-Cancel compliant cancellation (16 CFR Part 425).",
    designerFix:
      'Design a "trial terms" callout box above the credit card form stating: trial duration, what you will be charged, when, and a cancel link. This must be the most visible element on the signup screen.',
    legalSummary:
      "FTC Click-to-Cancel Rule 2024 (16 CFR Part 425): trial terms must be clearly disclosed at signup. EU Consumer Rights Directive Art. 6(1)(h): total price and billing period are mandatory pre-contract disclosures. India CPA 2019 §17.",
    estimatedEffort: "S",
  },
  "DP-PM-04": {
    brignullPattern: "Hidden Costs",
    brignullNumber: 4,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      "Show the full total price including all mandatory fees at the product listing stage. If fees vary, show a worst-case estimate with breakdown. Never add new mandatory fees at checkout that were not disclosed earlier.",
    designerFix:
      'Price displayed on product/listing pages must match checkout total (or show a clearly visible "+ fees" estimate). If there are mandatory service/booking fees, show them in the initial price display.',
    legalSummary:
      "FTC Act §5 deceptive drip pricing. EU Omnibus Directive (2021) Art. 6(1)(e): final price including all compulsory taxes and charges must be disclosed upfront. ACCC (Australia) has fined airlines for drip pricing.",
    estimatedEffort: "M",
  },
  "DP-PM-05": {
    brignullPattern: "Roach Motel",
    brignullNumber: 3,
    dsaArticle: "Art. 25(1)(c)",
    developerFix:
      "Implement a self-serve cancellation flow at /account/settings/cancel or equivalent. If signup is online, FTC 2024 mandates online cancellation in ≤ same steps as signup. Remove phone/email-only cancellation for digitally-signed users.",
    designerFix:
      'Add "Cancel Membership" or "Cancel Subscription" as a visible, first-level option in account settings. It must not be buried under help/support. The cancel flow should take no more than 2 screens.',
    legalSummary:
      "FTC Click-to-Cancel Rule 2024 (16 CFR Part 425): if signup was online, cancellation must be online with the same ease. EU Consumer Rights Directive Art. 9: right to cancel must be exercised without undue difficulty.",
    estimatedEffort: "M",
  },

  // ── India-Specific Rules ──
  "DP-MD-09": {
    brignullPattern: "Hidden Costs",
    brignullNumber: 4,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      "Remove asterisks from headline price/discount claims. Either state the actual price most users will pay in the headline, or clearly show qualifying conditions in the same font size and prominence as the headline. Tooltip or fine-print conditions do not satisfy transparency requirements.",
    designerFix:
      "Headline price or discount must represent the actual experience for a typical user. If conditions apply (minimum sum insured, specific policy term, new customers only), surface them in the same visual layer as the headline — not behind an asterisk or tooltip.",
    legalSummary:
      "India CPA Dark Pattern Guidelines 2023 (MCA notification): asterisked claims misrepresenting the actual price are a notified dark pattern. ASCI Guidelines Section 4: qualifying conditions must be prominently displayed. FTC Act §5: material conditions must be clear and conspicuous.",
    estimatedEffort: "S",
  },
  "DP-FA-07": {
    brignullPattern: "Forced Action",
    brignullNumber: 5,
    dsaArticle: "Art. 25(3)(d)",
    developerFix:
      "Remove the mobile gate from product/pricing pages. Phone collection is only appropriate at the quote or purchase step. Implement progressive disclosure: show product information freely, collect mobile only when required for personalised underwriting or OTP.",
    designerFix:
      'Product pages (plans, pricing, coverage) must be accessible without personal data entry. If a phone number is needed for personalised quotes, offer a "Browse Plans" mode with indicative pricing before the mobile gate.',
    legalSummary:
      "IN-DPDPA 2023 §4(1)(b): data collection must be limited to what is necessary. India CPA Dark Pattern Guidelines 2023 (Forced Action): conditioning access to publicly available product info on personal data = dark pattern. FTC Act §5: requiring unnecessary data as a condition of service is an unfair practice.",
    estimatedEffort: "M",
  },
  "DP-SP-05": {
    brignullPattern: "Social Proof Inflation",
    brignullNumber: 7,
    dsaArticle: "Art. 25(1)(e)",
    developerFix:
      'Either remove crore/lakh-scale trust claims or add a verifiable data citation (source, date, methodology). Example tooltip: "As per IRDAI Annual Report 2023-24, claims settled: X lakh." Never display large round numbers without auditable backing.',
    designerFix:
      'Trust scale claims must have a visible citation or verifiable source badge. Use actual audited figures (e.g., "Claim settlement ratio: 98.3% — IRDAI Annual Report 2023") rather than manufactured crore customer numbers.',
    legalSummary:
      "ASCI Guidelines 2023: scale or market leadership claims must be supported by verifiable data with disclosed source. India CPA Dark Pattern Guidelines 2023: unverifiable authority claims to manipulate consumer trust = dark pattern. FTC Endorsement Guides 16 CFR Part 255: trust claims must be truthful and verifiable.",
    estimatedEffort: "S",
  },
  "DP-CS-05": {
    brignullPattern: "Confirmshaming",
    brignullNumber: 8,
    dsaArticle: "Art. 25(1)(b)",
    developerFix:
      'Replace all family-guilt decline CTAs with neutral alternatives. Acceptable: "No thanks" / "Skip for now". Prohibited: "I don\'t want to protect my family" / "I\'ll risk leaving my family unprotected". Audit all modal and exit-intent copy for emotional manipulation language.',
    designerFix:
      "Decline CTAs must be neutral and non-judgmental. Never tie opt-out copy to family harm, financial risk, or personal inadequacy. Guilt-trip copy is never acceptable UX even if it improves conversion — it is explicitly prohibited under Indian and EU regulation.",
    legalSummary:
      "India CPA Dark Pattern Guidelines 2023 (Confirmshaming): guilt-based decline CTAs using family/safety framing are a notified dark pattern under the Consumer Protection Act 2019. ASCI Guidelines on emotional appeal: advertising must not exploit fear or guilt to deny rational choice. EU DSA Art. 25(1)(b): interface manipulation exploiting emotional vulnerabilities is prohibited.",
    estimatedEffort: "XS",
  },
};

// ── Per-category fallback audience content ──
const CATEGORY_AUDIENCE_FALLBACK: Record<
  string,
  Pick<AudienceFixEntry, "brignullPattern" | "brignullNumber" | "dsaArticle">
> = {
  "interface-interference": {
    brignullPattern: "Interface Interference",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
  },
  obstruction: {
    brignullPattern: "Roach Motel",
    brignullNumber: 3,
    dsaArticle: "Art. 25(1)(c)",
  },
  sneaking: {
    brignullPattern: "Trick Questions",
    brignullNumber: 1,
    dsaArticle: "Art. 25(1)(b)",
  },
  "forced-action": {
    brignullPattern: "Forced Action",
    brignullNumber: 5,
    dsaArticle: "Art. 25(3)(d)",
  },
  nagging: {
    brignullPattern: "Nagging",
    brignullNumber: 9,
    dsaArticle: "Art. 25(1)(d)",
  },
  "scarcity-urgency": {
    brignullPattern: "False Urgency",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(e)",
  },
  "social-pressure": {
    brignullPattern: "Social Proof",
    brignullNumber: 7,
    dsaArticle: "Art. 25(1)(e)",
  },
  "privacy-zuckering": {
    brignullPattern: "",
    brignullNumber: 6,
    dsaArticle: "Art. 25(2)(b)",
  },
  confirmshaming: {
    brignullPattern: "Confirmshaming",
    brignullNumber: 8,
    dsaArticle: "Art. 25(1)(f)",
  },
  misdirection: {
    brignullPattern: "Misdirection",
    brignullNumber: 11,
    dsaArticle: "Art. 25(1)(a)",
  },
};

function makeFinding(
  ruleId: string,
  pageUrl: string,
  elementHtml: string,
  evidence: DarkPatternEvidence,
): DarkPatternFinding {
  const rule =
    DARK_PATTERN_RULES.find((r) => r.id === ruleId) ??
    VISUAL_AI_RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Unknown dark pattern rule: ${ruleId}`);

  // Signal vs Verdict model — DOM/visual = verdict (provable), AI/text = signal (needs review)
  const detectToBasis: Record<string, "structural" | "visual" | "textual"> = {
    dom: "structural",
    visual: "visual",
    journey: "structural",
    ai: "textual",
    flow: "structural",
  };
  const detectionBasis = detectToBasis[rule.detect] || "textual";
  const isVerdict =
    detectionBasis === "structural" || detectionBasis === "visual";

  // ── Resolve audience-specific content ──
  const audienceFix = RULE_AUDIENCE_MAP[ruleId];
  const categoryFallback = CATEGORY_AUDIENCE_FALLBACK[rule.category];
  const brignullPattern =
    audienceFix?.brignullPattern ?? categoryFallback?.brignullPattern;
  const brignullNumber =
    audienceFix?.brignullNumber ?? categoryFallback?.brignullNumber;
  const dsaArticle = audienceFix?.dsaArticle ?? categoryFallback?.dsaArticle;

  // Derive fix priority from severity
  const fixPriority: "P0" | "P1" | "P2" | "P3" =
    rule.severity === "critical"
      ? "P0"
      : rule.severity === "high"
        ? "P1"
        : rule.severity === "medium"
          ? "P2"
          : "P3";

  return {
    id: "", // assigned by caller
    ruleId,
    category: rule.category,
    principle: rule.principle,
    title: rule.title,
    description: rule.description,
    element: "",
    elementHtml: elementHtml || undefined,
    pageUrl,
    severity: rule.severity,
    regulation: rule.regulation,
    confidence: rule.detect === "ai" ? "medium" : "high",
    recommendation: rule.recommendation || getRecommendation(rule.category),
    userImpact: getUserImpact(rule.principle),
    evidence,
    source:
      rule.detect === "ai"
        ? "ai"
        : rule.detect === "journey"
          ? "journey"
          : "rule",
    detectionBasis,
    findingVerdict: isVerdict ? "verdict" : "signal",
    verifiabilityNote: isVerdict
      ? "DOM-proven: element structure or computed style confirms this pattern"
      : "Content-based signal: flagged by text/AI analysis — manual review recommended",
    // ── Audience handoff ──
    brignullPattern,
    brignullNumber,
    dsaArticle,
    fixPriority,
    developerFix: audienceFix?.developerFix,
    designerFix: audienceFix?.designerFix,
    legalSummary: audienceFix?.legalSummary,
    estimatedEffort: audienceFix?.estimatedEffort,
  };
}

function getRecommendation(category: DarkPatternCategory): string {
  const recs: Record<DarkPatternCategory, string> = {
    "interface-interference":
      "Ensure all choice options (accept/reject) have equal visual prominence — same size, color contrast, and positioning.",
    obstruction:
      "Ensure opt-out/cancel flows have equal or fewer steps than opt-in/subscribe flows.",
    sneaking:
      "Remove all preselected opt-ins. All consent must be affirmative — require explicit user action.",
    "forced-action":
      "Remove forced account creation walls. Allow content access without mandatory registration.",
    nagging:
      "Limit interruptions to one modal/banner at a time. Respect user dismissals permanently.",
    "scarcity-urgency":
      "Remove or verify urgency messaging. Only display real-time availability data that is accurate and verifiable.",
    "social-pressure":
      "Remove or verify social proof metrics. Do not display fabricated or unverifiable activity data.",
    "privacy-zuckering":
      "Apply data minimization principle — only collect data necessary for the stated purpose.",
    confirmshaming:
      'Use neutral language for all options. "No thanks" is acceptable; guilt-inducing phrasing is not.',
    misdirection:
      "Ensure all options in pricing/plan comparisons have equal visual weight and clear labeling.",
  };
  return recs[category];
}

function getUserImpact(principle: EthicalPrinciple): string {
  const impacts: Record<EthicalPrinciple, string> = {
    "informed-consent":
      "Users may unknowingly agree to terms, data sharing, or subscriptions they do not want.",
    "symmetry-of-choice":
      "Users face unequal friction when trying to decline vs accept, biasing their decisions.",
    transparency:
      "Users cannot make informed decisions because costs, terms, or data practices are hidden.",
    "user-autonomy":
      "Users are emotionally pressured into decisions through shame, fear, or artificial urgency.",
    "accessibility-clarity":
      "Users with disabilities, low literacy, or elderly demographics cannot understand the flow.",
  };
  return impacts[principle];
}

function buildResult(
  findings: DarkPatternFinding[],
  pagesScanned: number,
  complianceExemptions = 0,
  complianceExemptionsByCategory: Record<string, number> = {},
): DarkPatternResult {
  const categoryBreakdown = {} as Record<DarkPatternCategory, number>;
  const findingsBySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const principleScores = {} as Record<EthicalPrinciple, number>;
  const regulatorySet = new Set<string>();

  // Count by category
  for (const f of findings) {
    categoryBreakdown[f.category] = (categoryBreakdown[f.category] || 0) + 1;
    findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] || 0) + 1;
    f.regulation.forEach((r) => regulatorySet.add(r));
  }

  // Calculate per-principle scores
  const allPrinciples: EthicalPrinciple[] = [
    "informed-consent",
    "symmetry-of-choice",
    "transparency",
    "user-autonomy",
    "accessibility-clarity",
  ];
  const sevWeights = { critical: 15, high: 8, medium: 3, low: 1 };

  for (const p of allPrinciples) {
    const pFindings = findings.filter((f) => f.principle === p);
    let deduction = 0;
    for (const f of pFindings) {
      const confidenceMult =
        f.confidence === "high" ? 1 : f.confidence === "medium" ? 0.7 : 0.4;
      // Apply compliance exemption reduction factor — reduces score impact for compliance-driven patterns
      const exemptionFactor =
        (f as any).complianceExemption?.scoreReductionFactor ?? 1;
      deduction += sevWeights[f.severity] * confidenceMult * exemptionFactor;
    }
    principleScores[p] = Math.max(0, Math.round(100 - deduction));
  }

  // Calculate overall ethics score
  let weightedSum = 0,
    totalWeight = 0;
  for (const p of allPrinciples) {
    const w = PRINCIPLE_WEIGHTS[p];
    weightedSum += principleScores[p] * w;
    totalWeight += w;
  }
  let ethicsScore =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;

  // ── Coverage Confidence Penalty ──
  // A site audited at <10% page coverage with no interaction simulation cannot credibly
  // score 100. Cap the score and surface an explicit warning.
  // NOTE: pagesScanned is passed in; we don't have totalDiscovered here but we can
  // signal low-interaction confidence via finding count vs page count ratio.
  const avgFindingsPerPage =
    pagesScanned > 0 ? findings.length / pagesScanned : 0;
  // If 0 findings on multiple pages of a transactional/BFSI site — apply confidence cap
  // This prevents false-perfect scores masking interaction-layer dark patterns
  const coverageCapApplied = findings.length === 0 && pagesScanned >= 3;
  if (coverageCapApplied) {
    // Cap at 82 — reflects "no issues found in static scan, but funnel not verified"
    // Auditor must manually verify transactional flows before full trust score is issued
    ethicsScore = Math.min(ethicsScore, 82);
  }

  // Consent integrity: focused on informed-consent + symmetry
  const consentIntegrity = Math.round(
    principleScores["informed-consent"] * 0.6 +
      principleScores["symmetry-of-choice"] * 0.4,
  );

  // Choice symmetry score
  const symmetryFindings = findings.filter(
    (f) => f.principle === "symmetry-of-choice",
  );
  const choiceSymmetry =
    symmetryFindings.length === 0
      ? 100
      : Math.max(0, 100 - symmetryFindings.length * 20);

  // Manipulation index (inverse — lower is better)
  const manipFindings = findings.filter(
    (f) =>
      f.category === "scarcity-urgency" ||
      f.category === "social-pressure" ||
      f.category === "confirmshaming" ||
      f.category === "nagging",
  );
  const manipulationIndex =
    manipFindings.length === 0 ? 0 : Math.min(100, manipFindings.length * 15);

  // ── Source + Phase breakdown ──
  const findingsBySource: Record<string, number> = {};
  const findingsByPhase: Record<string, number> = {};
  const ruleIdToPhase: Record<string, string> = {};
  // Map ruleId prefixes to phase names
  for (const f of findings) {
    findingsBySource[f.source] = (findingsBySource[f.source] || 0) + 1;
    // Infer phase from ruleId prefix
    const phase =
      f.source === "ai-vision"
        ? "Phase 8: Visual AI"
        : f.source === "temporal"
          ? "Gap 3: Temporal"
          : f.source === "cta-scorer"
            ? "Gap 4: CTA Prominence"
            : /DP-CC/.test(f.ruleId)
              ? "Phase 9: CMP Audit"
              : /DP-PM/.test(f.ruleId)
                ? "Phase 1: DOM Scan"
                : /DP-SN|DP-OB|DP-FA|DP-NG|DP-PZ/.test(f.ruleId)
                  ? "Phase 1: DOM Scan"
                  : /DP-IF/.test(f.ruleId)
                    ? "Phase 2: Visual Scan"
                    : /DP-SU|DP-SP|DP-CS|DP-MD|DP-BS|DP-DA|DP-FS|DP-HC/.test(
                          f.ruleId,
                        )
                      ? "Phase 3: NLP Scan"
                      : /DP-DEEP/.test(f.ruleId)
                        ? "Phase 4: Deep Code"
                        : /DP-AX/.test(f.ruleId)
                          ? "Phase 5: A11Y Cross-Map"
                          : /DP-FLOW|DP-OB-04/.test(f.ruleId)
                            ? "Phase 6: Flow Analysis"
                            : "Other";
    findingsByPhase[phase] = (findingsByPhase[phase] || 0) + 1;
    ruleIdToPhase[f.ruleId] = phase;
  }

  return {
    findings,
    ethicsScore,
    principleScores,
    categoryBreakdown,
    consentIntegrity,
    choiceSymmetry,
    manipulationIndex,
    totalFindings: findings.length,
    findingsBySeverity,
    pagesScanned,
    regulatoryRisks: [...regulatorySet] as any[],
    findingsBySource,
    findingsByPhase,
    complianceExemptions,
    complianceExemptionsByCategory,
    coverageCapApplied,
    funnelVerified: false, // static scan only — set to true when interaction engine runs
  };
}

// ═══════════════════════════════════════════════════════════
// PHASE 4: Deep Code Inspection
// ═══════════════════════════════════════════════════════════
async function runDeepCodeInspection(
  page: Page,
  pageUrl: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  // DP-SN-05: Tracking scripts before consent
  const trackingBeforeConsent = await page
    .evaluate(() => {
      const consentBanner = document.querySelector(
        '[class*="cookie"], [class*="consent"], [class*=""]',
      );
      const bannerVisible = consentBanner
        ? window.getComputedStyle(consentBanner).display !== "none"
        : false;
      if (!bannerVisible) return [];
      const scripts = [...document.querySelectorAll("script[src]")];
      const trackerDomains = [
        "google-analytics",
        "googletagmanager",
        "facebook",
        "hotjar",
        "clarity.ms",
        "tiktok",
        "doubleclick",
      ];
      return scripts
        .filter((s) =>
          trackerDomains.some((d) => (s.getAttribute("src") || "").includes(d)),
        )
        .map((s) => s.getAttribute("src") || "");
    })
    .catch(() => []);

  if (trackingBeforeConsent.length > 0) {
    findings.push(
      makeFinding("DP-SN-05", pageUrl, "", {
        summary: `${trackingBeforeConsent.length} tracking script(s) fire before consent interaction`,
        details: trackingBeforeConsent.slice(0, 5),
      }),
    );
  }

  // DP-IF-07: Dark CSS overlay traps
  const overlayTraps = await page
    .evaluate(() => {
      const overlays = document.querySelectorAll("div, span, a");
      const traps: string[] = [];
      overlays.forEach((el) => {
        const s = window.getComputedStyle(el);
        if (s.position === "fixed" || s.position === "absolute") {
          const opacity = parseFloat(s.opacity);
          const rect = el.getBoundingClientRect();
          if (
            opacity < 0.1 &&
            rect.width > 200 &&
            rect.height > 200 &&
            parseInt(s.zIndex) > 100
          ) {
            traps.push(el.outerHTML.substring(0, 200));
          }
        }
      });
      return traps;
    })
    .catch(() => []);

  if (overlayTraps.length > 0) {
    findings.push(
      makeFinding("DP-IF-07", pageUrl, overlayTraps[0], {
        summary: `${overlayTraps.length} invisible overlay(s) intercepting clicks`,
        details: overlayTraps.slice(0, 3),
      }),
    );
  }

  // DP-SU-04: Fake countdown (check if timer resets by comparing values)
  const timerCheck = await page
    .evaluate(() => {
      const timers = document.querySelectorAll(
        '[class*="countdown"], [class*="timer"], [data-countdown]',
      );
      const results: string[] = [];
      timers.forEach((t) => {
        const text = t.textContent?.trim() || "";
        if (/\d+\s*[:\-]\s*\d+/.test(text)) {
          const scripts = document.querySelectorAll("script:not([src])");
          scripts.forEach((s) => {
            const code = s.textContent || "";
            if (
              /setInterval|setTimeout/.test(code) &&
              /countdown|timer/i.test(code)
            ) {
              results.push(text);
            }
          });
        }
      });
      return results;
    })
    .catch(() => []);

  if (timerCheck.length > 0) {
    findings.push(
      makeFinding("DP-SU-04", pageUrl, "", {
        summary:
          "Countdown timer driven by JavaScript setInterval — may reset on refresh",
        details: timerCheck.map((t) => `Timer text: "${t}"`),
      }),
    );
  }

  // DP-OB-05: Buried unsubscribe (check navigation depth)
  const buriedUnsubscribe = await page
    .evaluate(() => {
      const links = [...document.querySelectorAll("a")];
      const unsub = links.filter((l) =>
        /unsubscribe|cancel|delete.?account|close.?account/i.test(
          l.textContent || "",
        ),
      );
      const buried: string[] = [];
      for (const link of unsub) {
        let depth = 0;
        let el: Element | null = link;
        while (el && el !== document.body) {
          if (
            el.tagName === "NAV" ||
            el.tagName === "UL" ||
            el.tagName === "DETAILS"
          )
            depth++;
          el = el.parentElement;
        }
        if (depth >= 3)
          buried.push(
            `"${link.textContent?.trim()}" nested ${depth} levels deep`,
          );
      }
      return buried;
    })
    .catch(() => []);

  if (buriedUnsubscribe.length > 0) {
    findings.push(
      makeFinding("DP-OB-05", pageUrl, "", {
        summary: "Unsubscribe/cancel option buried in deep navigation",
        details: buriedUnsubscribe,
      }),
    );
  }

  // DP-FA-04: Auto-renewal detection
  const autoRenewal = await page
    .evaluate(() => {
      const body = document.body?.textContent?.toLowerCase() || "";
      const hasAutoRenew =
        /auto.?renew|recurring\s+(charge|billing|payment)|will\s+be\s+charged\s+(again|monthly|annually)/i.test(
          body,
        );
      const hasCancelPath =
        /cancel\s+(anytime|subscription|renewal)|how\s+to\s+cancel/i.test(body);
      return { hasAutoRenew, hasCancelPath };
    })
    .catch(() => ({ hasAutoRenew: false, hasCancelPath: false }));

  if (autoRenewal.hasAutoRenew && !autoRenewal.hasCancelPath) {
    findings.push(
      makeFinding("DP-FA-04", pageUrl, "", {
        summary:
          "Auto-renewal/recurring charges mentioned without clear cancellation path",
        details: [
          "Page mentions auto-renewal but no visible cancellation instructions",
        ],
      }),
    );
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════
// PHASE 5: Accessibility × Dark Pattern Cross-Mapping
// ═══════════════════════════════════════════════════════════
async function runA11yCrossMap(
  page: Page,
  pageUrl: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  // DP-AX-02: Focus trapped in consent modal
  const focusTrap = await page
    .evaluate(() => {
      const modals = document.querySelectorAll(
        '[role="dialog"], [class*="consent"], [class*="cookie"]',
      );
      for (const modal of Array.from(modals)) {
        const s = window.getComputedStyle(modal);
        if (s.display === "none" || s.visibility === "hidden") continue;
        const focusable = modal.querySelectorAll(
          "button, a, input, [tabindex]",
        );
        const closeBtn = modal.querySelector(
          '[class*="close"], [aria-label*="close"], button[class*="dismiss"]',
        );
        if (focusable.length > 0 && !closeBtn)
          return modal.outerHTML.substring(0, 200);
      }
      return null;
    })
    .catch(() => null);

  if (focusTrap) {
    findings.push(
      makeFinding("DP-AX-02", pageUrl, focusTrap, {
        summary:
          "Consent modal has no keyboard-accessible close/dismiss button",
        details: ["Modal traps focus without providing keyboard escape"],
      }),
    );
  }

  // DP-AX-03: Screen reader text mismatch
  const srMismatch = await page
    .evaluate(() => {
      const mismatches: string[] = [];
      const buttons = document.querySelectorAll(
        'button, a[role="button"], [role="button"]',
      );
      buttons.forEach((btn) => {
        const visible = btn.textContent?.trim() || "";
        const ariaLabel = btn.getAttribute("aria-label") || "";
        if (
          ariaLabel &&
          visible &&
          ariaLabel.toLowerCase() !== visible.toLowerCase() &&
          visible.length > 2
        ) {
          mismatches.push(
            `Visible: "${visible}" vs aria-label: "${ariaLabel}"`,
          );
        }
      });
      return mismatches.slice(0, 5);
    })
    .catch(() => []);

  if (srMismatch.length > 0) {
    findings.push(
      makeFinding("DP-AX-03", pageUrl, "", {
        summary: `${srMismatch.length} button(s) have mismatched visible text and screen reader label`,
        details: srMismatch,
      }),
    );
  }

  // DP-AX-01: Low-contrast reject buttons (check against consent banners)
  const lowContrastReject = await page
    .evaluate(() => {
      const banners = document.querySelectorAll(
        '[class*="cookie"], [class*="consent"], [class*=""]',
      );
      const results: string[] = [];
      banners.forEach((banner) => {
        const s = window.getComputedStyle(banner);
        if (s.display === "none") return;
        const btns = banner.querySelectorAll('button, a[role="button"]');
        btns.forEach((btn) => {
          const text = btn.textContent?.trim() || "";
          if (/reject|decline|no|dismiss|close/i.test(text)) {
            const bs = window.getComputedStyle(btn);
            const opacity = parseFloat(bs.opacity);
            if (opacity < 0.6) results.push(`"${text}" opacity: ${opacity}`);
          }
        });
      });
      return results;
    })
    .catch(() => []);

  if (lowContrastReject.length > 0) {
    findings.push(
      makeFinding("DP-AX-01", pageUrl, "", {
        summary: "Reject/decline button has low visibility in consent banner",
        details: lowContrastReject,
      }),
    );
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════
// PHASE 6: Interaction Flow Analysis (Ethical Friction Score)
// ═══════════════════════════════════════════════════════════
async function runInteractionFlowAnalysis(
  page: Page,
  pageUrl: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  // Measure subscribe vs cancel friction
  const frictionAnalysis = await page
    .evaluate(() => {
      const body = document.body?.textContent?.toLowerCase() || "";
      const allLinks = [...document.querySelectorAll("a, button")];

      // Count entry points (subscribe/signup)
      const entryPoints = allLinks.filter((el) =>
        /subscribe|sign.?up|register|join|start|get.?started|create.?account/i.test(
          el.textContent || "",
        ),
      );

      // Count exit points (unsubscribe/cancel)
      const exitPoints = allLinks.filter((el) =>
        /unsubscribe|cancel|opt.?out|delete.?account|close.?account|deactivate|remove/i.test(
          el.textContent || "",
        ),
      );

      // Measure visibility: are exit points as prominent as entry?
      const entryVisible = entryPoints.filter((el) => {
        const s = window.getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden";
      });
      const exitVisible = exitPoints.filter((el) => {
        const s = window.getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden";
      });

      return {
        entryCount: entryVisible.length,
        exitCount: exitVisible.length,
        entryTexts: entryVisible
          .map((e) => e.textContent?.trim()?.substring(0, 50) || "")
          .slice(0, 3),
        exitTexts: exitVisible
          .map((e) => e.textContent?.trim()?.substring(0, 50) || "")
          .slice(0, 3),
      };
    })
    .catch(() => ({
      entryCount: 0,
      exitCount: 0,
      entryTexts: [] as string[],
      exitTexts: [] as string[],
    }));

  if (frictionAnalysis.entryCount > 0 && frictionAnalysis.exitCount === 0) {
    // Ethical Friction Score: infinite (no exit at all)
    findings.push(
      makeFinding("DP-OB-04", pageUrl, "", {
        summary: `${frictionAnalysis.entryCount} subscribe/signup option(s) but 0 cancel/unsubscribe options — EFS: ∞`,
        details: [
          `Entry points: ${frictionAnalysis.entryTexts.join(", ")}`,
          "No visible exit/cancel path found on page",
          "Ethical Friction Score: ∞ (infinite asymmetry)",
        ],
        measurements: {
          entryCount: frictionAnalysis.entryCount,
          exitCount: 0,
          efs: "infinity",
        },
      }),
    );
  } else if (
    frictionAnalysis.entryCount > 0 &&
    frictionAnalysis.exitCount > 0
  ) {
    // Check for multi-step confirmation dialogs
    const confirmDialogs = await page
      .$$eval(
        '[class*="confirm"], [class*="are-you-sure"], [class*="cancel-confirm"]',
        (els) =>
          els.filter((el) => window.getComputedStyle(el).display !== "none")
            .length,
      )
      .catch(() => 0);

    if (confirmDialogs > 0) {
      findings.push(
        makeFinding("DP-OB-04", pageUrl, "", {
          summary: `Exit path has ${confirmDialogs} confirmation dialog(s) while entry is direct`,
          details: [
            `Entry: ${frictionAnalysis.entryCount} direct action(s)`,
            `Exit: requires ${confirmDialogs} extra confirmation step(s)`,
          ],
          measurements: {
            entryCount: frictionAnalysis.entryCount,
            exitCount: frictionAnalysis.exitCount,
            confirmDialogs,
          },
        }),
      );
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════
// PHASE 8: Visual AI Dark Pattern Analysis (Claude Vision)
// Screenshots are captured via Playwright and sent to Claude
// claude-haiku-4-5 for design-level dark pattern detection that
// DOM scanning cannot catch (colour asymmetry, visual hierarchy, etc.)
// ═══════════════════════════════════════════════════════════
async function runVisualAIDarkPatternPhase8(
  page: Page,
  pageUrl: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  // 1. Guard: require ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured — visual AI analysis unavailable",
    );
  }

  // 2. Capture full-page screenshot as base64
  let screenshotB64: string;
  try {
    const buf = await page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 75,
    });
    screenshotB64 = buf.toString("base64");
  } catch (ssErr) {
    throw new Error(
      `Screenshot capture failed: ${ssErr instanceof Error ? ssErr.message : "unknown"}`,
    );
  }

  // 3. Build the structured prompt from VISUAL_AI_RULES
  const ruleDescriptions = VISUAL_AI_RULES.map(
    (r, i) =>
      `${i + 1}. [${r.id}] ${r.title}\n   Category: ${r.category} | Severity: ${r.severity}\n   Description: ${r.description}`,
  ).join("\n\n");

  const prompt = `You are an expert UX auditor and dark pattern analyst. Examine this screenshot of a web page and identify any VISUAL dark patterns from the following rules. These are patterns that can ONLY be detected visually — they are invisible to DOM/code scanners.

## Rules to check:
${ruleDescriptions}

## Instructions:
- Only flag issues you can clearly see in the screenshot.
- For each detected issue, return a JSON object.
- If no issues are found for a rule, skip it.
- Return a JSON array of findings (or empty array []).
- Each finding must have these fields:
  {
    "ruleId": "DP-VIS-AI-XX",
    "title": "Short descriptive title",
    "description": "What you see in the screenshot that constitutes this pattern",
    "severity": "critical" | "high" | "medium" | "low",
    "element": "CSS-style description of the element location (e.g. 'cookie banner at bottom')",
    "confidence": "high" | "medium" | "low",
    "recommendation": "Specific actionable fix"
  }

## Important:
- Do NOT hallucinate patterns. Only flag what is clearly visible.
- Provide specific visual evidence in the description (colors, sizes, positions).
- Return ONLY the JSON array, no markdown or explanation.`;

  // 4. Call Claude claude-haiku-4-5 Vision via Anthropic SDK
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await Promise.race([
    client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: screenshotB64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Phase 8 Vision API timed out after 45s")),
        45000,
      ),
    ),
  ]);

  const raw =
    (response.content[0] as { type: string; text: string })?.text || "[]";

  // 5. Parse the JSON response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return findings;

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn(
      "[TrustLens:DP-Phase8] Failed to parse Claude response as JSON",
    );
    return findings;
  }

  // 6. Convert each parsed item into a DarkPatternFinding
  for (const item of parsed) {
    const matchedRule = VISUAL_AI_RULES.find((r) => r.id === item.ruleId);
    if (!matchedRule) continue;

    const audienceFix = RULE_AUDIENCE_MAP[item.ruleId];
    const categoryFallback = CATEGORY_AUDIENCE_FALLBACK[matchedRule.category];
    const brignullPattern =
      audienceFix?.brignullPattern ?? categoryFallback?.brignullPattern;
    const brignullNumber =
      audienceFix?.brignullNumber ?? categoryFallback?.brignullNumber;
    const dsaArticle = audienceFix?.dsaArticle ?? categoryFallback?.dsaArticle;
    const severity = item.severity || matchedRule.severity;
    const fixPriority: "P0" | "P1" | "P2" | "P3" =
      severity === "critical"
        ? "P0"
        : severity === "high"
          ? "P1"
          : severity === "medium"
            ? "P2"
            : "P3";

    findings.push({
      id: "", // assigned by caller
      ruleId: item.ruleId,
      category: matchedRule.category,
      principle: matchedRule.principle,
      title: item.title || matchedRule.title,
      description: item.description || matchedRule.description,
      element: item.element || "",
      elementHtml: undefined,
      pageUrl,
      severity,
      regulation: matchedRule.regulation,
      confidence: item.confidence || "medium",
      recommendation:
        item.recommendation ||
        matchedRule.recommendation ||
        getRecommendation(matchedRule.category),
      userImpact: getUserImpact(matchedRule.principle),
      evidence: {
        summary: `Visual AI Detection (Claude Vision): ${item.description || matchedRule.description}`,
        details: [
          `Rule: ${matchedRule.id} — ${matchedRule.title}`,
          `Visual evidence: ${item.description || "See screenshot"}`,
          `Element location: ${item.element || "Full page"}`,
          `Detection method: Phase 8 — Screenshot-based Claude claude-haiku-4-5 vision analysis`,
        ],
      },
      source: "ai-vision",
      detectionBasis: "visual-ai",
      findingVerdict: "signal",
      verifiabilityNote:
        "Visual AI signal: flagged by Claude claude-haiku-4-5 screenshot analysis — manual design review recommended",
      visualAnalysisPhase: "Phase 8: Visual AI Dark Pattern Analysis",
      // ── Audience handoff ──
      brignullPattern,
      brignullNumber,
      dsaArticle,
      fixPriority,
      developerFix: audienceFix?.developerFix ?? item.developerFix,
      designerFix: audienceFix?.designerFix ?? item.designerFix,
      legalSummary: audienceFix?.legalSummary,
      estimatedEffort: audienceFix?.estimatedEffort,
    });
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════
// PHASE 9: Cookie Consent Management Platform (CMP) Audit
// Detects known CMPs (OneTrust, Cookiebot, Didomi, etc.) and
// audits them against EDPB Guidelines 3/2022 dark pattern rules:
// — Equal ease for accept and reject
// — No pre-ticked non-essential categories
// — No legitimate interest abuse
// — No consent by scrolling/inactivity
// ═══════════════════════════════════════════════════════════
async function runCookieConsentAudit(
  page: Page,
  pageUrl: string,
): Promise<DarkPatternFinding[]> {
  const findings: DarkPatternFinding[] = [];

  // ── Step 1: Detect CMP platform ──
  const cmpInfo = await page
    .evaluate(() => {
      type CmpDef = {
        name: string;
        signature: string;
        rejectSel: string;
        prefSel: string;
      };
      const cmps: CmpDef[] = [
        {
          name: "OneTrust",
          signature:
            "#onetrust-consent-sdk, .ot-sdk-container, #onetrust-banner-sdk",
          rejectSel: "#onetrust-reject-all-handler",
          prefSel: "#onetrust-pc-btn-handler",
        },
        {
          name: "Cookiebot",
          signature: "#CybotCookiebotDialog, .CybotCookiebotDialogBody",
          rejectSel: "#CybotCookiebotDialogBodyButtonDecline",
          prefSel: "#CybotCookiebotDialogBodyLevelButtonCustomize",
        },
        {
          name: "CookiePro",
          signature: '[class*="optanon-"], #optanon-popup-wrapper, #optanon',
          rejectSel: '[class*="optanon-reject"]',
          prefSel: '[class*="optanon-show-settings"]',
        },
        {
          name: "Didomi",
          signature: "#didomi-host, #didomi-notice, .didomi-popup",
          rejectSel: "#didomi-notice-disagree-button",
          prefSel: "#didomi-notice-learn-more-button",
        },
        {
          name: "Usercentrics",
          signature: '[data-testid*="uc-"], #usercentrics-cmp',
          rejectSel: '[data-testid="uc-deny-all-button"]',
          prefSel: '[data-testid="uc-customize-button"]',
        },
        {
          name: "CookieYes",
          signature: '[class*="cky-"], #cky-consent, .cky-consent-container',
          rejectSel: '.cky-btn-reject, [data-cky-tag="reject-button"]',
          prefSel: ".cky-btn-customize",
        },
        {
          name: "Quantcast",
          signature: '#qc-cmp2-container, [class*="qc-cmp"]',
          rejectSel: '[class*="qc-cmp2-buttons"] button:first-child',
          prefSel: "",
        },
        {
          name: "TrustArc",
          signature: '[class*="truste_"], #truste-consent-track',
          rejectSel: '[class*="truste_notallow"]',
          prefSel: "",
        },
        {
          name: "Osano",
          signature: '.osano-cm-window, [class*="osano-"]',
          rejectSel: ".osano-cm-deny",
          prefSel: ".osano-cm-manage",
        },
        {
          name: "Termly",
          signature: '#termly-code-snippet-support, [class*="termly-"]',
          rejectSel: '[class*="termly-"][class*="deny"]',
          prefSel: '[class*="termly-"][class*="prefer"]',
        },
      ];
      for (const cmp of cmps) {
        const el = document.querySelector(cmp.signature);
        if (el) {
          const style = window.getComputedStyle(el);
          if (style.display !== "none" && style.visibility !== "hidden") {
            const rejectEl = cmp.rejectSel
              ? document.querySelector(cmp.rejectSel)
              : null;
            const rejectVisible = rejectEl
              ? (() => {
                  const s = window.getComputedStyle(rejectEl);
                  return s.display !== "none" && s.visibility !== "hidden";
                })()
              : false;
            return {
              detected: true,
              name: cmp.name,
              rejectSel: cmp.rejectSel,
              prefSel: cmp.prefSel,
              rejectVisible,
            };
          }
        }
      }
      // Generic fallback
      const generic = document.querySelector(
        '[class*="cookie-banner"], [class*="cookie-notice"], [class*="consent-banner"], ' +
          '[id*="cookie-consent"], [id*="-consent"], [role="dialog"][aria-label*="cookie"]',
      );
      if (generic && window.getComputedStyle(generic).display !== "none") {
        const allBtns = Array.from(
          generic.querySelectorAll('button, a[role="button"]'),
        ) as HTMLElement[];
        const rejectBtn = allBtns.find((b) =>
          /reject|decline|deny|no\s*thanks?/i.test(b.textContent || ""),
        );
        return {
          detected: true,
          name: "Generic CMP",
          rejectSel: "",
          prefSel: "",
          rejectVisible: !!rejectBtn,
        };
      }
      return {
        detected: false,
        name: "",
        rejectSel: "",
        prefSel: "",
        rejectVisible: false,
      };
    })
    .catch(() => ({
      detected: false,
      name: "",
      rejectSel: "",
      prefSel: "",
      rejectVisible: false,
    }));

  if (!cmpInfo.detected) return findings;

  // ── Check 1: No "Reject All" on first screen ──
  if (!cmpInfo.rejectVisible) {
    findings.push(
      makeFinding("DP-CC-01", pageUrl, "", {
        summary: `${cmpInfo.name}: No "Reject All" button visible on initial consent banner`,
        details: [
          `CMP Detected: ${cmpInfo.name}`,
          cmpInfo.rejectSel
            ? `Reject selector "${cmpInfo.rejectSel}" not visible on first screen`
            : "No Reject All button found in initial banner",
          "EDPB Guidelines 3/2022 — Reject must be as easy as Accept (equal prominence, equal steps)",
          "CJEU Planet49 (C-673/17): refusal must not require more steps than acceptance",
        ],
      }),
    );
    // ── Check 1b: If Accept=1 click, Reject requires Manage Prefs → DP-CC-03 ──
    if (cmpInfo.prefSel) {
      findings.push(
        makeFinding("DP-CC-03", pageUrl, "", {
          summary: `${cmpInfo.name}: Accept=1 click, Reject requires navigating to Manage Preferences`,
          details: [
            "Accepting all cookies: 1 click on the banner",
            'Rejecting all cookies: click "Manage Preferences" → configure each category → save',
            "EDPB Guidelines 3/2022 §2.1.3: equivalent ease of rejection is legally required",
            "This asymmetric click-depth is cited in ICO, CNIL, and DPC enforcement decisions",
          ],
        }),
      );
    }
  }

  // ── Check 2: Non-essential categories pre-enabled in consent preferences ──
  const preEnabledCategories = await page
    .evaluate(() => {
      const selectors = [
        ".ot-tgl input:checked", // OneTrust
        ".CybotCookiebotDialogBodyLevelButton:not([disabled]):checked", // Cookiebot
        '[class*="category-switch"] input:checked',
        '[class*="purpose-item"] input:checked',
        '[aria-label*="statistics"][aria-checked="true"]',
        '[aria-label*="marketing"][aria-checked="true"]',
        '[aria-label*="analytics"][aria-checked="true"]',
        '[data-purpose*="ANALYTICS"][aria-checked="true"]',
        '[data-purpose*="MARKETING"][aria-checked="true"]',
      ].join(", ");
      const results: string[] = [];
      try {
        document.querySelectorAll(selectors).forEach((el) => {
          const container = el.closest(
            '[class*="category"], [class*="purpose"], li',
          );
          const label =
            container
              ?.querySelector(
                '[class*="title"], [class*="name"], h3, h4, label',
              )
              ?.textContent?.trim() ||
            el.getAttribute("aria-label") ||
            el.getAttribute("name") ||
            el.id ||
            "";
          if (
            /market|analyt|advertis|target|statistic|personali|social|partner|third.?party/i.test(
              label,
            )
          ) {
            results.push(label.substring(0, 60));
          }
        });
      } catch {
        /* skip */
      }
      return results;
    })
    .catch(() => [] as string[]);

  if (preEnabledCategories.length > 0) {
    findings.push(
      makeFinding("DP-CC-02", pageUrl, "", {
        summary: `${cmpInfo.name}: ${preEnabledCategories.length} non-essential category(s) pre-enabled`,
        details: [
          `Pre-enabled: ${preEnabledCategories.join(", ")}`,
          " Art. 7 + Recital 32: consent must be an affirmative act — pre-ticked is strictly prohibited",
          "Each non-essential cookie category requires explicit opt-in, not opt-out",
          "CNIL (Google €150M), ICO (TikTok), and DPC have issued fines for pre-enabled marketing cookies",
        ],
      }),
    );
  }

  // ── Check 3: Legitimate Interest abuse — ad vendors pre-enabled under LI ──
  const liAbuse = await page
    .evaluate(() => {
      const liSections = document.querySelectorAll(
        '[class*="legit"], [class*="legitimate-interest"], [data-consent-type="LEGITIMATE_INTEREST"], ' +
          '[class*="li-purpose"], #ot-li-title, [aria-label*="legitimate interest"]',
      );
      const preEnabled: string[] = [];
      liSections.forEach((section) => {
        const toggles = section.querySelectorAll(
          '[aria-checked="true"], input:checked',
        );
        toggles.forEach((t) => {
          const label =
            (t as HTMLElement).getAttribute("aria-label") ||
            (t as HTMLElement).getAttribute("name") ||
            t.id ||
            "";
          if (/advertis|target|market|track|profil/i.test(label))
            preEnabled.push(label.substring(0, 60));
        });
      });
      return preEnabled;
    })
    .catch(() => [] as string[]);

  if (liAbuse.length > 0) {
    findings.push(
      makeFinding("DP-CC-04", pageUrl, "", {
        summary: `${cmpInfo.name}: Legitimate Interest abuse — ${liAbuse.length} advertising vendor(s) pre-enabled`,
        details: [
          `LI vendors: ${liAbuse.slice(0, 5).join(", ")}`,
          "Legitimate Interest CANNOT serve as legal basis for advertising/targeting without balancing test",
          "Art. 6(1)(f) + EDPB Opinion 08/2023: LI does not apply to advertising tracking",
          "Belgian APD and French CNIL have specifically targeted IAB TCF LI abuse in enforcement actions",
        ],
      }),
    );
  }

  // ── Check 4: Accept appears before Reject in DOM order ──
  const domOrderBiased = await page
    .evaluate(() => {
      const bannerSels = [
        "#onetrust-banner-sdk",
        "#CybotCookiebotDialog",
        "#didomi-notice",
        "#cky-consent",
        '[class*="cookie-banner"]',
        '[class*="consent-banner"]',
        '[role="dialog"][aria-label*="cookie"]',
      ].join(", ");
      for (const banner of Array.from(document.querySelectorAll(bannerSels))) {
        const s = window.getComputedStyle(banner);
        if (s.display === "none" || s.visibility === "hidden") continue;
        const btns = Array.from(
          banner.querySelectorAll('button, a[role="button"]'),
        );
        let firstAccept = -1,
          firstReject = -1;
        btns.forEach((btn, i) => {
          const text = btn.textContent?.trim() || "";
          if (
            firstAccept === -1 &&
            /accept|agree|allow|ok|got.?it|enable.?all/i.test(text)
          )
            firstAccept = i;
          if (
            firstReject === -1 &&
            /reject|decline|deny|refuse|no.?thanks?/i.test(text)
          )
            firstReject = i;
        });
        if (
          firstAccept !== -1 &&
          firstReject !== -1 &&
          firstAccept < firstReject
        )
          return true;
      }
      return false;
    })
    .catch(() => false);

  if (domOrderBiased) {
    findings.push(
      makeFinding("DP-CC-06", pageUrl, "", {
        summary: `${cmpInfo.name}: Accept button declared before Reject in DOM — biases screen reader traversal`,
        details: [
          "Accept appears before Reject in DOM source order",
          "Screen reader users encounter the accept option first (default tab order)",
          "ICO guidance and EDPB recommend neutral or Reject-first ordering",
          "This exploits default keyboard/screen reader navigation to bias toward acceptance",
        ],
      }),
    );
  }

  return findings;
}
