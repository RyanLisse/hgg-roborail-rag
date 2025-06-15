import type { FullConfig } from '@playwright/test';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Playwright global setup - runs before all tests
 * Optimized for faster startup and better reliability
 */
async function globalSetup(config: FullConfig) {
  const startTime = Date.now();
  console.log('🧹 Starting test environment setup...');

  try {
    // More aggressive port cleanup with timeout
    const cleanupPromise = execAsync(
      'lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true',
      { timeout: 5000 },
    );

    await Promise.race([
      cleanupPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Port cleanup timeout')), 5000),
      ),
    ]);

    console.log('✅ Port cleanup complete');
  } catch (error) {
    console.log('⚠️  Port cleanup completed with warnings');
  }

  // Reduced delay - ports release faster than expected
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify ping endpoint will be available
  process.env.PLAYWRIGHT_SETUP = 'true';

  const setupTime = Date.now() - startTime;
  console.log(`🚀 Setup complete in ${setupTime}ms - ready for tests`);
}

export default globalSetup;
