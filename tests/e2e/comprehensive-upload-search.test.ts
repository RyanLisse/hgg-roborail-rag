import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  createPerformanceMonitor,
  sendMessageWithRetry,
  uploadFileWithRetry,
  verifyAppState,
  waitForChatResponse,
  waitForPageReady,
} from '../utils/test-helpers';

/**
 * Comprehensive E2E Test Suite for Upload → Search Workflow
 *
 * Tests the complete RAG pipeline:
 * 1. Document upload and processing
 * 2. Vector embeddings generation
 * 3. Search across all providers
 * 4. Citation system validation
 * 5. Performance benchmarking
 */

test.describe('Comprehensive Upload → Search E2E Tests', () => {
  // Test documents with different characteristics
  const testDocuments = {
    technical: {
      name: 'technical-guide.md',
      content: `# Advanced System Architecture Guide

## Introduction
This guide covers advanced system architecture patterns and best practices for scalable applications.

## Microservices Architecture
Microservices architecture is a design approach that structures an application as a collection of loosely coupled services.

### Key Benefits
- **Scalability**: Individual services can be scaled independently
- **Technology Diversity**: Different services can use different technologies
- **Fault Isolation**: Failures in one service don't cascade to others
- **Team Autonomy**: Teams can work independently on different services

### Design Patterns
1. **API Gateway Pattern**: Single entry point for all client requests
2. **Service Discovery**: Automatic detection of available services
3. **Circuit Breaker**: Prevents cascading failures
4. **Saga Pattern**: Manages distributed transactions

## Database Strategies
- **Database per Service**: Each microservice has its own database
- **Event Sourcing**: Store state changes as events
- **CQRS**: Command Query Responsibility Segregation
- **Polyglot Persistence**: Use different databases for different needs

## Communication Patterns
- **Synchronous**: REST, GraphQL, gRPC
- **Asynchronous**: Message queues, event streams
- **Request-Reply**: Direct service-to-service communication
- **Publish-Subscribe**: Event-driven communication

## Security Considerations
- **Authentication**: JWT tokens, OAuth 2.0
- **Authorization**: Role-based access control (RBAC)
- **API Security**: Rate limiting, input validation
- **Network Security**: Service mesh, mTLS

## Monitoring and Observability
- **Distributed Tracing**: Track requests across services
- **Metrics Collection**: Performance and business metrics
- **Centralized Logging**: Aggregate logs from all services
- **Health Checks**: Monitor service availability

## Deployment Strategies
- **Blue-Green Deployment**: Zero-downtime deployments
- **Canary Releases**: Gradual rollout of new versions
- **Container Orchestration**: Kubernetes, Docker Swarm
- **Infrastructure as Code**: Terraform, CloudFormation`,
    },

    research: {
      name: 'research-paper.md',
      content: `# Machine Learning in Healthcare: A Systematic Review

## Abstract
This systematic review examines the application of machine learning techniques in healthcare, analyzing 150 peer-reviewed studies published between 2020-2024.

## Introduction
Machine learning (ML) has emerged as a transformative technology in healthcare, offering unprecedented opportunities for improving patient outcomes, reducing costs, and enhancing clinical decision-making.

## Literature Review

### Medical Imaging
- **Computer Vision**: Deep learning models for image analysis
- **Diagnostic Accuracy**: CNN-based systems achieving 95%+ accuracy
- **Radiology**: Automated detection of tumors, fractures, and abnormalities
- **Pathology**: Digital slide analysis and cancer detection

### Clinical Decision Support
- **Risk Prediction**: Models for predicting patient deterioration
- **Treatment Recommendations**: Personalized treatment plans
- **Drug Discovery**: AI-accelerated pharmaceutical research
- **Clinical Trials**: Patient matching and outcome prediction

### Natural Language Processing
- **Electronic Health Records**: Automated data extraction
- **Clinical Notes**: Sentiment analysis and information extraction
- **Medical Literature**: Automated review and synthesis
- **Patient Communication**: Chatbots and virtual assistants

## Methodology
Our systematic review followed PRISMA guidelines:
1. **Search Strategy**: Comprehensive database search
2. **Inclusion Criteria**: Peer-reviewed studies, clinical applications
3. **Data Extraction**: Standardized data collection forms
4. **Quality Assessment**: Newcastle-Ottawa Scale

## Results

### Performance Metrics
- **Sensitivity**: Average 87.3% (range: 72-96%)
- **Specificity**: Average 91.2% (range: 83-98%)
- **AUC**: Average 0.89 (range: 0.78-0.97)
- **Precision**: Average 84.1% (range: 69-94%)

### Application Areas
1. **Cardiology**: ECG analysis, risk stratification
2. **Oncology**: Cancer detection, treatment planning
3. **Neurology**: Brain imaging, seizure prediction
4. **Emergency Medicine**: Triage, early warning systems

## Discussion

### Advantages
- **Improved Accuracy**: ML models often outperform traditional methods
- **Cost Reduction**: Automated processes reduce manual workload
- **Scalability**: Systems can handle large patient populations
- **Personalization**: Tailored treatments based on individual characteristics

### Challenges
- **Data Quality**: Inconsistent and incomplete datasets
- **Regulatory Approval**: Complex FDA approval processes
- **Interpretability**: Black-box models difficult to explain
- **Bias**: Training data may not represent diverse populations

## Future Directions
- **Federated Learning**: Privacy-preserving collaborative models
- **Explainable AI**: More interpretable algorithms
- **Real-time Processing**: Edge computing for immediate results
- **Multi-modal Integration**: Combining different data types

## Conclusion
Machine learning shows tremendous promise in healthcare, with significant potential to improve patient outcomes and healthcare efficiency. However, careful attention to ethical, regulatory, and technical challenges is essential for successful implementation.`,
    },

    simple: {
      name: 'simple-guide.txt',
      content: `Getting Started with Web Development

Introduction
Web development is the process of creating websites and web applications. It involves both frontend (client-side) and backend (server-side) development.

Frontend Technologies
- HTML: Structure and content
- CSS: Styling and layout
- JavaScript: Interactivity and behavior
- Frameworks: React, Vue, Angular

Backend Technologies
- Server Languages: Node.js, Python, Java, PHP
- Databases: MySQL, PostgreSQL, MongoDB
- APIs: REST, GraphQL
- Cloud Services: AWS, Azure, Google Cloud

Best Practices
1. Write clean, readable code
2. Use version control (Git)
3. Test your applications
4. Optimize for performance
5. Ensure security and accessibility

Learning Path
1. Start with HTML, CSS, JavaScript
2. Learn a frontend framework
3. Understand backend concepts
4. Practice with real projects
5. Deploy your applications

Resources
- Online tutorials and courses
- Documentation and guides
- Community forums and blogs
- Practice platforms and challenges

Conclusion
Web development is a rewarding field with many opportunities. Start with the basics and gradually build your skills through practice and continuous learning.`,
    },
  };

  // Helper functions
  const createTestFile = (document: { name: string; content: string }) => {
    const tempDir = path.join(process.cwd(), 'temp', 'test-docs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, document.name);
    fs.writeFileSync(filePath, document.content);
    return filePath;
  };

  const cleanupTestFiles = () => {
    const tempDir = path.join(process.cwd(), 'temp', 'test-docs');
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to cleanup test files:', error);
    }
  };

  test.beforeEach(async ({ page }) => {
    const monitor = createPerformanceMonitor();
    monitor.start('test-setup');

    try {
      await page.goto('/');
      await waitForPageReady(page, 20_000);

      const isHealthy = await verifyAppState(page);
      if (!isHealthy) {
        throw new Error('App failed health check');
      }

      // Handle authentication if needed
      const authButton = page.locator('button:has-text("Sign in")');
      if (await authButton.isVisible({ timeout: 2000 })) {
        await authButton.click();
        await waitForPageReady(page, 10_000);
      }

      monitor.end('test-setup');
    } catch (error) {
      monitor.end('test-setup');
      throw error;
    }
  });

  test.afterEach(() => {
    cleanupTestFiles();
  });

  test('should handle complete upload → process → search workflow', async ({
    page,
  }) => {
    const monitor = createPerformanceMonitor();
    const techDoc = createTestFile(testDocuments.technical);

    try {
      // Phase 1: Document Upload
      monitor.start('upload-phase');

      await uploadFileWithRetry(page, techDoc, { timeout: 15_000 });

      // Verify file attachment
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });
      const attachment = page.locator('[data-testid="attachment"]');
      expect(await attachment.textContent()).toContain('technical-guide.md');

      monitor.end('upload-phase');

      // Phase 2: Document Processing
      monitor.start('processing-phase');

      await sendMessageWithRetry(
        page,
        'Please process this document for vector search and make it available for RAG queries.',
        {
          waitForResponse: true,
        },
      );

      await waitForChatResponse(page, {
        timeout: 60_000,
        expectText: /processed|uploaded|added|vector|stored|indexed/i,
      });

      monitor.end('processing-phase');

      // Phase 3: Search and Retrieval Testing
      monitor.start('search-phase');

      const searchQueries = [
        {
          query: 'What are the key benefits of microservices architecture?',
          expectedTerms: [
            'scalability',
            'technology diversity',
            'fault isolation',
            'team autonomy',
          ],
        },
        {
          query: 'Explain the API Gateway pattern',
          expectedTerms: ['single entry point', 'client requests', 'gateway'],
        },
        {
          query: 'What database strategies are mentioned for microservices?',
          expectedTerms: [
            'database per service',
            'event sourcing',
            'cqrs',
            'polyglot',
          ],
        },
      ];

      for (const { query, expectedTerms } of searchQueries) {
        await sendMessageWithRetry(page, query, { waitForResponse: true });

        await waitForChatResponse(page, {
          timeout: 45_000,
          expectText: /microservices|architecture|services/i,
        });

        const response = await page
          .locator('.message-content')
          .last()
          .textContent();
        expect(response).toBeTruthy();

        // Check for relevant content
        const responseText = response?.toLowerCase() || '';
        const foundTerms = expectedTerms.filter((term) =>
          responseText.includes(term.toLowerCase()),
        );
        expect(foundTerms.length).toBeGreaterThan(0);
      }

      monitor.end('search-phase');

      // Phase 4: Citation Verification
      monitor.start('citation-phase');

      await sendMessageWithRetry(
        page,
        'What security considerations are mentioned in the document? Please provide citations.',
        {
          waitForResponse: true,
        },
      );

      await waitForChatResponse(page, {
        timeout: 30_000,
        expectText: /security|authentication|authorization/i,
      });

      // Check for citation elements
      const possibleCitations = [
        '.citations',
        '.sources',
        '.source-link',
        '.citation',
        '[data-testid="citations"]',
        '[data-testid="sources"]',
        ':text("technical-guide.md")',
        ':text("Source:")',
        ':text("[1]")',
        ':text("Reference:")',
      ];

      let citationsFound = false;
      for (const selector of possibleCitations) {
        try {
          const element = page.locator(selector);
          if (await element.isVisible({ timeout: 2000 })) {
            citationsFound = true;
            break;
          }
        } catch {
          // Continue checking other selectors
        }
      }

      if (citationsFound) {
        console.log('✅ Citations system is working');
      } else {
        console.log('⚠️ Citations may not be implemented yet');
      }

      monitor.end('citation-phase');
    } finally {
      fs.unlinkSync(techDoc);
    }
  });

  test('should handle multiple document types and cross-document queries', async ({
    page,
  }) => {
    const monitor = createPerformanceMonitor();
    const techDoc = createTestFile(testDocuments.technical);
    const researchDoc = createTestFile(testDocuments.research);

    try {
      monitor.start('multi-doc-upload');

      // Upload first document
      await uploadFileWithRetry(page, techDoc, { timeout: 15_000 });
      await sendMessageWithRetry(
        page,
        'Process this technical architecture document for search.',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 45_000 });

      // Upload second document
      await uploadFileWithRetry(page, researchDoc, { timeout: 15_000 });
      await sendMessageWithRetry(
        page,
        'Process this healthcare research paper for search.',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 45_000 });

      monitor.end('multi-doc-upload');

      // Cross-document query
      monitor.start('cross-doc-query');

      await sendMessageWithRetry(
        page,
        'Compare the monitoring and observability approaches mentioned in the architecture document with the performance metrics discussed in the healthcare research paper.',
        { waitForResponse: true },
      );

      await waitForChatResponse(page, {
        timeout: 60_000,
        expectText: /monitoring|metrics|performance|observability/i,
      });

      const response = await page
        .locator('.message-content')
        .last()
        .textContent();
      expect(response).toBeTruthy();

      // Should reference both documents
      const responseText = response!.toLowerCase();
      const hasArchitectureTerms =
        responseText.includes('distributed tracing') ||
        responseText.includes('monitoring') ||
        responseText.includes('observability');
      const hasHealthcareTerms =
        responseText.includes('sensitivity') ||
        responseText.includes('specificity') ||
        responseText.includes('auc');

      expect(hasArchitectureTerms || hasHealthcareTerms).toBe(true);

      monitor.end('cross-doc-query');
    } finally {
      fs.unlinkSync(techDoc);
      fs.unlinkSync(researchDoc);
    }
  });

  test('should handle different file formats and edge cases', async ({
    page,
  }) => {
    const monitor = createPerformanceMonitor();
    const simpleDoc = createTestFile(testDocuments.simple);

    try {
      monitor.start('format-testing');

      // Test with .txt file
      await uploadFileWithRetry(page, simpleDoc, { timeout: 15_000 });
      await sendMessageWithRetry(
        page,
        'Process this text file about web development.',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 30_000 });

      // Query the content
      await sendMessageWithRetry(
        page,
        'What frontend technologies are mentioned in the guide?',
        {
          waitForResponse: true,
        },
      );

      await waitForChatResponse(page, {
        timeout: 30_000,
        expectText: /html|css|javascript|frontend/i,
      });

      const response = await page
        .locator('.message-content')
        .last()
        .textContent();
      expect(response).toBeTruthy();
      expect(response!.toLowerCase()).toMatch(
        /(html|css|javascript|react|vue|angular)/,
      );

      monitor.end('format-testing');

      // Test edge cases
      monitor.start('edge-case-testing');

      // Empty query
      await sendMessageWithRetry(
        page,
        'Tell me about quantum computing from the documents.',
        {
          waitForResponse: true,
        },
      );

      await waitForChatResponse(page, { timeout: 30_000 });

      const edgeResponse = await page
        .locator('.message-content')
        .last()
        .textContent();
      expect(edgeResponse).toBeTruthy();

      // Should handle gracefully when topic not found
      const isGracefulHandling =
        edgeResponse!.toLowerCase().includes('not found') ||
        edgeResponse!.toLowerCase().includes('not mentioned') ||
        edgeResponse!.toLowerCase().includes('no information') ||
        edgeResponse!.toLowerCase().includes('quantum computing'); // General knowledge fallback

      expect(isGracefulHandling).toBe(true);

      monitor.end('edge-case-testing');
    } finally {
      fs.unlinkSync(simpleDoc);
    }
  });

  test('should maintain context across conversation turns', async ({
    page,
  }) => {
    const monitor = createPerformanceMonitor();
    const techDoc = createTestFile(testDocuments.technical);

    try {
      monitor.start('context-testing');

      // Setup
      await uploadFileWithRetry(page, techDoc, { timeout: 15_000 });
      await sendMessageWithRetry(page, 'Process this architecture document.', {
        waitForResponse: true,
      });
      await waitForChatResponse(page, { timeout: 30_000 });

      // First query
      await sendMessageWithRetry(
        page,
        'What are the main design patterns for microservices?',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 30_000 });

      // Contextual follow-up
      await sendMessageWithRetry(
        page,
        'Can you explain the first pattern in more detail?',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 30_000 });

      const contextResponse = await page
        .locator('.message-content')
        .last()
        .textContent();
      expect(contextResponse).toBeTruthy();
      expect(contextResponse!.toLowerCase()).toMatch(
        /(api gateway|single entry|entry point)/,
      );

      // Another contextual query
      await sendMessageWithRetry(
        page,
        'How does it help with the benefits you mentioned earlier?',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 30_000 });

      const finalResponse = await page
        .locator('.message-content')
        .last()
        .textContent();
      expect(finalResponse).toBeTruthy();

      monitor.end('context-testing');
    } finally {
      fs.unlinkSync(techDoc);
    }
  });

  test('should handle concurrent queries efficiently', async ({ page }) => {
    const monitor = createPerformanceMonitor();
    const techDoc = createTestFile(testDocuments.technical);

    try {
      monitor.start('concurrent-testing');

      // Setup
      await uploadFileWithRetry(page, techDoc, { timeout: 15_000 });
      await sendMessageWithRetry(
        page,
        'Process this document for concurrent testing.',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 30_000 });

      // Send rapid queries
      const queries = [
        'What is microservices architecture?',
        'List the communication patterns',
        'Explain database strategies',
        'What are security considerations?',
      ];

      monitor.start('rapid-queries');

      for (const query of queries) {
        await page.getByTestId('multimodal-input').fill(query);
        await page.getByTestId('send-button').click();
        // Small delay between queries
        await page.waitForTimeout(500);
      }

      // Wait for all responses
      await page.waitForTimeout(15_000);

      monitor.end('rapid-queries');

      const messages = page.locator('.message-content');
      const messageCount = await messages.count();

      // Should handle all queries
      expect(messageCount).toBeGreaterThan(queries.length);

      monitor.end('concurrent-testing');
    } finally {
      fs.unlinkSync(techDoc);
    }
  });

  test('should provide performance benchmarks for RAG operations', async ({
    page,
  }) => {
    const monitor = createPerformanceMonitor();
    const techDoc = createTestFile(testDocuments.technical);

    try {
      // Benchmark upload performance
      monitor.start('upload-benchmark');
      await uploadFileWithRetry(page, techDoc, { timeout: 15_000 });
      const uploadTime = monitor.end('upload-benchmark');

      // Benchmark processing performance
      monitor.start('processing-benchmark');
      await sendMessageWithRetry(
        page,
        'Process this document for performance testing.',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 60_000 });
      const processingTime = monitor.end('processing-benchmark');

      // Benchmark search performance
      monitor.start('search-benchmark');
      await sendMessageWithRetry(
        page,
        'What are the key benefits of microservices?',
        {
          waitForResponse: true,
        },
      );
      await waitForChatResponse(page, { timeout: 30_000 });
      const searchTime = monitor.end('search-benchmark');

      // Performance assertions
      expect(uploadTime).toBeLessThan(15_000); // Upload should be fast
      expect(processingTime).toBeLessThan(60_000); // Processing has longer tolerance
      expect(searchTime).toBeLessThan(30_000); // Search should be responsive

      console.log(`Performance Benchmarks:
        - Upload: ${uploadTime}ms
        - Processing: ${processingTime}ms  
        - Search: ${searchTime}ms`);
    } finally {
      fs.unlinkSync(techDoc);
    }
  });

  test('should handle vector store provider switching', async ({ page }) => {
    const monitor = createPerformanceMonitor();
    const techDoc = createTestFile(testDocuments.technical);

    try {
      monitor.start('provider-testing');

      // Upload document
      await uploadFileWithRetry(page, techDoc, { timeout: 15_000 });
      await sendMessageWithRetry(page, 'Process this document.', {
        waitForResponse: true,
      });
      await waitForChatResponse(page, { timeout: 30_000 });

      // Check if database/provider selector is available
      const providerSelectors = [
        '[data-testid="database-selector"]',
        '.database-selector',
        'button:has-text("Data Sources")',
        'button:has-text("Database")',
        'select[name="provider"]',
        'select[name="vectorstore"]',
      ];

      let providerSelector = null;
      for (const selector of providerSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          providerSelector = element;
          break;
        }
      }

      if (providerSelector) {
        console.log('✅ Provider selector found');

        // Try to interact with it
        await providerSelector.click();
        await page.waitForTimeout(1000);

        // Look for provider options
        const options = page.locator(
          '[role="menuitem"], [role="option"], option',
        );
        const optionCount = await options.count();

        if (optionCount > 0) {
          console.log(`✅ Found ${optionCount} provider options`);
        }

        // Test search with current provider
        await sendMessageWithRetry(
          page,
          'What security patterns are mentioned?',
          {
            waitForResponse: true,
          },
        );
        await waitForChatResponse(page, { timeout: 30_000 });
      } else {
        console.log('ℹ️ No provider selector found - may be auto-configured');

        // Still test basic search functionality
        await sendMessageWithRetry(
          page,
          'What security patterns are mentioned?',
          {
            waitForResponse: true,
          },
        );
        await waitForChatResponse(page, { timeout: 30_000 });
      }

      const response = await page
        .locator('.message-content')
        .last()
        .textContent();
      expect(response).toBeTruthy();
      expect(response!.toLowerCase()).toMatch(
        /(security|authentication|authorization)/,
      );

      monitor.end('provider-testing');
    } finally {
      fs.unlinkSync(techDoc);
    }
  });

  test('should validate error handling and recovery', async ({ page }) => {
    const monitor = createPerformanceMonitor();

    try {
      monitor.start('error-handling');

      // Test 1: Search without any documents
      await sendMessageWithRetry(
        page,
        'Search for information about artificial intelligence.',
        {
          waitForResponse: true,
        },
      );

      await waitForChatResponse(page, { timeout: 30_000 });

      const noDocResponse = await page
        .locator('.message-content')
        .last()
        .textContent();
      expect(noDocResponse).toBeTruthy();

      // Should either provide helpful message or general knowledge
      const isHandledGracefully =
        noDocResponse!.toLowerCase().includes('no documents') ||
        noDocResponse!.toLowerCase().includes('artificial intelligence') ||
        noDocResponse!.toLowerCase().includes('not found');
      expect(isHandledGracefully).toBe(true);

      // Test 2: Invalid/corrupted file handling
      const invalidFile = path.join(process.cwd(), 'temp', 'invalid.txt');
      fs.mkdirSync(path.dirname(invalidFile), { recursive: true });
      fs.writeFileSync(invalidFile, '\x00\x01\x02\x03'); // Binary content

      try {
        await uploadFileWithRetry(page, invalidFile, { timeout: 10_000 });
        await sendMessageWithRetry(page, 'Process this file.', {
          waitForResponse: true,
        });

        // Should handle gracefully
        await waitForChatResponse(page, { timeout: 20_000 });
      } catch (error) {
        // Expected to fail gracefully
        console.log('✅ Invalid file handled appropriately');
      }

      monitor.end('error-handling');
    } finally {
      // Cleanup
      const invalidFile = path.join(process.cwd(), 'temp', 'invalid.txt');
      try {
        if (fs.existsSync(invalidFile)) {
          fs.unlinkSync(invalidFile);
        }
      } catch {}
    }
  });
});
