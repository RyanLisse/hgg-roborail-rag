# Vector Store Monitoring & Observability

This document describes the comprehensive monitoring and observability system implemented for the RRA vector store services.

## Overview

The monitoring system provides real-time observability for:
- **OpenAI Vector Store**: File search operations, health checks, API performance
- **Neon Vector Store**: Embedding generation, similarity search, database connectivity  
- **Unified Vector Store**: Cross-provider search aggregation and performance
- **Memory Vector Store**: In-memory operations and caching

## Features

### 🏥 Health Monitoring
- Real-time health checks for all vector store providers
- Service availability and connectivity monitoring
- Automatic error detection and categorization
- Health status dashboard with visual indicators

### 📊 Performance Metrics
- Search latency tracking (average, P95, P99)
- Success/error rate monitoring
- Token usage tracking for OpenAI operations
- Throughput and request volume analytics

### 🚨 Error Classification & Alerting
Automatic categorization of errors:
- `network_error` - Connection issues
- `authentication_error` - API key problems
- `rate_limit_error` - Rate limiting
- `quota_exceeded` - Usage limits
- `timeout_error` - Request timeouts
- `service_unavailable` - Provider downtime
- `validation_error` - Input validation failures

### 📈 Analytics & Insights
- Query pattern analysis
- Performance trend tracking
- Usage analytics by provider
- Cost estimation for token-based services

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vector Store  │    │   Monitoring     │    │   Dashboard     │
│   Services      │───▶│   System         │───▶│   & API         │
│                 │    │                  │    │                 │
│ • OpenAI        │    │ • Metrics Store  │    │ • Real-time UI  │
│ • Neon          │    │ • Health Checks  │    │ • REST API      │
│ • Unified       │    │ • Alerting       │    │ • Export Tools  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Components

### 1. Monitoring Service (`lib/vectorstore/monitoring.ts`)
Central monitoring service that:
- Collects and stores metrics in memory
- Performs health checks
- Manages alert rules
- Provides performance analytics
- Handles data retention and cleanup

### 2. Performance Decorators
Automatic performance monitoring using the `withPerformanceMonitoring` decorator:
```typescript
searchFiles: withPerformanceMonitoring('openai', 'searchFiles', async function(...) {
  // Your search implementation
})
```

### 3. Monitoring API (`app/(chat)/api/vectorstore/monitoring/route.ts`)
RESTful API for accessing monitoring data:
- `GET ?action=dashboard` - Complete dashboard data
- `GET ?action=health` - Health status for all providers
- `GET ?action=metrics` - Filtered metrics data
- `GET ?action=performance` - Performance analytics
- `POST` - Testing and maintenance operations

### 4. Dashboard UI (`components/vector-store-monitoring.tsx`)
React component providing:
- Real-time health status cards
- Performance metrics visualization
- Error log viewer
- System information panel

## Installation & Setup

### 1. Automatic Initialization
The monitoring system is automatically initialized when the application starts via `instrumentation.ts`:

```typescript
import('./lib/vectorstore/monitoring-init')
  .then(({ initializeVectorStoreMonitoring }) => {
    return initializeVectorStoreMonitoring();
  })
```

### 2. Manual Initialization (if needed)
```typescript
import { initializeVectorStoreMonitoring } from '@/lib/vectorstore/monitoring-init';

await initializeVectorStoreMonitoring();
```

### 3. Configuration
The system uses sensible defaults but can be configured:

```typescript
import { createVectorStoreMonitoringService } from '@/lib/vectorstore/monitoring';

const monitoringService = createVectorStoreMonitoringService({
  enabled: true,
  metricsRetentionDays: 30,
  healthCheckIntervalMs: 60000, // 1 minute
  alertingEnabled: true,
  performanceThresholds: {
    maxLatencyMs: 5000,
    minSuccessRate: 0.95,
    maxErrorRate: 0.05,
  },
});
```

## Usage

### Accessing the Dashboard
Visit `/monitoring` for the complete monitoring dashboard showing:
- Health status of all vector store providers
- Real-time performance metrics
- Recent errors and alerts
- System configuration information

### API Endpoints

#### Health Check
```bash
curl "/api/vectorstore/monitoring?action=health&provider=all"
```

#### Performance Metrics
```bash
curl "/api/vectorstore/monitoring?action=performance&provider=openai&timeWindow=24h"
```

#### Dashboard Data
```bash
curl "/api/vectorstore/monitoring?action=dashboard"
```

#### Test Operations
```bash
curl -X POST "/api/vectorstore/monitoring" \
  -H "Content-Type: application/json" \
  -d '{"action": "test_search", "provider": "openai", "latency": 1500}'
```

### Programmatic Usage

#### Recording Custom Metrics
```typescript
import { getVectorStoreMonitoringService } from '@/lib/vectorstore/monitoring';

const monitoring = getVectorStoreMonitoringService();

// Record search latency
monitoring.recordSearchLatency('openai', 1250, { query: 'user query' });

// Record successful operation
monitoring.recordSearchSuccess('neon', { resultsCount: 5 });

// Record error
monitoring.recordSearchError('unified', new Error('Timeout'), { query: 'failed query' });

// Record token usage
monitoring.recordTokenUsage('openai', 1500, { model: 'gpt-4o-mini' });
```

#### Getting Analytics
```typescript
// Get performance metrics
const performance = monitoring.getPerformanceMetrics('openai', '24h');
console.log(`Success rate: ${(performance.successRate * 100).toFixed(1)}%`);

// Get recent metrics
const recentErrors = monitoring.getMetrics(undefined, 'search_error', '1h');

// Get health status
const healthStatus = monitoring.getHealthStatus('openai');
```

## Testing

### Automated Test
Run the monitoring test suite:
```bash
node scripts/test-monitoring.js
```

This tests:
- Monitoring system initialization
- Metric recording and retrieval
- Performance calculations
- Health status tracking
- Dashboard data generation
- Metric export functionality

### Manual Testing via API
Test search operations:
```bash
curl -X POST "/api/vectorstore/monitoring" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_search",
    "provider": "openai",
    "latency": 2000,
    "success": false
  }'
```

## Production Deployment

### Performance Considerations
- **Memory Usage**: Metrics are stored in memory with configurable limits
- **Cleanup**: Automatic cleanup of old metrics based on retention policy
- **Minimal Overhead**: Performance monitoring adds <5ms overhead per operation

### Scaling Recommendations
For high-volume production environments:
1. **External Storage**: Replace in-memory storage with Redis or PostgreSQL
2. **Metrics Aggregation**: Implement time-series aggregation for long-term storage  
3. **Distributed Monitoring**: Use tools like Prometheus + Grafana for multi-instance deployments
4. **Alert Integration**: Connect to external alerting systems (PagerDuty, Slack, etc.)

### Security Considerations
- Monitor API is accessible to authenticated users only in production
- No sensitive data is exposed in metrics (queries are metadata only)
- Error messages are sanitized to prevent information leakage

## Troubleshooting

### Common Issues

#### Monitoring Not Initializing
Check the application logs for initialization errors:
```bash
# Look for monitoring initialization messages
grep -i "vector store monitoring" logs/application.log
```

#### Missing Metrics
Verify services are enabled:
```typescript
const openaiService = await getOpenAIVectorStoreService();
console.log('OpenAI enabled:', openaiService.isEnabled);
```

#### Health Checks Failing
Check provider-specific configuration:
- OpenAI: Verify `OPENAI_API_KEY` environment variable
- Neon: Verify `POSTGRES_URL` environment variable
- Network: Check connectivity to external services

### Debug Mode
Enable detailed logging:
```typescript
const monitoringService = createVectorStoreMonitoringService({
  enableDetailedLogging: true,
});
```

## Metrics Reference

### Metric Types
- `search_latency` - Time taken for search operations (ms)
- `search_success` - Successful search operations (count)
- `search_error` - Failed search operations (count)
- `token_usage` - Tokens consumed (count)
- `embedding_generation` - Embedding creation operations (count)
- `service_health` - Health check results (0/1)
- `file_upload` - File upload operations (count)
- `cache_hit` / `cache_miss` - Caching effectiveness (count)

### Performance Metrics
- `totalRequests` - Total operations in time window
- `successRate` - Percentage of successful operations
- `averageLatency` - Mean response time
- `p95Latency` - 95th percentile response time
- `p99Latency` - 99th percentile response time
- `errorRate` - Percentage of failed operations
- `tokensUsed` - Total tokens consumed (OpenAI only)

## Future Enhancements

- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates
- [ ] Advanced alerting rules engine
- [ ] Cost tracking and optimization recommendations
- [ ] Query performance insights and suggestions
- [ ] A/B testing framework for vector store providers
- [ ] Automatic performance tuning recommendations

## Support

For issues or questions about the monitoring system:
1. Check the troubleshooting section above
2. Review application logs for error messages
3. Test with the provided test script
4. Verify provider configurations and API keys

The monitoring system is designed to be self-healing and will continue operating even if individual providers experience issues.