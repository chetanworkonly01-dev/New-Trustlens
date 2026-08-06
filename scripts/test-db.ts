import 'dotenv/config';
import { initializeDatabase } from '../lib/db';

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('STORAGE_MODE:', process.env.STORAGE_MODE);
  
  try {
    await initializeDatabase();
    console.log('Database initialization complete');
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

main();
