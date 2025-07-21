import { beforeEach, describe, expect, it } from "vitest";
import {
  ContextWindowManager,
  type OptimizedQuery,
  PROMPT_TEMPLATES,
  PromptOptimizationEngine,
  PromptOptimizationMetrics,
  type QueryContext,
  QueryExpansionEngine,
  ROBORAIL_DOMAIN_PROMPTS,
} from "./prompt-optimization";

describe("PromptOptimizationEngine", () => {
  describe("classifyQuery", () => {
    it("should classify technical queries correctly", async () => {
      const query =
        "How do I use the RoboRail API endpoint for authentication?";
      const context: QueryContext = { type: undefined };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.queryType).toBe("api");
      expect(result.metadata.complexity).toBeDefined();
      expect(result.expandedQueries.length).toBeGreaterThan(1);
    });

    it("should classify troubleshooting queries correctly", async () => {
      const query =
        "RoboRail automation workflow not working, getting error 500";
      const context: QueryContext = { type: undefined };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.queryType).toBe("troubleshooting");
      expect(result.contextualPrompt).toContain("troubleshooting");
    });

    it("should classify configuration queries correctly", async () => {
      const query =
        "How to configure RoboRail environment variables and settings?";
      const context: QueryContext = { type: undefined };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.queryType).toBe("configuration");
      expect(result.contextualPrompt).toContain("configuration");
    });

    it("should classify procedural queries correctly", async () => {
      const query = "Step by step guide to setup RoboRail integration";
      const context: QueryContext = { type: undefined };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.queryType).toBe("procedural");
      expect(result.searchInstructions).toContain("step-by-step");
    });
  });

  describe("determineComplexity", () => {
    it("should classify basic queries", async () => {
      const query = "What is RoboRail?";
      const context: QueryContext = { type: "conceptual" };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.complexity).toBe("basic");
    });

    it("should classify intermediate queries", async () => {
      const query =
        "How to implement RoboRail webhook authentication with OAuth2?";
      const context: QueryContext = { type: "technical" };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.complexity).toBe("intermediate");
    });

    it("should classify advanced queries", async () => {
      const query =
        "How to implement custom RoboRail microservices architecture with containerization, load balancing, and advanced monitoring observability?";
      const context: QueryContext = { type: "technical" };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.complexity).toBe("advanced");
    });
  });

  describe("domain-specific optimization", () => {
    it("should apply RoboRail domain context", async () => {
      const query = "automation workflow configuration";
      const context: QueryContext = {
        type: "configuration",
        domain: "automation",
      };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.contextualPrompt).toContain("automation");
      expect(result.contextualPrompt).toContain("RoboRail");
    });

    it("should include domain-specific keywords in expansion", async () => {
      const query = "integration setup";
      const context: QueryContext = {
        type: "integration",
        domain: "integration",
      };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      const hasIntegrationKeywords = result.expandedQueries.some(
        (q) =>
          q.includes("webhook") || q.includes("connector") || q.includes("API"),
      );
      expect(hasIntegrationKeywords).toBe(true);
    });
  });

  describe("conversation context optimization", () => {
    it("should incorporate conversation history", async () => {
      const query = "How do I fix this?";
      const context: QueryContext = {
        type: "troubleshooting",
        conversationHistory: [
          {
            role: "user",
            content: "I am having issues with RoboRail automation",
            timestamp: Date.now() - 60_000,
          },
          {
            role: "assistant",
            content:
              "What specific automation features are you having trouble with?",
            timestamp: Date.now() - 30_000,
          },
        ],
      };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.contextualPrompt).toContain("automation");
      expect(result.expandedQueries.some((q) => q.includes("automation"))).toBe(
        true,
      );
    });

    it("should include previous queries context", async () => {
      const query = "What about configuration?";
      const context: QueryContext = {
        type: "configuration",
        previousQueries: ["RoboRail API authentication", "webhook setup"],
      };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(
        result.expandedQueries.some((q) => q.includes("webhook setup")),
      ).toBe(true);
    });
  });

  describe("prompt template selection", () => {
    it("should use appropriate template for query type", async () => {
      const query = "RoboRail API documentation";
      const context: QueryContext = { type: "api" };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.contextualPrompt).toContain("API documentation");
      expect(result.contextualPrompt).toContain("endpoint");
    });

    it("should use expanded template for complex queries", async () => {
      const query = "Complete RoboRail microservices implementation guide";
      const context: QueryContext = {
        type: "technical",
        complexity: "advanced",
      };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.optimizedQuery).toContain("comprehensive");
      expect(result.optimizedQuery).toContain("implementation details");
    });
  });

  describe("relevance estimation", () => {
    it("should estimate higher relevance for specific queries", async () => {
      const query =
        "RoboRail automation API webhook configuration with OAuth2 authentication";
      const context: QueryContext = {
        type: "api",
        domain: "automation",
        userIntent: "Setup webhook authentication",
      };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.estimatedRelevance).toBeGreaterThan(0.7);
    });

    it("should estimate lower relevance for vague queries", async () => {
      const query = "help";
      const context: QueryContext = { type: "conceptual" };
      const result = await PromptOptimizationEngine.optimizeQuery(
        query,
        context,
      );

      expect(result.metadata.estimatedRelevance).toBeLessThan(0.7);
    });
  });
});

describe("QueryExpansionEngine", () => {
  describe("expandWithSynonyms", () => {
    it("should expand automation terms with synonyms", () => {
      const query = "automation configuration";
      const result = QueryExpansionEngine.expandWithSynonyms(query, "roborail");

      expect(result).toContain(query); // Original query
      expect(result.some((q) => q.includes("workflow"))).toBe(true);
      expect(result.some((q) => q.includes("setup"))).toBe(true);
    });

    it("should add related terms", () => {
      const query = "API integration";
      const result = QueryExpansionEngine.expandWithSynonyms(query, "roborail");

      expect(
        result.some((q) => q.includes("webhook") || q.includes("endpoint")),
      ).toBe(true);
    });
  });

  describe("generateDomainVariations", () => {
    it("should generate RoboRail-specific variations", () => {
      const query = "automation setup";
      const result = QueryExpansionEngine.generateDomainVariations(
        query,
        "automation",
      );

      expect(result).toContain("RoboRail automation setup");
      expect(result).toContain("automation setup in RoboRail");
      expect(result.some((q) => q.includes("workflow"))).toBe(true);
    });

    it("should include domain keywords", () => {
      const query = "configuration guide";
      const result = QueryExpansionEngine.generateDomainVariations(
        query,
        "configuration",
      );

      const domainConfig = ROBORAIL_DOMAIN_PROMPTS.configuration;
      expect(
        result.some((q) =>
          domainConfig.keywords.some((keyword) => q.includes(keyword)),
        ),
      ).toBe(true);
    });
  });

  describe("generateContextualVariations", () => {
    it("should generate variations based on conversation history", () => {
      const query = "how to fix this";
      const context: QueryContext = {
        conversationHistory: [
          {
            role: "user",
            content: "RoboRail webhook not working",
            timestamp: Date.now(),
          },
        ],
      };

      const result = QueryExpansionEngine.generateContextualVariations(
        query,
        context,
      );

      expect(result.some((q) => q.includes("webhook"))).toBe(true);
    });

    it("should build on previous queries", () => {
      const query = "next step";
      const context: QueryContext = {
        previousQueries: ["RoboRail API setup", "authentication configuration"],
      };

      const result = QueryExpansionEngine.generateContextualVariations(
        query,
        context,
      );

      expect(
        result.some((q) => q.includes("authentication configuration")),
      ).toBe(true);
    });
  });
});

describe("ContextWindowManager", () => {
  describe("optimizeDocumentContext", () => {
    it("should optimize large document sets", () => {
      const documents = Array.from({ length: 10 }, (_, i) => ({
        content:
          `Document ${i} content about RoboRail automation workflows and configuration settings. This document contains detailed information about ${i % 3 === 0 ? "automation" : i % 3 === 1 ? "configuration" : "integration"} features.`.repeat(
            50,
          ),
        metadata: { index: i },
      }));

      const query = "automation workflows";
      const optimized = ContextWindowManager.optimizeDocumentContext(
        documents,
        query,
        4000,
      );

      expect(optimized.length).toBeLessThanOrEqual(documents.length);
      expect(optimized.every((doc) => doc.content.length > 0)).toBe(true);

      // Should prioritize automation-related documents
      expect(optimized[0].content.includes("automation")).toBe(true);
    });

    it("should summarize documents when context limit is exceeded", () => {
      const documents = [
        {
          content:
            "Very long document content about RoboRail automation. ".repeat(
              1000,
            ),
          metadata: { type: "automation" },
        },
      ];

      const query = "automation";
      const optimized = ContextWindowManager.optimizeDocumentContext(
        documents,
        query,
        500,
      );

      expect(optimized.length).toBeGreaterThan(0);
      if (optimized[0].metadata?.summarized) {
        expect(optimized[0].content.length).toBeLessThan(
          documents[0].content.length,
        );
      }
    });
  });

  describe("optimizeConversationContext", () => {
    it("should limit conversation history by token count", () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i} about RoboRail. `.repeat(50),
        timestamp: Date.now() - (20 - i) * 60_000,
      }));

      const optimized = ContextWindowManager.optimizeConversationContext(
        history,
        "current query",
        1000,
      );

      expect(optimized.length).toBeLessThan(history.length);
      expect(optimized.length).toBeGreaterThan(0);

      // Should maintain chronological order
      for (let i = 1; i < optimized.length; i++) {
        expect(optimized[i].timestamp).toBeGreaterThan(
          optimized[i - 1].timestamp,
        );
      }
    });

    it("should prioritize recent messages", () => {
      const history = [
        {
          role: "user",
          content: "Old message about integration",
          timestamp: Date.now() - 3_600_000,
        },
        {
          role: "assistant",
          content: "Old response",
          timestamp: Date.now() - 3_500_000,
        },
        {
          role: "user",
          content: "Recent message about automation",
          timestamp: Date.now() - 60_000,
        },
        {
          role: "assistant",
          content: "Recent response",
          timestamp: Date.now() - 30_000,
        },
      ];

      const optimized = ContextWindowManager.optimizeConversationContext(
        history,
        "query",
        200,
      );

      expect(optimized.length).toBeGreaterThan(0);
      expect(optimized[optimized.length - 1].content).toContain(
        "Recent response",
      );
    });
  });
});

describe("PromptOptimizationMetrics", () => {
  beforeEach(() => {
    // Clear metrics before each test
    // @ts-expect-error - Accessing private field for test
    PromptOptimizationMetrics.metrics = new Map();
  });

  describe("recordOptimizationMetrics", () => {
    it("should record optimization metrics correctly", () => {
      const queryId = "test-query-1";
      const originalQuery = "RoboRail automation";
      const optimizedQuery: OptimizedQuery = {
        originalQuery,
        optimizedQuery: "Enhanced RoboRail automation query",
        expandedQueries: ["automation workflow", "RoboRail automation"],
        contextualPrompt: "Search for automation information",
        searchInstructions: "Focus on automation features",
        metadata: {
          queryType: "technical",
          complexity: "intermediate",
          optimizationStrategy: "technical_intermediate_optimization",
          estimatedRelevance: 0.8,
        },
      };
      const searchResults = [
        { id: "1", content: "result 1" },
        { id: "2", content: "result 2" },
      ];
      const responseTime = 150;

      PromptOptimizationMetrics.recordOptimizationMetrics(
        queryId,
        originalQuery,
        optimizedQuery,
        searchResults,
        responseTime,
      );

      const metrics = PromptOptimizationMetrics.getMetrics(queryId);
      expect(metrics).toBeDefined();
      expect(metrics.originalQuery).toBe(originalQuery);
      expect(metrics.queryType).toBe("technical");
      expect(metrics.complexity).toBe("intermediate");
      expect(metrics.estimatedRelevance).toBe(0.8);
      expect(metrics.resultsCount).toBe(2);
      expect(metrics.responseTime).toBe(150);
      expect(metrics.expansionCount).toBe(2);
    });
  });

  describe("getAggregatedMetrics", () => {
    it("should calculate aggregated metrics correctly", () => {
      // Record multiple queries
      const queries = [
        {
          id: "q1",
          originalQuery: "automation",
          optimizedQuery: {
            metadata: {
              queryType: "technical",
              complexity: "basic",
              estimatedRelevance: 0.7,
            },
            expandedQueries: ["a", "b"],
          },
          results: [1, 2],
          responseTime: 100,
        },
        {
          id: "q2",
          originalQuery: "configuration",
          optimizedQuery: {
            metadata: {
              queryType: "configuration",
              complexity: "intermediate",
              estimatedRelevance: 0.9,
            },
            expandedQueries: ["c", "d", "e"],
          },
          results: [1, 2, 3],
          responseTime: 200,
        },
      ];

      queries.forEach((q) => {
        PromptOptimizationMetrics.recordOptimizationMetrics(
          q.id,
          q.originalQuery,
          q.optimizedQuery as any,
          q.results,
          q.responseTime,
        );
      });

      const aggregated = PromptOptimizationMetrics.getAggregatedMetrics();

      expect(aggregated).toBeDefined();
      expect(aggregated.totalQueries).toBe(2);
      expect(aggregated.avgResponseTime).toBe(150);
      expect(aggregated.avgResultsCount).toBe(2.5);
      expect(aggregated.avgEstimatedRelevance).toBe(0.8);
      expect(aggregated.queryTypeDistribution.technical).toBe(1);
      expect(aggregated.queryTypeDistribution.configuration).toBe(1);
      expect(aggregated.complexityDistribution.basic).toBe(1);
      expect(aggregated.complexityDistribution.intermediate).toBe(1);
    });

    it("should return null for empty metrics", () => {
      const aggregated = PromptOptimizationMetrics.getAggregatedMetrics();
      expect(aggregated).toBeNull();
    });
  });
});

describe("Domain-specific prompts", () => {
  it("should have all required RoboRail domain configurations", () => {
    const expectedDomains = [
      "automation",
      "integration",
      "configuration",
      "troubleshooting",
      "performance",
      "security",
    ];

    expectedDomains.forEach((domain) => {
      expect(
        ROBORAIL_DOMAIN_PROMPTS[domain as keyof typeof ROBORAIL_DOMAIN_PROMPTS],
      ).toBeDefined();

      const config =
        ROBORAIL_DOMAIN_PROMPTS[domain as keyof typeof ROBORAIL_DOMAIN_PROMPTS];
      expect(config.base).toBeDefined();
      expect(config.context).toBeDefined();
      expect(config.keywords).toBeDefined();
      expect(Array.isArray(config.keywords)).toBe(true);
      expect(config.keywords.length).toBeGreaterThan(0);
    });
  });

  it("should have comprehensive prompt templates", () => {
    const expectedTypes = [
      "technical",
      "conceptual",
      "procedural",
      "troubleshooting",
      "configuration",
      "api",
      "integration",
      "best_practices",
      "examples",
      "reference",
      "multi_turn",
      "contextual",
    ];

    expectedTypes.forEach((type) => {
      expect(
        PROMPT_TEMPLATES[type as keyof typeof PROMPT_TEMPLATES],
      ).toBeDefined();

      const template = PROMPT_TEMPLATES[type as keyof typeof PROMPT_TEMPLATES];
      expect(template.base).toBeDefined();
      expect(template.expanded).toBeDefined();
      expect(template.contextual).toBeDefined();

      // Templates should contain placeholder for query
      expect(template.base).toContain("{query}");
      expect(template.expanded).toContain("{query}");
      expect(template.contextual).toContain("{query}");
    });
  });
});

describe("Integration tests", () => {
  it("should handle end-to-end optimization workflow", async () => {
    const query =
      "How to troubleshoot RoboRail automation webhook authentication failures?";
    const context: QueryContext = {
      type: undefined, // Let it auto-classify
      domain: "automation",
      conversationHistory: [
        {
          role: "user",
          content: "Setting up RoboRail webhooks",
          timestamp: Date.now() - 120_000,
        },
        {
          role: "assistant",
          content: "Webhooks require proper authentication setup",
          timestamp: Date.now() - 60_000,
        },
      ],
      userIntent: "Fix webhook authentication issues",
    };

    const result = await PromptOptimizationEngine.optimizeQuery(query, context);

    // Verify classification
    expect(result.metadata.queryType).toBe("troubleshooting");

    // Verify optimization
    expect(result.optimizedQuery).not.toBe(query);
    expect(result.expandedQueries.length).toBeGreaterThan(1);

    // Verify context inclusion
    expect(result.contextualPrompt).toContain("webhook");
    expect(result.contextualPrompt).toContain("authentication");

    // Verify RoboRail domain context
    expect(result.contextualPrompt).toContain("RoboRail");

    // Verify search instructions
    expect(result.searchInstructions).toContain("troubleshooting");

    // Verify reasonable relevance estimation
    expect(result.metadata.estimatedRelevance).toBeGreaterThan(0.5);
    expect(result.metadata.estimatedRelevance).toBeLessThanOrEqual(1.0);
  });

  it("should handle edge cases gracefully", async () => {
    const emptyQuery = "";
    const minimalContext: QueryContext = {};

    // Should not throw on empty query (validation will catch this)
    await expect(async () => {
      await PromptOptimizationEngine.optimizeQuery(emptyQuery, minimalContext);
    }).rejects.toThrow();

    // Should handle minimal context
    const basicQuery = "help";
    const result = await PromptOptimizationEngine.optimizeQuery(
      basicQuery,
      minimalContext,
    );

    expect(result.metadata.queryType).toBeDefined();
    expect(result.metadata.complexity).toBeDefined();
    expect(result.expandedQueries.length).toBeGreaterThan(0);
  });
});
