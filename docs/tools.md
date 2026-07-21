# Tools & Technology Stack

> **For everyone:** A transparent breakdown of every tool, platform, and AI model powering KPMG TrustLens — designed to build trust with technical judges, cross-functional teams, and executive stakeholders alike.

---

## ⚡ At a Glance (Executive Summary)

| Category | Tool / Platform | Purpose |
|---|---|---|
| **AI Intelligence** | OpenAI GPT-4 | Cognitive UX analysis & issue validation |
| **Browser Automation** | Playwright + Chromium | Simulates real user interactions |
| **Accessibility Rules** | axe-core | Industry-standard WCAG rule engine |
| **Full-Stack Platform** | Next.js 16 + TypeScript | Application framework |
| **Export Engine** | docx / pdf-lib / pptxgenjs | Word, PDF & PowerPoint reports |
| **Version Control** | Git + GitHub | Source control & collaboration |

---

## 🤖 AI & Intelligence Layer

### LLM: OpenAI GPT-4
*The "cognitive brain" of the system*

| Property | Details |
|---|---|
| **Model** | `gpt-4` |
| **Provider** | OpenAI API |
| **Temperature** | `0.3` — deliberately low to minimize hallucination and creative drift |
| **Max Tokens** | `3,000` per audit request |
| **Response Format** | Structured `JSON` — enforced via `response_format: json_object` |

**What GPT-4 does in KPMG TrustLens:**
- Receives a DOM snapshot (up to 12,000 characters of raw HTML) plus a list of already-detected issues.
- Evaluates the page like a human accessibility expert — looking for **semantic quality, cognitive load, visual hierarchy, and contextual meaning**.
- Returns up to 8 unique, non-duplicate issues in a strict JSON schema.

**What GPT-4 does NOT do:**
- It does not control the browser or press keys. That is handled by deterministic Playwright scripts.
- It is never the sole source of truth. Every AI finding is tagged with a confidence score (`high`, `medium`, `low`) and cross-referenced against rule-based results.

### AI Agent Orchestration Flow

```
┌─────────────────────────────────────────────────────┐
│                 AUDIT ORCHESTRATOR                  │
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │   Playwright crawls page   │
          │   → captures full HTML     │
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │  Test Runner executes 10   │
          │  browser-based test cases  │
          │  → returns TestResults[]   │
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │   AI Analyzer is called    │
          │   INPUT:                   │
          │   • Page URL & Title       │
          │   • Truncated HTML         │
          │   • Existing issues list   │
          │                            │
          │   PROMPT INSTRUCTS GPT-4:  │
          │   • Act as WCAG expert     │
          │   • Find what tools miss   │
          │   • Evaluate UX & semantics│
          │   • Assign confidence score│
          │                            │
          │   OUTPUT (JSON):           │
          │   • New unique issues only │
          │   • Each with WCAG mapping │
          │   • Confidence: H/M/L      │
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │  Confidence Engine         │
          │  • High → full weight      │
          │  • Medium → 0.7× weight    │
          │  • Low → 0.4× weight       │
          │  AI issues are DEDUCTED    │
          │  less than rule findings   │
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │  Scoring + Report          │
          └────────────────────────────┘
```

---

## 🕷️ Browser Automation Engine

### Playwright
*The "hands and eyes" of the system*

| Property | Details |
|---|---|
| **Library** | `@playwright/test` + `playwright` |
| **Browser** | Chromium (headless) |
| **Role** | Active browser simulation — crawling, clicking, typing, pressing keys |

**What Playwright does:**
- Boots a real Chromium instance for every audit session.
- Executes `page.keyboard.press('Tab')` up to **50 times** per page to trace the actual focus order.
- Submits forms empty to verify accessible error state announcements.
- Handles authenticated portals by navigating through login flows before auditing.
- Waits for lazy-loaded content and SPA route transitions.

### axe-core
*The "rulebook" of the system*

| Property | Details |
|---|---|
| **Library** | `axe-core` via `@axe-core/playwright` |
| **Rules Coverage** | 90+ WCAG 2.2 A and AA rules |
| **Role** | Fast, deterministic baseline scan on every page |

axe-core provides the high-confidence, low-ambiguity rule violations (e.g., "this image has no alt attribute") that the AI layer then builds upon with semantic and UX evaluation.

---

## 🏗️ Application Platform

### Next.js 16 + React
*The full-stack foundation*

| Property | Details |
|---|---|
| **Framework** | Next.js 16.2 (Turbopack) |
| **Language** | TypeScript (strict mode) |
| **Rendering** | Server Actions + Client Components |
| **API** | Next.js Route Handlers (`/app/api/...`) |

The backend and frontend are co-located in a single Next.js application, with asynchronous audit pipelines running in background server processes and the UI polling for updates every 1.5 seconds.

### TypeScript (Strict Mode)
Every engine (`test-runner.ts`, `audit-orchestrator.ts`, `ai-analyzer.ts`) is **100% strongly typed** — eliminating runtime errors and ensuring that data contracts between the Crawl Engine, AI Layer, and Report Generator are enforced at compile time.

---

## 📤 Export & Reporting Engine

| Format | Library | Target Audience |
|---|---|---|
| `.docx` (Word) | `docx` | Product Managers, Design Teams |
| `.pdf` | `pdf-lib` | Executives, Compliance Officers |
| `.pptx` (PowerPoint) | `pptxgenjs` | Award Presentations, C-Suite Reviews |
| `.json` (Raw) | Native `JSON.stringify` | Developers, CI/CD Pipelines |

---

## 🎨 Frontend & Design System

| Tool | Details |
|---|---|
| **Styling** | Vanilla CSS with custom design tokens (CSS variables) |
| **Design Language** | Glassmorphism — backdrop-blur, gradient borders, layered transparency |
| **Typography** | Inter (Google Fonts) |
| **Animations** | CSS `@keyframes` micro-animations for live test log, progress bar, and score gauge |
| **Icons** | Unicode emoji as semantic, zero-dependency icon system |

---

## ☁️ Infrastructure & DevOps

| Tool | Usage |
|---|---|
| **Git + GitHub** | Version control, branched feature development |
| **Railway** | Target deployment platform (Docker-based) |
| **`.env.local`** | Secure key management for `OPENAI_API_KEY` |
| **Node.js** | Runtime environment for Playwright and server processes |
