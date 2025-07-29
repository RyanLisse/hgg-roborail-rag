#!/usr/bin/env node

/**
 * Database Connection Validation Script
 * Validates all NeonDB connections and configurations
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.test' });

// Test configuration
const TEST_CONFIG = {
  // Main production database URL (from provided connection)
  MAIN_DB:
    'postgresql://neondb_owner:npg_09TNDHWMZhzi@ep-late-boat-a8biqbk3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require',

  // Test database URLs from .env.test
  TEST_DB: process.env.DATABASE_URL,
  TEST_DB_POSTGRES: process.env.POSTGRES_URL,
  TEST_DB_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
  TEST_DB_NO_SSL: process.env.POSTGRES_URL_NO_SSL,

  // Connection timeout
  TIMEOUT_MS: 10000,
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logHeader(message) {
  log(`\n${colors.bold}${colors.blue}🔍 ${message}${colors.reset}`);
}

// Test functions
async function testConnection(name, connectionString, description = '') {
  if (!connectionString) {
    logWarning(`${name}: Connection string not provided`);
    return false;
  }

  logInfo(`Testing ${name}${description ? ` (${description})` : ''}...`);

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: TEST_CONFIG.TIMEOUT_MS,
  });

  try {
    await client.connect();
    logSuccess(`${name}: Connection successful`);
    return client;
  } catch (error) {
    logError(`${name}: Connection failed - ${error.message}`);
    return false;
  }
}

async function testBasicQueries(client, name) {
  try {
    // Test basic SELECT query
    const result = await client.query(
      'SELECT NOW() as current_time, VERSION() as version',
    );
    logSuccess(`${name}: Basic query successful`);
    logInfo(`  Database time: ${result.rows[0].current_time}`);
    logInfo(
      `  PostgreSQL version: ${result.rows[0].version.substring(0, 50)}...`,
    );

    // Test database name query
    const dbResult = await client.query('SELECT current_database()');
    logInfo(`  Current database: ${dbResult.rows[0].current_database}`);

    return true;
  } catch (error) {
    logError(`${name}: Basic queries failed - ${error.message}`);
    return false;
  }
}

async function testSSLConfiguration(client, name) {
  try {
    // Check SSL status
    const sslResult = await client.query('SHOW ssl');
    const sslStatus = sslResult.rows[0].ssl;

    if (sslStatus === 'on') {
      logSuccess(`${name}: SSL is enabled`);
    } else {
      logWarning(`${name}: SSL is not enabled (status: ${sslStatus})`);
    }

    // Check connection security
    const securityResult = await client.query(`
      SELECT 
        inet_client_addr() as client_ip,
        inet_server_addr() as server_ip,
        current_user as current_user,
        session_user as session_user
    `);

    logInfo(`  Client IP: ${securityResult.rows[0].client_ip || 'N/A'}`);
    logInfo(`  Server IP: ${securityResult.rows[0].server_ip || 'N/A'}`);
    logInfo(`  Current user: ${securityResult.rows[0].current_user}`);

    return true;
  } catch (error) {
    logError(`${name}: SSL configuration check failed - ${error.message}`);
    return false;
  }
}

async function testPermissions(client, name) {
  try {
    // Test table creation permissions
    const testTableName = `test_permissions_${Date.now()}`;

    await client.query(
      `CREATE TABLE IF NOT EXISTS ${testTableName} (id SERIAL PRIMARY KEY, test_col TEXT)`,
    );
    logSuccess(`${name}: CREATE TABLE permission verified`);

    // Test insert permissions
    await client.query(
      `INSERT INTO ${testTableName} (test_col) VALUES ('test_data')`,
    );
    logSuccess(`${name}: INSERT permission verified`);

    // Test select permissions
    const selectResult = await client.query(`SELECT * FROM ${testTableName}`);
    logSuccess(
      `${name}: SELECT permission verified (${selectResult.rows.length} rows)`,
    );

    // Test update permissions
    await client.query(`UPDATE ${testTableName} SET test_col = 'updated_data'`);
    logSuccess(`${name}: UPDATE permission verified`);

    // Test delete permissions
    await client.query(`DELETE FROM ${testTableName}`);
    logSuccess(`${name}: DELETE permission verified`);

    // Clean up test table
    await client.query(`DROP TABLE ${testTableName}`);
    logSuccess(`${name}: DROP TABLE permission verified`);

    return true;
  } catch (error) {
    logError(`${name}: Permissions test failed - ${error.message}`);
    return false;
  }
}

async function testConnectionPooling(connectionString, name) {
  if (!connectionString) {
    logWarning(`${name}: Connection string not provided for pooling test`);
    return false;
  }

  logInfo(`Testing connection pooling for ${name}...`);

  const connections = [];
  const promises = [];

  try {
    // Create multiple concurrent connections
    for (let i = 0; i < 5; i++) {
      const client = new Client({
        connectionString,
        connectionTimeoutMillis: TEST_CONFIG.TIMEOUT_MS,
      });
      connections.push(client);
      promises.push(client.connect());
    }

    await Promise.all(promises);
    logSuccess(`${name}: Multiple connections (5) established successfully`);

    // Test concurrent queries
    const queryPromises = connections.map((client, index) =>
      client.query(`SELECT ${index + 1} as connection_id, NOW() as timestamp`),
    );

    const results = await Promise.all(queryPromises);
    logSuccess(`${name}: Concurrent queries executed successfully`);

    // Close all connections
    await Promise.all(connections.map((client) => client.end()));
    logSuccess(`${name}: All connections closed successfully`);

    return true;
  } catch (error) {
    logError(`${name}: Connection pooling test failed - ${error.message}`);

    // Cleanup on error
    await Promise.all(
      connections.map(async (client) => {
        try {
          await client.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }),
    );

    return false;
  }
}

async function testDatabaseQuotas(client, name) {
  try {
    // Check database size and limits
    const dbSizeResult = await client.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        current_database() as database_name
    `);

    logInfo(`  Database size: ${dbSizeResult.rows[0].database_size}`);

    // Check table count
    const tableCountResult = await client.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    logInfo(`  Public tables: ${tableCountResult.rows[0].table_count}`);

    // Check connection limits
    const connectionLimitResult = await client.query(`
      SELECT 
        setting as max_connections,
        current_setting('max_connections') as current_max
      FROM pg_settings 
      WHERE name = 'max_connections'
    `);

    logInfo(
      `  Max connections: ${connectionLimitResult.rows[0].max_connections}`,
    );

    logSuccess(`${name}: Database quota information retrieved`);
    return true;
  } catch (error) {
    logError(`${name}: Database quota check failed - ${error.message}`);
    return false;
  }
}

async function testApplicationSchema(client, name) {
  try {
    // Check if application tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user', 'chat', 'message', 'document', 'vote', 'suggestion', 'stream')
      ORDER BY table_name
    `);

    const existingTables = tablesResult.rows.map((row) => row.table_name);

    if (existingTables.length > 0) {
      logSuccess(
        `${name}: Found application tables: ${existingTables.join(', ')}`,
      );

      // Test each table with a simple count query
      for (const table of existingTables) {
        try {
          const countResult = await client.query(
            `SELECT COUNT(*) as count FROM "${table}"`,
          );
          logInfo(`  Table "${table}": ${countResult.rows[0].count} rows`);
        } catch (error) {
          logWarning(`  Table "${table}": Query failed - ${error.message}`);
        }
      }
    } else {
      logWarning(
        `${name}: No application tables found (this may be expected for a fresh database)`,
      );
    }

    return true;
  } catch (error) {
    logError(`${name}: Application schema test failed - ${error.message}`);
    return false;
  }
}

// Main validation function
async function validateDatabaseConnections() {
  logHeader('DATABASE CONNECTION VALIDATION REPORT');
  log(`Generated: ${new Date().toISOString()}\n`);

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    connections: {},
  };

  const testCases = [
    {
      name: 'MAIN_DB',
      url: TEST_CONFIG.MAIN_DB,
      description: 'Production database (provided)',
    },
    {
      name: 'TEST_DB',
      url: TEST_CONFIG.TEST_DB,
      description: 'Test database (DATABASE_URL)',
    },
    {
      name: 'TEST_DB_POSTGRES',
      url: TEST_CONFIG.TEST_DB_POSTGRES,
      description: 'Test database (POSTGRES_URL)',
    },
    {
      name: 'TEST_DB_NON_POOLING',
      url: TEST_CONFIG.TEST_DB_NON_POOLING,
      description: 'Non-pooling connection',
    },
    {
      name: 'TEST_DB_NO_SSL',
      url: TEST_CONFIG.TEST_DB_NO_SSL,
      description: 'No SSL connection',
    },
  ];

  for (const testCase of testCases) {
    logHeader(`Testing ${testCase.name}`);
    results.total++;

    const testResult = {
      connection: false,
      basicQueries: false,
      sslConfig: false,
      permissions: false,
      pooling: false,
      quotas: false,
      schema: false,
    };

    // Test basic connection
    const client = await testConnection(
      testCase.name,
      testCase.url,
      testCase.description,
    );
    if (client) {
      testResult.connection = true;

      try {
        // Run all tests with the connected client
        testResult.basicQueries = await testBasicQueries(client, testCase.name);
        testResult.sslConfig = await testSSLConfiguration(
          client,
          testCase.name,
        );
        testResult.permissions = await testPermissions(client, testCase.name);
        testResult.quotas = await testDatabaseQuotas(client, testCase.name);
        testResult.schema = await testApplicationSchema(client, testCase.name);

        await client.end();
      } catch (error) {
        logError(`${testCase.name}: Test execution failed - ${error.message}`);
        try {
          await client.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    // Test connection pooling separately
    if (testCase.url) {
      testResult.pooling = await testConnectionPooling(
        testCase.url,
        testCase.name,
      );
    }

    results.connections[testCase.name] = testResult;

    const passedTests = Object.values(testResult).filter(Boolean).length;
    const totalTests = Object.keys(testResult).length;

    if (passedTests === totalTests) {
      results.passed++;
      logSuccess(
        `${testCase.name}: All tests passed (${passedTests}/${totalTests})`,
      );
    } else {
      results.failed++;
      logWarning(
        `${testCase.name}: Some tests failed (${passedTests}/${totalTests})`,
      );
    }
  }

  // Generate summary report
  logHeader('VALIDATION SUMMARY');
  log(`Total databases tested: ${results.total}`);
  logSuccess(`Fully validated: ${results.passed}`);
  if (results.failed > 0) {
    logWarning(`Partially validated: ${results.failed}`);
  }

  // Detailed results
  logHeader('DETAILED RESULTS');
  for (const [name, result] of Object.entries(results.connections)) {
    log(`\n${colors.bold}${name}:${colors.reset}`);
    for (const [test, passed] of Object.entries(result)) {
      const status = passed ? '✅' : '❌';
      log(`  ${status} ${test}`);
    }
  }

  // Environment validation
  logHeader('ENVIRONMENT CONFIGURATION');
  log('Environment variables:');
  log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  log(`  POSTGRES_URL: ${process.env.POSTGRES_URL ? '✅ Set' : '❌ Not set'}`);
  log(
    `  POSTGRES_URL_NON_POOLING: ${process.env.POSTGRES_URL_NON_POOLING ? '✅ Set' : '❌ Not set'}`,
  );
  log(
    `  POSTGRES_URL_NO_SSL: ${process.env.POSTGRES_URL_NO_SSL ? '✅ Set' : '❌ Not set'}`,
  );

  logHeader('RECOMMENDATIONS');
  if (results.passed === results.total) {
    logSuccess('🎉 All database connections are working perfectly!');
    log('✅ Your NeonDB configuration is ready for production use.');
  } else {
    logWarning('⚠️  Some database connections need attention:');

    for (const [name, result] of Object.entries(results.connections)) {
      const failedTests = Object.entries(result).filter(
        ([test, passed]) => !passed,
      );
      if (failedTests.length > 0) {
        log(`\n${name} issues:`);
        failedTests.forEach(([test, passed]) => {
          switch (test) {
            case 'connection':
              log('  - Check connection string and network connectivity');
              break;
            case 'sslConfig':
              log('  - Verify SSL/TLS configuration');
              break;
            case 'permissions':
              log('  - Check database user permissions');
              break;
            case 'pooling':
              log('  - Review connection pooling settings');
              break;
            default:
              log(`  - Review ${test} configuration`);
          }
        });
      }
    }
  }

  return results;
}

// Run validation if called directly
if (require.main === module) {
  validateDatabaseConnections()
    .then((results) => {
      const exitCode = results.failed > 0 ? 1 : 0;
      process.exit(exitCode);
    })
    .catch((error) => {
      logError(`Validation script failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    });
}

module.exports = { validateDatabaseConnections, TEST_CONFIG };
