# Multi-Agent Orchestration System

A comprehensive multi-agent AI system that intelligently routes queries to specialized agents for optimal response quality and efficiency.

## Overview

The agent system consists of four specialized agents, each optimized for different types of tasks:

- **QA Agent**: Standard RAG for question answering
- **Rewrite Agent**: Text rephrasing, summarization, and optimization
- **Planner Agent**: Breaking complex queries into sub-questions and plans
- **Research Agent**: Deep research with enhanced search and citations

## Architecture

```
Query → Router → Agent Selection → Processing → Response
         ↓
    Intent Classification
    Complexity Analysis
    Source Selection
```

## Quick Start

### Basic Usage

```typescript
import { processQuery } from '@/lib/agents';

// Simple query processing
const response = await processQuery('What is machine learning?');
console.log(response.content);
```

### Streaming Responses

```typescript
import { processQueryStream } from '@/lib/agents';

// Stream response chunks
for await (const chunk of processQueryStream('Explain neural networks')) {
  if (typeof chunk === 'string') {
    process.stdout.write(chunk);
  }
}
```

### Using Specific Agents

```typescript
import { useAgent } from '@/lib/agents';

// Force use of a specific agent
const planResponse = await useAgent('planner', 'How do I learn data science?');
const researchResponse = await useAgent('research', 'Latest AI developments');
```

## Agent Types

### QA Agent (`qa`)
- **Purpose**: Direct question answering using RAG
- **Best for**: Factual questions, knowledge retrieval
- **Features**: Source attribution, context-aware responses
- **Temperature**: 0.1 (precise)

```typescript
// Automatically selected for questions like:
"What is the capital of France?"
"How does photosynthesis work?"
"Define artificial intelligence"
```

### Rewrite Agent (`rewrite`)
- **Purpose**: Text transformation and optimization
- **Best for**: Summarization, rephrasing, style changes
- **Features**: Content restructuring, tone adjustment
- **Temperature**: 0.3 (creative)

```typescript
// Automatically selected for queries like:
"Summarize this article"
"Rewrite this to be more professional"
"Make this text clearer"
```

### Planner Agent (`planner`)
- **Purpose**: Breaking down complex tasks
- **Best for**: Step-by-step plans, task decomposition
- **Features**: Sub-question generation, dependency mapping
- **Temperature**: 0.2 (structured)

```typescript
// Automatically selected for queries like:
"Create a plan to learn Python"
"What steps are needed to start a business?"
"How do I prepare for a job interview?"
```

### Research Agent (`research`)
- **Purpose**: Comprehensive information gathering
- **Best for**: In-depth analysis, multi-source research
- **Features**: Citation management, source evaluation
- **Temperature**: 0.1 (factual)

```typescript
// Automatically selected for queries like:
"Research the latest developments in quantum computing"
"Analyze the economic impact of AI"
"Comprehensive review of renewable energy technologies"
```

## Router Intelligence

The system uses intelligent routing based on:

### Intent Classification
- **question_answering**: Direct factual queries
- **summarization**: Content condensation requests
- **rewriting**: Text transformation needs
- **planning**: Task breakdown requirements
- **research**: Comprehensive investigation
- **comparison**: Multi-option analysis
- **analysis**: Deep evaluation tasks
- **general_chat**: Casual conversation

### Complexity Analysis
- **Simple**: Direct questions, minimal context
- **Moderate**: Multi-part questions, some complexity
- **Complex**: Multi-step problems, synthesis required

### Source Selection
- **OpenAI Vector Store**: Prioritized for documentation
- **Neon Database**: Structured data storage
- **Memory**: In-session context

## Configuration

### Global Configuration

```typescript
import { createAgentOrchestrator } from '@/lib/agents';

const orchestrator = createAgentOrchestrator({
  defaultModel: 'anthropic-claude-sonnet-4-20250514',
  fallbackModel: 'openai-gpt-4.1-mini',
  timeout: 30000,
  maxRetries: 2,
  enableTelemetry: true,
  vectorStoreConfig: {
    defaultSources: ['openai', 'neon'],
    searchThreshold: 0.3,
    maxResults: 10,
  },
});
```

### Request Options

```typescript
const response = await processQuery('Your query', {
  chatHistory: [
    { role: 'user', content: 'Previous message' },
    { role: 'assistant', content: 'Previous response' }
  ],
  sources: ['openai', 'neon'],
  modelId: 'anthropic-claude-sonnet-4-20250514',
  streaming: true,
});
```

## Advanced Features

### Agent Orchestration

```typescript
import { getAgentOrchestrator } from '@/lib/agents';

const orchestrator = getAgentOrchestrator();

// Custom request processing
const response = await orchestrator.processRequest({
  query: 'Complex multi-part question',
  context: {
    complexity: 'complex',
    sources: ['openai', 'neon'],
    requiresCitations: true,
    maxResults: 10,
  },
  options: {
    modelId: 'anthropic-claude-sonnet-4-20250514',
    streaming: true,
    maxTokens: 2000,
    temperature: 0.1,
  },
});
```

### Routing Analysis

```typescript
import { getRoutingDecision, classifyIntent, analyzeComplexity } from '@/lib/agents';

// Get routing decision without processing
const decision = await getRoutingDecision('Your query');
console.log(`Selected: ${decision.selectedAgent}`);
console.log(`Confidence: ${decision.confidence}`);
console.log(`Reasoning: ${decision.reasoning}`);

// Analyze components separately
const intent = await classifyIntent('Your query');
const complexity = await analyzeComplexity('Your query');
```

### System Health

```typescript
import { getSystemHealth, getAgentCapabilities } from '@/lib/agents';

// Check system status
const health = await getSystemHealth();
console.log(`Status: ${health.status}`);

// Get agent capabilities
const capabilities = getAgentCapabilities();
console.log(capabilities);
```

## Error Handling

The system includes comprehensive error handling:

### Automatic Fallbacks
- Primary agent failure → Fallback agent
- Streaming failure → Non-streaming fallback
- Timeout → Retry with exponential backoff

### Error Response Structure
```typescript
{
  content: "Error message for user",
  agent: "qa",
  metadata: { /* ... */ },
  streamingSupported: false,
  errorDetails: {
    code: "processing_error",
    message: "Detailed error description",
    retryable: true
  }
}
```

## Performance Optimization

### Caching
- Router decisions cached for similar queries
- Agent instances reused across requests
- Vector store results cached temporarily

### Resource Management
- Configurable timeouts and retries
- Memory-efficient streaming
- Connection pooling for external services

### Monitoring
- Request/response telemetry
- Agent performance metrics
- Error rate tracking

## Best Practices

### Query Optimization
```typescript
// Good: Specific, clear intent
"Summarize the key points from this research paper"

// Avoid: Vague, multi-intent
"Tell me about this paper and also explain quantum physics"
```

### Context Management
```typescript
// Provide relevant context
const response = await processQuery('How do I implement this?', {
  chatHistory: conversationHistory,
  sources: ['openai'], // Relevant knowledge base
});
```

### Error Handling
```typescript
try {
  const response = await processQuery(userQuery);
  if (response.errorDetails) {
    // Handle graceful errors
    console.warn('Agent warning:', response.errorDetails.message);
  }
  return response.content;
} catch (error) {
  // Handle unexpected errors
  console.error('System error:', error);
  return 'I apologize, but I encountered an error. Please try again.';
}
```

## Testing

The system includes comprehensive tests:

```bash
# Run agent system tests
npm test lib/agents/agents.test.ts

# Test specific functionality
npm test -- --grep "Router Functionality"
```

## Extension

### Adding New Agents

1. Create agent class extending `BaseAgent`
2. Implement required methods
3. Add to orchestrator initialization
4. Update router logic for new agent type

```typescript
class CustomAgent extends BaseAgent {
  constructor() {
    super('custom', {
      name: 'Custom Agent',
      description: 'Custom functionality',
      supportsStreaming: true,
      requiresTools: false,
    });
  }

  getSystemPrompt(request: AgentRequest): string {
    return 'Custom system prompt...';
  }
}
```

### Custom Routing Logic

```typescript
class CustomRouter extends SmartAgentRouter {
  selectAgent(intent: UserIntent, complexity: QueryComplexity): AgentType {
    // Custom selection logic
    if (intent === 'custom_intent') {
      return 'custom';
    }
    return super.selectAgent(intent, complexity);
  }
}
```

## Troubleshooting

### Common Issues

1. **Agent not responding**: Check model availability and API keys
2. **Poor routing decisions**: Verify query clarity and intent
3. **Vector store errors**: Confirm database connections
4. **Memory issues**: Monitor request concurrency

### Debug Mode

```typescript
// Enable detailed logging
const orchestrator = createAgentOrchestrator({
  enableTelemetry: true,
});

// Check system health
const health = await getSystemHealth();
console.log('System health:', health);
```

## License

Part of the RRA (Retrieval-Reasoning-Augmentation) system.