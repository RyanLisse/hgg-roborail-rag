# Vector Store Testing Scripts

This directory contains comprehensive testing scripts to check your vector store configuration and data availability across multiple vector store systems.

## Overview

The project uses a unified vector store system that supports:
- **OpenAI Vector Store** (`vs_6849955367a88191bf89d7660230325f`) - For RoboRail documentation
- **Neon/pgvector Database** - For custom document embeddings  
- **Memory Storage** - For temporary/session-based documents

## Scripts Available

### 1. Comprehensive Test Suite
```bash
pnpm vectorstore:test
# or
node test-vector-stores.js
```
Runs a complete test of all vector store configurations including:
- Environment variable validation
- OpenAI vector store connectivity and file listing
- Neon database connection and table structure
- Service configuration status

### 2. Summary Report
```bash
pnpm vectorstore:summary
# or  
node vector-store-summary.js
```
Generates a comprehensive report showing:
- Configuration status for all vector stores
- Current data in OpenAI vector store (files, sizes, status)
- Neon database statistics (documents, indexes, table structure)
- Usage recommendations and implementation guide

### 3. OpenAI Vector Store Tests
```bash
pnpm vectorstore:openai
# or
node simple-openai-test.js
```
Simple test to verify OpenAI vector store accessibility via direct API calls.

### 4. File Listing
```bash
pnpm vectorstore:files
# or
node get-vectorstore-files.js
```
Lists all files in the OpenAI vector store with details:
- File IDs and names
- File sizes and upload dates
- Processing status

### 5. Search Functionality Test
```bash
pnpm vectorstore:search
# or
node test-vector-search.js
```
Tests the vector search functionality by:
- Creating a temporary assistant with file_search tool
- Running test queries about RoboRail
- Verifying search results and file references

## Current Configuration Status

### ✅ OpenAI Vector Store
- **ID**: `vs_6849955367a88191bf89d7660230325f`
- **Name**: `roborail-assistant-md`
- **Status**: Active and ready for use
- **Content**: 3 RoboRail documentation files (~915 KB total)
  - FAQ_RoboRail_measurement_v0.0_020524.extraction.md (50 KB)
  - roborail_qa_dataset_no_vectors.json (182 KB)  
  - Operators manual_RoboRail V2.2_170424.extraction.md (307 KB)

### ✅ Neon/pgvector Database
- **Status**: Connected and configured
- **Extension**: pgvector v0.8.0 installed
- **Table**: `vector_documents` exists with proper schema
- **Indexes**: Vector similarity index configured
- **Current Documents**: 0 (ready for uploads)

### ✅ Environment Variables
All required environment variables are properly configured:
- `OPENAI_API_KEY`: Set
- `OPENAI_VECTORSTORE`: Set to `vs_6849955367a88191bf89d7660230325f`
- `POSTGRES_URL`: Set for Neon database

## Usage in Application

### File Search Tool Configuration
```javascript
const fileSearchTool = {
  type: "file_search",
  file_search: {
    vector_store_ids: ["vs_6849955367a88191bf89d7660230325f"]
  }
};
```

### Vector Store Service Usage
The application provides a unified interface through:
- `getOpenAIVectorStoreService()` - For OpenAI vector store operations
- `getNeonVectorStoreService()` - For Neon database operations  
- `getUnifiedVectorStoreService()` - For operations across all vector stores

## Recommended Usage Patterns

1. **OpenAI Vector Store**: Best for existing RoboRail documentation
   - Q&A about operations, calibration, safety procedures
   - Leverages OpenAI's managed vector search
   - Already populated and tested

2. **Neon Database**: Best for custom document uploads
   - Full control over embeddings and metadata
   - Custom similarity search parameters
   - Ideal for user-uploaded documents

3. **Memory Storage**: Best for temporary documents
   - Session-based document storage
   - No persistence required

## Testing Results Summary

✅ **All vector stores are properly configured and functional**

The OpenAI vector store contains relevant RoboRail documentation and successfully responds to search queries about:
- System descriptions and capabilities
- Calibration procedures  
- Safety requirements
- Operational guidelines

The Neon database is ready to receive custom document uploads with full vector search capabilities.

## Troubleshooting

If you encounter issues:

1. **Check environment variables**: Run `pnpm vectorstore:test` to verify configuration
2. **Verify connectivity**: Run `pnpm vectorstore:openai` for OpenAI or check database logs for Neon
3. **Test search functionality**: Run `pnpm vectorstore:search` to verify end-to-end functionality
4. **Review comprehensive status**: Run `pnpm vectorstore:summary` for detailed diagnostics

All scripts include detailed error reporting and colored output for easy debugging.