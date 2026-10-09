import { NextRequest, NextResponse } from 'next/server';
import { getAuditAsync, setAuditAsync } from '@/lib/store/audit-store';
import { getSessionFromCookiesAsync } from '@/lib/auth';
import { recordDarkPatternFeedback } from '@/lib/engines/dark-pattern-learning';

import type { DarkPatternFinding } from '@/lib/types/darkpattern';
import { PRINCIPLE_WEIGHTS } from '@/lib/types/darkpattern';
import type { EthicalPrinciple } from '@/lib/types/darkpattern';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────
// PATCH /api/audit/[id]/reject-finding
// Body: { findingId: string; reason?: string }
//
// Marks a dark-pattern finding as a false positive, recalculates
// ethicsScore excluding rejected findings, and persists the result.
// ─────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookiesAsync(request);
  const userId = session?.user?.id;

  const { id } = await params;

  let body: { findingId?: string; reason?: string; undo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { findingId, reason, undo = false } = body;
  if (!findingId) {
    return NextResponse.json({ error: 'findingId is required' }, { status: 400 });
  }

  const audit = await getAuditAsync(id);
  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  // Ownership check
  if (userId && audit.config.userId && audit.config.userId !== userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }


  // Locate the finding inside pillarResults.darkpatterns.findings
  const dpResult = audit.pillarResults?.darkpatterns;
  if (!dpResult) {
    return NextResponse.json({ error: 'No dark pattern results found for this audit' }, { status: 404 });
  }

  const finding = (dpResult.findings as DarkPatternFinding[]).find(f => f.id === findingId);
  if (!finding) {
    return NextResponse.json({ error: `Finding ${findingId} not found` }, { status: 404 });
  }

  // Apply or reverse rejection
  if (undo) {
    delete finding.rejected;
    delete finding.rejectionReason;
    delete finding.rejectedAt;
  } else {
    finding.rejected = true;
    finding.rejectionReason = reason || 'Marked as false positive';
    finding.rejectedAt = new Date().toISOString();

    // Save rich learning feedback into dark_pattern_learning table in PostgreSQL asynchronously (non-blocking)
    const elementDesc = finding.element || finding.elementSelector || finding.title || 'Interactive UI Component';
    const richPatternType = `${finding.ruleId || 'DP-RULE'}: ${finding.title || finding.category || 'Dark Pattern'}`;
    const richReason = reason
      ? `${reason} (Pattern: ${finding.description || 'Dismissed by auditor'})`
      : `Marked as false positive by auditor: ${finding.description || 'Dismissed finding'}`;

    recordDarkPatternFeedback({
      patternType: richPatternType,
      elementSelector: elementDesc,
      action: 'false_positive',
      reason: richReason,
    }).catch(learnErr => {
      console.warn('[RejectFinding] Failed to save dark pattern learning record:', learnErr);
    });
  }

  // ── Recalculate ethics score excluding rejected findings ──
  const activeFindings = (dpResult.findings as DarkPatternFinding[]).filter(f => !f.rejected);

  const allPrinciples: EthicalPrinciple[] = [
    'informed-consent',
    'symmetry-of-choice',
    'transparency',
    'user-autonomy',
    'accessibility-clarity',
  ];

  // Per-principle score — start at 100, deduct for each active finding
  const severityDeductions: Record<string, number> = { critical: 20, high: 12, medium: 6, low: 3 };
  const principleScores: Record<EthicalPrinciple, number> = {} as Record<EthicalPrinciple, number>;
  for (const p of allPrinciples) principleScores[p] = 100;

  for (const f of activeFindings) {
    const p = f.principle as EthicalPrinciple;
    if (principleScores[p] === undefined) continue;
    const deduction = severityDeductions[f.severity] ?? 6;
    const exemptFactor = f.complianceExemption?.scoreReductionFactor ?? 1;
    principleScores[p] = Math.max(0, principleScores[p] - deduction * exemptFactor);
  }

  let weightedSum = 0, totalWeight = 0;
  for (const p of allPrinciples) {
    const w = PRINCIPLE_WEIGHTS[p];
    weightedSum += principleScores[p] * w;
    totalWeight += w;
  }
  const newEthicsScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;

  // Patch the result object
  dpResult.ethicsScore = newEthicsScore;
  dpResult.totalFindings = activeFindings.length;
  dpResult.principleScores = principleScores;

  // Rebuild findingsBySeverity from active findings only
  const findingsBySeverity: Record<string, number> = {};
  for (const f of activeFindings) {
    findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] || 0) + 1;
  }
  dpResult.findingsBySeverity = findingsBySeverity;

  // Save the updated audit back to the store
  await setAuditAsync(id, audit);

  return NextResponse.json({
    success: true,
    finding: { id: finding.id, rejected: finding.rejected ?? false },
    updatedEthicsScore: newEthicsScore,
    activeFindings: activeFindings.length,
  });
}
