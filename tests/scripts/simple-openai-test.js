#!/usr/bin/env node

/**
 * Simple OpenAI Vector Store Test
 * Direct API call to check vector store accessibility
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const VECTOR_STORE_ID = process.env.OPENAI_VECTORSTORE;
const API_KEY = process.env.OPENAI_API_KEY;

async function testVectorStoreAPI() {
  if (!API_KEY) {
    console.log('❌ OPENAI_API_KEY not found');
    return;
  }

  if (!VECTOR_STORE_ID) {
    console.log('❌ OPENAI_VECTORSTORE not found');
    return;
  }

  console.log(`🧪 Testing vector store: ${VECTOR_STORE_ID}`);

  try {
    // Direct fetch to OpenAI API
    const response = await fetch(
      `https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
      },
    );

    if (response.ok) {
      const vectorStore = await response.json();
      console.log('✅ Vector store retrieved successfully!');
      console.log(JSON.stringify(vectorStore, null, 2));
    } else {
      const error = await response.text();
      console.log(
        `❌ Failed to retrieve vector store: ${response.status} ${response.statusText}`,
      );
      console.log(error);
    }
  } catch (error) {
    console.log(`❌ Error making API call: ${error.message}`);
  }
}

testVectorStoreAPI().catch(console.error);
