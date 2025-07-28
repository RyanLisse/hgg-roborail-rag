# Railway Deployment Guide

This comprehensive guide covers deploying the HGG RoboRail Assistant to Railway
platform with production-ready configuration.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Railway CLI** (optional): `npm install -g @railway/cli`
3. **GitHub Repository**: Repository connected to Railway
4. **Environment Variables**: All required API keys and secrets ready
5. **Database Access**: PostgreSQL with pgvector extension support

## Deployment Steps

### 1. Create New Project

1. Log in to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select this repository

### 2. Configure Services

#### PostgreSQL Database

1. Add a new service → Database → PostgreSQL
2. Railway will automatically create a PostgreSQL instance with pgvector extension
3. Copy the `DATABASE_URL` from the PostgreSQL service

#### Redis Instance

1. Add a new service → Database → Redis
2. Copy the `REDIS_URL` from the Redis service

### 3. Environment Variables

Add the following environment variables to your Railway service:

```bash
# Essential
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
NODE_ENV=production

# Database (auto-configured by Railway)
POSTGRES_URL=${{Postgres.DATABASE_URL}}

# Redis (auto-configured by Railway)
REDIS_URL=${{Redis.REDIS_URL}}

# AI Providers (at least one required)
OPENAI_API_KEY=<your-openai-key>
# ANTHROPIC_API_KEY=<your-anthropic-key>
# GOOGLE_GENERATIVE_AI_API_KEY=<your-google-key>

# Embeddings (required for vector store)
COHERE_API_KEY=<your-cohere-key>

# Storage
BLOB_READ_WRITE_TOKEN=<your-vercel-blob-token>

# Optional: Observability
# LANGCHAIN_TRACING_V2=true
# LANGCHAIN_API_KEY=<your-langsmith-key>
# LANGCHAIN_PROJECT=<your-project-name>
```

### 4. Deploy Configuration

The project includes a `railway.json` configuration file that:

- Runs database migrations during build
- Sets up health checks
- Configures restart policies
- Uses Nixpacks for building

### 5. Deploy

1. Push your code to the connected GitHub branch
2. Railway will automatically deploy using the configuration
3. Monitor the deployment logs in Railway dashboard

### 6. Post-Deployment

1. Check the health endpoint: `https://your-app.railway.app/api/health`
2. Verify database migrations ran successfully
3. Test the application functionality

## Monitoring

- Health check: `/api/health`
- Agent health: `/api/health/agents`
- Vector store monitoring: `/monitoring` (in app)

## Troubleshooting

### Database Connection Issues

- Ensure `POSTGRES_URL` is properly set
- Check if migrations ran during build
- Verify pgvector extension is enabled

### Build Failures

- Check Node.js version compatibility (18.x or higher)
- Ensure all required environment variables are set
- Review build logs for specific errors

### Memory Issues

- Railway provides 8GB RAM by default
- Monitor memory usage in Railway metrics
- Consider scaling if needed

## Scaling

Railway supports:

- Horizontal scaling (multiple instances)
- Automatic HTTPS/SSL
- Custom domains
- Regional deployments

## Cost Optimization

- Use Railway's usage-based pricing
- Monitor resource consumption
- Enable auto-sleep for development environments
- Use caching effectively (Redis)

## Security

- All environment variables are encrypted
- Use Railway's private networking for database connections
- Enable rate limiting (already configured in app)
- Regular security updates via dependabot

## Support

- Railway Discord: <https://discord.gg/railway>
- Railway Docs: <https://docs.railway.app>
- Project Issues: GitHub Issues
