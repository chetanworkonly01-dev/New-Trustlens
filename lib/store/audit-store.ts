import { AuditResult } from "../types/audit";
import * as fs from "fs";
import * as path from "path";
import { 
  getAudit as dbGetAudit, 
  setAudit as dbSetAudit, 
  getAllAudits as dbGetAllAudits, 
  deleteAudit as dbDeleteAudit, 
  deleteAllAudits as dbDeleteAllAudits, 
  saveAILearningData 
} from "./audit-store-db";
import { initializeDatabase as dbInitialize } from "../db";

/**
 * Audit Store Dispatcher
 *
 * When STORAGE_MODE='database' in .env.local:
 *   Strictly uses Neon PostgreSQL database (audits table).
 *   No local disk fallback (.audit-data/) is performed.
 *
 * When STORAGE_MODE='file':
 *   Uses local disk storage (.audit-data/).
 */

const DATA_DIR = path.join(process.cwd(), ".audit-data");

/**
 * Returns true if database storage mode is active.
 */
function isDatabaseMode(): boolean {
  return process.env.STORAGE_MODE === "database";
}

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
 * Get a single audit by ID (sync call).
 * Reads from in-memory cache if active.
 */
export function getAudit(id: string): AuditResult | undefined {
  // Check active cache first (for in-progress audits being polled)
  const cached = activeCache.get(id);
  if (cached) return cached;

  if (isDatabaseMode()) {
    // In database mode, async getAuditAsync should be used for DB reads.
    return undefined;
  }

  // Read from disk in file-based mode
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
 */
export function setAudit(id: string, audit: AuditResult): void {
  // Always keep in active cache for fast access during polling
  activeCache.set(id, audit);

  if (isDatabaseMode()) {
    // Strictly save to Neon PostgreSQL database without writing local files
    dbSetAudit(id, audit).catch((err) => {
      console.error(`[AuditStoreDB] Database save failed for ${id}:`, err);
    });
  } else {
    // File-based mode: save to .audit-data/ disk storage
    saveToFile(id, audit);
  }

  // Remove from active cache after terminal state to free memory
  if (audit.status === "complete" || audit.status === "error") {
    setTimeout(() => activeCache.delete(id), 10000);
  }
}

/**
 * Async version for saving audit data directly to active store mode.
 */
export async function setAuditSync(id: string, audit: AuditResult): Promise<void> {
  activeCache.set(id, audit);

  if (isDatabaseMode()) {
    await dbSetAudit(id, audit);
  } else {
    saveToFile(id, audit);
  }

  if (audit.status === "complete" || audit.status === "error") {
    setTimeout(() => activeCache.delete(id), 10000);
  }
}

export const setAuditAsync = setAuditSync;

/**
 * Write audit to disk as JSON file (File mode only).
 */
function saveToFile(id: string, audit: AuditResult): void {
  if (audit.status === "complete" || audit.status === "error") {
    clearTimeout(pendingFlush.get(id));
    pendingFlush.delete(id);
    writeToDisk(id, audit);
    return;
  }

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
 * Get all audits (Sync call).
 */
export function getAllAudits(): AuditResult[] {
  return getAllAuditsSync();
}

export function getAllAuditsSync(): AuditResult[] {
  const audits = new Map<string, AuditResult>();

  if (isDatabaseMode()) {
    // In database mode, getAllAuditsAsync must be used to fetch from Neon DB.
    return Array.from(activeCache.values());
  }

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

  for (const [id, audit] of activeCache) {
    audits.set(id, audit);
  }

  return Array.from(audits.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

/**
 * Delete an audit (Sync call).
 */
export function deleteAudit(id: string): boolean {
  activeCache.delete(id);

  if (isDatabaseMode()) {
    dbDeleteAudit(id).catch(console.error);
    return true;
  }

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
 * Delete all audits (Sync call).
 */
export function deleteAllAudits(): boolean {
  activeCache.clear();

  for (const timeoutId of pendingFlush.values()) {
    clearTimeout(timeoutId);
  }
  pendingFlush.clear();

  if (isDatabaseMode()) {
    dbDeleteAllAudits().catch(console.error);
    return true;
  }

  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
      ensureDataDir();
    }
    return true;
  } catch (err) {
    console.error(`[AuditStore] Failed to delete all audits:`, err);
    return false;
  }
}

// ===== ASYNC DATABASE METHODS =====

/**
 * Reads single audit by ID.
 * In database mode: strictly queries Neon PostgreSQL database.
 */
export async function getAuditAsync(id: string): Promise<AuditResult | undefined> {
  const cached = activeCache.get(id);
  if (cached) return cached;

  if (isDatabaseMode()) {
    return await dbGetAudit(id);
  }

  // File-mode fallback
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

/**
 * Reads all audits.
 * In database mode: strictly queries Neon PostgreSQL database.
 */
export async function getAllAuditsAsync(userId?: string): Promise<AuditResult[]> {
  if (isDatabaseMode()) {
    return await dbGetAllAudits(userId);
  }

  // File-mode fallback
  return getAllAuditsSync();
}

/**
 * Deletes single audit.
 * In database mode: strictly deletes from Neon PostgreSQL database.
 */
export async function deleteAuditAsync(id: string): Promise<boolean> {
  activeCache.delete(id);

  if (isDatabaseMode()) {
    return await dbDeleteAudit(id);
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

/**
 * Deletes all audits.
 * In database mode: strictly deletes from Neon PostgreSQL database.
 */
export async function deleteAllAuditsAsync(userId?: string): Promise<boolean> {
  if (!userId) {
    activeCache.clear();
  } else {
    for (const [id, audit] of activeCache) {
      if (!audit.config?.userId || audit.config?.userId === userId) {
        activeCache.delete(id);
      }
    }
  }

  for (const timeoutId of pendingFlush.values()) {
    clearTimeout(timeoutId);
  }
  pendingFlush.clear();

  if (isDatabaseMode()) {
    return await dbDeleteAllAudits(userId);
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      return true;
    }
    if (userId) {
      const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const data = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
          const audit = JSON.parse(data) as AuditResult;
          if (!audit.config?.userId || audit.config?.userId === userId) {
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
  if (isDatabaseMode() && process.env.DEV_BYPASS_DB !== "true") {
    try {
      await dbInitialize();
      console.log("[AuditStore] Neon DB storage mode initialized");
    } catch (err) {
      console.error("[AuditStore] Database initialization failed:", err);
    }
  }
}
