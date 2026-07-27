
  // ══════════════════════════════════════════════
  // COVER PAGE (standalone — runs before the first addPage)
  // ══════════════════════════════════════════════
  doc.setFillColor(...K.navy);
  doc.rect(0, 0, pw, ph, "F");
  // Teal accent strip
  doc.setFillColor(...K.teal);
  doc.rect(0, 0, pw, 6, "F");
  // Left accent bar
  // doc.setFillColor(...K.lightBlue);
  // doc.rect(0, 40, 4, 180, "F");

  // KPMG logo (white) injected into the cover header coordinate space
  try {
    // doc.addImage(
    //   kpmgLogoDataUri("#ffffff", "#00338D", 90, 35),
    //   "SVG",
    //   pw - 20 - 38,
    //   9,
    //   38,
    //   (38 * 35) / 90,
    //   undefined,
    //   "NONE",
    // );
  } catch {
    /* decorative */
  }

  // KPMG wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(44);
  doc.setTextColor(...K.white);
  doc.text("KPMG", 20, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(24);
  doc.setTextColor(...K.lightBlue);
  doc.text(reportTitle, 20, 85);

  doc.setFontSize(16);
  doc.setTextColor(...K.teal);
  doc.text("Final Delivery Report", 20, 96);

  // Decorative line
  doc.setDrawColor(...K.lightBlue);
  doc.setLineWidth(0.8);
  doc.line(20, 103, 80, 103);

  // Project name
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...K.midGrey);
  doc.text(projectName, 20, 115);

  // ── Derive DP-specific metrics for cover ──────────────────
  const dpResultsCover = (audit as any).pillarResults?.darkpatterns;
  const dpEthicsScore = dpResultsCover?.ethicsScore as number | undefined;
  const dpManipIdx = dpResultsCover?.manipulationIndex as number | undefined;
  const dpFindCount = ((dpResultsCover?.findings ?? []) as DarkPatternFinding[])
    .length;
  const dpConsent = dpResultsCover?.consentIntegrity as number | undefined;

  // Cover metadata table — pillar-aware
  const coverData =
    perfOnly && perfResultCover
      ? [
          ["Audit Date", auditDate],
          [
            "Pages Audited",
            String(perfResultCover.pages?.length ?? audit.pages.length),
          ],
          ["Performance Score", `${perfResultCover.overallScore ?? "—"} / 100`],
          [
            "Performance Grade",
            perfResultCover.overallScore != null
              ? perfGradeStr(perfResultCover.overallScore)
              : "—",
          ],
          ["Resource Issues", String(perfResultCover.totalResourceIssues ?? 0)],
          [
            "P0 Critical",
            String(
              (perfResultCover.recommendations || []).filter(
                (r: any) => r.priority === "P0",
              ).length,
            ),
          ],
          ["Classification", "KPMG Internal — Confidential"],
        ]
      : isDP && !isA11y
        ? [
            ["Audit Date", auditDate],
            ["Pages Audited", String(audit.pages.length)],
            ["Ethics Score", `${dpEthicsScore ?? "—"} / 100`],
            ["Patterns Found", String(dpFindCount)],
            [
              "Manipulation Idx",
              dpManipIdx != null ? `${dpManipIdx} / 100` : "—",
            ],
            ["Consent Score", dpConsent != null ? `${dpConsent} / 100` : "—"],
            ["Classification", "KPMG Internal — Confidential"],
          ]
        : [
            ["Standard", `${standard} Level ${testedLevel}`],
            ["Audit Date", auditDate],
            ["Pages Audited", String(audit.pages.length)],
            ["Score", `${score.overall} / 100`],
            ["Compliance", compLabel(score.complianceLevel)],
            ["Total Issues", String(score.totalIssues)],
            ["Classification", "KPMG Internal — Confidential"],
          ];

  autoTable(doc, {
    startY: 130,
    head: [],
    body: coverData,
    theme: "grid",
    margin: { left: 20, right: pw / 2 + 10 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: K.midGrey,
      lineColor: [0, 51, 100],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: K.lightBlue, cellWidth: 35 },
    },
    alternateRowStyles: { fillColor: [10, 25, 50] },
    bodyStyles: { fillColor: [5, 15, 40] },
  });

  // Score circle — pillar-aware
  const coverScore =
    perfOnly && perfResultCover?.overallScore != null
      ? perfResultCover.overallScore
      : isDP && !isA11y && dpEthicsScore != null
        ? dpEthicsScore
        : score.overall;
  const coverScoreLabel = perfOnly
    ? "PERF"
    : isDP && !isA11y
      ? "ETHICS"
      : "SCORE";
  doc.setDrawColor(...K.lightBlue);
  doc.setLineWidth(2);
  doc.circle(pw - 50, 90, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  const scoreColor =
    coverScore >= 75 ? K.teal : coverScore >= 50 ? K.medium : K.critical;
  doc.setTextColor(...scoreColor);
  doc.text(String(coverScore), pw - 50, 94, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...K.midGrey);
  doc.text(coverScoreLabel, pw - 50, 104, { align: "center" });

  // Bottom strip
  doc.setFillColor(...K.teal);
  doc.rect(0, ph - 6, pw, 6, "F");

  // TOC entry collector — page numbers resolved as sections are rendered.
  const tocEntries: { num: string; title: string; page: number }[] = [];



--------------------------------------------------------------------------

// ══════════════════════════════════════════════
// SECTION 3: ISSUE REGISTER (DETAILED)
// ══════════════════════════════════════════════
doc.addPage();
y = 18;
y = startSection(doc, tocEntries, "3", "Issue Register — Detailed Analysis", y);

issues.forEach((issue, idx) => {
  const issueId = `#${String(idx + 1).padStart(3, "0")}`;
  const team = deriveTeam(issue);
  const effort = deriveEffort(issue);

  if (y > ph - 80) {
    doc.addPage();
    y = 18;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...K.navy);
  const label = isA11y ? "WCAG Criterion:" : "Rule:";
  doc.text(label, 20, y);
  doc.setTextColor(...K.lightBlue);
  const ruleText = isA11y
    ? `${issue.wcagCriterion} — ${issue.wcagName} (${issue.wcagLevel})`
    : `${(issue as any).ruleId || issue.wcagCriterion || "—"}`;
  doc.text(ruleText, 22 + doc.getTextWidth(label), y);
  y += 10;

  // Issue header bar
  doc.setFillColor(...sevBg(issue.severity));
  doc.roundedRect(20, y - 3, pw - 40, 13, 2, 2, "F");
  doc.setDrawColor(...sevColor(issue.severity));
  doc.setLineWidth(0.4);
  doc.line(20, y - 3, 20, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...sevColor(issue.severity));
  doc.text(`${issueId} ${issue.title}`, 24, y + 5);
  y += 16;
  y += 10;

  // Meta line 1: WCAG/Rule
  // doc.setFontSize(8);
  // doc.setFont("helvetica", "bold");
  // doc.setTextColor(...K.navy);
  // doc.text(isA11y ? "WCAG Criterion:" : "Rule:", 24, y);

  // Meta line 2: Severity, Team, Effort, Page
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  // --- Item 1: Severity ---
  doc.setTextColor(...K.navy);
  doc.text("Severity: ", 24, y);
  const severityText = issue.severity.toUpperCase();
  doc.setTextColor(...sevColor(issue.severity));
  doc.text(severityText, 44, y);
  let currentX = 44 + doc.getTextWidth(severityText) + 6;

  // --- Separator ---
  doc.setTextColor(...K.midGrey);
  doc.text("|", currentX, y);
  currentX += 4;

  // --- Item 2: Team Owner ---
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...K.nearBlack);
  doc.text("Team Owner: ", currentX, y);
  currentX += doc.getTextWidth("Team Owner: ");
  doc.setTextColor(...K.nearBlack);
  doc.text(team, currentX, y);
  currentX += doc.getTextWidth(team) + 6;

  // --- Separator ---
  doc.setTextColor(...K.midGrey);
  doc.text("|", currentX, y);
  currentX += 4;

  // --- Item 3: Effort ---
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...K.nearBlack);
  doc.text("Effort: ", currentX, y);
  currentX += doc.getTextWidth("Effort: ");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...K.nearBlack);
  doc.text(effort, currentX, y);
  y += 8;

  // Description
  if (y > ph - 40) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...K.nearBlack);
  doc.text("Description", 24, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...K.darkGrey);
  const descLines = doc.splitTextToSize(issue.description, pw - 48);
  doc.text(descLines, 24, y);
  y += descLines.length * 3.5 + 3;

  // Current vs Expected
  if (y > ph - 40) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...K.nearBlack);
  doc.text("Current Behaviour", 24, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const currLines = doc.splitTextToSize(
    issue.description.substring(0, 150),
    pw - 48,
  );
  doc.text(currLines, 24, y);
  y += currLines.length * 3.5 + 3;

  // Recommendations

  const rawRecommendation = issue.recommendation
    ? String(issue.recommendation).trim()
    : "";
  const recLines = rawRecommendation
    ? doc.splitTextToSize(rawRecommendation, pw - 48)
    : [];
  if (recLines.length > 0) {
    // Define layout block metrics matching your full-width setup
    const leftMargin = 20;
    const rightMargin = 20;
    const blockWidth = pw - leftMargin - rightMargin;
    const blockHeight = 6;
    const blockY = y - 4.5; // Centers the heading text vertically

    // Draw full-width colored header block strip
    doc.setFillColor(...K.navy);
    doc.rect(leftMargin, blockY, blockWidth, blockHeight, "F");

    // Overlay Header Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...K.white);
    doc.text("Recommendation", 24, y);

    // Advance coordinate space down from header block to text body baseline
    y += 7;

    // Output Description Lines Paragraph
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...K.nearBlack);
    doc.text(recLines, 24, y);

    // Advance vertical tracker past paragraph content with a trailing spacer
    y += recLines.length * 3.5 + 4;
  }
  // Code fix (before → after)
  if (issue.codeFix) {
    if (y > ph - 40) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...K.nearBlack);
    doc.text("Code Fix", 24, y);
    y += 4;
    const codeLines = doc.splitTextToSize(issue.codeFix, pw - 52);
    const codeH = codeLines.length * 3.5 + 5;
    doc.setFillColor(...K.offWhite);
    doc.setDrawColor(...K.navy);
    doc.setLineWidth(0.5);
    // doc.roundedRect(24, y - 1, pw - 48, codeH, 2, 2, "FD");
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...K.nearBlack);
    doc.text(codeLines, 28, y + 3);
    y += codeH + 3;
  }

  // Separator
  y += 3;
  doc.setDrawColor(...K.lightGrey);
  doc.setLineWidth(0.2);
  doc.line(20, y, pw - 20, y);
  y += 8;

  // ── Management Response (injected inline per issue) ──
  y = drawManagementResponse(
    doc,
    y,
    issue,
    pw,
    ph,
    `${issueId} ${issue.title}`,
  );
});

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AuditResult, AccessibilityIssue } from "../types/audit";
import type { DarkPatternFinding } from "../types/darkpattern";
import type { RecommendationItem } from "../types/performance";

// ── KPMG Brand Palette (RGB) ──────────────────────────────────
const K = {
  navy: [0, 51, 141] as [number, number, number],
  blue: [0, 94, 184] as [number, number, number],
  lightBlue: [0, 145, 218] as [number, number, number],
  teal: [0, 178, 169] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  offWhite: [245, 247, 250] as [number, number, number],
  lightGrey: [238, 242, 247] as [number, number, number],
  midGrey: [139, 163, 199] as [number, number, number],
  darkGrey: [74, 85, 104] as [number, number, number],
  nearBlack: [26, 38, 56] as [number, number, number],
  critical: [232, 0, 45] as [number, number, number],
  criticalBg: [255, 240, 243] as [number, number, number],
  high: [255, 107, 0] as [number, number, number],
  highBg: [255, 243, 232] as [number, number, number],
  medium: [240, 171, 0] as [number, number, number],
  mediumBg: [255, 251, 232] as [number, number, number],
  low: [0, 145, 218] as [number, number, number],
  lowBg: [232, 246, 255] as [number, number, number],
  pass: [0, 186, 140] as [number, number, number],
  passBg: [232, 250, 249] as [number, number, number],
};

function sevColor(s: string): [number, number, number] {
  return (
    (
      {
        critical: K.critical,
        high: K.high,
        medium: K.medium,
        low: K.low,
      } as Record<string, [number, number, number]>
    )[s] || K.darkGrey
  );
}
function sevBg(s: string): [number, number, number] {
  return (
    (
      {
        critical: K.criticalBg,
        high: K.highBg,
        medium: K.mediumBg,
        low: K.lowBg,
      } as Record<string, [number, number, number]>
    )[s] || K.lightGrey
  );
}
function compLabel(l: string): string {
  return (
    (
      {
        "non-compliant": "Non-Compliant",
        "partially-compliant": "Partially Compliant",
        "aa-compliant": "WCAG AA Compliant",
        "aaa-compliant": "WCAG AAA Compliant",
      } as Record<string, string>
    )[l] || l
  );
}
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
    (
      {
        critical: "1 Sprint",
        high: "Half-day",
        medium: "1 hour",
        low: "Quick Win",
      } as Record<string, string>
    )[issue.severity] || "1 hour"
  );
}

function addKpmgHeader(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(...K.navy);
  doc.rect(0, 0, pageWidth, 5, "F");
  doc.setFillColor(...K.teal);
  doc.rect(0, 5, pageWidth, 1.5, "F");
}

function addKpmgFooter(
  doc: jsPDF,
  label = "Digital Trust Audit — Confidential",
) {
  const pageCount = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Top accent
    doc.setFillColor(...K.navy);
    doc.rect(0, 0, pw, 5, "F");
    doc.setFillColor(...K.teal);
    doc.rect(0, 5, pw, 1.5, "F");
    // Footer line
    doc.setDrawColor(...K.lightGrey);
    doc.setLineWidth(0.3);
    doc.line(20, ph - 16, pw - 20, ph - 16);
    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(...K.midGrey);
    doc.text(label, 20, ph - 11);
    doc.text(`Page ${i} of ${pageCount}`, pw - 20, ph - 11, { align: "right" });
  }
}

function sectionHeading(
  doc: jsPDF,
  num: string,
  title: string,
  y: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...K.navy);
  doc.text(`${num}. ${title}`, 20, y);
  y += 3;
  doc.setDrawColor(...K.lightBlue);
  doc.setLineWidth(0.6);
  doc.line(20, y, 90, y);
  return y + 10;
}

// ── Main Export ───────────────────────────────────────────────
export async function generatePdf(audit: AuditResult): Promise<Buffer> {
  const report = audit.report!;
  const score = audit.score;
  const issues = audit.issues;
  const config = audit.config;
  const testedLevel = report.testedLevel || "AA";
  const standard = config.standard || "WCAG 2.2";
  const auditDate = new Date(audit.startedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const projectName = config.url || "PDF Document";
  const pw = 210; // A4
  const ph = 297;

  // ── Dynamic pillar-aware report title ──────────────────────
  const pillars = (config as any).enabledPillars as string[] | undefined;
  const reportTitle =
    !pillars || pillars.length === 0
      ? "Accessibility Audit"
      : pillars.length === 1
        ? (
            {
              accessibility: "Accessibility Audit",
              darkpatterns: "Dark Pattern Audit",
              performance: "Performance Audit",
              privacy: "Privacy Compliance Audit",
            } as Record<string, string>
          )[pillars[0]] || "Digital Trust Audit"
        : pillars.length === 4
          ? "TrustLens 4-Pillar Audit"
          : "TrustLens Multi-Pillar Audit";
  const footerLabel = `KPMG ${reportTitle} — Confidential`;
  const isA11y =
    !pillars || pillars.length === 0 || pillars.includes("accessibility");
  const isDP = pillars?.includes("darkpatterns") ?? false;
  const isPerf = pillars?.includes("performance") ?? false;
  const isPriv2 = pillars?.includes("privacy") ?? false;
  const perfOnly = isPerf && !isA11y && !isDP && !isPriv2;
  const perfResultCover = (audit as any).pillarResults?.performance as any;
  const perfGradeStr = (s: number) =>
    s >= 90
      ? "A — Excellent"
      : s >= 75
        ? "B — Good"
        : s >= 50
          ? "C — Needs Improvement"
          : s >= 25
            ? "D — Poor"
            : "F — Critical";
  const col3H = isA11y
    ? "WCAG SC"
    : isDP
      ? "Pattern ID"
      : isPerf
        ? "Metric"
        : "Regulation";
  const col4H = isA11y
    ? "Level"
    : isDP
      ? "Regulation"
      : isPerf
        ? "Target"
        : "Article";
  const col3V = (iss: AccessibilityIssue) =>
    isA11y ? iss.wcagCriterion : (iss as any).ruleId || "—";
  const col4V = (iss: AccessibilityIssue) =>
    isA11y ? iss.wcagLevel : (iss as any).regulation?.[0] || "—";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ══════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════
  doc.setFillColor(...K.navy);
  doc.rect(0, 0, pw, ph, "F");
  // Teal accent strip
  doc.setFillColor(...K.teal);
  doc.rect(0, 0, pw, 6, "F");
  // Left accent bar
  doc.setFillColor(...K.lightBlue);
  doc.rect(0, 40, 4, 180, "F");

  // KPMG wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(44);
  doc.setTextColor(...K.white);
  doc.text("KPMG", 20, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(24);
  doc.setTextColor(...K.lightBlue);
  doc.text(reportTitle, 20, 85);

  doc.setFontSize(16);
  doc.setTextColor(...K.teal);
  doc.text("Final Delivery Report", 20, 96);

  // Decorative line
  doc.setDrawColor(...K.lightBlue);
  doc.setLineWidth(0.8);
  doc.line(20, 103, 80, 103);

  // Project name
  doc.setFont("helvetica", "italic");
  doc.setFontSize(12);
  doc.setTextColor(...K.midGrey);
  doc.text(projectName, 20, 115);

  // ── Derive DP-specific metrics for cover ──────────────────
  const dpResultsCover = (audit as any).pillarResults?.darkpatterns;
  const dpEthicsScore = dpResultsCover?.ethicsScore as number | undefined;
  const dpManipIdx = dpResultsCover?.manipulationIndex as number | undefined;
  const dpFindCount = ((dpResultsCover?.findings ?? []) as DarkPatternFinding[])
    .length;
  const dpConsent = dpResultsCover?.consentIntegrity as number | undefined;

  // Cover metadata table — pillar-aware
  const coverData =
    perfOnly && perfResultCover
      ? [
          ["Audit Date", auditDate],
          [
            "Pages Audited",
            String(perfResultCover.pages?.length ?? audit.pages.length),
          ],
          ["Performance Score", `${perfResultCover.overallScore ?? "—"} / 100`],
          [
            "Performance Grade",
            perfResultCover.overallScore != null
              ? perfGradeStr(perfResultCover.overallScore)
              : "—",
          ],
          ["Resource Issues", String(perfResultCover.totalResourceIssues ?? 0)],
          [
            "P0 Critical",
            String(
              (perfResultCover.recommendations || []).filter(
                (r: any) => r.priority === "P0",
              ).length,
            ),
          ],
          ["Classification", "KPMG Internal — Confidential"],
        ]
      : isDP && !isA11y
        ? [
            ["Audit Date", auditDate],
            ["Pages Audited", String(audit.pages.length)],
            ["Ethics Score", `${dpEthicsScore ?? "—"} / 100`],
            ["Patterns Found", String(dpFindCount)],
            [
              "Manipulation Idx",
              dpManipIdx != null ? `${dpManipIdx} / 100` : "—",
            ],
            ["Consent Score", dpConsent != null ? `${dpConsent} / 100` : "—"],
            ["Classification", "KPMG Internal — Confidential"],
          ]
        : [
            ["Standard", `${standard} Level ${testedLevel}`],
            ["Audit Date", auditDate],
            ["Pages Audited", String(audit.pages.length)],
            ["Score", `${score.overall} / 100`],
            ["Compliance", compLabel(score.complianceLevel)],
            ["Total Issues", String(score.totalIssues)],
            ["Classification", "KPMG Internal — Confidential"],
          ];

  autoTable(doc, {
    startY: 130,
    head: [],
    body: coverData,
    theme: "grid",
    margin: { left: 20, right: pw / 2 + 10 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: K.midGrey,
      lineColor: [0, 51, 100],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", textColor: K.lightBlue, cellWidth: 35 },
    },
    alternateRowStyles: { fillColor: [10, 25, 50] },
    bodyStyles: { fillColor: [5, 15, 40] },
  });

  // Score circle — pillar-aware
  const coverScore =
    perfOnly && perfResultCover?.overallScore != null
      ? perfResultCover.overallScore
      : isDP && !isA11y && dpEthicsScore != null
        ? dpEthicsScore
        : score.overall;
  const coverScoreLabel = perfOnly
    ? "PERF"
    : isDP && !isA11y
      ? "ETHICS"
      : "SCORE";
  doc.setDrawColor(...K.lightBlue);
  doc.setLineWidth(2);
  doc.circle(pw - 50, 90, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  const scoreColor =
    coverScore >= 75 ? K.teal : coverScore >= 50 ? K.medium : K.critical;
  doc.setTextColor(...scoreColor);
  doc.text(String(coverScore), pw - 50, 94, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...K.midGrey);
  doc.text(coverScoreLabel, pw - 50, 104, { align: "center" });

  // Bottom strip
  doc.setFillColor(...K.teal);
  doc.rect(0, ph - 6, pw, 6, "F");

  // ══════════════════════════════════════════════
  // SECTION 1: EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════
  doc.addPage();
  let y = 18;
  y = sectionHeading(doc, "1", "Executive Summary", y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...K.darkGrey);
  // Build summary paragraphs — keep ASCII-safe (jsPDF Helvetica doesn't support Unicode em-dashes, arrows, emoji)
  const safeText = (s: string) =>
    s
      .replace(/—/g, "-")
      .replace(/–/g, "-")
      .replace(/[^\x00-\x7F]/g, "");
  let summaryParas: string[] = [];
  if (report.executiveSummary) {
    summaryParas = report.executiveSummary
      .split(/\n\n+/)
      .map((p: string) => safeText(p.trim()))
      .filter(Boolean);
  } else if (perfOnly && perfResultCover) {
    const avg = perfResultCover.averageVitals || {};
    const p0c = (perfResultCover.recommendations || []).filter(
      (r: any) => r.priority === "P0",
    ).length;
    const p1c = (perfResultCover.recommendations || []).filter(
      (r: any) => r.priority === "P1",
    ).length;
    const pgs = perfResultCover.pages?.length ?? audit.pages.length;
    const grade = perfGradeStr(perfResultCover.overallScore ?? 0).replace(
      " - ",
      ": ",
    );
    summaryParas.push(
      `KPMG conducted a comprehensive Performance Audit of ${projectName}, evaluating Core Web Vitals, resource efficiency, rendering performance, and network resilience across ${pgs} page(s).`,
    );
    summaryParas.push(
      `Overall Performance Score: ${perfResultCover.overallScore ?? "N/A"}/100 (${grade}). ${perfResultCover.totalResourceIssues ?? 0} resource issue(s) identified across ${pgs} page(s). ${p0c} critical issue(s) require immediate action; ${p1c} high-priority issue(s) are scheduled for the next sprint.`,
    );
    const vitalsLines: string[] = [];
    if (avg.lcp != null) {
      const s =
        avg.lcp <= 2500
          ? "Good"
          : avg.lcp <= 4000
            ? "Needs Improvement"
            : "Poor";
      vitalsLines.push(
        `LCP (Largest Contentful Paint): ${Math.round(avg.lcp)} ms - ${s} threshold ${avg.lcp <= 2500 ? "(<= 2,500 ms)" : avg.lcp <= 4000 ? "(2,500-4,000 ms)" : "(> 4,000 ms)"}.`,
      );
    }
    if (avg.cls != null) {
      const s =
        avg.cls <= 0.1
          ? "Good"
          : avg.cls <= 0.25
            ? "Needs Improvement"
            : "Poor";
      vitalsLines.push(
        `CLS (Cumulative Layout Shift): ${avg.cls.toFixed(3)} - ${s}. Measures visual stability of the page.`,
      );
    }
    if (avg.fcp != null) {
      const s =
        avg.fcp <= 1800
          ? "Good"
          : avg.fcp <= 3000
            ? "Needs Improvement"
            : "Poor";
      vitalsLines.push(
        `FCP (First Contentful Paint): ${Math.round(avg.fcp)} ms - ${s}.`,
      );
    }
    if (avg.ttfb != null) {
      const s =
        avg.ttfb <= 800
          ? "Good"
          : avg.ttfb <= 1800
            ? "Needs Improvement"
            : "Poor";
      vitalsLines.push(
        `TTFB (Time to First Byte): ${Math.round(avg.ttfb)} ms - ${s}. Reflects server response speed.`,
      );
    }
    if (vitalsLines.length > 0)
      summaryParas.push("Core Web Vitals Summary:\n" + vitalsLines.join("\n"));
    if (p0c > 0)
      summaryParas.push(
        `CRITICAL ALERT: ${p0c} P0 issue(s) must be resolved before the next production release to prevent significant user experience degradation.`,
      );
  } else if (isA11y) {
    summaryParas = [
      `This KPMG ${reportTitle} evaluated ${projectName} against ${standard} Level ${testedLevel}. The overall score is ${score.overall}/100 (${compLabel(score.complianceLevel)}). ${score.totalIssues} issues were identified across ${audit.pages.length} page(s).`,
    ];
  } else {
    summaryParas = [
      `This KPMG ${reportTitle} audited ${projectName} across: ${(pillars || []).join(", ")}. Overall score: ${score.overall}/100 (${compLabel(score.complianceLevel)}). ${score.totalIssues} issue(s) identified.`,
    ];
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...K.darkGrey);
  for (const para of summaryParas) {
    if (y > ph - 40) {
      doc.addPage();
      y = 18;
    }
    // Handle inline \n within a paragraph (e.g. vitals list)
    const lines = para.split("\n");
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(safeText(line), pw - 40);
      doc.text(wrapped, 20, y);
      y += wrapped.length * 4;
    }
    y += 4; // paragraph gap
  }

  // Severity breakdown table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...K.nearBlack);
  doc.text(
    perfOnly ? "Resource Issues by Severity" : "Issue Breakdown by Severity",
    20,
    y,
  );
  y += 6;

  // Aggregate severity counts — perf-only uses resource issues, others use a11y+dp+privacy
  const aggBySev: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  if (perfOnly && perfResultCover) {
    for (const pg of perfResultCover.pages || []) {
      for (const ri of pg.resourceIssues || []) {
        if (ri.severity in aggBySev) aggBySev[ri.severity]++;
      }
    }
  } else {
    const _dpF = ((audit as any).pillarResults?.darkpatterns?.findings ??
      []) as Array<{ severity: string }>;
    const _pvF = ((audit as any).pillarResults?.privacy?.findings ??
      []) as Array<{ severity: string }>;
    for (const f of [...issues, ..._dpF, ..._pvF] as Array<{
      severity: string;
    }>) {
      if (f.severity in aggBySev) aggBySev[f.severity]++;
    }
  }
  const aggTotal = Object.values(aggBySev).reduce((a, b) => a + b, 0);

  const breakdownActionLabel = perfOnly
    ? {
        critical: "Block Release",
        high: "Next Sprint",
        medium: "This Quarter",
        low: "Backlog",
      }
    : { critical: "Immediate", high: "High", medium: "Moderate", low: "Low" };
  const breakdownSprintLabel = perfOnly
    ? { critical: "Sprint 1", high: "Sprint 2", medium: "Q3", low: "Q4" }
    : { critical: "Sprint 1", high: "Sprint 2", medium: "Q2", low: "Today" };

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Severity",
        "Count",
        "% of Total",
        perfOnly ? "Action" : "Priority",
        "Target Sprint",
      ],
    ],
    body: (["critical", "high", "medium", "low"] as const).map((sev) => [
      sev.charAt(0).toUpperCase() + sev.slice(1),
      String(aggBySev[sev]),
      aggTotal > 0 ? `${Math.round((aggBySev[sev] / aggTotal) * 100)}%` : "0%",
      breakdownActionLabel[sev],
      breakdownSprintLabel[sev],
    ]),
    headStyles: {
      fillColor: K.navy,
      textColor: K.white,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: K.lightGrey,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: K.offWhite },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const s = data.cell.text[0]?.toLowerCase();
        if (s) data.cell.styles.textColor = sevColor(s);
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 3) {
        const s = (["critical", "high", "medium", "low"] as const)[
          data.row.index
        ];
        if (s) {
          data.cell.styles.textColor = sevColor(s);
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = sevBg(s);
        }
      }
    },
    margin: { left: 20, right: 20 },
  });

  // Category scores / CWV cards — pillar-aware
  y = (doc as any).lastAutoTable.finalY + 12;
  if (perfOnly && perfResultCover) {
    // CWV average cards — 3 per row (LCP, FCP, CLS, TTFB, TBT, INP)
    const avg = perfResultCover.averageVitals || {};
    const cwvMeta = [
      {
        key: "lcp",
        label: "LCP",
        fmt: (v: number) => `${Math.round(v)}ms`,
        good: 2500,
        poor: 4000,
      },
      {
        key: "fcp",
        label: "FCP",
        fmt: (v: number) => `${Math.round(v)}ms`,
        good: 1800,
        poor: 3000,
      },
      {
        key: "cls",
        label: "CLS",
        fmt: (v: number) => v.toFixed(3),
        good: 0.1,
        poor: 0.25,
      },
      {
        key: "ttfb",
        label: "TTFB",
        fmt: (v: number) => `${Math.round(v)}ms`,
        good: 800,
        poor: 1800,
      },
      {
        key: "tbt",
        label: "TBT",
        fmt: (v: number) => `${Math.round(v)}ms`,
        good: 200,
        poor: 600,
      },
      {
        key: "inp",
        label: "INP",
        fmt: (v: number) => `${Math.round(v)}ms`,
        good: 200,
        poor: 500,
      },
    ];
    const cardW = (pw - 40 - 10) / 3;
    if (y + 28 > ph - 20) {
      doc.addPage();
      y = 18;
    }
    cwvMeta.forEach((m, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      if (col === 0 && row > 0 && y + 28 > ph - 20) {
        doc.addPage();
        y = 18;
      }
      const cx = 20 + col * (cardW + 5);
      const cy = y + row * 30;
      const val = avg[m.key];
      const color: [number, number, number] =
        val == null
          ? K.midGrey
          : val <= m.good
            ? K.teal
            : val <= m.poor
              ? K.medium
              : K.critical;
      const displayVal = val != null ? m.fmt(val) : "—";
      const statusText =
        val == null
          ? "—"
          : val <= m.good
            ? "Good"
            : val <= m.poor
              ? "Needs Impr."
              : "Poor";
      doc.setFillColor(...K.offWhite);
      doc.roundedRect(cx, cy, cardW, 26, 2, 2, "F");
      doc.setDrawColor(...color);
      doc.setLineWidth(0.4);
      doc.roundedRect(cx, cy, cardW, 26, 2, 2, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...K.navy);
      doc.text(m.label, cx + cardW / 2, cy + 6, { align: "center" });
      doc.setFontSize(13);
      doc.setTextColor(...color);
      doc.text(displayVal, cx + cardW / 2, cy + 16, { align: "center" });
      doc.setFontSize(6.5);
      doc.setTextColor(...color);
      doc.text(statusText, cx + cardW / 2, cy + 22, { align: "center" });
    });
    y += Math.ceil(cwvMeta.length / 3) * 30 + 4;
  } else if (isA11y) {
    const cats = [
      "perceivable",
      "operable",
      "understandable",
      "robust",
    ] as const;
    const catLabels = {
      perceivable: "Perceivable",
      operable: "Operable",
      understandable: "Understandable",
      robust: "Robust",
    };
    const cardW = (pw - 40 - 15) / 4;
    cats.forEach((cat, i) => {
      const x = 20 + i * (cardW + 5);
      const v = score.categoryScores[cat] || 0;
      const col = v >= 75 ? K.teal : v >= 50 ? K.medium : K.critical;
      doc.setFillColor(...K.offWhite);
      doc.roundedRect(x, y, cardW, 22, 2, 2, "F");
      doc.setDrawColor(...col);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, y, cardW, 22, 2, 2, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...col);
      doc.text(String(v), x + cardW / 2, y + 11, { align: "center" });
      doc.setFontSize(7);
      doc.setTextColor(...K.darkGrey);
      doc.text(catLabels[cat], x + cardW / 2, y + 18, { align: "center" });
    });
  }

  // ══════════════════════════════════════════════
  // SECTIONS 2-7: ACCESSIBILITY-ONLY SECTIONS
  // ══════════════════════════════════════════════
  if (isA11y) {
    // ── Section 2: Summary of Findings ──
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, "2", "Summary of Findings", y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...K.darkGrey);
    doc.text(
      "Quick-reference table of all issues identified. See Section 3 for full details.",
      20,
      y,
    );
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [
        ["#", "Issue Title", col3H, col4H, "Severity", "Team Owner", "Effort"],
      ],
      body: issues.map((iss, idx) => [
        `#${String(idx + 1).padStart(3, "0")}`,
        iss.title,
        col3V(iss),
        col4V(iss),
        iss.severity.toUpperCase(),
        deriveTeam(iss),
        deriveEffort(iss),
      ]),
      headStyles: {
        fillColor: K.navy,
        textColor: K.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        lineColor: K.lightGrey,
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      alternateRowStyles: { fillColor: K.offWhite },
      columnStyles: {
        0: { cellWidth: 12, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 48 },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 12, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 28 },
        6: { cellWidth: 20, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const s = data.cell.text[0]?.toLowerCase();
          if (s) {
            data.cell.styles.textColor = sevColor(s);
            data.cell.styles.fillColor = sevBg(s);
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.section === "body" && data.column.index === 3) {
          data.cell.styles.textColor = K.lightBlue;
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 20, right: 20 },
    });

    // ══════════════════════════════════════════════
    // SECTION 3: ISSUE REGISTER (DETAILED)
    // ══════════════════════════════════════════════
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, "3", "Issue Register — Detailed Analysis", y);

    issues.forEach((issue, idx) => {
      const issueId = `#${String(idx + 1).padStart(3, "0")}`;
      const team = deriveTeam(issue);
      const effort = deriveEffort(issue);

      if (y > ph - 80) {
        doc.addPage();
        y = 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...K.navy);
      const label = isA11y ? "WCAG Criterion:" : "Rule:";
      doc.text(label, 20, y);
      doc.setTextColor(...K.lightBlue);
      const ruleText = isA11y
        ? `${issue.wcagCriterion} — ${issue.wcagName} (${issue.wcagLevel})`
        : `${(issue as any).ruleId || issue.wcagCriterion || "—"}`;
      doc.text(ruleText, 22 + doc.getTextWidth(label), y);
      y += 10;

      // Issue header bar
      doc.setFillColor(...sevBg(issue.severity));
      doc.roundedRect(20, y - 3, pw - 40, 13, 2, 2, "F");
      doc.setDrawColor(...sevColor(issue.severity));
      doc.setLineWidth(0.4);
      doc.line(20, y - 3, 20, y + 10);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...sevColor(issue.severity));
      doc.text(`${issueId} ${issue.title}`, 24, y + 5);
      y += 16;
      y += 10;

      // Meta line 1: WCAG/Rule
      // doc.setFontSize(8);
      // doc.setFont("helvetica", "bold");
      // doc.setTextColor(...K.navy);
      // doc.text(isA11y ? "WCAG Criterion:" : "Rule:", 24, y);

      // Meta line 2: Severity, Team, Effort, Page
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");

      // --- Item 1: Severity ---
      doc.setTextColor(...K.navy);
      doc.text("Severity: ", 24, y);
      const severityText = issue.severity.toUpperCase();
      doc.setTextColor(...sevColor(issue.severity));
      doc.text(severityText, 44, y);
      let currentX = 44 + doc.getTextWidth(severityText) + 6;

      // --- Separator ---
      doc.setTextColor(...K.midGrey);
      doc.text("|", currentX, y);
      currentX += 4;

      // --- Item 2: Team Owner ---
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...K.navy);
      doc.text("Team Owner: ", currentX, y);
      currentX += doc.getTextWidth("Team Owner: ");
      doc.setTextColor(...K.teal);
      doc.text(team, currentX, y);
      currentX += doc.getTextWidth(team) + 6;

      // --- Separator ---
      doc.setTextColor(...K.midGrey);
      doc.text("|", currentX, y);
      currentX += 4;

      // --- Item 3: Effort ---
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...K.navy);
      doc.text("Effort: ", currentX, y);
      currentX += doc.getTextWidth("Effort: ");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...K.darkGrey);
      doc.text(effort, currentX, y);
      y += 8;

      // Description
      if (y > ph - 40) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...K.nearBlack);
      doc.text("Description", 24, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...K.darkGrey);
      const descLines = doc.splitTextToSize(issue.description, pw - 48);
      doc.text(descLines, 24, y);
      y += descLines.length * 3.5 + 3;

      // Current vs Expected
      if (y > ph - 40) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...K.critical);
      doc.text("Current Behaviour", 24, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const currLines = doc.splitTextToSize(
        issue.description.substring(0, 150),
        pw - 48,
      );
      doc.text(currLines, 24, y);
      y += currLines.length * 3.5 + 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 120, 86);
      doc.text("Expected Behaviour / Remediation", 24, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 120, 86);
      const recLines = doc.splitTextToSize(issue.recommendation, pw - 48);
      doc.text(recLines, 24, y);
      y += recLines.length * 3.5 + 3;

      // Code fix (before → after)
      if (issue.codeFix) {
        if (y > ph - 40) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...K.nearBlack);
        doc.text("Recommended Code Fix", 24, y);
        y += 4;
        const codeLines = doc.splitTextToSize(issue.codeFix, pw - 52);
        const codeH = codeLines.length * 3.5 + 5;
        doc.setFillColor(1, 11, 26);
        doc.setDrawColor(...K.teal);
        doc.setLineWidth(0.5);
        doc.roundedRect(24, y - 1, pw - 48, codeH, 2, 2, "FD");
        doc.setFont("courier", "normal");
        doc.setFontSize(7);
        doc.setTextColor(134, 239, 172);
        doc.text(codeLines, 28, y + 3);
        y += codeH + 3;
      }

      // Separator
      y += 3;
      doc.setDrawColor(...K.lightGrey);
      doc.setLineWidth(0.2);
      doc.line(20, y, pw - 20, y);
      y += 8;
    });

    // ══════════════════════════════════════════════
    // SECTION 4: COMPONENT-LEVEL FINDINGS
    // ══════════════════════════════════════════════
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, "4", "Component-Level Findings", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...K.darkGrey);
    doc.text(
      "Fix the component once at design-system level to resolve all instances.",
      20,
      y,
    );
    y += 8;

    const compFn = (i: AccessibilityIssue) => {
      const t = (i.title + " " + i.element).toLowerCase();
      if (t.includes("button") || t.includes("btn")) return "Buttons";
      if (t.includes("form") || t.includes("input") || t.includes("select"))
        return "Forms";
      if (t.includes("nav") || t.includes("link")) return "Navigation";
      if (t.includes("img") || t.includes("alt")) return "Images";
      if (t.includes("heading")) return "Headings";
      if (t.includes("color") || t.includes("contrast")) return "Colour";
      if (t.includes("focus") || t.includes("keyboard")) return "Focus/KB";
      return "General";
    };
    const byComp: Record<string, AccessibilityIssue[]> = {};
    issues.forEach((i) => {
      const c = compFn(i);
      if (!byComp[c]) byComp[c] = [];
      byComp[c].push(i);
    });

    autoTable(doc, {
      startY: y,
      head: [["Component", "Issues", "Critical", "High", "DS Impact", "Teams"]],
      body: Object.entries(byComp)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([comp, cIssues]) => {
          const crit = cIssues.filter((x) => x.severity === "critical").length;
          const hi = cIssues.filter((x) => x.severity === "high").length;
          const teams = [...new Set(cIssues.map((x) => deriveTeam(x)))].join(
            ", ",
          );
          return [
            comp,
            String(cIssues.length),
            String(crit),
            String(hi),
            cIssues.length >= 3 ? "Yes" : "No",
            teams,
          ];
        }),
      headStyles: {
        fillColor: K.navy,
        textColor: K.white,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        lineColor: K.lightGrey,
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: K.offWhite },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
      },
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          data.column.index === 2 &&
          parseInt(data.cell.text[0]) > 0
        ) {
          data.cell.styles.textColor = K.critical;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = K.criticalBg;
        }
        if (
          data.section === "body" &&
          data.column.index === 4 &&
          data.cell.text[0] === "Yes"
        ) {
          data.cell.styles.textColor = K.high;
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 20, right: 20 },
    });

    // ══════════════════════════════════════════════
    // SECTION 5: TEAM ASSIGNMENT MATRIX
    // ══════════════════════════════════════════════
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, "5", "Team Assignment Matrix", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...K.darkGrey);
    doc.text(
      "Route each issue to the correct team. Use this table for sprint planning.",
      20,
      y,
    );
    y += 8;

    const byTeam: Record<string, AccessibilityIssue[]> = {};
    issues.forEach((i) => {
      const t = deriveTeam(i);
      if (!byTeam[t]) byTeam[t] = [];
      byTeam[t].push(i);
    });

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Team",
          "Issues",
          "Critical",
          "High",
          "Med",
          "Low",
          "Total Effort",
          "Sprint",
        ],
      ],
      body: Object.entries(byTeam)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([team, tIssues]) => {
          const c = tIssues.filter((x) => x.severity === "critical").length;
          const h = tIssues.filter((x) => x.severity === "high").length;
          const m = tIssues.filter((x) => x.severity === "medium").length;
          const l = tIssues.filter((x) => x.severity === "low").length;
          const sprint =
            c > 0 ? "Sprint 1" : h > 0 ? "Sprint 1-2" : "Sprint 2+";
          return [
            team,
            String(tIssues.length),
            String(c),
            String(h),
            String(m),
            String(l),
            `~${Math.ceil(tIssues.length * 0.5)}h`,
            sprint,
          ];
        }),
      headStyles: {
        fillColor: K.navy,
        textColor: K.white,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 4.5,
        lineColor: K.lightGrey,
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: K.offWhite },
      columnStyles: {
        1: { halign: "center", fontStyle: "bold" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "center" },
      },
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          data.column.index === 2 &&
          parseInt(data.cell.text[0]) > 0
        ) {
          data.cell.styles.textColor = K.critical;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = K.criticalBg;
        }
        if (
          data.section === "body" &&
          data.column.index === 3 &&
          parseInt(data.cell.text[0]) > 0
        ) {
          data.cell.styles.textColor = K.high;
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 20, right: 20 },
    });

    // ══════════════════════════════════════════════
    // SECTION 6: PRIORITY & SPRINT PLAN
    // ══════════════════════════════════════════════
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, "6", "Priority & Sprint Plan", y);

    const quadrants = [
      {
        label: "Critical Blockers — Fix This Sprint",
        color: K.critical,
        bg: K.criticalBg,
        items: issues.filter((i) => i.severity === "critical"),
      },
      {
        label: "High Priority — Next Sprint",
        color: K.high,
        bg: K.highBg,
        items: issues.filter((i) => i.severity === "high"),
      },
      {
        label: "Medium Priority — This Quarter",
        color: K.medium,
        bg: K.mediumBg,
        items: issues.filter((i) => i.severity === "medium"),
      },
      {
        label: "Quick Wins — Fix Today (< 30 min each)",
        color: K.teal,
        bg: K.passBg,
        items: issues.filter((i) => i.severity === "low"),
      },
    ];

    quadrants.forEach(({ label, color, bg, items }) => {
      if (y > ph - 40) {
        doc.addPage();
        y = 18;
      }
      doc.setFillColor(...bg);
      doc.roundedRect(20, y - 2, pw - 40, 10, 2, 2, "F");
      doc.setDrawColor(...color);
      doc.setLineWidth(0.6);
      doc.line(20, y - 2, 20, y + 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...color);
      doc.text(
        `${label}  (${items.length} issue${items.length !== 1 ? "s" : ""})`,
        24,
        y + 5,
      );
      y += 14;

      if (items.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...K.midGrey);
        doc.text("No issues in this category.", 24, y);
        y += 8;
      } else {
        autoTable(doc, {
          startY: y,
          head: [],
          body: items.map((iss) => [
            iss.title,
            iss.wcagCriterion,
            deriveTeam(iss),
            deriveEffort(iss),
          ]),
          styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: K.lightGrey,
            lineWidth: 0.15,
            textColor: K.nearBlack,
          },
          alternateRowStyles: { fillColor: bg },
          columnStyles: {
            0: { cellWidth: 65 },
            1: { cellWidth: 15, halign: "center", textColor: K.lightBlue },
            2: { cellWidth: 30 },
            3: { cellWidth: 22, halign: "center" },
          },
          margin: { left: 24, right: 24 },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }
    });

    // ══════════════════════════════════════════════
    // SECTION 7: QA ACCEPTANCE CRITERIA
    // ══════════════════════════════════════════════
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, "7", "QA Acceptance Criteria", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...K.darkGrey);
    doc.text(
      'Use these as regression test cases. Each issue has a "Done When" checklist.',
      20,
      y,
    );
    y += 8;

    const getAcceptance = (iss: AccessibilityIssue): string => {
      const c = iss.wcagCriterion;
      if (c === "2.1.1" || c === "2.1.2")
        return "1. Keyboard nav works fully\n2. No keyboard trap detected";
      if (c === "1.4.3")
        return "1. Contrast >= 4.5:1 (normal) or 3:1 (large)\n2. Verified with analyser";
      if (c === "1.1.1")
        return '1. All images have descriptive alt text\n2. Decorative images use alt=""';
      if (c === "4.1.2")
        return "1. SR announces name, role, state\n2. ARIA attributes are valid";
      return `1. Issue no longer reproducible\n2. WCAG ${c} criterion met`;
    };

    autoTable(doc, {
      startY: y,
      head: [["#", "Issue", "Severity", "Done When — Acceptance Criteria"]],
      body: issues.map((iss, idx) => [
        `#${String(idx + 1).padStart(3, "0")}`,
        iss.title,
        iss.severity.toUpperCase(),
        getAcceptance(iss),
      ]),
      headStyles: {
        fillColor: K.navy,
        textColor: K.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        lineColor: K.lightGrey,
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      alternateRowStyles: { fillColor: K.offWhite },
      columnStyles: {
        0: { cellWidth: 12, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 45 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 78 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const s = data.cell.text[0]?.toLowerCase();
          if (s) {
            data.cell.styles.textColor = sevColor(s);
            data.cell.styles.fillColor = sevBg(s);
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 20, right: 20 },
    });
  } // end isA11y sections

  // ══════════════════════════════════════════════
  // DARK PATTERN FINDINGS (pillar-aware section num)
  // ══════════════════════════════════════════════
  const dpSectionNum = isA11y ? "8" : "2";
  const dpFindings: DarkPatternFinding[] =
    (audit as any).pillarResults?.darkpatterns?.findings || [];

  // ── Deduplicate: group same ruleId+pageUrl, keep first instance, annotate count ──
  const dpDeduped: (DarkPatternFinding & { _instanceCount: number })[] = [];
  const dpSeenKey = new Map<string, number>(); // key → index in dpDeduped
  for (const f of dpFindings) {
    const key = `${f.ruleId}||${f.pageUrl || ""}`;
    if (dpSeenKey.has(key)) {
      dpDeduped[dpSeenKey.get(key)!]._instanceCount++;
    } else {
      dpSeenKey.set(key, dpDeduped.length);
      dpDeduped.push({ ...f, _instanceCount: 1 });
    }
  }

  if (isDP && dpFindings.length > 0) {
    // ══════════════════════════════════════════════
    // SECTION: JOURNEY AUDIT MAP (DP-only)
    // ══════════════════════════════════════════════
    if (!isA11y) {
      doc.addPage();
      y = 18;
      y = sectionHeading(doc, "2", "Journey Audit Map", y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...K.darkGrey);
      const journeySteps: { url: string; label: string }[] =
        (audit.config as any).journeySteps || [];
      const pageList = audit.pages.map((p) => p.url);

      if (journeySteps.length > 0) {
        doc.text(
          `${journeySteps.length}-step predefined journey audited. Each step shows dark patterns detected at that URL.`,
          20,
          y,
        );
        y += 8;

        // Build per-step summary
        const stepRows = journeySteps.map((step, i) => {
          const stepUrl = step.url;
          const stepFindings = dpFindings.filter((f) => {
            const fu = f.pageUrl || "";
            return fu === stepUrl || fu.startsWith(stepUrl.replace(/\/$/, ""));
          });
          const crit = stepFindings.filter(
            (f) => f.severity === "critical",
          ).length;
          const high = stepFindings.filter((f) => f.severity === "high").length;
          const med = stepFindings.filter(
            (f) => f.severity === "medium",
          ).length;
          const cats =
            [
              ...new Set(
                stepFindings.map((f) =>
                  f.category
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase()),
                ),
              ),
            ]
              .slice(0, 2)
              .join(", ") || "—";
          const topRule =
            stepFindings[0]?.brignullPattern ||
            stepFindings[0]?.title?.substring(0, 30) ||
            "—";
          return [
            `${i + 1}. ${step.label}`,
            stepUrl.replace(/^https?:\/\/[^/]+/, "") || "/",
            String(stepFindings.length),
            crit > 0 ? String(crit) : "—",
            high > 0 ? String(high) : "—",
            cats,
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [
            ["Journey Step", "Path", "Total", "Crit", "High", "Top Categories"],
          ],
          body: stepRows,
          headStyles: {
            fillColor: [106, 40, 155],
            textColor: K.white,
            fontStyle: "bold",
            fontSize: 8,
          },
          styles: {
            fontSize: 8,
            cellPadding: 4,
            lineColor: K.lightGrey,
            lineWidth: 0.2,
            overflow: "linebreak",
          },
          alternateRowStyles: { fillColor: K.offWhite },
          columnStyles: {
            0: { cellWidth: 42 },
            1: { cellWidth: 48 },
            2: { cellWidth: 12, halign: "center", fontStyle: "bold" },
            3: { cellWidth: 10, halign: "center" },
            4: { cellWidth: 10, halign: "center" },
            5: { cellWidth: 48 },
          },
          didParseCell: (data) => {
            if (
              data.section === "body" &&
              data.column.index === 3 &&
              data.cell.text[0] !== "—"
            ) {
              data.cell.styles.textColor = K.critical;
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = K.criticalBg;
            }
            if (
              data.section === "body" &&
              data.column.index === 4 &&
              data.cell.text[0] !== "—"
            ) {
              data.cell.styles.textColor = K.high;
              data.cell.styles.fontStyle = "bold";
            }
            if (data.section === "body" && data.column.index === 2) {
              const n = parseInt(data.cell.text[0]);
              if (n >= 10) {
                data.cell.styles.textColor = K.critical;
                data.cell.styles.fontStyle = "bold";
              } else if (n >= 5) {
                data.cell.styles.textColor = K.high;
                data.cell.styles.fontStyle = "bold";
              }
            }
          },
          margin: { left: 20, right: 20 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;

        // Visual journey path strip
        const purple: [number, number, number] = [106, 40, 155];
        const stripH = 14;
        const stepW = (pw - 40) / Math.max(journeySteps.length, 1);
        if (y + stripH + 30 > ph - 20) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...K.navy);
        doc.text("User Journey Flow", 20, y);
        y += 6;

        journeySteps.forEach((step, i) => {
          const x = 20 + i * stepW;
          const stepF = dpFindings.filter((f) =>
            (f.pageUrl || "").startsWith(step.url.replace(/\/$/, "")),
          ).length;
          const bg: [number, number, number] =
            stepF >= 10 ? K.criticalBg : stepF >= 5 ? K.highBg : K.offWhite;
          const col: [number, number, number] =
            stepF >= 10 ? K.critical : stepF >= 5 ? K.high : K.teal;
          doc.setFillColor(...bg);
          doc.roundedRect(x, y, stepW - 2, stripH, 2, 2, "F");
          doc.setDrawColor(...col);
          doc.setLineWidth(0.4);
          doc.roundedRect(x, y, stepW - 2, stripH, 2, 2, "S");
          // Step number badge
          doc.setFillColor(...col);
          doc.circle(x + 5, y + stripH / 2, 3.5, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...K.white);
          doc.text(String(i + 1), x + 5, y + stripH / 2 + 1, {
            align: "center",
          });
          // Label
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(...K.nearBlack);
          const lbl =
            step.label.length > 12
              ? step.label.substring(0, 12) + "…"
              : step.label;
          doc.text(lbl, x + 10, y + 6, { maxWidth: stepW - 14 });
          // Finding count
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...col);
          doc.text(String(stepF), x + stepW / 2, y + stripH - 3, {
            align: "center",
          });
          // Arrow
          if (i < journeySteps.length - 1) {
            doc.setDrawColor(...K.midGrey);
            doc.setLineWidth(0.3);
            doc.line(x + stepW - 1, y + stripH / 2, x + stepW, y + stripH / 2);
          }
        });
        y += stripH + 4;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(...K.midGrey);
        doc.text(
          "Numbers = findings per step. Red = 10+ findings (critical density).",
          20,
          y,
        );
        y += 10;
      } else {
        doc.text(
          "General crawl mode — no predefined journey steps recorded.",
          20,
          y,
        );
        y += 10;
      }

      // ── Brignull Taxonomy Summary ──
      if (y + 60 > ph - 20) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...K.navy);
      doc.text("Brignull Dark Pattern Taxonomy", 20, y);
      y += 4;
      doc.setDrawColor(...([106, 40, 155] as [number, number, number]));
      doc.setLineWidth(0.6);
      doc.line(20, y, 90, y);
      y += 8;

      // Group by Brignull pattern
      const brignullMap = new Map<
        string,
        { count: number; sev: string; regs: Set<string> }
      >();
      for (const f of dpFindings) {
        const bp = f.brignullPattern || "Unclassified";
        if (!brignullMap.has(bp))
          brignullMap.set(bp, { count: 0, sev: "low", regs: new Set() });
        const entry = brignullMap.get(bp)!;
        entry.count++;
        const sevOrder: Record<string, number> = {
          critical: 3,
          high: 2,
          medium: 1,
          low: 0,
        };
        if ((sevOrder[f.severity] || 0) > (sevOrder[entry.sev] || 0))
          entry.sev = f.severity;
        (f.regulation || []).forEach((r) => entry.regs.add(r.substring(0, 25)));
      }
      const brignullRows = [...brignullMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([pattern, data]) => [
          pattern,
          String(data.count),
          data.sev.toUpperCase(),
          [...data.regs].slice(0, 2).join(", ") || "—",
        ]);

      autoTable(doc, {
        startY: y,
        head: [
          [
            "Brignull Pattern",
            "Instances",
            "Max Severity",
            "Regulations Triggered",
          ],
        ],
        body: brignullRows,
        headStyles: {
          fillColor: [106, 40, 155],
          textColor: K.white,
          fontStyle: "bold",
          fontSize: 8,
        },
        styles: {
          fontSize: 8,
          cellPadding: 3.5,
          lineColor: K.lightGrey,
          lineWidth: 0.2,
        },
        alternateRowStyles: { fillColor: K.offWhite },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 18, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: 72 },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            const s = data.cell.text[0]?.toLowerCase();
            if (s) {
              data.cell.styles.textColor = sevColor(s);
              data.cell.styles.fillColor = sevBg(s);
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
        margin: { left: 20, right: 20 },
      });
    } // end DP-only sections

    doc.addPage();
    y = 18;
    y = sectionHeading(
      doc,
      isA11y ? dpSectionNum : "3",
      "Dark Pattern Findings",
      y,
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...K.darkGrey);
    doc.text(
      `${dpFindings.length} dark pattern instance(s) detected — ${dpDeduped.length} unique finding(s) after deduplication.`,
      20,
      y,
    );
    y += 8;

    // Summary table — deduplicated rows
    autoTable(doc, {
      startY: y,
      head: [
        [
          "#",
          "Finding",
          "Category",
          "Brignull",
          "Severity",
          "DSA Article",
          "Instances",
        ],
      ],
      body: dpDeduped.map((f, idx) => [
        `#${String(idx + 1).padStart(3, "0")}`,
        f.title,
        f.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        f.brignullPattern ? `#${f.brignullNumber} ${f.brignullPattern}` : "—",
        f.severity.toUpperCase(),
        f.dsaArticle || f.regulation?.[0] || "—",
        f._instanceCount > 1 ? `×${f._instanceCount}` : "1",
      ]),
      headStyles: {
        fillColor: [106, 40, 155],
        textColor: K.white,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        lineColor: K.lightGrey,
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      alternateRowStyles: { fillColor: K.offWhite },
      columnStyles: {
        0: { cellWidth: 12, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 46 },
        2: { cellWidth: 26 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 22 },
        6: { cellWidth: 10, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const s = data.cell.text[0]?.toLowerCase();
          if (s) {
            data.cell.styles.textColor = sevColor(s);
            data.cell.styles.fillColor = sevBg(s);
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (
          data.section === "body" &&
          data.column.index === 6 &&
          data.cell.text[0] !== "1"
        ) {
          data.cell.styles.textColor = K.high;
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 20, right: 20 },
    });

    // Detailed dark pattern finding blocks — deduplicated
    doc.addPage();
    y = 18;
    y = sectionHeading(
      doc,
      (isA11y ? dpSectionNum : "3") + ".1",
      "Dark Pattern Detail Cards",
      y,
    );

    dpDeduped.forEach((f, idx) => {
      if (y > ph - 80) {
        doc.addPage();
        y = 18;
      }

      const purple: [number, number, number] = [106, 40, 155];

      // Brignull sub-header
      if (f.brignullPattern) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...purple);
        doc.text(
          `Brignull #${f.brignullNumber}: ${f.brignullPattern}`,
          20,
          y - 5,
        );
        y += 6;
      }

      // Finding header
      doc.setFillColor(...sevBg(f.severity));
      doc.roundedRect(20, y - 3, pw - 40, 13, 2, 2, "F");
      doc.setDrawColor(...sevColor(f.severity));
      doc.setLineWidth(0.5);
      doc.line(20, y - 3, 20, y + 10);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...sevColor(f.severity));
      const instanceTag =
        f._instanceCount > 1 ? `  [×${f._instanceCount} instances]` : "";
      doc.text(
        `#${String(idx + 1).padStart(3, "0")}  ${f.title}${instanceTag}`,
        24,
        y + 5,
      );
      y += 16;

      // Meta line 1
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...K.navy);
      doc.text("Severity: ", 24, y);
      doc.setTextColor(...sevColor(f.severity));
      doc.text(f.severity.toUpperCase(), 44, y);

      doc.setTextColor(...K.midGrey);
      doc.text("|", 62, y);
      doc.setTextColor(...K.navy);
      doc.text("Rule: ", 68, y);
      doc.setTextColor(...K.lightBlue);
      const ruleIdText = f.ruleId || "—";
      doc.text(ruleIdText, 80, y);
      let currentX = 80 + doc.getTextWidth(ruleIdText) + 4;
      y += 5;

      // Meta line 2
      doc.setTextColor(...K.navy);
      doc.text("DSA Article: ", 24, y);
      doc.setTextColor(...K.lightBlue);
      doc.text(f.dsaArticle || "—", 50, y);
      if (f.fixPriority) {
        doc.setTextColor(...K.midGrey);
        doc.text("|", 82, y);
        doc.setTextColor(...K.navy);
        doc.text("Priority: ", 88, y);
        doc.setTextColor(
          f.fixPriority === "P0" ? K.critical[0] : K.high[0],
          f.fixPriority === "P0" ? K.critical[1] : K.high[1],
          f.fixPriority === "P0" ? K.critical[2] : K.high[2],
        );
        doc.text(f.fixPriority, 104, y);
      }
      if (f.estimatedEffort) {
        doc.setTextColor(...K.midGrey);
        doc.text("|", 116, y);
        doc.setTextColor(...K.navy);
        doc.text(`Effort: ${f.estimatedEffort}`, 122, y);
      }
      y += 8;

      // Description
      if (y > ph - 40) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...K.nearBlack);
      doc.text("User Impact", 24, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...K.darkGrey);
      const impactLines = doc.splitTextToSize(
        f.userImpact || f.description,
        pw - 48,
      );
      doc.text(impactLines, 24, y);
      y += impactLines.length * 3.5 + 3;

      // Developer fix — IMPORTANT: set Courier font BEFORE splitTextToSize so
      // jsPDF calculates character widths correctly for that font, preventing overflow.
      if (f.developerFix && !isA11y) {
        if (y > ph - 35) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...K.nearBlack);
        doc.text("Developer Fix", 24, y);
        y += 4;
        // Set target font first so splitTextToSize uses correct char widths
        doc.setFont("courier", "normal");
        doc.setFontSize(7);
        const fixLines = doc.splitTextToSize(
          f.developerFix.substring(0, 300),
          pw - 56,
        );
        const fh = fixLines.length * 3.8 + 6;
        doc.setFillColor(1, 11, 26);
        doc.setDrawColor(...K.teal);
        doc.setLineWidth(0.5);
        doc.roundedRect(24, y - 1, pw - 48, fh, 2, 2, "FD");
        doc.setTextColor(134, 239, 172);
        doc.text(fixLines, 28, y + 4);
        y += fh + 4;
      }

      // Legal summary
      if (f.legalSummary) {
        if (y > ph - 30) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(180, 30, 30);
        doc.text("Legal / Regulatory Exposure", 24, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...K.darkGrey);
        const legalLines = doc.splitTextToSize(
          f.legalSummary.substring(0, 300),
          pw - 48,
        );
        doc.text(legalLines, 24, y);
        y += legalLines.length * 3.5 + 3;
      }

      // Evidence screenshot — capped at 55mm height to prevent full-page DOM dumps
      // from filling the entire card. Border frame makes it look intentional.
      if ((f.evidence as any)?.screenshotDataUrl) {
        const imgData: string = (f.evidence as any).screenshotDataUrl;
        const maxImgH = 55;
        const imgW = pw - 44;
        // Maintain aspect ratio but cap height
        const imgH = Math.min(Math.round(imgW * 0.5), maxImgH);
        if (y + imgH + 18 > ph - 20) {
          doc.addPage();
          y = 18;
        }

        // Label row — bold title left, italic URL right
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...K.nearBlack);
        doc.text("Evidence — Element Pinpoint", 24, y);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(...K.midGrey);
        const urlLabel = (f.pageUrl || "")
          .replace(/^https?:\/\//, "")
          .substring(0, 60);
        doc.text(urlLabel, pw - 20, y, { align: "right" });
        y += 4;

        // Outer frame + image
        const frameX = 22;
        const frameY = y;
        const frameW = pw - 44;
        const frameH = imgH + 2;
        doc.setFillColor(...K.offWhite);
        doc.setDrawColor(232, 0, 45); // red border to match the in-page highlight
        doc.setLineWidth(0.6);
        doc.roundedRect(frameX, frameY, frameW, frameH, 2, 2, "FD");
        try {
          doc.addImage(
            imgData,
            "JPEG",
            frameX + 1,
            frameY + 1,
            frameW - 2,
            imgH,
            undefined,
            "MEDIUM",
          );
        } catch (_) {
          /* skip if image data is invalid */
        }

        // Legend
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6.5);
        doc.setTextColor(...K.midGrey);
        doc.text(
          "Screenshot cropped to detected element  |  Red border marks exact dark pattern location  |  TrustLens audit engine",
          24,
          y + imgH + 5,
        );
        y += imgH + 11;
      }

      // Separator
      y += 2;
      doc.setDrawColor(...K.lightGrey);
      doc.setLineWidth(0.2);
      doc.line(20, y, pw - 20, y);
      y += 8;
    });
  } else if (isDP) {
    // DP pillar selected but no findings
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, "8", "Dark Pattern Findings", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 150, 100);
    doc.text(
      "✓  No dark patterns detected — the interface respects ethical design principles.",
      20,
      y + 10,
    );
  }

  // ── PERFORMANCE SECTION ──────────────────────────────────────
  if (isPerf) {
    const perfResult = (audit as any).pillarResults?.performance;
    const perfSectionNum = isA11y && isDP ? "9" : isA11y || isDP ? "3" : "2";
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, perfSectionNum, "Performance Findings", y);

    if (!perfResult || !perfResult.pages?.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...K.midGrey);
      doc.text("No performance data available for this audit.", 20, y + 8);
    } else {
      const perfPages: any[] = perfResult.pages;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...K.darkGrey);
      doc.text(
        `Core Web Vitals across ${perfPages.length} page(s). Overall performance score: ${perfResult.overallScore ?? "N/A"}/100.`,
        20,
        y,
      );
      y += 10;

      // Page vitals table
      autoTable(doc, {
        startY: y,
        head: [
          [
            "Page",
            "Score",
            "LCP (ms)",
            "CLS",
            "FCP (ms)",
            "TTFB (ms)",
            "Resource Issues",
          ],
        ],
        body: perfPages.map((pg: any) => [
          (pg.title || pg.url || "").substring(0, 40),
          String(pg.score ?? "—"),
          pg.vitals?.lcp != null ? String(Math.round(pg.vitals.lcp)) : "—",
          pg.vitals?.cls != null ? pg.vitals.cls.toFixed(3) : "—",
          pg.vitals?.fcp != null ? String(Math.round(pg.vitals.fcp)) : "—",
          pg.vitals?.ttfb != null ? String(Math.round(pg.vitals.ttfb)) : "—",
          String(pg.resourceIssues?.length ?? 0),
        ]),
        headStyles: {
          fillColor: [0, 110, 81],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: { fontSize: 8, textColor: K.nearBlack },
        alternateRowStyles: { fillColor: K.offWhite },
        margin: { left: 20, right: 20 },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Resource issues detail per page
      const allResourceIssues: any[] = perfPages.flatMap((pg: any) =>
        (pg.resourceIssues || []).map((ri: any) => ({
          ...ri,
          pageTitle: pg.title || pg.url || "",
        })),
      );
      if (allResourceIssues.length > 0) {
        doc.addPage();
        y = 18;
        // Section heading
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...K.navy);
        doc.text(`${perfSectionNum}.1 Resource Issues`, 20, y);
        y += 3;
        doc.setDrawColor(...K.lightBlue);
        doc.setLineWidth(0.6);
        doc.line(20, y, 90, y);
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...K.darkGrey);
        doc.text(
          `${allResourceIssues.length} resource issue(s) identified. Sorted by severity — critical items require immediate action.`,
          20,
          y,
        );
        y += 8;

        // Severity legend row
        const sevOrder = ["critical", "high", "medium", "low"] as const;
        const sevCounts: Record<string, number> = {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        };
        for (const ri of allResourceIssues) {
          if (ri.severity in sevCounts) sevCounts[ri.severity]++;
        }
        const lgdW = (pw - 40 - 9) / 4;
        sevOrder.forEach((sev, i) => {
          const lx = 20 + i * (lgdW + 3);
          const bg = sevBg(sev);
          const col = sevColor(sev);
          doc.setFillColor(...bg);
          doc.roundedRect(lx, y, lgdW, 14, 2, 2, "F");
          doc.setDrawColor(...col);
          doc.setLineWidth(0.5);
          doc.roundedRect(lx, y, lgdW, 14, 2, 2, "S");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(...col);
          doc.text(String(sevCounts[sev]), lx + lgdW / 2, y + 8, {
            align: "center",
          });
          doc.setFontSize(6.5);
          doc.setTextColor(...K.darkGrey);
          doc.text(
            sev.charAt(0).toUpperCase() + sev.slice(1),
            lx + lgdW / 2,
            y + 12.5,
            { align: "center" },
          );
        });
        y += 20;

        // Card per issue (sorted by severity)
        const sevRank: Record<string, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        const sortedIssues = [...allResourceIssues].sort(
          (a, b) => (sevRank[a.severity] || 4) - (sevRank[b.severity] || 4),
        );

        for (const ri of sortedIssues.slice(0, 40)) {
          const sev = ri.severity || "low";
          const col = sevColor(sev);
          const bg = sevBg(sev);
          const typeLabel = (ri.type || "issue")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          const descText = (ri.description || "").substring(0, 120);
          const recText = (ri.recommendation || "").substring(0, 120);
          const pageShort = (ri.pageTitle || ri.pageUrl || "").substring(0, 50);

          // Measure card height
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          const descLines = doc.splitTextToSize(descText, pw - 62);
          const recLines = doc.splitTextToSize(`Fix: ${recText}`, pw - 62);
          const cardH = 9 + descLines.length * 3.5 + recLines.length * 3.5 + 10;

          if (y + cardH > ph - 18) {
            doc.addPage();
            y = 18;
          }

          // Card background + severity left border
          doc.setFillColor(...K.offWhite);
          doc.roundedRect(20, y, pw - 40, cardH, 2, 2, "F");
          doc.setFillColor(...col);
          doc.roundedRect(20, y, 4, cardH, 1, 1, "F");
          doc.setDrawColor(...K.lightGrey);
          doc.setLineWidth(0.2);
          doc.roundedRect(20, y, pw - 40, cardH, 2, 2, "S");

          // Severity badge
          doc.setFillColor(...col);
          doc.roundedRect(28, y + 3, 18, 5.5, 1, 1, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.setTextColor(...K.white);
          doc.text(sev.toUpperCase(), 37, y + 7, { align: "center" });

          // Issue type label
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(...K.navy);
          doc.text(typeLabel, 50, y + 7);

          // Page label (right-aligned)
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(...K.midGrey);
          doc.text(pageShort, pw - 22, y + 7, { align: "right" });

          let cy = y + 12;

          // Description
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...K.nearBlack);
          doc.text(descLines, 28, cy);
          cy += descLines.length * 3.5 + 2;

          // Recommendation
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          doc.setTextColor(0, 110, 81);
          doc.text(recLines, 28, cy);

          y += cardH + 4;
        }

        if (sortedIssues.length > 40) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(...K.midGrey);
          doc.text(
            `... and ${sortedIssues.length - 40} more issue(s). See the full report in the web dashboard.`,
            20,
            y,
          );
          y += 8;
        }
        y += 6;
      }

      // Recommendations
      const recs = (perfResult.recommendations || []) as RecommendationItem[];
      if (recs.length > 0) {
        if (y > ph - 60) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...K.blue);
        doc.text(`${perfSectionNum}.2 Performance Recommendations`, 20, y);
        y += 8;
        autoTable(doc, {
          startY: y,
          head: [["Priority", "Recommendation", "Effort", "Impact"]],
          body: recs
            .slice(0, 15)
            .map((r) => [
              r.priority,
              `${r.title} — ${r.detail}`.substring(0, 80),
              r.effort,
              r.impact,
            ]),
          headStyles: {
            fillColor: [0, 110, 81],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: { fontSize: 8, textColor: K.nearBlack },
          alternateRowStyles: { fillColor: K.offWhite },
          columnStyles: {
            0: { cellWidth: 16 },
            1: { cellWidth: 110 },
            2: { cellWidth: 32 },
            3: { cellWidth: 20 },
          },
          margin: { left: 20, right: 20 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Auth flow
      if (perfResult.authFlow && perfResult.authFlow.status !== "skipped") {
        if (y > ph - 60) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...K.blue);
        doc.text(`${perfSectionNum}.3 Authentication Flow Timing`, 20, y);
        y += 8;
        const af = perfResult.authFlow;
        autoTable(doc, {
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Status", (af.status || "").toUpperCase()],
            [
              "Time to Form (ms)",
              af.timeToFormMs != null
                ? String(Math.round(af.timeToFormMs))
                : "—",
            ],
            [
              "Submit to Response (ms)",
              af.submitToResponseMs != null
                ? String(Math.round(af.submitToResponseMs))
                : "—",
            ],
            [
              "Response to Interactive (ms)",
              af.responseToInteractiveMs != null
                ? String(Math.round(af.responseToInteractiveMs))
                : "—",
            ],
            [
              "Total Round Trip (ms)",
              af.totalRoundTripMs != null
                ? String(Math.round(af.totalRoundTripMs))
                : "—",
            ],
          ],
          headStyles: {
            fillColor: K.navy,
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: { fontSize: 9, textColor: K.nearBlack },
          alternateRowStyles: { fillColor: K.offWhite },
          margin: { left: 20, right: 20 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Network simulation
      if (perfResult.networkSimulation?.length > 0) {
        if (y > ph - 60) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...K.blue);
        doc.text(`${perfSectionNum}.4 Network Simulation`, 20, y);
        y += 8;
        autoTable(doc, {
          startY: y,
          head: [["Condition", "LCP (ms)", "FCP (ms)", "TTFB (ms)", "Score"]],
          body: (perfResult.networkSimulation as any[]).map((sim: any) => [
            sim.label || sim.preset,
            sim.lcp != null ? String(Math.round(sim.lcp)) : "—",
            sim.fcp != null ? String(Math.round(sim.fcp)) : "—",
            sim.ttfb != null ? String(Math.round(sim.ttfb)) : "—",
            sim.score != null ? String(sim.score) : "—",
          ]),
          headStyles: {
            fillColor: K.navy,
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: { fontSize: 9, textColor: K.nearBlack },
          alternateRowStyles: { fillColor: K.offWhite },
          margin: { left: 20, right: 20 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Client-reported confirmed issues
      if (perfResult.confirmedClientIssues?.length > 0) {
        if (y > ph - 60) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...K.blue);
        doc.text(
          `${perfSectionNum}.5 Client-Reported Issue Verification`,
          20,
          y,
        );
        y += 8;
        autoTable(doc, {
          startY: y,
          head: [["Reported Issue", "Status", "Summary", "Evidence"]],
          body: (perfResult.confirmedClientIssues as any[]).map((ci: any) => [
            ci.flagLabel || ci.flag,
            (ci.status || "").toUpperCase(),
            (ci.summary || "").substring(0, 60),
            (ci.evidence || "").substring(0, 60),
          ]),
          headStyles: {
            fillColor: K.navy,
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: { fontSize: 8, textColor: K.nearBlack },
          alternateRowStyles: { fillColor: K.offWhite },
          margin: { left: 20, right: 20 },
          theme: "grid",
        });
      }
    }
  }

  // ── PRIVACY SECTION ──────────────────────────────────────────
  if (isPriv2) {
    const privResult = (audit as any).pillarResults?.privacy;
    const privSectionNum =
      isA11y && isDP && isPerf
        ? "10"
        : isA11y && isDP
          ? "9"
          : isA11y || isDP || isPerf
            ? "3"
            : "2";
    doc.addPage();
    y = 18;
    y = sectionHeading(doc, privSectionNum, "Privacy & Compliance Findings", y);

    if (!privResult) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...K.midGrey);
      doc.text("No privacy data available for this audit.", 20, y + 8);
    } else {
      const privFindings: any[] = privResult.findings || [];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...K.darkGrey);
      doc.text(
        `${privFindings.length} finding(s). Score: ${privResult.overallScore ?? "—"}/100. Trackers: ${privResult.totalTrackers ?? 0}. Consent banner: ${privResult.hasConsentBanner ? "Present" : "Missing"}.`,
        20,
        y,
      );
      y += 10;

      if (privFindings.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [
            ["#", "Finding", "Category", "Regulation", "Severity", "Page"],
          ],
          body: privFindings
            .slice(0, 30)
            .map((f: any, idx: number) => [
              `#${String(idx + 1).padStart(3, "0")}`,
              (f.title || "—").substring(0, 40),
              (f.category || "—").substring(0, 20),
              Array.isArray(f.regulation)
                ? f.regulation.slice(0, 2).join(", ")
                : f.regulation || "—",
              (f.severity || "—").toUpperCase(),
              (f.pageUrl || "/")
                .replace(/^https?:\/\/[^/]+/, "")
                .substring(0, 25) || "/",
            ]),
          headStyles: {
            fillColor: [180, 83, 9],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: { fontSize: 8, textColor: K.nearBlack },
          alternateRowStyles: { fillColor: K.offWhite },
          margin: { left: 20, right: 20 },
          theme: "grid",
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Trackers
      const trackers = (privResult.trackers || []) as any[];
      if (trackers.length > 0) {
        if (y > ph - 60) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...K.blue);
        doc.text(`${privSectionNum}.1 Trackers Detected`, 20, y);
        y += 8;
        autoTable(doc, {
          startY: y,
          head: [["Tracker Domain", "Company", "Category", "Requests"]],
          body: trackers
            .slice(0, 20)
            .map((t: any) => [
              t.domain || "—",
              t.company || "—",
              t.category || "—",
              String(t.requestCount || 0),
            ]),
          headStyles: {
            fillColor: K.navy,
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          bodyStyles: { fontSize: 9, textColor: K.nearBlack },
          alternateRowStyles: { fillColor: K.offWhite },
          margin: { left: 20, right: 20 },
          theme: "grid",
        });
      }
    }
  }

  // Footer on all pages
  addKpmgFooter(doc, footerLabel);
  return Buffer.from(doc.output("arraybuffer"));
}
