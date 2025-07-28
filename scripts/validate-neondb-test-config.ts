#!/usr/bin/env node

/**
 * NeonDB Test Branch Configuration Validator
 * Validates that test environment is properly isolated from production
 */

import { config } from "dotenv";
import { Client } from "pg";

interface DatabaseConfig {
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;
  POSTGRES_URL_NO_SSL?: string;
  DATABASE_URL_DIRECT?: string;
  NEON_DATABASE_URL?: string;
}

// Load production config
config({ path: ".env.local" });
const prodConfig: DatabaseConfig = {
  DATABASE_URL: process.env.DATABASE_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
};

// Load test config
config({ path: ".env.test" });
const testConfig: DatabaseConfig = {
  DATABASE_URL: process.env.DATABASE_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
  POSTGRES_URL_NO_SSL: process.env.POSTGRES_URL_NO_SSL,
  DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
};

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

log("🔍 NeonDB Test Branch Configuration Validation\n");

// 1. Validate URL structure and separation
log("📋 Configuration Analysis:");
log("=".repeat(50));

function extractDbName(url?: string): string {
  if (!url) return "NOT SET";
  const regex = /\/([^?]+)/;
  const match = regex.exec(url);
  return match?.[1] ?? "INVALID";
}

const prodDbName = extractDbName(prodConfig.DATABASE_URL);
const testDbName = extractDbName(testConfig.DATABASE_URL);

log(`Production DB: ${prodDbName}`);
log(`Test DB: ${testDbName}`);

// 2. Verify proper separation
const isProperlyIsolated =
  prodDbName !== testDbName && testDbName.includes("test");
log(`Database Isolation: ${isProperlyIsolated ? "✅ PASSED" : "❌ FAILED"}`);

if (!isProperlyIsolated) {
  log("⚠️  Test database should have different name from production");
  log('   and include "test" in the name for safety');
}

// 3. Validate all test URLs are consistent
log("\n🔗 Test URL Consistency:");
const testUrls = Object.entries(testConfig).filter(
  ([key, value]) => key.includes("URL") && value?.startsWith("postgresql://"),
);

const expectedTestDb = "neondb-test";
let allConsistent = true;

for (const [key, url] of testUrls) {
  const dbName = extractDbName(url);
  const isConsistent = dbName === expectedTestDb;
  log(`${key}: ${isConsistent ? "✅" : "❌"} ${dbName}`);
  if (!isConsistent) allConsistent = false;
}

log(`\nURL Consistency: ${allConsistent ? "✅ PASSED" : "❌ FAILED"}`);

// 4. Connection test (optional - requires actual NeonDB setup)
async function testConnections(): Promise<void> {
  log("\n🔌 Connection Tests:");

  // Test production connection (read-only query)
  try {
    log("Testing production connection...");
    const prodClient = new Client({
      connectionString: prodConfig.POSTGRES_URL,
    });
    await prodClient.connect();
    await prodClient.query("SELECT NOW()");
    await prodClient.end();
    log("Production connection: ✅ SUCCESS");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log(`Production connection: ❌ FAILED - ${message}`);
  }

  // Test test environment connection
  try {
    log("Testing test environment connection...");
    const testClient = new Client({
      connectionString: testConfig.POSTGRES_URL,
    });
    await testClient.connect();
    await testClient.query("SELECT NOW()");
    await testClient.end();
    log("Test connection: ✅ SUCCESS");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log(`Test connection: ❌ FAILED - ${message}`);
    log("ℹ️  This is expected if test branch is not yet created in NeonDB");
  }
}

// 5. Summary and recommendations
log("\n📋 Configuration Summary:");
log("=".repeat(50));
log(`✅ Production Database: ${prodDbName}`);
log(`✅ Test Database: ${testDbName}`);
log(`✅ Isolation Status: ${isProperlyIsolated ? "ISOLATED" : "NOT ISOLATED"}`);
log(`✅ URL Consistency: ${allConsistent ? "CONSISTENT" : "INCONSISTENT"}`);

if (isProperlyIsolated && allConsistent) {
  log("\n🎉 Configuration is properly set up for isolated testing!");
  log("\n📝 Next Steps:");
  log("1. Create test branch in NeonDB console with name: neondb-test");
  log("2. Run migrations against test branch: npm run db:migrate:test");
  log("3. Run tests: npm test");
} else {
  log("\n⚠️  Configuration needs attention before testing");
}

// Run connection tests if --test-connections flag is provided
if (process.argv.includes("--test-connections")) {
  testConnections().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    log(`Connection test failed: ${message}`);
  });
}
