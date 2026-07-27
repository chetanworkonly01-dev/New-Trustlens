"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";

// ── Accessibility types ──────────────────────────────────────
interface Issue {
  id: string;
  testId: string;
  title: string;
  description: string;
  element: string;
  elementHtml?: string;
  xpath?: string;
  checkData?: Record<string, unknown>;
  elementScreenshot?: string;
  pageUrl: string;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: string;
  severity: "critical" | "high" | "medium" | "low";
  impact: string;
  recommendation: string;
  codeFix?: string;
  category: string;
  source: string;
  confidence?: string;
}
interface Score {
  overall: number;
  categoryScores: Record<string, number>;
  complianceLevel: string;
  totalIssues: number;
  uniqueIssues?: number;
  issueBySeverity: Record<string, number>;
  issueByLevel: Record<string, number>;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
}

// ── Performance types ────────────────────────────────────────
interface ResourceIssue {
  type: string;
  url: string;
  pageUrl: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  recommendation: string;
  metrics?: Record<string, string | number>;
}
interface PerfPage {
  url: string;
  title: string;
  score: number;
  vitals: {
    lcp: number | null;
    cls: number | null;
    fcp: number | null;
    ttfb: number | null;
    tbt: number | null;
    inp: number | null;
  };
  resourceIssues: ResourceIssue[];
  totalTransferSize: number;
  totalRequests: number;
  domNodes: number;
  loadTime: number;
}
interface RecItem {
  priority: string;
  title: string;
  detail: string;
  effort: string;
  impact: string;
  clientReported?: boolean;
  rootCause?: string;
  whyItMatters?: string;
  businessImpact?: string;
  expectedImprovement?: string;
  sampleCode?: string;
  estimatedROI?: string;
}
interface ThirdPartyItem {
  url: string;
  domain: string;
  label: string;
  category: string;
  loadTimeMs: number | null;
  transferSize: number;
  blocking: boolean;
  async: boolean;
  recommendation: string;
}
interface ArchInfo {
  framework: string | null;
  cms: string | null;
  cdn: string | null;
  httpVersion: string | null;
  jsLibraries: string[];
  cssFrameworks: string[];
  hostingPlatform: string | null;
  hasServiceWorker: boolean;
  hasPwaManifest: boolean;
  hasResourceHints: boolean;
}
interface SeoData {
  hasMetaTitle: boolean;
  hasMetaDescription: boolean;
  hasRobotsTxt: boolean | null;
  hasSitemap: boolean | null;
  hasCanonical: boolean;
  hasStructuredData: boolean;
  hasOpenGraph: boolean;
  metaTitleLength: number | null;
  metaDescriptionLength: number | null;
  brokenLinks: string[];
  issues: Array<{ type: string; severity: string; detail: string; recommendation: string }>;
}
interface UXPainPoint {
  area: string;
  severity: string;
  description: string;
  userImpact: string;
}
interface UXImprovement {
  area: string;
  recommendation: string;
  expectedUplift: string;
  effort: string;
}
interface UXResult {
  score: number;
  initialLoadExperience: { score: number; hasLoadingIndicator: boolean; hasSkeletonScreens: boolean; hasProgressiveLoading: boolean; timeToInteractiveMs: number | null };
  visualStability: { score: number; clsDuringInteractionMs: number | null; layoutJankScore: string };
  responsiveness: { score: number; mobileUsabilityScore: number | null; navigationResponseMs: number | null; formResponseMs: number | null; searchResponseMs: number | null };
  animationPerformance: { score: number; scrollJank: boolean; animationFps: number | null; pageTransitionMs: number | null; smoothnessScore: string };
  painPoints: UXPainPoint[];
  improvementOpportunities: UXImprovement[];
}
interface AIRec {
  priority: string;
  title: string;
  description: string;
  rootCause: string;
  whyItMatters: string;
  businessImpact: string;
  recommendation: string;
  estimatedEffort: string;
  expectedImprovement: string;
  sampleCode?: string;
  estimatedROI?: string;
}
interface AIReportData {
  executiveSummary: string;
  developerSummary: string;
  uxNarrative: string;
  businessImpactNarrative: string;
  overallROI: string;
  recommendations: AIRec[];
  devTickets: Array<{ title: string; description: string; acceptanceCriteria: string[]; labels: string[]; storyPoints: number; priority: string }>;
  generatedAt: string;
}
interface PerfResult {
  pages: PerfPage[];
  overallScore: number;
  averageVitals: {
    lcp: number | null;
    cls: number | null;
    fcp: number | null;
    ttfb: number | null;
    tbt: number | null;
    inp: number | null;
  };
  totalResourceIssues: number;
  resourceIssuesByType: Record<string, number>;
  recommendations: RecItem[];
  basePagesAudited?: number;
  targetedPagesAudited?: number;
  authFlow?: {
    loginUrl: string;
    timeToFormMs: number | null;
    submitToResponseMs: number | null;
    responseToInteractiveMs: number | null;
    totalRoundTripMs: number | null;
    status: string;
    issues: ResourceIssue[];
    otpPageLoadMs?: number | null;
  };
  networkSimulation?: Array<{
    preset: string;
    label: string;
    lcp: number | null;
    fcp: number | null;
    ttfb: number | null;
    loadTimeMs: number | null;
    score: number | null;
  }>;
  confirmedClientIssues?: Array<{
    flag: string;
    flagLabel: string;
    status: string;
    summary: string;
    evidence: string;
  }>;
  clientReportedFlags?: string[];
  thirdPartyImpact?: ThirdPartyItem[];
  architecture?: ArchInfo;
  seoReadiness?: SeoData;
  uxPerformance?: UXResult;
  aiReport?: AIReportData;
}

// ── Dark Pattern finding ─────────────────────────────────────
interface DPFinding {
  id: string;
  ruleId: string;
  category: string;
  principle: string;
  title: string;
  description: string;
  element: string;
  elementHtml?: string;
  xpath?: string;
  pageUrl: string;
  severity: "critical" | "high" | "medium" | "low";
  regulation: string[];
  confidence: string;
  recommendation: string;
  userImpact: string;
  evidence: {
    summary: string;
    details: string[];
    screenshotDataUrl?: string;
  };
  source: string;
  brignullPattern?: string;
  brignullNumber?: number;
  dsaArticle?: string;
  fixPriority?: "P0" | "P1" | "P2" | "P3";
  developerFix?: string;
  designerFix?: string;
  legalSummary?: string;
  estimatedEffort?: string;
  findingVerdict?: "verdict" | "signal";
}

interface DPResult {
  findings: DPFinding[];
  ethicsScore: number;
  principleScores: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  consentIntegrity: number;
  choiceSymmetry: number;
  manipulationIndex: number;
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  regulatoryRisks: string[];
}

// ── Shared AuditData type ────────────────────────────────────
interface AuditData {
  id: string;
  status: string;
  config: {
    url?: string;
    type: string;
    wcagLevels?: string[];
    standard?: string;
    enabledPillars?: string[];
  };
  pages: { url: string; title: string }[];
  issues: Issue[];
  score: Score;
  report?: {
    testedLevel?: string;
    executiveSummary: string;
    groupedIssues?: GroupedIssue[];
    wcagMapping: {
      criterion: string;
      name: string;
      level: string;
      issueCount: number;
      status: string;
    }[];
    pageBreakdown: PageBreak[];
    remediationPlan: RemStep[];
  };
  crawlCoverage?: {
    totalPagesFound: number;
    pagesAudited: number;
    coveragePercent: number;
  };
  pillarResults?: {
    performance?: PerfResult;
    darkpatterns?: DPResult;
    privacy?: any;
  };
  trustScore?: {
    overall: number;
    trustLevel: "trusted" | "moderate" | "at-risk" | "critical";
    pillarScores: Record<string, { pillar: string; score: number; weight: number; totalFindings: number; status: string }>;
  };
  startedAt: string;
  completedAt?: string;
}
interface GroupedIssue {
  issueKey: string;
  title: string;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: string;
  severity: string;
  category: string;
  description: string;
  recommendation: string;
  codeFix?: string;
  occurrenceCount: number;
  affectedPages: string[];
  frequency: number;
}
interface PageBreak {
  url: string;
  title: string;
  score: number;
  issueCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}
interface RemStep {
  priority: number;
  severity: string;
  title: string;
  description: string;
  affectedPages: string[];
  estimatedEffort: string;
  frequency?: number;
}

// ── CWV Metrics config ───────────────────────────────────────
const CWV_META = [
  {
    key: "lcp",
    label: "Largest Contentful Paint",
    abbr: "LCP",
    unit: "ms",
    good: 2500,
    poor: 4000,
    desc: "Time for the largest visible element to load",
  },
  {
    key: "fcp",
    label: "First Contentful Paint",
    abbr: "FCP",
    unit: "ms",
    good: 1800,
    poor: 3000,
    desc: "Time until first content appears on screen",
  },
  {
    key: "cls",
    label: "Cumulative Layout Shift",
    abbr: "CLS",
    unit: "",
    good: 0.1,
    poor: 0.25,
    desc: "Visual stability — unexpected layout shifts",
  },
  {
    key: "ttfb",
    label: "Time to First Byte",
    abbr: "TTFB",
    unit: "ms",
    good: 800,
    poor: 1800,
    desc: "Server response time",
  },
  {
    key: "tbt",
    label: "Total Blocking Time",
    abbr: "TBT",
    unit: "ms",
    good: 200,
    poor: 600,
    desc: "Time main thread is blocked from user input",
  },
  {
    key: "inp",
    label: "Interaction to Next Paint",
    abbr: "INP",
    unit: "ms",
    good: 200,
    poor: 500,
    desc: "Responsiveness to user interactions",
  },
];

function cwvStatus(
  key: string,
  val: number | null,
): { label: string; color: string; icon: string } {
  if (val === null || val === undefined)
    return { label: "N/A", color: "#8BA3C7", icon: "—" };
  const m = CWV_META.find((x) => x.key === key);
  if (!m) return { label: "N/A", color: "#8BA3C7", icon: "—" };
  if (val <= m.good) return { label: "Good", color: "#00BA8C", icon: "✓" };
  if (val <= m.poor)
    return { label: "Needs Improvement", color: "#F0AB00", icon: "⚠" };
  return { label: "Poor", color: "#E8002D", icon: "✗" };
}
function fmtCwv(key: string, val: number | null): string {
  if (val === null || val === undefined) return "—";
  if (key === "cls") return val.toFixed(3);
  return Math.round(val).toLocaleString() + " ms";
}
function perfGrade(s: number): { grade: string; color: string } {
  if (s >= 90) return { grade: "A — Excellent", color: "#00BA8C" };
  if (s >= 75) return { grade: "B — Good", color: "#00B2A9" };
  if (s >= 50) return { grade: "C — Needs Improvement", color: "#F0AB00" };
  if (s >= 25) return { grade: "D — Poor", color: "#FF6B00" };
  return { grade: "F — Critical", color: "#E8002D" };
}
function sizeKb(bytes: number): string {
  return bytes > 0 ? (bytes / 1024).toFixed(0) + " KB" : "—";
}

// ── Accessibility helpers ─────────────────────────────────────
type TeamOwner =
  | "Frontend Dev"
  | "Designer"
  | "Content"
  | "QA"
  | "PDF Team"
  | "Design System";
type EffortLabel = "Quick Win" | "1 Sprint" | "Half-day" | "1 hour";
type IssueStatus = "Open" | "In Review" | "Fixed" | "Verified";

function deriveTeam(issue: Issue): TeamOwner {
  const c = issue.wcagCriterion;
  if (["1.1.1", "1.2.1", "1.2.2", "1.2.5"].includes(c)) return "Content";
  if (["1.4.3", "1.4.11", "1.3.3"].includes(c)) return "Designer";
  if (issue.source === "pdf-analyzer" || issue.category === "pdf")
    return "PDF Team";
  if (["1.3.1", "4.1.2", "4.1.3"].includes(c)) return "Design System";
  if (["3.3.1", "3.3.2", "3.3.3"].includes(c)) return "Frontend Dev";
  if (issue.source === "journey-test") return "QA";
  return "Frontend Dev";
}
function deriveEffort(issue: Issue): EffortLabel {
  if (issue.severity === "low") return "Quick Win";
  if (issue.severity === "medium") return "1 hour";
  if (issue.severity === "high") return "Half-day";
  return "1 Sprint";
}
function deriveComponent(issue: Issue): string {
  const t = (issue.title + " " + issue.element).toLowerCase();
  if (t.includes("button") || t.includes("btn")) return "Buttons";
  if (
    t.includes("form") ||
    t.includes("input") ||
    t.includes("label") ||
    t.includes("select") ||
    t.includes("textarea")
  )
    return "Forms";
  if (t.includes("modal") || t.includes("dialog")) return "Modals";
  if (t.includes("nav") || t.includes("menu") || t.includes("link"))
    return "Navigation";
  if (t.includes("table") || t.includes("grid")) return "Tables";
  if (t.includes("img") || t.includes("image") || t.includes("alt"))
    return "Images";
  if (t.includes("pdf")) return "PDF";
  if (t.includes("heading") || t.includes("h1") || t.includes("h2"))
    return "Headings";
  if (t.includes("color") || t.includes("contrast")) return "Colour & Contrast";
  if (t.includes("focus") || t.includes("keyboard")) return "Keyboard & Focus";
  if (t.includes("aria") || t.includes("role")) return "ARIA & Semantics";
  return "General";
}
function deriveAcceptanceCriteria(issue: Issue): string[] {
  const c = issue.wcagCriterion;
  if (c === "2.1.1" || c === "2.1.2")
    return [
      "Keyboard navigation works fully without a mouse",
      "No keyboard trap exists",
    ];
  if (c === "2.4.7" || c === "1.4.11")
    return [
      "Focus indicator is clearly visible on all interactive elements",
      "Focus contrast ratio meets 3:1 minimum",
    ];
  if (c === "1.4.3")
    return [
      "Text contrast ratio meets 4.5:1 (normal text) or 3:1 (large text)",
      "Verified with a contrast analyser tool",
    ];
  if (c === "1.1.1")
    return [
      "All meaningful images have descriptive alt text",
      'Decorative images have empty alt="" or aria-hidden="true"',
    ];
  if (c === "4.1.2")
    return [
      "Screen reader announces the control name, role and state correctly",
      "ARIA attributes are valid and reference existing elements",
    ];
  if (c.startsWith("3.3"))
    return [
      "Error messages are programmatically associated with the input",
      "Error is announced by screen reader without requiring visual reference",
    ];
  if (c === "2.4.1")
    return [
      '"Skip to main content" link is the first focusable element',
      "Link becomes visible on focus",
    ];
  return [
    "Issue is no longer reproducible by the steps provided",
    "Screen reader announces the element correctly",
    "WCAG " + c + " criterion is met",
  ];
}

// ── Palette ────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: "#E8002D",
  high: "#FF6B00",
  // medium: "#F0AB00",
  // low: "#0091DA",
  // critical: "var(--kpmg-dynamic)",
  // high: "var(--kpmg-dynamic)",
  medium: "#F0AB00",
  low: "#0091DA",
};
const SEV_BG: Record<string, string> = {
  CRITICAL: "rgba(224,1,45,0.32)",
  High: "rgba(255,107,0,0.08)",
  Medium: "rgba(240,171,0,0.08)",
  Low: "rgba(0,145,218,0.08)",
};
const TEAM_COLOR: Record<string, string> = {
  // "Frontend Dev": "#0091DA",
  // Designer: "#A78BFA",
  // Content: "#00B2A9",
  // QA: "#00BA8C",
  // "PDF Team": "#F0AB00",
  // "Design System": "#FF6B00",

  "Frontend Dev": "var(--offshade-text)",
  Designer: "var(--offshade-text)",
  Content: "var(--offshade-text)",
  QA: "var(--offshade-text)",
  "PDF Team": "var(--offshade-text)",
  "Design System": "var(--offshade-text)",
};
const EFFORT_COLOR: Record<string, string> = {
  "Quick Win": "#00BA8C",
  "1 hour": "#0091DA",
  "Half-day": "#F0AB00",
  "1 Sprint": "#FF6B00",
};
const COMP_ICON: Record<string, string> = {
  Buttons: "",
  Forms: "",
  Modals: "",
  Navigation: "",
  Tables: "",
  Images: "",
  PDF: "",
  Headings: "",
  "Colour & Contrast": "",
  "Keyboard & Focus": "",
  "ARIA & Semantics": "",
  General: "",

  // "Buttons": "🔘",
  // "Forms": "📋",
  // "Modals": "🪟",
  // "Navigation": "🧭",
  // "Tables": "📊",
  // "Images": "🖼️",
  // "PDF": "📄",
  // "Headings": "📝",
  // "Colour & Contrast": "🎨",
  // "Keyboard & Focus": "⌨️",
  // "ARIA & Semantics": "♿",
  // "General": "🔍",
};

// ── Shared Components ──────────────────────────────────────────
function Tile({
  val,
  label,
  color,
  sub,
}: {
  val: string | number;
  label: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-darkcard)",
        borderLeft: "1px solid var(--dynamic-border)",
        borderRight: "1px solid var(--dynamic-border)",
        borderBottom: "1px solid var(--dynamic-border)",
        borderTop: `1px solid var(--dynamic-border)`,
        // borderTop: `3px solid ${color}`,
        // borderRadius: "var(--radius-md)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 300,
          color: "var(--kpmg-dynamic)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {val}
      </div>
      {sub && (
        <div
          style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}
        >
          {sub}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--offshade-text)",
          textTransform: "capitalize",
          letterSpacing: "0.06em",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "var(--text-primary)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 5,
      }}
    >
      {label}
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--bg-darkcard)",
        border: "1px solid var(--dynamic-border)",
        // borderRadius: "var(--radius-md)",
        padding: 22,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Developer location helpers ──────────────────────────────────
/** Heuristic: does this "element" value look like a real CSS selector, or is it a prose fallback label? */
function looksLikeSelector(s: string): boolean {
  if (!s) return false;
  if (s.includes("/")) return false; // e.g. "timeout/redirect", "status/notification element"
  const withoutCombinators = s.replace(/\s*>\s*/g, ">");
  if (/\s/.test(withoutCombinators)) return false; // remaining whitespace = prose
  return true;
}

function SelectorRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: copied ? "rgba(0,186,140,0.15)" : "var(--bg-glass)",
            color: copied ? "#00BA8C" : "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <code
        style={{
          display: "block",
          fontSize: 11,
          background: "rgba(0,0,0,0.3)",
          padding: "6px 8px",
          borderRadius: 3,
          wordBreak: "break-all",
          whiteSpace: "pre-wrap",
          maxHeight: 120,
          overflowY: "auto",
        }}
      >
        {value}
      </code>
    </div>
  );
}

// ── Issue grouping (one row per violation type, drill down to instances) ──
interface IssueGroup {
  key: string;
  title: string;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: string;
  severity: Issue["severity"];
  category: string;
  instances: (Issue & { team: string; effort: string; component: string })[];
}

function groupIssuesByType(
  items: (Issue & { team: string; effort: string; component: string })[],
): IssueGroup[] {
  const map = new Map<string, IssueGroup>();
  for (const item of items) {
    const key = `${item.wcagCriterion}::${item.title}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        title: item.title,
        wcagCriterion: item.wcagCriterion,
        wcagName: item.wcagName,
        wcagLevel: item.wcagLevel,
        severity: item.severity,
        category: item.category,
        instances: [],
      };
      map.set(key, g);
    }
    g.instances.push(item);
  }
  const sevOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return Array.from(map.values()).sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity],
  );
}

function GroupedIssueCard({
  group,
  idx,
  statusMap,
  onStatusChange,
}: {
  group: IssueGroup;
  idx: number;
  statusMap: Record<string, IssueStatus>;
  onStatusChange: (id: string, s: IssueStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const count = group.instances.length;

  if (count === 1) {
    return (
      <IssueCard
        issue={group.instances[0]}
        idx={idx}
        status={statusMap[group.instances[0].id] || "Open"}
        onStatusChange={onStatusChange}
      />
    );
  }

  const affectedPages = Array.from(
    new Set(group.instances.map((i) => i.pageUrl)),
  );

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          cursor: "pointer",
          flexWrap: "wrap",
          border: `1px solid ${expanded ? "var(--kpmg-dynamic)" : "var(--dynamic-border)"}`,
          borderLeft: `3px solid ${SEV_COLOR[group.severity]}`,
          background: expanded ? "var(--bg-card-hover)" : "var(--bg-card)",
          transition: "var(--transition)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          #{String(idx).padStart(3, "0")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{group.title}</span>
          <span
            style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}
          >
            {affectedPages.length} page{affectedPages.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span
          style={{display: "inline-flex", alignItems: "center", 
            padding: "2px 8px",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 500,
            background: SEV_BG[group.severity],
            color: SEV_COLOR[group.severity],
            border: `1px solid ${SEV_COLOR[group.severity]}40`,
            textTransform: "uppercase",
          }}
        >
          {group.severity}
        </span>
        <span
          style={{display: "inline-flex", alignItems: "center", 
            padding: "2px 8px",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 700,
            background: "rgba(0,145,218,0.12)",
            color: "#0091DA",
          }}
        >
          × {count} instances
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            transform: expanded ? "rotate(180deg)" : "",
            transition: "0.2s",
            userSelect: "none",
          }}
        >
          ▼
        </span>
      </div>
      {expanded && (
        <div
          style={{
            paddingLeft: 14,
            marginTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderLeft: "2px solid var(--dynamic-border)",
          }}
        >
          {group.instances.map((inst, j) => (
            <IssueCard
              key={inst.id}
              issue={inst}
              idx={j + 1}
              status={statusMap[inst.id] || "Open"}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dark Pattern finding grouping (one row per rule+page, drill down to instances) ──
interface DPFindingGroup {
  key: string;
  title: string;
  ruleId: string;
  severity: DPFinding["severity"];
  category: string;
  pageUrl: string;
  instances: DPFinding[];
}

function groupDPFindings(items: DPFinding[]): DPFindingGroup[] {
  const map = new Map<string, DPFindingGroup>();
  for (const item of items) {
    const key = `${item.ruleId}::${item.pageUrl}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        title: item.title,
        ruleId: item.ruleId,
        severity: item.severity,
        category: item.category,
        pageUrl: item.pageUrl,
        instances: [],
      };
      map.set(key, g);
    }
    g.instances.push(item);
  }
  const sevOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return Array.from(map.values()).sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity],
  );
}

function DPFindingCard({ finding, idx }: { finding: DPFinding; idx: number }) {
  const [open, setOpen] = useState(false);
  const elementIsSelector = looksLikeSelector(finding.element || "");
  const devToolsCmd =
    finding.xpath
      ? `$x('${finding.xpath.replace(/'/g, "\\'")}')[0]`
      : elementIsSelector
        ? `document.querySelector('${finding.element.replace(/'/g, "\\'")}')`
        : null;

  return (
    <div
      style={{
        border: `1px solid ${open ? "var(--kpmg-dynamic)" : "var(--dynamic-border)"}`,
        borderLeft: `3px solid ${SEV_COLOR[finding.severity]}`,
        background: open ? "var(--bg-card-hover)" : "var(--bg-card)",
        marginBottom: 8,
        padding: "10px",
        transition: "var(--transition)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          cursor: "pointer",
          flexWrap: "wrap",
        }}
        onClick={() => setOpen(!open)}
      >
        <span
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          #{String(idx).padStart(3, "0")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            {finding.title}
          </span>
          <span
            style={{ marginLeft: 8, fontSize: 13, color: "var(--text-muted)" }}
          >
            {finding.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
          </span>
        </div>
        <span
          style={{display: "inline-flex", alignItems: "center", 
            padding: "2px 8px",
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 500,
            background: SEV_BG[finding.severity],
            color: SEV_COLOR[finding.severity],
            border: `1px solid ${SEV_COLOR[finding.severity]}40`,
            textTransform: "uppercase",
          }}
        >
          {finding.severity}
        </span>
        {finding.brignullPattern && (
          <span
            style={{display: "inline-flex", alignItems: "center", 
              padding: "2px 7px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 500,
              background: "rgba(205,171,254,0.12)",
              color: "#CDABFE",
            }}
          >
            {finding.brignullPattern}
          </span>
        )}
        <span
          style={{display: "inline-flex", alignItems: "center", 
            padding: "2px 7px",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 500,
            background: "rgba(0,145,218,0.1)",
            color: "#0091DA",
          }}
        >
          {finding.ruleId}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "",
            transition: "0.2s",
            userSelect: "none",
          }}
        >
          ▼
        </span>
      </div>
      {open && (
        <div
          style={{
            padding: "0 16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{ height: 1, background: "var(--border)", marginBottom: 4 }}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <SectionLabel label="Description" />
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {finding.description}
                </div>
              </div>
              <div>
                <SectionLabel label="Evidence" />
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {finding.evidence?.summary}
                </div>
              </div>
              <div>
                <SectionLabel label="User Impact" />
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {finding.userImpact}
                </div>
              </div>
              <div>
                <SectionLabel label="Recommendation" />
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {finding.developerFix || finding.recommendation}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <SectionLabel label="Developer Location" />
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {finding.evidence?.screenshotDataUrl && (
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 4,
                        }}
                      >
                        📸 Element Screenshot (captured during audit)
                      </div>
                      <img
                        src={finding.evidence.screenshotDataUrl}
                        alt="Screenshot of flagged element"
                        style={{
                          maxWidth: "100%",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          display: "block",
                        }}
                      />
                    </div>
                  )}
                  {finding.findingVerdict === "signal" && !finding.element ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      AI-detected pattern — no precise DOM element available.
                      See the screenshot and description above for visual
                      context.
                    </div>
                  ) : (
                    <>
                      <SelectorRow
                        label="🎯 CSS Selector"
                        value={finding.element || "(not resolved)"}
                      />
                      {finding.xpath && (
                        <SelectorRow label="📍 XPath" value={finding.xpath} />
                      )}
                      {devToolsCmd && (
                        <SelectorRow
                          label="🔧 DevTools Console Command"
                          value={devToolsCmd}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
              {finding.elementHtml && (
                <div>
                  <SectionLabel label="Affected Element (HTML)" />
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 12,
                      background: "#010B1A",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: "8px 10px",
                      overflowX: "auto",
                      color: "#B0D4F0",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {finding.elementHtml.substring(0, 400)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DPFindingGroupCard({ group }: { group: DPFindingGroup }) {
  const [expanded, setExpanded] = useState(false);
  const count = group.instances.length;

  if (count === 1) {
    return <DPFindingCard finding={group.instances[0]} idx={1} />;
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          cursor: "pointer",
          flexWrap: "wrap",
          border: `1px solid ${expanded ? "var(--kpmg-dynamic)" : "var(--dynamic-border)"}`,
          borderLeft: `3px solid ${SEV_COLOR[group.severity]}`,
          background: expanded ? "var(--bg-card-hover)" : "var(--bg-card)",
          transition: "var(--transition)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{group.title}</span>
          <span
            style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}
          >
            {group.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
          </span>
        </div>
        <span
          style={{display: "inline-flex", alignItems: "center", 
            padding: "2px 8px",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 500,
            background: SEV_BG[group.severity],
            color: SEV_COLOR[group.severity],
            border: `1px solid ${SEV_COLOR[group.severity]}40`,
            textTransform: "uppercase",
          }}
        >
          {group.severity}
        </span>
        <span
          style={{display: "inline-flex", alignItems: "center", 
            padding: "2px 8px",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 700,
            background: "rgba(0,145,218,0.12)",
            color: "#0091DA",
          }}
        >
          × {count} instances
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            transform: expanded ? "rotate(180deg)" : "",
            transition: "0.2s",
            userSelect: "none",
          }}
        >
          ▼
        </span>
      </div>
      {expanded && (
        <div
          style={{
            paddingLeft: 14,
            marginTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderLeft: "2px solid var(--dynamic-border)",
          }}
        >
          {group.instances.map((inst, j) => (
            <DPFindingCard key={inst.id} finding={inst} idx={j + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── IssueCard (Accessibility) ─────────────────────────────────
function IssueCard({
  issue,
  idx,
  status,
  onStatusChange,
}: {
  issue: Issue;
  idx: number;
  status: IssueStatus;
  onStatusChange: (id: string, s: IssueStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const team = deriveTeam(issue);
  const effort = deriveEffort(issue);
  const component = deriveComponent(issue);
  const acceptance = deriveAcceptanceCriteria(issue);
  const elementIsSelector = looksLikeSelector(issue.element);
  const devToolsCmd = issue.xpath
    ? `$x('${issue.xpath.replace(/'/g, "\\'")}')[0]`
    : elementIsSelector
      ? `document.querySelector('${issue.element.replace(/'/g, "\\'")}')`
      : null;
  const statusColors: Record<IssueStatus, string> = {
    // Open: "#FF3356",
    // "In Review": "#F0AB00",
    // Fixed: "#0091DA",
    // Verified: "#00BA8C",

    Open: "var(--kpmg-dynamic)",
    "In Review": "var(--kpmg-dynamic)",
    Fixed: "var(--kpmg-dynamic)",
    Verified: "var(--kpmg-dynamic)",
  };
  return (
    <div
      style={{
        border: `1px solid ${open ? "var(--kpmg-dynamic)" : "var(--dynamic-border)"}`,
        borderLeft: `3px solid ${SEV_COLOR[issue.severity]}`,
        // borderRadius: "var(--radius-md)",
        background: open ? "var(--bg-card-hover)" : "var(--bg-card)",
        marginBottom: 8,
        padding: "10px",
        transition: "var(--transition)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          cursor: "pointer",
          flexWrap: "wrap",
        }}
        onClick={() => setOpen(!open)}
      >
        <span
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          #{String(idx).padStart(3, "0")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{issue.title}</span>
          <span
            style={{ marginLeft: 8, fontSize: 13, color: "var(--text-muted)" }}
          >
            {issue.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 5,
            flexShrink: 0,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{display: "inline-flex", alignItems: "center", 
              padding: "2px 8px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 500,
              background: SEV_BG[issue.severity],
              color: SEV_COLOR[issue.severity],
              border: `1px solid ${SEV_COLOR[issue.severity]}40`,
              textTransform: "uppercase",
            }}
          >
            {issue.severity}
          </span>
          <span
            style={{display: "inline-flex", alignItems: "center", 
              padding: "2px 8px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 500,
              background: `${TEAM_COLOR[team]}15`,
              color: TEAM_COLOR[team],
              border: `1px solid ${TEAM_COLOR[team]}30`,
            }}
          >
            {team}
          </span>
          <span
            style={{display: "inline-flex", alignItems: "center", 
              padding: "2px 8px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 500,
              background: `${EFFORT_COLOR[effort]}15`,
              color: EFFORT_COLOR[effort],
              border: `1px solid ${EFFORT_COLOR[effort]}30`,
            }}
          >
            {effort}
          </span>
          <span
            style={{display: "inline-flex", alignItems: "center", 
              padding: "2px 7px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 500,
              background: "rgba(0,145,218,0.1)",
              color: "#0091DA",
            }}
          >
            {issue.wcagCriterion}
          </span>
          <select
            value={status}
            onChange={(e) => {
              e.stopPropagation();
              onStatusChange(issue.id, e.target.value as IssueStatus);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "2px 7px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 500,
              border: `1px solid var(--kpmg-dynamic)`,
              background: "var(--bg-glass)",
              color: statusColors[status],
              cursor: "pointer",
              // fontFamily: "Open Sans, sans-serif",
              outline: "none",
            }}
          >
            {(["Open", "In Review", "Fixed", "Verified"] as IssueStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              transform: open ? "rotate(180deg)" : "",
              transition: "0.2s",
              userSelect: "none",
            }}
          >
            ▼
          </span>
        </div>
      </div>
      {open && (
        <div
          style={{
            padding: "0 16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{ height: 1, background: "var(--border)", marginBottom: 4 }}
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <SectionLabel label="WCAG Reference" />
                <div style={{ fontSize: 13 }}>
                  <strong>{issue.wcagCriterion}</strong> — {issue.wcagName}{" "}
                  <span
                    style={{display: "inline-flex", alignItems: "center", 
                      padding: "1px 6px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 700,
                      background: "rgba(0,145,218,0.1)",
                      color: "#0091DA",
                      marginLeft: 4,
                    }}
                  >
                    Level {issue.wcagLevel}
                  </span>
                </div>
              </div>
              <div>
                <SectionLabel label="Steps to Reproduce" />
                <ol
                  style={{
                    paddingLeft: 16,
                    margin: 0,
                    fontSize: 12,
                    color: "var(--text-primary)",
                    lineHeight: 1.7,
                  }}
                >
                  <li>
                    Navigate to:{" "}
                    <code
                      style={{
                        fontSize: 12,
                        background: "rgba(0,0,0,0.3)",
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}
                    >
                      {issue.pageUrl}
                    </code>
                  </li>
                  <li>
                    Open DevTools → Console, then paste:{" "}
                    {devToolsCmd ? (
                      <code
                        style={{
                          fontSize: 11,
                          background: "rgba(0,0,0,0.3)",
                          padding: "1px 5px",
                          borderRadius: 3,
                          wordBreak: "break-all",
                        }}
                      >
                        {devToolsCmd}
                      </code>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>
                        no reliable selector — search the page source for the
                        HTML snippet shown under &quot;Affected Element&quot;
                      </span>
                    )}
                  </li>
                  <li>
                    The element will be selected and highlighted in the
                    Elements panel
                  </li>
                  <li>Attempt keyboard-only interaction (Tab, Enter, Space)</li>
                  <li>
                    Enable screen reader (NVDA/JAWS/VoiceOver) and navigate
                  </li>
                </ol>
              </div>
              <div>
                <SectionLabel label="Current vs Expected" />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(232,0,45,0.06)",
                      border: "1px solid rgba(232,0,45,0.2)",
                      // borderRadius: 6,
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#FF3356",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        marginBottom: 4,
                      }}
                    >
                      Current
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {issue.description.substring(0, 200)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(0,186,140,0.06)",
                      border: "1px solid rgba(0,186,140,0.2)",
                      // borderRadius: 6,
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#00BA8C",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        marginBottom: 4,
                      }}
                    >
                      Expected
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {(
                        issue.recommendation ||
                        "Recommendation not available — review the issue description and applicable WCAG criterion."
                      ).substring(0, 200)}
                    </div>
                  </div>
                </div>
              </div>
              {issue.checkData && Object.keys(issue.checkData).length > 0 && (
                <div>
                  <SectionLabel label="Measured Values" />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      fontSize: 12,
                      background: "rgba(0,0,0,0.2)",
                      borderRadius: 4,
                      padding: "8px 10px",
                    }}
                  >
                    {Object.entries(issue.checkData).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", gap: 6 }}>
                        <span style={{ color: "var(--text-muted)" }}>
                          {k}:
                        </span>
                        <span style={{ fontFamily: "monospace" }}>
                          {typeof v === "object"
                            ? JSON.stringify(v)
                            : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <SectionLabel label="Developer Location" />
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {issue.elementScreenshot && (
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginBottom: 4,
                        }}
                      >
                        📸 Element Screenshot (captured during audit)
                      </div>
                      <img
                        src={`data:image/png;base64,${issue.elementScreenshot}`}
                        alt="Screenshot of affected element"
                        style={{
                          maxWidth: "100%",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          display: "block",
                        }}
                      />
                    </div>
                  )}
                  <SelectorRow label="🎯 CSS Selector" value={issue.element} />
                  {issue.xpath && (
                    <SelectorRow label="📍 XPath" value={issue.xpath} />
                  )}
                  {devToolsCmd && (
                    <SelectorRow
                      label="🔧 DevTools Console Command"
                      value={devToolsCmd}
                    />
                  )}
                </div>
              </div>
              <div>
                <SectionLabel label="Affected Element (HTML)" />
                {issue.elementHtml ? (
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 12,
                      background: "#010B1A",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: "8px 10px",
                      overflowX: "auto",
                      color: "#B0D4F0",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {issue.elementHtml.substring(0, 400)}
                  </pre>
                ) : (
                  <code style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {issue.element}
                  </code>
                )}
              </div>
              {issue.codeFix && (
                <div>
                  <SectionLabel label="Recommended Code Fix" />
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 11,
                      background: "#010B1A",
                      border: "1px solid rgba(0,186,140,0.25)",
                      borderRadius: 4,
                      padding: "8px 10px",
                      overflowX: "auto",
                      color: "#86EFAC",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {issue.codeFix.substring(0, 500)}
                  </pre>
                </div>
              )}
              <div>
                <SectionLabel label="Done When (Acceptance Criteria)" />
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  {acceptance.map((a, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.7,
                        marginBottom: 2,
                      }}
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Performance Components ────────────────────────────────────
function CwvGauge({
  metaKey,
  value,
}: {
  metaKey: string;
  value: number | null;
}) {
  const m = CWV_META.find((x) => x.key === metaKey);
  if (!m) return null;
  const status = cwvStatus(metaKey, value);
  const pct =
    value !== null
      ? Math.min(
          100,
          metaKey === "cls" ? (value / m.poor) * 100 : (value / m.poor) * 100,
        )
      : 0;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid var(--border)`,
        borderTop: `3px solid ${status.color}`,
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {m.abbr}
          </div>
          <div
            style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}
          >
            {m.label}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 300,
              color: status.color,
              letterSpacing: "-0.02em",
            }}
          >
            {fmtCwv(metaKey, value)}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: status.color,
              marginTop: 2,
            }}
          >
            {status.icon} {status.label}
          </div>
        </div>
      </div>
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, pct)}%`,
            height: "100%",
            background: status.color,
            borderRadius: 99,
            transition: "width 1s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 5,
          fontSize: 9,
          color: "var(--text-muted)",
        }}
      >
        <span>Good ≤ {fmtCwv(metaKey, m.good)}</span>
        <span>Poor &gt; {fmtCwv(metaKey, m.poor)}</span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 4,
          fontStyle: "italic",
        }}
      >
        {m.desc}
      </div>
    </div>
  );
}

function ResourceIssueBadge({ severity }: { severity: string }) {
  return (
    <span
      style={{display: "inline-flex", alignItems: "center", 
        padding: "1px 7px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        background: SEV_BG[severity] || SEV_BG.low,
        color: SEV_COLOR[severity] || SEV_COLOR.low,
        border: `1px solid ${SEV_COLOR[severity] || SEV_COLOR.low}40`,
        textTransform: "uppercase",
      }}
    >
      {severity}
    </span>
  );
}

// ── Main Report Page ──────────────────────────────────────────
export default function FinalReportPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AuditData | null>(null);
  const [activeTab, setActiveTab] = useState("executive");
  const [statusMap, setStatusMap] = useState<Record<string, IssueStatus>>({});
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [effortFilter, setEffortFilter] = useState<string>("all");
  const [compFilter, setCompFilter] = useState<string>("all");
  const [riSevFilter, setRiSevFilter] = useState<string>("all");
  const [riTypeFilter, setRiTypeFilter] = useState<string>("all");
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [showAllBacklog, setShowAllBacklog] = useState(false);
  const [showAllAcceptance, setShowAllAcceptance] = useState(false);
  const [aiPersona, setAiPersona] = useState<"executive" | "developer" | "pm" | "consultant">("executive");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const [expandedRec, setExpandedRec] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/audit/${id}`);
    if (res.ok) setData(await res.json());
  }, [id]);
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!data)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
        }}
      >
        <div className="spinner" />
      </div>
    );
  if (data.status !== "complete")
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⏳</div>
        <h2>Audit still in progress…</h2>
        <a
          href={`/audit/${id}`}
          className="btn btn-primary"
          style={{ marginTop: 16 }}
        >
          View Live Progress →
        </a>
      </div>
    );

  // ── Pillar detection ──────────────────────────────────────────
  const enabledPillars: string[] = data.config?.enabledPillars || [
    "accessibility",
  ];
  const isA11y =
    enabledPillars.length === 0 || enabledPillars.includes("accessibility");
  const isPerf = enabledPillars.includes("performance");
  const isDP = enabledPillars.includes("darkpatterns");
  const isPriv = enabledPillars.includes("privacy");
  const perfOnly = isPerf && !isA11y && !isDP && !isPriv;

  // ── Core data ─────────────────────────────────────────────────
  const issues = data.issues || [];
  const score = data.score;
  const perfResult: PerfResult | undefined = data.pillarResults?.performance;
  const perfScore = perfResult?.overallScore ?? score.overall;
  const perfGradeInfo = perfGrade(perfScore);
  const testedLevel = data.report?.testedLevel || "AA";
  const standard = data.config?.standard || "WCAG 2.2";
  const reportDate = data.completedAt
    ? new Date(data.completedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "N/A";

  // ── Accessibility derived data ────────────────────────────────
  const augmented = issues.map((i) => ({
    ...i,
    team: deriveTeam(i),
    effort: deriveEffort(i),
    component: deriveComponent(i),
  }));
  const quickWins = augmented.filter((i) => i.effort === "Quick Win");
  const critical = augmented.filter((i) => i.severity === "critical");
  const highPri = augmented.filter((i) => i.severity === "high");
  const medPri = augmented.filter((i) => i.severity === "medium");
  const filtered = augmented.filter(
    (i) =>
      (teamFilter === "all" || i.team === teamFilter) &&
      (sevFilter === "all" || i.severity === sevFilter) &&
      (effortFilter === "all" || i.effort === effortFilter) &&
      (compFilter === "all" || i.component === compFilter),
  );
  const groupedBacklog = groupIssuesByType(filtered);

  // ── Dark Pattern derived data ───────────────────────────────────
  const dpFindings: DPFinding[] = data.pillarResults?.darkpatterns?.findings || [];
  const dpGroupedFindings = groupDPFindings(dpFindings);
  const compGroups: Record<string, typeof augmented> = {};
  augmented.forEach((i) => {
    if (!compGroups[i.component]) compGroups[i.component] = [];
    compGroups[i.component].push(i);
  });
  const teamGroups: Record<string, typeof augmented> = {};
  augmented.forEach((i) => {
    if (!teamGroups[i.team]) teamGroups[i.team] = [];
    teamGroups[i.team].push(i);
  });

  // ── Performance derived data ──────────────────────────────────
  const perfPages = perfResult?.pages || [];
  const avgVitals = perfResult?.averageVitals || {};
  const allResourceIssues: (ResourceIssue & { pageTitle: string })[] =
    perfPages.flatMap((pg) =>
      (pg.resourceIssues || []).map((ri) => ({
        ...ri,
        pageTitle: pg.title || pg.url || "",
      })),
    );
  const recs = (perfResult?.recommendations || []) as RecItem[];
  const p0Recs = recs.filter((r) => r.priority === "P0");
  const p1Recs = recs.filter((r) => r.priority === "P1");
  const p2Recs = recs.filter((r) => r.priority === "P2");
  const p3Recs = recs.filter((r) => r.priority === "P3" || r.priority === "P4");
  const riTypes = [...new Set(allResourceIssues.map((r) => r.type))].sort();
  const filteredRI = allResourceIssues.filter(
    (r) =>
      (riSevFilter === "all" || r.severity === riSevFilter) &&
      (riTypeFilter === "all" || r.type === riTypeFilter),
  );

  // ── Enterprise layer derived data ─────────────────────────────
  const thirdParty = perfResult?.thirdPartyImpact || [];
  const architecture = perfResult?.architecture;
  const seoReadiness = perfResult?.seoReadiness;
  const uxPerf = perfResult?.uxPerformance;
  const aiReport = perfResult?.aiReport;

  // Recharts data builders
  const uxRadarData = uxPerf ? [
    { subject: "Loading", value: uxPerf.initialLoadExperience.score, fullMark: 100 },
    { subject: "Stability", value: uxPerf.visualStability.score, fullMark: 100 },
    { subject: "Responsiveness", value: uxPerf.responsiveness.score, fullMark: 100 },
    { subject: "Animation", value: uxPerf.animationPerformance.score, fullMark: 100 },
    { subject: "Mobile", value: uxPerf.responsiveness.mobileUsabilityScore ?? 75, fullMark: 100 },
  ] : [];

  const uxResponsivenessData = uxPerf ? [
    { name: "Navigation", ms: uxPerf.responsiveness.navigationResponseMs ?? 0, target: 300 },
    { name: "Form Input", ms: uxPerf.responsiveness.formResponseMs ?? 0, target: 100 },
    { name: "Search", ms: uxPerf.responsiveness.searchResponseMs ?? 0, target: 300 },
  ].filter(d => d.ms > 0) : [];

  const networkSimData = (perfResult?.networkSimulation || []).map(s => ({
    name: s.label,
    LCP: s.lcp ?? 0,
    Score: s.score ?? 0,
  }));

  const riPieData = Object.entries(perfResult?.resourceIssuesByType || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.replace(/-/g, ' '), value }));

  const PIE_COLORS = ["#E8002D", "#FF6B00", "#F0AB00", "#0091DA", "#00B2A9", "#00BA8C", "#CDABFE", "#FE7141"];

  const triggerAIAnalysis = async () => {
    if (!data?.id || aiGenerating) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/audit/perf-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
    } finally {
      setAiGenerating(false);
    }
  };

  const exportPerfCSV = () => {
    const rows = [["Page URL", "Issue Type", "Severity", "Description", "Recommendation", "Effort", "Priority"]];
    recs.forEach(r => {
      rows.push([`"${data.config?.url || ''}"`, r.issueType || r.title, r.impact, `"${r.detail.replace(/"/g, '""')}"`, `"${r.detail.replace(/"/g, '""')}"`, r.effort, r.priority]);
    });
    allResourceIssues.forEach(ri => {
      rows.push([`"${ri.pageUrl}"`, ri.type, ri.severity, `"${ri.description.replace(/"/g, '""')}"`, `"${ri.recommendation.replace(/"/g, '""')}"`, "", ""]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url2 = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url2;
    a.download = `kpmg-perf-issues-${data.id}.csv`;
    a.click();
  };

  // ── Display values (pillar-aware) ──────────────────────────────
  // Derived from the pillars actually selected for this audit — never a generic bucket name.
  const PILLAR_LABEL: Record<string, string> = {
    accessibility: "Accessibility",
    darkpatterns: "Dark Patterns",
    performance: "Performance",
    privacy: "Privacy",
  };
  const pillarNames = enabledPillars.map((p) => PILLAR_LABEL[p] ?? p);
  const isMultiPillar = enabledPillars.length > 1;
  const joinedPillarNames =
    enabledPillars.length === 4 ? null : pillarNames.join(" + ");
  const displayScore = isMultiPillar
    ? (data.trustScore?.overall ?? score.overall)
    : perfOnly
      ? perfScore
      : isDP
        ? (data.pillarResults?.darkpatterns?.ethicsScore ?? score.overall)
        : isPriv && !isA11y
          ? (data.pillarResults?.privacy?.overallScore ?? score.overall)
          : score.overall;
  const scoreColor =
    displayScore >= 75 ? "#00BA8C" : displayScore >= 50 ? "#F0AB00" : "#FF3356";
  const reportTitle = isMultiPillar
    ? joinedPillarNames
      ? `${joinedPillarNames} Audit`
      : "TrustLens 4-Pillar Audit"
    : `${pillarNames[0]} Audit`;
  const headerSub = perfOnly
    ? `${data.config?.url || ""} · Performance Score: ${perfScore}/100 · ${reportDate}`
    : `${data.config?.url || ""} · ${isA11y && !isMultiPillar ? `${standard} Level ${testedLevel}` : enabledPillars.join(", ")} · ${reportDate}`;

  // ── Tabs (pillar-aware) ───────────────────────────────────────
  const TABS = perfOnly
    ? [
        { id: "executive", label: "Executive Summary" },
        { id: "cwv", label: "Core Web Vitals" },
        { id: "ux-performance", label: "UX Performance" },
        { id: "pages", label: "Page Analysis" },
        { id: "resources", label: "Resource Issues" },
        { id: "third-party", label: "Third-Party Impact" },
        { id: "architecture", label: "Architecture" },
        { id: "seo", label: "Technical SEO" },
        { id: "best-practices", label: "Best Practices" },
        { id: "action-plan", label: "Action Plan" },
        { id: "network", label: "Network & Auth" },
        { id: "ai-insights", label: "AI Insights" },
        { id: "roadmap", label: "Roadmap" },
      ]
    : [
        { id: "executive", label: "Executive Summary" },
        ...(isA11y
          ? [
              // { id: "backlog", label: "Issue Backlog" },
              { id: "components", label: "Components" },
              { id: "remediation", label: "Remediation Guide" },
              { id: "priority", label: "Priority Matrix" },
              // { id: "acceptance", label: "Acceptance / QA" },
            ]
          : []),
        ...(isDP ? [{ id: "dark-patterns", label: "Dark Patterns" }] : []),
        ...(isPerf ? [{ id: "performance", label: "Performance" }] : []),
      ];

  const handleStatusChange = (issueId: string, s: IssueStatus) =>
    setStatusMap((prev) => ({ ...prev, [issueId]: s }));

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [
        "ID",
        "Title",
        "Page",
        "WCAG",
        "Level",
        "Severity",
        "Team",
        "Effort",
        "Component",
        "Status",
        "Description",
      ],
    ];
    data.issues.forEach((issue, i) => {
      rows.push([
        `#${String(i + 1).padStart(3, "0")}`,
        issue.title,
        issue.pageUrl,
        issue.wcagCriterion,
        issue.wcagLevel,
        issue.severity,
        deriveTeam(issue),
        deriveEffort(issue),
        deriveComponent(issue),
        statusMap[issue.id] || "Open",
        `"${issue.description.replace(/"/g, '""')}"`,
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpmg-audit-${id}.csv`;
    a.click();
  };

  const TEAM_NOTES: Record<string, string> = {
    "Frontend Dev":
      "Focus on semantic HTML structure, keyboard event handlers, ARIA attributes, focus management, and form error handling.",
    Designer:
      "Review color contrast ratios, focus indicator visibility, touch target sizing, and visual hierarchy.",
    Content:
      "Provide descriptive alt text, rewrite vague link text, ensure heading hierarchy, and update button labels.",
    "Design System":
      "Fixing the component at design-system level resolves all instances across every page automatically.",
    QA: "Convert each issue into a regression test case. Add keyboard-only and screen-reader runs to CI/CD.",
    "PDF Team":
      "Ensure PDFs are tagged, have logical reading order, include alt text, and declare document language.",
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* ── Report Header ─────────────────────────────────────── */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #00338D 0%, #005EB8 60%, #0091DA 100%)",
          padding: "32px 0 15px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -80,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: -40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.03)",
          }}
        />
        <div className="container" style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 18,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {/* <Image
                  src="/kpmg-logo-dark.svg"
                  alt="KPMG"
                  width={100}
                  height={30}
                  style={{ width: 100, height: "auto" }}
                  priority
                />
                <div
                  style={{
                    width: 1,
                    height: 36,
                    background: "rgba(255,255,255,0.3)",
                  }}
                /> */}
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        border: `3px solid ${scoreColor}`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.25)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 30,
                          fontWeight: 300,
                          color: "white",
                          letterSpacing: "-0.03em",
                          lineHeight: 1,
                        }}
                      >
                        {displayScore}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "rgba(255,255,255,0.55)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Score
                      </div>
                    </div>
                    {perfOnly && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: perfGradeInfo.color,
                          marginTop: 5,
                        }}
                      >
                        {perfGradeInfo.grade}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  {/* <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                    }}
                  >
                    {reportTitle}
                  </div> */}
                  <div
                    style={{ fontSize: 32, fontWeight: 600, color: "white" }}
                  >
                    Final Delivery Report
                  </div>
                </div>
              </div>
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 300,
                  color: "white",
                  letterSpacing: "-0.02em",
                  margin: "0 0 6px",
                }}
              >
                {reportTitle} Report
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.7)",
                  paddingBottom: "10px",
                }}
              >
                {headerSub}
              </p>
              {/* Pillar badges */}
              {/* <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                {enabledPillars.map((p) => (
                  <span
                    key={p}
                    style={{display: "inline-flex", alignItems: "center", 
                      padding: "2px 10px",
                      borderRadius: 99,
                      marginTop: "10px",
                      fontSize: 14,
                      fontWeight: 700,
                      background: "rgba(255,255,255,0.15)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.25)",
                      textTransform: "capitalize",
                    }}
                  >
                    {p === "accessibility"
                      ? "♿ Accessibility"
                      : p === "performance"
                        ? "⚡ Performance"
                        : p === "darkpatterns"
                          ? "🕵️ Dark Patterns"
                          : ""}
                  </span>
                ))}
              </div> */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "start",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <a
                  href={`/audit/${id}/report?format=docx`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = `/api/export-report?id=${id}&format=docx`;
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: 11,
                    background: "rgba(255,255,255,0.12)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.25)",
                    textDecoration: "none",
                    textAlign: "center",
                    width: "120px",
                  }}
                >
                  Export DOCS
                </a>
                {isA11y && (
                  <button
                    onClick={exportCSV}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: 11,
                      background: "rgba(255,255,255,0.12)",
                      color: "white",
                      width: "120px",
                      border: "1px solid rgba(255,255,255,0.25)",
                    }}
                  >
                    Export CSV
                  </button>
                )}
                {perfOnly && (
                  <button
                    onClick={exportPerfCSV}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: 11,
                      background: "rgba(255,255,255,0.12)",
                      color: "white",
                      width: "120px",
                      border: "1px solid rgba(255,255,255,0.25)",
                    }}
                  >
                    Export CSV
                  </button>
                )}
                <a
                  href={`/api/export-report?id=${id}&format=pdf`}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: 11,
                    background: "rgba(255,255,255,0.12)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.25)",
                    textDecoration: "none",
                    width: "120px",
                    textAlign: "center",
                  }}
                >
                  Export PDF
                </a>
                <a
                  href={`/audit/${id}`}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: 11,
                    background: "rgba(255,255,255,0.12)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.25)",
                    textDecoration: "none",
                    width: "120px",
                    textAlign: "center",
                  }}
                >
                  Live Results
                </a>
              </div>
            </div>
            {/* Score circle */}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-gradient)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 66,
          zIndex: 50,
        }}
      >
        <div className="container">
          {/* <div style={{ display: "flex", gap: 0, overflowX: "none" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: "13px 18px",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === t.id ? "#003087" : "transparent"}`,
                  background: "transparent",
                  color: activeTab === t.id ? "#003087" : "var(--text-muted)",
                  fontWeight: activeTab === t.id ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "Open Sans, sans-serif",
                  transition: "var(--transition)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div> */}
          <div style={{ display: "flex", gap: 0, width: "100%", minWidth: 0 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  padding: "13px 18px",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === t.id ? "#003087" : "transparent"}`,
                  background: "transparent",
                  color:
                    activeTab === t.id
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  fontWeight: activeTab === t.id ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "Open Sans, sans-serif",
                  transition: "var(--transition)",
                  // Text truncation styles
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="container" style={{ paddingTop: 28, paddingBottom: 80 }}>
        {/* ══ EXECUTIVE SUMMARY ══ */}
        {activeTab === "executive" && (
          <div className="animate-fade-in">
            {/* ── PERFORMANCE EXECUTIVE SUMMARY ── */}
            {perfOnly && perfResult && (
              <>
                {/* KPI row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  <Tile
                    val={perfScore}
                    label="Performance Score"
                    color={scoreColor}
                    sub="/100"
                  />
                  <Tile
                    val={perfResult.totalResourceIssues}
                    label="Resource Issues"
                    color="#FF6B00"
                  />
                  <Tile
                    val={p0Recs.length}
                    label="P0 — Immediate"
                    color="#E8002D"
                    sub="fix before next release"
                  />
                  <Tile
                    val={p1Recs.length}
                    label="P1 — Next Sprint"
                    color="#FF6B00"
                  />
                  <Tile
                    val={perfPages.length}
                    label="Pages Analysed"
                    color="#0091DA"
                    sub={
                      perfResult?.targetedPagesAudited
                        ? `${perfResult.basePagesAudited ?? 0} crawled + ${perfResult.targetedPagesAudited} targeted`
                        : "Core Web Vitals"
                    }
                  />
                </div>

                {/* CWV quick dashboard */}
                <div style={{ marginBottom: 24 }}>
                  <h3
                    style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}
                  >
                    ⚡ Core Web Vitals — Average Across All Pages
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 12,
                    }}
                  >
                    {CWV_META.map((m) => (
                      <CwvGauge
                        key={m.key}
                        metaKey={m.key}
                        value={(avgVitals as any)[m.key] ?? null}
                      />
                    ))}
                  </div>
                </div>

                {/* Best / Worst page */}
                {perfPages.length > 1 &&
                  (() => {
                    const best = [...perfPages].sort(
                      (a, b) => b.score - a.score,
                    )[0];
                    const worst = [...perfPages].sort(
                      (a, b) => a.score - b.score,
                    )[0];
                    return (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 16,
                          marginBottom: 24,
                        }}
                      >
                        <Card style={{ borderTop: "3px solid #00BA8C" }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#00BA8C",
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              marginBottom: 8,
                            }}
                          >
                            Best Performing Page
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            {best.title || best.url}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {best.url}
                          </div>
                          <div
                            style={{
                              fontSize: 26,
                              fontWeight: 300,
                              color: "#00BA8C",
                              marginTop: 8,
                            }}
                          >
                            {best.score}
                            <span style={{ fontSize: 14 }}>/100</span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              LCP: {fmtCwv("lcp", best.vitals.lcp)}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              CLS: {fmtCwv("cls", best.vitals.cls)}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              FCP: {fmtCwv("fcp", best.vitals.fcp)}
                            </span>
                          </div>
                        </Card>
                        <Card style={{ borderTop: "3px solid #E8002D" }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#E8002D",
                              textTransform: "uppercase",
                              letterSpacing: "0.07em",
                              marginBottom: 8,
                            }}
                          >
                            Needs Most Attention
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            {worst.title || worst.url}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {worst.url}
                          </div>
                          <div
                            style={{
                              fontSize: 26,
                              fontWeight: 300,
                              color: worst.score >= 50 ? "#F0AB00" : "#E8002D",
                              marginTop: 8,
                            }}
                          >
                            {worst.score}
                            <span style={{ fontSize: 14 }}>/100</span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              LCP: {fmtCwv("lcp", worst.vitals.lcp)}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              {worst.resourceIssues?.length || 0} resource
                              issues
                            </span>
                          </div>
                        </Card>
                      </div>
                    );
                  })()}

                {/* Resource issue type breakdown */}
                {Object.keys(perfResult.resourceIssuesByType || {}).length >
                  0 && (
                  <Card style={{ marginBottom: 24 }}>
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginBottom: 14,
                      }}
                    >
                      Resource Issues by Category
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {Object.entries(perfResult.resourceIssuesByType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => (
                          <div
                            key={type}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 12px",
                              background: "rgba(0,145,218,0.06)",
                              border: "1px solid rgba(0,145,218,0.15)",
                              borderRadius: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                              }}
                            >
                              {type.replace(/-/g, " ")}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#0091DA",
                              }}
                            >
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </Card>
                )}

                {/* P0 immediate actions */}
                {p0Recs.length > 0 && (
                  <div
                    style={{
                      marginBottom: 24,
                      background: "rgba(232,0,45,0.04)",
                      border: "1px solid rgba(232,0,45,0.2)",
                      borderRadius: "var(--radius-md)",
                      padding: 22,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginBottom: 14,
                        color: "#FF3356",
                      }}
                    >
                      P0 — Fix Before Next Release
                    </h3>
                    {p0Recs.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          padding: "9px 0",
                          borderBottom:
                            i < p0Recs.length - 1
                              ? "1px solid rgba(232,0,45,0.1)"
                              : "none",
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "#E8002D",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {r.title}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {r.detail}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            flexShrink: 0,
                            textAlign: "right",
                          }}
                        >
                          <span
                            style={{display: "inline-flex", alignItems: "center", 
                              padding: "2px 8px",
                              borderRadius: 99,
                              fontSize: 10,
                              fontWeight: 700,
                              background: "rgba(232,0,45,0.1)",
                              color: "#E8002D",
                            }}
                          >
                            {r.impact} Impact
                          </span>
                          <span
                            style={{display: "inline-flex", alignItems: "center", 
                              padding: "2px 8px",
                              borderRadius: 99,
                              fontSize: 10,
                              color: "var(--text-muted)",
                              background: "var(--bg-secondary)",
                            }}
                          >
                            {r.effort}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Client-reported issues */}
                {(perfResult.confirmedClientIssues || []).length > 0 && (
                  <Card style={{ marginBottom: 24 }}>
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginBottom: 14,
                      }}
                    >
                      Client-Reported Issues — Verification Results
                    </h3>
                    {(perfResult.confirmedClientIssues || []).map((ci, i) => {
                      const statusStyle =
                        ci.status === "confirmed"
                          ? {
                              bg: "rgba(232,0,45,0.07)",
                              border: "rgba(232,0,45,0.2)",
                              color: "#E8002D",
                              icon: "✗ Confirmed",
                            }
                          : ci.status === "partial"
                            ? {
                                bg: "rgba(240,171,0,0.07)",
                                border: "rgba(240,171,0,0.2)",
                                color: "#F0AB00",
                                icon: "⚠ Partial",
                              }
                            : {
                                bg: "rgba(0,186,140,0.07)",
                                border: "rgba(0,186,140,0.2)",
                                color: "#00BA8C",
                                icon: "✓ Not Found",
                              };
                      return (
                        <div
                          key={i}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 3fr 3fr",
                            gap: 12,
                            padding: "10px 0",
                            borderBottom:
                              i <
                              (perfResult.confirmedClientIssues || []).length -
                                1
                                ? "1px solid var(--border)"
                                : "none",
                            alignItems: "start",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 12 }}>
                            {ci.flagLabel || ci.flag}
                          </div>
                          <span
                            style={{display: "inline-flex", alignItems: "center", 
                              padding: "2px 8px",
                              borderRadius: 99,
                              fontSize: 10,
                              fontWeight: 700,
                              background: statusStyle.bg,
                              border: `1px solid ${statusStyle.border}`,
                              color: statusStyle.color,
                            }}
                          >
                            {statusStyle.icon}
                          </span>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {ci.summary}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              fontStyle: "italic",
                            }}
                          >
                            {ci.evidence}
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                )}

                {/* Audit narrative */}
                <Card>
                  <h3
                    style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}
                  >
                    Audit Narrative
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.8,
                      whiteSpace: "pre-line",
                      margin: 0,
                    }}
                  >
                    {data.report?.executiveSummary || "No summary available."}
                  </p>
                </Card>
              </>
            )}

            {/* ── ACCESSIBILITY EXECUTIVE SUMMARY ── */}
            {(isA11y || !perfOnly) && !perfOnly && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  <Tile
                    val={score.overall}
                    label="Overall Score"
                    color={scoreColor}
                    sub="/100"
                  />
                  <Tile
                    val={score.uniqueIssues ?? issues.length}
                    label="Unique Issues"
                    color="#FF6B00"
                    sub={`${issues.length} instances`}
                  />
                  <Tile
                    val={score.issueBySeverity.critical}
                    label="Critical Blockers"
                    color="#E8002D"
                  />
                  <Tile
                    val={score.issueBySeverity.high}
                    label="High Priority"
                    color="#FF6B00"
                  />
                  <Tile
                    val={quickWins.length}
                    label="Quick Wins"
                    color="#00BA8C"
                    sub="fix in <30 min"
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 18,
                    marginBottom: 24,
                  }}
                >
                  <Card>
                    <h3
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        marginBottom: 14,
                      }}
                    >
                      Business Impact
                    </h3>
                    {score.overall < 50 && (
                      <div
                        style={{
                          padding: "10px 14px",
                          background: "rgba(232,0,45,0.07)",
                          border: "1px solid rgba(232,0,45,0.2)",
                          borderRadius: 6,
                          marginBottom: 10,
                          fontSize: 14,
                          color: "#FF3356",
                        }}
                      >
                        <strong>High Legal Risk</strong> — May not meet ADA / EN
                        301 549 / Section 508 obligations.
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 9,
                      }}
                    >
                      {[
                        {
                          icon: "🦯",
                          label: "Screen Reader Users",
                          impact: `${score.issueBySeverity.critical + score.issueBySeverity.high} issues directly block assistive technology`,
                        },
                        {
                          icon: "⌨️",
                          label: "Keyboard-Only Users",
                          impact:
                            "Focus management failures affect non-mouse users",
                        },
                        {
                          icon: "👁️",
                          label: "Low Vision Users",
                          impact:
                            score.categoryScores.perceivable < 70
                              ? "Colour contrast and visual clarity issues detected"
                              : "Perceivable category is passing",
                        },
                        {
                          icon: "🌍",
                          label: "Global Reach",
                          impact:
                            "~15% of the population lives with a disability",
                        },
                      ].map((r) => (
                        <div key={r.label} style={{ display: "flex", gap: 10 }}>
                          {/* <span style={{ fontSize: 18, flexShrink: 0 }}>
                            {r.icon}
                          </span> */}
                          <div>
                            <strong style={{ fontSize: 14 }}>{r.label}</strong>
                            <div
                              style={{
                                fontSize: 13,
                                paddingTop: "4px",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {r.impact}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <h3
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        marginBottom: 14,
                      }}
                    >
                      Risk Heat Map — WCAG Principles
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {Object.entries(score.categoryScores)
                        .filter(
                          ([k]) =>
                            k !== "pdf" || score.categoryScores.pdf < 100,
                        )
                        .map(([cat, val]) => {
                          const s = val as number;
                          const color =
                            s >= 80
                              ? "#00BA8C"
                              : s >= 60
                                ? "#F0AB00"
                                : "#FF3356";
                          const labels: Record<string, string> = {
                            perceivable: "Perceivable",
                            operable: "Operable",
                            understandable: "Understandable",
                            robust: "Robust",
                            pdf: "PDF",
                          };
                          return (
                            <div
                              key={cat}
                              style={{
                                padding: "12px 14px",
                                // background: `${color}10`,
                                border: `1px solid var(--kpmg-dynamic)`,
                                // borderRadius: 6,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginBottom: 5,
                                }}
                              >
                                <span style={{ fontSize: 12, fontWeight: 700 }}>
                                  {labels[cat] || cat}
                                </span>
                                <span
                                  style={{
                                    fontSize: 16,
                                    fontWeight: 300,
                                    color,
                                  }}
                                >
                                  {s}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 4,
                                  background: "rgba(255,255,255,0.06)",
                                  borderRadius: 99,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${s}%`,
                                    height: "100%",
                                    background: "var(--kpmg-dynamic)",
                                    borderRadius: 99,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </Card>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  <Tile
                    val={score.testsRun}
                    label="Tests Run"
                    color="var(--accent-blue)"
                  />
                  <Tile
                    val={score.testsPassed}
                    label="Tests Passed"
                    color="#00BA8C"
                  />
                  <Tile
                    val={score.testsFailed}
                    label="Tests Failed"
                    color="#FF3356"
                  />
                  <Tile
                    val={`${data.crawlCoverage?.coveragePercent ?? "—"}%`}
                    label="Page Coverage"
                    color="#A78BFA"
                    sub={`${data.crawlCoverage?.pagesAudited ?? "—"} of ${data.crawlCoverage?.totalPagesFound ?? "—"} pages`}
                  />
                </div>
                <Card style={{ marginBottom: 18 }}>
                  <h3
                    style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}
                  >
                    Audit Narrative
                  </h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      lineHeight: 1.8,
                      whiteSpace: "pre-line",
                      margin: 0,
                    }}
                  >
                    {data.report?.executiveSummary || "No summary available."}
                  </p>
                </Card>
                {critical.length > 0 && (
                  <div
                    style={{
                      background: "var(--bg-darkcard)",
                      border: "1px solid var(--dynamic-border)",
                      padding: 22,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginBottom: 14,
                        color: "#FF3356",
                      }}
                    >
                      Top {Math.min(5, critical.length)} Critical Actions — Fix
                      This Sprint
                    </h3>
                    {critical.slice(0, 5).map((issue, i) => (
                      <div
                        key={issue.id}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          padding: "9px 0",
                          borderBottom:
                            i < Math.min(4, critical.length - 1)
                              ? "1px solid rgba(232,0,45,0.1)"
                              : "none",
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "#E8002D",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {issue.title}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--offshade-text)",
                              marginTop: 2,
                            }}
                          >
                            WCAG {issue.wcagCriterion} ·{" "}
                            {issue.pageUrl.replace(/^https?:\/\/[^/]+/, "") ||
                              "/"}{" "}
                            · Owner:{" "}
                            <strong style={{ color: TEAM_COLOR[issue.team] }}>
                              {issue.team}
                            </strong>
                          </div>
                        </div>
                        <span
                          style={{display: "inline-flex", alignItems: "center", 
                            marginLeft: "auto",
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 700,
                            background: `${EFFORT_COLOR[issue.effort]}15`,
                            color: EFFORT_COLOR[issue.effort],
                            border: `1px solid ${EFFORT_COLOR[issue.effort]}30`,
                            flexShrink: 0,
                          }}
                        >
                          {issue.effort}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ CORE WEB VITALS TAB (perf-only) ══ */}
        {activeTab === "cwv" && perfOnly && (
          <div className="animate-fade-in">
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Google's Core Web Vitals are the key metrics for measuring
              real-world user experience. Each metric has thresholds defining
              Good, Needs Improvement, and Poor performance.
            </p>

            {/* Averages */}
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              📊 Average Vitals Across {perfPages.length} Page(s)
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
                marginBottom: 28,
              }}
            >
              {CWV_META.map((m) => (
                <CwvGauge
                  key={m.key}
                  metaKey={m.key}
                  value={(avgVitals as any)[m.key] ?? null}
                />
              ))}
            </div>

            {/* CWV threshold reference */}
            <Card style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                📏 Google Threshold Reference
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#00338D", color: "white" }}>
                      {[
                        "Metric",
                        "Full Name",
                        "Good",
                        "Needs Improvement",
                        "Poor",
                        "What It Measures",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "9px 12px",
                            textAlign: "left",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CWV_META.map((m, i) => {
                      const v = (avgVitals as any)[m.key] ?? null;
                      const st = cwvStatus(m.key, v);
                      return (
                        <tr
                          key={m.key}
                          style={{
                            background:
                              i % 2 === 0
                                ? "rgba(245,247,250,0.04)"
                                : "transparent",
                          }}
                        >
                          <td
                            style={{
                              padding: "9px 12px",
                              fontWeight: 700,
                              color: st.color,
                            }}
                          >
                            {m.abbr}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {m.label}
                          </td>
                          <td style={{ padding: "9px 12px", color: "#00BA8C" }}>
                            ≤{" "}
                            {m.key === "cls"
                              ? m.good.toFixed(2)
                              : m.good.toLocaleString()}
                            {m.unit && " " + m.unit}
                          </td>
                          <td style={{ padding: "9px 12px", color: "#F0AB00" }}>
                            {m.key === "cls"
                              ? `${m.good.toFixed(2)} – ${m.poor.toFixed(2)}`
                              : `${m.good.toLocaleString()} – ${m.poor.toLocaleString()} ms`}
                          </td>
                          <td style={{ padding: "9px 12px", color: "#E8002D" }}>
                            &gt;{" "}
                            {m.key === "cls"
                              ? m.poor.toFixed(2)
                              : m.poor.toLocaleString()}
                            {m.unit && " " + m.unit}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              color: "var(--text-muted)",
                              fontSize: 11,
                            }}
                          >
                            {m.desc}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pass/fail count */}
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                ✅ Vital Pass / Fail Summary
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 10,
                }}
              >
                {["Good", "Needs Improvement", "Poor"].map((label) => {
                  const color =
                    label === "Good"
                      ? "#00BA8C"
                      : label === "Poor"
                        ? "#E8002D"
                        : "#F0AB00";
                  const count = CWV_META.filter(
                    (m) =>
                      cwvStatus(m.key, (avgVitals as any)[m.key] ?? null)
                        .label === label,
                  ).length;
                  return (
                    <div
                      key={label}
                      style={{
                        padding: "14px 18px",
                        background: `${color}10`,
                        border: `1px solid ${color}25`,
                        borderRadius: "var(--radius-md)",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 32, fontWeight: 300, color }}>
                        {count}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginTop: 4,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        of 6 vitals
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ══ PAGE ANALYSIS TAB (perf-only) ══ */}
        {activeTab === "pages" && perfOnly && (
          <div className="animate-fade-in">
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Individual page performance scores and Core Web Vitals. Click a
              page to see resource issues and detailed metrics.
            </p>
            {perfPages.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 56,
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>No page
                data available.
              </div>
            ) : (
              perfPages.map((pg, i) => {
                const isOpen = expandedPage === pg.url;
                const pgColor =
                  pg.score >= 75
                    ? "#00BA8C"
                    : pg.score >= 50
                      ? "#F0AB00"
                      : "#E8002D";
                const critRI = (pg.resourceIssues || []).filter(
                  (r) => r.severity === "critical",
                ).length;
                return (
                  <div
                    key={pg.url}
                    style={{
                      marginBottom: 10,
                      border: `1px solid ${isOpen ? "var(--border-hover)" : "var(--border)"}`,
                      borderLeft: `3px solid ${pgColor}`,
                      borderRadius: "var(--radius-md)",
                      background: isOpen
                        ? "var(--bg-card-hover)"
                        : "var(--bg-card)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 18px",
                        cursor: "pointer",
                      }}
                      onClick={() => setExpandedPage(isOpen ? null : pg.url)}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          border: `2px solid ${pgColor}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: pgColor,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {pg.score}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {pg.title || pg.url}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pg.url}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          flexShrink: 0,
                          fontSize: 11,
                          color: "var(--text-muted)",
                        }}
                      >
                        <span>
                          LCP:{" "}
                          <strong
                            style={{
                              color: cwvStatus("lcp", pg.vitals.lcp).color,
                            }}
                          >
                            {fmtCwv("lcp", pg.vitals.lcp)}
                          </strong>
                        </span>
                        <span>
                          CLS:{" "}
                          <strong
                            style={{
                              color: cwvStatus("cls", pg.vitals.cls).color,
                            }}
                          >
                            {fmtCwv("cls", pg.vitals.cls)}
                          </strong>
                        </span>
                        <span>
                          FCP:{" "}
                          <strong
                            style={{
                              color: cwvStatus("fcp", pg.vitals.fcp).color,
                            }}
                          >
                            {fmtCwv("fcp", pg.vitals.fcp)}
                          </strong>
                        </span>
                        <span>
                          Resources:{" "}
                          <strong
                            style={{
                              color:
                                critRI > 0 ? "#E8002D" : "var(--text-primary)",
                            }}
                          >
                            {pg.resourceIssues?.length || 0}{" "}
                            {critRI > 0 ? `(${critRI} critical)` : ""}
                          </strong>
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          transform: isOpen ? "rotate(180deg)" : "",
                          transition: "0.2s",
                        }}
                      >
                        ▼
                      </span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "0 18px 18px" }}>
                        <div
                          style={{
                            height: 1,
                            background: "var(--border)",
                            marginBottom: 14,
                          }}
                        />
                        {/* Full vitals */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          {CWV_META.map((m) => (
                            <div
                              key={m.key}
                              style={{
                                padding: "10px 12px",
                                background: `${cwvStatus(m.key, (pg.vitals as any)[m.key]).color}10`,
                                border: `1px solid ${cwvStatus(m.key, (pg.vitals as any)[m.key]).color}25`,
                                borderRadius: 6,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span style={{ fontSize: 11, fontWeight: 700 }}>
                                  {m.abbr}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: cwvStatus(
                                      m.key,
                                      (pg.vitals as any)[m.key],
                                    ).color,
                                    fontWeight: 700,
                                  }}
                                >
                                  {
                                    cwvStatus(m.key, (pg.vitals as any)[m.key])
                                      .icon
                                  }{" "}
                                  {
                                    cwvStatus(m.key, (pg.vitals as any)[m.key])
                                      .label
                                  }
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 20,
                                  fontWeight: 300,
                                  color: cwvStatus(
                                    m.key,
                                    (pg.vitals as any)[m.key],
                                  ).color,
                                  marginTop: 4,
                                }}
                              >
                                {fmtCwv(m.key, (pg.vitals as any)[m.key])}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Page stats */}
                        <div
                          style={{
                            display: "flex",
                            gap: 20,
                            marginBottom: 14,
                            fontSize: 12,
                            color: "var(--text-muted)",
                          }}
                        >
                          <span>
                            Transfer:{" "}
                            <strong>{sizeKb(pg.totalTransferSize)}</strong>
                          </span>
                          <span>
                            Requests: <strong>{pg.totalRequests}</strong>
                          </span>
                          <span>
                            DOM Nodes:{" "}
                            <strong>{pg.domNodes?.toLocaleString()}</strong>
                          </span>
                          <span>
                            Load:{" "}
                            <strong>
                              {pg.loadTime
                                ? Math.round(pg.loadTime).toLocaleString() +
                                  " ms"
                                : "—"}
                            </strong>
                          </span>
                        </div>
                        {/* Resource issues */}
                        {(pg.resourceIssues || []).length > 0 && (
                          <>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.07em",
                                marginBottom: 8,
                              }}
                            >
                              Resource Issues
                            </div>
                            {(pg.resourceIssues || []).map((ri, j) => (
                              <div
                                key={j}
                                style={{
                                  display: "flex",
                                  gap: 10,
                                  alignItems: "flex-start",
                                  padding: "7px 0",
                                  borderBottom:
                                    j < pg.resourceIssues.length - 1
                                      ? "1px solid var(--border)"
                                      : "none",
                                }}
                              >
                                <ResourceIssueBadge severity={ri.severity} />
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{ fontSize: 12, fontWeight: 600 }}
                                  >
                                    {ri.type.replace(/-/g, " ")}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "var(--text-muted)",
                                      marginTop: 2,
                                    }}
                                  >
                                    {ri.description}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#00B2A9",
                                      marginTop: 2,
                                    }}
                                  >
                                    → {ri.recommendation}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══ RESOURCE ISSUES TAB (perf-only) ══ */}
        {activeTab === "resources" && perfOnly && (
          <div className="animate-fade-in">
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 18,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Filter by:
              </span>
              <select
                className="input-field"
                style={{ width: "auto", fontSize: 12 }}
                value={riSevFilter}
                onChange={(e) => setRiSevFilter(e.target.value)}
              >
                <option value="all">All Severities</option>
                {["critical", "high", "medium", "low"].map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <select
                className="input-field"
                style={{ width: "auto", fontSize: 13 }}
                value={riTypeFilter}
                onChange={(e) => setRiTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                {riTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "var(--offshade-text)",
                }}
              >
                Showing <strong>{filteredRI.length}</strong> of{" "}
                {allResourceIssues.length} issues
              </span>
            </div>
            {filteredRI.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 56,
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div>No resource issues match the current filters.</div>
              </div>
            ) : (
              filteredRI.map((ri, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 8,
                    border: `1px solid var(--border)`,
                    borderLeft: `3px solid ${SEV_COLOR[ri.severity] || "#8BA3C7"}`,
                    borderRadius: "var(--radius-md)",
                    padding: "12px 16px",
                    background: "var(--bg-card)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <ResourceIssueBadge severity={ri.severity} />
                        <span style={{ fontWeight: 700, fontSize: 13 }}>
                          {ri.type.replace(/-/g, " ")}
                        </span>
                        <span
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          ·
                        </span>
                        <span
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          {ri.pageTitle.substring(0, 40)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginBottom: 4,
                        }}
                      >
                        {ri.description}
                      </div>
                      <div style={{ fontSize: 12, color: "#00B2A9" }}>
                        → {ri.recommendation}
                      </div>
                      {ri.url && ri.url !== ri.pageUrl && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            marginTop: 3,
                            fontFamily: "monospace",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ri.url.substring(0, 80)}
                        </div>
                      )}
                    </div>
                    {ri.metrics && Object.keys(ri.metrics).length > 0 && (
                      <div style={{ flexShrink: 0 }}>
                        {Object.entries(ri.metrics)
                          .slice(0, 3)
                          .map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                fontSize: 10,
                                color: "var(--text-muted)",
                                textAlign: "right",
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{k}:</span>{" "}
                              {String(v)}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══ ACTION PLAN TAB (perf-only) ══ */}
        {activeTab === "action-plan" && perfOnly && (
          <div className="animate-fade-in">
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Prioritised performance recommendations. P0 and P1 items should be
              addressed in the next two sprints to achieve measurable Core Web
              Vitals improvement.
            </p>
            {[
              {
                label: "P0 — Fix Before Next Release",
                items: p0Recs,
                color: "#E8002D",
                bg: "rgba(232,0,45,0.05)",
                border: "rgba(232,0,45,0.2)",
                icon: "🚨",
                desc: "These issues cause significant user experience degradation and must be fixed immediately.",
              },
              {
                label: "P1 — Next Sprint",
                items: p1Recs,
                color: "#FF6B00",
                bg: "rgba(255,107,0,0.05)",
                border: "rgba(255,107,0,0.2)",
                icon: "🔴",
                desc: "High-impact improvements that should be scheduled in the next sprint.",
              },
              {
                label: "P2 — This Quarter",
                items: p2Recs,
                color: "#F0AB00",
                bg: "rgba(240,171,0,0.05)",
                border: "rgba(240,171,0,0.2)",
                icon: "🟡",
                desc: "Medium-priority improvements for sustained performance gains.",
              },
              {
                label: "P3/P4 — Backlog",
                items: p3Recs,
                color: "#0091DA",
                bg: "rgba(0,145,218,0.05)",
                border: "rgba(0,145,218,0.2)",
                icon: "🔵",
                desc: "Lower-priority improvements that provide incremental gains over time.",
              },
            ].map(({ label, items, color, bg, border, icon, desc }) => (
              <div
                key={label}
                style={{
                  marginBottom: 20,
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: "var(--radius-md)",
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {desc}
                    </div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 22,
                      fontWeight: 300,
                      color,
                    }}
                  >
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    No items in this priority tier.
                  </div>
                ) : (
                  items.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: "10px 0",
                        borderBottom:
                          i < items.length - 1 ? `1px solid ${border}` : "none",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 4,
                          background: color,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {r.priority}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            marginBottom: 3,
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {r.detail}
                        </div>
                        {r.clientReported && (
                          <span
                            style={{alignItems: "center", 
                              display: "inline-block",
                              marginTop: 4,
                              padding: "1px 7px",
                              borderRadius: 99,
                              fontSize: 10,
                              fontWeight: 700,
                              background: "rgba(167,139,250,0.15)",
                              color: "#A78BFA",
                            }}
                          >
                            🎯 Client-Reported
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{display: "inline-flex", alignItems: "center", 
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 700,
                            background: `${color}15`,
                            color,
                          }}
                        >
                          {r.impact} Impact
                        </span>
                        <span
                          style={{display: "inline-flex", alignItems: "center", 
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 10,
                            color: "var(--text-muted)",
                            background: "rgba(139,163,199,0.1)",
                            textAlign: "center",
                          }}
                        >
                          {r.effort}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}

            {/* Sprint planning guide */}
            <Card>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                📌 Sprint Planning Guide
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 12,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  <strong style={{ color: "#E8002D" }}>
                    Before Next Release →
                  </strong>{" "}
                  All P0 items. These directly degrade user experience and
                  conversion.
                </div>
                <div>
                  <strong style={{ color: "#FF6B00" }}>Sprint 1 →</strong> P1
                  items. High-impact, often quick to implement with significant
                  CWV improvement.
                </div>
                <div>
                  <strong style={{ color: "#F0AB00" }}>Sprint 2–3 →</strong> P2
                  items. Structural improvements that compound over time.
                </div>
                <div>
                  <strong style={{ color: "#0091DA" }}>Backlog →</strong> P3/P4
                  items. Ongoing optimisation — include in refactoring tasks.
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ══ NETWORK & AUTH TAB (perf-only) ══ */}
        {activeTab === "network" && perfOnly && (
          <div className="animate-fade-in">
            {/* Network Simulation */}
            {(perfResult?.networkSimulation || []).length > 0 ? (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                  🌐 Network Condition Simulation
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginBottom: 20,
                  }}
                >
                  Performance under different network conditions. Users on
                  slower connections experience significantly degraded
                  performance.
                </p>
                <div style={{ overflowX: "auto", marginBottom: 28 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#00338D", color: "white" }}>
                        {[
                          "Condition",
                          "Score",
                          "LCP",
                          "FCP",
                          "TTFB",
                          "Load Time",
                          "Risk",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "10px 14px",
                              textAlign: "left",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(perfResult?.networkSimulation || []).map((sim, i) => {
                        const sc = sim.score ?? 0;
                        const scColor =
                          sc >= 75
                            ? "#00BA8C"
                            : sc >= 50
                              ? "#F0AB00"
                              : "#E8002D";
                        const risk =
                          sc >= 75
                            ? { label: "Low", color: "#00BA8C" }
                            : sc >= 50
                              ? { label: "Medium", color: "#F0AB00" }
                              : { label: "High", color: "#E8002D" };
                        return (
                          <tr
                            key={sim.preset}
                            style={{
                              background:
                                i % 2 === 0
                                  ? "rgba(245,247,250,0.04)"
                                  : "transparent",
                            }}
                          >
                            <td
                              style={{ padding: "10px 14px", fontWeight: 700 }}
                            >
                              {sim.label || sim.preset}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontWeight: 700,
                                color: scColor,
                              }}
                            >
                              {sc}/100
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                color: cwvStatus("lcp", sim.lcp).color,
                              }}
                            >
                              {fmtCwv("lcp", sim.lcp)}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                color: cwvStatus("fcp", sim.fcp).color,
                              }}
                            >
                              {fmtCwv("fcp", sim.fcp)}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                color: cwvStatus("ttfb", sim.ttfb).color,
                              }}
                            >
                              {fmtCwv("ttfb", sim.ttfb)}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {sim.loadTimeMs != null
                                ? Math.round(sim.loadTimeMs).toLocaleString() +
                                  " ms"
                                : "—"}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span
                                style={{display: "inline-flex", alignItems: "center", 
                                  padding: "2px 8px",
                                  borderRadius: 99,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: `${risk.color}15`,
                                  color: risk.color,
                                }}
                              >
                                {risk.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "20px",
                  background: "rgba(0,145,218,0.05)",
                  border: "1px solid rgba(0,145,218,0.2)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: 24,
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                ℹ️ Network simulation was not run for this audit.
              </div>
            )}

            {/* Auth Flow */}
            {perfResult?.authFlow &&
            perfResult.authFlow.status !== "skipped" ? (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                  🔐 Authentication Flow Timing
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginBottom: 16,
                  }}
                >
                  Measured round-trip time for login, OTP, and post-login
                  redirect. Target: total round-trip under 3 seconds.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      label: "Status",
                      val: perfResult.authFlow.status?.toUpperCase(),
                      color:
                        perfResult.authFlow.status === "pass"
                          ? "#00BA8C"
                          : perfResult.authFlow.status === "critical"
                            ? "#E8002D"
                            : "#F0AB00",
                    },
                    {
                      label: "Total Round Trip",
                      val:
                        perfResult.authFlow.totalRoundTripMs != null
                          ? Math.round(perfResult.authFlow.totalRoundTripMs) +
                            " ms"
                          : "—",
                      color:
                        (perfResult.authFlow.totalRoundTripMs ?? 0) <= 3000
                          ? "#00BA8C"
                          : "#E8002D",
                    },
                    {
                      label: "Time to Form",
                      val:
                        perfResult.authFlow.timeToFormMs != null
                          ? Math.round(perfResult.authFlow.timeToFormMs) + " ms"
                          : "—",
                      color: "var(--text-primary)",
                    },
                    {
                      label: "Submit to Response",
                      val:
                        perfResult.authFlow.submitToResponseMs != null
                          ? Math.round(perfResult.authFlow.submitToResponseMs) +
                            " ms"
                          : "—",
                      color: "var(--text-primary)",
                    },
                    {
                      label: "Response to Interactive",
                      val:
                        perfResult.authFlow.responseToInteractiveMs != null
                          ? Math.round(
                              perfResult.authFlow.responseToInteractiveMs,
                            ) + " ms"
                          : "—",
                      color: "var(--text-primary)",
                    },
                    ...(perfResult.authFlow.otpPageLoadMs != null
                      ? [
                          {
                            label: "OTP Page Load",
                            val:
                              Math.round(perfResult.authFlow.otpPageLoadMs) +
                              " ms",
                            color:
                              perfResult.authFlow.otpPageLoadMs <= 2000
                                ? "#00BA8C"
                                : "#F0AB00",
                          },
                        ]
                      : []),
                  ].map(({ label, val, color }) => (
                    <div
                      key={label}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          marginBottom: 6,
                        }}
                      >
                        {label}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 300, color }}>
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
                {(perfResult.authFlow.issues || []).length > 0 && (
                  <Card>
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginBottom: 12,
                        color: "#FF3356",
                      }}
                    >
                      ⚠️ Auth Flow Issues
                    </h3>
                    {(perfResult.authFlow.issues || []).map((issue, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          padding: "8px 0",
                          borderBottom:
                            i < perfResult.authFlow!.issues.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                        }}
                      >
                        <ResourceIssueBadge severity={issue.severity} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {issue.type.replace(/-/g, " ")}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {issue.description}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#00B2A9",
                              marginTop: 2,
                            }}
                          >
                            → {issue.recommendation}
                          </div>
                        </div>
                      </div>
                    ))}
                  </Card>
                )}
              </>
            ) : !perfResult?.authFlow ? (
              <div
                style={{
                  padding: "20px",
                  background: "rgba(0,145,218,0.05)",
                  border: "1px solid rgba(0,145,218,0.2)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                ℹ️ Authentication flow testing was not configured for this
                audit. To enable, provide login credentials in the audit
                configuration.
              </div>
            ) : null}
          </div>
        )}

        {/* ══ UX PERFORMANCE TAB ══ */}
        {activeTab === "ux-performance" && perfOnly && (
          <div className="animate-fade-in">
            {uxPerf ? (
              <>
                {/* UX Score Hero */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
                  {[
                    { label: "UX Score", val: uxPerf.score, icon: "🎯" },
                    { label: "Loading Experience", val: uxPerf.initialLoadExperience.score, icon: "⏳" },
                    { label: "Visual Stability", val: uxPerf.visualStability.score, icon: "🔒" },
                    { label: "Responsiveness", val: uxPerf.responsiveness.score, icon: "⚡" },
                    { label: "Animation Smoothness", val: uxPerf.animationPerformance.score, icon: "🎬" },
                  ].map(({ label, val, icon }) => (
                    <div key={label} style={{ background: "var(--bg-darkcard)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "16px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: val >= 75 ? "#00BA8C" : val >= 50 ? "#F0AB00" : "#E8002D", lineHeight: 1 }}>{val}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Radar Chart */}
                {uxRadarData.length > 0 && (
                  <Card style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 UX Performance Dimensions</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={uxRadarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.1)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                        <Radar name="Score" dataKey="value" stroke="#0091DA" fill="#0091DA" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Responsiveness Chart */}
                {uxResponsivenessData.length > 0 && (
                  <Card style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>⚡ Responsiveness: Measured vs Target (ms)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={uxResponsivenessData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "var(--bg-darkcard)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12 }} />
                        <Legend />
                        <Bar dataKey="ms" name="Measured (ms)" fill="#0091DA" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="target" name="Target (ms)" fill="rgba(0,186,140,0.4)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Loading Experience Details */}
                <Card style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⏳ Initial Load Experience</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {[
                      { label: "Loading Indicator", ok: uxPerf.initialLoadExperience.hasLoadingIndicator, pass: "Detected", fail: "Not found — users see blank content during load" },
                      { label: "Skeleton Screens", ok: uxPerf.initialLoadExperience.hasSkeletonScreens, pass: "Detected", fail: "Not found — add skeleton placeholders for perceived speed" },
                      { label: "Progressive Loading", ok: uxPerf.initialLoadExperience.hasProgressiveLoading, pass: "Content loads progressively", fail: "Single paint event — consider chunked loading" },
                    ].map(({ label, ok, pass, fail }) => (
                      <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: ok ? "rgba(0,186,140,0.06)" : "rgba(232,0,45,0.06)", borderRadius: 8, border: `1px solid ${ok ? "rgba(0,186,140,0.2)" : "rgba(232,0,45,0.2)"}` }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{ok ? "✅" : "❌"}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{ok ? pass : fail}</div>
                        </div>
                      </div>
                    ))}
                    {uxPerf.initialLoadExperience.timeToInteractiveMs !== null && (
                      <div style={{ padding: "10px 12px", background: "var(--bg-darkcard)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Time to Interactive</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: uxPerf.initialLoadExperience.timeToInteractiveMs <= 3800 ? "#00BA8C" : "#F0AB00" }}>{Math.round(uxPerf.initialLoadExperience.timeToInteractiveMs)}ms</div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Pain Points */}
                {uxPerf.painPoints.length > 0 && (
                  <Card style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🚨 UX Pain Points</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {uxPerf.painPoints.map((pp, i) => (
                        <div key={i} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-darkcard)", border: `1px solid ${pp.severity === "critical" ? "#E8002D40" : pp.severity === "high" ? "#FF6B0040" : "var(--border-subtle)"}`, display: "flex", gap: 12 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "white", background: pp.severity === "critical" ? "#E8002D" : pp.severity === "high" ? "#FF6B00" : "#F0AB00", padding: "2px 8px", borderRadius: 4, height: "fit-content", flexShrink: 0, marginTop: 2 }}>{pp.severity.toUpperCase()}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{pp.description}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>👤 {pp.userImpact}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Improvement Opportunities */}
                {uxPerf.improvementOpportunities.length > 0 && (
                  <Card>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>💡 Improvement Opportunities</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {uxPerf.improvementOpportunities.map((opp, i) => (
                        <div key={i} style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(0,145,218,0.06)", border: "1px solid rgba(0,145,218,0.2)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>🚀</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{opp.area}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{opp.recommendation}</div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "#00BA8C", background: "rgba(0,186,140,0.1)", padding: "2px 8px", borderRadius: 4 }}>↑ {opp.expectedUplift}</span>
                              <span style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>🕐 {opp.effort}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-darkcard)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>UX Performance data not available</div>
                <div style={{ fontSize: 13 }}>UX Performance analysis (Layer M) requires a complete audit. Re-run the audit to capture UX metrics.</div>
              </div>
            )}
          </div>
        )}

        {/* ══ THIRD-PARTY IMPACT TAB ══ */}
        {activeTab === "third-party" && perfOnly && (
          <div className="animate-fade-in">
            {thirdParty.length > 0 ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                  <Tile val={thirdParty.length} label="Third-Party Resources" color="#0091DA" />
                  <Tile val={thirdParty.filter(t => t.blocking).length} label="Blocking Scripts" color={thirdParty.filter(t => t.blocking).length > 0 ? "#E8002D" : "#00BA8C"} />
                  <Tile val={thirdParty.filter(t => (t.loadTimeMs ?? 0) > 500).length} label="Slow Scripts (>500ms)" color={thirdParty.filter(t => (t.loadTimeMs ?? 0) > 500).length > 0 ? "#F0AB00" : "#00BA8C"} />
                </div>

                {/* Bar chart of third-party load times */}
                {thirdParty.slice(0, 8).length > 0 && (
                  <Card style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 Third-Party Load Times (ms)</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={thirdParty.slice(0, 8).map(t => ({ name: t.label, ms: t.loadTimeMs ?? 0, blocking: t.blocking }))} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                        <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={80} />
                        <Tooltip contentStyle={{ background: "var(--bg-darkcard)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="ms" name="Load time (ms)" radius={[0, 4, 4, 0]}>
                          {thirdParty.slice(0, 8).map((t, i) => (
                            <Cell key={i} fill={t.blocking ? "#E8002D" : (t.loadTimeMs ?? 0) > 500 ? "#F0AB00" : "#00BA8C"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                <Card>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🌐 Third-Party Script Inventory</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          {["Script / Service", "Category", "Load Time", "Size", "Blocking", "Recommendation"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {thirdParty.map((t, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "10px 10px", fontWeight: 600, color: "var(--text-primary)" }}>{t.label}</td>
                            <td style={{ padding: "10px 10px" }}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(0,145,218,0.12)", color: "#0091DA" }}>{t.category}</span></td>
                            <td style={{ padding: "10px 10px", color: (t.loadTimeMs ?? 0) > 500 ? "#F0AB00" : "var(--text-secondary)" }}>{t.loadTimeMs !== null ? `${t.loadTimeMs}ms` : "—"}</td>
                            <td style={{ padding: "10px 10px", color: "var(--text-muted)" }}>{t.transferSize > 0 ? `${Math.round(t.transferSize / 1024)}KB` : "—"}</td>
                            <td style={{ padding: "10px 10px" }}>{t.blocking ? <span style={{ color: "#E8002D", fontWeight: 700 }}>⚠ Blocking</span> : <span style={{ color: "#00BA8C" }}>✓ Non-blocking</span>}</td>
                            <td style={{ padding: "10px 10px" }}>
                              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: t.recommendation === "remove" ? "rgba(232,0,45,0.15)" : t.recommendation === "defer" ? "rgba(240,171,0,0.15)" : "rgba(0,186,140,0.15)", color: t.recommendation === "remove" ? "#E8002D" : t.recommendation === "defer" ? "#F0AB00" : "#00BA8C" }}>{t.recommendation.toUpperCase()}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-darkcard)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>No significant third-party scripts detected</div>
              </div>
            )}
          </div>
        )}

        {/* ══ ARCHITECTURE TAB ══ */}
        {activeTab === "architecture" && perfOnly && (
          <div className="animate-fade-in">
            {architecture ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
                  {[
                    { icon: "⚛️", label: "JavaScript Framework", value: architecture.framework ?? "Not detected", highlight: !!architecture.framework },
                    { icon: "📝", label: "CMS Platform", value: architecture.cms ?? "Not detected", highlight: !!architecture.cms },
                    { icon: "🌐", label: "CDN Provider", value: architecture.cdn ?? "No CDN detected ⚠️", highlight: !!architecture.cdn, warnIfFalsy: true },
                    { icon: "🔗", label: "HTTP Protocol", value: architecture.httpVersion ?? "Unknown", highlight: architecture.httpVersion !== "HTTP/1.1", warnIfFalsy: true },
                    { icon: "☁️", label: "Hosting Platform", value: architecture.hostingPlatform ?? "Unknown", highlight: !!architecture.hostingPlatform },
                    { icon: "⚙️", label: "Service Worker", value: architecture.hasServiceWorker ? "Active ✓" : "Not found", highlight: architecture.hasServiceWorker },
                    { icon: "📱", label: "PWA Manifest", value: architecture.hasPwaManifest ? "Present ✓" : "Not found", highlight: architecture.hasPwaManifest },
                    { icon: "⚡", label: "Resource Hints", value: architecture.hasResourceHints ? "Preload/Prefetch present ✓" : "Not found", highlight: architecture.hasResourceHints },
                  ].map(({ icon, label, value, highlight, warnIfFalsy }) => (
                    <div key={label} style={{ padding: "16px", background: "var(--bg-darkcard)", borderRadius: "var(--radius-md)", border: `1px solid ${highlight ? "rgba(0,145,218,0.25)" : warnIfFalsy && !highlight ? "rgba(240,171,0,0.3)" : "var(--border-subtle)"}` }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{icon} {label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: highlight ? "#0091DA" : warnIfFalsy ? "#F0AB00" : "var(--text-primary)" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {architecture.jsLibraries.length > 0 && (
                  <Card style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📦 Detected JavaScript Libraries</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {architecture.jsLibraries.map((lib, i) => (
                        <span key={i} style={{ fontSize: 12, padding: "4px 12px", background: "rgba(0,145,218,0.1)", border: "1px solid rgba(0,145,218,0.2)", borderRadius: 20, color: "#0091DA" }}>{lib}</span>
                      ))}
                    </div>
                  </Card>
                )}

                {architecture.cssFrameworks.length > 0 && (
                  <Card>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🎨 Detected CSS Frameworks</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {architecture.cssFrameworks.map((fw, i) => (
                        <span key={i} style={{ fontSize: 12, padding: "4px 12px", background: "rgba(205,171,254,0.1)", border: "1px solid rgba(205,171,254,0.2)", borderRadius: 20, color: "#CDABFE" }}>{fw}</span>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-darkcard)", borderRadius: "var(--radius-md)" }}>Architecture detection data not available. Re-run the audit to capture architecture information.</div>
            )}
          </div>
        )}

        {/* ══ TECHNICAL SEO TAB ══ */}
        {activeTab === "seo" && perfOnly && (
          <div className="animate-fade-in">
            {seoReadiness ? (
              <>
                {/* SEO Checklist */}
                <Card style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>✅ SEO Readiness Checklist</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {[
                      { label: "Meta Title", ok: seoReadiness.hasMetaTitle, detail: seoReadiness.metaTitleLength ? `${seoReadiness.metaTitleLength} chars` : undefined },
                      { label: "Meta Description", ok: seoReadiness.hasMetaDescription, detail: seoReadiness.metaDescriptionLength ? `${seoReadiness.metaDescriptionLength} chars` : undefined },
                      { label: "Canonical URL", ok: seoReadiness.hasCanonical },
                      { label: "Structured Data (JSON-LD)", ok: seoReadiness.hasStructuredData },
                      { label: "Open Graph Tags", ok: seoReadiness.hasOpenGraph },
                      { label: "robots.txt", ok: seoReadiness.hasRobotsTxt === true, warn: seoReadiness.hasRobotsTxt === null },
                      { label: "XML Sitemap", ok: seoReadiness.hasSitemap === true, warn: seoReadiness.hasSitemap === null },
                      { label: "No Broken Links", ok: seoReadiness.brokenLinks.length === 0, detail: seoReadiness.brokenLinks.length > 0 ? `${seoReadiness.brokenLinks.length} broken` : undefined },
                    ].map(({ label, ok, detail, warn }) => (
                      <div key={label} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: ok ? "rgba(0,186,140,0.06)" : warn ? "rgba(240,171,0,0.06)" : "rgba(232,0,45,0.06)", borderRadius: 8, border: `1px solid ${ok ? "rgba(0,186,140,0.2)" : warn ? "rgba(240,171,0,0.2)" : "rgba(232,0,45,0.2)"}` }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{ok ? "✅" : warn ? "⚠️" : "❌"}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                          {detail && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{detail}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* SEO Issues */}
                {seoReadiness.issues.length > 0 && (
                  <Card style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🔍 SEO Issues Found</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {seoReadiness.issues.map((issue, i) => (
                        <div key={i} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-darkcard)", border: `1px solid ${issue.severity === "critical" ? "#E8002D40" : issue.severity === "high" ? "#FF6B0040" : "var(--border-subtle)"}` }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "white", background: issue.severity === "critical" ? "#E8002D" : issue.severity === "high" ? "#FF6B00" : "#F0AB00", padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>{issue.severity.toUpperCase()}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{issue.detail}</div>
                              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>→ {issue.recommendation}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Broken Links */}
                {seoReadiness.brokenLinks.length > 0 && (
                  <Card>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#E8002D" }}>🔗 Broken Links (404)</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {seoReadiness.brokenLinks.map((link, i) => (
                        <div key={i} style={{ fontSize: 12, padding: "8px 12px", background: "rgba(232,0,45,0.06)", borderRadius: 6, fontFamily: "monospace", color: "var(--text-muted)", wordBreak: "break-all" }}>{link}</div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-darkcard)", borderRadius: "var(--radius-md)" }}>SEO readiness data not available. Re-run the audit to capture SEO signals.</div>
            )}
          </div>
        )}

        {/* ══ BEST PRACTICES TAB ══ */}
        {activeTab === "best-practices" && perfOnly && (
          <div className="animate-fade-in">
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>⚡ Front-End Performance Best Practices</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Resource Preloading (preload/prefetch/preconnect)", ok: architecture?.hasResourceHints ?? false, recommendation: "Add <link rel='preload'> for critical fonts and LCP images. Add <link rel='prefetch'> for next-page resources." },
                  { label: "Service Worker / Offline Support", ok: architecture?.hasServiceWorker ?? false, recommendation: "Implement a service worker for offline caching. Use Workbox for easy setup." },
                  { label: "PWA Web App Manifest", ok: architecture?.hasPwaManifest ?? false, recommendation: "Add a web app manifest (manifest.json) for installability and improved mobile UX." },
                  { label: "CDN for Static Assets", ok: !!architecture?.cdn, recommendation: "Deploy all static assets (JS, CSS, images) via a CDN. Reduces latency by 50-80% globally." },
                  { label: "HTTP/2 or HTTP/3 Protocol", ok: architecture?.httpVersion !== "HTTP/1.1" && !!architecture?.httpVersion, recommendation: "Upgrade to HTTP/2 for request multiplexing. HTTP/3 (QUIC) reduces connection overhead on mobile." },
                  { label: "Gzip / Brotli Compression", ok: !allResourceIssues.some(r => r.type === "missing-compression"), recommendation: "Enable brotli compression for 15-25% better compression than gzip." },
                  { label: "Browser Caching (Cache-Control)", ok: !allResourceIssues.some(r => r.type === "missing-cache-headers"), recommendation: "Set Cache-Control: max-age=31536000, immutable on versioned assets." },
                  { label: "Image Optimization (WebP/AVIF)", ok: !allResourceIssues.some(r => r.type === "unoptimized-image"), recommendation: "Serve images in WebP or AVIF format. Use srcset for responsive images." },
                  { label: "Code Splitting / Lazy Loading", ok: !allResourceIssues.some(r => r.type === "large-bundle"), recommendation: "Split JS bundles by route. Lazy-load non-critical components and third-party scripts." },
                  { label: "Async/Defer Script Loading", ok: !allResourceIssues.some(r => r.type === "sync-scripts"), recommendation: "Add async or defer attribute to all non-critical <script> tags in <head>." },
                ].map(({ label, ok, recommendation }) => (
                  <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", background: ok ? "rgba(0,186,140,0.05)" : "rgba(232,0,45,0.04)", borderRadius: 8, border: `1px solid ${ok ? "rgba(0,186,140,0.18)" : "rgba(232,0,45,0.18)"}` }}>
                    <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{ok ? "✅" : "❌"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: ok ? 0 : 4 }}>{label}</div>
                      {!ok && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>→ {recommendation}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ══ AI INSIGHTS TAB ══ */}
        {activeTab === "ai-insights" && perfOnly && (
          <div className="animate-fade-in">
            {!aiReport ? (
              <div style={{ textAlign: "center", padding: "48px 32px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>AI Performance Analysis</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
                  Generate deep AI insights powered by Claude: executive summaries, root cause analysis, business impact narrative, ROI estimates, and Jira/ADO tickets.
                </p>
                <button
                  onClick={triggerAIAnalysis}
                  disabled={aiGenerating}
                  className="btn btn-primary"
                  style={{ fontSize: 14, padding: "12px 28px", opacity: aiGenerating ? 0.7 : 1 }}
                >
                  {aiGenerating ? "⏳ Generating AI Report..." : "✨ Generate AI Report"}
                </button>
              </div>
            ) : (
              <>
                {/* Persona Selector */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                  {(["executive", "developer", "pm", "consultant"] as const).map(p => (
                    <button key={p} onClick={() => setAiPersona(p)} style={{ fontSize: 12, padding: "6px 16px", borderRadius: 20, border: `1px solid ${aiPersona === p ? "#0091DA" : "var(--border-subtle)"}`, background: aiPersona === p ? "rgba(0,145,218,0.15)" : "transparent", color: aiPersona === p ? "#0091DA" : "var(--text-muted)", cursor: "pointer", fontWeight: aiPersona === p ? 700 : 400 }}>
                      {p === "executive" ? "👔 Executive" : p === "developer" ? "💻 Developer" : p === "pm" ? "📋 Product Manager" : "🎯 Consultant"}
                    </button>
                  ))}
                </div>

                {/* Persona-specific content */}
                <Card style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{aiPersona === "executive" ? "👔 Executive Summary" : aiPersona === "developer" ? "💻 Technical Analysis" : aiPersona === "pm" ? "📋 Product Manager View" : "🎯 Consultant View"}</span>
                  </h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                    {aiPersona === "executive" ? aiReport.executiveSummary
                     : aiPersona === "developer" ? aiReport.developerSummary
                     : aiPersona === "pm" ? aiReport.uxNarrative
                     : `${aiReport.businessImpactNarrative}\n\nROI Estimate: ${aiReport.overallROI}`}
                  </p>
                  {aiPersona === "consultant" && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(0,186,140,0.08)", borderRadius: 8, border: "1px solid rgba(0,186,140,0.2)", fontSize: 13, color: "#00BA8C" }}>
                      💰 {aiReport.overallROI}
                    </div>
                  )}
                </Card>

                {/* AI Recommendations */}
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🎯 AI-Enriched Recommendations</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                  {aiReport.recommendations.map((rec, i) => (
                    <div key={i} style={{ background: "var(--bg-darkcard)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                      <button onClick={() => setExpandedRec(expandedRec === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: rec.priority === "P0" ? "#E8002D" : rec.priority === "P1" ? "#FF6B00" : rec.priority === "P2" ? "#F0AB00" : "#0091DA", color: "white", flexShrink: 0 }}>{rec.priority}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--text-primary)" }}>{rec.title}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 8px", background: "rgba(255,255,255,0.06)", borderRadius: 4, flexShrink: 0 }}>{rec.estimatedEffort}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: 14, flexShrink: 0 }}>{expandedRec === i ? "▲" : "▼"}</span>
                      </button>
                      {expandedRec === i && (
                        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                            {[
                              { label: "📋 Description", value: rec.description },
                              { label: "🔍 Root Cause", value: rec.rootCause },
                              { label: "❓ Why It Matters", value: rec.whyItMatters },
                              { label: "💼 Business Impact", value: rec.businessImpact },
                              { label: "🔧 Recommendation", value: rec.recommendation },
                              { label: "📈 Expected Improvement", value: rec.expectedImprovement },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          {rec.sampleCode && (
                            <div style={{ marginTop: 12, padding: "10px 12px", background: "#0d1117", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>💡 Sample Implementation</div>
                              <pre style={{ fontSize: 12, color: "#a8ff78", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{rec.sampleCode}</pre>
                            </div>
                          )}
                          {rec.estimatedROI && (
                            <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(0,186,140,0.08)", borderRadius: 8, fontSize: 12, color: "#00BA8C" }}>💰 ROI: {rec.estimatedROI}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Dev Tickets */}
                {aiReport.devTickets.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🎫 Jira / Azure DevOps Tickets</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {aiReport.devTickets.map((ticket, i) => (
                        <div key={i} style={{ background: "var(--bg-darkcard)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                          <button onClick={() => setExpandedTicket(expandedTicket === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: ticket.priority === "Critical" ? "#E8002D" : ticket.priority === "High" ? "#FF6B00" : ticket.priority === "Medium" ? "#F0AB00" : "#0091DA", color: "white", flexShrink: 0 }}>{ticket.priority}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--text-primary)" }}>{ticket.title}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 7px", background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>{ticket.storyPoints} pts</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{expandedTicket === i ? "▲" : "▼"}</span>
                          </button>
                          {expandedTicket === i && (
                            <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--border-subtle)" }}>
                              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 10, marginBottom: 12 }}>{ticket.description}</p>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Acceptance Criteria:</div>
                              <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                                {ticket.acceptanceCriteria.map((ac, j) => (
                                  <li key={j} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, lineHeight: 1.5 }}>{ac}</li>
                                ))}
                              </ul>
                              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                                {ticket.labels.map((label, j) => (
                                  <span key={j} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(0,145,218,0.12)", color: "#0091DA", border: "1px solid rgba(0,145,218,0.2)" }}>{label}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ marginTop: 20, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                  Generated by Claude AI · {new Date(aiReport.generatedAt).toLocaleString("en-GB")}
                  <button onClick={triggerAIAnalysis} disabled={aiGenerating} style={{ marginLeft: 12, fontSize: 11, padding: "3px 10px", borderRadius: 4, background: "rgba(255,255,255,0.08)", border: "1px solid var(--border-subtle)", cursor: "pointer", color: "var(--text-muted)" }}>
                    {aiGenerating ? "Regenerating..." : "Regenerate"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ ROADMAP TAB ══ */}
        {activeTab === "roadmap" && perfOnly && (
          <div className="animate-fade-in">
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Prioritized implementation roadmap. Address Critical items immediately, High items in the next sprint, Medium in the next quarter, and Low as time permits.
            </p>

            {/* Priority swimlanes */}
            {(["P0", "P1", "P2", "P3/P4"] as const).map((pLabel) => {
              const labelMap: Record<string, { label: string; color: string; bg: string }> = {
                "P0": { label: "🚨 Critical", color: "#E8002D", bg: "rgba(232,0,45,0.06)" },
                "P1": { label: "🔴 High", color: "#FF6B00", bg: "rgba(255,107,0,0.06)" },
                "P2": { label: "🟡 Medium", color: "#F0AB00", bg: "rgba(240,171,0,0.06)" },
                "P3/P4": { label: "🔵 Low", color: "#0091DA", bg: "rgba(0,145,218,0.06)" },
              };
              const style = labelMap[pLabel];
              const items = (aiReport?.recommendations || recs).filter(r => {
                if (pLabel === "P3/P4") return r.priority === "P3" || r.priority === "P4";
                return r.priority === pLabel;
              });
              if (items.length === 0) return null;
              return (
                <div key={pLabel} style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: style.color }}>{style.label}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {items.map((item, i) => {
                      const effort = "estimatedEffort" in item ? item.estimatedEffort : item.effort;
                      const desc = "description" in item ? item.description : item.detail;
                      const improvement = "expectedImprovement" in item ? item.expectedImprovement : undefined;
                      return (
                        <div key={i} style={{ padding: "14px 16px", borderRadius: "var(--radius-md)", background: style.bg, border: `1px solid ${style.color}30` }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)", lineHeight: 1.4 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>{desc}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "var(--text-muted)" }}>🕐 {effort}</span>
                            {improvement && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(0,186,140,0.1)", color: "#00BA8C" }}>↑ {improvement}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Effort vs Impact chart */}
            {recs.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 Issue Type Distribution</h3>
                {riPieData.length > 0 && (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={riPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                        {riPieData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--bg-darkcard)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ══ DARK PATTERNS TAB ══ */}
        {activeTab === "dark-patterns" && isDP && (
          <div className="animate-fade-in">
            {dpFindings.length > 0 ? (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 18,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    Showing <strong>{dpGroupedFindings.length}</strong>{" "}
                    finding{dpGroupedFindings.length !== 1 ? "s" : ""} (
                    {dpFindings.length} instance
                    {dpFindings.length !== 1 ? "s" : ""})
                  </span>
                </div>
                {dpGroupedFindings.map((group) => (
                  <DPFindingGroupCard key={group.key} group={group} />
                ))}
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: 56,
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div>No dark pattern findings detected.</div>
              </div>
            )}
          </div>
        )}

        {/* ══ PERFORMANCE TAB (multi-pillar) ══ */}
        {activeTab === "performance" && !perfOnly && perfResult && (
          <div className="animate-fade-in">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <Tile
                val={perfResult.overallScore}
                label="Performance Score"
                color={
                  perfResult.overallScore >= 75
                    ? "#00BA8C"
                    : perfResult.overallScore >= 50
                      ? "#F0AB00"
                      : "#E8002D"
                }
                sub="/100"
              />
              <Tile
                val={perfResult.totalResourceIssues}
                label="Resource Issues"
                color="#FF6B00"
              />
              <Tile
                val={p0Recs.length + p1Recs.length}
                label="P0+P1 Actions"
                color="#E8002D"
              />
              <Tile
                val={perfPages.length}
                label="Pages Analysed"
                color="#0091DA"
                sub={
                  perfResult?.targetedPagesAudited
                    ? `${perfResult.basePagesAudited ?? 0} crawled + ${perfResult.targetedPagesAudited} targeted`
                    : undefined
                }
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {CWV_META.map((m) => (
                <CwvGauge
                  key={m.key}
                  metaKey={m.key}
                  value={(avgVitals as any)[m.key] ?? null}
                />
              ))}
            </div>
            <Card style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                📄 Page Performance Scorecard
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#006E51", color: "white" }}>
                      {[
                        "Page",
                        "Score",
                        "LCP",
                        "CLS",
                        "FCP",
                        "TTFB",
                        "Resource Issues",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "9px 12px",
                            textAlign: "left",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perfPages.map((pg, i) => {
                      const sc = pg.score;
                      const scColor =
                        sc >= 75 ? "#00BA8C" : sc >= 50 ? "#F0AB00" : "#E8002D";
                      return (
                        <tr
                          key={pg.url}
                          style={{
                            background:
                              i % 2 === 0
                                ? "rgba(245,247,250,0.04)"
                                : "transparent",
                          }}
                        >
                          <td
                            style={{
                              padding: "9px 12px",
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {pg.title || pg.url}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              fontWeight: 700,
                              color: scColor,
                            }}
                          >
                            {sc}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              color: cwvStatus("lcp", pg.vitals.lcp).color,
                            }}
                          >
                            {fmtCwv("lcp", pg.vitals.lcp)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              color: cwvStatus("cls", pg.vitals.cls).color,
                            }}
                          >
                            {fmtCwv("cls", pg.vitals.cls)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              color: cwvStatus("fcp", pg.vitals.fcp).color,
                            }}
                          >
                            {fmtCwv("fcp", pg.vitals.fcp)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              color: cwvStatus("ttfb", pg.vitals.ttfb).color,
                            }}
                          >
                            {fmtCwv("ttfb", pg.vitals.ttfb)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              color:
                                (pg.resourceIssues?.length || 0) > 0
                                  ? "#F0AB00"
                                  : "#00BA8C",
                            }}
                          >
                            {pg.resourceIssues?.length || 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            {recs.length > 0 && (
              <Card>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                  🎯 Top Recommendations
                </h3>
                {recs.slice(0, 10).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "9px 0",
                      borderBottom:
                        i < Math.min(9, recs.length - 1)
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background:
                          r.priority === "P0"
                            ? "rgba(232,0,45,0.1)"
                            : r.priority === "P1"
                              ? "rgba(255,107,0,0.1)"
                              : "rgba(240,171,0,0.1)",
                        color:
                          r.priority === "P0"
                            ? "#E8002D"
                            : r.priority === "P1"
                              ? "#FF6B00"
                              : "#F0AB00",
                        flexShrink: 0,
                        alignSelf: "flex-start",
                      }}
                    >
                      {r.priority}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {r.detail}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        flexShrink: 0,
                        textAlign: "right",
                      }}
                    >
                      <div>{r.effort}</div>
                      <div
                        style={{
                          color:
                            r.impact === "Critical" || r.impact === "High"
                              ? "#FF6B00"
                              : "inherit",
                        }}
                      >
                        {r.impact}
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* ══ ACCESSIBILITY TABS (unchanged) ══ */}

        {activeTab === "backlog" && isA11y && (
          <div className="animate-fade-in">
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 18,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Filter by:
              </span>
              {[
                {
                  label: "Team",
                  val: teamFilter,
                  set: setTeamFilter,
                  opts: [
                    "all",
                    "Frontend Dev",
                    "Designer",
                    "Content",
                    "QA",
                    "PDF Team",
                    "Design System",
                  ],
                },
                {
                  label: "Severity",
                  val: sevFilter,
                  set: setSevFilter,
                  opts: ["all", "critical", "high", "medium", "low"],
                },
                {
                  label: "Effort",
                  val: effortFilter,
                  set: setEffortFilter,
                  opts: ["all", "Quick Win", "1 hour", "Half-day", "1 Sprint"],
                },
                {
                  label: "Component",
                  val: compFilter,
                  set: setCompFilter,
                  opts: ["all", ...Object.keys(compGroups).sort()],
                },
              ].map((f) => (
                <select
                  key={f.label}
                  className="input-field"
                  style={{ width: "auto", fontSize: 12 }}
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                >
                  <option value="all">All {f.label}s</option>
                  {f.opts
                    .filter((o) => o !== "all")
                    .map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                </select>
              ))}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Showing <strong>{groupedBacklog.length}</strong> issue type
                {groupedBacklog.length !== 1 ? "s" : ""} ({filtered.length}{" "}
                instance{filtered.length !== 1 ? "s" : ""})
              </span>
              <button
                onClick={exportCSV}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11 }}
              >
                Export CSV
              </button>
            </div>
            {(showAllBacklog
              ? groupedBacklog
              : groupedBacklog.slice(0, 10)
            ).map((group, i) => (
              <GroupedIssueCard
                key={group.key}
                group={group}
                idx={i + 1}
                statusMap={statusMap}
                onStatusChange={handleStatusChange}
              />
            ))}
            {groupedBacklog.length > 10 && !showAllBacklog && (
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button
                  onClick={() => setShowAllBacklog(true)}
                  className="btn btn-primary"
                  style={{
                    fontSize: 14,
                    padding: "10px 24px",
                  }}
                >
                  Show All {groupedBacklog.length} Issue Types
                </button>
              </div>
            )}
            {filtered.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: 56,
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                <div>No issues match the current filters.</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "components" && isA11y && (
          <div className="animate-fade-in">
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginBottom: 18,
              }}
            >
              Issues grouped by UI component. Fixing at the design-system level
              resolves all instances simultaneously.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 14,
              }}
            >
              {Object.entries(compGroups)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([comp, compIssues]) => {
                  const critCount = compIssues.filter(
                    (i) => i.severity === "critical",
                  ).length;
                  const dsImpact = compIssues.length >= 3;
                  return (
                    <div
                      key={comp}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        // borderRadius: "var(--radius-md)",
                        padding: 18,
                        // borderTop:
                        //   critCount > 0
                        //     ? "3px solid #E8002D"
                        //     : "3px solid #F0AB00",
                        borderLeft: "1px solid var(--dynamic-border)",
                        borderRight: "1px solid var(--dynamic-border)",
                        borderBottom: "1px solid var(--dynamic-border)",
                        borderTop: "1px solid var(--dynamic-border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          marginBottom: 10,
                        }}
                      >
                        <span style={{ fontSize: 24 }}>
                          {COMP_ICON[comp] || ""}
                        </span>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 16 }}>
                            {comp}
                          </span>
                          {dsImpact && (
                            <div
                              style={{
                                fontSize: 14,
                                color: "var(--offshade-text)",
                                fontWeight: 500,
                              }}
                            >
                              Design System Impact
                            </div>
                          )}
                        </div>
                        <div style={{ marginLeft: "auto", textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 28,
                              fontWeight: 700,
                              color:
                                critCount > 0
                                  ? "var(--kpmg-dynamic)"
                                  : "var(--kpmg-dynamic)",
                            }}
                          >
                            {compIssues.length}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "var(--offshade-text)",
                              textTransform: "uppercase",
                              fontWeight: 600,
                            }}
                          >
                            Issues
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          marginBottom: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        {["critical", "high", "medium", "low"]
                          .filter((s) =>
                            compIssues.some((i) => i.severity === s),
                          )
                          .map((s) => (
                            <span
                              key={s}
                              style={{display: "inline-flex", alignItems: "center", 
                                padding: "2px 8px",
                                borderRadius: 99,
                                fontSize: 13,
                                fontWeight: 700,
                                background: SEV_BG[s],
                                color: SEV_COLOR[s],
                                border: `1px solid ${SEV_COLOR[s]}40`,
                              }}
                            >
                              {
                                compIssues.filter((i) => i.severity === s)
                                  .length
                              }{" "}
                              {s}
                            </span>
                          ))}
                      </div>
                      {/* <div
                        style={{ fontSize: 13, color: "var(--offshade-text)" }}
                      >
                        {compIssues.slice(0, 3).map((i) => (
                          <div
                            key={i.id}
                            style={{
                              padding: "4px 0",
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: SEV_COLOR[i.severity],
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {i.title}
                            </span>
                          </div>
                        ))}
                        {compIssues.length > 3 && (
                          <div style={{ paddingTop: 4, fontSize: 11 }}>
                            +{compIssues.length - 3} more…
                          </div>
                        )}
                      </div> */}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {activeTab === "remediation" && isA11y && (
          <div
            className="animate-fade-in"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                margin: 0,
              }}
            >
              Practical implementation guidance by team. Each team sees only
              their issues.
            </p>
            {Object.entries(teamGroups).map(([team, tIssues]) => {
              const critCount = tIssues.filter(
                (i) => i.severity === "critical",
              ).length;
              return (
                <details
                  key={team}
                  open={tIssues.some((i) => i.severity === "critical")}
                >
                  <summary
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      padding: "18px 18px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      // borderRadius: "var(--radius-md)",
                      fontWeight: 700,
                      fontSize: 14,
                      listStyle: "none",
                    }}
                  >
                    <span style={{ flex: 1 }}>{team}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {critCount > 0 && (
                        <span
                          style={{display: "inline-flex", alignItems: "center", 
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 700,
                            background: SEV_BG.critical,
                            color: SEV_COLOR.critical,
                          }}
                        >
                          {critCount} Critical
                        </span>
                      )}
                      <span
                        style={{display: "inline-flex", alignItems: "center", 
                          padding: "2px 8px",
                          borderRadius: 99,
                          fontSize: 10,
                          fontWeight: 700,
                          // background: "rgba(0,145,218,0.1)",
                          color: "var(--kpmg-dynamic)",
                        }}
                      >
                        {tIssues.length} Issues
                      </span>
                    </div>
                  </summary>
                  <div
                    style={{
                      padding: "32px",
                      border: "1px solid var(--border)",
                      borderTop: "none",
                      borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                      background: "var(--bg-darkcard)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        marginBottom: 14,
                        padding: "10px 14px",
                        background: `${TEAM_COLOR[team as TeamOwner] || "#0091DA"}0A`,
                        border: `1px solid ${TEAM_COLOR[team as TeamOwner] || "#0091DA"}25`,
                        borderRadius: 6,
                      }}
                    >
                      {TEAM_NOTES[team]}
                    </p>
                    {tIssues.slice(0, 5).map((issue) => (
                      <div
                        key={issue.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px 10px",
                          marginBottom: 4,
                          background: "var(--bg-card)",
                          // borderRadius: 6,
                          border: `1px solid ${SEV_COLOR[issue.severity]}30`,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: SEV_COLOR[issue.severity],
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1, fontSize: 14 }}>
                          {issue.title}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                          }}
                        >
                          WCAG {issue.wcagCriterion}
                        </span>
                        <span
                          style={{display: "inline-flex", alignItems: "center", 
                            padding: "2px 7px",
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 500,
                            background: `${EFFORT_COLOR[issue.effort]}15`,
                            color: EFFORT_COLOR[issue.effort],
                          }}
                        >
                          {issue.effort}
                        </span>
                      </div>
                    ))}
                    {tIssues.length > 5 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          paddingTop: 6,
                        }}
                      >
                        + {tIssues.length - 5} more — see Issue Backlog tab with{" "}
                        {team} filter
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {activeTab === "priority" && isA11y && (
          <div className="animate-fade-in">
            <p
              style={{
                fontSize: 15,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              Assign items to the right sprint. Quick wins can be done
              immediately.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              {[
                {
                  label: "Critical Blockers",
                  desc: "Fix this sprint — users blocked",
                  emoji: "🔴",
                  items: critical,
                  color: "#E8002D",
                  // bg: "rgba(232,0,45,0.05)",
                  border: "1px solid #7a7373",
                },
                {
                  label: "High Priority",
                  desc: "Next sprint — significant impact",
                  emoji: "🟠",
                  items: highPri,
                  color: "#FF6B00",
                  // bg: "rgba(255,107,0,0.05)",
                  border: "1px solid #7a7373",
                },
                {
                  label: "Medium Priority",
                  desc: "This quarter — notable impact",
                  emoji: "🟡",
                  items: medPri,
                  color: "#F0AB00",
                  // bg: "rgba(240,171,0,0.05)",
                },
                {
                  label: "Quick Wins",
                  desc: "Fix today — under 30 minutes each",
                  emoji: "🟢",
                  items: quickWins,
                  color: "#00BA8C",
                  // bg: "rgba(0,186,140,0.05)",
                },
              ].map(({ label, desc, emoji, items, color, border }) => (
                <div
                  key={label}
                  style={{
                    // background: bg,
                    border: `1px solid var(--dynamic-border)`,
                    // borderRadius: "var(--radius-md)",
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    {/* <span style={{ fontSize: 22 }}>{emoji}</span> */}
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 18,
                          color: "var(--offshade-text)",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{ fontSize: 13, color: "var(--text-primary)" }}
                      >
                        {desc}
                      </div>
                    </div>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 26,
                        fontWeight: 700,
                        color: "var(--kpmg-dynamic)",
                      }}
                    >
                      {items.length}
                    </span>
                  </div>
                  {items.slice(0, 8).map((i) => (
                    <div
                      key={i.id}
                      style={{
                        padding: "7px 0",
                        borderBottom: `1px solid #dedede`,
                        fontSize: 13,
                      }}
                    >
                      <span>{i.title}</span>
                      <span
                        style={{
                          float: "right",
                          fontSize: 13,
                          color: TEAM_COLOR[i.team],
                          fontWeight: 700,
                        }}
                      >
                        {i.team}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "acceptance" && isA11y && (
          <div className="animate-fade-in">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Auto-generated acceptance criteria. Use as QA test cases and
                regression checks.
              </p>
              <button
                onClick={exportCSV}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 14 }}
              >
                Export QA Cases
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(showAllAcceptance ? augmented : augmented.slice(0, 10)).map(
                (issue, i) => {
                  const acceptance = deriveAcceptanceCriteria(issue);
                  return (
                    <div
                      key={issue.id}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderLeft: `3px solid ${SEV_COLOR[issue.severity]}`,
                        // borderRadius: "var(--radius-md)",
                        padding: "32px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 9,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            // fontFamily: "monospace",
                            color: "var(--text-muted)",
                          }}
                        >
                          #{String(i + 1).padStart(3, "0")}
                        </span>
                        <span
                          style={{ fontWeight: 700, fontSize: 16, flex: 1 }}
                        >
                          {issue.title}
                        </span>
                        <span
                          style={{display: "inline-flex", alignItems: "center", 
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 13,
                            fontWeight: 500,
                            background: SEV_BG[issue.severity],
                            color: SEV_COLOR[issue.severity],
                            border: `1px solid ${SEV_COLOR[issue.severity]}40`,
                          }}
                        >
                          {issue.severity}
                        </span>
                        <span
                          style={{display: "inline-flex", alignItems: "center", 
                            padding: "2px 7px",
                            borderRadius: 99,
                            fontSize: 13,
                            background: "rgba(0,145,218,0.1)",
                            color: "#0091DA",
                            fontWeight: 500,
                          }}
                        >
                          WCAG {issue.wcagCriterion}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 6,
                        }}
                      >
                        Done When:
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {acceptance.map((criterion, ci) => (
                          <label
                            key={ci}
                            style={{
                              display: "flex",
                              gap: 7,
                              alignItems: "flex-start",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              style={{ marginTop: 2, accentColor: "#003087" }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--text-secondary)",
                                lineHeight: 1.5,
                              }}
                            >
                              {criterion}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
            {augmented.length > 10 && !showAllAcceptance && (
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button
                  onClick={() => setShowAllAcceptance(true)}
                  className="btn btn-primary"
                  style={{
                    fontSize: 14,
                    padding: "10px 24px",
                  }}
                >
                  Show All {augmented.length} Items
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
