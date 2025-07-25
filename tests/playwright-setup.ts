import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Playwright global setup - runs before all tests
 * Enhanced for better stability and reliability
 */
async function globalSetup(config: FullConfig) {
  const startTime = Date.now();
  console.log('🚀 Starting Playwright global setup...');

  try {
    // 1. Create necessary directories
    const directories = [
      'playwright/.sessions',
      'test-results',
      'playwright-report',
      '.next/cache',
      'tmp',
    ];
    
    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
    }

    // 2. Clean up old test artifacts
    try {
      const testResults = await fs.readdir('test-results');
      const oldFiles = testResults.filter(file => 
        file.startsWith('e2e-') || file.startsWith('stagehand-') || file.endsWith('.zip')
      );
      
      await Promise.all(
        oldFiles.map(file => 
          fs.rm(path.join('test-results', file), { recursive: true, force: true })
        )
      );
    } catch {
      // Directory might not exist
    }

    // 3. Port cleanup with better error handling
    console.log('🧹 Cleaning up ports...');
    try {
      // Kill processes on test ports
      await execAsync(
        'lsof -ti:3000,3001,4983 | xargs kill -9 2>/dev/null || true',
        { timeout: 5000 }
      );
      
      // Additional cleanup for stubborn processes
      await execAsync(
        'pkill -f "next dev" || true',
        { timeout: 3000 }
      );
    } catch (error) {
      console.warn('⚠️ Port cleanup warning:', error);
    }

    // 4. Wait for ports to be released
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Environment setup
    process.env.PLAYWRIGHT_SETUP = 'true';
    process.env.NODE_ENV = 'test';
    process.env.NEXT_TELEMETRY_DISABLED = '1';
    process.env.SKIP_ENV_VALIDATION = 'true';
    
    // Optimize for test performance
    process.env.FORCE_COLOR = '0';
    process.env.TEST_PARALLEL = 'false';
    process.env.TEST_TIMEOUT_MULTIPLIER = '1.5';

    // 6. Create test database if needed
    if (process.env.POSTGRES_URL) {
      console.log('🗄️ Preparing test database...');
      try {
        await execAsync('pnpm db:migrate', { timeout: 30000 });
      } catch (error) {
        console.warn('⚠️ Database migration warning:', error);
      }
    }

    // 7. Clear any test caches
    try {
      await fs.rm('.next/cache', { recursive: true, force: true });
      await fs.mkdir('.next/cache', { recursive: true });
    } catch {
      // Cache might not exist
    }

    // 8. Create test image for file upload tests
    const testImagePath = path.join('tmp', 'test-image.png');
    const testImageData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    await fs.writeFile(testImagePath, testImageData);

    // 9. Store setup metadata
    const setupTime = Date.now() - startTime;
    await fs.writeFile(
      'test-results/.setup-metadata.json',
      JSON.stringify({
        setupTime,
        timestamp: new Date().toISOString(),
        workers: config.workers || 1,
        projects: config.projects.map(p => p.name),
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          CI: process.env.CI || false,
        }
      }, null, 2)
    );

    console.log(`✅ Global setup completed in ${setupTime}ms`);
    console.log(`📊 Running ${config.projects.length} test projects with ${config.workers || 1} workers`);

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;