-- ==========================================
-- Docker Database Initialization Script
-- Sets up PostgreSQL for containerized deployment
-- ==========================================

-- Create extensions needed for the application
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create production database if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'roborail_prod') THEN
        PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE roborail_prod');
    END IF;
END
$$;

-- Connect to the production database
\c roborail_prod;

-- Create extensions in the production database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create database user for the application (if not using default postgres user)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'roborail_user') THEN
        CREATE USER roborail_user WITH PASSWORD 'secure_password_change_in_production';
        GRANT ALL PRIVILEGES ON DATABASE roborail_prod TO roborail_user;
        ALTER USER roborail_user CREATEDB;
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL ON SCHEMA public TO roborail_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO roborail_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO roborail_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO roborail_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO roborail_user;

-- Performance optimizations for containerized environment
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Reload configuration
SELECT pg_reload_conf();

-- Create health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'database', 'healthy',
        'timestamp', now(),
        'version', version(),
        'connections', (SELECT count(*) FROM pg_stat_activity),
        'extensions', (
            SELECT json_agg(extname)
            FROM pg_extension
            WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector')
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create monitoring views for observability
CREATE OR REPLACE VIEW database_stats AS
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public';

CREATE OR REPLACE VIEW connection_stats AS
SELECT
    state,
    count(*) as connection_count,
    max(now() - query_start) as longest_query_time,
    max(now() - state_change) as longest_idle_time
FROM pg_stat_activity
WHERE state IS NOT NULL
GROUP BY state;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully at %', now();
END
$$;