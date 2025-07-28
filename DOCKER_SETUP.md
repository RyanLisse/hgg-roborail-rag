# Docker Setup Guide

This guide covers containerizing the Next.js RAG Assistant application with Docker for development and production environments.

## 📋 Overview

The Docker setup includes:


- **Multi-stage Dockerfile** optimized for production
- **Development environment** with hot reload
- **Production environment** with security hardening
- **Database and Redis** containerization
- **Health checks** and monitoring
- **Environment-specific configurations**

## 🏗️ Container Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App  │    │   PostgreSQL    │    │     Redis       │
│   (Port 3000)  │◄──►│   (Port 5432)   │    │   (Port 6379)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Docker        │
                    │   Network       │
                    └─────────────────┘
```

## 🚀 Quick Start

### Development Environment


1. **Start the development stack:**

   ```bash
   docker-compose up -d
   ```


2. **View logs:**

   ```bash
   docker-compose logs -f app
   ```<http://localhost:3000>
<http://localhost:8080>
3. **Access services:*<http://localhost:8081>

   - Application: http://localhost:3000

   - Database Admin: http://localhost:8080 (with tools profile)
   - Redis Commander: http://localhost:8081 (with tools profile)

4. **Start with development tools:**
   ```bash
   docker-compose --profile tools up -d
   ```


### Production Environment

1. **Configure environment variables:**

   ```bash

   cp .env.docker .env.production
   # Edit .env.production with your actual values
   ```

2. **Deploy production stack:**


   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

3. **Run database migrations:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec app pnpm db:migrate
   ```

## 📁 File Structure

```
.
├── Dockerfile                    # Multi-stage production build
├── .dockerignore                # Build context optimization
├── docker-compose.yml           # Development environment
├── docker-compose.prod.yml      # Production environment
├── .env.docker                  # Docker environment template
├── scripts/
│   └── init-db.sql             # Database initialization

└── DOCKER_SETUP.md             # This guide
```

## 🐳 Dockerfile Stages


### Stage 1: Dependencies

- Installs pnpm and Node.js dependencies
- Uses Alpine Linux for smaller image size
- Frozen lockfile installation for reproducible builds


### Stage 2: Builder

- Builds the Next.js application
- Optimized for production with tree-shaking
- Includes TypeScript compilation

### Stage 3: Runner (Production)

- Minimal runtime environment
- Non-root user for security
- Health check script included
- Optimized for fast startup

## 🔧 Configuration

### Environment Variables

| Variable         | Description                  | Default      |
| ---------------- | ---------------------------- | ------------ |
| `NODE_ENV`       | Runtime environment          | `production` |

| `PORT`           | Application port             | `3000`       |
| `DATABASE_URL`   | PostgreSQL connection string | Required     |
| `REDIS_URL`      | Redis connection string      | Required     |
| `AUTH_SECRET`    | Authentication secret        | Required     |
| `OPENAI_API_KEY` | OpenAI API key               | Required     |

### Database Configuration


The PostgreSQL container includes:

- **Extensions**: uuid-ossp, pgcrypto, vector
- **Performance tuning** for containerized environment
- **Health check function** for monitoring
- **Automatic initialization** with init-db.sql

### Redis Configuration


The Redis container includes:

- **Persistence** with AOF and RDB
- **Memory optimization** with LRU policy
- **Password protection** in production

- **Health checks** for reliability

## 🔒 Security Features

### Container Security


- **Non-root users** in all containers
- **Read-only filesystems** where possible
- **Resource limits** to prevent abuse
- **Security options** (no-new-privileges)

### Network Security


- **Isolated Docker network** for service communication
- **No direct external access** to database/Redis
- **Environment variable injection** for secrets

### Application Security


- **Secrets management** via environment variables
- **Source map disabled** in production
- **Telemetry disabled** for privacy
- **Security headers** configuration


## 📊 Monitoring & Health Checks

### Application Health Check

```javascript
// Built-in health check endpoint
GET / api / health;
```

### Container Health Checks

- **Application**: HTTP health check every 30s
- **PostgreSQL**: pg_isready check every 10s
- **Redis**: ping command every 10s


### Resource Monitoring

```bash
# View resource usage
docker-compose -f docker-compose.prod.yml top


# Check logs
docker-compose -f docker-compose.prod.yml logs -f app

# Monitor health status
docker-compose -f docker-compose.prod.yml ps

```

## 🚀 Deployment Strategies

### Single Server Deployment


```bash
# Basic production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Load Balanced Deployment

```bash

# Scale application instances

docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

### Rolling Updates


```bash
# Zero-downtime updates
docker-compose -f docker-compose.prod.yml up -d --no-deps app
```


### With Reverse Proxy

```bash
# Deploy with nginx
docker-compose -f docker-compose.prod.yml --profile with-nginx up -d
```

## 🔧 Development Workflow


### Local Development


1. **Start services:**

   ```bash
   docker-compose up -d postgres redis
   ```


2. **Run app locally:**

   ```bash
   pnpm dev
   ```

3. **Database operations:**


   ```bash
   # Run migrations
   pnpm db:migrate

   # Access database
   docker-compose exec postgres psql -U postgres -d roborail_dev
   ```

### Container Development


1. **Start full stack:**

   ```bash
   docker-compose up -d
   ```

2. **Hot reload enabled** via volume mounts
3. **Debug with logs:**

   ```bash
   docker-compose logs -f app
   ```

## 🛠️ Troubleshooting


### Common Issues

**Build Failures:**

```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

**Database Connection Issues:**

```bash
# Check database health
docker-compose exec postgres pg_isready -U postgres

# View database logs
docker-compose logs postgres
```

**Memory Issues:**


```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=8192
```

**Permission Issues:**


```bash
# Fix file permissions
sudo chown -R $USER:$GROUP ./volumes/
```


### Debug Commands

```bash
# Enter container shell
docker-compose exec app sh

# Check environment variables
docker-compose exec app env


# Test database connection
docker-compose exec app node -e "console.log(process.env.DATABASE_URL)"

# View container resources
docker stats
```

## 📈 Performance Optimization


### Build Optimization

- **Multi-stage builds** minimize final image size
- **.dockerignore** reduces build context
- **Layer caching** speeds up rebuilds

- **Alpine images** for smaller footprint

### Runtime Optimization

- **Resource limits** prevent resource contention
- **Health checks** enable automatic recovery
- **Logging limits** prevent disk space issues
- **Connection pooling** in database

### Production Tuning

- **Memory limits** based on actual usage
- **CPU limits** for resource allocation
- **Disk I/O** optimizations

- **Network configuration** tuning

## 🔄 Backup & Recovery

### Database Backup


```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres roborail_prod > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U postgres roborail_prod < backup.sql
```


### Volume Backup

```bash
# Backup volumes
docker run --rm -v roborail_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

### Disaster Recovery

```bash
# Stop services
docker-compose down

# Restore volumes
docker run --rm -v roborail_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /

# Start services
docker-compose up -d

```

## 📝 Best Practices

### Development


1. **Use volume mounts** for hot reload
2. **Separate environment files** for different stages
3. **Enable development tools** with profiles
4. **Regular dependency updates**

### Production

1. **Use specific image tags** instead of `latest`
2. **Set resource limits** for all containers
3. **Enable logging** with rotation
4. **Regular security updates**
5. **Monitor container health**

### Security

1. **Never commit secrets** to version control
2. **Use Docker secrets** for sensitive data
3. **Regular security scanning**
4. **Principle of least privilege**
5. **Network segmentation**

## 🎯 Next Steps

1. **Container Registry**: Push images to Docker Hub/ECR
2. **Orchestration**: Consider Kubernetes for production
3. **CI/CD Integration**: Automate build and deployment
4. **Monitoring**: Add Prometheus/Grafana
5. **Logging**: Centralized logging with ELK stack

---

## 📞 Support

For issues or questions about the Docker setup:

1. Check the troubleshooting section above
2. Review container logs for error messages
3. Verify environment variable configuration
4. Test individual services in isolation

The containerized setup provides a robust, scalable foundation for deploying the Next.js RAG Assistant in any environment that supports Docker.
