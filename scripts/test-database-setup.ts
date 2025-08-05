#!/usr/bin/env tsx

/**
 * Complete Database Setup Testing Script
 * Tests all aspects of the Railway PostgreSQL migration and setup
 */

import { config } from 'dotenv';
import { RailwayMigration } from '../lib/db/railway-migration';
import { DatabaseSeeder } from '../lib/db/seed-data';
import { checkDatabaseHealth, formatHealthCheckResults } from '../lib/db/health-check';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { railwayConfig } from '../lib/env';
import { vectorDocuments, user, chat, message } from '../lib/db/schema-enhanced';

// Load environment variables
config({ path: '.env.local' });

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: boolean;
  duration: number;
}

/**
 * Database Setup Test Runner
 */
class DatabaseTestRunner {
  private connection: any = null;
  private db: any = null;
  private results: TestSuite[] = [];

  constructor() {
    const connectionUrl = railwayConfig.databaseUrl || process.env.POSTGRES_URL || '';
    
    if (!connectionUrl) {
      throw new Error('No database connection URL found for testing');
    }

    this.connection = postgres(connectionUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 30,
    });
    
    this.db = drizzle(this.connection);
  }

  /**
   * Run a single test with timing and error handling
   */
  private async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      return {
        name,
        passed: true,
        duration,
        details: result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test suite: Basic connectivity and configuration
   */
  private async testConnectivity(): Promise<TestSuite> {
    console.log('\n📡 Testing database connectivity...');
    
    const tests: TestResult[] = [];

    // Test 1: Basic connection
    tests.push(await this.runTest('Basic Connection', async () => {
      const result = await this.connection`SELECT 1 as test, version() as version`;
      return { connected: true, version: result[0]?.version };
    }));

    // Test 2: Railway configuration
    tests.push(await this.runTest('Railway Configuration', async () => {
      return {
        environment: railwayConfig.environment,
        isEnabled: railwayConfig.isEnabled,
        isRailwayManaged: railwayConfig.isRailwayManaged,
        projectId: railwayConfig.projectId,
        hasConnectionUrl: !!railwayConfig.databaseUrl,
      };
    }));

    // Test 3: Database health check
    tests.push(await this.runTest('Health Check', async () => {
      const health = await checkDatabaseHealth();
      if (!health.isConnected) {
        throw new Error(`Health check failed: ${health.error}`);
      }
      return health;
    }));

    const allPassed = tests.every(test => test.passed);
    const totalDuration = tests.reduce((sum, test) => sum + test.duration, 0);

    return {
      name: 'Connectivity',
      tests,
      passed: allPassed,
      duration: totalDuration,
    };
  }

  /**
   * Test suite: PostgreSQL extensions
   */
  private async testExtensions(): Promise<TestSuite> {
    console.log('\n🧩 Testing PostgreSQL extensions...');
    
    const tests: TestResult[] = [];
    const requiredExtensions = ['uuid-ossp', 'pgcrypto', 'vector', 'pg_stat_statements'];

    for (const extensionName of requiredExtensions) {
      tests.push(await this.runTest(`Extension: ${extensionName}`, async () => {
        const result = await this.connection`
          SELECT extname, extversion 
          FROM pg_extension 
          WHERE extname = ${extensionName}
        `;
        
        if (result.length === 0) {
          throw new Error(`Extension ${extensionName} not found`);
        }
        
        return {
          name: result[0].extname,
          version: result[0].extversion,
          installed: true,
        };
      }));
    }

    // Test vector functionality specifically
    tests.push(await this.runTest('Vector Functionality', async () => {
      await this.connection`SELECT '[1,2,3]'::vector`;
      const result = await this.connection`
        SELECT '[1,0,0]'::vector <-> '[0,1,0]'::vector as distance
      `;
      return { vectorDistance: result[0]?.distance };
    }));

    const allPassed = tests.every(test => test.passed);
    const totalDuration = tests.reduce((sum, test) => sum + test.duration, 0);

    return {
      name: 'Extensions',
      tests,
      passed: allPassed,
      duration: totalDuration,
    };
  }

  /**
   * Test suite: Database schema and tables
   */
  private async testSchema(): Promise<TestSuite> {
    console.log('\n🏗️ Testing database schema...');
    
    const tests: TestResult[] = [];
    const requiredTables = [
      'User',
      'Chat',
      'Message',
      'Vote',
      'Document',
      'Embedding',
      'Suggestion',
      'Stream',
      'Feedback',
      'vector_documents',
      'search_analytics',
    ];

    // Test table existence
    for (const tableName of requiredTables) {
      tests.push(await this.runTest(`Table: ${tableName}`, async () => {
        const result = await this.connection`
          SELECT table_name, 
                 (SELECT count(*) FROM information_schema.columns 
                  WHERE table_name = ${tableName} AND table_schema = 'public') as column_count
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        `;
        
        if (result.length === 0) {
          throw new Error(`Table ${tableName} not found`);
        }
        
        return {
          name: result[0].table_name,
          columnCount: result[0].column_count,
        };
      }));
    }

    // Test foreign key constraints
    tests.push(await this.runTest('Foreign Key Constraints', async () => {
      const result = await this.connection`
        SELECT count(*) as constraint_count
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = 'public'
      `;
      
      const constraintCount = parseInt(result[0]?.constraint_count || '0');
      if (constraintCount < 5) {
        throw new Error(`Insufficient foreign key constraints: ${constraintCount}`);
      }
      
      return { constraintCount };
    }));

    // Test indexes
    tests.push(await this.runTest('Database Indexes', async () => {
      const result = await this.connection`
        SELECT count(*) as index_count
        FROM pg_indexes
        WHERE schemaname = 'public'
      `;
      
      const indexCount = parseInt(result[0]?.index_count || '0');
      if (indexCount < 20) {
        throw new Error(`Insufficient indexes for performance: ${indexCount}`);
      }
      
      return { indexCount };
    }));

    const allPassed = tests.every(test => test.passed);
    const totalDuration = tests.reduce((sum, test) => sum + test.duration, 0);

    return {
      name: 'Schema',
      tests,
      passed: allPassed,
      duration: totalDuration,
    };
  }

  /**
   * Test suite: Drizzle ORM functionality
   */
  private async testDrizzleORM(): Promise<TestSuite> {
    console.log('\n🔧 Testing Drizzle ORM functionality...');
    
    const tests: TestResult[] = [];

    // Test basic query
    tests.push(await this.runTest('Basic Query', async () => {
      const result = await this.db.execute(sql`SELECT count(*) as user_count FROM "User"`);
      return { userCount: result[0]?.user_count || 0 };
    }));

    // Test insert operation
    tests.push(await this.runTest('Insert Operation', async () => {
      const testUser = {
        email: `test-${Date.now()}@example.com`,
        type: 'user' as const,
        displayName: 'Test User',
        isActive: true,
      };
      
      const result = await this.db.insert(user).values(testUser).returning();
      
      // Clean up
      await this.db.delete(user).where(sql`email = ${testUser.email}`);
      
      return { insertedUser: result[0]?.id };
    }));

    // Test joins
    tests.push(await this.runTest('Join Operations', async () => {
      const result = await this.db
        .select({
          userId: user.id,
          userEmail: user.email,
          chatCount: sql<number>`count(${chat.id})`,
        })
        .from(user)
        .leftJoin(chat, sql`${chat.userId} = ${user.id}`)
        .groupBy(user.id, user.email)
        .limit(5);
      
      return { queryResult: result.length };
    }));

    // Test vector operations
    tests.push(await this.runTest('Vector Operations', async () => {
      // Create a test vector document
      const testDoc = {
        content: 'This is a test document for vector operations.',
        embedding: Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.1)),
        embeddingProvider: 'openai' as const,
        isPublic: true,
        isActive: true,
      };
      
      const inserted = await this.db.insert(vectorDocuments).values(testDoc).returning();
      
      // Test similarity search
      const searchVector = Array.from({ length: 1536 }, (_, i) => Math.cos(i * 0.1));
      const similarDocs = await this.db.execute(sql`
        SELECT id, content, (embedding <-> ${JSON.stringify(searchVector)}::vector) as distance
        FROM vector_documents
        WHERE is_active = true
        ORDER BY distance
        LIMIT 1
      `);
      
      // Clean up
      await this.db.delete(vectorDocuments).where(sql`id = ${inserted[0].id}`);
      
      return { 
        insertedDocuments: inserted.length,
        similaritySearchResults: similarDocs.length,
      };
    }));

    const allPassed = tests.every(test => test.passed);
    const totalDuration = tests.reduce((sum, test) => sum + test.duration, 0);

    return {
      name: 'Drizzle ORM',
      tests,
      passed: allPassed,
      duration: totalDuration,
    };
  }

  /**
   * Test suite: Performance and optimization
   */
  private async testPerformance(): Promise<TestSuite> {
    console.log('\n⚡ Testing database performance...');
    
    const tests: TestResult[] = [];

    // Test query performance
    tests.push(await this.runTest('Query Performance', async () => {
      const startTime = Date.now();
      
      // Run multiple queries to test performance
      await Promise.all([
        this.connection`SELECT count(*) FROM "User"`,
        this.connection`SELECT count(*) FROM "Chat"`,
        this.connection`SELECT count(*) FROM "Message"`,
        this.connection`SELECT count(*) FROM vector_documents`,
      ]);
      
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        throw new Error(`Query performance too slow: ${duration}ms`);
      }
      
      return { duration };
    }));

    // Test vector search performance
    tests.push(await this.runTest('Vector Search Performance', async () => {
      const startTime = Date.now();
      
      const testVector = Array.from({ length: 1536 }, () => Math.random());
      await this.connection`
        SELECT id, (embedding <-> ${JSON.stringify(testVector)}::vector) as distance
        FROM vector_documents
        WHERE is_active = true
        ORDER BY distance
        LIMIT 10
      `;
      
      const duration = Date.now() - startTime;
      
      if (duration > 500) {
        throw new Error(`Vector search too slow: ${duration}ms`);
      }
      
      return { duration };
    }));

    // Test index usage
    tests.push(await this.runTest('Index Usage', async () => {
      const result = await this.connection`
        SELECT schemaname, tablename, indexname, idx_scan
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND idx_scan > 0
      `;
      
      return { activeIndexes: result.length };
    }));

    // Test connection pool
    tests.push(await this.runTest('Connection Pool', async () => {
      const connections = await Promise.all(
        Array.from({ length: 5 }, () => 
          this.connection`SELECT pg_backend_pid() as pid`
        )
      );
      
      return { simultaneousConnections: connections.length };
    }));

    const allPassed = tests.every(test => test.passed);
    const totalDuration = tests.reduce((sum, test) => sum + test.duration, 0);

    return {
      name: 'Performance',
      tests,
      passed: allPassed,
      duration: totalDuration,
    };
  }

  /**
   * Test suite: Monitoring and health functions
   */
  private async testMonitoring(): Promise<TestSuite> {
    console.log('\n📊 Testing monitoring functions...');
    
    const tests: TestResult[] = [];

    // Test Railway health check function
    tests.push(await this.runTest('Railway Health Check Function', async () => {
      const result = await this.connection`SELECT railway_health_check()`;
      const healthData = result[0]?.railway_health_check;
      
      if (!healthData || healthData.database !== 'healthy') {
        throw new Error('Railway health check function failed');
      }
      
      return healthData;
    }));

    // Test performance stats view
    tests.push(await this.runTest('Performance Stats View', async () => {
      const result = await this.connection`SELECT * FROM railway_performance_stats LIMIT 5`;
      return { statsRecords: result.length };
    }));

    // Test connection stats view
    tests.push(await this.runTest('Connection Stats View', async () => {
      const result = await this.connection`SELECT * FROM railway_connection_stats`;
      return { connectionStats: result.length };
    }));

    const allPassed = tests.every(test => test.passed);
    const totalDuration = tests.reduce((sum, test) => sum + test.duration, 0);

    return {
      name: 'Monitoring',
      tests,
      passed: allPassed,
      duration: totalDuration,
    };
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<{
    success: boolean;
    summary: {
      totalSuites: number;
      passedSuites: number;
      totalTests: number;
      passedTests: number;
      duration: number;
    };
    results: TestSuite[];
  }> {
    console.log('🧪 Starting comprehensive database testing...');
    console.log('=' .repeat(60));

    const startTime = Date.now();
    const testSuites = [
      () => this.testConnectivity(),
      () => this.testExtensions(),
      () => this.testSchema(),
      () => this.testDrizzleORM(),
      () => this.testPerformance(),
      () => this.testMonitoring(),
    ];

    // Run all test suites
    for (const testSuite of testSuites) {
      try {
        const result = await testSuite();
        this.results.push(result);
      } catch (error) {
        console.error(`Test suite failed: ${error}`);
        // Continue with other tests
      }
    }

    const totalDuration = Date.now() - startTime;
    const totalTests = this.results.reduce((sum, suite) => sum + suite.tests.length, 0);
    const passedTests = this.results.reduce(
      (sum, suite) => sum + suite.tests.filter(test => test.passed).length, 
      0
    );
    const passedSuites = this.results.filter(suite => suite.passed).length;

    return {
      success: passedSuites === this.results.length,
      summary: {
        totalSuites: this.results.length,
        passedSuites,
        totalTests,
        passedTests,
        duration: totalDuration,
      },
      results: this.results,
    };
  }

  /**
   * Display test results in a formatted way
   */
  displayResults(testResults: any): void {
    console.log('\n📋 Test Results Summary');
    console.log('=' .repeat(60));

    // Overall summary
    const { summary, results } = testResults;
    console.log(`🎯 Overall: ${summary.passedSuites}/${summary.totalSuites} suites passed`);
    console.log(`🎯 Tests: ${summary.passedTests}/${summary.totalTests} tests passed`);
    console.log(`⏱️ Duration: ${summary.duration}ms`);
    console.log(`✅ Success: ${testResults.success ? 'YES' : 'NO'}`);

    // Detailed results by suite
    for (const suite of results) {
      const passedTests = suite.tests.filter((test: TestResult) => test.passed).length;
      const suiteIcon = suite.passed ? '✅' : '❌';
      
      console.log(`\n${suiteIcon} ${suite.name}: ${passedTests}/${suite.tests.length} (${suite.duration}ms)`);
      
      for (const test of suite.tests) {
        const testIcon = test.passed ? '  ✅' : '  ❌';
        console.log(`${testIcon} ${test.name} (${test.duration}ms)`);
        
        if (!test.passed && test.error) {
          console.log(`     Error: ${test.error}`);
        }
      }
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (testResults.success) {
      console.log('   ✅ Database setup is working correctly');
      console.log('   ✅ Ready for application deployment');
      console.log('   ✅ Monitoring functions are available');
    } else {
      console.log('   ❌ Some tests failed - review errors above');
      console.log('   🔧 Check database configuration and connections');
      console.log('   📞 Contact support if issues persist');
    }
  }

  /**
   * Clean up database connections
   */
  async cleanup(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        console.log('\n✅ Database test connections closed');
      } catch (error) {
        console.warn('⚠️ Error closing test connections:', error);
      }
    }
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const testRunner = new DatabaseTestRunner();

  try {
    console.log('🚀 Railway Database Setup Testing');
    console.log(`📍 Environment: ${railwayConfig.environment}`);
    console.log(`🔗 Database configured: ${railwayConfig.isEnabled}`);
    console.log('=' .repeat(60));

    // Run all tests
    const results = await testRunner.runAllTests();

    // Display results
    testRunner.displayResults(results);

    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Database testing failed:', error);
    console.log('\n🔧 Common solutions:');
    console.log('   • Check DATABASE_URL environment variable');
    console.log('   • Ensure Railway PostgreSQL service is running');
    console.log('   • Verify database migrations have been applied');
    console.log('   • Check network connectivity to Railway');
    
    process.exit(1);
  } finally {
    await testRunner.cleanup();
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️ Database testing interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Database testing terminated');
  process.exit(1);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { DatabaseTestRunner, main as runDatabaseTests };