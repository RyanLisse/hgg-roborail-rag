# AGENTS.md - Development Guide

## Commands
- **Dev**: `pnpm dev` (Next.js with Turbo)
- **Build**: `pnpm build` (runs migrations + build)
- **Lint**: `pnpm lint` (ESLint + Biome)
- **Format**: `pnpm format` (Biome formatter)
- **Test Unit**: `pnpm test:unit` (Vitest) - single test: `pnpm test:unit <filename>`
- **Test E2E**: `pnpm test` (Playwright)
- **Database**: `pnpm db:studio` (Drizzle Studio), `pnpm db:migrate` (run migrations)

## Architecture
- **Framework**: Next.js 15 App Router + React 19 + TypeScript
- **Database**: PostgreSQL with Drizzle ORM + pgvector for embeddings
- **RAG System**: Multi-modal embeddings (Cohere v4), vector stores (OpenAI/Neon/Memory)
- **AI**: AI SDK with multiple providers (OpenAI, Anthropic, Cohere, xAI)
- **Key modules**: `lib/rag/`, `lib/vectorstore/`, `lib/embeddings/`, `lib/db/`

## Code Style (Biome + ESLint)
- **Formatting**: 2 spaces, single quotes, trailing commas, semicolons
- **Imports**: Use `@/*` aliases, no unused imports
- **React**: JSX double quotes, fragment syntax preferred
- **Types**: TypeScript strict mode, avoid `any` when possible
- **Database**: Drizzle schema in `lib/db/schema.ts`, migrations auto-generated
# Agent Configuration for AI Chatbot RAG System

## Project Overview
Next.js 15 AI chatbot with advanced RAG capabilities, vector stores, and multimodal support.

## Essential Commands
```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start development server
make dev              # Start dev with port cleanup

# Database
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio

# Testing & Quality
pnpm test             # E2E tests (Playwright)
pnpm test:unit        # Unit tests (Vitest)
pnpm lint             # ESLint + Biome
pnpm format           # Format code

# Vector Store Testing
pnpm vectorstore:test # Test vector stores
pnpm test:roborail    # Test RoboRail responses
```

## Environment Setup
Required: `.env.local` with AUTH_SECRET, XAI_API_KEY, POSTGRES_URL, BLOB_READ_WRITE_TOKEN, REDIS_URL

## Key Directories
- `app/` - Next.js App Router pages
- `components/` - React components with shadcn/ui
- `lib/` - Core utilities (AI, DB, RAG, embeddings)
- `tests/` - E2E and unit tests

## Development Notes
- Uses pnpm package manager
- TypeScript + strict mode
- Drizzle ORM for PostgreSQL
- Auth.js for authentication
- LangSmith for observability
- Cohere v2 for embeddings