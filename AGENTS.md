# AGENTS.md - Agentic Development Guide

## Quick Setup
```bash
./SETUP.sh           # Automated environment setup
pnpm dev              # Start development server
make fresh            # Clean install + fresh start
```

## Essential Commands
```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Next.js with Turbo
pnpm build            # Build (runs migrations first)
pnpm lint             # ESLint + Biome linting
pnpm format           # Auto-format code

# Database Operations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Drizzle Studio (port 4983)
pnpm db:push          # Push schema changes

# Testing
pnpm test             # E2E tests (Playwright)
pnpm test:unit        # Unit tests (Vitest)
pnpm test:coverage    # Coverage reports
pnpm vectorstore:test # Test vector stores
```

## Architecture Overview
- **Stack**: Next.js 15 + React 19 + TypeScript + Drizzle ORM
- **AI**: Multi-provider system (20+ models: OpenAI, Anthropic, xAI, etc.)
- **RAG**: 3-tier vector stores (OpenAI, Neon pgvector, Memory)
- **Auth**: NextAuth.js with guest/regular user tiers
- **DB**: PostgreSQL with pgvector extensions

## Environment Requirements
Copy `.env.example` to `.env.local` and configure:
- `AUTH_SECRET` - Random 32-byte secret
- `XAI_API_KEY` - Default AI provider
- `POSTGRES_URL` - Database with pgvector
- `REDIS_URL` - For resumable streams
- `BLOB_READ_WRITE_TOKEN` - File storage

## Code Standards
- **Formatting**: Biome (2 spaces, single quotes, trailing commas)
- **Types**: TypeScript strict mode, avoid `any`
- **Imports**: Use `@/*` path aliases
- **DB**: Drizzle schema in `lib/db/schema.ts`