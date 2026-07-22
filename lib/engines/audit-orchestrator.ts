import {
  AuditConfig,
  AuditResult,
  AccessibilityIssue,
  PageData,
  CrawlCoverage,
  TestLogEntry,
} from "../types/audit";
import { crawlWebsite, closeCrawler } from "./crawler";
import { scanWithAxe, PageApplicabilityHints } from "./axe-scanner";
import { runCustomRules } from "./custom-rules";
import { analyzePdf } from "./pdf-analyzer";
import { analyzeWithAI, assignConfidence } from "./ai-analyzer";
import { calculateScore, normalizeSelector } from "./scoring";
import { generateReport } from "./report-generator";
import { runJourneyTests, runDarkPatternJourney } from "./journey-tester";
import { runTestSuite, TEST_CASES } from "./test-runner";
import {
  getAudit as storeGet,
  setAudit as storeSet,
  getAllAudits as storeGetAll,
} from "../store/audit-store";
const uuidv4 = (): string => crypto.randomUUID();
// ── TrustLens Pillar Engines ──
import { runDarkPatternAudit } from "./darkpattern-engine";
import { runPerformanceAudit } from "./performance-engine";
import { runPrivacyAudit } from "./privacy-engine";
import { calculateTrustScore } from "./trust-scoring";
import type { AuditPillar } from "../types/trustscore";
import type { DarkPatternResult } from "../types/darkpattern";
import type { PerformanceResult } from "../types/performance";
import type { PrivacyResult } from "../types/privacy";
// ── New Phase 2 engines ──
import { classifySite } from "./site-profiler";
import { getTransactionalPages } from "./page-intent-classifier";
// ── Gap 3 & 4: Temporal Scanner + CTA Prominence Scorer ──
import { runTemporalPatternScan } from "./temporal-scanner";
import { scoreCTAHierarchy } from "./cta-prominence-scorer";
import type {
  DarkPatternFinding,
  DarkPatternRegulation,
} from "../types/darkpattern";
import type { TemporalFinding } from "./temporal-scanner";
import type { CTAPair } from "./cta-prominence-scorer";

// ── Convert TemporalFinding → DarkPatternFinding for unified rendering ──
function normalizeTemporalFinding(
  tf: TemporalFinding,
  idx: number,
): DarkPatternFinding {
  const brignullMap: Record<
    string,
    { pattern: string; number: number; dsa: string }
  > = {
    "countdown-timer": {
      pattern: "False Urgency",
      number: 11,
      dsa: "Art. 25(1)(e)",
    },
    "social-proof-inflation": {
      pattern: "Social Proof Inflation",
      number: 7,
      dsa: "Art. 25(1)(e)",
    },
    "delayed-urgency-popup": {
      pattern: "Nagging",
      number: 9,
      dsa: "Art. 25(1)(d)",
    },
    "scroll-triggered-urgency": {
      pattern: "False Urgency",
      number: 11,
      dsa: "Art. 25(1)(e)",
    },
    "fake-stock-counter": {
      pattern: "False Urgency",
      number: 11,
      dsa: "Art. 25(1)(e)",
    },
  };
  const brignull = brignullMap[tf.pattern] ?? {
    pattern: "False Urgency",
    number: 11,
    dsa: "Art. 25(1)(e)",
  };
  const fixPriority: "P0" | "P1" | "P2" | "P3" =
    tf.severity === "critical" ? "P0" : tf.severity === "high" ? "P1" : "P2";

  return {
    id: `temporal-${idx + 1}`,
    ruleId: `TEMPORAL-${tf.pattern.toUpperCase()}`,
    category:
      tf.pattern === "social-proof-inflation"
        ? "social-pressure"
        : "scarcity-urgency",
    principle: "user-autonomy",
    title: tf.title,
    description: tf.description,
    element: tf.element,
    pageUrl: tf.pageUrl,
    severity: tf.severity,
    regulation: tf.regulation as DarkPatternRegulation[],
    confidence: tf.changed ? "high" : "medium",
    recommendation:
      tf.developerFix ||
      "Remove or verify this dynamic element. Only show real-time data from verified sources.",
    userImpact:
      "Users are exposed to manipulative dynamic content that changes over time to create artificial urgency.",
    evidence: {
      summary: `Temporal detection (T=0s→T=30s): ${tf.changeDescription}`,
      details: [
        `Pattern: ${tf.pattern}`,
        `Value at T=0s: "${tf.t0Value}"`,
        tf.t15Value ? `Value at T=15s: "${tf.t15Value}"` : "",
        `Value at T=30s: "${tf.t30Value}"`,
        `Changed: ${tf.changed ? "YES — value mutated during observation" : "No change detected"}`,
      ].filter(Boolean),
      measurements: {
        t0Value: tf.t0Value,
        t30Value: tf.t30Value,
        changed: tf.changed ? "yes" : "no",
        changeDescription: tf.changeDescription,
      },
    },
    source: "temporal",
    detectionBasis: "structural",
    findingVerdict: tf.changed ? "verdict" : "signal",
    verifiabilityNote: tf.changed
      ? "DOM-proven: element value changed during 30-second observation window"
      : "Temporal signal: element present but no change observed in 30s window",
    brignullPattern: brignull.pattern,
    brignullNumber: brignull.number,
    dsaArticle: brignull.dsa,
    fixPriority,
    developerFix: tf.developerFix,
    designerFix: tf.designerFix,
    temporalT0Value: tf.t0Value,
    temporalT30Value: tf.t30Value,
  };
}

// ── Convert CTAPair → DarkPatternFinding for unified rendering ──
function normalizeCTAFinding(
  pair: CTAPair,
  idx: number,
): DarkPatternFinding | null {
  if (pair.severity === "pass") return null;
  const fixPriority: "P0" | "P1" | "P2" | "P3" =
    pair.severity === "critical"
      ? "P0"
      : pair.severity === "high"
        ? "P1"
        : "P2";

  return {
    id: `cta-${idx + 1}`,
    ruleId: `CTA-${pair.patternType.toUpperCase()}`,
    category:
      pair.patternType === "privacy-zuckering"
        ? "privacy-zuckering"
        : "interface-interference",
    principle: "symmetry-of-choice",
    title: `CTA Prominence Asymmetry: "${pair.primaryLabel}" vs "${pair.secondaryLabel}"`,
    description: `The primary CTA ("${pair.primaryLabel}") is ${pair.prominenceRatio.toFixed(1)}× more visually prominent than the secondary CTA ("${pair.secondaryLabel}"). Area ratio: ${pair.areaRatio.toFixed(1)}:1, Font ratio: ${pair.fontRatio.toFixed(1)}:1.`,
    element: "",
    pageUrl: pair.pageUrl,
    severity:
      pair.severity === "critical"
        ? "critical"
        : pair.severity === "high"
          ? "high"
          : "medium",
    regulation: pair.regulation as DarkPatternRegulation[],
    confidence: "high",
    recommendation:
      pair.developerFix ||
      "Apply equal CSS styling to both CTA buttons — same min-width, padding, and font-size.",
    userImpact:
      "Users are visually steered toward the primary action with disproportionate visual weight, reducing true freedom of choice.",
    evidence: {
      summary: `CTA Prominence Scorer: ${pair.prominenceRatio.toFixed(1)}× visual weight asymmetry between "${pair.primaryLabel}" and "${pair.secondaryLabel}"`,
      details: [
        `Primary: "${pair.primaryLabel}" — ${Math.round(pair.primaryArea)}px² area, ${pair.primaryFontSize}px font`,
        `Secondary: "${pair.secondaryLabel}" — ${Math.round(pair.secondaryArea)}px² area, ${pair.secondaryFontSize}px font`,
        `Area ratio: ${pair.areaRatio.toFixed(1)}:1`,
        `Font ratio: ${pair.fontRatio.toFixed(1)}:1`,
        `Primary above fold: ${pair.primaryAboveFold ? "Yes" : "No"}`,
        `Secondary above fold: ${pair.secondaryAboveFold ? "Yes" : "No"}`,
        `Composite prominence ratio: ${pair.prominenceRatio.toFixed(1)}`,
      ],
      measurements: {
        areaRatio: parseFloat(pair.areaRatio.toFixed(2)),
        fontRatio: parseFloat(pair.fontRatio.toFixed(2)),
        prominenceRatio: parseFloat(pair.prominenceRatio.toFixed(2)),
        primaryContrast: pair.primaryContrast,
        secondaryContrast: pair.secondaryContrast,
      },
    },
    source: "cta-scorer",
    detectionBasis: "visual",
    findingVerdict: "verdict",
    verifiabilityNote:
      "CTA Prominence Scorer: computed from live DOM measurements (getBoundingClientRect + computed styles)",
    brignullPattern: "Interface Interference",
    brignullNumber: 12,
    dsaArticle: "Art. 25(1)(a)",
    fixPriority,
    developerFix: pair.developerFix,
    designerFix: pair.designerFix,
    ctaAreaRatio: pair.areaRatio,
    ctaPrimaryLabel: pair.primaryLabel,
    ctaSecondaryLabel: pair.secondaryLabel,
  };
}

export function getAudit(id: string): AuditResult | undefined {
  return storeGet(id);
}

export function getAllAudits(): AuditResult[] {
  return storeGetAll();
}

function createEmptyScore() {
  return {
    overall: 0,
    categoryScores: {
      perceivable: 0,
      operable: 0,
      understandable: 0,
      robust: 0,
      pdf: 0,
    },
    complianceLevel: "non-compliant" as const,
    totalIssues: 0,
    uniqueIssues: 0,
    issueBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    issueByLevel: { A: 0, AA: 0, AAA: 0 },
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
  };
}

export async function runWebsiteAudit(config: AuditConfig): Promise<string> {
  const id = uuidv4();
  const audit: AuditResult = {
    id,
    config,
    status: "pending",
    progress: 0,
    progressMessage: "Initializing...",
    pages: [],
    issues: [],
    score: createEmptyScore(),
    testResults: [],
    testLog: [],
    inapplicableCriteria: [],
    startedAt: new Date().toISOString(),
  };
  storeSet(id, audit);

  // Run pipeline with a 15-minute global timeout so audits never spin forever
  const TIMEOUT_MS = 15 * 60 * 1000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Audit timed out after 15 minutes")),
      TIMEOUT_MS,
    ),
  );
  Promise.race([runAuditPipeline(id, config), timeoutPromise]).catch((err) => {
    const a = storeGet(id);
    if (a && a.status !== "complete" && a.status !== "error") {
      a.status = "error";
      a.error = err.message;
      a.progressMessage = `Error: ${err.message}`;
      storeSet(id, a);
    }
  });

  return id;
}

async function runAuditPipeline(id: string, config: AuditConfig) {
  const audit = storeGet(id)!;
  const wcagLevels = config.wcagLevels || ["A", "AA"];
  const testedLevel = wcagLevels.includes("AAA")
    ? "AAA"
    : wcagLevels.includes("AA")
      ? "AA"
      : "A";

  const updateProgress = (msg: string, pct: number) => {
    audit.progressMessage = msg;
    audit.progress = pct;
    storeSet(id, audit); // ensure polling always sees fresh progress
  };

  const addLog = (entry: TestLogEntry) => {
    audit.testLog.push(entry);
    if (entry.status === "running") audit.progressMessage = entry.message;
    storeSet(id, audit);
  };

  // Aggregate N/A and pass data across all pages
  const allInapplicable = new Set<string>();
  const allPassed = new Set<string>();
  let mergedApplicabilityHints: PageApplicabilityHints = {
    hasMedia: false,
    hasForms: false,
    hasTimedContent: false,
    hasAnimation: false,
    isSinglePage: false,
  };

  try {
    // ─────────────────────────────────────────
    // PHASE 1: DEEP CRAWL (branches on scopeMode)
    // ─────────────────────────────────────────
    audit.status = "crawling";

    // For 'specific' mode: skip crawl entirely, fetch each named URL directly
    if (
      config.scopeMode === "specific" &&
      config.specificUrls &&
      config.specificUrls.length > 0
    ) {
      updateProgress(
        `Specific Pages mode: fetching ${config.specificUrls.length} named URL(s)...`,
        10,
      );
    } else if (
      config.scopeMode === "director" &&
      config.journeySteps &&
      config.journeySteps.length > 0
    ) {
      updateProgress(
        `Director Mode: crawling ${config.journeySteps.length} step URL(s)...`,
        5,
      );
    } else {
      updateProgress("Starting deep website crawl...", 5);
    }

    // Build seed URL list — for director/predefined, seed with journey step URLs
    const seedUrl = config.url!;
    const extraSeedUrls: string[] = [];
    if (
      (config.scopeMode === "director" || config.scopeMode === "predefined") &&
      config.journeySteps
    ) {
      const resolvedUrls = config.journeySteps
        .map((s) => {
          try {
            return new URL(s.url, seedUrl).href;
          } catch {
            return s.url;
          }
        })
        .filter(Boolean);
      extraSeedUrls.push(...resolvedUrls);
    }
    if (config.scopeMode === "specific" && config.specificUrls) {
      extraSeedUrls.push(...config.specificUrls);
    }

    const crawlResult = await crawlWebsite({
      url: seedUrl,
      maxPages:
        config.scopeMode === "specific"
          ? config.specificUrls?.length || 1 // exact count — no extra crawling
          : config.maxPages,
      crawlDepth: config.scopeMode === "specific" ? 1 : config.crawlDepth,
      loginConfig: config.loginConfig,
      onProgress: (msg, pct) => updateProgress(msg, pct),
      extraSeedUrls,
    });

    audit.pages = crawlResult.pages;
    mergedApplicabilityHints.isSinglePage = crawlResult.pages.length === 1;

    const crawlCoverage: CrawlCoverage = {
      totalPagesFound: crawlResult.totalFound,
      pagesAudited: crawlResult.pages.length,
      pagesSkipped: crawlResult.skippedPages.length,
      coveragePercent:
        crawlResult.totalFound > 0
          ? Math.round(
              (crawlResult.pages.length / crawlResult.totalFound) * 100,
            )
          : 0,
      skippedPages: crawlResult.skippedPages.slice(0, 50),
      discoveryMethods: crawlResult.discoveryMethods,
    };
    audit.crawlCoverage = crawlCoverage;

    if (crawlResult.pages.length === 0) {
      await closeCrawler(crawlResult.browser);
      audit.status = "error";
      audit.error = `Could not crawl any pages from ${config.url}. The site is blocking automated access (WAF/Cloudflare/Akamai). Try: (1) auditing a specific inner page URL, (2) uploading a screenshot via the Image tab, or (3) check that the URL is publicly accessible.`;
      audit.progressMessage = audit.error;
      audit.score = calculateScore([], 0);
      return;
    }

    updateProgress(
      `Crawl complete: ${crawlResult.pages.length} pages. Starting tests...`,
      50,
    );

    // ─────────────────────────────────────────
    // PHASE 2: TEST-DRIVEN EXECUTION
    // ─────────────────────────────────────────
    audit.status = "scanning";
    const allIssues: AccessibilityIssue[] = [];
    const enabledPillars: AuditPillar[] = config.enabledPillars || [
      "accessibility",
      "darkpatterns",
      "performance",
      "privacy",
    ];
    const a11yEnabled = enabledPillars.includes("accessibility");

    if (!a11yEnabled) {
      updateProgress(
        "Accessibility pillar disabled — skipping WCAG tests...",
        82,
      );
    }

    // Classify site profile early — available to all phases (AI analysis, pillar engines)
    const siteProfile = classifySite(
      config.url || "",
      crawlResult.pages[0]?.html,
    );

    let journeyResult: { journeyResults: any[]; issues: any[] } = {
      journeyResults: [],
      issues: [],
    };

    if (a11yEnabled) {
      for (let i = 0; i < crawlResult.pages.length; i++) {
        const pg = crawlResult.pages[i];
        const basePct = 50 + Math.round((i / crawlResult.pages.length) * 30);

        addLog({
          timestamp: new Date().toISOString(),
          testId: "SUITE",
          testName: "Test Suite",
          wcag: "",
          status: "running",
          message: `━━━ Page ${i + 1}/${crawlResult.pages.length}: ${pg.title} ━━━`,
          pageUrl: pg.url,
        });

        // Run structured test suite
        const pageResults = await runTestSuite(
          crawlResult.context,
          pg,
          (entry) => {
            addLog(entry);
            const testIdx = audit.testLog.filter(
              (l) => l.pageUrl === pg.url && l.status !== "running",
            ).length;
            const pct =
              basePct +
              Math.round(
                (testIdx / TEST_CASES.length) * (30 / crawlResult.pages.length),
              );
            audit.progress = Math.min(pct, 82);
          },
        );

        audit.testResults.push(...pageResults);
        for (const tr of pageResults) allIssues.push(...tr.issues);

        // axe-core + custom rules — using new return type
        try {
          const axeResult = await scanWithAxe(crawlResult.context, pg, undefined, wcagLevels);
          allIssues.push(...axeResult.issues);

          // Merge N/A and pass data
          axeResult.inapplicableCriteria.forEach((c) => allInapplicable.add(c));
          axeResult.passedCriteria.forEach((c) => allPassed.add(c));

          // Merge applicability hints (union — if ANY page has media/forms, it counts)
          if (axeResult.applicabilityHints.hasMedia)
            mergedApplicabilityHints.hasMedia = true;
          if (axeResult.applicabilityHints.hasForms)
            mergedApplicabilityHints.hasForms = true;
          if (axeResult.applicabilityHints.hasTimedContent)
            mergedApplicabilityHints.hasTimedContent = true;
          if (axeResult.applicabilityHints.hasAnimation)
            mergedApplicabilityHints.hasAnimation = true;

          const customIssues = await runCustomRules(pg);
          // Deduplicate: drop custom rules whose WCAG criterion is already covered by axe-core
          // on this page. axe-core is DOM-based and higher confidence for shared criteria.
          const axeCriteriaOnPage = new Set(axeResult.issues.map(i => i.wcagCriterion));
          const deduplicatedCustom = customIssues.filter(ci => !axeCriteriaOnPage.has(ci.wcagCriterion));
          allIssues.push(...deduplicatedCustom);
        } catch (err) {
          console.error(`Scanner error for ${pg.url}:`, err);
        }
      }

      // ─────────────────────────────────────────
      // PHASE 3: USER JOURNEY TESTING
      // ─────────────────────────────────────────
      updateProgress("Running user journey tests...", 83);
      addLog({
        timestamp: new Date().toISOString(),
        testId: "JOURNEY",
        testName: "User Journey Suite",
        wcag: "",
        status: "running",
        message: "━━━ Running User Journey Tests ━━━",
      });

      journeyResult = await runJourneyTests(
        crawlResult.context,
        crawlResult.pages,
        (msg) => updateProgress(msg, audit.progress),
      );
      allIssues.push(...journeyResult.issues);

      addLog({
        timestamp: new Date().toISOString(),
        testId: "JOURNEY",
        testName: "User Journey Suite",
        wcag: "",
        status: journeyResult.journeyResults.every((j) => j.passed)
          ? "pass"
          : "fail",
        message: `Journey tests: ${journeyResult.journeyResults.filter((j) => j.passed).length}/${journeyResult.journeyResults.length} passed`,
      });

      // ─────────────────────────────────────────
      // PHASE 4: AI ANALYSIS
      // ─────────────────────────────────────────
      if (config.includeAI) {
        if (!process.env.OPENAI_API_KEY) {
          addLog({
            timestamp: new Date().toISOString(),
            testId: "AI-WARN",
            testName: "AI Analysis",
            wcag: "",
            status: "error",
            message:
              "⚠️ AI Analysis skipped: OPENAI_API_KEY not set in .env.local",
          });
        } else {
          audit.status = "analyzing";
          updateProgress("Running AI-powered UX & cognitive analysis...", 86);

          const pagesToAnalyze = crawlResult.pages.slice(
            0,
            Math.min(5, crawlResult.pages.length),
          );
          for (let i = 0; i < pagesToAnalyze.length; i++) {
            const page = pagesToAnalyze[i];
            const pct = 86 + Math.round(((i + 1) / pagesToAnalyze.length) * 6);
            updateProgress(
              `AI analyzing page ${i + 1}/${pagesToAnalyze.length}: ${page.title}`,
              pct,
            );

            const aiIssues = await analyzeWithAI({
              pageUrl: page.url,
              pageTitle: page.title,
              htmlSnippet: page.html,
              pageScreenshot: page.screenshot,
              existingIssues: allIssues.filter(
                (issue) => issue.pageUrl === page.url,
              ),
              siteContext: {
                profile: siteProfile?.profile,
                siteName: config.url,
                aiDirection: config.aiDirection,
              },
            });
            allIssues.push(...aiIssues);
          }
        } // end if OPENAI_API_KEY
      }

      // ─────────────────────────────────────────
      // PHASE 4b: ELEMENT SCREENSHOT CAPTURE
      // ─────────────────────────────────────────
      // Capture element-level screenshots for critical/high issues while browser is still open
      updateProgress("Capturing visual evidence for critical issues...", 90);
      const screenshotTargets = allIssues.filter(
        (i) =>
          (i.severity === "critical" || i.severity === "high") &&
          i.element &&
          i.element !== "page-level" &&
          i.element !== "body",
      );
      for (const issue of screenshotTargets.slice(0, 20)) {
        // Cap at 20 to limit time
        try {
          const page = await crawlResult.context.newPage();
          await page.goto(issue.pageUrl, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
          await page
            .waitForLoadState("networkidle", { timeout: 8000 })
            .catch(() => {});
          const el = await page.$(issue.element).catch(() => null);
          if (el) {
            const buf = await el
              .screenshot({ type: "png", timeout: 5000 })
              .catch(() => null);
            if (buf) issue.elementScreenshot = buf.toString("base64");
          }
          await page.close();
        } catch {
          /* screenshot capture is best-effort */
        }
      }
    } // end if (a11yEnabled)

    // ─────────────────────────────────────────
    // PHASE 4c: TRUSTLENS PILLAR ENGINES (PARALLEL)
    // All 3 non-accessibility engines run concurrently.
    // Each tracks its own 0–100% progress in audit.pillarProgress.
    // A crashed engine sets auditIntegrity warning — score is NOT inflated.
    // ─────────────────────────────────────────

    // Set site profile on audit result (site was already classified above)
    audit.siteProfile = siteProfile.profile;
    addLog({
      timestamp: new Date().toISOString(),
      testId: "PROFILER",
      testName: "Site Profiler",
      wcag: "",
      status: "pass",
      message: ` Site profile: ${siteProfile.profile} (${siteProfile.confidence} confidence) — ${siteProfile.highRiskPatterns.slice(0, 3).join(", ")}`,
    });

    // Get transactional pages for dark pattern engine (Bug 2 fix)
    // Cap at 5 pages — each page scan takes 1–3 min; >5 pages risks exceeding the 15-min global budget.
    const transactionalPages = getTransactionalPages(
      crawlResult.pages.map((p) => ({ url: p.url, html: p.html })),
    ).slice(0, 5);
    // Pass pre-crawled HTML to DP engine — enables bot-detection fallback (WAF evasion mode)
    const dpPageList = transactionalPages.map((p) => {
      const crawledPage = crawlResult.pages.find((cp) => cp.url === p.url);
      return {
        url: p.url,
        title: crawledPage?.title || p.url,
        html: crawledPage?.html,
      };
    });
    const fullPageList = crawlResult.pages.map((p) => ({
      url: p.url,
      title: p.title,
    }));

    const failedPillars: string[] = [];
    audit.pillarProgress = { accessibility: a11yEnabled ? 100 : undefined };
    storeSet(id, audit);

    // Helper: update per-pillar progress
    // Also maps dark pattern pillar progress (0–100) → overall audit progress (87–97)
    // so the UI advances past the 87% stuck point during DP scanning.
    const setPillarProgress = (
      pillar: "darkpatterns" | "performance" | "privacy",
      pct: number,
    ) => {
      if (!audit.pillarProgress) audit.pillarProgress = {};
      audit.pillarProgress[pillar] = pct;
      if (pillar === "darkpatterns" && pct >= 0) {
        audit.progress = Math.min(97, 87 + Math.round((pct / 100) * 10));
        audit.progressMessage =
          pct < 100
            ? `Dark Pattern Engine: ${pct}% complete...`
            : "Dark pattern scan complete — building report...";
      }
      storeSet(id, audit);
    };

    let darkPatternResult: DarkPatternResult | null = null;
    let performanceResult: PerformanceResult | null = null;
    let privacyResult: PrivacyResult | null = null;

    updateProgress("Running pillar engines in parallel...", 87);

    // Build parallel tasks for enabled pillars only
    const pillarTasks: Promise<void>[] = [];

    if (enabledPillars.includes("darkpatterns")) {
      setPillarProgress("darkpatterns", 5);
      addLog({
        timestamp: new Date().toISOString(),
        testId: "DP-ENGINE",
        testName: "Dark Pattern Engine",
        wcag: "",
        status: "running",
        pillar: "darkpatterns",
        message: "━━━ 🕵️ Dark Pattern & Ethical UX Audit ━━━",
      });
      pillarTasks.push(
        runDarkPatternAudit(
          crawlResult.context,
          dpPageList,
          {
            aiClassification: config.includeAI,
            siteProfile: siteProfile.profile,
          },
          addLog,
        )
          .then(async (result) => {
            darkPatternResult = result;
            setPillarProgress("darkpatterns", 60);
            addLog({
              timestamp: new Date().toISOString(),
              testId: "DP-ENGINE",
              testName: "Dark Pattern Engine",
              wcag: "",
              status: result.totalFindings > 0 ? "fail" : "pass",
              pillar: "darkpatterns",
              message: `🕵️ Dark patterns: ${result.totalFindings} findings | Ethics: ${result.ethicsScore}/100 | Pages audited: ${dpPageList.length} transactional`,
            });

            // ── Gap 4: CTA Prominence Scorer — runs on first 3 pages ──
            addLog({
              timestamp: new Date().toISOString(),
              testId: "CTA-SCORER",
              testName: "CTA Prominence Scorer",
              wcag: "",
              status: "running",
              pillar: "darkpatterns",
              message: "  → Gap 4: Scoring CTA visual prominence hierarchy...",
              methodology: "CTA Visual Weight Analysis",
              phase: "CTA Prominence Scoring",
            });
            const ctaPages = crawlResult.pages.slice(0, 3);
            let totalCTAViolations = 0;
            for (const pg of ctaPages) {
              try {
                const ctaPage = await crawlResult.context.newPage();
                await ctaPage.goto(pg.url, {
                  waitUntil: "domcontentloaded",
                  timeout: 20000,
                });
                await ctaPage
                  .waitForLoadState("networkidle", { timeout: 8000 })
                  .catch(() => {});
                const ctaResult = await scoreCTAHierarchy(
                  ctaPage,
                  pg.url,
                  addLog,
                );
                await ctaPage.close();
                if (ctaResult.totalViolations > 0 && result) {
                  // Normalize CTA pairs → DarkPatternFinding and merge into main findings
                  const ctaFindings = ctaResult.pairs
                    .map((pair, i) =>
                      normalizeCTAFinding(pair, result!.findings.length + i),
                    )
                    .filter(Boolean) as DarkPatternFinding[];
                  result.findings.push(...ctaFindings);
                  result.totalFindings = result.findings.length;
                  result.findingsBySeverity = result.findingsBySeverity || {};
                  for (const f of ctaFindings) {
                    result.findingsBySeverity[f.severity] =
                      (result.findingsBySeverity[f.severity] || 0) + 1;
                  }
                  if (!result.findingsBySource) result.findingsBySource = {};
                  result.findingsBySource["cta-scorer"] =
                    (result.findingsBySource["cta-scorer"] || 0) +
                    ctaFindings.length;
                  totalCTAViolations += ctaResult.totalViolations;
                  addLog({
                    timestamp: new Date().toISOString(),
                    testId: "CTA-SCORER",
                    testName: "CTA Prominence Scorer",
                    wcag: "",
                    status: "fail",
                    pillar: "darkpatterns",
                    message: `  ✓ CTA scorer: ${ctaResult.totalViolations} asymmetric pair(s) on ${pg.url} — merged into findings`,
                    methodology: "CTA Visual Weight Analysis",
                    phase: "CTA Prominence Scoring",
                  });
                }
              } catch {
                /* non-fatal */
              }
            }
            if (totalCTAViolations === 0) {
              addLog({
                timestamp: new Date().toISOString(),
                testId: "CTA-SCORER",
                testName: "CTA Prominence Scorer",
                wcag: "",
                status: "pass",
                pillar: "darkpatterns",
                message:
                  "  ✓ CTA scorer: no prominence asymmetry violations detected",
                methodology: "CTA Visual Weight Analysis",
                phase: "CTA Prominence Scoring",
              });
            }
            setPillarProgress("darkpatterns", 80);

            // ── Gap 3: Temporal Scanner — runs on first transactional page ──
            if (dpPageList.length > 0) {
              addLog({
                timestamp: new Date().toISOString(),
                testId: "TEMPORAL-SCANNER",
                testName: "Temporal Pattern Scanner",
                wcag: "",
                status: "running",
                pillar: "darkpatterns",
                message:
                  "  → Gap 3: Temporal pattern scan (T=0s, T=15s, T=30s poll)...",
                methodology: "Temporal DOM Polling",
                phase: "Temporal Pattern Detection",
              });
              try {
                const temporalResult = await runTemporalPatternScan(
                  crawlResult.context,
                  dpPageList[0].url,
                  addLog,
                );
                if (temporalResult.findings.length > 0 && result) {
                  // Normalize temporal findings → DarkPatternFinding and merge into main findings
                  const temporalDPFindings = temporalResult.findings.map(
                    (tf, i) =>
                      normalizeTemporalFinding(tf, result!.findings.length + i),
                  );
                  result.findings.push(...temporalDPFindings);
                  result.totalFindings = result.findings.length;
                  result.findingsBySeverity = result.findingsBySeverity || {};
                  for (const f of temporalDPFindings) {
                    result.findingsBySeverity[f.severity] =
                      (result.findingsBySeverity[f.severity] || 0) + 1;
                  }
                  if (!result.findingsBySource) result.findingsBySource = {};
                  result.findingsBySource["temporal"] =
                    (result.findingsBySource["temporal"] || 0) +
                    temporalDPFindings.length;
                  if (!result.findingsByPhase) result.findingsByPhase = {};
                  result.findingsByPhase["Gap 3: Temporal"] =
                    (result.findingsByPhase["Gap 3: Temporal"] || 0) +
                    temporalDPFindings.length;
                  addLog({
                    timestamp: new Date().toISOString(),
                    testId: "TEMPORAL-SCANNER",
                    testName: "Temporal Pattern Scanner",
                    wcag: "",
                    status: "fail",
                    pillar: "darkpatterns",
                    message: `  ✓ Temporal scan: ${temporalResult.findings.length} dynamic dark pattern(s) detected — merged into findings`,
                    methodology: "Temporal DOM Polling",
                    phase: "Temporal Pattern Detection",
                  });
                } else {
                  addLog({
                    timestamp: new Date().toISOString(),
                    testId: "TEMPORAL-SCANNER",
                    testName: "Temporal Pattern Scanner",
                    wcag: "",
                    status: "pass",
                    pillar: "darkpatterns",
                    message:
                      "  ✓ Temporal scan: no dynamic dark patterns detected",
                    methodology: "Temporal DOM Polling",
                    phase: "Temporal Pattern Detection",
                  });
                }
              } catch (err) {
                addLog({
                  timestamp: new Date().toISOString(),
                  testId: "TEMPORAL-SCANNER",
                  testName: "Temporal Pattern Scanner",
                  wcag: "",
                  status: "error",
                  pillar: "darkpatterns",
                  message: `  ⚠ Temporal scan failed: ${(err as Error).message}`,
                });
              }
            }
            setPillarProgress("darkpatterns", 100);
          })
          .catch((err) => {
            failedPillars.push("darkpatterns");
            setPillarProgress("darkpatterns", -1);
            addLog({
              timestamp: new Date().toISOString(),
              testId: "DP-ENGINE",
              testName: "Dark Pattern Engine",
              wcag: "",
              status: "error",
              pillar: "darkpatterns",
              message: `⚠️ Dark pattern engine failed: ${(err as Error).message}`,
            });
          }),
      );
    }

    if (enabledPillars.includes("performance")) {
      setPillarProgress("performance", 5);
      addLog({
        timestamp: new Date().toISOString(),
        testId: "PERF-ENGINE",
        testName: "Performance Engine",
        wcag: "",
        status: "running",
        pillar: "performance",
        message: "━━━ ⚡ Performance & Core Web Vitals Audit ━━━",
      });
      if (config.performanceProblemContext?.flags?.length) {
        addLog({
          timestamp: new Date().toISOString(),
          testId: "PERF-CONTEXT",
          testName: "Performance Engine",
          wcag: "",
          status: "running",
          pillar: "performance",
          message: `🎯 Client-reported issues: ${config.performanceProblemContext.flags.join(", ")} — activating targeted test layers`,
        });
      }
      pillarTasks.push(
        runPerformanceAudit(
          crawlResult.context,
          fullPageList.slice(0, 5),
          addLog,
          config.performanceProblemContext,
          config.loginConfig,
        )
          .then((result) => {
            performanceResult = result;
            setPillarProgress("performance", 100);
            const confirmedCount =
              result.confirmedClientIssues?.filter(
                (c) => c.status === "confirmed",
              ).length ?? 0;
            const contextSuffix =
              confirmedCount > 0
                ? ` | ${confirmedCount} client issue(s) confirmed`
                : "";
            addLog({
              timestamp: new Date().toISOString(),
              testId: "PERF-ENGINE",
              testName: "Performance Engine",
              wcag: "",
              status: result.overallScore >= 80 ? "pass" : "fail",
              pillar: "performance",
              message: `⚡ Performance: ${result.overallScore}/100 | ${result.totalResourceIssues} resource issues${contextSuffix}`,
            });
          })
          .catch((err) => {
            failedPillars.push("performance");
            setPillarProgress("performance", -1);
            addLog({
              timestamp: new Date().toISOString(),
              testId: "PERF-ENGINE",
              testName: "Performance Engine",
              wcag: "",
              status: "error",
              pillar: "performance",
              message: `⚠️ Performance engine failed: ${(err as Error).message}`,
            });
          }),
      );
    }

    if (enabledPillars.includes("privacy")) {
      setPillarProgress("privacy", 5);
      addLog({
        timestamp: new Date().toISOString(),
        testId: "PRIV-ENGINE",
        testName: "Engine",
        wcag: "",
        status: "running",
        pillar: "privacy",
        message: "━━━ Compliance Audit ━━━",
      });
      pillarTasks.push(
        runPrivacyAudit(crawlResult.context, fullPageList.slice(0, 5), addLog)
          .then((result) => {
            privacyResult = result;
            setPillarProgress("privacy", 100);
            addLog({
              timestamp: new Date().toISOString(),
              testId: "PRIV-ENGINE",
              testName: "Engine",
              wcag: "",
              status: result.overallScore >= 80 ? "pass" : "fail",
              pillar: `${result.totalTrackers} trackers`,
            });
          })
          .catch((err) => {
            failedPillars.push("privacy");
            setPillarProgress("privacy", -1);
            addLog({
              timestamp: new Date().toISOString(),
              testId: "PRIV-ENGINE",
              testName: "Engine",
              wcag: "",
              status: "error",
              pillar: "privacy",
              message: `⚠️ engine failed: ${(err as Error).message}`,
            });
          }),
      );
    }

    // Dark Pattern Journey — runs in parallel when DP is enabled
    // Passes journeySteps from Director Mode directly; falls back to base URL
    if (enabledPillars.includes("darkpatterns")) {
      const dpJourneySteps = config.journeySteps?.map((s) => {
        try {
          return { url: new URL(s.url, config.url!).href, label: s.label };
        } catch {
          return { url: s.url, label: s.label };
        }
      });
      const dpHtmlCache = new Map(
        crawlResult.pages.map((p) => [p.url, p.html || ""]),
      );
      pillarTasks.push(
        runDarkPatternJourney(
          crawlResult.context,
          config.url!,
          dpJourneySteps,
          (msg) =>
            addLog({
              timestamp: new Date().toISOString(),
              testId: "DP-JOURNEY",
              testName: "Dark Pattern Journey",
              wcag: "",
              status: "running",
              pillar: "darkpatterns",
              message: msg,
            }),
          dpHtmlCache,
        )
          .then((journeyFindings) => {
            if (journeyFindings.findings.length > 0) {
              const converted = journeyFindings.findings.map((f) => ({
                id: crypto.randomUUID(),
                testId: "dp-journey",
                title: f.title,
                description: f.description,
                element: "page-level",
                pageUrl: config.url!,
                wcagCriterion: "dark-pattern",
                wcagName: `Dark Pattern: ${f.pattern}`,
                wcagLevel: "AA" as const,
                severity: f.severity as "critical" | "high" | "medium" | "low",
                impact: f.description,
                recommendation: `Fix ${f.pattern} pattern — ${f.regulation.join(", ")}`,
                category: "operable" as const,
                source: "journey-test" as const,
                confidence: f.confidence,
              }));
              allIssues.push(...converted);
              addLog({
                timestamp: new Date().toISOString(),
                testId: "DP-JOURNEY",
                testName: "Dark Pattern Journey",
                wcag: "",
                status: "fail",
                pillar: "darkpatterns",
                message: `🕵️ Journey simulation: ${journeyFindings.findings.length} dark patterns found`,
              });
            } else {
              addLog({
                timestamp: new Date().toISOString(),
                testId: "DP-JOURNEY",
                testName: "Dark Pattern Journey",
                wcag: "",
                status: "pass",
                pillar: "darkpatterns",
                message: `🕵️ Journey simulation: no dark patterns detected`,
              });
            }
          })
          .catch((err) => {
            addLog({
              timestamp: new Date().toISOString(),
              testId: "DP-JOURNEY",
              testName: "Dark Pattern Journey",
              wcag: "",
              status: "error",
              pillar: "darkpatterns",
              message: `⚠️ Journey simulation failed: ${(err as Error).message}`,
            });
          }),
      );
    }

    // Wait for ALL pillar engines to finish (parallel)
    await Promise.allSettled(pillarTasks);

    // Set audit integrity status
    if (failedPillars.length > 0) {
      audit.auditIntegrity = {
        status:
          failedPillars.length ===
          enabledPillars.filter((p) => p !== "accessibility").length
            ? "partial"
            : "warning",
        message: `${failedPillars.length} pillar(s) failed during audit: ${failedPillars.join(", ")}. Scores shown are for completed pillars only.`,
        failedPillars,
      };
    } else {
      audit.auditIntegrity = { status: "clean" };
    }

    await closeCrawler(crawlResult.browser);

    // ─────────────────────────────────────────
    // PHASE 5: VALIDATION & DEDUPLICATION
    // ─────────────────────────────────────────
    updateProgress("Validating results and cross-checking...", 92);

    for (const issue of allIssues) {
      if (!issue.confidence) issue.confidence = assignConfidence(issue);
    }

    // ── Level filter: keep only issues whose WCAG level was selected by the auditor ──
    // This is the single authoritative filter — axe tags and custom-rule dedup
    // are best-effort; this guarantees the final issue list matches the config.
    const dedupedRaw = deduplicateIssues(allIssues);
    const wcagLevelSet = new Set(wcagLevels);
    const deduped = dedupedRaw.filter(i => wcagLevelSet.has(i.wcagLevel));

    // Store collected N/A criteria (exclude any that ended up having violations)
    const failedCriteria = new Set(deduped.map((i) => i.wcagCriterion));
    const finalInapplicable = [...allInapplicable].filter(
      (c) => !failedCriteria.has(c),
    );
    audit.inapplicableCriteria = finalInapplicable;

    // ─────────────────────────────────────────
    // PHASE 6: SCORING
    // ─────────────────────────────────────────
    audit.status = "scoring";
    updateProgress("Calculating scores...", 94);
    audit.issues = deduped;
    audit.score = calculateScore(deduped, crawlResult.pages.length);

    const passed = audit.testResults.filter((r) => r.status === "pass").length;
    const failed = audit.testResults.filter((r) => r.status === "fail").length;
    audit.score.testsRun = audit.testResults.length;
    audit.score.testsPassed = passed;
    audit.score.testsFailed = failed;

    // ── TrustLens Unified Trust Score ──
    audit.pillarResults = {
      darkpatterns: darkPatternResult || undefined,
      performance: performanceResult || undefined,
      privacy: privacyResult || undefined,
    };
    audit.trustScore = calculateTrustScore(
      {
        overall: audit.score.overall,
        totalIssues: audit.score.totalIssues,
        uniqueIssues: audit.score.uniqueIssues,
        issueBySeverity: audit.score.issueBySeverity,
      },
      darkPatternResult,
      performanceResult,
      privacyResult,
      enabledPillars,
      config.pillarConfig?.weights,
    );

    // ─────────────────────────────────────────
    // PHASE 7: REPORT GENERATION
    // ─────────────────────────────────────────
    updateProgress("Generating report...", 96);
    audit.report = generateReport(
      id,
      deduped,
      audit.score,
      audit.pages.map((p) => ({ url: p.url, title: p.title })),
      crawlCoverage,
      journeyResult.journeyResults,
      finalInapplicable,
      testedLevel,
      {
        enabledPillars,
        darkpatterns: darkPatternResult,
        performance: performanceResult,
        privacy: privacyResult,
      },
    );
    audit.report.testResults = audit.testResults;
    audit.report.trustScore = audit.trustScore;
    audit.report.pillarResults = audit.pillarResults;

    const trustLabel = audit.trustScore
      ? ` | Trust: ${audit.trustScore.overall}/100`
      : "";
    addLog({
      timestamp: new Date().toISOString(),
      testId: "COMPLETE",
      testName: "Audit Complete",
      wcag: "",
      status: "pass",
      message: `✅ Audit complete — A11Y: ${audit.score.overall}/100${trustLabel} | WCAG ${testedLevel} | ${deduped.length} issues | ${passed}/${passed + failed} tests passed`,
    });

    audit.status = "complete";
    audit.progress = 100;
    audit.progressMessage = "Audit complete!";
    audit.completedAt = new Date().toISOString();
    storeSet(id, audit);
  } catch (error) {
    audit.status = "error";
    audit.error = error instanceof Error ? error.message : "Unknown error";
    audit.progressMessage = `Error: ${audit.error}`;
    storeSet(id, audit);
  }
}

/**
 * Deduplicate issues across engines. Uses WCAG criterion + title + element + page
 * as the key (not testId) so the same violation detected by different engines
 * (e.g. custom-rule O-03 and journey-test JRN-241) is properly merged.
 * When duplicates are found, the higher-confidence source is kept.
 */
function deduplicateIssues(issues: AccessibilityIssue[]): AccessibilityIssue[] {
  const confRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const best = new Map<string, AccessibilityIssue>();
  for (const issue of issues) {
    const key = `${issue.wcagCriterion}::${issue.title}::${normalizeSelector(issue.element)}::${issue.pageUrl}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, issue);
    } else {
      // Keep the higher-confidence version
      const existingRank = confRank[existing.confidence] || 2;
      const newRank = confRank[issue.confidence] || 2;
      if (newRank > existingRank) {
        best.set(key, issue);
      }
    }
  }
  return Array.from(best.values());
}

export async function runPdfAudit(
  fileBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const id = uuidv4();
  const config: AuditConfig = {
    type: "pdf",
    crawlDepth: 0,
    maxPages: 1,
    includeAI: false,
    wcagLevels: ["A", "AA"],
    standard: "WCAG 2.2",
  };
  const audit: AuditResult = {
    id,
    config,
    status: "scanning",
    progress: 10,
    progressMessage: "Analyzing PDF...",
    pages: [
      {
        url: fileName,
        title: fileName,
        html: "",
        timestamp: new Date().toISOString(),
      },
    ],
    issues: [],
    score: createEmptyScore(),
    testResults: [],
    testLog: [],
    inapplicableCriteria: [],
    startedAt: new Date().toISOString(),
  };
  storeSet(id, audit);

  try {
    const result = await analyzePdf(fileBuffer, fileName, (msg) => {
      audit.progressMessage = msg;
    });
    for (const issue of result.issues) {
      if (!issue.confidence) issue.confidence = assignConfidence(issue);
    }
    audit.issues = result.issues;
    audit.score = calculateScore(result.issues, 1);
    audit.score.testsRun = 0;
    audit.score.testsPassed = 0;
    audit.score.testsFailed = 0;
    audit.report = generateReport(
      id,
      result.issues,
      audit.score,
      [{ url: fileName, title: result.metadata.title || fileName }],
      undefined,
      undefined,
      [],
      "AA",
    );
    audit.status = "complete";
    audit.progress = 100;
    audit.completedAt = new Date().toISOString();
    storeSet(id, audit);
  } catch (error) {
    audit.status = "error";
    audit.error = error instanceof Error ? error.message : "Unknown error";
    storeSet(id, audit);
  }

  return id;
}
