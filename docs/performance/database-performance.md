# Database Performance Analysis

## Current Database Architecture

### Technology Stack

- **Database:** PostgreSQL via Vercel Postgres
- **ORM:** Drizzle ORM
- **Connection:** postgres.js client
- **Schema:** Relational with vector extensions

### Performance Issues Identified

## 1. Query Performance Bottlenecks

### N+1 Query Patterns

**Severity:** HIGH
**Location:** `lib/db/queries.ts`

#### Issue: Message Votes Loading

```typescript
// Current inefficient pattern
export async function getVotesByChatId({ id }: { id: string }) {
  return await database.select().from(vote).where(eq(vote.chatId, id));
}
```

**Problem:** Separate query for votes after loading messages
**Impact:** Additional round-trip per chat
**Solution:** Use optimized `getMessagesWithVotesByChatId` consistently

#### Issue: User Existence Checks

```typescript
// Multiple queries for user validation
const existingUser = await database.select().from(user).where(eq(user.id, userId));
if (existingUser.length === 0) {
  await database.insert(user).values({...}); // Second query
}
```

**Problem:** 2-3 queries per user check
**Solution:** Use UPSERT or optimistic insertion

### 2. Missing Index Optimizations

#### Critical Missing Indexes

```sql
-- Message queries by chat (high frequency)
CREATE INDEX CONCURRENTLY idx_message_chat_created
ON message(chat_id, created_at);

-- Vote lookups by message (medium frequency)
CREATE INDEX CONCURRENTLY idx_vote_message_chat
ON vote(message_id, chat_id);

-- User chats with pagination (high frequency)
CREATE INDEX CONCURRENTLY idx_chat_user_created
ON chat(user_id, created_at DESC);

-- Document searches (medium frequency)
CREATE INDEX CONCURRENTLY idx_document_user_kind
ON document(user_id, kind, created_at);

-- Stream tracking (low frequency but critical)
CREATE INDEX CONCURRENTLY idx_stream_chat_created
ON stream(chat_id, created_at);
```

### 3. Inefficient Query Patterns

#### Problem: Large Result Sets Without Limits

```typescript
// No pagination limits in vector store queries
export async function getMessagesByChatId({ id }: { id: string }) {
  return await database
    .select()
    .from(message)
    .where(eq(message.chatId, id))
    .orderBy(asc(message.createdAt))
    .limit(100); // Good: has limit
}

// But chat loading doesn't paginate
export async function getChatsByUserId({...}) {
  // Loads all chats at once - should paginate
}
```

#### Problem: Unnecessary Data Loading

```typescript
// Loading full message content when only metadata needed
const messagesToDelete = await database
  .select({ id: message.id }) // Good: only selecting id
  .from(message)
  .where(and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)));
```

## Query Optimization Recommendations

### 1. Connection Pool Optimization

#### Current Configuration Issues

```typescript
// Single connection instance
client = postgres(POSTGRES_URL);
```

**Optimized Configuration:**

```typescript
const client = postgres(POSTGRES_URL, {
  max: 20, // Connection pool size
  idle_timeout: 20, // Idle connection timeout
  connect_timeout: 10, // Connection timeout
  prepare: true, // Use prepared statements
  transform: {
    undefined: null, // Handle undefined values
  },
  connection: {
    application_name: "rra-chat",
    search_path: "public",
  },
});
```

### 2. Query Caching Strategy

#### Implement Result Caching

```typescript
import { cache } from "react";

// Cache frequently accessed data
export const getChatById = cache(async ({ id }: { id: string }) => {
  // Existing implementation with cache
});

export const getUserChats = cache(async (userId: string) => {
  // Cache user's chat list for 5 minutes
});
```

#### Redis Integration for Vector Store

```typescript
// Cache vector search results
const cacheKey = `vector_search:${hash(query)}:${sources.join(",")}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Store results with TTL
await redis.setex(cacheKey, 300, JSON.stringify(results));
```

### 3. Batch Operations

#### Optimize Multiple Inserts

```typescript
// Current: Individual message saves
await database.insert(message).values(messages);

// Optimized: Batch with transactions
export async function saveMessagesWithVotes(
  messagesData: Array<{ message: DBMessage; vote?: Vote }>,
) {
  return await database.transaction(async (tx) => {
    const messages = await tx
      .insert(message)
      .values(messagesData.map((d) => d.message))
      .returning();

    const votes = messagesData
      .filter((d) => d.vote)
      .map((d, i) => ({ ...d.vote!, messageId: messages[i].id }));

    if (votes.length > 0) {
      await tx.insert(vote).values(votes);
    }

    return messages;
  });
}
```

### 4. Pagination and Virtualization

#### Implement Cursor-Based Pagination

```typescript
export async function getMessagesPaginated({
  chatId,
  cursor,
  limit = 50,
}: {
  chatId: string;
  cursor?: string;
  limit?: number;
}) {
  const whereCondition = cursor
    ? and(eq(message.chatId, chatId), gt(message.createdAt, new Date(cursor)))
    : eq(message.chatId, chatId);

  const messages = await database
    .select()
    .from(message)
    .where(whereCondition)
    .orderBy(asc(message.createdAt))
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const results = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: results,
    nextCursor: hasMore
      ? results[results.length - 1].createdAt.toISOString()
      : null,
    hasMore,
  };
}
```

## Vector Store Database Integration

### 1. Neon Database Performance

#### Current Issues in Neon Vector Store

- No connection pooling configuration
- Embedding operations not batched
- Missing similarity search optimization

#### Optimizations

```typescript
// Batch embedding operations
export async function addDocumentsBatch(documents: DocumentInput[]) {
  const embeddings = await Promise.all(
    documents.map((doc) => generateEmbedding(doc.content)),
  );

  return await database.transaction(async (tx) => {
    return await tx
      .insert(documents)
      .values(
        documents.map((doc, i) => ({
          ...doc,
          embedding: embeddings[i],
          createdAt: new Date(),
        })),
      )
      .returning();
  });
}

// Optimize similarity search
export async function searchSimilarOptimized({
  query,
  threshold = 0.7,
  maxResults = 10,
}: SearchParams) {
  const queryEmbedding = await generateEmbedding(query);

  // Use pgvector optimized search
  const results = await database.execute(sql`
    SELECT id, content, metadata, 
           (embedding <=> ${queryEmbedding}::vector) as distance
    FROM documents 
    WHERE (embedding <=> ${queryEmbedding}::vector) < ${1 - threshold}
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${maxResults}
  `);

  return results.map((row) => ({
    ...row,
    similarity: 1 - row.distance,
  }));
}
```

### 2. Database Schema Optimizations

#### Vector Index Configuration

```sql
-- Optimize vector search performance
CREATE INDEX CONCURRENTLY documents_embedding_hnsw_idx
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Partial indexes for faster filtered searches
CREATE INDEX CONCURRENTLY documents_metadata_gin_idx
ON documents USING gin (metadata);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY documents_user_created_idx
ON documents(user_id, created_at DESC)
WHERE deleted_at IS NULL;
```

## Monitoring and Metrics

### Database Performance Monitoring

#### Query Performance Tracking

```typescript
export async function withQueryMetrics<T>(
  queryName: string,
  queryFn: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    // Log slow queries (>100ms)
    if (duration > 100) {
      console.warn(`Slow query [${queryName}]: ${duration}ms`);
    }

    // Track metrics
    recordQueryMetric(queryName, duration, "success");

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordQueryMetric(queryName, duration, "error");
    throw error;
  }
}
```

#### Connection Pool Monitoring

```typescript
// Monitor connection pool health
export function getConnectionPoolStats() {
  return {
    totalConnections: client.totalCount,
    idleConnections: client.idleCount,
    waitingClients: client.waitingCount,
    maxConnections: client.maxConnections,
  };
}
```

### Performance Benchmarks

#### Current Metrics (Estimated)

```
Chat loading: 150-300ms
Message pagination: 50-150ms
Vector search: 300-800ms
User operations: 20-100ms
Bulk operations: 200-1000ms
```

#### Target Metrics (Post-Optimization)

```
Chat loading: 50-150ms (-67%)
Message pagination: 20-75ms (-60%)
Vector search: 150-400ms (-50%)
User operations: 10-50ms (-50%)
Bulk operations: 100-400ms (-60%)
```

## Implementation Priority

### Phase 1: Critical Performance (Week 1)

1. Add missing database indexes
2. Implement connection pooling
3. Fix N+1 query patterns

### Phase 2: Caching Layer (Week 2)

1. Add Redis caching for frequent queries
2. Implement result caching for vector searches
3. Add query result memoization

### Phase 3: Advanced Optimization (Week 3)

1. Implement batch operations
2. Add cursor-based pagination
3. Optimize vector search queries

### Phase 4: Monitoring (Week 4)

1. Add comprehensive query monitoring
2. Implement performance alerting
3. Create database performance dashboard
