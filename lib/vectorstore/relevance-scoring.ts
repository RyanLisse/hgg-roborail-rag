/**
 * Document Relevance Scoring and Reranking System
 *
 * Implements multi-factor relevance scoring for improved search result quality.
 * Features:
 * - Multi-factor scoring (similarity, recency, authority, context)
 * - Query-document reranking
 * - Temporal relevance consideration
 * - Hybrid retrieval (vector + keyword)
 * - User feedback integration
 * - Performance optimization
 */

import { z } from 'zod';

// Schemas for relevance scoring
export const RelevanceFactors = z.object({
  similarity: z.number().min(0).max(1),
  recency: z.number().min(0).max(1),
  authority: z.number().min(0).max(1),
  contextRelevance: z.number().min(0).max(1),
  keywordMatch: z.number().min(0).max(1),
  semanticMatch: z.number().min(0).max(1),
  userFeedback: z.number().min(0).max(1).optional(),
});

export const ScoringWeights = z.object({
  similarity: z.number().min(0).max(1).default(0.35),
  recency: z.number().min(0).max(1).default(0.15),
  authority: z.number().min(0).max(1).default(0.2),
  contextRelevance: z.number().min(0).max(1).default(0.15),
  keywordMatch: z.number().min(0).max(1).default(0.1),
  semanticMatch: z.number().min(0).max(1).default(0.05),
  userFeedback: z.number().min(0).max(1).default(0.0),
});

export const DocumentMetadata = z.object({
  id: z.string(),
  title: z.string().optional(),
  source: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  authority: z.number().min(0).max(1).default(0.5),
  documentType: z
    .enum(['manual', 'faq', 'api', 'guide', 'reference'])
    .default('guide'),
  tags: z.array(z.string()).default([]),
});

export const ScoredDocument = z.object({
  id: z.string(),
  content: z.string(),
  metadata: DocumentMetadata,
  source: z.string(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  relevanceScore: z.number().min(0).max(1),
  factors: RelevanceFactors,
  weights: ScoringWeights,
  rank: z.number(),
  originalRank: z.number().optional(),
  rerankedRank: z.number().optional(),
  scoringMetadata: z.object({
    queryType: z.string().optional(),
    queryComplexity: z.string().optional(),
    scoringStrategy: z.string(),
    processingTime: z.number(),
    debugInfo: z.record(z.any()).optional(),
  }),
});

export const RelevanceScoringConfig = z.object({
  weights: ScoringWeights.default({}),
  enableReranking: z.boolean().default(true),
  enableKeywordMatching: z.boolean().default(true),
  enableTemporalScoring: z.boolean().default(true),
  enableUserFeedback: z.boolean().default(false),
  maxDocuments: z.number().min(1).max(100).default(20),
  rerankingModel: z.enum(['basic', 'advanced', 'hybrid']).default('hybrid'),
  debugMode: z.boolean().default(false),
});

// Additional schemas for reranking and user feedback
export const UserFeedback = z.object({
  queryId: z.string(),
  documentId: z.string(),
  rating: z.number().min(1).max(5),
  feedback: z.enum(['helpful', 'not_helpful', 'partially_helpful']),
  userId: z.string().optional(),
  timestamp: z.date(),
  comments: z.string().optional(),
  interactionData: z
    .object({
      clicked: z.boolean().optional(),
      timeSpent: z.number().optional(),
      scrollDepth: z.number().optional(),
    })
    .optional(),
});

export const RerankingRequest = z.object({
  documents: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      similarity: z.number(),
      metadata: z.record(z.any()).optional(),
      source: z.string().optional(),
      createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
    }),
  ),
  query: z.string(),
  queryContext: z.record(z.any()).optional(),
  weights: ScoringWeights.optional(),
  maxResults: z.number().default(10),
  enableCrossEncoder: z.boolean().default(false),
  enableUserFeedback: z.boolean().default(false),
});

export const HybridSearchRequest = z.object({
  query: z.string(),
  vectorResults: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      similarity: z.number(),
      metadata: z.record(z.any()).optional(),
    }),
  ),
  keywordResults: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        score: z.number(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .optional(),
  fusionWeights: z
    .object({
      vectorWeight: z.number().min(0).max(1).default(0.7),
      keywordWeight: z.number().min(0).max(1).default(0.3),
    })
    .optional(),
});

// Types
export type RelevanceFactors = z.infer<typeof RelevanceFactors>;
export type ScoringWeights = z.infer<typeof ScoringWeights>;
export type RelevanceWeights = ScoringWeights; // Alias for backward compatibility
export type DocumentMetadata = z.infer<typeof DocumentMetadata>;
export type ScoredDocument = z.infer<typeof ScoredDocument>;
export type RelevanceScoringConfig = z.infer<typeof RelevanceScoringConfig>;
export type UserFeedback = z.infer<typeof UserFeedback>;
export type RerankingRequest = z.infer<typeof RerankingRequest>;
export type HybridSearchRequest = z.infer<typeof HybridSearchRequest>;

export interface DocumentSearchResult {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
  source?: string;
}

export interface RerankingResult {
  documents: ScoredDocument[];
  totalProcessed: number;
  averageScore: number;
  scoringTime: number;
  improvements: {
    averagePositionChange: number;
    significantImprovements: number;
  };
}

/**
 * Multi-factor relevance scoring engine
 */
export class RelevanceScoringEngine {
  private config: RelevanceScoringConfig;
  private userFeedbackCache: Map<string, number> = new Map();
  private keywordCache: Map<string, string[]> = new Map();

  constructor(config?: Partial<RelevanceScoringConfig>) {
    this.config = RelevanceScoringConfig.parse(config || {});
  }

  /**
   * Score and rerank documents based on relevance factors
   */
  async scoreAndRankDocuments(
    query: string,
    documents: DocumentSearchResult[],
    queryContext?: Record<string, any>,
  ): Promise<RerankingResult> {
    const startTime = Date.now();

    try {
      // Extract query keywords for keyword matching
      const queryKeywords = this.extractKeywords(query);

      // Score each document
      const scoredDocuments: ScoredDocument[] = [];
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const scored = await this.scoreDocument(
          doc,
          query,
          queryKeywords,
          queryContext,
          i,
        );
        scoredDocuments.push(scored);
      }

      // Rerank documents if enabled
      let rankedDocuments = scoredDocuments;
      if (this.config.enableReranking) {
        rankedDocuments = this.rerankeDocuments(scoredDocuments);
      }

      // Calculate improvements
      const improvements = this.calculateImprovements(
        scoredDocuments,
        rankedDocuments,
      );

      const scoringTime = Date.now() - startTime;
      const averageScore =
        rankedDocuments.reduce((sum, doc) => sum + doc.relevanceScore, 0) /
        rankedDocuments.length;

      if (this.config.debugMode) {
      }

      return {
        documents: rankedDocuments.slice(0, this.config.maxDocuments),
        totalProcessed: documents.length,
        averageScore,
        scoringTime,
        improvements,
      };
    } catch (_error) {
      // Fallback to original documents with basic scoring
      const fallbackDocuments = documents.map((doc, index) => ({
        id: doc.id,
        content: doc.content,
        metadata: DocumentMetadata.parse(doc.metadata || {}),
        source: doc.source || 'unknown',
        createdAt: undefined,
        updatedAt: undefined,
        relevanceScore: doc.similarity || 0.5,
        factors: {
          similarity: doc.similarity || 0.5,
          recency: 0.5,
          authority: 0.5,
          contextRelevance: 0.5,
          keywordMatch: 0.5,
          semanticMatch: 0.5,
        },
        weights: this.config.weights,
        rank: index,
        originalRank: index,
        rerankedRank: index,
        scoringMetadata: {
          scoringStrategy: 'fallback',
          processingTime: Date.now(),
        },
      }));

      return {
        documents: fallbackDocuments,
        totalProcessed: documents.length,
        averageScore: 0.5,
        scoringTime: Date.now() - startTime,
        improvements: {
          averagePositionChange: 0,
          significantImprovements: 0,
        },
      };
    }
  }

  /**
   * Score individual document based on multiple factors
   */
  private async scoreDocument(
    document: DocumentSearchResult,
    query: string,
    queryKeywords: string[],
    queryContext?: Record<string, any>,
    originalRank?: number,
  ): Promise<ScoredDocument> {
    const metadata = DocumentMetadata.parse(document.metadata || {});

    // Calculate individual scoring factors
    const factors: RelevanceFactors = {
      similarity: document.similarity || 0.5,
      recency: this.calculateRecencyScore(metadata),
      authority: metadata.authority,
      contextRelevance: this.calculateContextRelevance(document, queryContext),
      keywordMatch: this.config.enableKeywordMatching
        ? this.calculateKeywordMatch(document.content, queryKeywords)
        : 0.5,
      semanticMatch: this.calculateSemanticMatch(
        document.content,
        query,
        queryContext,
      ),
      userFeedback: this.config.enableUserFeedback
        ? this.getUserFeedbackScore(document.id)
        : undefined,
    };

    // Calculate weighted relevance score
    const relevanceScore = this.calculateWeightedScore(factors);

    return {
      id: document.id,
      content: document.content,
      metadata,
      source: document.source || 'unknown',
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      relevanceScore,
      factors,
      weights: this.config.weights,
      rank: originalRank || 0,
      originalRank,
      scoringMetadata: {
        scoringStrategy: 'multi_factor',
        processingTime: Date.now(),
      },
    };
  }

  /**
   * Calculate weighted relevance score from factors
   */
  private calculateWeightedScore(factors: RelevanceFactors): number {
    const weights = this.config.weights;

    let totalWeight = 0;
    let weightedSum = 0;

    // Add weighted scores for each factor
    weightedSum += factors.similarity * weights.similarity;
    totalWeight += weights.similarity;

    weightedSum += factors.recency * weights.recency;
    totalWeight += weights.recency;

    weightedSum += factors.authority * weights.authority;
    totalWeight += weights.authority;

    weightedSum += factors.contextRelevance * weights.contextRelevance;
    totalWeight += weights.contextRelevance;

    weightedSum += factors.keywordMatch * weights.keywordMatch;
    totalWeight += weights.keywordMatch;

    weightedSum += factors.semanticMatch * weights.semanticMatch;
    totalWeight += weights.semanticMatch;

    // Include user feedback if available and enabled
    if (factors.userFeedback !== undefined && weights.userFeedback > 0) {
      weightedSum += factors.userFeedback * weights.userFeedback;
      totalWeight += weights.userFeedback;
    }

    // Normalize by total weight
    return totalWeight > 0
      ? Math.min(1, Math.max(0, weightedSum / totalWeight))
      : 0.5;
  }

  /**
   * Calculate recency score based on document dates
   */
  private calculateRecencyScore(metadata: DocumentMetadata): number {
    if (!this.config.enableTemporalScoring) {
      return 0.5; // Neutral score when temporal scoring is disabled
    }

    const now = new Date();
    const relevantDate = metadata.updatedAt || metadata.createdAt;

    if (!relevantDate) {
      return 0.4; // Slightly lower score for undated documents
    }

    // Calculate age in days
    const ageInDays =
      (now.getTime() - relevantDate.getTime()) / (1000 * 60 * 60 * 24);

    // Score function: newer documents get higher scores
    // Full score for documents < 30 days old
    // Gradual decay over 2 years
    if (ageInDays <= 30) {
      return 1.0;
    } else if (ageInDays <= 365) {
      return Math.max(0.3, 1.0 - ((ageInDays - 30) / (365 - 30)) * 0.5);
    } else if (ageInDays <= 730) {
      return Math.max(0.1, 0.5 - ((ageInDays - 365) / (730 - 365)) * 0.4);
    } else {
      return 0.1; // Minimum score for very old documents
    }
  }

  /**
   * Calculate context relevance based on query context
   */
  private calculateContextRelevance(
    document: DocumentSearchResult,
    queryContext?: Record<string, any>,
  ): number {
    if (!queryContext) {
      return 0.5; // Neutral score when no context
    }

    let relevanceScore = 0.5;
    const content = document.content.toLowerCase();
    const metadata = document.metadata || {};

    // Check for domain-specific relevance
    if (queryContext.domain) {
      const domain = queryContext.domain.toLowerCase();
      const domainKeywords = this.getDomainKeywords(domain);

      for (const keyword of domainKeywords) {
        if (content.includes(keyword)) {
          relevanceScore += 0.1;
        }
      }
    }

    // Check for query type relevance
    if (queryContext.type) {
      const queryType = queryContext.type.toLowerCase();
      const typeBoosts = this.getQueryTypeBoosts(queryType, content, metadata);
      relevanceScore += typeBoosts;
    }

    // Check for conversation context
    if (queryContext.conversationHistory?.length > 0) {
      const contextBoost = this.calculateConversationContextBoost(
        content,
        queryContext.conversationHistory,
      );
      relevanceScore += contextBoost;
    }

    return Math.min(1, Math.max(0, relevanceScore));
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordMatch(
    content: string,
    queryKeywords: string[],
  ): number {
    if (queryKeywords.length === 0) {
      return 0.5;
    }

    const contentLower = content.toLowerCase();
    let matches = 0;
    let totalImportance = 0;

    for (const keyword of queryKeywords) {
      const importance = keyword.length > 3 ? 1.0 : 0.5; // Longer keywords are more important
      totalImportance += importance;

      if (contentLower.includes(keyword.toLowerCase())) {
        // Bonus for exact matches
        if (contentLower.includes(` ${keyword.toLowerCase()} `)) {
          matches += importance * 1.2;
        } else {
          matches += importance;
        }
      }
    }

    return totalImportance > 0 ? Math.min(1, matches / totalImportance) : 0.5;
  }

  /**
   * Get user feedback score for document
   */
  private getUserFeedbackScore(documentId: string): number {
    return this.userFeedbackCache.get(documentId) || 0.5;
  }

  /**
   * Calculate semantic match score using semantic relationships
   */
  private calculateSemanticMatch(
    content: string,
    query: string,
    queryContext?: Record<string, any>,
  ): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();

    // Semantic word pairs for enhanced matching
    const semanticPairs = [
      ['configure', 'setup'],
      ['install', 'deployment'],
      ['error', 'issue'],
      ['fix', 'solution'],
      ['api', 'endpoint'],
      ['authentication', 'auth'],
      ['authorization', 'permission'],
      ['monitoring', 'observability'],
      ['workflow', 'automation'],
      ['integration', 'connection'],
    ];

    let semanticScore = 0;

    // Check for semantic relationships
    for (const [term1, term2] of semanticPairs) {
      if (
        (queryLower.includes(term1) && contentLower.includes(term2)) ||
        (queryLower.includes(term2) && contentLower.includes(term1))
      ) {
        semanticScore += 0.2;
      }
    }

    // Context-aware semantic matching
    if (queryContext?.domain) {
      const domain = queryContext.domain.toLowerCase();
      const domainKeywords = this.getDomainKeywords(domain);

      for (const keyword of domainKeywords) {
        if (contentLower.includes(keyword)) {
          semanticScore += 0.1;
        }
      }
    }

    return Math.min(1, semanticScore);
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(query: string): string[] {
    const cached = this.keywordCache.get(query);
    if (cached) {
      return cached;
    }

    // Simple keyword extraction
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter((word) => !this.isStopWord(word));

    this.keywordCache.set(query, keywords);
    return keywords;
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'among',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'what',
      'how',
      'where',
      'when',
      'why',
      'who',
      'which',
    ]);
    return stopWords.has(word.toLowerCase());
  }

  /**
   * Get domain-specific keywords
   */
  private getDomainKeywords(domain: string): string[] {
    const domainKeywords: Record<string, string[]> = {
      automation: [
        'workflow',
        'trigger',
        'rule',
        'automation',
        'process',
        'schedule',
      ],
      integration: [
        'api',
        'webhook',
        'connection',
        'integration',
        'sync',
        'endpoint',
      ],
      configuration: [
        'config',
        'setting',
        'parameter',
        'option',
        'setup',
        'preference',
      ],
      security: [
        'auth',
        'permission',
        'security',
        'access',
        'token',
        'credential',
      ],
      api: [
        'endpoint',
        'request',
        'response',
        'method',
        'parameter',
        'authentication',
      ],
      troubleshooting: [
        'error',
        'issue',
        'problem',
        'fix',
        'debug',
        'troubleshoot',
      ],
    };
    return domainKeywords[domain] || [];
  }

  /**
   * Get query type-specific relevance boosts
   */
  private getQueryTypeBoosts(
    queryType: string,
    content: string,
    metadata: Record<string, any>,
  ): number {
    let boost = 0;
    const contentLower = content.toLowerCase();

    switch (queryType) {
      case 'troubleshooting':
        if (
          contentLower.includes('error') ||
          contentLower.includes('problem') ||
          contentLower.includes('fix') ||
          contentLower.includes('troubleshoot')
        ) {
          boost += 0.2;
        }
        break;
      case 'api':
        if (
          contentLower.includes('api') ||
          contentLower.includes('endpoint') ||
          contentLower.includes('request') ||
          metadata.documentType === 'api'
        ) {
          boost += 0.2;
        }
        break;
      case 'configuration':
        if (
          contentLower.includes('config') ||
          contentLower.includes('setting') ||
          contentLower.includes('setup')
        ) {
          boost += 0.2;
        }
        break;
      case 'procedural':
        if (
          contentLower.includes('step') ||
          contentLower.includes('how to') ||
          contentLower.includes('guide') ||
          metadata.documentType === 'guide'
        ) {
          boost += 0.2;
        }
        break;
      default:
        break;
    }

    return boost;
  }

  /**
   * Calculate conversation context boost
   */
  private calculateConversationContextBoost(
    content: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): number {
    if (conversationHistory.length === 0) {
      return 0;
    }

    // Get recent user messages for context
    const recentMessages = conversationHistory
      .filter((msg) => msg.role === 'user')
      .slice(-3)
      .map((msg) => msg.content.toLowerCase());

    const contentLower = content.toLowerCase();
    let contextBoost = 0;

    for (const message of recentMessages) {
      const messageKeywords = this.extractKeywords(message);
      for (const keyword of messageKeywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          contextBoost += 0.05; // Small boost for each matching keyword
        }
      }
    }

    return Math.min(0.3, contextBoost); // Cap at 0.3
  }

  /**
   * Rerank documents based on relevance scores
   */
  private rerankeDocuments(documents: ScoredDocument[]): ScoredDocument[] {
    // Sort by relevance score (descending)
    const reranked = [...documents].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );

    // Update reranked positions
    reranked.forEach((doc, index) => {
      doc.rerankedRank = index;
    });

    return reranked;
  }

  /**
   * Calculate improvement metrics from reranking
   */
  private calculateImprovements(
    original: ScoredDocument[],
    reranked: ScoredDocument[],
  ): { averagePositionChange: number; significantImprovements: number } {
    let totalPositionChange = 0;
    let significantImprovements = 0;

    for (const doc of reranked) {
      const originalPos = doc.originalRank || 0;
      const newPos = doc.rerankedRank || 0;
      const positionChange = originalPos - newPos; // Positive = moved up

      totalPositionChange += Math.abs(positionChange);

      if (positionChange >= 3) {
        // Moved up 3+ positions
        significantImprovements++;
      }
    }

    return {
      averagePositionChange:
        original.length > 0 ? totalPositionChange / original.length : 0,
      significantImprovements,
    };
  }

  /**
   * Update user feedback for a document
   */
  updateUserFeedback(documentId: string, feedback: number): void {
    // Normalize feedback to 0-1 range
    const normalizedFeedback = Math.min(1, Math.max(0, feedback));
    this.userFeedbackCache.set(documentId, normalizedFeedback);
  }

  /**
   * Clear caches to free memory
   */
  clearCaches(): void {
    this.keywordCache.clear();
    this.userFeedbackCache.clear();
  }

  /**
   * Get current configuration
   */
  getConfig(): RelevanceScoringConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RelevanceScoringConfig>): void {
    this.config = RelevanceScoringConfig.parse({
      ...this.config,
      ...newConfig,
    });
  }

  /**
   * Static method to record user feedback (used by unified service)
   */
  static recordUserFeedback(feedback: UserFeedback): void {
    // In production, this would save to a database
    // For now, we'll use the default engine's feedback cache
    const normalizedRating = Math.min(
      1,
      Math.max(0, (feedback.rating - 1) / 4),
    );
    defaultRelevanceScoringEngine.updateUserFeedback(
      feedback.documentId,
      normalizedRating,
    );
  }
}

/**
 * Create a relevance scoring engine instance
 */
export function createRelevanceScoringEngine(
  config?: Partial<RelevanceScoringConfig>,
): RelevanceScoringEngine {
  return new RelevanceScoringEngine(config);
}

/**
 * Default relevance scoring engine for RoboRail documentation
 */
export const defaultRelevanceScoringEngine = createRelevanceScoringEngine({
  weights: {
    similarity: 0.35, // Primary factor: semantic similarity
    authority: 0.25, // Secondary: document authority/quality
    contextRelevance: 0.2, // Context from query and conversation
    recency: 0.1, // Document freshness
    keywordMatch: 0.05, // Keyword overlap
    semanticMatch: 0.05, // Semantic relationships
    userFeedback: 0.0, // Disabled by default
  },
  enableReranking: true,
  enableKeywordMatching: true,
  enableTemporalScoring: true,
  enableUserFeedback: false,
  maxDocuments: 20,
  rerankingModel: 'hybrid',
  debugMode: false,
});

export default RelevanceScoringEngine;
