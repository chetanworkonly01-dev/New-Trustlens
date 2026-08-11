import { NextRequest, NextResponse } from "next/server";
import { deleteAllAuditsAsync } from "@/lib/store/audit-store";
import { getSessionFromCookiesAsync } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log(
    "✅ [App Router] Attempting to hit /api/audits/clear-all endpoint.",
  );

  const session = await getSessionFromCookiesAsync(request);
  if (!session?.user?.id) {
    return NextResponse.json(
      { message: "Authentication required.", success: false },
      { status: 401 },
    );
  }

  const success = await deleteAllAuditsAsync(session.user.id);

  if (success) {
    return NextResponse.json({
      message: "Audit history cleared.",
      success: true,
    });
  }

  return NextResponse.json(
    { message: "Failed to clear audit history.", success: false },
    { status: 500 },
  );
}
