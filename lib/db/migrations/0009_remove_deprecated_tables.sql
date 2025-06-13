-- Migration: Remove deprecated tables and schemas
-- This migration removes the deprecated Message and Vote tables that have been replaced with Message_v2 and Vote_v2

-- Drop the deprecated Vote table first (has foreign key constraint)
DROP TABLE IF EXISTS "Vote" CASCADE;

-- Drop the deprecated Message table
DROP TABLE IF EXISTS "Message" CASCADE;

-- The migration is safe because:
-- 1. All active applications should be using Message_v2 and Vote_v2
-- 2. Data migration should have been completed in previous migrations
-- 3. CASCADE will clean up any remaining references

-- Note: This is part of the cleanup phase described in the migration guide
-- at https://chat-sdk.dev/docs/migration-guides/message-parts