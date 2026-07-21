import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/store/audit-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit/screenshot?id=<auditId>&url=<encodedPageUrl>
 *
 * Serves the Playwright-captured screenshot for a specific page within an audit.
 * Screenshots are stored as base64 PNG strings in PageData.screenshot.
 * Returns the raw PNG bytes so the UI can use a normal <img src="..."> tag.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id  = searchParams.get('id');
  const url = searchParams.get('url');

  if (!id || !url) {
    return NextResponse.json({ error: 'Missing id or url' }, { status: 400 });
  }

  const audit = getAudit(id);
  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  // Find exact URL match first, then fall back to any page that has a screenshot
  const page = audit.pages?.find(p => p.url === url && p.screenshot)
            ?? audit.pages?.find(p => p.screenshot);

  if (!page?.screenshot) {
    return NextResponse.json({ error: 'No screenshot available' }, { status: 404 });
  }

  const buffer = Buffer.from(page.screenshot, 'base64');
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, immutable',
      'X-Page-Url': page.url,
    },
  });
}
