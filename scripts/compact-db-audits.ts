import { initializeDatabase, executeQuery } from '../lib/db';
import { sanitizeAuditForStorage } from '../lib/store/audit-store-db';
import { compressPayload, decompressPayload } from '../lib/db/compression';
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

      const rawAudit = decompressPayload<AuditResult>(dataRows[0].audit_data);
      if (!rawAudit) continue;

      // Clean unpruned page screenshots inside pillarResults and storageState in config
      const sanitized = sanitizeAuditForStorage(rawAudit);

      await executeQuery(
        `UPDATE audits SET audit_config = $1, audit_data = $2, pillar_results = $3 WHERE id = $4`,
        [
          JSON.stringify(sanitized.config || {}),
          compressPayload(sanitized),
          JSON.stringify(sanitized.pillarResults || null),
          id,
        ]
      );
      console.log(`[Compaction] Compacted & GZIP compressed audit ${id}`);
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
