# API Architecture & Endpoint Organization

## API Design Overview

The RoboRail Assistant API follows RESTful principles with Next.js App Router, providing a comprehensive set of endpoints for chat functionality, vector search, agent orchestration, and system management.

## API Route Structure

```
app/
├── (auth)/api/               # Authentication endpoints
│   └── auth/
│       ├── [...nextauth]/    # NextAuth.js dynamic routes
│       └── guest/           # Guest authentication
├── (chat)/api/              # Main application APIs
│   ├── chat/                # Core chat functionality
│   ├── document/            # Document management
│   ├── files/               # File upload/handling
│   ├── history/             # Chat history
│   ├── suggestions/         # AI suggestions
│   ├── vote/               # Message voting
│   ├── feedback/           # User feedback
│   ├── fault-tolerance/    # System health
│   └── vectorstore/        # Vector search services
│       ├── search/         # Basic search
│       ├── search-enhanced/ # Advanced search
│       ├── upload/         # Document upload
│       ├── delete/         # Document removal
│       ├── files/          # File management
│       ├── monitoring/     # Performance metrics
│       ├── sources/        # Available sources
│       └── feedback/       # Search feedback
└── api/                    # Global system APIs
    ├── agents/             # Agent system
    │   ├── analyze/        # Query analysis
    │   ├── capabilities/   # Agent capabilities
    │   ├── health/         # Agent health
    │   └── process/        # Request processing
    ├── health/             # System health checks
    │   └── agents/         # Agent-specific health
    └── ping/               # Basic connectivity
```

## Core API Endpoints

### **Authentication API** (`/api/auth/*`)

#### NextAuth.js Routes
```http
GET/POST /api/auth/[...nextauth]
Description: Dynamic authentication routes (login, logout, providers)
Authentication: Public
Response: NextAuth.js standard responses
```

#### Guest Authentication
```http
POST /api/auth/guest
Description: Create guest session for anonymous users
Authentication: Public
Request: None
Response: { session: Session, redirect?: string }
```

### **Chat API** (`/api/chat`)

#### Create/Stream Chat Messages
```http
POST /api/chat
Description: Send message and receive AI response stream
Authentication: Required
Content-Type: application/json

Request Body:
{
  id: string;                    // Chat ID
  message: UIMessage;           // User message
  selectedChatModel: string;    // AI model ID
  selectedVisibilityType: 'public' | 'private';
  selectedSources: VectorStoreType[];  // Data sources
}

Response: Server-Sent Events Stream
- Text chunks (word-level streaming)
- Tool call results
- Reasoning steps
- Error messages
- Completion signals
```

#### Resume Chat Stream
```http
GET /api/chat?chatId={id}
Description: Resume interrupted chat stream
Authentication: Required
Parameters:
  - chatId: string (required)

Response: Resumed stream or empty response
```

#### Delete Chat
```http
DELETE /api/chat?id={id}
Description: Delete chat and all associated data
Authentication: Required (owner only)
Parameters:
  - id: string (required)

Response: { success: boolean, deletedChat: Chat }
```

### **Vector Store API** (`/api/vectorstore/*`)

#### Basic Search
```http
POST /api/vectorstore/search
Description: Search across multiple vector stores
Authentication: Required
Content-Type: application/json

Request Body:
{
  query: string;
  sources: ('openai' | 'neon' | 'memory')[];
  maxResults?: number;
  threshold?: number;
  metadata?: Record<string, any>;
}

Response:
{
  results: SearchResult[];
  totalResults: number;
  processingTime: number;
}
```

#### Enhanced Search
```http
POST /api/vectorstore/search-enhanced
Description: Advanced search with relevance scoring and reranking
Authentication: Required
Content-Type: application/json

Request Body:
{
  query: string;
  sources: VectorStoreType[];
  maxResults?: number;
  enableRelevanceScoring?: boolean;
  enableReranking?: boolean;
  enableHybridSearch?: boolean;
  userId?: string;
  queryContext?: {
    type: string;
    domain: string;
    complexity: 'basic' | 'intermediate' | 'advanced';
  };
}

Response:
{
  results: EnhancedSearchResult[];
  totalResults: number;
  processingTime: number;
  rerankingApplied: boolean;
  scoringStrategy: string;
  performance: {
    searchTime: number;
    rerankingTime?: number;
    totalTime: number;
  };
}
```

#### Document Upload
```http
POST /api/vectorstore/upload
Description: Upload and index documents
Authentication: Required
Content-Type: multipart/form-data

Request Body:
{
  file: File;
  content?: string;
  metadata?: Record<string, any>;
  targetSources?: VectorStoreType[];
}

Response:
{
  success: boolean;
  documents: UnifiedDocument[];
  message: string;
}
```

#### Vector Store Sources
```http
GET /api/vectorstore/sources
Description: Get available vector store sources and statistics
Authentication: Required

Response:
{
  sources: VectorStoreType[];
  stats: Record<VectorStoreType, {
    enabled: boolean;
    count?: number;
    status: 'healthy' | 'degraded' | 'unavailable';
  }>;
}
```

#### Vector Store Monitoring
```http
GET /api/vectorstore/monitoring
Description: Get vector store performance metrics
Authentication: Required

Response:
{
  metrics: {
    searchLatency: number;
    errorRate: number;
    throughput: number;
    cacheHitRate: number;
  };
  status: 'healthy' | 'degraded' | 'critical';
  lastUpdated: string;
}
```

### **Document API** (`/api/document`)

#### Create Document
```http
POST /api/document
Description: Create new document (code, text, image, sheet)
Authentication: Required
Content-Type: application/json

Request Body:
{
  title: string;
  content: string;
  kind: 'text' | 'code' | 'image' | 'sheet';
  metadata?: Record<string, any>;
}

Response:
{
  id: string;
  title: string;
  content: string;
  kind: string;
  createdAt: string;
}
```

#### Update Document
```http
PATCH /api/document
Description: Update existing document
Authentication: Required (owner only)
Content-Type: application/json

Request Body:
{
  id: string;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
}

Response: Updated document object
```

### **Agent API** (`/api/agents/*`)

#### Process Request
```http
POST /api/agents/process
Description: Process request through agent system
Authentication: Required
Content-Type: application/json

Request Body:
{
  query: string;
  agentType?: 'qa' | 'research' | 'rewrite' | 'planner';
  context?: {
    chatHistory: Message[];
    sources: VectorStoreType[];
    complexity: 'simple' | 'moderate' | 'complex';
  };
  options?: {
    modelId: string;
    streaming: boolean;
    useTools: boolean;
  };
}

Response:
{
  content: string;
  agent: string;
  metadata: {
    modelUsed: string;
    processingTime: number;
    toolsUsed: string[];
    confidence: number;
  };
  citations?: Citation[];
}
```

#### Analyze Query
```http
POST /api/agents/analyze
Description: Analyze query complexity and routing requirements
Authentication: Required
Content-Type: application/json

Request Body:
{
  query: string;
  context?: Record<string, any>;
}

Response:
{
  intent: UserIntent;
  complexity: QueryComplexity;
  recommendedAgent: AgentType;
  confidence: number;
  reasoning: string;
  requiredCapabilities: string[];
}
```

#### Agent Capabilities
```http
GET /api/agents/capabilities
Description: Get available agent capabilities and models
Authentication: Required

Response:
{
  agents: {
    [agentType: string]: {
      description: string;
      capabilities: string[];
      supportedModels: string[];
      maxComplexity: string;
    };
  };
  availableModels: ChatModel[];
  systemStatus: 'healthy' | 'degraded' | 'unavailable';
}
```

### **File Management API** (`/api/files/*`)

#### File Upload
```http
POST /api/files/upload
Description: Upload files for processing
Authentication: Required
Content-Type: multipart/form-data

Request Body:
{
  file: File;
  chatId?: string;
  metadata?: Record<string, any>;
}

Response:
{
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}
```

### **System Health API** (`/api/health/*`)

#### System Health Check
```http
GET /api/health
Description: Overall system health status
Authentication: Public

Response:
{
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  services: {
    database: 'healthy' | 'degraded' | 'unavailable';
    vectorStores: 'healthy' | 'degraded' | 'unavailable';
    aiModels: 'healthy' | 'degraded' | 'unavailable';
    cache: 'healthy' | 'degraded' | 'unavailable';
  };
  metrics: {
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
}
```

#### Agent Health
```http
GET /api/health/agents
Description: Agent system specific health
Authentication: Required

Response:
{
  agents: {
    [agentType: string]: {
      status: 'healthy' | 'degraded' | 'unavailable';
      responseTime: number;
      errorRate: number;
      lastCheck: string;
    };
  };
  router: {
    status: 'healthy' | 'degraded' | 'unavailable';
    processingTime: number;
  };
  orchestrator: {
    status: 'healthy' | 'degraded' | 'unavailable';
    activeRequests: number;
  };
}
```

## API Design Patterns

### **Request/Response Standards**

#### Request Headers
```http
Content-Type: application/json
Authorization: Bearer {token}  # If authenticated
Accept: application/json
X-Client-Version: {version}   # Optional client version
```

#### Response Headers
```http
Content-Type: application/json
Cache-Control: no-cache       # For real-time data
ETag: {hash}                  # For cacheable resources
X-RateLimit-Remaining: {count} # Rate limit info
X-Response-Time: {ms}         # Processing time
```

#### Standard Response Format
```typescript
// Success Response
{
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    requestId: string;
    processingTime: number;
  };
}

// Error Response
{
  success: false;
  error: {
    code: string;              // e.g., "unauthorized:chat"
    message: string;           // Human-readable error
    details?: any;             // Additional error context
  };
  requestId: string;
}
```

### **Authentication & Authorization**

#### Session-Based Authentication
```typescript
// NextAuth.js Session
interface Session {
  user: {
    id: string;
    email: string;
    type: 'user' | 'admin' | 'guest';
  };
  expires: string;
}

// Route Protection
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:api').toResponse();
  }
  // Protected route logic
}
```

#### Rate Limiting
```typescript
// User Type Entitlements
const entitlementsByUserType = {
  guest: { maxMessagesPerDay: 10 },
  user: { maxMessagesPerDay: 100 },
  admin: { maxMessagesPerDay: 1000 },
};

// Rate Limit Check
const messageCount = await getMessageCountByUserId({
  id: session.user.id,
  differenceInHours: 24,
});

if (messageCount > entitlements.maxMessagesPerDay) {
  return new ChatSDKError('rate_limit:chat').toResponse();
}
```

### **Error Handling Strategy**

#### Error Classification
```typescript
class ChatSDKError extends Error {
  constructor(
    public code: string,
    message?: string,
    public statusCode?: number
  ) {
    super(message);
  }

  toResponse(): Response {
    return Response.json(
      {
        code: this.code,
        message: this.message,
      },
      { status: this.statusCode || 400 }
    );
  }
}

// Error Codes
- unauthorized:chat     → 401
- forbidden:chat        → 403
- not_found:chat        → 404
- rate_limit:chat       → 429
- bad_request:api       → 400
- internal_server_error → 500
```

#### Global Error Handling
```typescript
export async function POST(request: Request) {
  try {
    // Route logic
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Log unexpected errors
    console.error('Unexpected API error:', error);
    
    return new Response(
      JSON.stringify({
        code: 'internal_server_error',
        message: 'An unexpected error occurred',
      }),
      { status: 500 }
    );
  }
}
```

### **Validation & Schemas**

#### Request Validation
```typescript
import { z } from 'zod';

const postRequestBodySchema = z.object({
  id: z.string(),
  message: z.object({
    id: z.string(),
    role: z.literal('user'),
    content: z.string().min(1),
    createdAt: z.date(),
  }),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(['public', 'private']),
  selectedSources: z.array(z.enum(['openai', 'neon', 'memory'])),
});

// Usage in route
export async function POST(request: Request) {
  const json = await request.json();
  const requestBody = postRequestBodySchema.parse(json);
  // Validated request body
}
```

### **Caching Strategy**

#### API Response Caching
```typescript
// Cache Headers for Static Data
export async function GET() {
  const data = await getStaticData();
  
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600', // 1 hour
      'ETag': generateETag(data),
    },
  });
}

// Cache Headers for Dynamic Data
export async function GET() {
  const data = await getDynamicData();
  
  return Response.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=60', // 1 minute
    },
  });
}
```

## Performance Optimizations

### **Response Optimization**

1. **Streaming Responses**: Real-time data delivery for chat
2. **Compression**: Gzip/Brotli for large payloads
3. **Pagination**: Limit large dataset responses
4. **Field Selection**: Optional response field filtering

### **Database Optimization**

1. **Query Optimization**: Efficient database queries
2. **Connection Pooling**: Resource management
3. **Read Replicas**: Load distribution
4. **Indexing Strategy**: Optimized database indexes

### **Vector Store Optimization**

1. **Parallel Search**: Concurrent multi-source queries
2. **Result Caching**: Semantic cache keys
3. **Relevance Scoring**: Optimized ranking algorithms
4. **Batch Processing**: Efficient bulk operations

## Monitoring & Observability

### **API Metrics**

- **Response Times**: Endpoint latency tracking
- **Error Rates**: Failure rate monitoring
- **Request Volume**: Traffic pattern analysis
- **User Engagement**: Feature usage statistics

### **Health Monitoring**

- **Service Health**: Component status checks
- **Database Health**: Connection and query monitoring
- **AI Model Health**: Provider availability and performance
- **Cache Health**: Hit rates and performance metrics

This API architecture provides a robust, scalable foundation for the AI-powered chat assistant with comprehensive error handling, security, and performance optimization.