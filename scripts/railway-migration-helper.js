#!/usr/bin/env node

/**
 * Railway PostgreSQL Migration Helper
 * Assists with database setup and migration for Railway deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function logStep(step, message) {
  log(
    `\n${colors.bold}[Step ${step}]${colors.reset} ${colors.blue}${message}${colors.reset}`,
  );
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

// Check if we're in the correct directory
function checkProjectStructure() {
  const requiredFiles = ['package.json', 'lib/env.ts', 'railway.json'];
  const missing = requiredFiles.filter((file) => !fs.existsSync(file));

  if (missing.length > 0) {
    logError(`Missing required files: ${missing.join(', ')}`);
    logError('Please run this script from the project root directory.');
    process.exit(1);
  }

  logSuccess('Project structure verified');
}

// Validate environment configuration
function validateEnvironment() {
  logStep(1, 'Validating environment configuration...');

  const requiredEnvVars = ['POSTGRES_URL', 'AUTH_SECRET', 'OPENAI_API_KEY'];

  const railwayEnvVars = [
    'DATABASE_URL',
    'PGHOST',
    'PGPORT',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
    'RAILWAY_ENVIRONMENT',
  ];

  // Check if .env.local exists
  const envLocalPath = '.env.local';
  if (!fs.existsSync(envLocalPath)) {
    logWarning('.env.local file not found');
    logWarning('Please create .env.local with your environment variables');
    return false;
  }

  // Load environment variables
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const envVars = {};
  envContent.split('\n').forEach((line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  });

  // Check required variables
  const missingRequired = requiredEnvVars.filter(
    (varName) => !envVars[varName] || envVars[varName] === '****',
  );
  if (missingRequired.length > 0) {
    logError(
      `Missing required environment variables: ${missingRequired.join(', ')}`,
    );
    return false;
  }

  // Check Railway variables
  const hasRailwayVars = railwayEnvVars.some(
    (varName) => envVars[varName] && envVars[varName] !== '****',
  );
  if (hasRailwayVars) {
    logSuccess('Railway environment variables detected');
  } else {
    logWarning(
      'No Railway environment variables found - will use POSTGRES_URL',
    );
  }

  logSuccess('Environment configuration validated');
  return true;
}

// Test database connection
async function testDatabaseConnection() {
  logStep(2, 'Testing database connection...');

  try {
    // Use Node.js to test the connection
    const testScript = `
      const { drizzle } = require('drizzle-orm/postgres-js');
      const postgres = require('postgres');
      
      const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!connectionString) {
        console.error('No database connection string found');
        process.exit(1);
      }
      
      const client = postgres(connectionString, { max: 1 });
      const db = drizzle(client);
      
      client\`SELECT 1 as test\`.then(() => {
        console.log('Database connection successful');
        client.end();
        process.exit(0);
      }).catch(error => {
        console.error('Database connection failed:', error.message);
        process.exit(1);
      });
    `;

    fs.writeFileSync('/tmp/test-db-connection.js', testScript);
    execSync('node /tmp/test-db-connection.js', { stdio: 'inherit' });
    fs.unlinkSync('/tmp/test-db-connection.js');

    logSuccess('Database connection test passed');
    return true;
  } catch (error) {
    logError(`Database connection test failed: ${error.message}`);
    return false;
  }
}

// Run database migrations
function runMigrations() {
  logStep(3, 'Running database migrations...');

  try {
    // Check if drizzle-kit is available
    execSync('npx drizzle-kit --version', { stdio: 'pipe' });

    // Generate migrations if needed
    log('Generating migrations...', 'blue');
    execSync('npx drizzle-kit generate:pg', { stdio: 'inherit' });

    // Run migrations
    log('Applying migrations...', 'blue');
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });

    logSuccess('Database migrations completed');
    return true;
  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    logWarning(
      'You may need to run migrations manually with: npx drizzle-kit push:pg',
    );
    return false;
  }
}

// Initialize Railway-specific database setup
function initializeRailwayDatabase() {
  logStep(4, 'Initializing Railway PostgreSQL setup...');

  const initScript = path.join(__dirname, 'railway-db-init.sql');
  if (!fs.existsSync(initScript)) {
    logError('Railway initialization script not found');
    return false;
  }

  try {
    // Run the Railway-specific initialization
    const psqlCommand = `psql "${process.env.DATABASE_URL || process.env.POSTGRES_URL}" -f "${initScript}"`;
    execSync(psqlCommand, { stdio: 'inherit' });

    logSuccess('Railway PostgreSQL initialization completed');
    return true;
  } catch (error) {
    logWarning(`Could not run Railway initialization script: ${error.message}`);
    logWarning('This is normal if psql is not available or in production');
    return true; // Don't fail the migration for this
  }
}

// Validate Railway configuration
function validateRailwayConfig() {
  logStep(5, 'Validating Railway configuration...');

  const railwayConfigPath = 'railway.json';
  if (!fs.existsSync(railwayConfigPath)) {
    logError('railway.json not found');
    return false;
  }

  try {
    const config = JSON.parse(fs.readFileSync(railwayConfigPath, 'utf8'));

    // Check if PostgreSQL service is defined
    const hasPostgresService = config.services?.some(
      (service) =>
        service.name === 'postgres' ||
        service.source?.image?.includes('postgres'),
    );

    if (hasPostgresService) {
      logSuccess('Railway PostgreSQL service configuration found');
    } else {
      logWarning('No PostgreSQL service found in railway.json');
      logWarning(
        'Make sure to add a PostgreSQL service to your Railway project',
      );
    }

    // Check for web service dependencies
    const webService = config.services?.find(
      (service) => service.name === 'web',
    );
    if (webService?.dependencies?.includes('postgres')) {
      logSuccess('Web service properly depends on PostgreSQL');
    } else {
      logWarning('Web service should depend on PostgreSQL service');
    }

    logSuccess('Railway configuration validated');
    return true;
  } catch (error) {
    logError(`Failed to validate Railway configuration: ${error.message}`);
    return false;
  }
}

// Generate deployment checklist
function generateDeploymentChecklist() {
  logStep(6, 'Generating deployment checklist...');

  const checklist = `
# Railway PostgreSQL Deployment Checklist

## Pre-deployment
- [ ] Environment variables configured in Railway dashboard
- [ ] PostgreSQL service added to Railway project
- [ ] Database connection string available
- [ ] All required API keys set (OpenAI, etc.)

## Database Setup
- [ ] PostgreSQL extensions enabled (uuid-ossp, pgcrypto, vector)
- [ ] Database migrations applied
- [ ] Vector store tables created
- [ ] Health check functions available

## Application Configuration
- [ ] lib/env.ts updated for Railway PostgreSQL
- [ ] Supabase configuration removed
- [ ] Railway-specific configuration added
- [ ] Build process includes database setup

## Testing
- [ ] Database connection test passes
- [ ] Vector store operations work
- [ ] Health check endpoints respond
- [ ] Application starts without errors

## Deployment
- [ ] Railway deployment successful
- [ ] Database accessible from application
- [ ] Vector search functionality working
- [ ] Monitoring and logging configured

## Post-deployment
- [ ] Health checks passing
- [ ] Performance monitoring active
- [ ] Backup strategy in place
- [ ] Error tracking configured
`;

  fs.writeFileSync('RAILWAY_DEPLOYMENT_CHECKLIST.md', checklist.trim());
  logSuccess('Deployment checklist created: RAILWAY_DEPLOYMENT_CHECKLIST.md');
}

// Main migration function
async function main() {
  log(`${colors.bold}🚀 Railway PostgreSQL Migration Helper${colors.reset}`);
  log(
    'This script will help you migrate from Supabase to Railway PostgreSQL\n',
  );

  checkProjectStructure();

  const envValid = validateEnvironment();
  if (!envValid) {
    logError(
      'Environment validation failed. Please fix the issues above and try again.',
    );
    process.exit(1);
  }

  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    logError(
      'Database connection failed. Please check your connection string and try again.',
    );
    process.exit(1);
  }

  const migrationsSuccessful = runMigrations();
  initializeRailwayDatabase();

  const railwayConfigValid = validateRailwayConfig();

  generateDeploymentChecklist();

  log(
    `\n${colors.bold}${colors.green}🎉 Railway PostgreSQL Migration Complete!${colors.reset}`,
  );

  if (migrationsSuccessful && railwayConfigValid) {
    log(
      '\n✅ All checks passed! Your application is ready for Railway deployment.',
    );
  } else {
    log(
      '\n⚠️  Some issues were found. Please review the warnings above before deploying.',
    );
  }

  log('\nNext steps:');
  log('1. Review the deployment checklist: RAILWAY_DEPLOYMENT_CHECKLIST.md');
  log('2. Test your application locally with the new configuration');
  log('3. Deploy to Railway and verify all functionality');
  log('4. Monitor the application and database performance');
}

// Run the migration helper
if (require.main === module) {
  main().catch((error) => {
    logError(`Migration failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  checkProjectStructure,
  validateEnvironment,
  testDatabaseConnection,
  runMigrations,
  initializeRailwayDatabase,
  validateRailwayConfig,
  generateDeploymentChecklist,
};
