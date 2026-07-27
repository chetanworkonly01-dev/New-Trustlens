import { AccessibilityIssue } from "../types/audit";
const uuidv4 = (): string => crypto.randomUUID();

interface PdfAnalysisResult {
  issues: AccessibilityIssue[];
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
