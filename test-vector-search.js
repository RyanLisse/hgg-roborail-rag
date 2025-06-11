#!/usr/bin/env node

/**
 * Test Vector Search Functionality
 * Test search capabilities across both vector stores
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

const VECTOR_STORE_ID = process.env.OPENAI_VECTORSTORE;
const API_KEY = process.env.OPENAI_API_KEY;

async function testOpenAIVectorSearch() {
  console.log('🔍 Testing OpenAI Vector Store Search via Assistant...');
  
  if (!API_KEY || !VECTOR_STORE_ID) {
    console.log('❌ Missing API key or vector store ID');
    return;
  }
  
  try {
    // Create a temporary assistant with file_search tool
    const assistant = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        name: 'Vector Search Test Assistant',
        instructions: 'You help search through RoboRail documentation. Be concise in your responses.',
        model: 'gpt-4o-mini',
        tools: [{
          type: 'file_search'
        }],
        tool_resources: {
          file_search: {
            vector_store_ids: [VECTOR_STORE_ID]
          }
        }
      })
    });
    
    if (!assistant.ok) {
      const errorText = await assistant.text();
      console.log(`Error details: ${errorText}`);
      throw new Error(`Failed to create assistant: ${assistant.status}`);
    }
    
    const assistantData = await assistant.json();
    console.log(`✅ Created assistant: ${assistantData.id}`);
    
    // Create a thread
    const thread = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({})
    });
    
    const threadData = await thread.json();
    console.log(`✅ Created thread: ${threadData.id}`);
    
    // Test queries about RoboRail
    const testQueries = [
      'What is RoboRail?',
      'How do I calibrate the system?',
      'What are the safety requirements?'
    ];
    
    for (const query of testQueries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      
      // Add message to thread
      await fetch(`https://api.openai.com/v1/threads/${threadData.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          role: 'user',
          content: query
        })
      });
      
      // Run the assistant
      const run = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: assistantData.id
        })
      });
      
      const runData = await run.json();
      console.log(`   ⏳ Run started: ${runData.id}`);
      
      // Wait for completion (simplified polling)
      let runStatus = runData;
      let attempts = 0;
      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        if (attempts++ > 20) break; // Timeout after 20 attempts
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/runs/${runData.id}`, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        runStatus = await statusResponse.json();
      }
      
      if (runStatus.status === 'completed') {
        // Get messages
        const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/messages`, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        const messagesData = await messagesResponse.json();
        const lastMessage = messagesData.data[0];
        
        if (lastMessage.role === 'assistant') {
          console.log(`   ✅ Response: ${lastMessage.content[0].text.value.substring(0, 200)}...`);
          
          // Check for file search annotations
          const annotations = lastMessage.content[0].text.annotations || [];
          if (annotations.length > 0) {
            console.log(`   📄 Sources found: ${annotations.length} file references`);
          }
        }
      } else {
        console.log(`   ❌ Run failed with status: ${runStatus.status}`);
      }
    }
    
    // Clean up
    await fetch(`https://api.openai.com/v1/assistants/${assistantData.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    console.log('\n🧹 Cleaned up test assistant');
    
  } catch (error) {
    console.log(`❌ Error testing OpenAI vector search: ${error.message}`);
  }
}

testOpenAIVectorSearch().catch(console.error);