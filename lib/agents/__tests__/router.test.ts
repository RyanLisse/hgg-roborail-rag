import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SmartAgentRouter } from '../router';
import type { QueryComplexity, VectorStoreType } from '../types';

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// Mock providers
vi.mock('../../ai/providers', () => ({
  getModelInstance: vi.fn().mockReturnValue('mocked-model'),
}));

// Mock unified vector store
vi.mock('../../vectorstore/unified', () => ({
  getUnifiedVectorStoreService: vi.fn(() =>
    Promise.resolve({
      searchAcrossSources: vi.fn(() => Promise.resolve([])),
      getAvailableSources: vi.fn(() =>
        Promise.resolve(['openai', 'memory', 'neon']),
      ),
      healthCheck: vi.fn(() => Promise.resolve({ isHealthy: true })),
      config: {
        sources: ['openai', 'memory', 'neon'],
        searchThreshold: 0.3,
        maxResults: 10,
      },
    }),
  ),
}));

import { generateText } from 'ai';

const mockGenerateText = generateText as any;

describe('SmartAgentRouter', () => {
  let router: SmartAgentRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new SmartAgentRouter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Intent Classification', () => {
    it('should classify question_answering intent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'question_answering',
      });

      const intent = await router.classifyIntent(
        'What is the capital of France?',
      );

      expect(intent).toBe('question_answering');
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining(
                'What is the capital of France?',
              ),
            }),
          ]),
        }),
      );
    });

    it('should classify summarization intent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'summarization',
      });

      const intent = await router.classifyIntent(
        'Please summarize this document',
      );

      expect(intent).toBe('summarization');
    });

    it('should classify rewriting intent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'rewriting',
      });

      const intent = await router.classifyIntent(
        'Can you rewrite this paragraph?',
      );

      expect(intent).toBe('rewriting');
    });

    it('should classify planning intent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'planning',
      });

      const intent = await router.classifyIntent('Help me plan a project');

      expect(intent).toBe('planning');
    });

    it('should classify research intent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'research',
      });

      const intent = await router.classifyIntent(
        'Research the latest trends in AI',
      );

      expect(intent).toBe('research');
    });

    it('should classify comparison intent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'comparison',
      });

      const intent = await router.classifyIntent(
        'Compare Python and JavaScript',
      );

      expect(intent).toBe('comparison');
    });

    it('should classify analysis intent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'analysis',
      });

      const intent = await router.classifyIntent('Analyze the market data');

      expect(intent).toBe('analysis');
    });

    it('should handle fuzzy matching for intent classification', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'This is question answering about factual information',
      });

      const intent = await router.classifyIntent('What is AI?');

      expect(intent).toBe('question_answering');
    });

    it('should default to question_answering for unclear responses', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'unclear response',
      });

      const intent = await router.classifyIntent('Some ambiguous query');

      expect(intent).toBe('question_answering');
    });

    it('should handle classification errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockGenerateText.mockRejectedValueOnce(new Error('API Error'));

      const intent = await router.classifyIntent('Test query');

      expect(intent).toBe('question_answering');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Intent classification failed, defaulting to question_answering:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Complexity Analysis', () => {
    it('should classify simple queries', async () => {
      const complexity = await router.analyzeComplexity('What is AI?');

      expect(complexity.level).toBe('simple');
      expect(complexity.factors.wordCount).toBe(3);
      expect(complexity.factors.questionCount).toBe(1);
      expect(complexity.score).toBeLessThan(0.3);
    });

    it('should classify moderate complexity queries', async () => {
      const query =
        'Can you explain the differences between machine learning and deep learning, including their applications in modern technology?';
      const complexity = await router.analyzeComplexity(query);

      expect(complexity.level).toBe('moderate');
      expect(complexity.factors.wordCount).toBeGreaterThan(10);
      expect(complexity.score).toBeGreaterThanOrEqual(0.3);
      expect(complexity.score).toBeLessThanOrEqual(0.6);
    });

    it('should classify complex queries', async () => {
      const query =
        'Analyze the comprehensive impact of artificial intelligence on healthcare systems, including machine learning algorithms, data privacy concerns, regulatory frameworks, and step-by-step implementation strategies for hospitals. Compare current AI solutions and synthesize recommendations for future development.';
      const complexity = await router.analyzeComplexity(query);

      expect(complexity.level).toBe('complex');
      expect(complexity.factors.wordCount).toBeGreaterThan(30);
      expect(complexity.factors.technicalTerms).toBeGreaterThan(0);
      expect(complexity.factors.requiresMultipleSteps).toBe(true);
      expect(complexity.factors.requiresSynthesis).toBe(true);
      expect(complexity.score).toBeGreaterThan(0.6);
    });

    it('should detect technical terms', async () => {
      const query =
        'Configure the REST API with JSON responses using SQL database and ML algorithms';
      const complexity = await router.analyzeComplexity(query);

      expect(complexity.factors.technicalTerms).toBeGreaterThan(3);
    });

    it('should detect multi-step requirements', async () => {
      const query =
        'First, analyze the data, then create a model, and finally deploy it to production';
      const complexity = await router.analyzeComplexity(query);

      expect(complexity.factors.requiresMultipleSteps).toBe(true);
    });

    it('should detect external data needs', async () => {
      const query = 'What is the current price of Bitcoin today?';
      const complexity = await router.analyzeComplexity(query);

      expect(complexity.factors.requiresExternalData).toBe(true);
    });

    it('should detect synthesis requirements', async () => {
      const query =
        'Analyze and evaluate the pros and cons of different programming languages';
      const complexity = await router.analyzeComplexity(query);

      expect(complexity.factors.requiresSynthesis).toBe(true);
    });
  });

  describe('Agent Selection', () => {
    const mockComplexity: QueryComplexity = {
      level: 'moderate',
      factors: {
        wordCount: 10,
        questionCount: 1,
        technicalTerms: 2,
        requiresMultipleSteps: false,
        requiresExternalData: false,
        requiresSynthesis: false,
      },
      score: 0.4,
    };

    const availableSources: VectorStoreType[] = ['openai', 'memory'];

    it('should select rewrite agent for summarization', () => {
      const agent = router.selectAgent(
        'summarization',
        mockComplexity,
        availableSources,
      );
      expect(agent).toBe('rewrite');
    });

    it('should select rewrite agent for rewriting', () => {
      const agent = router.selectAgent(
        'rewriting',
        mockComplexity,
        availableSources,
      );
      expect(agent).toBe('rewrite');
    });

    it('should select planner agent for planning', () => {
      const agent = router.selectAgent(
        'planning',
        mockComplexity,
        availableSources,
      );
      expect(agent).toBe('planner');
    });

    it('should select research agent for research', () => {
      const agent = router.selectAgent(
        'research',
        mockComplexity,
        availableSources,
      );
      expect(agent).toBe('research');
    });

    it('should select research agent for analysis', () => {
      const agent = router.selectAgent(
        'analysis',
        mockComplexity,
        availableSources,
      );
      expect(agent).toBe('research');
    });

    it('should select QA agent for simple comparisons', () => {
      const simpleComplexity: QueryComplexity = {
        ...mockComplexity,
        level: 'simple',
      };
      const agent = router.selectAgent(
        'comparison',
        simpleComplexity,
        availableSources,
      );
      expect(agent).toBe('qa');
    });

    it('should select research agent for complex comparisons', () => {
      const complexComplexity: QueryComplexity = {
        ...mockComplexity,
        level: 'complex',
      };
      const agent = router.selectAgent(
        'comparison',
        complexComplexity,
        availableSources,
      );
      expect(agent).toBe('research');
    });

    it('should select planner for complex multi-step questions', () => {
      const complexComplexity: QueryComplexity = {
        ...mockComplexity,
        level: 'complex',
        factors: {
          ...mockComplexity.factors,
          requiresMultipleSteps: true,
        },
      };
      const agent = router.selectAgent(
        'question_answering',
        complexComplexity,
        availableSources,
      );
      expect(agent).toBe('planner');
    });

    it('should select research for complex synthesis questions', () => {
      const complexComplexity: QueryComplexity = {
        ...mockComplexity,
        level: 'complex',
        factors: {
          ...mockComplexity.factors,
          requiresSynthesis: true,
        },
      };
      const agent = router.selectAgent(
        'question_answering',
        complexComplexity,
        availableSources,
      );
      expect(agent).toBe('research');
    });

    it('should select QA for simple questions', () => {
      const simpleComplexity: QueryComplexity = {
        ...mockComplexity,
        level: 'simple',
      };
      const agent = router.selectAgent(
        'question_answering',
        simpleComplexity,
        availableSources,
      );
      expect(agent).toBe('qa');
    });
  });

  describe('Complete Routing Process', () => {
    beforeEach(() => {
      // Mock the getAvailableSources method
      vi.spyOn(router as any, 'getAvailableSources').mockResolvedValue([
        'openai',
        'memory',
      ]);
    });

    it('should route simple question to QA agent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'question_answering',
      });

      const decision = await router.routeQuery('What is AI?');

      expect(decision.selectedAgent).toBe('qa');
      expect(decision.confidence).toBeGreaterThan(0.5);
      expect(decision.fallbackAgent).toBe('research');
      expect(decision.estimatedComplexity).toBe('simple');
      expect(decision.suggestedSources).toContain('openai');
    });

    it('should route summarization request to rewrite agent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'summarization',
      });

      const decision = await router.routeQuery(
        'Please summarize this document for me',
      );

      expect(decision.selectedAgent).toBe('rewrite');
      expect(decision.fallbackAgent).toBe('qa');
      expect(decision.reasoning).toContain('rewrite agent for summarization');
    });

    it('should route complex research query to research agent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'research',
      });

      const complexQuery =
        'Conduct comprehensive research on the impact of artificial intelligence on healthcare systems, analyzing current trends, regulatory challenges, and future opportunities. Compare different AI implementations and synthesize recommendations.';
      const decision = await router.routeQuery(complexQuery);

      expect(decision.selectedAgent).toBe('research');
      expect(decision.estimatedComplexity).toBe('moderate');
      expect(decision.suggestedSources.length).toBeGreaterThanOrEqual(2);
    });

    it('should route planning request to planner agent', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'planning',
      });

      const decision = await router.routeQuery(
        'Help me create a step-by-step plan for launching a startup',
      );

      expect(decision.selectedAgent).toBe('planner');
      expect(decision.fallbackAgent).toBe('qa');
    });

    it('should handle routing errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockGenerateText.mockRejectedValueOnce(new Error('API Error'));

      const decision = await router.routeQuery('Test query');

      expect(decision.selectedAgent).toBe('qa');
      expect(decision.confidence).toBeCloseTo(0.8, 5);
      expect(decision.reasoning).toContain('question_answering');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Intent classification failed, defaulting to question_answering:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should calculate high confidence for clear intent indicators', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'rewriting',
      });

      const decision = await router.routeQuery(
        'Please rewrite this text to be more professional',
      );

      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    it('should include multi-step reasoning in decision', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'planning',
      });

      const decision = await router.routeQuery(
        'First, analyze the market, then create a business plan, and finally launch the product',
      );

      expect(decision.reasoning).toContain('Multi-step approach needed');
    });

    it('should include synthesis reasoning in decision', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'research',
      });

      const decision = await router.routeQuery(
        'Analyze and evaluate the comprehensive benefits and drawbacks of different cloud platforms',
      );

      expect(decision.reasoning).toContain('Information synthesis required');
    });
  });

  describe('Source Selection', () => {
    const availableSources: VectorStoreType[] = ['openai', 'memory', 'neon'];

    it('should select multiple sources for research agent', () => {
      const sources = (router as any).selectOptimalSources(
        'research',
        'research',
        availableSources,
      );
      expect(sources.length).toBe(3);
    });

    it('should prioritize OpenAI for simple QA', () => {
      const sources = (router as any).selectOptimalSources(
        'question_answering',
        'qa',
        availableSources,
      );
      expect(sources).toContain('openai');
      expect(sources.length).toBe(1);
    });

    it('should select default sources for other agents', () => {
      const sources = (router as any).selectOptimalSources(
        'rewriting',
        'rewrite',
        availableSources,
      );
      expect(sources.length).toBe(2);
    });

    it('should handle limited available sources', () => {
      const limitedSources: VectorStoreType[] = ['memory'];
      const sources = (router as any).selectOptimalSources(
        'research',
        'research',
        limitedSources,
      );
      expect(sources.length).toBe(1);
      expect(sources).toEqual(['memory']);
    });
  });

  describe('Fallback Logic', () => {
    it('should provide correct fallbacks for each agent type', () => {
      expect((router as any).getFallbackAgent('qa')).toBe('research');
      expect((router as any).getFallbackAgent('rewrite')).toBe('qa');
      expect((router as any).getFallbackAgent('planner')).toBe('qa');
      expect((router as any).getFallbackAgent('research')).toBe('qa');
    });
  });

  describe('Confidence Calculation', () => {
    const mockComplexity: QueryComplexity = {
      level: 'simple',
      factors: {
        wordCount: 5,
        questionCount: 1,
        technicalTerms: 0,
        requiresMultipleSteps: false,
        requiresExternalData: false,
        requiresSynthesis: false,
      },
      score: 0.2,
    };

    it('should boost confidence for explicit intent keywords', () => {
      const rewriteConfidence = (router as any).calculateRoutingConfidence(
        'rewriting',
        mockComplexity,
        'Please rewrite this text',
      );
      const baseConfidence = (router as any).calculateRoutingConfidence(
        'rewriting',
        mockComplexity,
        'Modify this content',
      );

      expect(rewriteConfidence).toBeGreaterThan(baseConfidence);
    });

    it('should boost confidence for planning keywords', () => {
      const confidence = (router as any).calculateRoutingConfidence(
        'planning',
        mockComplexity,
        'Help me plan this step by step',
      );

      expect(confidence).toBeGreaterThan(0.8);
    });

    it('should boost confidence for research keywords', () => {
      const confidence = (router as any).calculateRoutingConfidence(
        'research',
        mockComplexity,
        'Research and analyze this topic',
      );

      expect(confidence).toBeGreaterThan(0.8);
    });

    it('should boost confidence for simple question-answering alignment', () => {
      const confidence = (router as any).calculateRoutingConfidence(
        'question_answering',
        mockComplexity,
        'What is the answer?',
      );

      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should cap confidence at 1.0', () => {
      const confidence = (router as any).calculateRoutingConfidence(
        'rewriting',
        mockComplexity,
        'Please rewrite and plan this step by step research',
      );

      expect(confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Detection Methods', () => {
    it('should detect multi-step queries', () => {
      const queries = [
        'First do this, then do that',
        'What are the steps to complete this?',
        '1. Start here 2. Then here',
        'How to guide for beginners',
        'Process and then additional steps',
      ];

      queries.forEach((query) => {
        expect((router as any).detectMultiStepQuery(query)).toBe(true);
      });
    });

    it('should detect external data needs', () => {
      const queries = [
        'What is the current price?',
        'Latest news about AI',
        'Recent updates in 2024',
        'Compare the cost versus benefit',
        "Show me today's statistics",
      ];

      queries.forEach((query) => {
        expect((router as any).detectExternalDataNeed(query)).toBe(true);
      });
    });

    it('should detect synthesis needs', () => {
      const queries = [
        'Analyze the comprehensive data',
        'Evaluate pros and cons',
        'Examine the relationship between',
        'Thorough review of the impact',
        'In-depth assessment needed',
      ];

      queries.forEach((query) => {
        expect((router as any).detectSynthesisNeed(query)).toBe(true);
      });
    });

    it('should count technical terms accurately', () => {
      const query =
        'Configure the REST API with JSON responses using SQL database and ML algorithms CPU GPU';
      const count = (router as any).countTechnicalTerms(query);

      expect(count).toBeGreaterThan(5);
    });

    it('should not detect patterns in simple queries', () => {
      const simpleQuery = 'Hello, how are you?';

      expect((router as any).detectMultiStepQuery(simpleQuery)).toBe(false);
      expect((router as any).detectExternalDataNeed(simpleQuery)).toBe(false);
      expect((router as any).detectSynthesisNeed(simpleQuery)).toBe(false);
      expect((router as any).countTechnicalTerms(simpleQuery)).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle vector store service errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock the getUnifiedVectorStoreService to fail
      const mockUnifiedService = await import('../../vectorstore/unified');
      vi.mocked(
        mockUnifiedService.getUnifiedVectorStoreService,
      ).mockResolvedValueOnce({
        searchAcrossSources: vi.fn(() => Promise.resolve([])),
        getAvailableSources: vi
          .fn()
          .mockRejectedValueOnce(new Error('Service error')),
        healthCheck: vi.fn(() => Promise.resolve({ isHealthy: true })),
        config: {
          sources: ['openai', 'memory'],
          searchThreshold: 0.3,
          maxResults: 10,
        },
      } as any);

      mockGenerateText.mockResolvedValueOnce({
        text: 'question_answering',
      });

      const decision = await router.routeQuery('Test query');

      expect(decision.suggestedSources).toEqual(['openai']);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get available sources, using defaults:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should provide valid routing decision even with partial failures', async () => {
      mockGenerateText.mockRejectedValueOnce(
        new Error('Classification failed'),
      );

      const decision = await router.routeQuery('Test query');

      expect(decision.selectedAgent).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.reasoning).toBeDefined();
      expect(decision.fallbackAgent).toBeDefined();
      expect(decision.suggestedSources).toBeDefined();
      expect(decision.estimatedComplexity).toBeDefined();
    });
  });
});
