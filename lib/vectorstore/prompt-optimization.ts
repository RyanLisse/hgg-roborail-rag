import "server-only";

import { z } from "zod";

// Schema definitions for prompt optimization
export const QueryType = z.enum([
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
]);

export const QueryContext = z.object({
  type: QueryType,
  domain: z.string().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.number(),
      }),
    )
    .optional(),
  previousQueries: z.array(z.string()).optional(),
  userIntent: z.string().optional(),
  complexity: z.enum(["basic", "intermediate", "advanced"]).optional(),
  searchDepth: z.enum(["shallow", "comprehensive", "exhaustive"]).optional(),
});

export const PromptConfig = z.object({
  basePrompt: z.string(),
  contextPrompt: z.string().optional(),
  domainPrompt: z.string().optional(),
  expansionPrompt: z.string().optional(),
  refinementPrompt: z.string().optional(),
  maxTokens: z.number().default(1500),
  temperature: z.number().min(0).max(1).default(0.1),
  includeContext: z.boolean().default(true),
  includeCitations: z.boolean().default(true),
});

export const OptimizedQuery = z.object({
  originalQuery: z.string(),
  optimizedQuery: z.string(),
  expandedQueries: z.array(z.string()),
  contextualPrompt: z.string(),
  searchInstructions: z.string(),
  metadata: z.object({
    queryType: QueryType,
    complexity: z.string(),
    optimizationStrategy: z.string(),
    estimatedRelevance: z.number().min(0).max(1),
  }),
});

// Types
export type QueryType = z.infer<typeof QueryType>;
export type QueryContext = z.infer<typeof QueryContext>;
export type PromptConfig = z.infer<typeof PromptConfig>;
export type OptimizedQuery = z.infer<typeof OptimizedQuery>;

// Interface for prompt optimization metrics
export interface PromptOptimizationMetric {
  timestamp: number;
  originalQuery: string;
  optimizedQuery: string;
  queryType: QueryType;
  complexity: string;
  estimatedRelevance: number;
  resultsCount: number;
  responseTime: number;
  expansionCount: number;
}

// Interface for aggregated optimization metrics
export interface AggregatedOptimizationMetrics {
  totalQueries: number;
  avgResponseTime: number;
  avgResultsCount: number;
  avgEstimatedRelevance: number;
  queryTypeDistribution: Record<string, number>;
  complexityDistribution: Record<string, number>;
}

/**
 * RoboRail-specific domain prompts for technical documentation
 */
export const ROBORAIL_DOMAIN_PROMPTS = {
  automation: {
    base: "Focus on RoboRail automation features, workflows, triggers, and automation rules.",
    context:
      "Consider automation setup, configuration, scheduling, and monitoring.",
    keywords: [
      "automation",
      "workflow",
      "trigger",
      "rule",
      "schedule",
      "monitoring",
    ],
  },
  integration: {
    base: "Search for RoboRail integration capabilities, APIs, webhooks, and third-party connections.",
    context:
      "Include integration patterns, authentication, data exchange, and compatibility.",
    keywords: [
      "integration",
      "API",
      "webhook",
      "connection",
      "third-party",
      "authentication",
    ],
  },
  configuration: {
    base: "Look for RoboRail configuration guides, settings, parameters, and setup instructions.",
    context: "Include environment setup, parameter tuning, and best practices.",
    keywords: [
      "configuration",
      "settings",
      "setup",
      "parameters",
      "environment",
      "tuning",
    ],
  },
  troubleshooting: {
    base: "Search for RoboRail troubleshooting guides, error resolution, and diagnostic procedures.",
    context:
      "Include common issues, error codes, debugging steps, and solutions.",
    keywords: [
      "troubleshooting",
      "error",
      "debug",
      "issue",
      "solution",
      "diagnostic",
    ],
  },
  performance: {
    base: "Focus on RoboRail performance optimization, scaling, and monitoring.",
    context:
      "Include performance metrics, optimization techniques, and resource management.",
    keywords: [
      "performance",
      "optimization",
      "scaling",
      "monitoring",
      "metrics",
      "resources",
    ],
  },
  security: {
    base: "Search for RoboRail security features, authentication, authorization, and compliance.",
    context:
      "Include security policies, access control, encryption, and audit trails.",
    keywords: [
      "security",
      "authentication",
      "authorization",
      "encryption",
      "compliance",
      "audit",
    ],
  },
} as const;

/**
 * Dynamic prompt templates based on query type and context
 */
export const PROMPT_TEMPLATES = {
  technical: {
    base: `Search for detailed technical information about {query}. Focus on implementation details, technical specifications, and accurate technical documentation.`,
    expanded: `Find comprehensive technical documentation including: implementation details, configuration options, technical specifications, code examples, API references, and best practices for {query}.`,
    contextual: `Given the technical context, search for information about {query} including related technical concepts, dependencies, prerequisites, and implementation guidance.`,
  },
  conceptual: {
    base: `Search for conceptual information and explanations about {query}. Focus on understanding principles, concepts, and theoretical foundations.`,
    expanded: `Find conceptual explanations including: fundamental principles, theoretical background, concept relationships, use cases, and practical applications for {query}.`,
    contextual: `Based on the conceptual context, search for comprehensive explanations of {query} including related concepts, principles, and practical implications.`,
  },
  procedural: {
    base: `Search for step-by-step procedures and instructions for {query}. Focus on actionable guidance and process documentation.`,
    expanded: `Find detailed procedures including: step-by-step instructions, process workflows, checklists, prerequisites, and validation steps for {query}.`,
    contextual: `Given the procedural context, search for comprehensive process documentation for {query} including preparation steps, execution procedures, and verification methods.`,
  },
  troubleshooting: {
    base: `Search for troubleshooting information related to {query}. Focus on problem diagnosis, solutions, and resolution procedures.`,
    expanded: `Find troubleshooting resources including: common issues, error messages, diagnostic procedures, resolution steps, and prevention measures for {query}.`,
    contextual: `Based on the troubleshooting context, search for problem resolution information for {query} including root cause analysis, diagnostic steps, and effective solutions.`,
  },
  configuration: {
    base: `Search for configuration information about {query}. Focus on setup procedures, parameter settings, and configuration options.`,
    expanded: `Find configuration documentation including: setup instructions, parameter descriptions, configuration examples, environment settings, and optimization tips for {query}.`,
    contextual: `Given the configuration context, search for comprehensive setup and configuration information for {query} including environment requirements and parameter tuning.`,
  },
  api: {
    base: `Search for API documentation and technical references for {query}. Focus on endpoints, parameters, examples, and integration details.`,
    expanded: `Find API documentation including: endpoint descriptions, parameter specifications, request/response examples, authentication methods, and integration guides for {query}.`,
    contextual: `Based on the API context, search for detailed endpoint documentation and technical references for {query} including usage examples, best practices, and integration patterns.`,
  },
  integration: {
    base: `Search for integration information about {query}. Focus on connection methods, compatibility, and integration patterns.`,
    expanded: `Find integration documentation including: connection procedures, compatibility requirements, data mapping, authentication setup, and integration examples for {query}.`,
    contextual: `Given the integration context, search for comprehensive integration information for {query} including setup procedures, data flow, and troubleshooting.`,
  },
  best_practices: {
    base: `Search for best practices and recommendations for {query}. Focus on proven approaches, optimization tips, and expert guidance.`,
    expanded: `Find best practice guidance including: recommended approaches, optimization strategies, common pitfalls to avoid, performance tips, and expert recommendations for {query}.`,
    contextual: `Based on the best practices context, search for expert guidance and proven methodologies for {query} including optimization strategies and recommended patterns.`,
  },
  examples: {
    base: `Search for practical examples and use cases for {query}. Focus on real-world implementations and code samples.`,
    expanded: `Find practical examples including: code samples, use case scenarios, implementation examples, demo projects, and real-world applications for {query}.`,
    contextual: `Given the examples context, search for comprehensive practical examples for {query} including working code, use cases, and implementation patterns.`,
  },
  reference: {
    base: `Search for reference documentation and specifications for {query}. Focus on authoritative information and detailed specifications.`,
    expanded: `Find reference documentation including: technical specifications, parameter references, command listings, syntax guides, and authoritative documentation for {query}.`,
    contextual: `Based on the reference context, search for authoritative reference materials for {query} including specifications, parameter details, and technical references.`,
  },
  multi_turn: {
    base: `Considering our previous conversation, search for information about {query} that builds on our discussion context.`,
    expanded: `Find information about {query} that relates to our conversation history, including follow-up details, related concepts, and contextual information.`,
    contextual: `Given our conversation context about {previousContext}, search for detailed information about {query} that continues and expands our discussion.`,
  },
  contextual: {
    base: `Search for information about {query} considering the specific context and related requirements.`,
    expanded: `Find contextually relevant information about {query} including related concepts, dependencies, and contextual considerations.`,
    contextual: `Based on the specific context provided, search for comprehensive information about {query} that addresses the contextual requirements and considerations.`,
  },
} as const;

/**
 * Context window optimization strategies
 */
export const CONTEXT_OPTIMIZATION = {
  large_documents: {
    strategy: "chunk_summarization",
    maxChunkSize: 1000,
    summaryPrompt:
      "Provide a concise summary of the key information in this document chunk that relates to the search query.",
  },
  conversation_history: {
    strategy: "selective_inclusion",
    maxHistoryItems: 5,
    relevanceThreshold: 0.7,
  },
  multi_source: {
    strategy: "source_prioritization",
    maxSources: 10,
    priorityWeights: {
      official_docs: 1.0,
      examples: 0.8,
      community: 0.6,
      general: 0.4,
    },
  },
} as const;

/**
 * Query expansion strategies for better retrieval
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
export class QueryExpansionEngine {
  /**
   * Expand query with synonyms and related terms
   */
  static expandWithSynonyms(query: string, domain?: string): string[] {
    const baseTerms = QueryExpansionEngine.extractKeyTerms(query);
    const synonyms = QueryExpansionEngine.getSynonyms(baseTerms, domain);
    const related = QueryExpansionEngine.getRelatedTerms(baseTerms, domain);

    return [
      query,
      ...synonyms.map((syn) =>
        QueryExpansionEngine.replaceTerm(query, syn.original, syn.synonym),
      ),
      ...related.map((rel) => `${query} ${rel}`),
    ];
  }

  /**
   * Generate domain-specific query variations
   */
  static generateDomainVariations(query: string, domain: string): string[] {
    const domainConfig =
      ROBORAIL_DOMAIN_PROMPTS[domain as keyof typeof ROBORAIL_DOMAIN_PROMPTS];
    if (!domainConfig) {
      return [query];
    }

    const variations = [
      query,
      `RoboRail ${query}`,
      `${query} in RoboRail`,
      ...domainConfig.keywords.map((keyword) => `${keyword} ${query}`),
      ...domainConfig.keywords.map((keyword) => `${query} ${keyword}`),
    ];

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Create contextual query variations based on conversation history
   */
  static generateContextualVariations(
    query: string,
    context: QueryContext,
  ): string[] {
    const variations = [query];

    // Add conversation context
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentContext = context.conversationHistory
        .slice(-3)
        .map((msg) => msg.content)
        .join(" ");

      const contextTerms = QueryExpansionEngine.extractKeyTerms(recentContext);
      if (contextTerms.length > 0) {
        variations.push(
          `${query} considering ${contextTerms.slice(0, 3).join(" ")}`,
          `${query} related to previous discussion`,
          `${query} ${contextTerms[0]}`, // Add key term directly
        );
      }
    }

    // Add previous queries context
    if (context.previousQueries && context.previousQueries.length > 0) {
      const lastQuery = context.previousQueries.at(-1);
      variations.push(`${query} building on ${lastQuery}`);
    }

    return variations;
  }

  private static extractKeyTerms(text: string): string[] {
    // Simple keyword extraction - in production, use more sophisticated NLP
    const terms = text
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (term) => term.length > 3 && !QueryExpansionEngine.isStopWord(term),
      );

    // Prioritize important domain terms
    const importantTerms = [
      "automation",
      "webhook",
      "authentication",
      "roborail",
      "configuration",
      "integration",
    ];
    const prioritized: string[] = [];
    const regular: string[] = [];

    for (const term of terms) {
      if (
        importantTerms.some(
          (important) => term.includes(important) || important.includes(term),
        )
      ) {
        prioritized.push(term);
      } else {
        regular.push(term);
      }
    }

    return [...prioritized, ...regular].slice(0, 10);
  }

  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "up",
      "about",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "between",
      "among",
      "through",
      "during",
      "this",
      "that",
      "these",
      "those",
      "what",
      "which",
      "who",
      "when",
      "where",
      "why",
      "how",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "cannot",
    ]);
    return stopWords.has(word.toLowerCase());
  }

  private static getSynonyms(
    terms: string[],
    _domain?: string,
  ): Array<{ original: string; synonym: string }> {
    // RoboRail-specific synonyms
    const roborailSynonyms: Record<string, string[]> = {
      automation: ["workflow", "process", "rule", "trigger"],
      configuration: ["setup", "settings", "config", "parameters"],
      integration: ["connection", "linking", "interface", "bridge"],
      monitoring: ["tracking", "observing", "watching", "surveillance"],
      optimization: ["tuning", "enhancement", "improvement", "refinement"],
      troubleshooting: ["debugging", "diagnosis", "problem-solving", "repair"],
      deployment: ["installation", "setup", "rollout", "implementation"],
      performance: ["speed", "efficiency", "throughput", "responsiveness"],
      security: ["protection", "safety", "authentication", "authorization"],
      scalability: ["growth", "expansion", "scaling", "extensibility"],
    };

    const synonymPairs: Array<{ original: string; synonym: string }> = [];

    for (const term of terms) {
      const synonyms = roborailSynonyms[term] || [];
      for (const synonym of synonyms) {
        synonymPairs.push({ original: term, synonym });
      }
    }

    return synonymPairs;
  }

  private static getRelatedTerms(terms: string[], _domain?: string): string[] {
    // RoboRail-specific related terms
    const roborailRelated: Record<string, string[]> = {
      automation: ["scheduling", "triggers", "workflows", "rules"],
      api: ["endpoints", "authentication", "requests", "responses"],
      configuration: ["environment", "parameters", "variables", "settings"],
      integration: ["webhooks", "connectors", "adapters", "protocols"],
      monitoring: ["alerts", "metrics", "dashboards", "logs"],
      security: ["permissions", "roles", "tokens", "certificates"],
      performance: ["caching", "optimization", "scaling", "load"],
      deployment: ["containers", "kubernetes", "docker", "ci/cd"],
    };

    const related: string[] = [];
    for (const term of terms) {
      const relatedTerms = roborailRelated[term] || [];
      related.push(...relatedTerms);
    }

    return [...new Set(related)];
  }

  private static replaceTerm(
    query: string,
    original: string,
    replacement: string,
  ): string {
    const regex = new RegExp(`\\b${original}\\b`, "gi");
    return query.replace(regex, replacement);
  }
}

/**
 * Prompt optimization engine for improving retrieval accuracy
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
export class PromptOptimizationEngine {
  /**
   * Optimize query and generate enhanced prompts
   */
  static async optimizeQuery(
    originalQuery: string,
    context: QueryContext,
    config: Partial<PromptConfig> = {},
  ): Promise<OptimizedQuery> {
    // Validate input
    if (!originalQuery || originalQuery.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    // Classify query type if not provided or validate if provided
    let queryType: QueryType;
    if (context.type) {
      // Validate that the provided type is a valid QueryType
      const validationResult = QueryType.safeParse(context.type);
      if (validationResult.success) {
        queryType = validationResult.data;
      } else {
        // If invalid type provided, fall back to classification
        queryType = PromptOptimizationEngine.classifyQuery(originalQuery);
      }
    } else {
      queryType = PromptOptimizationEngine.classifyQuery(originalQuery);
    }

    // Determine complexity and search depth
    const complexity =
      context.complexity ||
      PromptOptimizationEngine.determineComplexity(originalQuery);
    const searchDepth = context.searchDepth || "comprehensive";

    // Generate expanded queries
    const expandedQueries = PromptOptimizationEngine.generateExpandedQueries(
      originalQuery,
      context,
      queryType,
    );

    // Create optimized query
    const optimizedQuery = PromptOptimizationEngine.createOptimizedQuery(
      originalQuery,
      queryType,
      complexity,
    );

    // Generate contextual prompt
    const contextualPrompt = PromptOptimizationEngine.createContextualPrompt(
      originalQuery,
      context,
      queryType,
      config,
    );

    // Create search instructions
    const searchInstructions =
      PromptOptimizationEngine.createSearchInstructions(
        queryType,
        complexity,
        searchDepth,
        context,
      );

    // Estimate relevance score
    const estimatedRelevance = PromptOptimizationEngine.estimateRelevance(
      originalQuery,
      queryType,
      context,
    );

    return OptimizedQuery.parse({
      originalQuery,
      optimizedQuery,
      expandedQueries,
      contextualPrompt,
      searchInstructions,
      metadata: {
        queryType,
        complexity,
        optimizationStrategy: PromptOptimizationEngine.getOptimizationStrategy(
          queryType,
          complexity,
        ),
        estimatedRelevance,
      },
    });
  }

  /**
   * Classify query type using pattern matching and keyword analysis
   */
  private static classifyQuery(query: string): QueryType {
    const lowerQuery = query.toLowerCase();

    // Troubleshooting indicators (check first for priority)
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "troubleshoot",
        "debug",
        "fix",
        "solve",
        "error",
        "issue",
        "problem",
        "fail",
        "broken",
        "not working",
      ])
    ) {
      return "troubleshooting";
    }

    // API indicators (check before technical)
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "api",
        "endpoint",
        "rest",
        "graphql",
        "request",
        "response",
      ]) ||
      (PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "authentication",
        "authorization",
        "token",
      ]) &&
        !PromptOptimizationEngine.hasPatterns(lowerQuery, [
          "troubleshoot",
          "debug",
          "fix",
          "solve",
          "error",
          "issue",
          "problem",
        ]))
    ) {
      return "api";
    }

    // Procedural indicators (check before configuration and technical)
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "step by step",
        "procedure",
        "guide",
        "tutorial",
        "walkthrough",
        "instruction",
      ])
    ) {
      return "procedural";
    }

    // Check for "how to" without other configuration keywords
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, ["how to"]) &&
      !PromptOptimizationEngine.hasPatterns(lowerQuery, ["configure", "config"])
    ) {
      return "procedural";
    }

    // Technical indicators
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "method",
        "function",
        "class",
        "parameter",
        "specification",
        "implementation",
        "code",
        "syntax",
        "technical",
      ])
    ) {
      return "technical";
    }

    // Configuration indicators
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "configure",
        "setup",
        "install",
        "setting",
        "config",
        "parameter",
        "environment",
        "variable",
        "option",
      ])
    ) {
      return "configuration";
    }

    // Integration indicators
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "integrate",
        "connect",
        "link",
        "interface",
        "bridge",
        "webhook",
        "connector",
        "third party",
      ])
    ) {
      return "integration";
    }

    // Best practices indicators
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "best practice",
        "recommendation",
        "optimize",
        "improve",
        "performance",
        "efficient",
        "pattern",
      ])
    ) {
      return "best_practices";
    }

    // Examples indicators
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "example",
        "sample",
        "demo",
        "use case",
        "scenario",
        "illustration",
        "template",
      ])
    ) {
      return "examples";
    }

    // Skip duplicate API check since it's already done above

    // Reference indicators
    if (
      PromptOptimizationEngine.hasPatterns(lowerQuery, [
        "reference",
        "documentation",
        "spec",
        "manual",
        "command",
        "option",
        "flag",
      ])
    ) {
      return "reference";
    }

    // Default to conceptual
    return "conceptual";
  }

  private static hasPatterns(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => text.includes(pattern));
  }

  /**
   * Determine query complexity based on length, technical terms, and structure
   */
  private static determineComplexity(
    query: string,
  ): "basic" | "intermediate" | "advanced" {
    const technicalTerms = [
      "authentication",
      "authorization",
      "middleware",
      "microservices",
      "containerization",
      "orchestration",
      "scaling",
      "load balancing",
      "caching",
      "optimization",
      "performance",
      "monitoring",
      "observability",
      "ci/cd",
      "deployment",
      "infrastructure",
      "architecture",
    ];

    const queryLength = query.split(" ").length;
    const technicalTermCount = technicalTerms.filter((term) =>
      query.toLowerCase().includes(term),
    ).length;

    if (queryLength > 15 || technicalTermCount > 2) {
      return "advanced";
    } else if (queryLength > 8 || technicalTermCount > 0) {
      return "intermediate";
    } else {
      return "basic";
    }
  }

  /**
   * Generate expanded queries for better retrieval coverage
   */
  private static generateExpandedQueries(
    originalQuery: string,
    context: QueryContext,
    queryType: QueryType,
  ): string[] {
    const expansions = [originalQuery];

    // Add synonym-based expansions
    expansions.push(
      ...QueryExpansionEngine.expandWithSynonyms(originalQuery, context.domain),
    );

    // Add domain-specific variations
    if (context.domain) {
      expansions.push(
        ...QueryExpansionEngine.generateDomainVariations(
          originalQuery,
          context.domain,
        ),
      );
    }

    // Add contextual variations
    expansions.push(
      ...QueryExpansionEngine.generateContextualVariations(
        originalQuery,
        context,
      ),
    );

    // Add type-specific expansions
    expansions.push(
      ...PromptOptimizationEngine.getTypeSpecificExpansions(
        originalQuery,
        queryType,
      ),
    );

    // Remove duplicates and limit to reasonable number
    return [...new Set(expansions)].slice(0, 8);
  }

  private static getTypeSpecificExpansions(
    query: string,
    queryType: QueryType,
  ): string[] {
    const expansions: string[] = [];

    switch (queryType) {
      case "technical":
        expansions.push(
          `${query} implementation`,
          `${query} technical details`,
          `${query} specifications`,
        );
        break;
      case "configuration":
        expansions.push(
          `${query} setup`,
          `${query} configuration guide`,
          `${query} settings`,
        );
        break;
      case "troubleshooting":
        expansions.push(`${query} error`, `${query} fix`, `${query} solution`);
        break;
      case "api":
        expansions.push(
          `${query} API`,
          `${query} endpoint`,
          `${query} integration`,
        );
        break;
    }

    return expansions;
  }

  /**
   * Create optimized query with enhanced keywords and structure
   */
  private static createOptimizedQuery(
    originalQuery: string,
    queryType: QueryType,
    complexity: string,
  ): string {
    const template = PROMPT_TEMPLATES[queryType];
    if (!template) {
      return originalQuery;
    }

    // Use expanded template for complex queries
    const promptTemplate =
      complexity === "advanced" ? template.expanded : template.base;

    return promptTemplate.replace("{query}", originalQuery);
  }

  /**
   * Create contextual prompt with domain knowledge and conversation history
   */
  private static createContextualPrompt(
    query: string,
    context: QueryContext,
    queryType: QueryType,
    _config: Partial<PromptConfig>,
  ): string {
    const template = PROMPT_TEMPLATES[queryType];
    if (!template?.contextual) {
      throw new Error(`Invalid query type: ${queryType}`);
    }
    let prompt = template.contextual.replace("{query}", query);

    // Add domain context
    if (
      context.domain &&
      ROBORAIL_DOMAIN_PROMPTS[
        context.domain as keyof typeof ROBORAIL_DOMAIN_PROMPTS
      ]
    ) {
      const domainConfig =
        ROBORAIL_DOMAIN_PROMPTS[
          context.domain as keyof typeof ROBORAIL_DOMAIN_PROMPTS
        ];
      prompt += `\n\nDomain context: ${domainConfig.base} ${domainConfig.context}`;
    }

    // Add conversation context
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentMessages = context.conversationHistory.slice(-3);
      const contextSummary = recentMessages
        .map((msg) => `${msg.role}: ${msg.content.slice(0, 200)}`)
        .join("\n");

      prompt = prompt.replace("{previousContext}", contextSummary);
      prompt += `\n\nConversation context:\n${contextSummary}`;
    }

    // Add user intent if available
    if (context.userIntent) {
      prompt += `\n\nUser intent: ${context.userIntent}`;
    }

    return prompt;
  }

  /**
   * Create search instructions for the vector store
   */
  private static createSearchInstructions(
    queryType: QueryType,
    complexity: string,
    searchDepth: string,
    context: QueryContext,
  ): string {
    let instructions = `Search strategy: ${queryType} query with ${complexity} complexity using ${searchDepth} search depth.`;

    // Add type-specific instructions
    switch (queryType) {
      case "technical":
        instructions +=
          " Prioritize technical documentation, API references, and implementation guides.";
        break;
      case "troubleshooting":
        instructions +=
          " Focus on error messages, diagnostic procedures, and solution documentation.";
        break;
      case "configuration":
        instructions +=
          " Emphasize setup guides, parameter documentation, and configuration examples.";
        break;
      case "procedural":
        instructions +=
          " Look for step-by-step guides, process documentation, and instructional content.";
        break;
      case "integration":
        instructions +=
          " Search for integration guides, connector documentation, and compatibility information.";
        break;
    }

    // Add domain-specific instructions
    if (context.domain) {
      instructions += ` Focus on RoboRail ${context.domain} documentation and related technical materials.`;
    }

    return instructions;
  }

  /**
   * Estimate relevance score based on query characteristics
   */
  private static estimateRelevance(
    query: string,
    queryType: QueryType,
    context: QueryContext,
  ): number {
    let score = 0.5; // Base score

    // Query length and specificity
    const queryLength = query.split(" ").length;
    if (queryLength > 5) {
      score += 0.2;
    }
    if (queryLength > 10) {
      score += 0.1;
    }

    // Domain specificity
    if (context.domain) {
      score += 0.15;
    }

    // Context availability
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      score += 0.1;
    }
    if (context.userIntent) {
      score += 0.05;
    }

    // Query type confidence
    const confidenceBoost: Record<QueryType, number> = {
      technical: 0.1,
      api: 0.1,
      configuration: 0.08,
      troubleshooting: 0.08,
      procedural: 0.06,
      integration: 0.06,
      conceptual: 0.05,
      best_practices: 0.05,
      examples: 0.04,
      reference: 0.04,
      multi_turn: 0.03,
      contextual: 0.03,
    };

    score += confidenceBoost[queryType] || 0;

    return Math.min(score, 1.0);
  }

  /**
   * Get optimization strategy description
   */
  private static getOptimizationStrategy(
    queryType: QueryType,
    complexity: string,
  ): string {
    return `${queryType}_${complexity}_optimization`;
  }
}

/**
 * Context window manager for handling large documents and conversation history
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
export class ContextWindowManager {
  private static readonly MAX_CONTEXT_TOKENS = 8000; // Conservative limit
  private static readonly BUFFER_TOKENS = 1000; // Reserve for response

  /**
   * Optimize context for large documents
   */
  static optimizeDocumentContext(
    documents: Array<{ content: string; metadata?: any }>,
    query: string,
    maxTokens: number = ContextWindowManager.MAX_CONTEXT_TOKENS,
  ): Array<{ content: string; metadata?: any }> {
    const availableTokens = Math.max(
      maxTokens - ContextWindowManager.BUFFER_TOKENS,
      Math.floor(maxTokens * 0.8),
    );
    let currentTokens = 0;
    const optimizedDocs: Array<{ content: string; metadata?: any }> = [];

    // Sort documents by relevance (simplified - in production use semantic similarity)
    const sortedDocs = documents.toSorted((a, b) => {
      const aRelevance = ContextWindowManager.calculateDocumentRelevance(
        a.content,
        query,
      );
      const bRelevance = ContextWindowManager.calculateDocumentRelevance(
        b.content,
        query,
      );
      return bRelevance - aRelevance;
    });

    for (const doc of sortedDocs) {
      const docTokens = ContextWindowManager.estimateTokens(doc.content);

      if (currentTokens + docTokens <= availableTokens) {
        optimizedDocs.push(doc);
        currentTokens += docTokens;
      } else {
        // Try to include a summary if there's space
        const summary = ContextWindowManager.summarizeDocument(
          doc.content,
          query,
        );
        const summaryTokens = ContextWindowManager.estimateTokens(summary);

        if (currentTokens + summaryTokens <= availableTokens) {
          optimizedDocs.push({
            content: summary,
            metadata: { ...doc.metadata, summarized: true },
          });
        }
        break;
      }
    }

    return optimizedDocs;
  }

  /**
   * Optimize conversation history for context
   */
  static optimizeConversationContext(
    history: Array<{ role: string; content: string; timestamp: number }>,
    _currentQuery: string,
    maxTokens = 2000,
  ): Array<{ role: string; content: string; timestamp: number }> {
    if (!history.length) {
      return [];
    }

    let currentTokens = 0;
    const optimizedHistory: Array<{
      role: string;
      content: string;
      timestamp: number;
    }> = [];

    // Include recent messages first (reverse chronological)
    const recentHistory = [...history].reverse();

    for (const message of recentHistory) {
      const messageTokens = ContextWindowManager.estimateTokens(
        message.content,
      );

      if (currentTokens + messageTokens <= maxTokens) {
        optimizedHistory.unshift(message); // Add to beginning to maintain order
        currentTokens += messageTokens;
      } else {
        break;
      }
    }

    return optimizedHistory;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private static estimateTokens(text: string): number {
    // Rough estimate: 4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate document relevance to query (simplified)
   */
  private static calculateDocumentRelevance(
    content: string,
    query: string,
  ): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let matches = 0;
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        matches++;
      }
    }

    return matches / queryTerms.length;
  }

  /**
   * Summarize document content for context optimization
   */
  private static summarizeDocument(content: string, query: string): string {
    // Extract key sentences related to the query
    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const queryTerms = query.toLowerCase().split(/\s+/);

    const relevantSentences = sentences
      .map((sentence) => ({
        sentence: sentence.trim(),
        relevance: ContextWindowManager.calculateSentenceRelevance(
          sentence,
          queryTerms,
        ),
      }))
      .filter((item) => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3)
      .map((item) => item.sentence);

    if (relevantSentences.length === 0) {
      // If no relevant sentences, take first few sentences
      return `${sentences.slice(0, 2).join(". ")}.`;
    }

    return `${relevantSentences.join(". ")}.`;
  }

  /**
   * Calculate sentence relevance to query terms
   */
  private static calculateSentenceRelevance(
    sentence: string,
    queryTerms: string[],
  ): number {
    const sentenceLower = sentence.toLowerCase();
    let matches = 0;

    for (const term of queryTerms) {
      if (sentenceLower.includes(term)) {
        matches++;
      }
    }

    return matches / queryTerms.length;
  }
}

/**
 * Performance monitoring for prompt optimization
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
export class PromptOptimizationMetrics {
  private static readonly metrics: Map<string, PromptOptimizationMetric> =
    new Map();

  static recordOptimizationMetrics(
    queryId: string,
    originalQuery: string,
    optimizedQuery: OptimizedQuery,
    searchResults: unknown[],
    responseTime: number,
  ): void {
    PromptOptimizationMetrics.metrics.set(queryId, {
      timestamp: Date.now(),
      originalQuery,
      optimizedQuery: optimizedQuery.optimizedQuery,
      queryType: optimizedQuery.metadata.queryType,
      complexity: optimizedQuery.metadata.complexity,
      estimatedRelevance: optimizedQuery.metadata.estimatedRelevance,
      resultsCount: searchResults.length,
      responseTime,
      expansionCount: optimizedQuery.expandedQueries.length,
    });
  }

  static getMetrics(queryId: string): PromptOptimizationMetric | undefined {
    return PromptOptimizationMetrics.metrics.get(queryId);
  }

  static getAggregatedMetrics(): AggregatedOptimizationMetrics | null {
    const allMetrics = Array.from(PromptOptimizationMetrics.metrics.values());

    if (allMetrics.length === 0) {
      return null;
    }

    return {
      totalQueries: allMetrics.length,
      avgResponseTime:
        allMetrics.reduce((sum, m) => sum + m.responseTime, 0) /
        allMetrics.length,
      avgResultsCount:
        allMetrics.reduce((sum, m) => sum + m.resultsCount, 0) /
        allMetrics.length,
      avgEstimatedRelevance:
        allMetrics.reduce((sum, m) => sum + m.estimatedRelevance, 0) /
        allMetrics.length,
      queryTypeDistribution: PromptOptimizationMetrics.getDistribution(
        allMetrics,
        "queryType",
      ),
      complexityDistribution: PromptOptimizationMetrics.getDistribution(
        allMetrics,
        "complexity",
      ),
    };
  }

  private static getDistribution(
    metrics: any[],
    field: string,
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const metric of metrics) {
      const value = metric[field];
      distribution[value] = (distribution[value] || 0) + 1;
    }

    return distribution;
  }
}
