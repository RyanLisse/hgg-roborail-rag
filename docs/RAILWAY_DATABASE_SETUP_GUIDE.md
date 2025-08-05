# Railway Database Setup Guide

Complete guide for setting up and migrating to Railway PostgreSQL for the RRA (RoboRail Assistant) project.

## 🚀 Quick Start

### 1. One-Command Setup

```bash
# Complete Railway setup with migration, seeding, and testing
pnpm run railway:setup
```

This command will:
- ✅ Run complete database migration
- ✅ Seed minimal test data
- ✅ Run comprehensive database tests
- ✅ Validate all functionality

### 2. Manual Step-by-Step Setup

If you prefer manual control:

```bash
# Step 1: Run complete migration
pnpm run db:migrate:complete

# Step 2: Seed database with test data
pnpm run db:seed:full

# Step 3: Test database setup
pnpm run test:db:railway

# Step 4: Deploy to Railway
pnpm run railway:deploy
```

## 📋 Prerequisites

### Railway Account Setup

1. **Create Railway Account**: [https://railway.app](https://railway.app)
2. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

### Environment Variables

Create `.env.local` with Railway database connection:

```bash
# Railway PostgreSQL (Primary)
DATABASE_URL=postgresql://username:password@host:port/database

# Alternative format (fallback)
POSTGRES_URL=postgresql://username:password@host:port/database

# Railway Platform (auto-provided in production)
RAILWAY_ENVIRONMENT=production
RAILWAY_PROJECT_ID=your-project-id
RAILWAY_SERVICE_ID=your-service-id

# Required AI Provider
OPENAI_API_KEY=sk-your-openai-key

# Authentication
AUTH_SECRET=your-auth-secret-32-chars-min
```

## 🏗️ Database Architecture

### Core Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `User` | User management | Enhanced with preferences, activity tracking |
| `Chat` | Chat sessions | Message counting, archiving, tags |
| `Message` | Chat messages | Role-based, threading, metadata |
| `Vote` | Message feedback | User-specific voting system |
| `Document` | Document storage | Multi-format support, versioning |
| `Embedding` | Text embeddings | Multi-provider support (OpenAI, Cohere) |
| `Suggestion` | AI suggestions | Confidence scoring, review workflow |
| `Stream` | Streaming data | Real-time message streaming |
| `Feedback` | User feedback | LangSmith integration, categorization |

### RAG (Retrieval-Augmented Generation) Tables

| Table | Purpose | Dimensions |
|-------|---------|------------|
| `vector_documents` | Vector storage | 1536 (OpenAI), 1024 (Cohere) |
| `search_analytics` | Search tracking | Performance monitoring |

### Extensions Required

- **uuid-ossp**: UUID generation
- **pgcrypto**: Cryptographic functions  
- **vector**: pgvector for similarity search
- **pg_stat_statements**: Performance monitoring

## 🔧 Available Commands

### Migration Commands

```bash
# Basic Drizzle migration
pnpm run db:migrate

# Railway-specific migration with optimizations
pnpm run db:migrate:railway

# Complete migration with validation and setup
pnpm run db:migrate:complete
```

### Database Seeding

```bash
# Minimal data (users, basic chats)
pnpm run db:seed:minimal

# Full dataset (includes vector documents, analytics)
pnpm run db:seed:full

# Vector documents only
pnpm run db:seed:vector

# Generic seeding command
pnpm run db:seed
```

### Testing Commands

```bash
# Comprehensive database testing
pnpm run test:db:railway

# Complete migration + testing
pnpm run test:db:complete

# Standard database validation
pnpm run test:db
```

### Railway Deployment

```bash
# Complete setup (migration + seed + test)
pnpm run railway:setup

# Build and deploy to Railway
pnpm run railway:deploy

# View Railway logs
pnpm run railway:logs
```

### Database Management

```bash
# Open Drizzle Studio
pnpm run db:studio

# Generate new migrations
pnpm run db:generate

# Check migration status
pnpm run db:check

# Database health monitoring
pnpm run db:health
pnpm run db:monitor
```

## 🧪 Testing & Validation

### Test Suites

The comprehensive test suite includes:

1. **Connectivity Tests**
   - Basic connection validation
   - Railway configuration check
   - Health check functionality

2. **Extension Tests**
   - PostgreSQL extension verification
   - Vector functionality testing
   - UUID and crypto functions

3. **Schema Tests**
   - Table structure validation
   - Foreign key constraints
   - Index performance verification

4. **Drizzle ORM Tests**
   - Basic CRUD operations
   - Complex joins and queries
   - Vector similarity searches

5. **Performance Tests**
   - Query response times
   - Vector search performance
   - Connection pool efficiency

6. **Monitoring Tests**
   - Health check functions
   - Performance stats views
   - Connection monitoring

### Sample Test Output

```
🧪 Starting comprehensive database testing...
============================================================

📡 Testing database connectivity...
✅ Connectivity: 3/3 (245ms)
  ✅ Basic Connection (89ms)
  ✅ Railway Configuration (12ms)
  ✅ Health Check (144ms)

🧩 Testing PostgreSQL extensions...
✅ Extensions: 5/5 (312ms)
  ✅ Extension: uuid-ossp (45ms)
  ✅ Extension: pgcrypto (38ms)
  ✅ Extension: vector (67ms)
  ✅ Extension: pg_stat_statements (89ms)
  ✅ Vector Functionality (73ms)

📋 Test Results Summary
============================================================
🎯 Overall: 6/6 suites passed
🎯 Tests: 28/28 tests passed
⏱️ Duration: 1,245ms
✅ Success: YES
```

## 📊 Monitoring & Health Checks

### Built-in Health Functions

```sql
-- Railway health check
SELECT railway_health_check();

-- Performance statistics
SELECT * FROM railway_performance_stats;

-- Connection monitoring
SELECT * FROM railway_connection_stats;
```

### API Health Endpoints

- `/api/health` - Application health
- `/api/health/database` - Database connectivity
- Custom monitoring dashboards

### Performance Optimization

The setup includes Railway-optimized settings:

```sql
-- Connection management
max_connections = 100
shared_buffers = '128MB'
effective_cache_size = '512MB'

-- Query optimization
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

-- Maintenance settings
maintenance_work_mem = '32MB'
checkpoint_completion_target = 0.9
wal_buffers = '8MB'
```

## 🎯 Vector Search Configuration

### OpenAI Embeddings (Default)
- **Dimensions**: 1536
- **Model**: text-embedding-3-small
- **Index**: IVFFLAT with cosine similarity

### Cohere Embeddings (Alternative)
- **Dimensions**: 1024  
- **Model**: embed-v4
- **Index**: IVFFLAT with cosine similarity

### Vector Search Performance

```sql
-- Example vector similarity search
SELECT 
    id, 
    content, 
    (embedding <-> $1::vector) as distance
FROM vector_documents 
WHERE is_active = true 
    AND is_public = true
ORDER BY distance 
LIMIT 10;
```

Performance targets:
- **< 100ms** for simple vector searches
- **< 500ms** for complex filtered searches
- **> 95%** index utilization rate

## 🚀 Railway Deployment

### Project Structure

```
railway.json           # Railway configuration
├── services/
│   ├── web/          # Next.js application  
│   └── postgres/     # PostgreSQL database
├── volumes/
│   └── postgres-data # Persistent storage
└── environment/      # Environment variables
```

### Deployment Process

1. **Automatic Deployment**:
   ```bash
   git push origin main
   # Railway auto-deploys on push
   ```

2. **Manual Deployment**:
   ```bash
   pnpm run railway:deploy
   ```

3. **Environment Setup**:
   - Railway automatically provides `DATABASE_URL`
   - Set additional variables in Railway dashboard
   - Configure domain and SSL certificates

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Vector search functionality tested
- [ ] Health checks responding
- [ ] SSL certificates configured
- [ ] Domain names set up
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented

## 🔍 Troubleshooting

### Common Issues

#### 1. Connection Failures

```bash
# Test connection manually
psql "$DATABASE_URL" -c "SELECT version();"

# Check Railway service status
railway status

# View logs
pnpm run railway:logs
```

#### 2. Migration Errors

```bash
# Reset and retry migrations
pnpm run db:generate
pnpm run db:migrate:complete

# Check migration status
pnpm run db:check
```

#### 3. Vector Search Issues

```bash
# Test vector extension
SELECT '[1,2,3]'::vector;

# Check vector indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'vector_documents' 
AND indexname LIKE '%vector%';
```

#### 4. Performance Issues

```bash
# Run performance tests
pnpm run test:db:railway

# Check database stats
SELECT * FROM railway_performance_stats;

# Monitor connections
SELECT * FROM railway_connection_stats;
```

### Error Messages

| Error | Solution |
|-------|----------|
| `Extension "vector" not found` | Run `pnpm run db:migrate:complete` |
| `Connection timeout` | Check Railway service status |
| `Permission denied` | Verify DATABASE_URL credentials |
| `Table does not exist` | Apply migrations: `pnpm run db:migrate` |
| `Index scan too slow` | Run `ANALYZE` on affected tables |

## 📚 Additional Resources

### Documentation
- [Railway PostgreSQL Docs](https://docs.railway.app/databases/postgresql)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Drizzle ORM Guide](https://orm.drizzle.team/docs/get-started-postgresql)

### Support Channels
- Railway Discord: [https://discord.gg/railway](https://discord.gg/railway)
- Project Issues: GitHub repository
- Database Health: `/api/health` endpoint

### Performance Resources
- Railway Performance Guide
- PostgreSQL Optimization Tips
- Vector Search Best Practices

---

## 🎉 Migration Complete!

Your Railway PostgreSQL setup is now ready for production. The database includes:

✅ **Enhanced Schema** - Optimized tables with proper relationships  
✅ **Vector Search** - Full RAG capabilities with embeddings  
✅ **Performance Indexes** - Optimized for Railway infrastructure  
✅ **Monitoring Tools** - Built-in health checks and analytics  
✅ **Test Coverage** - Comprehensive validation suite  
✅ **Production Ready** - Railway deployment configuration  

**Next Steps:**
1. Deploy to Railway: `pnpm run railway:deploy`
2. Configure your domain and SSL
3. Set up monitoring alerts
4. Import your production data
5. Configure backup strategies

**Happy coding! 🚀**