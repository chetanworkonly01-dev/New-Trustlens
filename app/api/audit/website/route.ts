import { NextRequest, NextResponse } from 'next/server';
import { runWebsiteAudit } from '@/lib/engines/audit-orchestrator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      url, loginConfig,
      crawlDepth = 2, maxPages = 5,
      includeAI = false,
      wcagLevels = ['A', 'AA'],
      standard = 'WCAG 2.2',
      enabledPillars,
      // New scope fields from UI
      scopeMode = 'general',
      specificUrls,
      selectedJourney,
      journeySteps,
      aiDirection,
      performanceProblemContext,
    } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const auditId = await runWebsiteAudit({
      url,
      type: loginConfig ? 'portal' : 'website',
      loginConfig,
      crawlDepth: Math.min(crawlDepth, 5),
      maxPages: Math.min(maxPages, 200),
      includeAI,
      wcagLevels,
      standard,
      enabledPillars: enabledPillars || ['accessibility', 'darkpatterns', 'performance', 'privacy'],
      // Scope fields
      scopeMode,
      specificUrls: Array.isArray(specificUrls) ? specificUrls : undefined,
      selectedJourney: selectedJourney || undefined,
      journeySteps: Array.isArray(journeySteps) ? journeySteps : undefined,
      aiDirection: aiDirection || undefined,
      performanceProblemContext: performanceProblemContext || undefined,
    });

    return NextResponse.json({ auditId, status: 'started' });
  } catch (error) {
    console.error('Website audit error:', error);
    return NextResponse.json({ error: 'Failed to start audit' }, { status: 500 });
  }
}
