/**
 * Database connection and initialization for TrustLens
 * 
 * Uses PostgreSQL (compatible with Neon, Supabase, etc.)
 * Replaces file-based storage in lib/store/audit-store.ts
 */
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'production'
    ? process.env.DATABASE_PROD_URL
    : process.env.DATABASE_DEV_URL) ||
  '';

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
  if (process.env.DEV_BYPASS_DB === 'true') {
    console.log('[TrustLens DB] Database bypassed via DEV_BYPASS_DB env var');
    return false;
  }
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

// Schema creation SQL - Streamlined strictly to 3 Core Tables (users, audits, system_settings)
const SCHEMA_SQL = `
-- Drop legacy normalized tables if they exist
DROP TABLE IF EXISTS audit_pages, audit_issues, audit_test_results, ai_model_performance, audit_test_logs, audit_reports, ai_learning_data CASCADE;

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash TEXT,
    role VARCHAR(20) DEFAULT 'user' NOT NULL,
    reset_token TEXT,
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. Audits table (stores full AuditResult as JSONB)
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
    audit_data JSONB,
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

-- Ensure audit_data column exists if table was created previously
ALTER TABLE audits ADD COLUMN IF NOT EXISTS audit_data JSONB;

-- 3. System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

INSERT INTO system_settings (key, value)
VALUES ('is_signup_allowed', 'false')
ON CONFLICT (key) DO NOTHING;

-- 4. Dark Pattern Learning table (Minimal feedback store)
CREATE TABLE IF NOT EXISTS dark_pattern_learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(100) NOT NULL,
    element_selector TEXT NOT NULL,
    action VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_dp_learning_domain ON dark_pattern_learning(domain);
CREATE INDEX IF NOT EXISTS idx_dp_learning_action ON dark_pattern_learning(action);
`;

let schemaInitialized = false;

// Initialize the database schema
export async function initializeDatabase(): Promise<void> {
  if (schemaInitialized) return;
  const isConnected = await testConnection();
  if (!isConnected) {
    console.warn('[TrustLens DB] Skipping schema initialization - database not reachable');
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(SCHEMA_SQL);
      schemaInitialized = true;
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
  if (process.env.DEV_BYPASS_DB === 'true') {
    return [];
  }
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
  if (process.env.DEV_BYPASS_DB === 'true') {
    return [];
  }
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
