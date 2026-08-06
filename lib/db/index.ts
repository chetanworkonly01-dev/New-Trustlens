/**
 * Database connection and initialization for TrustLens
 * 
 * Uses PostgreSQL (compatible with Neon, Supabase, etc.)
 * Replaces file-based storage in lib/store/audit-store.ts
 */
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

if (!connectionString) {
  console.error('[TrustLens DB] DATABASE_URL is not configured. Database storage will not work.');
}

// Connection pool with minimal config for serverless compatibility
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : true,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test the connection on module load
let connectionTested = false;

async function testConnection() {
  if (connectionTested) return true;
  
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    connectionTested = true;
    console.log('[TrustLens DB] Connection successful');
    return true;
  } catch (err) {
    console.error('[TrustLens DB] Connection failed:', err);
    return false;
  }
}

// Schema creation SQL
const SCHEMA_SQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash TEXT,
    reset_token TEXT,
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Audits table (main audit records)
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    url TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'website',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    progress_message TEXT,
    site_profile VARCHAR(100),
    audit_config JSONB,
    score_data JSONB,
    crawl_coverage JSONB,
    trust_score JSONB,
    pillar_results JSONB,
    pillar_progress JSONB,
    audit_integrity JSONB,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Audit pages table
CREATE TABLE IF NOT EXISTS audit_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    html TEXT,
    screenshot TEXT, -- base64 encoded
    timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Issues table (normalized from audit results)
CREATE TABLE IF NOT EXISTS audit_issues (
    id UUID PRIMARY KEY,
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    test_id VARCHAR(100),
    source VARCHAR(50),
    title TEXT NOT NULL,
    description TEXT,
    page_url TEXT,
    element TEXT,
    element_html TEXT,
    xpath TEXT,
    wcag_criterion VARCHAR(20),
    wcag_name TEXT,
    wcag_level VARCHAR(10),
    severity VARCHAR(20),
    impact TEXT,
    recommendation TEXT,
    code_fix TEXT,
    category VARCHAR(50),
    confidence VARCHAR(20),
    evidence JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Test results table
CREATE TABLE IF NOT EXISTS audit_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    test_id VARCHAR(100),
    test_name TEXT,
    page_url TEXT,
    status VARCHAR(20),
    wcag_criterion VARCHAR(20),
    wcag_name TEXT,
    wcag_level VARCHAR(10),
    severity VARCHAR(20),
    confidence VARCHAR(20),
    execution_time INTEGER,
    evidence JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Test logs table
CREATE TABLE IF NOT EXISTS audit_test_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    timestamp TIMESTAMP,
    test_id VARCHAR(100),
    test_name TEXT,
    wcag VARCHAR(20),
    status VARCHAR(20),
    message TEXT,
    page_url TEXT,
    pillar VARCHAR(50),
    methodology TEXT,
    phase TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Export reports table
CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    report_type VARCHAR(50),
    file_path TEXT,
    generated_by UUID REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- AI training data table
CREATE TABLE IF NOT EXISTS ai_learning_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES audit_issues(id) ON DELETE SET NULL,
    ai_model_version VARCHAR(100),
    ai_confidence_score DECIMAL(3,2),
    finding_type VARCHAR(50),
    prompt_used TEXT,
    raw_response JSONB,
    user_feedback TEXT,
    ground_truth JSONB,
    evaluated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- AI model performance tracking
CREATE TABLE IF NOT EXISTS ai_model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version VARCHAR(100) NOT NULL,
    audit_type VARCHAR(50),
    finding_category VARCHAR(50),
    precision_score DECIMAL(3,2),
    recall_score DECIMAL(3,2),
    feedback_count INTEGER DEFAULT 0,
    evaluated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_issues_audit_id ON audit_issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_source ON audit_issues(source);
CREATE INDEX IF NOT EXISTS idx_audit_issues_severity ON audit_issues(severity);
CREATE INDEX IF NOT EXISTS idx_audit_pages_audit_id ON audit_pages(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_test_results_audit_id ON audit_test_results(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_test_logs_audit_id ON audit_test_logs(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_audit_id ON audit_reports(audit_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_audit_id ON ai_learning_data(audit_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_model_feedback ON ai_learning_data(ai_model_version, user_feedback);
`;

// Initialize the database schema
export async function initializeDatabase(): Promise<void> {
  const isConnected = await testConnection();
  if (!isConnected) {
    console.warn('[TrustLens DB] Skipping schema initialization - database not reachable');
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(SCHEMA_SQL);
      console.log('[TrustLens DB] Schema initialized successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[TrustLens DB] Schema initialization failed:', err);
    throw err;
  }
}

// Execute a query with error handling
export async function executeQuery<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (err) {
    console.error('[TrustLens DB] Query failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Execute a query within a transaction
export async function executeTransaction<T = Record<string, unknown>>(
  queries: { text: string; params?: unknown[] }[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results: T[] = [];
    for (const query of queries) {
      const result = await client.query(query.text, query.params);
      results.push(result.rows as T);
    }
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[TrustLens DB] Transaction failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
