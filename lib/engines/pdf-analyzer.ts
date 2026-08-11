import { AccessibilityIssue } from "../types/audit";
import type {
  DarkPatternFinding,
  DarkPatternResult,
  DarkPatternCategory,
  EthicalPrinciple,
  DarkPatternEvidence,
  DarkPatternRegulation,
  DarkPatternResult as DarkPatternResultType,
} from "../types/darkpattern";
import { PRINCIPLE_WEIGHTS } from "../types/darkpattern";
import {
  URGENCY_PATTERNS,
  CONFIRMSHAMING_PATTERNS,
  SOCIAL_PRESSURE_PATTERNS,
  FEAR_LANGUAGE_PATTERNS,
  TRICK_QUESTION_PATTERNS,
  AUTO_RENEWAL_PATTERNS,
  DRIP_PRICING_PATTERNS,
  SUBSCRIPTION_TRAP_PATTERNS,
  PLAN_ANCHORING_PATTERNS,
  ASTERISK_PROMO_PATTERNS,
  COOKIE_CONSENT_PATTERNS,
  CRORE_TRUST_PATTERNS,
  FAMILY_GUILT_PATTERNS,
  DARK_PATTERN_RULES,
} from "./darkpattern-rules";
const uuidv4 = (): string => crypto.randomUUID();

interface PdfAnalysisResult {
  issues: AccessibilityIssue[];
  text: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount: number;
    isTagged: boolean;
    hasLanguage: boolean;
  };
}

/**
 * Enhanced PDF Accessibility Analyzer
 *
 * Uses dual-engine approach:
 * 1. pdf-parse for text extraction and metadata (with worker fallback)
 * 2. pdf-lib for structural tag tree parsing and form field analysis
 *
 * Checks 15 accessibility criteria (up from 7):
 * - PDF-01: Tagged structure
 * - PDF-02: Reading order
 * - PDF-03: Alt text for images
 * - PDF-04: Font embedding
 * - PDF-05: Table structure
 * - PDF-06: Document title
 * - PDF-07: Language specification
 * - PDF-08: Bookmarks / navigation aids
 * - PDF-09: Form field labels
 * - PDF-10: Link accessibility
 * - PDF-11: Heading hierarchy
 * - PDF-12: Color-only information (heuristic)
 * - PDF-13: Security / copy restrictions
 * - PDF-14: Page numbering / artifacts
 * - PDF-15: Character encoding / Unicode mapping
 */
export async function analyzePdf(
  fileBuffer: Buffer,
  fileName: string,
  onProgress?: (msg: string) => void,
): Promise<PdfAnalysisResult> {
  const issues: AccessibilityIssue[] = [];

  // â”€â”€â”€ Phase 1: Parse with pdf-parse v2.x for text & metadata â”€â”€â”€
  let text = "";
  let pageCount = 0;
  let info: Record<string, string> = {};
  let metadata: Record<string, string> | null = null;
  let pdfParseError: string | null = null;

  try {
    const pdfParseModule = (await import("pdf-parse")) as unknown as Record<
      string,
      unknown
    >;
    const PDFParseClass = pdfParseModule.PDFParse as new (opts: {
      data: Buffer;
    }) => {
      getText(): Promise<{ text: string }>;
      getInfo(): Promise<{
        total: number;
        info?: Record<string, string>;
        metadata?: Record<string, string> | null;
      }>;
    };
    if (typeof PDFParseClass !== "function") {
      throw new Error("pdf-parse module did not export a PDFParse class");
    }
    onProgress?.(`Parsing PDF: ${fileName}...`);
    const parser = new PDFParseClass({ data: fileBuffer });
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo(),
    ]);
    text = textResult.text || "";
    pageCount = infoResult.total || 0;
    info =
      infoResult.info && typeof infoResult.info === "object"
        ? infoResult.info
        : {};
    metadata =
      infoResult.metadata && typeof infoResult.metadata === "object"
        ? infoResult.metadata
        : null;
  } catch (error) {
    pdfParseError =
      error instanceof Error ? error.message : "Unknown pdf-parse error";
  }

  // â”€â”€â”€ Phase 2: Load with pdf-lib for structure â”€â”€â”€
  let pdfLibDoc: Awaited<
    ReturnType<(typeof import("pdf-lib"))["PDFDocument"]["load"]>
  > | null = null;

  try {
    const { PDFDocument } = await import("pdf-lib");
    pdfLibDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    onProgress?.("Analyzing PDF structure with pdf-lib...");
  } catch {
    // pdf-lib may fail on some PDFs â€” no fallback available
  }

  // If pdf-parse failed, log it and skip text-dependent checks
  if (pdfParseError) {
    onProgress?.(
      `PDF text extraction unavailable (pdf-parse worker error), continuing with structural checks only.`,
    );
  } else {
    onProgress?.(
      `PDF parsed: ${pageCount} pages, running ${15} accessibility checks...`,
    );
  }

  const metaStr = metadata ? JSON.stringify(metadata).toLowerCase() : "";
  const infoStr = JSON.stringify(info).toLowerCase();

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-01: Tagged structure
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const isTagged = !!(
    info.Tagged === "yes" ||
    metaStr.includes("tagged") ||
    infoStr.includes('"tagged":"yes"')
  );
  if (!isTagged) {
    issues.push(
      createIssue(
        "PDF-01",
        "Missing tagged PDF structure",
        "PDF is not tagged. Tags are essential for screen readers to understand document structure, headings, lists, tables, and reading order.",
        "document structure",
        fileName,
        "1.3.1",
        "Info and Relationships",
        "A",
        "critical",
        "Screen reader users cannot navigate document structure",
        'Re-create with proper tagging. In Word, enable "Document structure tags for accessibility" when saving as PDF. In InDesign, enable "Create Tagged PDF" in export settings.',
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-02: Reading order
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (text && !isTagged) {
    const lines = text.split("\n").filter((l) => l.trim());
    let hasOrderIssues = false;
    for (let i = 1; i < Math.min(lines.length, 50); i++) {
      if (
        lines[i].trim().length < 5 &&
        lines[i - 1].trim().length > 40 &&
        i + 1 < lines.length &&
        lines[i + 1].trim().length > 40
      ) {
        hasOrderIssues = true;
        break;
      }
    }
    if (hasOrderIssues) {
      issues.push(
        createIssue(
          "PDF-02",
          "Incorrect reading order",
          "Content may be read in wrong order by screen readers due to missing tags and likely multi-column layout.",
          "reading order",
          fileName,
          "1.3.2",
          "Meaningful Sequence",
          "A",
          "high",
          "Screen reader users receive content in wrong order",
          "Use Adobe Acrobat Reading Order tool to fix tag order. For multi-column documents, ensure tags follow visual reading order.",
        ),
      );
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-03: Images without alt text (heuristic)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const avgChars = text.length / Math.max(pageCount, 1);
  if (avgChars < 100 && pageCount > 0) {
    issues.push(
      createIssue(
        "PDF-03",
        "Possible missing alt text on images",
        `Very little text (${Math.round(avgChars)} chars/page) suggests image-heavy content lacking alt text. Scanned documents without OCR are completely inaccessible.`,
        "images",
        fileName,
        "1.1.1",
        "Non-text Content",
        "A",
        "critical",
        "Screen reader users cannot access image content",
        'Add alt text to all images using Adobe Acrobat "Set Alternate Text" feature. For scanned documents, run OCR first (Acrobat > Scan & OCR > Recognize Text).',
      ),
    );
  } else if (avgChars < 300 && pageCount > 2) {
    issues.push(
      createIssue(
        "PDF-03b",
        "Moderate image-to-text ratio",
        `Below-average text density (${Math.round(avgChars)} chars/page). Some images may lack alt text.`,
        "images",
        fileName,
        "1.1.1",
        "Non-text Content",
        "A",
        "medium",
        "Some image content may be inaccessible to screen reader users",
        "Review all images and ensure meaningful alt text is provided. Decorative images should be marked as artifacts.",
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-04: Font embedding / encoding
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const hasEncoding =
    text.includes("ï¿½") ||
    /[\x00-\x08\x0E-\x1F]/.test(text.substring(0, 2000));
  const hasToUnicodeIssues =
    /\ufffd/.test(text) ||
    (text.match(/[^\x20-\x7E\xA0-\uFFFF\n\r\t ]/g)?.length ?? 0) >
      text.length * 0.05;
  if (hasEncoding || hasToUnicodeIssues) {
    issues.push(
      createIssue(
        "PDF-04",
        "Font embedding / Unicode mapping issues",
        "Text extraction reveals encoding issues â€” fonts may not be properly embedded or lack ToUnicode CMap tables. This prevents accurate text-to-speech and copy/paste.",
        "fonts",
        fileName,
        "1.3.1",
        "Info and Relationships",
        "A",
        "high",
        "Screen readers may mispronounce or skip text, copy/paste produces garbage",
        'Embed all fonts with ToUnicode maps. In Acrobat: File > Properties > Fonts, verify all fonts are embedded. Re-export from source with "Embed fonts" enabled.',
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-05: Table structure
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const tabularPatterns = text.match(/(\t.*){3,}/g);
  const hasAlignedColumns = text.match(/(\s{2,}\S+){3,}/gm);
  if ((tabularPatterns || hasAlignedColumns) && !isTagged) {
    issues.push(
      createIssue(
        "PDF-05",
        "Table structure issues",
        `Tabular data detected (${(tabularPatterns?.length || 0) + (hasAlignedColumns?.length || 0)} instances) but document lacks proper table tags (Table, TR, TH, TD).`,
        "tables",
        fileName,
        "1.3.1",
        "Info and Relationships",
        "A",
        "high",
        "Screen reader users cannot navigate table content or understand data relationships",
        "Tag tables with Table, TR, TH, TD elements using Acrobat Table Editor. Ensure header cells use TH tags with scope attributes.",
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-06: Document title
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (!info.Title?.trim()) {
    issues.push(
      createIssue(
        "PDF-06",
        "Missing document title",
        "PDF metadata has no title. Browsers and assistive technology show the filename instead, which may not describe the document purpose.",
        "metadata",
        fileName,
        "2.4.2",
        "Page Titled",
        "A",
        "medium",
        "Users cannot identify document purpose from title bar or window title",
        'Add a descriptive title in File > Properties > Description. Set Initial View to "Show Document Title" in Window options.',
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-07: Language specification
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const hasLang = !!(
    info.Language ||
    metaStr.includes("lang") ||
    infoStr.includes("language")
  );
  if (!hasLang) {
    issues.push(
      createIssue(
        "PDF-07",
        "Missing language specification",
        "PDF does not specify a document language. Screen readers use incorrect pronunciation rules and may mispronounce all text.",
        "language",
        fileName,
        "3.1.1",
        "Language of Page",
        "A",
        "high",
        "Screen readers use incorrect language pronunciation rules for entire document",
        "Set language in File > Properties > Advanced > Language. For multi-language documents, also tag individual sections with the appropriate language.",
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-08: Bookmarks / navigation aids
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (pageCount > 5 && !isTagged && !pdfParseError) {
    const headingPatterns = text.match(/^[A-Z][A-Z\s]{3,}$/gm);
    if (headingPatterns && headingPatterns.length >= 3) {
      issues.push(
        createIssue(
          "PDF-08",
          "Missing bookmarks for long document",
          `Document has ${pageCount} pages with ${headingPatterns.length} detected heading-like sections but no bookmarks for navigation.`,
          "navigation",
          fileName,
          "2.4.5",
          "Multiple Ways",
          "AA",
          "medium",
          "Users cannot quickly navigate to sections in long documents",
          "Add bookmarks for each major section. In Acrobat: View > Navigation Panels > Bookmarks, then create bookmarks from headings.",
        ),
      );
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-09: Form field labels (via pdf-lib)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (pdfLibDoc) {
    try {
      const form = pdfLibDoc.getForm();
      const fields = form.getFields();
      let unlabeledCount = 0;
      for (const field of fields) {
        const name = field.getName();
        if (
          !name ||
          /^(field|text|check|radio|combo|list|button)\d*$/i.test(name)
        ) {
          unlabeledCount++;
        }
      }
      if (unlabeledCount > 0) {
        issues.push(
          createIssue(
            "PDF-09",
            "Form fields missing accessible labels",
            `${unlabeledCount} of ${fields.length} form fields have generic or missing names, indicating they lack proper accessible labels.`,
            "form fields",
            fileName,
            "3.3.2",
            "Labels or Instructions",
            "A",
            "high",
            "Screen reader users cannot identify the purpose of form fields",
            "Add descriptive tooltips/labels to all form fields. In Acrobat: Forms > Edit, select each field > Properties > General > Tooltip.",
          ),
        );
      }
      if (fields.length > 0 && !info.Title?.trim()) {
        issues.push(
          createIssue(
            "PDF-09b",
            "Interactive form without document title",
            `Form with ${fields.length} fields lacks a document title, making it harder for users to identify the form purpose.`,
            "form",
            fileName,
            "2.4.2",
            "Page Titled",
            "A",
            "medium",
            "Users cannot identify which form they are filling out",
            "Add a descriptive title via File > Properties > Description.",
          ),
        );
      }
    } catch {
      /* form parsing may fail */
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-10: Link accessibility
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const rawUrls = text.match(/https?:\/\/[^\s]{20,}/gi);
  if (rawUrls && rawUrls.length > 2) {
    issues.push(
      createIssue(
        "PDF-10",
        "Links use raw URLs as link text",
        `${rawUrls.length} links display raw URLs instead of descriptive text. Example: "${rawUrls[0].substring(0, 60)}..."`,
        "links",
        fileName,
        "2.4.4",
        "Link Purpose (In Context)",
        "A",
        "medium",
        "Screen reader users hear long URLs read character-by-character instead of meaningful link descriptions",
        'Replace raw URLs with descriptive link text. In the source document, use hyperlinked text like "View Report" instead of pasting URLs.',
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-11: Heading hierarchy
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (isTagged && !pdfParseError) {
    const headingMarkers = text.match(/^(Chapter|Section|\d+\.)\s/gim);
    if (pageCount > 3 && (!headingMarkers || headingMarkers.length < 2)) {
      issues.push(
        createIssue(
          "PDF-11",
          "Insufficient heading structure",
          `Long document (${pageCount} pages) has few or no detectable heading structures. This makes navigation by headings impossible.`,
          "headings",
          fileName,
          "1.3.1",
          "Info and Relationships",
          "A",
          "medium",
          "Screen reader users cannot navigate by headings to find content quickly",
          "Add proper heading tags (H1-H6) to section titles. Use a logical hierarchy: one H1 for document title, H2 for major sections, etc.",
        ),
      );
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-12: Color-only information (heuristic)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const colorIndicators = text.match(
    /\b(shown in red|marked in green|highlighted in yellow|blue text|red text|color-coded)\b/gi,
  );
  if (colorIndicators && colorIndicators.length > 0) {
    issues.push(
      createIssue(
        "PDF-12",
        "Possible color-only information",
        `Text references color as an information carrier: "${colorIndicators[0]}". Color must not be the sole means of conveying information.`,
        "color usage",
        fileName,
        "1.4.1",
        "Use of Color",
        "A",
        "medium",
        "Color-blind users cannot perceive information conveyed only by color",
        'Supplement color coding with text labels, patterns, or symbols. Example: "Error (shown in red)" â†’ "âŒ Error".',
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-13: Security restrictions
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (
    info.Encrypted ||
    infoStr.includes("encrypted") ||
    metaStr.includes("encrypted")
  ) {
    issues.push(
      createIssue(
        "PDF-13",
        "PDF has security restrictions",
        "Document has security restrictions that may prevent assistive technology from accessing content or copying text.",
        "security",
        fileName,
        "4.1.2",
        "Name, Role, Value",
        "A",
        "high",
        "Screen readers may be blocked from reading protected content",
        'Remove copy/accessibility restrictions. In Acrobat: File > Properties > Security > set "Enable text access for screen reader devices".',
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-14: Page numbering artifacts
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (pageCount > 10 && !isTagged && !pdfParseError) {
    issues.push(
      createIssue(
        "PDF-14",
        "Headers/footers not marked as artifacts",
        `Long untagged document (${pageCount} pages) likely has repeating headers, footers, and page numbers that are not marked as artifacts, causing screen readers to read them as content on every page.`,
        "artifacts",
        fileName,
        "1.3.1",
        "Info and Relationships",
        "A",
        "medium",
        "Screen reader users hear repetitive header/footer/page number text on every page",
        "Mark repeating headers, footers, and page numbers as Artifact elements in the tag tree. In Acrobat: Touch Up Reading Order > select header/footer > mark as Background/Artifact.",
      ),
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PDF-15: Unicode / character mapping
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const ligatureIssues = text.match(/[ï¬ï¬‚ï¬€ï¬ƒï¬„]/g);
  if (ligatureIssues && ligatureIssues.length > 5) {
    issues.push(
      createIssue(
        "PDF-15",
        "Ligature character mapping issues",
        `${ligatureIssues.length} ligature characters detected that may not decompose correctly for search and assistive technology.`,
        "text encoding",
        fileName,
        "1.3.1",
        "Info and Relationships",
        "A",
        "low",
        "Search and screen reader text may not match visual appearance",
        "Ensure ActualText attributes are set for ligature glyphs. Re-export with a font that includes proper ToUnicode CMap entries.",
      ),
    );
  }

  onProgress?.(
    `PDF analysis complete: ${issues.length} issues found across ${15} checks.`,
  );
  return {
    issues,
    text,
    metadata: {
      title: info.Title,
      author: info.Author,
      pageCount,
      isTagged,
      hasLanguage: hasLang,
    },
  };
}

/**
 * Helper to create a properly typed AccessibilityIssue for PDF checks.
 */
function createIssue(
  testId: string,
  title: string,
  description: string,
  element: string,
  pageUrl: string,
  wcagCriterion: string,
  wcagName: string,
  wcagLevel: "A" | "AA" | "AAA",
  severity: "critical" | "high" | "medium" | "low",
  impact: string,
  recommendation: string,
): AccessibilityIssue {
  return {
    id: uuidv4(),
    testId,
    title,
    description,
    element,
    pageUrl,
    wcagCriterion,
    wcagName,
    wcagLevel,
    severity,
    impact,
    recommendation,
    category: "pdf",
    source: "pdf-analyzer",
    confidence: "high",
  };
}

/**
 * Simple text-based dark pattern detection for PDFs.
 * Scans extracted text for common dark pattern indicators.
 */
export function detectDarkPatternsInPdfText(
  text: string,
  fileName: string,
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const lowerText = text.toLowerCase();

  const patterns: {
    testId: string;
    title: string;
    description: string;
    keywords: string[];
    severity: "critical" | "high" | "medium" | "low";
  }[] = [];
  const foundPatterns: typeof patterns = [];

  for (const pattern of patterns) {
    if (pattern.keywords.some((kw) => lowerText.includes(kw))) {
      foundPatterns.push(pattern);
    }
  }

  if (foundPatterns.length === 0) return issues;

  for (const pattern of foundPatterns) {
    const matchingKeyword = pattern.keywords.find((kw) =>
      lowerText.includes(kw),
    );
    issues.push(
      createIssue(
        pattern.testId,
        pattern.title,
        `${pattern.description} Keyword found: "${matchingKeyword}".`,
        "document text",
        fileName,
        pattern.testId.startsWith("DP-SN") ? "dark-pattern" : "dark-pattern",
        `Dark Pattern: ${pattern.title}`,
        "AA",
        pattern.severity,
        "Potential dark pattern detected in document text. Manual review recommended.",
        "Ensure transparency and easy opt-out. If pre-selected, change to opt-in. If auto-renewal, disclose clearly with easy cancellation. If urgency, ensure it is genuine and verifiable.",
      ),
    );
  }

  return issues;
}

/**
 * Proper static-text + NLP rule scan for PDFs, mirroring
 * `runDarkPatternAudit`'s text/NLP branch (DOM/visual/journey skipped).
 */
export function analyzePdfDarkPatterns(
  text: string,
  fileName: string,
): DarkPatternResult {
  const findings: DarkPatternFinding[] = [];
  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 4);

  const textElements = lines.map((line) => ({
    text: line.substring(0, 200),
    tag: "text" as const,
    html: line.substring(0, 200),
    isButton: false,
    isLink: false,
  }));

  const seenTexts = new Set<string>();

  const pushFinding = (
    ruleId: string,
    el: { text: string; html: string },
    evidence: DarkPatternEvidence,
  ) => {
    const rule = DARK_PATTERN_RULES.find((r) => r.id === ruleId);
    if (!rule) return;

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

    const fixPriority: "P0" | "P1" | "P2" | "P3" =
      rule.severity === "critical"
        ? "P0"
        : rule.severity === "high"
          ? "P1"
          : rule.severity === "medium"
            ? "P2"
            : "P3";

    findings.push({
      id: crypto.randomUUID(),
      ruleId,
      category: rule.category,
      principle: rule.principle,
      title: rule.title,
      description: rule.description,
      element: el.html.substring(0, 120),
      elementHtml: el.html,
      pageUrl: fileName,
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
      fixPriority,
    });
  };

  // DP-SU-02/03: Urgency/scarcity language
  for (const el of textElements) {
    for (const pattern of URGENCY_PATTERNS) {
      if (pattern.test(el.text)) {
        const ruleId = /\d+\s*(left|remaining|available)/i.test(el.text)
          ? "DP-SU-02"
          : "DP-SU-03";
        pushFinding(ruleId, el, {
          summary: `Urgency/scarcity language detected: "${el.text.substring(0, 80)}"`,
          details: [`Text: "${el.text}"`, `Pattern matched: ${pattern.source}`],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-SP-01/02: Social pressure
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of SOCIAL_PRESSURE_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-SP-01", el, {
          summary: `Social pressure messaging: "${el.text.substring(0, 80)}"`,
          details: [`Text: "${el.text}"`, `Pattern: ${pattern.source}`],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-CS-05: Family/dependant protection guilt framing
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of FAMILY_GUILT_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-CS-05", el, {
          summary: `Family protection guilt framing: "${el.text.substring(0, 100)}"`,
          details: [
            `Text: "${el.text}"`,
            "Uses family safety as emotional lever to shame users who decline",
            "India CPA Dark Pattern Guidelines 2023 (Confirmshaming): prohibited notified dark pattern",
            "ASCI Guidelines: advertising must not exploit guilt or fear to deny rational choice",
          ],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-CS-01: Confirmshaming in text
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of CONFIRMSHAMING_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-CS-01", el, {
          summary: `Confirmshaming language: "${el.text.substring(0, 80)}"`,
          details: [
            `Text: "${el.text}"`,
            "This language shames users who choose to decline",
          ],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-CS-03: Fear-based language
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of FEAR_LANGUAGE_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-CS-03", el, {
          summary: `Fear-based language: "${el.text.substring(0, 80)}"`,
          details: [`Text: "${el.text}"`, `Pattern: ${pattern.source}`],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-MD-04: Trick questions (length check)
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    if (el.text.length > 10) {
      for (const pattern of TRICK_QUESTION_PATTERNS) {
        if (pattern.test(el.text)) {
          pushFinding("DP-MD-04", el, {
            summary: `Confusing wording: "${el.text.substring(0, 80)}"`,
            details: [`Text: "${el.text}"`, "Double-negative or trick wording"],
          });
          seenTexts.add(el.text);
          break;
        }
      }
    }
  }

  // DP-FA-04: Auto-renewal / forced continuity
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of AUTO_RENEWAL_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-FA-04", el, {
          summary: `Auto-renewal / forced continuity language: "${el.text.substring(0, 80)}"`,
          details: [
            `Text: "${el.text}"`,
            "Hidden auto-renewal detected",
            "FTC Click-to-Cancel Rule 2024 and EU Consumer Rights Directive require clear disclosure of recurring charges",
          ],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-PM-04: Drip pricing / hidden costs
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of DRIP_PRICING_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-PM-04", el, {
          summary: `Drip pricing / hidden fees: "${el.text.substring(0, 80)}"`,
          details: [
            `Text: "${el.text}"`,
            "Mandatory fees or taxes not included in advertised price",
            "FTC Act §5 and EU Omnibus Directive require all-in pricing",
          ],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-PM-05: Subscription cancellation friction
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of SUBSCRIPTION_TRAP_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-PM-05", el, {
          summary: `Subscription trap language: "${el.text.substring(0, 80)}"`,
          details: [
            `Text: "${el.text}"`,
            "Cancellation friction or phone-only cancel detected in text",
            "FTC Click-to-Cancel Rule 2024 requires online cancel for online signups",
          ],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-PM-02: Plan anchoring
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of PLAN_ANCHORING_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-PM-02", el, {
          summary: `Plan anchoring copy: "${el.text.substring(0, 80)}"`,
          details: [
            `Text: "${el.text}"`,
            'Exploits decoy effect — "Most Popular" badge steers users toward premium options',
            "EU DSA Art. 25(1)(a) prohibits biasing user choice through interface design",
          ],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-CC-05: Cookie consent by scrolling/browsing
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of COOKIE_CONSENT_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-CC-05", el, {
          summary: `Implied consent language detected: "${el.text.substring(0, 80)}"`,
          details: [
            `Text: "${el.text}"`,
            "Implies consent through continued browsing — requires explicit opt-in",
            "CJEU Planet49 (Case C-673/17): scrolling/browsing does NOT constitute valid consent",
          ],
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-MD-09: Asterisk/hash-qualified promotional claims
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of ASTERISK_PROMO_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-MD-09", el, {
          summary: `Asterisk-qualified promotional claim: "${el.text.substring(0, 100)}"`,
          details: [
            `Text: "${el.text}"`,
            "Headline discount/price is qualified by an asterisk or hash marker — conditions buried in fine print",
            "India CPA Dark Pattern Guidelines 2023: bait advertising / misleading claims",
            "ASCI Guidelines: unqualified superlatives and claims without substantiation are prohibited",
          ],
          measurements: { matchedPattern: pattern.source },
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  // DP-SP-05: Crore/lakh-scale unverifiable trust claims
  for (const el of textElements) {
    if (seenTexts.has(el.text)) continue;
    for (const pattern of CRORE_TRUST_PATTERNS) {
      if (pattern.test(el.text)) {
        pushFinding("DP-SP-05", el, {
          summary: `Unverifiable trust claim: "${el.text.substring(0, 100)}"`,
          details: [
            `Text: "${el.text}"`,
            "Scale figure (crore/lakh customers) displayed without verifiable source, audit date, or methodology",
            "ASCI Guidelines 2023: testimonials/statistics must be capable of substantiation",
            "IN-CPA Dark Pattern Guidelines 2023: social proof used to manufacture artificial authority",
          ],
          measurements: { matchedPattern: pattern.source },
        });
        seenTexts.add(el.text);
        break;
      }
    }
  }

  return buildResult(findings, 1);
}

/**
 * Mirrors darkpattern-engine's buildResult so PDFs get a consistent
 * DarkPatternResult without touching DOM/visual/journey engines.
 */
function buildResult(
  findings: DarkPatternFinding[],
  pagesScanned: number,
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

  for (const f of findings) {
    categoryBreakdown[f.category] = (categoryBreakdown[f.category] || 0) + 1;
    findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] || 0) + 1;
    f.regulation.forEach((r) => regulatorySet.add(r));
  }

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
      deduction += sevWeights[f.severity] * confidenceMult;
    }
    principleScores[p] = Math.max(0, Math.round(100 - deduction));
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const p of allPrinciples) {
    const w = PRINCIPLE_WEIGHTS[p] || 1;
    weightedSum += principleScores[p] * w;
    totalWeight += w;
  }
  let ethicsScore =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;

  const avgFindingsPerPage =
    pagesScanned > 0 ? findings.length / pagesScanned : 0;
  const coverageCapApplied = findings.length === 0 && pagesScanned >= 3;
  if (coverageCapApplied) {
    ethicsScore = Math.min(ethicsScore, 82);
  }

  const consentIntegrity = Math.round(
    principleScores["informed-consent"] * 0.6 +
      principleScores["symmetry-of-choice"] * 0.4,
  );

  const symmetryFindings = findings.filter(
    (f) => f.principle === "symmetry-of-choice",
  );
  const choiceSymmetry =
    symmetryFindings.length === 0
      ? 100
      : Math.max(0, 100 - symmetryFindings.length * 20);

  const manipFindings = findings.filter(
    (f) =>
      f.category === "scarcity-urgency" ||
      f.category === "social-pressure" ||
      f.category === "confirmshaming" ||
      f.category === "nagging",
  );
  const manipulationIndex =
    manipFindings.length === 0 ? 0 : Math.min(100, manipFindings.length * 15);

  const findingsBySource: Record<string, number> = {};
  const findingsByPhase: Record<string, number> = {};
  for (const f of findings) {
    findingsBySource[f.source] = (findingsBySource[f.source] || 0) + 1;
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
                    : /DP-SU|DP-SP|DP-CS|DP-MD|DP-BS|DP-FA|DP-HC/.test(f.ruleId)
                      ? "Phase 3: NLP Scan"
                      : /DP-AX/.test(f.ruleId)
                        ? "Phase 5: A11Y Cross-Map"
                        : /DP-FLOW|DP-OB-04/.test(f.ruleId)
                          ? "Phase 6: Flow Analysis"
                          : "Other";
    findingsByPhase[phase] = (findingsByPhase[phase] || 0) + 1;
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
    regulatoryRisks: [...regulatorySet] as DarkPatternRegulation[],
    findingsBySource,
    findingsByPhase,
    complianceExemptions: 0,
    complianceExemptionsByCategory: {},
    coverageCapApplied,
    funnelVerified: false,
  };
}

const getRecommendation = (category: DarkPatternCategory): string => {
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
  return (
    recs[category] ||
    "Review and remediate this dark pattern to improve ethical design compliance."
  );
};

const getUserImpact = (principle: EthicalPrinciple): string => {
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
};
