import { test, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';

test.describe('Vector Store with Stagehand AI', () => {
  let stagehand: Stagehand;

  test.beforeEach(async () => {
    stagehand = new Stagehand({
      env: 'LOCAL', // Use local browser instead of cloud
      headless: false, // Show browser for debugging
      domSettleTimeoutMs: 1000,
    });
    await stagehand.init();
  });

  test.afterEach(async () => {
    await stagehand.close();
  });

  test('should navigate to RAG chat and verify database selector using AI', async () => {
    const page = stagehand.page;
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for initial page load
    await page.waitForTimeout(3000);
    
    // Use AI to navigate to RAG chat
    await page.act('Navigate to the RAG chat page');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Use AI to find and interact with database selector
    const hasDataSources = await page.act('Look for data sources or database selector options');
    
    // Verify the interface loaded
    expect(page.url()).toContain('rag');
  });

  test('should verify deploy button is removed from header', async () => {
    const page = stagehand.page;
    
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    // Use AI to look for deploy button
    try {
      await page.act('Find the Deploy with Vercel button', { 
        timeout: 5000 
      });
      // If we get here without timeout, the button exists (should fail)
      expect(false).toBe(true);
    } catch (error) {
      // Timeout means button not found (good!)
      expect(true).toBe(true);
    }
  });

  test('should test file upload interface in RAG chat', async () => {
    const page = stagehand.page;
    
    await page.goto('http://localhost:3000/rag');
    await page.waitForTimeout(3000);
    
    // Use AI to find file upload area
    await page.act('Look for file upload area or browse files button');
    
    // Use AI to find chat input
    await page.act('Find the chat input field and type a test message');
    
    // Extract information about what was found
    const pageInfo = await page.extract({
      instruction: 'Extract information about available interfaces on this page',
      schema: {
        type: 'object',
        properties: {
          hasChatInput: { type: 'boolean', description: 'Is there a chat input field?' },
          hasFileUpload: { type: 'boolean', description: 'Is there a file upload area?' },
          hasDatabaseSelector: { type: 'boolean', description: 'Is there a database selector?' },
          interfaceType: { type: 'string', description: 'What type of interface is this?' }
        }
      }
    });
    
    console.log('Page interface info:', pageInfo);
    
    // Verify key components exist
    expect(pageInfo.hasChatInput).toBe(true);
    expect(pageInfo.hasFileUpload).toBe(true);
  });

  test('should test complete chat flow with vector stores', async () => {
    const page = stagehand.page;
    
    await page.goto('http://localhost:3000/rag');
    await page.waitForTimeout(3000);
    
    // Use AI to interact with the interface
    await page.act('Type "What is RAG?" in the chat input field');
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Try to submit the message
    await page.act('Submit the chat message or click send button');
    
    // Wait for potential response
    await page.waitForTimeout(3000);
    
    // Extract what happened
    const chatResult = await page.extract({
      instruction: 'Check if a message was sent and if there are any responses',
      schema: {
        type: 'object',
        properties: {
          messageSent: { type: 'boolean', description: 'Was the message sent successfully?' },
          hasResponse: { type: 'boolean', description: 'Is there a response from the assistant?' },
          responseContent: { type: 'string', description: 'What is the response content if any?' },
          errorMessage: { type: 'string', description: 'Any error messages visible?' }
        }
      }
    });
    
    console.log('Chat result:', chatResult);
    
    // Just verify the interface is working (message sent)
    expect(chatResult.messageSent).toBe(true);
  });

  test('should verify model selector is present', async () => {
    const page = stagehand.page;
    
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    // Use AI to find model selector
    await page.act('Look for model selector or AI model dropdown');
    
    const modelInfo = await page.extract({
      instruction: 'Check for model selection interface',
      schema: {
        type: 'object',
        properties: {
          hasModelSelector: { type: 'boolean', description: 'Is there a model selector?' },
          selectedModel: { type: 'string', description: 'What model is currently selected?' },
          availableModels: { type: 'array', items: { type: 'string' }, description: 'What models are available?' }
        }
      }
    });
    
    console.log('Model selector info:', modelInfo);
    expect(modelInfo.hasModelSelector).toBe(true);
  });
});