-- Supabase Database Initialization Script
-- This script sets up the complete Supabase database schema for Railway deployment

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create Supabase schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS supabase_functions;

-- Set up search path
ALTER DATABASE supabase SET search_path = public, extensions;

-- Create Supabase roles
DO $$
BEGIN
    -- Anonymous role for public access
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    
    -- Authenticated role for logged-in users
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    
    -- Service role for admin access
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    
    -- Supabase admin role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin NOLOGIN NOINHERIT CREATEDB CREATEROLE REPLICATION BYPASSRLS;
    END IF;
    
    -- PostgREST authenticator role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOINHERIT LOGIN;
    END IF;
    
    -- Realtime role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
        CREATE ROLE supabase_realtime_admin NOLOGIN NOINHERIT CREATEDB CREATEROLE REPLICATION BYPASSRLS;
    END IF;
END
$$;

-- Grant basic permissions to roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Grant permissions to authenticator role
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Set up Row Level Security defaults
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Auth schema setup
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aud VARCHAR(255) DEFAULT 'authenticated',
    role VARCHAR(255) DEFAULT 'authenticated',
    email VARCHAR(255) UNIQUE,
    encrypted_password VARCHAR(255),
    email_confirmed_at TIMESTAMPTZ,
    invited_at TIMESTAMPTZ,
    confirmation_token VARCHAR(255),
    confirmation_sent_at TIMESTAMPTZ,
    recovery_token VARCHAR(255),
    recovery_sent_at TIMESTAMPTZ,
    email_change_token_new VARCHAR(255),
    email_change VARCHAR(255),
    email_change_sent_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    is_super_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    phone VARCHAR(15) UNIQUE,
    phone_confirmed_at TIMESTAMPTZ,
    phone_change VARCHAR(15),
    phone_change_token VARCHAR(255),
    phone_change_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current VARCHAR(255) DEFAULT '',
    email_change_confirm_status SMALLINT DEFAULT 0,
    banned_until TIMESTAMPTZ,
    reauthentication_token VARCHAR(255),
    reauthentication_sent_at TIMESTAMPTZ,
    is_sso_user BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

-- Create indexes for auth.users
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);
CREATE INDEX IF NOT EXISTS users_phone_idx ON auth.users (phone);
CREATE INDEX IF NOT EXISTS confirmation_token_idx ON auth.users (confirmation_token) WHERE confirmation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS recovery_token_idx ON auth.users (recovery_token) WHERE recovery_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_change_token_current_idx ON auth.users (email_change_token_current) WHERE email_change_token_current <> '';
CREATE INDEX IF NOT EXISTS email_change_token_new_idx ON auth.users (email_change_token_new) WHERE email_change_token_new IS NOT NULL;
CREATE INDEX IF NOT EXISTS reauthentication_token_idx ON auth.users (reauthentication_token) WHERE reauthentication_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_is_sso_user_idx ON auth.users (is_sso_user);

-- Auth instances table
CREATE TABLE IF NOT EXISTS auth.instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uuid UUID,
    raw_base_config TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auth refresh tokens table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    instance_id UUID,
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    parent VARCHAR(255),
    session_id UUID
);

CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_idx ON auth.refresh_tokens (instance_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens (instance_id, user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_parent_idx ON auth.refresh_tokens (parent);
CREATE INDEX IF NOT EXISTS refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens (session_id, revoked);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens (token);

-- Storage schema setup
CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    public BOOLEAN DEFAULT false,
    avif_autodetection BOOLEAN DEFAULT false,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id),
    name TEXT,
    owner UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
    version TEXT,
    owner_id TEXT
);

-- Storage indexes
CREATE INDEX IF NOT EXISTS objects_bucket_id_idx ON storage.objects (bucket_id);
CREATE INDEX IF NOT EXISTS objects_name_idx ON storage.objects (name);
CREATE INDEX IF NOT EXISTS objects_owner_idx ON storage.objects (owner);

-- Realtime schema setup
CREATE TABLE IF NOT EXISTS _realtime.subscription (
    id BIGSERIAL PRIMARY KEY,
    subscription_id UUID NOT NULL,
    entity REGCLASS NOT NULL,
    filters REALTIME.user_defined_filter[] DEFAULT '{}',
    claims JSONB,
    claims_role REGROLE GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create RLS policies for auth tables
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for storage
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create some default RLS policies
CREATE POLICY "Users can view own user data" ON auth.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own user data" ON auth.users
    FOR UPDATE USING (auth.uid() = id);

-- Storage policies
CREATE POLICY "Bucket access for authenticated users" ON storage.buckets
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Object access for authenticated users" ON storage.objects
    FOR ALL USING (auth.role() = 'authenticated');

-- Create utility functions
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT 
    COALESCE(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT 
    COALESCE(
      current_setting('request.jwt.claim.role', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
    )::text
$$;

-- Create health check function
CREATE OR REPLACE FUNCTION public.railway_health_check()
RETURNS TABLE(
    status TEXT,
    database_name TEXT,
    extensions_enabled TEXT[],
    schemas_available TEXT[],
    tables_count INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        'healthy'::TEXT as status,
        current_database() as database_name,
        ARRAY(SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pgjwt', 'vector')) as extensions_enabled,
        ARRAY(SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('public', 'auth', 'storage', '_realtime', 'extensions')) as schemas_available,
        (SELECT COUNT(*)::INTEGER FROM information_schema.tables WHERE table_schema = 'public') as tables_count;
$$;

-- Create deployment info function
CREATE OR REPLACE FUNCTION public.railway_deployment_info()
RETURNS TABLE(
    deployment_timestamp TIMESTAMPTZ,
    supabase_version TEXT,
    postgres_version TEXT,
    database_size TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        now() as deployment_timestamp,
        'self-hosted-railway'::TEXT as supabase_version,
        version() as postgres_version,
        pg_size_pretty(pg_database_size(current_database())) as database_size;
$$;

-- Grant execute permissions on utility functions
GRANT EXECUTE ON FUNCTION public.railway_health_check() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.railway_deployment_info() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

-- Set up schema permissions
GRANT ALL ON SCHEMA auth TO supabase_admin;
GRANT ALL ON SCHEMA storage TO supabase_admin;
GRANT ALL ON SCHEMA _realtime TO supabase_realtime_admin;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_admin;
GRANT ALL ON ALL TABLES IN SCHEMA _realtime TO supabase_realtime_admin;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA _realtime TO supabase_realtime_admin;

-- Create a simple test table for validation
CREATE TABLE IF NOT EXISTS public.railway_test (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on test table
ALTER TABLE public.railway_test ENABLE ROW LEVEL SECURITY;

-- Create policy for test table
CREATE POLICY "Test table access for authenticated users" ON public.railway_test
    FOR ALL USING (auth.role() = 'authenticated');

-- Insert test data
INSERT INTO public.railway_test (name) VALUES ('Railway Supabase Deployment Test') ON CONFLICT DO NOTHING;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE '✅ Supabase database initialization completed successfully';
    RAISE NOTICE '📊 Database: %, Extensions: uuid-ossp, pgcrypto, pgjwt, vector', current_database();
    RAISE NOTICE '🔒 Schemas created: auth, storage, _realtime, extensions';
    RAISE NOTICE '👥 Roles configured: anon, authenticated, service_role, supabase_admin';
    RAISE NOTICE '🚀 Ready for Supabase services connection';
END
$$;