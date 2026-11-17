import { NextRequest, NextResponse } from 'next/server';
import { getAuditAsync } from '@/lib/store/audit-store';
import { generateDocx } from '@/lib/export/docx-generator';
import { generatePdf } from '@/lib/export/pdf-generator';
import { generatePptx } from '@/lib/export/pptx-generator';
import { sanitizeAuditForExport } from '@/lib/export/report-helpers';
import { consolidateAudits } from '@/lib/export/consolidate-audits';
import type { AuditResult } from '@/lib/types/audit';

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

  const auditRaw = await getAuditAsync(auditId);
  if (!auditRaw) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  if (auditRaw.status !== 'complete') {
    return NextResponse.json({ error: 'Audit not yet complete', status: auditRaw.status }, { status: 202 });
  }

  if (!auditRaw.report) {
    return NextResponse.json({ error: 'No report data available' }, { status: 404 });
  }

  // Filter out false positive/rejected findings and recalculate score for export
  const audit = sanitizeAuditForExport(auditRaw);

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

// Also support POST for sending audit data directly or consolidating multiple audits
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format = 'pdf', auditId, auditIds } = body;

    if (!format || !['docx', 'pdf', 'pptx'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use: docx, pdf, pptx' }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────
    // CONSOLIDATED MULTI-AUDIT EXPORT (When auditIds array is provided)
    // ─────────────────────────────────────────────────────────────
    if (Array.isArray(auditIds) && auditIds.length >= 2) {
      const audits = (
        await Promise.all(auditIds.map((id: string) => getAuditAsync(id)))
      ).filter(Boolean) as AuditResult[];

      if (audits.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 valid audits are required to consolidate' },
          { status: 400 }
        );
      }

      const incomplete = audits.find((a) => a.status !== 'complete');
      if (incomplete) {
        return NextResponse.json(
          { error: `Audit ${incomplete.id} is not yet complete` },
          { status: 400 }
        );
      }

      const consolidatedAudit = consolidateAudits(audits);
      const audit = sanitizeAuditForExport(consolidatedAudit);

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

      const date = new Date().toISOString().split('T')[0];
      const projectName = (audit.config.url || 'website')
        .replace(/https?:\/\//, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50);

      const fileName = `TrustLens_Consolidated_Audit_${date}_${projectName}.${fileExtension}`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(buffer.length),
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // SINGLE AUDIT EXPORT (Preserved 100% as before)
    // ─────────────────────────────────────────────────────────────
    if (!auditId) {
      return NextResponse.json({ error: 'Missing auditId or auditIds' }, { status: 400 });
    }

    // Redirect to GET with params
    const url = new URL(request.url);
    url.searchParams.set('id', auditId);
    url.searchParams.set('format', format);

    return GET(new NextRequest(url.toString()));
  } catch (error) {
    console.error('Export POST error:', error);
    return NextResponse.json(
      { error: 'Failed to export document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
