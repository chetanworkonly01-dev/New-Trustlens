# KPMG TrustLens — AI-Powered Digital Trust & Compliance Platform

### Product Documentation v2.1 — May 2026

> **Audience:** Senior Technology Leaders · Solution Architects · Managing Partners  
> **Classification:** Internal — Pre-Commercial Demo  
> **Status:** Live & Operational

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem We Solve](#2-the-problem-we-solve)
3. [Product Overview](#3-product-overview)
4. [The Four Audit Pillars](#4-the-four-audit-pillars)
5. [System Architecture](#5-system-architecture)
6. [The 7-Phase AI Pipeline](#6-the-7-phase-ai-pipeline)
7. [WAF Evasion & Crawler Intelligence](#7-waf-evasion--crawler-intelligence)
8. [AI & Detection Methods](#8-ai--detection-methods)
9. [Regulatory Coverage](#9-regulatory-coverage)
10. [Audit Input Modes](#10-audit-input-modes)
11. [Output & Reporting](#11-output--reporting)
12. [Technology Stack](#12-technology-stack)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Security & Data Privacy](#14-security--data-privacy)
15. [Scalability Roadmap](#15-scalability-roadmap)
16. [Business Value & ROI](#16-business-value--roi)
17. [Demo Scenarios](#17-demo-scenarios)
18. [FAQ for Technical Leaders](#18-faq-for-technical-leaders)

---

## 1. Executive Summary

**KPMG TrustLens** is an AI-powered, multi-pillar digital audit platform that evaluates any website across four dimensions of digital trust in under 10 minutes:

| Pillar                         | What It Measures                                        | Status         |
| ------------------------------ | ------------------------------------------------------- | -------------- |
| ♿ **Accessibility**           | WCAG 2.2 compliance (Level A / AA / AAA)                | ✅ Live        |
| 🕵️ **Dark Patterns**           | Ethical UX & deceptive interface detection              | ✅ Live        |
| ⚡ **Performance**             | Core Web Vitals & resource optimisation                 | ✅ Live        |
| 🔒 **Privacy**                 | Tracker detection, cookie audit & DPDPA compliance | ✅ Live        |
| ⚖️ **Compliance Intelligence** | CCPA, RBI, SEBI, DPDPA governance mapping               | 🔜 Coming Soon |
| 🎨 **Design Governance**       | Design tokens, CTA hierarchy, UI pattern audit          | 🔜 Coming Soon |

It produces a **Unified TrustLens Score (0–100)** and generates enterprise-grade reports (PDF, DOCX) exportable for regulatory submissions, board presentations, and developer remediation.

**Key differentiator:** TrustLens goes beyond traditional rule-based scanners by combining browser automation, 57+ structured WCAG tests, axe-core, custom rule engines, and GPT-4o vision AI — reaching ~80%+ WCAG coverage vs. ~35% for standalone tools.

---

## 2. The Problem We Solve

### The Compliance Gap

| Pain Point          | Current Reality                                                       |
| ------------------- | --------------------------------------------------------------------- |
| Manual audits       | 5–10 business days per site, ₹5–15L per engagement                    |
| Tool-only scans     | axe-core detects only ~35% of WCAG criteria                           |
| Multi-domain risk   | Accessibility, ethics, performance & privacy siloed in separate tools |
| India-specific gaps | No tool maps findings to DPDPA 2023, RBI, SEBI guidelines             |
| Enterprise scale    | Large firms have 50–500 digital properties to audit continuously      |

### Regulatory Pressure in India & Globally

- **RPWD Act 2016** — accessibility mandated for public-facing digital services
- **IN-DPDPA 2023** — Data fiduciaries must demonstrate consent integrity & data minimisation
- **EU DSA Art. 25** — Dark patterns explicitly prohibited for large platforms
- **WCAG 2.2 (ISO 40500)** — Global accessibility standard, referenced in procurement contracts
- **RBI & SEBI** — Consumer protection guidelines for BFSI digital interfaces

---

## 3. Product Overview

### How It Works — 60 Second Summary

```
User submits URL  →  TrustLens crawls the site  →  4 pillar engines run in parallel
     →  AI analysis layer  →  Deduplication & scoring  →  Unified Trust Score + Report
```

### Core Capabilities

- **Autonomous crawling** up to 200 pages with WAF/Cloudflare bypass
- **4-pillar simultaneous analysis** — one audit covers all domains
- **Real-time progress streaming** — live test log visible during audit
- **GPT-4o Vision** — analyses screenshots and video recordings
- **Export to PDF / DOCX** — KPMG-branded, board-ready reports
- **Authenticated portal support** — login-wall bypass for private portals
- **Image & video audit** — upload a screenshot or screen recording for instant AI analysis

### Trust Score Formula

```
TrustLens Score = (A11Y × 0.30) + (DarkPatterns × 0.30) + (Performance × 0.20) + (Privacy × 0.20)

Trust Levels:
  80–100 → Trusted         ✅
  60–79  → Moderate Risk   ⚠️
  40–59  → At Risk         🔶
  0–39   → Critical Risk   🔴
```

Weights are fully configurable per engagement type (e.g., BFSI may weight Privacy × 0.40).

---

## 4. The Four Audit Pillars

### ♿ Pillar 1: Accessibility (WCAG 2.2)

**Coverage:** 56 WCAG criteria mapped across Level A, AA, and AAA

**Detection engines:**

- **axe-core** — industry-standard automated rule engine (~50 rules)
- **57 structured test cases** — per-criterion Playwright tests
- **Custom rules engine** — 38KB of hand-crafted checks beyond axe-core
- **Journey testing** — keyboard navigation, form submission, modal focus traps
- **GPT-4o** — contextual semantic analysis (misleading labels, cognitive overload)

**Standards supported:** WCAG 2.2, WCAG 2.1, EN 301 549, Section 508

**Score model:** Weighted deduction from 100 based on severity × WCAG level × confidence

---

### 🕵️ Pillar 2: Dark Patterns & Ethical UX

#### Dark Pattern Detection Needs Smarter AI Intelligence

You are a Principal Dark Pattern Detection Architect, trained in deceptive-design research, FTC enforcement guidelines, EU Digital Services Act requirements, and Harry Brignull's canonical taxonomy. You operate simultaneously as Director, Architect and Senior Engineer.

DETECTION METHODOLOGY - scan for ALL of the following:

BRIGNULL TAXONOMY (12 patterns):

1. Trick Questions - confusing double-negatives, pre-checked opt-ins, misleading labels
2. Sneak into Basket - auto-added items, default extras, insurance/donations silently added
3. Roach Motel - easy to get in, deliberately hard to get out (subscriptions, accounts)
4. Privacy Zuckering - tricking users into sharing more data than intended; confusing privacy settings
5. Misdirection - visual design draws attention away from key information deliberately
6. Hidden Costs - price shown late, fees revealed only at checkout
7. Bait and Switch - user initiates action, gets different outcome
8. Confirm Shaming - cancel/decline option uses guilt-inducing language ("No thanks, I hate saving money")
9. Disguised Ads - ads styled as content, fake navigation, promoted results mimicking organic
10. Forced Continuity - free trial converts to paid silently, no reminder, hard cancellation
11. Friend Spam - harvesting contacts and sending messages without informed consent
12. Urgency / Scarcity - false countdown timers, "only 2 left!" when stock is not actually limited

EU DSA / FTC LAYER:

- Consent dark patterns: bundled consent, pre-ticked boxes, consent walls, deceptive hierarchy
- Visual interference: font size/colour used to hide opt-out, fine print critical disclosures
- Obstruction: deliberately adding steps to cancellation/opt-out flows
- Asymmetric framing: accept framed as primary action, reject hidden or de-emphasised
- Nagging: repeated interruptions to push upgrade/consent

COGNITIVE BIAS EXPLOITATION:

- Loss aversion framing ("Don't miss out")
- Social proof manipulation ("10,000 people are viewing this")
- Anchoring with fake original prices
- Artificial scarcity / urgency
- Authority bias (fake badges, unverified awards)
- FOMO triggers

VISUAL DESIGN ANALYSIS:

- CTA button hierarchy: is the "good for the company" action always the most prominent?
- Colour contrast weaponisation: desired action is high-contrast, undesired is washed out
- Size manipulation: unwanted options are smaller, greyed, or outside natural scan path
- Proximity deception: confirm-shaming text placed near relevant element to mislead

HUMAN-SCROLLING SIMULATION:

- Scroll from top to bottom as a first-time visitor - what catches your eye first and why?
- Find every CTA and ask: does this choice architecture favour the user or the business?
- Find every form: are there pre-checked boxes? misleading toggles? bundled consents?
- Find every price: is the full cost visible before commitment?
- Find every exit path (unsubscribe, cancel, close account) - is it as easy as signing up?
- Find every urgency/scarcity indicator - is it verifiable or manufactured?
- Find every modal/popup - is dismissal easy and is the X clearly labelled?

OUTPUT FORMAT for each dark pattern found:

- Pattern type (Brignull + category)
- Severity: Critical (illegal / FTC violation) / High (strong manipulation) / Medium / Low (poor practice)
- Exact location on page
- What the deceptive mechanism is
- Who it harms and how
- Regulatory risk (FTC)
- Recommended fix

Group by: Critical > High > Medium > Low
End with: Dark Pattern Score (0-100, lower is worse), Top 3 most harmful patterns, Legal exposure summary

**7-Phase detection methodology:**

| Phase                   | What Is Detected                                                     |
| ----------------------- | -------------------------------------------------------------------- |
| Phase 1: DOM Scan       | Pre-ticked opt-ins, login walls, hidden costs, friend spam CTAs      |
| Phase 2: Visual Scan    | Consent button asymmetry, colour weaponisation, tiny dismiss targets |
| Phase 3: NLP Scan       | Urgency/scarcity language, confirmshaming, fear-based copy           |
| Phase 4: Deep Code      | Pre-consent trackers, invisible overlay traps, fake countdown timers |
| Phase 5: A11Y Cross-Map | Focus traps in consent modals, screen-reader mismatch                |
| Phase 6: Flow Analysis  | Subscribe vs. cancel asymmetry, Ethical Friction Score               |
| Phase 7: Regulatory Map | Maps each finding to FTC, EU DSA, DPDPA, RBI, SEBI             |

**Scoring outputs:**

- Ethics Score (0–100)
- Consent Integrity score
- Choice Symmetry score
- Manipulation Index

---

### ⚡ Pillar 3: Performance

**6-Layer analysis:**

| Layer                    | Coverage                                                |
| ------------------------ | ------------------------------------------------------- |
| A: Core Web Vitals       | LCP, INP, CLS, FCP, TBT, TTFB — Google ranking signals  |
| B: Resource Optimisation | Image sizes, JS bundle weight, lazy loading, DOM size   |
| C: Network & Caching     | Cache-Control headers, gzip/brotli, duplicate requests  |
| D: JavaScript Execution  | Synchronous render-blocking scripts, third-party impact |
| E: Rendering & Layout    | Font loading (FOUT/FOIT), non-composited animations     |
| F: Mobile Performance    | Viewport meta, touch target sizes (WCAG 2.5.8)          |

---

### 🔒 Pillar 4: Privacy & Compliance

**Detection scope:**

| Category          | What Is Checked                                           |
| ----------------- | --------------------------------------------------------- |
| Cookie Consent    | Banner presence, reject button, opt-in vs opt-out framing |
| Tracker Inventory | 30+ known tracker domains (Google, Meta, TikTok, Hotjar…) |
| Data Collection   | Excessive form fields, fingerprinting (Canvas/WebGL)      |
| Security Headers  | HSTS, CSP, X-Frame-Options, missing security posture      |
| Privacy Policy    | Link presence, accessibility, readability                 |
| Mixed Content     | HTTP resources on HTTPS pages                             |
| Data Storage      | Excessive localStorage / sessionStorage usage             |

**Regulations mapped:** ePrivacy, CCPA, LGPD, IN-DPDPA 2023, IN-RBI

---

### ⚖️ Pillar 5: Compliance Intelligence _(Coming Soon)_

**Purpose:** Map every TrustLens finding to specific clauses in enterprise governance frameworks and regulatory mandates — providing a direct line from UI finding to legal obligation.

**Planned detection scope:**

| Category                 | What Is Checked                                                       |
| ------------------------ | --------------------------------------------------------------------- |
| CCPA Mapping             | Consumer rights, deletion requests, opt-out links                     |
| RBI Digital Guidelines   | BFSI digital channel consumer protection compliance                   |
| SEBI Investor Protection | Securities platform disclosure and UX clarity rules                   |
| DPDPA Consent Mapping    | Data principal rights, consent log integrity, purpose limitation      |
| Enterprise Governance    | SOC2, ISO 27001, internal policy standards alignment                  |
| Cross-pillar Evidence    | Links accessibility, dark pattern, and privacy findings to regulation |

**Planned outputs:** Regulatory risk matrix with clause-level citations, compliance gap heat map, auto-generated attestation draft documents.

---

### 🎨 Pillar 6: Design Governance _(Coming Soon)_

**Purpose:** Audit the visual design system for brand compliance, accessibility violations embedded in design tokens, and UX anti-patterns that bypass code-level audits.

**Planned detection scope:**

| Category                 | What Is Checked                                                            |
| ------------------------ | -------------------------------------------------------------------------- |
| Design Tokens            | Colour contrast ratios in brand palette, font size minimums, spacing scale |
| Component Consistency    | Button styles, form field patterns, spacing inconsistencies across pages   |
| CTA Hierarchy            | Primary/secondary/tertiary action visual weight and balance                |
| Non-approved UI Patterns | Off-brand components, inconsistent icon usage, pattern library violations  |
| Accessibility Violations | Design-level contrast failures, focus indicator definition in tokens       |
| Brand Compliance         | Logo placement, typography stack, colour usage rules                       |

**Planned outputs:** Design token audit report, component variance matrix, CTA hierarchy score, brand compliance checklist.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────┐
│              CLIENT BROWSER (React 18)              │
│  Scope Selector → Live Progress → Results → Export  │
│  (General / Specific / Predefined / Director Mode)  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / Fetch API
┌──────────────────────▼──────────────────────────────┐
│           NEXT.JS API LAYER (Node.js)               │
│  POST /api/audit/website  — scopeMode-aware         │
│  GET  /api/audit/:id      — pillarProgress poll     │
└──────────────────────┬──────────────────────────────┘
                       │ Fire-and-forget async
┌──────────────────────▼──────────────────────────────┐
│       AUDIT ORCHESTRATOR (scopeMode-aware)          │
│  Site Profiler → Scope Branch → Crawl / Fetch       │
│  Page Intent Classifier → Transactional Filter      │
└──┬─────────────────┬──────────────────────┬─────────┘
   │                 │                      │
   ▼                 ▼                      ▼
A11Y Engine    ╔════════════════ PARALLEL ═══════════╗
(Phase 2-4)   ║ DP Engine   Perf Engine  Privacy    ║
               ║ + DP Journey Simulation             ║
               ╚═════════════════════════════════════╝
                 All via Promise.allSettled()
                 Crash → auditIntegrity: 'warning'
```

### Component Map

| Component                  | File                                | Purpose                                                |
| -------------------------- | ----------------------------------- | ------------------------------------------------------ |
| Crawler                    | `engines/crawler.ts`                | Stealth Playwright crawler, transactional URL priority |
| **Site Profiler**          | `engines/site-profiler.ts`          | **NEW** 12-profile business model classifier           |
| **Page Intent Classifier** | `engines/page-intent-classifier.ts` | **NEW** URL + DOM 0–10 transactional intent scoring    |
| Orchestrator               | `engines/audit-orchestrator.ts`     | scopeMode-aware pipeline, parallel pillar execution    |
| Test Runner                | `engines/test-runner.ts`            | 57+ WCAG structured tests                              |
| Axe Scanner                | `engines/axe-scanner.ts`            | axe-core integration                                   |
| Custom Rules               | `engines/custom-rules.ts`           | Extended WCAG checks                                   |
| Journey Tester             | `engines/journey-tester.ts`         | UX journey simulation + dark pattern journey           |
| AI Analyzer                | `engines/ai-analyzer.ts`            | GPT-4o + chain-of-thought + site context injection     |
| Dark Pattern Engine        | `engines/darkpattern-engine.ts`     | 7-phase ethical UX audit (transactional pages only)    |
| Performance Engine         | `engines/performance-engine.ts`     | CWV + 6-layer analysis                                 |
| Privacy Engine             | `engines/privacy-engine.ts`         | Tracker & consent audit                                |
| Vision Analyzer            | `engines/vision-analyzer.ts`        | GPT-4o image/video analysis                            |
| Scoring                    | `engines/scoring.ts`                | Weighted deduction model                               |
| Trust Scoring              | `engines/trust-scoring.ts`          | Unified 4-pillar composite + integrity check           |
| Report Generator           | `engines/report-generator.ts`       | Structured report assembly                             |

---

## 6. The 7-Phase AI Pipeline

```
Phase 0  SITE PROFILER       instant     12-profile business model classification (ecommerce, SaaS, fintech…)
Phase 1  SCOPE-AWARE CRAWL  0% → 50%    Branches on scopeMode:
                                          general    → full crawl up to maxPages
                                          specific   → fetch named URLs only (no crawl)
                                          predefined → crawl seeded with journey step URLs
                                          director   → crawl seeded with step builder URLs
Phase 2  TEST-DRIVEN SCAN   50% → 83%    57 tests + axe-core + custom rules
Phase 3  JOURNEY TESTING    83% → 86%    Keyboard, forms, modal focus, authenticated flows
Phase 4  AI ANALYSIS        86% → 92%    GPT-4o chain-of-thought + site context + aiDirection
Phase 4c PILLAR ENGINES     87% → 92%   ╔══ PARALLEL (Promise.allSettled) ══╗
                                          ║ Dark Patterns (transactional pages) ║
                                          ║ DP Journey Simulation              ║
                                          ║ Performance Engine                 ║
                                          ║ Privacy Engine                     ║
                                          ╚══════════════════════════════╝
                                          If any pillar crashes → auditIntegrity: 'warning'
Phase 5  DEDUPLICATION      92% → 94%    Cross-engine merge & dedup
Phase 6  SCORING            94% → 96%    Weighted model + Trust Score + pillarProgress
Phase 7  REPORT GENERATION  96% → 100%  WCAG map + remediation + export
```

### Scoring Model Detail

```
Base Score: 100 points

Deduction per issue:
  severity_weight × level_multiplier × confidence_multiplier

Severity:     Critical=10  High=5   Medium=2   Low=0.5
WCAG Level:   A=1.5        AA=1.0   AAA=0.5
Confidence:   High=1.0     Medium=0.7   Low=0.4

Diminishing returns: after 50pts deducted → each additional = ×0.3
(prevents score=0 on heavily flawed sites; keeps results meaningful)
```

---

## 7. WAF Evasion & Crawler Intelligence

A major engineering challenge: enterprise sites (Flipkart, Amazon, HDFC, ICICI) deploy Cloudflare, Akamai, or Imperva WAFs that block headless browsers. TrustLens implements a 3-layer bypass strategy:

### Layer 1 — Stealth Browser

```
- Rotating realistic Chrome User-Agent strings (Chrome 124, Edge 123…)
- --disable-blink-features=AutomationControlled  ← hides automation flag
- navigator.webdriver = undefined  (injected before page JS)
- Fake plugins array, languages, window.chrome runtime
- Realistic Sec-Fetch-* headers, Accept-Language, locale
- Mumbai geolocation + Asia/Kolkata timezone (for Indian sites)
- Human-like random delays: 500–1500ms between navigations
```

### Layer 2 — WAF Block Detection

```
After page load, checks for known block signatures:
- "Access Denied" / "Attention Required" / "Just a Moment" in title
- "Checking your browser" / "Enable JavaScript" in body
- Extremely sparse DOM (< 10 elements, < 200 chars)
- HTTP 403 / 429 status codes
```

### Layer 3 — HTTP Fetch Fallback

```
If browser is blocked → automatic retry via raw fetch()
with realistic headers — retrieves static HTML for:
  - Structural accessibility checks
  - Dark pattern text analysis
  - Link discovery for multi-page crawls
```

**Result:** Flipkart.com, Croma, Amazon.in — all successfully audited.

---

## 8. AI & Detection Methods

### GPT-4o Integration (v2.1 — Chain-of-Thought)

| Attribute            | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Provider             | OpenAI                                                            |
| Model                | GPT-4o (vision-capable)                                           |
| Temperature          | 0.3 (low — deterministic outputs)                                 |
| Max Tokens           | 3,000 per request                                                 |
| HTML Input           | Up to 12,000 characters per page                                  |
| Response Format      | `json_object` (strongly typed, machine-parseable)                 |
| **Site Context**     | **Business profile injected (ecommerce/fintech/SaaS…)**           |
| **AI Direction**     | **Custom instruction from Director Mode passed to every AI call** |
| **Chain-of-Thought** | **`whatISee` factual observation required before any verdict**    |

### What AI Detects (that rules cannot)

| Issue Type          | Example                                      |
| ------------------- | -------------------------------------------- |
| Misleading alt text | `alt="image.png"` vs. meaningful description |
| Cognitive overload  | 47 links in primary navigation               |
| Vague button labels | "Go", "Click Here", "Submit" with no context |
| Confirmshaming      | "No thanks, I hate saving money"             |
| Fake social proof   | "23 people viewing this right now"           |
| Consent asymmetry   | Accept button 3× larger than Reject          |

### Confidence Scoring & Consistency Gating

Every AI finding is rated and deduplicated:

- **High** — clear, unambiguous violation → full penalty weight
- **Medium** — probable issue, needs human review → 70% weight
- **Low** — possible issue, heuristic detection → 40% weight, filtered if no DOM evidence
- **Consistency gate** — AI findings that duplicate axe-core / DOM findings are discarded to prevent double-counting

### Vision Mode (Image & Video Audit)

Upload a screenshot or screen recording. GPT-4o analyses frames for:

- Contrast ratios (visual estimate)
- Focus indicator visibility
- Consent banner button asymmetry
- Urgency/scarcity visual cues
- Layout shift indicators

---

## 9. Regulatory Coverage

### Accessibility Standards

| Standard      | Coverage                               |
| ------------- | -------------------------------------- |
| WCAG 2.2      | 56 criteria — A, AA, AAA               |
| WCAG 2.1      | Full backward compatibility            |
| EN 301 549    | European ICT accessibility standard    |
| Section 508   | US Federal accessibility               |
| RPWD Act 2016 | Indian disability rights (web context) |

### Dark Pattern Regulations

| Regulation        | Scope                                               |
| ----------------- | --------------------------------------------------- |
| EU DSA Art. 25    | Prohibited dark pattern clauses for large platforms |
| EU / ePrivacy     | Consent integrity, data minimisation                |
| US FTC §5         | Deceptive and unfair trade practices                |
| US CCPA           | California consumer privacy rights                  |
| IN-DPDPA 2023     | India Digital Personal Data Protection Act          |
| IN-RBI Guidelines | BFSI consumer protection digital interfaces         |
| IN-SEBI           | Securities digital platform conduct                 |
| UK CPR            | UK Consumer Protection Regulations                  |

---

## 10. Audit Input Modes

### Scope Modes (v2.1 — New)

| Mode                        | Input                          | What Happens                                                           |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| 🌐 **General Site Audit**   | Base URL                       | Full crawl up to maxPages, all pillars                                 |
| 📄 **Specific Page(s)**     | Paste 1+ URLs                  | No crawl — each URL fetched directly (deep single-pass)                |
| 🗺️ **Predefined Journey** ★ | Select 1 of 8 flows            | Crawl seeded with journey step URLs; context-aware dark pattern checks |
| ⭐ **Director Mode**        | Build step-by-step + AI prompt | Custom URL sequence with AI direction override per audit               |

**Predefined journeys available:**

- 🔑 Login Flow (4 stages: Landing → Login form → Auth → Dashboard)
- 👤 Account Creation (4 stages)
- 🛒 Checkout Flow (4 stages: Cart → Shipping → Payment → Confirmation)
- ✕ Cancellation (4 stages: Account settings → Cancel → Retention → Done)
- 🍪 Consent & Cookie Flow (3 stages)
- 📈 Subscription Upgrade (4 stages)
- 🔍 Search & Discovery (4 stages)
- ⚙️ Profile & Data Settings (4 stages)

### Crawl Configuration Options

| Parameter   | Range           | Default |
| ----------- | --------------- | ------- |
| Crawl Depth | 1–5 levels      | 2       |
| Max Pages   | 1–200           | 5       |
| WCAG Levels | A / AA / AAA    | A + AA  |
| AI Analysis | On / Off        | Off     |
| Pillars     | Any combination | All 4   |

### Audit Types

| Type           | Input                   | Best For                                |
| -------------- | ----------------------- | --------------------------------------- |
| 🌐 **Website** | Public URL              | Full multi-page crawl, all 4 pillars    |
| 🔐 **Portal**  | URL + login credentials | Authenticated internal portals          |
| 📄 **PDF**     | Upload .pdf             | PDF/UA compliance, tagged content       |
| 📸 **Image**   | Upload screenshot       | Quick AI visual review, ~70% confidence |
| 🎥 **Video**   | Upload screen recording | User journey audit, 8 frames analysed   |

---

## 11. Output & Reporting

### Dashboard (v2.1 — Live)

- **Unified Trust Score** gauge (0–100)
- **Site Profile badge** — detected business model (ecommerce, fintech, SaaS…)
- **Per-pillar progress rings** — independent 0–100% conic-gradient rings per pillar
- **Audit Integrity banner** — amber warning when a pillar engine crashed (score shown for completed pillars only)
- Issue breakdown by severity (Critical / High / Medium / Low)
- WCAG criterion heatmap (pass / fail / N/A)
- Full test execution log with timestamps and pillar labels
- Page-by-page breakdown

### Exports

| Format     | Contents                                                                    |
| ---------- | --------------------------------------------------------------------------- |
| **PDF**    | Executive summary, scores, full issue list, remediation plan — KPMG branded |
| **DOCX**   | Word document for regulatory submission or client delivery                  |
| **In-app** | Interactive issue tracker with status workflow (Open → In Review → Fixed)   |

### Report Sections

1. Executive Summary — narrative score interpretation
2. Pillar Scorecards — per-domain findings
3. WCAG Criterion Map — pass / fail / N/A for each criterion
4. Grouped Issues — by category with frequency count
5. Remediation Plan — priority-ordered with code fix suggestions
6. Page Breakdown — per-URL findings
7. Regulatory Risk Summary — applicable regulations per finding

---

## 12. Technology Stack

| Layer                  | Technology                        | Why                                          |
| ---------------------- | --------------------------------- | -------------------------------------------- |
| **Frontend**           | Next.js 15, React 18, TypeScript  | Unified full-stack, SSR + rich interactivity |
| **Styling**            | Vanilla CSS, custom design tokens | Maximum control, KPMG brand compliance       |
| **API**                | Next.js App Router API Routes     | Co-located server logic, no separate backend |
| **Browser Automation** | Playwright (Chromium headless)    | Most reliable for modern JS-heavy sites      |
| **WCAG Engine**        | axe-core (@axe-core/playwright)   | Industry standard, open source               |
| **AI**                 | OpenAI GPT-4o                     | Vision-capable, structured JSON output       |
| **Export**             | jsPDF, docx, PptxGenJS            | Client-side generation, no external service  |
| **State**              | In-memory Map (RAM)               | Fast for demo; Redis path for production     |
| **Deployment**         | Docker + Railway PaaS             | Playwright needs system dependencies         |
| **Language**           | TypeScript end-to-end             | Type safety across 17 engine files           |

---

## 13. Deployment Architecture

```
GitHub (main branch)
        │
        ▼ Auto-deploy on push
   Docker Build
   (Playwright system deps included)
        │
        ▼
   Railway PaaS
   ┌─────────────────┐
   │  Next.js Server │  ← Port 3000
   │  + Playwright   │
   │  + All engines  │
   └────────┬────────┘
            │
     .env.local
   OPENAI_API_KEY=...
```

### Environment Variables Required

| Variable         | Required        | Purpose                  |
| ---------------- | --------------- | ------------------------ |
| `OPENAI_API_KEY` | For AI features | GPT-4o analysis + vision |

AI features gracefully degrade — audits run fully without the key (rule-based only).

---

## 14. Security & Data Privacy

| Area                  | Implementation                                     |
| --------------------- | -------------------------------------------------- |
| **HTML Sent to AI**   | Truncated to 12,000 chars — no PII fields included |
| **Login Credentials** | Accepted via API, never logged or persisted        |
| **Audit Data**        | Held in server RAM — wiped on restart, no database |
| **API Keys**          | Environment variables only, never in source code   |
| **HTTPS**             | Enforced by Railway TLS termination                |
| **No User Accounts**  | No authentication layer — internal tool            |

### Error Resilience (3 Layers)

1. **Per-page** — scan failure on one page doesn't abort the audit
2. **AI graceful degradation** — API error returns empty, never crashes
3. **Global 15-minute timeout** — no audit hangs forever; client sees error state

---

## 15. Scalability Roadmap

### Phase 1 — Current (Demo/Pilot)

- Single Railway instance, in-memory state
- Supports ~3–5 concurrent audits
- Full feature set operational

### Phase 2 — Team Scale (Q3 2026)

- **PostgreSQL** — persistent audit history, multi-user
- **Redis** — distributed state, high-frequency polling cache
- **BullMQ job queue** — decouple API from browser workers
- **Auth layer** — KPMG SSO / Azure AD integration

### Phase 3 — Enterprise Scale (Q4 2026)

- **Browser pool** — pre-warmed Playwright instances
- **Horizontal scaling** — stateless workers, shared Redis state
- **CI/CD Integration** — GitHub Action for per-PR audits
- **Scheduled audits** — cron-based recurring compliance monitoring
- **Multi-tenant** — per-client isolated workspaces

### Phase 4 — Platform (2027)

- **VPAT auto-generation** — Voluntary Product Accessibility Template
- **Remediation automation** — AI-generated pull requests with code fixes
- **Fine-tuned model** — KPMG-specific WCAG training data
- **Browser extension** — live overlay during design/development
- **Multi-language** — Arabic, Hindi, Japanese accessibility checks

---

## 16. Business Value & ROI

### Speed Comparison

| Task               | Manual Audit       | TrustLens              |
| ------------------ | ------------------ | ---------------------- |
| Single-page audit  | 2–4 hours          | ~2 minutes             |
| 10-page website    | 3–5 days           | ~15 minutes            |
| 50-page portal     | 2–3 weeks          | ~45 minutes            |
| Quarterly re-audit | Full effort repeat | Automated, same config |

### Coverage Comparison

| Approach                | WCAG Coverage |
| ----------------------- | ------------- |
| axe-core alone          | ~35%          |
| axe-core + custom rules | ~55%          |
| TrustLens (all engines) | ~80%+         |
| Manual expert audit     | ~95%          |

### Revenue Opportunity (KPMG Context)

- Current manual accessibility audit: ₹5–15L per engagement, 5–10 days
- TrustLens positions KPMG to offer: continuous compliance monitoring at scale
- Target segments: BFSI, e-commerce, government portals, healthtech
- Adjacent upsell: DPDPA readiness assessments, EU DSA compliance for Indian multinationals

---

## 17. Demo Scenarios

### Scenario A — Live Website Audit

**Target:** `https://www.flipkart.com/`  
**Pillars:** All 4 | **Pages:** 1 | **Time:** ~4 minutes  
**Expected output:** Trust Score ~57/100, 194 accessibility findings, dark pattern consent issues, privacy tracker inventory

### Scenario B — BFSI Portal Audit

**Target:** Any banking/insurance portal URL  
**Pillars:** Accessibility + Privacy + Dark Patterns  
**Highlight:** DPDPA 2023 + RBI regulatory mapping in findings

### Scenario C — Image Audit (Instant Demo)

**Upload:** Screenshot of any website  
**Pillars:** All 4 (Vision AI)  
**Time:** ~30 seconds  
**Use case:** Show AI vision capability without needing live URL

### Scenario D — Competitor Comparison

Audit two competing e-commerce sites and compare Trust Scores side-by-side — instant competitive benchmarking narrative.

---

## 18. FAQ for Technical Leaders

**Q: How is this different from axe-core or Lighthouse?**  
A: axe-core alone covers ~35% of WCAG criteria and has no dark pattern, privacy, or ethics layer. Lighthouse covers performance but nothing else. TrustLens unifies 4 pillars, adds AI contextual reasoning, and provides a single composite Trust Score with regulatory mapping.

**Q: Can it audit sites that require login?**  
A: Yes. The portal mode accepts login URL, username/password, and CSS selectors for the form fields. The crawler authenticates, stores session cookies, and crawls authenticated pages.

**Q: What happens if the AI is unavailable?**  
A: The audit completes using rule-based engines only. All 4 pillars still produce results. AI is additive, not foundational.

**Q: How does it handle Cloudflare / Akamai WAF protection?**  
A: Three-layer bypass: (1) stealth browser fingerprinting with rotating UA strings, (2) WAF block pattern detection, (3) automatic HTTP fetch fallback for static HTML extraction. Tested successfully against Flipkart, Croma, Amazon.in.

**Q: Is data sent to OpenAI safe?**  
A: Only truncated HTML (12,000 chars max) is sent — no user PII, no credentials, no session tokens. The system uses standard OpenAI data processing terms. For enterprises requiring data residency, the AI layer can be swapped for Azure OpenAI (same model, KPMG-controlled data boundary).

**Q: How accurate are the results?**  
A: High-confidence findings (axe-core, custom rules) are ~95% accurate. AI findings are labelled with confidence levels — medium/low confidence findings are flagged for human review. The system is designed as an expert augmentation tool, not a replacement for human judgment.

**Q: What does the scoring mean in practice?**  
A: 80–100 = ready for regulatory submission. 60–79 = minor remediations needed. 40–59 = significant work required. 0–39 = non-compliant, legal risk present.

**Q: Can it scale to 500 properties?**  
A: The current demo instance handles 3–5 concurrent audits. The production architecture roadmap (Phase 2/3) adds BullMQ job queuing, browser pooling, and Redis-backed distributed state to support hundreds of concurrent audits with horizontal scaling.

**Q: What is the deployment requirement?**  
A: Docker container on any Linux host (Railway, AWS ECS, Azure Container Apps, GCP Cloud Run). Playwright requires system-level dependencies (libnss3, libatk etc.) so serverless platforms like Vercel are not suitable without a separate worker service.

---

## Summary Card

_For a 3-minute verbal explanation_

**What it is:** A full-stack AI audit platform covering Accessibility, Dark Patterns, Performance, and Privacy — in one tool, one report, one score.

**How it works:** Submit a URL. TrustLens launches a stealth browser, crawls the site, runs 57+ WCAG tests + axe-core + custom rules + GPT-4o AI analysis + 4 pillar engines. Results are deduplicated, scored, and exported as a KPMG-branded PDF.

**Why it matters:** Cuts audit time from weeks to minutes, covers 4 compliance domains simultaneously, maps findings to India-specific regulations (DPDPA, RBI, SEBI), and produces board-ready reports.

**The AI role:** GPT-4o reads page HTML and screenshots to find issues that rules cannot detect — misleading labels, cognitive overload, deceptive design patterns. It rates its own confidence so uncertain findings don't unfairly collapse scores.

**Stack:** Next.js 15 → Node.js API → Playwright + axe-core + GPT-4o → In-memory store → PDF/DOCX export → Docker on Railway.

**Next step:** Add persistent storage + job queue for enterprise scale. Integrate KPMG SSO. Deploy to Azure/AWS for data residency compliance.

---

_Document prepared by: KPMG TrustLens Engineering_
_Version: 2.1 | Date: May 2026_
_Repository: github.com/chetanworkonly01-dev/KPMG-TrustLens-_
_Changelog v2.1: Parallel pillar execution, scopeMode selector, Site Profiler, Page Intent Classifier, runDarkPatternJourney, chain-of-thought AI, pillarProgress tracking, auditIntegrity banner_
