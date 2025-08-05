#!/usr/bin/env tsx

/**
 * Complete Railway Database Migration Script
 * Handles the full migration process from Supabase to Railway PostgreSQL
 */

import { config } from 'dotenv';
import { RailwayMigration } from '../lib/db/railway-migration';
import { checkDatabaseHealth, formatHealthCheckResults } from '../lib/db/health-check';
import { railwayConfig } from '../lib/env';

// Load environment variables
config({ path: '.env.local' });

interface MigrationSummary {
  timestamp: string;
  environment: string;
  railwayProjectId: string;
  databaseUrl: string;
  extensionsInstalled: string[];
  migrationsApplied: number;
  duration: number;
  healthStatus: string;
  success: boolean;
}

/**
 * Display Railway configuration information
 */
function displayRailwayInfo(): void {
  console.log('\n🚂 Railway PostgreSQL Migration');
  console.log('═'.repeat(50));
  console.log(`📍 Environment: ${railwayConfig.environment}`);
  console.log(`🆔 Project ID: ${railwayConfig.projectId || 'Not set'}`);
  console.log(`🔧 Service ID: ${railwayConfig.serviceId || 'Not set'}`);
  console.log(`🔗 Database URL: ${railwayConfig.isEnabled ? 'Configured' : 'Missing'}`);
  console.log(`🏗️ Railway Managed: ${railwayConfig.isRailwayManaged ? 'Yes' : 'No'}`);
  console.log('═'.repeat(50));
}

/**
 * Pre-migration validation
 */
async function validatePreMigration(): Promise<boolean> {
  console.log('\n🔍 Pre-migration validation...');
  
  // Check environment variables
  if (!railwayConfig.databaseUrl) {
    console.error('❌ No database URL configured');
    console.error('   Set DATABASE_URL or POSTGRES_URL in your environment');
    return false;
  }

  // Check database health
  const health = await checkDatabaseHealth();
  console.log(formatHealthCheckResults(health));

  if (!health.isConnected) {
    console.error('❌ Cannot connect to database');
    return false;
  }

  console.log('✅ Pre-migration validation passed');
  return true;
}

/**
 * Run the complete migration process
 */
async function runCompleteMigration(): Promise<MigrationSummary> {
  const startTime = Date.now();
  const migration = new RailwayMigration();

  console.log('\n🚀 Starting complete Railway migration...');

  // Test connection first
  console.log('\n📡 Testing database connection...');
  const connectionTest = await migration.testConnection();
  
  if (!connectionTest.connected) {
    throw new Error(`Database connection failed: ${connectionTest.error}`);
  }

  console.log('✅ Database connection successful');
  console.log('📊 Connection details:', JSON.stringify(connectionTest.details, null, 2));

  // Run migration
  const migrationResult = await migration.migrate();

  if (!migrationResult.success) {
    throw new Error(`Migration failed: ${migrationResult.error}`);
  }

  // Post-migration health check
  const finalHealth = await checkDatabaseHealth();

  const summary: MigrationSummary = {
    timestamp: new Date().toISOString(),
    environment: railwayConfig.environment,
    railwayProjectId: railwayConfig.projectId,
    databaseUrl: railwayConfig.databaseUrl ? 'Configured' : 'Missing',
    extensionsInstalled: migrationResult.details.extensions
      .filter(ext => ext.installed)
      .map(ext => `${ext.name} (${ext.version || 'unknown'})`),
    migrationsApplied: migrationResult.details.migrationsApplied,
    duration: Date.now() - startTime,
    healthStatus: finalHealth.status,
    success: migrationResult.success && finalHealth.isConnected,
  };

  return summary;
}

/**
 * Display migration summary
 */
function displayMigrationSummary(summary: MigrationSummary): void {
  console.log('\n📋 Migration Summary');
  console.log('═'.repeat(50));
  console.log(`⏰ Timestamp: ${summary.timestamp}`);
  console.log(`🌍 Environment: ${summary.environment}`);
  console.log(`🆔 Railway Project: ${summary.railwayProjectId}`);
  console.log(`🔗 Database URL: ${summary.databaseUrl}`);
  console.log(`🧩 Extensions: ${summary.extensionsInstalled.join(', ')}`);
  console.log(`📦 Migrations Applied: ${summary.migrationsApplied}`);
  console.log(`⏱️ Duration: ${summary.duration}ms`);
  console.log(`💊 Health Status: ${summary.healthStatus}`);
  console.log(`✅ Success: ${summary.success ? 'YES' : 'NO'}`);
  console.log('═'.repeat(50));

  if (summary.success) {
    console.log('\n🎉 Railway PostgreSQL migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test your application locally with `npm run dev`');
    console.log('   2. Run tests with `npm run test`');
    console.log('   3. Deploy to Railway with `railway deploy`');
    console.log('   4. Monitor health at /api/health');
  } else {
    console.log('\n❌ Migration encountered issues');
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check database connection settings');
    console.log('   2. Verify Railway environment variables');
    console.log('   3. Review migration logs above');
    console.log('   4. Contact Railway support if needed');
  }
}

/**
 * Generate post-migration checklist
 */
function generatePostMigrationChecklist(): void {
  console.log('\n✅ Post-Migration Checklist');
  console.log('═'.repeat(50));
  
  const checklist = [
    'Database connection working',
    'Required extensions installed (uuid-ossp, pgcrypto, vector)',
    'All tables created successfully',
    'Indexes applied for performance',
    'Health check endpoints responding',
    'Vector search functionality working',
    'Application builds without errors',
    'Tests passing',
    'Railway deployment successful',
    'Monitoring and logging active',
  ];

  checklist.forEach((item, index) => {
    console.log(`   ${index + 1}. [ ] ${item}`);
  });

  console.log('\n📚 Documentation:');
  console.log('   • Railway PostgreSQL: https://docs.railway.app/databases/postgresql');
  console.log('   • pgvector: https://github.com/pgvector/pgvector');
  console.log('   • Drizzle ORM: https://orm.drizzle.team/docs/get-started-postgresql');
  
  console.log('\n🆘 Support:');
  console.log('   • Railway Discord: https://discord.gg/railway');
  console.log('   • Project Issues: Check GitHub repository');
  console.log('   • Health Check: Visit /api/health endpoint');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Display Railway info
    displayRailwayInfo();

    // Validate pre-migration requirements
    const validationPassed = await validatePreMigration();
    if (!validationPassed) {
      console.error('\n❌ Pre-migration validation failed');
      process.exit(1);
    }

    // Run complete migration
    const summary = await runCompleteMigration();

    // Display results
    displayMigrationSummary(summary);
    generatePostMigrationChecklist();

    // Exit with appropriate code
    process.exit(summary.success ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Migration process failed:', error);
    
    console.log('\n🔧 Common solutions:');
    console.log('   • Check your DATABASE_URL environment variable');
    console.log('   • Ensure Railway PostgreSQL service is running');
    console.log('   • Verify network connectivity to Railway');
    console.log('   • Check Railway project and service IDs');
    
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️ Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Migration terminated');
  process.exit(1);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { main as runCompleteMigration, displayRailwayInfo, validatePreMigration };