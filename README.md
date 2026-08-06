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

---

## 🏃 Getting Started

### Prerequisites
- **Node.js** 18+
- **npm** (comes with Node.js)
- **PostgreSQL** database (Neon, Supabase, or local)

### 1. Clone and Install
```bash
git clone <repo-url>
cd New-Trustlens
npm install
```

### 2. Set Up Environment Files
Copy the appropriate environment file and fill in your values:

```bash
# For local development
cp .env.local.dev .env.local

# For production
cp .env.production .env.production.local
```

### 3. Configure Database
Update the database connection URL in your `.env.local`:
```
DATABASE_DEV_URL=postgresql://user:password@host:port/database?sslmode=require
```

### 4. Run Database Migrations
```bash
# Add role column (if first time)
npm run migrate:role

# Migrate existing audits (if upgrading from file storage)
npm run migrate:audits
```

### 5. Start the Development Server
```bash
# Local development with dev database
npm run dev:local

# Or default dev (uses DATABASE_URL from .env.local)
npm run dev
```

The app runs at `http://localhost:3000`.

### 6. Build for Production
```bash
npm run build:prod
npm run start:prod
```

---

## 🔑 Environment Variables

### `.env.local` (Local Development)
| Variable | Description | Example |
|---|---|---|
| `DATABASE_DEV_URL` | Dev database connection string | `postgresql://user:pass@host:port/db?sslmode=require` |
| `DATABASE_URL` | Active database URL (set to `DATABASE_DEV_URL`) | Same as `DATABASE_DEV_URL` |
| `STORAGE_MODE` | Storage mode: `database` or `file` | `database` |
| `OPENAI_API_KEY` | OpenAI API key for AI analysis | `sk-...` |
| `NEXTAUTH_URL` | App URL for auth | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth secret key | `your-secret` |
| `JWT_SECRET` | JWT signing secret | `dev-jwt-secret-key` |
| `NODE_ENV` | Environment | `development` |

### `.env.production` (Production)
| Variable | Description | Example |
|---|---|---|
| `DATABASE_PROD_URL` | Production database connection string | `postgresql://user:pass@host:port/db?sslmode=require` |
| `DATABASE_URL` | Active database URL (set to `DATABASE_PROD_URL`) | Same as `DATABASE_PROD_URL` |
| `STORAGE_MODE` | Storage mode: `database` or `file` | `database` |
| `OPENAI_API_KEY` | OpenAI API key for AI analysis | `sk-...` |
| `NEXTAUTH_URL` | App URL for auth | `https://yourdomain.com` |
| `NEXTAUTH_SECRET` | NextAuth secret key | `your-prod-secret` |
| `JWT_SECRET` | JWT signing secret | `prod-jwt-secret-key` |
| `NODE_ENV` | Environment | `production` |

### Environment Resolution
The app resolves database and JWT secrets based on `NODE_ENV`:

- **`npm run dev:local`** → Uses `DATABASE_DEV_URL` and `JWT_SECRET` from `.env.local.dev`
- **`npm run build:prod`** → Uses `DATABASE_PROD_URL` and `JWT_SECRET` from `.env.production`
- **Fallback chain for DB URL:** `DATABASE_URL` → `DATABASE_PROD_URL` (prod) → `DATABASE_DEV_URL` (dev)
- **Fallback chain for JWT:** `JWT_SECRET` → `PROD_JWT_SECRET` (prod) → `DEV_JWT_SECRET` (dev)

---

## 📜 Available Scripts
| Script | Description |
|---|---|
| `npm run dev` | Start dev server (default) |
| `npm run dev:local` | Start dev server with local dev env |
| `npm run build` | Build for production |
| `npm run build:prod` | Build with production env |
| `npm run start` | Start production server |
| `npm run start:prod` | Start with production env |
| `npm run lint` | Run ESLint |
| `npm run test-db` | Test database connection |
| `npm run migrate:audits` | Migrate existing JSON audits to DB |
| `npm run migrate:role` | Add role column to users table |
