#!/usr/bin/env node

/**
 * Performance benchmarking script for prompt optimization system
 * Tests retrieval accuracy improvements with optimized prompts vs standard prompts
 */

const { performance } = require('perf_hooks');

// Test configuration
const TEST_CONFIG = {
  // Test queries representing different types and complexities
  testQueries: [
    {
      query: 'How to configure RoboRail automation webhooks?',
      expectedType: 'configuration',
      expectedComplexity: 'intermediate',
      domain: 'automation',
      userIntent: 'Setup webhook configuration'
    },
    {
      query: 'RoboRail API authentication error 401',
      expectedType: 'troubleshooting',
      expectedComplexity: 'intermediate',
      domain: 'api',
      userIntent: 'Fix authentication issues'
    },
    {
      query: 'Step by step RoboRail integration guide',
      expectedType: 'procedural',
      expectedComplexity: 'basic',
      domain: 'integration',
      userIntent: 'Follow integration process'
    },
    {
      query: 'Advanced RoboRail microservices architecture patterns',
      expectedType: 'technical',
      expectedComplexity: 'advanced',
      domain: 'architecture',
      userIntent: 'Understand advanced patterns'
    },
    {
      query: 'Best practices for RoboRail performance optimization',
      expectedType: 'best_practices',
      expectedComplexity: 'intermediate',
      domain: 'performance',
      userIntent: 'Optimize system performance'
    }
  ],

  // Conversation contexts for multi-turn testing
  conversationContexts: [
    {
      history: [
        { role: 'user', content: 'I am setting up RoboRail for the first time', timestamp: Date.now() - 300000 },
        { role: 'assistant', content: 'Great! Let me help you with the initial setup. What specific area do you want to start with?', timestamp: Date.now() - 240000 },
        { role: 'user', content: 'I need to configure the automation system', timestamp: Date.now() - 180000 },
      ],
      followUpQuery: 'How do I test the automation rules?',
      expectedContext: 'automation setup and testing'
    },
    {
      history: [
        { role: 'user', content: 'Having issues with webhook authentication', timestamp: Date.now() - 120000 },
        { role: 'assistant', content: 'Authentication issues can be caused by several factors. Are you getting specific error codes?', timestamp: Date.now() - 60000 },
      ],
      followUpQuery: 'Getting 403 forbidden errors',
      expectedContext: 'webhook authentication troubleshooting'
    }
  ]
};

/**
 * Mock implementation for testing (replace with actual imports in real testing)
 */
class MockPromptOptimizationEngine {
  static async optimizeQuery(query, context, config = {}) {
    const startTime = performance.now();
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
    
    // Mock classification logic
    const queryType = this.classifyQuery(query);
    const complexity = this.determineComplexity(query);
    const expandedQueries = this.generateExpandedQueries(query, context);
    
    const optimizedQuery = `Enhanced ${queryType} query: ${query}`;
    const contextualPrompt = `Contextual search for ${queryType} information about: ${query}`;
    const searchInstructions = `Focus on ${queryType} documentation with ${complexity} complexity`;
    const estimatedRelevance = Math.random() * 0.4 + 0.6; // 0.6 - 1.0
    
    const endTime = performance.now();
    
    return {
      originalQuery: query,
      optimizedQuery,
      expandedQueries,
      contextualPrompt,
      searchInstructions,
      metadata: {
        queryType,
        complexity,
        optimizationStrategy: `${queryType}_${complexity}_optimization`,
        estimatedRelevance,
        processingTime: endTime - startTime
      }
    };
  }

  static classifyQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('error') || lowerQuery.includes('issue') || lowerQuery.includes('problem')) {
      return 'troubleshooting';
    }
    if (lowerQuery.includes('configure') || lowerQuery.includes('setup') || lowerQuery.includes('setting')) {
      return 'configuration';
    }
    if (lowerQuery.includes('step') || lowerQuery.includes('guide') || lowerQuery.includes('tutorial')) {
      return 'procedural';
    }
    if (lowerQuery.includes('api') || lowerQuery.includes('endpoint')) {
      return 'api';
    }
    if (lowerQuery.includes('best practice') || lowerQuery.includes('optimize')) {
      return 'best_practices';
    }
    if (lowerQuery.includes('architecture') || lowerQuery.includes('technical') || lowerQuery.includes('implementation')) {
      return 'technical';
    }
    
    return 'conceptual';
  }

  static determineComplexity(query) {
    const wordCount = query.split(' ').length;
    const technicalTerms = ['microservices', 'architecture', 'authentication', 'optimization', 'integration'].filter(term => 
      query.toLowerCase().includes(term)
    ).length;
    
    if (wordCount > 12 || technicalTerms > 2) return 'advanced';
    if (wordCount > 6 || technicalTerms > 0) return 'intermediate';
    return 'basic';
  }

  static generateExpandedQueries(query, context) {
    const expansions = [query];
    
    // Add RoboRail context
    expansions.push(`RoboRail ${query}`);
    expansions.push(`${query} in RoboRail`);
    
    // Add domain-specific expansions
    if (context?.domain) {
      expansions.push(`${context.domain} ${query}`);
      expansions.push(`${query} ${context.domain}`);
    }
    
    // Add conversation context
    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];
      const contextTerms = this.extractKeyTerms(lastMessage.content);
      if (contextTerms.length > 0) {
        expansions.push(`${query} ${contextTerms[0]}`);
      }
    }
    
    return expansions.slice(0, 6); // Limit expansions
  }

  static extractKeyTerms(text) {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4 && !this.isStopWord(word))
      .slice(0, 3);
  }

  static isStopWord(word) {
    const stopWords = ['with', 'from', 'they', 'have', 'this', 'that', 'were', 'been', 'their', 'said', 'each', 'which'];
    return stopWords.includes(word);
  }
}

/**
 * Mock vector store search for comparison
 */
class MockVectorStoreService {
  static async searchWithOptimization(query, context, useOptimization = true) {
    const startTime = performance.now();
    
    let searchQuery = query;
    let metadata = { optimizationUsed: false };
    
    if (useOptimization) {
      const optimized = await MockPromptOptimizationEngine.optimizeQuery(query, context);
      searchQuery = optimized.optimizedQuery;
      metadata = {
        optimizationUsed: true,
        queryType: optimized.metadata.queryType,
        complexity: optimized.metadata.complexity,
        estimatedRelevance: optimized.metadata.estimatedRelevance,
        expansionCount: optimized.expandedQueries.length
      };
    }
    
    // Simulate search processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Mock results - optimization should improve relevance
    const baseRelevance = Math.random() * 0.4 + 0.4; // 0.4 - 0.8
    const optimizationBoost = useOptimization ? 0.15 : 0;
    const resultsCount = Math.floor(Math.random() * 8) + 2; // 2-10 results
    
    const results = Array.from({ length: resultsCount }, (_, i) => ({
      id: `result_${i}`,
      content: `Mock result ${i} for query: ${searchQuery}`,
      relevance: Math.min(baseRelevance + optimizationBoost + (Math.random() * 0.2 - 0.1), 1.0),
      source: 'openai'
    }));
    
    const endTime = performance.now();
    
    return {
      success: true,
      results,
      searchTime: endTime - startTime,
      metadata
    };
  }
}

/**
 * Performance metrics calculator
 */
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      optimization: {
        totalQueries: 0,
        totalTime: 0,
        averageRelevance: 0,
        averageResultsCount: 0,
        classificationAccuracy: 0
      },
      standard: {
        totalQueries: 0,
        totalTime: 0,
        averageRelevance: 0,
        averageResultsCount: 0
      }
    };
  }

  recordOptimizationTest(result, expected, timeTaken) {
    const metrics = this.metrics.optimization;
    metrics.totalQueries++;
    metrics.totalTime += timeTaken;
    
    if (result.results && result.results.length > 0) {
      const avgRelevance = result.results.reduce((sum, r) => sum + r.relevance, 0) / result.results.length;
      metrics.averageRelevance = ((metrics.averageRelevance * (metrics.totalQueries - 1)) + avgRelevance) / metrics.totalQueries;
      metrics.averageResultsCount = ((metrics.averageResultsCount * (metrics.totalQueries - 1)) + result.results.length) / metrics.totalQueries;
    }
    
    // Check classification accuracy
    if (result.metadata && result.metadata.queryType === expected.expectedType) {
      metrics.classificationAccuracy = ((metrics.classificationAccuracy * (metrics.totalQueries - 1)) + 1) / metrics.totalQueries;
    } else {
      metrics.classificationAccuracy = (metrics.classificationAccuracy * (metrics.totalQueries - 1)) / metrics.totalQueries;
    }
  }

  recordStandardTest(result, timeTaken) {
    const metrics = this.metrics.standard;
    metrics.totalQueries++;
    metrics.totalTime += timeTaken;
    
    if (result.results && result.results.length > 0) {
      const avgRelevance = result.results.reduce((sum, r) => sum + r.relevance, 0) / result.results.length;
      metrics.averageRelevance = ((metrics.averageRelevance * (metrics.totalQueries - 1)) + avgRelevance) / metrics.totalQueries;
      metrics.averageResultsCount = ((metrics.averageResultsCount * (metrics.totalQueries - 1)) + result.results.length) / metrics.totalQueries;
    }
  }

  getComparison() {
    const opt = this.metrics.optimization;
    const std = this.metrics.standard;
    
    return {
      relevanceImprovement: ((opt.averageRelevance - std.averageRelevance) / std.averageRelevance * 100).toFixed(2),
      performanceOverhead: ((opt.totalTime / opt.totalQueries) - (std.totalTime / std.totalQueries)).toFixed(2),
      classificationAccuracy: (opt.classificationAccuracy * 100).toFixed(1),
      optimizedQueries: opt.totalQueries,
      standardQueries: std.totalQueries,
      metrics: {
        optimization: {
          averageTime: (opt.totalTime / opt.totalQueries).toFixed(2),
          averageRelevance: opt.averageRelevance.toFixed(3),
          averageResults: opt.averageResultsCount.toFixed(1)
        },
        standard: {
          averageTime: (std.totalTime / std.totalQueries).toFixed(2),
          averageRelevance: std.averageRelevance.toFixed(3),
          averageResults: std.averageResultsCount.toFixed(1)
        }
      }
    };
  }
}

/**
 * Main test runner
 */
async function runPromptOptimizationBenchmark() {
  console.log('🚀 Starting Prompt Optimization Benchmark');
  console.log('=' .repeat(60));
  
  const metrics = new PerformanceMetrics();
  
  // Test 1: Basic query optimization
  console.log('\n📊 Test 1: Basic Query Optimization');
  console.log('-'.repeat(40));
  
  for (const testCase of TEST_CONFIG.testQueries) {
    console.log(`\nTesting: "${testCase.query}"`);
    
    // Test with optimization
    const startOptimized = performance.now();
    const optimizedResult = await MockVectorStoreService.searchWithOptimization(
      testCase.query,
      { domain: testCase.domain, userIntent: testCase.userIntent },
      true
    );
    const optimizedTime = performance.now() - startOptimized;
    
    // Test without optimization
    const startStandard = performance.now();
    const standardResult = await MockVectorStoreService.searchWithOptimization(
      testCase.query,
      { domain: testCase.domain, userIntent: testCase.userIntent },
      false
    );
    const standardTime = performance.now() - startStandard;
    
    // Record metrics
    metrics.recordOptimizationTest(optimizedResult, testCase, optimizedTime);
    metrics.recordStandardTest(standardResult, standardTime);
    
    // Display results
    console.log(`  Optimized: ${optimizedResult.results.length} results, avg relevance: ${(optimizedResult.results.reduce((s, r) => s + r.relevance, 0) / optimizedResult.results.length).toFixed(3)}, time: ${optimizedTime.toFixed(2)}ms`);
    console.log(`  Standard:  ${standardResult.results.length} results, avg relevance: ${(standardResult.results.reduce((s, r) => s + r.relevance, 0) / standardResult.results.length).toFixed(3)}, time: ${standardTime.toFixed(2)}ms`);
    
    if (optimizedResult.metadata?.queryType) {
      const correct = optimizedResult.metadata.queryType === testCase.expectedType ? '✅' : '❌';
      console.log(`  Classification: ${optimizedResult.metadata.queryType} (expected: ${testCase.expectedType}) ${correct}`);
    }
  }
  
  // Test 2: Conversation context optimization
  console.log('\n📈 Test 2: Conversation Context Optimization');
  console.log('-'.repeat(40));
  
  for (const contextTest of TEST_CONFIG.conversationContexts) {
    console.log(`\nTesting context-aware query: "${contextTest.followUpQuery}"`);
    
    // Test with conversation context
    const contextOptimized = await MockVectorStoreService.searchWithOptimization(
      contextTest.followUpQuery,
      { conversationHistory: contextTest.history },
      true
    );
    
    // Test without conversation context
    const noContextOptimized = await MockVectorStoreService.searchWithOptimization(
      contextTest.followUpQuery,
      {},
      true
    );
    
    console.log(`  With context:    ${contextOptimized.results.length} results, avg relevance: ${(contextOptimized.results.reduce((s, r) => s + r.relevance, 0) / contextOptimized.results.length).toFixed(3)}`);
    console.log(`  Without context: ${noContextOptimized.results.length} results, avg relevance: ${(noContextOptimized.results.reduce((s, r) => s + r.relevance, 0) / noContextOptimized.results.length).toFixed(3)}`);
  }
  
  // Test 3: Query expansion effectiveness
  console.log('\n🔍 Test 3: Query Expansion Analysis');
  console.log('-'.repeat(40));
  
  for (const testCase of TEST_CONFIG.testQueries.slice(0, 3)) {
    const optimized = await MockPromptOptimizationEngine.optimizeQuery(
      testCase.query,
      { domain: testCase.domain }
    );
    
    console.log(`\nOriginal: "${optimized.originalQuery}"`);
    console.log(`Optimized: "${optimized.optimizedQuery}"`);
    console.log(`Expansions (${optimized.expandedQueries.length}):`);
    optimized.expandedQueries.forEach((expansion, i) => {
      console.log(`  ${i + 1}. ${expansion}`);
    });
    console.log(`Estimated relevance: ${optimized.metadata.estimatedRelevance.toFixed(3)}`);
  }
  
  // Final comparison
  console.log('\n📋 Performance Comparison Summary');
  console.log('=' .repeat(60));
  
  const comparison = metrics.getComparison();
  
  console.log(`\n🎯 Relevance Improvement: ${comparison.relevanceImprovement}%`);
  console.log(`⏱️  Performance Overhead: +${comparison.performanceOverhead}ms per query`);
  console.log(`🎪 Classification Accuracy: ${comparison.classificationAccuracy}%`);
  
  console.log('\n📊 Detailed Metrics:');
  console.log(`Optimized Queries:`);
  console.log(`  - Average time: ${comparison.metrics.optimization.averageTime}ms`);
  console.log(`  - Average relevance: ${comparison.metrics.optimization.averageRelevance}`);
  console.log(`  - Average results: ${comparison.metrics.optimization.averageResults}`);
  
  console.log(`Standard Queries:`);
  console.log(`  - Average time: ${comparison.metrics.standard.averageTime}ms`);
  console.log(`  - Average relevance: ${comparison.metrics.standard.averageRelevance}`);
  console.log(`  - Average results: ${comparison.metrics.standard.averageResults}`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  const relevanceImprovementNum = parseFloat(comparison.relevanceImprovement);
  const performanceOverheadNum = parseFloat(comparison.performanceOverhead);
  const classificationAccuracyNum = parseFloat(comparison.classificationAccuracy);
  
  if (relevanceImprovementNum > 10) {
    console.log('✅ Prompt optimization shows significant relevance improvement');
  } else if (relevanceImprovementNum > 5) {
    console.log('⚠️  Prompt optimization shows moderate improvement');
  } else {
    console.log('❌ Prompt optimization may need fine-tuning');
  }
  
  if (performanceOverheadNum < 50) {
    console.log('✅ Performance overhead is acceptable');
  } else if (performanceOverheadNum < 100) {
    console.log('⚠️  Performance overhead is moderate');
  } else {
    console.log('❌ Performance overhead may be too high for real-time use');
  }
  
  if (classificationAccuracyNum > 80) {
    console.log('✅ Query classification is highly accurate');
  } else if (classificationAccuracyNum > 60) {
    console.log('⚠️  Query classification needs improvement');
  } else {
    console.log('❌ Query classification requires significant optimization');
  }
  
  console.log('\n🏁 Benchmark completed successfully!');
  
  return comparison;
}

/**
 * Additional utility functions for production testing
 */
function generateTestReport(results) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    testConfiguration: TEST_CONFIG,
    results,
    summary: {
      totalQueries: results.optimizedQueries + results.standardQueries,
      relevanceImprovement: results.relevanceImprovement,
      performanceOverhead: results.performanceOverhead,
      classificationAccuracy: results.classificationAccuracy
    }
  };
  
  return JSON.stringify(report, null, 2);
}

// Run the benchmark if this script is executed directly
if (require.main === module) {
  runPromptOptimizationBenchmark()
    .then(results => {
      const report = generateTestReport(results);
      console.log('\n📄 Test Report Generated');
      console.log('(In production, this would be saved to a file)');
      
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runPromptOptimizationBenchmark,
  generateTestReport,
  MockPromptOptimizationEngine,
  MockVectorStoreService,
  PerformanceMetrics
};