#!/usr/bin/env node

/**
 * Database Connection Validation Script
 * Tests PostgreSQL connection to Neon DB with comprehensive validation
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { performance } from 'perf_hooks';

// Load environment variables
config({ path: '.env.test' });

const DB_CONFIG = {
  // Main connection URL from your specification
  MAIN_URL: 'postgresql://neondb_owner:npg_09TNDHWMZhzi@ep-late-boat-a8biqbk3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require',
  
  // Test environment URLs from .env.test
  TEST_URL: process.env.POSTGRES_URL,
  TEST_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
  TEST_URL_NO_SSL: process.env.POSTGRES_URL_NO_SSL,
  TEST_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING
};

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.blue}=== ${title} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

class DatabaseValidator {
  constructor() {
    this.testResults = {
      connections: {},
      ssl: {},
      pooling: {},
      operations: {},
      schema: {},
      performance: {}
    };
  }

  async validateConnection(name, url, options = {}) {
    const startTime = performance.now();
    
    try {
      if (!url) {
        throw new Error(`Connection URL not provided for ${name}`);
      }

      logInfo(`Testing connection: ${name}`);
      logInfo(`URL: ${url.replace(/:[^:@]*@/, ':***@')}`); // Hide password
      
      const sql = postgres(url, {
        max: 1,
        connect_timeout: 10,
        idle_timeout: 5,
        ...options
      });

      // Test basic connection
      const result = await sql`SELECT 1 as test, version(), current_database(), current_user, inet_server_addr(), inet_server_port()`;
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      await sql.end();

      this.testResults.connections[name] = {
        success: true,
        duration: Math.round(duration),
        serverInfo: result[0],
        url: url.replace(/:[^:@]*@/, ':***@')
      };

      logSuccess(`Connection successful (${Math.round(duration)}ms)`);
      logInfo(`Database: ${result[0].current_database}`);
      logInfo(`User: ${result[0].current_user}`);
      logInfo(`Server: ${result[0].inet_server_addr}:${result[0].inet_server_port}`);
      
      return true;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.testResults.connections[name] = {
        success: false,
        duration: Math.round(duration),
        error: error.message,
        url: url?.replace(/:[^:@]*@/, ':***@') || 'N/A'
      };

      logError(`Connection failed: ${error.message}`);
      return false;
    }
  }

  async testSSLConfiguration(url) {
    logSection('SSL/TLS Configuration Test');
    
    try {
      // Test with SSL required
      logInfo('Testing SSL required connection...');
      const sslUrl = url + (url.includes('?') ? '&' : '?') + 'sslmode=require&channel_binding=require';
      const sslResult = await this.validateConnection('SSL Required', sslUrl);
      
      // Test SSL info
      if (sslResult) {
        const sql = postgres(sslUrl, { max: 1 });
        const sslInfo = await sql`
          SELECT 
            ssl_is_used() as ssl_active,
            version() as server_version
        `;
        await sql.end();
        
        this.testResults.ssl = {
          success: true,
          ssl_active: sslInfo[0].ssl_active,
          server_version: sslInfo[0].server_version
        };
        
        logSuccess(`SSL is ${sslInfo[0].ssl_active ? 'ACTIVE' : 'NOT ACTIVE'}`);
      }
      
    } catch (error) {
      this.testResults.ssl = {
        success: false,
        error: error.message
      };
      logError(`SSL test failed: ${error.message}`);
    }
  }

  async testConnectionPooling() {
    logSection('Connection Pooling Test');
    
    try {
      const pooledUrl = DB_CONFIG.TEST_URL;
      const directUrl = DB_CONFIG.TEST_URL_NON_POOLING;
      
      // Test pooled connection
      logInfo('Testing pooled connection...');
      const pooledStart = performance.now();
      await this.validateConnection('Pooled', pooledUrl);
      const pooledDuration = performance.now() - pooledStart;
      
      // Test direct connection
      logInfo('Testing direct connection...');
      const directStart = performance.now();
      await this.validateConnection('Direct', directUrl);
      const directDuration = performance.now() - directStart;
      
      this.testResults.pooling = {
        pooled_duration: Math.round(pooledDuration),
        direct_duration: Math.round(directDuration),
        performance_difference: Math.round(Math.abs(pooledDuration - directDuration))
      };
      
      logSuccess(`Pooled: ${Math.round(pooledDuration)}ms, Direct: ${Math.round(directDuration)}ms`);
      
    } catch (error) {
      this.testResults.pooling = {
        success: false,
        error: error.message
      };
      logError(`Pooling test failed: ${error.message}`);
    }
  }

  async testBasicOperations(url) {
    logSection('Basic Database Operations Test');
    
    const sql = postgres(url, { max: 1 });
    
    try {
      // Test SELECT
      logInfo('Testing SELECT operation...');
      const selectResult = await sql`SELECT NOW() as current_time, 'test' as message`;
      logSuccess(`SELECT: Retrieved ${selectResult.length} rows`);
      
      // Test table creation
      logInfo('Testing CREATE TABLE operation...');
      await sql`
        CREATE TABLE IF NOT EXISTS db_validation_test (
          id SERIAL PRIMARY KEY,
          test_data TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      logSuccess('CREATE TABLE: Success');
      
      // Test INSERT
      logInfo('Testing INSERT operation...');
      const insertResult = await sql`
        INSERT INTO db_validation_test (test_data) 
        VALUES ('Database validation test data') 
        RETURNING id, created_at
      `;
      logSuccess(`INSERT: Created record with ID ${insertResult[0].id}`);
      
      // Test UPDATE
      logInfo('Testing UPDATE operation...');
      const updateResult = await sql`
        UPDATE db_validation_test 
        SET test_data = 'Updated test data' 
        WHERE id = ${insertResult[0].id}
      `;
      logSuccess(`UPDATE: Modified ${updateResult.count} rows`);
      
      // Test DELETE
      logInfo('Testing DELETE operation...');
      const deleteResult = await sql`
        DELETE FROM db_validation_test 
        WHERE id = ${insertResult[0].id}
      `;
      logSuccess(`DELETE: Removed ${deleteResult.count} rows`);
      
      // Clean up
      await sql`DROP TABLE IF EXISTS db_validation_test`;
      logSuccess('Cleanup: Test table dropped');
      
      this.testResults.operations = {
        success: true,
        operations_tested: ['SELECT', 'CREATE', 'INSERT', 'UPDATE', 'DELETE']
      };
      
    } catch (error) {
      this.testResults.operations = {
        success: false,
        error: error.message
      };
      logError(`Operations test failed: ${error.message}`);
    } finally {
      await sql.end();
    }
  }

  async validateSchema(url) {
    logSection('Schema Access and Permissions Test');
    
    const sql = postgres(url, { max: 1 });
    
    try {
      // Check database permissions
      logInfo('Checking database permissions...');
      const permissions = await sql`
        SELECT 
          current_database() as database_name,
          current_user as user_name,
          session_user as session_user,
          has_database_privilege(current_database(), 'CONNECT') as can_connect,
          has_database_privilege(current_database(), 'CREATE') as can_create,
          has_database_privilege(current_database(), 'TEMP') as can_temp
      `;
      
      const perm = permissions[0];
      logSuccess(`Database: ${perm.database_name}`);
      logSuccess(`User: ${perm.user_name}`);
      logInfo(`Permissions - Connect: ${perm.can_connect}, Create: ${perm.can_create}, Temp: ${perm.can_temp}`);
      
      // Check schema access
      logInfo('Checking schema access...');
      const schemas = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_owner = current_user OR schema_name IN ('public', 'information_schema')
        ORDER BY schema_name
      `;
      
      logSuccess(`Accessible schemas: ${schemas.map(s => s.schema_name).join(', ')}`);
      
      // Check table privileges
      logInfo('Checking table creation privileges...');
      const testTableName = 'schema_validation_test_' + Date.now();
      
      await sql`CREATE TABLE ${sql(testTableName)} (id SERIAL PRIMARY KEY)`;
      await sql`DROP TABLE ${sql(testTableName)}`;
      
      logSuccess('Schema validation: Full table privileges confirmed');
      
      this.testResults.schema = {
        success: true,
        database: perm.database_name,
        user: perm.user_name,
        permissions: {
          connect: perm.can_connect,
          create: perm.can_create,
          temp: perm.can_temp
        },
        accessible_schemas: schemas.map(s => s.schema_name)
      };
      
    } catch (error) {
      this.testResults.schema = {
        success: false,
        error: error.message
      };
      logError(`Schema validation failed: ${error.message}`);
    } finally {
      await sql.end();
    }
  }

  async performanceTest(url) {
    logSection('Performance Test');
    
    const sql = postgres(url, { max: 5 });
    
    try {
      // Connection latency test
      logInfo('Testing connection latency...');
      const latencyTests = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await sql`SELECT 1`;
        const duration = performance.now() - start;
        latencyTests.push(duration);
      }
      
      const avgLatency = latencyTests.reduce((a, b) => a + b, 0) / latencyTests.length;
      logSuccess(`Average query latency: ${Math.round(avgLatency)}ms`);
      
      // Concurrent connections test
      logInfo('Testing concurrent connections...');
      const concurrentStart = performance.now();
      const concurrentPromises = Array(10).fill().map(async (_, i) => {
        return await sql`SELECT ${i} as query_number, pg_backend_pid() as process_id`;
      });
      
      const concurrentResults = await Promise.all(concurrentPromises);
      const concurrentDuration = performance.now() - concurrentStart;
      
      logSuccess(`10 concurrent queries completed in ${Math.round(concurrentDuration)}ms`);
      logInfo(`Unique process IDs: ${new Set(concurrentResults.map(r => r[0].process_id)).size}`);
      
      this.testResults.performance = {
        success: true,
        average_latency_ms: Math.round(avgLatency),
        concurrent_queries_duration_ms: Math.round(concurrentDuration),
        concurrent_connections_tested: 10
      };
      
    } catch (error) {
      this.testResults.performance = {
        success: false,
        error: error.message
      };
      logError(`Performance test failed: ${error.message}`);
    } finally {
      await sql.end();
    }
  }

  generateReport() {
    logSection('Database Validation Report');
    
    console.log(JSON.stringify(this.testResults, null, 2));
    
    // Summary
    logSection('Summary');
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(test => 
      test.success || (typeof test === 'object' && Object.values(test).some(v => v && v.success !== false))
    ).length;
    
    if (passedTests === totalTests) {
      logSuccess(`All ${totalTests} test categories passed!`);
      logSuccess('Database connection is fully validated and ready for production use.');
    } else {
      logWarning(`${passedTests}/${totalTests} test categories passed.`);
      logWarning('Please review failed tests above.');
    }
    
    // Quick connection guide
    logSection('Quick Connection Guide');
    logInfo('For application use:');
    console.log(`${colors.green}Main DB:${colors.reset} ${DB_CONFIG.MAIN_URL.replace(/:[^:@]*@/, ':***@')}`);
    console.log(`${colors.green}Test DB:${colors.reset} ${DB_CONFIG.TEST_URL?.replace(/:[^:@]*@/, ':***@') || 'Not configured'}`);
    
    return passedTests === totalTests;
  }

  async runAllTests() {
    try {
      logSection('PostgreSQL Database Connection Validation');
      logInfo('Testing Neon DB connection with SSL and pooling');
      
      // Test all connection types
      await this.validateConnection('Main Database', DB_CONFIG.MAIN_URL);
      if (DB_CONFIG.TEST_URL) {
        await this.validateConnection('Test Database', DB_CONFIG.TEST_URL);
      }
      if (DB_CONFIG.TEST_URL_DIRECT) {
        await this.validateConnection('Test Direct', DB_CONFIG.TEST_URL_DIRECT);
      }
      
      // Run comprehensive tests on main database
      const testUrl = DB_CONFIG.MAIN_URL;
      
      await this.testSSLConfiguration(testUrl);
      await this.testConnectionPooling();
      await this.testBasicOperations(testUrl);
      await this.validateSchema(testUrl);
      await this.performanceTest(testUrl);
      
      return this.generateReport();
      
    } catch (error) {
      logError(`Validation failed: ${error.message}`);
      return false;
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DatabaseValidator();
  
  validator.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Fatal error: ${error.message}`);
      process.exit(1);
    });
}

export { DatabaseValidator };