import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({
  path: '.env.local',
});

const runMigrate = async () => {
  // Use process.env directly for migration since we need to load after dotenv
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not defined');
  }

  const connection = postgres(postgresUrl, { max: 1 });
  const db = drizzle(connection);

  const _start = Date.now();
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  const _end = Date.now();
  process.exit(0);
};

runMigrate().catch((_err) => {
  process.exit(1);
});
