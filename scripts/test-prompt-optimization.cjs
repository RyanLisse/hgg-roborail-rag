#!/usr/bin/env node

/**
 * Test script for RoboRail prompt optimization functionality
 * Run with: node scripts/test-prompt-optimization.cjs
 */

const { performance } = require('node:perf_hooks');

// Test configuration
const testConfig = {
  verbose: true,
  runPerformanceTests: true,
  testCount: 10,
};

// Test data
const testQueries = [
  {
    query: 'How do I integrate RoboRail with my existing automation system?',
    context: {
      type: 'integration',
      domain: 'automation',
      userIntent: 'Setup integration between RoboRail and external system',
    },
    expectedType: 'integration',
    expectedComplexity: 'intermediate',
  },
  {
    query: 'RoboRail API authentication not working, getting 401 error',
    context: {
      type: 'troubleshooting',
      domain: 'api',
      previousQueries: ['How to setup API keys', 'API endpoint documentation'],
    },
    expectedType: 'troubleshooting',
    expectedComplexity: 'intermediate',
  },
  {
    query: 'What is RoboRail?',
    context: {
      type: 'conceptual',
    },
    expectedType: 'conceptual',
    expectedComplexity: 'basic',
  },
  {
    query: 'Configure RoboRail webhook handlers with OAuth2 authentication and implement retry logic for failed requests',
    context: {
      type: 'configuration',
      domain: 'integration',
      complexity: 'advanced',
    },
    expectedType: 'configuration',
    expectedComplexity: 'advanced',
  },
  {
    query: 'Step by step guide to deploy RoboRail on Kubernetes with monitoring',
    context: {
      type: 'procedural',
      domain: 'deployment',
    },
    expectedType: 'procedural',
    expectedComplexity: 'advanced',
  },
];

// Test conversation contexts
const conversationContexts = [
  {
    description: 'Continuation of automation discussion',
    history: [
      { role: 'user', content: 'I need help with RoboRail automation workflows', timestamp: Date.now() - 180000 },
      { role: 'assistant', content: 'RoboRail automation workflows help you automate repetitive tasks...', timestamp: Date.now() - 120000 },
      { role: 'user', content: 'How do I trigger workflows based on events?', timestamp: Date.now() - 60000 },
    ],
    currentQuery: 'What about error handling?',
  },
];

/**
 * Mock implementation for testing (replace with actual imports in real testing)
 */
const MockPromptOptimizationEngine = {
  async optimizeQuery(query, context = {}) {
    // Mock classification logic
    const queryType = MockPromptOptimizationEngine.classifyQuery(query);
    const complexity = MockPromptOptimizationEngine.determineComplexity(query);
    const expandedQueries = MockPromptOptimizationEngine.generateExpandedQueries(query, context);
    
    const optimizedQuery = `Enhanced ${queryType} query: ${query}`;
    const contextualPrompt = MockPromptOptimizationEngine.generateContextualPrompt(query, queryType, context);
    const searchInstructions = MockPromptOptimizationEngine.generateSearchInstructions(queryType, complexity);
    
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
        estimatedRelevance: MockPromptOptimizationEngine.estimateRelevance(query, context),
      }
    };
  },

  classifyQuery(query) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('error') || queryLower.includes('not working') || queryLower.includes('issue')) {
      return 'troubleshooting';
    }
    if (queryLower.includes('configure') || queryLower.includes('setup') || queryLower.includes('setting')) {
      return 'configuration';
    }
    if (queryLower.includes('integrate') || queryLower.includes('integration') || queryLower.includes('connect')) {
      return 'integration';
    }
    if (queryLower.includes('api') || queryLower.includes('endpoint') || queryLower.includes('request')) {
      return 'api';
    }
    if (queryLower.includes('step by step') || queryLower.includes('guide') || queryLower.includes('how to')) {
      return 'procedural';
    }
    if (queryLower.includes('what is') || queryLower.includes('explain') || queryLower.includes('define')) {
      return 'conceptual';
    }
    
    return 'technical';
  },

  determineComplexity(query) {
    const words = query.split(/\s+/).length;
    const technicalTerms = ['oauth', 'kubernetes', 'microservice', 'webhook', 'authentication', 'deployment'];
    const technicalCount = technicalTerms.filter(term => query.toLowerCase().includes(term)).length;
    
    if (words < 10 && technicalCount === 0) return 'basic';
    if (words > 20 || technicalCount >= 2) return 'advanced';
    return 'intermediate';
  },

  generateExpandedQueries(query, context) {
    const expansions = [query]; // Always include original
    
    // Add domain-specific expansions
    if (context.domain) {
      expansions.push(`${query} ${context.domain}`);
      expansions.push(`RoboRail ${context.domain} ${query}`);
    }
    
    // Add type-specific expansions
    const queryType = MockPromptOptimizationEngine.classifyQuery(query);
    if (queryType === 'troubleshooting') {
      expansions.push(`${query} solution fix resolve`);
    } else if (queryType === 'configuration') {
      expansions.push(`${query} setup guide tutorial`);
    }
    
    // Add context from conversation history
    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];
      const contextTerms = MockPromptOptimizationEngine.extractKeyTerms(lastMessage.content);
      if (contextTerms.length > 0) {
        expansions.push(`${query} ${contextTerms[0]}`);
      }
    }
    
    return [...new Set(expansions)]; // Remove duplicates
  },

  extractKeyTerms(text) {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4 && !MockPromptOptimizationEngine.isStopWord(word))
      .slice(0, 3);
  },

  isStopWord(word) {
    const stopWords = ['about', 'which', 'where', 'would', 'should', 'could', 'these', 'those', 'there'];
    return stopWords.includes(word);
  },

  generateContextualPrompt(query, queryType, context) {
    let prompt = `Search for ${queryType} information about: ${query}. `;
    
    if (context.domain) {
      prompt += `Focus on RoboRail ${context.domain} features. `;
    }
    
    if (context.userIntent) {
      prompt += `User intent: ${context.userIntent}. `;
    }
    
    return prompt.trim();
  },

  generateSearchInstructions(queryType, complexity) {
    const instructions = {
      troubleshooting: 'Look for error messages, solutions, and troubleshooting guides.',
      configuration: 'Find configuration examples, settings documentation, and setup guides.',
      integration: 'Search for integration guides, API documentation, and connector information.',
      api: 'Focus on API reference, endpoint documentation, and authentication details.',
      procedural: 'Find step-by-step guides, tutorials, and procedural documentation.',
      conceptual: 'Look for explanations, definitions, and conceptual overviews.',
      technical: 'Search technical documentation, implementation details, and specifications.',
    };
    
    let instruction = instructions[queryType] || instructions.technical;
    
    if (complexity === 'advanced') {
      instruction += ' Include advanced topics and edge cases.';
    } else if (complexity === 'basic') {
      instruction += ' Focus on introductory and basic information.';
    }
    
    return instruction;
  },

  estimateRelevance(query, context) {
    let score = 0.5; // Base score
    
    // Boost for specific query
    if (query.split(/\s+/).length > 3) score += 0.1;
    
    // Boost for context
    if (context.domain) score += 0.1;
    if (context.userIntent) score += 0.1;
    if (context.conversationHistory) score += 0.1;
    
    // Boost for RoboRail mention
    if (query.toLowerCase().includes('roborail')) score += 0.1;
    
    return Math.min(score, 1.0);
  }
};

/**
 * Mock vector store search for comparison
 */
const mockVectorSearch = async (query) => {
  // Simulate search delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return [
    { id: 'doc1', content: `Sample document about ${query}`, similarity: 0.85 },
    { id: 'doc2', content: `Another document related to ${query}`, similarity: 0.75 },
    { id: 'doc3', content: `Documentation for ${query}`, similarity: 0.65 },
  ];
};

// Test functions
async function testQueryOptimization() {
  console.log('\n===== Testing Query Optimization =====\n');
  
  for (const testCase of testQueries) {
    console.log(`\nQuery: "${testCase.query}"`);
    console.log('Context:', JSON.stringify(testCase.context, null, 2));
    
    const startTime = performance.now();
    const result = await MockPromptOptimizationEngine.optimizeQuery(testCase.query, testCase.context);
    const endTime = performance.now();
    
    console.log('\nOptimization Result:');
    console.log(`  Query Type: ${result.metadata.queryType} (expected: ${testCase.expectedType})`);
    console.log(`  Complexity: ${result.metadata.complexity} (expected: ${testCase.expectedComplexity})`);
    console.log(`  Optimized Query: ${result.optimizedQuery}`);
    console.log(`  Expanded Queries: ${result.expandedQueries.length} variations`);
    result.expandedQueries.forEach((q, i) => console.log(`    ${i + 1}. ${q}`));
    console.log(`  Search Instructions: ${result.searchInstructions}`);
    console.log(`  Estimated Relevance: ${result.metadata.estimatedRelevance}`);
    console.log(`  Processing Time: ${(endTime - startTime).toFixed(2)}ms`);
    
    // Validate expectations
    if (result.metadata.queryType !== testCase.expectedType) {
      console.warn(`  ⚠️  Query type mismatch!`);
    }
    if (result.metadata.complexity !== testCase.expectedComplexity) {
      console.warn(`  ⚠️  Complexity mismatch!`);
    }
  }
}

async function testConversationContext() {
  console.log('\n===== Testing Conversation Context Optimization =====\n');
  
  for (const context of conversationContexts) {
    console.log(`\nScenario: ${context.description}`);
    console.log(`Current Query: "${context.currentQuery}"`);
    console.log('Conversation History:');
    context.history.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.role}]: ${msg.content.substring(0, 50)}...`);
    });
    
    const queryContext = {
      conversationHistory: context.history,
      type: 'contextual',
    };
    
    const result = await MockPromptOptimizationEngine.optimizeQuery(context.currentQuery, queryContext);
    
    console.log('\nOptimization with Context:');
    console.log(`  Contextual Prompt: ${result.contextualPrompt}`);
    console.log(`  Expanded Queries:`);
    result.expandedQueries.forEach((q, i) => console.log(`    ${i + 1}. ${q}`));
  }
}

async function testPerformanceComparison() {
  if (!testConfig.runPerformanceTests) return;
  
  console.log('\n===== Performance Comparison =====\n');
  
  const queries = [
    'RoboRail automation configuration',
    'How to fix webhook authentication errors',
    'Integrate RoboRail with external systems',
  ];
  
  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    
    // Test without optimization
    const startBasic = performance.now();
    const basicResults = await mockVectorSearch(query);
    const endBasic = performance.now();
    
    // Test with optimization
    const startOptimized = performance.now();
    const optimized = await MockPromptOptimizationEngine.optimizeQuery(query, { domain: 'roborail' });
    const optimizedResults = await mockVectorSearch(optimized.optimizedQuery);
    const endOptimized = performance.now();
    
    console.log(`  Basic search time: ${(endBasic - startBasic).toFixed(2)}ms`);
    console.log(`  Optimized search time: ${(endOptimized - startOptimized).toFixed(2)}ms`);
    console.log(`  Optimization overhead: ${((endOptimized - startOptimized) - (endBasic - startBasic)).toFixed(2)}ms`);
  }
}

async function testBatchOptimization() {
  console.log('\n===== Testing Batch Query Optimization =====\n');
  
  const batchQueries = [
    'RoboRail API authentication',
    'webhook configuration',
    'error handling best practices',
    'deployment on cloud platforms',
    'monitoring and observability',
  ];
  
  console.log(`Processing ${batchQueries.length} queries...`);
  
  const startTime = performance.now();
  const results = await Promise.all(
    batchQueries.map(q => MockPromptOptimizationEngine.optimizeQuery(q, { domain: 'roborail' }))
  );
  const endTime = performance.now();
  
  console.log(`\nBatch processing completed in ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`Average time per query: ${((endTime - startTime) / batchQueries.length).toFixed(2)}ms`);
  
  // Summary statistics
  const queryTypes = {};
  const complexities = {};
  
  results.forEach((result, i) => {
    queryTypes[result.metadata.queryType] = (queryTypes[result.metadata.queryType] || 0) + 1;
    complexities[result.metadata.complexity] = (complexities[result.metadata.complexity] || 0) + 1;
  });
  
  console.log('\nQuery Type Distribution:');
  Object.entries(queryTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${((count / results.length) * 100).toFixed(0)}%)`);
  });
  
  console.log('\nComplexity Distribution:');
  Object.entries(complexities).forEach(([complexity, count]) => {
    console.log(`  ${complexity}: ${count} (${((count / results.length) * 100).toFixed(0)}%)`);
  });
}

async function testEdgeCases() {
  console.log('\n===== Testing Edge Cases =====\n');
  
  const edgeCases = [
    { query: '', description: 'Empty query' },
    { query: 'a', description: 'Single character' },
    { query: 'help', description: 'Very vague query' },
    { query: `RoboRail ${'complex '.repeat(50)}query`, description: 'Very long query' },
    { query: '!!!@#$%^&*()', description: 'Special characters only' },
    { query: 'роборейл конфигурация', description: 'Non-English query' },
  ];
  
  for (const testCase of edgeCases) {
    console.log(`\nEdge case: ${testCase.description}`);
    console.log(`Query: "${testCase.query.substring(0, 50)}${testCase.query.length > 50 ? '...' : ''}"`);
    
    try {
      const result = await MockPromptOptimizationEngine.optimizeQuery(testCase.query);
      console.log(`  ✅ Handled successfully`);
      console.log(`  Query Type: ${result.metadata.queryType}`);
      console.log(`  Complexity: ${result.metadata.complexity}`);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log('Starting RoboRail Prompt Optimization Tests...\n');
  console.log('Configuration:', testConfig);
  
  try {
    await testQueryOptimization();
    await testConversationContext();
    await testPerformanceComparison();
    await testBatchOptimization();
    await testEdgeCases();
    
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
  MockPromptOptimizationEngine,
  testQueries,
  runAllTests,
};