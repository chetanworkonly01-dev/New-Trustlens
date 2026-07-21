// ============================================================
// KPMG TrustLens — Dark Pattern & Ethical UX Types
// ============================================================

// ── Dark Pattern Taxonomy Categories ──
export type DarkPatternCategory =
  | "interface-interference" // UI visually biases decisions
  | "obstruction" // Makes unwanted actions hard
  | "sneaking" // Hidden actions/costs
  | "forced-action" // Requires unrelated actions
  | "nagging" // Repeated interruptions
  | "scarcity-urgency" // Fake time or stock pressure
  | "social-pressure" // Emotional manipulation via social proof
  | "privacy-zuckering" // Oversharing encouragement
  | "confirmshaming" // Guilt-based rejection
  | "misdirection"; // Visual hierarchy steers user

export const DARK_PATTERN_CATEGORY_LABELS: Record<DarkPatternCategory, string> =
  {
    "interface-interference": "Interface Interference",
    obstruction: "Obstruction",
    sneaking: "Sneaking",
    "forced-action": "Forced Action",
    nagging: "Nagging",
    "scarcity-urgency": "Scarcity & Urgency",
    "social-pressure": "Social Pressure",
    "privacy-zuckering": "Privacy Zuckering",
    confirmshaming: "Confirmshaming",
    misdirection: "Misdirection",
  };

export const DARK_PATTERN_CATEGORY_ICONS: Record<DarkPatternCategory, string> =
  {
    "interface-interference": "🎭",
    obstruction: "🚧",
    sneaking: "🐍",
    "forced-action": "⛓️",
    nagging: "📢",
    "scarcity-urgency": "⏰",
    "social-pressure": "👥",
    "privacy-zuckering": "🔓",
    confirmshaming: "😔",
    misdirection: "🎯",
  };

// ── Foundational Ethical Principles ──
export type EthicalPrinciple =
  | "informed-consent" // Users understand agreements
  | "symmetry-of-choice" // Rejecting = accepting ease
  | "transparency" // No hidden costs/tracking
  | "user-autonomy" // No emotional manipulation
  | "accessibility-clarity"; // Understandable by all users

export const ETHICAL_PRINCIPLE_LABELS: Record<EthicalPrinciple, string> = {
  "informed-consent": "Informed Consent",
  "symmetry-of-choice": "Symmetry of Choice",
  transparency: "Transparency",
  "user-autonomy": "User Autonomy",
  "accessibility-clarity": "Accessibility & Clarity",
};

export const ETHICAL_PRINCIPLE_DESCRIPTIONS: Record<EthicalPrinciple, string> =
  {
    "informed-consent":
      "Users should understand what they agree to, see consequences clearly, and have equal reject/accept choices.",
    "symmetry-of-choice":
      "Rejecting should be as easy as accepting. Subscribe and unsubscribe should have equal friction.",
    transparency:
      "The system should not conceal costs, subscriptions, tracking, sharing, or permissions.",
    "user-autonomy":
      "The interface should not emotionally manipulate users through shame, guilt, fear, or fake urgency.",
    "accessibility-clarity":
      "Users with low literacy, disabilities, or elderly demographics should still understand the flow.",
  };

// Principle severity weights for scoring
export const PRINCIPLE_WEIGHTS: Record<EthicalPrinciple, number> = {
  "informed-consent": 1.5,
  "symmetry-of-choice": 1.3,
  transparency: 1.2,
  "user-autonomy": 1.0,
  "accessibility-clarity": 1.0,
};

// ── Regulation Mapping ──
export type DarkPatternRegulation =
  | "EU-DSA" // EU Digital Services Act
  | "EU-GDPR" // General Data Protection Regulation
  | "US-FTC" // Federal Trade Commission Act
  | "US-CCPA" // California Consumer Privacy Act
  | "IN-CCPA" // India Consumer Protection Act 2019
  | "IN-CPA" // India Consumer Protection (Dark Patterns) Guidelines 2023
  | "IN-ASCI" // Advertising Standards Council of India Dark Pattern Guidelines 2023
  | "IN-DPDPA" // India Digital Personal Data Protection Act 2023
  | "IN-RBI" // Reserve Bank of India Guidelines
  | "IN-SEBI" // Securities and Exchange Board of India
  | "UK-CPR" // UK Consumer Protection Regulations
  | "UK-PECR" // UK Privacy and Electronic Communications Regulations
  | "UK-ICO" // UK Information Commissioner's Office Guidance
  | "AU-ACL"; // Australia Consumer Law

// ── Finding Verifiability (Signal vs Verdict model) ──
export type FindingVerdict = "verdict" | "signal";
export type DetectionBasis = "visual" | "structural" | "textual" | "visual-ai";

// ── Individual Dark Pattern Finding ──
export interface DarkPatternFinding {
  id: string;
  ruleId: string; // e.g. DP-IF-01 or DP-VIS-AI-01
  category: DarkPatternCategory;
  principle: EthicalPrinciple;
  title: string;
  description: string;
  element: string; // CSS selector
  elementHtml?: string; // Outer HTML snippet
  pageUrl: string;
  severity: "critical" | "high" | "medium" | "low";
  regulation: DarkPatternRegulation[]; // Which regulations this violates
  confidence: "high" | "medium" | "low";
  recommendation: string;
  userImpact: string; // How this harms real users
  evidence: DarkPatternEvidence;
  source: "rule" | "ai" | "journey" | "ai-vision" | "temporal" | "cta-scorer"; // Detection method
  // Signal vs Verdict model
  detectionBasis?: DetectionBasis; // How the finding was detected: visual/structural/textual/visual-ai
  verifiabilityNote?: string; // Explains if DOM-provable (verdict) or content-only (signal)
  findingVerdict?: FindingVerdict; // 'verdict' = DOM-proven, 'signal' = unverifiable claim
  // Visual AI fields (Phase 8)
  screenshotEvidence?: string; // Base64 screenshot used as evidence
  visualAnalysisPhase?: "Phase 8: Visual AI Dark Pattern Analysis";
  // ── Audience-segmented handoff fields ──
  developerFix?: string; // Code-level remediation (selector, snippet, PR guidance)
  designerFix?: string; // Design-token / visual hierarchy fix
  legalSummary?: string; // Enforcement framing for legal team
  brignullPattern?: string; // e.g. "Trick Questions", "Roach Motel"
  brignullNumber?: number; // 1–12 CCPA taxonomy number
  dsaArticle?: string; // e.g. "Art. 25(1)(a)", "Art. 25(3)(b)"
  elementSelector?: string; // Developer-ready CSS selector
  fixPriority?: "P0" | "P1" | "P2" | "P3"; // P0 = fix immediately, P3 = backlog
  estimatedEffort?: "XS" | "S" | "M" | "L"; // Effort to remediate
  // ── Temporal / CTA-specific fields ──
  temporalT0Value?: string; // Value at T=0s (temporal findings)
  temporalT30Value?: string; // Value at T=30s (temporal findings)
  ctaAreaRatio?: number; // Accept:Reject area ratio (CTA findings)
  ctaPrimaryLabel?: string; // Primary CTA label
  ctaSecondaryLabel?: string; // Secondary CTA label
  // ── Compliance Exemption (IRDAI / RBI / SEBI regulated BFSI sites) ──
  complianceExemption?: {
    category: string; // ComplianceExemptionCategory
    regulation: string; // Regulation(s) that mandate this pattern
    rationale: string; // Why this is compliance-driven, not a dark pattern
    validationNote: string; // What requires backend validation to confirm exemption
    exemptionLabel: string; // Short label for display (e.g. "Mandatory KYC Step")
    scoreReductionFactor: number; // 0–1: multiplier applied to severity deduction in scoring
  };
  /** Optional management response / owner acknowledgement notes (per-finding) */
  managementResponse?: import("./audit").ManagementResponseBlock;
}

export interface DarkPatternEvidence {
  summary: string;
  details: string[];
  measurements?: Record<string, string | number>;
  screenshot?: string; // legacy — Base64 or path
  screenshotDataUrl?: string; // data:image/jpeg;base64,... for inline display
}

// ── Dark Pattern Rule Definition ──
export interface DarkPatternRule {
  id: string; // e.g. DP-IF-01
  category: DarkPatternCategory;
  principle: EthicalPrinciple;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  regulation: DarkPatternRegulation[];
  detect: "dom" | "visual" | "journey" | "ai" | "flow" | "textual"; // Detection method type
  recommendation?: string; // Rule-specific fix override (falls back to category-level)
  complianceExemptible?: boolean; // May be compliance-driven in BFSI/fintech (IRDAI/RBI/SEBI)
}

// ── Aggregated Dark Pattern Result ──
export interface DarkPatternResult {
  findings: DarkPatternFinding[];
  ethicsScore: number; // 0-100
  principleScores: Record<EthicalPrinciple, number>; // 0-100 per principle
  categoryBreakdown: Record<DarkPatternCategory, number>; // Finding count per category
  consentIntegrity: number; // 0-100 consent health
  choiceSymmetry: number; // 0-100 accept vs reject balance
  manipulationIndex: number; // 0-100 manipulation pressure (lower = better)
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  pagesScanned: number;
  regulatoryRisks: DarkPatternRegulation[]; // Regulations with violations
  // ── Extended source breakdown ──
  findingsBySource?: Record<string, number>; // rule / ai-vision / temporal / cta-scorer
  findingsByPhase?: Record<string, number>; // Phase 1-8 breakdown
  // ── Compliance Exemption Summary ──
  complianceExemptions?: number; // Count of findings flagged as compliance-driven
  complianceExemptionsByCategory?: Record<string, number>; // Breakdown by exemption category
  // ── Coverage Confidence ──
  coverageCapApplied?: boolean; // True when static scan found 0 issues but funnel was not verified
  funnelVerified?: boolean; // True only when interaction simulation traversed transactional flows
}
