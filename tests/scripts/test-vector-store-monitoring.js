#!/usr/bin/env node

/**
 * Integration test for vector store monitoring system
 * Tests the complete monitoring pipeline with real vector store operations
 */

import { fileURLToPath } from 'node:url';
import { dirname, } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up environment for testing
process.env.NODE_ENV = 'development';

async function testVectorStoreMonitoring() {
  console.log('🧪 Testing Vector Store Monitoring Integration...\n');

  try {
    // Import required modules
    const { getVectorStoreMonitoringService } = await import('./lib/vectorstore/monitoring.js');
    const { getOpenAIVectorStoreService } = await import('./lib/vectorstore/openai.js');
    const { getNeonVectorStoreService } = await import('./lib/vectorstore/neon.js');
    const { getUnifiedVectorStoreService } = await import('./lib/vectorstore/unified.js');
    const { initializeVectorStoreMonitoring } = await import('./lib/vectorstore/monitoring-init.js');

    console.log('1. Initializing services...');
    
    // Initialize monitoring
    await initializeVectorStoreMonitoring();
    
    // Get services
    const monitoring = getVectorStoreMonitoringService();
    const openaiService = await getOpenAIVectorStoreService();
    const neonService = await getNeonVectorStoreService();
    const unifiedService = await getUnifiedVectorStoreService();
    
    console.log('✅ Services initialized');
    console.log(`   - OpenAI: ${openaiService.isEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Neon: ${neonService.isEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Unified: Available`);
    console.log('');

    // Test health checks
    console.log('2. Testing health checks...');
    
    if (openaiService.isEnabled) {
      console.log('   Testing OpenAI health check...');
      const openaiHealth = await openaiService.healthCheck();
      console.log(`   OpenAI Health: ${openaiHealth.isHealthy ? '✅' : '❌'} ${openaiHealth.error || ''}`);
    }
    
    if (neonService.isEnabled) {
      console.log('   Testing Neon health check...');
      try {
        await neonService.initializeExtensions();
        console.log('   Neon Health: ✅ Database connected');
      } catch (error) {
        console.log(`   Neon Health: ❌ ${error.message}`);
      }
    }
    
    console.log('');

    // Test metric recording with simulated operations
    console.log('3. Testing metric recording...');
    
    // Simulate various operations
    const testScenarios = [
      { provider: 'openai', latency: 1200, success: true, operation: 'file_search' },
      { provider: 'neon', latency: 800, success: true, operation: 'similarity_search' },
      { provider: 'unified', latency: 2000, success: true, operation: 'cross_provider_search' },
      { provider: 'openai', latency: 5000, success: false, operation: 'timeout_search' },
      { provider: 'neon', latency: 600, success: true, operation: 'embedding_generation' },
    ];

    for (const scenario of testScenarios) {
      if (scenario.success) {
        monitoring.recordSearchLatency(scenario.provider, scenario.latency, {
          operation: scenario.operation,
          test: true
        });
        monitoring.recordSearchSuccess(scenario.provider, {
          operation: scenario.operation,
          test: true
        });
      } else {
        monitoring.recordSearchError(scenario.provider, new Error('Simulated timeout'), {
          operation: scenario.operation,
          test: true
        });
      }
    }

    // Record some token usage
    monitoring.recordTokenUsage('openai', 1500, { model: 'gpt-4o-mini', test: true });
    monitoring.recordTokenUsage('openai', 800, { model: 'text-embedding-3-small', test: true });

    console.log('✅ Test metrics recorded');
    console.log('');

    // Test performance analytics
    console.log('4. Testing performance analytics...');
    
    const providers = ['openai', 'neon', 'unified'];
    for (const provider of providers) {
      const performance = monitoring.getPerformanceMetrics(provider, '1h');
      console.log(`📊 ${provider.toUpperCase()} Performance:`);
      console.log(`   - Requests: ${performance.totalRequests}`);
      console.log(`   - Success Rate: ${(performance.successRate * 100).toFixed(1)}%`);
      console.log(`   - Avg Latency: ${Math.round(performance.averageLatency)}ms`);
      console.log(`   - Error Rate: ${(performance.errorRate * 100).toFixed(1)}%`);
      
      if (performance.tokensUsed) {
        console.log(`   - Tokens Used: ${performance.tokensUsed}`);
      }
      console.log('');
    }

    // Test dashboard data generation
    console.log('5. Testing dashboard data...');
    
    const dashboardData = await monitoring.getDashboardData();
    console.log('📱 Dashboard Data Generated:');
    console.log(`   - Overview: ${Object.keys(dashboardData.overview).length} providers`);
    console.log(`   - Health Status: ${dashboardData.healthStatus.length} services`);
    console.log(`   - Recent Errors: ${dashboardData.recentErrors.length} errors`);
    console.log(`   - Alerts: ${dashboardData.alerts.length} alert rules`);
    console.log('');

    // Test error classification
    console.log('6. Testing error classification...');
    
    const errorTypes = [
      new Error('Connection timeout'),
      new Error('Rate limit exceeded'),
      new Error('Invalid API key'),
      new Error('Service unavailable'),
      new Error('Quota exceeded'),
    ];

    errorTypes.forEach((error, index) => {
      monitoring.recordSearchError('openai', error, { testError: index + 1 });
    });

    const recentErrors = monitoring.getMetrics(undefined, 'search_error', '1h');
    const errorsByCategory = recentErrors.reduce((acc, error) => {
      const category = error.errorCategory || 'unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    console.log('🏷️  Error Categories:');
    Object.entries(errorsByCategory).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count} errors`);
    });
    console.log('');

    // Test real vector store operations if enabled
    if (openaiService.isEnabled) {
      console.log('7. Testing real OpenAI vector store operations...');
      
      try {
        // Test listing vector stores
        const vectorStores = await openaiService.listVectorStores();
        console.log(`   ✅ Listed ${vectorStores.length} vector stores`);
        
        if (openaiService.defaultVectorStoreId) {
          // Test search if default vector store is configured
          const searchResult = await openaiService.searchFiles({
            query: 'test search query',
            maxResults: 3,
          });
          
          console.log(`   ✅ Search completed: ${searchResult.success ? 'Success' : 'Failed'}`);
          console.log(`   📊 Results: ${searchResult.results.length} found in ${searchResult.executionTime}ms`);
        }
      } catch (error) {
        console.log(`   ⚠️ OpenAI operations failed: ${error.message}`);
      }
      console.log('');
    }

    if (neonService.isEnabled) {
      console.log('8. Testing real Neon vector store operations...');
      
      try {
        // Test embedding generation
        const embedding = await neonService.generateEmbedding('test text for embedding');
        console.log(`   ✅ Generated embedding: ${embedding.length} dimensions`);
        
        // Test document addition (if database is available)
        const testDoc = await neonService.addDocument({
          content: 'This is a test document for monitoring',
          metadata: { test: true, timestamp: new Date().toISOString() }
        });
        console.log(`   ✅ Added test document: ${testDoc.id}`);
        
        // Clean up test document
        await neonService.deleteDocument(testDoc.id);
        console.log(`   🧹 Cleaned up test document`);
        
      } catch (error) {
        console.log(`   ⚠️ Neon operations failed: ${error.message}`);
      }
      console.log('');
    }

    // Show final metrics summary
    console.log('9. Final metrics summary...');
    
    const finalMetrics = monitoring.getMetrics(undefined, undefined, '1h');
    const metricsByType = finalMetrics.reduce((acc, metric) => {
      acc[metric.metricType] = (acc[metric.metricType] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 Metrics Collected:');
    Object.entries(metricsByType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} events`);
    });
    console.log('');

    // Test cleanup
    console.log('10. Testing cleanup...');
    
    const beforeCleanup = monitoring.getMetrics().length;
    monitoring.cleanup();
    const afterCleanup = monitoring.getMetrics().length;
    
    console.log(`   📊 Metrics before cleanup: ${beforeCleanup}`);
    console.log(`   📊 Metrics after cleanup: ${afterCleanup}`);
    console.log('');

    console.log('🎉 Vector Store Monitoring Integration Test Completed Successfully!');
    console.log('');
    console.log('🔗 Next Steps:');
    console.log('   1. Start your development server');
    console.log('   2. Visit /monitoring to see the dashboard');
    console.log('   3. Use the API endpoints to access monitoring data');
    console.log('   4. Monitor real vector store operations in your application');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Ensure environment variables are set correctly');
    console.error('   2. Check database connectivity for Neon vector store');
    console.error('   3. Verify OpenAI API key if using OpenAI vector store');
    console.error('   4. Review the monitoring documentation in VECTOR_STORE_MONITORING.md');
    process.exit(1);
  }
}

// Run the integration test
testVectorStoreMonitoring()
  .then(() => {
    console.log('\n✅ Integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  });