-- Migration: Complete Railway PostgreSQL setup with enhanced schema
-- This migration ensures full compatibility with Railway deployment

-- Enable required extensions for Railway PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; 
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create enhanced enums for better type safety
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('user', 'admin', 'moderator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chat_visibility AS ENUM ('public', 'private');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system', 'tool');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_kind AS ENUM ('text', 'code', 'image', 'sheet', 'pdf', 'csv');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE feedback_vote AS ENUM ('up', 'down');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE embedding_provider AS ENUM ('openai', 'cohere', 'google', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing User table with Railway enhancements
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS avatar TEXT,
ADD COLUMN IF NOT EXISTS preferences JSON DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update User table type column to use enum
DO $$ BEGIN
    ALTER TABLE "User" ALTER COLUMN type TYPE user_type USING type::user_type;
EXCEPTION
    WHEN invalid_text_representation THEN
        -- Handle existing data that doesn't match enum
        UPDATE "User" SET type = 'user' WHERE type NOT IN ('user', 'admin', 'moderator');
        ALTER TABLE "User" ALTER COLUMN type TYPE user_type USING type::user_type;
END $$;

-- Enhance Chat table
ALTER TABLE "Chat" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS tags JSON DEFAULT '[]',
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Rename columns to match enhanced schema
DO $$ BEGIN
    ALTER TABLE "Chat" RENAME COLUMN "createdAt" TO created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Chat" RENAME COLUMN "userId" TO user_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Update Chat visibility to use enum
DO $$ BEGIN
    ALTER TABLE "Chat" ALTER COLUMN visibility TYPE chat_visibility USING visibility::chat_visibility;
EXCEPTION
    WHEN invalid_text_representation THEN
        UPDATE "Chat" SET visibility = 'private' WHERE visibility NOT IN ('public', 'private');
        ALTER TABLE "Chat" ALTER COLUMN visibility TYPE chat_visibility USING visibility::chat_visibility;
END $$;

-- Enhance Message table
ALTER TABLE "Message" 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES "Message"(id),
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Rename Message columns
DO $$ BEGIN
    ALTER TABLE "Message" RENAME COLUMN "createdAt" TO created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Message" RENAME COLUMN "chatId" TO chat_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Message" RENAME COLUMN "messageId" TO message_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Update Message role to use enum
DO $$ BEGIN
    ALTER TABLE "Message" ALTER COLUMN role TYPE message_role USING role::message_role;
EXCEPTION
    WHEN invalid_text_representation THEN
        UPDATE "Message" SET role = 'user' WHERE role NOT IN ('user', 'assistant', 'system', 'tool');
        ALTER TABLE "Message" ALTER COLUMN role TYPE message_role USING role::message_role;
END $$;

-- Enhance Vote table
ALTER TABLE "Vote" 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES "User"(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Rename Vote columns
DO $$ BEGIN
    ALTER TABLE "Vote" RENAME COLUMN "chatId" TO chat_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Vote" RENAME COLUMN "messageId" TO message_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Vote" RENAME COLUMN "isUpvoted" TO is_upvoted;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Enhance Document table
ALTER TABLE "Document" 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS tags JSON DEFAULT '[]',
ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Rename Document columns
DO $$ BEGIN
    ALTER TABLE "Document" RENAME COLUMN "createdAt" TO created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Document" RENAME COLUMN "userId" TO user_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Update Document kind to use enum
DO $$ BEGIN
    ALTER TABLE "Document" ALTER COLUMN kind TYPE document_kind USING kind::document_kind;
EXCEPTION
    WHEN invalid_text_representation THEN
        UPDATE "Document" SET kind = 'text' WHERE kind NOT IN ('text', 'code', 'image', 'sheet', 'pdf', 'csv');
        ALTER TABLE "Document" ALTER COLUMN kind TYPE document_kind USING kind::document_kind;
END $$;

-- Enhance Embedding table
ALTER TABLE "Embedding" 
ADD COLUMN IF NOT EXISTS cohere_embedding vector(1024),
ADD COLUMN IF NOT EXISTS provider embedding_provider DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Rename Embedding columns
DO $$ BEGIN
    ALTER TABLE "Embedding" RENAME COLUMN "documentId" TO document_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Embedding" RENAME COLUMN "documentCreatedAt" TO document_created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Embedding" RENAME COLUMN "createdAt" TO created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Enhance Suggestion table
ALTER TABLE "Suggestion" 
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS confidence REAL,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES "User"(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Rename Suggestion columns
DO $$ BEGIN
    ALTER TABLE "Suggestion" RENAME COLUMN "documentId" TO document_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Suggestion" RENAME COLUMN "documentCreatedAt" TO document_created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Suggestion" RENAME COLUMN "originalText" TO original_text;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Suggestion" RENAME COLUMN "suggestedText" TO suggested_text;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Suggestion" RENAME COLUMN "isResolved" TO is_resolved;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Suggestion" RENAME COLUMN "userId" TO user_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Suggestion" RENAME COLUMN "createdAt" TO created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Enhance Stream table
ALTER TABLE "Stream" 
ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES "Message"(id),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Rename Stream columns
DO $$ BEGIN
    ALTER TABLE "Stream" RENAME COLUMN "chatId" TO chat_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Stream" RENAME COLUMN "createdAt" TO created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Enhance Feedback table
ALTER TABLE "Feedback" 
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS severity INTEGER,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;

-- Rename Feedback columns
DO $$ BEGIN
    ALTER TABLE "Feedback" RENAME COLUMN "runId" TO run_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Feedback" RENAME COLUMN "messageId" TO message_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Feedback" RENAME COLUMN "userId" TO user_id;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Feedback" RENAME COLUMN "createdAt" TO created_at;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- Update Feedback vote to use enum
DO $$ BEGIN
    ALTER TABLE "Feedback" ALTER COLUMN vote TYPE feedback_vote USING vote::feedback_vote;
EXCEPTION
    WHEN invalid_text_representation THEN
        UPDATE "Feedback" SET vote = 'up' WHERE vote NOT IN ('up', 'down');
        ALTER TABLE "Feedback" ALTER COLUMN vote TYPE feedback_vote USING vote::feedback_vote;
END $$;

-- Enhance vector_documents table
ALTER TABLE vector_documents 
ADD COLUMN IF NOT EXISTS title VARCHAR(500),
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS source VARCHAR(255),
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS cohere_embedding vector(1024),
ADD COLUMN IF NOT EXISTS embedding_provider embedding_provider DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_document_id UUID,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES "User"(id),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP DEFAULT NOW();

-- Create search analytics table for tracking performance
CREATE TABLE IF NOT EXISTS search_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES "User"(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    query TEXT NOT NULL,
    result_count INTEGER DEFAULT 0,
    response_time INTEGER, -- milliseconds
    search_type VARCHAR(50) NOT NULL, -- 'vector', 'text', 'hybrid'
    threshold REAL, -- similarity threshold
    model VARCHAR(100), -- embedding model used
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create performance indexes for all tables

-- User indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON "User" (email);
CREATE INDEX IF NOT EXISTS idx_user_type ON "User" (type);
CREATE INDEX IF NOT EXISTS idx_user_active ON "User" (is_active);
CREATE INDEX IF NOT EXISTS idx_user_created ON "User" (created_at);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON "Chat" (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON "Chat" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_visibility ON "Chat" (visibility);
CREATE INDEX IF NOT EXISTS idx_chat_archived ON "Chat" (is_archived);
CREATE INDEX IF NOT EXISTS idx_chat_user_created ON "Chat" (user_id, created_at DESC);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_message_chat_id ON "Message" (chat_id);
CREATE INDEX IF NOT EXISTS idx_message_role ON "Message" (role);
CREATE INDEX IF NOT EXISTS idx_message_created ON "Message" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_parent ON "Message" (parent_id);
CREATE INDEX IF NOT EXISTS idx_message_chat_created ON "Message" (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_deleted ON "Message" (is_deleted);

-- Vote indexes
CREATE INDEX IF NOT EXISTS idx_vote_message ON "Vote" (message_id);
CREATE INDEX IF NOT EXISTS idx_vote_user ON "Vote" (user_id);
CREATE INDEX IF NOT EXISTS idx_vote_created ON "Vote" (created_at DESC);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_document_user ON "Document" (user_id);
CREATE INDEX IF NOT EXISTS idx_document_kind ON "Document" (kind);
CREATE INDEX IF NOT EXISTS idx_document_created ON "Document" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_public ON "Document" (is_public);
CREATE INDEX IF NOT EXISTS idx_document_user_created ON "Document" (user_id, created_at DESC);

-- Embedding indexes
CREATE INDEX IF NOT EXISTS idx_embedding_document ON "Embedding" (document_id);
CREATE INDEX IF NOT EXISTS idx_embedding_provider ON "Embedding" (provider);
CREATE INDEX IF NOT EXISTS idx_embedding_model ON "Embedding" (model);
CREATE INDEX IF NOT EXISTS idx_embedding_created ON "Embedding" (created_at DESC);

-- Vector similarity indexes (IVFFLAT for better performance)
CREATE INDEX IF NOT EXISTS idx_embedding_openai_cosine 
ON "Embedding" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_embedding_cohere_cosine 
ON "Embedding" USING ivfflat (cohere_embedding vector_cosine_ops) WITH (lists = 100);

-- Suggestion indexes
CREATE INDEX IF NOT EXISTS idx_suggestion_document ON "Suggestion" (document_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_user ON "Suggestion" (user_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_resolved ON "Suggestion" (is_resolved);
CREATE INDEX IF NOT EXISTS idx_suggestion_category ON "Suggestion" (category);
CREATE INDEX IF NOT EXISTS idx_suggestion_created ON "Suggestion" (created_at DESC);

-- Stream indexes
CREATE INDEX IF NOT EXISTS idx_stream_chat ON "Stream" (chat_id);
CREATE INDEX IF NOT EXISTS idx_stream_message ON "Stream" (message_id);
CREATE INDEX IF NOT EXISTS idx_stream_status ON "Stream" (status);
CREATE INDEX IF NOT EXISTS idx_stream_created ON "Stream" (created_at DESC);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_run ON "Feedback" (run_id);
CREATE INDEX IF NOT EXISTS idx_feedback_message ON "Feedback" (message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON "Feedback" (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_vote ON "Feedback" (vote);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON "Feedback" (category);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON "Feedback" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_resolved ON "Feedback" (is_resolved);

-- Vector documents indexes
CREATE INDEX IF NOT EXISTS idx_vector_documents_source ON vector_documents (source);
CREATE INDEX IF NOT EXISTS idx_vector_documents_source_type ON vector_documents (source_type);
CREATE INDEX IF NOT EXISTS idx_vector_documents_provider ON vector_documents (embedding_provider);
CREATE INDEX IF NOT EXISTS idx_vector_documents_model ON vector_documents (embedding_model);
CREATE INDEX IF NOT EXISTS idx_vector_documents_chunk ON vector_documents (chunk_index);
CREATE INDEX IF NOT EXISTS idx_vector_documents_parent ON vector_documents (parent_document_id);
CREATE INDEX IF NOT EXISTS idx_vector_documents_user ON vector_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_vector_documents_public ON vector_documents (is_public);
CREATE INDEX IF NOT EXISTS idx_vector_documents_active ON vector_documents (is_active);
CREATE INDEX IF NOT EXISTS idx_vector_documents_created ON vector_documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vector_documents_indexed ON vector_documents (indexed_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_vector_documents_active_public ON vector_documents (is_active, is_public);
CREATE INDEX IF NOT EXISTS idx_vector_documents_user_active ON vector_documents (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vector_documents_parent_chunk ON vector_documents (parent_document_id, chunk_index);

-- Vector similarity indexes for vector_documents
CREATE INDEX IF NOT EXISTS idx_vector_documents_openai_cosine 
ON vector_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_vector_documents_cohere_cosine 
ON vector_documents USING ivfflat (cohere_embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_vector_documents_content_fts 
ON vector_documents USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_vector_documents_metadata_gin 
ON vector_documents USING gin(metadata);

-- Search analytics indexes
CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_session ON search_analytics (session_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_type ON search_analytics (search_type);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_response_time ON search_analytics (response_time);

-- Create Railway-specific monitoring functions
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
        'extensions', (
            SELECT json_agg(extname)
            FROM pg_extension
            WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector', 'pg_stat_statements')
        ),
        'tables', (
            SELECT count(*)
            FROM information_schema.tables
            WHERE table_schema = 'public'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring view
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
    n_live_tup,
    n_dead_tup,
    vacuum_count,
    autovacuum_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC, idx_scan DESC;

-- Create connection monitoring view
CREATE OR REPLACE VIEW railway_connection_stats AS
SELECT
    state,
    count(*) as connection_count,
    max(now() - query_start) as longest_query_time,
    max(now() - state_change) as longest_idle_time
FROM pg_stat_activity
WHERE state IS NOT NULL
GROUP BY state
ORDER BY connection_count DESC;

-- Update table statistics for better query planning
ANALYZE "User";
ANALYZE "Chat";
ANALYZE "Message";
ANALYZE "Vote";
ANALYZE "Document";
ANALYZE "Embedding";
ANALYZE "Suggestion";
ANALYZE "Stream";
ANALYZE "Feedback";
ANALYZE vector_documents;
ANALYZE search_analytics;

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Railway PostgreSQL setup completed successfully at %', now();
    RAISE NOTICE 'Enhanced schema with improved indexing and monitoring';
    RAISE NOTICE 'Ready for production deployment on Railway';
END
$$;