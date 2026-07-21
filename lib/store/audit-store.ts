import { AuditResult } from '../types/audit';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Persistent Audit Store
 * 
 * Replaces the in-memory Map<string, AuditResult> with a file-backed store
 * that survives server restarts. Each audit is stored as a separate JSON file
 * in the data directory for fast individual reads.
 * 
 * UPGRADE PATH:
 * - Replace this module with a PostgreSQL-backed implementation
 * - Keep the same exported API: get(), set(), getAll(), delete()
 * - Add connection pooling via pg or Prisma
 */

const DATA_DIR = path.join(process.cwd(), '.audit-data');

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function auditPath(id: string): string {
  // Sanitize ID to prevent path traversal
  const safeId = id.replace(/[^a-zA-Z0-9\-]/g, '');
  return path.join(DATA_DIR, `${safeId}.json`);
}

// In-memory cache for active (in-progress) audits to avoid excessive disk I/O during polling
const activeCache = new Map<string, AuditResult>();

/**
 * Get a single audit by ID.
 * Returns from memory cache if in-progress, otherwise reads from disk.
 */
export function getAudit(id: string): AuditResult | undefined {
  // Check active cache first (for in-progress audits being polled)
  const cached = activeCache.get(id);
  if (cached) return cached;

  // Read from disk
  const filePath = auditPath(id);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as AuditResult;
    }
  } catch (err) {
    console.error(`[AuditStore] Failed to read audit ${id}:`, err);
  }
  return undefined;
}

/**
 * Save/update an audit.
 * In-progress audits are kept in memory cache for fast polling.
 * Completed/errored audits are flushed to disk and removed from cache.
 */
export function setAudit(id: string, audit: AuditResult): void {
  // Always keep in active cache for fast access
  activeCache.set(id, audit);

  // Always flush to disk so in-progress audits survive HMR/server restarts
  flushToDisk(id, audit);

  // Remove from active cache after terminal state to free memory
  if (audit.status === 'complete' || audit.status === 'error') {
    setTimeout(() => activeCache.delete(id), 10000);
  }
}

/**
 * Write audit to disk as JSON file.
 * Uses compact JSON and debouncing to avoid excessive I/O during rapid polling.
 */
const pendingFlush = new Map<string, NodeJS.Timeout>();

function flushToDisk(id: string, audit: AuditResult): void {
  // For terminal states, flush immediately
  if (audit.status === 'complete' || audit.status === 'error') {
    clearTimeout(pendingFlush.get(id));
    pendingFlush.delete(id);
    writeToDisk(id, audit);
    return;
  }

  // For in-progress, debounce writes (max once per 2s)
  if (pendingFlush.has(id)) return;
  pendingFlush.set(id, setTimeout(() => {
    pendingFlush.delete(id);
    writeToDisk(id, audit);
  }, 2000));
}

function writeToDisk(id: string, audit: AuditResult): void {
  ensureDataDir();
  const filePath = auditPath(id);
  try {
    fs.writeFileSync(filePath, JSON.stringify(audit), 'utf-8');
  } catch (err) {
    console.error(`[AuditStore] Failed to write audit ${id}:`, err);
  }
}

/**
 * Get all audits (active + persisted).
 * Returns most recent first.
 */
export function getAllAudits(): AuditResult[] {
  const audits = new Map<string, AuditResult>();

  // Load all persisted audits from disk
  ensureDataDir();
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
        const audit = JSON.parse(data) as AuditResult;
        audits.set(audit.id, audit);
      } catch { /* skip corrupted files */ }
    }
  } catch { /* data dir may not exist yet */ }

  // Overlay active cache (in-progress audits override disk versions)
  for (const [id, audit] of activeCache) {
    audits.set(id, audit);
  }

  // Sort by startedAt descending
  return Array.from(audits.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

/**
 * Delete an audit from both cache and disk.
 */
export function deleteAudit(id: string): boolean {
  activeCache.delete(id);
  const filePath = auditPath(id);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.error(`[AuditStore] Failed to delete audit ${id}:`, err);
  }
  return false;
}
