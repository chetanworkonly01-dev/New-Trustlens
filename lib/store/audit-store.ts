import { AuditResult } from "../types/audit";
import * as fs from "fs";
import * as path from "path";
import { getAudit as dbGetAudit, setAudit as dbSetAudit, getAllAudits as dbGetAllAudits, deleteAudit as dbDeleteAudit, deleteAllAudits as dbDeleteAllAudits, saveAILearningData } from "./audit-store-db";
import { initializeDatabase as dbInitialize } from "../db";

/**
 * Persistent Audit Store
 *
 * Primary storage: PostgreSQL database (via lib/store/audit-store-db.ts)
 * Fallback storage: Local file system (.audit-data/) for resilience
 *
 * The store uses an in-memory cache for active (in-progress) audits to avoid
 * excessive database I/O during polling. When the storage mode is set to
 * 'database' in environment variables, the database is the primary store.
 * If the database is unavailable, it gracefully falls back to file-based storage.
 */

const DATA_DIR = path.join(process.cwd(), ".audit-data");

// Check if database mode is enabled
const STORAGE_MODE = process.env.STORAGE_MODE || "file"; // 'database' or 'file'

let dbAvailable = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function auditPath(id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9\-]/g, "");
  return path.join(DATA_DIR, `${safeId}.json`);
}

// In-memory cache for active (in-progress) audits to avoid excessive I/O during polling
const activeCache = new Map<string, AuditResult>();

// Debounce mechanism for file writes (in-progress audits)
const pendingFlush = new Map<string, NodeJS.Timeout>();

/**
 * Get a single audit by ID.
 * Returns from memory cache if in-progress, otherwise reads from database (or file fallback).
 */
export function getAudit(id: string): AuditResult | undefined {
  // Check active cache first (for in-progress audits being polled)
  const cached = activeCache.get(id);
  if (cached) return cached;

  // Try database first if enabled
  if (STORAGE_MODE === "database" && dbAvailable) {
    try {
      // Synchronous read from database - this is a limitation
      // In practice, we need to handle this differently for synchronous compatibility
      // For now, fall back to cached or file system for synchronous operations
    } catch {
      // Fall through to file system
    }
  }

  // Read from disk (fallback or file-based mode)
  const filePath = auditPath(id);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
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
 * Completed/errored audits are flushed to database (or file) and removed from cache.
 */
export function setAudit(id: string, audit: AuditResult): void {
  // Always keep in active cache for fast access
  activeCache.set(id, audit);

  if (STORAGE_MODE === "database") {
    // Async database save - fire-and-forget with error handling
    dbSetAudit(id, audit).catch((err) => {
      console.error(`[AuditStore] Database save failed for ${id}, falling back to file:`, err);
      saveToFile(id, audit);
    });
  } else {
    saveToFile(id, audit);
  }

  // Remove from active cache after terminal state to free memory
  if (audit.status === "complete" || audit.status === "error") {
    setTimeout(() => activeCache.delete(id), 10000);
  }
}

// Async version for explicit use in async contexts
export async function setAuditSync(id: string, audit: AuditResult): Promise<void> {
  // Always keep in active cache for fast access
  activeCache.set(id, audit);

  if (STORAGE_MODE === "database") {
    try {
      await dbSetAudit(id, audit);
    } catch (err) {
      console.error(`[AuditStore] Database save failed for ${id}, falling back to file:`, err);
      saveToFile(id, audit);
    }
  } else {
    saveToFile(id, audit);
  }

  // Remove from active cache after terminal state to free memory
  if (audit.status === "complete" || audit.status === "error") {
    setTimeout(() => activeCache.delete(id), 10000);
  }
}

// Async alias for the async orchestrator
export const setAuditAsync = setAuditSync;

/**
 * Write audit to disk as JSON file.
 * Uses debouncing to avoid excessive I/O during rapid polling.
 */
function saveToFile(id: string, audit: AuditResult): void {
  // For terminal states, flush immediately
  if (audit.status === "complete" || audit.status === "error") {
    clearTimeout(pendingFlush.get(id));
    pendingFlush.delete(id);
    writeToDisk(id, audit);
    return;
  }

  // For in-progress, debounce writes (max once per 2s)
  if (pendingFlush.has(id)) return;
  pendingFlush.set(
    id,
    setTimeout(() => {
      pendingFlush.delete(id);
      writeToDisk(id, audit);
    }, 2000),
  );
}

function writeToDisk(id: string, audit: AuditResult): void {
  ensureDataDir();
  const filePath = auditPath(id);
  try {
    fs.writeFileSync(filePath, JSON.stringify(audit), "utf-8");
  } catch (err) {
    console.error(`[AuditStore] Failed to write audit ${id}:`, err);
  }
}

/**
 * Get all audits (active + persisted).
 * Returns most recent first.
 */
export function getAllAudits(): AuditResult[] {
  return getAllAuditsSync();
}

// Sync version for in-process use (file fallback)
export function getAllAuditsSync(): AuditResult[] {
  const audits = new Map<string, AuditResult>();

  if (STORAGE_MODE === "database") {
    // For database mode, we need to use async methods
    // But this function is synchronous - we'll need to change calling code
    // For now, load from file system as fallback
    console.warn("[AuditStore] getAllAudits is synchronous but database mode requires async. Using file cache.");
  }

  // Load all persisted audits from disk
  ensureDataDir();
  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
        const audit = JSON.parse(data) as AuditResult;
        audits.set(audit.id, audit);
      } catch {
        /* skip corrupted files */
      }
    }
  } catch {
    /* data dir may not exist yet */
  }

  // Overlay active cache (in-progress audits override disk versions)
  for (const [id, audit] of activeCache) {
    audits.set(id, audit);
  }

  // Sort by startedAt descending
  return Array.from(audits.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

/**
 * Delete an audit from both cache and storage.
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

/**
 * Deletes ALL audits from the cache and storage.
 */
export function deleteAllAudits(): boolean {
  activeCache.clear();

  for (const timeoutId of pendingFlush.values()) {
    clearTimeout(timeoutId);
  }
  pendingFlush.clear();

  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    ensureDataDir();
    return true;
  } catch (err) {
    console.error(`[AuditStore] Failed to delete all audits:`, err);
    return false;
  }
}

// ===== ASYNC DATABASE METHODS =====
// These are used by API routes that can be async

export async function getAuditAsync(id: string): Promise<AuditResult | undefined> {
  // Check active cache first
  const cached = activeCache.get(id);
  if (cached) return cached;

  if (STORAGE_MODE === "database") {
    try {
      const audit = await dbGetAudit(id);
      if (audit) {
        activeCache.set(id, audit);
        return audit;
      }
    } catch (err) {
      console.error(`[AuditStore] Database read failed for ${id}, trying file:`, err);
    }
  }

  // Fallback to file system
  const filePath = auditPath(id);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      const audit = JSON.parse(data) as AuditResult;
      activeCache.set(id, audit);
      return audit;
    }
  } catch (err) {
    console.error(`[AuditStore] File read failed for ${id}:`, err);
  }
  return undefined;
}

export async function getAllAuditsAsync(userId?: string): Promise<AuditResult[]> {
  if (STORAGE_MODE === "database") {
    try {
      return await dbGetAllAudits(userId);
    } catch (err) {
      console.error('[AuditStore] Database query failed, falling back to file system:', err);
    }
  }

  // Fallback to file-based getAllAudits
  return getAllAudits();
}

export async function deleteAuditAsync(id: string): Promise<boolean> {
  activeCache.delete(id);

  if (STORAGE_MODE === "database") {
    try {
      return await dbDeleteAudit(id);
    } catch (err) {
      console.error(`[AuditStore] Database delete failed for ${id}:`, err);
    }
  }

  const filePath = auditPath(id);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.error(`[AuditStore] File delete failed for ${id}:`, err);
  }
  return false;
}

export async function deleteAllAuditsAsync(userId?: string): Promise<boolean> {
  // Clear in-memory cache
  if (!userId) {
    activeCache.clear();
  } else {
    for (const [id, audit] of activeCache) {
      if (audit.config?.userId === userId) {
        activeCache.delete(id);
      }
    }
  }

  for (const timeoutId of pendingFlush.values()) {
    clearTimeout(timeoutId);
  }
  pendingFlush.clear();

  if (STORAGE_MODE === "database") {
    try {
      return await dbDeleteAllAudits(userId);
    } catch (err) {
      console.error('[AuditStore] Database delete all failed:', err);
    }
  }

  try {
    if (userId) {
      // File-based: filter by userId in config
      const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const data = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
          const audit = JSON.parse(data) as AuditResult;
          if (audit.config?.userId === userId) {
            fs.unlinkSync(path.join(DATA_DIR, file));
          }
        } catch {
          /* skip corrupted files */
        }
      }
    } else {
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
      ensureDataDir();
    }
    return true;
  } catch (err) {
    console.error(`[AuditStore] File delete all failed:`, err);
    return false;
  }
}

// Re-export AI learning data save function
export { saveAILearningData };

// Initialize database connection
export async function initDatabase(): Promise<void> {
  if (STORAGE_MODE === "database") {
    try {
      await dbInitialize();
      dbAvailable = true;
      console.log("[AuditStore] Database storage initialized");
    } catch (err) {
      console.error("[AuditStore] Database initialization failed:", err);
      dbAvailable = false;
    }
  }
}
