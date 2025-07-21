import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { FullConfig } from "@playwright/test";

const execAsync = promisify(exec);

/**
 * Playwright global teardown - runs after all tests
 * Fast and thorough cleanup
 */
async function globalTeardown(config: FullConfig) {
  const startTime = Date.now();
  console.log("🧹 Starting test environment teardown...");

  try {
    // Comprehensive cleanup with timeout
    const cleanupCommands = [
      "lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true",
      'pkill -f "next dev" 2>/dev/null || true',
      'pkill -f "pnpm dev" 2>/dev/null || true',
    ];

    await Promise.all(
      cleanupCommands.map((cmd) =>
        execAsync(cmd, { timeout: 3000 }).catch(() => {}),
      ),
    );

    console.log("✅ Process cleanup complete");
  } catch (error) {
    console.log("⚠️  Cleanup completed with warnings");
  }

  // Clean up environment
  process.env.PLAYWRIGHT_SETUP = undefined;

  const teardownTime = Date.now() - startTime;
  console.log(`🏁 Teardown complete in ${teardownTime}ms`);
}

export default globalTeardown;
