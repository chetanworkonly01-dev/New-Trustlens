export interface PillarMeta {
  icon: string;
  label: string;
  color: string;
  desc: string;
  regs: string[];
  detail: string;
}

export const PILLAR_META: Record<string, PillarMeta> = {
  accessibility: {
    icon: "/icons/accessibility.svg",
    label: "Accessibility",
    color: "var(--kpmg-dynamic)",
    desc: "Automated + AI visual + journey testing against WCAG 2.2, EN 301 549 and Section 508.",
    detail:
      "Detects contrast failures, missing ARIA labels, keyboard traps, focus order issues, and PDF/UA compliance across every crawled page.",
    regs: ["WCAG 2.2", "EN 301 549", "Section 508", "WCAG 2.1"],
  },
  darkpatterns: {
    icon: "/icons/dark-patterns.svg",
    label: "Dark Patterns",
    color: "var(--kpmg-dynamic)",
    desc: "CCPA 15-pattern taxonomy, EU DSA Art. 25, FTC §5 — cognitive bias exploitation detection.",
    detail:
      "Identifies confirmshaming, hidden costs, roach motels, trick questions and manipulative subscription flows using GPT-4o visual analysis.",
    regs: ["EU DSA Art.25", "FTC §5", "DPDPA"],
  },
  performance: {
    icon: "/icons/performance.svg",
    label: "Performance",
    color: "var(--kpmg-dynamic)",
    desc: "Core Web Vitals (LCP / INP / CLS), RAIL model, Lighthouse scoring across desktop and mobile 4G.",
    detail:
      "Measures LCP, CLS, FCP, TTFB, TBT and INP per page. Detects render-blocking resources, DOM bloat, excessive requests and third-party script impact.",
    regs: ["Core Web Vitals", "RAIL Model", "Lighthouse", "HTTP/2"],
  },
  // privacy: {
  //   icon: "/icons/privacy.svg",
  //   label: "Privacy",
  //   color: "#003087",
  //   desc: " 5–37, CCPA/CPRA, DPDPA 2023, ePrivacy and ICO enforcement pattern detection.",
  //   detail:
  //     "Scans for tracking scripts, third-party data leakage, consent banner integrity, cookie classification, and data retention policy gaps.",
  //   regs: ["CCPA/CPRA", "DPDPA 2023", "ePrivacy"],
  // },
};

export const TRUST_COLORS: Record<string, string> = {
  trusted: "#00BA8C",
  moderate: "#F0AB00",
  "at-risk": "#FF8533",
  critical: "#FF3356",
};
export const TRUST_LABELS: Record<string, string> = {
  trusted: "Trusted",
  moderate: "Moderate Risk",
  "at-risk": "At Risk",
  critical: "Critical Risk",
};
export const COMPLIANCE_COLORS: Record<string, string> = {
  "non-compliant": "#FF3356",
  "partially-compliant": "#F0AB00",
  "aa-compliant": "#0091DA",
  "aaa-compliant": "#00B2A9",
};
export const COMPLIANCE_LABELS: Record<string, string> = {
  "non-compliant": "Non-Compliant",
  "partially-compliant": "Partially Compliant",
  "aa-compliant": "AA Compliant",
  "aaa-compliant": "AAA Compliant",
};

export function getPerfGrade(s: number) {
  if (s >= 90) return { label: "A", sub: "Excellent", color: "#00BA8C" };
  if (s >= 75) return { label: "B", sub: "Good", color: "#00B2A9" };
  if (s >= 50) return { label: "C", sub: "Needs Work", color: "#F0AB00" };
  if (s >= 25) return { label: "D", sub: "Poor", color: "#FF3356" };
  return { label: "F", sub: "Critical", color: "#FF3356" };
}

export function getAuditTitle(pillars: string[]): string {
  if (!pillars || pillars.length === 0) return "Accessibility Audit";
  if (pillars.length === 4) return "TrustLens 3-Pillar Audit";
  if (pillars.length === 1) {
    return (
      (
        {
          accessibility: "Accessibility Audit",
          darkpatterns: "Dark Pattern Audit",
          performance: "Performance Audit",
          // privacy: "Privacy Audit",
        } as Record<string, string>
      )[pillars[0]] || "Digital Audit"
    );
  }
  return "Multi-Pillar Audit";
}
