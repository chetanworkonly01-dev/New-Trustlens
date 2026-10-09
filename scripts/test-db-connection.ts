import { initializeDatabase } from '../lib/db';
import { getAllAudits, getAuditCount } from '../lib/store/audit-store-db';

async function test() {
  console.log('[Test] Connecting to Neon DB...');
  const start = Date.now();
  await initializeDatabase();
  console.log(`[Test] Connection ready in ${Date.now() - start}ms`);

  const queryStart = Date.now();
  const [audits, count] = await Promise.all([
    getAllAudits(undefined, 3),
    getAuditCount(),
  ]);
  console.log(`[Test] Fetched 3 items + count (${count} total) in ${Date.now() - queryStart}ms!`);
  console.log('[Test] Items:', audits.map(a => ({ id: a.id, url: a.config.url, score: a.score.overall })));
}

test().catch(console.error);
