import { BrowserContext, Page } from 'playwright';
import { AccessibilityIssue, PageData } from '../types/audit';
// uuid replaced with Node.js built-in
const uuidv4 = (): string => crypto.randomUUID();

/**
 * Deep Auditor — 14-Step Human-Like Accessibility Audit
 * Performs interactive page-level testing that mimics a senior accessibility expert.
 */

export async function runDeepAudit(
  context: BrowserContext,
  pageData: PageData,
  onProgress?: (msg: string) => void
): Promise<AccessibilityIssue[]> {
  const allIssues: AccessibilityIssue[] = [];
  const page = await context.newPage();

  try {
    await page.goto(pageData.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Step 1: Analyze Page Structure
    onProgress?.(`[Step 1/14] Analyzing page structure: ${pageData.title}`);
    allIssues.push(...await auditPageStructure(page, pageData.url));

    // Step 2: Simulate Keyboard Navigation
    onProgress?.(`[Step 2/14] Simulating keyboard navigation...`);
    allIssues.push(...await auditKeyboardNavigation(page, pageData.url));

    // Step 3: Evaluate Focus Management
    onProgress?.(`[Step 3/14] Evaluating focus management...`);
    allIssues.push(...await auditFocusManagement(page, pageData.url));

    // Step 4: Check Image Alt Text Quality
    onProgress?.(`[Step 4/14] Checking image alt text quality...`);
    allIssues.push(...await auditImageQuality(page, pageData.url));

    // Step 5: Analyze Color Contrast
    onProgress?.(`[Step 5/14] Analyzing color contrast...`);
    allIssues.push(...await auditColorContrast(page, pageData.url));

    // Step 6: Audit Forms
    onProgress?.(`[Step 6/14] Auditing forms...`);
    allIssues.push(...await auditForms(page, pageData.url));

    // Step 7: Evaluate Buttons & Links
    onProgress?.(`[Step 7/14] Evaluating buttons & links...`);
    allIssues.push(...await auditButtonsAndLinks(page, pageData.url));

    // Step 9: Detect Dynamic Content Issues
    onProgress?.(`[Step 9/14] Checking dynamic content & ARIA live regions...`);
    allIssues.push(...await auditDynamicContent(page, pageData.url));

    // Step 10: Validate ARIA Usage
    onProgress?.(`[Step 10/14] Validating ARIA usage...`);
    allIssues.push(...await auditAriaUsage(page, pageData.url));

    // Step 12: Test Zoom & Responsiveness
    onProgress?.(`[Step 12/14] Testing zoom & responsiveness...`);
    allIssues.push(...await auditZoomResponsiveness(page, pageData.url, context));

    // Step 14: Screen Reader Simulation (reading order)
    onProgress?.(`[Step 14/14] Simulating screen reader reading order...`);
    allIssues.push(...await auditReadingOrder(page, pageData.url));

  } catch (error) {
    console.error(`Deep audit failed for ${pageData.url}:`, error);
  } finally {
    await page.close();
  }

  return allIssues;
}

// ========================================================================
// STEP 1: PAGE STRUCTURE
// ========================================================================
async function auditPageStructure(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const headings: { level: number; text: string; empty: boolean }[] = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      headings.push({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim().substring(0, 80) || '',
        empty: !h.textContent?.trim()
      });
    });

    const landmarks = {
      main: document.querySelectorAll('main, [role="main"]').length,
      nav: document.querySelectorAll('nav, [role="navigation"]').length,
      banner: document.querySelectorAll('header, [role="banner"]').length,
      contentinfo: document.querySelectorAll('footer, [role="contentinfo"]').length,
      search: document.querySelectorAll('[role="search"]').length,
      complementary: document.querySelectorAll('aside, [role="complementary"]').length,
    };

    const h1Count = headings.filter(h => h.level === 1).length;
    const totalContent = document.body?.innerText?.length || 0;

    return { headings, landmarks, h1Count, totalContent };
  });

  // Check h1 count
  if (result.h1Count === 0) {
    issues.push(createIssue(url, 'DA-S1-01', 'Missing h1 heading', 'Page has no h1 heading. Every page should have exactly one h1 describing its main topic.', '1.3.1', 'Info and Relationships', 'A', 'high', 'perceivable', 'Add a single h1 heading that describes the main purpose of this page.'));
  } else if (result.h1Count > 1) {
    issues.push(createIssue(url, 'DA-S1-02', 'Multiple h1 headings', `Page has ${result.h1Count} h1 headings. Use exactly one h1 per page for clear document structure.`, '1.3.1', 'Info and Relationships', 'A', 'medium', 'perceivable', 'Keep only one h1 that describes the page purpose. Convert others to h2 or lower.'));
  }

  // Check heading hierarchy
  let prevLevel = 0;
  for (const h of result.headings) {
    if (h.empty) {
      issues.push(createIssue(url, 'DA-S1-03', 'Empty heading element', `Empty h${h.level} heading detected. Screen readers announce this as a heading with no content.`, '1.3.1', 'Info and Relationships', 'A', 'high', 'perceivable', 'Add descriptive text or remove the empty heading element.'));
    }
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      issues.push(createIssue(url, 'DA-S1-04', `Heading level skipped (h${prevLevel} → h${h.level})`, `Heading "${h.text}" skips from h${prevLevel} to h${h.level}. This breaks the logical outline for screen reader users.`, '1.3.1', 'Info and Relationships', 'A', 'high', 'perceivable', `Change to h${prevLevel + 1} or add intermediate headings.`));
    }
    prevLevel = h.level;
  }

  // Check landmarks
  if (result.landmarks.main === 0) {
    issues.push(createIssue(url, 'DA-S1-05', 'Missing main landmark', 'Page has no <main> element or role="main". Screen reader users cannot quickly jump to main content.', '1.3.1', 'Info and Relationships', 'A', 'high', 'perceivable', 'Wrap primary content in a <main> element.'));
  }
  if (result.landmarks.nav === 0 && result.totalContent > 500) {
    issues.push(createIssue(url, 'DA-S1-06', 'Missing navigation landmark', 'No <nav> landmark detected. Navigation links should be wrapped in <nav> for screen reader users.', '1.3.1', 'Info and Relationships', 'A', 'medium', 'perceivable', 'Wrap navigation links in a <nav> element with an aria-label.'));
  }

  return issues;
}

// ========================================================================
// STEP 2: KEYBOARD NAVIGATION
// ========================================================================
async function auditKeyboardNavigation(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const focusableSelector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]';
    const focusable = Array.from(document.querySelectorAll(focusableSelector));

    const interactiveNoFocus: string[] = [];
    const hiddenFocusable: string[] = [];
    const negativeTabindex: string[] = [];

    // Check for interactive-looking elements that aren't focusable
    document.querySelectorAll('[onclick], [role="button"], [role="link"], [role="tab"]').forEach(el => {
      if (!el.matches(focusableSelector) && el.getAttribute('tabindex') !== '0') {
        interactiveNoFocus.push(el.outerHTML.substring(0, 120));
      }
    });

    // Check for visually hidden but still focusable elements
    focusable.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        if (el.getAttribute('tabindex') !== '-1') {
          hiddenFocusable.push(el.outerHTML.substring(0, 120));
        }
      }
    });

    // Check for interactive elements with negative tabindex
    document.querySelectorAll('a[href][tabindex="-1"], button[tabindex="-1"]').forEach(el => {
      if (!(el as HTMLElement).closest('[role="menu"]') && !(el as HTMLElement).closest('[role="tablist"]')) {
        negativeTabindex.push(el.outerHTML.substring(0, 120));
      }
    });

    return { totalFocusable: focusable.length, interactiveNoFocus, hiddenFocusable, negativeTabindex };
  });

  for (const el of result.interactiveNoFocus) {
    issues.push(createIssue(url, 'DA-S2-01', 'Interactive element not keyboard accessible', `Element with click handler or interactive role is not in the tab order: ${el}`, '2.1.1', 'Keyboard', 'A', 'critical', 'operable', 'Add tabindex="0" and keyboard event handlers, or use a native <button>/<a> element.'));
  }

  for (const el of result.hiddenFocusable) {
    issues.push(createIssue(url, 'DA-S2-02', 'Hidden element still focusable', `Visually hidden element remains in tab order: ${el}`, '2.4.3', 'Focus Order', 'A', 'medium', 'operable', 'Add tabindex="-1" or aria-hidden="true" to hidden interactive elements.'));
  }

  for (const el of result.negativeTabindex) {
    issues.push(createIssue(url, 'DA-S2-03', 'Interactive element removed from tab order', `Native interactive element has tabindex="-1": ${el}`, '2.1.1', 'Keyboard', 'A', 'high', 'operable', 'Remove tabindex="-1" from interactive elements unless they are part of a composite widget (menus, tablists).'));
  }

  return issues;
}

// ========================================================================
// STEP 3: FOCUS MANAGEMENT
// ========================================================================
async function auditFocusManagement(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog, .modal, [aria-modal="true"]');
    const dialogIssues: string[] = [];

    dialogs.forEach(d => {
      if (!d.getAttribute('aria-label') && !d.getAttribute('aria-labelledby')) {
        dialogIssues.push(`Dialog missing accessible name: ${d.outerHTML.substring(0, 80)}`);
      }
      if (d.getAttribute('aria-modal') !== 'true' && !d.matches('dialog')) {
        dialogIssues.push(`Dialog missing aria-modal="true": ${d.outerHTML.substring(0, 80)}`);
      }
    });

    // Check for popups/tooltips without proper focus management
    const tooltips = document.querySelectorAll('[role="tooltip"]');
    const tooltipIssues: string[] = [];
    tooltips.forEach(t => {
      if (!t.id) {
        tooltipIssues.push('Tooltip without id (cannot be referenced by aria-describedby)');
      }
    });

    return { dialogIssues, tooltipIssues, dialogCount: dialogs.length };
  });

  for (const issue of result.dialogIssues) {
    issues.push(createIssue(url, 'DA-S3-01', 'Dialog focus management issue', issue, '2.4.3', 'Focus Order', 'A', 'high', 'operable', 'Ensure dialogs have aria-label/aria-labelledby, aria-modal="true", trap focus inside, and return focus on close.'));
  }

  for (const issue of result.tooltipIssues) {
    issues.push(createIssue(url, 'DA-S3-02', 'Tooltip not properly connected', issue, '4.1.2', 'Name, Role, Value', 'A', 'medium', 'robust', 'Add an id to the tooltip and reference it with aria-describedby on the trigger element.'));
  }

  return issues;
}

// ========================================================================
// STEP 4: IMAGE ALT TEXT QUALITY
// ========================================================================
async function auditImageQuality(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const images: { src: string; alt: string | null; hasAlt: boolean; isDecorative: boolean; size: { w: number; h: number }; context: string }[] = [];

    document.querySelectorAll('img').forEach(img => {
      const alt = img.getAttribute('alt');
      const style = window.getComputedStyle(img);
      images.push({
        src: img.src?.substring(0, 100) || '',
        alt,
        hasAlt: alt !== null,
        isDecorative: img.getAttribute('role') === 'presentation' || img.getAttribute('role') === 'none' || img.getAttribute('aria-hidden') === 'true',
        size: { w: img.naturalWidth || parseInt(style.width) || 0, h: img.naturalHeight || parseInt(style.height) || 0 },
        context: (img.parentElement?.textContent?.trim() || '').substring(0, 50)
      });
    });

    return images;
  });

  const badAltPatterns = [
    /^img$/i, /^image$/i, /^photo$/i, /^picture$/i, /^graphic$/i, /^icon$/i,
    /^untitled$/i, /^screenshot$/i, /^img_?\d+/i, /^dsc_?\d+/i, /^photo_?\d+/i,
    /\.(jpg|jpeg|png|gif|svg|webp)$/i, /^banner$/i, /^logo$/i,
    /^\s*$/,
  ];

  for (const img of result) {
    if (!img.hasAlt && !img.isDecorative) {
      issues.push(createIssue(url, 'DA-S4-01', 'Image missing alt text', `Image (${img.src}) has no alt attribute.`, '1.1.1', 'Non-text Content', 'A', 'critical', 'perceivable', 'Add descriptive alt text, or alt="" with role="presentation" for decorative images.'));
      continue;
    }

    if (img.alt && !img.isDecorative) {
      // Check for low-quality alt text
      const isGeneric = badAltPatterns.some(p => p.test(img.alt!));
      if (isGeneric) {
        issues.push(createIssue(url, 'DA-S4-02', 'Low-quality alt text', `Image alt text "${img.alt}" is generic/unhelpful. Alt text should describe the image content meaningfully.`, '1.1.1', 'Non-text Content', 'A', 'high', 'perceivable', 'Replace with descriptive text that conveys the image purpose: what information does this image convey?', 'medium'));
      }

      // Check for overly long alt text
      if (img.alt.length > 150) {
        issues.push(createIssue(url, 'DA-S4-03', 'Alt text too long', `Alt text is ${img.alt.length} characters. Long descriptions should use aria-describedby or a long description link instead.`, '1.1.1', 'Non-text Content', 'A', 'low', 'perceivable', 'Keep alt text under 125 characters. Use aria-describedby for longer descriptions.'));
      }

      // Check for alt text that starts with "image of" or "picture of"
      if (/^(image|picture|photo|graphic|icon) of /i.test(img.alt)) {
        issues.push(createIssue(url, 'DA-S4-04', 'Alt text has redundant prefix', `Alt text "${img.alt.substring(0, 60)}" starts with "image of" — screen readers already announce this as an image.`, '1.1.1', 'Non-text Content', 'A', 'low', 'perceivable', 'Remove "image of", "photo of" etc. prefixes from alt text.'));
      }
    }
  }

  return issues;
}

// ========================================================================
// STEP 5: COLOR CONTRAST
// ========================================================================
async function auditColorContrast(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const lowContrastElements: { text: string; fg: string; bg: string; element: string; ratio: number }[] = [];

    function getLuminance(r: number, g: number, b: number): number {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return null;
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a: match[4] ? parseFloat(match[4]) : 1 };
    }

    function getContrastRatio(fg: string, bg: string): number {
      const fgC = parseColor(fg);
      const bgC = parseColor(bg);
      if (!fgC || !bgC) return 21;
      const l1 = getLuminance(fgC.r, fgC.g, fgC.b);
      const l2 = getLuminance(bgC.r, bgC.g, bgC.b);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Sample text elements
    const textElements = document.querySelectorAll('p, span, a, button, label, li, td, th, h1, h2, h3, h4, h5, h6, div');
    const checked = new Set<string>();

    for (const el of Array.from(textElements).slice(0, 100)) {
      const text = el.textContent?.trim();
      if (!text || text.length < 2) continue;

      const style = window.getComputedStyle(el);
      const fg = style.color;
      const bg = style.backgroundColor;

      if (!fg || !bg) continue;
      const bgParsed = parseColor(bg);
      if (bgParsed && bgParsed.a < 0.1) continue; // transparent BG

      const key = `${fg}|${bg}`;
      if (checked.has(key)) continue;
      checked.add(key);

      const ratio = getContrastRatio(fg, bg);
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight) || 400;
      const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const threshold = isLargeText ? 3 : 4.5;

      if (ratio < threshold && ratio > 1) {
        lowContrastElements.push({
          text: text.substring(0, 40),
          fg, bg,
          element: `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ')[0] : ''}`,
          ratio: Math.round(ratio * 100) / 100
        });
      }
    }

    return lowContrastElements.slice(0, 10);
  });

  for (const item of result) {
    issues.push(createIssue(url, 'DA-S5-01', `Low color contrast (${item.ratio}:1)`,
      `Text "${item.text}" on ${item.element} has contrast ratio ${item.ratio}:1 (fg: ${item.fg}, bg: ${item.bg}). Minimum required: 4.5:1 for normal text, 3:1 for large text.`,
      '1.4.3', 'Contrast (Minimum)', 'AA', 'high', 'perceivable',
      `Increase contrast to at least 4.5:1. Darken the text or lighten the background.`));
  }

  return issues;
}

// ========================================================================
// STEP 6: FORMS
// ========================================================================
async function auditForms(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const formIssues: { type: string; detail: string; element: string }[] = [];

    document.querySelectorAll('input, select, textarea').forEach(input => {
      const el = input as HTMLInputElement;
      const type = el.type?.toLowerCase() || 'text';
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;

      const id = el.id;
      const hasAriaLabel = !!el.getAttribute('aria-label');
      const hasAriaLabelledBy = !!el.getAttribute('aria-labelledby');
      const hasTitle = !!el.getAttribute('title');
      const hasPlaceholder = !!el.getAttribute('placeholder');
      const hasExplicitLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const hasWrappingLabel = !!el.closest('label');

      if (!hasExplicitLabel && !hasWrappingLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
        if (hasPlaceholder) {
          formIssues.push({ type: 'placeholder-only-label', detail: `Input [type="${type}"] uses placeholder as only label: "${el.placeholder}"`, element: el.outerHTML.substring(0, 120) });
        } else {
          formIssues.push({ type: 'no-label', detail: `Input [type="${type}"] has no label`, element: el.outerHTML.substring(0, 120) });
        }
      }

      // Check required fields
      if (el.required && !el.getAttribute('aria-required')) {
        formIssues.push({ type: 'required-no-aria', detail: `Required field missing aria-required="true"`, element: el.outerHTML.substring(0, 120) });
      }

      // Check autocomplete for identity fields
      const name = (el.name || el.id || '').toLowerCase();
      const identityFields = ['email', 'password', 'name', 'username', 'phone', 'tel', 'address', 'city', 'zip', 'postal', 'country', 'firstname', 'lastname'];
      if (identityFields.some(f => name.includes(f)) && !el.getAttribute('autocomplete')) {
        formIssues.push({ type: 'missing-autocomplete', detail: `Identity field "${name}" missing autocomplete attribute`, element: el.outerHTML.substring(0, 120) });
      }
    });

    // Check radio/checkbox groups without fieldset
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const radios = form.querySelectorAll('input[type="radio"]');
      if (radios.length > 1 && !form.querySelector('fieldset')) {
        formIssues.push({ type: 'missing-fieldset', detail: `Form has ${radios.length} radio buttons without <fieldset>/<legend> grouping`, element: 'form' });
      }
    });

    return formIssues;
  });

  for (const issue of result) {
    if (issue.type === 'no-label') {
      issues.push(createIssue(url, 'DA-S6-01', 'Form input without label', issue.detail, '3.3.2', 'Labels or Instructions', 'A', 'critical', 'understandable', 'Add a visible <label> with a matching "for" attribute, or use aria-label.'));
    } else if (issue.type === 'placeholder-only-label') {
      issues.push(createIssue(url, 'DA-S6-02', 'Placeholder used as only label', issue.detail, '3.3.2', 'Labels or Instructions', 'A', 'high', 'understandable', 'Add a visible <label>. Placeholders disappear on input and are not reliable labels.'));
    } else if (issue.type === 'required-no-aria') {
      issues.push(createIssue(url, 'DA-S6-03', 'Required field without aria-required', issue.detail, '3.3.2', 'Labels or Instructions', 'A', 'medium', 'understandable', 'Add aria-required="true" to required fields for screen reader announcement.'));
    } else if (issue.type === 'missing-autocomplete') {
      issues.push(createIssue(url, 'DA-S6-04', 'Identity field missing autocomplete', issue.detail, '1.3.5', 'Identify Input Purpose', 'AA', 'medium', 'perceivable', 'Add appropriate autocomplete value (e.g., autocomplete="email").'));
    } else if (issue.type === 'missing-fieldset') {
      issues.push(createIssue(url, 'DA-S6-05', 'Radio group without fieldset/legend', issue.detail, '1.3.1', 'Info and Relationships', 'A', 'high', 'perceivable', 'Wrap radio/checkbox groups in <fieldset> with a descriptive <legend>.'));
    }
  }

  return issues;
}

// ========================================================================
// STEP 7: BUTTONS & LINKS CLARITY
// ========================================================================
async function auditButtonsAndLinks(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const problems: { type: string; text: string; el: string }[] = [];
    const vagueLinkTexts = ['click here', 'here', 'more', 'read more', 'learn more', 'link', 'click', 'this', 'details', 'info', 'go', 'view', 'see more', 'continue'];
    const vagueButtonTexts = ['submit', 'go', 'ok', 'click', 'send', 'button'];

    document.querySelectorAll('a[href]').forEach(a => {
      const text = (a.textContent?.trim() || '').toLowerCase();
      const ariaLabel = a.getAttribute('aria-label')?.trim();
      const accessibleName = ariaLabel || text;

      if (!accessibleName) {
        // Check for image-only links
        const img = a.querySelector('img');
        if (img && !img.getAttribute('alt')) {
          problems.push({ type: 'link-no-name', text: 'Image link without alt text', el: a.outerHTML.substring(0, 120) });
        } else if (!img) {
          problems.push({ type: 'link-empty', text: 'Empty link', el: a.outerHTML.substring(0, 120) });
        }
      } else if (vagueLinkTexts.includes(text) && !ariaLabel) {
        problems.push({ type: 'link-vague', text: accessibleName, el: a.outerHTML.substring(0, 120) });
      }

      // Check for links that open in new window without warning
      if (a.getAttribute('target') === '_blank' && !accessibleName.includes('new window') && !accessibleName.includes('new tab') && !a.getAttribute('aria-label')?.includes('new')) {
        problems.push({ type: 'link-new-window', text: accessibleName, el: a.outerHTML.substring(0, 120) });
      }
    });

    document.querySelectorAll('button').forEach(btn => {
      const text = (btn.textContent?.trim() || '').toLowerCase();
      const ariaLabel = btn.getAttribute('aria-label')?.trim();
      const accessibleName = ariaLabel || text;

      if (!accessibleName) {
        problems.push({ type: 'btn-no-name', text: 'Empty button', el: btn.outerHTML.substring(0, 120) });
      } else if (vagueButtonTexts.includes(text) && !ariaLabel) {
        problems.push({ type: 'btn-vague', text: accessibleName, el: btn.outerHTML.substring(0, 120) });
      }
    });

    return problems.slice(0, 20);
  });

  for (const p of result) {
    if (p.type === 'link-no-name' || p.type === 'link-empty') {
      issues.push(createIssue(url, 'DA-S7-01', 'Link without accessible name', `Link has no discernible text: ${p.el}`, '2.4.4', 'Link Purpose (In Context)', 'A', 'critical', 'operable', 'Add descriptive text content or aria-label.'));
    } else if (p.type === 'link-vague') {
      issues.push(createIssue(url, 'DA-S7-02', `Non-descriptive link text: "${p.text}"`, `Link text "${p.text}" doesn't describe the destination. Screen reader users cannot determine where this link goes.`, '2.4.4', 'Link Purpose (In Context)', 'A', 'high', 'operable', 'Use descriptive link text e.g., "Read the accessibility policy" instead of "Click here".'));
    } else if (p.type === 'link-new-window') {
      issues.push(createIssue(url, 'DA-S7-03', 'Link opens new window without warning', `Link "${p.text}" opens in a new tab/window without informing the user.`, '3.2.2', 'On Input', 'A', 'medium', 'understandable', 'Add "(opens in new tab)" to the link text or aria-label.', 'medium'));
    } else if (p.type === 'btn-no-name') {
      issues.push(createIssue(url, 'DA-S7-04', 'Button without accessible name', `Button has no discernible text: ${p.el}`, '4.1.2', 'Name, Role, Value', 'A', 'critical', 'robust', 'Add text content or aria-label to the button.'));
    } else if (p.type === 'btn-vague') {
      issues.push(createIssue(url, 'DA-S7-05', `Non-descriptive button text: "${p.text}"`, `Button text "${p.text}" is vague. Users cannot determine what action this button performs.`, '4.1.2', 'Name, Role, Value', 'A', 'medium', 'robust', 'Use descriptive text e.g., "Submit contact form" instead of "Submit".', 'medium'));
    }
  }

  return issues;
}

// ========================================================================
// STEP 9: DYNAMIC CONTENT & ARIA LIVE
// ========================================================================
async function auditDynamicContent(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const liveRegions = document.querySelectorAll('[aria-live], [role="alert"], [role="status"], [role="log"], [role="timer"]');
    const hasLiveRegions = liveRegions.length > 0;

    // Check for status messages without live regions
    const statusContainers = document.querySelectorAll('.toast, .notification, .alert, .message, .status, .error-message, .success-message, [class*="toast"], [class*="snackbar"]');
    const missingLive: string[] = [];

    statusContainers.forEach(el => {
      if (!el.getAttribute('role') && !el.getAttribute('aria-live') && !el.closest('[aria-live]') && !el.closest('[role="alert"]')) {
        missingLive.push(el.className || el.tagName.toLowerCase());
      }
    });

    // Check for auto-updating content without live region
    const timers = document.querySelectorAll('[class*="timer"], [class*="countdown"], [class*="clock"]');
    const timerIssues: string[] = [];
    timers.forEach(t => {
      if (!t.getAttribute('aria-live') && !t.getAttribute('role')) {
        timerIssues.push(t.className || t.tagName.toLowerCase());
      }
    });

    return { hasLiveRegions, missingLive, timerIssues };
  });

  for (const el of result.missingLive) {
    issues.push(createIssue(url, 'DA-S9-01', 'Status message without live region', `Element "${el}" appears to show status messages but lacks role="alert"/role="status" or aria-live.`, '4.1.3', 'Status Messages', 'AA', 'high', 'robust', 'Add role="status" and aria-live="polite" for non-urgent messages, or role="alert" for urgent ones.'));
  }

  for (const el of result.timerIssues) {
    issues.push(createIssue(url, 'DA-S9-02', 'Auto-updating content without live region', `Timer/countdown element "${el}" lacks aria-live to announce updates to screen readers.`, '4.1.3', 'Status Messages', 'AA', 'medium', 'robust', 'Add role="timer" or aria-live="polite" to auto-updating content.'));
  }

  return issues;
}

// ========================================================================
// STEP 10: ARIA VALIDATION
// ========================================================================
async function auditAriaUsage(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const problems: { type: string; detail: string }[] = [];

    // aria-hidden on focusable
    document.querySelectorAll('[aria-hidden="true"] a[href], [aria-hidden="true"] button, [aria-hidden="true"] input, [aria-hidden="true"] [tabindex]:not([tabindex="-1"])').forEach(el => {
      if (!(el as HTMLElement).closest('[inert]')) {
        problems.push({ type: 'hidden-focusable', detail: `Focusable element inside aria-hidden: ${el.outerHTML.substring(0, 100)}` });
      }
    });

    // aria-labelledby referencing non-existent ids
    document.querySelectorAll('[aria-labelledby]').forEach(el => {
      const ids = el.getAttribute('aria-labelledby')!.split(' ');
      for (const id of ids) {
        if (!document.getElementById(id)) {
          problems.push({ type: 'broken-labelledby', detail: `aria-labelledby references non-existent id "${id}": ${el.outerHTML.substring(0, 100)}` });
        }
      }
    });

    // aria-describedby referencing non-existent ids
    document.querySelectorAll('[aria-describedby]').forEach(el => {
      const ids = el.getAttribute('aria-describedby')!.split(' ');
      for (const id of ids) {
        if (!document.getElementById(id)) {
          problems.push({ type: 'broken-describedby', detail: `aria-describedby references non-existent id "${id}"` });
        }
      }
    });

    // role="presentation" or role="none" on focusable
    document.querySelectorAll('[role="presentation"] a, [role="presentation"] button, [role="none"] a, [role="none"] button').forEach(el => {
      problems.push({ type: 'presentation-focusable', detail: `Focusable element inside presentation role: ${el.outerHTML.substring(0, 100)}` });
    });

    return problems.slice(0, 15);
  });

  for (const p of result) {
    if (p.type === 'hidden-focusable') {
      issues.push(createIssue(url, 'DA-S10-01', 'Focusable element inside aria-hidden', p.detail, '4.1.2', 'Name, Role, Value', 'A', 'critical', 'robust', 'Remove aria-hidden from the parent, add tabindex="-1" to the child, or use the inert attribute.'));
    } else if (p.type === 'broken-labelledby') {
      issues.push(createIssue(url, 'DA-S10-02', 'Broken aria-labelledby reference', p.detail, '4.1.2', 'Name, Role, Value', 'A', 'high', 'robust', 'Ensure the referenced id exists in the DOM.'));
    } else if (p.type === 'broken-describedby') {
      issues.push(createIssue(url, 'DA-S10-03', 'Broken aria-describedby reference', p.detail, '4.1.2', 'Name, Role, Value', 'A', 'medium', 'robust', 'Ensure the referenced id exists in the DOM.'));
    } else if (p.type === 'presentation-focusable') {
      issues.push(createIssue(url, 'DA-S10-04', 'Focusable inside presentation role', p.detail, '4.1.2', 'Name, Role, Value', 'A', 'high', 'robust', 'Do not place interactive elements inside role="presentation" containers.'));
    }
  }

  return issues;
}

// ========================================================================
// STEP 12: ZOOM & RESPONSIVENESS
// ========================================================================
async function auditZoomResponsiveness(page: Page, url: string, context: BrowserContext): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  // Test at 200% zoom (320px effective viewport)
  const zoomPage = await context.newPage();
  try {
    await zoomPage.setViewportSize({ width: 640, height: 480 });
    await zoomPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await zoomPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const result = await zoomPage.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const problems: string[] = [];

      // Check for horizontal scrollbar
      if (document.documentElement.scrollWidth > viewportWidth + 10) {
        problems.push(`Page requires horizontal scroll at ${viewportWidth}px: content width is ${document.documentElement.scrollWidth}px`);
      }

      // Check for text truncation / overflow hidden
      const textElements = document.querySelectorAll('p, span, div, a, button, label, h1, h2, h3, h4, h5, h6');
      let overflowHiddenCount = 0;
      for (const el of Array.from(textElements).slice(0, 50)) {
        const style = window.getComputedStyle(el);
        if (style.overflow === 'hidden' && style.textOverflow === 'ellipsis') {
          overflowHiddenCount++;
        }
      }

      // Check for fixed-width elements that may overflow
      const fixedWidthElements = document.querySelectorAll('[style*="width"]');
      let fixedOverflow = 0;
      fixedWidthElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > viewportWidth) fixedOverflow++;
      });

      return { problems, overflowHiddenCount, fixedOverflow, scrollWidth: document.documentElement.scrollWidth, viewportWidth };
    });

    if (result.scrollWidth > result.viewportWidth + 10) {
      issues.push(createIssue(url, 'DA-S12-01', 'Content not reflow-friendly at 200% zoom', `At 200% zoom (${result.viewportWidth}px viewport), page requires horizontal scrolling (content: ${result.scrollWidth}px). Users who zoom should not need to scroll horizontally.`, '1.4.10', 'Reflow', 'AA', 'high', 'perceivable', 'Use responsive layouts with relative units (%, rem, vw). Avoid fixed pixel widths over 320px.'));
    }

    if (result.fixedOverflow > 3) {
      issues.push(createIssue(url, 'DA-S12-02', 'Fixed-width elements overflow at zoom', `${result.fixedOverflow} elements overflow the viewport at 200% zoom.`, '1.4.10', 'Reflow', 'AA', 'medium', 'perceivable', 'Replace fixed pixel widths with max-width and relative units.'));
    }

  } catch (error) {
    console.error('Zoom test error:', error);
  } finally {
    await zoomPage.close();
  }

  return issues;
}

// ========================================================================
// STEP 14: READING ORDER (Screen Reader Simulation)
// ========================================================================
async function auditReadingOrder(page: Page, url: string): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  const result = await page.evaluate(() => {
    const problems: string[] = [];

    // Check for CSS ordering that may disrupt reading order
    const flexGridElements = document.querySelectorAll('[style*="order"], [style*="flex-direction: row-reverse"], [style*="flex-direction: column-reverse"]');
    if (flexGridElements.length > 0) {
      problems.push(`${flexGridElements.length} element(s) use CSS order/reverse which may disrupt screen reader reading order`);
    }

    // Check for content placed via CSS (::before, ::after with meaningful content)
    // This is hard to detect fully, but we can check for empty elements with visually apparent content
    const possiblyVisual = document.querySelectorAll('[aria-hidden="true"]');
    let hiddenWithText = 0;
    possiblyVisual.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 5 && !el.closest('svg')) {
        hiddenWithText++;
      }
    });
    if (hiddenWithText > 0) {
      problems.push(`${hiddenWithText} elements with aria-hidden="true" contain meaningful text that screen readers will skip`);
    }

    // Check for tabular data not in tables
    const preElements = document.querySelectorAll('pre');
    preElements.forEach(pre => {
      const text = pre.textContent || '';
      const tabCount = (text.match(/\t/g) || []).length;
      if (tabCount > 5) {
        problems.push('Tabular data appears to be in <pre> instead of proper <table> markup');
      }
    });

    return problems;
  });

  for (const p of result) {
    if (p.includes('CSS order')) {
      issues.push(createIssue(url, 'DA-S14-01', 'CSS visual order differs from DOM order', p, '1.3.2', 'Meaningful Sequence', 'A', 'medium', 'perceivable', 'Ensure DOM order matches visual order. Avoid CSS order property for meaningful content reordering.', 'medium'));
    } else if (p.includes('aria-hidden')) {
      issues.push(createIssue(url, 'DA-S14-02', 'Meaningful content hidden from screen readers', p, '1.3.1', 'Info and Relationships', 'A', 'high', 'perceivable', 'Remove aria-hidden from elements with meaningful text, or move the text outside the hidden container.'));
    } else if (p.includes('Tabular')) {
      issues.push(createIssue(url, 'DA-S14-03', 'Tabular data not in proper table markup', p, '1.3.1', 'Info and Relationships', 'A', 'high', 'perceivable', 'Use <table> with proper <th> headers instead of <pre> for tabular data.'));
    }
  }

  return issues;
}

// ========================================================================
// HELPER: Create issue with standard shape
// ========================================================================
function createIssue(
  pageUrl: string, testId: string, title: string, description: string,
  wcagCriterion: string, wcagName: string, wcagLevel: 'A' | 'AA' | 'AAA',
  severity: 'critical' | 'high' | 'medium' | 'low',
  category: AccessibilityIssue['category'],
  recommendation: string,
  confidence: 'high' | 'medium' | 'low' = 'high'
): AccessibilityIssue {
  return {
    id: uuidv4(), testId, title, description,
    element: 'page-level', pageUrl,
    wcagCriterion, wcagName, wcagLevel,
    severity,
    impact: `Affects users relying on assistive technologies`,
    recommendation, category,
    source: 'custom-rule',
    confidence
  };
}
