# Database Schema & Relationships

## Database Architecture Overview

The RoboRail Assistant uses PostgreSQL as the primary database with the Drizzle ORM for type-safe database operations. The schema is designed to support multi-user chat functionality, document management, vector storage, and user feedback systems.

## Database Technology Stack

- **Database**: PostgreSQL (Vercel PostgreSQL)
- **ORM**: Drizzle ORM with TypeScript
- **Vector Storage**: pgvector extension
- **Connection**: postgres.js client with connection pooling
- **Migrations**: Drizzle Kit migration system

## Core Schema Tables

### **User Management**

#### User Table

```sql
CREATE TABLE "User" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(64) NOT NULL UNIQUE,
    password VARCHAR(64) -- Nullable for OAuth users
);
```

**TypeScript Interface:**

```typescript
interface User {
  id: string;
  email: string;
  password?: string;
}
```

**Purpose**: Stores user authentication and profile information
**Indexes**: Primary key on `id`, unique index on `email`

### **Chat System**

#### Chat Table

```sql
CREATE TABLE "Chat" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP NOT NULL,
    title TEXT NOT NULL,
    "userId" UUID NOT NULL REFERENCES "User"(id),
    visibility VARCHAR CHECK (visibility IN ('public', 'private'))
        NOT NULL DEFAULT 'private'
);
```

**TypeScript Interface:**

```typescript
interface Chat {
  id: string;
  createdAt: Date;
  title: string;
  userId: string;
  visibility: "public" | "private";
}
```

**Purpose**: Stores chat session metadata and permissions
**Relationships**: Many-to-one with User
**Indexes**: Primary key on `id`, foreign key on `userId`

#### Message Table (Message_v2)

```sql
CREATE TABLE "Message_v2" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL REFERENCES "Chat"(id),
    role VARCHAR NOT NULL,
    parts JSON NOT NULL,
    attachments JSON NOT NULL,
    "createdAt" TIMESTAMP NOT NULL
);
```

**TypeScript Interface:**

```typescript
interface DBMessage {
  id: string;
  chatId: string;
  role: string;
  parts: any; // Complex message parts (text, images, etc.)
  attachments: any; // File attachments
  createdAt: Date;
}
```

**Purpose**: Stores individual chat messages with rich content
**Relationships**: Many-to-one with Chat
**Features**: JSON columns for flexible message content and attachments

#### Stream Table

```sql
CREATE TABLE "Stream" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("chatId") REFERENCES "Chat"(id)
);
```

**Purpose**: Tracks streaming sessions for chat resumption
**Relationships**: Many-to-one with Chat

### **User Interaction System**

#### Vote Table (Vote_v2)

```sql
CREATE TABLE "Vote_v2" (
    "chatId" UUID NOT NULL REFERENCES "Chat"(id),
    "messageId" UUID NOT NULL REFERENCES "Message_v2"(id),
    "isUpvoted" BOOLEAN NOT NULL,
    PRIMARY KEY ("chatId", "messageId")
);
```

**TypeScript Interface:**

```typescript
interface Vote {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
}
```

**Purpose**: Stores user votes (upvote/downvote) on AI responses
**Relationships**: Composite foreign keys to Chat and Message
**Constraints**: Composite primary key prevents duplicate votes

#### Feedback Table

```sql
CREATE TABLE "Feedback" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "runId" VARCHAR(255) NOT NULL, -- LangSmith run ID
    "messageId" UUID NOT NULL REFERENCES "Message_v2"(id),
    "userId" UUID NOT NULL REFERENCES "User"(id),
    vote VARCHAR CHECK (vote IN ('up', 'down')) NOT NULL,
    comment TEXT,
    metadata JSON,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Purpose**: Detailed user feedback for AI response quality tracking
**Relationships**: References Message and User
**Features**: Integrates with LangSmith for AI observability

### **Document Management**

#### Document Table

```sql
CREATE TABLE "Document" (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    kind VARCHAR CHECK (kind IN ('text', 'code', 'image', 'sheet'))
        NOT NULL DEFAULT 'text',
    "userId" UUID NOT NULL REFERENCES "User"(id),
    PRIMARY KEY (id, "createdAt")
);
```

**TypeScript Interface:**

```typescript
interface Document {
  id: string;
  createdAt: Date;
  title: string;
  content?: string;
  kind: "text" | "code" | "image" | "sheet";
  userId: string;
}
```

**Purpose**: Stores user-created documents (artifacts)
**Features**: Composite primary key enables document versioning
**Document Types**: Text, code, images, spreadsheets

#### Suggestion Table

```sql
CREATE TABLE "Suggestion" (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "documentCreatedAt" TIMESTAMP NOT NULL,
    "originalText" TEXT NOT NULL,
    "suggestedText" TEXT NOT NULL,
    description TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
    "userId" UUID NOT NULL REFERENCES "User"(id),
    "createdAt" TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY ("documentId", "documentCreatedAt")
        REFERENCES "Document"(id, "createdAt")
);
```

**Purpose**: AI-generated suggestions for document improvements
**Relationships**: Complex foreign key to Document (id + createdAt)
**Workflow**: Track suggestion status (resolved/unresolved)

### **Vector Storage**

#### Vector Documents Table

```sql
CREATE TABLE vector_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSON,
    embedding VECTOR(1536), -- OpenAI embeddings are 1536 dimensions
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**TypeScript Interface:**

```typescript
interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[]; // 1536-dimensional vector
  createdAt: Date;
  updatedAt: Date;
}
```

**Purpose**: Stores documents with vector embeddings for semantic search
**Features**: pgvector extension for efficient similarity search
**Dimensions**: 1536 dimensions (OpenAI text-embedding-ada-002)

## Database Relationships

### **Entity Relationship Diagram**

```
User (1) ──────────── (∞) Chat
 │                      │
 │                      ├── (∞) Message_v2
 │                      │     │
 │                      │     └── (∞) Vote_v2
 │                      │     └── (∞) Feedback
 │                      │
 │                      └── (∞) Stream
 │
 └── (∞) Document ──── (∞) Suggestion
```

### **Relationship Details**

1. **User → Chat**: One-to-many (users can have multiple chats)
2. **Chat → Message**: One-to-many (chats contain multiple messages)
3. **Message → Vote**: One-to-many (messages can be voted on)
4. **Message → Feedback**: One-to-many (detailed feedback per message)
5. **Chat → Stream**: One-to-many (streaming sessions per chat)
6. **User → Document**: One-to-many (users create documents)
7. **Document → Suggestion**: One-to-many (AI suggestions per document)

## Migration System

### **Migration Files**

Located in `/lib/db/migrations/`:

```
0000_keen_devos.sql              # Initial schema
0001_sparkling_blue_marvel.sql   # User enhancements
0002_wandering_riptide.sql       # Chat features
0003_cloudy_glorian.sql          # Message system
0004_odd_slayback.sql           # Voting system
0005_wooden_whistler.sql        # Document management
0006_marvelous_frog_thor.sql    # Suggestions
0007_yielding_epoch.sql         # Vector storage
0008_empty_nighthawk.sql        # Performance optimizations
0009_remove_deprecated_tables.sql # Schema cleanup
0010_optimize_vector_indexes.sql  # Index optimization
```

### **Migration Management**

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Check migration status
npm run db:check

# Database studio (GUI)
npm run db:studio
```

## Database Indexes & Performance

### **Primary Indexes**

- **User.id**: UUID primary key
- **Chat.id**: UUID primary key
- **Message_v2.id**: UUID primary key
- **Document.(id, createdAt)**: Composite primary key

### **Foreign Key Indexes**

- **Chat.userId**: References User.id
- **Message_v2.chatId**: References Chat.id
- **Vote_v2.(chatId, messageId)**: Composite foreign key
- **Feedback.messageId**: References Message_v2.id
- **Feedback.userId**: References User.id

### **Vector Indexes**

```sql
-- Vector similarity search optimization
CREATE INDEX idx_vector_documents_embedding
ON vector_documents USING ivfflat (embedding vector_cosine_ops);

-- Content search optimization
CREATE INDEX idx_vector_documents_content
ON vector_documents USING gin (to_tsvector('english', content));
```

### **Query Optimization Indexes**

```sql
-- Chat history queries
CREATE INDEX idx_chat_user_created
ON "Chat" ("userId", "createdAt" DESC);

-- Message ordering
CREATE INDEX idx_message_chat_created
ON "Message_v2" ("chatId", "createdAt" ASC);

-- User lookup
CREATE UNIQUE INDEX idx_user_email
ON "User" (email);
```

## Data Types & Constraints

### **UUID Generation**

- All primary keys use `gen_random_uuid()` for security
- UUIDs prevent enumeration attacks
- Globally unique across distributed systems

### **JSON Columns**

- **Message.parts**: Flexible message content structure
- **Message.attachments**: File attachment metadata
- **Feedback.metadata**: Extensible feedback context
- **VectorDocument.metadata**: Document classification data

### **Timestamps**

- **createdAt**: Record creation time
- **updatedAt**: Last modification time (with triggers)
- Default to `NOW()` for automatic timestamping

### **Enums & Constraints**

```sql
-- Chat visibility levels
visibility VARCHAR CHECK (visibility IN ('public', 'private'))

-- Document types
kind VARCHAR CHECK (kind IN ('text', 'code', 'image', 'sheet'))

-- Vote types
vote VARCHAR CHECK (vote IN ('up', 'down'))
```

## Backup & Recovery Strategy

### **Automated Backups**

- **Vercel PostgreSQL**: Automatic daily backups
- **Point-in-time Recovery**: Up to 7 days
- **Cross-region Replication**: High availability

### **Data Retention Policies**

- **Chat Messages**: Retained indefinitely
- **Vector Documents**: Cached with TTL
- **Logs & Metrics**: 30-day retention
- **User Data**: Compliance with privacy regulations

## Security Considerations

### **Data Protection**

- **Passwords**: Hashed with bcrypt (Argon2 in production)
- **API Keys**: Stored in environment variables
- **PII Handling**: Minimal collection, secure storage

### **Access Control**

- **Row-Level Security**: User-owned data isolation
- **API Authentication**: NextAuth.js session validation
- **Database Permissions**: Read-only for analytics queries

### **Audit Trail**

- **User Actions**: Tracked through feedback system
- **System Events**: Logged with LangSmith integration
- **Data Changes**: Trigger-based audit logging

## Performance Monitoring

### **Query Performance**

- **Slow Query Logging**: Identify bottlenecks
- **Connection Pooling**: Optimize resource usage
- **Index Usage**: Monitor index effectiveness

### **Storage Metrics**

- **Table Sizes**: Track growth patterns
- **Vector Index Performance**: Similarity search efficiency
- **Cache Hit Rates**: Memory usage optimization

This database schema provides a robust foundation for the AI chat assistant with proper normalization, efficient indexing, and scalable vector search capabilities.
