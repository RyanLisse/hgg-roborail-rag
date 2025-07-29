-- ==========================================
-- Railway PostgreSQL Database Initialization Script
-- Sets up PostgreSQL for Railway deployment
-- ==========================================

-- Create extensions needed for the application
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enable additional extensions for performance and monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application schema (Railway manages database creation)
-- Note: Railway automatically creates the database, so we don't need to create it

-- Create database user permissions (Railway manages users automatically)
-- Note: Railway provides managed users, but we can create additional roles if needed

-- Performance optimizations for Railway environment
-- These settings are optimized for Railway's infrastructure
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET max_connections = 100; -- Railway optimized
ALTER SYSTEM SET shared_buffers = '128MB'; -- Railway optimized
ALTER SYSTEM SET effective_cache_size = '512MB'; -- Railway optimized
ALTER SYSTEM SET maintenance_work_mem = '32MB'; -- Railway optimized
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '8MB'; -- Railway optimized
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Reload configuration to apply settings
SELECT pg_reload_conf();

-- Create health check function for Railway health checks
CREATE OR REPLACE FUNCTION railway_health_check()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'database', 'healthy',
        'timestamp', now(),
        'version', version(),
        'connections', (SELECT count(*) FROM pg_stat_activity),
        'railway_environment', current_setting('application_name', true),
        'extensions', (
            SELECT json_agg(extname)
            FROM pg_extension
            WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector', 'pg_stat_statements')
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create Railway-specific monitoring views
CREATE OR REPLACE VIEW railway_database_stats AS
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    null_frac,
    avg_width
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY schemaname, tablename, attname;

CREATE OR REPLACE VIEW railway_connection_stats AS
SELECT
    state,
    count(*) as connection_count,
    max(now() - query_start) as longest_query_time,
    max(now() - state_change) as longest_idle_time,
    max(now() - backend_start) as longest_connection_time
FROM pg_stat_activity
WHERE state IS NOT NULL
GROUP BY state
ORDER BY connection_count DESC;

-- Create Railway-specific performance monitoring view
CREATE OR REPLACE VIEW railway_performance_stats AS
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_tup_hot_upd,
    n_live_tup,
    n_dead_tup,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC, idx_scan DESC;

-- Create function to get Railway deployment info
CREATE OR REPLACE FUNCTION railway_deployment_info()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'database_name', current_database(),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'schema_count', (SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')),
        'table_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
        'total_connections', (SELECT count(*) FROM pg_stat_activity),
        'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
        'postgresql_version', version(),
        'uptime', (SELECT date_trunc('second', now() - pg_postmaster_start_time())),
        'checkpoint_write_time', (SELECT checkpoints_timed + checkpoints_req FROM pg_stat_bgwriter)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance on common queries
-- These will be created when tables are available

-- Grant necessary permissions for application operations
-- Note: Railway manages permissions, but we ensure proper access
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT CREATE ON SCHEMA public TO PUBLIC;

-- Set default privileges for future objects created in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO PUBLIC;

-- Create a function to initialize vector store tables if needed
CREATE OR REPLACE FUNCTION initialize_vector_store()
RETURNS void AS $$
BEGIN
    -- This function will be called by the application to set up vector store tables
    -- if they don't already exist
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vector_documents') THEN
        -- Vector documents table will be created by Drizzle migrations
        RAISE NOTICE 'Vector store tables will be created by application migrations';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Log successful Railway initialization
DO $$
BEGIN
    RAISE NOTICE 'Railway PostgreSQL initialization completed successfully at %', now();
    RAISE NOTICE 'Database: %, Extensions: vector, uuid-ossp, pgcrypto, pg_stat_statements', current_database();
    RAISE NOTICE 'Ready for Railway deployment';
END
$$;