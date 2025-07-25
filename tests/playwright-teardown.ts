import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Playwright global teardown - runs after all tests
 * Enhanced cleanup with reporting
 */
async function globalTeardown(_config: FullConfig) {
  const startTime = Date.now();
  console.log('🧹 Running Playwright global teardown...');

  try {
    // 1. Generate test summary
    try {
      const metadata = await fs.readFile('test-results/.setup-metadata.json', 'utf-8');
      const setupData = JSON.parse(metadata);
      
      const teardownData = {
        ...setupData,
        teardownTime: Date.now() - startTime,
        completedAt: new Date().toISOString(),
        totalDuration: Date.now() - new Date(setupData.timestamp).getTime(),
      };
      
      await fs.writeFile(
        'test-results/.teardown-summary.json',
        JSON.stringify(teardownData, null, 2)
      );
    } catch {
      // Metadata might not exist
    }

    // 2. Comprehensive process cleanup
    console.log('🔪 Killing test processes...');
    const cleanupCommands = [
      // Kill by port
      'lsof -ti:3000,3001,4983 | xargs kill -9 2>/dev/null || true',
      // Kill by process name
      'pkill -f "next dev" 2>/dev/null || true',
      'pkill -f "pnpm dev" 2>/dev/null || true',
      'pkill -f "node.*next" 2>/dev/null || true',
      // Kill any hanging chrome instances
      'pkill -f "chrome.*--remote-debugging" 2>/dev/null || true',
    ];

    await Promise.allSettled(
      cleanupCommands.map(cmd =>
        execAsync(cmd, { timeout: 5000 }).catch(() => {})
      )
    );

    // 3. Clean up temporary files
    console.log('🗑️ Cleaning up temporary files...');
    const tempPaths = [
      'tmp/test-image.png',
      'playwright/.sessions',
      '.next/cache/webpack',
    ];

    await Promise.allSettled(
      tempPaths.map(tempPath =>
        fs.rm(tempPath, { recursive: true, force: true }).catch(() => {})
      )
    );

    // 4. Archive test results if in CI
    if (process.env.CI) {
      console.log('📦 Archiving test results...');
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveName = `test-results-${timestamp}.tar.gz`;
        
        await execAsync(
          `tar -czf ${archiveName} test-results playwright-report 2>/dev/null || true`,
          { timeout: 10000 }
        );
        
        console.log(`📁 Test results archived as ${archiveName}`);
      } catch {
        // Archive might fail
      }
    }

    // 5. Clean up environment variables
    delete process.env.PLAYWRIGHT_SETUP;
    delete process.env.TEST_PARALLEL;
    delete process.env.TEST_TIMEOUT_MULTIPLIER;

    // 6. Final port verification
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const portCheck = await execAsync('lsof -ti:3000', { timeout: 1000 });
      if (portCheck.stdout.trim()) {
        console.warn('⚠️ Port 3000 is still in use after teardown');
      }
    } catch {
      // Port is free
    }

    const teardownTime = Date.now() - startTime;
    console.log(`✅ Global teardown completed in ${teardownTime}ms`);

  } catch (error) {
    console.error('❌ Global teardown error:', error);
    // Don't throw - let tests complete even if teardown has issues
  }
}

export default globalTeardown;