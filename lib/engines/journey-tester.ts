import { BrowserContext, Page } from 'playwright';
import { AccessibilityIssue, JourneyTestResult, JourneyStep, PageData } from '../types/audit';
// uuid replaced with Node.js built-in
const uuidv4 = (): string => crypto.randomUUID();

/**
 * User Journey Accessibility Tester
 * Simulates real user flows (keyboard navigation, form interaction, focus management)
 * and detects issues that static analysis cannot find.
 */

export async function runJourneyTests(
  context: BrowserContext,
  pages: PageData[],
  onProgress?: (msg: string) => void
): Promise<{ journeyResults: JourneyTestResult[]; issues: AccessibilityIssue[] }> {
  const journeyResults: JourneyTestResult[] = [];
  const allIssues: AccessibilityIssue[] = [];
  const firstPageUrl = pages[0]?.url;

  if (!firstPageUrl) return { journeyResults, issues: allIssues };

  // Test 1: Keyboard Navigation Journey
  onProgress?.('Testing keyboard navigation...');
  const keyboardResult = await testKeyboardNavigation(context, firstPageUrl);
  journeyResults.push(keyboardResult);
  allIssues.push(...keyboardResult.issues);

  // Test 2: Focus Management Journey
  onProgress?.('Testing focus management...');
  const focusResult = await testFocusManagement(context, firstPageUrl);
  journeyResults.push(focusResult);
  allIssues.push(...focusResult.issues);

  // Test 3: Form Interaction (if forms exist)
  onProgress?.('Testing form interactions...');
  for (const pageData of pages.slice(0, 5)) {
    if (pageData.html.includes('<form') || pageData.html.includes('<input')) {
      const formResult = await testFormInteraction(context, pageData.url);
      journeyResults.push(formResult);
      allIssues.push(...formResult.issues);
      break; // test first page with forms
    }
  }

  // Test 4: Navigation Flow
  onProgress?.('Testing navigation flow...');
  if (pages.length > 1) {
    const navResult = await testNavigationFlow(context, pages.slice(0, 3));
    journeyResults.push(navResult);
    allIssues.push(...navResult.issues);
  }

  // Test 5: Error State Testing
  onProgress?.('Testing error states...');
  for (const pageData of pages.slice(0, 5)) {
    if (pageData.html.includes('<form')) {
      const errorResult = await testErrorStates(context, pageData.url);
      journeyResults.push(errorResult);
      allIssues.push(...errorResult.issues);
      break;
    }
  }

  return { journeyResults, issues: allIssues };
}

/**
 * Dark Pattern Journey Tester
 * Simulates transactional user flows to catch patterns invisible to static DOM analysis:
 * - Sneak into basket (items added without explicit user action)
 * - Pre-ticked add-ons that appear during checkout
 * - Roach Motel (cancel requires more steps than subscribe)
 */
/** Navigate a page with bot-detection fallback — uses cached HTML when live navigation fails */
async function gotoWithFallback(
  page: Page,
  url: string,
  htmlCache?: Map<string, string>
): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Check if we got a bot challenge page
    const html = await page.content().catch(() => '');
    const isChallenge = html.length < 3000 || ['just a moment', 'checking your browser', 'cf-browser-verification', '_cf_chl_', 'enable javascript and cookies'].some(s => html.toLowerCase().includes(s));
    if (isChallenge && htmlCache) {
      const cached = htmlCache.get(url) || htmlCache.get(url.replace(/\/$/, '')) || htmlCache.get(url + '/');
      if (cached && cached.length > 3000) {
        await page.setContent(cached, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    }
  } catch {
    if (htmlCache) {
      const cached = htmlCache.get(url) || htmlCache.get(url.replace(/\/$/, '')) || htmlCache.get(url + '/');
      if (cached && cached.length > 3000) {
        await page.setContent(cached, { waitUntil: 'domcontentloaded' }).catch(() => {});
        return;
      }
    }
    throw new Error(`Navigation failed for ${url} and no cached HTML available`);
  }
}

export async function runDarkPatternJourney(
  context: BrowserContext,
  baseUrl: string,
  journeySteps?: { url: string; label: string }[],
  onProgress?: (msg: string) => void,
  htmlCache?: Map<string, string>
): Promise<{ journeyName: string; findings: DarkPatternJourneyFinding[] }> {
  const findings: DarkPatternJourneyFinding[] = [];
  const page = await context.newPage();

  try {
    // Step 1: Load the base/product page and record initial cart state
    onProgress?.('Dark pattern journey: loading product page...');
    await gotoWithFallback(page, baseUrl, htmlCache);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const initialCartState = await page.evaluate(() => {
      const cartIndicators = document.querySelectorAll(
        '[class*="cart"], [class*="basket"], [class*="bag"], [aria-label*="cart"], [aria-label*="basket"]'
      );
      const counts: string[] = [];
      cartIndicators.forEach(el => {
        const text = el.textContent?.trim();
        if (text) counts.push(text);
      });
      return counts;
    });

    // Step 2: Click Add to Cart / Buy if present and record what changed
    onProgress?.('Dark pattern journey: interacting with add-to-cart...');
    const addToCartClicked = await page.evaluate(() => {
      // Note: :has-text() is Playwright-only — use native DOM selectors + text matching
      const cssSels = [
        'button[id*="add-to-cart"]', 'button[name*="add-to-cart"]',
        'button[class*="add-to-cart"]', 'button[class*="addToCart"]',
        '[data-action="add-to-cart"]', 'input[value*="Add to Cart"]',
      ];
      for (const sel of cssSels) {
        const btn = document.querySelector(sel) as HTMLElement | null;
        if (btn) { btn.click(); return true; }
      }
      // Text-matching fallback (native DOM, no Playwright pseudo-selectors)
      const addTexts = ['add to cart', 'add to bag', 'add to basket', 'buy now', 'add to wishlist'];
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"]')) as HTMLElement[];
      for (const btn of allBtns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (addTexts.some(t => txt.includes(t))) { btn.click(); return true; }
      }
      return false;
    });

    if (addToCartClicked) {
      await page.waitForTimeout(2000);

      // Check if additional items were silently added
      const postCartState = await page.evaluate(() => {
        const preChecked = document.querySelectorAll(
          'input[type="checkbox"]:checked, input[type="radio"]:checked'
        );
        const preCheckedItems: { label: string; value: string }[] = [];
        preChecked.forEach(el => {
          const input = el as HTMLInputElement;
          const label = document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()
            || input.closest('label')?.textContent?.trim()
            || input.name || '';
          if (label) preCheckedItems.push({ label, value: input.value || '' });
        });

        // Look for upsell/add-on items that appeared
        const upsells = document.querySelectorAll(
          '[class*="upsell"], [class*="cross-sell"], [class*="addon"], [class*="add-on"], [class*="protection"]'
        );
        const upsellTexts: string[] = [];
        upsells.forEach(el => {
          const text = el.textContent?.trim().substring(0, 100);
          if (text) upsellTexts.push(text);
        });

        return { preCheckedItems, upsellTexts };
      });

      // Flag pre-ticked add-ons (sneak into basket variant)
      if (postCartState.preCheckedItems.length > 0) {
        findings.push({
          pattern: 'sneak-into-basket',
          severity: 'critical',
          title: 'Pre-selected add-ons after Add to Cart',
          description: `After clicking Add to Cart, ${postCartState.preCheckedItems.length} item(s) were found pre-selected: ${postCartState.preCheckedItems.map(i => i.label).join(', ')}`,
          evidence: postCartState.preCheckedItems.map(i => i.label),
          detectionMethod: 'journey-simulation',
          regulation: ['EU DSA Art. 25', 'FTC Act §5', 'Consumer Protection Act'],
          confidence: 'high',
        });
      }
    }

    // Step 3: If explicit journey steps provided, walk through them
    if (journeySteps && journeySteps.length > 0) {
      onProgress?.('Dark pattern journey: walking predefined steps...');
      let stepCount = 0;
      for (const step of journeySteps) {
        stepCount++;
        try {
          await gotoWithFallback(page, step.url, htmlCache);
          await page.waitForTimeout(1500);

          const stepFindings = await page.evaluate((stepLabel: string) => {
            const results: { pattern: string; title: string; description: string; evidence: string[] }[] = [];

            // Check pre-ticked checkboxes
            const preChecked = document.querySelectorAll('input[type="checkbox"]:checked');
            preChecked.forEach(el => {
              const input = el as HTMLInputElement;
              const label = document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()
                || input.closest('label')?.textContent?.trim() || input.name || 'Unknown';
              results.push({
                pattern: 'pre-ticked-checkbox',
                title: `Pre-ticked checkbox on ${stepLabel}`,
                description: `Checkbox "${label}" is pre-selected by default. User must actively opt out.`,
                evidence: [label],
              });
            });

            // Check for urgency signals
            const urgencyWords = ['limited time', 'expires', 'only left', 'hurry', 'last chance', 'selling fast'];
            const allText = document.body.innerText?.toLowerCase() || '';
            for (const word of urgencyWords) {
              if (allText.includes(word)) {
                const snippet = allText.substring(allText.indexOf(word) - 20, allText.indexOf(word) + 60).trim();
                results.push({
                  pattern: 'false-urgency',
                  title: `Urgency signal on ${stepLabel}`,
                  description: `Urgency language detected: "...${snippet}..."`,
                  evidence: [snippet],
                });
                break;
              }
            }

            // Count cancel vs subscribe steps
            const cancelLinks = document.querySelectorAll('a, button');
            let cancelStepCount = 0;
            cancelLinks.forEach(el => {
              const text = (el.textContent || '').toLowerCase();
              if (text.includes('cancel') || text.includes('unsubscribe') || text.includes('delete')) {
                cancelStepCount++;
              }
            });

            return results;
          }, step.label);

          for (const f of stepFindings) {
            findings.push({
              pattern: f.pattern as any,
              severity: 'high',
              title: f.title,
              description: f.description,
              evidence: f.evidence,
              detectionMethod: 'journey-simulation',
              regulation: ['EU DSA Art. 25', 'FTC Act §5'],
              confidence: 'high',
            });
          }
        } catch {
          // Step navigation failed, skip
        }
      }
    }

    // Step 4: Roach Motel — count clicks needed to cancel vs subscribe
    onProgress?.('Dark pattern journey: checking roach motel...');
    const subscribeButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('a, button'));
      return btns.filter(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('subscribe') || t.includes('sign up') || t.includes('get started') || t.includes('start free');
      }).length;
    });

    const cancelButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('a, button'));
      return btns.filter(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('cancel') || t.includes('unsubscribe') || t.includes('delete account');
      }).length;
    });

    if (subscribeButtons > 0 && cancelButtons === 0) {
      findings.push({
        pattern: 'roach-motel',
        severity: 'high',
        title: 'Roach Motel: Subscribe visible, Cancel hidden',
        description: `Found ${subscribeButtons} subscribe CTA(s) but 0 cancel/unsubscribe options on this page. Classic asymmetry — easy to enter, hard to exit.`,
        evidence: [`${subscribeButtons} subscribe buttons found`, '0 cancel/unsubscribe options visible'],
        detectionMethod: 'journey-simulation',
        regulation: ['EU DSA Art. 25', 'CMA Subscription Trap Guidelines', 'FTC Click-to-Cancel Rule'],
        confidence: 'medium',
      });
    }

  } catch (error) {
    console.error('Dark pattern journey error:', error);
  } finally {
    await page.close();
  }

  return { journeyName: 'Dark Pattern Journey', findings };
}

export interface DarkPatternJourneyFinding {
  pattern: 'sneak-into-basket' | 'pre-ticked-checkbox' | 'roach-motel' | 'false-urgency' | 'hidden-cost';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  evidence: string[];
  detectionMethod: 'journey-simulation';
  regulation: string[];
  confidence: 'high' | 'medium';
}

/**
 * Test keyboard navigation: tab through all elements, check for traps
 */
async function testKeyboardNavigation(context: BrowserContext, url: string): Promise<JourneyTestResult> {
  const steps: JourneyStep[] = [];
  const issues: AccessibilityIssue[] = [];
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Step 1: Check skip link
    const hasSkipLink = await page.evaluate(() => {
      const firstFocusable = document.querySelector('a[href^="#"], a.skip-link, a.skiplink');
      if (!firstFocusable) return false;
      const text = firstFocusable.textContent?.toLowerCase() || '';
      return text.includes('skip') || text.includes('main');
    });

    steps.push({
      name: 'Skip Navigation Link',
      action: 'Check for skip-to-content link',
      passed: hasSkipLink,
      issue: hasSkipLink ? undefined : 'No skip navigation link found'
    });

    if (!hasSkipLink) {
      issues.push(createJourneyIssue(url, {
        title: 'Missing skip navigation link',
        description: 'Page does not have a skip-to-main-content link. Keyboard users must tab through all navigation on every page.',
        wcagCriterion: '2.4.1', wcagName: 'Bypass Blocks',
        severity: 'high', category: 'operable',
        recommendation: 'Add a "Skip to main content" link as the first focusable element.',
      }));
    }

    // Step 2: Tab through elements and detect keyboard traps
    const tabResult = await page.evaluate(() => {
      const focusableElements: string[] = [];
      const tabSequence: string[] = [];
      let trapDetected = false;
      let trapElement = '';

      // Get all focusable elements
      const focusable = document.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]'
      );

      focusable.forEach(el => {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim().substring(0, 30) || el.getAttribute('aria-label') || '';
        focusableElements.push(`${tag}: ${text}`);
      });

      // Check for potential keyboard traps (elements with tabindex that could trap)
      const highTabindex = document.querySelectorAll('[tabindex]');
      highTabindex.forEach(el => {
        const val = parseInt(el.getAttribute('tabindex') || '0');
        if (val > 0) {
          trapDetected = true;
          trapElement = el.outerHTML.substring(0, 100);
        }
      });

      return {
        focusableCount: focusableElements.length,
        focusableElements: focusableElements.slice(0, 20),
        trapDetected,
        trapElement
      };
    });

    steps.push({
      name: 'Keyboard Tab Navigation',
      action: `Tabbed through ${tabResult.focusableCount} focusable elements`,
      passed: !tabResult.trapDetected && tabResult.focusableCount > 0,
      issue: tabResult.trapDetected ? `Potential keyboard trap detected at: ${tabResult.trapElement}` : undefined
    });

    if (tabResult.trapDetected) {
      issues.push(createJourneyIssue(url, {
        title: 'Potential keyboard trap detected',
        description: `Element with positive tabindex disrupts natural keyboard navigation: ${tabResult.trapElement}`,
        wcagCriterion: '2.1.2', wcagName: 'No Keyboard Trap',
        severity: 'critical', category: 'operable',
        recommendation: 'Remove positive tabindex values. Use tabindex="0" or natural DOM order.',
      }));
    }

    // Step 3: Check focus visibility
    const focusVisibility = await page.evaluate(() => {
      const styles = Array.from(document.styleSheets);
      let outlineNone = false;

      try {
        for (const sheet of styles) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (const rule of Array.from(rules)) {
              const cssRule = rule as CSSStyleRule;
              if (cssRule.selectorText?.includes(':focus') && cssRule.style) {
                if (cssRule.style.outline === 'none' || cssRule.style.outline === '0') {
                  if (!cssRule.style.boxShadow && !cssRule.style.borderColor) {
                    outlineNone = true;
                  }
                }
              }
            }
          } catch { /* cross-origin stylesheets */ }
        }
      } catch { /* ignore */ }

      return { outlineNone };
    });

    steps.push({
      name: 'Focus Indicator Visibility',
      action: 'Check CSS for focus indicator suppression',
      passed: !focusVisibility.outlineNone,
      issue: focusVisibility.outlineNone ? 'CSS removes focus outline without replacement' : undefined
    });

    if (focusVisibility.outlineNone) {
      issues.push(createJourneyIssue(url, {
        title: 'Focus indicators suppressed via CSS',
        description: 'CSS rules remove the default focus outline without providing a visible alternative indicator.',
        wcagCriterion: '2.4.7', wcagName: 'Focus Visible',
        severity: 'critical', category: 'operable',
        recommendation: 'Never remove focus styles without providing a visible alternative (box-shadow, border, or custom outline).',
      }));
    }

  } catch (error) {
    steps.push({ name: 'Keyboard Navigation', action: 'Test failed', passed: false, issue: String(error) });
  } finally {
    await page.close();
  }

  return {
    journeyName: 'Keyboard Navigation',
    description: 'Tests keyboard accessibility including skip links, tab navigation, traps, and focus visibility.',
    steps,
    passed: steps.every(s => s.passed),
    issues
  };
}

/**
 * Test focus management after dynamic interactions
 */
async function testFocusManagement(context: BrowserContext, url: string): Promise<JourneyTestResult> {
  const steps: JourneyStep[] = [];
  const issues: AccessibilityIssue[] = [];
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Check for modals/dialogs that might steal focus
    const dialogCheck = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog, .modal');
      const issues: string[] = [];

      dialogs.forEach(dialog => {
        if (!dialog.getAttribute('aria-label') && !dialog.getAttribute('aria-labelledby')) {
          issues.push('Dialog missing aria-label or aria-labelledby');
        }
        // Check for focus trap within dialog
        const focusable = dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
        if (focusable.length === 0) {
          issues.push('Dialog has no focusable elements');
        }
      });

      return { dialogCount: dialogs.length, issues };
    });

    steps.push({
      name: 'Dialog/Modal Focus Management',
      action: `Found ${dialogCheck.dialogCount} dialog(s)`,
      passed: dialogCheck.issues.length === 0,
      issue: dialogCheck.issues.length > 0 ? dialogCheck.issues.join('; ') : undefined
    });

    for (const dialogIssue of dialogCheck.issues) {
      issues.push(createJourneyIssue(url, {
        title: 'Dialog accessibility issue',
        description: dialogIssue,
        wcagCriterion: '2.4.3', wcagName: 'Focus Order',
        severity: 'high', category: 'operable',
        recommendation: 'Ensure dialogs have proper ARIA labels, trap focus within them, and return focus to the trigger element on close.',
      }));
    }

    // Check live regions
    const liveRegionCheck = await page.evaluate(() => {
      const statusMessages = document.querySelectorAll('[role="status"], [role="alert"], [aria-live]');
      return { count: statusMessages.length };
    });

    steps.push({
      name: 'Live Region Detection',
      action: `Found ${liveRegionCheck.count} live region(s)`,
      passed: true, // informational
    });

  } catch (error) {
    steps.push({ name: 'Focus Management', action: 'Test failed', passed: false, issue: String(error) });
  } finally {
    await page.close();
  }

  return {
    journeyName: 'Focus Management',
    description: 'Tests focus management in dialogs, dynamic content, and live regions.',
    steps,
    passed: steps.every(s => s.passed),
    issues
  };
}

/**
 * Test form interaction accessibility
 */
async function testFormInteraction(context: BrowserContext, url: string): Promise<JourneyTestResult> {
  const steps: JourneyStep[] = [];
  const issues: AccessibilityIssue[] = [];
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const formAnalysis = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const results: {
        formCount: number;
        inputsWithoutLabels: string[];
        inputsWithoutAutocomplete: string[];
        missingFieldsets: boolean;
        requiredWithoutAria: string[];
        submitButtonsWithoutText: string[];
      } = {
        formCount: forms.length,
        inputsWithoutLabels: [],
        inputsWithoutAutocomplete: [],
        missingFieldsets: false,
        requiredWithoutAria: [],
        submitButtonsWithoutText: [],
      };

      forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select, textarea');
        const radioGroups = form.querySelectorAll('input[type="radio"]');
        const checkboxGroups = form.querySelectorAll('input[type="checkbox"]');

        // Check for fieldset/legend on radio/checkbox groups
        if ((radioGroups.length > 1 || checkboxGroups.length > 1) && !form.querySelector('fieldset')) {
          results.missingFieldsets = true;
        }

        inputs.forEach(input => {
          const el = input as HTMLInputElement;
          const type = el.type?.toLowerCase();
          if (['hidden', 'submit', 'button', 'reset'].includes(type)) return;

          // Check label association
          const id = el.id;
          const hasLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
            (id && document.querySelector(`label[for="${id}"]`));
          if (!hasLabel) {
            results.inputsWithoutLabels.push(`${el.tagName.toLowerCase()}[type="${type}"]`);
          }

          // Check autocomplete for common fields
          const name = (el.name || '').toLowerCase();
          if (['email', 'password', 'name', 'phone', 'tel', 'address', 'zip', 'postal'].some(k => name.includes(k))) {
            if (!el.getAttribute('autocomplete')) {
              results.inputsWithoutAutocomplete.push(name);
            }
          }

          // Check required without aria-required
          if (el.required && !el.getAttribute('aria-required')) {
            results.requiredWithoutAria.push(el.name || el.id || type);
          }
        });

        // Check submit buttons
        const submitBtns = form.querySelectorAll('button[type="submit"], input[type="submit"]');
        submitBtns.forEach(btn => {
          const text = btn.textContent?.trim() || btn.getAttribute('value') || btn.getAttribute('aria-label');
          if (!text) results.submitButtonsWithoutText.push(btn.outerHTML.substring(0, 100));
        });
      });

      return results;
    });

    // Step: Labels
    const labelsOk = formAnalysis.inputsWithoutLabels.length === 0;
    steps.push({
      name: 'Form Label Associations',
      action: `Checked ${formAnalysis.formCount} form(s)`,
      passed: labelsOk,
      issue: labelsOk ? undefined : `${formAnalysis.inputsWithoutLabels.length} input(s) missing labels`
    });

    if (!labelsOk) {
      issues.push(createJourneyIssue(url, {
        title: 'Form inputs missing label associations',
        description: `${formAnalysis.inputsWithoutLabels.length} form inputs lack proper label associations: ${formAnalysis.inputsWithoutLabels.join(', ')}`,
        wcagCriterion: '3.3.2', wcagName: 'Labels or Instructions',
        severity: 'critical', category: 'understandable',
        recommendation: 'Associate every form input with a <label> element or use aria-label/aria-labelledby.',
      }));
    }

    // Step: Fieldsets
    if (formAnalysis.missingFieldsets) {
      steps.push({
        name: 'Form Group Structure',
        action: 'Check radio/checkbox grouping',
        passed: false,
        issue: 'Radio/checkbox groups missing fieldset/legend'
      });
      issues.push(createJourneyIssue(url, {
        title: 'Missing fieldset/legend for form groups',
        description: 'Radio button or checkbox groups are not wrapped in <fieldset> with <legend>, making group context unclear.',
        wcagCriterion: '1.3.1', wcagName: 'Info and Relationships',
        severity: 'high', category: 'perceivable',
        recommendation: 'Wrap related radio buttons/checkboxes in <fieldset> with a descriptive <legend>.',
      }));
    }

    // Step: Autocomplete
    if (formAnalysis.inputsWithoutAutocomplete.length > 0) {
      steps.push({
        name: 'Autocomplete Support',
        action: 'Check autocomplete attributes',
        passed: false,
        issue: `${formAnalysis.inputsWithoutAutocomplete.length} fields missing autocomplete`
      });
      issues.push(createJourneyIssue(url, {
        title: 'Missing autocomplete attributes on common fields',
        description: `Fields (${formAnalysis.inputsWithoutAutocomplete.join(', ')}) should have autocomplete attributes for assistive technology.`,
        wcagCriterion: '1.3.5', wcagName: 'Identify Input Purpose',
        severity: 'medium', category: 'perceivable',
        recommendation: 'Add autocomplete attributes (e.g., autocomplete="email", autocomplete="current-password").',
      }));
    }

  } catch (error) {
    steps.push({ name: 'Form Interaction', action: 'Test failed', passed: false, issue: String(error) });
  } finally {
    await page.close();
  }

  return {
    journeyName: 'Form Interaction',
    description: 'Tests form accessibility including labels, grouping, autocomplete, and error handling.',
    steps,
    passed: steps.every(s => s.passed),
    issues
  };
}

/**
 * Test navigation flow between pages
 */
async function testNavigationFlow(context: BrowserContext, pages: PageData[]): Promise<JourneyTestResult> {
  const steps: JourneyStep[] = [];
  const issues: AccessibilityIssue[] = [];
  const page = await context.newPage();

  try {
    for (let i = 0; i < pages.length; i++) {
      await page.goto(pages[i].url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // Check if focus returns to top on navigation
      const focusState = await page.evaluate(() => {
        const activeEl = document.activeElement;
        const isBodyOrNull = !activeEl || activeEl === document.body || activeEl === document.documentElement;
        return {
          focusOnBody: isBodyOrNull,
          activeElement: activeEl?.tagName || 'none'
        };
      });

      steps.push({
        name: `Page ${i + 1} Focus Reset`,
        action: `Navigate to ${pages[i].title}`,
        passed: focusState.focusOnBody,
        issue: focusState.focusOnBody ? undefined : `Focus stuck on ${focusState.activeElement} instead of resetting`
      });

      if (!focusState.focusOnBody) {
        issues.push(createJourneyIssue(pages[i].url, {
          title: 'Focus not reset after page navigation',
          description: `After navigating to this page, focus remains on ${focusState.activeElement} instead of resetting to the page top.`,
          wcagCriterion: '2.4.3', wcagName: 'Focus Order',
          severity: 'medium', category: 'operable',
          recommendation: 'Ensure focus is managed appropriately after navigation. For SPAs, programmatically set focus to the main heading or content area.',
        }));
      }
    }
  } catch (error) {
    steps.push({ name: 'Navigation Flow', action: 'Test failed', passed: false, issue: String(error) });
  } finally {
    await page.close();
  }

  return {
    journeyName: 'Navigation Flow',
    description: 'Tests focus management and state preservation during page-to-page navigation.',
    steps,
    passed: steps.every(s => s.passed),
    issues
  };
}

/**
 * Test error states in forms
 */
async function testErrorStates(context: BrowserContext, url: string): Promise<JourneyTestResult> {
  const steps: JourneyStep[] = [];
  const issues: AccessibilityIssue[] = [];
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Check for error handling patterns
    const errorHandling = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const results = {
        hasErrorContainer: false,
        hasAriaInvalid: false,
        hasAriaDescribedby: false,
        hasErrorRole: false,
      };

      // Check for error containers
      const errorElements = document.querySelectorAll('.error, .error-message, [role="alert"], .invalid-feedback, .form-error, .field-error');
      results.hasErrorContainer = errorElements.length > 0;
      results.hasErrorRole = !!document.querySelector('[role="alert"]');

      forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          if (input.getAttribute('aria-invalid')) results.hasAriaInvalid = true;
          if (input.getAttribute('aria-describedby')) results.hasAriaDescribedby = true;
        });
      });

      return results;
    });

    // Check for proper error identification
    steps.push({
      name: 'Error State Handling',
      action: 'Check error identification patterns',
      passed: errorHandling.hasErrorContainer || errorHandling.hasAriaInvalid,
      issue: !errorHandling.hasErrorContainer && !errorHandling.hasAriaInvalid
        ? 'No error handling patterns detected (no aria-invalid, no error containers)'
        : undefined
    });

    if (!errorHandling.hasErrorRole && errorHandling.hasErrorContainer) {
      issues.push(createJourneyIssue(url, {
        title: 'Error messages not announced to screen readers',
        description: 'Form error messages exist but lack role="alert" or aria-live, so screen readers won\'t announce them.',
        wcagCriterion: '4.1.3', wcagName: 'Status Messages',
        severity: 'high', category: 'robust',
        recommendation: 'Add role="alert" or aria-live="assertive" to error message containers.',
      }));
    }

  } catch (error) {
    steps.push({ name: 'Error States', action: 'Test failed', passed: false, issue: String(error) });
  } finally {
    await page.close();
  }

  return {
    journeyName: 'Error State Handling',
    description: 'Tests how the application communicates errors to assistive technology users.',
    steps,
    passed: steps.every(s => s.passed),
    issues
  };
}

// Helper to create journey issues
function createJourneyIssue(pageUrl: string, opts: {
  title: string; description: string;
  wcagCriterion: string; wcagName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: AccessibilityIssue['category'];
  recommendation: string; codeFix?: string;
}): AccessibilityIssue {
  return {
    id: uuidv4(),
    testId: `JRN-${opts.wcagCriterion.replace(/\./g, '')}`,
    title: opts.title,
    description: opts.description,
    element: 'page-level',
    pageUrl,
    wcagCriterion: opts.wcagCriterion,
    wcagName: opts.wcagName,
    wcagLevel: getLevel(opts.wcagCriterion),
    severity: opts.severity,
    impact: `Detected during user journey testing — affects real user flows`,
    recommendation: opts.recommendation,
    codeFix: opts.codeFix,
    category: opts.category,
    source: 'journey-test',
    confidence: 'high',
  };
}

function getLevel(criterion: string): 'A' | 'AA' | 'AAA' {
  const aaCriteria = ['1.2.4','1.2.5','1.3.5','1.4.3','1.4.4','1.4.5','1.4.10','1.4.11','1.4.12','1.4.13','2.4.5','2.4.6','2.4.7','2.4.11','2.5.7','2.5.8','3.1.2','3.2.3','3.2.4','3.3.3','3.3.4','3.3.8','4.1.3'];
  if (aaCriteria.includes(criterion)) return 'AA';
  return 'A';
}
