import { NextResponse } from 'next/server';
import { recordDarkPatternFeedback, DarkPatternFeedbackInput } from '@/lib/engines/dark-pattern-learning';
import { getSessionFromCookiesAsync } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookiesAsync(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const { patternType, elementSelector, action, reason } = body;

    if (!patternType || !elementSelector || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: patternType, elementSelector, and action are required.' },
        { status: 400 }
      );
    }

    if (action !== 'false_positive' && action !== 'verified') {
      return NextResponse.json(
        { error: "Invalid action. Must be 'false_positive' or 'verified'." },
        { status: 400 }
      );
    }

    const feedbackInput: DarkPatternFeedbackInput = {
      patternType,
      elementSelector,
      action,
      reason: reason || undefined,
    };

    const success = await recordDarkPatternFeedback(feedbackInput);

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Dark pattern global feedback (${action}) recorded successfully.`,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to persist feedback in database.' },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
