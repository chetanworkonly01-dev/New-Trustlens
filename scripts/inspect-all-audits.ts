import { initializeDatabase, executeQuery } from '../lib/db';

async function inspect() {
  await initializeDatabase();
  const rows = await executeQuery<{ id: string; user_id: string | null; url: string; status: string; created_at: string }>(
    `SELECT id, user_id, url, status, created_at FROM audits ORDER BY created_at DESC`
  );
  console.log(`Total DB Rows: ${rows.length}`);
  console.log(rows);
}

inspect().catch(console.error);
