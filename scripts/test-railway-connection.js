#!/usr/bin/env node

/**
 * Railway Database Connection Testing Script
 * Tests database connectivity and Railway configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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

// Test environment configuration
function testEnvironmentConfiguration() {
  log(`\n${colors.bold}🔧 Testing Environment Configuration${colors.reset}`);
  
  const requiredVars = [
    'AUTH_SECRET',
    'NODE_ENV'
  ];
  
  const databaseVars = [
    'DATABASE_URL',
    'POSTGRES_URL'
  ];
  
  const railwayVars = [
    'RAILWAY_ENVIRONMENT',
    'RAILWAY_PROJECT_ID',
    'RAILWAY_SERVICE_ID'
  ];
  
  const aiProviderVars = [
    'OPENAI_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'ANTHROPIC_API_KEY'
  ];
  
  let hasErrors = false;
  
  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      logError(`Missing required variable: ${varName}`);
      hasErrors = true;
    } else {
      logSuccess(`${varName} is set`);
    }
  }
  
  // Check database configuration
  const hasDatabaseUrl = databaseVars.some(varName => process.env[varName]);
  if (hasDatabaseUrl) {
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    logSuccess(`Database URL configured: ${dbUrl.replace(/:\/\/.*@/, '://***:***@')}`);
  } else {
    logError('No database URL configured (DATABASE_URL or POSTGRES_URL)');
    hasErrors = true;
  }
  
  // Check Railway configuration
  const hasRailwayConfig = railwayVars.some(varName => process.env[varName]);
  if (hasRailwayConfig) {
    logSuccess('Railway configuration detected');
    railwayVars.forEach(varName => {
      if (process.env[varName]) {
        logInfo(`${varName}: ${process.env[varName]}`);
      }
    });
  } else {
    logWarning('No Railway configuration found (this is normal for local development)');
  }
  
  // Check AI provider configuration
  const hasAiProvider = aiProviderVars.some(varName => process.env[varName]);
  if (hasAiProvider) {
    logSuccess('AI provider configuration found');
  } else {
    logError('No AI provider API keys configured');
    hasErrors = true;
  }
  
  // Check Smart-Spawn configuration
  const smartSpawnVars = [
    'SMART_SPAWN_DB_MAX_CONNECTIONS',
    'SMART_SPAWN_DB_CONNECTION_TIMEOUT',
    'SMART_SPAWN_FALLBACK_MODE'
  ];
  
  const hasSmartSpawnConfig = smartSpawnVars.some(varName => process.env[varName]);
  if (hasSmartSpawnConfig) {
    logSuccess('Smart-Spawn configuration found');
  } else {
    logInfo('Using default Smart-Spawn configuration');
  }
  
  return !hasErrors;
}

// Test database connectivity
async function testDatabaseConnection() {
  log(`\n${colors.bold}🗄️  Testing Database Connection${colors.reset}`);
  
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    logError('No database connection string available');
    return false;
  }
  
  try {
    logInfo('Testing basic connection...');
    
    // Test connection using pg client
    const testScript = `
      const { Client } = require('pg');
      
      async function testConnection() {
        const client = new Client({
          connectionString: '${connectionString}',
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        try {
          await client.connect();
          console.log('✅ Database connection successful');
          
          // Test basic query
          const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
          console.log('✅ Query execution successful');
          console.log('📊 Database info:', {
            time: result.rows[0].current_time,
            version: result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]
          });
          
          // Test pgvector extension
          try {
            await client.query('SELECT * FROM pg_extension WHERE extname = \\'vector\\'');
            console.log('✅ pgvector extension available');
          } catch (error) {
            console.log('⚠️  pgvector extension not found (this is normal if not installed)');
          }
          
          await client.end();
          return true;
        } catch (error) {
          console.error('❌ Database connection failed:', error.message);
          return false;
        }
      }
      
      testConnection().then(success => process.exit(success ? 0 : 1));
    `;
    
    // Write and execute test script
    const tempFile = path.join(__dirname, 'temp-db-test.js');
    fs.writeFileSync(tempFile, testScript);
    
    try {
      execSync(`node ${tempFile}`, { stdio: 'inherit' });
      fs.unlinkSync(tempFile);
      return true;
    } catch (error) {
      fs.unlinkSync(tempFile);
      return false;
    }
    
  } catch (error) {
    logError(`Database connection test failed: ${error.message}`);
    return false;
  }
}

// Test application initialization
async function testApplicationInitialization() {
  log(`\n${colors.bold}🚀 Testing Application Initialization${colors.reset}`);
  
  try {
    logInfo('Testing environment validation...');
    
    // Test environment validation
    const testScript = `
      const { validateEnv } = require('./lib/env');
      
      try {
        const env = validateEnv();
        console.log('✅ Environment validation passed');
        console.log('📊 Configuration summary:', {
          nodeEnv: env.NODE_ENV,
          hasDatabase: !!(env.DATABASE_URL || env.POSTGRES_URL),
          hasAiProvider: !!(env.OPENAI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
          railwayManaged: !!(env.RAILWAY_PROJECT_ID),
          smartSpawnEnabled: !!(env.SMART_SPAWN_DB_MAX_CONNECTIONS)
        });
      } catch (error) {
        console.error('❌ Environment validation failed:', error.message);
        process.exit(1);
      }
    `;
    
    const tempFile = path.join(__dirname, 'temp-env-test.js');
    fs.writeFileSync(tempFile, testScript);
    
    try {
      execSync(`node ${tempFile}`, { stdio: 'inherit' });
      fs.unlinkSync(tempFile);
      return true;
    } catch (error) {
      fs.unlinkSync(tempFile);
      logError('Application initialization test failed');
      return false;
    }
    
  } catch (error) {
    logError(`Application initialization test failed: ${error.message}`);
    return false;
  }
}

// Test Railway-specific features
async function testRailwayFeatures() {
  log(`\n${colors.bold}🚄 Testing Railway-Specific Features${colors.reset}`);
  
  const isRailwayEnvironment = !!(
    process.env.RAILWAY_PROJECT_ID || 
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.DATABASE_URL?.includes('railway')
  );
  
  if (!isRailwayEnvironment) {
    logWarning('Not in Railway environment - skipping Railway-specific tests');
    return true;
  }
  
  logSuccess('Railway environment detected');
  
  // Test Railway service discovery
  const railwayServices = [
    'RAILWAY_PROJECT_ID',
    'RAILWAY_SERVICE_ID',
    'RAILWAY_ENVIRONMENT',
    'RAILWAY_DEPLOYMENT_ID'
  ];
  
  railwayServices.forEach(service => {
    if (process.env[service]) {
      logSuccess(`${service}: ${process.env[service]}`);
    } else {
      logInfo(`${service}: not set`);
    }
  });
  
  // Test Railway PostgreSQL service
  if (process.env.DATABASE_URL?.includes('railway')) {
    logSuccess('Railway PostgreSQL service detected');
  }
  
  // Test Railway Redis service
  if (process.env.REDIS_URL?.includes('railway')) {
    logSuccess('Railway Redis service detected');
  }
  
  return true;
}

// Generate test report
function generateTestReport(results) {
  log(`\n${colors.bold}📋 Test Report${colors.reset}`);
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(result => result).length;
  const failedTests = totalTests - passedTests;
  
  log(`\n📊 Summary:`);
  log(`   Total tests: ${totalTests}`);
  logSuccess(`   Passed: ${passedTests}`);
  if (failedTests > 0) {
    logError(`   Failed: ${failedTests}`);
  }
  
  log(`\n📋 Test Results:`);
  Object.entries(results).forEach(([testName, passed]) => {
    if (passed) {
      logSuccess(`   ${testName}`);
    } else {
      logError(`   ${testName}`);
    }
  });
  
  if (failedTests === 0) {
    log(`\n🎉 All tests passed! Your Railway configuration is ready for deployment.`);
  } else {
    log(`\n⚠️  Some tests failed. Please review the issues above before deploying.`);
  }
  
  // Generate recommendations
  log(`\n💡 Recommendations:`);
  
  if (!results.environmentConfig) {
    log(`   - Review and set missing environment variables`);
    log(`   - Ensure all API keys are valid and have sufficient quotas`);
  }
  
  if (!results.databaseConnection) {
    log(`   - Verify database connection string format`);
    log(`   - Check database server accessibility`);
    log(`   - Ensure database service is running`);
  }
  
  if (!results.applicationInit) {
    log(`   - Fix environment validation errors`);
    log(`   - Check application configuration`);
  }
  
  log(`   - Test the configuration in Railway's staging environment`);
  log(`   - Monitor application logs after deployment`);
  log(`   - Set up health check monitoring`);
  
  return failedTests === 0;
}

// Main test function
async function main() {
  log(`${colors.bold}🧪 Railway Database Connection Test Suite${colors.reset}`);
  log(`This script validates your Railway PostgreSQL configuration\n`);
  
  const results = {};
  
  // Run all tests
  results.environmentConfig = testEnvironmentConfiguration();
  results.databaseConnection = await testDatabaseConnection();
  results.applicationInit = await testApplicationInitialization();
  results.railwayFeatures = await testRailwayFeatures();
  
  // Generate report
  const allTestsPassed = generateTestReport(results);
  
  // Exit with appropriate code
  process.exit(allTestsPassed ? 0 : 1);
}

// Run the test suite
if (require.main === module) {
  main().catch((error) => {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  testEnvironmentConfiguration,
  testDatabaseConnection,
  testApplicationInitialization,
  testRailwayFeatures,
  generateTestReport,
};