import { NextResponse } from "next/server";
import { deleteAllAudits } from "@/lib/store/audit-store";

export const dynamic = "force-dynamic";

export async function GET() {
  console.log(
    "✅ [App Router] Attempting to hit /api/audits/clear-all endpoint.",
  );

  const success = deleteAllAudits();

  if (success) {
    return NextResponse.json({
      message: "All audit history has been cleared.",
      success: true,
    });
  }

  return NextResponse.json(
    { message: "Failed to clear audit history.", success: false },
    { status: 500 },
  );
}
