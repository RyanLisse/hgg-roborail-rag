# NeonDB Test Branch Setup Guide

This guide explains how to set up and configure a separate NeonDB branch for testing to ensure proper isolation between production and test databases.

## Overview

The project now supports two database configurations:


- **Production/Development**: Main NeonDB database (`neondb`)
- **Testing**: Separate NeonDB branch (`neondb_test`)

## Prerequisites

1. Active NeonDB account with existing database
2. Proper environment variables configured in `.env.local`
3. Node.js and pnpm installed

## NeonDB Branch Setup

### Step 1: Create Test Database Branch

In your NeonDB console:

1. Go to your NeonDB project dashboard
2. Navigate to "Branches" section
3. Click "Create Branch"
4. Name it `test-branch` or similar
5. Set the parent branch as your main branch
6. Copy the new connection string

### Step 2: Update Environment Configuration

The `.env.test` file has been configured with the test database URL pattern:

```bash
# Current configuration in .env.test
DATABASE_URL='postgresql://neondb_owner:npg_09TNDHWMZhzi@ep-late-boat-a8biqbk3-pooler.eastus2.azure.neon.tech/neondb_test?sslmode=require&channel_binding=require'
POSTGRES_URL='postgresql://neondb_owner:npg_09TNDHWMZhzi@ep-late-boat-a8biqbk3-pooler.eastus2.azure.neon.tech/neondb_test?sslmode=require&channel_binding=require'
```

**⚠️ Important**: Replace `neondb_test` with your actual test branch database name from NeonDB.

### Step 3: Update Connection Strings

1. Copy your test branch connection string from NeonDB
2. Update the `.env.test` file with the correct:
   - Database name
   - Host endpoint (if different)
   - Credentials (if different)


Example format:

```
postgresql://[user]:[password]@[host]/[test_database_name]?sslmode=require&channel_binding=require
```

## Database Migration and Setup

### Run Test Database Migration

```bash
# Migrate the test database
pnpm run db:migrate:test

# Or use the combined setup command
pnpm run test:db:setup
```

### Available Database Commands

| Command                    | Description                     |
| -------------------------- | ------------------------------- |
| `pnpm run db:migrate:test` | Run migrations on test database |
| `pnpm run db:studio:test`  | Open Drizzle Studio for test DB |
| `pnpm run db:push:test`    | Push schema to test database    |
| `pnpm run db:check:test`   | Check test database schema      |
| `pnpm run test:db`         | Validate database configuration |
| `pnpm run test:db:setup`   | Full test database setup        |

## Testing Configuration

### Playwright Tests

Playwright tests automatically use the test database configuration from `.env.test`:

```bash
# Run all tests (uses test database)
pnpm test

# Run specific test suites
pnpm test:e2e
pnpm test:traditional
```

### Vitest Unit Tests

Unit tests use mocked database connections by default, but can be configured to use the test database when needed.

## Database Validation

Run the database validation suite to ensure both databases are properly configured:

```bash
# Validate database configuration
pnpm run test:db
```


This will test:

- ✅ Database connectivity
- ✅ SSL/TLS configuration
- ✅ Connection pooling
- ✅ Schema validation
- ✅ Vector extension (pgvector)
- ✅ CRUD operations
- ✅ Performance metrics


## Configuration Files

### Main Database Configuration

- **File**: `drizzle.config.ts`

- **Environment**: `.env.local`
- **Usage**: Development and production

### Test Database Configuration

- **File**: `drizzle.config.test.ts`
- **Environment**: `.env.test`

- **Usage**: Testing and CI/CD

## Best Practices

### 1. Branch Isolation


- Keep test data separate from production
- Use realistic test data volumes
- Regularly clean test database


### 2. Schema Synchronization

- Test database should mirror production schema
- Run migrations on both databases
- Validate schema compatibility

### 3. CI/CD Integration


```bash
# Example CI pipeline commands
pnpm run db:migrate:test
pnpm run test:db
pnpm test
```

### 4. Security


- Use separate credentials for test environment when possible
- Never expose production credentials in test configs
- Ensure SSL is properly configured

## Troubleshooting


### Common Issues

**Connection Refused**

```bash
# Check if the database URL is correct

pnpm run test:db
```

**Migration Errors**

```bash
# Reset test database schema
pnpm run db:push:test
```

**Schema Mismatch**

```bash
# Check schema differences
pnpm run db:check:test
```

### Environment Variables Debug


```bash
# Check loaded environment variables
node -e "
require('dotenv').config({path: '.env.test'});
console.log('POSTGRES_URL:', process.env.POSTGRES_URL?.replace(/:[^:@]*@/, ':***@'));
"
```


## Support

For additional help:

1. Check NeonDB documentation
2. Review Drizzle ORM guides
3. Run `pnpm run test:db` for validation
4. Check logs in `tests/database-validation.js`

---

**Next Steps**: After completing this setup, run `pnpm run test:db:setup` to validate your configuration.
