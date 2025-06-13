-- Migration: Optimize database indexes for vector store operations
-- This migration adds indexes to improve query performance

-- Index for vector similarity searches (most important for performance)
CREATE INDEX IF NOT EXISTS idx_vector_documents_embedding 
ON vector_documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for content filtering
CREATE INDEX IF NOT EXISTS idx_vector_documents_content_text 
ON vector_documents USING gin(to_tsvector('english', content));

-- Index for metadata queries
CREATE INDEX IF NOT EXISTS idx_vector_documents_metadata 
ON vector_documents USING gin(metadata);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_vector_documents_created_at 
ON vector_documents (created_at DESC);

-- Index for updates
CREATE INDEX IF NOT EXISTS idx_vector_documents_updated_at 
ON vector_documents (updated_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_vector_documents_created_metadata 
ON vector_documents (created_at DESC, metadata);

-- Optimize existing tables for better performance

-- Index for chat messages by chat ID and creation time
CREATE INDEX IF NOT EXISTS idx_message_v2_chat_created 
ON "Message_v2" (chatId, createdAt DESC);

-- Index for feedback queries
CREATE INDEX IF NOT EXISTS idx_feedback_message_user 
ON "Feedback" (messageId, userId, createdAt DESC);

-- Index for user's documents
CREATE INDEX IF NOT EXISTS idx_document_user_created 
ON "Document" (userId, createdAt DESC);

-- Index for suggestions by document
CREATE INDEX IF NOT EXISTS idx_suggestion_document_resolved 
ON "Suggestion" (documentId, isResolved, createdAt DESC);

-- Update table statistics for better query planning
ANALYZE vector_documents;
ANALYZE "Message_v2";
ANALYZE "Feedback";
ANALYZE "Document";
ANALYZE "Suggestion";