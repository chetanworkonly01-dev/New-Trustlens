import { NextRequest, NextResponse } from 'next/server';
import { runPdfAudit } from '@/lib/engines/audit-orchestrator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const auditId = await runPdfAudit(buffer, file.name);

    return NextResponse.json({ auditId, status: 'started' });
  } catch (error) {
    console.error('PDF audit error:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}
