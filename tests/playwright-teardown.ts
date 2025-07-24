import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { FullConfig } from '@playwright/test';

const execAsync = promisify(exec);

/**
 * Playwright global teardown - runs after all tests
 * Fast and thorough cleanup
 */
async function globalTeardown(_config: FullConfig) {
  const startTime = Date.now();

  try {
    // Comprehensive cleanup with timeout
    const cleanupCommands = [
      'lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true',
      'pkill -f "next dev" 2>/dev/null || true',
      'pkill -f "pnpm dev" 2>/dev/null || true',
    ];

    await Promise.all(
      cleanupCommands.map((cmd) =>
        execAsync(cmd, { timeout: 3000 }).catch(() => {}),
      ),
    );
  } catch (_error) {
  }

  // Clean up environment
  process.env.PLAYWRIGHT_SETUP = undefined;

  const _teardownTime = Date.now() - startTime;
}

export default globalTeardown;
