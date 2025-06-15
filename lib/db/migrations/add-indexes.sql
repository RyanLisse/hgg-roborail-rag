-- Database optimization indexes
-- Add strategic indexes to optimize chat message queries

-- Optimize message queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_chatid_created 
ON "Message_v2" (chat_id, created_at) INCLUDE (id, role, parts, attachments);

-- Optimize vote lookups  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vote_messageid
ON "Vote_v2" (message_id) INCLUDE (is_upvoted);

-- Optimize chat queries by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_userid_updated
ON "Chat" (user_id, updated_at) INCLUDE (id, title, visibility);

-- Optimize document queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_userid_created
ON "Document" (user_id, created_at) INCLUDE (id, title, kind);

-- Optimize vector document searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vector_document_content
ON vector_documents USING gin(to_tsvector('english', content));