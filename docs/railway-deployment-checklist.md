# Railway Deployment Checklist

Use this checklist to ensure a successful Railway deployment.

## Pre-Deployment Checklist

### 1. Environment Setup


- [ ] **Railway Account**: Created and verified
- [ ] **Project Repository**: Connected to Railway via GitHub
- [ ] **Local Environment**: All environment variables working locally
- [ ] **Dependencies**: All required API keys obtained


### 2. Required Services Setup

- [ ] **PostgreSQL Database**: Added to Railway project
- [ ] **Redis Instance**: Added to Railway project (recommended)
- [ ] **Domain Configuration**: Custom domain configured (optional)


### 3. Environment Variables Configuration

- [ ] **AUTH_SECRET**: Generated with `openssl rand -base64 32`
- [ ] **POSTGRES_URL**: Set to `${{Postgres.DATABASE_URL}}`
- [ ] **REDIS_URL**: Set to `${{Redis.REDIS_URL}}`
- [ ] **AI Provider Keys**: At least one AI provider API key configured
- [ ] **COHERE_API_KEY**: Required for embeddings and vector store

- [ ] **BLOB_READ_WRITE_TOKEN**: Configured for file uploads (optional)

### 4. Code Preparation

- [ ] **Package.json**: `build:railway` script exists
- [ ] **Database Migrations**: All migrations in `lib/db/migrations/` folder
- [ ] **Health Endpoints**: `/api/health` and `/api/health/agents` working
- [ ] **Railway Config**: `railway.json` and `nixpacks.toml` present
- [ ] **Git Status**: All changes committed and pushed


## Deployment Process

### 1. Initial Deployment

- [ ] **Deploy**: Trigger deployment in Railway dashboard

- [ ] **Build Logs**: Monitor build process for errors
- [ ] **Migration Check**: Verify database migrations ran successfully
- [ ] **Service Status**: All services show as "Active"

### 2. Post-Deployment Verification

- [ ] **Health Check**: Visit `https://your-app.railway.app/api/health`
- [ ] **Agent Health**: Visit `https://your-app.railway.app/api/health/agents`

- [ ] **Database Connection**: Verify database connectivity in health check
- [ ] **AI Providers**: Test chat functionality with all configured providers
- [ ] **Vector Store**: Upload a test document and verify search works
- [ ] **File Upload**: Test file upload functionality (if enabled)

### 3. Monitoring Setup

- [ ] **Health Checks**: Railway health checks configured and passing

- [ ] **Metrics**: Review Railway metrics dashboard
- [ ] **Logs**: Check application logs for errors
- [ ] **Performance**: Monitor response times and resource usage

## Environment Variables Validation

### Core Requirements ✅

```bash
# Required for app functionality
NODE_ENV=production
AUTH_SECRET=[32-character-secret]
POSTGRES_URL=${{Postgres.DATABASE_URL}}

# At least one AI provider
OPENAI_API_KEY=sk-...

# OR GOOGLE_GENERATIVE_AI_API_KEY=...
# OR ANTHROPIC_API_KEY=...

# Required for vector store
COHERE_API_KEY=...
```

### Optional but Recommended ⚠️

```bash
# Caching and performance
REDIS_URL=${{Redis.REDIS_URL}}

# File storage
BLOB_READ_WRITE_TOKEN=...

# Monitoring
LANGCHAIN_TRACING_V2=true

LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=railway-production
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Build Failures


- **Issue**: `pnpm install` fails

  - **Solution**: Check `pnpm-lock.yaml` is committed
  - **Solution**: Verify Node.js version in `nixpacks.toml`

- **Issue**: Database migration errors
  - **Solution**: Check `POSTGRES_URL` environment variable
  - **Solution**: Verify PostgreSQL service is running
  - **Solution**: Check migration files in `lib/db/migrations/`

#### Runtime Errors


- **Issue**: Health check returns 503

  - **Solution**: Check environment variable validation
  - **Solution**: Verify all required API keys are set
  - **Solution**: Check database connectivity

- **Issue**: AI providers not working
  - **Solution**: Validate API key format (OpenAI starts with `sk-`)
  - **Solution**: Check provider availability in health endpoint
  - **Solution**: Test API keys locally first

#### Performance Issues


- **Issue**: Slow response times

  - **Solution**: Enable Redis caching
  - **Solution**: Check database query performance
  - **Solution**: Monitor Railway metrics for resource usage


- **Issue**: Memory errors
  - **Solution**: Check Smart-Spawn configuration
  - **Solution**: Optimize database connection pool
  - **Solution**: Consider upgrading Railway plan

## Security Checklist


### Environment Security

- [ ] **Secrets**: No API keys in source code
- [ ] **AUTH_SECRET**: Strong, randomly generated secret
- [ ] **HTTPS**: Railway automatic HTTPS enabled
- [ ] **Environment Isolation**: Production variables separate from development


### Application Security

- [ ] **Rate Limiting**: Configured and tested
- [ ] **Input Validation**: Environment variable validation working
- [ ] **Error Handling**: No sensitive information in error messages
- [ ] **Dependencies**: Security audit passed (`npm audit`)


## Performance Optimization

### Railway Configuration

- [ ] **Region**: Optimal region selected (us-west1 recommended)
- [ ] **Health Checks**: Configured for fast response

- [ ] **Restart Policy**: Set to ON_FAILURE with max 3 retries
- [ ] **Build Caching**: Enabled for faster deployments

### Application Optimization

- [ ] **Database Connections**: Smart-Spawn configuration optimized
- [ ] **Redis Caching**: Enabled for vector store and sessions
- [ ] **Bundle Size**: Next.js build optimized
- [ ] **Static Assets**: Properly configured for CDN

## Monitoring and Maintenance

### Health Monitoring

- [ ] **Automated Checks**: Railway health checks configured
- [ ] **Custom Monitoring**: Set up external uptime monitoring
- [ ] **Error Tracking**: Configure error reporting service
- [ ] **Performance Monitoring**: Set up APM if needed

### Regular Maintenance

- [ ] **Dependency Updates**: Regular security updates
- [ ] **Database Maintenance**: Monitor storage and performance
- [ ] **Log Rotation**: Configure log retention policies
- [ ] **Backup Strategy**: Database backup verification

## Success Criteria

Your deployment is successful when:

✅ **Health endpoints return 200 OK**
✅ **Chat functionality works with all AI providers**
✅ **Vector store search returns results**
✅ **File upload and processing works**
✅ **Database connections are stable**
✅ **Response times are under 2 seconds**
✅ **Error rate is below 1%**
✅ **All required environment variables validated**

## Quick Command Reference

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Test local build
pnpm build:railway

# Check health endpoint
curl https://your-app.railway.app/api/health


# View Railway logs
railway logs

# Connect to database
railway connect postgres

# Deploy with Railway CLI
railway up
```

## Support Resources

- **Railway Documentation**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Project Issues**: Create GitHub issue with deployment logs
- **Health Endpoints**: `/api/health` and `/api/health/agents`

---

**Note**: Keep this checklist updated as your deployment requirements change.
Save a copy of successful configurations for future deployments.
