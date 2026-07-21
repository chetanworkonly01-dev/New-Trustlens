import { NextRequest, NextResponse } from 'next/server';
import { parsePerfProblemText } from '@/lib/engines/problem-parser';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const result = await parsePerfProblemText(text.slice(0, 1000));
    return NextResponse.json(result);
  } catch (err) {
    console.error('[parse-perf-context] Error:', err);
    return NextResponse.json({ flags: [], confidence: {}, reasoning: 'Error' }, { status: 200 });
  }
}
