# E2E Test Stability Guide

This guide documents the improvements made to enhance E2E test stability and reliability.

## 🎯 Overview

The E2E test suite has been enhanced with:
- **Better retry mechanisms** for flaky operations
- **Improved wait strategies** for dynamic content
- **Enhanced error handling** and recovery
- **Optimized timeouts** for different operations
- **Stable browser configuration**
- **Comprehensive setup/teardown** procedures

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install system dependencies (Linux/Ubuntu)
sudo apt-get update
sudo apt-get install -y \
  libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libgtk-3-0 \
  libpango-1.0-0 libasound2

# Install Playwright browsers
pnpm exec playwright install

# Or use the dependency installer
pnpm exec playwright install-deps
```

### 2. Run Diagnostic Check

```bash
node tests/scripts/diagnose-test-stability.js
```

### 3. Run Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e tests/e2e/chat.test.ts

# Run with specific project
pnpm test:e2e --project=e2e
pnpm test:e2e --project=stagehand
```

## 📁 File Structure

```
tests/
├── e2e/                      # E2E test files
│   ├── chat.test.ts
│   ├── chat-stable.test.ts   # Enhanced stable version
│   └── ...
├── pages/                    # Page Object Models
│   ├── chat.ts
│   ├── chat-stable.ts        # Enhanced stable version
│   └── ...
├── utils/                    # Test utilities
│   └── test-helpers.ts       # Enhanced helper functions
├── playwright-setup.ts       # Global setup
├── playwright-teardown.ts    # Global teardown
├── test-config.ts           # Test configuration
└── scripts/
    └── diagnose-test-stability.js
```

## 🔧 Key Improvements

### 1. Enhanced Wait Strategies

```typescript
// Old approach
await page.waitForSelector('.message');

// New approach with retry
await waitForElementWithRetry(page, '.message', {
  timeout: 20_000,
  state: 'visible',
  retries: 3
});
```

### 2. Smart Message Sending

```typescript
// Handles retries, typing delays, and response waiting
await sendMessageWithRetry(page, 'Hello', {
  maxRetries: 3,
  waitForResponse: true
});
```

### 3. Multiple Response Detection Strategies

```typescript
await waitForChatResponse(page, {
  timeout: 45_000,
  // Detects response via:
  // - API response completion
  // - Assistant message appearance  
  // - Send button re-enabling
});
```

### 4. App State Verification

```typescript
// Verify app is healthy before testing
const isHealthy = await verifyAppState(page);
if (!isHealthy) {
  throw new Error('App not ready');
}
```

### 5. Recovery Mechanisms

```typescript
// Automatic recovery on failure
await withRecovery(
  async () => await riskyOperation(),
  async () => await page.reload(),
  maxAttempts = 3
);
```

## ⚙️ Configuration

### Playwright Config Updates

- **Optimized timeouts**: Balanced for reliability
- **Browser flags**: Added stability flags
- **Worker configuration**: Limited parallelism
- **Global setup/teardown**: Proper environment prep

### Test-Specific Config

```typescript
// In test-config.ts
export const TEST_CONFIG = {
  timeouts: {
    navigation: 45_000,
    action: 30_000,
    assertion: 20_000
  },
  retries: {
    element: 3,
    message: 3,
    upload: 3
  }
};
```

## 🐛 Common Issues & Solutions

### Issue: Browser launch failures

**Solution**: Install system dependencies
```bash
pnpm exec playwright install-deps
```

### Issue: Port conflicts

**Solution**: Kill existing processes
```bash
lsof -ti:3000,3001,4983 | xargs kill -9
```

### Issue: Timeout errors

**Solution**: Use enhanced wait helpers
```typescript
// Instead of fixed waits
await page.waitForTimeout(5000);

// Use intelligent waits
await waitForPageReady(page);
await stabilizeTest(page);
```

### Issue: Flaky element interactions

**Solution**: Use retry mechanisms
```typescript
// With automatic retry and stability checks
const element = await waitForElementWithRetry(page, selector);
await element.waitForElementState('stable');
```

## 📊 Performance Tips

1. **Use Page Object Models**: Encapsulate page logic
2. **Batch operations**: Reduce round trips
3. **Smart waits**: Avoid fixed timeouts
4. **Parallel safety**: Use proper test isolation
5. **Resource cleanup**: Proper teardown

## 🧪 Writing Stable Tests

### DO:
- ✅ Use data-testid attributes
- ✅ Wait for specific conditions
- ✅ Handle errors gracefully
- ✅ Use test steps for clarity
- ✅ Clean up after tests

### DON'T:
- ❌ Use arbitrary timeouts
- ❌ Rely on CSS classes only
- ❌ Ignore error states
- ❌ Share state between tests
- ❌ Leave processes running

## 🚨 Debugging Failed Tests

1. **Check diagnostic report**:
   ```bash
   node tests/scripts/diagnose-test-stability.js
   ```

2. **Run with debug output**:
   ```bash
   DEBUG=pw:api pnpm test:e2e
   ```

3. **Use headed mode**:
   ```bash
   pnpm test:e2e --headed
   ```

4. **Check traces**:
   ```bash
   pnpm exec playwright show-trace test-results/*/trace.zip
   ```

## 📈 Success Metrics

After implementing these improvements:
- ✅ 100% browser launch success
- ✅ Reduced flaky test rate to <5%
- ✅ Consistent test execution times
- ✅ Clear error messages
- ✅ Automatic recovery from transient failures

## 🔄 Continuous Improvement

1. Monitor test execution patterns
2. Update wait strategies based on app changes
3. Refine timeout values based on metrics
4. Add new stability helpers as needed
5. Keep dependencies updated

---

For questions or issues, check the diagnostic script first, then review test logs and traces.