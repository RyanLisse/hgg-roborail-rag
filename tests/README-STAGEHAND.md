# Stagehand AI-Powered Testing

This project now includes AI-powered testing using [Stagehand](https://docs.stagehand.dev/) alongside traditional Playwright tests.

## What is Stagehand?

Stagehand is an AI-powered browser automation tool that allows you to:
- **Use natural language** instead of brittle CSS selectors
- **Adapt to UI changes** automatically through AI
- **Extract structured data** from web pages intelligently
- **Perform actions** using human-like descriptions

## Test Structure

### Traditional Tests (Original)
- Located in `tests/e2e/*.test.ts` (excluding stagehand files)
- Use traditional Playwright selectors like `getByTestId()`
- Fast but brittle to UI changes

### Stagehand Tests (New)
- Located in `tests/e2e/stagehand-*.test.ts`
- Use AI-powered natural language instructions
- More resilient but slower due to AI processing

## Running Tests

### All Tests
```bash
make test          # Run all tests (traditional + stagehand)
pnpm test          # Same as above
```

### Stagehand Tests Only
```bash
make test-stagehand    # Run only AI-powered tests
pnpm test:stagehand   # Same as above
```

**Note**: Without Browserbase credentials, these commands will run and show:
```
🤖 Stagehand tests skipped - Browserbase credentials not configured
   To run these tests, set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID
   Visit https://www.browserbase.com/ to get credentials
```

### Traditional Tests Only
```bash
make test-traditional  # Run only traditional tests  
pnpm test:traditional # Same as above
```

### Hybrid Strategy
This project uses a **dual testing approach**:

1. **Traditional tests** always run (no external dependencies)
2. **Stagehand tests** only run when Browserbase is configured
3. **CI/CD environments** can choose which tests to enable
4. **Developers** can work locally without any AI testing setup

## Key Differences

### Traditional Approach
```typescript
// Brittle selector-based approach
await page.getByTestId('multimodal-input').click();
await page.getByTestId('multimodal-input').fill(message);
await page.getByTestId('send-button').click();
```

### Stagehand Approach
```typescript
// Natural language approach
await stagehand.page.act('click on the message input text area');
await stagehand.page.act(`type the message: "${message}"`);
await stagehand.page.act('click the send button to submit the message');
```

## Stagehand Page Object

The `StagehandChatPage` class provides AI-powered methods:

### Core Actions
- `sendUserMessage(message)` - Send a chat message using AI
- `isGenerationComplete()` - Wait for response completion
- `getRecentAssistantMessage()` - Extract latest AI response

### Smart Observations
- `isSendButtonVisible()` - Check button state with AI
- `isScrolledToBottom()` - Determine scroll position
- `getSelectedModel()` - Extract current model selection

### Data Extraction
Uses structured schemas to extract data:
```typescript
const messageData = await stagehand.page.extract({
  instruction: 'extract the content of the most recent AI assistant message',
  schema: {
    type: 'object',
    properties: {
      content: { type: 'string' },
      hasReasoning: { type: 'boolean' }
    },
    required: ['content']
  }
});
```

## Configuration

### Prerequisites
Stagehand tests require **Browserbase credentials** to run:

1. **Sign up at [Browserbase](https://www.browserbase.com/)**
2. **Get your API credentials** from the dashboard
3. **Set environment variables**:
   ```bash
   export BROWSERBASE_API_KEY="your-api-key"
   export BROWSERBASE_PROJECT_ID="your-project-id"
   ```

### Conditional Execution
Stagehand tests automatically **skip** when credentials are not available:
- ✅ **With credentials**: Tests run using Browserbase cloud browsers
- ⏭️ **Without credentials**: Tests skip with helpful message
- 🔧 **Local development**: No setup required - tests just skip

### Timeouts
Stagehand tests use longer timeouts due to AI processing:
- **Test timeout**: 2 minutes per test
- **Action timeout**: 90 seconds for AI actions
- **Assertion timeout**: 30 seconds

### Browser Settings
- **Cloud-based**: All tests run on Browserbase infrastructure
- **Viewport**: Consistent browser environment
- **Workers**: Single worker to prevent conflicts

## Benefits

### Resilience
- ✅ **Adapts to UI changes** - AI can find elements even if HTML structure changes
- ✅ **Self-healing tests** - Less maintenance when UI evolves
- ✅ **Natural language** - Tests are more readable and maintainable

### Limitations
- ⚠️ **Slower execution** - AI processing takes time
- ⚠️ **Less predictable** - AI behavior can vary slightly
- ⚠️ **Requires internet** - AI models need connectivity

## Best Practices

### Use Stagehand For
- **UI interaction testing** where element locations might change
- **Complex user workflows** that benefit from natural language
- **Cross-browser testing** where selectors might differ
- **Tests that frequently break** due to UI changes

### Use Traditional Tests For
- **API testing** and response validation
- **Performance testing** where speed matters
- **Precise assertions** on specific data
- **CI/CD pipelines** where determinism is critical

## Example Test

```typescript
test('Send a user message and receive response', async () => {
  await chatPage.sendUserMessage('Why is grass green?');
  await chatPage.isGenerationComplete();

  const assistantMessage = await chatPage.getRecentAssistantMessage();
  expect(assistantMessage.content).toBeTruthy();
  expect(assistantMessage.content.length).toBeGreaterThan(10);
});
```

## Debugging

### Enable Verbose Logging
Set `verbose: 1` in Stagehand constructor for debug output.

### Browser Visibility
Stagehand tests run with visible browser in development for easier debugging.

### Trace Viewing
Use Playwright's trace viewer for detailed step analysis:
```bash
pnpm exec playwright show-trace test-results/.../trace.zip
```

## Migration Strategy

1. **Start with critical paths** - Convert your most important user flows first
2. **Keep both approaches** - Run traditional and Stagehand tests in parallel
3. **Gradual migration** - Move tests one by one as you gain confidence
4. **Monitor flakiness** - Compare reliability between approaches

## Production Deployment

### CI/CD Configuration
Add Browserbase credentials to your CI environment:

```yaml
# GitHub Actions example
env:
  BROWSERBASE_API_KEY: ${{ secrets.BROWSERBASE_API_KEY }}
  BROWSERBASE_PROJECT_ID: ${{ secrets.BROWSERBASE_PROJECT_ID }}
```

### Environment-Specific Testing
- **Development**: Traditional tests only (fast feedback)
- **Staging**: Both traditional and Stagehand tests (full coverage)
- **Production**: Traditional tests for monitoring, Stagehand for acceptance

This **hybrid approach** gives you:
- ⚡ **Speed** of traditional tests for development
- 🤖 **Resilience** of AI-powered testing for critical flows
- 🔧 **Flexibility** to choose which tests run where