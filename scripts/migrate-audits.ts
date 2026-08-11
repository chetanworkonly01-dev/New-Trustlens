/**
 * Migration script: Convert existing JSON file-based audits to PostgreSQL database
 * 
 * Usage: npm run migrate:audits
 */
import fs from 'fs';
import path from 'path';
import { initializeDatabase, executeQuery } from '../lib/db';
import { setAudit } from '../lib/store/audit-store-db';
import type { AuditResult } from '../lib/types/audit';

const DATA_DIR = path.join(process.cwd(), ".audit-data");

async function migrateAudits() {
  console.log('[Migration] Starting audit data migration...');

  // Initialize database
  await initializeDatabase();
  console.log('[Migration] Database connected');

  // Check if data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    console.log('[Migration] No .audit-data directory found. Nothing to migrate.');
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  console.log(`[Migration] Found ${files.length} audit files to migrate`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      const audit: AuditResult = JSON.parse(data);

      // Check if audit already exists in database
      const existing = await executeQuery(
        `SELECT id FROM audits WHERE id = $1`,
        [audit.id]
      );

      if (existing.length > 0) {
        console.log(`[Migration] Audit ${audit.id} already exists, updating JSONB...`);
      }

      // Migrate audit to database
      await setAudit(audit.id, audit);
      successCount++;
      console.log(`[Migration] Migrated audit ${audit.id} (${audit.status})`);

    } catch (err) {
      console.error(`[Migration] Failed to migrate ${file}:`, err);
      errorCount++;
    }
  }

  console.log(`[Migration] Migration complete: ${successCount} processed, ${skipCount} skipped, ${errorCount} errors`);
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateAudits().catch(err => {
    console.error('[Migration] Fatal error:', err);
    process.exit(1);
  });
}

export { migrateAudits };
