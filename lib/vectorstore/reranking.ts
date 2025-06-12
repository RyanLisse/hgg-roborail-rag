import 'server-only';

import { z } from 'zod';
import {
  RelevanceScoringEngine,
  ScoringWeights,
  ScoredDocument,
  RerankingRequest,
  HybridSearchRequest,
  type RelevanceFactors,
  type RelevanceWeights,
} from './relevance-scoring';

// Cross-encoder models for semantic reranking
export const CrossEncoderModels = z.enum([
  'ms-marco-MiniLM-L-6-v2',
  'ms-marco-electra-base',
  'cross-encoder/ms-marco-TinyBERT-L-2-v2',
  'sentence-transformers/cross-encoder-roberta-base',
]);

export const RerankingStrategy = z.enum([
  'relevance_only',
  'cross_encoder',
  'hybrid_fusion',
  'learning_to_rank',
  'neural_rerank',
]);

export const RerankingConfig = z.object({
  strategy: RerankingStrategy.default('relevance_only'),
  weights: ScoringWeights.optional(),
  crossEncoderModel: CrossEncoderModels.optional(),
  maxCandidates: z.number().min(1).max(100).default(50),
  enableDiversification: z.boolean().default(true),
  diversityThreshold: z.number().min(0).max(1).default(0.8),
  temporalDecay: z.boolean().default(true),
  enableUserPersonalization: z.boolean().default(false),
  debugMode: z.boolean().default(false),
});

export const RerankingResult = z.object({
  scoredDocuments: z.array(ScoredDocument),
  totalCandidates: z.number(),
  rerankingTime: z.number(),
  strategy: RerankingStrategy,
  diversificationApplied: z.boolean(),
  debugInfo: z.record(z.any()).optional(),
});

export const FusionScore = z.object({
  documentId: z.string(),
  vectorScore: z.number(),
  keywordScore: z.number().optional(),
  crossEncoderScore: z.number().optional(),
  finalScore: z.number(),
  rank: z.number(),
});

// Types
export type CrossEncoderModels = z.infer<typeof CrossEncoderModels>;
export type RerankingStrategy = z.infer<typeof RerankingStrategy>;
export type RerankingConfig = z.infer<typeof RerankingConfig>;
export type RerankingResult = z.infer<typeof RerankingResult>;
export type FusionScore = z.infer<typeof FusionScore>;

// Re-export types from relevance-scoring for convenience
export type { RerankingRequest, HybridSearchRequest } from './relevance-scoring';

/**
 * Advanced document reranking engine
 */
export class DocumentRerankingEngine {
  private static temporalWeights = new Map<string, number>();
  private static userPreferences = new Map<string, RelevanceWeights>();

  /**
   * Rerank documents using multi-factor relevance scoring
   */
  static async rerankDocuments(request: RerankingRequest): Promise<RerankingResult> {
    const startTime = Date.now();
    const validatedRequest = RerankingRequest.parse(request);
    
    const config = RerankingConfig.parse({
      strategy: validatedRequest.enableCrossEncoder ? 'cross_encoder' : 'relevance_only',
      weights: validatedRequest.weights,
      maxCandidates: Math.min(validatedRequest.documents.length, 50),
      enableDiversification: true,
      diversityThreshold: 0.8,
      temporalDecay: true,
      enableUserPersonalization: validatedRequest.enableUserFeedback,
      debugMode: false,
    });

    let scoredDocuments: ScoredDocument[] = [];
    let debugInfo: Record<string, any> = {};

    try {
      // Step 1: Calculate relevance scores for all documents
      const candidateDocuments = validatedRequest.documents.slice(0, config.maxCandidates);
      
      scoredDocuments = await this.scoreDocuments(
        candidateDocuments,
        validatedRequest.query,
        validatedRequest.queryContext,
        config
      );

      // Step 2: Apply cross-encoder reranking if enabled
      if (config.strategy === 'cross_encoder' || config.strategy === 'neural_rerank') {
        scoredDocuments = await this.applyCrossEncoderReranking(
          scoredDocuments,
          validatedRequest.query,
          config
        );
      }

      // Step 3: Apply diversification if enabled
      let diversificationApplied = false;
      if (config.enableDiversification) {
        const diversifiedDocs = this.applyDiversification(
          scoredDocuments,
          config.diversityThreshold!
        );
        
        if (diversifiedDocs.length !== scoredDocuments.length) {
          scoredDocuments = diversifiedDocs;
          diversificationApplied = true;
        }
      }

      // Step 4: Apply temporal decay if enabled
      if (config.temporalDecay) {
        scoredDocuments = this.applyTemporalDecay(scoredDocuments);
      }

      // Step 5: Final ranking and limit results
      scoredDocuments = scoredDocuments
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, validatedRequest.maxResults)
        .map((doc, index) => ({
          ...doc,
          rank: index + 1,
        }));

      // Step 6: Collect debug information
      if (config.debugMode) {
        debugInfo = {
          originalOrder: validatedRequest.documents.map(d => d.id),
          rerankedOrder: scoredDocuments.map(d => d.id),
          scoringBreakdown: scoredDocuments.map(d => ({
            id: d.id,
            factors: d.factors,
            weights: d.weights,
          })),
          strategyUsed: config.strategy,
          diversificationApplied,
        };
      }

      const rerankingTime = Date.now() - startTime;

      return RerankingResult.parse({
        scoredDocuments,
        totalCandidates: candidateDocuments.length,
        rerankingTime,
        strategy: config.strategy,
        diversificationApplied,
        debugInfo: config.debugMode ? debugInfo : undefined,
      });

    } catch (error) {
      console.error('Document reranking failed:', error);
      
      // Fallback: return original order with basic scoring
      const fallbackDocuments = validatedRequest.documents
        .slice(0, validatedRequest.maxResults)
        .map((doc, index) => 
          ScoredDocument.parse({
            ...doc,
            relevanceScore: doc.similarity || 0.5,
            factors: {
              similarity: doc.similarity || 0.5,
              recency: 0.5,
              authority: 0.5,
              contextRelevance: 0.5,
              keywordMatch: 0.5,
              semanticMatch: 0.5,
            },
            weights: ScoringWeights.parse({}),
            rank: index + 1,
            scoringMetadata: {
              scoringStrategy: 'fallback',
              processingTime: Date.now() - startTime,
              debugInfo: { error: error instanceof Error ? error.message : 'Unknown error' },
            },
          })
        );

      return RerankingResult.parse({
        scoredDocuments: fallbackDocuments,
        totalCandidates: validatedRequest.documents.length,
        rerankingTime: Date.now() - startTime,
        strategy: 'relevance_only',
        diversificationApplied: false,
        debugInfo: { error: 'Fallback to basic scoring', originalError: error },
      });
    }
  }

  /**
   * Score documents using relevance factors
   */
  private static async scoreDocuments(
    documents: Array<{
      id: string;
      content: string;
      similarity: number;
      metadata?: any;
      source?: string;
      createdAt?: Date;
      updatedAt?: Date;
    }>,
    query: string,
    queryContext?: any,
    config: Partial<RerankingConfig> = {}
  ): Promise<ScoredDocument[]> {
    const weights = config.weights || ScoringWeights.parse({});
    const scoredDocuments: ScoredDocument[] = [];

    for (const doc of documents) {
      try {
        // Use the default scoring engine for calculations
        const scoringEngine = new RelevanceScoringEngine({ weights });
        const scoringResult = await scoringEngine.scoreAndRankDocuments(
          query,
          [doc],
          queryContext
        );

        const scoreData = scoringResult.documents[0];
        const factors = scoreData?.factors || {
          similarity: doc.similarity || 0.5,
          recency: 0.5,
          authority: 0.5,
          contextRelevance: 0.5,
          keywordMatch: 0.5,
          semanticMatch: 0.5,
          userFeedback: 0.5,
        };
        const relevanceScore = scoreData?.relevanceScore || doc.similarity || 0.5;

        // Create scored document
        const scoredDoc = ScoredDocument.parse({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          source: doc.source || 'unknown',
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          relevanceScore,
          factors,
          weights,
          rank: 0, // Will be set later
          scoringMetadata: {
            queryType: queryContext?.type,
            queryComplexity: queryContext?.complexity,
            scoringStrategy: config.strategy || 'relevance_only',
            processingTime: Date.now(),
          },
        });

        scoredDocuments.push(scoredDoc);
      } catch (error) {
        console.warn(`Failed to score document ${doc.id}:`, error);
        
        // Add fallback scored document
        scoredDocuments.push(ScoredDocument.parse({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          source: doc.source || 'unknown',
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          relevanceScore: doc.similarity || 0.5,
          factors: {
            similarity: doc.similarity || 0.5,
            recency: 0.5,
            authority: 0.5,
            contextRelevance: 0.5,
            keywordMatch: 0.5,
            semanticMatch: 0.5,
          },
          weights,
          rank: 0,
          scoringMetadata: {
            scoringStrategy: 'fallback',
            processingTime: Date.now(),
            debugInfo: { error: 'Scoring failed, using fallback' },
          },
        }));
      }
    }

    return scoredDocuments;
  }

  /**
   * Apply cross-encoder reranking using semantic similarity
   */
  private static async applyCrossEncoderReranking(
    documents: ScoredDocument[],
    query: string,
    config: RerankingConfig
  ): Promise<ScoredDocument[]> {
    // In production, this would use a real cross-encoder model like sentence-transformers
    // For now, we'll implement a simplified version that improves upon basic similarity
    
    const rerankedDocuments = [...documents];
    
    for (let i = 0; i < rerankedDocuments.length; i++) {
      const doc = rerankedDocuments[i];
      
      // Simulate cross-encoder scoring with enhanced semantic analysis
      const crossEncoderScore = this.simulateCrossEncoderScore(doc.content, query);
      
      // Combine original relevance score with cross-encoder score
      const combinedScore = (doc.relevanceScore * 0.7) + (crossEncoderScore * 0.3);
      
      rerankedDocuments[i] = {
        ...doc,
        relevanceScore: combinedScore,
        scoringMetadata: {
          ...doc.scoringMetadata,
          scoringStrategy: 'cross_encoder',
          debugInfo: {
            ...doc.scoringMetadata.debugInfo,
            crossEncoderScore,
          },
        },
      };
    }
    
    return rerankedDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Simulate cross-encoder scoring (replace with real model in production)
   */
  private static simulateCrossEncoderScore(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Enhanced semantic matching
    let score = 0;
    
    // 1. Exact phrase matching
    if (contentLower.includes(queryLower)) {
      score += 0.4;
    }
    
    // 2. Word order preservation
    const queryWords = queryLower.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);
    
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    
    for (let i = 0; i < contentWords.length - queryWords.length + 1; i++) {
      consecutiveMatches = 0;
      for (let j = 0; j < queryWords.length; j++) {
        if (contentWords[i + j] === queryWords[j]) {
          consecutiveMatches++;
        } else {
          break;
        }
      }
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    }
    
    score += (maxConsecutive / queryWords.length) * 0.3;
    
    // 3. Semantic relationships (simplified)
    const semanticPairs = this.getSemanticPairs();
    for (const [term1, term2] of semanticPairs) {
      if ((queryLower.includes(term1) && contentLower.includes(term2)) ||
          (queryLower.includes(term2) && contentLower.includes(term1))) {
        score += 0.1;
      }
    }
    
    // 4. Context window analysis
    const contextScore = this.analyzeContextWindow(contentLower, queryLower);
    score += contextScore * 0.2;
    
    return Math.min(score, 1.0);
  }

  /**
   * Get semantic word pairs for enhanced matching
   */
  private static getSemanticPairs(): [string, string][] {
    return [
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
  }

  /**
   * Analyze context window for semantic coherence
   */
  private static analyzeContextWindow(content: string, query: string): number {
    const queryWords = query.split(/\s+/);
    const sentences = content.split(/[.!?]+/);
    
    let maxContextScore = 0;
    
    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      let sentenceScore = 0;
      let wordsFound = 0;
      
      for (const word of queryWords) {
        if (sentenceLower.includes(word)) {
          wordsFound++;
        }
      }
      
      if (wordsFound > 0) {
        sentenceScore = wordsFound / queryWords.length;
        // Boost score if multiple query words appear in same sentence
        if (wordsFound > 1) {
          sentenceScore *= 1.5;
        }
      }
      
      maxContextScore = Math.max(maxContextScore, sentenceScore);
    }
    
    return maxContextScore;
  }

  /**
   * Apply diversification to avoid redundant results
   */
  private static applyDiversification(
    documents: ScoredDocument[],
    threshold: number
  ): ScoredDocument[] {
    if (documents.length <= 1) return documents;
    
    const diversifiedDocs: ScoredDocument[] = [documents[0]]; // Always include top result
    
    for (let i = 1; i < documents.length; i++) {
      const candidate = documents[i];
      let shouldInclude = true;
      
      // Check similarity with already selected documents
      for (const selected of diversifiedDocs) {
        const similarity = this.calculateContentSimilarity(candidate.content, selected.content);
        
        if (similarity > threshold) {
          shouldInclude = false;
          break;
        }
      }
      
      if (shouldInclude) {
        diversifiedDocs.push(candidate);
      }
      
      // Limit diversified results
      if (diversifiedDocs.length >= 10) break;
    }
    
    return diversifiedDocs;
  }

  /**
   * Calculate content similarity for diversification
   */
  private static calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Apply temporal decay to boost recent documents
   */
  private static applyTemporalDecay(documents: ScoredDocument[]): ScoredDocument[] {
    const now = new Date();
    
    return documents.map(doc => {
      let temporalBoost = 1.0;
      
      const relevantDate = doc.updatedAt || doc.createdAt;
      if (relevantDate) {
        const ageInDays = (now.getTime() - relevantDate.getTime()) / (1000 * 60 * 60 * 24);
        
        // Apply temporal decay: newer documents get a boost
        if (ageInDays <= 7) temporalBoost = 1.1;
        else if (ageInDays <= 30) temporalBoost = 1.05;
        else if (ageInDays <= 90) temporalBoost = 1.0;
        else if (ageInDays <= 365) temporalBoost = 0.95;
        else temporalBoost = 0.9;
      }
      
      const adjustedScore = Math.min(doc.relevanceScore * temporalBoost, 1.0);
      
      return {
        ...doc,
        relevanceScore: adjustedScore,
        scoringMetadata: {
          ...doc.scoringMetadata,
          temporalBoost,
        },
      };
    });
  }

  /**
   * Hybrid search fusion combining vector and keyword results
   */
  static fuseHybridResults(request: HybridSearchRequest): FusionScore[] {
    const validatedRequest = HybridSearchRequest.parse(request);
    const fusionWeights = validatedRequest.fusionWeights || { vectorWeight: 0.7, keywordWeight: 0.3 };
    
    // Create document index for merging
    const documentMap = new Map<string, {
      vectorScore?: number;
      keywordScore?: number;
      document?: any;
    }>();
    
    // Add vector results
    for (const result of validatedRequest.vectorResults) {
      documentMap.set(result.id, {
        vectorScore: result.similarity,
        document: result,
      });
    }
    
    // Add keyword results
    if (validatedRequest.keywordResults) {
      for (const result of validatedRequest.keywordResults) {
        const existing = documentMap.get(result.id) || {};
        documentMap.set(result.id, {
          ...existing,
          keywordScore: result.score,
          document: existing.document || result,
        });
      }
    }
    
    // Calculate fusion scores
    const fusionScores: FusionScore[] = [];
    
    for (const [docId, scores] of documentMap.entries()) {
      const vectorScore = scores.vectorScore || 0;
      const keywordScore = scores.keywordScore || 0;
      
      // Reciprocal Rank Fusion (RRF) with weighted combination
      const finalScore = 
        (vectorScore * fusionWeights.vectorWeight) + 
        (keywordScore * fusionWeights.keywordWeight);
      
      fusionScores.push(FusionScore.parse({
        documentId: docId,
        vectorScore,
        keywordScore,
        finalScore,
        rank: 0, // Will be set after sorting
      }));
    }
    
    // Sort by final score and assign ranks
    return fusionScores
      .sort((a, b) => b.finalScore - a.finalScore)
      .map((score, index) => ({
        ...score,
        rank: index + 1,
      }));
  }

  /**
   * Learn user preferences from feedback
   */
  static updateUserPreferences(userId: string, feedback: {
    queryType: string;
    preferredFactors: string[];
    adjustments: Partial<RelevanceWeights>;
  }): void {
    const currentPrefs = this.userPreferences.get(userId) || ScoringWeights.parse({});
    
    // Apply feedback adjustments
    const updatedPrefs = { ...currentPrefs };
    
    for (const [factor, adjustment] of Object.entries(feedback.adjustments)) {
      if (factor in updatedPrefs && typeof adjustment === 'number') {
        (updatedPrefs as any)[factor] = Math.max(0, Math.min(1, 
          (updatedPrefs as any)[factor] + adjustment
        ));
      }
    }
    
    // Normalize weights to ensure they sum to approximately 1
    const totalWeight = Object.values(updatedPrefs).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight > 0) {
      for (const key of Object.keys(updatedPrefs)) {
        (updatedPrefs as any)[key] = (updatedPrefs as any)[key] / totalWeight;
      }
    }
    
    this.userPreferences.set(userId, ScoringWeights.parse(updatedPrefs));
  }

  /**
   * Get user-specific relevance weights
   */
  static getUserPreferences(userId: string): RelevanceWeights {
    return this.userPreferences.get(userId) || ScoringWeights.parse({});
  }

  /**
   * Performance monitoring for reranking operations
   */
  static getPerformanceMetrics(): {
    totalRerankings: number;
    averageRerankingTime: number;
    strategyDistribution: Record<string, number>;
    diversificationRate: number;
  } {
    // In production, this would aggregate from monitoring service
    return {
      totalRerankings: 0,
      averageRerankingTime: 0,
      strategyDistribution: {},
      diversificationRate: 0,
    };
  }
}

/**
 * Learning-to-Rank (LTR) engine for advanced reranking
 */
export class LearningToRankEngine {
  private static trainingData = new Map<string, any[]>();

  /**
   * Collect training data from user interactions
   */
  static collectTrainingData(
    query: string,
    documents: ScoredDocument[],
    userInteractions: Array<{
      documentId: string;
      clicked: boolean;
      timeSpent: number;
      rating?: number;
    }>
  ): void {
    const features = documents.map(doc => ({
      documentId: doc.id,
      features: [
        doc.factors.similarity,
        doc.factors.recency,
        doc.factors.authority,
        doc.factors.contextRelevance,
        doc.factors.keywordMatch,
        doc.factors.semanticMatch,
        doc.factors.userFeedback || 0,
      ],
      label: this.calculateLabel(doc.id, userInteractions),
    }));

    const queryHash = this.hashQuery(query);
    if (!this.trainingData.has(queryHash)) {
      this.trainingData.set(queryHash, []);
    }
    
    this.trainingData.get(queryHash)!.push(...features);
  }

  /**
   * Calculate relevance label from user interactions
   */
  private static calculateLabel(
    documentId: string,
    interactions: Array<{
      documentId: string;
      clicked: boolean;
      timeSpent: number;
      rating?: number;
    }>
  ): number {
    const interaction = interactions.find(i => i.documentId === documentId);
    if (!interaction) return 0;

    let label = 0;
    if (interaction.clicked) label += 0.5;
    if (interaction.timeSpent > 30) label += 0.3; // Engaged reading
    if (interaction.rating) label += (interaction.rating - 3) * 0.1; // Rating contribution

    return Math.max(0, Math.min(1, label));
  }

  /**
   * Simple query hashing for training data organization
   */
  private static hashQuery(query: string): string {
    // Simple hash function - in production, use more sophisticated approach
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Get training data statistics
   */
  static getTrainingStats(): {
    totalQueries: number;
    totalSamples: number;
    avgSamplesPerQuery: number;
  } {
    const totalQueries = this.trainingData.size;
    const totalSamples = Array.from(this.trainingData.values())
      .reduce((sum, samples) => sum + samples.length, 0);
    
    return {
      totalQueries,
      totalSamples,
      avgSamplesPerQuery: totalQueries > 0 ? totalSamples / totalQueries : 0,
    };
  }
}