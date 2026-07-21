// ============================================================
// KPMG TrustLens — Vision Analyzer (GPT-4o Multimodal)
// Handles image and video-frame-based audits
// ============================================================

import OpenAI from "openai";
import type { TestLogEntry } from "../types/audit";

type ProgressFn = (entry: TestLogEntry) => void;
type Pillar = "accessibility" | "darkpatterns" | "performance" | "privacy";

export interface VisionFinding {
  id: string;
  pillar: Pillar;
  ruleId: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  recommendation: string;
  evidence: { summary: string; details: string[] };
  regulation?: string[];
}

export interface VisionAuditResult {
  inputType: "image" | "video";
  framesAnalyzed: number;
  findings: VisionFinding[];
  confidenceNote: string;
  overallScore: number;
  pillarSummary: Record<string, { findings: number; score: number }>;
}

// ── Pillar-specific GPT-4o prompts ─────────────────────────
const PILLAR_PROMPTS: Record<Pillar, string> = {
  accessibility: `You are a WCAG 2.2 accessibility expert analyzing a UI screenshot.
Identify accessibility issues visible in the image. Check for:
- Low colour contrast between text and background (WCAG 1.4.3)
- Missing or incorrect focus indicators (WCAG 2.4.7)
- Text too small to read (<16px equivalent, WCAG 1.4.4)
- Images without obvious alt text context (WCAG 1.1.1)
- Form fields without visible labels (WCAG 1.3.1)
- Interactive elements too small for touch (<44x44px, WCAG 2.5.8)
- Heading hierarchy issues (WCAG 1.3.1)
- No skip navigation link visible (WCAG 2.4.1)
For each issue found, respond with JSON array: [{"title":"...","description":"...","severity":"critical|high|medium|low","wcag":"criterion","recommendation":"..."}]
If no issues found, return [].`,

  darkpatterns: `You are a dark pattern detection expert trained in CCPA taxonomy and EU DSA Art. 25.
Analyze this UI screenshot for deceptive design patterns across all 12 CCPA categories.
For each pattern found respond with: [{"title":"...","description":"...","brignullPattern":"...","severity":"critical|high|medium|low","regulation":"FTC|DSA|GDPR","recommendation":"..."}]
If none found, return [].`,

  performance: `You are a web performance expert analyzing a UI screenshot for perceived performance issues.
Look for:
- Loading spinners or skeleton screens visible (page not loaded)
- Layout shift indicators (elements misaligned, overlapping)
- Heavy image use without apparent optimization
- Multiple large above-fold images
- Text rendered before fonts loaded (FOUT visible)
- Render-blocking visual indicators
- Slow-loading state indicators
- Mobile viewport issues (content cut off, horizontal scroll)
For each issue: [{"title":"...","description":"...","metric":"LCP|CLS|INP|FCP","severity":"critical|high|medium|low","recommendation":"..."}]
If none found, return [].`,

  privacy: `You are a privacy and GDPR compliance expert analyzing a UI screenshot.
Look for:
- Cookie/consent banner presence and quality
- "Accept all" without visible "Reject all" at same level
- Consent banner that blocks page access (consent wall)
- Privacy policy link visibility
- Tracking pixel indicators (small 1x1 invisible images)
- Forms collecting sensitive data without visible purpose
- Social login buttons without data-sharing disclosure
- Third-party widgets (chat, social share) loading without consent context
For each issue: [{"title":"...","description":"...","gdprArticle":"Art. X","severity":"critical|high|medium|low","regulation":"GDPR|CCPA|ePrivacy","recommendation":"..."}]
If none found, return [].`,
};

// ── CCPA 15-Pattern Taxonomy — Structured Visual Prompts ─────────────────
// Each prompt asks ONE question only, producing specific visual evidence suitable
// for developer handoff: element description, position hint, WCAG/DSA article.
interface BrignullPrompt {
  pattern: string;
  category: string;
  regulation: string[];
  prompt: string;
}

const BRIGNULL_VISUAL_PROMPTS: BrignullPrompt[] = [
  {
    pattern: "confirmshaming",
    category: "Emotional Manipulation",
    regulation: ["EU DSA Art. 25", "FTC Act §5"],
    prompt: `SINGLE TASK — Confirmshaming Detection Only.
Look ONLY for guilt-inducing or shame-based language on the decline/cancel/skip option.
Examples: "No thanks, I don't want to save money", "I prefer to pay full price", "No, I'll stay uninformed".
If found: [{"element":"exact button/link text","visualDescription":"where it appears on screen","guilt_phrase":"the exact shameful copy","severity":"high|critical","wcagArticle":"WCAG 2.4.6","dsaArticle":"DSA Art. 25(1)(b)","developerFix":"Change decline copy to neutral language e.g. No thanks","designerFix":"Use equal visual weight for both accept and decline options"}]
If NOT found: []`,
  },
  {
    pattern: "interface-interference",
    category: "Visual Manipulation",
    regulation: ["EU DSA Art. 25", "WCAG 1.4.3"],
    prompt: `SINGLE TASK — Interface Interference (Visual Prominence Asymmetry) Detection Only.
Look ONLY for cases where two competing CTAs have massively different visual weight.
E.g.: "Accept All" is a large, colourful, above-fold button while "Reject All" is tiny grey text below the fold.
Measure: relative button size, colour contrast, position (above/below fold), font size difference.
If found: [{"primaryCTA":"text of dominant button","secondaryCTA":"text of suppressed option","primarySizeEstimate":"large/medium/small","secondarySizeEstimate":"large/medium/small","positionPrimary":"above-fold/below-fold","positionSecondary":"above-fold/below-fold","severity":"critical|high|medium","wcagArticle":"WCAG 1.4.3","dsaArticle":"DSA Art. 25(1)(a)","developerFix":"Give both CTAs equal visual weight","designerFix":"Match button size, colour contrast ratio, and vertical position for competing actions"}]
If NOT found: []`,
  },
  {
    pattern: "disguised-ads",
    category: "Misdirection",
    regulation: ["FTC Native Advertising Guidelines", "EU DSA Art. 26"],
    prompt: `SINGLE TASK — Disguised Advertisements Detection Only.
Look ONLY for sponsored or paid content that is NOT clearly labelled as an advertisement.
Check: search results, product listings, recommended content, article feeds.
Signals: "Sponsored" label absent or in 7px grey text; paid placement styled identically to organic results.
If found: [{"elementDescription":"where the ad appears","labelVisible":true|false,"labelText":"exact text of label if any","labelContrast":"readable/barely-visible/none","severity":"high|critical","regulation":"FTC 16 CFR Part 255","developerFix":"Add prominent 'Ad' or 'Sponsored' label in ≥12px with 4.5:1 contrast","designerFix":"Distinguish ad cards with background colour or border"}]
If NOT found: []`,
  },
  {
    pattern: "visual-misdirection",
    category: "Misdirection",
    regulation: ["EU DSA Art. 25", "FTC Act §5"],
    prompt: `SINGLE TASK — Visual Misdirection Detection Only.
Look ONLY for intentional eye-flow manipulation that steers the user away from a secondary (but important) action.
E.g.: bright animated CTA next to a barely-visible "cancel" link; decorative arrows pointing only toward purchase; confetti/background animation that obscures the opt-out path.
If found: [{"distractingElement":"description of attention-capturing element","hiddenOption":"description of suppressed important option","manipulationMechanism":"animation|colour|size|position","severity":"high|critical","dsaArticle":"DSA Art. 25(1)(a)","developerFix":"Remove animation from primary CTA or apply equal animation to secondary option","designerFix":"Establish neutral visual hierarchy between competing choices"}]
If NOT found: []`,
  },
  {
    pattern: "roach-motel",
    category: "Forced Continuity",
    regulation: [
      "EU DSA Art. 25",
      "FTC Click-to-Cancel Rule",
      "CMA Subscription Guidelines",
    ],
    prompt: `SINGLE TASK — Roach Motel (Visual) Detection Only.
Look ONLY for visual evidence that subscribing/signing-up is made extremely easy while cancellation/opt-out is hidden or absent.
Check: is there a clear "Cancel subscription" or "Delete account" link visible? Is "Subscribe" / "Get Started" far more prominent?
If found: [{"subscribeVisibility":"prominently-visible|visible|hidden","cancelVisibility":"prominently-visible|visible|hidden|absent","subscribeElementDescription":"button/link description","cancelElementDescription":"button/link description or none","effortAsymmetry":"subscribe is X times more visible than cancel","severity":"high|critical","regulation":"FTC Click-to-Cancel Rule","developerFix":"Add clearly labelled cancellation path at equal prominence to subscription CTA","designerFix":"Match visual weight of entry and exit paths"}]
If NOT found: []`,
  },
  {
    pattern: "trick-questions",
    category: "Confusion",
    regulation: ["EU DSA Art. 25", "GDPR Art. 7", "FTC Act §5"],
    prompt: `SINGLE TASK — Trick Questions / Double-Negative Opt-Out Detection Only.
Look ONLY for checkboxes, toggles, or form fields where the wording uses a double-negative or confusing logic so that the user's intended action is reversed.
E.g.: "Uncheck to not receive marketing emails" — where leaving it checked means you DO get emails but the language implies checking means opting out.
If found: [{"elementType":"checkbox|toggle|radio|text","elementLabel":"exact label text","confusingLogic":"description of the double-negative or confusing construction","correctInterpretation":"what it actually does","severity":"high|critical","wcagArticle":"WCAG 3.3.2","gdprArticle":"GDPR Art. 7(2)","developerFix":"Rewrite as a positive opt-in: 'Send me marketing emails [ ]'","designerFix":"Use explicit positive-only language for all consent controls"}]
If NOT found: []`,
  },
  {
    pattern: "hidden-costs",
    category: "Pricing Deception",
    regulation: [
      "EU Consumer Rights Directive",
      "FTC Act §5",
      "CMA Pricing Practices",
    ],
    prompt: `SINGLE TASK — Hidden Costs (Visual) Detection Only.
Look ONLY for price elements where the full cost is NOT visible or is revealed only at a late stage.
E.g.: "Free" in large text with tiny "then £9.99/month" in grey below; price shown without tax/fees that are not disclosed until checkout; subscription auto-renewal buried in micro-copy.
If found: [{"priceDisplayed":"what price is shown prominently","hiddenCost":"what additional cost is not prominently shown","disclosure":"how/where the hidden cost appears","fontSizeRatio":"prominent price is X× larger than disclosure","severity":"high|critical","regulation":"EU Consumer Rights Directive Art. 22","developerFix":"Display total cost prominently at same visual weight as lead price","designerFix":"Never use font size <12px for price disclosures; use same colour/weight as headline price"}]
If NOT found: []`,
  },
  {
    pattern: "false-urgency",
    category: "Urgency Manipulation",
    regulation: ["EU DSA Art. 25", "FTC Act §5", "ASA CAP Code"],
    prompt: `SINGLE TASK — False Urgency Detection Only.
Look ONLY for countdown timers, time-limited offer claims, or deadline language that creates artificial urgency.
E.g.: countdown timer saying "Offer ends in 02:14:33", "Today only!", "This offer expires soon".
If found: [{"urgencyElement":"description of timer/text","urgencyText":"exact text","isLikelyFake":"yes|no|unclear","reasoning":"why this appears artificial","severity":"high|critical","regulation":"ASA CAP 3.1","dsaArticle":"DSA Art. 25(1)(d)","developerFix":"Remove countdown or verify the deadline is real and consistent across sessions","designerFix":"Do not use red/orange countdown styling for artificial urgency cues"}]
If NOT found: []`,
  },
  {
    pattern: "scarcity-manipulation",
    category: "Urgency Manipulation",
    regulation: ["EU DSA Art. 25", "FTC Act §5", "CMA Fake Reviews Guidance"],
    prompt: `SINGLE TASK — Scarcity Manipulation Detection Only.
Look ONLY for "Only X left in stock", "X items remaining", or similar inventory scarcity claims that may be unverifiable.
Distinguish genuine inventory display (e.g. "3 seats left" on a flight) from manipulation (e.g. "Only 2 left!" on a digital download).
If found: [{"scarcityText":"exact text","elementType":"stock-counter|text-label|badge","productType":"physical|digital|subscription|unclear","isLikelyManipulative":"yes|no|unclear","reasoning":"why","severity":"medium|high|critical","regulation":"FTC Act §5","developerFix":"Only show scarcity for genuinely limited physical inventory; remove for digital goods","designerFix":"Do not use red/orange urgency styling for scarcity claims on unlimited digital products"}]
If NOT found: []`,
  },
  {
    pattern: "social-proof-inflation",
    category: "Urgency Manipulation",
    regulation: [
      "EU DSA Art. 25",
      "FTC Endorsement Guides",
      "CMA Fake Reviews Guidance",
    ],
    prompt: `SINGLE TASK — Social Proof Inflation Detection Only.
Look ONLY for "X people viewing now", "X bought in the last hour", star ratings with unverifiable review counts, or "trusted by X companies" claims without attribution.
If found: [{"socialProofText":"exact text","claimType":"viewers|purchases|ratings|testimonials","isVerifiable":"yes|no|unclear","manipulationSignals":"e.g. counter changes every page refresh, round numbers, no link to reviews","severity":"medium|high","regulation":"FTC Endorsement Guides 16 CFR 255","developerFix":"Link all social proof claims to verifiable sources or remove","designerFix":"Do not use urgency colour (red/orange) for social proof counters unless real-time verified"}]
If NOT found: []`,
  },
  {
    pattern: "privacy-zuckering",
    category: "Privacy Manipulation",
    regulation: [
      "GDPR Art. 5",
      "GDPR Art. 7",
      "ePrivacy Directive",
      "EU DSA Art. 25",
    ],
    prompt: `SINGLE TASK — Privacy Zuckering Detection Only.
Look ONLY for data sharing consent defaults, pre-enabled data sharing toggles, or privacy settings that are buried or confusingly labelled.
E.g.: "Share data with partners" toggle is ON by default; "Personalised ads" is pre-checked; privacy settings require 12 clicks to find.
If found: [{"elementDescription":"description of the pre-enabled toggle/checkbox","defaultState":"on|off|unclear","dataType":"marketing|analytics|third-party|unclear","visibilityLevel":"prominent|buried|hidden","severity":"high|critical","gdprArticle":"GDPR Art. 7(2) — consent must be freely given, specific, informed","developerFix":"Default all optional data sharing to OFF; require affirmative opt-in","designerFix":"Surface privacy controls at point of data collection, not buried in settings"}]
If NOT found: []`,
  },
  {
    pattern: "forced-continuity",
    category: "Forced Continuity",
    regulation: [
      "FTC Click-to-Cancel Rule",
      "EU Consumer Rights Directive Art. 22",
      "CMA Subscription Guidelines",
    ],
    prompt: `SINGLE TASK — Forced Continuity (Visual) Detection Only.
Look ONLY for auto-renewal disclosures, free trial conversion notices, or subscription continuation language that is hidden, in micro-copy, or absent entirely.
E.g.: "Free for 30 days" in large text but "then £9.99/month, cancel anytime" in 8px grey text; no mention of auto-renewal on the payment form.
If found: [{"primaryOfferText":"prominent offer text","continuationDisclosure":"text of auto-renewal disclosure if present","disclosureVisibility":"prominent|small|absent","fontSize":"description of relative size","severity":"high|critical","regulation":"FTC Click-to-Cancel Rule 2024","developerFix":"Display auto-renewal terms at ≥12px, same visual prominence as offer headline, immediately adjacent to CTA","designerFix":"Never use lower contrast or smaller font for continuation terms than for the headline offer"}]
If NOT found: []`,
  },
];

const log = (
  testId: string,
  message: string,
  methodology?: string,
  onProgress?: ProgressFn,
) => {
  onProgress?.({
    timestamp: new Date().toISOString(),
    testId,
    testName: "Vision AI",
    wcag: "",
    status: "running",
    message,
    pillar: "accessibility",
    methodology,
    phase: "Vision Analysis",
  });
};

// ── CCPA 15-Pattern Visual Scan — runs 15 focused GPT-4o prompts ─────────
async function runBrignullVisualScan(
  client: OpenAI,
  imageBase64: string,
  mimeType: string,
  findingId: number,
  onProgress?: ProgressFn,
): Promise<{ findings: VisionFinding[]; nextId: number }> {
  const findings: VisionFinding[] = [];
  let id = findingId;

  log(
    "CCPA Categorization",
    "  → Running 15-pattern CCPA structured visual taxonomy (always-on)...",
    "CCPA Taxonomy",
    onProgress,
  );

  for (const bp of BRIGNULL_VISUAL_PROMPTS) {
    log(
      `VIS-DP-${bp.pattern.toUpperCase().replace(/-/g, "_")}`,
      `    · ${bp.pattern}: ${bp.category}...`,
      `CCPA — ${bp.pattern}`,
      onProgress,
    );
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: bp.prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
      });

      const raw = response.choices[0]?.message?.content || "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]) as any[];
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      for (const item of parsed) {
        // Build a rich description combining all structured fields from the prompt response
        const descParts: string[] = [];
        if (item.visualDescription)
          descParts.push(`Location: ${item.visualDescription}`);
        if (item.guilt_phrase)
          descParts.push(`Shame phrase: "${item.guilt_phrase}"`);
        if (item.primaryCTA && item.secondaryCTA)
          descParts.push(
            `Primary: "${item.primaryCTA}" vs Secondary: "${item.secondaryCTA}"`,
          );
        if (item.effortAsymmetry)
          descParts.push(`Effort asymmetry: ${item.effortAsymmetry}`);
        if (item.urgencyText)
          descParts.push(`Urgency text: "${item.urgencyText}"`);
        if (item.scarcityText)
          descParts.push(`Scarcity text: "${item.scarcityText}"`);
        if (item.socialProofText)
          descParts.push(`Social proof: "${item.socialProofText}"`);
        if (item.hiddenCost) descParts.push(`Hidden cost: ${item.hiddenCost}`);
        if (item.continuationDisclosure)
          descParts.push(
            `Auto-renewal disclosure: ${item.continuationDisclosure}`,
          );
        if (item.elementLabel)
          descParts.push(`Element label: "${item.elementLabel}"`);
        if (item.confusingLogic)
          descParts.push(`Confusing logic: ${item.confusingLogic}`);
        if (item.defaultState)
          descParts.push(`Default state: ${item.defaultState}`);
        if (item.elementDescription)
          descParts.push(`Element: ${item.elementDescription}`);

        const description =
          descParts.join(" | ") ||
          item.description ||
          `${bp.pattern} dark pattern detected`;

        findings.push({
          id: `vis-brignull-${++id}`,
          pillar: "darkpatterns",
          ruleId: `VIS-DP-${bp.pattern.toUpperCase().replace(/-/g, "_")}`,
          title: `${bp.category}: ${bp.pattern.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}`,
          description,
          severity: (item.severity || "high") as VisionFinding["severity"],
          confidence: "high",
          recommendation:
            item.developerFix ||
            item.recommendation ||
            `Remediate ${bp.pattern} pattern`,
          evidence: {
            summary: `CCPA pattern detected via targeted GPT-4o visual scan: ${bp.pattern}`,
            details: [
              description,
              item.developerFix ? `Dev fix: ${item.developerFix}` : "",
              item.designerFix ? `Design fix: ${item.designerFix}` : "",
            ].filter(Boolean),
          },
          regulation: bp.regulation,
          // Extended fields for audience-segmented reporting
          brignullPattern: bp.pattern,
          developerFix: item.developerFix,
          designerFix: item.designerFix,
          dsaArticle: item.dsaArticle || item.wcagArticle || item.gdprArticle,
          category: bp.category,
        } as VisionFinding & {
          brignullPattern: string;
          developerFix?: string;
          designerFix?: string;
          dsaArticle?: string;
          category: string;
        });
      }

      if (parsed.length > 0) {
        log(
          `VIS-DP-${bp.pattern.toUpperCase().replace(/-/g, "_")}`,
          `     ${bp.pattern}: ${parsed.length} finding(s)`,
          `CCPA — ${bp.pattern}`,
          onProgress,
        );
      }
    } catch (err) {
      // Individual pattern scan failure — continue with remaining patterns
      log(
        `VIS-DP-${bp.pattern.toUpperCase().replace(/-/g, "_")}`,
        `    ⚠ ${bp.pattern} scan failed: ${err instanceof Error ? err.message : "unknown"}`,
        undefined,
        onProgress,
      );
    }
  }

  log(
    "VIS-DP-BRIGNULL-DONE",
    `   CCPA scan complete — ${findings.length} visual dark pattern(s) across 12 patterns`,
    "CCPA Taxonomy",
    onProgress,
  );

  return { findings, nextId: id };
}

// ── Image Audit ─────────────────────────────────────────────
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  enabledPillars: Pillar[],
  onProgress?: ProgressFn,
): Promise<VisionAuditResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const findings: VisionFinding[] = [];
  let findingId = 0;

  log(
    "VIS-START",
    "━━━ Vision AI: Image Analysis — GPT-4o Multimodal",
    "GPT-4o Vision Analysis",
    onProgress,
  );
  log(
    "VIS-CONF",
    `  → Confidence: ~70% (visual analysis only — no DOM access)`,
    "Vision Confidence Framework",
    onProgress,
  );
  log(
    "VIS-PIL",
    `  → Pillars: ${enabledPillars.join(", ")}`,
    "Multi-Pillar Visual Scan",
    onProgress,
  );

  for (const pillar of enabledPillars) {
    // Dark patterns: always run the full 15-pattern CCPA taxonomy
    if (pillar === "darkpatterns") {
      const brignullResult = await runBrignullVisualScan(
        client,
        imageBase64,
        mimeType,
        findingId,
        onProgress,
      );
      findings.push(...brignullResult.findings);
      findingId = brignullResult.nextId;
      continue;
    }

    log(
      `VIS-${pillar.toUpperCase()}`,
      `  → Scanning for ${pillar} issues via GPT-4o vision...`,
      PILLAR_PROMPTS[pillar].split("\n")[0],
      onProgress,
    );
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PILLAR_PROMPTS[pillar] },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
      });

      const raw = response.choices[0]?.message?.content || "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]) as any[];
      for (const item of parsed) {
        findings.push({
          id: `vis-${++findingId}`,
          pillar,
          ruleId: `VIS-${pillar.toUpperCase()}-${findingId.toString().padStart(2, "0")}`,
          title: item.title || "Visual Issue Detected",
          description: item.description || "",
          severity: item.severity || "medium",
          confidence: "medium",
          recommendation: item.recommendation || "",
          evidence: {
            summary: "Detected via GPT-4o vision analysis",
            details: [item.description || ""],
          },
          regulation: item.regulation
            ? [item.regulation]
            : item.gdprArticle
              ? ["GDPR"]
              : undefined,
        });
      }
      log(
        `VIS-${pillar.toUpperCase()}`,
        `  ✓ ${pillar}: ${parsed.length} finding(s) detected`,
        `GPT-4o — ${pillar}`,
        onProgress,
      );
    } catch (err) {
      log(
        `VIS-${pillar.toUpperCase()}`,
        `  ⚠ ${pillar} analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        undefined,
        onProgress,
      );
    }
  }

  return buildVisionResult("image", 1, findings, enabledPillars);
}

// ── Video Frame Extraction + Analysis (client-canvas approach) ──
export async function analyzeVideoFrames(
  frames: Array<{ base64: string; mimeType: string; timestampMs: number }>,
  enabledPillars: Pillar[],
  onProgress?: ProgressFn,
): Promise<VisionAuditResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const findings: VisionFinding[] = [];
  let findingId = 0;

  log(
    "VIS-VID",
    "━━━ Vision AI: Video Frame Analysis — GPT-4o Multimodal",
    "GPT-4o Video Frame Analysis",
    onProgress,
  );
  log(
    "VIS-VID-CONF",
    `  → Confidence: ~60% (behavioral inference from ${frames.length} frames)`,
    "Vision Confidence Framework",
    onProgress,
  );
  log(
    "VIS-VID-FRM",
    `  → Analyzing ${frames.length} key frame(s) at: ${frames.map((f) => `${(f.timestampMs / 1000).toFixed(1)}s`).join(", ")}`,
    "Frame Sampling Strategy",
    onProgress,
  );

  // Analyze a sample of frames (max 4 to control cost)
  const sampleFrames =
    frames.length > 4
      ? [
          frames[0],
          frames[Math.floor(frames.length / 3)],
          frames[Math.floor((2 * frames.length) / 3)],
          frames[frames.length - 1],
        ]
      : frames;

  for (let i = 0; i < sampleFrames.length; i++) {
    const frame = sampleFrames[i];
    log(
      `VIS-VID-F${i}`,
      `  → Analysing frame at ${(frame.timestampMs / 1000).toFixed(1)}s...`,
      "GPT-4o Frame Scan",
      onProgress,
    );

    for (const pillar of enabledPillars) {
      try {
        const prompt = `${PILLAR_PROMPTS[pillar]}\nThis is frame ${i + 1} of ${sampleFrames.length} from a screen recording at ${(frame.timestampMs / 1000).toFixed(1)}s. Also look for: layout shifts, loading states, interaction delays visible between frames.`;
        const response = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${frame.mimeType};base64,${frame.base64}`,
                    detail: "low",
                  },
                },
              ],
            },
          ],
        });

        const raw = response.choices[0]?.message?.content || "[]";
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) continue;

        const parsed = JSON.parse(jsonMatch[0]) as any[];
        for (const item of parsed) {
          // Deduplicate by title
          if (
            !findings.some((f) => f.title === item.title && f.pillar === pillar)
          ) {
            findings.push({
              id: `vis-${++findingId}`,
              pillar,
              ruleId: `VIS-VID-${pillar.toUpperCase()}-${findingId.toString().padStart(2, "0")}`,
              title: item.title || "Visual Issue Detected",
              description: `[Frame ${i + 1} @ ${(frame.timestampMs / 1000).toFixed(1)}s] ${item.description || ""}`,
              severity: item.severity || "medium",
              confidence: "low",
              recommendation: item.recommendation || "",
              evidence: {
                summary: `Detected at ${(frame.timestampMs / 1000).toFixed(1)}s via GPT-4o`,
                details: [item.description || ""],
              },
              regulation: item.regulation ? [item.regulation] : undefined,
            });
          }
        }
      } catch {
        /* continue with next frame */
      }
    }
  }

  log(
    "VIS-VID-DONE",
    `  ✓ Video analysis complete — ${findings.length} finding(s) across ${sampleFrames.length} frames`,
    "GPT-4o Video Analysis",
    onProgress,
  );
  return buildVisionResult("video", frames.length, findings, enabledPillars);
}

// ── Build Result ────────────────────────────────────────────
function buildVisionResult(
  inputType: "image" | "video",
  framesAnalyzed: number,
  findings: VisionFinding[],
  pillars: Pillar[],
): VisionAuditResult {
  const sevW = { critical: 20, high: 10, medium: 4, low: 1 };
  const pillarSummary: Record<string, { findings: number; score: number }> = {};
  for (const p of pillars) {
    const pf = findings.filter((f) => f.pillar === p);
    const ded = pf.reduce((s, f) => s + (sevW[f.severity] || 1), 0);
    pillarSummary[p] = {
      findings: pf.length,
      score: Math.max(0, Math.min(100, 100 - ded)),
    };
  }
  const overallScore =
    pillars.length > 0
      ? Math.round(
          Object.values(pillarSummary).reduce((s, p) => s + p.score, 0) /
            pillars.length,
        )
      : 100;
  const confNote =
    inputType === "image"
      ? "Image audit: ~70% confidence. DOM-based checks not available. Results are AI visual inference only."
      : "Video audit: ~60% confidence. Frame sampling may miss transient issues. Complement with live URL audit.";

  return {
    inputType,
    framesAnalyzed,
    findings,
    confidenceNote: confNote,
    overallScore,
    pillarSummary,
  };
}
