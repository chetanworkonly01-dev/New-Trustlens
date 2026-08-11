import { initializeDatabase, executeQuery } from '../lib/db';
import { setAudit } from '../lib/store/audit-store-db';
import type { AuditResult } from '../lib/types/audit';

async function deepCompactDatabaseAudits() {
  console.log('[DeepCompaction] Connecting to database...');
  await initializeDatabase();

  const rows = await executeQuery<{ id: string }>(`SELECT id FROM audits`);
  console.log(`[DeepCompaction] Compacting ${rows.length} audits...`);

  for (const { id } of rows) {
    try {
      const dataRows = await executeQuery<{ audit_data: any }>(
        `SELECT audit_data FROM audits WHERE id = $1`,
        [id]
      );
      if (dataRows.length === 0 || !dataRows[0].audit_data) continue;

      const raw: AuditResult = dataRows[0].audit_data;

      // Deep clean base64 element screenshots > 50KB & unpruned page screenshot dumps
      if (raw.issues) {
        raw.issues = raw.issues.map((i) => ({
          ...i,
          elementScreenshot:
            i.elementScreenshot && i.elementScreenshot.length > 50000
              ? undefined
              : i.elementScreenshot,
        }));
      }

      if (raw.pillarResults?.performance?.pages) {
        raw.pillarResults.performance.pages = raw.pillarResults.performance.pages.map(
          (p) => ({
            ...p,
            screenshot: undefined,
          })
        );
      }

      if (raw.pillarResults?.darkpatterns?.findings) {
        raw.pillarResults.darkpatterns.findings = raw.pillarResults.darkpatterns.findings.map(
          (f) => ({
            ...f,
            evidence: f.evidence
              ? ({ ...f.evidence, screenshotDataUrl: undefined } as any)
              : (f.evidence as any),
          })
        );
      }

      await setAudit(id, raw);
      console.log(`[DeepCompaction] Cleaned ${id}`);
    } catch (err) {
      console.error(`[DeepCompaction] Error processing ${id}:`, err);
    }
  }

  const newSizes = await executeQuery<{ id: string; status: string; bytes: number }>(
    `SELECT id, status, length(audit_data::text) as bytes FROM audits`
  );
  console.log('[DeepCompaction] FINAL ULTRA-LEAN ROW SIZES:', newSizes);
}

deepCompactDatabaseAudits().catch(console.error);
