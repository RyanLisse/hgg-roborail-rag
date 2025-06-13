#!/usr/bin/env node

/**
 * Test Vector Store API Endpoints
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testAPI() {
  try {
    console.log('🧪 Testing Vector Store API...');
    
    const response = await fetch('http://localhost:3000/api/vectorstore/sources');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Response:', JSON.stringify(data, null, 2));
    
    if (data.sourceStats?.openai?.count) {
      console.log(`✅ OpenAI Vector Store has ${data.sourceStats.openai.count} files`);
    } else {
      console.log('⚠️ OpenAI Vector Store shows 0 files');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();