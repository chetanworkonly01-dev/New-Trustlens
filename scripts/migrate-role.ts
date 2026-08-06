import 'dotenv/config';
import { executeQuery } from '../lib/db';

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  
  try {
    // Check if role column already exists
    const columns = await executeQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'`
    );
    
    if (columns.length === 0) {
      console.log('Adding role column to users table...');
      await executeQuery(`ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL`);
      console.log('Role column added successfully');
    } else {
      console.log('Role column already exists');
    }

    // Mark the first user (by created_at) as admin if no admin exists
    const adminExists = await executeQuery(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`
    );

    if (adminExists.length === 0) {
      const firstUser = await executeQuery<{ id: string }>(
        `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`
      );
      
      if (firstUser.length > 0) {
        await executeQuery(`UPDATE users SET role = 'admin' WHERE id = $1`, [firstUser[0].id]);
        console.log(`Promoted first user (id: ${firstUser[0].id}) to admin`);
      }
    } else {
      console.log('Admin user already exists');
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
