import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({
  path: '.env.test',
});

const runTestMigrate = async () => {
  // Use process.env directly for migration since we need to load after dotenv
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not defined in test environment');
  }

  console.log('Running migrations on test database...');
  console.log('Database URL:', postgresUrl.replace(/:[^:@]*@/, ':***@')); // Hide password

  const connection = postgres(postgresUrl, { max: 1 });
  const db = drizzle(connection);

  const start = Date.now();
  try {
    await migrate(db, { migrationsFolder: './lib/db/migrations' });
    const end = Date.now();
    console.log(`Test database migration completed in ${end - start}ms`);
  } catch (error) {
    console.error('Test migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }

  process.exit(0);
};

runTestMigrate().catch((err) => {
  console.error('Test migration error:', err);
  process.exit(1);
});
