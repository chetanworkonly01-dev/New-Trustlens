import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────
// POST /api/audit/authenticate-portal
// Body: { url: string; timeoutSeconds?: number }
//
// Launches a headful (visible) Chromium window for the user to log in
// manually (enter credentials, OTP, solve CAPTCHA). Captures and
// returns the resulting browser storageState (cookies & localStorage).
// ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: { url?: string; timeoutSeconds?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, timeoutSeconds = 180 } = body;
  if (!url) {
    return NextResponse.json({ error: "Target URL is required" }, { status: 400 });
  }

  console.log(`[InteractiveAuth] Launching headful Chrome window for ${url}...`);

  let browser: import("playwright").Browser | undefined;
  try {
    // Launch visible Chrome browser window on host system with clean incognito context
    browser = await chromium.launch({
      headless: false,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--start-maximized",
        "--no-sandbox",
      ],
    });

    const context = await browser.newContext({
      viewport: null, // Default to window size
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Navigate to target URL
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Wait until browser context is closed by user OR timeout expires OR explicit authenticated page reached
    const maxWaitMs = timeoutSeconds * 1000;
    const startTime = Date.now();

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        // 1. Check if browser or window was closed manually by user
        if (!browser || !browser.isConnected() || context.pages().length === 0) {
          console.log("[InteractiveAuth] Window closed by user! Capturing session state.");
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // 2. Timeout fallback (3 minutes)
        if (elapsed >= maxWaitMs) {
          console.log("[InteractiveAuth] Max timeout reached. Capturing active session state.");
          clearInterval(checkInterval);
          resolve();
          return;
        }
      }, 1000);
    });

    // Capture captured cookies and localStorage state before closing
    let storageState = null;
    let cookieCount = 0;

    if (browser.isConnected()) {
      storageState = await context.storageState();
      cookieCount = storageState.cookies?.length || 0;
      await browser.close().catch(() => {});
    }

    if (!storageState || cookieCount === 0) {
      return NextResponse.json(
        {
          error: "No session cookies captured. Please ensure you completed sign-in in the Chrome window.",
        },
        { status: 400 }
      );
    }

    console.log(`[InteractiveAuth] Successfully captured ${cookieCount} session cookies for ${url}`);

    return NextResponse.json({
      success: true,
      storageState,
      cookieCount,
      message: `Successfully captured ${cookieCount} active session cookies & storage tokens!`,
    });
  } catch (err: unknown) {
    if (browser && browser.isConnected()) {
      await browser.close().catch(() => {});
    }
    const message = err instanceof Error ? err.message : "Authentication error";
    console.error("[InteractiveAuth] Error during interactive authentication:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
