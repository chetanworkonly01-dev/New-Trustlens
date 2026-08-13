# KPMG TrustLens — Unified Digital Trust & Experience Intelligence Platform

> **Designing for All. Protecting Every User. Delivering Executive Compliance Confidence.**

---

## 📚 Table of Contents

- [Overview](#-overview)
- [Architecture & System Design](#-architecture--system-design)
  - [Frontend Architecture](#frontend-architecture)
  - [Backend & Engine Architecture](#backend--engine-architecture)
  - [Database & GZIP Payload Compression](#database--gzip-payload-compression)
- [The Four Pillars of Digital Trust](#-the-four-pillars-of-digital-trust)
  - [1. ♿ Accessibility (A11y)](#1--accessibility-a11y)
  - [2. 🕵️ Dark Patterns (Ethical UX)](#2--dark-patterns-ethical-ux)
  - [3. ⚡ Performance & Core Web Vitals](#3--performance--core-web-vitals)
  - [4. 🔒 Privacy & Data Protection](#4--privacy--data-protection)
- [Omni-Channel Export Engine](#-omni-channel-export-engine)
- [Getting Started & Local Setup](#-getting-started--local-setup)
  - [Prerequisites](#prerequisites)
  - [1. Clone and Install](#1-clone-and-install)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Database Initialization & Indexing](#3-database-initialization--indexing)
  - [4. Run Development Server](#4-run-development-server)
- [Deployment Options](#-deployment-options)
  - [Option A: Docker / Container Deployment (AWS EC2 / Render / Railway)](#option-a-docker--container-deployment-aws-ec2--render--railway)
  - [Option B: Vercel Cloud Deployment](#option-b-vercel-cloud-deployment)
- [Environment Variables Reference](#-environment-variables-reference)
- [Authentication & Admin Security](#-authentication--admin-security)
- [Scripts Reference](#-scripts-reference)

---

## 🌟 Overview

**KPMG TrustLens** is the unified digital trust platform that evaluates digital products across **Four Core Pillars** — Accessibility, Dark Patterns, Performance, and Privacy — in a single integrated audit pipeline.

Unlike standard static analysis tools that analyze code snippets in isolation, TrustLens employs an agentic **Test-Driven Execution Model** powered by **Playwright + Chromium** and **Cognitive AI Analysis**. It navigates target websites like a human user, interacting with dynamic elements, bypassing consent gates, testing complex checkout funnels, and validating compliance against international regulations including **WCAG 2.2 AA/AAA**, **EU Digital Services Act (Art. 25)**, **FTC Click-to-Cancel Rule 2024**, **India DPDPA 2023**, and **EU GDPR / US CCPA**.

---

## 🏗️ Architecture & System Design

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND LAYER                                    │
│  Next.js 15 (App Router)  │  TypeScript  │  Theme System  │       │
│  - /audit (New Audit)     │  - /audit-history           │  - /audit/[id] (Report)│
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │  HTTP / REST API
┌────────────────────────────────────────▼──────────────────────────────────────────┐
│                                 BACKEND API LAYER                                 │
│  Next.js Server API Routes (/api/audit/*, /api/auth/*)                            │
│  - JWT Authentication & RBAC Middleware                                           │
│  - Server-Sent Event (SSE) / Live Audit Stream                                    │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼──────────────────────────────────────────┐
│                              AUDIT ORCHESTRATOR PIPELINE                          │
│                                (lib/engines/audit-orchestrator.ts)                 │
│  ├── 🌐 Playwright Crawler (Headless / Interactive Authenticator Window)           │
│  ├── ♿ axe-core Scanner + Custom WCAG Test Runner                                │
│  ├── 🕵️ Dark Pattern 85-Rule Master Taxonomy Engine                               │
│  ├── ⚡ Core Web Vitals & Resource Performance Analyzer                            │
│  ├── 🔒 Privacy & Cookie Consent Tracker Engine                                   │
│  └── 🧠 OpenAI GPT-4 Cognitive UX & Confidence Scoring                            │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │  GZIP Compression ("gz:<base64>")
┌────────────────────────────────────────▼──────────────────────────────────────────┐
│                            DATABASE & STORAGE LAYER                               │
│  PostgreSQL (Neon Cloud DB / Local PG)                                            │
│  - Pool Management (keepAlive: true, max: 10)                                     │
│  - Composite B-Tree Indexes (idx_audits_user_status_created, idx_audits_started)  │
│  - LRU In-Memory Report Caching (0.1ms Report Delivery)                           │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Architecture
- **Framework**: Next.js 15 with App Router (`/app`) & React 19.
- **Styling & Tokens**: Custom Vanilla CSS Tokens, CSS Grid, Glassmorphic Glass-UI Card System, and Dark/Light Mode.
- **Interactive Visualizations**: Dynamic SVG radial gauges, score progress bars, severity badges, and interactive WCAG criterion filtering.
- **Live Stream Terminal**: Real-time audit log streaming giving full visibility into crawler DOM navigation and AI decision-making.

### Backend & Engine Architecture
- **Orchestrator**: `lib/engines/audit-orchestrator.ts` executes autonomous multi-pillar audit pipelines without artificial execution timeouts.
- **Playwright Crawler**: `lib/engines/crawler.ts` provisions stealth Chromium instances, bypassing bot-detection signals and injecting active session storage states.
- **Interactive Portal Authenticator**: `app/api/audit/authenticate-portal/route.ts` opens a visible Chrome window for auditors to log into complex portals (OTP / CAPTCHA / 2FA), harvesting verified session storage states.

### Database & GZIP Payload Compression
- **PostgreSQL Pool**: `lib/db/index.ts` connects via `pg.Pool` tuned with `keepAlive: true` and 100% parameter-bound queries.
- **GZIP Compression (`gz:<base64>`)**: `lib/db/compression.ts` automatically compresses large JSON payloads (`audit_data`), shrinking 3MB DB rows to **~40 KB (96% size reduction)** to ensure infinite scalability on Neon DB.
- **LRU In-Memory Cache**: `completedReportCache` stores decompressed completed audit reports in Node.js server memory, serving report views (`/audit/[id]`) in **0.1 milliseconds**.

---

## 🛡️ The Four Pillars of Digital Trust

### 1. ♿ Accessibility (A11y)
- **Standard Compliance**: Full **WCAG 2.2 Level A, AA, and AAA** evaluation.
- **Automated Engine**: Integrated `axe-core` DOM analyzer combined with custom WCAG test cases.
- **Key Checks**: Keyboard navigation trap detection, focus visibility, contrast ratio analysis ($< 4.5:1$), image `alt` text quality validation, and form label association.

### 2. 🕵️ Dark Patterns (Ethical UX)
- **Taxonomy Engine**: Complete **85-Rule Master Taxonomy** (`DP-OB-01` through `DP-CS-05`) covering:
  - **Obstruction & Roach Motel**: Asymmetric cancellation paths, missing data export options.
  - **Sneaking & Drip Pricing**: Hidden mandatory fees at checkout, preselected add-on products.
  - **Misdirection & Asymmetry**: Low-contrast decline buttons, deceptive strikethrough original prices.
  - **Confirmshaming & Guilt Framing**: Emotional manipulation language on opt-out options.
  - **Social Pressure & Urgency**: Manufactured stock counters and fake live viewer activity badges.
- **Legal Regulation Mapping**: Automatic violation mapping to **EU DSA Art. 25**, **FTC Click-to-Cancel Rule 2024**, **India DPDPA 2023**, and **US CCPA**.

### 3. ⚡ Performance & Core Web Vitals
- **Core Metrics**: Measures Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), Total Blocking Time (TBT), and Time to First Byte (TTFB).
- **Resource Analysis**: Audits render-blocking JavaScript/CSS, uncompressed images, un-cached static assets, and third-party script overhead.

### 4. 🔒 Privacy & Data Protection
- **Tracker Analysis**: Identifies third-party analytics and ad-tracking scripts firing prior to user consent.
- **Consent Integrity**: Validates cookie banner reject/accept symmetry and data minimisation principles under **EU GDPR** and **US CCPA**.

---

## 📄 Omni-Channel Export Engine

TrustLens translates audit data into audience-tailored executive deliverables:
- **PDF Executive Reports**: Generated via `jspdf` & `jspdf-autotable`, rendering visual evidence capture screenshots, executive summary tiles, and role-segmented fixes.
- **Microsoft Word (DOCX)**: Complete editable remediation documentation generated via `docx`.
- **Microsoft PowerPoint (PPTX)**: Board-ready executive presentation decks generated via `pptxgenjs`.

---

## 🏃 Getting Started & Local Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: Neon Cloud DB or local PostgreSQL instance

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/New-Trustlens.git
cd New-Trustlens
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.local.dev .env.local
```

Ensure `.env.local` contains valid database and authentication variables:

```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-weathered-forest-ax0yg5rh-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require
STORAGE_MODE=database
OPENAI_API_KEY=sk-proj-...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key
JWT_SECRET=your-jwt-secret-key-32-chars-minimum
NODE_ENV=development
```

### 3. Database Initialization & Indexing

Initialize PostgreSQL tables and performance B-Tree indexes:

```bash
# Add role column to users table
npm run migrate:role

# Run test connection & verify schema
npm run test-db
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Deployment Options

### Option A: Docker / Container Deployment (AWS EC2 / Render / Railway)

Your repository includes a production-optimized [`Dockerfile`](file:///c:/Users/yasir/Downloads/New-Trustlens/Dockerfile) containing Node.js, Next.js standalone server, and Playwright Chromium binaries.

#### Building & Running locally via Docker:

```bash
# 1. Build Docker image
docker build -t trustlens .

# 2. Run container on Port 3000
docker run -d -p 3000:3000 --env-file .env.local --name trustlens-app trustlens
```

#### Deploying on AWS EC2 (12 Months Free Tier):
1. Launch an Ubuntu 24.04 `t2.micro` or `t3.micro` EC2 instance.
2. SSH into instance and install Docker:
   ```bash
   sudo apt update && sudo apt install -y docker.io git
   ```
3. Clone repository and run Docker:
   ```bash
   sudo docker build -t trustlens .
   sudo docker run -d -p 80:3000 --env-file .env.local trustlens
   ```

---

### Option B: Vercel Cloud Deployment

1. Connect your repository to [vercel.com](https://vercel.com).
2. Set Environment Variables: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`.
3. Click **Deploy**. (Next.js UI, Auth, Dashboard, Reports, and PDF exports run 100% on Vercel).

---

## 🔑 Environment Variables Reference

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `STORAGE_MODE` | Persistence mode (`database` or `file`) | `database` |
| `JWT_SECRET` | Secret key used to sign session JWT tokens | `5f938932d9...` |
| `NEXTAUTH_SECRET` | NextAuth encryption secret | `your-secret` |
| `OPENAI_API_KEY` | OpenAI API key for Cognitive AI UX analysis | `sk-proj-...` |
| `NODE_ENV` | Application environment (`development` or `production`) | `development` |

---

## 🔐 Authentication & Admin Security

### Admin Role & System Setup
- The **first user to sign up** on a fresh deployment is automatically assigned the **`admin`** role.
- Admins can access `/admin/settings` to toggle public registration (`Enable Sign Up` / `Disable Sign Up`).
- Non-admin users attempting to access `/admin/settings` are automatically redirected to the dashboard.

---

## 📜 Scripts Reference

| Script | Description |
| :--- | :--- |
| `npm run dev` | Start Next.js development server. |
| `npm run dev:local` | Start development server using `.env.local.dev`. |
| `npm run build` | Build production Next.js standalone package. |
| `npm run start` | Run production Next.js server. |
| `npm run test-db` | Benchmark database connection and index performance. |
| `npm run migrate:role` | Add `role` column to PostgreSQL `users` table. |
| `npm run migrate:audits` | Migrate legacy file-backed JSON audits to compressed PostgreSQL database. |
| `npm run compact:audits` | Compress all PostgreSQL audit rows using GZIP (`gz:<base64>`). |

---

<p center="align">
  <b>KPMG TrustLens</b> — Built for Enterprise Digital Product Trust & Compliance.
</p>
