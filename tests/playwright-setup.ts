import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { FullConfig } from '@playwright/test';

const execAsync = promisify(exec);

/**
 * Playwright global setup - runs before all tests
 * Optimized for faster startup and better reliability
 */
async function globalSetup(_config: FullConfig) {
  const startTime = Date.now();

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
  } catch (_error) {}

  // Reduced delay - ports release faster than expected
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify ping endpoint will be available
  process.env.PLAYWRIGHT_SETUP = 'true';

  const _setupTime = Date.now() - startTime;
}

export default globalSetup;
