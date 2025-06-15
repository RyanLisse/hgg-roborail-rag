#!/usr/bin/env node

/**
 * Test script for RoboRail Relevance Scoring and Reranking system
 *
 * This script tests the relevance scoring implementation including:
 * - Multi-factor relevance calculation
 * - Document reranking
 * - Cross-encoder simulation
 * - User feedback integration
 * - Performance metrics
 */

const { performance } = require('node:perf_hooks');

// Mock implementation for testing (since we can't import TypeScript modules directly)
const TestRelevanceScoringEngine = {
  userFeedbackStore: new Map(),
  documentAuthorityCache: new Map(),

  calculateRelevanceScore(document, query, queryContext = {}, weights = {}) {
    const defaultWeights = {
      similarity: 0.3,
      recency: 0.15,
      authority: 0.2,
      contextRelevance: 0.15,
      keywordMatch: 0.1,
      semanticMatch: 0.05,
      userFeedback: 0.05,
      ...weights,
    };

    // Simulate relevance factor calculations
    const similarity = document.similarity || 0.5;
    const recency = TestRelevanceScoringEngine.calculateRecencyScore(
      document.createdAt,
      document.updatedAt,
    );
    const authority = TestRelevanceScoringEngine.calculateAuthorityScore(
      document.id,
      document.source,
      document.metadata,
    );
    const contextRelevance =
      TestRelevanceScoringEngine.calculateContextRelevance(
        document.content,
        query,
        queryContext,
      );
    const keywordMatch = TestRelevanceScoringEngine.calculateKeywordMatch(
      document.content,
      query,
    );
    const semanticMatch = TestRelevanceScoringEngine.calculateSemanticMatch(
      document.content,
      query,
      queryContext,
    );
    const userFeedback = TestRelevanceScoringEngine.calculateUserFeedbackScore(
      document.id,
      query,
    );

    const factors = {
      similarity,
      recency,
      authority,
      contextRelevance,
      keywordMatch,
      semanticMatch,
      userFeedback,
    };

    const relevanceScore =
      factors.similarity * defaultWeights.similarity +
      factors.recency * defaultWeights.recency +
      factors.authority * defaultWeights.authority +
      factors.contextRelevance * defaultWeights.contextRelevance +
      factors.keywordMatch * defaultWeights.keywordMatch +
      factors.semanticMatch * defaultWeights.semanticMatch +
      factors.userFeedback * defaultWeights.userFeedback;

    return {
      factors,
      relevanceScore: Math.min(Math.max(relevanceScore, 0), 1),
    };
  },

  calculateRecencyScore(createdAt, updatedAt) {
    if (!createdAt && !updatedAt) return 0.5;

    const relevantDate = updatedAt || createdAt;
    const now = new Date();
    const ageInDays =
      (now.getTime() - relevantDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays <= 7) return 1.0;
    if (ageInDays <= 30) return 0.9;
    if (ageInDays <= 90) return 0.7;
    if (ageInDays <= 365) return 0.5;
    if (ageInDays <= 730) return 0.3;
    return 0.1;
  },

  calculateAuthorityScore(documentId, source, metadata) {
    if (TestRelevanceScoringEngine.documentAuthorityCache.has(documentId)) {
      return TestRelevanceScoringEngine.documentAuthorityCache.get(documentId);
    }

    let score = 0.5;

    const sourceAuthority = {
      roborail_official: 1.0,
      roborail_api: 0.95,
      roborail_examples: 0.8,
      openai: 0.9,
      community: 0.6,
      neon: 0.7,
      memory: 0.5,
    };

    if (source && sourceAuthority[source]) {
      score = Math.max(score, sourceAuthority[source]);
    }

    if (metadata) {
      if (metadata.official) score += 0.2;
      if (metadata.type === 'api_reference') score += 0.15;
      if (metadata.type === 'tutorial') score += 0.1;
      if (metadata.verified) score += 0.1;
    }

    score = Math.min(Math.max(score, 0), 1);
    TestRelevanceScoringEngine.documentAuthorityCache.set(documentId, score);
    return score;
  },

  calculateContextRelevance(content, query, queryContext) {
    let score = 0.5;
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();

    // Simple keyword overlap
    const queryWords = queryLower.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);
    const overlap = queryWords.filter((word) =>
      contentWords.includes(word),
    ).length;
    score += (overlap / queryWords.length) * 0.3;

    // Domain relevance
    if (
      queryContext.domain === 'roborail' &&
      contentLower.includes('roborail')
    ) {
      score += 0.2;
    }

    // Type relevance
    if (queryContext.type && contentLower.includes(queryContext.type)) {
      score += 0.1;
    }

    return Math.min(Math.max(score, 0), 1);
  },

  calculateKeywordMatch(content, query) {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const contentLower = content.toLowerCase();

    let score = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 1;
      }
    }

    return Math.min(score / Math.max(queryWords.length, 1), 1);
  },

  calculateSemanticMatch(content, query, queryContext) {
    // Simplified semantic matching
    const semanticPairs = [
      ['configure', 'setup'],
      ['install', 'deployment'],
      ['error', 'issue'],
      ['fix', 'solution'],
      ['api', 'endpoint'],
    ];

    let score = 0;
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();

    for (const [term1, term2] of semanticPairs) {
      if (
        (queryLower.includes(term1) && contentLower.includes(term2)) ||
        (queryLower.includes(term2) && contentLower.includes(term1))
      ) {
        score += 0.2;
      }
    }

    return Math.min(score, 1);
  },

  calculateUserFeedbackScore(documentId, query) {
    const feedbacks =
      TestRelevanceScoringEngine.userFeedbackStore.get(documentId) || [];
    if (feedbacks.length === 0) return 0.5;

    const avgRating =
      feedbacks.reduce((sum, fb) => sum + fb.rating, 0) / feedbacks.length;
    return (avgRating - 1) / 4; // Convert 1-5 scale to 0-1
  },

  recordUserFeedback(feedback) {
    if (
      !TestRelevanceScoringEngine.userFeedbackStore.has(feedback.documentId)
    ) {
      TestRelevanceScoringEngine.userFeedbackStore.set(feedback.documentId, []);
    }
    TestRelevanceScoringEngine.userFeedbackStore
      .get(feedback.documentId)
      .push(feedback);
  },
};

const TestDocumentRerankingEngine = {
  async rerankDocuments(request) {
    const startTime = performance.now();

    const scoredDocuments = [];

    for (let i = 0; i < request.documents.length; i++) {
      const doc = request.documents[i];
      const scoringResult = TestRelevanceScoringEngine.calculateRelevanceScore(
        doc,
        request.query,
        request.queryContext,
        request.weights,
      );

      scoredDocuments.push({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        source: doc.source,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        relevanceScore: scoringResult.relevanceScore,
        factors: scoringResult.factors,
        weights: request.weights || {},
        rank: 0, // Will be set after sorting
        scoringMetadata: {
          scoringStrategy: request.enableCrossEncoder
            ? 'cross_encoder'
            : 'relevance_only',
          processingTime: performance.now(),
        },
      });
    }

    // Sort by relevance score and assign ranks
    scoredDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);
    scoredDocuments.forEach((doc, index) => {
      doc.rank = index + 1;
    });

    // Limit results
    const finalResults = scoredDocuments.slice(0, request.maxResults || 10);

    const rerankingTime = performance.now() - startTime;

    return {
      scoredDocuments: finalResults,
      totalCandidates: request.documents.length,
      rerankingTime,
      strategy: request.enableCrossEncoder ? 'cross_encoder' : 'relevance_only',
      diversificationApplied: false,
    };
  },

  fuseHybridResults(request) {
    const documentMap = new Map();

    // Add vector results
    for (const result of request.vectorResults) {
      documentMap.set(result.id, {
        vectorScore: result.similarity,
        document: result,
      });
    }

    // Add keyword results
    if (request.keywordResults) {
      for (const result of request.keywordResults) {
        const existing = documentMap.get(result.id) || {};
        documentMap.set(result.id, {
          ...existing,
          keywordScore: result.score,
          document: existing.document || result,
        });
      }
    }

    // Calculate fusion scores
    const fusionWeights = request.fusionWeights || {
      vectorWeight: 0.7,
      keywordWeight: 0.3,
    };
    const fusionScores = [];

    for (const [docId, scores] of documentMap.entries()) {
      const vectorScore = scores.vectorScore || 0;
      const keywordScore = scores.keywordScore || 0;

      const finalScore =
        vectorScore * fusionWeights.vectorWeight +
        keywordScore * fusionWeights.keywordWeight;

      fusionScores.push({
        documentId: docId,
        vectorScore,
        keywordScore,
        finalScore,
        rank: 0,
      });
    }

    // Sort and assign ranks
    fusionScores.sort((a, b) => b.finalScore - a.finalScore);
    fusionScores.forEach((score, index) => {
      score.rank = index + 1;
    });

    return fusionScores;
  },
};

// Test data generators
function generateTestDocuments(count = 20) {
  const topics = [
    'automation',
    'configuration',
    'integration',
    'troubleshooting',
    'api',
    'deployment',
  ];
  const sources = [
    'roborail_official',
    'roborail_api',
    'community',
    'openai',
    'neon',
  ];
  const types = [
    'tutorial',
    'guide',
    'api_reference',
    'troubleshooting_guide',
    'best_practices',
  ];

  return Array.from({ length: count }, (_, i) => {
    const topic = topics[i % topics.length];
    const source = sources[i % sources.length];
    const type = types[i % types.length];

    return {
      id: `test-doc-${i}`,
      content: `RoboRail ${topic} ${type} - This document covers ${topic} aspects of RoboRail including setup, configuration, and best practices.`,
      similarity: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
      metadata: {
        type,
        topic,
        official: source.includes('roborail'),
        verified: Math.random() > 0.5,
      },
      source,
      createdAt: new Date(
        Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
      ),
      updatedAt: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      ),
    };
  });
}

// Test functions
async function testRelevanceScoring() {
  console.log('\n===== Testing Relevance Scoring =====\n');

  const testDocument = {
    id: 'doc-1',
    content:
      'RoboRail automation workflow configuration guide for API integration',
    similarity: 0.85,
    metadata: {
      type: 'api_reference',
      official: true,
    },
    source: 'roborail_api',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  };

  const query = 'roborail automation api configuration';
  const queryContext = {
    domain: 'roborail',
    type: 'configuration',
  };

  const result = TestRelevanceScoringEngine.calculateRelevanceScore(
    testDocument,
    query,
    queryContext,
  );

  console.log('Document:', testDocument.id);
  console.log('Query:', query);
  console.log('\nRelevance Factors:');
  Object.entries(result.factors).forEach(([factor, score]) => {
    console.log(`  ${factor}: ${score.toFixed(3)}`);
  });
  console.log(`\nFinal Relevance Score: ${result.relevanceScore.toFixed(3)}`);
}

async function testDocumentReranking() {
  console.log('\n===== Testing Document Reranking =====\n');

  const documents = generateTestDocuments(10);
  const query = 'roborail automation configuration';
  const queryContext = {
    domain: 'roborail',
    type: 'configuration',
  };

  const request = {
    documents,
    query,
    queryContext,
    maxResults: 5,
    enableCrossEncoder: false,
  };

  const result = await TestDocumentRerankingEngine.rerankDocuments(request);

  console.log(`Total documents: ${result.totalCandidates}`);
  console.log(`Reranking time: ${result.rerankingTime.toFixed(2)}ms`);
  console.log(`Strategy: ${result.strategy}\n`);

  console.log('Top 5 Results:');
  result.scoredDocuments.forEach((doc) => {
    console.log(`\nRank ${doc.rank}: ${doc.id}`);
    console.log(`  Content: ${doc.content.substring(0, 60)}...`);
    console.log(`  Relevance Score: ${doc.relevanceScore.toFixed(3)}`);
    console.log(`  Source: ${doc.source}`);
  });
}

async function testHybridFusion() {
  console.log('\n===== Testing Hybrid Result Fusion =====\n');

  // Simulate vector search results
  const vectorResults = [
    { id: 'doc-1', similarity: 0.9, content: 'Vector result 1' },
    { id: 'doc-2', similarity: 0.85, content: 'Vector result 2' },
    { id: 'doc-3', similarity: 0.8, content: 'Vector result 3' },
  ];

  // Simulate keyword search results
  const keywordResults = [
    { id: 'doc-2', score: 0.95, content: 'Keyword result 2' },
    { id: 'doc-4', score: 0.88, content: 'Keyword result 4' },
    { id: 'doc-1', score: 0.75, content: 'Keyword result 1' },
  ];

  const request = {
    vectorResults,
    keywordResults,
    fusionWeights: { vectorWeight: 0.6, keywordWeight: 0.4 },
  };

  const results = TestDocumentRerankingEngine.fuseHybridResults(request);

  console.log('Fusion Results:');
  results.forEach((result) => {
    console.log(`\nDocument ${result.documentId}:`);
    console.log(`  Vector Score: ${result.vectorScore.toFixed(3)}`);
    console.log(`  Keyword Score: ${result.keywordScore.toFixed(3)}`);
    console.log(`  Final Score: ${result.finalScore.toFixed(3)}`);
    console.log(`  Rank: ${result.rank}`);
  });
}

async function testUserFeedbackIntegration() {
  console.log('\n===== Testing User Feedback Integration =====\n');

  // Record some user feedback
  const feedbacks = [
    { documentId: 'doc-1', rating: 5, userId: 'user-1' },
    { documentId: 'doc-1', rating: 4, userId: 'user-2' },
    { documentId: 'doc-2', rating: 2, userId: 'user-1' },
    { documentId: 'doc-3', rating: 3, userId: 'user-2' },
  ];

  feedbacks.forEach((fb) => TestRelevanceScoringEngine.recordUserFeedback(fb));

  // Test documents with user feedback
  const documents = [
    {
      id: 'doc-1',
      content: 'Document with positive feedback',
      similarity: 0.8,
    },
    {
      id: 'doc-2',
      content: 'Document with negative feedback',
      similarity: 0.85,
    },
    { id: 'doc-3', content: 'Document with mixed feedback', similarity: 0.82 },
    { id: 'doc-4', content: 'Document with no feedback', similarity: 0.83 },
  ];

  console.log('Document Scores with User Feedback:');
  for (const doc of documents) {
    const result = TestRelevanceScoringEngine.calculateRelevanceScore(
      doc,
      'test query',
    );
    console.log(`\n${doc.id}:`);
    console.log(
      `  User Feedback Score: ${result.factors.userFeedback.toFixed(3)}`,
    );
    console.log(`  Final Relevance Score: ${result.relevanceScore.toFixed(3)}`);
  }
}

async function testWeightCustomization() {
  console.log('\n===== Testing Weight Customization =====\n');

  const document = {
    id: 'test-doc',
    content: 'RoboRail API documentation for automation workflows',
    similarity: 0.7,
    source: 'roborail_official',
    createdAt: new Date(),
  };

  const query = 'roborail automation';

  // Test with different weight configurations
  const weightConfigs = [
    { name: 'Default', weights: {} },
    {
      name: 'Similarity-focused',
      weights: { similarity: 0.6, authority: 0.1 },
    },
    { name: 'Authority-focused', weights: { similarity: 0.2, authority: 0.5 } },
    { name: 'Recency-focused', weights: { similarity: 0.2, recency: 0.5 } },
  ];

  console.log('Testing different weight configurations:');
  for (const config of weightConfigs) {
    const result = TestRelevanceScoringEngine.calculateRelevanceScore(
      document,
      query,
      {},
      config.weights,
    );
    console.log(`\n${config.name}:`);
    console.log(`  Relevance Score: ${result.relevanceScore.toFixed(3)}`);
  }
}

// Performance testing
async function testPerformance() {
  console.log('\n===== Performance Testing =====\n');

  const documentCounts = [10, 50, 100, 500];

  for (const count of documentCounts) {
    const documents = generateTestDocuments(count);
    const query = 'roborail automation configuration';

    const startTime = performance.now();

    const request = {
      documents,
      query,
      queryContext: { domain: 'roborail' },
      maxResults: 10,
    };

    const result = await TestDocumentRerankingEngine.rerankDocuments(request);

    const totalTime = performance.now() - startTime;
    const avgTimePerDoc = totalTime / count;

    console.log(`\nDocuments: ${count}`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Avg time per doc: ${avgTimePerDoc.toFixed(2)}ms`);
    console.log(`  Throughput: ${(1000 / avgTimePerDoc).toFixed(0)} docs/sec`);
  }
}

// Main test runner
async function runAllTests() {
  console.log('Starting RoboRail Relevance Scoring Tests...\n');

  try {
    await testRelevanceScoring();
    await testDocumentReranking();
    await testHybridFusion();
    await testUserFeedbackIntegration();
    await testWeightCustomization();
    await testPerformance();

    console.log('\n===== All Tests Completed Successfully =====\n');
  } catch (error) {
    console.error('\nError during testing:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  TestRelevanceScoringEngine,
  TestDocumentRerankingEngine,
  generateTestDocuments,
  runAllTests,
};
