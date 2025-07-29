# Railway PostgreSQL Migration Guide

This guide covers the complete migration from Supabase to Railway PostgreSQL for the RRA (RoboRail Assistant) project.

## Overview

The migration updates the entire application stack to use Railway's managed PostgreSQL service instead of Supabase, while maintaining all existing functionality including vector search capabilities.

## Key Changes

### 1. Environment Configuration (`lib/env.ts`)

**Removed:**
- Supabase-specific environment variables
- `supabaseConfig` helper object
- Supabase service keys and URLs

**Added:**
- Railway PostgreSQL connection variables
- `railwayConfig` helper object with connection details
- Railway platform-specific configuration
- Enhanced database connection handling

### 2. Railway Configuration (`railway.json`)

**Added:**
- PostgreSQL service definition using `postgres:15-alpine`
- Service dependencies (web depends on postgres)
- Volume mounting for data persistence
- Environment variables for database configuration
- Proper restart policies for database service

### 3. Database Migration Scripts

**New Files:**
- `scripts/railway-db-init.sql` - Railway-specific database initialization
- `scripts/railway-migration-helper.js` - Automated migration assistant

**Features:**
- PostgreSQL extensions setup (uuid-ossp, pgcrypto, vector)
- Performance optimizations for Railway environment
- Health check functions for monitoring
- Railway-specific monitoring views

### 4. Environment Documentation (`.env.example`)

**Updated:**
- Railway PostgreSQL connection examples
- Removed Supabase references
- Added Railway platform variables
- Clear documentation for each variable type

## Migration Steps

### 1. Automatic Migration

Use the provided migration helper script:

```bash
node scripts/railway-migration-helper.js
```

This script will:
- ✅ Validate project structure
- ✅ Check environment configuration
- ✅ Test database connection
- ✅ Run database migrations
- ✅ Initialize Railway PostgreSQL
- ✅ Validate Railway configuration
- ✅ Generate deployment checklist

### 2. Manual Migration Steps

If you prefer manual migration:

#### Step 1: Update Environment Variables

1. Copy `.env.example` to `.env.local`
2. Update database connection variables:

```bash
# Primary Railway PostgreSQL connection
DATABASE_URL=postgresql://user:password@host:port/database

# Alternative format (fallback)
POSTGRES_URL=postgresql://user:password@host:port/database

# Railway-managed connection details (auto-provided)
PGHOST=your-railway-host
PGPORT=5432
PGUSER=your-railway-user
PGPASSWORD=your-railway-password
PGDATABASE=your-railway-database

# Railway platform info (auto-provided)
RAILWAY_ENVIRONMENT=production
RAILWAY_PROJECT_ID=your-project-id
RAILWAY_SERVICE_ID=your-service-id
```

#### Step 2: Initialize Database

Run the Railway database initialization:

```bash
# If psql is available
psql "$DATABASE_URL" -f scripts/railway-db-init.sql

# Or during Railway deployment, this runs automatically
```

#### Step 3: Run Migrations

Apply database schema migrations:

```bash
# Generate and apply migrations
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

#### Step 4: Test Configuration

Verify the setup works:

```bash
npm run build
npm run test
```

## Configuration Details

### Database Connection

The application now supports multiple connection formats:

1. **Railway DATABASE_URL** (preferred): Automatically provided by Railway
2. **Manual POSTGRES_URL**: For custom or external PostgreSQL instances
3. **Individual components**: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

### Vector Store Support

Railway PostgreSQL maintains full vector search capabilities:

- **pgvector extension**: Enabled automatically
- **Embedding dimensions**: 1536 (OpenAI compatible)
- **Search algorithms**: Cosine similarity, L2 distance
- **Performance**: Optimized for Railway's infrastructure

### Health Checks

Multiple health check endpoints available:

- `/api/health` - Application health
- `/api/health/database` - Database connectivity
- Custom SQL functions for detailed monitoring

## Environment Variables Reference

### Required Variables

```bash
# Authentication
AUTH_SECRET=your-auth-secret

# Database (at least one required)
DATABASE_URL=postgresql://...  # Railway managed
POSTGRES_URL=postgresql://...  # Alternative

# AI Provider (at least one required)
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### Optional Railway Variables

```bash
# Railway Platform (auto-provided in production)
RAILWAY_ENVIRONMENT=production
RAILWAY_PROJECT_ID=...
RAILWAY_SERVICE_ID=...

# Individual PostgreSQL components (auto-provided)
PGHOST=...
PGPORT=5432
PGUSER=...
PGPASSWORD=...
PGDATABASE=...
```

### Other Optional Variables

```bash
# File Storage
BLOB_READ_WRITE_TOKEN=...

# Caching
REDIS_URL=...

# Monitoring
LANGSMITH_API_KEY=...
LANGSMITH_TRACING=true

# Testing
PLAYWRIGHT_TEST_BASE_URL=...
```

## Railway Deployment

### 1. Railway Project Setup

1. Create new Railway project
2. Add PostgreSQL service:
   ```bash
   railway add postgresql
   ```
3. Connect your Git repository
4. Configure environment variables in Railway dashboard

### 2. Service Configuration

The `railway.json` file includes:

- **Web service**: Your Next.js application
- **PostgreSQL service**: Managed PostgreSQL 15
- **Dependencies**: Web service depends on PostgreSQL
- **Volumes**: Persistent storage for database data

### 3. Deployment Process

1. Push changes to your repository
2. Railway automatically builds and deploys
3. PostgreSQL service starts first
4. Web service connects to database
5. Health checks verify functionality

## Testing

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm run test

# Build application
npm run build

# Start development server
npm run dev
```

### Production Testing

After Railway deployment:

1. Check health endpoints
2. Test vector search functionality
3. Verify database connections
4. Monitor performance metrics

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check environment variables
echo $DATABASE_URL
echo $POSTGRES_URL

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1"
```

#### Missing Extensions

```bash
# Connect to database and check extensions
psql "$DATABASE_URL" -c "SELECT * FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pgcrypto')"
```

#### Migration Errors

```bash
# Reset and rerun migrations
npx drizzle-kit drop
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

### Railway-Specific Issues

#### Service Dependencies

Ensure web service depends on PostgreSQL:
```json
{
  "name": "web",
  "dependencies": ["postgres"]
}
```

#### Environment Variables

Check Railway dashboard for correct variable names and values.

#### Volume Mounting

Verify PostgreSQL data persistence:
```json
{
  "volumes": [
    {
      "name": "postgres-data",
      "mountPath": "/var/lib/postgresql/data"
    }
  ]
}
```

## Performance Optimization

### Database Settings

Railway-optimized PostgreSQL settings:
- `max_connections = 100`
- `shared_buffers = 128MB`
- `effective_cache_size = 512MB`
- `maintenance_work_mem = 32MB`

### Vector Search Optimization

- Proper indexing on vector columns
- Optimized similarity thresholds
- Efficient embedding generation
- Batch processing for multiple documents

### Application Optimization

- Connection pooling
- Query optimization
- Caching strategies
- Performance monitoring

## Monitoring and Maintenance

### Health Monitoring

Built-in monitoring functions:
- `railway_health_check()` - Overall health
- `railway_deployment_info()` - Deployment status
- Performance views for query analysis

### Logging

Comprehensive logging for:
- Database connections
- Vector search operations
- Migration processes
- Error tracking

### Backup Strategy

Railway provides:
- Automatic backups
- Point-in-time recovery
- Volume snapshots
- Cross-region replication options

## Support and Resources

### Documentation

- [Railway PostgreSQL Documentation](https://docs.railway.app/databases/postgresql)
- [pgvector Extension Guide](https://github.com/pgvector/pgvector)
- [Drizzle ORM Railway Guide](https://orm.drizzle.team/docs/get-started-postgresql)

### Troubleshooting Resources

- Railway Community Discord
- GitHub Issues for this project
- PostgreSQL documentation
- Vector search optimization guides

---

## Migration Checklist

Use this checklist to ensure complete migration:

- [ ] Environment variables updated
- [ ] Database connection tested
- [ ] Migrations applied successfully
- [ ] Vector search functionality verified
- [ ] Health checks passing
- [ ] Railway configuration validated
- [ ] Application builds without errors
- [ ] All tests passing
- [ ] Production deployment successful
- [ ] Monitoring and logging active

---

*This migration maintains full compatibility with existing functionality while providing the benefits of Railway's managed PostgreSQL service.*