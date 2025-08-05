# Environment Security Configuration Guide

This guide outlines security best practices for managing environment variables in the Railway PostgreSQL migration.

## 🔒 Security Checklist

### Authentication & Secrets
- [ ] `AUTH_SECRET` - Use 32+ character random string generated with `openssl rand -base64 32`
- [ ] Never use default or weak secrets in production
- [ ] Rotate secrets regularly (at least every 90 days)
- [ ] Store secrets in Railway's environment variable dashboard, never in code

### Database Security
- [ ] `DATABASE_URL` - Ensure connection string uses SSL/TLS (Railway handles this automatically)
- [ ] `PGPASSWORD` - Use strong, unique password (Railway generates this automatically)
- [ ] Never expose database credentials in logs or error messages
- [ ] Use connection pooling limits to prevent DoS attacks

### API Keys Management
- [ ] `OPENAI_API_KEY` - Secure with proper scoping and usage limits
- [ ] `COHERE_API_KEY` - Monitor usage and set billing alerts
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` - Use service account keys with minimal permissions
- [ ] Store API keys as Railway secrets, never commit to version control
- [ ] Implement key rotation procedures

### File Storage Security
- [ ] `BLOB_READ_WRITE_TOKEN` - Use time-limited tokens when possible
- [ ] Implement file type validation and size limits
- [ ] Regular audit of uploaded files and storage usage

## 🛡️ Railway-Specific Security Configuration

### Environment Variable Protection
```bash
# ✅ SECURE: Use Railway's built-in variable references
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# ❌ INSECURE: Never hardcode sensitive values
DATABASE_URL=postgresql://user:password@host:port/db
```

### Smart-Spawn Security Settings
```bash
# Secure connection pool configuration
SMART_SPAWN_DB_MAX_CONNECTIONS=20        # Prevent connection exhaustion
SMART_SPAWN_DB_CONNECTION_TIMEOUT=30000  # Timeout to prevent hanging connections
SMART_SPAWN_DB_RETRY_ATTEMPTS=3          # Limited retry attempts
SMART_SPAWN_FALLBACK_MODE=graceful       # Graceful degradation
```

### Production Security Headers
```bash
# Security configuration
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
GENERATE_SOURCEMAP=false
DEBUG=false
```

## 🔍 Security Validation

### Environment Variable Validation
The application validates all environment variables at startup:

1. **Required Variables Check**
   - Ensures all critical variables are present
   - Validates format and length requirements
   - Fails fast with clear error messages

2. **Security Format Validation**
   - OpenAI API keys must start with 'sk-'
   - Vector store IDs must start with 'vs_'
   - Database URLs must use proper PostgreSQL format

3. **Production-Only Validations**
   - Strong secret requirements in production
   - SSL/TLS enforcement for database connections
   - API key format and length validation

### Database Connection Security
```typescript
// Secure connection configuration
const connectionConfig = {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: Number.parseInt(process.env.SMART_SPAWN_DB_MAX_CONNECTIONS || '20', 10),
  idle_timeout: 300,
  connect_timeout: 30,
  prepare: false, // Prevent SQL injection via prepared statements
};
```

## 🚨 Security Monitoring

### Health Check Security
```bash
# Health check configuration
HEALTHCHECK_PATH=/api/health
HEALTHCHECK_TIMEOUT=30
```

### Logging Security
```bash
# Secure logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
```

**Security Note**: Never log sensitive information like passwords, API keys, or personal data.

### Error Handling Security
- Sanitize error messages in production
- Prevent information disclosure through stack traces
- Log security events for monitoring

## 🔐 Secrets Management

### Railway Secrets Management
1. **Use Railway Dashboard**
   ```bash
   # Set secrets via Railway CLI
   railway vars set AUTH_SECRET="your-secure-secret"
   railway vars set OPENAI_API_KEY="sk-your-key"
   ```

2. **Environment Separation**
   - Separate secrets for staging and production
   - Use different API keys for different environments
   - Test with limited-scope keys in development

3. **Access Control**
   - Limit team member access to production secrets
   - Use Railway's role-based access control
   - Regular audit of secret access logs

### Local Development Security
```bash
# .env.local (never commit this file)
AUTH_SECRET="dev-secret-minimum-32-characters-long"
OPENAI_API_KEY="sk-development-key-with-limits"
DATABASE_URL="postgresql://localhost:5432/dev_db"
```

## 🔧 Security Testing

### Automated Security Checks
The CI/CD pipeline includes:

1. **Secret Detection**
   - Scans for accidentally committed secrets
   - Validates environment variable formats
   - Checks for weak or default passwords

2. **Dependency Security**
   - Automated vulnerability scanning
   - Regular dependency updates
   - Security advisory monitoring

3. **Configuration Validation**
   - Environment variable completeness
   - Security header configuration
   - Database connection security

### Manual Security Audits
Regular security reviews should include:

- [ ] Review of all environment variables
- [ ] API key usage and permissions audit
- [ ] Database access pattern analysis
- [ ] File upload security testing
- [ ] Authentication flow security review

## 🚫 Common Security Anti-Patterns

### ❌ What NOT to Do
```bash
# Never commit secrets to version control
AUTH_SECRET=actual-secret-value

# Never use default or weak secrets
AUTH_SECRET=password123
AUTH_SECRET=default-secret

# Never log sensitive information
console.log('Database URL:', process.env.DATABASE_URL)

# Never expose internal URLs or credentials
INTERNAL_API_URL=http://admin:password@internal.service
```

### ✅ Secure Alternatives
```bash
# Use Railway variable references
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Generate strong secrets
AUTH_SECRET=$(openssl rand -base64 32)

# Use secure logging
logger.info('Database connection established', { host: 'masked' })

# Use proper service discovery
INTERNAL_API_URL=${{InternalService.URL}}
```

## 🔄 Security Maintenance

### Regular Security Tasks
1. **Monthly**
   - Review access logs
   - Update dependencies with security patches
   - Validate backup procedures

2. **Quarterly**
   - Rotate API keys and secrets
   - Security configuration review
   - Penetration testing of public endpoints

3. **Annually**
   - Complete security audit
   - Update security policies
   - Team security training

### Incident Response Plan
1. **Secret Compromise**
   - Immediately rotate affected secrets
   - Review access logs for unauthorized usage
   - Update all affected environments

2. **Database Breach**
   - Change all database credentials
   - Review database access logs
   - Implement additional access controls

3. **API Key Abuse**
   - Revoke and replace API keys
   - Implement rate limiting
   - Monitor usage patterns

## 📋 Security Compliance

### Data Protection
- Encrypt sensitive data at rest
- Use TLS for all data in transit
- Implement proper data retention policies
- Regular data backup and recovery testing

### Access Control
- Principle of least privilege
- Regular access review and cleanup
- Multi-factor authentication for admin access
- Audit trails for all configuration changes

### Monitoring & Alerting
- Real-time security monitoring
- Automated alerting for security events
- Regular security log analysis
- Performance and availability monitoring

## 🆘 Emergency Procedures

### Security Incident Response
1. **Immediate Actions**
   ```bash
   # Rotate all secrets immediately
   railway vars set AUTH_SECRET="$(openssl rand -base64 32)"
   railway vars set OPENAI_API_KEY="new-secure-key"
   
   # Review and revoke access
   railway team list
   railway access revoke user@example.com
   ```

2. **Investigation**
   - Review Railway deployment logs
   - Check database access logs
   - Analyze API usage patterns
   - Document timeline of events

3. **Recovery**
   - Update all affected systems
   - Notify affected users if necessary
   - Implement additional security measures
   - Post-incident review and improvements

## 📚 Additional Resources

- [Railway Security Documentation](https://docs.railway.app/deploy/security)
- [OWASP Environment Configuration Guidelines](https://owasp.org/www-project-configuration/)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [Next.js Security Guidelines](https://nextjs.org/docs/going-to-production#security)

---

**Remember**: Security is an ongoing process, not a one-time setup. Regular reviews and updates are essential for maintaining a secure environment.