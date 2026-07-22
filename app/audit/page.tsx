"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const STANDARDS = [
  {
    value: "WCAG 2.2",
    label: "WCAG 2.2 (Web Content Accessibility Guidelines)",
  },
  { value: "EN 301 549", label: "EN 301 549 (European Standard)" },
  { value: "Section 508", label: "Section 508 (US Federal)" },
  { value: "WCAG 2.1", label: "WCAG 2.1 (Legacy)" },
];

interface JourneyStep {
  id: string;
  label: string;
  url: string;
  action?: string; // natural language instruction, e.g. "search for shoes", "click add to cart"
}

type JourneyDomain =
  | "ecommerce"
  | "banking"
  | "insurance"
  | "healthcare"
  | "lifestyle"
  | "saas"
  | "travel"
  | "media";

interface PredefinedJourneyTemplate {
  id: string;
  domain: JourneyDomain;
  icon: string;
  label: string;
  description: string;
  checksFocus: string;
  primaryPillar: "accessibility" | "darkpatterns" | "performance";
  secondaryPillars: string[];
  ccpaPatterns: string[];
  effortAsymmetry?: {
    entryLabel: string;
    exitLabel: string;
    entrySteps: number;
    exitSteps: number;
  };
  regulationFocus: string[];
  expectedFindings: string[];
  stages: JourneyStep[];
}

const JOURNEY_DOMAINS: {
  id: JourneyDomain;
  icon: string;
  label: string;
  color: string;
}[] = [
  { id: "ecommerce", icon: "🛒", label: "E-Commerce", color: "#0091DA" },
  { id: "banking", icon: "🏦", label: "Banking", color: "#00338D" },
  { id: "insurance", icon: "🛡️", label: "Insurance", color: "#00B2A9" },
  { id: "healthcare", icon: "🏥", label: "Healthcare", color: "#E8002D" },
  { id: "lifestyle", icon: "💪", label: "Lifestyle", color: "#9B59B6" },
  { id: "saas", icon: "💻", label: "SaaS & Tech", color: "#F0AB00" },
  { id: "travel", icon: "✈️", label: "Travel", color: "#06B6D4" },
  { id: "media", icon: "🎬", label: "Media", color: "#EC4899" },
];

// ── Predefined Journey Templates — each has concrete, ordered pages + action instructions ──
const PREDEFINED_JOURNEYS: PredefinedJourneyTemplate[] = [
  {
    id: "login",
    domain: "ecommerce",
    icon: "🔐",
    label: "Login Flow",
    description:
      "Checks the full authentication journey for dark patterns in access control",
    checksFocus: "Forced continuity, confirmshaming, account lockout friction",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Confirmshaming",
      "Forced Continuity",
      // "Privacy Zuckering",
    ],
    regulationFocus: ["EU DSA Art. 25", "WCAG 2.1 AA"],
    expectedFindings: [
      "Pre-ticked newsletter opt-in on login form",
      "Guilt-based messaging if login fails",
      'No visible "forgot password" link',
      "Missing WCAG labels on form fields",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Landing Page",
        url: "/",
        action: "Observe primary CTA and login prompt prominence",
      },
      {
        id: crypto.randomUUID(),
        label: "Login Form",
        url: "/login",
        action:
          "Check for pre-filled checkboxes, newsletter opt-ins, and dark patterns on the login form",
      },
      {
        id: crypto.randomUUID(),
        label: "Post-Auth Dashboard",
        url: "/dashboard",
        action: "Verify no forced upgrades or dark patterns after login",
      },
    ],
  },
  {
    id: "account",
    domain: "ecommerce",
    icon: "👤",
    label: "Account Creation",
    description:
      "Signup flow analysis for consent bundling and trick questions",
    checksFocus: "Trick questions, consent bundling, excessive data collection",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Trick Questions",
      // "Privacy Zuckering",
      "Confirmshaming",
      "Interface Interference",
    ],
    regulationFocus: ["EU DSA Art. 25", "FTC Act §5"],
    expectedFindings: [
      "Pre-ticked marketing consent checkbox",
      "Double-negative opt-out language",
      "Forced data sharing to proceed",
      "Bundled consent for multiple purposes",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Landing / Homepage",
        url: "/",
        action: "Scan for signup CTAs and their visual prominence",
      },
      {
        id: crypto.randomUUID(),
        label: "Sign Up Page",
        url: "/signup",
        action:
          "Check for pre-ticked checkboxes, forced marketing consent, and double-negatives",
      },
      {
        id: crypto.randomUUID(),
        label: "Email Verification",
        url: "/verify-email",
        action:
          "Check for urgency language or confirmation shaming if user skips",
      },
      {
        id: crypto.randomUUID(),
        label: "Onboarding",
        url: "/onboarding",
        action:
          "Check for forced data sharing or profile completion manipulation",
      },
    ],
  },
  {
    id: "checkout",
    domain: "ecommerce",
    icon: "🛒",
    label: "Checkout Flow",
    description:
      "E-commerce purchase funnel for hidden costs and urgency manipulation",
    checksFocus:
      "Hidden costs, fake urgency, sneak-into-basket, pre-ticked add-ons",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["performance"],
    ccpaPatterns: [
      "Hidden Costs",
      "Sneak Into Basket",
      "False Urgency",
      "Scarcity Manipulation",
      "Forced Continuity",
    ],
    effortAsymmetry: {
      entryLabel: "Buy Now",
      exitLabel: "Remove item",
      entrySteps: 2,
      exitSteps: 5,
    },
    regulationFocus: [
      "EU Consumer Rights Directive Art. 22",
      "FTC Act §5",
      "EU DSA Art. 25",
    ],
    expectedFindings: [
      "Auto-added insurance/add-ons in cart",
      "Price revealed only at payment step",
      'Fake "X left in stock" counter',
      "Urgency timer on checkout page",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Product / Listing Page",
        url: "/products",
        action:
          "Look for fake scarcity messaging (Only X left!) and urgency banners",
      },
      {
        id: crypto.randomUUID(),
        label: "Shopping Cart",
        url: "/cart",
        action:
          "Check for auto-added items, hidden fees, and pre-ticked insurance/add-ons",
      },
      {
        id: crypto.randomUUID(),
        label: "Shipping & Details",
        url: "/checkout/shipping",
        action:
          "Verify price transparency — no cost revealed for the first time here",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment Page",
        url: "/checkout/payment",
        action:
          "Check for forced continuity signals and auto-renewal disclosures",
      },
      {
        id: crypto.randomUUID(),
        label: "Confirmation",
        url: "/checkout/confirmation",
        action:
          "Verify confirmation copy is not confirmshaming or manipulative",
      },
    ],
  },
  {
    id: "cancel",
    domain: "ecommerce",
    icon: "",
    label: "Cancellation Flow",
    description:
      "Subscription or account cancellation path — Roach Motel detection",
    checksFocus:
      "Roach Motel, multi-step friction, emotional retention tactics",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Roach Motel",
      "Confirmshaming",
      "Interface Interference",
      "Visual Misdirection",
    ],
    effortAsymmetry: {
      entryLabel: "Subscribe",
      exitLabel: "Cancel",
      entrySteps: 1,
      exitSteps: 6,
    },
    regulationFocus: [
      "FTC Click-to-Cancel Rule",
      "EU DSA Art. 25",
      "CMA Subscription Guidelines",
    ],
    expectedFindings: [
      "Cancel option buried 4+ clicks deep",
      'Emotional retention copy ("We\'ll miss you!")',
      "Pause option visually dominant over cancel",
      "Confirmation-shaming on final cancel screen",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Account Settings",
        url: "/account/settings",
        action:
          "Find the cancel/unsubscribe option — measure how many clicks from landing",
      },
      {
        id: crypto.randomUUID(),
        label: "Cancel Confirmation",
        url: "/account/cancel",
        action:
          "Check for guilt-based retention copy and confirmshaming language",
      },
      {
        id: crypto.randomUUID(),
        label: "Retention / Pause Page",
        url: "/account/pause",
        action:
          'Identify if "pause" option is visually dominant over actual cancel',
      },
    ],
  },
  {
    id: "consent",
    domain: "ecommerce",
    icon: "🍪",
    label: "Consent & Cookie Flow",
    description: "Cookie consent and settings for trustlens compliance",
    checksFocus: "Pre-ticked consent boxes, reject button hiding, consent wall",
    primaryPillar: "",
    secondaryPillars: ["darkpatterns"],
    ccpaPatterns: [
      "Interface Interference",
      // "Privacy Zuckering",
      "Trick Questions",
    ],
    effortAsymmetry: {
      entryLabel: "Accept All",
      exitLabel: "Reject All",
      entrySteps: 1,
      exitSteps: 3,
    },
    regulationFocus: ["EU DSA Art. 25", "ICO Guidance"],
    expectedFindings: [
      "Accept button 3× larger than Reject",
      "Reject buried below the fold",
      "Pre-ticked analytics/marketing cookies",
      "Consent wall blocking page access",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Homepage (First Visit)",
        url: "/",
        action:
          "Assess cookie banner: is Reject as prominent as Accept? Any consent wall?",
      },
      {
        id: crypto.randomUUID(),
        label: "Cookie Preference Centre",
        url: "/cookie-settings",
        action:
          "Check for pre-enabled marketing/analytics cookies and toggle asymmetry",
      },
      {
        id: crypto.randomUUID(),
        label: "Settings",
        url: "settings",
        action: "Verify data sharing opt-outs are findable and symmetrical",
      },
    ],
  },
  {
    id: "subscription",
    domain: "ecommerce",
    icon: "📈",
    label: "Subscription Upgrade",
    description:
      "Plan comparison and upgrade flow for pricing anchoring tactics",
    checksFocus:
      "Price anchoring, free trial traps, forced continuity, bait-and-switch",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["performance"],
    ccpaPatterns: [
      "Hidden Costs",
      "Forced Continuity",
      "Interface Interference",
      "False Urgency",
    ],
    regulationFocus: [
      "FTC Click-to-Cancel Rule",
      "EU Consumer Rights Directive",
      "EU DSA Art. 25",
    ],
    expectedFindings: [
      'Most expensive plan highlighted as "Recommended"',
      "Free trial auto-converts without clear notice",
      "Auto-renewal not disclosed at purchase",
      "Post-purchase upsell banner",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Pricing Page",
        url: "/pricing",
        action:
          "Analyze visual hierarchy — is the most expensive plan falsely highlighted as recommended?",
      },
      {
        id: crypto.randomUUID(),
        label: "Plan Comparison",
        url: "/pricing/compare",
        action:
          "Check for dark feature strikethrough tactics and fake value anchoring",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment / Upgrade",
        url: "/upgrade/payment",
        action:
          "Verify free trial terms are disclosed upfront, check for hidden auto-renewal",
      },
      {
        id: crypto.randomUUID(),
        label: "Confirmation",
        url: "/upgrade/confirmation",
        action: "Check for surprise charges or upsell banners post-purchase",
      },
    ],
  },
  {
    id: "search",
    domain: "ecommerce",
    icon: "🔍",
    label: "Search & Discovery",
    description:
      "Search and product discovery flow for misdirection and fake scarcity",
    checksFocus:
      "Misdirection, fake scarcity, sponsored content masking, filter manipulation",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["performance", "accessibility"],
    ccpaPatterns: [
      "Disguised Ads",
      "Scarcity Manipulation",
      "Visual Misdirection",
      "Social Proof Inflation",
    ],
    regulationFocus: [
      "FTC Native Advertising Guidelines",
      "EU DSA Art. 26",
      "EU DSA Art. 25",
    ],
    expectedFindings: [
      "Sponsored results styled identically to organic",
      "Fake scarcity on search result cards",
      '"Best Seller" badge with no source',
      "Filter reset manipulates results order",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Homepage / Entry",
        url: "/",
        action: "Assess search prominence and any forced journey prompts",
      },
      {
        id: crypto.randomUUID(),
        label: "Search Results",
        url: "/search",
        action:
          'Search for a product (e.g. "shoes"). Check sponsored vs organic visual distinction',
      },
      {
        id: crypto.randomUUID(),
        label: "Filtered Listing",
        url: "/search?category=shoes&sort=relevance",
        action:
          "Apply filters — check if filter state resets or manipulates results",
      },
      {
        id: crypto.randomUUID(),
        label: "Product Detail Page",
        url: "/product/item-1",
        action:
          "Look for fake scarcity, fake review counts, urgency countdown timers",
      },
    ],
  },
  {
    id: "profile",
    domain: "ecommerce",
    icon: "⚙️",
    label: "Profile & Data Settings",
    description: "Settings and data management for detection",
    checksFocus: " hard-to-find opt-outs, data sharing defaults",
    primaryPillar: "",
    secondaryPillars: ["darkpatterns", "accessibility"],
    ccpaPatterns: [
      // "Privacy Zuckering",
      "Interface Interference",
      "Trick Questions",
    ],
    regulationFocus: ["CCPA", "DPDPA 2023"],
    expectedFindings: [
      "Data sharing defaults to ON",
      "Right to erasure buried 5+ clicks deep",
      "Notification opt-outs harder than opt-ins",
      "Data export requires contacting support",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Profile Page",
        url: "/profile",
        action: "Assess data sharing defaults and how visible controls are",
      },
      {
        id: crypto.randomUUID(),
        label: "Data Sharing Settings",
        url: "/profile/data-sharing",
        action: "Check default states — are data sharing toggles pre-enabled?",
      },
      {
        id: crypto.randomUUID(),
        label: "Notification Preferences",
        url: "/profile/notifications",
        action: "Verify notification opt-outs are as prominent as opt-ins",
      },
      {
        id: crypto.randomUUID(),
        label: " Centre",
        url: "/",
        action:
          "Measure friction to find and execute data deletion / export rights",
      },
    ],
  },

  // ══════════════════════════════════════════
  // BANKING & FINANCE
  // ══════════════════════════════════════════
  {
    id: "bank-account-open",
    domain: "banking",
    icon: "🏦",
    label: "Account Opening (KYC)",
    description:
      "Digital bank account opening — KYC friction, mandatory disclosure gates, data capture walls",
    checksFocus:
      "Forced data capture, consent bundling, KYC friction beyond regulatory requirement",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Forced Action",
      // "Privacy Zuckering",
      "Trick Questions",
      "Interface Interference",
    ],
    effortAsymmetry: {
      entryLabel: "Open Account",
      exitLabel: "Abandon Application",
      entrySteps: 1,
      exitSteps: 5,
    },
    regulationFocus: [
      "RBI KYC Master Direction 2016",
      "PMLA 2002",
      "DPDPA 2023",
      "IRDAI guidelines",
    ],
    expectedFindings: [
      "Pre-ticked marketing consent alongside KYC consent",
      "Phone + email + address collected before eligibility check",
      'No "Save and Continue Later" option — forcing session completion',
      "Misleading urgency on account approval timelines",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Landing / Product Page",
        url: "/savings-account",
        action:
          'Scan for urgency messaging ("Limited Period Offer"), pre-selected product features, and misleading APR claims',
      },
      {
        id: crypto.randomUUID(),
        label: "Eligibility / Pre-check",
        url: "/apply/eligibility",
        action:
          "Check if data collected here exceeds eligibility check requirements — phone, PAN before confirming eligibility",
      },
      {
        id: crypto.randomUUID(),
        label: "KYC / Aadhaar Step",
        url: "/apply/kyc",
        action:
          "Verify KYC consent is separate from marketing consent — check for bundled checkboxes",
      },
      {
        id: crypto.randomUUID(),
        label: "Document Upload",
        url: "/apply/documents",
        action:
          "Check for excessive document requests beyond RBI minimum KYC requirements",
      },
      {
        id: crypto.randomUUID(),
        label: "Confirmation & Activation",
        url: "/apply/confirmation",
        action:
          "Verify no auto-subscriptions, pre-selected add-ons (credit card, insurance), or forced upsell on confirmation",
      },
    ],
  },
  {
    id: "bank-fund-transfer",
    domain: "banking",
    icon: "💸",
    label: "Fund Transfer Flow",
    description:
      "NEFT/IMPS/UPI transfer — fee disclosure, speed manipulation, cross-sell dark patterns",
    checksFocus:
      "Hidden charges, fee disclosure timing, forced premium speed selection",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Hidden Costs",
      "Interface Interference",
      "Confirmshaming",
      "Misdirection",
    ],
    regulationFocus: [
      "RBI Payment System Guidelines",
      "PCI DSS",
      "NPCI UPI Guidelines",
    ],
    expectedFindings: [
      "IMPS fee not shown until final confirmation step",
      "Instant transfer pre-selected over free NEFT",
      'Add beneficiary step with pre-ticked "Save for future" sharing consent',
      "Timer pressure on OTP screen",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Transfer Initiation",
        url: "/transfer",
        action:
          "Check if fee for NEFT/IMPS/UPI is clearly shown upfront or hidden until confirmation",
      },
      {
        id: crypto.randomUUID(),
        label: "Beneficiary Selection",
        url: "/transfer/beneficiary",
        action:
          'Scan for pre-ticked "share contact details" or implicit data sharing on beneficiary save',
      },
      {
        id: crypto.randomUUID(),
        label: "Amount & Mode Selection",
        url: "/transfer/amount",
        action:
          "Verify transfer mode defaults to fastest (most expensive) option — check for fake urgency around timing",
      },
      {
        id: crypto.randomUUID(),
        label: "OTP / Confirmation",
        url: "/transfer/confirm",
        action:
          "Check countdown timer on OTP — is it creating false urgency? Verify all fees shown before final confirm",
      },
    ],
  },
  {
    id: "bank-loan-apply",
    domain: "banking",
    icon: "📋",
    label: "Loan Application",
    description:
      "Personal/home/auto loan application — hidden charges, urgency, cross-sell insurance",
    checksFocus:
      "Hidden processing fees, pre-selected loan insurance, urgency manipulation on approval",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Hidden Costs",
      "Forced Continuity",
      "Scarcity Manipulation",
      "Sneak Into Basket",
    ],
    effortAsymmetry: {
      entryLabel: "Apply Now",
      exitLabel: "Decline Offer",
      entrySteps: 2,
      exitSteps: 7,
    },
    regulationFocus: [
      "RBI Fair Practices Code",
      "IRDAI Insurance Bundling Guidelines",
      "FTC §5",
    ],
    expectedFindings: [
      "Loan insurance auto-added without clear opt-out",
      "Processing fee buried in terms, not shown in EMI calculator",
      '"Limited Pre-Approved Offer" urgency without real deadline',
      "Rate shown without processing fee in headline APR",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Loan Products Page",
        url: "/loans/personal",
        action:
          'Check if interest rate prominently shown includes all fees — look for "as low as" bait rates',
      },
      {
        id: crypto.randomUUID(),
        label: "EMI Calculator",
        url: "/loans/emi-calculator",
        action:
          "Verify calculator includes processing fee, insurance premium in total cost — not just EMI",
      },
      {
        id: crypto.randomUUID(),
        label: "Application Form",
        url: "/loans/apply",
        action:
          "Check for pre-selected loan protection insurance, pre-ticked cross-sell products",
      },
      {
        id: crypto.randomUUID(),
        label: "Offer & Disbursement",
        url: "/loans/offer",
        action:
          'Scan for urgency countdown ("Offer expires in 2 hours"), verify all charges disclosed before signing',
      },
    ],
  },
  {
    id: "bank-demat",
    domain: "banking",
    icon: "📈",
    label: "Demat / Trading Account",
    description:
      "Demat and trading account opening — risk disclaimer gates, data capture, brokerage dark patterns",
    checksFocus:
      "Risk disclaimer gates, forced subscription tiers, misleading brokerage fee display",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility", ""],
    ccpaPatterns: [
      "Forced Action",
      "Interface Interference",
      "Hidden Costs",
      // "Privacy Zuckering",
    ],
    regulationFocus: [
      "SEBI KYC Regulations",
      "CDSL/NSDL Guidelines",
      "SEBI LODR",
      "DPDPA 2023",
    ],
    expectedFindings: [
      "Risk acknowledgment bundled with marketing consent",
      "AMC charges not displayed upfront",
      '"Recommended" plan is highest-cost tier',
      "Mandatory nominee details creating friction to abandon",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Account Types / Pricing",
        url: "/demat/plans",
        action:
          "Verify brokerage fees, AMC, and transaction charges are clearly shown — look for plan highlighting manipulation",
      },
      {
        id: crypto.randomUUID(),
        label: "Account Opening Form",
        url: "/demat/open",
        action:
          "Check for bundled consent — are SEBI risk disclosure and marketing opt-in separate checkboxes?",
      },
      {
        id: crypto.randomUUID(),
        label: "KYC / In-Person Verification",
        url: "/demat/kyc",
        action:
          "Scan for data minimization violations — is more data collected than KYC minimums require?",
      },
      {
        id: crypto.randomUUID(),
        label: "Platform Activation",
        url: "/demat/activate",
        action:
          "Check for auto-enrolled premium features with trial periods that auto-convert to paid",
      },
    ],
  },

  // ══════════════════════════════════════════
  // INSURANCE
  // ══════════════════════════════════════════
  {
    id: "ins-quote-compare",
    domain: "insurance",
    icon: "🔍",
    label: "Quote & Compare",
    description:
      "Insurance quote comparison — price anchoring, coverage hiding, apples-to-oranges framing",
    checksFocus:
      "Price anchoring, feature obfuscation, recommended plan manipulation",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Interface Interference",
      "Misdirection",
      "Hidden Costs",
      "False Urgency",
    ],
    regulationFocus: [
      "IRDAI Protection of Policyholders Rules 2017",
      "IRDAI Product Regulations",
      "FTC §5",
    ],
    expectedFindings: [
      "Cheapest plan missing key coverages not flagged clearly",
      '"Most Popular" badge on highest-margin plan',
      "Premium shown per day / per month without total annual cost",
      "Comparison table hides important exclusions",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Product Landing Page",
        url: "/insurance/health",
        action:
          "Scan for urgency (limited offer, price increase warnings), check if premium shown is complete or misleadingly low",
      },
      {
        id: crypto.randomUUID(),
        label: "Quote / Premium Calculator",
        url: "/insurance/quote",
        action:
          "Check if all riders are pre-selected, verify quote includes GST — not shown as add-on",
      },
      {
        id: crypto.randomUUID(),
        label: "Plan Comparison",
        url: "/insurance/compare",
        action:
          "Verify exclusions are equally visible as inclusions — check for plan highlighting/anchoring on expensive option",
      },
    ],
  },
  {
    id: "ins-policy-purchase",
    domain: "insurance",
    icon: "📜",
    label: "Policy Purchase",
    description:
      "Insurance policy purchase — pre-ticked riders, unclear exclusions, consent bundling",
    checksFocus:
      "Pre-ticked riders, unclear exclusions, consent bundling with marketing",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["privacy", "accessibility"],
    ccpaPatterns: [
      "Sneak Into Basket",
      "Trick Questions",
      // "Privacy Zuckering",
      "Interface Interference",
    ],
    effortAsymmetry: {
      entryLabel: "Buy Policy",
      exitLabel: "Remove Add-on Rider",
      entrySteps: 2,
      exitSteps: 6,
    },
    regulationFocus: [
      "IRDAI Guidelines on Insurance Products",
      "IRDAI Electronic Insurance Guidelines 2020",
      "DPDPA 2023",
    ],
    expectedFindings: [
      "Critical illness rider auto-added with prominent placement",
      "Marketing consent bundled with policy consent checkbox",
      "Nominee details required before price shown",
      "Free-look period not prominently disclosed",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Product Details Page",
        url: "/insurance/term/details",
        action:
          "Check if free-look period and claim settlement ratio are prominently disclosed",
      },
      {
        id: crypto.randomUUID(),
        label: "Customisation / Riders",
        url: "/insurance/customise",
        action:
          "Verify riders are opt-IN not opt-OUT — check pre-ticked add-ons and their prominence",
      },
      {
        id: crypto.randomUUID(),
        label: "Proposer Details",
        url: "/insurance/proposer",
        action:
          "Check data collection scope — is more PII collected than underwriting requires?",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment & Summary",
        url: "/insurance/payment",
        action:
          "Verify full premium (base + riders + GST) shown before payment — no hidden revelation at payment step",
      },
    ],
  },
  {
    id: "ins-claim-file",
    domain: "insurance",
    icon: "📩",
    label: "Claims Filing",
    description:
      "Insurance claim filing — friction by design, document overload, status ambiguity",
    checksFocus:
      "Roach Motel for claims, document overload, ambiguous status communication",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Roach Motel",
      "Interface Interference",
      "Obstruction",
      "Misdirection",
    ],
    effortAsymmetry: {
      entryLabel: "Buy Policy",
      exitLabel: "File Claim",
      entrySteps: 3,
      exitSteps: 9,
    },
    regulationFocus: [
      "IRDAI Claim Regulations 2016",
      "Consumer Protection Act 2019",
      "IRDAI Grievance Guidelines",
    ],
    expectedFindings: [
      "Claim form requires 12+ documents not listed upfront",
      '"Call us to file" forced for large claims — no digital path',
      "Claim status page shows no timeline or next step",
      "Rejection reason is vague — no appeals path shown",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Claims Landing Page",
        url: "/claims",
        action:
          "Measure how many clicks to reach the claim form from homepage — check for forced phone channel",
      },
      {
        id: crypto.randomUUID(),
        label: "Claim Initiation Form",
        url: "/claims/new",
        action:
          "Document all required fields and attachments — check if document checklist shown upfront or revealed progressively",
      },
      {
        id: crypto.randomUUID(),
        label: "Document Upload",
        url: "/claims/documents",
        action:
          "Check upload UX — are unsupported formats flagged clearly? Is max file size disclosed?",
      },
      {
        id: crypto.randomUUID(),
        label: "Claim Status / Tracker",
        url: "/claims/status",
        action:
          "Verify claim status page shows ETA, next action required, and grievance escalation path clearly",
      },
    ],
  },
  {
    id: "ins-renewal",
    domain: "insurance",
    icon: "🔄",
    label: "Policy Renewal",
    description:
      "Insurance renewal — auto-debit manipulation, forced continuity, coverage change obfuscation",
    checksFocus:
      "Auto-renewal without explicit consent, forced continuity, premium increase hiding",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Forced Continuity",
      "Interface Interference",
      "Hidden Costs",
      "Misdirection",
    ],
    regulationFocus: [
      "IRDAI Protection of Policyholders Rules 2017",
      "RBI e-Mandate Framework",
      "DPDPA 2023",
    ],
    expectedFindings: [
      "Auto-renewal enabled by default — opt-out buried in settings",
      "Premium increase from last year not highlighted in renewal notice",
      "Coverage changes (exclusions added) not clearly disclosed",
      '"Renew Now" button prominent; "Review Coverage" hard to find',
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Renewal Notification Page",
        url: "/renewal",
        action:
          "Check if premium change from last year is shown prominently — look for visual de-emphasis of increases",
      },
      {
        id: crypto.randomUUID(),
        label: "Coverage Review",
        url: "/renewal/coverage",
        action:
          "Verify any coverage changes, new exclusions, or benefit reductions are clearly disclosed before renewal payment",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment / Mandate Setup",
        url: "/renewal/payment",
        action:
          "Check if auto-debit mandate setup is clearly disclosed — verify opt-out is as prominent as opt-in",
      },
      {
        id: crypto.randomUUID(),
        label: "Renewal Confirmation",
        url: "/renewal/confirmation",
        action:
          "Confirm policy term, coverage, and next renewal date are clearly shown — verify no silent add-ons",
      },
    ],
  },

  // ── PolicyBazaar-specific deep audit journey ──
  {
    id: "ins-policybazaar-full",
    domain: "insurance",
    icon: "🔍",
    label: "PolicyBazaar Full Audit (IRDAI)",
    description:
      "Deep 6-page dark pattern audit of PolicyBazaar covering homepage, term/health landing, comparison, and pages",
    checksFocus:
      "Social proof manipulation, urgency framing, plan anchoring, consent bundling, data export rights",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Sneak Into Basket",
      "Trick Questions",
      // "Privacy Zuckering",
      "False Urgency",
      "Misdirection",
      "Interface Interference",
    ],
    effortAsymmetry: {
      entryLabel: "Get Quote",
      exitLabel: "Cancel / Opt Out",
      entrySteps: 2,
      exitSteps: 8,
    },
    regulationFocus: [
      "IRDAI Protection of Policyholders Rules 2017",
      "IRDAI Product Regulations 2024",
      "IN-ASCI Advertising Code",
      "IN-CPA 2019",
      "DPDPA 2023",
    ],
    expectedFindings: [
      '"X crore customers trust us" unverifiable trust claims',
      '"Limited offer" urgency on permanent products',
      "Most Popular badge on highest-margin plan",
      "Marketing consent bundled with policy consent",
      '"Get Quote" requires phone/email before price shown',
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Homepage",
        url: "https://www.policybazaar.com",
        action:
          "Scan trust claims, urgency banners, social proof counters, and modal count",
      },
      {
        id: crypto.randomUUID(),
        label: "Term Insurance Landing",
        url: "https://www.policybazaar.com/life-insurance/term-insurance/",
        action:
          "Check premium display completeness (base vs GST), urgency copy, and plan anchoring",
      },
      {
        id: crypto.randomUUID(),
        label: "Health Insurance Landing",
        url: "https://www.policybazaar.com/health-insurance/",
        action:
          'Scan real-time buyer counters, "X people viewed today" social pressure, and CTA asymmetry',
      },
      {
        id: crypto.randomUUID(),
        label: "Term Plan Comparison",
        url: "https://www.policybazaar.com/life-insurance/term-insurance/compare-term-insurance/",
        action:
          "Verify exclusions are equally prominent as inclusions — check for recommended/popular plan anchoring",
      },
      {
        id: crypto.randomUUID(),
        label: "Car Insurance",
        url: "https://www.policybazaar.com/motor-insurance/car-insurance/",
        action:
          "Check for add-on pre-selection, zero depreciation auto-tick, and urgency copy near CTA",
      },
      {
        id: crypto.randomUUID(),
        label: "Privacy Policy",
        url: "https://www.policybazaar.com/about-us/privacy-policy/",
        action:
          "Assess data minimisation language, check if data export/deletion rights are clearly stated",
      },
    ],
  },

  // ══════════════════════════════════════════
  // HEALTHCARE
  // ══════════════════════════════════════════
  {
    id: "health-patient-reg",
    domain: "healthcare",
    icon: "🏥",
    label: "Patient Registration",
    description:
      "Digital patient registration — excessive data collection, consent bundling, health data ",
    checksFocus:
      "Excessive PII and health data collection, marketing consent bundled with medical consent",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["", "accessibility"],
    ccpaPatterns: [
      // "Privacy Zuckering",
      "Trick Questions",
      "Forced Action",
      "Interface Interference",
    ],
    regulationFocus: [
      "DPDPA 2023",
      "DISHA Bill",
      "IT Act 2000 (Health Data)",
      "HIPAA (for global context)",
    ],
    expectedFindings: [
      "Medical history required before appointment booking is enabled",
      "Marketing consent bundled with mandatory health data consent",
      "Emergency contact required as mandatory field for routine appointment",
      "Health data shared with third parties via pre-ticked consent",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Registration / Sign-Up",
        url: "/register",
        action:
          "Check data fields for medical history, health conditions on first registration — is this beyond what is needed?",
      },
      {
        id: crypto.randomUUID(),
        label: "Profile Completion",
        url: "/profile/health",
        action:
          "Verify health data consent is separate from marketing/newsletter consent — are they bundled?",
      },
      {
        id: crypto.randomUUID(),
        label: "Insurance Linking",
        url: "/profile/insurance",
        action:
          "Check if insurance linking is mandatory or optional — look for forced integration dark patterns",
      },
    ],
  },
  {
    id: "health-appointment",
    domain: "healthcare",
    icon: "📅",
    label: "Appointment Booking",
    description:
      "Doctor appointment booking — slot scarcity manipulation, upsell to premium, fee reveal timing",
    checksFocus:
      "Fake scarcity on slots, premium doctor upsell, consultation fee reveal timing",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Scarcity Manipulation",
      "Interface Interference",
      "Hidden Costs",
      "Misdirection",
    ],
    regulationFocus: [
      "Consumer Protection Act 2019",
      "NMC Regulations",
      "DPDPA 2023",
    ],
    expectedFindings: [
      "Only 1 slot left! displayed when more exist",
      "Free doctor slots not shown unless scrolled past premium sponsored ones",
      "Consultation fee shown after selecting doctor, not in search results",
      '"Recommended" tag on highest-fee specialists',
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Doctor Search",
        url: "/doctors",
        action:
          "Scan sponsored vs organic doctor listings — check for fake availability indicators and scarcity badges",
      },
      {
        id: crypto.randomUUID(),
        label: "Doctor Profile",
        url: "/doctor/profile",
        action:
          "Verify consultation fee prominently shown — check if premium add-ons (video call, report review) are pre-selected",
      },
      {
        id: crypto.randomUUID(),
        label: "Slot Selection",
        url: "/book/slots",
        action:
          'Check for "Only N slots left" urgency — verify slots shown include all availability, not just limited window',
      },
      {
        id: crypto.randomUUID(),
        label: "Booking Confirmation",
        url: "/book/confirm",
        action:
          "Verify total charge (consultation + platform fee + taxes) shown before payment — no hidden platform fee",
      },
    ],
  },
  {
    id: "health-prescription",
    domain: "healthcare",
    icon: "💊",
    label: "Prescription & Records",
    description:
      "Medical records and prescription access — data wall, forced app install, friction",
    checksFocus:
      "Health record access walls, forced app installation, data portability friction",
    primaryPillar: "",
    secondaryPillars: ["darkpatterns", "accessibility"],
    ccpaPatterns: [
      "Roach Motel",
      "Forced Action",
      // "Privacy Zuckering",
      "Obstruction",
    ],
    effortAsymmetry: {
      entryLabel: "Share Health Data",
      exitLabel: "Download My Records",
      entrySteps: 2,
      exitSteps: 8,
    },
    regulationFocus: [
      "ABHA / ABDM Guidelines",
      "DPDPA 2023",
      "IT Act Sensitive Data Rules",
    ],
    expectedFindings: [
      "Prescription download requires app install — no web option",
      'Health summary shared with "partner hospitals" by default — opt-out buried',
      "ABHA ID linking mandatory for basic prescription access",
      "Medical records deletion option not available",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Records Dashboard",
        url: "/records",
        action:
          "Measure how many clicks to download a prescription — check for forced app install requirement",
      },
      {
        id: crypto.randomUUID(),
        label: "Prescription Download",
        url: "/records/prescriptions",
        action:
          'Verify download works on web without app — check for "sharing" defaults with partner clinics/labs',
      },
      {
        id: crypto.randomUUID(),
        label: "ABHA / Health ID Linking",
        url: "/records/abha",
        action:
          "Check if ABHA linking is genuinely optional or presented as mandatory for basic features",
      },
    ],
  },
  {
    id: "health-payment",
    domain: "healthcare",
    icon: "💳",
    label: "Healthcare Payment",
    description:
      "Hospital or clinic bill payment — hidden fees, insurance claim friction, no-cost EMI dark patterns",
    checksFocus:
      "Hidden facility charges, insurance pre-auth friction, misleading no-cost EMI",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Hidden Costs",
      "Misdirection",
      "Interface Interference",
      "Forced Continuity",
    ],
    regulationFocus: [
      "Consumer Protection Act 2019",
      "IRDA Health Insurance Guidelines",
      "NMC Itemised Billing Guidelines",
    ],
    expectedFindings: [
      "Facility charges (OT, nursing) not itemised in bill",
      "Insurance cashless pre-auth path requires calling — no digital option",
      'EMI option shown as "no cost" but processing fee charged',
      "Bill payment confirmation shows different amount than quote",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Bill View / Summary",
        url: "/billing",
        action:
          "Check if bill is itemised — are facility charges, doctor fees, medicines broken out separately?",
      },
      {
        id: crypto.randomUUID(),
        label: "Insurance / Cashless Claim",
        url: "/billing/insurance",
        action:
          "Verify cashless claim initiation is available digitally — measure friction vs self-pay option",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment Options",
        url: "/billing/pay",
        action:
          'Check EMI terms — is "no cost EMI" actually no cost? Are all payment method fees shown upfront?',
      },
    ],
  },

  // ══════════════════════════════════════════
  // LIFESTYLE & WELLNESS
  // ══════════════════════════════════════════
  {
    id: "life-membership",
    domain: "lifestyle",
    icon: "💪",
    label: "Membership Sign-up",
    description:
      "Gym / fitness app membership — trial traps, auto-renewal, forced continuity",
    checksFocus:
      "Free trial auto-convert, card required for trial, auto-renewal without clear notice",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Forced Continuity",
      "Hidden Costs",
      "False Urgency",
      "Interface Interference",
    ],
    effortAsymmetry: {
      entryLabel: "Start Free Trial",
      exitLabel: "Cancel Before Charge",
      entrySteps: 2,
      exitSteps: 7,
    },
    regulationFocus: [
      "FTC Click-to-Cancel Rule 2024",
      "EU Consumer Rights Directive",
      "CMA Subscription Guidelines",
    ],
    expectedFindings: [
      "Credit card required for free trial — charged on day 1 without reminder",
      "Auto-renewal clause buried in step 5 of 6 in registration flow",
      '"Best Value" annual plan highlighted — monthly shown as more expensive per comparison',
      "No trial end reminder email/notification mentioned during sign-up",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Pricing / Plans Page",
        url: "/pricing",
        action:
          "Check if free trial terms (card required, auto-charge date) are shown upfront — look for plan anchoring",
      },
      {
        id: crypto.randomUUID(),
        label: "Sign-Up Flow",
        url: "/signup",
        action:
          "Scan for consent to auto-renewal — is it a separate explicit checkbox or buried in terms?",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment Details",
        url: "/signup/payment",
        action:
          "Verify trial end date and first charge date shown at payment step — check for pre-selected annual plan",
      },
      {
        id: crypto.randomUUID(),
        label: "Confirmation",
        url: "/signup/confirmation",
        action:
          "Verify trial terms, cancellation deadline, and auto-renewal amount shown in confirmation",
      },
    ],
  },
  {
    id: "life-subscription",
    domain: "lifestyle",
    icon: "📱",
    label: "Content Subscription",
    description:
      "Streaming / content platform subscription — plan confusion, annual lock-in, upgrades",
    checksFocus:
      "Plan anchoring, annual lock-in pressure, HD/4K upsell during signup",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Interface Interference",
      "Hidden Costs",
      "Scarcity Manipulation",
      "Misdirection",
    ],
    regulationFocus: [
      "EU Consumer Rights Directive",
      "FTC Negative Option Rule",
      "CMA Online Platforms Review",
    ],
    expectedFindings: [
      'Annual plan default-selected saving "X per month" — actual savings math unclear',
      "HD/4K option pre-selected adding premium to base price",
      '"Save 40%" on annual plan headline — monthly option hidden',
      "Simultaneous screens benefit framed as urgency to upgrade",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Plans & Pricing",
        url: "/plans",
        action:
          "Analyze visual hierarchy — which plan is most prominent? Verify monthly option is equally accessible to annual",
      },
      {
        id: crypto.randomUUID(),
        label: "Plan Selection",
        url: "/subscribe",
        action:
          "Check for pre-selected add-ons (HD, extra screens) — verify price shown is the base, not inflated by pre-selections",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment",
        url: "/subscribe/payment",
        action:
          "Verify total charge is confirmed before payment — check for device/profile add-ons sneaked in",
      },
    ],
  },
  {
    id: "life-cancel",
    domain: "lifestyle",
    icon: "🚫",
    label: "Membership Cancellation",
    description:
      "Gym / app membership cancellation — Roach Motel, pause upsell, confirmshaming",
    checksFocus:
      "Roach Motel pattern, pause option dominance over cancel, emotional retention copy",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Roach Motel",
      "Confirmshaming",
      "Interface Interference",
      "Obstruction",
    ],
    effortAsymmetry: {
      entryLabel: "Sign Up",
      exitLabel: "Cancel Membership",
      entrySteps: 1,
      exitSteps: 8,
    },
    regulationFocus: [
      "FTC Click-to-Cancel Rule 2024",
      "EU DSA Art. 25",
      "CMA Subscription Guidelines",
    ],
    expectedFindings: [
      "Cancel option requires calling or in-person visit — no digital path",
      '"Pause membership" visually dominates over "Cancel" button',
      'Confirmation-shaming: "No thanks, I hate staying fit"',
      "Multiple retention screens before cancel is confirmed",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Account / Membership Settings",
        url: "/account/membership",
        action:
          "Find the cancellation option — measure number of clicks from homepage, check for obfuscation",
      },
      {
        id: crypto.randomUUID(),
        label: "Cancel / Manage Page",
        url: "/account/cancel",
        action:
          "Check visual prominence of Pause vs Cancel — look for confirmshaming copy on decline button",
      },
      {
        id: crypto.randomUUID(),
        label: "Retention / Offers Screen",
        url: "/account/retention",
        action:
          "Scan for false discounts, emotional manipulation, and countdown timers on retention offer",
      },
      {
        id: crypto.randomUUID(),
        label: "Cancellation Confirmation",
        url: "/account/cancelled",
        action:
          "Verify cancellation confirmation is clear — check if account access continues to end of billing cycle",
      },
    ],
  },
  {
    id: "life-data-settings",
    domain: "lifestyle",
    icon: "⚙️",
    label: "App  Settings",
    description: "Wellness / lifestyle app  settings, hard-to-find opt-outs",
    checksFocus: " health data sharing defaults, notification opt-out friction",
    primaryPillar: "",
    secondaryPillars: ["darkpatterns", "accessibility"],
    ccpaPatterns: [
      // "Privacy Zuckering",
      "Trick Questions",
      "Obstruction",
      "Interface Interference",
    ],
    regulationFocus: ["DPDPA 2023", "App Store Guidelines"],
    expectedFindings: [
      "Workout and health data shared with ad partners by default",
      "Notification opt-outs require 6+ taps vs 1-tap opt-in",
      'Location access cannot be limited to "while using app" on certain flows',
      'Data deletion option not present — only "deactivate account"',
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "App / Account Settings",
        url: "/settings",
        action:
          "Navigate directly to data settings — measure how many taps/clicks required from homepage",
      },
      {
        id: crypto.randomUUID(),
        label: "Data Sharing Preferences",
        url: "/settings",
        action:
          "Check all data sharing toggles — are they ON by default? Is health data sharing separate from analytics?",
      },
      {
        id: crypto.randomUUID(),
        label: "Notification Settings",
        url: "/settings/notifications",
        action:
          'Verify notification opt-outs are as easy as opt-ins — check for missing "turn all off" option',
      },
      {
        id: crypto.randomUUID(),
        label: "Account / Data Deletion",
        url: "/settings/account",
        action:
          "Find data deletion or erasure request — measure friction; verify it deletes data not just deactivates",
      },
    ],
  },

  // ══════════════════════════════════════════
  // SAAS & TECHNOLOGY
  // ══════════════════════════════════════════
  {
    id: "saas-free-trial",
    domain: "saas",
    icon: "🆓",
    label: "Free Trial Sign-up",
    description:
      "SaaS product free trial — credit card requirement, auto-convert, feature gating",
    checksFocus:
      "Card required for trial, auto-convert without reminder, trial feature gating",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Forced Continuity",
      "Forced Action",
      "Hidden Costs",
      "Misdirection",
    ],
    effortAsymmetry: {
      entryLabel: "Start Free Trial",
      exitLabel: "Cancel Before Charge",
      entrySteps: 3,
      exitSteps: 6,
    },
    regulationFocus: [
      "FTC Negative Option Rule",
      "EU Consumer Rights Directive",
      "FTC §5",
    ],
    expectedFindings: [
      "Card required for 14-day free trial with no mention of charge date",
      '"Most Popular" tag on middle plan anchoring users away from cheap option',
      "Trial features limited to create upgrade pressure before trial ends",
      "Auto-email sequence designed to prevent cancellation vs inform",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Pricing / Plans",
        url: "/pricing",
        action:
          'Check if trial terms are clear — is credit card required? When does first charge occur? Verify "Most Popular" plan selection',
      },
      {
        id: crypto.randomUUID(),
        label: "Trial Registration",
        url: "/trial/signup",
        action:
          "Scan for consent to auto-renewal in trial sign-up — is it explicit checkbox or hidden in ToS",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment Details",
        url: "/trial/payment",
        action:
          "Verify charge date, cancellation method, and post-trial plan and price all shown at payment step",
      },
      {
        id: crypto.randomUUID(),
        label: "Onboarding",
        url: "/onboarding",
        action:
          "Check for artificial feature limitations designed to create upgrade urgency during trial",
      },
    ],
  },
  {
    id: "saas-upgrade",
    domain: "saas",
    icon: "⬆️",
    label: "Plan Upgrade Flow",
    description:
      "SaaS plan upgrade — price anchoring, feature gate manipulation, annual plan pressure",
    checksFocus:
      "Price anchoring on annual vs monthly, feature gates creating forced upgrades",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Interface Interference",
      "Misdirection",
      "False Urgency",
      "Scarcity Manipulation",
    ],
    regulationFocus: [
      "EU Consumer Rights Directive",
      "FTC §5",
      "ACM Netherlands SaaS Guidelines",
    ],
    expectedFindings: [
      "Feature usage limit notification designed to create urgency vs inform",
      "Upgrade dialog shows annual cost without monthly breakdown",
      "Downgrade path requires contacting sales — upgrade is 1-click",
      '"Save 40% with annual" shown without making 40% calculation transparent',
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Current Plan / Billing Page",
        url: "/settings/billing",
        action:
          "Check for urgency messages around usage limits — is limit proximity shown as informative or manipulative?",
      },
      {
        id: crypto.randomUUID(),
        label: "Plan Comparison",
        url: "/upgrade",
        action:
          "Verify annual vs monthly comparison is honest — check for pre-selected annual plan",
      },
      {
        id: crypto.randomUUID(),
        label: "Upgrade Checkout",
        url: "/upgrade/payment",
        action:
          "Check prorated charge calculation is shown — verify no hidden activation or setup fees",
      },
    ],
  },
  {
    id: "saas-cancel",
    domain: "saas",
    icon: "",
    label: "SaaS Cancellation",
    description:
      "SaaS subscription cancellation — multi-step friction, data hold, downgrade alternative forcing",
    checksFocus:
      "Roach Motel cancellation, forced survey before cancel, data export gating",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Roach Motel",
      "Obstruction",
      "Confirmshaming",
      "Interface Interference",
    ],
    effortAsymmetry: {
      entryLabel: "Subscribe",
      exitLabel: "Cancel",
      entrySteps: 2,
      exitSteps: 7,
    },
    regulationFocus: [
      "FTC Click-to-Cancel Rule 2024",
      "EU Consumer Rights Directive",
      "Data Portability",
    ],
    expectedFindings: [
      'Cancel requires "mandatory" exit survey — cannot skip to cancel',
      "Data export not available on free plan — creates lock-in to avoid cancellation",
      "Cancel button deceptively styled as secondary (grey, small)",
      '"Pause plan" shown more prominently than "Cancel subscription"',
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Billing / Account Settings",
        url: "/settings/billing",
        action:
          "Find cancel subscription option — measure clicks from homepage, check for visual deprioritization",
      },
      {
        id: crypto.randomUUID(),
        label: "Cancel Flow",
        url: "/settings/cancel",
        action:
          'Scan for friction: mandatory survey, "are you sure" screens, hard-to-find confirm button',
      },
      {
        id: crypto.randomUUID(),
        label: "Data Export / Offboarding",
        url: "/settings/export",
        action:
          "Verify data export is available and functional — check if it requires paid plan (creates lock-in)",
      },
    ],
  },

  // ══════════════════════════════════════════
  // TRAVEL & HOSPITALITY
  // ══════════════════════════════════════════
  {
    id: "travel-flight-book",
    domain: "travel",
    icon: "✈️",
    label: "Flight Booking",
    description:
      "Flight booking flow — hidden fees, seat selection dark patterns, fare class confusion",
    checksFocus:
      "Drip pricing on fees, seat selection manipulation, travel insurance auto-add",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Hidden Costs",
      "Sneak Into Basket",
      "Scarcity Manipulation",
      "Interface Interference",
    ],
    regulationFocus: [
      "DGCA Consumer Guidelines",
      "EU Regulation 261/2004",
      "FTC Airline Fee Disclosure",
    ],
    expectedFindings: [
      "Base fare shown without taxes until final step",
      "Seat selection UI designed to confuse free vs paid seats",
      "Travel insurance auto-added with confusing opt-out language",
      '"Only 3 seats left" shown for common economy rows',
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Search Results",
        url: "/flights/search",
        action:
          'Check if fare shown includes taxes and fees — look for "View price details" hidden disclosure pattern',
      },
      {
        id: crypto.randomUUID(),
        label: "Fare Selection",
        url: "/flights/select",
        action:
          'Verify fare class differences are clearly explained — look for "Recommended" manipulation on expensive fares',
      },
      {
        id: crypto.randomUUID(),
        label: "Seat Selection",
        url: "/flights/seats",
        action:
          "Check seat map for paid seat prominence vs free seat availability — look for urgency on preferred seats",
      },
      {
        id: crypto.randomUUID(),
        label: "Add-ons / Extras",
        url: "/flights/extras",
        action:
          "Check for pre-added travel insurance, meal, or baggage — verify all extras are opt-in not opt-out",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment / Booking Review",
        url: "/flights/payment",
        action:
          "Verify final price matches what was shown at each step — check for last-minute fee reveals",
      },
    ],
  },
  {
    id: "travel-hotel-book",
    domain: "travel",
    icon: "🏨",
    label: "Hotel Booking",
    description:
      "Hotel booking — fake scarcity, resort fees hidden, price match manipulation",
    checksFocus:
      "Fake room scarcity, resort/destination fees revealed late, review manipulation",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Scarcity Manipulation",
      "Hidden Costs",
      "Social Proof Inflation",
      "Interface Interference",
    ],
    regulationFocus: [
      "CMA Online Travel Agents Investigation 2022",
      "FTC Endorsement Guidelines",
      "EU Consumer Rights Directive",
    ],
    expectedFindings: [
      '"Only 1 room left!" shown for multiple room types simultaneously',
      "Destination fee / resort fee not shown until checkout",
      "Review score sourced from pre-screened stays — methodology not disclosed",
      "Free cancellation shown but fine print requires 48h notice — not highlighted",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Search Results",
        url: "/hotels/search",
        action:
          'Check scarcity indicators ("1 left", "10 people viewing") — are they real-time or artificial pressure?',
      },
      {
        id: crypto.randomUUID(),
        label: "Hotel Detail Page",
        url: "/hotels/property",
        action:
          "Verify resort/destination/cleaning fees shown prominently — check review sourcing transparency",
      },
      {
        id: crypto.randomUUID(),
        label: "Room Selection",
        url: "/hotels/rooms",
        action:
          "Check free cancellation terms — are conditions (cutoff time, blackout periods) clearly shown?",
      },
      {
        id: crypto.randomUUID(),
        label: "Checkout",
        url: "/hotels/checkout",
        action:
          "Verify total price matches room price shown in listing — check for any hidden fee reveal at final step",
      },
    ],
  },
  {
    id: "travel-insurance",
    domain: "travel",
    icon: "🧳",
    label: "Travel Insurance Upsell",
    description:
      "In-flow travel insurance upsell — pre-checked, confusing decline, coverage obfuscation",
    checksFocus:
      "Pre-ticked insurance, confusing decline UI, exaggerated benefit framing",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Sneak Into Basket",
      "Trick Questions",
      "Interface Interference",
      "Confirmshaming",
    ],
    regulationFocus: [
      "IRDAI Travel Insurance Guidelines",
      "EU Insurance Distribution Directive",
      "FTC §5",
    ],
    expectedFindings: [
      'Travel insurance pre-ticked with confusing opt-out labeled "No, I am willing to risk traveling uninsured"',
      "Insurance cost not shown until after email entered",
      '"Most travelers add this" social proof label on insurance',
      "Decline button styled in grey / secondary — accept is primary",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Insurance Add-On Step",
        url: "/booking/insurance",
        action:
          "Check pre-selection state of insurance — verify opt-out language is straightforward, not confirmshaming",
      },
      {
        id: crypto.randomUUID(),
        label: "Coverage Details",
        url: "/booking/insurance/details",
        action:
          "Verify coverage exclusions are as prominently shown as inclusions",
      },
      {
        id: crypto.randomUUID(),
        label: "Review & Payment",
        url: "/booking/review",
        action:
          "Confirm insurance is shown in total — verify it was not silently re-added after being declined",
      },
    ],
  },

  // ══════════════════════════════════════════
  // MEDIA & ENTERTAINMENT
  // ══════════════════════════════════════════
  {
    id: "media-subscribe",
    domain: "media",
    icon: "🎬",
    label: "Streaming Subscription",
    description:
      "Streaming platform subscription — plan confusion, trial traps, ad-tier obfuscation",
    checksFocus:
      "Plan tier confusion, ad-supported tier obfuscation, auto-renew without reminder",
    primaryPillar: "darkpatterns",
    secondaryPillars: [""],
    ccpaPatterns: [
      "Interface Interference",
      "Misdirection",
      "Forced Continuity",
      "Hidden Costs",
    ],
    effortAsymmetry: {
      entryLabel: "Start Subscription",
      exitLabel: "Cancel",
      entrySteps: 3,
      exitSteps: 6,
    },
    regulationFocus: [
      "FTC Negative Option Rule",
      "EU Consumer Rights Directive",
      "CMA Streaming Investigation 2021",
    ],
    expectedFindings: [
      "Ad-supported tier available but not shown on main pricing page",
      '"Most Popular" badge on 4K plan anchors users to premium tier',
      "Trial end date not shown during sign-up flow",
      "Password sharing policy changed post-subscription without clear notice",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Pricing / Plans",
        url: "/plans",
        action:
          "Check if all tiers including ad-supported are equally discoverable — verify plan comparison is honest",
      },
      {
        id: crypto.randomUUID(),
        label: "Sign-Up",
        url: "/signup",
        action:
          "Check for auto-renewal consent — is it explicit or implied? Verify trial end date displayed",
      },
      {
        id: crypto.randomUUID(),
        label: "Payment",
        url: "/payment",
        action:
          "Verify selected plan cost + any add-ons shown before final charge — no last-minute plan upgrade pre-selection",
      },
    ],
  },
  {
    id: "media-cancel",
    domain: "media",
    icon: "🚫",
    label: "Streaming Cancellation",
    description:
      "Streaming service cancellation — pause option dominance, guilt-trip copy, access confusion",
    checksFocus:
      "Pause dominance over cancel, confirmshaming, confusing access end date",
    primaryPillar: "darkpatterns",
    secondaryPillars: ["accessibility"],
    ccpaPatterns: [
      "Roach Motel",
      "Confirmshaming",
      "Interface Interference",
      "Obstruction",
    ],
    effortAsymmetry: {
      entryLabel: "Subscribe",
      exitLabel: "Cancel",
      entrySteps: 2,
      exitSteps: 6,
    },
    regulationFocus: [
      "FTC Click-to-Cancel Rule 2024",
      "EU DSA Art. 25",
      "EU Consumer Rights Directive",
    ],
    expectedFindings: [
      "Pause subscription visually dominates over Cancel in retention flow",
      '"Lose access to X titles" framing alongside cancel confirm button',
      "Access end date unclear — does content remain accessible till billing cycle end?",
      "Re-subscribe button displayed immediately on cancellation confirmation",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Account / Membership Page",
        url: "/account/membership",
        action:
          "Find the cancellation option — measure click depth, check visual prominence vs account retention CTAs",
      },
      {
        id: crypto.randomUUID(),
        label: "Cancel Flow",
        url: "/account/cancel",
        action:
          "Scan for guilt-trip copy, pause option prominence, and any fake discount offers before cancel confirm",
      },
      {
        id: crypto.randomUUID(),
        label: "Cancellation Confirmation",
        url: "/account/cancelled",
        action:
          "Verify access end date clearly shown — check if re-subscribe is the most prominent element on the confirmation",
      },
    ],
  },
  {
    id: "media-parental",
    domain: "media",
    icon: "👨‍👩‍👧",
    label: "Parental Controls & Kids",
    description:
      "Kids profiles and parental controls —  of minors, default sharing, age verification",
    checksFocus: " Data collection defaults for kids profiles, age-gate bypass",
    primaryPillar: "",
    secondaryPillars: ["darkpatterns", "accessibility"],
    ccpaPatterns: [, "Trick Questions", "Interface Interference"],
    regulationFocus: [
      "COPPA (US)",
      "Article 8 (Child Data)",
      "DPDPA 2023 Child Protections",
      "UK AADC (Age Appropriate Design Code)",
    ],
    expectedFindings: [
      "Kids profile shares viewing data with advertising partners by default",
      "Age verification easily bypassed — no robust check",
      "Parental controls require re-authentication every session with no persistent setting",
      "Content targeting settings for kids profile not separate from adult profile",
    ],
    stages: [
      {
        id: crypto.randomUUID(),
        label: "Kids Profile Creation",
        url: "/profiles/kids/create",
        action:
          "Check data collection for kids profile — verify age-appropriate content consent is robust and separate",
      },
      {
        id: crypto.randomUUID(),
        label: "Parental Controls",
        url: "/settings/parental",
        action:
          "Verify data sharing for minor profiles is off by default — check for hidden tracking of kids viewing",
      },
      {
        id: crypto.randomUUID(),
        label: "Content Restrictions",
        url: "/settings/parental/content",
        action:
          "Test content filtering robustness — check if parental PIN can be easily bypassed",
      },
    ],
  },
];

export default function AuditPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"website" | "pdf" | "image" | "video">(
    "website",
  );
  const [url, setUrl] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(5);
  const [includeAI, setIncludeAI] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameSelector, setUsernameSelector] = useState("#username");
  const [passwordSelector, setPasswordSelector] = useState("#password");
  const [submitSelector, setSubmitSelector] = useState('button[type="submit"]');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoProcessing, setVideoProcessing] = useState(false);

  // Scope mode
  const [scopeMode, setScopeMode] = useState<
    "general" | "specific" | "predefined" | "director"
  >("general");
  const [specificUrls, setSpecificUrls] = useState("");
  const [selectedJourney, setSelectedJourney] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] =
    useState<JourneyDomain>("ecommerce");
  const [aiDirection, setAiDirection] = useState("");
  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>([]);

  // Performance Problem Context
  type PerfFlag =
    | "perf-slow-load"
    | "perf-login"
    | "perf-otp"
    | "perf-mobile"
    | "perf-timeout"
    | "perf-checkout"
    | "perf-search"
    | "perf-calculator"
    | "perf-pdf-download"
    | "perf-session-expiry";
  const PERF_CHIPS: { flag: PerfFlag; icon: string; label: string }[] = [
    { flag: "perf-slow-load", icon: "🐢", label: "Site loads too slowly" },
    { flag: "perf-login", icon: "🔐", label: "Login / auth is slow" },
    { flag: "perf-otp", icon: "🔢", label: "OTP / 2FA takes too long" },
    { flag: "perf-mobile", icon: "📱", label: "Poor mobile / 3G experience" },
    { flag: "perf-timeout", icon: "⏱️", label: "Pages hang or time out" },
    { flag: "perf-checkout", icon: "💳", label: "Checkout / payment slow" },
    { flag: "perf-search", icon: "🔍", label: "Search / filter sluggish" },
    { flag: "perf-calculator", icon: "🧮", label: "Calculator unresponsive" },
    { flag: "perf-pdf-download", icon: "📄", label: "PDF / download hangs" },
    {
      flag: "perf-session-expiry",
      icon: "⏰",
      label: "Session logs out too fast",
    },
  ];
  const [perfFlags, setPerfFlags] = useState<PerfFlag[]>([]);
  const [perfText, setPerfText] = useState("");
  const [perfParsing, setPerfParsing] = useState(false);

  const togglePerfFlag = (flag: PerfFlag) =>
    setPerfFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );

  const parsePerfText = async () => {
    if (!perfText.trim()) return;
    setPerfParsing(true);
    try {
      const res = await fetch("/api/audit/parse-perf-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: perfText }),
      });
      const data = await res.json();
      if (Array.isArray(data.flags) && data.flags.length > 0) {
        setPerfFlags((prev) => Array.from(new Set([...prev, ...data.flags])));
      }
    } catch {}
    setPerfParsing(false);
  };

  // WCAG — independent level selection (auditor can pick any combination)
  const [wcagLevelA, setWcagLevelA] = useState(true);
  const [wcagLevelAA, setWcagLevelAA] = useState(true);
  const [wcagLevelAAA, setWcagLevelAAA] = useState(false);
  const [standard, setStandard] = useState("WCAG 2.2");

  // Pillars (Performance & Privacy are Coming Soon — disabled)
  const [pillarA11y, setPillarA11y] = useState(true);
  const [pillarDP, setPillarDP] = useState(true);
  const [pillarPerf, setPillarPerf] = useState(false);
  const [pillarPrivacy, setPillarPrivacy] = useState(false);

  const getEnabledPillars = () => {
    const p: string[] = [];
    if (pillarA11y) p.push("accessibility");
    if (pillarDP) p.push("darkpatterns");
    if (pillarPerf) p.push("performance");
    if (pillarPrivacy) p.push("privacy");
    return p;
  };

  const getSelectedLevels = (): ("A" | "AA" | "AAA")[] => {
    const levels: ("A" | "AA" | "AAA")[] = [];
    if (wcagLevelA) levels.push("A");
    if (wcagLevelAA) levels.push("AA");
    if (wcagLevelAAA) levels.push("AAA");
    return levels.length > 0 ? levels : ["A", "AA"];
  };

  const getConformanceLabel = () => {
    if (wcagLevelAAA) return "AAA";
    if (wcagLevelAA) return "AA";
    return "A";
  };

  // When predefined journey is selected, pre-populate journeySteps from the template
  const selectPredefinedJourney = useCallback((journeyId: string) => {
    if (journeyId === "custom") {
      setScopeMode("director");
      setSelectedJourney(null);
      return;
    }
    const template = PREDEFINED_JOURNEYS.find((j) => j.id === journeyId);
    if (!template) return;
    setSelectedJourney(journeyId);
    // Pre-fill journey steps from the template (user can then edit them)
    setJourneySteps(
      template.stages.map((s) => ({
        id: crypto.randomUUID(),
        label: s.label,
        url: s.url,
        action: s.action || "",
      })),
    );
  }, []);

  // Effective max pages — for predefined/director modes, auto-set to step count
  const effectiveMaxPages =
    (scopeMode === "predefined" || scopeMode === "director") &&
    journeySteps.length > 0
      ? journeySteps.length
      : maxPages;

  const startWebsiteAudit = async () => {
    if (!url) {
      setError("Please enter a URL");
      return;
    }
    if (scopeMode === "specific" && !specificUrls.trim()) {
      setError("Please enter at least one page URL");
      return;
    }
    if (scopeMode === "predefined" && !selectedJourney) {
      setError("Please select a journey");
      return;
    }
    if (scopeMode === "predefined" && journeySteps.length === 0) {
      setError(
        "Journey steps could not be loaded. Please select a journey again.",
      );
      return;
    }
    if (scopeMode === "director" && journeySteps.length === 0) {
      setError("Add at least one step in Director Mode");
      return;
    }
    const levels = getSelectedLevels();
    if (levels.length === 0) {
      setError("Select at least one WCAG level");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        url,
        crawlDepth,
        maxPages: effectiveMaxPages,
        includeAI,
        wcagLevels: levels,
        standard,
        enabledPillars: getEnabledPillars(),
        scopeMode,
        specificUrls:
          scopeMode === "specific"
            ? specificUrls
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        selectedJourney:
          scopeMode === "predefined" ? selectedJourney : undefined,
        // For predefined mode, pass the (potentially edited) steps + action instructions
        journeySteps:
          scopeMode === "predefined" || scopeMode === "director"
            ? journeySteps
            : undefined,
        aiDirection: aiDirection || undefined,
        performanceProblemContext:
          pillarPerf && (perfFlags.length > 0 || perfText.trim())
            ? { flags: perfFlags, freeText: perfText.trim() || undefined }
            : undefined,
      };
      if (showLogin && username && password) {
        body.loginConfig = {
          loginUrl: loginUrl || url,
          username,
          password,
          usernameSelector,
          passwordSelector,
          submitSelector,
        };
      }
      const res = await fetch("/api/audit/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.auditId) router.push(`/audit/${data.auditId}`);
      else setError(data.error || "Failed to start audit");
    } catch {
      setError("Network error — please try again");
    }
    setLoading(false);
  };

  const startPdfAudit = async () => {
    if (!pdfFile) {
      setError("Please select a PDF file");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", pdfFile);
      const res = await fetch("/api/audit/pdf", { method: "POST", body: form });
      const data = await res.json();
      if (data.auditId) router.push(`/audit/${data.auditId}`);
      else setError(data.error || "Failed to start audit");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const startImageAudit = async () => {
    if (!imageFile) {
      setError("Please select an image file");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", imageFile);
      form.append("pillars", getEnabledPillars().join(","));
      const res = await fetch("/api/audit/image", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.auditId) router.push(`/audit/${data.auditId}`);
      else setError(data.error || "Failed to start image audit");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const startVideoAudit = async () => {
    if (!videoFile) {
      setError("Please select a video file");
      return;
    }
    setLoading(true);
    setVideoProcessing(true);
    setError("");
    try {
      const frames = await extractVideoFrames(videoFile, 8);
      const res = await fetch("/api/audit/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames,
          pillars: getEnabledPillars(),
          filename: videoFile.name,
        }),
      });
      const data = await res.json();
      if (data.auditId) router.push(`/audit/${data.auditId}`);
      else setError(data.error || "Failed to start video audit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video processing failed");
    }
    setLoading(false);
    setVideoProcessing(false);
  };

  const extractVideoFrames = (
    file: File,
    count: number,
  ): Promise<
    Array<{ base64: string; mimeType: string; timestampMs: number }>
  > => {
    return new Promise((resolve, reject) => {
      const objUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = objUrl;
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () => {
        const duration = video.duration;
        const times = Array.from(
          { length: count },
          (_, i) => (duration / (count + 1)) * (i + 1) * 1000,
        );
        const frames: Array<{
          base64: string;
          mimeType: string;
          timestampMs: number;
        }> = [];
        let idx = 0;
        const capture = () => {
          if (idx >= times.length) {
            URL.revokeObjectURL(objUrl);
            resolve(frames);
            return;
          }
          video.currentTime = times[idx] / 1000;
          video.onseeked = () => {
            const canvas = document.createElement("canvas");
            canvas.width = Math.min(video.videoWidth, 1280);
            canvas.height = Math.round(
              canvas.width * (video.videoHeight / video.videoWidth),
            );
            canvas
              .getContext("2d")!
              .drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push({
              base64: canvas.toDataURL("image/jpeg", 0.7).split(",")[1],
              mimeType: "image/jpeg",
              timestampMs: times[idx],
            });
            idx++;
            capture();
          };
        };
        capture();
      };
      video.onerror = () =>
        reject(new Error("Failed to load video. Try MP4 or WebM format."));
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith(".pdf")) setPdfFile(file);
    else setError("Only PDF files are accepted");
  };

  // Helper for step field updates
  const updateStep = (id: string, field: keyof JourneyStep, value: string) => {
    setJourneySteps((steps) =>
      steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const selectedTemplate = selectedJourney
    ? PREDEFINED_JOURNEYS.find((j) => j.id === selectedJourney)
    : null;

  return (
    <div
      className="container"
      style={{
        paddingTop: 36,
        paddingBottom: 80,
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">New TrustLens Audit</h1>
        <p className="page-subtitle">
          AI-powered digital trust audit: Accessibility | Dark Patterns |
          Performance
        </p>
      </div>

      {/* ── Pillar Selection ── */}
      <div
        className="glass-card animate-fade-in"
        style={{ marginBottom: 20, padding: "18px 20px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700 }}>
            Select Audit Pillars you want to do -
          </span>
          {/* <span style={{ fontSize: 16, color: "var(--offshade-text)" }}>
             domains to audit
          </span> */}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          {[
            {
              key: "a11y",
              icon: "♿",
              label: "Accessibility",
              desc: "WCAG 2.2 · EN 301 549 · Section 508",
              color: "var(--pillar-a11y)",
              checked: pillarA11y,
              set: setPillarA11y,
            },
            {
              key: "dp",
              icon: "🕵️",
              label: "Dark Patterns",
              desc: "Ethical UX · Visual AI · CCPA taxonomy",
              color: "var(--pillar-dp)",
              checked: pillarDP,
              set: setPillarDP,
            },
          ].map((p) => (
            <label
              key={p.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "20px 20px",
                borderRadius: "var(--radius-md)",
                border: `2px solid ${p.checked ? "var(--kpmg-dynamic)" : "var(--border)"}`,
                background: "transparent",
                cursor: "pointer",
                transition: "var(--transition)",
                textAlign: "center",
              }}
            >
              <input
                type="checkbox"
                checked={p.checked}
                onChange={(e) => p.set(e.target.checked)}
                style={{ display: "none" }}
              />
              {/* <span style={{ fontSize: 22 }}>{p.icon}</span> */}
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: p.checked
                    ? "var(--pillar-a11y)"
                    : "var(--offshade-text)",
                }}
              >
                {p.label}
              </span>
              <span style={{ fontSize: 10, color: "var(--offshade-text)" }}>
                {p.desc}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "6px 12px",
                  borderRadius: 99,

                  background: p.checked ? `#24a86b` : "rgba(255,255,255,0.04)",
                  color: p.checked
                    ? "var(--kpmg-inverse)"
                    : "var(--text-muted)",
                }}
              >
                {p.checked ? " Selected" : "Unselected"}
              </span>
            </label>
          ))}
        </div>
        {/* Row 2 — Performance (live) + Privacy (coming soon) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            marginTop: 10,
          }}
        >
          {/* ⚡ Performance — fully live */}
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "20px 20px",
              borderRadius: "var(--radius-md)",
              border: `2px solid ${pillarPerf ? "var(--kpmg-dynamic)" : "var(--border)"}`,
              // background: pillarPerf
              //   ? "color-mix(in srgb, var(--pillar-perf) 10%, transparent)"
              //   : "transparent",
              cursor: "pointer",
              transition: "var(--transition)",
              textAlign: "center",
            }}
          >
            <input
              type="checkbox"
              checked={pillarPerf}
              onChange={(e) => setPillarPerf(e.target.checked)}
              style={{ display: "none" }}
            />
            {/* <span style={{ fontSize: 22 }}>⚡</span> */}
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: pillarPerf
                  ? "var(--pillar-a11y)"
                  : "var(--offshade-text)",
              }}
            >
              Performance
            </span>
            <span style={{ fontSize: 10, color: "var(--offshade-text)" }}>
              CWV · Auth Flows · Network Sim
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "6px 12px",
                borderRadius: 99,
                background: pillarPerf ? `#24a86b` : "rgba(255,255,255,0.04)",
                color: pillarPerf ? "var(--kpmg-inverse)" : "var(--text-muted)",
              }}
            >
              {pillarPerf ? " Selected" : "Unselected"}
            </span>
          </label>

          {/* 🔒 Privacy — coming soon */}
          {/* <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "14px 10px",
              borderRadius: "var(--radius-md)",
              border: "2px dashed rgba(230,126,34,0.3)",
              background: "rgba(230,126,34,0.04)",
              opacity: 0.65,
              cursor: "not-allowed",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 22 }}>🔒</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
              }}
            >
              Privacy
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              Tracker detection · Cookie audit
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 99,
                background: "rgba(230,126,34,0.12)",
                color: "#E67E22",
                border: "1px solid rgba(230,126,34,0.3)",
                fontFamily: "Geist Mono, monospace",
              }}
            >
              COMING SOON
            </span>
          </div> */}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "var(--offshade-text)",
          }}
        >
          {getEnabledPillars().length} of 3 pillars enabled
        </div>
      </div>

      {/* ── Performance Problem Context ── only shown when Performance pillar is ON */}
      {pillarPerf && (
        <div
          className="glass-card animate-fade-in"
          style={{
            marginBottom: 20,
            padding: "18px 20px",
            borderTop: "3px solid var(--pillar-perf)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              What has the client reported?
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-secondary)",
                background: "rgba(255,255,255,0.06)",
                padding: "2px 8px",
                borderRadius: 99,
                // fontFamily: "Geist Mono, monospace",
              }}
            >
              optional — activates targeted test layers
            </span>
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              marginBottom: 14,
            }}
          >
            Select all known performance complaints. The engine will run deeper,
            targeted tests for each and confirm them in the report.
          </p>

          {/* Chip grid */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {PERF_CHIPS.map((chip) => {
              const active = perfFlags.includes(chip.flag);
              return (
                <button
                  key={chip.flag}
                  onClick={() => togglePerfFlag(chip.flag)}
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 99,
                    border: `1.5px solid ${active ? "var(--kpmg-dynamic)" : "var(--border)"}`,
                    // background: active
                    //   ? "color-mix(in srgb, var(--pillar-perf) 15%, transparent)"
                    //   : "var(--bg-secondary)",
                    color: active
                      ? "var(--kpmg-dynamic)"
                      : "var(--kpmg-dynamic)",
                    fontSize: 12,
                    fontWeight: active ? 700 : 400,
                    cursor: "pointer",
                    transition: "var(--transition)",
                  }}
                >
                  {/* <span>{chip.icon}</span> */}
                  <span>{chip.label}</span>
                  {/* {active && (
                    <span style={{ fontSize: 10, marginLeft: 2 }}>✓</span>
                  )} */}
                </button>
              );
            })}
          </div>

          {perfFlags.length > 0 && (
            <div
              style={{
                fontSize: 13,
                color: "var(--kpmg-dynamic)",
                marginBottom: 12,
                fontWeight: 600,
                // fontFamily: "Geist Mono, monospace",
              }}
            >
              {perfFlags.length} problem{perfFlags.length > 1 ? "s" : ""}{" "}
              flagged → Layers{" "}
              {[
                perfFlags.some((f) => ["perf-login", "perf-otp"].includes(f)) &&
                  "G (auth)",
                perfFlags.some((f) =>
                  ["perf-search", "perf-calculator"].includes(f),
                ) && "H (interaction)",
                perfFlags.some((f) =>
                  ["perf-mobile", "perf-slow-load", "perf-timeout"].includes(f),
                ) && "I (3G sim)",
              ]
                .filter(Boolean)
                .join(", ")}{" "}
              will activate
            </div>
          )}

          {/* AI text input */}
          <div style={{ position: "relative" }}>
            <textarea
              value={perfText}
              onChange={(e) => setPerfText(e.target.value)}
              placeholder={
                'Or describe the issue in your own words…\ne.g. "The login page on mobile takes 8 seconds. The OTP step seems to hang. Users also complain the insurance calculator freezes on older phones."'
              }
              rows={3}
              style={{
                width: "100%",
                resize: "vertical",
                fontSize: 12,
                fontStyle: perfText ? "normal" : "italic",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={parsePerfText}
              disabled={!perfText.trim() || perfParsing}
              type="button"
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background:
                  perfText.trim() && !perfParsing
                    ? "var(--kpmg-dynamic)"
                    : "var(--border)",
                color:
                  perfText.trim() && !perfParsing
                    ? "var(--alternate-text)"
                    : "var(--offshade-text)",
                fontSize: 13,
                fontWeight: 700,
                cursor:
                  perfText.trim() && !perfParsing ? "pointer" : "not-allowed",
                transition: "var(--transition)",
              }}
            >
              {perfParsing ? "Parsing…" : "Parse with AI "}
            </button>
          </div>
        </div>
      )}

      {/* ── WCAG Standard ── */}
      {pillarA11y && (
        <div
          className="glass-card animate-fade-in"
          style={{ marginBottom: 20, padding: "18px 20px" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div className="input-group">
              <label className="input-label">Accessibility Standard</label>
              <select
                className="input-field"
                value={standard}
                onChange={(e) => setStandard(e.target.value)}
              >
                {STANDARDS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Conformance Level</label>
              <div className="wcag-level-selector" style={{ paddingTop: 2, display: "flex", gap: 8 }}>
                {([
                  { key: "A", label: "Level A", checked: wcagLevelA, set: setWcagLevelA, desc: "Baseline" },
                  { key: "AA", label: "Level AA", checked: wcagLevelAA, set: setWcagLevelAA, desc: "Standard" },
                  { key: "AAA", label: "Level AAA", checked: wcagLevelAAA, set: setWcagLevelAAA, desc: "Enhanced" },
                ] as const).map(({ key, label, checked, set, desc }) => (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: checked ? "2px solid #0057a8" : "2px solid #c0c0c0",
                      background: checked ? "#0057a8" : "transparent",
                      color: checked ? "#fff" : "inherit",
                      cursor: "pointer",
                      userSelect: "none",
                      fontWeight: 600,
                      fontSize: 13,
                      minWidth: 80,
                      textAlign: "center",
                      transition: "background 0.15s, border-color 0.15s, color 0.15s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => set(e.target.checked)}
                      style={{ display: "none" }}
                    />
                    {label}
                    <span style={{ fontSize: 10, fontWeight: 400, opacity: checked ? 0.85 : 0.5 }}>{desc}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
                {getSelectedLevels().length === 0
                  ? "Select at least one level."
                  : `Audit will check WCAG criteria at: ${getSelectedLevels().join(", ")}. Only issues at these levels will be reported.`}
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              Audit Scope:
            </span>
            <span className={` ${getConformanceLabel().toLowerCase()}`}>
              {standard} — Level {getConformanceLabel()}
            </span>
          </div>
        </div>
      )}

      {/* ── Media Type Tabs ── */}
      <div className="tabs" style={{ marginBottom: 20, gap: 60 }}>
        <button
          className={`tab ${tab === "website" ? "active" : ""}`}
          onClick={() => setTab("website")}
        >
          Website / Portal
        </button>
        <button
          className={`tab ${tab === "pdf" ? "active" : ""}`}
          onClick={() => setTab("pdf")}
        >
          PDF Document
        </button>
        <button
          className={`tab ${tab === "image" ? "active" : ""}`}
          onClick={() => setTab("image")}
          style={{ position: "relative" }}
        >
          Screenshot / Image
          {/* <span
            style={{
              marginLeft: 5,
              fontSize: 8,
              padding: "1px 5px",
              borderRadius: 99,
              background: "rgba(205,171,254,0.15)",
              color: "var(--accent-purple)",
              border: "1px solid rgba(205,171,254,0.3)",
              fontWeight: 700,
              verticalAlign: "middle",
              // fontFamily: "Geist Mono, monospace",
            }}
          >
             AI Vision 
          </span> */}
        </button>
        <button
          className={`tab ${tab === "video" ? "active" : ""}`}
          onClick={() => setTab("video")}
          style={{ position: "relative" }}
        >
          Video Recording
          {/* <span
            style={{
              marginLeft: 5,
              fontSize: 8,
              padding: "1px 5px",
              borderRadius: 99,
              background: "rgba(254,113,65,0.12)",
              color: "var(--accent-primary)",
              border: "1px solid rgba(254,113,65,0.3)",
              fontWeight: 700,
              verticalAlign: "middle",
              fontFamily: "Geist Mono, monospace",
            }}
          >
             AI Vision 
          </span> */}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(232,0,45,0.08)",
            border: "1px solid rgba(232,0,45,0.25)",
            borderRadius: "var(--radius-md)",
            color: "#E8002D",
            fontSize: 13,
            marginBottom: 18,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── WEBSITE TAB ── */}
      {tab === "website" && (
        <div className="glass-card animate-fade-in">
          {/* URL */}
          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Website URL *</label>
            <input
              id="website-url"
              className="input-field"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          {/* ── AUDIT SCOPE ── */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--offshade-text)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 10,
              }}
            >
              Audit Scope
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {(
                [
                  {
                    id: "general",
                    icon: "🌐",
                    label: "General Site Audit",
                    desc: "Crawl & audit the full site automatically",
                    tags: ["URL + crawl depth", "Max pages", "Auto-discover"],
                    rec: false,
                  },
                  {
                    id: "specific",
                    icon: "📄",
                    label: "Specific Page(s)",
                    desc: "Paste exact URLs — deep single-pass per page",
                    tags: ["Named pages", "Multi-URL input", "No crawling"],
                    rec: false,
                  },
                  {
                    id: "predefined",
                    icon: "🗺️",
                    label: "Predefined Journey",
                    desc: "Pick a known user flow — context-aware checks",
                    tags: ["Journey-aware", "Editable steps", "Custom actions"],
                    rec: true,
                  },
                  {
                    id: "director",
                    icon: "⭐",
                    label: "Director Mode",
                    desc: "Build your own flow + AI direction prompt",
                    tags: ["Page sequencing", "AI direction", "Step notes"],
                    rec: false,
                  },
                ] as {
                  id: "general" | "specific" | "predefined" | "director";
                  icon: string;
                  label: string;
                  desc: string;
                  tags: string[];
                  rec: boolean;
                }[]
              ).map((m) => (
                <button
                  key={m.id}
                  id={`scope-mode-${m.id}`}
                  onClick={() => setScopeMode(m.id)}
                  style={{
                    textAlign: "left",
                    padding: "8px 18px",
                    borderRadius: "var(--radius-md)",
                    border: `2px solid ${scopeMode === m.id ? "var(--kpmg-dynamic)" : "var(--border)"}`,
                    // background:
                    //   scopeMode === m.id
                    //     ? "rgba(254,113,65,0.06)"
                    //     : "transparent",
                    cursor: "pointer",
                    transition: "var(--transition)",
                    position: "relative",
                  }}
                >
                  {m.rec && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        fontSize: 8,
                        padding: "20px 20px",
                        borderRadius: 99,
                        // background: "rgba(254,113,65,0.15)",
                        color: "var(--offshade-text)",
                        // border: "1px solid rgba(254,113,65,0.3)",
                        fontWeight: 700,
                        // fontFamily: "Geist Mono, monospace",
                      }}
                    >
                      {/* ★ REC */}
                    </span>
                  )}
                  {/* <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div> */}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        scopeMode === m.id
                          ? "var(--offshade-text)"
                          : "var(--text-primary)",
                      marginBottom: 3,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--offshade-text)",
                      marginBottom: 6,
                      lineHeight: 1.4,
                    }}
                  >
                    {m.desc}
                  </div>
                  {/* <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {m.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 99,
                          background: "var(--bg-secondary)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                          fontFamily: "Geist Mono, monospace",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div> */}
                </button>
              ))}
            </div>

            {/* MODE 1 — General */}
            {scopeMode === "general" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                }}
              >
                <div className="input-group">
                  <label className="input-label">Crawl Depth</label>
                  <select
                    className="input-field"
                    value={crawlDepth}
                    onChange={(e) => setCrawlDepth(+e.target.value)}
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>
                        {v} level{v > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Max Pages</label>
                  <select
                    className="input-field"
                    value={maxPages}
                    onChange={(e) => setMaxPages(+e.target.value)}
                  >
                    {[1, 3, 5, 10, 20, 30, 50, 100, 200].map((v) => (
                      <option key={v} value={v}>
                        {v} pages
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">AI Analysis</label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      padding: "10px 0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeAI}
                      onChange={(e) => setIncludeAI(e.target.checked)}
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: "var(--accent-primary)",
                      }}
                    />
                    <span
                      style={{ fontSize: 13, color: "var(--text-secondary)" }}
                    >
                      Enable GPT-4o
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* MODE 2 — Specific Pages */}
            {scopeMode === "specific" && (
              <div>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label className="input-label">
                    Page URLs (one per line)
                  </label>
                  <textarea
                    id="specific-urls"
                    className="input-field"
                    rows={4}
                    placeholder={
                      "https://example.com/checkout\nhttps://example.com/pricing\nhttps://example.com/account/cancel"
                    }
                    value={specificUrls}
                    onChange={(e) => setSpecificUrls(e.target.value)}
                    style={{
                      resize: "vertical",
                      // fontFamily: "Geist Mono, monospace",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    // fontFamily: "Geist Mono, monospace",
                  }}
                >
                  No crawling — each URL gets a deep single-pass audit. Pages to
                  audit:{" "}
                  {specificUrls.split("\n").filter((s) => s.trim()).length || 0}
                </div>
              </div>
            )}

            {/* MODE 3 — Predefined Journey */}
            {scopeMode === "predefined" && (
              <div>
                {/* Journey Template Picker — V2 Rich Cards */}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--offshade-text)",
                    marginBottom: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Select a Journey Template
                </div>

                {/* Domain Selector */}
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--offshade-text)",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Industry Domain
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      overflowX: "auto",
                      paddingBottom: 4,
                    }}
                  >
                    {JOURNEY_DOMAINS.map((d) => {
                      const domainJourneyCount = PREDEFINED_JOURNEYS.filter(
                        (j) => j.domain === d.id,
                      ).length;
                      const isActiveDomain = selectedDomain === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => {
                            setSelectedDomain(d.id);
                            setSelectedJourney(null);
                          }}
                          style={{
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            padding: "10px 14px",
                            borderRadius: "var(--radius-md)",
                            border: `2px solid ${isActiveDomain ? "var(--kpmg-dynamic)" : "var(--border)"}`,
                            background: "transparent",
                            // cursor: "pointer",
                            transition: "all 0.2s ease",
                            minWidth: 72,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{d.icon}</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: isActiveDomain
                                ? "var(--kpmg-dynamic)"
                                : "var(--text-primary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {d.label}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: isActiveDomain
                                ? "var(--kpmg-dynamic)"
                                : "var(--text-primary)",
                            }}
                          >
                            {domainJourneyCount} flows
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pillar legend */}
                {/* <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    {
                      key: "darkpatterns",
                      label: "Dark Patterns",
                      color: "var(--pillar-dp)",
                      icon: "🕵️",
                    },
                    // {
                    //   key: "privacy",
                    //   label: "Privacy",
                    //   color: "var(--pillar-priv)",
                    //   icon: "🔒",
                    // },
                    {
                      key: "accessibility",
                      label: "Accessibility",
                      color: "var(--pillar-a11y)",
                      icon: "♿",
                    },
                    {
                      key: "performance",
                      label: "Performance",
                      color: "var(--pillar-perf)",
                      icon: "⚡",
                    },
                  ].map((p) => (
                    <span
                      key={p.key}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: `${p.color}15`,
                        color: "var(--offshade-text)",
                        border: `1px solid ${p.color}35`,
                      }}
                    >
                      {p.icon} {p.label}
                    </span>
                  ))}
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--offshade-text)",
                      alignSelf: "center",
                    }}
                  >
                    = primary pillar this journey tests most heavily
                  </span>
                </div> */}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {PREDEFINED_JOURNEYS.filter(
                    (j) => j.domain === selectedDomain,
                  ).map((j) => {
                    const pillarColors: Record<string, string> = {
                      darkpatterns: "var(--pillar-dp)",
                      // privacy: "var(--pillar-priv)",
                      accessibility: "var(--pillar-a11y)",
                      performance: "var(--pillar-perf)",
                    };
                    const pillarIcons: Record<string, string> = {
                      darkpatterns: "🕵️",
                      // privacy: "🔒",
                      accessibility: "♿",
                      performance: "⚡",
                    };
                    const pillarColor =
                      pillarColors[j.primaryPillar] || "var(--accent-primary)";
                    const isSelected = selectedJourney === j.id;
                    return (
                      <button
                        key={j.id}
                        id={`journey-${j.id}`}
                        onClick={() => selectPredefinedJourney(j.id)}
                        style={{
                          textAlign: "left",
                          borderRadius: "var(--radius-md)",
                          // borderTop: `4px solid ${pillarColor}`,
                          borderRight: `1px solid ${isSelected ? "var(--offshade-text)" : "var(--border)"}`,
                          borderTop: `1px solid ${isSelected ? "var(--offshade-text)" : "var(--border)"}`,
                          borderBottom: `1px solid ${isSelected ? "var(--offshade-text)" : "var(--border)"}`,
                          borderLeft: `1px solid ${isSelected ? "var(--offshade-text)" : "var(--border)"}`,
                          background: isSelected
                            ? `${pillarColor}08`
                            : "transparent",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          position: "relative",
                        }}
                      >
                        <div style={{ padding: "10px 12px" }}>
                          {/* Row 1: icon + name + stage count */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                              }}
                            >
                              {/* <span style={{ fontSize: 18 }}>{j.icon}</span> */}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: isSelected
                                    ? "var(--offshade-text)"
                                    : "var(--text-primary)",
                                }}
                              >
                                {j.label}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 99,
                                background: `${pillarColor}18`,
                                color: "var(--offshade-text)",

                                flexShrink: 0,
                              }}
                            >
                              {j.stages.length} STAGES
                            </span>
                          </div>

                          {/* Description */}
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--offshade-text)",
                              lineHeight: 1.5,
                              marginBottom: 8,
                            }}
                          >
                            {j.description}
                          </div>

                          {/* Primary pillar badge */}
                          {/* <div
                            style={{
                              display: "flex",
                              gap: 5,
                              flexWrap: "wrap",
                              marginBottom: 7,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 99,
                                background: `${pillarColor}18`,
                                color: pillarColor,
                                border: `1px solid ${pillarColor}35`,
                                fontFamily: "Geist Mono, monospace",
                              }}
                            >
                              {pillarIcons[j.primaryPillar]} PRIMARY:{" "}
                              {j.primaryPillar.toUpperCase()}
                            </span>
                            {j.secondaryPillars.map((sp) => (
                              <span
                                key={sp}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  fontSize: 9,
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: 99,
                                  background: `${pillarColors[sp]}12`,
                                  color: pillarColors[sp],
                                  fontFamily: "Geist Mono, monospace",
                                }}
                              >
                                {pillarIcons[sp]}
                              </span>
                            ))}
                          </div> */}

                          {/* CCPApatterns targeted */}
                          {/* <div
                            style={{
                              display: "flex",
                              gap: 4,
                              flexWrap: "wrap",
                              marginBottom: 7,
                            }}
                          >
                            {j.ccpaPatterns.slice(0, 3).map((bp) => (
                              <span
                                key={bp}
                                style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 99,
                                  background: "rgba(205,171,254,0.12)",
                                  color: "var(--pillar-dp)",
                                  border: "1px solid rgba(205,171,254,0.25)",
                                  fontFamily: "Geist Mono, monospace",
                                }}
                              >
                                {bp}
                              </span>
                            ))}
                            {j.ccpaPatterns.length > 3 && (
                              <span
                                style={{
                                  fontSize: 8,
                                  color: "var(--text-muted)",
                                  fontFamily: "Geist Mono, monospace",
                                  padding: "1px 4px",
                                }}
                              >
                                +{j.ccpaPatterns.length - 3} more
                              </span>
                            )}
                          </div> */}

                          {/* Regulation hook */}
                          {/* <div
                            style={{
                              display: "flex",
                              gap: 4,
                              flexWrap: "wrap",
                              marginBottom: j.effortAsymmetry ? 8 : 0,
                            }}
                          >
                            {j.regulationFocus.slice(0, 2).map((reg) => (
                              <span
                                key={reg}
                                style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 99,
                                  background: "rgba(254,113,65,0.1)",
                                  color: "#FE7141",
                                  fontFamily: "Geist Mono, monospace",
                                }}
                              >
                                {reg}
                              </span>
                            ))}
                          </div> */}

                          {/* Effort asymmetry callout */}
                          {/* {j.effortAsymmetry && (
                            <div
                              style={{
                                marginTop: 8,
                                padding: "6px 8px",
                                borderRadius: 6,
                                background: "rgba(232,0,45,0.06)",
                                border: "1px solid rgba(232,0,45,0.2)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#E8002D",
                                  marginBottom: 3,
                                  // fontFamily: "Geist Mono, monospace",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                ⚖ Effort Asymmetry
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                }}
                              >
                                <div style={{ textAlign: "center" }}>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: "var(--offshade-text)",
                                    }}
                                  >
                                    {j.effortAsymmetry.entrySteps}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "var(--offshade-text)",
                                    }}
                                  >
                                    {j.effortAsymmetry.entryLabel}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--offshade-text)",
                                  }}
                                >
                                  vs
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <div
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 700,
                                      color: "#E8002D",
                                    }}
                                  >
                                    {j.effortAsymmetry.exitSteps}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "var(--offshade-text)",
                                    }}
                                  >
                                    {j.effortAsymmetry.exitLabel}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#E8002D",
                                    fontWeight: 700,
                                    marginLeft: 4,
                                  }}
                                >
                                  {j.effortAsymmetry.exitSteps}× harder to exit
                                </div>
                              </div>
                            </div>
                          )} */}
                        </div>
                      </button>
                    );
                  })}
                  {/* Custom Journey Card */}
                  <button
                    id="journey-custom"
                    onClick={() => selectPredefinedJourney("custom")}
                    style={{
                      textAlign: "left",
                      borderRadius: "var(--radius-md)",
                      borderTop: "1px dashed var(--border)",
                      borderRight: "1px dashed var(--border)",
                      borderBottom: "1px dashed var(--border)",
                      borderLeft: "1px dashed var(--border)",
                      background: "transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        height: "100%",
                        justifyContent: "center",
                      }}
                    >
                      {/* <div style={{ fontSize: 20 }}>➕</div> */}
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        Create Custom Journey
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        Define your own page flow, URLs, and action instructions
                        from scratch
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          // fontFamily: "Geist Mono, monospace",
                          color: "var(--accent-primary)",
                          marginTop: 4,
                        }}
                      >
                        Director Mode →
                      </div>
                    </div>
                  </button>
                </div>

                {selectedTemplate &&
                  journeySteps.length > 0 &&
                  (() => {
                    const pillarColors: Record<string, string> = {
                      darkpatterns: "var(--pillar-dp)",
                      // privacy: "var(--pillar-priv)",
                      accessibility: "var(--pillar-a11y)",
                      performance: "var(--pillar-perf)",
                    };
                    const pillarColor =
                      pillarColors[selectedTemplate.primaryPillar] ||
                      "var(--accent-primary)";
                    return (
                      <div
                        style={{
                          borderRadius: "var(--radius-md)",
                          border: `1px solid ${pillarColor}40`,
                          background: `${pillarColor}06`,
                          marginBottom: 12,
                          overflow: "hidden",
                          animation: "fadeIn 0.3s ease",
                        }}
                      >
                        {/* Panel header */}
                        <div
                          style={{
                            padding: "10px 14px",
                            borderBottom: `1px solid ${pillarColor}25`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 20 }}>
                              {/* {selectedTemplate.icon} */}
                            </span>
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: "var(--offshade-text)",
                                }}
                              >
                                {selectedTemplate.label}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--offshade-text)",
                                }}
                              >
                                {selectedTemplate.stages.length} stages ·{" "}
                                {selectedTemplate.ccpaPatterns.length} CCPA
                                Patterns targeted
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            {/* {selectedTemplate.regulationFocus.map((reg) => (
                              <span
                                key={reg}
                                style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 99,
                                  background: "rgba(254,113,65,0.12)",
                                  color: "var(--offshade-text)",
                                }}
                              >
                                {reg}
                              </span>
                            ))} */}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: "2px 14px",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 16,
                          }}
                        >
                          {/* Left: Vertical stage timeline */}

                          {/* Right: What this tests + CCPAcoverage */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 12,
                            }}
                          >
                            {/* Expected findings */}
                            {/* <div>
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  marginBottom: 8,
                                  // fontFamily: "Geist Mono, monospace",
                                }}
                              >
                                Expected Findings
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 5,
                                }}
                              >
                                {selectedTemplate.expectedFindings.map(
                                  (f, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        display: "flex",
                                        gap: 6,
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: "var(--kpmg-dynamic)",
                                          marginTop: 1,
                                          flexShrink: 0,
                                        }}
                                      >
                                        ●
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: "var(--text-secondary)",
                                          lineHeight: 1.4,
                                        }}
                                      >
                                        {f}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div> */}

                            {/* CCPApatterns targeted */}
                            <div>
                              {/* <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  marginBottom: 8,
                                  // fontFamily: "Geist Mono, monospace",
                                }}
                              >
                                CCPA Patterns Scanned
                              </div> */}
                              {/* <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 4,
                                }}
                              >
                                {selectedTemplate.ccpaPatterns.map((bp) => (
                                  <span
                                    key={bp}
                                    style={{
                                      fontSize: 8,
                                      fontWeight: 700,
                                      padding: "2px 7px",
                                      borderRadius: 99,
                                      background: "rgba(205,171,254,0.12)",
                                      color: "var(--pillar-dp)",
                                      border: "1px solid rgba(205,171,254,0.3)",
                                      // fontFamily: "Geist Mono, monospace",
                                    }}
                                  >
                                    {bp}
                                  </span>
                                ))}
                              </div> */}
                            </div>

                            {/* Effort asymmetry (expanded) */}
                            {/* {selectedTemplate.effortAsymmetry && (
                              <div
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  // background: "rgba(232,0,45,0.05)",
                                  border: "1px solid #7a7373",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: "var(--offshade-text)",
                                    marginBottom: 6,
                                    // fontFamily: "Geist Mono, monospace",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Effort Asymmetry — this journey measures:
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 0,
                                    alignItems: "center",
                                  }}
                                >
                                  <div
                                    style={{
                                      flex: 1,
                                      textAlign: "center",
                                      padding: "6px 8px",
                                      borderRadius: 6,
                                      // background: "rgba(0,186,140,0.1)",
                                      border: "1px solid #7a7373",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: "var(--offshade-text)",
                                        // fontFamily: "Geist Mono, monospace",
                                      }}
                                    >
                                      {
                                        selectedTemplate.effortAsymmetry
                                          .entrySteps
                                      }
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "var(--text-muted)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      clicks to{" "}
                                      {
                                        selectedTemplate.effortAsymmetry
                                          .entryLabel
                                      }
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      padding: "0 10px",
                                      fontSize: 16,
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    ⟷
                                  </div>
                                  <div
                                    style={{
                                      flex: 1,
                                      textAlign: "center",
                                      padding: "6px 8px",
                                      borderRadius: 6,
                                      // background: "rgba(232,0,45,0.08)",
                                      border: "1px solid #7a7373",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: "var(--offshade-text)",
                                        // fontFamily: "Geist Mono, monospace",
                                      }}
                                    >
                                      {
                                        selectedTemplate.effortAsymmetry
                                          .exitSteps
                                      }
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "var(--text-muted)",
                                        fontWeight: 600,
                                      }}
                                    >
                                      clicks to{" "}
                                      {
                                        selectedTemplate.effortAsymmetry
                                          .exitLabel
                                      }
                                    </div>
                                  </div>
                                </div>
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 9,
                                    color: "var(--offshade-text)",
                                    fontWeight: 600,
                                    textAlign: "center",
                                  }}
                                >
                                  {selectedTemplate.effortAsymmetry.exitSteps}×
                                  more friction to exit than to enter — Roach
                                  Motel signal
                                </div>
                              </div>
                            )} */}

                            {/* Pillar auto-enable nudge */}
                            {/* <div
                              style={{
                                padding: "7px 10px",
                                borderRadius: 8,
                                background: `${pillarColor}10`,
                                border: `1px solid ${pillarColor}30`,
                                fontSize: 10,
                                color: "var(--text-secondary)",
                                lineHeight: 1.5,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: "var(--offshade-text)",
                                }}
                              >
                                Auto-enabled:
                              </span>{" "}
                              Selecting this journey activates the{" "}
                              <strong>{selectedTemplate.primaryPillar}</strong>{" "}
                              pillar automatically.
                              {selectedTemplate.secondaryPillars.length > 0 && (
                                <span>
                                  {" "}
                                  Also recommended:{" "}
                                  <strong>
                                    {selectedTemplate.secondaryPillars.join(
                                      ", ",
                                    )}
                                  </strong>
                                  .
                                </span>
                              )}
                            </div> */}
                          </div>
                        </div>

                        {/* Editable steps section */}
                        <div
                          style={{
                            padding: "10px 14px",
                            borderTop: `1px solid ${pillarColor}20`,
                          }}
                        >
                          {/* Template URL warning */}
                          <div
                            style={{
                              marginBottom: 10,
                              padding: "8px 12px",
                              borderRadius: 8,
                              // background: "rgba(240,171,0,0.08)",
                              border: "1px solid #7a7373",
                              display: "flex",
                              gap: 8,
                              alignItems: "flex-start",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            ></span>
                            <div>
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "var(--kpmg-dynamic)",
                                  marginBottom: 2,
                                  // fontFamily: "Geist Mono, monospace",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                Template URLs — Update for your site
                              </div>
                              {/* <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                  lineHeight: 1.5,
                                }}
                              >
                                These paths are generic templates. Replace each
                                URL with the actual page URL from your site
                                (e.g.{" "}
                                <code
                                  style={{
                                    // fontFamily: "Geist Mono, monospace",
                                    background: "rgba(255,255,255,0.06)",
                                    padding: "1px 4px",
                                    borderRadius: 3,
                                  }}
                                >
                                  /term-life-insurance
                                </code>
                                ). The audit engine will attempt the nearest
                                match automatically.
                              </div> */}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--text-muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              marginBottom: 8,
                              // fontFamily: "Geist Mono, monospace",
                            }}
                          >
                            Customize URLs &amp; Action Instructions
                          </div>
                          <div className="journey-step-builder">
                            {journeySteps.map((step, i) => (
                              <div
                                key={step.id}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "28px 1fr 1fr auto",
                                  gap: 6,
                                  alignItems: "start",
                                  padding: "8px 10px",
                                  borderRadius: "var(--radius-md)",
                                  background: "var(--bg-secondary)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <span className="journey-step-num">
                                  {i + 1}
                                </span>
                                <input
                                  className="input-field"
                                  placeholder="Page label"
                                  value={step.label}
                                  onChange={(e) =>
                                    updateStep(step.id, "label", e.target.value)
                                  }
                                  style={{ fontSize: 12, padding: "7px 10px" }}
                                />
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                  }}
                                >
                                  <input
                                    className="input-field"
                                    placeholder="/relative-url or https://..."
                                    value={step.url}
                                    onChange={(e) =>
                                      updateStep(step.id, "url", e.target.value)
                                    }
                                    style={{
                                      fontSize: 12,
                                      padding: "7px 10px",
                                      // fontFamily: "Geist Mono, monospace",
                                    }}
                                  />
                                  <input
                                    className="input-field"
                                    placeholder='Action: e.g. "search for shoes" or "click add to cart"'
                                    value={step.action || ""}
                                    onChange={(e) =>
                                      updateStep(
                                        step.id,
                                        "action",
                                        e.target.value,
                                      )
                                    }
                                    style={{
                                      fontSize: 11,
                                      padding: "6px 10px",
                                      color: "var(--offshade-text)",
                                      // background: `${pillarColor}04`,
                                      borderColor: `var(--offshade-text)`,
                                    }}
                                  />
                                </div>
                                <button
                                  onClick={() =>
                                    setJourneySteps((steps) =>
                                      steps.filter((s) => s.id !== step.id),
                                    )
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    fontSize: 18,
                                    lineHeight: 1,
                                    padding: "6px 4px",
                                    marginTop: 2,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            id="add-journey-step-predefined"
                            onClick={() =>
                              setJourneySteps((s) => [
                                ...s,
                                {
                                  id: crypto.randomUUID(),
                                  label: "",
                                  url: "",
                                  action: "",
                                },
                              ])
                            }
                            style={{
                              fontSize: 12,
                              color: "var('offshade-text')",
                              background: "none",
                              border: `1px dashed ${pillarColor}50`,
                              borderRadius: "var(--radius-sm)",
                              padding: "6px 14px",
                              cursor: "pointer",
                              width: "100%",
                              marginTop: 8,
                            }}
                          >
                            + Add Step
                          </button>
                          <div
                            style={{
                              marginTop: 10,
                              padding: "8px 12px",
                              borderRadius: "var(--radius-sm)",
                              background: `${pillarColor}08`,
                              border: `1px solid ${pillarColor}20`,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {/* <span style={{ fontSize: 14 }}>📊</span> */}
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                              }}
                            >
                              <strong
                                style={{
                                  color: "var(--offshade-text)",
                                  fontFamily: "Geist Mono, monospace",
                                }}
                              >
                                {journeySteps.length}
                              </strong>{" "}
                              pages will be audited — one deep pass per stage.
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  marginLeft: 6,
                                }}
                              >
                                Modify URLs above to match the target
                                site&apos;s actual paths.
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* MODE 4 — Director Mode */}
            {scopeMode === "director" && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--offshade-text)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Step-by-Step Page Flow
                </div>
                <div style={{ marginBottom: 10 }}>
                  {journeySteps.map((step, i) => (
                    <div
                      key={step.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr 1fr auto",
                        gap: 8,
                        alignItems: "start",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--kpmg-dynamic)",
                          textAlign: "center",
                          marginTop: 10,
                          // fontFamily: "Geist Mono, monospace",
                        }}
                      >
                        {i + 1}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <input
                          className="input-field"
                          placeholder="Page label (e.g. Checkout)"
                          value={step.label}
                          onChange={(e) =>
                            updateStep(step.id, "label", e.target.value)
                          }
                          style={{ fontSize: 12 }}
                        />
                        <input
                          className="input-field"
                          placeholder='Action instruction (e.g. "buy shoes", "click add to cart")'
                          value={step.action || ""}
                          onChange={(e) =>
                            updateStep(step.id, "action", e.target.value)
                          }
                          style={{
                            fontSize: 11,
                            color: "var(offshade-text)",
                            // background: "rgba(254,113,65,0.04)",
                            borderColor: "#7a7373",
                          }}
                        />
                      </div>
                      <input
                        className="input-field"
                        placeholder="https://example.com/checkout"
                        value={step.url}
                        onChange={(e) =>
                          updateStep(step.id, "url", e.target.value)
                        }
                        style={{
                          fontSize: 12,
                          // fontFamily: "Geist Mono, monospace",
                        }}
                      />
                      <button
                        onClick={() =>
                          setJourneySteps((s) =>
                            s.filter((x) => x.id !== step.id),
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontSize: 18,
                          marginTop: 8,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    id="add-journey-step"
                    onClick={() =>
                      setJourneySteps((s) => [
                        ...s,
                        {
                          id: crypto.randomUUID(),
                          label: "",
                          url: "",
                          action: "",
                        },
                      ])
                    }
                    style={{
                      fontSize: 12,
                      color: "var(--offshade-text)",
                      background: "none",
                      border: "1px dashed rgba(254,113,65,0.4)",
                      borderRadius: "var(--radius-sm)",
                      padding: "6px 14px",
                      cursor: "pointer",
                      width: "100%",
                      marginTop: 4,
                    }}
                  >
                    + Add Step
                  </button>
                </div>
                <div className="input-group">
                  <label
                    className="input-label"
                    style={{ color: "var(--kpmg-dynamic)" }}
                  >
                    AI Audit Direction{" "}
                    <span
                      style={{
                        fontWeight: 400,
                        color: "var(--text-muted)",
                        fontSize: 10,
                      }}
                    >
                      — natural language instruction to the audit engine
                    </span>
                  </label>
                  <textarea
                    id="ai-direction"
                    className="input-field"
                    rows={3}
                    placeholder={
                      "Focus on hidden cost patterns between pricing and checkout. Flag any pre-ticked add-ons, detect urgency signals, and check if the free trial converts silently to paid."
                    }
                    value={aiDirection}
                    onChange={(e) => setAiDirection(e.target.value)}
                    style={{
                      resize: "vertical",
                      fontSize: 12,
                      fontStyle: aiDirection ? "normal" : "italic",
                    }}
                  />
                </div>
                {journeySteps.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      color: "var(--text-muted)",
                      // fontFamily: "Geist Mono, monospace",
                    }}
                  >
                    {journeySteps.length} pages will be audited (one per step)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Login Config */}
          <div style={{ marginBottom: 16 }}>
            <div
              className="collapsible-header"
              onClick={() => setShowLogin(!showLogin)}
            >
              <span>Login Configuration (authenticated portals)</span>
              <span
                style={{
                  transform: showLogin ? "rotate(180deg)" : "",
                  transition: "var(--transition)",
                  fontSize: 12,
                }}
              >
                ▼
              </span>
            </div>
            {showLogin && (
              <div className="collapsible-body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div className="input-group">
                    <label className="input-label">Login URL</label>
                    <input
                      className="input-field"
                      placeholder="https://example.com/login"
                      value={loginUrl}
                      onChange={(e) => setLoginUrl(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Submit Selector</label>
                    <input
                      className="input-field"
                      placeholder='button[type="submit"]'
                      value={submitSelector}
                      onChange={(e) => setSubmitSelector(e.target.value)}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div className="input-group">
                    <label className="input-label">Username</label>
                    <input
                      className="input-field"
                      placeholder="user@example.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Password</label>
                    <input
                      className="input-field"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div className="input-group">
                    <label className="input-label">Username Selector</label>
                    <input
                      className="input-field"
                      placeholder="#username"
                      value={usernameSelector}
                      onChange={(e) => setUsernameSelector(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Password Selector</label>
                    <input
                      className="input-field"
                      placeholder="#password"
                      value={passwordSelector}
                      onChange={(e) => setPasswordSelector(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            id="start-audit-btn"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            onClick={startWebsiteAudit}
            disabled={loading}
          >
            {loading ? (
              <>
                <div
                  className="spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />{" "}
                Running Audit...
              </>
            ) : (
              `Start TrustLens Audit`
              // (${getEnabledPillars().length} pillars${effectiveMaxPages > 0 ? ` · ${effectiveMaxPages} pages` : ""})`
            )}
          </button>
        </div>
      )}

      {/* ── PDF TAB ── */}
      {tab === "pdf" && (
        <div className="glass-card animate-fade-in">
          <div
            className={`upload-area ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) setPdfFile(e.target.files[0]);
              }}
            />
            <div style={{ fontSize: 44, marginBottom: 14 }}>📄</div>
            {pdfFile ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {pdfFile.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    // fontFamily: "Geist Mono, monospace",
                  }}
                >
                  {(pdfFile.size / 1024).toFixed(1)} KB · PDF Document
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  Drop PDF here or click to browse
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Supports .pdf files up to 50MB · WCAG PDF/UA checks
                </div>
              </div>
            )}
          </div>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: 18 }}
            onClick={startPdfAudit}
            disabled={loading || !pdfFile}
          >
            {loading ? (
              <>
                <div
                  className="spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />{" "}
                Analyzing PDF...
              </>
            ) : (
              "Analyze PDF Accessibility"
            )}
          </button>
        </div>
      )}

      {/* ── IMAGE TAB ── */}
      {tab === "image" && (
        <div className="glass-card animate-fade-in">
          <div
            style={{
              padding: "10px 0 16px",
              borderBottom: "1px solid var(--border)",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              {/* <span style={{ fontSize: 18 }}>📸</span> */}
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Screenshot / Image Audit
              </span>
              {/* <span className="dp-ai-vision-badge">GPT-4o Vision</span> */}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Upload a screenshot or UI image. GPT-4o will analyse it across
              your selected pillars. ~70% confidence — complements DOM auditing.
            </p>
          </div>
          <div
            className="upload-area"
            onClick={() => imageRef.current?.click()}
            style={{
              borderColor: imageFile ? "var(--accent-primary)" : undefined,
              background: imageFile ? "rgba(254,113,65,0.04)" : undefined,
            }}
          >
            <input
              ref={imageRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setImageFile(e.target.files[0]);
                  setError("");
                }
              }}
            />
            <div style={{ fontSize: 44, marginBottom: 14 }}>📸</div>
            {imageFile ? (
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--accent-primary)",
                    marginBottom: 4,
                  }}
                >
                  {imageFile.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    // fontFamily: "Geist Mono, monospace",
                  }}
                >
                  {(imageFile.size / 1024).toFixed(1)} KB · {imageFile.type}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  Click to upload screenshot or UI image
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Supports JPEG, PNG, WebP, GIF · Max 20MB
                </div>
              </div>
            )}
          </div>
          {/* <div
            style={{
              margin: "14px 0",
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(205,171,254,0.06)",
              border: "1px solid rgba(205,171,254,0.2)",
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "var(--accent-purple)",
                marginBottom: 4,
              }}
            >
              What Vision AI checks per pillar:
            </div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <span style={{ color: "var(--pillar-a11y)", fontWeight: 600 }}>
                ♿ A11Y:
              </span>{" "}
              Contrast, focus indicators, label visibility, text size, heading
              hierarchy
              <br />
              <span style={{ color: "var(--pillar-dp)", fontWeight: 600 }}>
                🕵️ Dark Patterns:
              </span>{" "}
              Consent asymmetry, urgency cues, confirmshaming, disguised CTAs,
              visual manipulation
              <br />
              <span style={{ color: "var(--pillar-perf)", fontWeight: 600 }}>
                ⚡ Performance:
              </span>{" "}
              Loading states, layout shifts, image density, font rendering
              <br />
              <span style={{ color: "var(--pillar-priv)", fontWeight: 600 }}>
                🔒 Privacy:
              </span>{" "}
              Consent banner quality, reject option, privacy policy link
              visibility
            </div>
          </div> */}
          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            onClick={startImageAudit}
            disabled={loading || !imageFile}
          >
            {loading ? (
              <>
                <div
                  className="spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />{" "}
                Analysing with GPT-4o...
              </>
            ) : (
              "Analyse Image "
              // (${getEnabledPillars().length} pillar${getEnabledPillars().length !== 1 ? "s" : ""})`
            )}
          </button>
        </div>
      )}

      {/* ── VIDEO TAB ── */}
      {tab === "video" && (
        <div className="glass-card animate-fade-in">
          <div
            style={{
              padding: "10px 0 16px",
              borderBottom: "1px solid var(--border)",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              {/* <span style={{ fontSize: 18 }}>🎥</span> */}
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Video Recording Audit
              </span>
              {/* <span
                style={{
                  fontSize: 9,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "rgba(254,113,65,0.12)",
                  color: "var(--accent-primary)",
                  border: "1px solid rgba(254,113,65,0.3)",
                  fontWeight: 700,
                   fontFamily: "Geist Mono, monospace",
                }}
              >
                Frame Sampling
              </span> */}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Upload a screen recording. 8 frames are extracted in your browser
              via Canvas API, then analysed by GPT-4o.
            </p>
          </div>
          <div
            className="upload-area"
            onClick={() => videoRef.current?.click()}
            style={{
              borderColor: videoFile ? "var(--accent-primary)" : undefined,
              background: videoFile ? "rgba(254,113,65,0.04)" : undefined,
            }}
          >
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/webm,video/mov,video/quicktime"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setVideoFile(e.target.files[0]);
                  setError("");
                }
              }}
            />
            <div style={{ fontSize: 44, marginBottom: 14 }}>🎥</div>
            {videoFile ? (
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--accent-primary)",
                    marginBottom: 4,
                  }}
                >
                  {videoFile.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    // fontFamily: "Geist Mono, monospace",
                  }}
                >
                  {(videoFile.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                  {videoFile.type || "video"}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  Click to upload screen recording
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Supports MP4, WebM, MOV · Max 500MB
                </div>
              </div>
            )}
          </div>
          {/* <div
            style={{
              margin: "14px 0",
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(254,113,65,0.05)",
              border: "1px solid rgba(254,113,65,0.2)",
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "var(--accent-primary)",
                marginBottom: 6,
              }}
            >
              🎬 How video analysis works:
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              <div>✦ 8 frames extracted evenly from video duration</div>
              <div>✦ Frame extraction happens in your browser (Canvas API)</div>
              <div>✦ Each frame analysed by GPT-4o per selected pillar</div>
              <div>✦ Duplicate findings automatically deduplicated</div>
              <div>✦ Results same as a standard audit report</div>
              <div>✦ No video data stored — frames only</div>
            </div>
          </div> */}
          {videoProcessing && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(254,113,65,0.08)",
                border: "1px solid rgba(254,113,65,0.3)",
                fontSize: 12,
                color: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                className="spinner"
                style={{ width: 14, height: 14, borderWidth: 2 }}
              />
              Extracting frames from video in browser... this may take a moment.
            </div>
          )}
          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            onClick={startVideoAudit}
            disabled={loading || !videoFile}
          >
            {loading ? (
              <>
                <div
                  className="spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />{" "}
                {videoProcessing ? "Extracting frames..." : "Analysing..."}
              </>
            ) : (
              "Analyse Video"
              // (${getEnabledPillars().length} pillar${getEnabledPillars().length !== 1 ? "s" : ""})`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
