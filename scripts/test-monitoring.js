#!/usr/bin/env node

/**
 * Test script for vector store monitoring system
 * Run with: node scripts/test-monitoring.js
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Add the project root to the module path
process.env.NODE_PATH = join(__dirname, '..');
require('node:module').Module._initPaths();

async function testMonitoring() {
  console.log('🧪 Testing Vector Store Monitoring System...\n');

  try {
    // Import monitoring services
    const { getVectorStoreMonitoringService } = await import('../lib/vectorstore/monitoring.js');
    const { initializeVectorStoreMonitoring } = await import('../lib/vectorstore/monitoring-init.js');

    // Initialize monitoring
    console.log('1. Initializing monitoring system...');
    await initializeVectorStoreMonitoring();
    console.log('✅ Monitoring system initialized\n');

    // Get monitoring service
    const monitoringService = getVectorStoreMonitoringService();

    // Test basic metric recording
    console.log('2. Testing metric recording...');
    
    // Record some test search metrics
    monitoringService.recordSearchLatency('openai', 1250, { test: true });
    monitoringService.recordSearchLatency('neon', 890, { test: true });
    monitoringService.recordSearchLatency('unified', 2100, { test: true });

    monitoringService.recordSearchSuccess('openai', { query: 'test query 1' });
    monitoringService.recordSearchSuccess('neon', { query: 'test query 2' });
    
    monitoringService.recordSearchError('openai', new Error('Test API timeout'), { query: 'failing query' });
    
    monitoringService.recordTokenUsage('openai', 1500, { model: 'gpt-4o-mini' });
    
    console.log('✅ Test metrics recorded\n');

    // Test metrics retrieval
    console.log('3. Testing metrics retrieval...');
    
    const recentMetrics = monitoringService.getMetrics(undefined, undefined, '1h');
    console.log(`📊 Found ${recentMetrics.length} metrics in the last hour`);
    
    const openaiMetrics = monitoringService.getMetrics('openai', undefined, '1h');
    console.log(`📊 Found ${openaiMetrics.length} OpenAI metrics`);

    // Test performance metrics calculation
    console.log('\n4. Testing performance metrics...');
    
    const openaiPerf = monitoringService.getPerformanceMetrics('openai', '24h');
    console.log('📈 OpenAI Performance:', {
      totalRequests: openaiPerf.totalRequests,
      successRate: `${(openaiPerf.successRate * 100).toFixed(1)}%`,
      averageLatency: `${Math.round(openaiPerf.averageLatency)}ms`,
      errorRate: `${(openaiPerf.errorRate * 100).toFixed(1)}%`,
    });

    const neonPerf = monitoringService.getPerformanceMetrics('neon', '24h');
    console.log('📈 Neon Performance:', {
      totalRequests: neonPerf.totalRequests,
      successRate: `${(neonPerf.successRate * 100).toFixed(1)}%`,
      averageLatency: `${Math.round(neonPerf.averageLatency)}ms`,
      errorRate: `${(neonPerf.errorRate * 100).toFixed(1)}%`,
    });

    // Test dashboard data
    console.log('\n5. Testing dashboard data...');
    
    const dashboardData = await monitoringService.getDashboardData();
    console.log('📱 Dashboard Data:');
    console.log(`   - Providers: ${Object.keys(dashboardData.overview).join(', ')}`);
    console.log(`   - Health Status: ${dashboardData.healthStatus.length} services`);
    console.log(`   - Recent Errors: ${dashboardData.recentErrors.length} errors`);
    console.log(`   - Active Alerts: ${dashboardData.alerts.length} alerts`);

    // Test health status
    console.log('\n6. Testing health status...');
    
    const healthStatuses = monitoringService.getHealthStatus();
    healthStatuses.forEach(status => {
      console.log(`🏥 ${status.provider}: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      if (status.errorMessage) {
        console.log(`   Error: ${status.errorMessage}`);
      }
    });

    // Test metric export
    console.log('\n7. Testing metric export...');
    
    const exportedMetrics = await monitoringService.exportMetrics('1h');
    console.log(`📤 Exported ${exportedMetrics.length} metrics from last hour`);

    // Show sample metrics for verification
    if (exportedMetrics.length > 0) {
      console.log('\n📋 Sample exported metrics:');
      exportedMetrics.slice(0, 3).forEach((metric, index) => {
        console.log(`   ${index + 1}. ${metric.provider}/${metric.metricType}: ${metric.value}${metric.unit} ${metric.success ? '✅' : '❌'}`);
      });
    }

    console.log('\n🎉 All monitoring tests completed successfully!');
    
    // Show monitoring API endpoints
    console.log('\n🔗 Available monitoring endpoints:');
    console.log('   GET /api/vectorstore/monitoring?action=dashboard');
    console.log('   GET /api/vectorstore/monitoring?action=health&provider=all');
    console.log('   GET /api/vectorstore/monitoring?action=metrics&timeWindow=24h');
    console.log('   GET /api/vectorstore/monitoring?action=performance&provider=openai');
    console.log('   POST /api/vectorstore/monitoring (for testing)');
    console.log('\n🖥️  Dashboard available at: /monitoring');

  } catch (error) {
    console.error('❌ Monitoring test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMonitoring()
  .then(() => {
    console.log('\n✅ Monitoring test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });