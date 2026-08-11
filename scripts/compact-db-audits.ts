import { initializeDatabase, executeQuery } from '../lib/db';
import { setAudit } from '../lib/store/audit-store-db';
import type { AuditResult } from '../lib/types/audit';

async function compactDatabaseAudits() {
  console.log('[Compaction] Initializing database connection...');
  await initializeDatabase();

  const rows = await executeQuery<{ id: string }>(`SELECT id FROM audits`);
  console.log(`[Compaction] Found ${rows.length} audits in Neon DB to compact.`);

  for (const { id } of rows) {
    try {
      const dataRows = await executeQuery<{ audit_data: any }>(
        `SELECT audit_data FROM audits WHERE id = $1`,
        [id]
      );
      if (dataRows.length === 0 || !dataRows[0].audit_data) continue;

      const rawAudit: AuditResult = dataRows[0].audit_data;

      // Clean unpruned page screenshots inside pillarResults
      if (rawAudit.pillarResults) {
        if (rawAudit.pillarResults.performance && rawAudit.pillarResults.performance.pages) {
          rawAudit.pillarResults.performance.pages = rawAudit.pillarResults.performance.pages.map((p) => ({
            ...p,
            screenshot: undefined,
          }));
        }
        if (rawAudit.pillarResults.darkpatterns && rawAudit.pillarResults.darkpatterns.findings) {
          rawAudit.pillarResults.darkpatterns.findings = rawAudit.pillarResults.darkpatterns.findings.map((f) => ({
            ...f,
            evidence: f.evidence ? ({ ...f.evidence, screenshotDataUrl: undefined } as any) : (f.evidence as any),
          }));
        }
      }

      // Re-save via setAudit (applies sanitizeAuditForStorage & updates all columns)
      await setAudit(id, rawAudit);
      console.log(`[Compaction] Compacted audit ${id}`);
    } catch (err) {
      console.error(`[Compaction] Failed to compact audit ${id}:`, err);
    }
  }

  const newSizes = await executeQuery<{ id: string; status: string; bytes: number }>(
    `SELECT id, status, length(audit_data::text) as bytes FROM audits`
  );
  console.log('[Compaction] Final DB Row Sizes:', newSizes);
}

compactDatabaseAudits().catch(console.error);
