# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server with Turbo
make dev              # Enhanced dev with port cleanup (recommended)
make fresh            # Clean install + start fresh
```

### Database Operations

```bash
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Drizzle Studio on port 4983
pnpm db:generate      # Generate new migration files
pnpm db:push          # Push schema changes directly
```

### Testing & Quality

```bash
pnpm test             # E2E tests with Playwright
pnpm test:unit        # Unit tests with Vitest
pnpm test:coverage    # Coverage reports
pnpm lint             # ESLint + Biome linting
pnpm format           # Auto-format with Biome
```

### Vector Store Operations

```bash
pnpm vectorstore:test     # Test all vector stores
pnpm test:roborail        # Test RoboRail API responses
pnpm vectorstore:summary  # Generate vector store status
```

## Architecture Overview

### Multi-Provider AI System

This is a sophisticated AI chatbot supporting **20+ models across 6 providers** (OpenAI, Anthropic, Google, Cohere, Groq, xAI). The default model is `openai-gpt-4.1`. Models are defined in `lib/ai/models.ts` with provider-specific configurations.

**Key files:**

- `lib/ai/providers.ts` - Dynamic provider switching logic
- `lib/ai/tools/` - AI function tools (weather, document management, search)
- `app/api/chat/route.ts` - Streaming chat endpoint with resumable streams

### RAG (Retrieval Augmented Generation) System

Implements a **three-tier vector store architecture**:

1. **OpenAI Vector Store** (`lib/vectorstore/openai.ts`) - File-based search with file_search tool
2. **Neon pgvector** (`lib/vectorstore/neon.ts`) - PostgreSQL vector similarity search
3. **Memory Store** (`lib/vectorstore/unified.ts`) - In-memory fallback for development

**RAG pipeline:** Document ingestion → Cohere v2 multimodal embeddings → Vector storage → Query embedding → Similarity search → Context injection → LLM response

### Database Schema (PostgreSQL + pgvector)

Uses **Drizzle ORM** with incremental migrations in `lib/db/migrations/`. Key tables:

- `chats` + `messages_v2` - Chat conversations with JSON message parts
- `documents` - User artifacts (code, text, spreadsheets, images)
- `vector_documents` - Embedded content with `embedding[1536]` pgvector field
- `votes_v2` + `feedback` - User feedback system integrated with LangSmith
- `suggestions` - AI writing assistance for documents

### Authentication & Sessions

**NextAuth.js** with dual user types:

- **Guest users**: 10 messages/day, temporary sessions
- **Regular users**: 100 messages/day, persistent accounts
- Rate limiting enforced in `lib/ai/entitlements.ts`

### Streaming & Real-time Features

- **Resumable streams** using Redis for conversation continuity
- **Word-level chunking** for smooth streaming experience
- **Data streams** for real-time artifact updates during generation
- **Server Actions** for optimistic UI updates

## Development Patterns

### Adding New AI Models

1. Add model definition to `lib/ai/models.ts`
2. Configure provider in `lib/ai/providers.ts`
3. Test with existing tools and vector search

### Vector Store Integration

All vector operations go through `lib/vectorstore/unified.ts` which provides:

- **Parallel search** across multiple stores
- **Smart result aggregation** and ranking
- **Automatic failover** between vector stores
- **Unified interface** for upload, search, and management

### Reasoning Model Support (o1/o3 series)

Special handling for reasoning models in chat route:

- **Thinking extraction**: Parse `<thinking>` blocks from responses
- **No streaming**: Reasoning models return complete responses
- **Higher timeouts**: Allow longer processing time

### Component Architecture

Uses **shadcn/ui** with Radix primitives. Key patterns:

- `components/chat.tsx` - Main chat interface with streaming
- `components/artifact.tsx` - Code/document viewer with live editing
- `components/message.tsx` - Message rendering with tool calls
- `components/multimodal-input.tsx` - File upload + text input

### Testing Strategy

- **E2E tests** in `tests/e2e/` cover full user workflows
- **Route tests** in `tests/routes/` test API endpoints
- **Page objects** in `tests/pages/` for reusable test patterns
- **Vector store tests** verify RAG functionality across all stores

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

- `POSTGRES_URL` - Neon or local PostgreSQL with pgvector
- `XAI_API_KEY` - Default provider (or configure others)
- `COHERE_API_KEY` - Required for multimodal embeddings
- `LANGCHAIN_API_KEY` - Optional LangSmith observability
- `REDIS_URL` - Required for resumable streams

## LangSmith Observability

Comprehensive tracing system in `lib/observability/langsmith.ts`:

- **Conversation tracing** - Every chat interaction logged
- **Feedback collection** - User votes tracked with metadata
- **Error monitoring** - Structured error reporting
- **Performance metrics** - Token usage and latency tracking

## Deployment Notes

- **Vercel-optimized** with Edge Runtime support
- **Database migrations** run automatically on build (`pnpm build`)
- **Environment variables** auto-configured on Vercel deployment
- **Blob storage** for file uploads via Vercel Blob
- **Redis** required for production (stream persistence)
