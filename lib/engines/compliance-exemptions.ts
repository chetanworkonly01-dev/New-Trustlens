// ============================================================
// KPMG TrustLens — Compliance Exemptions Engine
// Identifies findings that appear as dark patterns but are
// driven by regulatory requirements (IRDAI, RBI, SEBI, etc.)
// for Indian financial services and BFSI sector websites.
// ============================================================

import type { DarkPatternFinding } from '../types/darkpattern';

// ── Compliance Exemption Categories ──
export type ComplianceExemptionCategory =
  | 'urgency-legitimate-offer'       // Time-limited offers backed by real campaign logic
  | 'mandatory-regulatory-disclosure'// IRDAI/RBI/SEBI mandatory policy disclosures before proceed
  | 'kyc-authentication-gate'        // OTP/Aadhaar/PAN verification mandated by RBI/SEBI/PMLA
  | 'regulated-default-selection'    // Insurance riders/card defaults driven by product structure
  | 'underwriting-data-capture';     // Login/mobile gate required for quotes, underwriting, audit trail

export interface ComplianceExemption {
  category: ComplianceExemptionCategory;
  regulation: string;           // e.g. "IRDAI (Insurance Products Regulations, 2013)"
  rationale: string;            // Why this is compliant, not a dark pattern
  validationNote: string;       // What needs backend validation to confirm exemption
  exemptionLabel: string;       // Short label for UI display
  scoreReductionFactor: number; // 0–1: multiply deduction by this (0 = full exemption, 1 = no change)
}

// ── Exemption Definitions ──
// Maps rule IDs + context signals → exemption metadata
// Each entry describes: when to grant, what regulation applies, what needs validation

const EXEMPTION_RULES: Array<{
  ruleIds: string[];
  signals: RegExp[];           // Must match element HTML / evidence summary
  financeOnly: boolean;        // Only apply for fintech/bfsi site profiles
  exemption: ComplianceExemption;
}> = [
  // ── Edge Case 1: Countdown Timers / Limited-Period Offers ──
  // Insurance premium discounts, cashback offers — may be genuine campaign logic
  {
    ruleIds: ['DP-SU-01', 'DP-SU-02', 'DP-SU-04', 'DP-SU-05'],
    signals: [/premium|discount|cashback|offer|policy|plan|cover|insurance|locker|benefit/i],
    financeOnly: true,
    exemption: {
      category: 'urgency-legitimate-offer',
      regulation: 'IRDAI (Protection of Policyholders\' Interests) Regulations, 2017; RBI Master Directions on Marketing',
      rationale:
        'Countdown timers or limited-period offers for insurance premiums or banking cashback may reflect genuine, time-bound campaign offers verified by backend campaign management systems. Classification as false urgency requires validation against backend campaign logic not visible through UI assessment.',
      validationNote:
        'Validate against backend campaign system: confirm offer expiry is persistent across sessions, not reset on page reload. If the timer resets on refresh, reclassify as dark pattern (DP-SU-04).',
      exemptionLabel: 'Possible Legitimate Campaign Offer',
      scoreReductionFactor: 0.3, // 70% reduction in severity weight
    },
  },

  // ── Edge Case 2: Mandatory Regulatory Disclosures / Acknowledgments ──
  // IRDAI policy disclosures, RBI terms, SEBI investment risk disclosures
  {
    ruleIds: ['DP-FA-05', 'DP-FA-02', 'DP-OB-03'],
    signals: [/disclosure|declaration|acknowledge|risk|irdai|sebi|rbi|policy|terms|invest|mandate|norms|regulation|compliance|statutory/i],
    financeOnly: true,
    exemption: {
      category: 'mandatory-regulatory-disclosure',
      regulation: 'IRDAI (Insurance Products) Regulations, 2016; SEBI LODR Regulations, 2015; RBI Master Circular on KYC; PMLA 2002',
      rationale:
        'Mandatory declarations or acknowledgments before proceeding (e.g., policy disclosures in insurance, risk disclosures in investment products) are required under IRDAI, RBI, or SEBI guidelines. These may appear as forced actions but are compliance-driven consent gates, not dark patterns.',
      validationNote:
        'Confirm that the disclosure is explicitly mandated by the applicable regulation cited on the page. Verify that the acknowledgment text corresponds to a statutory requirement, not a marketing consent bundled with a regulatory disclosure.',
      exemptionLabel: 'Mandatory Regulatory Disclosure',
      scoreReductionFactor: 0.1, // 90% reduction — near-full exemption
    },
  },

  // ── Edge Case 3: KYC / Authentication Steps ──
  // OTP verification, Aadhaar/PAN validation — appear as forced action but compliance-driven
  {
    ruleIds: ['DP-FA-01', 'DP-FA-06', 'DP-FA-05'],
    signals: [/otp|aadhaar|aadhar|pan|kyc|verify|verification|mobile.*number|phone.*number|authenticate|biometric|ckyc|ckycr|digilocker/i],
    financeOnly: true,
    exemption: {
      category: 'kyc-authentication-gate',
      regulation: 'RBI Master Direction on KYC (2016, updated 2023); PMLA Rules 2005; IRDAI Guidelines on e-KYC; SEBI Circular on KYC',
      rationale:
        'KYC or authentication steps such as OTP verification, Aadhaar/PAN validation during account opening, wallet activation, or trading account setup may appear as forced data capture but are mandated under AML/CFT (PMLA), RBI KYC norms, IRDAI e-KYC guidelines, and SEBI regulations. These cannot be bypassed without regulatory non-compliance.',
      validationNote:
        'Confirm that the specific data captured (mobile, PAN, Aadhaar) is required by the cited KYC regulation for the product category being onboarded. Assess whether the data collection is proportionate to the onboarding step.',
      exemptionLabel: 'Compliance-Mandated KYC Step',
      scoreReductionFactor: 0.05, // 95% reduction — essentially fully exempt
    },
  },

  // ── Edge Case 4: Default Selection of Product Options ──
  // Insurance riders, card variants, communication defaults — product structuring or eligibility-driven
  {
    ruleIds: ['DP-SN-01', 'DP-SN-02'],
    signals: [/rider|cover|variant|plan|add-?on|accidental|critical.*illness|term|premium|card.*type|basic.*cover|standard.*plan|eligib/i],
    financeOnly: true,
    exemption: {
      category: 'regulated-default-selection',
      regulation: 'IRDAI (Linked Insurance Products) Regulations, 2013; IRDAI (Non-Linked Insurance Products) Regulations, 2013; RBI Circular on Credit Card Guidelines',
      rationale:
        'Default selection of insurance covers/riders, card variants, or communication preferences may be identified as potential nudging; however, such defaults may be driven by product structuring, eligibility criteria, regulatory minimums, or standard configurations mandated by IRDAI or RBI product guidelines.',
      validationNote:
        'Verify whether the pre-selected product option represents a regulatory minimum cover (e.g., base sum insured under IRDAI norms) or an optional upsell. If optional, the default selection should be reviewed against IRDAI anti-mis-selling guidelines.',
      exemptionLabel: 'Possible Regulated Product Default',
      scoreReductionFactor: 0.35, // 65% reduction — context-dependent
    },
  },

  // ── Edge Case 5: Login / Mobile Number Gate for Product Information ──
  // Insurance quotes, pre-approved loan/card offers — underwriting, personalization, audit trail
  {
    ruleIds: ['DP-FA-01', 'DP-PZ-01'],
    signals: [/quote|premium.*calcul|pre-?approv|personaliz|underwriting|eligibil|offer.*for.*you|your.*offer|custom.*plan|check.*eligib|mobile.*required|log.*in.*to.*view|sign.*in.*to.*see/i],
    financeOnly: true,
    exemption: {
      category: 'underwriting-data-capture',
      regulation: 'IRDAI (Protection of Policyholders\' Interests) Regulations, 2017; RBI Master Direction on Digital Lending, 2022; SEBI KYC Registration Agency Guidelines',
      rationale:
        'The requirement to enter mobile number or log in prior to accessing detailed product information (e.g., insurance quotes, pre-approved loan/card offers) may appear as forced data capture but is often required for underwriting, risk-based pricing, personalization, or regulatory audit trail purposes under IRDAI, RBI digital lending, and SEBI guidelines.',
      validationNote:
        'Confirm that the data capture is required for underwriting or personalization of the specific offer, and that the privacy notice clearly discloses how the captured data will be used. Assess whether a general product brochure/tariff is accessible without login.',
      exemptionLabel: 'Underwriting / Personalization Gate',
      scoreReductionFactor: 0.3, // 70% reduction
    },
  },
];

// ── Financial Site Profile Detection ──
const FINANCE_SITE_PROFILES = new Set([
  'fintech', 'banking', 'insurance', 'investment', 'bfsi', 'nbfc', 'lending',
]);

/**
 * Determines if a site profile is a regulated financial services site
 * where compliance exemptions apply.
 */
export function isFinanceSiteProfile(siteProfile?: string): boolean {
  if (!siteProfile) return false;
  const lc = siteProfile.toLowerCase();
  return Array.from(FINANCE_SITE_PROFILES).some(p => lc.includes(p)) ||
    /bank|insur|invest|mutual.*fund|stock|broker|loan|credit|nbfc|neft|upi|fin(tech|ancial)/i.test(lc);
}

/**
 * Checks a single finding against compliance exemption rules.
 * Returns a ComplianceExemption if the finding qualifies, otherwise undefined.
 */
export function checkComplianceExemption(
  finding: DarkPatternFinding,
  siteProfile?: string,
): ComplianceExemption | undefined {
  const isFinance = isFinanceSiteProfile(siteProfile);

  for (const rule of EXEMPTION_RULES) {
    // Check rule ID match
    if (!rule.ruleIds.includes(finding.ruleId)) continue;

    // Finance-only exemptions need fintech site profile
    if (rule.financeOnly && !isFinance) continue;

    // Check evidence signals — match against element HTML, evidence summary, or description
    const evidenceText = [
      finding.elementHtml || '',
      finding.evidence?.summary || '',
      finding.description || '',
      finding.title || '',
      ...(finding.evidence?.details || []),
    ].join(' ');

    const signalMatched = rule.signals.some(sig => sig.test(evidenceText));
    if (!signalMatched) continue;

    return rule.exemption;
  }

  return undefined;
}

/**
 * Applies compliance exemptions to all findings in-place.
 * Marks qualifying findings with a complianceExemption and
 * adjusts their severity impact for scoring purposes.
 *
 * @param findings - All dark pattern findings
 * @param siteProfile - Site business model profile from site-profiler
 * @returns Object with count of findings exempted
 */
export function applyComplianceExemptions(
  findings: DarkPatternFinding[],
  siteProfile?: string,
): { totalExempted: number; byCategory: Record<ComplianceExemptionCategory, number> } {
  let totalExempted = 0;
  const byCategory = {} as Record<ComplianceExemptionCategory, number>;

  for (const finding of findings) {
    const exemption = checkComplianceExemption(finding, siteProfile);
    if (exemption) {
      (finding as any).complianceExemption = exemption;
      totalExempted++;
      byCategory[exemption.category] = (byCategory[exemption.category] || 0) + 1;
    }
  }

  return { totalExempted, byCategory };
}

// ── Exemption Category Labels for UI ──
export const EXEMPTION_CATEGORY_LABELS: Record<ComplianceExemptionCategory, string> = {
  'urgency-legitimate-offer':        'Legitimate Time-Limited Offer',
  'mandatory-regulatory-disclosure': 'Mandatory Regulatory Disclosure',
  'kyc-authentication-gate':         'Compliance-Mandated KYC / Auth',
  'regulated-default-selection':     'Regulated Product Default',
  'underwriting-data-capture':       'Underwriting / Personalization Gate',
};

export const EXEMPTION_CATEGORY_ICONS: Record<ComplianceExemptionCategory, string> = {
  'urgency-legitimate-offer':        '📅',
  'mandatory-regulatory-disclosure': '📋',
  'kyc-authentication-gate':         '🔐',
  'regulated-default-selection':     '🏦',
  'underwriting-data-capture':       '📝',
};
