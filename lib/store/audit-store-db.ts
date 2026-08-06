/**
 * Database-backed Audit Store
 * 
 * Implements the same interface as lib/store/audit-store.ts but uses PostgreSQL
 * for persistence instead of local filesystem.
 * 
 * Key benefits:
 * - Survives server restarts
 * - Supports multi-user scenarios
 * - Enables AI learning data collection
 * - Scales with application growth
 */
import { AuditResult, AuditConfig, AuditScore, TestLogEntry } from '../types/audit';
import { executeQuery, executeTransaction, initializeDatabase } from '../db';

// In-memory cache for active (in-progress) audits to avoid excessive database I/O
const activeCache = new Map<string, AuditResult>();

// Initialize database on module load
let dbInitialized = false;

function ensureDatabase(): void {
  if (dbInitialized) return;
  dbInitialized = true;
  initializeDatabase().catch(err => {
    console.error('[AuditStoreDB] Database initialization failed:', err);
  });
}

/**
 * Get a single audit by ID.
 * Returns from memory cache if in-progress, otherwise reads from database.
 */
export async function getAudit(id: string): Promise<AuditResult | undefined> {
  ensureDatabase();

  // Check active cache first (for in-progress audits being polled)
  const cached = activeCache.get(id);
  if (cached) return cached;

  try {
    // Get main audit record
    const auditRows = await executeQuery<Record<string, unknown>>(
      `SELECT * FROM audits WHERE id = $1`,
      [id]
    );

    if (auditRows.length === 0) return undefined;
    
    const auditRow = auditRows[0] as Record<string, unknown>;
    
    // Reconstruct the full AuditResult object
    const audit: AuditResult = {
      id: auditRow.id as string,
      config: (auditRow.audit_config || {}) as AuditConfig,
      status: auditRow.status as string as "pending" | "crawling" | "scanning" | "analyzing" | "scoring" | "generating" | "complete" | "error",
      progress: (auditRow.progress as number) || 0,
      progressMessage: (auditRow.progress_message as string) || '',
      pages: [], // Will be populated from separate table
      issues: [], // Will be populated from separate table
      score: ((auditRow.score_data as Record<string, unknown>)?.score as unknown) as AuditScore || createEmptyScore(),
      testResults: [], // Will be populated from separate table
      testLog: [], // Will be populated from separate table
      inapplicableCriteria: [],
      startedAt: auditRow.started_at as string,
      ...(auditRow.completed_at ? { completedAt: auditRow.completed_at as string } : {}),
      ...(auditRow.error ? { error: auditRow.error as string } : {}),
      
      // Optional fields
      ...((auditRow.trust_score as Record<string, unknown>) ? { trustScore: auditRow.trust_score as Record<string, unknown> } : {}),
      ...(auditRow.pillar_results ? { pillarResults: auditRow.pillar_results as Record<string, unknown> } : {}),
      ...(auditRow.pillar_progress ? { pillarProgress: auditRow.pillar_progress as Record<string, unknown> } : {}),
      ...(auditRow.crawl_coverage ? { crawlCoverage: auditRow.crawl_coverage as Record<string, unknown> } : {}),
      ...(auditRow.audit_integrity ? { auditIntegrity: auditRow.audit_integrity as Record<string, unknown> } : {}),
      ...(auditRow.site_profile ? { siteProfile: auditRow.site_profile as string } : {}),
    } as AuditResult;

    // Load related data in parallel
    const [pages, issues, testResults, testLogs] = await Promise.all([
      executeQuery<Record<string, unknown>>(`SELECT url, title, timestamp FROM audit_pages WHERE audit_id = $1 ORDER BY created_at`, [id]),
      executeQuery<Record<string, unknown>>(`SELECT * FROM audit_issues WHERE audit_id = $1 ORDER BY created_at`, [id]),
      executeQuery<Record<string, unknown>>(`SELECT * FROM audit_test_results WHERE audit_id = $1 ORDER BY created_at`, [id]),
      executeQuery<Record<string, unknown>>(`SELECT timestamp, test_id as "testId", test_name as "testName", 
        wcag, status, message, page_url as "pageUrl", pillar, methodology, phase 
        FROM audit_test_logs WHERE audit_id = $1 ORDER BY timestamp`, [id]),
    ]);

    audit.pages = (pages as Record<string, unknown>[]).map(p => ({
      url: p.url as string,
      title: p.title as string,
      html: '', // Not stored in DB for performance
      timestamp: p.timestamp as string,
    }));

    const issuesArr = issues as Record<string, unknown>[];
    audit.issues = issuesArr.map(i => ({
      id: i.id as string,
      testId: i.test_id as string,
      title: i.title as string,
      description: i.description as string,
      element: i.element as string,
      ...(i.element_html ? { elementHtml: i.element_html as string } : {}),
      ...(i.xpath ? { xpath: i.xpath as string } : {}),
      ...(i.check_data ? { checkData: i.check_data as Record<string, unknown> } : {}),
      ...(i.element_screenshot ? { elementScreenshot: i.element_screenshot as string } : {}),
      pageUrl: i.page_url as string,
      wcagCriterion: i.wcag_criterion as string,
      wcagName: i.wcag_name as string,
      wcagLevel: (i.wcag_level as string) as "A" | "AA" | "AAA",
      severity: (i.severity as string) as "critical" | "high" | "medium" | "low",
      impact: i.impact as string,
      recommendation: i.recommendation as string,
      ...(i.code_fix ? { codeFix: i.code_fix as string } : {}),
      category: (i.category as string) as "perceivable" | "operable" | "understandable" | "robust" | "pdf",
      source: (i.source as string) as "axe-core" | "custom-rule" | "pdf-analyzer" | "ai-analysis" | "journey-test" | "test-runner",
      confidence: (i.confidence as string) as "high" | "medium" | "low",
    }));

    const testResultsArr = testResults as Record<string, unknown>[];
    audit.testResults = testResultsArr.map(t => ({
      testId: t.test_id as string,
      testName: t.test_name as string,
      pageUrl: t.page_url as string,
      status: (t.status as string) as ("pending" | "running" | "pass" | "fail" | "error" | "needs-review"),
      wcagCriterion: t.wcag_criterion as string,
      wcagName: t.wcag_name as string,
      wcagLevel: (t.wcag_level as string) as "A" | "AA" | "AAA",
      severity: (t.severity as string) as "critical" | "high" | "medium" | "low",
      confidence: (t.confidence as string) as "high" | "medium" | "low",
      evidence: (t.evidence as unknown) as Record<string, unknown> & { summary: string; elementsChecked: number; elementsFailed: number; details: string[] },
      issues: [],
      executionTime: t.execution_time as number,
      ...(typeof t.error === 'string' ? { error: t.error } : {}),
    }));

    audit.testLog = (testLogs as unknown) as TestLogEntry[];

    // Reconstruct report if it exists in score_data
    const scoreData = (auditRow.score_data || {}) as Record<string, unknown>;
    if (scoreData?.report) {
      audit.report = scoreData.report as unknown as AuditResult["report"];
    }

    return audit;
  } catch (err) {
    console.error(`[AuditStoreDB] Failed to read audit ${id}:`, err);
    return undefined;
  }
}

/**
 * Save/update an audit.
 * In-progress audits are kept in memory cache for fast polling.
 * Completed/errored audits are flushed to database.
 */
export async function setAudit(id: string, audit: AuditResult): Promise<void> {
  ensureDatabase();

  // Always keep in active cache for fast access
  activeCache.set(id, audit);

  try {
    if (audit.status === 'complete' || audit.status === 'error') {
      // Terminal state - save everything to database immediately
      await saveFullAudit(id, audit);
      setTimeout(() => activeCache.delete(id), 10000);
    } else {
      // In-progress - save essential progress data (debounced by caller or periodic)
      await upsertAuditProgress(id, audit);
    }
  } catch (err) {
    console.error(`[AuditStoreDB] Failed to save audit ${id}:`, err);
    // Continue - data is in cache and will be saved when complete
  }
}

/**
 * Upsert audit progress (for in-progress audits)
 * Only saves essential fields, not full data
 */
async function upsertAuditProgress(id: string, audit: AuditResult): Promise<void> {
  await executeQuery(
    `INSERT INTO audits (id, user_id, url, type, status, progress, progress_message, 
     audit_config, score_data, started_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       status = EXCLUDED.status,
       progress = EXCLUDED.progress,
       progress_message = EXCLUDED.progress_message,
       audit_config = EXCLUDED.audit_config,
       score_data = EXCLUDED.score_data,
       updated_at = NOW()`,
    [
      id,
      audit.config?.userId || null,
      audit.config?.url || null,
      audit.config?.type || 'website',
      audit.status,
      audit.progress,
      audit.progressMessage,
      JSON.stringify(audit.config || {}),
      JSON.stringify({
        score: audit.score,
        trustScore: audit.trustScore,
        pillarResults: audit.pillarResults,
        crawlCoverage: audit.crawlCoverage,
        pillarProgress: audit.pillarProgress,
        auditIntegrity: audit.auditIntegrity,
        siteProfile: audit.siteProfile,
      }),
      audit.startedAt,
    ]
  );
}

/**
 * Save full audit data (for completed audits)
 */
async function saveFullAudit(id: string, audit: AuditResult): Promise<void> {
  const mainAuditQuery = {
    text: `INSERT INTO audits (id, user_id, url, type, status, progress, progress_message,
           site_profile, audit_config, score_data, crawl_coverage, trust_score,
           pillar_results, pillar_progress, audit_integrity, started_at, completed_at, error, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
           ON CONFLICT (id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             status = EXCLUDED.status,
             progress = EXCLUDED.progress,
             progress_message = EXCLUDED.progress_message,
             score_data = EXCLUDED.score_data,
             crawl_coverage = EXCLUDED.crawl_coverage,
             trust_score = EXCLUDED.trust_score,
             pillar_results = EXCLUDED.pillar_results,
             pillar_progress = EXCLUDED.pillar_progress,
             audit_integrity = EXCLUDED.audit_integrity,
             completed_at = EXCLUDED.completed_at,
             error = EXCLUDED.error,
             updated_at = NOW()`,
    params: [
      id,
      audit.config?.userId || null,
      audit.config?.url || null,
      audit.config?.type || 'website',
      audit.status,
      audit.progress,
      audit.progressMessage,
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
  };

  const queries = [mainAuditQuery];

  // Save pages
  if (audit.pages && audit.pages.length > 0) {
    for (const page of audit.pages) {
      queries.push({
        text: `INSERT INTO audit_pages (audit_id, url, title, timestamp)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (id) DO UPDATE SET
                 url = EXCLUDED.url,
                 title = EXCLUDED.title`,
        params: [id, page.url, page.title, page.timestamp]
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
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                       $16, $17, $18, $19, $20)
               ON CONFLICT (id) DO UPDATE SET
                 title = EXCLUDED.title,
                 severity = EXCLUDED.severity`,
        params: [
          issue.id,
          id,
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
               status, wcag_criterion, wcag_name, wcag_level, severity, confidence,
               execution_time, evidence)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        params: [
          id,
          test.testId || null,
          test.testName || null,
          test.pageUrl || null,
          test.status || null,
          test.wcagCriterion || null,
          test.wcagName || null,
          test.wcagLevel || null,
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
          id,
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

/**
 * Get all audits (optionally filtered by user ID).
 * Returns most recent first.
 */
export async function getAllAudits(userId?: string): Promise<AuditResult[]> {
  ensureDatabase();

  try {
    const query = userId
      ? `SELECT id, url, type, status, progress, progress_message, started_at, completed_at, error,
                score_data, audit_config, crawl_coverage, trust_score, site_profile, pillar_progress, audit_integrity
         FROM audits 
         WHERE user_id = $1 
         ORDER BY started_at DESC`
      : `SELECT id, url, type, status, progress, progress_message, started_at, completed_at, error,
                score_data, audit_config, crawl_coverage, trust_score, site_profile, pillar_progress, audit_integrity
         FROM audits 
         ORDER BY started_at DESC`;

    const rows = userId 
      ? await executeQuery<Record<string, unknown>>(query, [userId])
      : await executeQuery<Record<string, unknown>>(query);

    return rows.map(row => {
      const scoreData = (row.score_data || {}) as Record<string, unknown>;
      const trustScore = row.trust_score as Record<string, unknown>;
      
      return {
        id: row.id as string,
        config: (row.audit_config || {}) as AuditConfig,
        status: row.status as string,
        progress: (row.progress as number) || 0,
        progressMessage: (row.progress_message as string) || '',
        pages: [],
        issues: [],
        score: (scoreData.score as unknown) as AuditScore || createEmptyScore(),
        testResults: [],
        testLog: [],
        inapplicableCriteria: [],
        startedAt: row.started_at as string,
        ...(row.completed_at ? { completedAt: row.completed_at as string } : {}),
        ...(row.error ? { error: row.error as string } : {}),
        ...(trustScore ? { trustScore } : {}),
        ...(row.site_profile ? { siteProfile: row.site_profile as string } : {}),
      } as unknown as AuditResult;
    });
  } catch (err) {
    console.error('[AuditStoreDB] Failed to list audits:', err);
    return [];
  }
}

/**
 * Delete an audit from both cache and database.
 */
export async function deleteAudit(id: string): Promise<boolean> {
  ensureDatabase();
  
  activeCache.delete(id);
  
  try {
    await executeQuery(`DELETE FROM audits WHERE id = $1`, [id]);
    return true;
  } catch (err) {
    console.error(`[AuditStoreDB] Failed to delete audit ${id}:`, err);
    return false;
  }
}

/**
 * Deletes ALL audits from the cache and the database.
 * If userId is provided, only deletes that user's audits.
 */
export async function deleteAllAudits(userId?: string): Promise<boolean> {
  ensureDatabase();

  // Clear in-memory cache only for relevant audits
  if (!userId) {
    activeCache.clear();
  } else {
    for (const [id, audit] of activeCache) {
      if (audit.config?.userId === userId) {
        activeCache.delete(id);
      }
    }
  }

  try {
    if (userId) {
      // Delete only this user's audits - need to get audit IDs first since child tables use audit_id
      const auditIds = await executeQuery<{ id: string }>(
        `SELECT id FROM audits WHERE user_id = $1`,
        [userId]
      );
      for (const row of auditIds) {
        await executeQuery(`DELETE FROM audits WHERE id = $1`, [row.id]);
      }
    } else {
      await executeQuery(`DELETE FROM audits`);
      await executeQuery(`DELETE FROM audit_issues`);
      await executeQuery(`DELETE FROM audit_pages`);
      await executeQuery(`DELETE FROM audit_test_results`);
      await executeQuery(`DELETE FROM audit_test_logs`);
      await executeQuery(`DELETE FROM audit_reports`);
    }
    return true;
  } catch (err) {
    console.error('[AuditStoreDB] Failed to delete all audits:', err);
    return false;
  }
}

/**
 * Save AI learning data for training purposes
 */
export async function saveAILearningData(data: {
  auditId: string;
  findingId?: string;
  aiModelVersion: string;
  aiConfidenceScore: number;
  findingType: string;
  promptUsed: string;
  rawResponse: Record<string, unknown>;
}): Promise<void> {
  ensureDatabase();
  
  try {
    await executeQuery(
      `INSERT INTO ai_learning_data 
       (audit_id, finding_id, ai_model_version, ai_confidence_score, finding_type, 
        prompt_used, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.auditId,
        data.findingId || null,
        data.aiModelVersion,
        data.aiConfidenceScore,
        data.findingType,
        data.promptUsed,
        JSON.stringify(data.rawResponse)
      ]
    );
  } catch (err) {
    console.error('[AuditStoreDB] Failed to save AI learning data:', err);
  }
}

function createEmptyScore() {
  return {
    overall: 0,
    categoryScores: {
      perceivable: 0,
      operable: 0,
      understandable: 0,
      robust: 0,
      pdf: 0,
    },
    complianceLevel: "non-compliant" as const,
    totalIssues: 0,
    uniqueIssues: 0,
    issueBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    issueByLevel: { A: 0, AA: 0, AAA: 0 },
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
  };
}
