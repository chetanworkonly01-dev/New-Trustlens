/**
 * Application initialization module
 * Handles database initialization and migration on startup
 */
import { initDatabase } from './store/audit-store';

let initialized = false;

export async function initApp(): Promise<void> {
  if (initialized) return;
  
  console.log('[TrustLens] Initializing application...');
  
  // Initialize database connection
  await initDatabase();
  
  initialized = true;
  console.log('[TrustLens] Application initialized');
}
