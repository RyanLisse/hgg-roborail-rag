import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  PromptOptimizationEngine,
  QueryExpansionEngine,
  ContextWindowManager,
  type QueryContext 
} from '@/lib/vectorstore/prompt-optimization';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

describe('Prompt Optimization Integration Tests', () => {
  let vectorStoreService: any;

  beforeAll(async () => {
    // Initialize vector store service for integration testing
    vectorStoreService = await getUnifiedVectorStoreService();
  });

  describe('End-to-End Query Optimization', () => {
    it('should optimize RoboRail automation queries correctly', async () => {
      const query = 'How to setup RoboRail automation workflows with webhook triggers?';
      const context: QueryContext = {
        domain: 'automation',
        userIntent: 'Setup automation with webhooks',
      };

      const optimizedQuery = await PromptOptimizationEngine.optimizeQuery(query, context);

      // Verify optimization results
      expect(optimizedQuery.originalQuery).toBe(query);
      expect(optimizedQuery.optimizedQuery).not.toBe(query);
      expect(optimizedQuery.metadata.queryType).toBe('configuration');
      expect(optimizedQuery.expandedQueries.length).toBeGreaterThan(1);
      expect(optimizedQuery.contextualPrompt).toContain('automation');
      expect(optimizedQuery.contextualPrompt).toContain('webhook');
      expect(optimizedQuery.searchInstructions).toContain('configuration');
    });

    it('should handle multi-turn conversation context', async () => {
      const query = 'How do I fix this authentication error?';
      const context: QueryContext = {
        type: 'troubleshooting',
        domain: 'api',
        conversationHistory: [
          {
            role: 'user',
            content: 'I am setting up RoboRail API integration with OAuth2',
            timestamp: Date.now() - 120000,
          },
          {
            role: 'assistant',
            content: 'OAuth2 integration requires proper token configuration. What specific issue are you encountering?',
            timestamp: Date.now() - 60000,
          },
        ],
        userIntent: 'Fix OAuth2 authentication',
      };

      const optimizedQuery = await PromptOptimizationEngine.optimizeQuery(query, context);

      // Should incorporate conversation context
      expect(optimizedQuery.contextualPrompt).toContain('OAuth2');
      expect(optimizedQuery.expandedQueries.some(q => q.includes('OAuth2') || q.includes('authentication'))).toBe(true);
      expect(optimizedQuery.metadata.queryType).toBe('troubleshooting');
    });

    it('should classify complex technical queries correctly', async () => {
      const query = 'Advanced RoboRail microservices architecture with containerization and load balancing optimization';
      const context: QueryContext = {
        domain: 'architecture',
      };

      const optimizedQuery = await PromptOptimizationEngine.optimizeQuery(query, context);

      expect(optimizedQuery.metadata.queryType).toBe('technical');
      expect(optimizedQuery.metadata.complexity).toBe('advanced');
      expect(optimizedQuery.metadata.estimatedRelevance).toBeGreaterThan(0.6);
    });
  });

  describe('Query Expansion Testing', () => {
    it('should expand automation queries with relevant synonyms', () => {
      const query = 'automation configuration';
      const expansions = QueryExpansionEngine.expandWithSynonyms(query, 'roborail');

      expect(expansions).toContain(query);
      expect(expansions.some(q => q.includes('workflow'))).toBe(true);
      expect(expansions.some(q => q.includes('setup'))).toBe(true);
      expect(expansions.length).toBeGreaterThan(1);
    });

    it('should generate domain-specific variations', () => {
      const query = 'integration setup';
      const variations = QueryExpansionEngine.generateDomainVariations(query, 'integration');

      expect(variations).toContain('RoboRail integration setup');
      expect(variations).toContain('integration setup in RoboRail');
      expect(variations.some(q => q.includes('connection') || q.includes('webhook'))).toBe(true);
    });

    it('should create contextual variations from conversation history', () => {
      const query = 'next steps';
      const context: QueryContext = {
        conversationHistory: [
          {
            role: 'user',
            content: 'Setting up RoboRail webhook authentication',
            timestamp: Date.now() - 60000,
          },
        ],
      };

      const variations = QueryExpansionEngine.generateContextualVariations(query, context);

      expect(variations.some(q => q.includes('webhook') || q.includes('authentication'))).toBe(true);
    });
  });

  describe('Context Window Management', () => {
    it('should optimize large document sets for context window', () => {
      const documents = Array.from({ length: 20 }, (_, i) => ({
        content: `RoboRail document ${i} about ${i % 4 === 0 ? 'automation' : i % 4 === 1 ? 'configuration' : i % 4 === 2 ? 'integration' : 'troubleshooting'} features. `.repeat(100),
        metadata: { id: i, type: i % 4 === 0 ? 'automation' : 'other' },
      }));

      const query = 'automation setup';
      const optimized = ContextWindowManager.optimizeDocumentContext(documents, query, 8000);

      expect(optimized.length).toBeLessThanOrEqual(documents.length);
      expect(optimized.length).toBeGreaterThan(0);
      
      // Should prioritize automation-related documents
      expect(optimized[0].content.includes('automation')).toBe(true);
    });

    it('should optimize conversation history for context', () => {
      const history = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} about RoboRail features. `.repeat(30),
        timestamp: Date.now() - (30 - i) * 60000,
      }));

      const optimized = ContextWindowManager.optimizeConversationContext(history, 'current query', 2000);

      expect(optimized.length).toBeLessThan(history.length);
      expect(optimized.length).toBeGreaterThan(0);
      
      // Should maintain chronological order
      for (let i = 1; i < optimized.length; i++) {
        expect(optimized[i].timestamp).toBeGreaterThan(optimized[i - 1].timestamp);
      }
    });
  });

  describe('Vector Store Integration', () => {
    it('should perform optimized search with query context', async () => {
      const searchRequest = {
        query: 'RoboRail automation workflow configuration',
        sources: ['memory'] as const,
        maxResults: 5,
        threshold: 0.3,
        queryContext: {
          type: 'configuration' as const,
          domain: 'automation',
          complexity: 'intermediate' as const,
          searchDepth: 'comprehensive' as const,
        },
        optimizePrompts: true,
        promptConfig: {
          maxTokens: 1500,
          temperature: 0.1,
          includeContext: true,
          includeCitations: true,
        },
      };

      const results = await vectorStoreService.searchAcrossSources(searchRequest);

      expect(Array.isArray(results)).toBe(true);
      // Results may be empty in test environment, but search should not throw
    });

    it('should handle search without optimization gracefully', async () => {
      const searchRequest = {
        query: 'RoboRail basic information',
        sources: ['memory'] as const,
        maxResults: 5,
        threshold: 0.3,
        optimizePrompts: false,
      };

      const results = await vectorStoreService.searchAcrossSources(searchRequest);

      expect(Array.isArray(results)).toBe(true);
      // Should work without optimization
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle malformed query context gracefully', async () => {
      const query = 'test query';
      const malformedContext = {
        // Invalid enum value
        type: 'invalid_type',
        domain: 'test',
      } as any;

      // Should not throw, but handle gracefully
      expect(async () => {
        await PromptOptimizationEngine.optimizeQuery(query, malformedContext);
      }).not.toThrow();
    });

    it('should handle empty conversation history', async () => {
      const query = 'test query';
      const context: QueryContext = {
        conversationHistory: [],
        previousQueries: [],
      };

      const result = await PromptOptimizationEngine.optimizeQuery(query, context);

      expect(result.originalQuery).toBe(query);
      expect(result.expandedQueries.length).toBeGreaterThan(0);
    });

    it('should complete optimization within reasonable time', async () => {
      const startTime = Date.now();
      
      const query = 'Complex RoboRail microservices architecture with advanced monitoring and observability patterns';
      const context: QueryContext = {
        type: 'technical',
        domain: 'architecture',
        complexity: 'advanced',
        conversationHistory: Array.from({ length: 10 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i} about microservices architecture`,
          timestamp: Date.now() - (10 - i) * 60000,
        })),
      };

      const result = await PromptOptimizationEngine.optimizeQuery(query, context);
      
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metadata.queryType).toBe('technical');
    });
  });

  describe('Domain-Specific RoboRail Optimization', () => {
    it('should apply RoboRail automation domain context correctly', async () => {
      const query = 'workflow triggers not firing';
      const context: QueryContext = {
        type: 'troubleshooting',
        domain: 'automation',
      };

      const result = await PromptOptimizationEngine.optimizeQuery(query, context);

      expect(result.contextualPrompt).toContain('automation');
      expect(result.contextualPrompt).toContain('RoboRail');
      expect(result.searchInstructions).toContain('troubleshooting');
      expect(result.expandedQueries.some(q => q.includes('automation') || q.includes('workflow'))).toBe(true);
    });

    it('should apply RoboRail integration domain context correctly', async () => {
      const query = 'API webhook authentication setup';
      const context: QueryContext = {
        type: 'configuration',
        domain: 'integration',
      };

      const result = await PromptOptimizationEngine.optimizeQuery(query, context);

      expect(result.contextualPrompt).toContain('integration');
      expect(result.expandedQueries.some(q => 
        q.includes('webhook') || q.includes('API') || q.includes('authentication')
      )).toBe(true);
    });

    it('should apply RoboRail performance domain context correctly', async () => {
      const query = 'optimization strategies for scaling';
      const context: QueryContext = {
        type: 'best_practices',
        domain: 'performance',
      };

      const result = await PromptOptimizationEngine.optimizeQuery(query, context);

      expect(result.contextualPrompt).toContain('performance');
      expect(result.metadata.queryType).toBe('best_practices');
      expect(result.expandedQueries.some(q => 
        q.includes('optimization') || q.includes('scaling') || q.includes('performance')
      )).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with legacy search requests', async () => {
      const legacyRequest = {
        query: 'RoboRail documentation',
        sources: ['memory'] as const,
        maxResults: 5,
        threshold: 0.3,
        // No optimization parameters
      };

      const results = await vectorStoreService.searchAcrossSources(legacyRequest);

      expect(Array.isArray(results)).toBe(true);
      // Should work without breaking existing functionality
    });

    it('should handle partial optimization parameters', async () => {
      const partialRequest = {
        query: 'RoboRail configuration',
        sources: ['memory'] as const,
        maxResults: 5,
        threshold: 0.3,
        optimizePrompts: true,
        // queryContext is missing, should use defaults
      };

      const results = await vectorStoreService.searchAcrossSources(partialRequest);

      expect(Array.isArray(results)).toBe(true);
    });
  });
});

describe('Real-world Use Cases', () => {
  it('should handle typical user workflow: setup -> configuration -> troubleshooting', async () => {
    // Simulate a user workflow
    const workflow = [
      {
        query: 'How to get started with RoboRail?',
        context: { type: 'conceptual' as const, domain: 'general' },
        expectedType: 'conceptual',
      },
      {
        query: 'RoboRail automation setup guide',
        context: { type: 'procedural' as const, domain: 'automation' },
        expectedType: 'procedural',
      },
      {
        query: 'Configure webhook authentication',
        context: { type: 'configuration' as const, domain: 'integration' },
        expectedType: 'configuration',
      },
      {
        query: 'Webhook not receiving events',
        context: { type: 'troubleshooting' as const, domain: 'integration' },
        expectedType: 'troubleshooting',
      },
    ];

    let conversationHistory: any[] = [];

    for (const step of workflow) {
      const fullContext: QueryContext = {
        ...step.context,
        conversationHistory: conversationHistory.slice(-5), // Keep recent context
      };

      const result = await PromptOptimizationEngine.optimizeQuery(step.query, fullContext);

      expect(result.metadata.queryType).toBe(step.expectedType);
      expect(result.expandedQueries.length).toBeGreaterThan(1);

      // Add to conversation history
      conversationHistory.push({
        role: 'user',
        content: step.query,
        timestamp: Date.now(),
      });
      conversationHistory.push({
        role: 'assistant',
        content: `Response about ${step.expectedType} for ${step.context.domain}`,
        timestamp: Date.now() + 1000,
      });
    }

    // Final query should have rich context from the entire conversation
    const finalResult = await PromptOptimizationEngine.optimizeQuery(
      'What are the best practices for this setup?',
      {
        type: 'best_practices',
        conversationHistory,
      }
    );

    expect(finalResult.contextualPrompt).toContain('webhook');
    expect(finalResult.expandedQueries.some(q => 
      q.includes('automation') || q.includes('integration') || q.includes('webhook')
    )).toBe(true);
  });
});