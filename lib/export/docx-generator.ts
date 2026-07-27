import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  LevelFormat,
  INumberingOptions,
  ImageRun,
  TableLayoutType,
} from "docx";
import { AuditResult, AccessibilityIssue } from "../types/audit";
import type { DarkPatternFinding } from "../types/darkpattern";
import { getReportDisplayInfo, formatPageCount } from "./report-helpers";

// ── KPMG Brand Palette ────────────────────────────────────────
const K = {
  navy: "00338D", // KPMG Navy
  blue: "005EB8", // KPMG Blue
  lightBlue: "0091DA", // KPMG Light Blue
  teal: "00B2A9", // KPMG Teal
  white: "FFFFFF",
  offWhite: "F5F7FA",
  lightGrey: "EEF2F7",
  midGrey: "B0BDC8",
  darkGrey: "4A5568",
  nearBlack: "1A2638",
  critical: "E8002D",
  criticalBg: "FFF0F3",
  high: "FF6B00",
  highBg: "FFF3E8",
  medium: "F0AB00",
  mediumBg: "FFFBE8",
  low: "0091DA",
  lowBg: "E8F6FF",
  pass: "00B2A9",
  passBg: "E8FAF9",
};

// ── Team colour map ───────────────────────────────────────────
const TEAM_COLOR: Record<string, string> = {
  "Frontend Dev": K.lightBlue,
  Designer: "A78BFA",
  Content: K.teal,
  QA: "00BA8C",
  "PDF Team": K.medium,
  "Design System": K.high,
};

function sevColor(s: string) {
  return (
    { critical: K.critical, high: K.high, medium: K.medium, low: K.low }[s] ||
    K.darkGrey
  );
}
function sevBg(s: string) {
  return (
    {
      critical: K.criticalBg,
      high: K.highBg,
      medium: K.mediumBg,
      low: K.lowBg,
    }[s] || K.lightGrey
  );
}
function compLabel(l: string) {
  return (
    {
      "non-compliant": "Non-Compliant",
      "partially-compliant": "Partially Compliant",
      "aa-compliant": "WCAG AA Compliant",
      "aaa-compliant": "WCAG AAA Compliant",
    }[l] || l
  );
}

/** Heuristic: does this "element" value look like a real CSS selector, or a prose fallback label? */
function looksLikeSelectorDocx(s: string): boolean {
  if (!s) return false;
  if (s.includes("/")) return false; // e.g. "timeout/redirect"
  const withoutCombinators = s.replace(/\s*>\s*/g, ">");
  if (/\s/.test(withoutCombinators)) return false;
  return true;
}

/** Mirrors the DevTools command generator used on the live report page's IssueCard. */
function buildDevToolsCommand(iss: AccessibilityIssue): string | null {
  if (iss.xpath) return `$x('${iss.xpath.replace(/'/g, "\\'")}')[0]`;
  if (looksLikeSelectorDocx(iss.element)) {
    return `document.querySelector('${iss.element.replace(/'/g, "\\'")}')`;
  }
  return null;
}

/** Reads pixel dimensions from a PNG (IHDR chunk) or JPEG (SOFx marker) buffer, or null if unreadable. */
function getImageDimensions(
  buf: Buffer,
  format: "png" | "jpg",
): { width: number; height: number } | null {
  try {
    if (format === "png") {
      if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // JPEG: scan markers for the first SOFx (start-of-frame) segment
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 4 <= buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      if (marker >= 0xd0 && marker <= 0xd7) {
        offset += 2;
        continue;
      }
      const segLen = buf.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        if (offset + 9 > buf.length) return null;
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + segLen;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fits image dimensions into a maxW×maxH box while preserving aspect ratio.
 * Small source images may be scaled up (capped at 4x) so evidence stays legible;
 * without this, a fixed box (the previous behavior) stretched extreme aspect
 * ratios — e.g. a 1264×19 element screenshot into 500×120 — into an unrecognizable smear.
 */
function fitImageBox(
  dims: { width: number; height: number } | null,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (!dims || dims.width <= 0 || dims.height <= 0) {
    return { width: maxW, height: Math.round(maxW * 0.24) };
  }
  const scale = Math.min(maxW / dims.width, maxH / dims.height, 4);
  return {
    width: Math.max(20, Math.round(dims.width * scale)),
    height: Math.max(10, Math.round(dims.height * scale)),
  };
}

// Derive team from issue (mirrors report page logic)
function deriveTeam(issue: AccessibilityIssue): string {
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

function deriveEffort(issue: AccessibilityIssue): string {
  return (
    {
      critical: "1 Sprint",
      high: "Half-day",
      medium: "1 hour",
      low: "Quick Win",
    }[issue.severity] || "1 hour"
  );
}

function deriveAcceptance(issue: AccessibilityIssue): string[] {
  const c = issue.wcagCriterion;
  if (c === "2.1.1" || c === "2.1.2")
    return [
      "Keyboard navigation works fully without a mouse",
      "No keyboard trap detected",
    ];
  if (c === "2.4.7" || c === "1.4.11")
    return [
      "Focus indicator is clearly visible on all interactive elements",
      "Focus contrast ratio ≥ 3:1",
    ];
  if (c === "1.4.3")
    return [
      "Text contrast ratio ≥ 4.5:1 (normal) or 3:1 (large text)",
      "Verified with contrast analyser tool",
    ];
  if (c === "1.1.1")
    return [
      "All meaningful images have descriptive alt text",
      'Decorative images use alt="" or aria-hidden="true"',
    ];
  if (c === "4.1.2")
    return [
      "Screen reader announces name, role, and state correctly",
      "ARIA attributes are valid and reference existing IDs",
    ];
  return [
    "Issue is no longer reproducible",
    "Screen reader announces the element correctly",
    `WCAG ${c} criterion is met`,
  ];
}

// ── Cell helpers ──────────────────────────────────────────────
function cell(
  text: string,
  opts?: {
    bold?: boolean;
    color?: string;
    bg?: string;
    width?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    italic?: boolean;
  },
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts?.align || AlignmentType.LEFT,
        spacing: { before: 50, after: 50 },
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            color: opts?.color || K.nearBlack,
            size: opts?.size || 19,
            font: "Calibri",
            italics: opts?.italic,
          }),
        ],
      }),
    ],
    width: opts?.width
      ? { size: opts.width, type: WidthType.PERCENTAGE }
      : undefined,
    shading: opts?.bg
      ? { type: ShadingType.SOLID, color: opts.bg, fill: opts.bg }
      : undefined,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
  });
}

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "D1DCE8" };
const TABLE_BORDERS = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
  insideHorizontal: BORDER,
  insideVertical: BORDER,
};

function sp(before = 0, after = 160): Paragraph {
  return new Paragraph({ spacing: { before, after } });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        size: 36,
        color: K.navy,
      }),
    ],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 140 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        size: 28,
        color: K.blue,
      }),
    ],
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        bold: true,
        size: 24,
        color: K.lightBlue,
      }),
    ],
  });
}

function body(text: string, color = K.darkGrey): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, font: "Calibri", size: 20, color })],
  });
}

function labelValue(
  label: string,
  value: string,
  valueColor?: string,
): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: label + ": ",
        font: "Calibri",
        bold: true,
        size: 20,
        color: K.navy,
      }),
      new TextRun({
        text: value,
        font: "Calibri",
        size: 20,
        color: valueColor || K.darkGrey,
      }),
    ],
  });
}

function divider(): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    children: [
      new TextRun({
        text: "─".repeat(90),
        font: "Calibri",
        size: 14,
        color: "D1DCE8",
      }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    numbering: { reference: "bullet-list", level: 0 },
    children: [
      new TextRun({ text, font: "Calibri", size: 19, color: K.darkGrey }),
    ],
  });
}

// ── Main export ───────────────────────────────────────────────
export async function generateDocx(audit: AuditResult): Promise<Buffer> {
  const report = audit.report!;
  const score = audit.score;
  const issues = audit.issues;
  const config = audit.config;
  const testedLevel = report.testedLevel || "AA";
  const standard = config.standard || "WCAG 2.2";
  const auditDate = new Date(audit.startedAt).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const projectName = config.url || "PDF Document";

  // ── Pillar-aware title/score/badge ──────────────────────────
  // Derived from the pillars actually selected for this audit — never a generic bucket name.
  const displayInfo = getReportDisplayInfo(audit);
  const pillars =
    ((config as any).enabledPillars as string[] | undefined) || [];
  const reportTitle = displayInfo.reportTitle;
  const footerText = `Confidential  |  KPMG ${reportTitle}  |  Page `;
  const isA11y = pillars.length === 0 || pillars.includes("accessibility");
  const isDP = pillars.includes("darkpatterns");
  const isPerf = pillars.includes("performance");
  const isPriv = pillars.includes("privacy");
  const perfOnly = isPerf && !isA11y && !isDP && !isPriv;
  const perfResult = (audit as any).pillarResults?.performance as
    | any
    | undefined;
  const perfGradeLabel = (s: number) =>
    s >= 90
      ? "A (Excellent)"
      : s >= 75
        ? "B (Good)"
        : s >= 50
          ? "C (Needs Improvement)"
          : s >= 25
            ? "D (Poor)"
            : "F (Critical)";
  // Dynamic section numbers based on which pillars are active
  const dpSectionNum = isA11y ? "7" : "2";
  const perfSectionNum = isA11y && isDP ? "8" : isA11y || isDP ? "3" : "2";
  const privSectionNum =
    isA11y && isDP && isPerf
      ? "9"
      : isA11y && isDP
        ? "8"
        : isA11y || isDP || isPerf
          ? "3"
          : "2";

  // ── Pillar-specific column headers for issue table ────────────
  const col3Header = isA11y
    ? "WCAG SC"
    : isDP
      ? "Pattern ID"
      : isPerf
        ? "Metric"
        : "Regulation";
  const col4Header = isA11y
    ? "Level"
    : isDP
      ? "Regulation"
      : isPerf
        ? "Target"
        : "Article";
  const col3Val = (iss: AccessibilityIssue) =>
    isA11y
      ? iss.wcagCriterion
      : (iss as any).ruleId || (iss as any).patternId || "—";
  const col4Val = (iss: AccessibilityIssue) =>
    isA11y ? iss.wcagLevel : (iss as any).regulation?.[0] || "—";

  // Group by team for Section 4
  const byTeam: Record<string, AccessibilityIssue[]> = {};
  for (const iss of issues) {
    const t = deriveTeam(iss);
    if (!byTeam[t]) byTeam[t] = [];
    byTeam[t].push(iss);
  }

  // Group by component for Section 3
  const compFn = (i: AccessibilityIssue) => {
    const t = (i.title + " " + i.element).toLowerCase();
    if (t.includes("button") || t.includes("btn")) return "Buttons";
    if (
      t.includes("form") ||
      t.includes("input") ||
      t.includes("label") ||
      t.includes("select")
    )
      return "Forms";
    if (t.includes("modal") || t.includes("dialog")) return "Modals";
    if (t.includes("nav") || t.includes("menu") || t.includes("link"))
      return "Navigation";
    if (t.includes("img") || t.includes("alt")) return "Images";
    if (t.includes("heading")) return "Headings";
    if (t.includes("color") || t.includes("contrast"))
      return "Colour & Contrast";
    if (t.includes("focus") || t.includes("keyboard"))
      return "Keyboard & Focus";
    return "General";
  };
  const byComp: Record<string, AccessibilityIssue[]> = {};
  for (const iss of issues) {
    const c = compFn(iss);
    if (!byComp[c]) byComp[c] = [];
    byComp[c].push(iss);
  }

  const quickWins = issues.filter((i) => i.severity === "low");
  const critical = issues.filter((i) => i.severity === "critical");
  const high = issues.filter((i) => i.severity === "high");
  const medium = issues.filter((i) => i.severity === "medium");

  const numbering: INumberingOptions = {
    config: [
      {
        reference: "bullet-list",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: {
                  left: convertInchesToTwip(0.4),
                  hanging: convertInchesToTwip(0.2),
                },
              },
            },
          },
        ],
      },
    ],
  };

  const HEADER_CHILDREN = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1DCE8" },
      },
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "KPMG ",
          font: "Calibri",
          size: 16,
          bold: true,
          color: K.navy,
        }),
        new TextRun({
          text: `${reportTitle} Report`,
          font: "Calibri",
          size: 16,
          color: K.darkGrey,
          italics: true,
        }),
        new TextRun({
          text: "  |  " + auditDate,
          font: "Calibri",
          size: 16,
          color: K.midGrey,
        }),
      ],
    }),
  ];

  const FOOTER_CHILDREN = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: "D1DCE8" } },
      spacing: { before: 80 },
      children: [
        new TextRun({
          text: footerText,
          font: "Calibri",
          size: 14,
          color: K.midGrey,
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          font: "Calibri",
          size: 14,
          color: K.midGrey,
        }),
        new TextRun({
          text: " of ",
          font: "Calibri",
          size: 14,
          color: K.midGrey,
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          font: "Calibri",
          size: 14,
          color: K.midGrey,
        }),
      ],
    }),
  ];

  const doc = new Document({
    numbering,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20, color: K.nearBlack } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.9),
              bottom: convertInchesToTwip(0.9),
              left: convertInchesToTwip(1.1),
              right: convertInchesToTwip(1.1),
            },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        headers: { default: new Header({ children: HEADER_CHILDREN }) },
        footers: { default: new Footer({ children: FOOTER_CHILDREN }) },
        children: [
          // ─────────────────────────────────────────────────────
          // COVER PAGE
          // ─────────────────────────────────────────────────────
          sp(1440),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: "KPMG",
                font: "Calibri",
                size: 72,
                bold: true,
                color: K.navy,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `${reportTitle} — Final Delivery Report`,
                font: "Calibri",
                size: 32,
                color: K.lightBlue,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "━".repeat(60),
                font: "Calibri",
                size: 22,
                color: K.navy,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({
                text: projectName,
                font: "Calibri",
                size: 26,
                color: K.darkGrey,
                italics: true,
              }),
            ],
          }),
          // Metadata table
          new Table({
            width: { size: 55, type: WidthType.PERCENTAGE },
            alignment: AlignmentType.CENTER,
            borders: TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  cell("Report Type", {
                    bold: true,
                    color: K.navy,
                    width: 40,
                    bg: K.offWhite,
                  }),
                  cell(reportTitle, {
                    width: 60,
                    bold: true,
                    color: K.lightBlue,
                  }),
                ],
              }),
              isA11y
                ? new TableRow({
                    children: [
                      cell("Standard", {
                        bold: true,
                        color: K.navy,
                        width: 40,
                        bg: K.offWhite,
                      }),
                      cell(`${standard} Level ${testedLevel}`, { width: 60 }),
                    ],
                  })
                : new TableRow({
                    children: [
                      cell("Pillars Audited", {
                        bold: true,
                        color: K.navy,
                        width: 40,
                        bg: K.offWhite,
                      }),
                      cell(pillars.join(", "), { width: 60 }),
                    ],
                  }),
              new TableRow({
                children: [
                  cell("Audit Date", {
                    bold: true,
                    color: K.navy,
                    width: 40,
                    bg: K.offWhite,
                  }),
                  cell(auditDate, { width: 60 }),
                ],
              }),
              new TableRow({
                children: [
                  cell("Pages Audited", {
                    bold: true,
                    color: K.navy,
                    width: 40,
                    bg: K.offWhite,
                  }),
                  cell(
                    perfResult && perfResult.targetedPagesAudited
                      ? formatPageCount(perfResult)
                      : String(audit.pages.length),
                    { width: 60 },
                  ),
                ],
              }),
              (() => {
                const displayScore = displayInfo.score;
                const scoreColor =
                  displayScore >= 75
                    ? K.teal
                    : displayScore >= 50
                      ? K.medium
                      : K.critical;
                return new TableRow({
                  children: [
                    cell(displayInfo.scoreLabel, {
                      bold: true,
                      color: K.navy,
                      width: 40,
                      bg: K.offWhite,
                    }),
                    cell(`${displayScore}/100`, {
                      width: 60,
                      color: scoreColor,
                      bold: true,
                    }),
                  ],
                });
              })(),
              new TableRow({
                children: [
                  cell("Status", {
                    bold: true,
                    color: K.navy,
                    width: 40,
                    bg: K.offWhite,
                  }),
                  cell(displayInfo.statusLabel, { width: 60 }),
                ],
              }),
              (() => {
                const displayIssues =
                  perfOnly && perfResult
                    ? String(perfResult.totalResourceIssues ?? 0)
                    : `${score.uniqueIssues} unique (${score.totalIssues} instances)`;
                const issueLabel = perfOnly
                  ? "Resource Issues"
                  : "Total Issues";
                return new TableRow({
                  children: [
                    cell(issueLabel, {
                      bold: true,
                      color: K.navy,
                      width: 40,
                      bg: K.offWhite,
                    }),
                    cell(displayIssues, { width: 60 }),
                  ],
                });
              })(),
              new TableRow({
                children: [
                  cell("Classified Confidential", {
                    bold: true,
                    color: K.navy,
                    width: 40,
                    bg: K.offWhite,
                  }),
                  cell("KPMG Internal Use Only", {
                    width: 60,
                    italic: true,
                    color: K.midGrey,
                  }),
                ],
              }),
            ],
          }),

          // ─────────────────────────────────────────────────────
          // SECTION 1: EXECUTIVE SUMMARY
          // ─────────────────────────────────────────────────────
          h1("1. Executive Summary"),
          ...(
            report.executiveSummary ||
            `This KPMG ${reportTitle} evaluated ${projectName}${isA11y ? ` against ${standard} Level ${testedLevel} guidelines` : ""}. The overall score is ${displayInfo.score}/100 (${displayInfo.statusLabel}). ${score.uniqueIssues} unique issue(s) were identified (${score.totalIssues} total instances).`
          )
            .split("\n\n")
            .filter((s: string) => s.trim())
            .map((para: string) => body(para.trim(), K.darkGrey)),
          sp(),
          h2("1.1 Issue Breakdown"),
          (() => {
            if (perfOnly && perfResult) {
              // Performance-only: show resource issues by severity
              const perfPages: any[] = perfResult.pages || [];
              const bySev: Record<string, number> = {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
              };
              for (const pg of perfPages) {
                for (const ri of pg.resourceIssues || []) {
                  if (ri.severity in bySev) bySev[ri.severity]++;
                }
              }
              const total = Object.values(bySev).reduce((a, b) => a + b, 0);
              return new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                layout: TableLayoutType.FIXED,
                borders: TABLE_BORDERS,
                rows: [
                  new TableRow({
                    children: [
                      cell("Severity", {
                        bold: true,
                        bg: K.navy,
                        color: K.white,
                        width: 20,
                      }),
                      cell("Issues", {
                        bold: true,
                        bg: K.navy,
                        color: K.white,
                        width: 20,
                        align: AlignmentType.CENTER,
                      }),
                      cell("% of Total", {
                        bold: true,
                        bg: K.navy,
                        color: K.white,
                        width: 20,
                        align: AlignmentType.CENTER,
                      }),
                      cell("Action", {
                        bold: true,
                        bg: K.navy,
                        color: K.white,
                        width: 20,
                        align: AlignmentType.CENTER,
                      }),
                      cell("Target Sprint", {
                        bold: true,
                        bg: K.navy,
                        color: K.white,
                        width: 20,
                        align: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  ...(["critical", "high", "medium", "low"] as const).map(
                    (sev, i) =>
                      new TableRow({
                        children: [
                          cell(sev.charAt(0).toUpperCase() + sev.slice(1), {
                            bold: true,
                            color: sevColor(sev),
                            bg: i % 2 === 0 ? K.offWhite : K.white,
                          }),
                          cell(String(bySev[sev]), {
                            align: AlignmentType.CENTER,
                            bg: i % 2 === 0 ? K.offWhite : K.white,
                          }),
                          cell(
                            total > 0
                              ? `${Math.round((bySev[sev] / total) * 100)}%`
                              : "0%",
                            {
                              align: AlignmentType.CENTER,
                              bg: i % 2 === 0 ? K.offWhite : K.white,
                            },
                          ),
                          cell(
                            {
                              critical: "Block Release",
                              high: "Next Sprint",
                              medium: "Q2",
                              low: "Backlog",
                            }[sev],
                            {
                              align: AlignmentType.CENTER,
                              bold: true,
                              color: sevColor(sev),
                              bg: sevBg(sev),
                            },
                          ),
                          cell(
                            {
                              critical: "Sprint 1",
                              high: "Sprint 2",
                              medium: "Q3",
                              low: "Q4",
                            }[sev],
                            {
                              align: AlignmentType.CENTER,
                              bg: i % 2 === 0 ? K.offWhite : K.white,
                            },
                          ),
                        ],
                      }),
                  ),
                ],
              });
            }
            // Multi-pillar: aggregate severity counts
            const aggBySev: Record<string, number> = {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0,
            };
            const dpF = ((audit as any).pillarResults?.darkpatterns?.findings ??
              []) as Array<{ severity: string }>;
            const pvF = ((audit as any).pillarResults?.privacy?.findings ??
              []) as Array<{ severity: string }>;
            const perfIssues = (
              ((audit as any).pillarResults?.performance?.pages ?? []) as Array<{
                resourceIssues?: Array<{ severity: string }>;
              }>
            ).flatMap((p) => p.resourceIssues ?? []);
            for (const f of [...issues, ...dpF, ...pvF, ...perfIssues]) {
              if (f.severity in aggBySev) aggBySev[f.severity]++;
            }
            const aggTotal = Object.values(aggBySev).reduce((a, b) => a + b, 0);
            return new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              layout: TableLayoutType.FIXED,
              borders: TABLE_BORDERS,
              rows: [
                new TableRow({
                  children: [
                    cell("Severity", {
                      bold: true,
                      bg: K.navy,
                      color: K.white,
                      width: 20,
                    }),
                    cell("Count", {
                      bold: true,
                      bg: K.navy,
                      color: K.white,
                      width: 20,
                      align: AlignmentType.CENTER,
                    }),
                    cell("% of Total", {
                      bold: true,
                      bg: K.navy,
                      color: K.white,
                      width: 20,
                      align: AlignmentType.CENTER,
                    }),
                    cell("Priority", {
                      bold: true,
                      bg: K.navy,
                      color: K.white,
                      width: 20,
                      align: AlignmentType.CENTER,
                    }),
                    cell("Target Sprint", {
                      bold: true,
                      bg: K.navy,
                      color: K.white,
                      width: 20,
                      align: AlignmentType.CENTER,
                    }),
                  ],
                }),
                ...(["critical", "high", "medium", "low"] as const).map(
                  (sev, i) =>
                    new TableRow({
                      children: [
                        cell(sev.charAt(0).toUpperCase() + sev.slice(1), {
                          bold: true,
                          color: sevColor(sev),
                          bg: i % 2 === 0 ? K.offWhite : K.white,
                        }),
                        cell(String(aggBySev[sev]), {
                          align: AlignmentType.CENTER,
                          bg: i % 2 === 0 ? K.offWhite : K.white,
                        }),
                        cell(
                          aggTotal > 0
                            ? `${Math.round((aggBySev[sev] / aggTotal) * 100)}%`
                            : "0%",
                          {
                            align: AlignmentType.CENTER,
                            bg: i % 2 === 0 ? K.offWhite : K.white,
                          },
                        ),
                        cell(
                          {
                            critical: "Immediate",
                            high: "High",
                            medium: "Moderate",
                            low: "Low",
                          }[sev],
                          {
                            align: AlignmentType.CENTER,
                            bold: true,
                            color: sevColor(sev),
                            bg: sevBg(sev),
                          },
                        ),
                        cell(
                          {
                            critical: "Sprint 1",
                            high: "Sprint 2",
                            medium: "Q2",
                            low: "Today",
                          }[sev],
                          {
                            align: AlignmentType.CENTER,
                            bg: i % 2 === 0 ? K.offWhite : K.white,
                          },
                        ),
                      ],
                    }),
                ),
              ],
            });
          })(),
          sp(),
          ...(isA11y
            ? [
                h2("1.2 Category Scores (WCAG Principles)"),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  layout: TableLayoutType.FIXED,
                  borders: TABLE_BORDERS,
                  rows: [
                    new TableRow({
                      children: [
                        "Perceivable",
                        "Operable",
                        "Understandable",
                        "Robust",
                        "PDF",
                      ].map((c) =>
                        cell(c, {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          align: AlignmentType.CENTER,
                        }),
                      ),
                    }),
                    new TableRow({
                      children: [
                        "perceivable",
                        "operable",
                        "understandable",
                        "robust",
                        "pdf",
                      ].map((k) => {
                        const v =
                          score.categoryScores[
                            k as keyof typeof score.categoryScores
                          ] || 0;
                        const col =
                          v >= 75 ? K.teal : v >= 50 ? K.medium : K.critical;
                        return cell(String(v) + "/100", {
                          align: AlignmentType.CENTER,
                          bold: true,
                          color: col,
                        });
                      }),
                    }),
                  ],
                }),
              ]
            : perfOnly && perfResult
              ? [
                  h2("1.2 Core Web Vitals — Average Across All Pages"),
                  (() => {
                    const avg = perfResult.averageVitals || {};
                    const fmtMs = (v: number | null | undefined) =>
                      v != null ? `${Math.round(v)} ms` : "—";
                    const cwvStatus = (
                      key: string,
                      v: number | null | undefined,
                    ) => {
                      if (v == null) return K.midGrey;
                      if (key === "cls")
                        return v <= 0.1
                          ? K.teal
                          : v <= 0.25
                            ? K.medium
                            : K.critical;
                      const good: Record<string, number> = {
                        lcp: 2500,
                        fcp: 1800,
                        ttfb: 800,
                        tbt: 200,
                        inp: 200,
                      };
                      const poor: Record<string, number> = {
                        lcp: 4000,
                        fcp: 3000,
                        ttfb: 1800,
                        tbt: 600,
                        inp: 500,
                      };
                      return v <= (good[key] || 9999)
                        ? K.teal
                        : v <= (poor[key] || 9999)
                          ? K.medium
                          : K.critical;
                    };
                    return new Table({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      layout: TableLayoutType.FIXED,
                      borders: TABLE_BORDERS,
                      rows: [
                        new TableRow({
                          children: [
                            "Metric",
                            "Average",
                            "Status",
                            "Good Threshold",
                            "Poor Threshold",
                          ].map((h) =>
                            cell(h, {
                              bold: true,
                              bg: K.navy,
                              color: K.white,
                              align: AlignmentType.CENTER,
                            }),
                          ),
                        }),
                        ...(
                          [
                            {
                              key: "lcp",
                              label: "LCP (Largest Contentful Paint)",
                              good: "≤ 2,500 ms",
                              poor: "> 4,000 ms",
                              fmt: fmtMs,
                            },
                            {
                              key: "fcp",
                              label: "FCP (First Contentful Paint)",
                              good: "≤ 1,800 ms",
                              poor: "> 3,000 ms",
                              fmt: fmtMs,
                            },
                            {
                              key: "cls",
                              label: "CLS (Cumulative Layout Shift)",
                              good: "≤ 0.10",
                              poor: "> 0.25",
                              fmt: (v: number | null | undefined) =>
                                v != null ? v.toFixed(3) : "—",
                            },
                            {
                              key: "ttfb",
                              label: "TTFB (Time to First Byte)",
                              good: "≤ 800 ms",
                              poor: "> 1,800 ms",
                              fmt: fmtMs,
                            },
                            {
                              key: "tbt",
                              label: "TBT (Total Blocking Time)",
                              good: "≤ 200 ms",
                              poor: "> 600 ms",
                              fmt: fmtMs,
                            },
                            {
                              key: "inp",
                              label: "INP (Interaction to Next Paint)",
                              good: "≤ 200 ms",
                              poor: "> 500 ms",
                              fmt: fmtMs,
                            },
                          ] as Array<{
                            key: string;
                            label: string;
                            good: string;
                            poor: string;
                            fmt: (v: number | null | undefined) => string;
                          }>
                        ).map((m, i) => {
                          const val = avg[m.key];
                          const color = cwvStatus(m.key, val);
                          const statusLabel =
                            color === K.teal
                              ? "Good"
                              : color === K.medium
                                ? "Needs Improvement"
                                : color === K.critical
                                  ? "Poor"
                                  : "—";
                          return new TableRow({
                            children: [
                              cell(m.label, {
                                bold: true,
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                              }),
                              cell(m.fmt(val), {
                                align: AlignmentType.CENTER,
                                bold: true,
                                color,
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                              }),
                              cell(statusLabel, {
                                align: AlignmentType.CENTER,
                                bold: true,
                                color,
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                              }),
                              cell(m.good, {
                                align: AlignmentType.CENTER,
                                color: K.teal,
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                              }),
                              cell(m.poor, {
                                align: AlignmentType.CENTER,
                                color: K.critical,
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                              }),
                            ],
                          });
                        }),
                      ],
                    });
                  })(),
                ]
              : [
                  h2(`1.2 Pillar Score Summary`),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                    borders: TABLE_BORDERS,
                    rows: [
                      new TableRow({
                        children: pillars.map((p) =>
                          cell(p.charAt(0).toUpperCase() + p.slice(1), {
                            bold: true,
                            bg: K.navy,
                            color: K.white,
                            align: AlignmentType.CENTER,
                          }),
                        ),
                      }),
                      new TableRow({
                        children: pillars.map((p) => {
                          const v =
                            (audit as any).trustScore?.pillarScores?.[p]
                              ?.score ??
                            (p === "accessibility"
                              ? score.overall
                              : p === "darkpatterns"
                                ? (audit as any).pillarResults?.darkpatterns
                                    ?.ethicsScore
                                : p === "performance"
                                  ? (audit as any).pillarResults?.performance
                                      ?.overallScore
                                  : p === "privacy"
                                    ? (audit as any).pillarResults?.privacy
                                        ?.overallScore
                                    : 0) ??
                            0;
                          const col =
                            v >= 75 ? K.teal : v >= 50 ? K.medium : K.critical;
                          return cell(String(v) + "/100", {
                            align: AlignmentType.CENTER,
                            bold: true,
                            color: col,
                          });
                        }),
                      }),
                    ],
                  }),
                ]),

          // ─────────────────────────────────────────────────────
          // SECTIONS 2-6: ACCESSIBILITY-ONLY SECTIONS
          // ─────────────────────────────────────────────────────
          ...(!isA11y
            ? []
            : [
                h1("2. Issue Backlog — Developer Format"),
                body(
                  "Each issue below includes all information needed to assign, estimate, implement, and verify the fix. Issues are sorted by severity.",
                  K.darkGrey,
                ),
                sp(),

                // Summary table — pillar-aware columns
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  layout: TableLayoutType.FIXED,
                  borders: TABLE_BORDERS,
                  rows: [
                    new TableRow({
                      children: [
                        cell("#", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 8,
                          align: AlignmentType.CENTER,
                        }),
                        cell("Issue Title", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 30,
                        }),
                        cell(col3Header, {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 12,
                        }),
                        cell(col4Header, {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 8,
                          align: AlignmentType.CENTER,
                        }),
                        cell("Severity", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 12,
                          align: AlignmentType.CENTER,
                        }),
                        cell("Team Owner", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 15,
                        }),
                        cell("Effort", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 15,
                          align: AlignmentType.CENTER,
                        }),
                      ],
                    }),
                    ...issues.map(
                      (iss, idx) =>
                        new TableRow({
                          children: [
                            cell(`#${String(idx + 1).padStart(3, "0")}`, {
                              align: AlignmentType.CENTER,
                              bold: true,
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                            cell(iss.title, {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                            cell(col3Val(iss), {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                            cell(col4Val(iss), {
                              align: AlignmentType.CENTER,
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                              color: K.lightBlue,
                              bold: true,
                            }),
                            cell(iss.severity.toUpperCase(), {
                              align: AlignmentType.CENTER,
                              bold: true,
                              color: sevColor(iss.severity),
                              bg: sevBg(iss.severity),
                              size: 17,
                            }),
                            cell(deriveTeam(iss), {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                            cell(deriveEffort(iss), {
                              align: AlignmentType.CENTER,
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                          ],
                        }),
                    ),
                  ],
                }),

                // Detail blocks — grouped by wcagCriterion::title so that a single
                // reused component (identical `element` across every instance)
                // renders ONE consolidated "Component Fix" card instead of N
                // near-duplicate cards; genuinely distinct elements each keep
                // their own full card with independent location evidence.
                sp(200),
                ...(() => {
                  const groupMap = new Map<string, AccessibilityIssue[]>();
                  for (const iss of issues) {
                    const key = `${iss.wcagCriterion}::${iss.title}`;
                    if (!groupMap.has(key)) groupMap.set(key, []);
                    groupMap.get(key)!.push(iss);
                  }
                  const groups = Array.from(groupMap.values());
                  let cardCount = 0;
                  return groups.flatMap((group) => {
                    const distinctElements = new Set(
                      group.map((i) => i.element),
                    ).size;
                    const isComponentFix =
                      distinctElements === 1 && group.length > 1;
                    const affectedPages = Array.from(
                      new Set(group.map((i) => i.pageUrl)),
                    );
                    const toRender = isComponentFix ? [group[0]] : group;
                    return toRender.flatMap((iss) => {
                  const idx = cardCount++;
                  const acceptance = deriveAcceptance(iss);
                  const team = deriveTeam(iss);
                  const parts: (Paragraph | Table)[] = [
                    divider(),
                    h3(`#${String(idx + 1).padStart(3, "0")} — ${iss.title}`),
                    ...(isComponentFix
                      ? [
                          new Paragraph({
                            spacing: { after: 100 },
                            shading: {
                              type: ShadingType.SOLID,
                              color: "E8F9F4",
                              fill: "E8F9F4",
                            },
                            border: {
                              left: {
                                style: BorderStyle.THICK,
                                size: 6,
                                color: K.teal,
                              },
                            },
                            children: [
                              new TextRun({
                                text: `  COMPONENT FIX — this is the same reused element on ${affectedPages.length} page(s) (${group.length} instance${group.length !== 1 ? "s" : ""} total). Fixing it once at the component/design-system level resolves every instance.`,
                                bold: true,
                                italics: true,
                                font: "Calibri",
                                size: 18,
                                color: "047856",
                              }),
                            ],
                          }),
                        ]
                      : []),
                    new Paragraph({
                      spacing: { after: 120 },
                      children: [
                        new TextRun({
                          text: "Severity: ",
                          bold: true,
                          font: "Calibri",
                          size: 20,
                          color: K.navy,
                        }),
                        new TextRun({
                          text: iss.severity.toUpperCase(),
                          bold: true,
                          font: "Calibri",
                          size: 20,
                          color: sevColor(iss.severity),
                        }),
                        new TextRun({
                          text: "   |   WCAG: ",
                          bold: true,
                          font: "Calibri",
                          size: 20,
                          color: K.navy,
                        }),
                        new TextRun({
                          text: `${iss.wcagCriterion} — ${iss.wcagName} (Level ${iss.wcagLevel})`,
                          font: "Calibri",
                          size: 20,
                          color: K.lightBlue,
                        }),
                        new TextRun({
                          text: "   |   Owner: ",
                          bold: true,
                          font: "Calibri",
                          size: 20,
                          color: K.navy,
                        }),
                        new TextRun({
                          text: team,
                          bold: true,
                          font: "Calibri",
                          size: 20,
                          color: `${TEAM_COLOR[team] || K.lightBlue}`,
                        }),
                        new TextRun({
                          text: "   |   Effort: ",
                          bold: true,
                          font: "Calibri",
                          size: 20,
                          color: K.navy,
                        }),
                        new TextRun({
                          text: deriveEffort(iss),
                          font: "Calibri",
                          size: 20,
                          color: K.darkGrey,
                        }),
                      ],
                    }),
                    sp(40),
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [
                        new TextRun({
                          text: "Page / Screen: ",
                          bold: true,
                          font: "Calibri",
                          size: 19,
                          color: K.navy,
                        }),
                        new TextRun({
                          text:
                            iss.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/",
                          font: "Calibri",
                          size: 19,
                          color: K.darkGrey,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Developer Location",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.nearBlack,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [
                        new TextRun({
                          text: "🎯 CSS Selector: ",
                          bold: true,
                          font: "Calibri",
                          size: 19,
                          color: K.navy,
                        }),
                        new TextRun({
                          text: iss.element,
                          font: "Consolas",
                          size: 17,
                          color: K.blue,
                        }),
                      ],
                    }),
                    ...(iss.xpath
                      ? [
                          new Paragraph({
                            spacing: { after: 40 },
                            children: [
                              new TextRun({
                                text: "📍 XPath: ",
                                bold: true,
                                font: "Calibri",
                                size: 19,
                                color: K.navy,
                              }),
                              new TextRun({
                                text: iss.xpath,
                                font: "Consolas",
                                size: 17,
                                color: K.blue,
                              }),
                            ],
                          }),
                        ]
                      : []),
                    ...(() => {
                      const cmd = buildDevToolsCommand(iss);
                      return cmd
                        ? [
                            new Paragraph({
                              spacing: { after: 60 },
                              shading: {
                                type: ShadingType.SOLID,
                                color: "010B1A",
                                fill: "010B1A",
                              },
                              children: [
                                new TextRun({
                                  text: `  🔧 DevTools Console: ${cmd}`,
                                  font: "Consolas",
                                  size: 17,
                                  color: "86EFAC",
                                }),
                              ],
                            }),
                          ]
                        : [];
                    })(),
                    ...(iss.elementScreenshot
                      ? (() => {
                          try {
                            const imgBuf = Buffer.from(
                              iss.elementScreenshot,
                              "base64",
                            );
                            const dims = getImageDimensions(imgBuf, "png");
                            const box = fitImageBox(dims, 500, 220);
                            return [
                              new Paragraph({
                                spacing: { before: 60, after: 40 },
                                children: [
                                  new TextRun({
                                    text: "📸 Element Screenshot (captured during audit)",
                                    bold: true,
                                    italics: true,
                                    font: "Calibri",
                                    size: 18,
                                    color: K.midGrey,
                                  }),
                                ],
                              }),
                              new Paragraph({
                                spacing: { after: 100 },
                                children: [
                                  new ImageRun({
                                    data: imgBuf,
                                    transformation: box,
                                    type: "png",
                                  }),
                                ],
                              }),
                            ];
                          } catch {
                            return [];
                          }
                        })()
                      : []),
                    sp(60),
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Description",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.nearBlack,
                        }),
                      ],
                    }),
                    body(iss.description),
                    sp(60),
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Steps to Reproduce",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.nearBlack,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 60 },
                      numbering: { reference: "bullet-list", level: 0 },
                      children: [
                        new TextRun({
                          text: `Navigate to: ${iss.pageUrl}`,
                          font: "Calibri",
                          size: 19,
                          color: K.darkGrey,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 60 },
                      numbering: { reference: "bullet-list", level: 0 },
                      children: [
                        new TextRun({
                          text: `Locate element: ${iss.element.substring(0, 80)}`,
                          font: "Calibri",
                          size: 19,
                          color: K.darkGrey,
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { after: 60 },
                      numbering: { reference: "bullet-list", level: 0 },
                      children: [
                        new TextRun({
                          text: isA11y
                            ? "Interact using keyboard only (Tab, Enter, Space) or screen reader (NVDA/JAWS/VoiceOver)"
                            : isDP
                              ? "Visually inspect the element for dark pattern indicators (prominence, pre-selection, misleading copy)"
                              : isPerf
                                ? "Load page with DevTools Network tab open and capture timing metrics"
                                : "Check cookies, network requests, and consent state in browser DevTools",
                          font: "Calibri",
                          size: 19,
                          color: K.darkGrey,
                        }),
                      ],
                    }),
                    sp(60),
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Current Behaviour",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.critical,
                        }),
                      ],
                    }),
                    body(iss.description, K.critical),
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Expected Behaviour",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: "047856",
                        }),
                      ],
                    }),
                    body(
                      iss.recommendation ||
                        "Recommendation not available — review the issue description and applicable WCAG criterion.",
                      "047856",
                    ),
                    sp(60),
                    iss.codeFix
                      ? new Paragraph({
                          spacing: { after: 50 },
                          children: [
                            new TextRun({
                              text: "Recommended Code Fix",
                              bold: true,
                              font: "Calibri",
                              size: 21,
                              color: K.nearBlack,
                            }),
                          ],
                        })
                      : sp(0),
                    iss.codeFix
                      ? new Paragraph({
                          spacing: { after: 120 },
                          shading: {
                            type: ShadingType.SOLID,
                            color: "010B1A",
                            fill: "010B1A",
                          },
                          border: {
                            left: {
                              style: BorderStyle.THICK,
                              size: 6,
                              color: K.teal,
                            },
                          },
                          children: [
                            new TextRun({
                              text: iss.codeFix.substring(0, 600),
                              font: "Consolas",
                              size: 17,
                              color: "86EFAC",
                            }),
                          ],
                        })
                      : sp(0),
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Done When (Acceptance Criteria)",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.nearBlack,
                        }),
                      ],
                    }),
                    ...acceptance.map((a) => bullet(`-  ${a}`)),
                  ];
                  return parts;
                    });
                  });
                })(),

                // ─────────────────────────────────────────────────────
                // SECTION 3: COMPONENT-LEVEL FINDINGS
                // ─────────────────────────────────────────────────────
                h1("3. Component-Level Findings"),
                body(
                  "Issues grouped by UI component. Fixing the root cause at the component/design-system level resolves all instances at once.",
                  K.darkGrey,
                ),
                sp(),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  layout: TableLayoutType.FIXED,
                  borders: TABLE_BORDERS,
                  rows: [
                    new TableRow({
                      children: [
                        cell("Component", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 22,
                        }),
                        cell("Issues", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 10,
                          align: AlignmentType.CENTER,
                        }),
                        cell("Critical", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 10,
                          align: AlignmentType.CENTER,
                        }),
                        cell("High", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 10,
                          align: AlignmentType.CENTER,
                        }),
                        cell("DS Impact", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 14,
                          align: AlignmentType.CENTER,
                        }),
                        cell("Affected Teams", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 34,
                        }),
                      ],
                    }),
                    ...Object.entries(byComp)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([comp, cIssues], i) => {
                        const critC = cIssues.filter(
                          (x) => x.severity === "critical",
                        ).length;
                        const highC = cIssues.filter(
                          (x) => x.severity === "high",
                        ).length;
                        const teams = [
                          ...new Set(cIssues.map((x) => deriveTeam(x))),
                        ].join(", ");
                        const dsImpact = cIssues.length >= 3 ? "Yes" : "No";
                        return new TableRow({
                          children: [
                            cell(comp, {
                              bold: true,
                              bg: i % 2 === 0 ? K.offWhite : K.white,
                            }),
                            cell(String(cIssues.length), {
                              align: AlignmentType.CENTER,
                              bold: true,
                              color:
                                cIssues.length >= 5 ? K.critical : K.darkGrey,
                              bg: i % 2 === 0 ? K.offWhite : K.white,
                            }),
                            cell(String(critC), {
                              align: AlignmentType.CENTER,
                              bold: critC > 0,
                              color: critC > 0 ? K.critical : K.darkGrey,
                              bg:
                                critC > 0
                                  ? K.criticalBg
                                  : i % 2 === 0
                                    ? K.offWhite
                                    : K.white,
                            }),
                            cell(String(highC), {
                              align: AlignmentType.CENTER,
                              bold: highC > 0,
                              color: highC > 0 ? K.high : K.darkGrey,
                              bg: i % 2 === 0 ? K.offWhite : K.white,
                            }),
                            cell(dsImpact, {
                              align: AlignmentType.CENTER,
                              bold: cIssues.length >= 3,
                              color: cIssues.length >= 3 ? K.high : K.teal,
                              bg: i % 2 === 0 ? K.offWhite : K.white,
                            }),
                            cell(teams, {
                              bg: i % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                          ],
                        });
                      }),
                  ],
                }),

                // ─────────────────────────────────────────────────────
                // SECTION 4: REMEDIATION GUIDANCE BY TEAM
                // ─────────────────────────────────────────────────────
                h1("4. Remediation Guidance by Team"),
                body(
                  "Route issues to the correct team. Each team's issues are listed with implementation notes.",
                  K.darkGrey,
                ),

                ...Object.entries(byTeam).flatMap(([team, tIssues]) => [
                  h2(
                    `4.x  ${team}  (${tIssues.length} issue${tIssues.length > 1 ? "s" : ""})`,
                  ),
                  body(
                    {
                      "Frontend Dev":
                        "Focus on semantic HTML, keyboard event handlers, ARIA attributes, focus management, and form error handling. Use native HTML elements before ARIA.",
                      Designer:
                        "Review colour contrast ratios, focus indicator visibility, touch target sizing, and visual hierarchy. Update design tokens in the design system.",
                      Content:
                        "Provide descriptive alt text, rewrite vague link text, confirm heading hierarchy, and update button labels to describe their action.",
                      "Design System":
                        "These are systemic issues. Fixing the component in the design system resolves all instances across every page automatically.",
                      QA: "Convert each issue into a regression test case. Add keyboard-only and screen-reader test runs to your CI/CD pipeline.",
                      "PDF Team":
                        "Ensure all elements are tagged, reading order is logical, images have alt text, the document language is set, and table headers are marked.",
                    }[team] || "",
                    K.darkGrey,
                  ),
                  sp(40),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                    borders: TABLE_BORDERS,
                    rows: [
                      new TableRow({
                        children: [
                          cell("ID", {
                            bold: true,
                            bg: K.lightBlue,
                            color: K.white,
                            width: 10,
                            align: AlignmentType.CENTER,
                          }),
                          cell("Title", {
                            bold: true,
                            bg: K.lightBlue,
                            color: K.white,
                            width: 45,
                          }),
                          cell(col3Header, {
                            bold: true,
                            bg: K.lightBlue,
                            color: K.white,
                            width: 13,
                          }),
                          cell("Severity", {
                            bold: true,
                            bg: K.lightBlue,
                            color: K.white,
                            width: 15,
                            align: AlignmentType.CENTER,
                          }),
                          cell("Effort", {
                            bold: true,
                            bg: K.lightBlue,
                            color: K.white,
                            width: 17,
                            align: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                      ...tIssues.map(
                        (iss, i) =>
                          new TableRow({
                            children: [
                              cell(
                                `#${String(issues.indexOf(iss) + 1).padStart(3, "0")}`,
                                {
                                  bold: true,
                                  align: AlignmentType.CENTER,
                                  bg: i % 2 === 0 ? K.offWhite : K.white,
                                  size: 17,
                                },
                              ),
                              cell(iss.title, {
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                                size: 17,
                              }),
                              cell(col3Val(iss), {
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                                size: 17,
                              }),
                              cell(iss.severity.toUpperCase(), {
                                align: AlignmentType.CENTER,
                                bold: true,
                                color: sevColor(iss.severity),
                                bg: sevBg(iss.severity),
                                size: 17,
                              }),
                              cell(deriveEffort(iss), {
                                align: AlignmentType.CENTER,
                                bg: i % 2 === 0 ? K.offWhite : K.white,
                                size: 17,
                              }),
                            ],
                          }),
                      ),
                    ],
                  }),
                  sp(80),
                ]),

                // ─────────────────────────────────────────────────────
                // SECTION 5: PRIORITY MATRIX
                // ─────────────────────────────────────────────────────
                h1("5. Priority Matrix"),
                body(
                  "Use this matrix during sprint planning to correctly queue and assign fixes.",
                  K.darkGrey,
                ),
                sp(),

                ...(
                  [
                    [
                      "Critical Blockers — Fix This Sprint",
                      K.critical,
                      K.criticalBg,
                      critical,
                    ],
                    ["High Priority — Next Sprint", K.high, K.highBg, high],
                    [
                      "Medium Priority — This Quarter",
                      K.medium,
                      K.mediumBg,
                      medium,
                    ],
                    [
                      "Quick Wins — Fix Today (< 30 min each)",
                      K.teal,
                      K.passBg,
                      quickWins,
                    ],
                  ] as [string, string, string, AccessibilityIssue[]][]
                ).flatMap(([title, color, bg, grp]) => [
                  new Paragraph({
                    spacing: { before: 200, after: 80 },
                    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
                    border: {
                      left: { style: BorderStyle.THICK, size: 6, color },
                    },
                    children: [
                      new TextRun({
                        text: `  ${title}  (${grp.length} issue${grp.length !== 1 ? "s" : ""})`,
                        font: "Calibri",
                        bold: true,
                        size: 22,
                        color,
                      }),
                    ],
                  }),
                  grp.length === 0
                    ? body("No issues in this category.", K.midGrey)
                    : new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        layout: TableLayoutType.FIXED,
                        borders: TABLE_BORDERS,
                        rows: grp.map(
                          (iss, i) =>
                            new TableRow({
                              children: [
                                cell(iss.title, {
                                  bg: i % 2 === 0 ? bg : K.white,
                                  size: 18,
                                }),
                                cell(iss.wcagCriterion, {
                                  bg: i % 2 === 0 ? bg : K.white,
                                  size: 18,
                                  color: K.lightBlue,
                                }),
                                cell(deriveTeam(iss), {
                                  bg: i % 2 === 0 ? bg : K.white,
                                  size: 18,
                                  color,
                                }),
                                cell(deriveEffort(iss), {
                                  bg: i % 2 === 0 ? bg : K.white,
                                  size: 18,
                                  align: AlignmentType.CENTER,
                                }),
                              ],
                            }),
                        ),
                      }),
                ]),

                // ─────────────────────────────────────────────────────
                // SECTION 6: ACCEPTANCE CRITERIA / QA CHECKLIST
                // ─────────────────────────────────────────────────────
                h1("6. Acceptance Criteria & QA Test Cases"),
                body(
                  'Each issue has a "Done When" checklist. Use these as regression test cases and code-review acceptance gates.',
                  K.darkGrey,
                ),
                sp(),

                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  layout: TableLayoutType.FIXED,
                  borders: TABLE_BORDERS,
                  rows: [
                    new TableRow({
                      children: [
                        cell("#", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 8,
                          align: AlignmentType.CENTER,
                        }),
                        cell("Issue", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 35,
                        }),
                        cell("Severity", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 12,
                          align: AlignmentType.CENTER,
                        }),
                        cell("Done When — Acceptance Criteria", {
                          bold: true,
                          bg: K.navy,
                          color: K.white,
                          width: 45,
                        }),
                      ],
                    }),
                    ...issues.map(
                      (iss, idx) =>
                        new TableRow({
                          children: [
                            cell(`#${String(idx + 1).padStart(3, "0")}`, {
                              bold: true,
                              align: AlignmentType.CENTER,
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                            cell(iss.title, {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                            }),
                            cell(iss.severity.toUpperCase(), {
                              align: AlignmentType.CENTER,
                              bold: true,
                              color: sevColor(iss.severity),
                              bg: sevBg(iss.severity),
                              size: 17,
                            }),
                            cell(
                              deriveAcceptance(iss)
                                .map((a, i) => `${i + 1}. ${a}`)
                                .join("\n"),
                              {
                                bg: idx % 2 === 0 ? K.offWhite : K.white,
                                size: 16,
                              },
                            ),
                          ],
                        }),
                    ),
                  ],
                }),
              ]), // end isA11y sections 2-6

          // ─────────────────────────────────────────────────────
          // DARK PATTERN FINDINGS (pillar-aware section num)
          // ─────────────────────────────────────────────────────
          ...(() => {
            if (!isDP) return [];
            const dpFindings: DarkPatternFinding[] =
              (audit as any).pillarResults?.darkpatterns?.findings || [];
            const purple = "6A289B";
            const purpleBg = "F8F0FF";

            if (dpFindings.length === 0) {
              return [
                h1(`${dpSectionNum}. Dark Pattern Findings`),
                body(
                  "✓  No dark patterns detected — the interface respects ethical design principles.",
                  K.teal,
                ),
              ];
            }

            return [
              h1(`${dpSectionNum}. Dark Pattern Findings`),
              body(
                `${dpFindings.length} dark pattern(s) detected. Each finding is classified against the CCPA taxonomy and EU Digital Services Act Article 25.`,
                K.darkGrey,
              ),
              sp(),

              // Summary table
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                layout: TableLayoutType.FIXED,
                borders: TABLE_BORDERS,
                rows: [
                  new TableRow({
                    children: [
                      cell("#", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 6,
                        align: AlignmentType.CENTER,
                      }),
                      cell("Finding", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 21,
                      }),
                      cell("Location", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 17,
                      }),
                      cell("Category", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 14,
                      }),
                      cell("CCPA", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 14,
                      }),
                      cell("Severity", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 12,
                        align: AlignmentType.CENTER,
                      }),
                      cell("DSA Article", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 8,
                      }),
                      cell("Priority", {
                        bold: true,
                        bg: purple,
                        color: K.white,
                        width: 8,
                        align: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  ...dpFindings.map(
                    (f, idx) =>
                      new TableRow({
                        children: [
                          cell(`#${String(idx + 1).padStart(3, "0")}`, {
                            align: AlignmentType.CENTER,
                            bold: true,
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                          cell(f.title, {
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                          cell(
                            f.element ||
                              f.pageUrl.replace(/^https?:\/\/[^/]+/, "") ||
                              "/",
                            {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 15,
                            },
                          ),
                          cell(f.category.replace(/-/g, " "), {
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                          cell(
                            f.brignullPattern
                              ? `#${f.brignullNumber} ${f.brignullPattern}`
                              : "—",
                            {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                              color: purple,
                            },
                          ),
                          cell(f.severity.toUpperCase(), {
                            align: AlignmentType.CENTER,
                            bold: true,
                            color: sevColor(f.severity),
                            bg: sevBg(f.severity),
                            size: 17,
                          }),
                          cell(f.dsaArticle || f.regulation?.[0] || "—", {
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                          cell(f.fixPriority || "—", {
                            align: AlignmentType.CENTER,
                            bold: true,
                            color:
                              f.fixPriority === "P0"
                                ? K.critical
                                : f.fixPriority === "P1"
                                  ? K.high
                                  : K.darkGrey,
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                        ],
                      }),
                  ),
                ],
              }),

              // Detail cards
              sp(200),
              h2(`${dpSectionNum}.1 Dark Pattern Detail Cards`),
              ...dpFindings.flatMap((f, idx) => {
                const parts: (Paragraph | Table)[] = [
                  divider(),
                  new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 220, after: 100 },
                    shading: {
                      type: ShadingType.SOLID,
                      color: purpleBg,
                      fill: purpleBg,
                    },
                    border: {
                      left: {
                        style: BorderStyle.THICK,
                        size: 6,
                        color: purple,
                      },
                    },
                    children: [
                      new TextRun({
                        text: `  #${String(idx + 1).padStart(3, "0")} — ${f.title}`,
                        font: "Calibri",
                        bold: true,
                        size: 22,
                        color: purple,
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 100 },
                    children: [
                      new TextRun({
                        text: "Severity: ",
                        bold: true,
                        font: "Calibri",
                        size: 20,
                        color: K.navy,
                      }),
                      new TextRun({
                        text: f.severity.toUpperCase(),
                        bold: true,
                        font: "Calibri",
                        size: 20,
                        color: sevColor(f.severity),
                      }),
                      new TextRun({
                        text: "   |   Rule: ",
                        bold: true,
                        font: "Calibri",
                        size: 20,
                        color: K.navy,
                      }),
                      new TextRun({
                        text: f.ruleId || "—",
                        font: "Calibri",
                        size: 20,
                        color: K.lightBlue,
                      }),
                      ...(f.brignullPattern
                        ? [
                            new TextRun({
                              text: "   |   CCPA: ",
                              bold: true,
                              font: "Calibri",
                              size: 20,
                              color: K.navy,
                            }),
                            new TextRun({
                              text: `#${f.brignullNumber} ${f.brignullPattern}`,
                              bold: true,
                              font: "Calibri",
                              size: 20,
                              color: purple,
                            }),
                          ]
                        : []),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 100 },
                    children: [
                      new TextRun({
                        text: "Location: ",
                        bold: true,
                        font: "Calibri",
                        size: 20,
                        color: K.navy,
                      }),
                      new TextRun({
                        text: `${f.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}  →  `,
                        font: "Calibri",
                        size: 18,
                        color: K.darkGrey,
                      }),
                      new TextRun({
                        text: f.element || "(selector not resolved)",
                        font: "Consolas",
                        size: 18,
                        color: K.lightBlue,
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 120 },
                    children: [
                      new TextRun({
                        text: "DSA Article: ",
                        bold: true,
                        font: "Calibri",
                        size: 20,
                        color: K.navy,
                      }),
                      new TextRun({
                        text: f.dsaArticle || "—",
                        font: "Calibri",
                        size: 20,
                        color: K.lightBlue,
                      }),
                      ...(f.fixPriority
                        ? [
                            new TextRun({
                              text: "   |   Fix Priority: ",
                              bold: true,
                              font: "Calibri",
                              size: 20,
                              color: K.navy,
                            }),
                            new TextRun({
                              text: f.fixPriority,
                              bold: true,
                              font: "Calibri",
                              size: 20,
                              color:
                                f.fixPriority === "P0" ? K.critical : K.high,
                            }),
                            new TextRun({
                              text: f.estimatedEffort
                                ? `   |   Effort: ${f.estimatedEffort}`
                                : "",
                              font: "Calibri",
                              size: 20,
                              color: K.darkGrey,
                            }),
                          ]
                        : []),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 50 },
                    children: [
                      new TextRun({
                        text: "User Impact",
                        bold: true,
                        font: "Calibri",
                        size: 21,
                        color: K.nearBlack,
                      }),
                    ],
                  }),
                  body(f.userImpact || f.description),
                ];

                if (f.developerFix) {
                  parts.push(
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Developer Fix",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.nearBlack,
                        }),
                      ],
                    }),
                  );
                  parts.push(
                    new Paragraph({
                      spacing: { after: 120 },
                      shading: {
                        type: ShadingType.SOLID,
                        color: "010B1A",
                        fill: "010B1A",
                      },
                      border: {
                        left: {
                          style: BorderStyle.THICK,
                          size: 6,
                          color: K.teal,
                        },
                      },
                      children: [
                        new TextRun({
                          text: f.developerFix.substring(0, 500),
                          font: "Consolas",
                          size: 17,
                          color: "86EFAC",
                        }),
                      ],
                    }),
                  );
                }

                if (f.designerFix) {
                  parts.push(
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Design Fix",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.nearBlack,
                        }),
                      ],
                    }),
                  );
                  parts.push(body(f.designerFix, "A78BFA"));
                }

                if (f.legalSummary) {
                  parts.push(
                    new Paragraph({
                      spacing: { after: 50 },
                      children: [
                        new TextRun({
                          text: "Legal / Regulatory Exposure",
                          bold: true,
                          font: "Calibri",
                          size: 21,
                          color: K.critical,
                        }),
                      ],
                    }),
                  );
                  parts.push(
                    body(f.legalSummary.substring(0, 400), K.critical),
                  );
                }

                parts.push(
                  new Paragraph({
                    spacing: { after: 50 },
                    children: [
                      new TextRun({
                        text: "Recommendation",
                        bold: true,
                        font: "Calibri",
                        size: 21,
                        color: "047856",
                      }),
                    ],
                  }),
                );
                parts.push(body(f.recommendation, "047856"));

                // Evidence screenshot
                const screenshotUrl: string | undefined = (f.evidence as any)
                  ?.screenshotDataUrl;
                if (screenshotUrl) {
                  const base64Data = screenshotUrl.replace(
                    /^data:image\/\w+;base64,/,
                    "",
                  );
                  parts.push(
                    new Paragraph({
                      spacing: { before: 120, after: 40 },
                      children: [
                        new TextRun({
                          text: `Evidence Screenshot — ${(f.evidence as any)?.pageUrl || f.pageUrl || ""}`,
                          bold: true,
                          font: "Calibri",
                          size: 18,
                          color: K.midGrey,
                          italics: true,
                        }),
                      ],
                    }),
                  );
                  try {
                    const imgBuf = Buffer.from(base64Data, "base64");
                    const dims = getImageDimensions(imgBuf, "jpg");
                    const box = fitImageBox(dims, 500, 250);
                    parts.push(
                      new Paragraph({
                        spacing: { after: 160 },
                        children: [
                          new ImageRun({
                            data: imgBuf,
                            transformation: box,
                            type: "jpg",
                          }),
                        ],
                      }),
                    );
                  } catch (_) {
                    /* skip if image data is invalid */
                  }
                }

                return parts;
              }),
            ];
          })(),

          // ─────────────────────────────────────────────────────
          // SECTION 8: PERFORMANCE FINDINGS (if Perf pillar)
          // ─────────────────────────────────────────────────────
          ...(() => {
            if (!isPerf) return [];
            const perfResult = (audit as any).pillarResults?.performance;
            if (!perfResult) return [];
            const perfPages: any[] = perfResult.pages || [];
            const green = "006E51";
            const greenBg = "E8F9F4";
            if (perfPages.length === 0) return [];

            const vitalLabel: Record<string, string> = {
              lcp: "LCP (ms)",
              fid: "FID (ms)",
              cls: "CLS",
              fcp: "FCP (ms)",
              ttfb: "TTFB (ms)",
              tti: "TTI (ms)",
            };

            return [
              h1(`${perfSectionNum}. Performance Findings`),
              body(
                `Core Web Vitals and resource analysis across ${formatPageCount(perfResult)}. Overall performance score: ${perfResult.overallScore ?? "—"}/100.`,
                K.darkGrey,
              ),
              sp(),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                layout: TableLayoutType.FIXED,
                borders: TABLE_BORDERS,
                rows: [
                  new TableRow({
                    children: [
                      cell("Page", {
                        bold: true,
                        bg: green,
                        color: K.white,
                        width: 36,
                      }),
                      cell("Score", {
                        bold: true,
                        bg: green,
                        color: K.white,
                        width: 10,
                        align: AlignmentType.CENTER,
                      }),
                      cell("LCP (ms)", {
                        bold: true,
                        bg: green,
                        color: K.white,
                        width: 12,
                        align: AlignmentType.CENTER,
                      }),
                      cell("CLS", {
                        bold: true,
                        bg: green,
                        color: K.white,
                        width: 10,
                        align: AlignmentType.CENTER,
                      }),
                      cell("FCP (ms)", {
                        bold: true,
                        bg: green,
                        color: K.white,
                        width: 12,
                        align: AlignmentType.CENTER,
                      }),
                      cell("Resource Issues", {
                        bold: true,
                        bg: green,
                        color: K.white,
                        width: 20,
                        align: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                  ...perfPages.map((pg: any, i: number) => {
                    const sc = pg.score ?? 0;
                    const scCol =
                      sc >= 75 ? K.teal : sc >= 50 ? K.medium : K.critical;
                    return new TableRow({
                      children: [
                        cell(
                          pg.title ||
                            pg.url.replace(/^https?:\/\/[^/]+/, "") ||
                            "/",
                          { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 },
                        ),
                        cell(String(sc), {
                          align: AlignmentType.CENTER,
                          bold: true,
                          color: scCol,
                          bg: i % 2 === 0 ? K.offWhite : K.white,
                        }),
                        cell(
                          pg.vitals?.lcp != null
                            ? String(Math.round(pg.vitals.lcp))
                            : "—",
                          {
                            align: AlignmentType.CENTER,
                            bg: i % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          },
                        ),
                        cell(
                          pg.vitals?.cls != null
                            ? pg.vitals.cls.toFixed(3)
                            : "—",
                          {
                            align: AlignmentType.CENTER,
                            bg: i % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          },
                        ),
                        cell(
                          pg.vitals?.fcp != null
                            ? String(Math.round(pg.vitals.fcp))
                            : "—",
                          {
                            align: AlignmentType.CENTER,
                            bg: i % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          },
                        ),
                        cell(String(pg.resourceIssues?.length ?? 0), {
                          align: AlignmentType.CENTER,
                          bold: (pg.resourceIssues?.length ?? 0) > 0,
                          color:
                            (pg.resourceIssues?.length ?? 0) > 0
                              ? K.high
                              : K.teal,
                          bg: i % 2 === 0 ? K.offWhite : K.white,
                        }),
                      ],
                    });
                  }),
                ],
              }),
              sp(120),

              // ── AI Executive Summary ────────────────────────────
              ...(() => {
                const aiReport = perfResult.aiReport;
                if (!aiReport?.executiveSummary) return [];
                return [
                  h2(`${perfSectionNum}.1 Executive Summary (AI-Generated)`),
                  body(aiReport.executiveSummary, K.darkGrey),
                  sp(),
                  h2(`${perfSectionNum}.2 Business Impact Analysis`),
                  body(aiReport.businessImpactNarrative || '', K.darkGrey),
                  ...(aiReport.overallROI ? [sp(80), body(`Estimated ROI: ${aiReport.overallROI}`, K.teal)] : []),
                  sp(),
                  h2(`${perfSectionNum}.3 Developer Summary`),
                  body(aiReport.developerSummary || '', K.darkGrey),
                  sp(80),
                ];
              })(),

              // ── UX Performance ─────────────────────────────────
              ...(() => {
                const uxPerf = perfResult.uxPerformance;
                if (!uxPerf) return [];
                return [
                  h2(`${perfSectionNum}.${perfResult.aiReport ? 4 : 1} UX Performance`),
                  body(`Overall UX Score: ${uxPerf.score}/100 — Loading: ${uxPerf.initialLoadExperience?.score ?? '?'}/100 · Stability: ${uxPerf.visualStability?.score ?? '?'}/100 · Responsiveness: ${uxPerf.responsiveness?.score ?? '?'}/100 · Animation: ${uxPerf.animationPerformance?.score ?? '?'}/100`, K.darkGrey),
                  sp(),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                    borders: TABLE_BORDERS,
                    rows: [
                      new TableRow({ children: [
                        cell('UX Feature', { bold: true, bg: '006E51', color: K.white, width: 50 }),
                        cell('Status', { bold: true, bg: '006E51', color: K.white, width: 25 }),
                        cell('Detail', { bold: true, bg: '006E51', color: K.white, width: 25 }),
                      ]}),
                      new TableRow({ children: [cell('Loading Indicator', { bg: K.offWhite }), cell(uxPerf.initialLoadExperience?.hasLoadingIndicator ? 'PASS ✓' : 'FAIL ✗', { color: uxPerf.initialLoadExperience?.hasLoadingIndicator ? K.pass : K.critical, bold: true }), cell(uxPerf.initialLoadExperience?.hasLoadingIndicator ? 'Spinner / progress bar detected' : 'Not found — users see blank content', { size: 17 })] }),
                      new TableRow({ children: [cell('Skeleton Screens', {}), cell(uxPerf.initialLoadExperience?.hasSkeletonScreens ? 'PASS ✓' : 'FAIL ✗', { color: uxPerf.initialLoadExperience?.hasSkeletonScreens ? K.pass : K.critical, bold: true }), cell(uxPerf.initialLoadExperience?.hasSkeletonScreens ? 'Skeleton placeholders detected' : 'Not found — add skeleton loading', { size: 17 })] }),
                      new TableRow({ children: [cell('Scroll Jank-free', { bg: K.offWhite }), cell(uxPerf.animationPerformance?.scrollJank === false ? 'PASS ✓' : 'FAIL ✗', { color: uxPerf.animationPerformance?.scrollJank === false ? K.pass : K.critical, bold: true }), cell(uxPerf.animationPerformance?.animationFps != null ? `${uxPerf.animationPerformance.animationFps} FPS measured` : '—', { size: 17 })] }),
                    ],
                  }),
                  sp(80),
                  ...(uxPerf.painPoints?.length > 0 ? [
                    h3('UX Pain Points'),
                    ...uxPerf.painPoints.slice(0, 5).map((pp: any) => bullet(`[${(pp.severity || '').toUpperCase()}] ${pp.description} — ${pp.userImpact}`)),
                    sp(80),
                  ] : []),
                ];
              })(),

              // ── Third-Party Impact ─────────────────────────────
              ...(() => {
                const thirdParty: any[] = perfResult.thirdPartyImpact || [];
                if (thirdParty.length === 0) return [];
                return [
                  h2(`Third-Party Script Impact`),
                  body(`${thirdParty.length} third-party resource(s) detected. ${thirdParty.filter((t: any) => t.blocking).length} blocking the main thread.`, K.darkGrey),
                  sp(),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                    borders: TABLE_BORDERS,
                    rows: [
                      new TableRow({ children: [
                        cell('Script / Service', { bold: true, bg: K.navy, color: K.white, width: 30 }),
                        cell('Category', { bold: true, bg: K.navy, color: K.white, width: 20 }),
                        cell('Load Time', { bold: true, bg: K.navy, color: K.white, width: 15 }),
                        cell('Blocking', { bold: true, bg: K.navy, color: K.white, width: 15 }),
                        cell('Action', { bold: true, bg: K.navy, color: K.white, width: 20 }),
                      ]}),
                      ...thirdParty.slice(0, 15).map((t: any, i: number) => new TableRow({ children: [
                        cell(t.label || t.domain || '—', { bg: i % 2 === 0 ? K.offWhite : K.white }),
                        cell(t.category || '—', { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                        cell(t.loadTimeMs != null ? `${t.loadTimeMs}ms` : '—', { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17, color: (t.loadTimeMs ?? 0) > 500 ? K.high : K.darkGrey }),
                        cell(t.blocking ? 'Yes ⚠' : 'No', { bg: i % 2 === 0 ? K.offWhite : K.white, bold: t.blocking, color: t.blocking ? K.critical : K.pass }),
                        cell((t.recommendation || '—').toUpperCase(), { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                      ]})),
                    ],
                  }),
                  sp(80),
                ];
              })(),

              // ── Technical Architecture ─────────────────────────
              ...(() => {
                const arch = perfResult.architecture;
                if (!arch) return [];
                return [
                  h2('Technical Architecture'),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                    borders: TABLE_BORDERS,
                    rows: [
                      new TableRow({ children: [
                        cell('Component', { bold: true, bg: K.navy, color: K.white, width: 25 }),
                        cell('Detected', { bold: true, bg: K.navy, color: K.white, width: 30 }),
                        cell('Performance Impact', { bold: true, bg: K.navy, color: K.white, width: 45 }),
                      ]}),
                      ...[
                        ['Framework', arch.framework ?? 'Not detected', arch.framework ? 'Modern framework — good' : 'Unable to detect'],
                        ['CMS', arch.cms ?? 'Not detected', arch.cms ? 'CMS detected — audit plugin overhead' : '—'],
                        ['CDN', arch.cdn ?? 'No CDN ⚠', arch.cdn ? 'CDN active — reduced global latency' : 'No CDN — deploy static assets to CDN'],
                        ['HTTP Version', arch.httpVersion ?? 'Unknown', arch.httpVersion === 'HTTP/2' || arch.httpVersion === 'HTTP/3' ? 'Multiplexing enabled' : 'Upgrade to HTTP/2'],
                        ['Hosting', arch.hostingPlatform ?? 'Unknown', '—'],
                        ['Service Worker', arch.hasServiceWorker ? 'Active ✓' : 'Not found', arch.hasServiceWorker ? 'Offline caching enabled' : 'Implement for PWA/offline'],
                        ['Resource Hints', arch.hasResourceHints ? 'Present ✓' : 'Not found', arch.hasResourceHints ? 'Preload/prefetch active' : 'Add preload for critical assets'],
                      ].map(([comp, val, impact], i) => new TableRow({ children: [
                        cell(comp, { bg: i % 2 === 0 ? K.offWhite : K.white, bold: true, size: 17 }),
                        cell(val, { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                        cell(impact, { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                      ]})),
                    ],
                  }),
                  ...(arch.jsLibraries?.length > 0 ? [sp(80), body(`JS Libraries: ${arch.jsLibraries.join(', ')}`, K.darkGrey)] : []),
                  sp(80),
                ];
              })(),

              // ── Technical SEO ──────────────────────────────────
              ...(() => {
                const seo = perfResult.seoReadiness;
                if (!seo) return [];
                return [
                  h2('Technical SEO Readiness'),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                    borders: TABLE_BORDERS,
                    rows: [
                      new TableRow({ children: [
                        cell('SEO Check', { bold: true, bg: '006E51', color: K.white, width: 35 }),
                        cell('Status', { bold: true, bg: '006E51', color: K.white, width: 15 }),
                        cell('Detail / Recommendation', { bold: true, bg: '006E51', color: K.white, width: 50 }),
                      ]}),
                      ...[
                        ['Meta Title', seo.hasMetaTitle, seo.metaTitleLength ? `${seo.metaTitleLength} chars. Keep 50–60 chars.` : 'Add a unique title tag per page.'],
                        ['Meta Description', seo.hasMetaDescription, seo.metaDescriptionLength ? `${seo.metaDescriptionLength} chars. Target 120–160.` : 'Add meta description for search snippet.'],
                        ['Canonical URL', seo.hasCanonical, seo.hasCanonical ? 'Canonical link tag present.' : 'Add <link rel="canonical"> to prevent duplicate content.'],
                        ['Structured Data', seo.hasStructuredData, seo.hasStructuredData ? 'JSON-LD detected.' : 'Add schema.org structured data for rich search results.'],
                        ['Open Graph', seo.hasOpenGraph, seo.hasOpenGraph ? 'OG tags present.' : 'Add og:title, og:description, og:image for social sharing.'],
                        ['robots.txt', seo.hasRobotsTxt === true, seo.hasRobotsTxt ? '/robots.txt accessible.' : 'Create /robots.txt to guide search engine crawlers.'],
                        ['XML Sitemap', seo.hasSitemap === true, seo.hasSitemap ? '/sitemap.xml accessible.' : 'Create XML sitemap and submit to Google Search Console.'],
                      ].map(([label, pass, detail], i) => new TableRow({ children: [
                        cell(label as string, { bg: i % 2 === 0 ? K.offWhite : K.white, bold: true, size: 17 }),
                        cell(pass ? 'PASS ✓' : 'FAIL ✗', { color: pass ? K.pass : K.critical, bold: true }),
                        cell(detail as string, { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                      ]})),
                      ...(seo.brokenLinks.length > 0 ? [new TableRow({ children: [
                        cell('Broken Links', { bg: K.criticalBg, bold: true }),
                        cell(`${seo.brokenLinks.length} broken`, { color: K.critical, bold: true }),
                        cell(seo.brokenLinks.slice(0, 3).join(' | '), { size: 16 }),
                      ]})] : []),
                    ],
                  }),
                  sp(80),
                ];
              })(),

              // ── Enriched Recommendations ───────────────────────
              sp(120),
              ...(perfResult.recommendations?.length > 0
                ? [
                    h2(`Performance Recommendations`),
                    new Table({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      layout: TableLayoutType.FIXED,
                      borders: TABLE_BORDERS,
                      rows: [
                        new TableRow({ children: [
                          cell('P', { bold: true, bg: '006E51', color: K.white, width: 5, align: AlignmentType.CENTER }),
                          cell('Title', { bold: true, bg: '006E51', color: K.white, width: 25 }),
                          cell('Description', { bold: true, bg: '006E51', color: K.white, width: 30 }),
                          cell('Business Impact', { bold: true, bg: '006E51', color: K.white, width: 25 }),
                          cell('Effort', { bold: true, bg: '006E51', color: K.white, width: 15 }),
                        ]}),
                        ...(perfResult.recommendations as import('../types/performance').RecommendationItem[]).slice(0, 15).map((r, i) =>
                          new TableRow({ children: [
                            cell(r.priority, { align: AlignmentType.CENTER, bold: true, bg: r.priority === 'P0' ? K.critical : r.priority === 'P1' ? K.high : r.priority === 'P2' ? K.medium : K.lightBlue, color: K.white }),
                            cell(r.title, { bg: i % 2 === 0 ? K.offWhite : K.white, bold: true, size: 17 }),
                            cell(r.businessImpact || r.detail, { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                            cell(r.businessImpact || '—', { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                            cell(r.effort, { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                          ]}),
                        ),
                      ],
                    }),
                  ]
                : []),

              // ── AI-Enriched Recommendations (if AI report exists) ─
              ...(() => {
                const aiRecs: any[] = perfResult.aiReport?.recommendations || [];
                if (aiRecs.length === 0) return [];
                return [
                  sp(120),
                  h2('AI-Enriched Recommendations (All 9 Fields)'),
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    layout: TableLayoutType.FIXED,
                    borders: TABLE_BORDERS,
                    rows: [
                      new TableRow({ children: [
                        cell('P', { bold: true, bg: K.navy, color: K.white, width: 5, align: AlignmentType.CENTER }),
                        cell('Title', { bold: true, bg: K.navy, color: K.white, width: 22 }),
                        cell('Root Cause', { bold: true, bg: K.navy, color: K.white, width: 20 }),
                        cell('Business Impact', { bold: true, bg: K.navy, color: K.white, width: 23 }),
                        cell('Expected Improvement', { bold: true, bg: K.navy, color: K.white, width: 15 }),
                        cell('ROI', { bold: true, bg: K.navy, color: K.white, width: 15 }),
                      ]}),
                      ...aiRecs.slice(0, 10).map((r: any, i: number) => new TableRow({ children: [
                        cell(r.priority, { align: AlignmentType.CENTER, bold: true, bg: r.priority === 'P0' ? K.critical : r.priority === 'P1' ? K.high : r.priority === 'P2' ? K.medium : K.lightBlue, color: K.white }),
                        cell(r.title || '—', { bg: i % 2 === 0 ? K.offWhite : K.white, bold: true, size: 17 }),
                        cell(r.rootCause || '—', { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                        cell(r.businessImpact || '—', { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                        cell(r.expectedImprovement || '—', { bg: i % 2 === 0 ? K.offWhite : K.white, size: 17 }),
                        cell(r.estimatedROI || '—', { bg: i % 2 === 0 ? K.offWhite : K.white, size: 16 }),
                      ]})),
                    ],
                  }),
                ];
              })(),

              // ── Developer Action Plan (AI Tickets) ────────────
              ...(() => {
                const tickets: any[] = perfResult.aiReport?.devTickets || [];
                if (tickets.length === 0) return [];
                return [
                  sp(120),
                  h2('Developer Action Plan — Jira / Azure DevOps Tickets'),
                  ...tickets.map((t: any, i: number) => [
                    h3(`[${t.priority}] ${t.title} (${t.storyPoints} pts)`),
                    body(t.description || '', K.darkGrey),
                    ...(t.acceptanceCriteria?.length > 0 ? [
                      body('Acceptance Criteria:', K.navy),
                      ...t.acceptanceCriteria.map((ac: string) => bullet(ac)),
                    ] : []),
                    ...(t.labels?.length > 0 ? [body(`Labels: ${t.labels.join(', ')}`, K.midGrey)] : []),
                    ...(i < tickets.length - 1 ? [sp(80)] : []),
                  ]).flat(),
                ];
              })(),
            ];
          })(),

          // ─────────────────────────────────────────────────────
          // SECTION 9: PRIVACY FINDINGS (if Privacy pillar)
          // ─────────────────────────────────────────────────────
          ...(() => {
            if (!isPriv) return [];
            const privResult = (audit as any).pillarResults?.privacy;
            if (!privResult) return [];
            const privFindings: any[] = privResult.findings || [];
            const orange = "B45309";
            const orangeBg = "FFF7ED";

            return [
              h1(`${privSectionNum}. Privacy & Compliance Findings`),
              body(
                `${privFindings.length} privacy finding(s) detected. Overall privacy score: ${privResult.overallScore ?? "—"}/100. Trackers detected: ${privResult.totalTrackers ?? 0}. Consent banner: ${privResult.hasConsentBanner ? "Present" : "Missing"}.`,
                K.darkGrey,
              ),
              sp(),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                layout: TableLayoutType.FIXED,
                borders: TABLE_BORDERS,
                rows: [
                  new TableRow({
                    children: [
                      cell("#", {
                        bold: true,
                        bg: orange,
                        color: K.white,
                        width: 6,
                        align: AlignmentType.CENTER,
                      }),
                      cell("Finding", {
                        bold: true,
                        bg: orange,
                        color: K.white,
                        width: 28,
                      }),
                      cell("Category", {
                        bold: true,
                        bg: orange,
                        color: K.white,
                        width: 18,
                      }),
                      cell("Regulation", {
                        bold: true,
                        bg: orange,
                        color: K.white,
                        width: 18,
                      }),
                      cell("Severity", {
                        bold: true,
                        bg: orange,
                        color: K.white,
                        width: 12,
                        align: AlignmentType.CENTER,
                      }),
                      cell("Page", {
                        bold: true,
                        bg: orange,
                        color: K.white,
                        width: 18,
                      }),
                    ],
                  }),
                  ...privFindings.map(
                    (f: any, idx: number) =>
                      new TableRow({
                        children: [
                          cell(`#${String(idx + 1).padStart(3, "0")}`, {
                            align: AlignmentType.CENTER,
                            bold: true,
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                          cell(f.title || "—", {
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                          cell(f.category || "—", {
                            bg: idx % 2 === 0 ? K.offWhite : K.white,
                            size: 17,
                          }),
                          cell(
                            Array.isArray(f.regulation)
                              ? f.regulation.slice(0, 2).join(", ")
                              : f.regulation || "—",
                            {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 17,
                              color: K.lightBlue,
                            },
                          ),
                          cell(String(f.severity || "—").toUpperCase(), {
                            align: AlignmentType.CENTER,
                            bold: true,
                            color: sevColor(f.severity),
                            bg: sevBg(f.severity),
                            size: 17,
                          }),
                          cell(
                            (f.pageUrl || "").replace(
                              /^https?:\/\/[^/]+/,
                              "",
                            ) || "/",
                            {
                              bg: idx % 2 === 0 ? K.offWhite : K.white,
                              size: 16,
                            },
                          ),
                        ],
                      }),
                  ),
                ],
              }),
              ...(privFindings.length > 0
                ? [
                    sp(120),
                    h2(`${privSectionNum}.1 Privacy Finding Details`),
                    ...privFindings
                      .slice(0, 20)
                      .flatMap((f: any, idx: number) => [
                        divider(),
                        new Paragraph({
                          heading: HeadingLevel.HEADING_3,
                          spacing: { before: 200, after: 80 },
                          shading: {
                            type: ShadingType.SOLID,
                            color: orangeBg,
                            fill: orangeBg,
                          },
                          border: {
                            left: {
                              style: BorderStyle.THICK,
                              size: 6,
                              color: orange,
                            },
                          },
                          children: [
                            new TextRun({
                              text: `  #${String(idx + 1).padStart(3, "0")} — ${f.title}`,
                              font: "Calibri",
                              bold: true,
                              size: 22,
                              color: orange,
                            }),
                          ],
                        }),
                        new Paragraph({
                          spacing: { after: 100 },
                          children: [
                            new TextRun({
                              text: "Severity: ",
                              bold: true,
                              font: "Calibri",
                              size: 20,
                              color: K.navy,
                            }),
                            new TextRun({
                              text: String(f.severity || "").toUpperCase(),
                              bold: true,
                              font: "Calibri",
                              size: 20,
                              color: sevColor(f.severity),
                            }),
                            new TextRun({
                              text: "   |   Regulation: ",
                              bold: true,
                              font: "Calibri",
                              size: 20,
                              color: K.navy,
                            }),
                            new TextRun({
                              text: Array.isArray(f.regulation)
                                ? f.regulation.join(", ")
                                : f.regulation || "—",
                              font: "Calibri",
                              size: 20,
                              color: K.lightBlue,
                            }),
                          ],
                        }),
                        new Paragraph({
                          spacing: { after: 50 },
                          children: [
                            new TextRun({
                              text: "Description",
                              bold: true,
                              font: "Calibri",
                              size: 21,
                              color: K.nearBlack,
                            }),
                          ],
                        }),
                        body(f.description || "—"),
                        new Paragraph({
                          spacing: { after: 50 },
                          children: [
                            new TextRun({
                              text: "Recommendation",
                              bold: true,
                              font: "Calibri",
                              size: 21,
                              color: "047856",
                            }),
                          ],
                        }),
                        body(f.recommendation || "—", "047856"),
                      ]),
                  ]
                : []),
              ...(privResult.trackers?.length > 0
                ? [
                    sp(120),
                    h2("9.2 Trackers Detected"),
                    new Table({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      layout: TableLayoutType.FIXED,
                      borders: TABLE_BORDERS,
                      rows: [
                        new TableRow({
                          children: [
                            cell("Tracker Domain", {
                              bold: true,
                              bg: K.navy,
                              color: K.white,
                              width: 30,
                            }),
                            cell("Company", {
                              bold: true,
                              bg: K.navy,
                              color: K.white,
                              width: 25,
                            }),
                            cell("Category", {
                              bold: true,
                              bg: K.navy,
                              color: K.white,
                              width: 25,
                            }),
                            cell("Requests", {
                              bold: true,
                              bg: K.navy,
                              color: K.white,
                              width: 20,
                              align: AlignmentType.CENTER,
                            }),
                          ],
                        }),
                        ...(privResult.trackers as any[]).slice(0, 20).map(
                          (t: any, i: number) =>
                            new TableRow({
                              children: [
                                cell(t.domain || "—", {
                                  bg: i % 2 === 0 ? K.offWhite : K.white,
                                  size: 17,
                                }),
                                cell(t.company || "—", {
                                  bg: i % 2 === 0 ? K.offWhite : K.white,
                                  size: 17,
                                }),
                                cell(t.category || "—", {
                                  bg: i % 2 === 0 ? K.offWhite : K.white,
                                  size: 17,
                                }),
                                cell(String(t.requestCount || 0), {
                                  align: AlignmentType.CENTER,
                                  bg: i % 2 === 0 ? K.offWhite : K.white,
                                  size: 17,
                                }),
                              ],
                            }),
                        ),
                      ],
                    }),
                  ]
                : []),
            ];
          })(),

          sp(200),
          divider(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: `KPMG ${reportTitle} — Confidential`,
                font: "Calibri",
                size: 18,
                color: K.midGrey,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
