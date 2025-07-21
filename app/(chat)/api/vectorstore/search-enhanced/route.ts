import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  type EnhancedSearchResponse,
  getUnifiedVectorStoreService,
} from "@/lib/vectorstore/unified";

// Enhanced search request schema
const EnhancedSearchRequestSchema = z.object({
  query: z.string().min(1),
  sources: z
    .array(z.enum(["openai", "neon", "memory", "unified"]))
    .default(["openai", "memory"]),
  maxResults: z.number().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.3),
  metadata: z.record(z.any()).optional(),

  // Query context for optimization
  queryContext: z
    .object({
      type: z
        .enum([
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
        ])
        .optional(),
      domain: z.string().optional(),
      complexity: z.enum(["basic", "intermediate", "advanced"]).optional(),
      userIntent: z.string().optional(),
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
    })
    .optional(),

  // Prompt optimization
  optimizePrompts: z.boolean().default(true),
  promptConfig: z
    .object({
      maxTokens: z.number().default(1500),
      temperature: z.number().min(0).max(1).default(0.1),
      includeContext: z.boolean().default(true),
      includeCitations: z.boolean().default(true),
    })
    .optional(),

  // Enhanced relevance scoring options
  enableRelevanceScoring: z.boolean().default(true),
  relevanceWeights: z
    .object({
      similarity: z.number().min(0).max(1).default(0.3),
      recency: z.number().min(0).max(1).default(0.15),
      authority: z.number().min(0).max(1).default(0.2),
      contextRelevance: z.number().min(0).max(1).default(0.15),
      keywordMatch: z.number().min(0).max(1).default(0.1),
      semanticMatch: z.number().min(0).max(1).default(0.05),
      userFeedback: z.number().min(0).max(1).default(0.05),
    })
    .optional(),
  enableCrossEncoder: z.boolean().default(false),
  enableDiversification: z.boolean().default(true),
  enableHybridSearch: z.boolean().default(false),
  userId: z.string().optional(),

  // Performance options
  timeout: z.number().min(1000).max(30_000).default(10_000), // 10 second default timeout
  debug: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request
    let validatedRequest: z.infer<typeof EnhancedSearchRequestSchema>;
    try {
      validatedRequest = EnhancedSearchRequestSchema.parse(body);
    } catch (validationError: any) {
      console.error("Invalid search request:", validationError);
      return NextResponse.json(
        {
          error: "Invalid request format",
          details:
            validationError instanceof z.ZodError
              ? validationError.errors
              : "Unknown validation error",
        },
        { status: 400 },
      );
    }

    console.log(`🚀 Enhanced search request: "${validatedRequest.query}"`);
    console.log(
      `🎯 Features enabled: scoring=${validatedRequest.enableRelevanceScoring}, cross-encoder=${validatedRequest.enableCrossEncoder}, diversification=${validatedRequest.enableDiversification}`,
    );

    if (validatedRequest.queryContext) {
      console.log(
        `📊 Query context: ${validatedRequest.queryContext.type || "auto-detect"} (${validatedRequest.queryContext.domain || "general"}, ${validatedRequest.queryContext.complexity || "auto"})`,
      );
    }

    const vectorStoreService = await getUnifiedVectorStoreService();

    // Add user ID for personalized scoring
    const searchRequest = {
      ...validatedRequest,
      userId: session.user.id,
      queryContext: validatedRequest.queryContext || {
        domain: "roborail",
        type: "conceptual" as const,
      },
    };

    // Perform enhanced search with timeout
    const searchPromise = vectorStoreService.searchEnhanced(searchRequest);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Search timeout")),
        validatedRequest.timeout,
      ),
    );

    const result = (await Promise.race([
      searchPromise,
      timeoutPromise,
    ])) as EnhancedSearchResponse;

    // Add additional metadata for debugging
    const response = {
      ...result,
      searchMetadata: {
        userId: session.user.id,
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        features: {
          relevanceScoring: validatedRequest.enableRelevanceScoring,
          crossEncoder: validatedRequest.enableCrossEncoder,
          diversification: validatedRequest.enableDiversification,
          hybridSearch: validatedRequest.enableHybridSearch,
        },
        performance: {
          timeout: validatedRequest.timeout,
          actualTime: result.processingTime,
          efficiency: result.processingTime / validatedRequest.timeout,
        },
      },
    };

    // Log performance metrics
    console.log(`✅ Enhanced search completed in ${result.processingTime}ms:`);
    console.log(`   - Results: ${result.totalResults}`);
    console.log(`   - Strategy: ${result.scoringStrategy}`);
    console.log(`   - Reranked: ${result.rerankingApplied}`);
    console.log(`   - Diversified: ${result.diversificationApplied}`);

    if (result.performance.rerankingTime) {
      console.log(`   - Reranking time: ${result.performance.rerankingTime}ms`);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Enhanced search failed:", error);

    const errorResponse = {
      error: "Enhanced search failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      fallbackAvailable: true,
    };

    // For timeout errors, suggest adjusting parameters
    if (error instanceof Error && error.message.includes("timeout")) {
      errorResponse.message =
        "Search timed out. Try reducing maxResults or increasing timeout.";
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vectorStoreService = await getUnifiedVectorStoreService();

    // Get relevance metrics and user preferences
    const [metrics, userPreferences] = await Promise.all([
      vectorStoreService.getRelevanceMetrics(),
      vectorStoreService.getUserPreferences(session.user.id),
    ]);

    const response = {
      metrics,
      userPreferences,
      features: {
        relevanceScoring: true,
        crossEncoder: true,
        diversification: true,
        hybridSearch: true,
        userFeedback: true,
        personalization: true,
      },
      documentation: {
        endpoint: "/api/vectorstore/search-enhanced",
        method: "POST",
        description:
          "Enhanced vector store search with advanced relevance scoring",
        parameters: {
          query: "Required: Search query string",
          enableRelevanceScoring:
            "Optional: Enable multi-factor relevance scoring (default: true)",
          enableCrossEncoder:
            "Optional: Enable cross-encoder reranking (default: false)",
          enableDiversification:
            "Optional: Enable result diversification (default: true)",
          relevanceWeights: "Optional: Custom weights for relevance factors",
          queryContext: "Optional: Query context for optimization",
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get enhanced search info:", error);
    return NextResponse.json(
      { error: "Failed to get enhanced search info" },
      { status: 500 },
    );
  }
}
