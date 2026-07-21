# KPMG TrustLens: AI-Powered Digital Compliance & Experience Intelligence
**Unified Digital Trust Platform. Designing for All. Protecting Every User.**

---

## 📚 Project Documentation

| Document | Description |
|---|---|
| [🏗️ Architecture](docs/architecture.md) | Full system design, data flow, and component breakdown |
| [🛠️ Tools & Tech Stack](docs/tools.md) | All platforms, LLMs, AI agents, and infrastructure |
| [🧠 Skills](docs/skills.md) | Competencies demonstrated across UX, AI, and engineering |
| [📜 AI Rules & Ethics](docs/rules.md) | How the AI agent behaves and its ethical mandates |
| [🎬 Demo Strategy](docs/demo-script-strategy.md) | 5-minute award pitch run-of-show script |

---

## Why KPMG TrustLens?
Current digital compliance tools are fragmented — accessibility scanners miss dark patterns, performance tools ignore privacy, and none speak the language of business leadership.

**KPMG TrustLens is different.** It is the industry's first unified digital trust platform that audits across **four pillars** — Accessibility, Dark Patterns, Performance, and Privacy — in a single sweep. We bypassed standard "code scanning" and built an agentic **Test-Driven Execution Model** supervised by Cognitive AI that actually *uses* the application like a human would, evaluating true User Experience (UX), cognitive load, ethical friction, and regulatory compliance.

## 🛡️ The Four Pillars of Digital Trust

| Pillar | What It Audits |
|---|---|
| ♿ **Accessibility** | WCAG 2.2 (A/AA/AAA), keyboard navigation, screen reader compatibility, cognitive load |
| 🕵️ **Dark Patterns** | Deceptive UI, forced actions, misdirection, confirmshaming, ethical friction scoring |
| ⚡ **Performance** | Core Web Vitals, resource optimization, render-blocking assets, bundle analysis |
| 🔒 **Privacy** | GDPR/DPDPA compliance, tracker detection, cookie consent, data collection practices |

## 💼 Business Value & Enterprise ROI
* **Mitigate Legal Risk & Brand Damage:** Go beyond basic WCAG compliance by catching functional barriers, dark patterns, and privacy violations that trigger litigation.
* **Expand Market Reach:** 1 in 4 adults live with a disability. KPMG TrustLens ensures your digital storefront is truly accessible to a $8 Trillion market segment.
* **Unified Compliance Dashboard:** One audit, four pillars, one Trust Score — eliminating the need for 4+ separate tools.
* **Accelerate Cross-Functional Velocity:**
  * **For Leadership:** Automated PowerPoint executive summaries with Trust Score.
  * **For PMs & Designers:** Human-readable UX analysis and Word docs prioritizing user impact.
  * **For Engineers:** Developer-ready JSON outputs with generated code fixes.

## ✨ The Premium UI/UX Experience
KPMG TrustLens doesn't just evaluate design — it embodies premium design.
* **Glassmorphic Aesthetics:** A modern, immersive, high-contrast dashboard with dynamic micro-animations.
* **Live Test Visibility:** A terminal-style live execution log that visualizes the AI's "thought process" and browser actions in real-time, building user trust.
* **Smart Data Visualization:** Circular score gauges, color-coded severity badges, and intuitive progress tracking to eliminate data fatigue.

## ⚙️ Core Innovations
1. **Deep User-Journey Testing:** Securely authenticates, traverses pagination, and tests complete checkout/login flows — catching errors standard scanners miss.
2. **Cognitive AI Analysis:** Evaluates the *quality* of UI elements (e.g., determining if image alt-text is actually meaningful or if button labels are too vague).
3. **Zero-Hallucination Testing:** Strict test execution (pressing real `Tab` keys via Playwright) married with heuristic AI validation ensures 100% deterministic, evidence-backed reporting.
4. **Multi-Pillar Trust Score:** Weighted composite scoring across all four audit pillars with regulatory mapping to WCAG 2.2, GDPR, DPDPA 2023, and more.

## 🛠 Strategic Technologies
* **Frontend/Backend:** Next.js 16 (React 19), TypeScript, CSS Design Tokens & Micro-animations
* **Active Browser Simulation:** Playwright + Chromium
* **Intelligence Layer:** OpenAI GPT-4 (Cognitive UX Analysis)
* **Accessibility Rules Engine:** axe-core (WCAG 2.2)
* **Ethical UX Engine:** Custom dark pattern detection with 7-layer analysis
* **Omni-Channel Export Engine:** docx, pdf-lib, pptxgenjs

## 🚀 Deployment
* **Platform:** Railway (Docker-based)
* **Health Check:** `GET /api/health`
* **Data Store:** File-backed JSON with persistent volume (PostgreSQL upgrade path available)
