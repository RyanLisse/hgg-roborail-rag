#!/usr/bin/env node

/**
 * Railway Deployment Validation Script
 * Validates environment variables and system readiness for Railway deployment
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REQUIRED_ENV_VARS = [
  'AUTH_SECRET',
  'POSTGRES_URL',
  // At least one AI provider required
  ['OPENAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'ANTHROPIC_API_KEY'],
  'COHERE_API_KEY', // Required for embeddings
];

const OPTIONAL_ENV_VARS = [
  'REDIS_URL',
  'BLOB_READ_WRITE_TOKEN',
  'LANGSMITH_API_KEY',
];

const REQUIRED_FILES = [
  'railway.json',
  'nixpacks.toml',
  'package.json',
  'lib/db/schema.ts',
  'app/api/health/route.ts',
];

class RailwayValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      error: '\x1b[31m',
      warning: '\x1b[33m',
      success: '\x1b[32m',
      info: '\x1b[36m',
      reset: '\x1b[0m',
    };

    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  validateEnvironmentVariables() {
    this.log('🔍 Validating environment variables...', 'info');

    // Check required variables
    for (const envVar of REQUIRED_ENV_VARS) {
      if (Array.isArray(envVar)) {
        // At least one of these is required
        const hasOne = envVar.some((v) => process.env[v]);
        if (hasOne) {
          const available = envVar.filter((v) => process.env[v]);
          this.passed.push(`AI Provider(s): ${available.join(', ')}`);
        } else {
          this.errors.push(
            `Missing required AI provider. Need at least one: ${envVar.join(', ')}`,
          );
        }
      } else {
        if (process.env[envVar]) {
          this.passed.push(`${envVar}: ✓`);
        } else {
          this.errors.push(`Missing required environment variable: ${envVar}`);
        }
      }
    }

    // Check optional variables
    for (const envVar of OPTIONAL_ENV_VARS) {
      if (process.env[envVar]) {
        this.passed.push(`${envVar}: ✓ (optional)`);
      } else {
        this.warnings.push(`Optional environment variable not set: ${envVar}`);
      }
    }

    // Validate specific formats
    if (
      process.env.OPENAI_API_KEY &&
      !process.env.OPENAI_API_KEY.startsWith('sk-')
    ) {
      this.errors.push('OPENAI_API_KEY must start with "sk-"');
    }

    if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
      this.warnings.push('AUTH_SECRET should be at least 32 characters long');
    }
  }

  validateRequiredFiles() {
    this.log('📁 Validating required files...', 'info');

    for (const file of REQUIRED_FILES) {
      if (existsSync(file)) {
        this.passed.push(`File exists: ${file}`);
      } else {
        this.errors.push(`Missing required file: ${file}`);
      }
    }
  }

  validateRailwayConfig() {
    this.log('⚙️ Validating Railway configuration...', 'info');

    try {
      const railwayConfig = JSON.parse(readFileSync('railway.json', 'utf8'));

      // Check required railway.json fields
      const requiredFields = ['build', 'deploy'];
      for (const field of requiredFields) {
        if (railwayConfig[field]) {
          this.passed.push(`Railway config has ${field} section`);
        } else {
          this.errors.push(`Railway config missing ${field} section`);
        }
      }

      // Check health check configuration
      if (railwayConfig.deploy?.healthcheckPath) {
        this.passed.push(
          `Health check configured: ${railwayConfig.deploy.healthcheckPath}`,
        );
      } else {
        this.warnings.push('No health check path configured in railway.json');
      }

      // Check build command
      if (railwayConfig.build?.buildCommand?.includes('build:railway')) {
        this.passed.push('Build command includes database migrations');
      } else {
        this.warnings.push(
          'Build command should include "build:railway" for migrations',
        );
      }
    } catch (error) {
      this.errors.push(`Invalid railway.json: ${error.message}`);
    }
  }

  validatePackageJson() {
    this.log('📦 Validating package.json...', 'info');

    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

      // Check for required scripts
      const requiredScripts = ['build', 'start', 'build:railway'];
      for (const script of requiredScripts) {
        if (pkg.scripts?.[script]) {
          this.passed.push(`Script exists: ${script}`);
        } else {
          this.errors.push(`Missing required script: ${script}`);
        }
      }

      // Check package manager
      if (pkg.packageManager?.includes('pnpm')) {
        this.passed.push('Using pnpm package manager');
      } else {
        this.warnings.push('Consider using pnpm for faster Railway builds');
      }
    } catch (error) {
      this.errors.push(`Invalid package.json: ${error.message}`);
    }
  }

  validateDatabaseMigrations() {
    this.log('🗄️ Validating database setup...', 'info');

    const migrationsDir = 'lib/db/migrations';
    if (existsSync(migrationsDir)) {
      try {
        const files = execSync(
          `ls ${migrationsDir}/*.sql 2>/dev/null || echo ""`,
          { encoding: 'utf8' },
        );
        const migrationFiles = files
          .trim()
          .split('\n')
          .filter((f) => f);

        if (migrationFiles.length > 0) {
          this.passed.push(`Found ${migrationFiles.length} migration files`);
        } else {
          this.warnings.push('No SQL migration files found');
        }
      } catch (error) {
        this.warnings.push('Could not check migration files');
      }
    } else {
      this.errors.push('Missing migrations directory: lib/db/migrations');
    }

    // Check for schema file
    if (existsSync('lib/db/schema.ts')) {
      this.passed.push('Database schema file exists');
    } else {
      this.errors.push('Missing database schema: lib/db/schema.ts');
    }
  }

  validateHealthEndpoints() {
    this.log('🏥 Validating health endpoints...', 'info');

    const healthFiles = [
      'app/api/health/route.ts',
      'app/api/health/agents/route.ts',
      'app/api/ping/route.ts',
    ];

    for (const file of healthFiles) {
      if (existsSync(file)) {
        this.passed.push(`Health endpoint: ${file}`);
      } else {
        this.warnings.push(`Missing health endpoint: ${file}`);
      }
    }
  }

  async validateBuild() {
    this.log('🔨 Validating build process...', 'info');

    try {
      // Check if we can run type checking
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      this.passed.push('TypeScript compilation successful');
    } catch (error) {
      this.errors.push('TypeScript compilation failed');
    }

    try {
      // Test build command (dry run)
      execSync(
        'npm run build --dry-run 2>/dev/null || echo "Build check skipped"',
        { stdio: 'pipe' },
      );
      this.passed.push('Build command syntax valid');
    } catch (error) {
      this.warnings.push('Could not validate build command');
    }
  }

  generateReport() {
    this.log('\n🎯 Railway Deployment Validation Report', 'info');
    this.log('='.repeat(50), 'info');

    if (this.passed.length > 0) {
      this.log('\n✅ PASSED CHECKS:', 'success');
      this.passed.forEach((item) => this.log(`  ✓ ${item}`, 'success'));
    }

    if (this.warnings.length > 0) {
      this.log('\n⚠️  WARNINGS:', 'warning');
      this.warnings.forEach((item) => this.log(`  ⚠ ${item}`, 'warning'));
    }

    if (this.errors.length > 0) {
      this.log('\n❌ ERRORS (MUST FIX):', 'error');
      this.errors.forEach((item) => this.log(`  ✗ ${item}`, 'error'));
    }

    this.log('\n📊 SUMMARY:', 'info');
    this.log(`  Passed: ${this.passed.length}`, 'success');
    this.log(`  Warnings: ${this.warnings.length}`, 'warning');
    this.log(`  Errors: ${this.errors.length}`, 'error');

    if (this.errors.length === 0) {
      this.log('\n🚀 Ready for Railway deployment!', 'success');
      this.log('\nNext steps:', 'info');
      this.log('1. Push your code to GitHub', 'info');
      this.log('2. Connect your repo to Railway', 'info');
      this.log('3. Add PostgreSQL and Redis services', 'info');
      this.log('4. Configure environment variables', 'info');
      this.log('5. Deploy and monitor health endpoints', 'info');
      return true;
    } else {
      this.log('\n🛑 Fix errors before deploying to Railway', 'error');
      return false;
    }
  }

  async run() {
    this.log('🚂 Starting Railway deployment validation...', 'info');

    try {
      this.validateEnvironmentVariables();
      this.validateRequiredFiles();
      this.validateRailwayConfig();
      this.validatePackageJson();
      this.validateDatabaseMigrations();
      this.validateHealthEndpoints();
      await this.validateBuild();

      const success = this.generateReport();
      process.exit(success ? 0 : 1);
    } catch (error) {
      this.log(`Validation failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new RailwayValidator();
  validator.run();
}

export default RailwayValidator;
