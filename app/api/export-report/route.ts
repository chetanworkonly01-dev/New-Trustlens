import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/engines/audit-orchestrator';
import { generateDocx } from '@/lib/export/docx-generator';
import { generatePdf } from '@/lib/export/pdf-generator';
import { generatePptx } from '@/lib/export/pptx-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auditId = url.searchParams.get('id');
  const format = url.searchParams.get('format') || 'docx';

  if (!auditId) {
    return NextResponse.json({ error: 'Missing audit ID' }, { status: 400 });
  }

  if (!['docx', 'pdf', 'pptx'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use: docx, pdf, pptx' }, { status: 400 });
  }

  const audit = getAudit(auditId);
  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  if (audit.status !== 'complete') {
    return NextResponse.json({ error: 'Audit not yet complete', status: audit.status }, { status: 202 });
  }

  if (!audit.report) {
    return NextResponse.json({ error: 'No report data available' }, { status: 404 });
  }

  try {
    let buffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'docx':
        buffer = await generateDocx(audit);
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileExtension = 'docx';
        break;
      case 'pdf':
        buffer = await generatePdf(audit);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;
      case 'pptx':
        buffer = await generatePptx(audit);
        contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        fileExtension = 'pptx';
        break;
      default:
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    // Generate filename
    const date = new Date(audit.startedAt).toISOString().split('T')[0];
    const projectName = (audit.config.url || 'document')
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
    const pillars = (audit.config as any).enabledPillars as string[] | undefined;
    const reportLabel = !pillars || pillars.length === 0 ? 'Accessibility_Audit'
      : pillars.length === 1 ? ({
          accessibility: 'Accessibility_Audit',
          darkpatterns:  'Dark_Pattern_Audit',
          performance:   'Performance_Audit',
          privacy:       'Privacy_Compliance_Audit',
        } as Record<string, string>)[pillars[0]] || 'TrustLens_Audit'
      : pillars.length === 4 ? 'TrustLens_4Pillar_Audit'
      : 'TrustLens_Audit';
    const fileName = `${reportLabel}_${date}_${projectName}.${fileExtension}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also support POST for sending audit data directly
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format, auditId } = body;

    if (!auditId) {
      return NextResponse.json({ error: 'Missing auditId' }, { status: 400 });
    }

    if (!format || !['docx', 'pdf', 'pptx'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use: docx, pdf, pptx' }, { status: 400 });
    }

    // Redirect to GET with params
    const url = new URL(request.url);
    url.searchParams.set('id', auditId);
    url.searchParams.set('format', format);

    return GET(new NextRequest(url.toString()));
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
