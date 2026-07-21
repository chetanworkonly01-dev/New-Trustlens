# Technology Stack & System Architecture

> **Audience:** AI Directors, VP of Engineering, Technical Leadership  
> **Purpose:** A structured breakdown of the technology choices, system flow, and AI integration for the KPMG Accessibility Audit Platform.

---

## 1. Frontend (UI Layer)

**Technologies Used:**
*   **Framework:** Next.js 15 (React 18) with App Router.
*   **Language:** TypeScript (for type safety across the stack).
*   **Styling:** Vanilla CSS / custom design tokens for maximum control and premium KPMG branding.

**Why this framework?**
Next.js provides a unified full-stack environment. It allows us to seamlessly blend server-side rendering (for fast initial loads and SEO) with rich client-side interactivity, all within a single monolithic repository. 

**Communication with Backend:**
*   Standard **RESTful API calls** using the native browser `fetch` API.
*   **Real-time updates:** We use a **short-polling mechanism** (fetching `/api/audit/[id]` every 1.5 seconds) to get live progress updates and test logs. This is lightweight, avoids WebSocket connection overhead, and easily passes through corporate firewalls.

**State Management & UI Handling:**
*   We use native **React Hooks** (`useState`, `useEffect`) and Context. Because our data flow is highly localised to the audit session, we intentionally avoided heavy global stores like Redux. 
*   **Handling AI Responses:** The UI is designed to never leave the user waiting in the dark. While the heavy automated and AI tasks run, the UI streams a "live execution log" showing exactly which tests are passing/failing in real-time, building user trust.

---

## 2. Backend (Server Layer)

**Technologies Used:**
*   **Language Environment:** Node.js (TypeScript).
*   **Framework:** Next.js API Routes (Serverless/Node environment).
*   **Core Automation:** Playwright (for headless Chromium browser crawling and DOM inspection).

**API Structure & Request Processing:**
*   Our API is strictly **RESTful**. 
*   **Step-by-step processing:** When a request hits `/api/audit/website`, the API doesn't wait for the 5-minute audit to finish. It instantly returns a generated `Audit ID` and fires off the `audit-orchestrator` as an asynchronous background thread. Doing this prevents HTTP timeout limits.

**Authentication & Authorization:**
*   Currently designed as an open internal/testing tool without a strict auth gateway. For enterprise deployment, we would wrap the Next.js middleware with JWT or OAuth2 (acting as single-sign-on for firm employees).

---

## 3. AI Layer Integration

**Connection to the Model:**
*   We use the **OpenAI API** directly via their official Node SDK.
*   **Model chosen:** `gpt-4`. We use it with a low `temperature` (0.3) to ensure deterministic, highly factual, and reliable outputs rather than creative hallucination.

**Prompt Handling & Parsing:**
*   We dynamically construct prompts by feeding the model a truncated snapshot of the page's HTML (up to 12,000 characters to respect context windows) along with a summary of issues *already found* by the standard rule engine.
*   We force the model to respond in a strict predefined JSON structure using OpenAI's `response_format: { type: 'json_object' }`, which allows our backend orchestrator to safely parse and strongly-type the results without regex scraping.

**Logic Split (Rules vs. AI):**
*   **Backend (Rules):** Handles 100% of deterministic checks (e.g., "Does this image have an empty alt tag?", "Is the contrast ratio exactly 4.5:1?"). Powered by Axe-core and custom scripts.
*   **AI (Context):** Handles subjective user experience tasks (e.g., "Is this alt-text actually meaningful, or does it just say 'image.png'?", "Is the intent of this specific button label confusing for cognitive accessibility?").

---

## 4. Database & Storage

**Current Implementation: In-Memory Map**
*   **Type:** Ephemeral RAM Storage (`Map<string, AuditResult>`).
*   **What is stored:** User configurations, live progress states, execution logs, and full JSON reports.
*   **Why?** For speed to market, prototype validation, and ease of deployment. It avoids database provisioning overhead while proving out the AI logic. All data generated is session-based.

**Future Enterprise Path:**
*   When moving to production scale, this will be swapped for a combination of **PostgreSQL** (to store historical reports and user metadata indefinitely) and **Redis** (to cache active session progress and handle the high-frequency polling from the frontend).

---

## 5. System Flow (Step-by-Step)

Here is exactly how data moves through the system:

1.  **User (Frontend):** Enters URL (e.g., `5paisa.com`), selects WCAG AA standards, and clicks "Start Audit".
2.  **Frontend → Backend:** Sends a `POST` request to the Next.js API with the configuration.
3.  **Backend Response:** Generates a unique UUID and immediately sends it back to the Frontend.
4.  **Backend (Async Orchestrator):** 
    *   Fires up headless Chromium (Playwright) to visit the site.
    *   Runs deterministic rules (axe-core).
    *   Packages the extracted HTML and sends it to the **AI Layer**.
5.  **AI Layer:** GPT-4 analyzes the semantic/UX structure, generates a structured JSON array of context-issues, and returns it to the backend.
6.  **Backend Scoring:** The backend deduplicates AI findings against automated findings, calculates a 0-100 severity-weighted score, and marks the status as `complete`.
7.  **Frontend:** Which has been polling `/api/audit/[id]` every 1.5 seconds, receives the `complete` status and instantly routes the user to the final dashboard and PDF export interface.

---

## 6. Deployment & Infrastructure

**Hosting & Infrastructure:**
*   **Platform:** Railway (PaaS).
*   **Containerization:** We use a custom **Docker** container (defined via `Dockerfile`). This is critical because Playwright requires underlying Linux OS dependencies (libnss3, libatk, etc.) to run headless Chromium, which standard serverless functions (like Vercel) struggle with.

**CI/CD Basics:**
*   Code is versioned in GitHub. Pushes to the `main` or specific environment branches trigger automated Docker builds and zero-downtime rolling deployments on Railway.

**Scalability Approach:**
*   **Current Bottleneck:** Because Playwright UI automation and the In-Memory database share the same Node.js process, memory consumption scales linearly with concurrent audits.
*   **Next Iteration:** Implement a distributed task queue (like BullMQ + Redis). The Next.js API will simply drop audit tasks into the queue, and separate isolated worker nodes will process the heavy browser automation. This allows horizontal scaling of the heavy infrastructure independently of the web frontend.

---

## 7. Real Example Flow (Action: Start website scan)

When a partner clicks "Audit" for a new client site, the technical step-by-step is:

1.  **Initiation:** React captures the URL and calls `POST /api/audit/website`. 
2.  **Handshake:** Node.js generates ID `xyz-123`, saves a `pending` state in RAM, and returns `xyz-123` to the browser.
3.  **Visual Feedback:** The browser navigates to `/audit/xyz-123`. A React `useEffect` interval begins calling `GET /api/audit/xyz-123` every 1500ms, updating the UI progress bar.
4.  **Deep Crawl:** In the background, Playwright boots up, navigates to the URL, bypasses popups, injecting JavaScript to extract the DOM tree and run Axe-core.
5.  **AI Invocation:** The orchestrator packages `<body>...</body>`, sets system instructions ("You are a WCAG expert..."), and awaits the OpenAI HTTP response.
6.  **Resolution:** OpenAi responds, the orchestrator merges the human-like findings, scores the run (e.g., `42/100`), compiles the remediation guide, and updates RAM to `status: complete`.
7.  **Final Render:** On the very next 1.5s frontend poll, React receives the full JSON result object, unmounts the loading spinner, and renders the premium KPMG Executive Summary dashboard.
