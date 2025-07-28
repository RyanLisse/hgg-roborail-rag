import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '.env.test',
});

// Test-specific Drizzle configuration
// Uses the test database branch for migrations and schema operations
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // For test environment, use the test database URL
    // biome-ignore lint: Forbidden non-null assertion.
    url: process.env.POSTGRES_URL!,
  },
});
