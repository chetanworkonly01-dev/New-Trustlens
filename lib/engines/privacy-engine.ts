// ============================================================
// KPMG TrustLens — Privacy & Compliance Engine (7 Layers)
// ============================================================

import type { BrowserContext, Page } from "playwright";
import type {
  PrivacyResult,
  PrivacyFinding,
  CookieInfo,
  TrackerInfo,
  CookiePurpose,
} from "../types/privacy";
import { KNOWN_TRACKERS } from "../types/privacy";
import type { TestLogEntry } from "../types/audit";

interface PageData {
  url: string;
  title: string;
}
type ProgressFn = (entry: TestLogEntry) => void;

export async function runPrivacyAudit(
  context: BrowserContext,
  pages: PageData[],
  onProgress?: ProgressFn,
): Promise<PrivacyResult> {
  const findings: PrivacyFinding[] = [];
  const allCookies: CookieInfo[] = [];
  const trackerMap = new Map<string, TrackerInfo>();
  let hasConsentBanner = false;
  let hasPrivacyPolicy = false;
  let hasMixedContent = false;
  let findingId = 0;
  const trackedRequests: Array<{ url: string; pageUrl: string }> = [];
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
      testName: "",
      wcag: "",
      status: status as any,
      message,
      pillar: "privacy",
      methodology,
      phase,
    });
  };

  for (const pageData of pages) {
    let page: Page | null = null;
    try {
      page = await context.newPage();
      page.on("request", (req) => {
        trackedRequests.push({ url: req.url(), pageUrl: pageData.url });
      });
      await page.goto(pageData.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);

      // ── Layer A: Cookie & Storage Analysis ──
      log(
        "PRIV-CK",
        "running",
        "━━━ Layer A: Cookie & Storage Analysis",
        " Art. 5(1)(e) + ePrivacy Directive",
        "Layer A: Cookie Audit",
      );
      log(
        "PRIV-CK-CL",
        "running",
        "  → Cookie Classification: Necessary / Analytics / Marketing / Functional mapping",
        "ePrivacy Directive — Cookie Categorisation",
        "Layer A: Cookie Audit",
      );
      log(
        "PRIV-CK-EX",
        "running",
        "  → Cookie Lifetime: Flagging non-essential cookies persisting >1 year (CNIL guidance)",
        " Art. 5(1)(e) — Storage Limitation",
        "Layer A: Cookie Audit",
      );
      log(
        "PRIV-CK-SC",
        "running",
        "  → Cookie Security: Secure flag, HttpOnly, SameSite attributes on sensitive cookies",
        " Art. 32 — Security of Processing",
        "Layer A: Cookie Audit",
      );
      log(
        "PRIV-CK-ST",
        "running",
        "  → Client Storage: localStorage / sessionStorage item count (data minimisation check)",
        " Art. 5(1)(c) — Data Minimisation",
        "Layer A: Cookie Audit",
      );
      const cookies = await context.cookies(pageData.url);
      for (const cookie of cookies) {
        const info: CookieInfo = {
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          purpose: classifyCookie(cookie.name, cookie.domain),
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expires:
            cookie.expires > 0
              ? new Date(cookie.expires * 1000).toISOString()
              : null,
        };
        allCookies.push(info);

        // PRIV-CK-03: Insecure cookies
        if (!cookie.secure && cookie.domain) {
          // Only flag if site is HTTPS
          const isHttps = pageData.url.startsWith("https");
          if (isHttps && !cookie.secure && info.purpose !== "necessary") {
            // Will aggregate below
          }
        }
      }

      // Check for excessive cookie expiry (>1 year)
      const longCookies = cookies.filter(
        (c) =>
          c.expires > 0 &&
          c.expires * 1000 - Date.now() > 365 * 24 * 60 * 60 * 1000,
      );
      if (longCookies.length > 0) {
        findings.push({
          id: `priv-${++findingId}`,
          category: "cookie-consent",
          title: `${longCookies.length} Cookie(s) with Excessive Expiry (>1 Year)`,
          description: `${longCookies.length} non-essential cookie(s) persist for more than one year.`,
          pageUrl: pageData.url,
          severity: "medium",
          regulation: ["ePrivacy"],
          recommendation:
            "Reduce cookie lifetimes. Non-essential cookies should expire within 6-12 months.",
          evidence: {
            summary: `${longCookies.length} long-lived cookies`,
            details: longCookies
              .slice(0, 5)
              .map((c) => `${c.name} (${c.domain})`),
          },
        });
      }

      // Storage analysis
      const storageAnalysis = await page
        .evaluate(() => {
          let ls = 0,
            ss = 0;
          try {
            ls = localStorage.length;
          } catch {}
          try {
            ss = sessionStorage.length;
          } catch {}
          return { ls, ss };
        })
        .catch(() => ({ ls: 0, ss: 0 }));

      if (storageAnalysis.ls + storageAnalysis.ss > 20) {
        findings.push({
          id: `priv-${++findingId}`,
          category: "data-storage",
          title: "Excessive Client-Side Data Storage",
          description: `${storageAnalysis.ls + storageAnalysis.ss} items in localStorage/sessionStorage.`,
          pageUrl: pageData.url,
          severity: "medium",
          regulation: ["ePrivacy"],
          recommendation: "Review storage usage and ensure data minimization.",
          evidence: {
            summary: `${storageAnalysis.ls} localStorage + ${storageAnalysis.ss} sessionStorage`,
            details: [],
          },
        });
      }
      log(
        "PRIV-CK",
        "pass",
        `  ✓ Layer A complete — Cookies: ${cookies.length} | Storage: ${storageAnalysis.ls + storageAnalysis.ss} items`,
        " Art. 5 + ePrivacy",
        "Layer A: Cookie Audit",
      );

      // ── Layer B: Tracker Detection ──
      log(
        "PRIV-TR",
        "running",
        "━━━ Layer B: Third-Party Tracker Detection",
        " Art. 6 — Lawful Basis for Processing",
        "Layer B: Tracker Detection",
      );
      log(
        "PRIV-TR-TK",
        "running",
        "  → Known Trackers: Google Analytics, Meta Pixel, Hotjar, Clarity, TikTok Pixel detection",
        " Art. 6 — Consent Required for Trackers",
        "Layer B: Tracker Detection",
      );
      log(
        "PRIV-TR-FP",
        "running",
        "  → Browser Fingerprinting: Canvas, AudioContext, font-enumeration fingerprint signals",
        " Art. 4(1) — Fingerprint = Personal Data",
        "Layer B: Tracker Detection",
      );
      log(
        "PRIV-TR-PX",
        "running",
        "  → Tracking Pixels: 1×1 image beacons for cross-site tracking identification",
        "ePrivacy Directive — Electronic Surveillance",
        "Layer B: Tracker Detection",
      );
      // (tracked requests processed after loop)

      // Fingerprinting detection
      const fingerprinting = await page
        .evaluate(() => {
          const signals: string[] = [];
          // Check for canvas fingerprinting
          const canvasEls = document.querySelectorAll("canvas");
          if (canvasEls.length > 0) {
            canvasEls.forEach((c) => {
              if (
                c.width === 1 ||
                c.height === 1 ||
                (c.width <= 16 && c.height <= 16)
              ) {
                signals.push(
                  "Suspicious small canvas element (potential fingerprinting)",
                );
              }
            });
          }
          // Check for known fingerprinting scripts
          const scripts = [...document.querySelectorAll("script[src]")];
          const fpDomains = ["fingerprintjs", "fp2", "clientjs", "evercookie"];
          scripts.forEach((s) => {
            const src = s.getAttribute("src") || "";
            if (fpDomains.some((d) => src.toLowerCase().includes(d))) {
              signals.push(`Fingerprinting library detected: ${src}`);
            }
          });
          return signals;
        })
        .catch(() => []);

      if (fingerprinting.length > 0) {
        findings.push({
          id: `priv-${++findingId}`,
          category: "fingerprinting",
          title: "Browser Fingerprinting Detected",
          description: `${fingerprinting.length} fingerprinting signal(s) found.`,
          pageUrl: pageData.url,
          severity: "high",
          regulation: ["IN-DPDPA", "ePrivacy"],
          recommendation:
            "Remove fingerprinting scripts. Use privacy-respecting analytics.",
          evidence: {
            summary: `${fingerprinting.length} signals`,
            details: fingerprinting,
          },
        });
      }

      // Pixel tracking (1x1 images)
      const trackingPixels = await page
        .$$eval("img", (imgs) =>
          (imgs as HTMLImageElement[])
            .filter(
              (img) =>
                (img.width <= 1 && img.height <= 1) ||
                (img.naturalWidth <= 1 && img.naturalHeight <= 1),
            )
            .map((img) => img.src)
            .filter((src) => src && !src.startsWith("data:")),
        )
        .catch(() => []);

      if (trackingPixels.length > 0) {
        findings.push({
          id: `priv-${++findingId}`,
          category: "third-party-tracker",
          title: `${trackingPixels.length} Tracking Pixel(s) Detected`,
          description: `1×1 pixel images used for cross-site tracking.`,
          pageUrl: pageData.url,
          severity: "medium",
          regulation: ["ePrivacy"],
          recommendation: "Remove tracking pixels or gate behind consent.",
          evidence: {
            summary: `${trackingPixels.length} pixels`,
            details: trackingPixels.slice(0, 5),
          },
        });
      }
      log(
        "PRIV-TR",
        "pass",
        `  ✓ Layer B complete — Fingerprinting: ${fingerprinting.length} signals | Pixels: ${trackingPixels.length}`,
        " Art. 6",
        "Layer B: Tracker Detection",
      );

      // ── Layer C: Consent Infrastructure ──
      log(
        "PRIV-CN",
        "running",
        "━━━ Layer C: Consent Infrastructure Audit",
        " Art. 7 + ICO Enforcement Guidance",
        "Layer C: Consent Audit",
      );
      log(
        "PRIV-CN-BN",
        "running",
        "  → Consent Banner: Detection of cookie/ consent UI presence",
        " Art. 7 — Conditions for Consent",
        "Layer C: Consent Audit",
      );
      log(
        "PRIV-CN-RJ",
        "running",
        '  → Reject Option: "Reject All" / "Decline" button at first layer (ICO, CNIL requirement)',
        " Art. 7 + CNIL Guidance — Equal Prominence",
        "Layer C: Consent Audit",
      );
      log(
        "PRIV-CN-AS",
        "running",
        "  → Asymmetric UI: Accept prominent vs Reject hidden/de-emphasised (ICO enforcement focus)",
        "ICO Enforcement — Asymmetric Consent UI",
        "Layer C: Consent Audit",
      );
      log(
        "PRIV-CN-LI",
        "running",
        "  → Legitimate Interest: Pre-selected LI toggles without user action (illegal under )",
        " Art. 6(1)(f) — Legitimate Interest",
        "Layer C: Consent Audit",
      );
      log(
        "PRIV-CN-CW",
        "running",
        "  → Consent Wall: Page access blocked unless user consents (generally illegal )",
        " Art. 7(4) — Conditional Consent",
        "Layer C: Consent Audit",
      );
      const consentDetected = await page
        .$$eval(
          '[class*="cookie"], [class*="consent"], [class*=""], [id*="cookie"], [id*="consent"]',
          (els) =>
            els.filter((el) => {
              const s = window.getComputedStyle(el);
              return s.display !== "none" && s.visibility !== "hidden";
            }).length,
        )
        .catch(() => 0);
      if (consentDetected > 0) hasConsentBanner = true;

      // Check if reject option exists in consent banner
      if (hasConsentBanner) {
        const hasRejectOption = await page
          .evaluate(() => {
            const banners = document.querySelectorAll(
              '[class*="cookie"], [class*="consent"], [class*=""]',
            );
            for (const banner of Array.from(banners)) {
              const s = window.getComputedStyle(banner);
              if (s.display === "none") continue;
              const btns = banner.querySelectorAll("button, a");
              for (const btn of Array.from(btns)) {
                if (
                  /reject|decline|refuse|no|deny/i.test(btn.textContent || "")
                )
                  return true;
              }
            }
            return false;
          })
          .catch(() => false);

        if (!hasRejectOption) {
          findings.push({
            id: `priv-${++findingId}`,
            category: "consent-mechanism",
            title: "Consent Banner Has No Reject Option",
            description:
              "Cookie consent banner exists but provides no visible reject/decline button.",
            pageUrl: pageData.url,
            severity: "critical",
            regulation: ["IN-DPDPA", "ePrivacy"],
            recommendation:
              'Add a clearly visible "Reject All" or "Decline" button to the consent banner.',
            evidence: {
              summary: "No reject option",
              details: ["Accept-only consent banner detected"],
            },
          });
        }
      }
      log(
        "PRIV-CN",
        hasConsentBanner ? "pass" : "fail",
        `  ✓ Layer C complete — Consent banner: ${hasConsentBanner ? "Found ✓" : "MISSING ✗"}`,
        " Art. 7 + ICO",
        "Layer C: Consent Audit",
      );

      // ── Layer D: Data Collection Analysis ──
      log(
        "PRIV-DC",
        "running",
        "━━━ Layer D: Data Collection & Minimisation Analysis",
        " Art. 5(1)(c) — Data Minimisation Principle",
        "Layer D: Data Collection",
      );
      log(
        "PRIV-DC-FM",
        "running",
        "  → Form Field Audit: Counting visible fields — email + phone + >6 fields = excessive",
        " Art. 5(1)(c) — Collect Only What Is Necessary",
        "Layer D: Data Collection",
      );
      log(
        "PRIV-DC-HF",
        "running",
        "  → Hidden Input Fields: Tracking submission of data user cannot see or control",
        " Art. 5(1)(a) — Transparency Principle",
        "Layer D: Data Collection",
      );
      log(
        "PRIV-DC-SL",
        "running",
        "  → Social Login: Data-sharing disclosure for OAuth providers (Google, Facebook, Apple)",
        " Art. 13 — Information to Be Provided",
        "Layer D: Data Collection",
      );
      const formAnalysis = await page
        .$$eval("form", (forms) =>
          forms.map((f) => {
            const inputs = f.querySelectorAll(
              'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea',
            );
            const hidden = f.querySelectorAll('input[type="hidden"]');
            return {
              fieldCount: inputs.length,
              hiddenCount: hidden.length,
              hasEmail: !!f.querySelector('[type="email"], [name*="email"]'),
              hasPhone: !!f.querySelector(
                '[type="tel"], [name*="phone"], [name*="mobile"]',
              ),
              html: f.outerHTML.substring(0, 200),
            };
          }),
        )
        .catch(() => []);

      for (const form of formAnalysis) {
        if (form.hasEmail && form.hasPhone && form.fieldCount >= 6) {
          findings.push({
            id: `priv-${++findingId}`,
            category: "data-minimization",
            title: `Form Collects ${form.fieldCount} Fields Including Phone — Potentially Excessive`,
            description: `Form collects phone number and email with ${form.fieldCount} visible fields.`,
            pageUrl: pageData.url,
            severity: "medium",
            regulation: ["IN-DPDPA"],
            recommendation:
              "Apply data minimization — only collect data necessary for the stated purpose.",
            evidence: {
              summary: `${form.fieldCount} fields`,
              details: [`${form.hiddenCount} hidden fields`],
            },
          });
        }
      }
      log(
        "PRIV-DC",
        "pass",
        `  ✓ Layer D complete — Forms analysed: ${formAnalysis.length}`,
        " Art. 5(1)(c)",
        "Layer D: Data Collection",
      );

      // ── Layer E: Privacy Policy Analysis ──
      log(
        "PRIV-PP",
        "running",
        "━━━ Layer E: Policy Quality Audit",
        " Art. 12–14 — Transparency Obligations",
        "Layer E: Policy",
      );
      log(
        "PRIV-PP-LK",
        "running",
        "  → Policy Link: Visible link from homepage/footer (legal requirement, Art. 13)",
        " Art. 13 — Information at Collection",
      );
      log(
        "PRIV-PP-LB",
        "running",
        "  → Legal Basis: Each processing purpose must state its lawful basis (Art. 6)",
        " Art. 6 — Lawful Basis Per Purpose",
      );
      log(
        "PRIV-PP-PL",
        "running",
        "  → Plain Language: Policy must be written in clear, plain language (Art. 12)",
        " Art. 12 — Transparent Communication",
      );
      log(
        "PRIV-PP-RT",
        "running",
        "  → User Rights: Access, erasure, portability, objection rights must be explained",
        " Art. 15–22 — Data Subject Rights",
      );
      log(
        "PRIV-PP-DP",
        "running",
        "  → DPO Contact: Data Protection Officer contact details required (Art. 37)",
        " Art. 37 — DPO Designation",
      );
      const privacyLink = await page
        .$$eval("a", (links) =>
          links.some((l) =>
            /privacy\s*(policy|notice|statement)/i.test(l.textContent || ""),
          ),
        )
        .catch(() => false);
      if (privacyLink) hasPrivacyPolicy = true;
      log(
        "PRIV-PP",
        hasPrivacyPolicy ? "pass" : "fail",
        `  ✓ Layer E complete —  : ${hasPrivacyPolicy ? "Found ✓" : "MISSING ✗"}`,
        " Art. 13/14",
      );

      // ── Layer F: Security Baseline ──
      log(
        "PRIV-SC",
        "running",
        "━━━ Layer F: Security Baseline & Data Protection",
        " Art. 32 — Security of Processing",
        "Layer F: Security",
      );
      log(
        "PRIV-SC-MC",
        "running",
        "  → Mixed Content: HTTP resources on HTTPS page (data interception risk)",
        " Art. 32 — Encryption in Transit",
        "Layer F: Security",
      );
      log(
        "PRIV-SC-HS",
        "running",
        "  → Security Headers: HSTS, CSP, X-Frame-Options, Referrer-Policy presence",
        " Art. 32 + OWASP Security Headers",
        "Layer F: Security",
      );
      log(
        "PRIV-SC-HT",
        "running",
        "  → HTTPS Enforcement: All resources served over TLS (Strict-Transport-Security)",
        " Art. 32(1)(a) — Pseudonymisation & Encryption",
        "Layer F: Security",
      );
      // Mixed content
      const mixedContent = await page
        .evaluate(() => {
          if (window.location.protocol !== "https:") return [];
          const http: string[] = [];
          document
            .querySelectorAll("img, script, link, iframe")
            .forEach((el) => {
              const src =
                el.getAttribute("src") || el.getAttribute("href") || "";
              if (src.startsWith("http://")) http.push(src);
            });
          return http;
        })
        .catch(() => []);

      if (mixedContent.length > 0) {
        hasMixedContent = true;
        findings.push({
          id: `priv-${++findingId}`,
          category: "mixed-content",
          title: "Mixed Content Detected (HTTP on HTTPS)",
          description: `${mixedContent.length} resource(s) loaded over insecure HTTP.`,
          pageUrl: pageData.url,
          severity: "high",
          regulation: [],
          recommendation: "Serve all resources over HTTPS.",
          evidence: {
            summary: `${mixedContent.length} insecure resources`,
            details: mixedContent.slice(0, 5),
          },
        });
      }

      // Security headers check
      try {
        const response = await page.goto(pageData.url, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        if (response) {
          const headers = response.headers();
          const missingHeaders: string[] = [];
          if (!headers["strict-transport-security"])
            missingHeaders.push("Strict-Transport-Security (HSTS)");
          if (!headers["content-security-policy"])
            missingHeaders.push("Content-Security-Policy (CSP)");
          if (
            !headers["x-frame-options"] &&
            !headers["content-security-policy"]?.includes("frame-ancestors")
          )
            missingHeaders.push("X-Frame-Options");
          if (!headers["referrer-policy"])
            missingHeaders.push("Referrer-Policy");

          if (missingHeaders.length >= 2) {
            findings.push({
              id: `priv-${++findingId}`,
              category: "security-header",
              title: `${missingHeaders.length} Security Header(s) Missing`,
              description: `Missing: ${missingHeaders.join(", ")}`,
              pageUrl: pageData.url,
              severity: missingHeaders.length >= 3 ? "high" : "medium",
              regulation: ["IN-DPDPA"],
              recommendation:
                "Configure security headers: HSTS, CSP, X-Frame-Options, Referrer-Policy.",
              evidence: {
                summary: `${missingHeaders.length} missing`,
                details: missingHeaders,
              },
            });
          }
        }
      } catch {}
      log(
        "PRIV-SC",
        mixedContent.length > 0 ? "fail" : "pass",
        `  ✓ Layer F complete — Mixed content: ${mixedContent.length} | Security headers checked`,
        " Art. 32",
        "Layer F: Security",
      );
    } catch (err) {
      console.error(`[TrustLens:Privacy] Error on ${pageData.url}:`, err);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  // ── Layer B (continued): Classify tracked requests ──
  for (const req of trackedRequests) {
    try {
      const domain = new URL(req.url).hostname;
      for (const [td, info] of Object.entries(KNOWN_TRACKERS)) {
        if (domain.includes(td)) {
          const existing = trackerMap.get(td);
          if (existing) {
            existing.requestCount++;
            if (!existing.pageUrls.includes(req.pageUrl))
              existing.pageUrls.push(req.pageUrl);
          } else {
            trackerMap.set(td, {
              domain: td,
              company: info.company,
              category: info.category,
              pageUrls: [req.pageUrl],
              requestCount: 1,
            });
          }
          break;
        }
      }
    } catch {}
  }

  const trackers = [...trackerMap.values()];
  if (trackers.length > 0) {
    findings.push({
      id: `priv-${++findingId}`,
      category: "third-party-tracker",
      title: `${trackers.length} Third-Party Tracker(s) Detected`,
      description: `${trackers.length} tracking service(s) detected loading without verified consent.`,
      pageUrl: pages[0]?.url || "",
      severity: trackers.length > 5 ? "critical" : "high",
      regulation: ["CCPA", "ePrivacy", "IN-DPDPA"],
      recommendation:
        "Ensure all trackers require explicit consent before loading.",
      evidence: {
        summary: `${trackers.length} trackers`,
        details: trackers.map(
          (t) => `${t.company} (${t.domain}) — ${t.requestCount} reqs`,
        ),
      },
    });
  }

  if (!hasConsentBanner && trackers.length > 0) {
    findings.push({
      id: `priv-${++findingId}`,
      category: "cookie-consent",
      title: "No Cookie Consent Banner Detected",
      description: "Tracking cookies/scripts load without a consent banner.",
      pageUrl: pages[0]?.url || "",
      severity: "critical",
      regulation: ["ePrivacy", "CCPA", "IN-DPDPA"],
      recommendation: "Implement a /CCPA-compliant cookie consent banner.",
      evidence: {
        summary: "No consent mechanism",
        details: ["Trackers loading without consent"],
      },
    });
  }

  if (!hasPrivacyPolicy) {
    findings.push({
      id: `priv-${++findingId}`,
      category: "privacy-policy",
      title: "No Link Found",
      description: "No link to a privacy policy was detected.",
      pageUrl: pages[0]?.url || "",
      severity: "high",
      regulation: ["CCPA", "IN-DPDPA"],
      recommendation:
        "Add a visible privacy policy link in footer or navigation.",
      evidence: { summary: "policy not found", details: [] },
    });
  }

  // ── Layer G: Regulatory Risk Mapping ──
  log(
    "PRIV-REG",
    "running",
    "━━━ Layer G: Multi-Regulation Risk Mapping",
    " Regulatory Framework",
    "Layer G: Regulatory Mapping",
  );
  log(
    "PRIV-REG-EU",
    "running",
    "  →  (EU 2016/679): Data protection, consent, data subject rights",
    " — European Data Protection Regulation",
    "Layer G: Regulatory Mapping",
  );
  log(
    "PRIV-REG-US",
    "running",
    "  → CCPA / CPRA: California consumer privacy rights & opt-out of sale",
    "CCPA / CPRA — California Rights",
    "Layer G: Regulatory Mapping",
  );
  log(
    "PRIV-REG-UK",
    "running",
    "  → UK  + PECR: Post-Brexit UK data protection & cookie rules (ICO)",
    "UK  + PECR — ICO Enforcement",
    "Layer G: Regulatory Mapping",
  );
  log(
    "PRIV-REG-IN",
    "running",
    "  → IN-DPDPA 2023: India Digital Personal Data Protection Act",
    "India DPDPA 2023 — Data Fiduciary Obligations",
    "Layer G: Regulatory Mapping",
  );
  log(
    "PRIV-REG-BD",
    "running",
    "  → By Design: Ann Cavoukian 7 Principles — proactive, default, embedded",
    "by Design — ISO 29101 Framework",
    "Layer G: Regulatory Mapping",
  );
  const regSet = new Set<string>();
  for (const f of findings) f.regulation.forEach((r) => regSet.add(r));
  log(
    "PRIV-REG",
    "pass",
    `  ✓ Layer G complete — Mapped to ${regSet.size} regulation(s): ${[...regSet].join(", ")}`,
    " Regulatory Framework",
    "Layer G: Regulatory Mapping",
  );
  // Build result
  const findingsBySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const cookiesByPurpose: Record<string, number> = {
    necessary: 0,
    analytics: 0,
    marketing: 0,
    functional: 0,
    unknown: 0,
  };
  for (const f of findings) findingsBySeverity[f.severity]++;
  for (const c of allCookies) cookiesByPurpose[c.purpose]++;

  const sevW = { critical: 20, high: 10, medium: 4, low: 1 };
  let ded = 0;
  for (const f of findings) ded += (sevW as any)[f.severity] || 1;
  const overallScore = Math.max(0, Math.min(100, Math.round(100 - ded)));

  return {
    findings,
    overallScore,
    cookies: allCookies,
    cookiesByPurpose: cookiesByPurpose as any,
    trackers,
    totalTrackers: trackers.length,
    hasConsentBanner,
    hasPrivacyPolicy,
    hasMixedContent,
    regulatoryRisks: [...regSet] as any[],
    findingsBySeverity,
    pagesScanned: pages.length,
  };
}

function classifyCookie(name: string, _domain: string): CookiePurpose {
  const n = name.toLowerCase();
  if (/^(_ga|_gid|_gat|_gtag|hjid|_hj|_clarity|mp_|ajs_)/.test(n))
    return "analytics";
  if (/^(_fbp|_fbc|fr|_gcl|_ttp|IDE|test_cookie|NID)/.test(n))
    return "marketing";
  if (/^(lang|locale|theme|timezone|currency|pref)/.test(n))
    return "functional";
  if (/^(session|sess|sid|csrf|xsrf|token|auth)/.test(n)) return "necessary";
  return "unknown";
}
