import { AccessibilityIssue, PageData } from '../types/audit';
import { getImpactDescription } from '../wcag/severity';
// uuid replaced with Node.js built-in
const uuidv4 = (): string => crypto.randomUUID();

interface CustomRule {
  testId: string;
  title: string;
  wcagCriterion: string;
  wcagName: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: AccessibilityIssue['category'];
  check: (html: string, url: string) => CustomRuleResult[];
}

interface CustomRuleResult {
  element: string;
  elementHtml?: string;
  description: string;
  recommendation: string;
  codeFix?: string;
}

// ========== HELPER FUNCTIONS ==========

function findAllMatches(html: string, regex: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match);
  }
  return matches;
}

function getElementContext(html: string, index: number, length: number = 200): string {
  const start = Math.max(0, index - 50);
  const end = Math.min(html.length, index + length);
  return html.substring(start, end).replace(/\s+/g, ' ').trim();
}

// ========== CUSTOM RULES DEFINITIONS ==========

const customRules: CustomRule[] = [
  // ===== PERCEIVABLE =====
  {
    testId: 'P-01',
    title: 'Missing alt text on images',
    wcagCriterion: '1.1.1',
    wcagName: 'Non-text Content',
    wcagLevel: 'A',
    severity: 'critical',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const imgRegex = /<img\b([^>]*)>/gi;
      const matches = findAllMatches(html, imgRegex);
      for (const match of matches) {
        const attrs = match[1];
        if (!attrs.includes('alt=') && !attrs.includes('role="presentation"') && !attrs.includes('role="none"')) {
          results.push({
            element: 'img',
            elementHtml: match[0].substring(0, 200),
            description: 'Image element is missing an alt attribute, making it inaccessible to screen reader users.',
            recommendation: 'Add a descriptive alt attribute to the image. Use alt="" for decorative images.',
            codeFix: `<!-- Add alt text -->\n<img alt="Description of image" ${attrs.trim()} />`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'P-02',
    title: 'Decorative images not properly marked',
    wcagCriterion: '1.1.1',
    wcagName: 'Non-text Content',
    wcagLevel: 'A',
    severity: 'medium',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const imgRegex = /<img\b([^>]*?)alt\s*=\s*["'](\s*)["']([^>]*)>/gi;
      const matches = findAllMatches(html, imgRegex);
      for (const match of matches) {
        const fullTag = match[0];
        if (!fullTag.includes('role="presentation"') && !fullTag.includes('role="none"') && !fullTag.includes('aria-hidden="true"')) {
          results.push({
            element: 'img[alt=""]',
            elementHtml: fullTag.substring(0, 200),
            description: 'Image with empty alt text should also have role="presentation" or aria-hidden="true" to properly convey decorative intent.',
            recommendation: 'Add role="presentation" or aria-hidden="true" for decorative images with empty alt text.',
            codeFix: fullTag.replace('<img', '<img role="presentation"')
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'P-03',
    title: 'Missing captions for video content',
    wcagCriterion: '1.2.2',
    wcagName: 'Captions (Prerecorded)',
    wcagLevel: 'A',
    severity: 'critical',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const videoRegex = /<video\b[^>]*>([\s\S]*?)<\/video>/gi;
      const matches = findAllMatches(html, videoRegex);
      for (const match of matches) {
        const videoContent = match[1];
        if (!videoContent.includes('<track') || !videoContent.toLowerCase().includes('kind="captions"')) {
          results.push({
            element: 'video',
            elementHtml: match[0].substring(0, 300),
            description: 'Video element is missing captions track. Deaf and hard-of-hearing users cannot access audio content.',
            recommendation: 'Add a <track> element with kind="captions" and a valid .vtt caption file.',
            codeFix: `<video controls>\n  <source src="video.mp4" type="video/mp4" />\n  <track kind="captions" src="captions.vtt" srclang="en" label="English" default />\n</video>`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'P-04',
    title: 'Missing audio descriptions for video',
    wcagCriterion: '1.2.5',
    wcagName: 'Audio Description (Prerecorded)',
    wcagLevel: 'AA',
    severity: 'medium',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const videoRegex = /<video\b[^>]*>([\s\S]*?)<\/video>/gi;
      const matches = findAllMatches(html, videoRegex);
      for (const match of matches) {
        const videoContent = match[1];
        if (!videoContent.toLowerCase().includes('kind="descriptions"')) {
          results.push({
            element: 'video',
            elementHtml: match[0].substring(0, 300),
            description: 'Video element is missing audio descriptions track for blind users.',
            recommendation: 'Add a <track> element with kind="descriptions" to describe important visual information.',
            codeFix: `<track kind="descriptions" src="descriptions.vtt" srclang="en" label="English" />`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'P-05',
    title: 'Information conveyed by color alone',
    wcagCriterion: '1.4.1',
    wcagName: 'Use of Color',
    wcagLevel: 'A',
    severity: 'high',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      // Check for elements with color-based class names but no other indicators
      const colorOnlyPatterns = [
        /class="[^"]*(?:text-red|text-green|color-red|color-green|error-red|success-green)[^"]*"/gi,
        /style="[^"]*color\s*:\s*(red|green|#ff0000|#00ff00|#f00|#0f0)[^"]*"/gi
      ];
      for (const pattern of colorOnlyPatterns) {
        const matches = findAllMatches(html, pattern);
        for (const match of matches) {
          const context = getElementContext(html, match.index);
          if (!context.includes('aria-') && !context.includes('role=') && !context.includes('icon') && !context.includes('✓') && !context.includes('✗')) {
            results.push({
              element: 'element with color-only indicator',
              elementHtml: context,
              description: 'Content appears to use color as the sole method of conveying information.',
              recommendation: 'Add text, icons, or patterns alongside color to convey information. Do not rely on color alone.',
              codeFix: `<!-- Add an icon or text alongside color -->\n<span class="error" style="color: red;">⚠ Error: Description here</span>`
            });
          }
        }
      }
      return results;
    }
  },
  {
    testId: 'P-06',
    title: 'Improper heading hierarchy',
    wcagCriterion: '1.3.1',
    wcagName: 'Info and Relationships',
    wcagLevel: 'A',
    severity: 'high',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const headingRegex = /<h([1-6])\b[^>]*>/gi;
      const headings = findAllMatches(html, headingRegex);
      let lastLevel = 0;
      for (const match of headings) {
        const level = parseInt(match[1]);
        if (lastLevel > 0 && level > lastLevel + 1) {
          results.push({
            element: `h${level}`,
            elementHtml: getElementContext(html, match.index, 100),
            description: `Heading level h${level} skips from h${lastLevel}. Heading levels should not skip (e.g., h${lastLevel} → h${lastLevel + 1}).`,
            recommendation: `Change to h${lastLevel + 1} or add intermediate heading levels. Headings should form a logical outline.`,
            codeFix: `<!-- Change h${level} to h${lastLevel + 1} -->\n<h${lastLevel + 1}>Heading Text</h${lastLevel + 1}>`
          });
        }
        lastLevel = level;
      }
      return results;
    }
  },
  {
    testId: 'P-07',
    title: 'Missing form field label associations',
    wcagCriterion: '1.3.1',
    wcagName: 'Info and Relationships',
    wcagLevel: 'A',
    severity: 'critical',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const inputRegex = /<input\b([^>]*?)>/gi;
      const matches = findAllMatches(html, inputRegex);
      for (const match of matches) {
        const attrs = match[1];
        const type = attrs.match(/type\s*=\s*["'](\w+)["']/i);
        const inputType = type ? type[1].toLowerCase() : 'text';
        if (['hidden', 'submit', 'button', 'reset', 'image'].includes(inputType)) continue;
        const hasId = attrs.match(/id\s*=\s*["']([^"']+)["']/i);
        const hasAriaLabel = attrs.includes('aria-label') || attrs.includes('aria-labelledby');
        const hasTitle = attrs.includes('title=');
        if (!hasAriaLabel && !hasTitle) {
          if (!hasId) {
            results.push({
              element: `input[type="${inputType}"]`,
              elementHtml: match[0].substring(0, 200),
              description: 'Form input has no id attribute and no ARIA label, so it cannot be associated with a <label>.',
              recommendation: 'Add an id attribute and associate it with a <label for="id"> element, or add an aria-label.',
              codeFix: `<label for="fieldId">Field Label</label>\n<input type="${inputType}" id="fieldId" />`
            });
          }
        }
      }
      return results;
    }
  },
  {
    testId: 'P-10',
    title: 'Inline styles with potential contrast issues',
    wcagCriterion: '1.4.3',
    wcagName: 'Contrast (Minimum)',
    wcagLevel: 'AA',
    severity: 'high',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      // Detect light-on-light or dark-on-dark inline color patterns
      const styleRegex = /style="[^"]*color\s*:\s*([^;]+);[^"]*background[^:]*:\s*([^;"]+)/gi;
      const matches = findAllMatches(html, styleRegex);
      for (const match of matches) {
        const fg = match[1].trim().toLowerCase();
        const bg = match[2].trim().toLowerCase();
        if ((fg.includes('#fff') && bg.includes('#fff')) ||
            (fg.includes('#000') && bg.includes('#000')) ||
            (fg.includes('white') && bg.includes('white')) ||
            (fg === 'gray' || fg === 'grey' || fg === '#999' || fg === '#ccc' || fg === 'silver')) {
          results.push({
            element: 'element with inline styles',
            elementHtml: getElementContext(html, match.index, 200),
            description: 'Element has inline styles with potentially insufficient color contrast.',
            recommendation: 'Ensure text color and background color have a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text.',
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'P-13',
    title: 'Content not reflow-friendly (fixed widths)',
    wcagCriterion: '1.4.10',
    wcagName: 'Reflow',
    wcagLevel: 'AA',
    severity: 'medium',
    category: 'perceivable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const fixedWidthRegex = /style="[^"]*width\s*:\s*(\d{4,})px/gi;
      const matches = findAllMatches(html, fixedWidthRegex);
      for (const match of matches) {
        const width = parseInt(match[1]);
        if (width > 320) {
          results.push({
            element: 'element with fixed width',
            elementHtml: getElementContext(html, match.index, 200),
            description: `Element has a fixed width of ${width}px which may cause horizontal scrolling at 320px viewport.`,
            recommendation: 'Use responsive units (%, rem, vw) instead of fixed pixel widths. Ensure content reflows at 320px width.',
            codeFix: `/* Use responsive width */\nwidth: 100%;\nmax-width: ${width}px;`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'R-08',
    title: 'Inaccessible SVG elements',
    wcagCriterion: '1.1.1',
    wcagName: 'Non-text Content',
    wcagLevel: 'A',
    severity: 'high',
    category: 'robust',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const svgRegex = /<svg\b([^>]*?)>([\s\S]*?)<\/svg>/gi;
      const matches = findAllMatches(html, svgRegex);
      for (const match of matches) {
        const attrs = match[1];
        const content = match[2];
        const hasAriaLabel = attrs.includes('aria-label');
        const hasAriaHidden = attrs.includes('aria-hidden="true"');
        const hasTitle = content.includes('<title');
        const hasRole = attrs.includes('role="img"');
        if (!hasAriaHidden && !hasAriaLabel && !hasTitle) {
          results.push({
            element: 'svg',
            elementHtml: match[0].substring(0, 200),
            description: 'SVG element is missing accessible name. Screen readers cannot describe this graphic.',
            recommendation: 'Add role="img" and aria-label to the SVG, or add a <title> element as the first child. Use aria-hidden="true" for purely decorative SVGs.',
            codeFix: `<svg role="img" aria-label="Description of graphic">\n  <title>Description of graphic</title>\n  <!-- SVG content -->\n</svg>`
          });
        }
      }
      return results;
    }
  },

  // ===== OPERABLE =====
  {
    testId: 'O-01',
    title: 'Non-keyboard accessible interactive elements',
    wcagCriterion: '2.1.1',
    wcagName: 'Keyboard',
    wcagLevel: 'A',
    severity: 'critical',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      // Detect click handlers on non-interactive elements
      const clickRegex = /<(div|span|td|li|p)\b([^>]*?)onclick\s*=/gi;
      const matches = findAllMatches(html, clickRegex);
      for (const match of matches) {
        const tag = match[1];
        const attrs = match[2];
        if (!attrs.includes('tabindex') && !attrs.includes('role="button"') && !attrs.includes('role="link"')) {
          results.push({
            element: tag,
            elementHtml: getElementContext(html, match.index, 150),
            description: `<${tag}> has a click handler but is not keyboard accessible. This element cannot be focused or activated via keyboard.`,
            recommendation: `Use a <button> or <a> element instead, or add tabindex="0", role="button", and keyboard event handlers.`,
            codeFix: `<${tag} role="button" tabindex="0" onclick="handler()" onkeydown="if(event.key==='Enter')handler()">`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'O-03',
    title: 'Missing skip navigation link',
    wcagCriterion: '2.4.1',
    wcagName: 'Bypass Blocks',
    wcagLevel: 'A',
    severity: 'high',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const hasSkipLink = html.match(/skip[\s-]*(to|nav|main|content)/i) ||
                          html.match(/<a[^>]*href=["']#(main|content|maincontent)[^"']*["']/i);
      const hasMainLandmark = html.includes('role="main"') || html.includes('<main');
      if (!hasSkipLink && hasMainLandmark) {
        results.push({
          element: 'body',
          description: 'Page is missing a "Skip to main content" link. Keyboard users must tab through all navigation elements on every page.',
          recommendation: 'Add a skip navigation link as the first focusable element in the page.',
          codeFix: `<!-- Add as first child of <body> -->\n<a href="#main-content" class="skip-link">Skip to main content</a>\n\n<!-- Style to show on focus -->\n<style>\n.skip-link {\n  position: absolute;\n  left: -10000px;\n  top: auto;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n}\n.skip-link:focus {\n  position: fixed;\n  top: 10px;\n  left: 10px;\n  width: auto;\n  height: auto;\n  padding: 12px 24px;\n  background: #1a1a2e;\n  color: white;\n  z-index: 10000;\n  border-radius: 4px;\n}\n</style>`
        });
      }
      return results;
    }
  },
  {
    testId: 'O-04',
    title: 'Missing or inadequate page title',
    wcagCriterion: '2.4.2',
    wcagName: 'Page Titled',
    wcagLevel: 'A',
    severity: 'high',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (!titleMatch) {
        results.push({
          element: 'head',
          description: 'Page is missing a <title> element.',
          recommendation: 'Add a descriptive <title> that identifies the subject of the page.',
          codeFix: `<title>Page Title - Site Name</title>`
        });
      } else {
        const title = titleMatch[1].trim();
        if (title.length < 3 || title.toLowerCase() === 'untitled' || title.toLowerCase() === 'document' || title.toLowerCase() === 'page') {
          results.push({
            element: 'title',
            elementHtml: titleMatch[0],
            description: `Page title "${title}" is not descriptive. Titles should describe the page topic or purpose.`,
            recommendation: 'Use a title that clearly describes what the page is about, e.g., "Contact Us - Company Name".',
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'O-05',
    title: 'Illogical tab order (positive tabindex)',
    wcagCriterion: '2.4.3',
    wcagName: 'Focus Order',
    wcagLevel: 'A',
    severity: 'high',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const tabindexRegex = /tabindex\s*=\s*["'](\d+)["']/gi;
      const matches = findAllMatches(html, tabindexRegex);
      for (const match of matches) {
        const value = parseInt(match[1]);
        if (value > 0) {
          results.push({
            element: `element[tabindex="${value}"]`,
            elementHtml: getElementContext(html, match.index, 150),
            description: `Positive tabindex value (${value}) disrupts natural tab order and creates an unpredictable focus sequence.`,
            recommendation: 'Remove positive tabindex values. Use tabindex="0" to add elements to natural tab order, or tabindex="-1" for programmatic focus only.',
            codeFix: `<!-- Use 0 instead of positive value -->\ntabindex="0"`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'O-06',
    title: 'Non-descriptive link text',
    wcagCriterion: '2.4.4',
    wcagName: 'Link Purpose (In Context)',
    wcagLevel: 'A',
    severity: 'high',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const linkRegex = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
      const badTexts = ['click here', 'here', 'more', 'read more', 'learn more', 'link', 'click', 'this'];
      const matches = findAllMatches(html, linkRegex);
      for (const match of matches) {
        const text = match[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
        if (badTexts.includes(text)) {
          results.push({
            element: 'a',
            elementHtml: match[0].substring(0, 200),
            description: `Link text "${text}" is not descriptive. Screen reader users cannot determine the link's destination or purpose.`,
            recommendation: 'Use descriptive link text that explains where the link goes, e.g., "Read the accessibility guidelines" instead of "Click here".',
            codeFix: `<!-- Before -->\n<a href="url">${text}</a>\n\n<!-- After -->\n<a href="url">Descriptive text about the destination</a>`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'O-07',
    title: 'Focus visibility suppressed via CSS',
    wcagCriterion: '2.4.7',
    wcagName: 'Focus Visible',
    wcagLevel: 'AA',
    severity: 'critical',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      // Check for outline: none or outline: 0 without replacement
      const outlineNoneRegex = /(:focus\s*\{[^}]*outline\s*:\s*(none|0)[^}]*\})/gi;
      const matches = findAllMatches(html, outlineNoneRegex);
      for (const match of matches) {
        const block = match[1];
        if (!block.includes('box-shadow') && !block.includes('border') && !block.includes('outline-offset')) {
          results.push({
            element: ':focus styles',
            elementHtml: match[0].substring(0, 200),
            description: 'CSS removes focus outline without providing an alternative focus indicator.',
            recommendation: 'Never remove focus indicators without providing a visible alternative (e.g., box-shadow, border, or custom outline).',
            codeFix: `/* Provide visible focus indicator */\n:focus {\n  outline: 2px solid #3B82F6;\n  outline-offset: 2px;\n}\n\n/* Or use :focus-visible for mouse-click users */\n:focus:not(:focus-visible) {\n  outline: none;\n}\n:focus-visible {\n  outline: 2px solid #3B82F6;\n  outline-offset: 2px;\n}`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'O-10',
    title: 'Potential timeout without warning',
    wcagCriterion: '2.2.1',
    wcagName: 'Timing Adjustable',
    wcagLevel: 'A',
    severity: 'high',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const timeoutPatterns = [
        /setTimeout\s*\([^,]+,\s*\d{4,}\)/gi,
        /meta\s[^>]*http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["']\d/gi
      ];
      for (const pattern of timeoutPatterns) {
        const matches = findAllMatches(html, pattern);
        for (const match of matches) {
          results.push({
            element: 'timeout/redirect',
            elementHtml: match[0].substring(0, 200),
            description: 'Page may have automatic timeouts or redirects. Users with disabilities may need more time to read or interact with content.',
            recommendation: 'Allow users to extend, adjust, or turn off any time limits. Provide a warning at least 20 seconds before timeout.',
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'O-11',
    title: 'Auto-playing media content',
    wcagCriterion: '2.2.2',
    wcagName: 'Pause, Stop, Hide',
    wcagLevel: 'A',
    severity: 'high',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const autoplayRegex = /<(video|audio)\b[^>]*autoplay[^>]*>/gi;
      const matches = findAllMatches(html, autoplayRegex);
      for (const match of matches) {
        results.push({
          element: match[1],
          elementHtml: match[0].substring(0, 200),
          description: 'Media element auto-plays, which can be disruptive to screen reader users and users with cognitive disabilities.',
          recommendation: 'Remove the autoplay attribute, or provide a mechanism to pause, stop, or mute the media within 3 seconds.',
          codeFix: `<!-- Remove autoplay -->\n<${match[1]} controls>\n  <!-- sources -->\n</${match[1]}>`
        });
      }
      return results;
    }
  },
  {
    testId: 'O-13',
    title: 'Target size too small',
    wcagCriterion: '2.5.8',
    wcagName: 'Target Size (Minimum)',
    wcagLevel: 'AA',
    severity: 'medium',
    category: 'operable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      // Check for small inline links/buttons with small padding or size
      const smallTargetRegex = /style="[^"]*(?:width|height)\s*:\s*(\d+)px[^"]*"/gi;
      const matches = findAllMatches(html, smallTargetRegex);
      for (const match of matches) {
        const size = parseInt(match[1]);
        if (size > 0 && size < 24) {
          const context = getElementContext(html, match.index, 200);
          if (context.match(/<(a|button|input|select)\b/i)) {
            results.push({
              element: 'interactive element',
              elementHtml: context,
              description: `Interactive element has a target size of ${size}px, which is below the minimum 24×24px requirement.`,
              recommendation: 'Increase the clickable area to at least 24×24 CSS pixels. Use padding to increase touch target size.',
              codeFix: `/* Ensure minimum target size */\nmin-width: 24px;\nmin-height: 24px;\npadding: 8px;`
            });
          }
        }
      }
      return results;
    }
  },

  // ===== UNDERSTANDABLE =====
  {
    testId: 'U-01',
    title: 'Missing page language attribute',
    wcagCriterion: '3.1.1',
    wcagName: 'Language of Page',
    wcagLevel: 'A',
    severity: 'critical',
    category: 'understandable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const htmlTag = html.match(/<html\b([^>]*)>/i);
      if (htmlTag) {
        if (!htmlTag[1].includes('lang=')) {
          results.push({
            element: 'html',
            elementHtml: htmlTag[0],
            description: 'The <html> element is missing a lang attribute. Screen readers cannot determine the page\'s language.',
            recommendation: 'Add a lang attribute to the <html> element with the appropriate BCP 47 language tag.',
            codeFix: `<html lang="en">`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'U-03',
    title: 'Form inputs without labels',
    wcagCriterion: '3.3.2',
    wcagName: 'Labels or Instructions',
    wcagLevel: 'A',
    severity: 'critical',
    category: 'understandable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const inputRegex = /<(input|select|textarea)\b([^>]*?)>/gi;
      const matches = findAllMatches(html, inputRegex);
      for (const match of matches) {
        const tag = match[1];
        const attrs = match[2];
        const type = attrs.match(/type\s*=\s*["'](\w+)["']/i);
        const inputType = type ? type[1].toLowerCase() : 'text';
        if (['hidden', 'submit', 'button', 'reset'].includes(inputType)) continue;
        const hasLabel =
          attrs.includes('aria-label') ||
          attrs.includes('aria-labelledby') ||
          attrs.includes('title=') ||
          attrs.includes('placeholder=');
        const hasId = attrs.match(/id\s*=\s*["']([^"']+)["']/i);
        if (hasId) {
          const labelFor = new RegExp(`<label[^>]*for\\s*=\\s*["']${hasId[1]}["']`, 'i');
          if (labelFor.test(html)) continue;
        }
        if (!hasLabel && !hasId) {
          results.push({
            element: `${tag}[type="${inputType}"]`,
            elementHtml: match[0].substring(0, 200),
            description: `Form ${tag} element has no visible label, aria-label, or associated <label> element.`,
            recommendation: `Add a <label> element with a matching "for" attribute, or add an aria-label attribute.`,
            codeFix: `<label for="input-id">Field Label</label>\n<${tag} id="input-id" type="${inputType}" />`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'U-08',
    title: 'Context change on focus (auto-submit)',
    wcagCriterion: '3.2.1',
    wcagName: 'On Focus',
    wcagLevel: 'A',
    severity: 'high',
    category: 'understandable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const focusChangeRegex = /onfocus\s*=\s*["'][^"']*(?:submit|location|window\.open|navigate)/gi;
      const matches = findAllMatches(html, focusChangeRegex);
      for (const match of matches) {
        results.push({
          element: 'element with onfocus',
          elementHtml: getElementContext(html, match.index, 200),
          description: 'Element triggers a context change (navigation/submission) on focus, which is unexpected for keyboard users.',
          recommendation: 'Do not change context when an element receives focus. Use explicit user actions (click/submit) for context changes.',
        });
      }
      return results;
    }
  },
  {
    testId: 'U-09',
    title: 'Context change on input',
    wcagCriterion: '3.2.2',
    wcagName: 'On Input',
    wcagLevel: 'A',
    severity: 'high',
    category: 'understandable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const selectChangeRegex = /<select\b[^>]*onchange\s*=\s*["'][^"']*(?:submit|location|window\.|navigate)/gi;
      const matches = findAllMatches(html, selectChangeRegex);
      for (const match of matches) {
        results.push({
          element: 'select[onchange]',
          elementHtml: match[0].substring(0, 200),
          description: 'Dropdown/select element triggers a context change (navigation/submission) on value change without warning.',
          recommendation: 'Add a separate submit button instead of auto-submitting on selection change.',
          codeFix: `<!-- Add explicit submit -->\n<select id="options">\n  <option>Choose...</option>\n</select>\n<button type="submit">Go</button>`
        });
      }
      return results;
    }
  },
  {
    testId: 'U-13',
    title: 'Visible label not matching accessible name',
    wcagCriterion: '2.5.3',
    wcagName: 'Label in Name',
    wcagLevel: 'A',
    severity: 'medium',
    category: 'understandable',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const ariaLabelRegex = /<(button|a|input)\b[^>]*aria-label\s*=\s*["']([^"']+)["'][^>]*>([^<]*)</gi;
      const matches = findAllMatches(html, ariaLabelRegex);
      for (const match of matches) {
        const ariaLabel = match[2].toLowerCase().trim();
        const visibleText = match[3].toLowerCase().trim();
        if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
          results.push({
            element: match[1],
            elementHtml: match[0].substring(0, 200),
            description: `Accessible name "${match[2]}" does not contain the visible text "${match[3]}". Voice control users cannot activate this element by speaking its visible label.`,
            recommendation: 'Ensure the aria-label contains the visible text label. The accessible name should start with or include the visible text.',
            codeFix: `<${match[1]} aria-label="${match[3]} - additional context">${match[3]}</${match[1]}>`
          });
        }
      }
      return results;
    }
  },

  // ===== ROBUST =====
  {
    testId: 'R-01',
    title: 'Invalid or duplicate ARIA roles',
    wcagCriterion: '4.1.2',
    wcagName: 'Name, Role, Value',
    wcagLevel: 'A',
    severity: 'high',
    category: 'robust',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const validRoles = new Set([
        'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox',
        'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog',
        'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
        'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu',
        'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note',
        'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row',
        'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider',
        'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term',
        'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
      ]);
      const roleRegex = /role\s*=\s*["']([^"']+)["']/gi;
      const matches = findAllMatches(html, roleRegex);
      for (const match of matches) {
        const role = match[1].toLowerCase().trim();
        if (!validRoles.has(role)) {
          results.push({
            element: `element[role="${role}"]`,
            elementHtml: getElementContext(html, match.index, 150),
            description: `Invalid ARIA role "${role}" used. Assistive technologies will not recognize this role.`,
            recommendation: `Use a valid ARIA role from the WAI-ARIA specification. Common roles: button, link, navigation, main, dialog.`,
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'R-03',
    title: 'Interactive elements missing ARIA labels',
    wcagCriterion: '4.1.2',
    wcagName: 'Name, Role, Value',
    wcagLevel: 'A',
    severity: 'high',
    category: 'robust',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      // Check buttons with only icons (no text content)
      const iconButtonRegex = /<button\b([^>]*)>\s*<(?:i|svg|img|span)\b[^>]*(?:icon|fa-|material)[^>]*>\s*<\/button>/gi;
      const matches = findAllMatches(html, iconButtonRegex);
      for (const match of matches) {
        const attrs = match[1];
        if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby') && !attrs.includes('title=')) {
          results.push({
            element: 'button (icon-only)',
            elementHtml: match[0].substring(0, 200),
            description: 'Button contains only an icon with no accessible text. Screen readers will announce it as an empty button.',
            recommendation: 'Add aria-label to describe the button\'s purpose, e.g., aria-label="Close" or aria-label="Search".',
            codeFix: `<button aria-label="Action description">\n  <svg><!-- icon --></svg>\n</button>`
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'R-04',
    title: 'Duplicate element IDs',
    wcagCriterion: '4.1.2',
    wcagName: 'Name, Role, Value',
    wcagLevel: 'A',
    severity: 'high',
    category: 'robust',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      const idRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
      const idMap = new Map<string, number>();
      const matches = findAllMatches(html, idRegex);
      for (const match of matches) {
        const id = match[1];
        idMap.set(id, (idMap.get(id) || 0) + 1);
      }
      for (const [id, count] of idMap.entries()) {
        if (count > 1) {
          results.push({
            element: `#${id}`,
            description: `Duplicate id="${id}" found ${count} times. IDs must be unique for ARIA associations (aria-labelledby, aria-describedby) to work correctly.`,
            recommendation: `Ensure each id value is unique within the page. Use classes for styling and unique IDs for ARIA references.`,
          });
        }
      }
      return results;
    }
  },
  {
    testId: 'R-05',
    title: 'Missing ARIA live region for status messages',
    wcagCriterion: '4.1.3',
    wcagName: 'Status Messages',
    wcagLevel: 'AA',
    severity: 'medium',
    category: 'robust',
    check: (html) => {
      const results: CustomRuleResult[] = [];
      // Check for toast/notification/alert patterns without aria-live
      const statusPatterns = [
        /class="[^"]*(?:toast|notification|alert|status|message|snackbar|banner)[^"]*"/gi,
      ];
      for (const pattern of statusPatterns) {
        const matches = findAllMatches(html, pattern);
        for (const match of matches) {
          const context = getElementContext(html, match.index, 300);
          if (!context.includes('aria-live') && !context.includes('role="alert"') && !context.includes('role="status"')) {
            results.push({
              element: 'status/notification element',
              elementHtml: context.substring(0, 200),
              description: 'Status message or notification element does not use aria-live or role="alert". Screen readers will not announce dynamic content updates.',
              recommendation: 'Add aria-live="polite" for status updates or role="alert" for important messages.',
              codeFix: `<!-- For polite updates -->\n<div aria-live="polite" class="notification">...</div>\n\n<!-- For urgent alerts -->\n<div role="alert">Error message here</div>`
            });
          }
        }
      }
      return results;
    }
  },
];

// ========== MAIN EXPORT ==========

export async function runCustomRules(
  pageData: PageData,
  onProgress?: (msg: string) => void
): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  onProgress?.(`Running ${customRules.length} custom rules on ${pageData.title}...`);

  for (const rule of customRules) {
    try {
      const ruleResults = rule.check(pageData.html, pageData.url);
      for (const result of ruleResults) {
        issues.push({
          id: uuidv4(),
          testId: rule.testId,
          title: rule.title,
          description: result.description,
          element: result.element,
          elementHtml: result.elementHtml,
          pageUrl: pageData.url,
          wcagCriterion: rule.wcagCriterion,
          wcagName: rule.wcagName,
          wcagLevel: rule.wcagLevel,
          severity: rule.severity,
          impact: getImpactDescription(rule.wcagCriterion, rule.severity),
          recommendation: result.recommendation,
          codeFix: result.codeFix,
          category: rule.category,
          source: 'custom-rule',
          confidence: 'medium' as const
        });
      }
    } catch (error) {
      console.error(`Custom rule ${rule.testId} failed:`, error);
    }
  }

  onProgress?.(`Custom rules complete: ${issues.length} issues found.`);
  return issues;
}

export function getCustomRuleCount(): number {
  return customRules.length;
}
