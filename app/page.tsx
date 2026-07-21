"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface PillarScore {
  score: number;
  total: number;
}

interface Audit {
  id: string;
  status: string;
  config: {
    url?: string;
    type: string;
    wcagLevels?: string[];
    standard?: string;
    enabledPillars?: string[];
  };
  score: {
    overall: number;
    complianceLevel: string;
    totalIssues: number;
    testsRun?: number;
  };
  displayScore?: number;
  totalIssues?: number;
  pillarScores?: Record<string, number>;
  trustScore?: { overall: number; trustLevel: string };
  progress: number;
  startedAt: string;
  completedAt?: string;
  crawlCoverage?: {
    totalPagesFound: number;
    pagesAudited: number;
    coveragePercent: number;
  };
}

const PILLAR_META: Record<
  string,
  {
    icon: string;
    label: string;
    color: string;
    desc: string;
    regs: string[];
    detail: string;
  }
> = {
  accessibility: {
    icon: "♿",
    label: "Accessibility",
    color: "var(--kpmg-dynamic)",
    desc: "Automated + AI visual + journey testing against WCAG 2.2, EN 301 549 and Section 508.",
    detail:
      "Detects contrast failures, missing ARIA labels, keyboard traps, focus order issues, and PDF/UA compliance across every crawled page.",
    regs: ["WCAG 2.2", "EN 301 549", "Section 508", "WCAG 2.1"],
  },
  darkpatterns: {
    icon: "🕵️",
    label: "Dark Patterns",
    color: "var(--kpmg-dynamic)",
    desc: "CCPA 15-pattern taxonomy, EU DSA Art. 25, FTC §5 — cognitive bias exploitation detection.",
    detail:
      "Identifies confirmshaming, hidden costs, roach motels, trick questions and manipulative subscription flows using GPT-4o visual analysis.",
    regs: ["EU DSA Art.25", "FTC §5", "DPDPA"],
  },
  performance: {
    icon: "⚡",
    label: "Performance",
    color: "var(--kpmg-dynamic)",
    desc: "Core Web Vitals (LCP / INP / CLS), RAIL model, Lighthouse scoring across desktop and mobile 4G.",
    detail:
      "Measures LCP, CLS, FCP, TTFB, TBT and INP per page. Detects render-blocking resources, DOM bloat, excessive requests and third-party script impact.",
    regs: ["Core Web Vitals", "RAIL Model", "Lighthouse", "HTTP/2"],
  },
  // privacy: {
  //   icon: "🔒",
  //   label: "Privacy",
  //   color: "#003087",
  //   desc: " 5–37, CCPA/CPRA, DPDPA 2023, ePrivacy and ICO enforcement pattern detection.",
  //   detail:
  //     "Scans for tracking scripts, third-party data leakage, consent banner integrity, cookie classification, and data retention policy gaps.",
  //   regs: ["CCPA/CPRA", "DPDPA 2023", "ePrivacy"],
  // },
};

const TRUST_COLORS: Record<string, string> = {
  trusted: "#00BA8C",
  moderate: "#F0AB00",
  "at-risk": "#FF8533",
  critical: "#FF3356",
};
const TRUST_LABELS: Record<string, string> = {
  trusted: "Trusted",
  moderate: "Moderate Risk",
  "at-risk": "At Risk",
  critical: "Critical Risk",
};
const COMPLIANCE_COLORS: Record<string, string> = {
  "non-compliant": "#FF3356",
  "partially-compliant": "#F0AB00",
  "aa-compliant": "#0091DA",
  "aaa-compliant": "#00B2A9",
};
const COMPLIANCE_LABELS: Record<string, string> = {
  "non-compliant": "Non-Compliant",
  "partially-compliant": "Partially Compliant",
  "aa-compliant": "AA Compliant",
  "aaa-compliant": "AAA Compliant",
};

function getPerfGrade(s: number) {
  if (s >= 90) return { label: "A", sub: "Excellent", color: "#00BA8C" };
  if (s >= 75) return { label: "B", sub: "Good", color: "#00B2A9" };
  if (s >= 50) return { label: "C", sub: "Needs Work", color: "#F0AB00" };
  if (s >= 25) return { label: "D", sub: "Poor", color: "#FF8533" };
  return { label: "F", sub: "Critical", color: "#FF3356" };
}

function getAuditTitle(pillars: string[]): string {
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

export default function HomePage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  // --- Typewriter Effect State ---
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const keywords = [
    "TrustLens",
    "Accessibility",
    "Compliance",
    "Performance",
    "Dark Pattern",
  ];
  const typingSpeed = 90;
  const deletingSpeed = 30;
  const pauseDuration = 2000;

  useEffect(() => {
    const handleTyping = () => {
      const currentWord = keywords[wordIndex];
      const updatedText = isDeleting
        ? currentWord.substring(0, text.length - 1)
        : currentWord.substring(0, text.length + 1);

      setText(updatedText);

      if (!isDeleting && updatedText === currentWord) {
        // Pause after typing a word
        setTimeout(() => setIsDeleting(true), pauseDuration);
      } else if (isDeleting && updatedText === "") {
        setIsDeleting(false);
        setWordIndex((prevIndex) => (prevIndex + 1) % keywords.length);
      }
    };

    const typingTimeout = setTimeout(
      handleTyping,
      isDeleting ? deletingSpeed : typingSpeed,
    );
    return () => clearTimeout(typingTimeout);
  }, [text, isDeleting, wordIndex, keywords]);
  // --- End Typewriter Effect ---

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const res = await fetch("/api/audit/list");
        if (res.ok) setAudits(await res.json());
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    fetchAudits();
  }, []);

  const running = audits.filter(
    (a) => a.status !== "complete" && a.status !== "error",
  );
  const completed = audits
    .filter((a) => a.status === "complete")
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

  // Pillar-aware aggregate stats
  const avgScore = completed.length
    ? Math.round(
        completed.reduce((s, a) => s + (a.displayScore ?? a.score.overall), 0) /
          completed.length,
      )
    : 0;
  const totalIssues = completed.reduce(
    (s, a) => s + (a.totalIssues ?? a.score.totalIssues),
    0,
  );
  const testsRun = completed.reduce((s, a) => s + (a.score.testsRun || 0), 0);
  const pillarsRun = [
    ...new Set(
      completed.flatMap((a) => a.config.enabledPillars || ["accessibility"]),
    ),
  ];

  return (
    <div>
      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <div className="hero">
        {/* <div style={{ marginBottom: 18 }}>
          <span className="kpmg-ai-badge" style={{ fontSize: 12 }}>
            <span className="kpmg-ai-dot" />
            KPMG AI — GPT-4o Vision · Playwright · axe-core · Lighthouse
          </span>
        </div> */}

        <h1 className="hero-title">
          <br />
          KPMG{" "}
          <span className="typewriter-text">
            {text}
            <span className="typewriter-cursor" />
          </span>
          <br />
          Enterprise Audit Platform
        </h1>

        <p
          className="hero-subtitle"
          style={{ maxWidth: 660, margin: "0 auto 12px" }}
        >
          A single platform that audits applications for accessibility, detects
          dark patterns, measures performance, and enforces design governance
          all in one automated workflow
        </p>
        <p
          style={{
            textAlign: "center",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: 36,
          }}
        ></p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 48,
          }}
        >
          <Link href="/audit" className="btn btn-primary btn-lg">
            Start New Audit
          </Link>
          <a href="#audits" className="btn btn-secondary btn-lg">
            View Audit History
          </a>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 40,
            flexWrap: "wrap",
          }}
        >
          {/* {[
            {
              val: "4 Pillars",
              label: "Audit Domains",
              color: "var(--kpmg-dynamic)",
            },
            {
              val: "7 Layers",
              label: "Per-Engine Depth",
              color: "var(--kpmg-dynamic)",
            },
            {
              val: "GPT-4o",
              label: "Vision AI Engine",
              color: "var(--kpmg-dynamic)",
            },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: s.color,
                  marginBottom: 3,
                }}
              >
                {s.val}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--offshade-text)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 600,
                }}
              >
                {s.label}
              </div>
            </div>
          ))} */}
        </div>
      </div>

      <div className="container">
        {/* ══ WHY TRUSTLENS — PROBLEM / IMPACT ═══════════════════════════ */}
        <div style={{ marginBottom: 56 }}>
          {/* Section header */}
          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "var(--offshade-text)",
                textTransform: "uppercase",
                display: "block",
                marginBottom: 10,
              }}
            >
              Why TrustLens
            </span>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
              Real Problems. Measurable Impact.
            </h2>
            <p
              style={{
                fontSize: 17,
                color: "var(--offshade-text)",
                maxWidth: 620,
                margin: "0 auto",
                lineHeight: 1.7,
              }}
            >
              Most digital products carry four invisible risks — exclusion,
              manipulation, slowness and data exposure. None of them show up in
              your analytics. All of them are costing you users, revenue and
              regulatory standing right now.
            </p>
          </div>

          {/* Opening framing bar */}
          <div
            className="glass-card"
            style={{
              padding: "20px 28px",
              marginBottom: 20,
              background: "var(--bg-darkcard)",
              // border: "1px solid rgba(0,145,218,0.18)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20,
            }}
          >
            {[
              {
                label: "The average enterprise website",
                stat: "fails 47 WCAG criteria",
                color: "var(--kpmg-dynamic)",
              },
              {
                label: "Users who encounter dark patterns",
                stat: "are 2x more likely to churn",
                color: "var(--kpmg-dynamic)",
              },
              {
                label: "A 1-second improvement in load time",
                stat: "can lift conversions by 27%",
                color: "var(--kpmg-dynamic)",
              },
              {
                label: "Sites scanned by regulators in 2024",
                stat: "83% had undisclosed trackers",
                color: "var(--kpmg-dynamic)",
              },
            ].map((f) => (
              <div
                key={f.label}
                style={{ borderLeft: `3px solid ${f.color}`, paddingLeft: 8 }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--offshade-text)",
                    marginBottom: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: f.color,
                    lineHeight: 1.4,
                  }}
                >
                  {f.stat}
                </div>
              </div>
            ))}
          </div>

          {/* Pillar problem cards */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            {[
              {
                // icon: "♿",
                color: "var(--kpmg-dynamic)",
                pillar: "Accessibility",
                // headline: "1 in 6 users cannot use your product today.",
                // problem:
                //   "Keyboard traps, missing alt text, low contrast ratios and inaccessible form fields are not edge cases — they are systematic failures that exist on virtually every enterprise digital product. Users with visual, motor, or cognitive disabilities either abandon immediately or find workarounds that your team never sees in session recordings.",

                whatWeFind: [
                  "Automatically finds common WCAG accessibility issues across your website",
                  "Uses AI-powered visual analysis to spot contrast, readability, and layout problems that scanners often miss",
                  "Tests key user journeys to uncover keyboard navigation and usability barriers",
                  "Reviews PDFs separately to identify accessibility and PDF/UA compliance gaps",
                ],
                // impact: [
                //   {
                //     stat: "€1M+",
                //     label: "maximum fine under EN 301 549 (EU) and EAA 2025",
                //   },
                //   {
                //     stat: "16%",
                //     label: "of your total user base currently excluded",
                //   },
                //   {
                //     stat: "30%",
                //     label: "reduction in support calls after remediation",
                //   },
                //   {
                //     stat: "£17B",
                //     label: "annual UK purple pound — the accessible economy",
                //   },
                // ],
              },
              {
                // icon: "🕵️",
                color: "var(--kpmg-dynamic)",
                pillar: "Dark Patterns",
                // headline:
                //   "Your UX is manipulating users — and breaking EU law.",
                // problem:
                //   "Dark patterns are not always intentional. A pre-ticked newsletter opt-in added by a junior developer, a cancellation flow buried three menus deep, or a countdown timer that resets — each one is a EU DSA Art. 25 violation. The DSA came into force in February 2024. Regulators are actively scanning. Fines have already been issued to major platforms.",

                whatWeFind: [
                  "Scans every page for dark pattern signals and potentially misleading design practices",
                  "Compares sign-up and cancellation flows to measure user friction",
                  "Flags manipulative or confusing language that may influence user decisions",
                  "Detects hidden fees, unexpected charges, and pricing transparency issues",
                ],
                // impact: [
                //   {
                //     stat: "4%",
                //     label: "of global annual revenue — DSA maximum fine",
                //   },
                //   {
                //     stat: "2×",
                //     label:
                //       "higher churn on products where dark patterns are found",
                //   },
                //   {
                //     stat: "68%",
                //     label: "of users permanently distrust brands that use them",
                //   },
                //   {
                //     stat: "1 in 5",
                //     label:
                //       "enterprise sites has a reportable DSA violation right now",
                //   },
                // ],
              },
              {
                // icon: "⚡",
                color: "var(--kpmg-dynamic)",
                pillar: "Performance",
                // headline: "Every slow page is a revenue leak you can quantify.",
                // problem:
                //   "Core Web Vitals became a confirmed Google ranking signal in 2021. Since then, sites with poor LCP and CLS scores have seen measurable drops in organic search position. Beyond SEO, the direct conversion impact is stark — a 3-second load time loses 40% of users before the first pixel of content is visible. Most enterprise sites we audit have never measured CWV per page.",

                whatWeFind: [
                  "Measures Core Web Vitals and page speed across the entire website",
                  "Identifies render-blocking code, large assets, and optimization opportunities",
                  "Shows which third-party scripts and tools are impacting performance",
                  "Simulates real-world mobile network conditions to reflect actual user experience",
                ],
                // impact: [
                //   {
                //     stat: "7%",
                //     label:
                //       "conversion lost per additional 100ms of load time (Akamai)",
                //   },
                //   {
                //     stat: "Top 3",
                //     label:
                //       "Google ranking factor — CWV score directly affects SEO",
                //   },
                //   {
                //     stat: "27%",
                //     label:
                //       "conversion lift from a 1-second improvement (Cloudflare)",
                //   },
                //   {
                //     stat: "40%",
                //     label: "of users abandon if page takes more than 3 seconds",
                //   },
                // ],
              },
              {
                icon: "🔒",
                color: "var(--kpmg-dynamic)",
                pillar: "Design GOVERNANCE",
                headline: "You have trackers and data flows you cannot see.",
                // pillar: "Compliance",
                // headline: "You have trackers and data flows you cannot see. (Coming Soon)",
                // problem:
                //   "Third-party scripts added by marketing, analytics or A/B testing tools often collect and transmit user data without appearing in your or being covered by your consent banner. Under Art. 5 and CCPA, you are liable for every data flow from your domain — even ones you did not authorise. ICO and CNIL have fined organisations for exactly this gap.",

                whatWeFind: [
                  "Establishes design review checkpoints for compliance validation",
                  "Ensures trackers and consent flows meet governance standards",
                  "Aligns cookie classification with organizational policies",
                  "Flags non‑compliant design elements before approval",
                ],
                // impact: [
                //   {
                //     stat: "4%",
                //     label: "of global turnover — GDPR Art. 83 maximum penalty",
                //   },
                //   {
                //     stat: "83%",
                //     label:
                //       "of enterprise sites transmit data to undisclosed third parties",
                //   },
                //   {
                //     stat: "€1.2B",
                //     label: "in fines issued in 2023 alone (DLA Piper)",
                //   },
                //   {
                //     stat: "79%",
                //     label: "of users say data control determines brand loyalty",
                //   },
                // ],
              },
            ].map((card) => (
              <div
                key={card.pillar}
                className="glass-card"
                style={{
                  borderTop: `4px solid ${card.color}`,
                  padding: "26px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                {/* Pillar label */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {/* <span style={{ fontSize: 24 }}>{card.icon}</span> */}
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: card.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.10em",
                    }}
                  >
                    {card.pillar}
                  </span>
                  <span
                    style={{
                      letterSpacing: "0",
                      color: "var(--text-muted)",
                    }}
                  >
                    {card.pillar === "Design GOVERNANCE" ? "(Coming Soon)" : ""}
                  </span>
                </div>

                {/* Headline */}
                {/* <p
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.4,
                    marginBottom: 10,
                  }}
                >
                  {card.headline}
                </p> */}

                {/* Problem narrative */}
                {/* <p
                  style={{
                    fontSize: 14,
                    color: "var(--offshade-text)",
                    lineHeight: 1.75,
                    marginBottom: 18,
                  }}
                >
                  {card.problem}
                </p> */}

                {/* What TrustLens finds */}
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: card.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.09em",
                      marginBottom: 10,
                    }}
                  >
                    What TrustLens detects
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 7 }}
                  >
                    {card.whatWeFind.map((f) => (
                      <div
                        key={f}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            color: card.color,
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          ›
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: "var(--offshade-text)",
                            lineHeight: 1.55,
                          }}
                        >
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Impact stats */}
                {/* <div
                  style={{
                    marginTop: "auto",
                    padding: "16px",
                    // borderRadius: 8,
                    background: `${card.color}08`,
                    border: `1px solid ${card.color}20`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: card.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.09em",
                      marginBottom: 12,
                    }}
                  >
                    Solving it moves
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    {card.impact.map((i) => (
                      <div
                        key={i.label}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: card.color,
                            lineHeight: 1,
                          }}
                        >
                          {i.stat}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--offshade-text)",
                            lineHeight: 1.45,
                          }}
                        >
                          {i.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div> */}
              </div>
            ))}
          </div>

          {/* Closing CTA bar */}
          {/* <div
            className="glass-card"
            style={{
              marginTop: 20,
              padding: "24px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
              // background:
              //   "linear-gradient(135deg, rgba(0,51,141,0.12) 0%, rgba(0,178,169,0.08) 100%)",
              background: "var(--bg-darkcard)",
              // border: "1px solid #7a7373",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                Every one of these risks is measurable in under 30 minutes.
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--offshade-text)",
                  lineHeight: 1.65,
                  maxWidth: 560,
                }}
              >
                TrustLens runs all Three pillars in a single automated pass — no
                manual effort, no spreadsheets, no consultant waiting time. You
                get a scored, evidence-backed report with a prioritised
                remediation roadmap, team assignment matrix and executive
                summary ready for the boardroom.
              </div>
            </div>
            <Link
              href="/audit"
              className="btn btn-primary btn-lg"
              style={{ flexShrink: 0 }}
            >
              Run a Free Audit Now
            </Link>
          </div> */}
        </div>

        {/* ══ 3-PILLAR CARDS ══════════════════════════════════════════════ */}
        {/* <div style={{ marginBottom: 52 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
              Three Pillars of TrustLens
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--offshade-text)",
                maxWidth: 540,
                margin: "0 auto",
                paddingBottom: "25px",
              }}
            >
              Each pillar runs independently or as a combined audit — scored and
              weighted into a single unified TrustLens Score
            </p>
          </div>
          <div className="grid-3 animate-slide-up stagger-1">
            {Object.entries(PILLAR_META).map(([key, p]) => (
              <div
                key={key}
                className="glass-card"
                style={{
                  borderTop: `3px solid ${p.color}`,
                  padding: "22px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                <div style={{ fontSize: 34, marginBottom: 10 }}>{p.icon}</div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: 18,
                    marginBottom: 6,
                    color: p.color,
                  }}
                >
                  {p.label}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var( --offshade-text)",
                    lineHeight: 1.65,
                    marginBottom: 8,
                  }}
                >
                  {p.desc}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "var( --offshade-text)",
                    lineHeight: 1.6,
                    marginBottom: 14,
                  }}
                >
                  {p.detail}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    marginTop: "auto",
                  }}
                >
                  {p.regs.map((r) => (
                    <span
                      key={r}
                      style={{
                        fontSize: 12,
                        padding: "2px 6px",
                        borderRadius: 99,
                        background: `${p.color}18`,
                        color: p.color,
                        border: `1px solid ${p.color}35`,
                        fontWeight: 700,
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            {[
              {
                icon: "⚖️",
                label: "Compliance Intelligence",
                color: "#06B6D4",
                desc: "Map findings automatically against CCPA, RBI principles, SEBI investor protection, DPDP consent requirements, and enterprise governance standards.",
                regs: ["CCPA", "RBI", "SEBI", "DPDPA", "Governance"],
              },
              {
                icon: "🎨",
                label: "Design Governance",
                color: "#EC4899",
                desc: "Audit design token consistency, CTA hierarchy, component library compliance, accessibility violations at design system level, and non-approved UI patterns.",
                regs: ["Design Tokens", "CTA Audit", "UI Patterns", "Brand"],
              },
            ].map((p) => (
              <div
                key={p.label}
                className="glass-card"
                style={{
                  borderTop: `3px solid ${p.color}`,
                  padding: "20px 18px",
                  opacity: 0.75,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 12,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: `${p.color}20`,
                    color: p.color,
                    border: `1px solid ${p.color}40`,
                    letterSpacing: "0.05em",
                  }}
                >
                  COMING SOON
                </div>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{p.icon}</div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 6,
                    color: p.color,
                  }}
                >
                  {p.label}
                </h3>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    lineHeight: 1.65,
                    marginBottom: 12,
                  }}
                >
                  {p.desc}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {p.regs.map((r) => (
                    <span
                      key={r}
                      style={{
                        fontSize: 8,
                        padding: "2px 6px",
                        borderRadius: 99,
                        background: `${p.color}18`,
                        color: p.color,
                        border: `1px solid ${p.color}35`,
                        fontWeight: 700,
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div> */}

        {/* ══ HOW IT WORKS ════════════════════════════════════════════════ */}
        {/* <div
          className="glass-card animate-slide-up stagger-2"
          style={{ marginBottom: 44, padding: "28px 32px" }}
        > */}
        {/* <h2
            style={{
              fontSize: 26,
              fontWeight: 700,
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            How TrustLens Works
          </h2> */}
        {/* <p
            style={{
              fontSize: 14,
              color: "var( --offshade-text)",
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            From URL to enterprise-grade report in minutes
          </p> */}
        {/* <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 28,
            }}
          >
            {[
              {
                step: "01",
                icon: "⚙️",
                title: "Configure Your Audit",
                desc: "Enter your URL, PDF, screenshot or video. Select one or more audit pillars — Accessibility, Dark Patterns, Performance, Privacy. Set crawl depth, WCAG level and network conditions.",
              },
              {
                step: "02",
                icon: "🔬",
                title: "AI Multi-Engine Analysis",
                desc: "7-layer engines run simultaneously: DOM crawl (Playwright + axe-core), GPT-4o visual inspection, Core Web Vitals measurement, behavioural journey testing, NLP content analysis, and regulatory mapping.",
              },
              {
                step: "03",
                icon: "📋",
                title: "Pillar-Aware Reports",
                desc: "Download PDF, DOCX or PPTX reports tailored to the pillars you ran. Includes issue register, per-pillar scores, remediation roadmap, team assignment matrix, and executive summary.",
              },
            ].map((s) => (
              <div key={s.step} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--accent-blue)",
                    letterSpacing: "0.1em",
                    marginBottom: 8,
                  }}
                >
                  STEP {s.step}
                </div>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    lineHeight: 1.7,
                  }}
                >
                  {s.desc}
                </div>
              </div>
            ))}
          </div> */}
        {/* <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr auto 1fr",
              alignItems: "start",
              gap: 20,
            }}
          >
            {[
              {
                step: "01",
                icon: "⚙️",
                title: "Configure Your Audit",
                desc: "Enter your URL, PDF, screenshot or video. Select one or more audit pillars — Accessibility, Dark Patterns, Performance. Set crawl depth, WCAG level and network conditions.",
              },
              {
                step: "02",
                icon: "🔬",
                title: "AI Multi-Engine Analysis",
                desc: "7-layer engines run simultaneously: DOM crawl (Playwright + axe-core), GPT-4o visual inspection, Core Web Vitals measurement, behavioural journey testing, NLP content analysis, and regulatory mapping.",
              },
              {
                step: "03",
                icon: "📋",
                title: "Pillar-Aware Reports",
                desc: "Download PDF, DOCX or PPTX reports tailored to the pillars you ran. Includes issue register, per-pillar scores, remediation roadmap, team assignment matrix, and executive summary.",
              },
            ].map((s, index, array) => (
              <>
                <div key={s.step} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--kpmg-dynamic)",
                      letterSpacing: "0.1em",
                      marginBottom: 8,
                    }}
                  >
                    STEP {s.step}
                  </div>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
                  <div
                    style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var( --offshade-text)",
                      lineHeight: 1.7,
                    }}
                  >
                    {s.desc}
                  </div>
                </div>
                {index < array.length - 1 && (
                  <div
                    style={{
                      fontSize: 24,
                      color: "var( --offshade-text)",
                      // marginTop: 60,
                      userSelect: "none",
                    }}
                  >
                    →
                  </div>
                )}
              </>
            ))}
          </div> */}
        {/* </div> */}

        {/* ══ AI CAPABILITIES ═════════════════════════════════════════════ */}
        {/* <div
          className="glass-card animate-slide-up stagger-3"
          style={{
            marginBottom: 44,
            padding: "22px 28px",
            background: "var(--bg-darkcard)",
            
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 55,
            }}
          >
            <div>
              <div
                style={{ fontWeight: 700, fontSize: 24, paddingBottom: "6px" }}
              >
                How AI Solve Under The Hood
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: "var(--offshade-text)",
                  paddingBottom: "18px",
                }}
              >
                Multi-source intelligence layered per pillar — not a
                single-model black box
              </div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                icon: "🌐",
                title: "DOM + Playwright Crawl",
                desc: "Full-page crawl with interaction, axe-core engine, custom WCAG rule validation per element",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "👁️",
                title: "GPT-4o Vision AI",
                desc: "Screenshot analysis for contrast ratios, layout shifts, dark patterns, and consent UI integrity",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "⚡",
                title: "Core Web Vitals Engine",
                desc: "LCP, CLS, FCP, TTFB, TBT, INP measured per page under desktop and mobile 4G conditions",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "🎭",
                title: "Behavioural Simulation",
                desc: "Journey testing — subscribe vs cancel path ratios, flow completion rates, interaction friction points",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "⚖️",
                title: "Regulatory Mapper",
                desc: " FTC §5, DPDPA — every finding auto-tagged to applicable regulation",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "📊",
                title: "Confidence Scoring",
                desc: "High / Medium / Low confidence per finding with full evidence chain and screenshot pinpoints",
                color: "var(--kpmg-dynamic)",
              },
            ].map((c) => (
              <div
                key={c.title}
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</span>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: c.color,
                      marginBottom: 3,
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--offshade-text)",
                      lineHeight: 1.6,
                    }}
                  >
                    {c.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div> */}

        {/* ══ INPUT MODES ═════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 55 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
              Audit Any Digital Asset
            </h2>
            <p style={{ fontSize: 13, color: "var(--offshade-text)" }}>
              Multiple input modes — all 4 pillars apply to each input type
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 12,
              width: "100%",
            }}
          >
            {[
              {
                icon: "🌐",
                mode: "Website / Web App",
                conf: "95% confidence",
                desc: "Full DOM audit, multi-page crawl, live interaction testing, performance measurement",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "📄",
                mode: "PDF Document",
                conf: "85% confidence",
                desc: "PDF/UA, tagged structure, reading order, alt text, WCAG 2.1 SC 1.4 compliance",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "📸",
                mode: "Screenshot / Image",
                conf: "70% confidence",
                desc: "GPT-4o visual analysis — contrast, layout, dark patterns, consent UI, spacing",
                color: "var(--kpmg-dynamic)",
              },
              {
                icon: "🎥",
                mode: "Video Recording",
                conf: "60% confidence",
                desc: "Frame-by-frame behavioural pattern detection — flow analysis, UX friction scoring",
                color: "var(--kpmg-dynamic)",
              },
            ].map((m) => (
              <div
                key={m.mode}
                className="glass-card"
                style={{
                  padding: "18px",
                  borderLeft: `3px solid ${m.color}`,
                  flex: "1 1 210px", // Replaces minmax(210px, 1fr)
                  maxWidth: "350px", // Optional: Prevents a single card from stretching too wide on its own row
                  boxSizing: "border-box",
                }}
              >
                {/* <div style={{ fontSize: 26, marginBottom: 8 }}>{m.icon}</div> */}
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {m.mode}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--offshade-text)",
                    marginBottom: 10,
                    lineHeight: 1.55,
                  }}
                >
                  {m.desc}
                </div>
                {/* <span
                  style={{
                    fontSize: 12,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: `${m.color}18`,
                    color: m.color,
                    border: `1px solid ${m.color}40`,
                    fontWeight: 700,
                  }}
                >
                  {m.conf}
                </span> */}
              </div>
            ))}
          </div>
        </div>

        {/* ══ REGULATION COVERAGE ════════════════════════════════════════ */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
              Audit History
            </h2>
            {/* <p style={{ fontSize: 14, color: "var(--offshade-text)" }}>
              Every finding is automatically mapped to the applicable regulation
              or standard
            </p> */}
            {completed.length > 0 && (
              <p
                style={{
                  fontSize: 14,
                  paddingTop: "2px",
                  color: "var(--offshade-text)",
                  margin: 0,
                }}
              >
                {completed.length} completed audit
                {completed.length !== 1 ? "s" : ""} — click any card to view the
                full report
              </p>
            )}
          </div>
          {/* <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              justifyContent: "center",
            }}
          >
            {[
              ["♿ WCAG 2.2", "var(--text-secondary)"],
              ["♿ EN 301 549", "var(--text-secondary)"],
              ["♿ Section 508", "var(--text-secondary)"],
              ["♿ WCAG 2.1", "var(--text-secondary)"],
              // ["🛡️ GDPR Art. 5–37", "var(--text-secondary)"],
              ["🛡️ CCPA / CPRA", "var(--text-secondary)"],
              ["🛡️ IN-DPDPA 2023", "var(--text-secondary)"],
              // ["🛡️ ePrivacy", "var(--text-secondary)"],
              ["⚖️ EU DSA Art. 25", "var(--text-secondary)"],
              ["⚖️ FTC §5", "var(--text-secondary)"],
              ["⚖️ ICO Guidance", "var(--text-secondary)"],
              ["⚖️ CNIL", "var(--text-secondary)"],
              ["⚡ Core Web Vitals", "var(--text-secondary)"],
              ["⚡ RAIL Model", "var(--text-secondary)"],
              ["⚡ Lighthouse", "var(--text-secondary)"],
              ["⚡ HTTP/2", "var(--text-secondary)"],
            ].map(([label, color]) => (
              <span
                key={label}
                style={{
                  fontSize: 12,
                  padding: "8px 16px",
                  borderRadius: 99,
                  background: `${color}14`,
                  color,
                  border: `1px solid var(--text-muted)`,
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
            ))}
          </div> */}
        </div>

        {/* ══ AGGREGATE STATS (from real audits) ══════════════════════════ */}
        {completed.length > 0 && (
          <div className="grid-4 animate-slide-up" style={{ marginBottom: 28 }}>
            {[
              {
                val: completed.length,
                label: "Audits Completed",
                color: "var(--accent-blue)",
              },
              {
                val: `${avgScore}/100`,
                label: "Average Score",
                color:
                  avgScore >= 75
                    ? "var(--kpmg-dynamic)"
                    : avgScore >= 50
                      ? "var(--kpmg-dynamic)"
                      : "var(--kpmg-dynamic)",
              },
              {
                val: totalIssues,
                label: "Total Issues Found",
                color: "var(--kpmg-dynamic)",
              },
              {
                val: pillarsRun.length,
                label: "Pillars Exercised",
                color: "var(--kpmg-teal)",
              },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div
                  className="stat-value"
                  style={{ color: "var(--kpmg-dynamic)" }}
                >
                  {s.val}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══ RUNNING AUDITS ══════════════════════════════════════════════ */}
        {running.length < 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Running Audits
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {running.map((a) => (
                <Link
                  key={a.id}
                  href={`/audit/${a.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="glass-card animate-glow"
                    style={{ cursor: "pointer" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 9,
                      }}
                    >
                      <div
                        className="animate-spin"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "2px solid rgba(0,145,218,0.2)",
                          borderTopColor: "var(--accent-blue)",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {a.config?.url || "PDF Audit"}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            marginTop: 4,
                          }}
                        >
                          {(a.config?.enabledPillars || ["accessibility"]).map(
                            (p) => {
                              const m = PILLAR_META[p];
                              if (!m) return null;
                              return (
                                <span
                                  key={p}
                                  style={{
                                    fontSize: 9,
                                    padding: "1px 6px",
                                    borderRadius: 99,
                                    background: `${m.color}18`,
                                    color: m.color,
                                    border: `1px solid ${m.color}40`,
                                    fontWeight: 700,
                                  }}
                                >
                                  {m.icon} {m.label}
                                </span>
                              );
                            },
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 300,
                          color: "var(--accent-blue)",
                        }}
                      >
                        {a.progress}%
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${a.progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══ AUDIT HISTORY ═══════════════════════════════════════════════ */}
        <div id="audits" style={{ marginBottom: 44 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              {/* <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 2 }}>
                📋 Audit History
              </h2> */}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {completed.length > 3 && !showAllCompleted && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAllCompleted(true)}
                >
                  Show All ({completed.length})
                </button>
              )}
              <Link href="/audit" className="btn btn-primary btn-sm">
                + New Audit
              </Link>
            </div>
          </div>

          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: 44,
              }}
            >
              <div
                className="spinner"
                style={{ margin: "0 auto", marginBottom: 12 }}
              />
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Loading audits...
              </p>
            </div>
          )}

          {!loading && completed.length === 0 && (
            <div
              className="glass-card"
              style={{ textAlign: "center", padding: 56 }}
            >
              <div style={{ fontSize: 52, marginBottom: 16 }}>🛡️</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: 18 }}>
                No Audits Yet
              </h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: 10,
                  fontSize: 14,
                }}
              >
                Start your first TrustLens audit to get enterprise-grade digital
                trust insights.
              </p>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 12,
                  marginBottom: 24,
                }}
              >
                Choose any combination of Accessibility · Dark Patterns ·
                Performance ·
              </p>
              <Link href="/audit" className="btn btn-primary btn-lg">
                🚀 Start First Audit
              </Link>
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {(showAllCompleted ? completed : completed.slice(0, 3)).map((a) => {
              const pillars = a.config?.enabledPillars || [];
              const isPerfOnly =
                pillars.length === 1 && pillars[0] === "performance";
              const isA11yOnly =
                pillars.length === 0 ||
                (pillars.length === 1 && pillars[0] === "accessibility");
              const displayScore = a.displayScore ?? a.score.overall;
              const issueCount = a.totalIssues ?? a.score.totalIssues;
              const pillarScores = a.pillarScores ?? {};
              const trustColor = a.trustScore
                ? TRUST_COLORS[a.trustScore.trustLevel] || "#0091DA"
                : displayScore >= 75
                  ? "#00BA8C"
                  : displayScore >= 50
                    ? "#F0AB00"
                    : "#FF3356";
              const level = a.config?.wcagLevels?.includes("AAA")
                ? "AAA"
                : a.config?.wcagLevels?.includes("AA")
                  ? "AA"
                  : "A";
              const auditTitle = getAuditTitle(pillars);
              const perfGrade = isPerfOnly ? getPerfGrade(displayScore) : null;

              return (
                <Link
                  key={a.id}
                  href={`/audit/${a.id}/report`}
                  style={{
                    textDecoration: "none",
                    fontSize: "14px",
                    color: "var(--kpmg-dynamic)",
                  }}
                >
                  <div
                    className="glass-card"
                    style={{
                      cursor: "pointer",
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform =
                        "translateY(-2px)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 8px 32px rgba(0,0,0,0.18)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                    }}
                  >
                    {/* Top row: score circle + info + badge */}
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                      }}
                    >
                      {/* Score circle */}
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          border: `2.5px solid ${trustColor}`,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          background: `${trustColor}08`,
                        }}
                      >
                        {isPerfOnly && perfGrade ? (
                          <>
                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: perfGrade.color,
                                lineHeight: 1,
                              }}
                            >
                              {perfGrade.label}
                            </div>
                            <div
                              style={{
                                fontSize: 7.5,
                                color: "var(--text-scondary)",
                                letterSpacing: "0.03em",
                              }}
                            >
                              {perfGrade.sub}
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color: trustColor,
                                lineHeight: 1,
                              }}
                            >
                              {displayScore}
                            </div>
                            <div
                              style={{
                                fontSize: 8,
                                color: "var(--offshade-text)",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              {a.trustScore ? "Trust" : "Score"}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* URL + audit type */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 18,
                            marginBottom: 5,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 300,
                            }}
                          >
                            {a.config?.url || "PDF Document"}
                          </span>
                          {/* <span
                            style={{
                              fontSize: 13,
                              padding: "2px 7px",
                              borderRadius: 99,
                              background: "rgba(0,145,218,0.1)",
                              color: "var(--accent-blue)",
                              border: "1px solid rgba(0,145,218,0.25)",
                              fontWeight: 700,
                            }}
                          >
                            {auditTitle}
                          </span> */}
                          {isA11yOnly && (
                            <span
                              className={`audit-level-chip ${level.toLowerCase()}`}
                              style={{ fontSize: 12, padding: "2px 7px" }}
                            >
                              {a.config?.standard || "WCAG 2.2"} {level}
                            </span>
                          )}
                        </div>

                        {/* Pillar badges */}
                        {/* {pillars.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              gap: 14,
                              flexWrap: "wrap",
                              marginBottom: 8,
                            }}
                          >
                            {pillars.map((p) => {
                              const m = PILLAR_META[p];
                              if (!m) return null;
                              const ps = pillarScores[p];
                              const pColor =
                                ps != null
                                  ? ps >= 75
                                    ? "#00BA8C"
                                    : ps >= 50
                                      ? "#F0AB00"
                                      : "#FF3356"
                                  : m.color;
                              return (
                                <span
                                  key={p}
                                  style={{
                                    fontSize: 13,
                                    // padding: "2px 8px",
                                    borderRadius: 99,
                                    background: `${m.color}15`,
                                    color: m.color,
                                    border: `1px solid ${m.color}35`,
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  {m.icon} {m.label}
                                  {ps != null && (
                                    <span
                                      style={{
                                        color: pColor,
                                        fontWeight: 700,
                                        marginLeft: 3,
                                      }}
                                    >
                                      {ps}/100
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )} */}

                        {/* Meta row */}
                        <div
                          style={{
                            display: "flex",
                            gap: 18,
                            fontSize: 13,
                            color: "var(--offshade-text)",
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 99,
                              border: "1px solid var(--kpmg-dynamic)",
                              // background: "var(--kpmg-dynamic)",
                              color: "var(--offshade-text)",
                              fontWeight: 200,
                              fontSize: 12,
                            }}
                          >
                            {a.crawlCoverage?.pagesAudited ?? "—"} pages
                          </span>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 99,
                              border: "1px solid var(--kpmg-dynamic)",
                              // background: "var(--kpmg-dynamic)",
                              color: "var(--offshade-text)",
                              fontWeight: 200,
                              fontSize: 12,
                            }}
                          >
                            {issueCount} issue{issueCount !== 1 ? "s" : ""}
                          </span>
                          {a.crawlCoverage && (
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: 99,
                                border: "1px solid var(--kpmg-dynamic)",
                                // background: "var(--kpmg-dynamic)",
                                color: "var(--offshade-text)",
                                fontWeight: 200,
                                fontSize: 12,
                              }}
                            >
                              {a.crawlCoverage.coveragePercent}% coverage
                            </span>
                          )}
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 99,
                              border: "1px solid var(--kpmg-dynamic)",
                              // background: "var(--kpmg-dynamic)",
                              color: "var(--offshade-text)",
                              fontWeight: 200,
                              fontSize: 12,
                            }}
                          >
                            {" "}
                            {new Date(a.startedAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Right badge — trust level for multi-pillar, compliance for a11y, grade for perf */}
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 6,
                        }}
                      >
                        {a.trustScore ? (
                          <span
                            style={{
                              fontSize: 13,
                              padding: "4px 10px",
                              borderRadius: 99,
                              fontWeight: 700,
                              background: `${TRUST_COLORS[a.trustScore.trustLevel] || trustColor}18`,
                              color:
                                TRUST_COLORS[a.trustScore.trustLevel] ||
                                trustColor,
                              border: `1px solid ${TRUST_COLORS[a.trustScore.trustLevel] || trustColor}40`,
                            }}
                          >
                            {TRUST_LABELS[a.trustScore.trustLevel] ||
                              a.trustScore.trustLevel}
                          </span>
                        ) : isPerfOnly ? (
                          <span
                            style={{
                              fontSize: 13,
                              padding: "4px 10px",
                              borderRadius: 99,
                              fontWeight: 700,
                              background: `${trustColor}18`,
                              color: trustColor,
                              border: `1px solid ${trustColor}40`,
                            }}
                          >
                            {getPerfGrade(displayScore).sub}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 13,
                              padding: "4px 10px",
                              borderRadius: 99,
                              fontWeight: 700,
                              background: `${COMPLIANCE_COLORS[a.score.complianceLevel] || "#0091DA"}18`,
                              color:
                                COMPLIANCE_COLORS[a.score.complianceLevel] ||
                                "#0091DA",
                              border: `1px solid ${COMPLIANCE_COLORS[a.score.complianceLevel] || "#0091DA"}40`,
                            }}
                          >
                            {COMPLIANCE_LABELS[a.score.complianceLevel] ||
                              a.score.complianceLevel}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            marginTop: "12px",
                            color: "var(--text-secondary)",
                          }}
                        >
                          View Report →
                        </span>
                      </div>
                    </div>

                    {/* Per-pillar score bar (multi-pillar only) */}
                    {Object.keys(pillarScores).length > 1 && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: "1px solid var(--border)",
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {Object.entries(pillarScores).map(([p, ps]) => {
                          const m = PILLAR_META[p];
                          if (!m) return null;
                          const barColor =
                            ps >= 75
                              ? "var(--kpmg-dynamic)"
                              : ps >= 50
                                ? "var(--kpmg-dynamic)"
                                : "var(--kpmg-dynamic)";
                          return (
                            <div key={p} style={{ flex: 1, minWidth: 80 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 14,
                                  marginBottom: 3,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                <span
                                  style={{ color: m.color, fontWeight: 700 }}
                                >
                                  {/* {m.icon} */}
                                  {m.label}
                                </span>
                                <span
                                  style={{ color: barColor, fontWeight: 700 }}
                                >
                                  {ps}
                                </span>
                              </div>
                              <div
                                style={{
                                  height: 4,
                                  borderRadius: 99,
                                  background: "var(--border)",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${ps}%`,
                                    background: barColor,
                                    borderRadius: 99,
                                    transition: "width 0.6s ease",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
