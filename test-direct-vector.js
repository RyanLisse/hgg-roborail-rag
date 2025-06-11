#!/usr/bin/env node

/**
 * Direct test of vector store functionality
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testUnifiedVectorStore() {
  console.log('🧪 Testing Unified Vector Store Service...');
  
  try {
    // Import the unified service
    const { getUnifiedVectorStoreService } = await import('./lib/vectorstore/unified.ts');
    
    const vectorStoreService = await getUnifiedVectorStoreService();
    
    console.log('✅ Unified vector store service created');
    
    // Test available sources
    const availableSources = await vectorStoreService.getAvailableSources();
    console.log('📊 Available sources:', availableSources);
    
    // Test source stats
    const sourceStats = await vectorStoreService.getSourceStats();
    console.log('📈 Source stats:', JSON.stringify(sourceStats, null, 2));
    
    // Test search functionality
    console.log('🔍 Testing search functionality...');
    const searchResults = await vectorStoreService.searchDocuments('test query', {
      sources: ['neon', 'memory'],
      limit: 5
    });
    console.log('🔍 Search results:', searchResults.length, 'documents found');
    
    console.log('✅ All unified vector store tests passed!');
    
  } catch (error) {
    console.error('❌ Unified vector store test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testUnifiedVectorStore();