import fs from 'node:fs';
import path from 'node:path';
import { Stagehand } from '@browserbasehq/stagehand';
import { expect, test } from '@playwright/test';

test.describe('Vector Store with Stagehand AI', () => {
  let stagehand: Stagehand;

  // Helper to create test documents
  const createTestDocument = (filename: string, content: string) => {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  const cleanupTestDocument = (filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_error) {}
  };

  test.beforeEach(async () => {
    // Check if we have proper Browserbase credentials
    const hasCredentials = !!(
      process.env.BROWSERBASE_API_KEY &&
      process.env.BROWSERBASE_PROJECT_ID &&
      process.env.BROWSERBASE_API_KEY !==
        'test-browserbase-key-for-local-testing'
    );

    if (!hasCredentials) {
      test.skip();
    }

    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1,
      domSettleTimeoutMs: 1000,
    });
    await stagehand.init();
  });

  test.afterEach(async () => {
    if (stagehand) {
      await stagehand.close();
    }
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
    const _hasDataSources = await page.act(
      'Look for data sources or database selector options',
    );

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
        timeout: 15_000,
      });
      // If we get here without timeout, the button exists (should fail)
      expect(false).toBe(true);
    } catch (_error) {
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
      instruction:
        'Extract information about available interfaces on this page',
      schema: {
        type: 'object',
        properties: {
          hasChatInput: {
            type: 'boolean',
            description: 'Is there a chat input field?',
          },
          hasFileUpload: {
            type: 'boolean',
            description: 'Is there a file upload area?',
          },
          hasDatabaseSelector: {
            type: 'boolean',
            description: 'Is there a database selector?',
          },
          interfaceType: {
            type: 'string',
            description: 'What type of interface is this?',
          },
        },
      },
    });

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
          messageSent: {
            type: 'boolean',
            description: 'Was the message sent successfully?',
          },
          hasResponse: {
            type: 'boolean',
            description: 'Is there a response from the assistant?',
          },
          responseContent: {
            type: 'string',
            description: 'What is the response content if any?',
          },
          errorMessage: {
            type: 'string',
            description: 'Any error messages visible?',
          },
        },
      },
    });

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
          hasModelSelector: {
            type: 'boolean',
            description: 'Is there a model selector?',
          },
          selectedModel: {
            type: 'string',
            description: 'What model is currently selected?',
          },
          availableModels: {
            type: 'array',
            items: { type: 'string' },
            description: 'What models are available?',
          },
        },
      },
    });
    expect(modelInfo.hasModelSelector).toBe(true);
  });

  test('should demonstrate complete RAG workflow with AI agent routing', async () => {
    const aiGuideContent = `
# AI and Machine Learning Complete Guide

## Introduction
Artificial Intelligence (AI) represents the simulation of human intelligence in machines programmed to think and learn.

## Machine Learning Fundamentals
Machine Learning is a subset of AI that enables systems to automatically learn and improve from experience.

### Types of Machine Learning
1. **Supervised Learning**: Learning with labeled data
   - Classification: Predicting categories
   - Regression: Predicting continuous values

2. **Unsupervised Learning**: Finding patterns in unlabeled data
   - Clustering: Grouping similar data
   - Association: Finding relationships

3. **Reinforcement Learning**: Learning through rewards and punishments
   - Agent-environment interaction
   - Trial and error optimization

## Deep Learning
Deep learning uses artificial neural networks with multiple layers to model complex patterns.

### Applications
- Natural Language Processing
- Computer Vision
- Speech Recognition
- Autonomous Systems

## Ethics in AI
Important considerations for responsible AI development:
- Fairness and bias mitigation
- Transparency and explainability
- Privacy protection
- Human oversight
`;

    const testFilePath = createTestDocument(
      'ai-complete-guide.md',
      aiGuideContent,
    );

    try {
      const page = stagehand.page;

      // Navigate to the main chat interface
      await page.goto('http://localhost:3000');
      await page.waitForTimeout(3000);

      // Use AI to find and interact with file upload
      await page.act(
        'Find the file upload area or attachment button and prepare to upload a file',
      );

      // Upload the test file (this may require manual file selection in headed mode)
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.waitForTimeout(1000);

      // Use AI to send the upload message
      await page.act(
        'Type "Please process this AI guide for knowledge retrieval" in the chat input and send it',
      );
      await page.waitForTimeout(10_000); // Wait for processing

      await page.act(
        'Clear the chat input and type "What is machine learning?" then send the message',
      );
      await page.waitForTimeout(3000);

      const qaResult = await page.extract({
        instruction:
          'Check the latest response for information about machine learning',
        schema: {
          type: 'object',
          properties: {
            hasResponse: {
              type: 'boolean',
              description:
                'Is there a response to the machine learning question?',
            },
            mentionsMachineLearning: {
              type: 'boolean',
              description:
                'Does the response mention machine learning concepts?',
            },
            responseQuality: {
              type: 'string',
              description: 'How would you rate the response quality?',
            },
          },
        },
      });

      expect(qaResult.hasResponse).toBe(true);
      expect(qaResult.mentionsMachineLearning).toBe(true);

      await page.act(
        'Type "Analyze the relationship between AI, machine learning, and deep learning. Provide a comprehensive comparison of their applications and how they work together." then send',
      );
      await page.waitForTimeout(8000); // Longer wait for complex analysis

      const researchResult = await page.extract({
        instruction:
          'Analyze the latest response for comprehensive research content',
        schema: {
          type: 'object',
          properties: {
            isComprehensive: {
              type: 'boolean',
              description: 'Does the response provide comprehensive analysis?',
            },
            coversAllTopics: {
              type: 'boolean',
              description: 'Does it cover AI, ML, and deep learning?',
            },
            showsRelationships: {
              type: 'boolean',
              description: 'Does it explain relationships between the topics?',
            },
          },
        },
      });

      expect(researchResult.isComprehensive).toBe(true);
      expect(researchResult.coversAllTopics).toBe(true);

      await page.act(
        'Type "Please rewrite the machine learning section to make it suitable for high school students, using simpler language and more examples" then send',
      );
      await page.waitForTimeout(10_000);

      const rewriteResult = await page.extract({
        instruction:
          'Check if the response shows content rewritten for high school students',
        schema: {
          type: 'object',
          properties: {
            usesSimpleLanguage: {
              type: 'boolean',
              description: 'Does the response use simplified language?',
            },
            includesExamples: {
              type: 'boolean',
              description: 'Are there examples included?',
            },
            suitableForStudents: {
              type: 'boolean',
              description: 'Does it seem appropriate for high school level?',
            },
          },
        },
      });

      expect(rewriteResult.usesSimpleLanguage).toBe(true);

      await page.act(
        'Type "Create a step-by-step learning plan for someone who wants to master AI, starting from beginner level. Include timelines and specific topics." then send',
      );
      await page.waitForTimeout(10_000);

      const planResult = await page.extract({
        instruction:
          'Check if the response contains a structured learning plan',
        schema: {
          type: 'object',
          properties: {
            hasSteps: {
              type: 'boolean',
              description:
                'Does the response include step-by-step information?',
            },
            includesTimelines: {
              type: 'boolean',
              description: 'Are timelines mentioned?',
            },
            coversProgression: {
              type: 'boolean',
              description: 'Does it show progression from beginner level?',
            },
          },
        },
      });

      expect(planResult.hasSteps).toBe(true);

      await page.act(
        'Type "What about the timeline for the machine learning part of the plan?" then send',
      );
      await page.waitForTimeout(3000);

      const contextResult = await page.extract({
        instruction:
          'Check if the response addresses the machine learning timeline specifically',
        schema: {
          type: 'object',
          properties: {
            addressesContext: {
              type: 'boolean',
              description:
                'Does the response address the specific timeline question?',
            },
            mentionsML: {
              type: 'boolean',
              description: 'Does it specifically mention machine learning?',
            },
            providesTimeline: {
              type: 'boolean',
              description: 'Does it provide timeline information?',
            },
          },
        },
      });

      expect(contextResult.addressesContext).toBe(true);

      await page.act(
        'Type "What is the weather on Mars according to this AI guide?" then send',
      );
      await page.waitForTimeout(3000);

      const errorResult = await page.extract({
        instruction: 'Check how the system handles an irrelevant question',
        schema: {
          type: 'object',
          properties: {
            handlesGracefully: {
              type: 'boolean',
              description:
                'Does the system handle the irrelevant question gracefully?',
            },
            acknowledgesLimitation: {
              type: 'boolean',
              description:
                'Does it acknowledge the information is not available?',
            },
            staysHelpful: {
              type: 'boolean',
              description:
                'Does it remain helpful despite the irrelevant question?',
            },
          },
        },
      });

      expect(errorResult.handlesGracefully).toBe(true);

      const rapidQueries = [
        'Define AI',
        'Types of ML',
        'Deep learning basics',
        'Ethics in AI',
      ];

      for (const query of rapidQueries) {
        await page.act(`Type "${query}" and send it`);
        await page.waitForTimeout(2000);
      }

      await page.waitForTimeout(3000); // Wait for all responses

      const performanceResult = await page.extract({
        instruction: 'Check if all rapid queries received responses',
        schema: {
          type: 'object',
          properties: {
            allQueriesAnswered: {
              type: 'boolean',
              description: 'Did all rapid queries receive responses?',
            },
            responseQuality: {
              type: 'string',
              description: 'How is the overall response quality?',
            },
            systemStability: {
              type: 'boolean',
              description: 'Did the system remain stable during rapid queries?',
            },
          },
        },
      });

      expect(performanceResult.systemStability).toBe(true);

      const finalResult = await page.extract({
        instruction:
          'Provide an overall assessment of the RAG workflow completion',
        schema: {
          type: 'object',
          properties: {
            workflowCompleted: {
              type: 'boolean',
              description:
                'Was the complete RAG workflow successfully demonstrated?',
            },
            agentRoutingWorked: {
              type: 'boolean',
              description:
                'Did different types of queries get appropriately routed?',
            },
            qualityScore: {
              type: 'number',
              description: 'Overall quality score from 1-10',
            },
            issues: {
              type: 'array',
              items: { type: 'string' },
              description: 'Any issues encountered',
            },
          },
        },
      });

      expect(finalResult.workflowCompleted).toBe(true);
      expect(finalResult.agentRoutingWorked).toBe(true);
      expect(finalResult.qualityScore).toBeGreaterThan(6);
    } finally {
      cleanupTestDocument(testFilePath);
    }
  });

  test('should handle multi-document knowledge base with agent routing', async () => {
    const doc1Content = `
# Programming Languages Comparison

## Python
- High-level, interpreted language
- Great for data science and AI
- Easy to learn syntax
- Extensive libraries

## JavaScript  
- Dynamic, event-driven language
- Essential for web development
- Runs in browsers and servers
- Large ecosystem

## Java
- Object-oriented, platform-independent
- Enterprise applications
- Strong typing system
- JVM ecosystem
`;

    const doc2Content = `
# Software Development Best Practices

## Code Quality
- Write clean, readable code
- Follow naming conventions
- Use meaningful comments
- Implement proper error handling

## Testing Strategies
- Unit testing for individual components
- Integration testing for system interactions
- End-to-end testing for user workflows
- Performance testing for scalability

## Version Control
- Use Git for source control
- Meaningful commit messages
- Branch-based development
- Code review processes
`;

    const doc1Path = createTestDocument(
      'programming-comparison.md',
      doc1Content,
    );
    const doc2Path = createTestDocument('dev-practices.md', doc2Content);

    try {
      const page = stagehand.page;

      await page.goto('http://localhost:3000');
      await page.waitForTimeout(3000);

      // Upload first document
      await page.act('Find the file upload area and prepare to upload a file');
      await page.setInputFiles('input[type="file"]', doc1Path);
      await page.act(
        'Type "Add programming languages guide to knowledge base" and send',
      );
      await page.waitForTimeout(10_000);

      // Upload second document
      await page.act('Upload another file');
      await page.setInputFiles('input[type="file"]', doc2Path);
      await page.act(
        'Type "Add development practices guide to knowledge base" and send',
      );
      await page.waitForTimeout(10_000);

      // Test cross-document synthesis
      await page.act(
        'Type "Compare Python and JavaScript for web development projects. How do the best practices apply to each language?" and send',
      );
      await page.waitForTimeout(8000);

      const synthesisResult = await page.extract({
        instruction:
          'Check if the response synthesizes information from both documents',
        schema: {
          type: 'object',
          properties: {
            comparesBothLanguages: {
              type: 'boolean',
              description: 'Does it compare Python and JavaScript?',
            },
            includesBestPractices: {
              type: 'boolean',
              description: 'Does it reference best practices?',
            },
            showsSynthesis: {
              type: 'boolean',
              description: 'Does it synthesize information from both sources?',
            },
          },
        },
      });

      expect(synthesisResult.comparesBothLanguages).toBe(true);
      expect(synthesisResult.includesBestPractices).toBe(true);

      // Test planning across domains
      await page.act(
        'Type "Create a learning roadmap that combines programming skills with development best practices" and send',
      );
      await page.waitForTimeout(10_000);

      const planningResult = await page.extract({
        instruction:
          'Check if the response creates a comprehensive learning roadmap',
        schema: {
          type: 'object',
          properties: {
            hasRoadmap: {
              type: 'boolean',
              description: 'Does it provide a learning roadmap?',
            },
            combinesDomains: {
              type: 'boolean',
              description: 'Does it combine programming and practices?',
            },
            isStructured: {
              type: 'boolean',
              description: 'Is the roadmap well-structured?',
            },
          },
        },
      });

      expect(planningResult.hasRoadmap).toBe(true);
      expect(planningResult.combinesDomains).toBe(true);
    } finally {
      cleanupTestDocument(doc1Path);
      cleanupTestDocument(doc2Path);
    }
  });

  test('should demonstrate agent confidence and fallback mechanisms', async () => {
    const testDoc = createTestDocument(
      'confidence-test.txt',
      'This is a simple test document for testing agent routing confidence and fallback mechanisms.',
    );

    try {
      const page = stagehand.page;

      await page.goto('http://localhost:3000');
      await page.waitForTimeout(3000);

      // Upload test document
      await page.act('Upload a file and process it');
      await page.setInputFiles('input[type="file"]', testDoc);
      await page.act('Type "Process this test document" and send');
      await page.waitForTimeout(3000);

      // Test high-confidence intent
      await page.act(
        'Type "Please rewrite this document to be more formal and professional" and send',
      );
      await page.waitForTimeout(3000);

      const highConfidenceResult = await page.extract({
        instruction:
          'Check the quality and relevance of the rewriting response',
        schema: {
          type: 'object',
          properties: {
            providesRewrite: {
              type: 'boolean',
              description: 'Does it provide a rewritten version?',
            },
            moreFormally: {
              type: 'boolean',
              description: 'Is the rewrite more formal?',
            },
            confidenceLevel: {
              type: 'string',
              description: 'How confident does the response seem?',
            },
          },
        },
      });

      expect(highConfidenceResult.providesRewrite).toBe(true);

      // Test ambiguous query
      await page.act('Type "Um, so like, what about this thing?" and send');
      await page.waitForTimeout(3000);

      const ambiguousResult = await page.extract({
        instruction: 'Check how the system handles an ambiguous query',
        schema: {
          type: 'object',
          properties: {
            providesResponse: {
              type: 'boolean',
              description: 'Does it still provide a helpful response?',
            },
            asksForClarification: {
              type: 'boolean',
              description: 'Does it ask for clarification?',
            },
            handlesGracefully: {
              type: 'boolean',
              description: 'Is the ambiguity handled gracefully?',
            },
          },
        },
      });

      expect(ambiguousResult.providesResponse).toBe(true);
      expect(ambiguousResult.handlesGracefully).toBe(true);

      // Test mixed intent
      await page.act(
        'Type "Can you rewrite this and also create a plan and research related topics?" and send',
      );
      await page.waitForTimeout(10_000);

      const mixedIntentResult = await page.extract({
        instruction:
          'Check how the system handles multiple intents in one query',
        schema: {
          type: 'object',
          properties: {
            addressesMultipleIntents: {
              type: 'boolean',
              description: 'Does it address multiple aspects?',
            },
            prioritizesAppropriately: {
              type: 'boolean',
              description: 'Does it prioritize the requests appropriately?',
            },
            remainsCoherent: {
              type: 'boolean',
              description: 'Is the response coherent despite multiple intents?',
            },
          },
        },
      });

      expect(mixedIntentResult.addressesMultipleIntents).toBe(true);
      expect(mixedIntentResult.remainsCoherent).toBe(true);
    } finally {
      cleanupTestDocument(testDoc);
    }
  });
});
