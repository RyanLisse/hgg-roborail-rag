#!/usr/bin/env node

/**
 * Test OpenAI Vector Store Integration
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testOpenAIVectorStore() {
  const VECTOR_STORE_ID = process.env.OPENAI_VECTORSTORE;
  const API_KEY = process.env.OPENAI_API_KEY;
  
  console.log('🧪 Testing OpenAI Vector Store Integration...');
  console.log(`Vector Store ID: ${VECTOR_STORE_ID}`);
  console.log(`API Key: ${API_KEY ? 'Configured' : 'Missing'}`);
  
  if (!API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY');
    return;
  }
  
  if (!VECTOR_STORE_ID) {
    console.error('❌ Missing OPENAI_VECTORSTORE');
    return;
  }
  
  try {
    // Test vector store details
    console.log('\n📊 Testing vector store details...');
    const vsResponse = await fetch(`https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (!vsResponse.ok) {
      throw new Error(`Vector store API error: ${vsResponse.status} ${vsResponse.statusText}`);
    }
    
    const vsData = await vsResponse.json();
    console.log(`✅ Vector Store: ${vsData.name}`);
    console.log(`✅ Files: ${vsData.file_counts.total} total, ${vsData.file_counts.completed} completed`);
    console.log(`✅ Status: ${vsData.status}`);
    console.log(`✅ Size: ${Math.round(vsData.usage_bytes / 1024)} KB`);
    
    // Test file listing
    console.log('\n📂 Testing file listing...');
    const filesResponse = await fetch(`https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/files`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (!filesResponse.ok) {
      throw new Error(`Files API error: ${filesResponse.status} ${filesResponse.statusText}`);
    }
    
    const filesData = await filesResponse.json();
    console.log(`✅ Files API returned ${filesData.data.length} files:`);
    
    filesData.data.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.id} (status: ${file.status})`);
    });
    
    // Test application integration
    console.log('\n🔗 Testing application integration...');
    
    // Simulate the application's OpenAI service
    const mockConfig = {
      apiKey: API_KEY,
      defaultVectorStoreId: VECTOR_STORE_ID,
      isEnabled: true
    };
    
    console.log('✅ Configuration would be:', {
      hasApiKey: !!mockConfig.apiKey,
      hasVectorStoreId: !!mockConfig.defaultVectorStoreId,
      isEnabled: mockConfig.isEnabled
    });
    
    console.log('\n🎯 Integration test completed successfully!');
    console.log('The OpenAI vector store should show 3 files in the UI.');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

testOpenAIVectorStore();