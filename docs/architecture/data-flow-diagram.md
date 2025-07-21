# Data Flow & State Management Architecture

## Data Flow Overview

The RoboRail Assistant implements a sophisticated data flow architecture that handles real-time AI interactions, persistent state management, and multi-source vector search capabilities.

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐ ┌─────────────────┐│
│  │   React State   │  │   SWR Cache     │ │   AI SDK State  ││
│  │   (UI State)    │  │  (Server Data)  │ │  (Chat Stream)  ││
│  └─────────────────┘  └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                API Gateway Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐ ┌─────────────────┐│
│  │  Next.js Routes │  │   Middleware    │ │  Error Handlers ││
│  │  (/api/*)       │  │  (Auth, CORS)   │ │  (Boundaries)   ││
│  └─────────────────┘  └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Service Orchestration                        │
│  ┌─────────────────┐  ┌─────────────────┐ ┌─────────────────┐│
│  │  Agent Router   │  │  DI Container   │ │  Stream Manager ││
│  │  (Smart Routing)│  │  (Services)     │ │  (Real-time)    ││
│  └─────────────────┘  └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Services                             │
│  ┌─────────────────┐  ┌─────────────────┐ ┌─────────────────┐│
│  │   PostgreSQL    │  │  Vector Stores  │ │  Cache Layer    ││
│  │   (Persistent)  │  │  (AI Search)    │ │  (Redis/Memory) ││
│  └─────────────────┘  └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Core Data Flow Patterns

### 1. **Chat Message Flow**

```
User Input → MultimodalInput Component
     │
     ▼
useChat Hook (AI SDK) → API Route (/api/chat)
     │                        │
     ▼                        ▼
Client State Update    Authentication Check
     │                        │
     ▼                        ▼
Optimistic UI Update   Agent Orchestrator
     │                        │
     ▼                        ▼
Streaming Response ←── AI Model Processing
     │                        │
     ▼                        ▼
Real-time UI Update    Database Persistence
     │                        │
     ▼                        ▼
Final State Sync ←──── Response Completion
```

### 2. **Vector Search Flow**

```
Search Query → Enhanced Search Tool
     │
     ▼
Unified Vector Store Service
     │
     ├─→ OpenAI Assistant Files
     ├─→ Neon PostgreSQL (pgvector)
     └─→ Memory Store (In-memory)
     │
     ▼
Relevance Scoring & Reranking
     │
     ▼
Cached Results (Redis/Memory)
     │
     ▼
AI Context Integration
     │
     ▼
Response Generation
```

### 3. **State Management Flow**

```
Component State (useState)
     │
     ▼
Custom Hooks (useChat, useMessages)
     │
     ▼
SWR for Server State
     │
     ▼
API Routes
     │
     ▼
Database Queries
     │
     ▼
Cache Updates
```

## API Route Architecture

### **Chat API** (`/api/chat`)

**POST** - Create/Stream Chat Messages

```typescript
Request Flow:
1. Request validation (Zod schema)
2. Authentication check (NextAuth)
3. Rate limiting (user entitlements)
4. Message persistence (PostgreSQL)
5. AI model routing (provider selection)
6. Tool integration (vector search, documents)
7. Streaming response (Server-sent events)
8. Response persistence

Response: Streamed AI response with data stream
```

**GET** - Resume Interrupted Streams

```typescript
Request Flow:
1. Stream context validation
2. Chat ownership verification
3. Stream ID lookup
4. Message reconstruction
5. Resumable stream response

Response: Continued stream or empty response
```

**DELETE** - Remove Chat

```typescript
Request Flow:
1. Authentication check
2. Ownership verification
3. Cascade deletion (messages, votes, streams)

Response: Deletion confirmation
```

### **Vector Store APIs** (`/api/vectorstore/*`)

**Search** (`/search`, `/search-enhanced`)

```typescript
Request Flow:
1. Query optimization
2. Multi-source search (OpenAI, Neon, Memory)
3. Relevance scoring
4. Result reranking
5. Cache storage

Response: Ranked search results with metadata
```

**Upload** (`/upload`)

```typescript
Request Flow:
1. File validation
2. Content extraction
3. Embedding generation
4. Multi-store persistence
5. Index updating

Response: Document IDs and metadata
```

**Monitoring** (`/monitoring`)

```typescript
Request Flow:
1. Service health checks
2. Performance metrics collection
3. Usage statistics aggregation

Response: System status and metrics
```

### **Agent APIs** (`/api/agents/*`)

**Process** (`/process`)

```typescript
Request Flow:
1. Query classification
2. Agent routing decision
3. Context preparation
4. Agent execution
5. Response formatting

Response: Agent-processed response
```

**Analyze** (`/analyze`)

```typescript
Request Flow:
1. Complexity analysis
2. Intent classification
3. Resource requirements
4. Routing recommendations

Response: Analysis metadata
```

## Database Schema & Relationships

### **Core Tables**

```sql
-- User Management
User (id, email, password)
     │
     ▼
-- Chat Sessions
Chat (id, userId, title, visibility, createdAt)
     │
     ▼
-- Messages & Streams
Message_v2 (id, chatId, role, parts, attachments, createdAt)
Stream (id, chatId, createdAt)
     │
     ▼
-- User Interactions
Vote_v2 (chatId, messageId, isUpvoted)
Feedback (id, runId, messageId, userId, vote, comment)
     │
     ▼
-- Document Management
Document (id, userId, title, content, kind, createdAt)
Suggestion (id, documentId, originalText, suggestedText)
     │
     ▼
-- Vector Storage
vector_documents (id, content, metadata, embedding, createdAt)
```

### **Data Relationships**

```
User (1) ──── (∞) Chat
 │                │
 ▼                ▼
Document (∞) ─── (∞) Message_v2
 │                │
 ▼                ▼
Suggestion (∞)   Vote_v2 (1)
                 │
                 ▼
                Feedback (∞)
```

## State Management Patterns

### 1. **Client State (React)**

```typescript
// UI State
const [messages, setMessages] = useState<UIMessage[]>([]);
const [input, setInput] = useState<string>("");
const [attachments, setAttachments] = useState<Attachment[]>([]);

// Derived State
const isLoading = status === "streaming";
const canSubmit = input.trim().length > 0 && !isLoading;
```

### 2. **Server State (SWR)**

```typescript
// Chat History
const { data: chats } = useSWR("/api/history", fetcher);

// Votes
const { data: votes } = useSWR(`/api/vote?chatId=${id}`, fetcher);

// Vector Store Status
const { data: sources } = useSWR("/api/vectorstore/sources", fetcher);
```

### 3. **Streaming State (AI SDK)**

```typescript
const { messages, input, handleSubmit, status, append, reload } = useChat({
  id: chatId,
  initialMessages,
  experimental_throttle: 300,
  onFinish: () => mutate(getChatHistoryKey),
});
```

## Caching Strategy

### **Multi-Layer Caching**

```
Browser Cache (SWR)
     │
     ▼
Server Cache (Redis/Memory)
     │
     ▼
Database Query Cache
     │
     ▼
Vector Store Cache
```

### **Cache Keys & Patterns**

```typescript
// Vector Search Caching
CacheKey: `vs:${hash(query)}:${hash(sources)}:${hash(options)}`
TTL: 15 minutes

// Agent Response Caching
CacheKey: `ar:${agentType}:${hash(query)}:${hash(context)}`
TTL: 5 minutes

// Document Embedding Caching
CacheKey: `emb:${model}:${hash(content)}`
TTL: 1 hour

// Health Check Caching
CacheKey: `health:${service}:${hash(endpoint)}`
TTL: 30 seconds
```

## Real-Time Data Flow

### **Streaming Response Pattern**

```
Client Request
     │
     ▼
Server-Sent Events Stream
     │
     ├─→ Text Chunks (word-level)
     ├─→ Tool Calls (function execution)
     ├─→ Reasoning Steps (thought process)
     ├─→ Error Messages (failure handling)
     └─→ Completion Signal (stream end)
     │
     ▼
Client State Updates (incremental)
     │
     ▼
UI Rendering (real-time)
```

### **WebSocket Alternative (Future)**

```
WebSocket Connection
     │
     ├─→ Bidirectional Chat
     ├─→ Collaborative Editing
     ├─→ Real-time Notifications
     └─→ Status Updates
```

## Error Handling & Recovery

### **Error Flow Pattern**

```
Client Error → Error Boundary
     │
     ▼
Fallback UI → Retry Logic
     │
     ▼
Server Error → Graceful Degradation
     │
     ▼
Database Error → Fallback Data
     │
     ▼
Network Error → Offline Mode
```

### **Data Consistency**

```
Optimistic Updates
     │
     ▼
Server Validation
     │
     ├─→ Success: Confirm Update
     └─→ Failure: Rollback State
     │
     ▼
Error Recovery
     │
     ▼
State Reconciliation
```

## Performance Optimizations

### **Data Loading Strategies**

1. **Lazy Loading**: Components and services loaded on demand
2. **Prefetching**: Predictive data loading for common paths
3. **Pagination**: Incremental loading for large datasets
4. **Virtualization**: Efficient rendering of long lists

### **Caching Optimizations**

1. **Semantic Caching**: Context-aware cache keys
2. **Cache Warming**: Proactive cache population
3. **TTL Management**: Intelligent expiration policies
4. **Invalidation**: Pattern-based cache clearing

### **Database Optimizations**

1. **Query Optimization**: Efficient database queries
2. **Index Strategy**: Strategic database indexing
3. **Connection Pooling**: Resource optimization
4. **Read Replicas**: Load distribution

## Monitoring & Observability

### **Data Flow Monitoring**

```
Request Tracing
     │
     ▼
Performance Metrics
     │
     ▼
Error Tracking
     │
     ▼
Usage Analytics
     │
     ▼
Resource Monitoring
```

### **Key Metrics**

- **Response Times**: API latency, database query times
- **Throughput**: Requests per second, message processing rate
- **Error Rates**: Failed requests, timeout rates
- **Resource Usage**: Memory, CPU, database connections
- **User Engagement**: Message counts, feature usage

This data flow architecture ensures reliable, performant, and scalable handling of complex AI-powered chat interactions while maintaining data consistency and user experience quality.
