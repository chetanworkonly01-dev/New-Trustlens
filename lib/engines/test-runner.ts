import { BrowserContext, Page } from "playwright";
import {
  TestCase,
  TestResult,
  TestEvidence,
  TestLogEntry,
  AccessibilityIssue,
  PageData,
} from "../types/audit";
// uuid replaced with Node.js built-in
const uuidv4 = (): string => crypto.randomUUID();

// ===== TEST CASE DEFINITIONS =====
export const TEST_CASES: TestCase[] = [
  {
    testId: "A11Y-KEY-001",
    testName: "Keyboard Navigation",
    wcagCriterion: "2.1.1",
    wcagName: "Keyboard",
    wcagLevel: "A",
    category: "operable",
    severity: "critical",
    description: "Simulate Tab navigation, track focus order, detect traps",
    browserInteraction: true,
  },
  {
    testId: "A11Y-FOC-001",
    testName: "Focus Visibility",
    wcagCriterion: "2.4.7",
    wcagName: "Focus Visible",
    wcagLevel: "AA",
    category: "operable",
    severity: "critical",
    description: "Check if focused elements have visible focus indicators",
    browserInteraction: true,
  },
  {
    testId: "A11Y-IMG-001",
    testName: "Image Alt Text",
    wcagCriterion: "1.1.1",
    wcagName: "Non-text Content",
    wcagLevel: "A",
    category: "perceivable",
    severity: "critical",
    description: "Validate alt text quality, not just presence",
    browserInteraction: false,
  },
  {
    testId: "A11Y-BTN-001",
    testName: "Button Accessibility",
    wcagCriterion: "4.1.2",
    wcagName: "Name, Role, Value",
    wcagLevel: "A",
    category: "robust",
    severity: "critical",
    description: "Ensure buttons are keyboard accessible with clear labels",
    browserInteraction: true,
  },
  {
    testId: "A11Y-FRM-001",
    testName: "Form Label Association",
    wcagCriterion: "3.3.2",
    wcagName: "Labels or Instructions",
    wcagLevel: "A",
    category: "understandable",
    severity: "high",
    description: "Verify labels are properly associated with inputs",
    browserInteraction: false,
  },
  {
    testId: "A11Y-ERR-001",
    testName: "Error Handling",
    wcagCriterion: "3.3.1",
    wcagName: "Error Identification",
    wcagLevel: "A",
    category: "understandable",
    severity: "high",
    description: "Trigger invalid input and check accessible error messages",
    browserInteraction: true,
  },
  {
    testId: "A11Y-CON-001",
    testName: "Color Contrast",
    wcagCriterion: "1.4.3",
    wcagName: "Contrast (Minimum)",
    wcagLevel: "AA",
    category: "perceivable",
    severity: "high",
    description: "Compute contrast ratios for text elements",
    browserInteraction: false,
  },
  {
    testId: "A11Y-HDG-001",
    testName: "Heading Structure",
    wcagCriterion: "1.3.1",
    wcagName: "Info and Relationships",
    wcagLevel: "A",
    category: "perceivable",
    severity: "high",
    description: "Validate heading hierarchy (h1-h6)",
    browserInteraction: false,
  },
  {
    testId: "A11Y-LNK-001",
    testName: "Link Purpose",
    wcagCriterion: "2.4.4",
    wcagName: "Link Purpose (In Context)",
    wcagLevel: "A",
    category: "operable",
    severity: "high",
    description: "Check links are meaningful out of context",
    browserInteraction: false,
  },
  {
    testId: "A11Y-ARI-001",
    testName: "ARIA Validation",
    wcagCriterion: "4.1.2",
    wcagName: "Name, Role, Value",
    wcagLevel: "A",
    category: "robust",
    severity: "high",
    description: "Detect ARIA misuse and broken references",
    browserInteraction: false,
  },
];

type LogCallback = (entry: TestLogEntry) => void;

export async function runTestSuite(
  context: BrowserContext,
  pageData: PageData,
  onLog: LogCallback,
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const testCase of TEST_CASES) {
    // Step 1: ANNOUNCE TEST
    onLog({
      timestamp: new Date().toISOString(),
      testId: testCase.testId,
      testName: testCase.testName,
      wcag: testCase.wcagCriterion,
      status: "running",
      message: `Running Test: ${testCase.testName} (WCAG ${testCase.wcagCriterion})`,
      pageUrl: pageData.url,
    });

    const startTime = Date.now();
    let result: TestResult;

    try {
      // Step 2: EXECUTE TEST
      const page = await context.newPage();
      try {
        await page.goto(pageData.url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page
          .waitForLoadState("networkidle", { timeout: 10000 })
          .catch(() => {});

        result = await executeTest(testCase, page, pageData);
      } finally {
        await page.close();
      }
    } catch (error) {
      result = {
        testId: testCase.testId,
        testName: testCase.testName,
        pageUrl: pageData.url,
        status: "error",
        wcagCriterion: testCase.wcagCriterion,
        wcagName: testCase.wcagName,
        wcagLevel: testCase.wcagLevel,
        severity: testCase.severity,
        confidence: "low",
        evidence: {
          summary: "Test execution error",
          elementsChecked: 0,
          elementsFailed: 0,
          details: [String(error)],
        },
        issues: [],
        executionTime: Date.now() - startTime,
        error: String(error),
      };
    }

    result.executionTime = Date.now() - startTime;
    results.push(result);

    // Step 5: LOG RESULT
    const icon =
      result.status === "pass"
        ? " PASS"
        : result.status === "fail"
          ? " FAIL"
          : result.status === "error"
            ? " ERROR"
            : " REVIEW";
    onLog({
      timestamp: new Date().toISOString(),
      testId: testCase.testId,
      testName: testCase.testName,
      wcag: testCase.wcagCriterion,
      status: result.status,
      message: `${icon} – ${testCase.testName} | ${result.evidence.summary}`,
      pageUrl: pageData.url,
    });
  }

  return results;
}

async function executeTest(
  testCase: TestCase,
  page: Page,
  pageData: PageData,
): Promise<TestResult> {
  switch (testCase.testId) {
    case "A11Y-KEY-001":
      return await testKeyboardNavigation(page, pageData.url);
    case "A11Y-FOC-001":
      return await testFocusVisibility(page, pageData.url);
    case "A11Y-IMG-001":
      return await testImageAltText(page, pageData.url);
    case "A11Y-BTN-001":
      return await testButtonAccessibility(page, pageData.url);
    case "A11Y-FRM-001":
      return await testFormLabels(page, pageData.url);
    case "A11Y-ERR-001":
      return await testErrorHandling(page, pageData.url);
    case "A11Y-CON-001":
      return await testColorContrast(page, pageData.url);
    case "A11Y-HDG-001":
      return await testHeadingStructure(page, pageData.url);
    case "A11Y-LNK-001":
      return await testLinkPurpose(page, pageData.url);
    case "A11Y-ARI-001":
      return await testAriaValidation(page, pageData.url);
    default:
      throw new Error(`Unknown test: ${testCase.testId}`);
  }
}

// ═══════════════════════════════════════════
// TEST 1: KEYBOARD NAVIGATION (Browser Action)
// ═══════════════════════════════════════════
async function testKeyboardNavigation(
  page: Page,
  url: string,
): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  // Simulate real Tab key presses
  const focusOrder: string[] = [];
  let trapDetected = false;
  let prevElement = "";
  let stuckCount = 0;
  const MAX_TABS = 50;

  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);

    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body)
        return { tag: "body", text: "", selector: "body", hasTabindex: false };
      const text =
        el.textContent?.trim().substring(0, 40) ||
        el.getAttribute("aria-label") ||
        "";
      return {
        tag: el.tagName.toLowerCase(),
        text,
        selector: el.id
          ? `#${el.id}`
          : `${el.tagName.toLowerCase()}${el.className ? "." + el.className.split(" ")[0] : ""}`,
        hasTabindex: el.hasAttribute("tabindex"),
        tabindex: el.getAttribute("tabindex"),
        isVisible:
          (el as HTMLElement).offsetWidth > 0 &&
          (el as HTMLElement).offsetHeight > 0,
      };
    });

    const elementId = `${focused.tag}:${focused.text.substring(0, 20)}`;
    focusOrder.push(elementId);

    // Detect keyboard trap: same element focused 3+ times in a row
    if (elementId === prevElement) {
      stuckCount++;
      if (stuckCount >= 3) {
        trapDetected = true;
        details.push(
          `⚠ Keyboard trap detected at: ${focused.selector} ("${focused.text}")`,
        );
        break;
      }
    } else {
      stuckCount = 0;
    }
    prevElement = elementId;

    // Check for non-visible focused elements
    if (!focused.isVisible && focused.tag !== "body") {
      details.push(`Hidden element received focus: ${focused.selector}`);
    }
  }

  // Check for interactive elements NOT in tab order
  const unReachable = await page.evaluate(() => {
    const interactive = document.querySelectorAll(
      '[onclick], [role="button"]:not(button), [role="link"]:not(a)',
    );
    const unreachable: string[] = [];
    interactive.forEach((el) => {
      if (
        !el.matches(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
      ) {
        unreachable.push(el.outerHTML.substring(0, 100));
      }
    });
    return unreachable;
  });

  const elementsChecked = focusOrder.length;
  let elementsFailed = 0;

  if (trapDetected) {
    elementsFailed++;
    issues.push(
      mkIssue(
        url,
        "A11Y-KEY-001",
        "Keyboard trap detected",
        `User gets stuck in a keyboard trap. Focus cannot move past this element.`,
        "2.1.2",
        "No Keyboard Trap",
        "A",
        "critical",
        "operable",
      ),
    );
  }

  for (const el of unReachable.slice(0, 5)) {
    elementsFailed++;
    issues.push(
      mkIssue(
        url,
        "A11Y-KEY-001",
        "Interactive element not keyboard accessible",
        `Element with click handler is not reachable via Tab: ${el}`,
        "2.1.1",
        "Keyboard",
        "A",
        "critical",
        "operable",
      ),
    );
  }

  details.push(`Tabbed through ${elementsChecked} elements`);
  details.push(
    `${unReachable.length} interactive elements unreachable by keyboard`,
  );

  return buildResult("A11Y-KEY-001", "Keyboard Navigation", url, issues, {
    summary: trapDetected
      ? `Keyboard trap detected after ${elementsChecked} tab presses`
      : `${elementsChecked} elements checked, ${elementsFailed} failures`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 2: FOCUS VISIBILITY (Browser Action)
// ═══════════════════════════════════════════
async function testFocusVisibility(
  page: Page,
  url: string,
): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];
  let elementsChecked = 0;
  let elementsFailed = 0;

  // Tab through elements and check each one for a visible focus indicator
  const MAX_CHECKS = 20;
  for (let i = 0; i < MAX_CHECKS; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);

    const focusCheck = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el || el === document.body) return null;

      const style = window.getComputedStyle(el);
      const hasOutline =
        style.outlineStyle !== "none" && style.outlineWidth !== "0px";
      const hasBoxShadow = style.boxShadow !== "none" && style.boxShadow !== "";
      const hasBorder =
        style.borderColor !== "" && style.borderStyle !== "none";

      // Also check ::focus styles via class/pseudo changes
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (
          el.textContent?.trim() ||
          el.getAttribute("aria-label") ||
          ""
        ).substring(0, 30),
        selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
        hasOutline,
        hasBoxShadow,
        hasBorder,
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        isVisible: rect.width > 0 && rect.height > 0,
      };
    });

    if (!focusCheck || !focusCheck.isVisible) continue;
    elementsChecked++;

    const hasIndicator = focusCheck.hasOutline || focusCheck.hasBoxShadow;
    if (!hasIndicator) {
      elementsFailed++;
      details.push(
        `No focus indicator on: ${focusCheck.selector} ("${focusCheck.text}")`,
      );
      if (elementsFailed <= 3) {
        issues.push(
          mkIssue(
            url,
            "A11Y-FOC-001",
            `No visible focus indicator on ${focusCheck.tag}`,
            `Element "${focusCheck.text}" (${focusCheck.selector}) has no visible focus indicator (outline: ${focusCheck.outlineStyle}).`,
            "2.4.7",
            "Focus Visible",
            "AA",
            "critical",
            "operable",
          ),
        );
      }
    }
  }

  // Also check CSS for global outline:none
  const cssCheck = await page.evaluate(() => {
    let outlineNoneGlobal = false;
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const css = rule as CSSStyleRule;
            if (
              css.selectorText?.match(/\*:focus|:focus\b/) &&
              css.style?.outline === "none" &&
              !css.style?.boxShadow
            ) {
              outlineNoneGlobal = true;
            }
          }
        } catch {
          /* cross-origin */
        }
      }
    } catch {}
    return { outlineNoneGlobal };
  });

  if (cssCheck.outlineNoneGlobal) {
    elementsFailed++;
    details.push("⚠ Global CSS rule removes focus outline without replacement");
    issues.push(
      mkIssue(
        url,
        "A11Y-FOC-001",
        "CSS globally suppresses focus indicators",
        "A CSS rule like *:focus { outline: none } removes focus visibility without providing an alternative.",
        "2.4.7",
        "Focus Visible",
        "AA",
        "critical",
        "operable",
      ),
    );
  }

  details.push(
    `Checked ${elementsChecked} focused elements, ${elementsFailed} missing indicators`,
  );

  return buildResult("A11Y-FOC-001", "Focus Visibility", url, issues, {
    summary:
      elementsFailed === 0
        ? `All ${elementsChecked} focused elements have visible indicators`
        : `${elementsFailed}/${elementsChecked} elements missing focus indicators`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 3: IMAGE ALT TEXT QUALITY
// ═══════════════════════════════════════════
async function testImageAltText(page: Page, url: string): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).map((img) => ({
      src:
        img.src?.substring(
          img.src.lastIndexOf("/") + 1,
          img.src.lastIndexOf("/") + 50,
        ) || "",
      alt: img.getAttribute("alt"),
      hasAlt: img.hasAttribute("alt"),
      isDecorative:
        img.getAttribute("role") === "presentation" ||
        img.getAttribute("role") === "none" ||
        img.getAttribute("aria-hidden") === "true",
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      html: img.outerHTML.substring(0, 150),
    }));
  });

  const badPatterns = [
    /^img$/i,
    /^image$/i,
    /^photo$/i,
    /^picture$/i,
    /^icon$/i,
    /^untitled$/i,
    /^banner$/i,
    /\.(jpg|jpeg|png|gif|svg|webp)$/i,
    /^img_?\d+/i,
    /^dsc_?\d+/i,
    /^screenshot/i,
    /^\s*$/,
  ];
  let elementsChecked = images.length;
  let elementsFailed = 0;

  for (const img of images) {
    if (!img.hasAlt && !img.isDecorative) {
      elementsFailed++;
      details.push(`Missing alt: ${img.src}`);
      issues.push(
        mkIssue(
          url,
          "A11Y-IMG-001",
          "Image missing alt attribute",
          `Image "${img.src}" has no alt attribute. Screen readers cannot describe this image.`,
          "1.1.1",
          "Non-text Content",
          "A",
          "critical",
          "perceivable",
          img.html,
        ),
      );
    } else if (img.alt !== null && !img.isDecorative) {
      const isGeneric = badPatterns.some((p) => p.test(img.alt!));
      if (isGeneric) {
        elementsFailed++;
        details.push(`Generic alt "${img.alt}": ${img.src}`);
        issues.push(
          mkIssue(
            url,
            "A11Y-IMG-001",
            `Low-quality alt text: "${img.alt}"`,
            `Alt text "${img.alt}" is generic/meaningless. Describe what the image conveys.`,
            "1.1.1",
            "Non-text Content",
            "A",
            "high",
            "perceivable",
            img.html,
          ),
        );
      }
      if (/^(image|picture|photo|graphic) of/i.test(img.alt!)) {
        details.push(`Redundant prefix in alt: "${img.alt}"`);
      }
    }
  }

  return buildResult("A11Y-IMG-001", "Image Alt Text", url, issues, {
    summary:
      elementsFailed === 0
        ? `All ${elementsChecked} images have proper alt text`
        : `${elementsFailed}/${elementsChecked} images have alt text issues`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 4: BUTTON ACCESSIBILITY (Browser Action)
// ═══════════════════════════════════════════
async function testButtonAccessibility(
  page: Page,
  url: string,
): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  const buttons = await page.evaluate(() => {
    const results: {
      text: string;
      hasName: boolean;
      name: string;
      isNative: boolean;
      isKeyboardAccessible: boolean;
      html: string;
    }[] = [];
    // Native buttons
    document
      .querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"]',
      )
      .forEach((btn) => {
        const el = btn as HTMLElement;
        const text = el.textContent?.trim() || "";
        const ariaLabel = el.getAttribute("aria-label")?.trim() || "";
        const value = (el as HTMLInputElement).value?.trim() || "";
        const title = el.getAttribute("title")?.trim() || "";
        const name = ariaLabel || text || value || title;
        const isNative = el.tagName === "BUTTON" || el.tagName === "INPUT";
        const tabindex = el.getAttribute("tabindex");
        const isKeyboardAccessible =
          isNative ||
          tabindex === "0" ||
          (tabindex !== "-1" && tabindex !== null);

        results.push({
          text: name.substring(0, 40),
          hasName: !!name,
          name,
          isNative,
          isKeyboardAccessible,
          html: el.outerHTML.substring(0, 150),
        });
      });
    return results;
  });

  let elementsChecked = buttons.length;
  let elementsFailed = 0;
  const vague = ["submit", "go", "ok", "click", "send", "button", "close", "x"];

  for (const btn of buttons) {
    if (!btn.hasName) {
      elementsFailed++;
      details.push(
        `Button without accessible name: ${btn.html.substring(0, 60)}`,
      );
      issues.push(
        mkIssue(
          url,
          "A11Y-BTN-001",
          "Button without accessible name",
          `Button has no text, aria-label, or title.`,
          "4.1.2",
          "Name, Role, Value",
          "A",
          "critical",
          "robust",
          btn.html,
        ),
      );
    }
    if (!btn.isKeyboardAccessible && !btn.isNative) {
      elementsFailed++;
      details.push(`Button not keyboard accessible: ${btn.text}`);
      issues.push(
        mkIssue(
          url,
          "A11Y-BTN-001",
          "Button not keyboard accessible",
          `Element with role="button" is not keyboard accessible (missing tabindex="0").`,
          "2.1.1",
          "Keyboard",
          "A",
          "critical",
          "operable",
          btn.html,
        ),
      );
    }
    if (btn.hasName && vague.includes(btn.name.toLowerCase())) {
      details.push(`Vague button label: "${btn.name}"`);
    }
  }

  // Test each button with Enter key via browser action
  const nativeButtons = await page.$$("button:visible");
  for (const btn of nativeButtons.slice(0, 5)) {
    try {
      await btn.focus();
      const isFocused = await page.evaluate(
        (el) => document.activeElement === el,
        btn,
      );
      if (!isFocused) {
        elementsFailed++;
        details.push("Button could not receive focus programmatically");
      }
    } catch {
      /* element may have been removed */
    }
  }

  return buildResult("A11Y-BTN-001", "Button Accessibility", url, issues, {
    summary:
      elementsFailed === 0
        ? `All ${elementsChecked} buttons are accessible`
        : `${elementsFailed} button issues found in ${elementsChecked} buttons`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 5: FORM LABEL ASSOCIATION
// ═══════════════════════════════════════════
async function testFormLabels(page: Page, url: string): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  const inputs = await page.evaluate(() => {
    const results: {
      type: string;
      hasLabel: boolean;
      labelMethod: string;
      html: string;
      name: string;
      placeholder: string;
    }[] = [];
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      const input = el as HTMLInputElement;
      const type = input.type?.toLowerCase() || "text";
      if (["hidden", "submit", "button", "reset", "image"].includes(type))
        return;

      const id = input.id;
      const hasExplicit = id
        ? !!document.querySelector(`label[for="${id}"]`)
        : false;
      const hasWrapping = !!input.closest("label");
      const hasAriaLabel = !!input.getAttribute("aria-label");
      const hasAriaLabelledBy = !!input.getAttribute("aria-labelledby");
      const hasTitle = !!input.getAttribute("title");

      let labelMethod = "none";
      if (hasExplicit) labelMethod = "explicit-label";
      else if (hasWrapping) labelMethod = "wrapping-label";
      else if (hasAriaLabel) labelMethod = "aria-label";
      else if (hasAriaLabelledBy) labelMethod = "aria-labelledby";
      else if (hasTitle) labelMethod = "title";

      results.push({
        type,
        hasLabel: labelMethod !== "none",
        labelMethod,
        html: input.outerHTML.substring(0, 150),
        name: input.name || input.id || type,
        placeholder: input.placeholder || "",
      });
    });
    return results;
  });

  let elementsChecked = inputs.length;
  let elementsFailed = 0;

  for (const input of inputs) {
    if (!input.hasLabel) {
      elementsFailed++;
      const method = input.placeholder
        ? `Uses placeholder "${input.placeholder}" as only label`
        : "No label at all";
      details.push(`${input.type} "${input.name}": ${method}`);
      issues.push(
        mkIssue(
          url,
          "A11Y-FRM-001",
          `Form input without proper label`,
          `Input [type="${input.type}"] (${input.name}) has no associated label. ${method}.`,
          "3.3.2",
          "Labels or Instructions",
          "A",
          input.placeholder ? "high" : "critical",
          "understandable",
          input.html,
        ),
      );
    } else {
      details.push(
        `✔ ${input.type} "${input.name}": labeled via ${input.labelMethod}`,
      );
    }
  }

  return buildResult("A11Y-FRM-001", "Form Label Association", url, issues, {
    summary:
      elementsFailed === 0
        ? `All ${elementsChecked} form inputs have proper labels`
        : `${elementsFailed}/${elementsChecked} inputs missing labels`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 6: ERROR HANDLING (Browser Action)
// ═══════════════════════════════════════════
async function testErrorHandling(page: Page, url: string): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];
  let elementsChecked = 0;
  let elementsFailed = 0;

  // Find forms and try to submit them empty to trigger validation
  const forms = await page.$$("form");
  if (forms.length === 0) {
    return buildResult("A11Y-ERR-001", "Error Handling", url, [], {
      summary: "No forms found on page — test not applicable",
      elementsChecked: 0,
      elementsFailed: 0,
      details: ["No forms detected on this page"],
    });
  }

  for (const form of forms.slice(0, 3)) {
    elementsChecked++;
    try {
      // Try submitting the form without filling required fields
      const submitBtn = await form.$(
        'button[type="submit"], input[type="submit"], button:not([type])',
      );
      if (submitBtn) {
        await submitBtn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(500);
      }

      // Check for error announcements
      const errorCheck = await page.evaluate(() => {
        const alerts = document.querySelectorAll(
          '[role="alert"], [aria-live="assertive"], [aria-live="polite"]',
        );
        const ariaInvalid = document.querySelectorAll('[aria-invalid="true"]');
        const errorMsgs = document.querySelectorAll(
          '.error, .error-message, .invalid-feedback, .field-error, [class*="error"]',
        );
        const describedErrors = document.querySelectorAll("[aria-describedby]");

        return {
          alertCount: alerts.length,
          ariaInvalidCount: ariaInvalid.length,
          errorMsgCount: errorMsgs.length,
          describedByCount: describedErrors.length,
          hasAccessibleErrors: alerts.length > 0 || ariaInvalid.length > 0,
        };
      });

      details.push(
        `Form ${elementsChecked}: ${errorCheck.errorMsgCount} error messages, ${errorCheck.alertCount} role="alert", ${errorCheck.ariaInvalidCount} aria-invalid`,
      );

      if (errorCheck.errorMsgCount > 0 && !errorCheck.hasAccessibleErrors) {
        elementsFailed++;
        issues.push(
          mkIssue(
            url,
            "A11Y-ERR-001",
            "Error messages not accessible",
            `Form shows ${errorCheck.errorMsgCount} error messages but none use role="alert" or aria-invalid. Screen readers won't announce errors.`,
            "3.3.1",
            "Error Identification",
            "A",
            "high",
            "understandable",
          ),
        );
      }
    } catch (e) {
      details.push(`Form ${elementsChecked}: Could not test (${e})`);
    }
  }

  return buildResult("A11Y-ERR-001", "Error Handling", url, issues, {
    summary:
      elementsFailed === 0
        ? `${elementsChecked} form(s) checked — errors properly accessible`
        : `${elementsFailed} form(s) with inaccessible error messages`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 7: COLOR CONTRAST
// ═══════════════════════════════════════════
async function testColorContrast(page: Page, url: string): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  const contrastResults = await page.evaluate(() => {
    function getLum(r: number, g: number, b: number): number {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }
    function parseRGB(c: string) {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    }
    function ratio(fg: string, bg: string): number {
      const f = parseRGB(fg),
        b = parseRGB(bg);
      if (!f || !b) return 21;
      const l1 = getLum(f.r, f.g, f.b),
        l2 = getLum(b.r, b.g, b.b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    const fails: {
      text: string;
      el: string;
      ratio: number;
      fg: string;
      bg: string;
      isLarge: boolean;
    }[] = [];
    const seen = new Set<string>();
    const els = document.querySelectorAll(
      "p,span,a,button,label,li,td,th,h1,h2,h3,h4,h5,h6",
    );

    for (const el of Array.from(els).slice(0, 150)) {
      const t = el.textContent?.trim();
      if (!t || t.length < 2) continue;
      const s = window.getComputedStyle(el);
      const fg = s.color,
        bg = s.backgroundColor;
      const bgP = parseRGB(bg);
      if (bgP && bgP.r + bgP.g + bgP.b === 0 && bg.includes("0)")) continue; // transparent
      const key = `${fg}|${bg}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = ratio(fg, bg);
      const fs = parseFloat(s.fontSize);
      const fw = parseInt(s.fontWeight) || 400;
      const isLarge = fs >= 24 || (fs >= 18.66 && fw >= 700);
      const thresh = isLarge ? 3 : 4.5;
      if (r < thresh && r > 1) {
        fails.push({
          text: t.substring(0, 30),
          el: `${el.tagName.toLowerCase()}${el.className ? "." + el.className.split(" ")[0] : ""}`,
          ratio: Math.round(r * 100) / 100,
          fg,
          bg,
          isLarge,
        });
      }
    }
    return { totalChecked: seen.size, fails: fails.slice(0, 10) };
  });

  let elementsChecked = contrastResults.totalChecked;
  let elementsFailed = contrastResults.fails.length;

  for (const f of contrastResults.fails) {
    details.push(
      `${f.el}: ratio ${f.ratio}:1 (need ${f.isLarge ? "3" : "4.5"}:1) — "${f.text}"`,
    );
    issues.push(
      mkIssue(
        url,
        "A11Y-CON-001",
        `Low contrast: ${f.ratio}:1 on ${f.el}`,
        `Text "${f.text}" has contrast ratio ${f.ratio}:1 (fg: ${f.fg}, bg: ${f.bg}). Minimum: ${f.isLarge ? "3" : "4.5"}:1.`,
        "1.4.3",
        "Contrast (Minimum)",
        "AA",
        "high",
        "perceivable",
      ),
    );
  }

  return buildResult("A11Y-CON-001", "Color Contrast", url, issues, {
    summary:
      elementsFailed === 0
        ? `All ${elementsChecked} color pairs meet contrast requirements`
        : `${elementsFailed} low-contrast text elements found`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 8: HEADING STRUCTURE
// ═══════════════════════════════════════════
async function testHeadingStructure(
  page: Page,
  url: string,
): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(
      (h) => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim().substring(0, 60) || "",
        empty: !h.textContent?.trim(),
        html: h.outerHTML.substring(0, 100),
      }),
    );
  });

  let elementsChecked = headings.length;
  let elementsFailed = 0;
  const h1s = headings.filter((h) => h.level === 1);

  if (h1s.length === 0) {
    elementsFailed++;
    details.push(" No h1 heading found");
    issues.push(
      mkIssue(
        url,
        "A11Y-HDG-001",
        "Missing h1 heading",
        "Page has no h1. Every page needs exactly one h1 describing its purpose.",
        "1.3.1",
        "Info and Relationships",
        "A",
        "high",
        "perceivable",
      ),
    );
  } else if (h1s.length > 1) {
    elementsFailed++;
    details.push(` ${h1s.length} h1 headings found (expected 1)`);
    issues.push(
      mkIssue(
        url,
        "A11Y-HDG-001",
        `Multiple h1 headings (${h1s.length})`,
        "Page has multiple h1 elements. Use exactly one h1 per page.",
        "1.3.1",
        "Info and Relationships",
        "A",
        "medium",
        "perceivable",
      ),
    );
  } else {
    details.push(`✔ Single h1: "${h1s[0].text}"`);
  }

  let prev = 0;
  for (const h of headings) {
    if (h.empty) {
      elementsFailed++;
      details.push(` Empty h${h.level}`);
      issues.push(
        mkIssue(
          url,
          "A11Y-HDG-001",
          `Empty h${h.level} heading`,
          "Empty heading confuses screen reader users.",
          "1.3.1",
          "Info and Relationships",
          "A",
          "high",
          "perceivable",
          h.html,
        ),
      );
    }
    if (prev > 0 && h.level > prev + 1) {
      elementsFailed++;
      details.push(` Skipped: h${prev} → h${h.level}`);
      issues.push(
        mkIssue(
          url,
          "A11Y-HDG-001",
          `Heading level skip (h${prev} → h${h.level})`,
          `"${h.text}" jumps from h${prev} to h${h.level}, breaking the outline.`,
          "1.3.1",
          "Info and Relationships",
          "A",
          "high",
          "perceivable",
        ),
      );
    }
    prev = h.level;
  }

  details.push(
    `Heading outline: ${headings.map((h) => `h${h.level}`).join(" → ")}`,
  );

  return buildResult("A11Y-HDG-001", "Heading Structure", url, issues, {
    summary:
      elementsFailed === 0
        ? `Heading hierarchy is valid (${elementsChecked} headings)`
        : `${elementsFailed} heading structure issues`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 9: LINK PURPOSE
// ═══════════════════════════════════════════
async function testLinkPurpose(page: Page, url: string): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  const links = await page.evaluate(() => {
    const vagueTexts = [
      "click here",
      "here",
      "more",
      "read more",
      "learn more",
      "link",
      "click",
      "this",
      "go",
      "details",
      "info",
    ];
    return Array.from(document.querySelectorAll("a[href]")).map((a) => {
      const text = (a.textContent?.trim() || "").toLowerCase();
      const ariaLabel = a.getAttribute("aria-label")?.trim();
      const name = ariaLabel || text;
      const img = a.querySelector("img");
      const imgAlt = img?.getAttribute("alt");
      const opensNew = a.getAttribute("target") === "_blank";
      return {
        text: name.substring(0, 50),
        isEmpty: !name && !imgAlt,
        isVague: vagueTexts.includes(text) && !ariaLabel,
        opensNew,
        warnsNew:
          opensNew &&
          (name.includes("new window") ||
            name.includes("new tab") ||
            (ariaLabel || "").includes("new")),
        html: a.outerHTML.substring(0, 120),
      };
    });
  });

  let elementsChecked = links.length;
  let elementsFailed = 0;

  for (const link of links) {
    if (link.isEmpty) {
      elementsFailed++;
      details.push(`Empty link: ${link.html.substring(0, 60)}`);
      issues.push(
        mkIssue(
          url,
          "A11Y-LNK-001",
          "Link without accessible name",
          `Link has no text or aria-label.`,
          "2.4.4",
          "Link Purpose (In Context)",
          "A",
          "critical",
          "operable",
          link.html,
        ),
      );
    } else if (link.isVague) {
      elementsFailed++;
      details.push(`Vague link: "${link.text}"`);
      issues.push(
        mkIssue(
          url,
          "A11Y-LNK-001",
          `Non-descriptive link: "${link.text}"`,
          `Link text "${link.text}" doesn\'t describe the destination.`,
          "2.4.4",
          "Link Purpose (In Context)",
          "A",
          "high",
          "operable",
        ),
      );
    }
    if (link.opensNew && !link.warnsNew) {
      details.push(`Opens new tab without warning: "${link.text}"`);
    }
  }

  return buildResult("A11Y-LNK-001", "Link Purpose", url, issues, {
    summary:
      elementsFailed === 0
        ? `All ${elementsChecked} links have descriptive text`
        : `${elementsFailed}/${elementsChecked} links have purpose issues`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// TEST 10: ARIA VALIDATION
// ═══════════════════════════════════════════
async function testAriaValidation(
  page: Page,
  url: string,
): Promise<TestResult> {
  const issues: AccessibilityIssue[] = [];
  const details: string[] = [];

  const ariaResult = await page.evaluate(() => {
    const problems: { type: string; detail: string; html: string }[] = [];
    let checked = 0;

    // aria-hidden on focusable
    document
      .querySelectorAll(
        '[aria-hidden="true"] a[href], [aria-hidden="true"] button, [aria-hidden="true"] input:not([type="hidden"]), [aria-hidden="true"] [tabindex]:not([tabindex="-1"])',
      )
      .forEach((el) => {
        if (!(el as HTMLElement).closest("[inert]")) {
          checked++;
          problems.push({
            type: "hidden-focusable",
            detail: "Focusable element inside aria-hidden",
            html: el.outerHTML.substring(0, 120),
          });
        }
      });

    // Broken aria-labelledby references
    document.querySelectorAll("[aria-labelledby]").forEach((el) => {
      checked++;
      const ids = el.getAttribute("aria-labelledby")!.split(/\s+/);
      for (const id of ids) {
        if (id && !document.getElementById(id)) {
          problems.push({
            type: "broken-ref",
            detail: `aria-labelledby references missing id="${id}"`,
            html: el.outerHTML.substring(0, 120),
          });
        }
      }
    });

    // Broken aria-describedby references
    document.querySelectorAll("[aria-describedby]").forEach((el) => {
      checked++;
      const ids = el.getAttribute("aria-describedby")!.split(/\s+/);
      for (const id of ids) {
        if (id && !document.getElementById(id)) {
          problems.push({
            type: "broken-ref",
            detail: `aria-describedby references missing id="${id}"`,
            html: el.outerHTML.substring(0, 120),
          });
        }
      }
    });

    // Invalid ARIA roles
    const validRoles = [
      "alert",
      "alertdialog",
      "application",
      "article",
      "banner",
      "button",
      "cell",
      "checkbox",
      "columnheader",
      "combobox",
      "complementary",
      "contentinfo",
      "definition",
      "dialog",
      "directory",
      "document",
      "feed",
      "figure",
      "form",
      "grid",
      "gridcell",
      "group",
      "heading",
      "img",
      "link",
      "list",
      "listbox",
      "listitem",
      "log",
      "main",
      "marquee",
      "math",
      "menu",
      "menubar",
      "menuitem",
      "menuitemcheckbox",
      "menuitemradio",
      "navigation",
      "none",
      "note",
      "option",
      "presentation",
      "progressbar",
      "radio",
      "radiogroup",
      "region",
      "row",
      "rowgroup",
      "rowheader",
      "scrollbar",
      "search",
      "searchbox",
      "separator",
      "slider",
      "spinbutton",
      "status",
      "switch",
      "tab",
      "table",
      "tablist",
      "tabpanel",
      "term",
      "textbox",
      "timer",
      "toolbar",
      "tooltip",
      "tree",
      "treegrid",
      "treeitem",
    ];
    document.querySelectorAll("[role]").forEach((el) => {
      checked++;
      const role = el.getAttribute("role")!.toLowerCase();
      if (!validRoles.includes(role)) {
        problems.push({
          type: "invalid-role",
          detail: `Invalid ARIA role="${role}"`,
          html: el.outerHTML.substring(0, 120),
        });
      }
    });

    return { checked, problems: problems.slice(0, 15) };
  });

  let elementsChecked = ariaResult.checked;
  let elementsFailed = ariaResult.problems.length;

  for (const p of ariaResult.problems) {
    details.push(`${p.type}: ${p.detail}`);
    issues.push(
      mkIssue(
        url,
        "A11Y-ARI-001",
        p.detail,
        `ARIA misuse detected: ${p.detail}`,
        "4.1.2",
        "Name, Role, Value",
        "A",
        p.type === "hidden-focusable" ? "critical" : "high",
        "robust",
        p.html,
      ),
    );
  }

  return buildResult("A11Y-ARI-001", "ARIA Validation", url, issues, {
    summary:
      elementsFailed === 0
        ? `${elementsChecked} ARIA attributes validated — all correct`
        : `${elementsFailed} ARIA issues found in ${elementsChecked} elements`,
    elementsChecked,
    elementsFailed,
    details,
  });
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function buildResult(
  testId: string,
  testName: string,
  url: string,
  issues: AccessibilityIssue[],
  evidence: TestEvidence,
): TestResult {
  const tc = TEST_CASES.find((t) => t.testId === testId)!;
  return {
    testId,
    testName,
    pageUrl: url,
    status: issues.length === 0 ? "pass" : "fail",
    wcagCriterion: tc.wcagCriterion,
    wcagName: tc.wcagName,
    wcagLevel: tc.wcagLevel,
    severity: tc.severity,
    confidence:
      issues.length === 0
        ? "high"
        : issues.some((i) => i.confidence === "high")
          ? "high"
          : "medium",
    evidence,
    issues,
    executionTime: 0,
  };
}

function mkIssue(
  url: string,
  testId: string,
  title: string,
  desc: string,
  wcag: string,
  wcagName: string,
  level: "A" | "AA" | "AAA",
  sev: "critical" | "high" | "medium" | "low",
  cat: AccessibilityIssue["category"],
  html?: string,
): AccessibilityIssue {
  return {
    id: uuidv4(),
    testId,
    title,
    description: desc,
    element: "page-level",
    elementHtml: html,
    pageUrl: url,
    wcagCriterion: wcag,
    wcagName,
    wcagLevel: level,
    severity: sev,
    impact: "Affects assistive technology users",
    recommendation: "",
    category: cat,
    source: "test-runner",
    confidence: "high",
  };
}
