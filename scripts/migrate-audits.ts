/**
 * Migration script: Convert existing JSON file-based audits to PostgreSQL database
 * 
 * Usage: npm run migrate:audits
 * 
 * This script reads all audit JSON files from .audit-data directory and inserts
 * them into the PostgreSQL database, preserving all data including issues, pages,
 * test results, and test logs.
 */
import fs from 'fs';
import path from 'path';
import { initializeDatabase, executeQuery, executeTransaction } from '../lib/db';
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
        console.log(`[Migration] Audit ${audit.id} already exists, skipping`);
        skipCount++;
        continue;
      }

      // Migrate audit to database
      await migrateSingleAudit(audit);
      successCount++;
      console.log(`[Migration] Migrated audit ${audit.id} (${audit.status})`);

    } catch (err) {
      console.error(`[Migration] Failed to migrate ${file}:`, err);
      errorCount++;
    }
  }

  console.log(`[Migration] Migration complete: ${successCount} migrated, ${skipCount} skipped, ${errorCount} errors`);
}

async function migrateSingleAudit(audit: AuditResult) {
  const queries = [];

  // Main audit record
  queries.push({
    text: `INSERT INTO audits (id, url, type, status, progress, progress_message,
           site_profile, audit_config, score_data, crawl_coverage, trust_score,
           pillar_results, pillar_progress, audit_integrity, started_at, completed_at, error)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    params: [
      audit.id,
      audit.config?.url || null,
      audit.config?.type || 'website',
      audit.status,
      audit.progress || 0,
      audit.progressMessage || null,
      audit.siteProfile || null,
      JSON.stringify(audit.config || {}),
      JSON.stringify({
        score: audit.score,
        report: audit.report,
        trustScore: audit.trustScore,
      }),
      JSON.stringify(audit.crawlCoverage || null),
      JSON.stringify(audit.trustScore || null),
      JSON.stringify(audit.pillarResults || null),
      JSON.stringify(audit.pillarProgress || null),
      JSON.stringify(audit.auditIntegrity || null),
      audit.startedAt,
      audit.completedAt || null,
      audit.error || null,
    ]
  });

  // Save pages
  if (audit.pages && audit.pages.length > 0) {
    for (const page of audit.pages) {
      queries.push({
        text: `INSERT INTO audit_pages (audit_id, url, title, timestamp)
               VALUES ($1, $2, $3, $4)`,
        params: [audit.id, page.url, page.title, page.timestamp]
      });
    }
  }

  // Save issues
  if (audit.issues && audit.issues.length > 0) {
    for (const issue of audit.issues) {
      queries.push({
        text: `INSERT INTO audit_issues (id, audit_id, test_id, source, title, description,
               page_url, element, element_html, xpath, wcag_criterion, wcag_name,
               wcag_level, severity, impact, recommendation, code_fix, category,
               confidence, evidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        params: [
          issue.id,
          audit.id,
          issue.testId || null,
          issue.source || null,
          issue.title || '',
          issue.description || null,
          issue.pageUrl || null,
          issue.element || null,
          issue.elementHtml || null,
          issue.xpath || null,
          issue.wcagCriterion || null,
          issue.wcagName || null,
          issue.wcagLevel || null,
          issue.severity || null,
          issue.impact || null,
          issue.recommendation || null,
          issue.codeFix || null,
          issue.category || null,
          issue.confidence || null,
          JSON.stringify({
            checkData: issue.checkData,
            elementScreenshot: issue.elementScreenshot,
          })
        ]
      });
    }
  }

  // Save test results
  if (audit.testResults && audit.testResults.length > 0) {
    for (const test of audit.testResults) {
      queries.push({
        text: `INSERT INTO audit_test_results (audit_id, test_id, test_name, page_url,
               wcag_criterion, wcag_name, wcag_level, status, severity, confidence,
               execution_time, evidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        params: [
          audit.id,
          test.testId || null,
          test.testName || null,
          test.pageUrl || null,
          test.wcagCriterion || null,
          test.wcagName || null,
          test.wcagLevel || null,
          test.status || null,
          test.severity || null,
          test.confidence || null,
          test.executionTime || 0,
          JSON.stringify(test.evidence || {})
        ]
      });
    }
  }

  // Save test logs
  if (audit.testLog && audit.testLog.length > 0) {
    for (const log of audit.testLog) {
      queries.push({
        text: `INSERT INTO audit_test_logs (audit_id, timestamp, test_id, test_name,
               wcag, status, message, page_url, pillar, methodology, phase)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        params: [
          audit.id,
          log.timestamp || null,
          log.testId || null,
          log.testName || null,
          log.wcag || null,
          log.status || null,
          log.message || null,
          log.pageUrl || null,
          log.pillar || null,
          log.methodology || null,
          log.phase || null
        ]
      });
    }
  }

  await executeTransaction(queries);
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateAudits().catch(err => {
    console.error('[Migration] Fatal error:', err);
    process.exit(1);
  });
}

export { migrateAudits };
