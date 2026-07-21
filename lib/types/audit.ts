import type {
  AuditPillar,
  TrustScore,
  PillarResults,
  PillarConfig,
} from "./trustscore";

export type AuditType = "website" | "portal" | "pdf";
export type AuditStatus =
  | "pending"
  | "crawling"
  | "scanning"
  | "analyzing"
  | "scoring"
  | "complete"
  | "error";

export interface LoginConfig {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  username: string;
  password: string;
  otpSelector?: string;
  otpValue?: string;
  successIndicator?: string;
}

export interface AuditConfig {
  url?: string;
  type: AuditType;
  loginConfig?: LoginConfig;
  crawlDepth: number;
  maxPages: number;
  includeAI: boolean;
  wcagLevels: ("A" | "AA" | "AAA")[];
  standard?: string;
  enabledPillars?: AuditPillar[];
  pillarConfig?: Partial<PillarConfig>;
  // ── New scope fields from Director Mode UI ──
  scopeMode?: "general" | "specific" | "predefined" | "director";
  specificUrls?: string[];
  selectedJourney?: string;
  journeySteps?: { id: string; label: string; url: string; action?: string }[];
  aiDirection?: string;
  // ── Performance Problem Context (client-reported issues) ──
  performanceProblemContext?: import("./performance").PerformanceProblemContext;
}

export interface PageData {
  url: string;
  title: string;
  html: string;
  screenshot?: string;
  timestamp: string;
}

export interface AuditResult {
  id: string;
  config: AuditConfig;
  status: AuditStatus;
  progress: number;
  progressMessage: string;
  pages: PageData[];
  issues: AccessibilityIssue[];
  score: AuditScore;
  report?: AuditReport;
  crawlCoverage?: CrawlCoverage;
  testResults: TestResult[];
  testLog: TestLogEntry[];
  inapplicableCriteria: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  // ── TrustLens Multi-Pillar Results ──
  trustScore?: TrustScore;
  pillarResults?: PillarResults;
  // ── Per-pillar independent progress (0-100 each) ──
  pillarProgress?: {
    accessibility?: number;
    darkpatterns?: number;
    performance?: number;
    privacy?: number;
  };
  // ── Audit integrity warning (amber banner trigger) ──
  auditIntegrity?: {
    status: "clean" | "warning" | "partial";
    message?: string;
    failedPillars?: string[];
  };
  // ── Site classification from profiler ──
  siteProfile?: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

// ── Per-entity Management Response block ──
export interface ManagementResponseBlock {
  /** Person or team accountable for the response */
  owner?: string;
  /** Target date / sprint for remediation */
  target?: string;
  /** Free-form management acknowledgement / narrative */
  notes?: string;
  /** Status of the response: accepts, disputes, or plans remediation */
  status?: "accepted" | "disputed" | "planned" | "in-progress" | "resolved";
}

// ===== TEST-DRIVEN EXECUTION MODEL =====

export type TestStatus =
  | "pending"
  | "running"
  | "pass"
  | "fail"
  | "error"
  | "needs-review";

export interface TestCase {
  testId: string;
  testName: string;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: "A" | "AA" | "AAA";
  category: "perceivable" | "operable" | "understandable" | "robust";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  browserInteraction: boolean;
}

export interface TestResult {
  testId: string;
  testName: string;
  pageUrl: string;
  status: TestStatus;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: "A" | "AA" | "AAA";
  severity: "critical" | "high" | "medium" | "low";
  confidence: ConfidenceLevel;
  evidence: TestEvidence;
  issues: AccessibilityIssue[];
  executionTime: number;
  error?: string;
}

export interface TestEvidence {
  summary: string;
  elementsChecked: number;
  elementsFailed: number;
  details: string[];
  domSnapshots?: string[];
}

export interface TestLogEntry {
  timestamp: string;
  testId: string;
  testName: string;
  wcag: string;
  status: TestStatus;
  message: string;
  pageUrl?: string;
  /** Which audit pillar this log entry belongs to */
  pillar?: "accessibility" | "darkpatterns" | "performance" | "privacy";
  /** The principle, standard or framework being applied (e.g. "CCPA Taxonomy", "GDPR Art. 7", "RAIL Model") */
  methodology?: string;
  /** The named phase within the engine (e.g. "Phase 1: DOM Scan", "Layer C: Consent Infrastructure") */
  phase?: string;
}

export interface AccessibilityIssue {
  id: string;
  testId: string;
  title: string;
  description: string;
  element: string;
  elementHtml?: string;
  /** Base64-encoded PNG screenshot of the violating element */
  elementScreenshot?: string;
  pageUrl: string;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: "A" | "AA" | "AAA";
  severity: "critical" | "high" | "medium" | "low";
  impact: string;
  recommendation: string;
  codeFix?: string;
  category: "perceivable" | "operable" | "understandable" | "robust" | "pdf";
  source:
    | "axe-core"
    | "custom-rule"
    | "pdf-analyzer"
    | "ai-analysis"
    | "journey-test"
    | "test-runner";
  confidence: ConfidenceLevel;
  occurrenceCount?: number;
  affectedPages?: string[];
  /** Optional management response / owner acknowledgement notes (per-issue) */
  managementResponse?: ManagementResponseBlock;
}

export interface AuditScore {
  overall: number;
  categoryScores: {
    perceivable: number;
    operable: number;
    understandable: number;
    robust: number;
    pdf: number;
  };
  complianceLevel:
    | "non-compliant"
    | "partially-compliant"
    | "aa-compliant"
    | "aaa-compliant";
  totalIssues: number;
  uniqueIssues: number;
  issueBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  issueByLevel: { A: number; AA: number; AAA: number };
  journeyScore?: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
}

// ===== CRAWL COVERAGE =====

export interface CrawlCoverage {
  totalPagesFound: number; // all unique URLs discovered (before any cap/skip)
  pagesAudited: number;
  pagesSkipped: number;
  coveragePercent: number;
  skippedPages: SkippedPage[];
  discoveryMethods: Record<string, number>;
}

export interface SkippedPage {
  url: string;
  reason: string;
}

// ===== GROUPED ISSUES =====

export interface GroupedIssue {
  issueKey: string;
  title: string;
  testId: string;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: "A" | "AA" | "AAA";
  severity: "critical" | "high" | "medium" | "low";
  category: AccessibilityIssue["category"];
  description: string;
  recommendation: string;
  codeFix?: string;
  confidence: ConfidenceLevel;
  occurrenceCount: number;
  affectedPages: string[];
  frequency: number;
  instances: AccessibilityIssue[];
}

// ===== USER JOURNEY =====

export interface JourneyTestResult {
  journeyName: string;
  description: string;
  steps: JourneyStep[];
  passed: boolean;
  issues: AccessibilityIssue[];
}

export interface JourneyStep {
  name: string;
  action: string;
  passed: boolean;
  issue?: string;
}

// ===== REPORT =====

export interface AuditReport {
  id: string;
  auditId: string;
  /** WCAG level(s) that were in scope for this audit */
  testedLevel: string;
  executiveSummary: string;
  score: AuditScore;
  issues: AccessibilityIssue[];
  groupedIssues: GroupedIssue[];
  topCritical: GroupedIssue[];
  wcagMapping: WcagMappingEntry[];
  remediationPlan: RemediationStep[];
  pageBreakdown: PageBreakdownEntry[];
  crawlCoverage?: CrawlCoverage;
  journeyResults?: JourneyTestResult[];
  testResults?: TestResult[];
  generatedAt: string;
  // ── TrustLens Multi-Pillar ──
  trustScore?: TrustScore;
  pillarResults?: PillarResults;
}

export interface WcagMappingEntry {
  criterion: string;
  name: string;
  level: "A" | "AA" | "AAA";
  issueCount: number;
  /** 'not-tested' = criterion was N/A for this content (e.g. no video → captions N/A) */
  status: "pass" | "fail" | "not-tested";
}

export interface RemediationStep {
  priority: number;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedPages: string[];
  estimatedEffort: "low" | "medium" | "high";
  frequency: number;
}

export interface PageBreakdownEntry {
  url: string;
  title: string;
  score: number;
  issueCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}
