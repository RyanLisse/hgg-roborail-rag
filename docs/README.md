# HGG RoboRail Assistant (RRA) - Documentation

## Project Overview

The HGG RoboRail Assistant (RRA) is a sophisticated AI-powered chatbot application built with Next.js 15 and the AI SDK. It serves as an intelligent assistant specifically designed for rail industry applications, featuring advanced RAG (Retrieval-Augmented Generation) capabilities, multi-model AI support, and comprehensive document processing.

### Key Features

- **Advanced AI Chat Interface**: Multi-model support including xAI Grok, OpenAI, Anthropic, Cohere, and Google models
- **RAG (Retrieval-Augmented Generation)**: Intelligent document search and context-aware responses
- **Vector Store Integration**: Multiple vector database options (OpenAI, Neon, Unified)
- **Agent-Based Architecture**: Specialized AI agents for different tasks (research, QA, planning, rewriting)
- **Real-time Collaboration**: Document sharing and collaborative editing capabilities
- **Comprehensive Testing**: E2E testing with Playwright and unit testing with Vitest
- **Performance Monitoring**: Built-in observability with LangSmith integration

## Architecture Overview

### Core Technology Stack

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **AI Integration**: AI SDK with multiple provider support
- **Database**: Postgres with Drizzle ORM
- **Authentication**: NextAuth.js
- **File Storage**: Vercel Blob
- **State Management**: React Query (TanStack Query)
- **Testing**: Playwright (E2E), Vitest (Unit), Stagehand (Browser automation)

### Application Structure

```
app/
├── (auth)/          # Authentication routes
├── (chat)/          # Main chat interface
├── api/             # API endpoints
└── globals.css      # Global styles

components/          # Reusable UI components
├── ui/             # Base UI components (shadcn/ui)
├── chat.tsx        # Main chat interface
├── artifact.tsx    # Code/document artifacts
└── ...

lib/                # Core business logic
├── agents/         # AI agent implementations
├── ai/             # AI model configurations
├── vectorstore/    # Vector database integrations
├── db/             # Database schema and queries
├── rag/            # RAG implementation
└── ...

tests/              # Comprehensive test suite
├── e2e/            # End-to-end tests
├── integration/    # Integration tests
└── utils/          # Test utilities
```

## Key Components

### 1. AI Agent System (`lib/agents/`)

The application features a sophisticated agent-based architecture:

- **Base Agent**: Core agent functionality and interfaces
- **Research Agent**: Specialized for information gathering and analysis
- **QA Agent**: Question-answering and fact verification
- **Planner Agent**: Task planning and workflow orchestration
- **Rewrite Agent**: Content optimization and restructuring
- **Router**: Intelligent agent selection and task distribution

### 2. Vector Store System (`lib/vectorstore/`)

Multiple vector database implementations with fault tolerance:

- **OpenAI Integration**: Primary vector store with OpenAI embeddings
- **Neon Integration**: Postgres-based vector storage
- **Unified System**: Abstraction layer for multiple vector stores
- **Fault Tolerance**: Automatic failover and error recovery
- **Performance Optimization**: Caching and query optimization

### 3. RAG Implementation (`lib/rag/`)

Advanced retrieval-augmented generation:

- **Document Chunking**: Intelligent text segmentation
- **Semantic Search**: Context-aware document retrieval
- **Citation Generation**: Automatic source attribution
- **Relevance Scoring**: Result ranking and filtering

### 4. AI Model Integration (`lib/ai/`)

Comprehensive model provider support:

- **xAI Grok**: Default model (grok-2-1212)
- **OpenAI**: GPT-4 and embedding models
- **Anthropic**: Claude family models
- **Cohere**: Command and embedding models
- **Google**: Gemini models
- **Groq**: High-speed inference

## Development Workflow

### Setup and Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and configuration

# Set up database
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

### Available Scripts

#### Development
- `pnpm dev` - Start development server with Turbo
- `pnpm build` - Build production application
- `pnpm start` - Start production server

#### Code Quality
- `pnpm lint` - Run ESLint and Biome linting
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm format` - Format code with Biome
- `pnpm type-check` - TypeScript type checking

#### Database
- `pnpm db:generate` - Generate Drizzle schema
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio

#### Testing
- `pnpm test` - Run Playwright E2E tests
- `pnpm test:unit` - Run Vitest unit tests
- `pnpm test:coverage` - Generate test coverage report
- `pnpm test:comprehensive` - Run all test suites

#### Vector Store Testing
- `pnpm test:vectorstore` - Test vector store implementations
- `pnpm vectorstore:summary` - Generate vector store performance summary

### Code Quality Standards

The project maintains high code quality through:

- **ESLint Configuration**: Next.js recommended rules plus custom configurations
- **Biome Integration**: Fast formatting and additional linting
- **TypeScript Strict Mode**: Full type safety enforcement
- **Pre-commit Hooks**: Automatic formatting and linting on commit
- **Pre-push Validation**: Type checking and testing before push

### Testing Strategy

#### End-to-End Testing (Playwright)
- **Chat Interface**: Complete conversation flows
- **RAG Workflows**: Document upload and retrieval testing
- **Authentication**: Login/logout and session management
- **Vector Store**: Database operations and search functionality
- **Stagehand Integration**: Advanced browser automation

#### Unit Testing (Vitest)
- **Agent System**: Individual agent functionality
- **Vector Store**: Database operations and fault tolerance
- **RAG Components**: Chunking, embedding, and retrieval
- **Utility Functions**: Helper functions and data processing

#### Integration Testing
- **API Endpoints**: Full request/response cycles
- **Database Operations**: Data persistence and retrieval
- **Model Integration**: AI provider communication

## Configuration

### Environment Variables

Key environment variables required for operation:

```bash
# Database
POSTGRES_URL="postgresql://..."

# AI Providers
XAI_API_KEY="xai-..."
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
COHERE_API_KEY="..."
GOOGLE_GENERATIVE_AI_API_KEY="..."

# Vector Stores
OPENAI_API_KEY="..." # For embeddings
NEON_DATABASE_URL="postgresql://..."

# Authentication
AUTH_SECRET="..."
AUTH_GITHUB_ID="..."
AUTH_GITHUB_SECRET="..."

# Storage
BLOB_READ_WRITE_TOKEN="..."

# Monitoring
LANGCHAIN_API_KEY="..."
LANGCHAIN_PROJECT="..."
```

### Build Configuration

The application uses several configuration files:

- **next.config.ts**: Next.js configuration with PPR and TypeScript settings
- **tsconfig.json**: TypeScript compiler options
- **tailwind.config.ts**: Tailwind CSS customization
- **biome.jsonc**: Code formatting and linting rules
- **playwright.config.ts**: E2E testing configuration
- **vitest.config.ts**: Unit testing configuration

## Performance Considerations

### Optimization Features

1. **Partial Pre-rendering (PPR)**: Enabled in Next.js configuration
2. **Vector Caching**: Intelligent caching of embedding results
3. **Connection Pooling**: Optimized database connections
4. **Lazy Loading**: Component and route-level code splitting
5. **Fault Tolerance**: Automatic error recovery and fallback systems

### Monitoring and Observability

- **LangSmith Integration**: Request tracing and performance monitoring
- **Error Tracking**: Comprehensive error handling and reporting
- **Performance Metrics**: Response time and throughput monitoring
- **Vector Store Analytics**: Search performance and accuracy metrics

## Security

### Authentication and Authorization

- **NextAuth.js**: Secure authentication with multiple providers
- **Session Management**: Secure cookie-based sessions
- **API Protection**: Route-level authentication checks
- **Environment Security**: Proper secret management

### Data Security

- **Input Validation**: Zod schema validation for all inputs
- **SQL Injection Prevention**: Parameterized queries with Drizzle ORM
- **CORS Configuration**: Proper cross-origin request handling
- **Rate Limiting**: API endpoint protection

## Deployment

### Vercel Deployment (Recommended)

The application is optimized for Vercel deployment:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set up Neon Postgres database
4. Deploy with automatic CI/CD

### Manual Deployment

For custom deployment environments:

1. Build the application: `pnpm build`
2. Set up production database
3. Configure environment variables
4. Start production server: `pnpm start`

## Contributing

### Development Guidelines

1. **Code Style**: Follow existing patterns and use provided linting tools
2. **Testing**: Write tests for new features and bug fixes
3. **Documentation**: Update documentation for significant changes
4. **Type Safety**: Maintain strict TypeScript compliance
5. **Performance**: Consider performance implications of changes

### Pull Request Process

1. Create feature branch from main
2. Implement changes with appropriate tests
3. Run full test suite: `pnpm test:comprehensive`
4. Ensure code quality: `pnpm lint && pnpm type-check`
5. Submit pull request with detailed description

## Troubleshooting

### Common Issues

1. **Database Connection**: Verify POSTGRES_URL and database accessibility
2. **API Keys**: Ensure all required API keys are properly configured
3. **Build Errors**: Check TypeScript errors and dependency versions
4. **Test Failures**: Verify test environment setup and database state

### Support Resources

- **Documentation**: Check docs/ folder for detailed guides
- **Issue Tracking**: Use GitHub issues for bug reports
- **Development Chat**: Internal team communication channels
- **Performance Monitoring**: LangSmith dashboard for AI performance

## Future Roadmap

### Planned Features

1. **Enhanced Agent Capabilities**: More specialized AI agents
2. **Advanced RAG**: Improved document processing and retrieval
3. **Multi-modal Support**: Image and voice interaction capabilities
4. **Workflow Automation**: Automated task execution and scheduling
5. **Enterprise Features**: Advanced security and compliance features

### Performance Improvements

1. **Caching Enhancements**: More sophisticated caching strategies
2. **Database Optimization**: Query optimization and indexing improvements
3. **Vector Store Performance**: Faster embedding and retrieval
4. **UI/UX Enhancements**: Improved user interface and experience

---

For detailed technical documentation, see the additional files in this docs/ directory.