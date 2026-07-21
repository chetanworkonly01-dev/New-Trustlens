// ============================================================
// KPMG TrustLens — Dark Pattern Detection Rules (60+ rules)
// Comprehensive coverage: visual, DOM, NLP, behavioural, AI
// Mapped to: EU DSA Art.25, GDPR, FTC, CCPA, DPDPA, WCAG 2.2
// ============================================================

import type { DarkPatternRule } from '../types/darkpattern';

// Note: complianceExemptible marks rules where the pattern may be
// compliance-driven in BFSI/fintech contexts (IRDAI, RBI, SEBI).
// The compliance-exemptions engine applies contextual exemption logic.
export const DARK_PATTERN_RULES: DarkPatternRule[] = [

  // ═══════════════════════════════════════════════════════════
  // INTERFACE INTERFERENCE (DP-IF) — UI visually biases decisions
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-IF-01', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'Cookie Accept Button Disproportionately Larger',
    description: 'The "Accept" button on a cookie/consent banner is significantly larger than the "Reject" or "Manage" option, visually biasing users toward acceptance. EU DSA Art. 25(1)(a) prohibits this asymmetric framing.',
    severity: 'high', regulation: ['EU-DSA', 'EU-GDPR'], detect: 'visual',
  },
  {
    id: 'DP-IF-02', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'Accept Button Uses High-Contrast Color While Reject Is Muted',
    description: 'Accept/agree uses a vibrant color while reject/decline uses a muted, transparent, or hard-to-see color. This colour weaponisation is prohibited under EU DSA Art. 25(1)(a) and ICO cookie guidance.',
    severity: 'high', regulation: ['EU-DSA', 'EU-GDPR'], detect: 'visual',
  },
  {
    id: 'DP-IF-03', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'Reject Option Hidden Below Fold or in Settings',
    description: 'The reject/decline option is not visible without scrolling or requires navigating to a sub-menu, while accept is immediately visible. Critical violation of EU DSA Art. 25(1)(a) and GDPR consent requirements.',
    severity: 'critical', regulation: ['EU-DSA', 'EU-GDPR'], detect: 'visual',
  },
  {
    id: 'DP-IF-04', category: 'interface-interference', principle: 'informed-consent',
    title: 'Dismiss Button Is Unusually Small or Hard to Target',
    description: 'A close/dismiss button is extremely small (<24px), making it difficult to interact with, especially on touch devices. Violates WCAG 2.5.8 and EU DSA Art. 25(1)(a).',
    severity: 'medium', regulation: ['EU-DSA'], detect: 'visual',
  },
  {
    id: 'DP-IF-05', category: 'interface-interference', principle: 'transparency',
    title: 'Fake Disabled UI State',
    description: 'An interactive element appears visually disabled (grayed out, low opacity) but is actually clickable, misleading users about available options.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-CCPA'], detect: 'visual',
  },
  {
    id: 'DP-IF-06', category: 'interface-interference', principle: 'user-autonomy',
    title: 'Visual Urgency Indicator (Pulsing/Flashing CTA)',
    description: 'A call-to-action button or banner uses pulsing animation, flashing colors, or other visual urgency cues to pressure immediate action.',
    severity: 'medium', regulation: ['EU-DSA', 'IN-CCPA'], detect: 'visual',
  },
  {
    id: 'DP-IF-07', category: 'interface-interference', principle: 'informed-consent',
    title: 'Dark CSS Overlay Trap',
    description: 'An invisible or semi-transparent overlay covers content, intercepting clicks intended for underlying elements. Violates EU DSA Art. 25(1)(b) and FTC deceptive practices.',
    severity: 'critical', regulation: ['EU-DSA', 'US-FTC', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-IF-08', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'No Visual Distinction Between Paid and Free Options',
    description: 'Paid tiers are presented with identical visual weight to free tiers, obscuring the cost difference and biasing users toward accidental purchase.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC'], detect: 'visual',
  },
  {
    id: 'DP-IF-09', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'Pre-selected Most Expensive Plan as "Recommended"',
    description: 'In pricing/plan comparisons, the most expensive plan is pre-selected or highlighted as "Best Value" or "Recommended" using a visual badge, border glow, or scale transformation — biasing the user toward the highest cost option.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-CCPA'], detect: 'visual',
  },
  {
    id: 'DP-IF-10', category: 'interface-interference', principle: 'informed-consent',
    title: 'Contrast Weaponisation — Low Contrast Reject in Consent Banner',
    description: 'The Reject/No Thanks button in a consent or cookie banner has a contrast ratio below WCAG minimum (4.5:1), making it effectively invisible to users with low vision while Accept is high-contrast.',
    severity: 'critical', regulation: ['EU-DSA', 'EU-GDPR', 'IN-DPDPA'], detect: 'visual',
  },

  // ═══════════════════════════════════════════════════════════
  // OBSTRUCTION (DP-OB) — Makes unwanted actions hard
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-OB-01', category: 'obstruction', principle: 'symmetry-of-choice',
    title: 'No Visible Unsubscribe or Cancel Option',
    description: 'The page/app has subscribe/sign-up options but no visible path to unsubscribe or cancel. Violates FTC Click-to-Cancel Rule 2024 and EU DSA Art. 25(1)(d).',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA'], detect: 'dom',
  },
  {
    id: 'DP-OB-02', category: 'obstruction', principle: 'symmetry-of-choice',
    title: 'Account Deletion Not Accessible',
    description: 'No visible "delete account" or "close account" link/button found in account settings or profile areas. Violates GDPR Art. 17 right to erasure.',
    severity: 'high', regulation: ['EU-GDPR', 'US-CCPA', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-OB-03', category: 'obstruction', principle: 'user-autonomy',
    title: 'Multi-Step Confirmation to Decline',
    description: 'Declining an offer requires multiple confirmation steps (e.g., "Are you sure?" dialogs) while accepting is one-click. Creates asymmetric friction prohibited by EU DSA Art. 25(1)(d).',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC'], detect: 'journey',
  },
  {
    id: 'DP-OB-04', category: 'obstruction', principle: 'symmetry-of-choice',
    title: 'Cancel Flow Has More Friction Than Subscribe (EFS > 2.0)',
    description: 'The cancellation or opt-out flow requires significantly more steps/clicks than the subscription or opt-in flow, creating asymmetric friction (Roach Motel pattern). Violates FTC Click-to-Cancel Rule 2024 and EU DSA Art. 25.',
    severity: 'critical', regulation: ['EU-DSA', 'US-FTC', 'IN-CCPA', 'IN-DPDPA'], detect: 'flow',
  },
  {
    id: 'DP-OB-05', category: 'obstruction', principle: 'symmetry-of-choice',
    title: 'Unsubscribe Link Buried in Deep Navigation',
    description: 'The unsubscribe or account deletion option requires navigating through 3+ levels of menus or settings. Violates FTC Click-to-Cancel Rule and GDPR Art. 17.',
    severity: 'high', regulation: ['EU-GDPR', 'US-FTC', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-OB-06', category: 'obstruction', principle: 'user-autonomy',
    title: 'Cancellation Requires Phone Call or Email',
    description: 'The only method to cancel a subscription is to call a phone number or send an email, creating friction unavailable online. Violates FTC Click-to-Cancel Rule 2024 which mandates online cancellation if online signup is offered.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-OB-07', category: 'obstruction', principle: 'user-autonomy',
    title: 'Data Export Not Available or Hard to Find',
    description: 'Right to data portability (GDPR Art. 20 / DPDPA) is not easily accessible. No visible "Download my data" or "Export data" option in account settings.',
    severity: 'high', regulation: ['EU-GDPR', 'IN-DPDPA', 'US-CCPA'], detect: 'dom',
    recommendation: 'Add a clearly labelled "Download my data" or "Export data" option in account settings, accessible within 2 clicks. Required under GDPR Art. 20, IN-DPDPA 2023 §16, and US CCPA §1798.100.',
  },

  // ═══════════════════════════════════════════════════════════
  // SNEAKING (DP-SN) — Hidden actions/costs
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-SN-01', category: 'sneaking', principle: 'informed-consent',
    title: 'Preselected Opt-In Checkboxes',
    description: 'Checkboxes for newsletters, marketing emails, or data sharing are pre-checked by default, requiring users to actively opt-out. Violates GDPR Art. 7(2) — consent must be active, not passive.',
    severity: 'critical', regulation: ['EU-GDPR', 'EU-DSA', 'IN-DPDPA'], detect: 'dom',
    complianceExemptible: true, // Insurance riders / card defaults may reflect IRDAI/RBI-mandated base covers
  },
  {
    id: 'DP-SN-02', category: 'sneaking', principle: 'transparency',
    title: 'Hidden Preselected Add-Ons',
    description: 'Additional products, services, or insurance options are preselected in forms or checkout flows without explicit user action. Violates EU Consumer Rights Directive Art. 22.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA', 'IN-CCPA'], detect: 'dom',
    complianceExemptible: true, // Preselected insurance covers or plan variants may follow IRDAI product structure norms
  },
  {
    id: 'DP-SN-03', category: 'sneaking', principle: 'transparency',
    title: 'Price Not Visible Until Late in Flow (Drip Pricing)',
    description: 'The full cost/price is not displayed upfront but only revealed in later checkout steps. Violates EU Consumer Rights Directive Art. 6(1)(e) and FTC Act §5.',
    severity: 'high', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SN-04', category: 'sneaking', principle: 'informed-consent',
    title: 'Hidden Input Fields with Default Values',
    description: 'Hidden form fields (type="hidden") carry default values for consent/marketing purposes that the user cannot see or modify, potentially submitting data without consent.',
    severity: 'medium', regulation: ['EU-GDPR', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-SN-05', category: 'sneaking', principle: 'informed-consent',
    title: 'Tracking Scripts Fire Before Consent',
    description: 'Analytics or advertising scripts execute before the user interacts with the consent banner, collecting data without explicit permission. Clear violation of GDPR Art. 6 and ePrivacy Directive.',
    severity: 'critical', regulation: ['EU-GDPR', 'IN-DPDPA', 'US-CCPA'], detect: 'dom',
  },
  {
    id: 'DP-SN-06', category: 'sneaking', principle: 'transparency',
    title: 'Auto-Added Items in Cart/Checkout',
    description: 'Products, services, insurance, or add-ons are automatically added to the shopping cart without explicit user action. Violates EU Consumer Rights Directive Art. 22.',
    severity: 'critical', regulation: ['US-FTC', 'IN-CCPA', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SN-07', category: 'sneaking', principle: 'transparency',
    title: 'Hidden Fees Disclosed Only at Final Step',
    description: 'Service fees, booking fees, processing charges, or taxes are revealed only at the final payment step — after the user has invested time in the checkout process. Classic drip pricing.',
    severity: 'critical', regulation: ['EU-DSA', 'US-FTC', 'UK-CPR', 'IN-CCPA'], detect: 'dom',
  },
  {
    id: 'DP-SN-08', category: 'sneaking', principle: 'informed-consent',
    title: 'Bundled Consent — Multiple Purposes in One Checkbox',
    description: 'A single checkbox bundles consent for multiple distinct purposes (e.g., marketing + analytics + third-party sharing). GDPR Art. 7(2) requires separate consent per purpose.',
    severity: 'critical', regulation: ['EU-GDPR', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-SN-09', category: 'sneaking', principle: 'transparency',
    title: 'Free Trial Converts to Paid Without Clear Warning',
    description: 'A free trial automatically converts to a paid subscription without a clear pre-expiry warning email or on-page disclosure. Violates FTC Click-to-Cancel Rule and EU Consumer Rights Directive.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },

  // ═══════════════════════════════════════════════════════════
  // FORCED ACTION (DP-FA) — Requires unrelated actions
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-FA-01', category: 'forced-action', principle: 'user-autonomy',
    title: 'Forced Account Creation to View Content',
    description: 'Content is blocked by a login/registration wall that forces users to create an account before accessing publicly available information. Violates EU DSA Art. 25(1)(c) — obstruction pattern.',
    severity: 'high', regulation: ['EU-DSA'], detect: 'dom',
    complianceExemptible: true, // Login/mobile gate for insurance quotes or pre-approved offers may be required for underwriting/KYC (RBI/IRDAI)
  },
  {
    id: 'DP-FA-02', category: 'forced-action', principle: 'informed-consent',
    title: 'Forced Newsletter Signup During Checkout',
    description: 'The checkout or registration flow requires subscribing to newsletters or marketing with no opt-out option. Violates GDPR Art. 7 — consent cannot be a condition of a contract.',
    severity: 'high', regulation: ['EU-GDPR', 'US-FTC', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-FA-03', category: 'forced-action', principle: 'user-autonomy',
    title: 'App Install Prompt Blocking Content',
    description: 'A full-screen or blocking prompt forces users to install a mobile app to access content available on the web.',
    severity: 'medium', regulation: ['EU-DSA'], detect: 'dom',
  },
  {
    id: 'DP-FA-04', category: 'forced-action', principle: 'transparency',
    title: 'Hidden Auto-Renewal / Forced Continuity',
    description: 'A subscription or trial automatically renews without clear disclosure of recurring charges or an easy cancellation path. Violates FTC Click-to-Cancel Rule 2024.',
    severity: 'critical', regulation: ['US-FTC', 'IN-CCPA', 'IN-RBI', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-FA-05', category: 'forced-action', principle: 'user-autonomy',
    title: 'Consent Wall — Deny Consent, Deny Access',
    description: 'The website blocks all access (or significantly degrades experience) if the user declines data processing consent. Violates GDPR Art. 7 — consent cannot be coerced through denial of service.',
    severity: 'critical', regulation: ['EU-GDPR', 'EU-DSA', 'IN-DPDPA'], detect: 'dom',
    complianceExemptible: true, // Mandatory risk/policy disclosures in insurance/investment flows may be required before proceeding (IRDAI/SEBI)
  },
  {
    id: 'DP-FA-06', category: 'forced-action', principle: 'informed-consent',
    title: 'Forced Social Login Without Alternative',
    description: 'Users are forced to log in via Facebook, Google, or Apple with no email/password alternative, requiring third-party data sharing as a condition of use.',
    severity: 'high', regulation: ['EU-GDPR', 'EU-DSA', 'IN-DPDPA'], detect: 'dom',
  },

  // ═══════════════════════════════════════════════════════════
  // NAGGING (DP-NG) — Repeated interruptions
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-NG-01', category: 'nagging', principle: 'user-autonomy',
    title: 'Multiple Overlapping Modals or Popups',
    description: 'The page shows multiple overlapping modal dialogs, popups, or banners simultaneously, creating excessive interruption violating EU DSA Art. 25(1)(c) — obstruction/nagging.',
    severity: 'medium', regulation: ['EU-DSA'], detect: 'dom',
  },
  {
    id: 'DP-NG-02', category: 'nagging', principle: 'user-autonomy',
    title: 'Notification Permission Prompt on First Visit',
    description: 'The site requests browser notification permissions immediately on first visit before any user engagement.',
    severity: 'medium', regulation: ['EU-DSA'], detect: 'dom',
  },
  {
    id: 'DP-NG-03', category: 'nagging', principle: 'user-autonomy',
    title: 'Persistent Cookie Banner Reappears After Rejection',
    description: 'Cookie/consent banner reappears on subsequent visits even after user explicitly rejected or dismissed it, nagging users into accepting.',
    severity: 'critical', regulation: ['EU-GDPR', 'EU-DSA', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-NG-04', category: 'nagging', principle: 'user-autonomy',
    title: 'Exit-Intent Popup with Urgency Messaging',
    description: 'A popup triggered on exit intent uses urgency or guilt language to pressure the user from leaving. Combines nagging and confirmshaming patterns.',
    severity: 'medium', regulation: ['EU-DSA', 'US-FTC'], detect: 'dom',
    recommendation: 'Remove exit-intent interception scripts. If a retention prompt is necessary, use a neutral message with a prominent, easy-to-dismiss close button — no urgency language, guilt framing, or asymmetric button styling.',
  },

  // ═══════════════════════════════════════════════════════════
  // SCARCITY & URGENCY (DP-SU) — Fake time/stock pressure
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-SU-01', category: 'scarcity-urgency', principle: 'user-autonomy',
    title: 'Countdown Timer Creating False Urgency',
    description: 'A countdown timer is displayed suggesting limited time for an offer, which may create artificial urgency. Violates EU DSA Art. 25(1)(d) when not tied to a genuine, verifiable deadline.',
    severity: 'high', regulation: ['US-FTC', 'EU-DSA', 'IN-CCPA'], detect: 'dom',
    complianceExemptible: true, // Insurance premium discounts or cashback offers may be genuine campaign offers (requires backend validation)
  },
  {
    id: 'DP-SU-02', category: 'scarcity-urgency', principle: 'transparency',
    title: 'Fake Scarcity Messaging ("Only X Left!")',
    description: 'Messages suggesting limited availability (e.g., "Only 2 left!", "Selling fast!") that may not reflect actual stock levels. Violates FTC Act §5 deceptive practices.',
    severity: 'high', regulation: ['US-FTC', 'IN-CCPA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SU-03', category: 'scarcity-urgency', principle: 'user-autonomy',
    title: 'Urgency Language in CTA Text',
    description: 'Call-to-action buttons or banners use urgency language like "Act now!", "Limited time!", "Hurry!" to pressure decisions.',
    severity: 'medium', regulation: ['EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SU-04', category: 'scarcity-urgency', principle: 'transparency',
    title: 'Fake Countdown Timer (JavaScript-Resetting)',
    description: 'A countdown timer that resets on page refresh, indicating the urgency is artificial and not tied to a real deadline. Clear FTC Act §5 deceptive practice.',
    severity: 'high', regulation: ['US-FTC', 'IN-CCPA', 'EU-DSA'], detect: 'dom',
  },
  {
    id: 'DP-SU-05', category: 'scarcity-urgency', principle: 'transparency',
    title: 'Flash Sale with Unverifiable End Time',
    description: 'A "flash sale" or time-limited deal is displayed but the end time is not clearly stated or verifiable, or the same deal reappears repeatedly.',
    severity: 'medium', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SU-06', category: 'scarcity-urgency', principle: 'user-autonomy',
    title: 'Fake "X People Viewing" or "X in Cart" Counter',
    description: 'Dynamic counters like "5 people are viewing this!" or "3 items left in cart" are used to create artificial social scarcity. These are provably fake when the counter increments even when no other users are active.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR', 'IN-CCPA'], detect: 'dom',
  },

  // ═══════════════════════════════════════════════════════════
  // SOCIAL PRESSURE (DP-SP) — Emotional manipulation
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-SP-01', category: 'social-pressure', principle: 'user-autonomy',
    title: 'Real-Time Viewer/Buyer Count Displayed',
    description: 'Messages like "X people are viewing this right now" or "X people bought this today" create social pressure to act quickly. Often fabricated.',
    severity: 'medium', regulation: ['EU-DSA', 'IN-CCPA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SP-02', category: 'social-pressure', principle: 'user-autonomy',
    title: 'Activity Notifications Creating FOMO',
    description: 'Popup notifications showing other users\' actions (e.g., "John from London just purchased...") designed to create fear of missing out. Frequently fabricated.',
    severity: 'medium', regulation: ['EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SP-03', category: 'social-pressure', principle: 'transparency',
    title: 'Unverifiable "Best Seller" or "#1 Choice" Badge',
    description: '"Best Seller", "Editor\'s Choice", "#1 Rated" or similar badges displayed without a verifiable source, certification body, or methodology. Violates FTC Endorsement Guides 16 CFR Part 255.',
    severity: 'medium', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-SP-04', category: 'social-pressure', principle: 'transparency',
    title: 'Review Count Displayed Without Verification Source',
    description: 'Star ratings or review counts displayed without attribution to a verified platform (e.g., "4.9 stars — 12,847 reviews" with no source link). May violate FTC Endorsement Guides and EU DSA Art. 31.',
    severity: 'medium', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },

  // ═══════════════════════════════════════════════════════════
  // PRIVACY ZUCKERING (DP-PZ) — Oversharing encouragement
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-PZ-01', category: 'privacy-zuckering', principle: 'informed-consent',
    title: 'Form Collects Excessive Personal Data',
    description: 'A form collects significantly more personal data fields than necessary for its stated purpose (e.g., phone number for a newsletter). Violates GDPR Art. 5(1)(c) data minimisation principle.',
    severity: 'high', regulation: ['EU-GDPR', 'US-CCPA', 'IN-DPDPA'], detect: 'dom',
    complianceExemptible: true, // Mobile/PAN/Aadhaar capture for insurance quotes or loan eligibility may be required for underwriting/KYC
  },
  {
    id: 'DP-PZ-02', category: 'privacy-zuckering', principle: 'transparency',
    title: 'Social Share Buttons More Prominent Than Content',
    description: 'Social sharing buttons are disproportionately prominent, encouraging data sharing over content consumption.',
    severity: 'low', regulation: ['EU-DSA', 'EU-GDPR'], detect: 'visual',
  },
  {
    id: 'DP-PZ-03', category: 'privacy-zuckering', principle: 'informed-consent',
    title: 'Data Sharing Enabled by Default Without Clear Disclosure',
    description: 'Third-party data sharing toggles are pre-enabled (ON) by default in privacy settings, without user action. Violates GDPR Art. 5(1)(b) purpose limitation and Art. 7 consent.',
    severity: 'critical', regulation: ['EU-GDPR', 'US-CCPA', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-PZ-04', category: 'privacy-zuckering', principle: 'transparency',
    title: 'Vague Data Collection Purpose Statements',
    description: 'Privacy policy or consent form uses generic language like "improving your experience" or "legitimate business purposes" without specific purpose disclosure. Violates GDPR Art. 13(1)(c) purpose specification.',
    severity: 'medium', regulation: ['EU-GDPR', 'IN-DPDPA', 'US-CCPA'], detect: 'dom',
  },

  // ═══════════════════════════════════════════════════════════
  // CONFIRMSHAMING (DP-CS) — Guilt-based rejection
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-CS-01', category: 'confirmshaming', principle: 'user-autonomy',
    title: 'Guilt Language on Decline/Reject Option',
    description: 'The reject/decline option uses emotionally manipulative text like "No thanks, I don\'t want to save money" or "I prefer to pay full price". Violates EU DSA Art. 25(1)(b) and FTC Act §5.',
    severity: 'critical', regulation: ['EU-DSA', 'US-FTC', 'UK-CPR'], detect: 'ai',
  },
  {
    id: 'DP-CS-02', category: 'confirmshaming', principle: 'user-autonomy',
    title: 'Negative Framing on Opt-Out Choice',
    description: 'Opt-out text uses negative framing (e.g., "No, I hate discounts") designed to shame users into opting in.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC'], detect: 'ai',
  },
  {
    id: 'DP-CS-03', category: 'confirmshaming', principle: 'user-autonomy',
    title: 'Fear-Based Language on Decline Option',
    description: 'The decline option uses fear-inducing language like "Your account is at risk" or "You will lose access" to pressure users.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-CCPA'], detect: 'ai',
  },
  {
    id: 'DP-CS-04', category: 'confirmshaming', principle: 'user-autonomy',
    title: 'Sad/Disappointed Visual on Decline Button',
    description: 'The decline option uses a sad face emoji, downward arrow, or disappointed imagery to create visual shame without using guilt-language that NLP detectors can catch.',
    severity: 'medium', regulation: ['EU-DSA', 'US-FTC'], detect: 'visual',
  },

  // ═══════════════════════════════════════════════════════════
  // MISDIRECTION (DP-MD) — Visual steering
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-MD-01', category: 'misdirection', principle: 'symmetry-of-choice',
    title: 'Premium Option Visually Highlighted Over Basic',
    description: 'In a pricing/plan comparison, the most expensive option is disproportionately highlighted with badges, colors, or size while the basic/free option is de-emphasized.',
    severity: 'medium', regulation: ['EU-DSA', 'US-FTC'], detect: 'visual',
  },
  {
    id: 'DP-MD-02', category: 'misdirection', principle: 'informed-consent',
    title: 'Misleading Button Labels',
    description: 'Buttons use ambiguous or misleading labels where the action performed does not match reasonable user expectations.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'UK-CPR'], detect: 'ai',
  },
  {
    id: 'DP-MD-03', category: 'misdirection', principle: 'transparency',
    title: 'Close Button Triggers Unexpected Action',
    description: 'Clicking a close/dismiss button on a modal or banner triggers an unexpected action like a redirect or subscription.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA'], detect: 'journey',
  },
  {
    id: 'DP-MD-04', category: 'misdirection', principle: 'informed-consent',
    title: 'Trick Question (Confusing Checkbox Wording)',
    description: 'A checkbox or toggle uses double-negative or confusing wording that makes it unclear whether checking means opting in or out. Violates GDPR Art. 7(2) plain language requirement.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-CCPA'], detect: 'ai',
  },
  {
    id: 'DP-MD-05', category: 'misdirection', principle: 'transparency',
    title: 'Disguised Advertising Without Clear "Ad" Label',
    description: 'Sponsored or paid content is styled identically to organic editorial content with no visible "Sponsored", "Ad", or "Paid" label. Violates FTC Native Advertising Guidelines and EU DSA Art. 26.',
    severity: 'high', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-MD-06', category: 'misdirection', principle: 'transparency',
    title: 'Friend Spam / Contact Harvesting CTA',
    description: 'Interface prompts users to invite contacts or import address books with vague language, potentially accessing contacts without granular consent.',
    severity: 'high', regulation: ['EU-GDPR', 'IN-DPDPA', 'US-CCPA'], detect: 'dom',
  },
  {
    id: 'DP-MD-07', category: 'misdirection', principle: 'transparency',
    title: 'Bait and Switch — Dismiss Link Redirects Externally',
    description: 'A link or button labelled "No thanks", "Close", or "Dismiss" navigates the user to a different page rather than dismissing the element.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC'], detect: 'dom',
  },
  {
    id: 'DP-MD-08', category: 'misdirection', principle: 'symmetry-of-choice',
    title: 'Strikethrough "Original" Price Without Verification',
    description: 'A crossed-out "original" or "RRP" price is displayed next to a sale price without evidence the item was ever sold at that price. Classic reference pricing deception violating FTC Act §5 and UK CPR.',
    severity: 'high', regulation: ['US-FTC', 'UK-CPR', 'EU-DSA'], detect: 'dom',
  },

  // ═══════════════════════════════════════════════════════════
  // ACCESSIBILITY × DARK PATTERN CROSS-MAPPING (DP-AX)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-AX-01', category: 'interface-interference', principle: 'accessibility-clarity',
    title: 'Low-Contrast Opt-Out / Reject Button',
    description: 'The reject or opt-out button has insufficient contrast ratio (< 4.5:1), making it effectively invisible to users with low vision.',
    severity: 'high', regulation: ['EU-DSA', 'EU-GDPR', 'IN-DPDPA'], detect: 'visual',
  },
  {
    id: 'DP-AX-02', category: 'interface-interference', principle: 'accessibility-clarity',
    title: 'Focus Trapped in Consent Modal',
    description: 'Keyboard focus is trapped inside a consent/cookie modal with no way to dismiss using keyboard alone, forcing acceptance. Violates WCAG 2.1.2 No Keyboard Trap.',
    severity: 'critical', regulation: ['EU-DSA', 'EU-GDPR', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-AX-03', category: 'misdirection', principle: 'accessibility-clarity',
    title: 'Screen Reader Text Mismatch',
    description: 'The text announced to screen readers differs from the visible text, potentially misleading assistive technology users about the action they are performing.',
    severity: 'high', regulation: ['EU-DSA', 'IN-DPDPA'], detect: 'dom',
  },
  {
    id: 'DP-AX-04', category: 'interface-interference', principle: 'accessibility-clarity',
    title: 'Reject Button Below Minimum Touch Target Size',
    description: 'The reject/decline button is smaller than WCAG 2.5.8 minimum touch target (24×24px), making it difficult for users with motor impairments.',
    severity: 'medium', regulation: ['EU-DSA', 'IN-DPDPA'], detect: 'visual',
  },

  // ═══════════════════════════════════════════════════════════
  // COOKIE CONSENT MANIPULATION (DP-CC)
  // Covers CMP platform dark patterns: OneTrust, Cookiebot, etc.
  // Mapped to: EDPB Guidelines 3/2022, ICO Cookie Guidance 2023
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-CC-01', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'No "Reject All" on Initial Consent Banner',
    description: 'The cookie consent banner shows no "Reject All" button on the first screen. Users must navigate to "Manage Preferences" to find any rejection mechanism, creating asymmetric friction that violates EDPB Guidelines 3/2022 (Reject should be as easy as Accept) and the CJEU Planet49 ruling (Case C-673/17).',
    severity: 'critical', regulation: ['EU-GDPR', 'EU-DSA', 'UK-PECR'], detect: 'dom',
  },
  {
    id: 'DP-CC-02', category: 'sneaking', principle: 'informed-consent',
    title: 'Non-Essential Cookies Pre-Enabled in Consent Manager',
    description: 'Marketing, analytics, or advertising cookie categories are pre-enabled (toggled ON) by default in the consent preferences panel. GDPR Art. 7 and Recital 32 explicitly prohibit pre-ticked consent — every non-essential cookie category requires an affirmative opt-in action from the user.',
    severity: 'critical', regulation: ['EU-GDPR', 'UK-PECR', 'US-CCPA'], detect: 'dom',
  },
  {
    id: 'DP-CC-03', category: 'obstruction', principle: 'symmetry-of-choice',
    title: 'Reject All Requires More Steps Than Accept All',
    description: 'Accepting cookies requires one click while rejecting requires multiple steps: "Manage Preferences" → toggle each category → "Confirm My Choices". EDPB Guidelines 3/2022 require equivalent ease for consent and refusal — asymmetric friction is prohibited.',
    severity: 'high', regulation: ['EU-GDPR', 'EU-DSA', 'UK-PECR'], detect: 'dom',
  },
  {
    id: 'DP-CC-04', category: 'sneaking', principle: 'transparency',
    title: '"Legitimate Interest" Abuse — Advertising Vendors Pre-Enabled',
    description: 'The consent banner\'s "Legitimate Interest" section contains pre-enabled vendor toggles for advertising or targeting. Companies cannot invoke legitimate interest for marketing/advertising without explicit consent — violates GDPR Art. 6(1)(f), EDPB Opinion 08/2023, and multiple DPA enforcement decisions (CNIL, ICO, DPC).',
    severity: 'critical', regulation: ['EU-GDPR', 'UK-ICO'], detect: 'dom',
  },
  {
    id: 'DP-CC-05', category: 'interface-interference', principle: 'informed-consent',
    title: 'Consent by Scrolling / Browsing — Implied Consent Language',
    description: 'The consent notice implies that scrolling, clicking, or continuing to use the site constitutes cookie consent. GDPR Recital 32 and the CJEU Planet49 judgment explicitly prohibit silence, inactivity, or pre-ticked boxes as valid consent mechanisms.',
    severity: 'critical', regulation: ['EU-GDPR', 'EU-DSA', 'UK-PECR'], detect: 'dom',
  },
  {
    id: 'DP-CC-06', category: 'misdirection', principle: 'symmetry-of-choice',
    title: 'Accept Button Appears Before Reject in DOM Order',
    description: 'In the consent banner\'s DOM structure, the Accept button appears before the Reject button. For screen reader users, this means the biased option is encountered first. ICO and CNIL guidance require neutral or alphabetical ordering of consent options.',
    severity: 'medium', regulation: ['EU-GDPR', 'EU-DSA'], detect: 'dom',
  },

  // ═══════════════════════════════════════════════════════════
  // PRICING MANIPULATION (DP-PM)
  // Annual billing obfuscation, plan anchoring, drip pricing
  // Mapped to: FTC Act §5, EU Consumer Rights Directive, UK CPR
  // ═══════════════════════════════════════════════════════════
  {
    id: 'DP-PM-01', category: 'misdirection', principle: 'transparency',
    title: 'Annual Plan Shown as Monthly Equivalent (Billing Obfuscation)',
    description: 'Pricing is advertised as a monthly rate (e.g., "£4/month") while actual billing is annual (£48 upfront). The true annual charge is displayed in smaller text or hidden in T&Cs. This billing obfuscation violates FTC Act §5 clear pricing requirements and EU Consumer Rights Directive Art. 6.',
    severity: 'high', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR', 'IN-CCPA'], detect: 'dom',
  },
  {
    id: 'DP-PM-02', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'Plan Anchoring — Most Expensive Plan Marked as "Recommended"',
    description: 'In a pricing comparison, the most expensive or most profitable plan is visually highlighted with a "Most Popular", "Best Value", or "Recommended" badge, exploiting the decoy effect and centre-stage bias to steer users away from cheaper options. Violates EU DSA Art. 25(1)(a) interface manipulation provisions.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-CCPA'], detect: 'dom',
  },
  {
    id: 'DP-PM-03', category: 'sneaking', principle: 'transparency',
    title: 'Free Trial Requires Credit Card Without Clear Conversion Notice',
    description: 'A "free trial" requires credit card entry but lacks a prominent, upfront notice of: what price the trial converts to, when it converts, and how to cancel before conversion. Violates FTC Click-to-Cancel Rule (2024), EU Consumer Rights Directive Art. 6(1)(h), and India Consumer Protection Act.',
    severity: 'high', regulation: ['US-FTC', 'EU-DSA', 'IN-CCPA'], detect: 'dom',
  },
  {
    id: 'DP-PM-04', category: 'sneaking', principle: 'transparency',
    title: 'Drip Pricing — Mandatory Fees Added Only at Checkout',
    description: 'The advertised price excludes mandatory fees (service fees, convenience charges, booking fees, environmental levies) that are only revealed at checkout. The final price significantly exceeds the advertised price. Violates FTC Act §5, EU Omnibus Directive, and Australian Consumer Law.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
  {
    id: 'DP-PM-05', category: 'obstruction', principle: 'symmetry-of-choice',
    title: 'Cancellation Requires Phone Call or Email — Online Cancel Absent',
    description: 'Users who subscribed online cannot cancel online. Cancellation requires calling a phone number or sending an email, adding significant friction. Violates the FTC Click-to-Cancel Rule (2024) which mandates that cancellation must be as simple as signup.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA', 'UK-CPR'], detect: 'dom',
  },
];

// ── Visual AI Rules (Phase 8 — GPT-4o Screenshot Analysis) ──
// These rules catch design-level manipulation invisible to DOM scanners.
export const VISUAL_AI_RULES: DarkPatternRule[] = [
  {
    id: 'DP-VIS-AI-01', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'Graphical Consent Asymmetry — Accept vs Reject Visual Weight',
    description: 'The overall visual composition creates a strong imbalance: Accept is visually dominant (larger, bolder, brighter) while Reject is suppressed through design — colour, size, position, whitespace — in ways not detectable from DOM structure alone.',
    severity: 'critical', regulation: ['EU-DSA', 'EU-GDPR', 'IN-DPDPA'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-02', category: 'scarcity-urgency', principle: 'user-autonomy',
    title: 'Image-Based Countdown Timer or Urgency Graphic',
    description: 'A countdown timer, urgency badge, or scarcity indicator is rendered as an image, SVG, or canvas element — invisible to DOM text scanners but visually pressuring users to act immediately.',
    severity: 'high', regulation: ['US-FTC', 'EU-DSA', 'IN-CCPA'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-03', category: 'misdirection', principle: 'symmetry-of-choice',
    title: 'Visual Hierarchy Manipulation — Premium Option Dominance',
    description: 'Page layout uses visual size, glow effects, or highlighted borders to make the most expensive or data-sharing option appear as the default choice, guiding the eye away from basic or free options.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-04', category: 'social-pressure', principle: 'user-autonomy',
    title: 'Emotional Imagery Creating Fear or FOMO',
    description: 'Background images or photography create anxiety, fear of missing out, or social exclusion to pressure subscription or purchase decisions.',
    severity: 'medium', regulation: ['EU-DSA'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-05', category: 'interface-interference', principle: 'informed-consent',
    title: 'Disguised CTA — Advertising Blends with Organic Content',
    description: 'Sponsored content is designed to visually blend with organic content — same card style, typography — with "Sponsored" label reduced to near-invisible size or contrast.',
    severity: 'high', regulation: ['US-FTC', 'EU-DSA', 'IN-CCPA'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-06', category: 'obstruction', principle: 'symmetry-of-choice',
    title: 'Reject Option Placed Outside Natural Visual Scan Path',
    description: 'The reject or opt-out option is positioned in the lower-left or below-fold area — outside the natural F-pattern or Z-pattern scan path — ensuring most users never see it without conscious effort.',
    severity: 'high', regulation: ['EU-DSA', 'EU-GDPR'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-07', category: 'sneaking', principle: 'transparency',
    title: 'Hidden or Camouflaged Price or Additional Charge',
    description: 'A price increase or additional fee is presented in an element that blends into the page background — light grey on white, or a de-emphasised font weight — making the cost easy to miss.',
    severity: 'critical', regulation: ['US-FTC', 'EU-DSA', 'IN-CCPA'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-08', category: 'confirmshaming', principle: 'user-autonomy',
    title: 'Confirmshaming via Visual Design — Decline Option Visually Shamed',
    description: 'The decline option is styled to look broken, greyed out, or paired with a sad/disappointed icon — creating visual shame without using guilt-language that NLP can detect.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-09', category: 'sneaking', principle: 'transparency',
    title: 'Pre-ticked Visual Checkbox That Looks Decorative',
    description: 'A checkbox is pre-ticked (checked state) but styled with a custom design (green checkmark, custom icon) that makes it look like a feature badge or decorative element rather than an actionable consent control.',
    severity: 'critical', regulation: ['EU-GDPR', 'EU-DSA', 'IN-DPDPA'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-10', category: 'scarcity-urgency', principle: 'user-autonomy',
    title: 'Red/Orange Urgency Color on Non-Urgent Content',
    description: 'Red or orange alert-style colors are used on content that is not genuinely urgent (e.g., normal pricing, standard features) to create a false sense of urgency through visual alarm.',
    severity: 'medium', regulation: ['EU-DSA'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-11', category: 'interface-interference', principle: 'symmetry-of-choice',
    title: 'CTA Button Contrast Weaponisation — Accept Vivid, Decline Invisible',
    description: 'Accept/Buy CTA is a high-saturation, full-opacity button while Decline/Cancel is rendered as a small greyed-out link or text-only element with no background — making the accept path visually irresistible.',
    severity: 'critical', regulation: ['EU-DSA', 'EU-GDPR'], detect: 'visual',
  },
  {
    id: 'DP-VIS-AI-12', category: 'misdirection', principle: 'informed-consent',
    title: 'Strikethrough Price Without Verification Badge',
    description: 'A crossed-out "original" price is displayed prominently next to a sale price with no verification that the item was ever sold at that price. Creates false anchoring.',
    severity: 'high', regulation: ['US-FTC', 'UK-CPR', 'EU-DSA'], detect: 'visual',
  },

  // ── India-Specific Rules (added post-PolicyBazaar audit, May 2026) ──
  {
    id: 'DP-MD-09', category: 'misdirection', principle: 'transparency',
    title: 'Asterisked / Qualified Promotional Claim',
    description: 'A headline price or discount claim (e.g. "Upto 91%* Off", "@₹10/day*", "Starting from ₹X*") is qualified by an asterisk whose conditions are buried in fine print or a tooltip. The headline figure is unrepresentative of the actual price most users will pay. Violates India CPA Dark Pattern Guidelines 2023, ASCI Guidelines, and FTC Act §5.',
    severity: 'high', regulation: ['IN-CPA', 'IN-ASCI', 'US-FTC', 'IN-CCPA'], detect: 'textual',
  },
  {
    id: 'DP-FA-07', category: 'forced-action', principle: 'informed-consent',
    title: 'Phone Number / Mobile Gate Before Product Information',
    description: 'A mobile phone number is required before the user can view any price, plan, or product information. The gate collects personal data as a condition of access to publicly available product details. Violates IN-DPDPA 2023 (data minimisation), India CPA Dark Pattern Guidelines 2023 (Forced Action), and FTC Act §5.',
    severity: 'critical', regulation: ['IN-DPDPA', 'IN-CPA', 'US-FTC', 'IN-RBI'], detect: 'dom',
    complianceExemptible: true,  // BFSI context: RBI KYC-linked underwriting may justify
  },
  {
    id: 'DP-SP-05', category: 'social-pressure', principle: 'transparency',
    title: 'Unverifiable Crore-Scale Trust Claim',
    description: 'A claim of the form "X crore Indians trust us" or "trusted by X lakh families" is displayed without a verifiable source, audit date, or methodology. Scale is used to manufacture authority. Violates ASCI Guidelines and IN-CPA Guidelines 2023.',
    severity: 'medium', regulation: ['IN-ASCI', 'IN-CPA', 'US-FTC'], detect: 'textual',
  },
  {
    id: 'DP-CS-05', category: 'confirmshaming', principle: 'user-autonomy',
    title: 'Family / Dependant Protection Guilt Framing',
    description: 'A decline CTA or opt-out uses emotional guilt tied to family safety (e.g. "I don\'t want to protect my family", "I\'ll leave my family unprotected") — common in Indian insurance and fintech dark patterns. Violates IN-CPA Guidelines 2023 and ASCI Guidelines on emotional manipulation.',
    severity: 'high', regulation: ['IN-CPA', 'IN-ASCI', 'EU-DSA'], detect: 'textual',
  },

  // ── Disguised Ads / Native Ad Deception ──
  {
    id: 'DP-DA-01', category: 'misdirection', principle: 'transparency',
    title: 'Disguised Ads — Sponsored Content Without Clear Ad Label',
    description: 'Sponsored, promoted, or paid placement content lacks a visible "Ad" or "Sponsored" label, making it indistinguishable from editorial content. Violates DSA Art. 26(2) which mandates clear identification of commercial communications, and FTC Endorsement Guides.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-ASCI'], detect: 'dom',
    recommendation: 'Add a clearly visible "Ad", "Sponsored", or "Promoted" label to all paid placements. The label must be adjacent to the content, in legible font, and not hidden behind a hover state. Required under EU DSA Art. 26(2), FTC Endorsement Guides, and IN-ASCI Advertising Standards Code.',
  },

  // ── Bait & Switch ──
  {
    id: 'DP-BS-01', category: 'misdirection', principle: 'transparency',
    title: 'Bait & Switch — Dismissal Link Redirects Externally',
    description: 'A link or button labelled with dismissal language ("No thanks", "Skip", "Cancel", "Dismiss") actually navigates the user externally rather than dismissing the element. The visible text implies a safe exit but the action performs a different function. Violates EU DSA Art. 25(1)(a) and FTC Act §5 deceptive practices.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-CPA'], detect: 'dom',
  },

  // ── Friend Spam / Contact Harvesting ──
  {
    id: 'DP-FS-01', category: 'privacy-zuckering', principle: 'informed-consent',
    title: 'Friend Spam — Contact Harvesting Without Granular Consent',
    description: 'A call-to-action invites users to import contacts or send social invites in a way that may access and message contacts without explicit per-contact consent. Violates GDPR Art. 6, IN-DPDPA 2023 data minimisation, and DSA Art. 25(3)(d).',
    severity: 'high', regulation: ['EU-GDPR', 'EU-DSA', 'IN-DPDPA'], detect: 'dom',
  },

  // ── Hidden Costs ──
  {
    id: 'DP-HC-01', category: 'sneaking', principle: 'transparency',
    title: 'Hidden Costs — Price Excludes Mandatory Fees or Tax',
    description: 'A price is prominently displayed but excludes mandatory fees, taxes, or charges that are only disclosed later in the flow. The drip pricing technique violates EU Omnibus Directive Art. 6(1)(e), FTC Act §5, and UK Consumer Rights Act 2015.',
    severity: 'high', regulation: ['EU-DSA', 'US-FTC', 'IN-CPA', 'IN-CCPA'], detect: 'dom',
  },
];

// ══════════════════════════════════════════════════════════════════
// NLP DETECTION PATTERNS — massively expanded for real-world coverage
// ══════════════════════════════════════════════════════════════════

// ── Urgency / Scarcity language ──
export const URGENCY_PATTERNS = [
  // Stock scarcity
  /only\s+\d+\s+(left|remaining|available|in\s+stock)/i,
  /\d+\s+(left|remaining|in\s+stock)\b/i,
  /almost\s+(sold\s+out|gone|out)/i,
  /selling\s+(fast|quickly|out)/i,
  /going\s+fast/i,
  /nearly\s+gone/i,
  /while\s+(supplies|stocks?)\s+last/i,
  /low\s+stock/i,
  /high\s+demand/i,
  /popular\s+item/i,
  /last\s+(few|one|chance|item)/i,
  // Time urgency
  /limited\s+(time|offer|availability|deal|access|period|edition|spots?)/i,
  /(hurry|act\s+now|don'?t\s+miss|last\s+chance)/i,
  /offer\s+(ends?|expires?|closing)\s+(soon|today|tonight|at\s+midnight|in)/i,
  /ends?\s+(in|at|today|tonight|soon|midnight)/i,
  /flash\s+sale/i,
  /today\s+only/i,
  /tonight\s+only/i,
  /this\s+week\s+only/i,
  /before\s+it'?s?\s+(gone|too\s+late)/i,
  /\d+%?\s+off\s+(ends?|today|now|tonight)/i,
  /(time.?sensitive|time.?limited)/i,
  /expires?\s+(in|at|soon|today)/i,
  /deal\s+(ends?|expires?)\s+(in|at|today|soon)/i,
  /sale\s+(ends?|expires?)\s+(in|at|today|soon|midnight)/i,
  /countdown/i,
  /hours?\s+(left|remaining)/i,
  /minutes?\s+(left|remaining)/i,
  /seconds?\s+(left|remaining)/i,
  /don'?t\s+(wait|delay|miss\s+out)/i,
  // Exclusivity / FOMO
  /exclusive\s+(deal|offer|access|discount|price)/i,
  /members?\s+only\s+(deal|offer|price)/i,
  /invite.?only/i,
  /limited\s+access/i,
  /claim\s+(your|this)\s+(offer|deal|discount)/i,
  // ── Indian insurance / fintech urgency (added post-PolicyBazaar audit) ──
  /offer\s+(valid|available)\s+(till|until|only\s+till)\s+\d/i,
  /offer\s+(valid|available)\s+till\s+(today|tomorrow|tonight|midnight|end\s+of\s+(day|month))/i,
  /last\s+\d+\s+(spots?|seats?|slots?)\s+at\s+this\s+price/i,
  /\d+\s+people\s+(bought|purchased|renewed|took)\s+this\s+(plan|policy|cover)\s+(today|this\s+week|this\s+month)/i,
  /price\s+(increases?|goes?\s+up|hiked?)\s+(after|from)\s+(today|tomorrow|midnight|\d)/i,
  /premium\s+(increases?|goes?\s+up|rises?)\s+(with\s+)?(age|time|delay)/i,
  /cover\s+(decreases?|reduces?)\s+if\s+you\s+wait/i,
  /get\s+insured\s+(before|now|today)\s+(you|it'?s?)\s+(turn|too\s+late|harder)/i,
  /\d+\s+(lakh|crore|lac)\s+(people|families|customers|Indians)\s+(are|have)\s+(protected|insured|covered|trusted)/i,
];

// ── Confirmshaming on decline/reject buttons ──
export const CONFIRMSHAMING_PATTERNS = [
  // Classic "No thanks I hate..."
  /no\s*(,|\.|\s)?\s*thanks?\s*(,|\.|\s)?\s*i\s*(don'?t|do\s+not|hate|dislike|prefer\s+not)/i,
  /i\s*(prefer|choose|want)\s*to\s*(pay|miss|lose|stay|remain|keep)/i,
  /i\s*(hate|don'?t\s+(like|want|need|care|bother))/i,
  /no\s*(,|\.|\s)?\s*i'?m?\s*(fine|good|ok|alright)\s*(with|without|paying)/i,
  /i'?ll?\s*(pass|skip|decline)\s*(on)?\s*(saving|the\s+discount|this\s+offer|free)/i,
  /not?\s*(interested|now|for\s+me|thanks)/i,
  // Variations
  /i\s+(don'?t\s+want|don'?t\s+need)\s+(to\s+)?(save|protect|improve|grow|learn)/i,
  /no\s+thanks?,?\s+i'?ll?\s+(pay\s+more|miss\s+out|figure\s+it\s+out|stay\s+as\s+is)/i,
  /decline\s+(this)?\s*(offer|deal|discount|free\s+trial)?/i,
  /i\s+(already\s+have\s+enough|don'?t\s+want\s+to\s+save|prefer\s+to\s+pay\s+full)/i,
  /(skip|ignore)\s+this\s+offer/i,
  /i\s+don'?t\s+want\s+(to|any|the)\s+(discount|deal|savings?|offer|free|trial)/i,
  /continue\s+without\s+(saving|the\s+discount|protection|upgrade)/i,
  /no,?\s+i'?m?\s+not?\s+interested/i,
  /i'?m\s+okay\s+(paying|with|without)/i,
  /maybe\s+later\s*(,|\s)*i'?ll?\s+pay/i,
  // ── Indian insurance confirmshaming — family/protection guilt framing ──
  /i\s+(don'?t|do\s+not)\s+want\s+to\s+(protect|secure|safeguard|cover)\s+(my\s+)?(family|loved\s+ones?|children|parents?)/i,
  /i'?ll?\s+(take\s+the\s+risk|leave\s+my\s+family\s+(unprotected|uncovered|vulnerable))/i,
  /my\s+family\s+(can|will)\s+(manage|be\s+fine)\s+without\s+(cover|insurance|protection)/i,
  /i\s+(don'?t\s+care|am\s+not\s+worried)\s+about\s+(my\s+)?(health|life|future|family)/i,
  /no\s+thanks?,?\s+i'?ll?\s+(risk\s+it|stay\s+uninsured|skip\s+(the\s+)?(cover|protection))/i,
  /i\s+(understand|accept)\s+(the\s+risk|that\s+my\s+family\s+(won'?t|will\s+not)\s+be\s+(covered|protected))/i,
];

// ── Social pressure / fake proof ──
export const SOCIAL_PRESSURE_PATTERNS = [
  /\d+\s+(people|users?|visitors?|shoppers?|customers?|others?)\s+(are\s+)?(viewing|watching|looking\s+at|browsing|in\s+this\s+cart)/i,
  /\d+\s+(people|customers?)\s+(just\s+)?(bought|purchased|ordered|added\s+to\s+cart)/i,
  /(join|trusted\s+by)\s+[\d,]+\+?\s+(users?|customers?|people|businesses|companies)/i,
  /someone\s+(just|recently)\s+(bought|signed\s+up|subscribed|purchased)/i,
  /popular\s+(choice|item|option|product)/i,
  /most\s+(popular|chosen|selected|loved|liked)/i,
  /trending\s+(now|today|this\s+week)/i,
  /best.?seller/i,
  /#1\s+(rated|choice|pick|seller|product)/i,
  /editor'?s?\s+(choice|pick|selection)/i,
  /\d+[\d,]+\s+(five.?star|5.?star)\s+(reviews?|ratings?)/i,
  /rated\s+[\d.]+\s+(out\s+of\s+5|stars?)\s+(by\s+)?\d+/i,
  /sold\s+(out\s+)?\d+\s+times/i,
  /\d+\s+(sold|bought)\s+(this\s+)?(week|month|today)/i,
  /people\s+are\s+buying\s+this\s+(fast|quickly|right\s+now)/i,
  /this\s+(product|item)\s+is\s+(hot|on\s+fire|flying\s+off)/i,
  // ── Indian insurance / fintech social proof ──
  /\d+\s*(?:\+\s*)?(?:lakh|crore|lac)\s+(?:Indians?|customers?|families|people|clients?)\s+(?:trust|insured\s+with|covered\s+by|rely\s+on|secured?|protected?|helped?)/i,
  /\d+\s+people\s+(bought|purchased|took|renewed)\s+this\s+(plan|policy|cover|insurance)\s+(today|this\s+week|this\s+month|in\s+the\s+last)/i,
  /recommended\s+by\s+\d+\s+(financial\s+(advisors?|experts?)|doctors?|experts?)/i,
  /\d+[\d,]+\s+(happy|satisfied|protected|insured)\s+(customers?|families|policy\s+holders?)/i,
  /(india'?s?\s+)?(no\.?\s*1|number\s+(one|1))\s+(insurance|insurer|aggregator|platform|app)/i,
  /\d+\s+plans?\s+(sold|bought|taken)\s+(today|this\s+(hour|week|month))/i,
];

// ── Confirmshaming + Fear-based language ──
export const FEAR_LANGUAGE_PATTERNS = [
  /your\s*(account|data|files?|information|device|computer)\s*(is|are|will\s+be)\s*(at\s+risk|compromised|deleted|lost|hacked|exposed|vulnerable)/i,
  /you\s*(will|may|could|might)\s*(lose|miss|forfeit|be\s+without)\s*(access|data|progress|benefits?|protection|coverage)/i,
  /(warning|alert|urgent|critical)\s*[:\-!]\s*(your|action\s+required|immediate)/i,
  /last\s+warning/i,
  /(security|privacy|virus|malware|threat)\s*(alert|warning|issue|concern|risk|detected)/i,
  /before\s*(it'?s?\s+too\s+late|you\s+lose|your\s+account|expir)/i,
  /(unprotected|vulnerable|exposed|at\s+risk)\s*(device|account|data|network)/i,
  /your\s*(protection|security|subscription)\s*(expires?|is\s+ending|runs?\s+out)/i,
  /losing\s+access\s+to/i,
  /account\s+(will\s+be\s+)?(deleted|closed|suspended|terminated)/i,
  /danger(ous)?\s+(browsing|connection|network|activity)/i,
  /action\s+required\s+(immediately|now|urgently)/i,
];

// ── Trick questions / double-negatives ──
export const TRICK_QUESTION_PATTERNS = [
  /do\s+not\s+un(check|subscribe|select|tick)/i,
  /un(check|tick)\s+to\s+(not|avoid|prevent|opt\s+out\s+of)/i,
  /leave\s+(un)?checked\s+to\s+(not|avoid|stop)/i,
  /opt\s+out\s+of\s+not\s+receiving/i,
  /don'?t\s+not\s+/i,
  /disable\s+to\s+enable/i,
  /check\s+to\s+unsubscribe/i,
  /uncheck\s+to\s+subscribe/i,
  /by\s+(not\s+checking|leaving\s+unchecked)\s+you\s+(agree|consent|accept)/i,
  /by\s+(clicking|pressing|continuing)\s+(you\s+)?(agree|accept|consent\s+to)/i,
  /proceeding\s+(means|indicates)\s+you\s+(agree|accept|consent)/i,
  /your\s+continued\s+use\s+constitutes\s+(acceptance|agreement|consent)/i,
  /no\s+(means|indicates)\s+yes/i,
];

// ── Auto-renewal / forced continuity ──
export const AUTO_RENEWAL_PATTERNS = [
  /auto.?renew(al|s)?/i,
  /automatically\s+(renews?|billed|charged|debited)/i,
  /recurring\s+(charge|billing|payment|subscription)/i,
  /will\s+be\s+(charged|billed|debited)\s+(again|monthly|annually|yearly|weekly)/i,
  /subscription\s+(renews?|continues?|auto.?renews?)/i,
  /billed\s+(monthly|annually|yearly|weekly)\s+unless\s+(cancel(led)?|you\s+cancel)/i,
  /unless\s+(you\s+)?(cancel|opt\s+out)\s+(before|by|within)/i,
  /cancel\s+anytime/i,  // "cancel anytime" without a clear link = forced continuity signal
  /free\s+trial\s+(converts?|becomes?|rolls?\s+into|auto.?renews?\s+to)\s+paid/i,
  /charged\s+after\s+(trial|free\s+period|intro\s+period)/i,
  /no\s+obligation\s+to\s+(cancel|stop|end)/i,
];

// ── Drip pricing / hidden costs ──
export const DRIP_PRICING_PATTERNS = [
  /\+\s*(fee|fees|charge|charges)/i,
  /plus\s+(fee|fees|charge|charges|tax(es)?|vat)/i,
  /(excl?\.?|excluding)\s+tax(es)?/i,
  /before\s+tax(es)?/i,
  /taxes?\s+(not\s+included|calculated\s+at\s+checkout|added\s+at\s+checkout)/i,
  /additional\s+(fee|fees|charge|charges|cost|costs)/i,
  /(processing|service|booking|handling|convenience)\s+(fee|fees|charge)/i,
  /(final|actual)\s+price\s+(may\s+vary|shown\s+at\s+checkout)/i,
  /from\s+\$?[\d.]+(\s+per\s+(month|year|day))?/i,  // "from £9.99" drip pricing signal
  /starting\s+(at|from)\s+\$?[\d.]+/i,
  /\+\s*\$?[\d.]+\s+(booking|service|processing|handling)/i,
];

// ── Fake review / badge signals ──
export const FAKE_REVIEW_PATTERNS = [
  /\d+[\d,]+\s+(verified\s+)?(5.?star|five.?star)\s+(reviews?|ratings?)/i,
  /(awarded|winner|voted|named)\s+(best|top|#1)\s+(product|service|app|tool)/i,
  /as\s+(seen\s+on|featured\s+in)\s+(bbc|cnn|forbes|techcrunch)/i,
  /[\d,]+\+?\s+(happy|satisfied|delighted)\s+(customers?|users?|clients?)/i,
  /money.?back\s+guarantee/i,
  /(certified|accredited|approved)\s+by/i,
  /iso\s+\d{4,5}/i,
  /award.?winning/i,
  /industry.?leading/i,
  /world.?class/i,
];

// ── Annual billing / billing obfuscation ──
// Auditor signal: shows monthly price for annual plan without clear disclosure
export const ANNUAL_BILLING_PATTERNS = [
  /[\$£€₹]\s*[\d.]+\s*\/\s*mo(nth)?\s*(when\s+billed|billed|paid|charged|if\s+paid)\s+(annually|yearly|per\s+year|\/year)/i,
  /[\$£€₹]\s*[\d.]+\s*(per|\/)\s*mo(nth)?\s*\(?billed\s+(annually|yearly)\)?/i,
  /save\s+\d+%?\s+(with|on)\s+(annual|yearly|12.?month)\s+(billing|plan|subscription)/i,
  /billed\s+(as|at)\s+[\$£€₹][\d.,]+\s+(per\s+year|annually|\/year|\/yr|per\s+annum)/i,
  /(annual|yearly)\s+(billing|plan|subscription|commitment)\s+at\s+[\$£€₹][\d.]+/i,
  /[\$£€₹][\d.]+\s+(billed\s+)?(per|\/)\s*(year|annum|yr|annually)/i,
  /one\s+(annual|yearly)\s+(payment|charge|billing)\s+of\s+[\$£€₹][\d.]+/i,
  /pay\s+(yearly|annually)\s+(and\s+)?(save|get|earn)\s+\d+%/i,
  /annual\s+plan.*[\$£€₹][\d.]+.*\/mo/i,
];

// ── Subscription trap patterns ──
// Auditor signal: hard-to-cancel, retention manipulation, pause dominance
export const SUBSCRIPTION_TRAP_PATTERNS = [
  /cancel\s+(by|via|through|using|with)\s+(call(ing)?|phone|email|chat|mail)/i,
  /to\s+cancel.*please\s+(call|contact|email|write\s+to)/i,
  /call\s+us\s+to\s+cancel/i,
  /cancellations?\s+(must\s+be|should\s+be|can\s+only\s+be)\s+(made|processed|requested)\s+(by\s+phone|via\s+phone|over\s+the\s+phone|by\s+calling)/i,
  /pause\s+(your|the|a)\s+(membership|subscription|account)\s+instead/i,
  /(would\s+you\s+like\s+to\s+pause|before\s+you\s+cancel.*pause)/i,
  /are\s+you\s+sure\s+you\s+want\s+to\s+cancel/i,  // multi-step cancel confirmation
  /we'?re?\s+sorry\s+to\s+see\s+you\s+go.*offer/i,  // cancel-prevention offer
  /special\s+(retention|loyalty|save)\s+offer/i,  // retention bribery
  /you'?ll?\s+(lose|miss|forfeit|give\s+up)\s+.{0,50}(if\s+you\s+cancel|upon\s+cancellation)/i,
  /cancel\s+at\s+end\s+of\s+(billing\s+period|current\s+period|cycle)/i,  // not immediate cancel
  /no\s+refund\s+(after|once)\s+(cancel|cancellation)/i,
];

// ── Plan anchoring patterns ──
// Auditor signal: most expensive plan visually or textually pushed as "recommended"
export const PLAN_ANCHORING_PATTERNS = [
  /most\s+popular\s+(plan|option|tier|choice)?/i,
  /best\s+value\s+(plan|option|tier|choice)?/i,
  /recommended\s+(plan|option|tier|for\s+(you|most|teams))?/i,
  /perfect\s+for\s+most\s+(users|customers|teams|businesses)/i,
  /chosen\s+by\s+\d+%?\s+(of\s+)?(our\s+)?(customers|users|teams)/i,
  /upgrading\s+is\s+(worth\s+it|recommended)/i,
  /get\s+(the\s+)?(most|maximum|best)\s+value/i,
  /unlock\s+(full|all|premium|pro|advanced)\s+(features?|access|capabilities)/i,
  /why\s+(go|stay)\s+(basic|free|starter)/i,  // steering away from free tier
];

// ── India: Asterisk/hash-qualified promotional claims ──
// Auditor signal: "Upto X%* off", "Upto X%# off", "@₹10/day*", "Starting from ₹X*"
// Note: PolicyBazaar and many Indian sites use # as footnote marker instead of *
export const ASTERISK_PROMO_PATTERNS = [
  /upto\s+[\d]+\s*%\s*[*#†]?/i,                                          // "upto 15%#", "upto 17%*", "upto 15%"
  /discount\s+upto\s+[\d]+\s*%/i,                                         // "discount upto 15%"
  /get\s+(exclusive\s+)?[\d]+\s*%\s+(off|discount)/i,                     // "get exclusive 15% discount"
  /@\s*₹\s*[\d.,]+\s*(\/\s*(day|month|year))?\s*[*#†]?/i,
  /starting\s+(from|at)\s+(?:just\s+)?₹\s*[\d.,]+/i,                     // "starting at just ₹16/day"
  /only\s+₹\s*[\d.,]+\s*\/\s*(day|mo|year)\s*[*#†]?/i,
  /from\s+₹\s*[\d.,]+\s*[*#†]?/i,
  /as\s+low\s+as\s+₹\s*[\d.,]+\s*[*#†]?/i,
  /plans?\s+(from|starting)\s+₹\s*[\d.,]+\s*[*#†]?/i,
  /[*#†]\s*(t&c|terms?\s+apply|conditions?\s+apply|see\s+terms)/i,        // footnote marker + fine print
  /[*#†]\s*(exclu?d(es?|ing)|subject\s+to|basis\s+of)/i,
  /\d+[*#†]\s*for\s+buying\s+online/i,                                    // "15%# for buying online"
];

// ── India: Crore-scale / lakh-scale trust manufacturing ──
// Auditor signal: "2 crore Indians trust us", "15 lakh Families Secured", "trusted by 1 lakh families"
// Note: PolicyBazaar uses "Secured/Covered/Protected" not "trust/choose" — patterns broadened
export const CRORE_TRUST_PATTERNS = [
  /[\d.]+\s*(?:\+\s*)?(?:crore|lakh|lac)\s*\+?\s+(?:indians?|customers?|families?|people|users?|clients?)\s+(?:trust|choose|rely|use|secured?|covered?|protected?|helped?|insured?|serve[ds]?)/i,
  /[\d.]+\s*(?:\+\s*)?(?:crore|lakh|lac)\s*\+?\s+(?:happy|satisfied|delighted|loyal)\s+(?:customers?|families?|users?)/i,
  /[\d.]+\s*(?:\+\s*)?(?:crore|lakh|lac)\s+(?:claims?|policies?|lives?|insured)\s+(?:settled|issued|served|covered|secured)/i,
  /(trusted|chosen|used|relied\s+on)\s+by\s+[\d.]+\s*(?:\+\s*)?(?:crore|lakh|lac)/i,
  /[\d.]+\s*(?:crore|lakh|lac)\s*[+]?\s+(?:of\s+)?(?:life\s+cover|coverage|sum\s+assured)/i,  // "₹13,50,000 Crore of Life Cover"
  /india'?s?\s+(#1|number\s+one|largest|most\s+trusted)\s+(insurer|bank|app|platform|provider)/i,
  /(ranked|rated|voted)\s+(#1|no\.?\s*1)\s+(by|in)\s+india/i,
  /[\d.]+\s*(million|billion)\s+(indians?|customers?)\s+(trust|rely|secured|covered)/i,
];

// ── India: Family / dependant protection guilt framing ──
// Auditor signal: "I don't want to protect my family" on decline CTA
export const FAMILY_GUILT_PATTERNS = [
  /i\s+(don'?t\s+want|refuse|won'?t|choose\s+not)\s+to\s+(protect|secure|safeguard|insure)\s+(my\s+)?(family|dependants?|loved\s+ones?|children|spouse)/i,
  /i'?ll?\s+(leave|risk\s+leaving|let)\s+(my\s+)?(family|dependants?|loved\s+ones?|spouse)\s+(unprotected|at\s+risk|without\s+cover)/i,
  /no\s+thanks?,?\s+i\s+(don'?t\s+care|am\s+not\s+concerned)\s+about\s+(my\s+)?(family'?s?|children'?s?)\s+(future|protection|security|health)/i,
  /i\s+(don'?t\s+want|refuse)\s+(life|health|term)\s+(insurance|cover|protection)\s+for\s+(my\s+)?(family|dependants?)/i,
  /skip,?\s+my\s+family\s+(doesn'?t\s+need|can\s+manage\s+without)\s+(insurance|coverage|protection)/i,
];

// ── Cookie consent manipulation patterns ──
// Auditor signal: implied consent, scroll-to-accept, ambiguous consent language
export const COOKIE_CONSENT_PATTERNS = [
  /by\s+(continuing|scrolling|browsing|clicking|using)\s+(this\s+)?(site|page|website|app),?\s*(you\s+)?(agree|accept|consent)/i,
  /continuing\s+to\s+(use|browse|access|navigate)\s+(this\s+)?(site|page|website)\s+(means?|implies?|constitutes?)\s+(your\s+)?(agreement|acceptance|consent)/i,
  /your\s+continued\s+use\s+(of\s+this\s+site\s+)?(constitutes|implies|means)\s+(your\s+)?(acceptance|agreement|consent)/i,
  /by\s+(scrolling\s+past|clicking\s+anywhere|pressing\s+any\s+key)\s*(,\s*you)?\s*(are\s+)?(agreeing|accepting|consenting)/i,
  /i\s+accept\s+(all\s+)?cookies/i,  // accept-only CTA without reject visible
  /we\s+use\s+cookies\s+to\s+improve\s+your\s+experience/i,  // vague purpose statement
  /reject\s+(all\s+)?non.?essential\s+cookies/i,  // hidden reject all (signal to check position)
];
