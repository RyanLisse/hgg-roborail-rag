#!/usr/bin/env node

/**
 * Simple RoboRail Vector Store Test
 *
 * Tests the OpenAI vector store with RoboRail documentation
 * using direct OpenAI API calls.
 */

import OpenAI from 'openai';
import { config } from 'dotenv';

// Load environment variables
config();

const VECTOR_STORE_ID = 'vs_6849955367a88191bf89d7660230325f';
const TEST_QUESTIONS = ['How do I calibrate the RoboRail system?'];

async function testRoboRailVectorStore() {
  console.log('🤖 Testing RoboRail Vector Store Integration');
  console.log(`Vector Store ID: ${VECTOR_STORE_ID}`);
  console.log('='.repeat(60));

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('✅ OpenAI client initialized');
  console.log('VectorStores available:', !!openai.vectorStores);

  // Test 1: Check vector store exists and list files
  console.log('\n📁 Checking vector store files...');
  try {
    const vectorStore = await openai.vectorStores.retrieve(VECTOR_STORE_ID);
    console.log(`✅ Vector Store found: ${vectorStore.name || 'Unnamed'}`);
    console.log(`   - Status: ${vectorStore.status}`);
    console.log(
      `   - File count: ${vectorStore.file_counts.completed} completed, ${vectorStore.file_counts.total} total`,
    );

    const files = await openai.vectorStores.files.list(VECTOR_STORE_ID);
    console.log(`   - Files in store: ${files.data.length}`);

    if (files.data.length > 0) {
      console.log('   - Sample files:');
      files.data.slice(0, 3).forEach((file, index) => {
        console.log(`     ${index + 1}. ${file.id} (${file.status})`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to check vector store:', error.message);
    return;
  }

  // Test 2: Test file search with RoboRail questions
  console.log('\n🔍 Testing file search with RoboRail questions...');

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const question = TEST_QUESTIONS[i];
    console.log(`\n${i + 1}. Testing: "${question}"`);

    try {
      const startTime = Date.now();

      // Create an assistant with file search tool
      const assistant = await openai.beta.assistants.create({
        name: 'RoboRail Test Assistant',
        instructions:
          'You are a helpful assistant that answers questions about RoboRail based on the provided documentation. Be specific and cite relevant information.',
        model: 'gpt-4o-mini',
        tools: [{ type: 'file_search' }],
        tool_resources: {
          file_search: {
            vector_store_ids: [VECTOR_STORE_ID],
          },
        },
      });

      // Create a thread and run
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: 'user',
            content: question,
          },
        ],
      });

      console.log(`   Thread created: ${thread.id}`);

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      console.log(`   Run created: ${run.id}`);

      // Wait for completion
      let runStatus = await openai.beta.threads.runs.retrieve(
        thread.id,
        run.id,
      );
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      console.log(`   Initial run status: ${runStatus.status}`);

      while (
        runStatus.status !== 'completed' &&
        runStatus.status !== 'failed' &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          runStatus = await openai.beta.threads.runs.retrieve(
            thread.id,
            run.id,
          );
          console.log(`   Run status (${attempts + 1}): ${runStatus.status}`);
        } catch (error) {
          console.log(`   Error retrieving run status: ${error.message}`);
          break;
        }
        attempts++;
      }

      const responseTime = Date.now() - startTime;

      if (runStatus.status === 'completed') {
        // Get the response
        const messages = await openai.beta.threads.messages.list(thread.id);
        const response = messages.data[0];

        if (
          response.role === 'assistant' &&
          response.content[0].type === 'text'
        ) {
          const answerText = response.content[0].text.value;
          const citations = response.content[0].text.annotations || [];

          console.log(`   ✅ Response received (${responseTime}ms)`);
          console.log(
            `   📝 Answer: ${answerText.substring(0, 150)}${answerText.length > 150 ? '...' : ''}`,
          );
          console.log(`   📚 Citations: ${citations.length} found`);

          // Check if response contains RoboRail-specific content
          const roboRailKeywords = [
            'roborail',
            'measurement',
            'calibration',
            'accuracy',
            'safety',
          ];
          const hasRoboRailContent = roboRailKeywords.some((keyword) =>
            answerText.toLowerCase().includes(keyword),
          );

          if (hasRoboRailContent) {
            console.log(`   🎯 Contains RoboRail-specific content: ✅`);
          } else {
            console.log(`   ⚠️  May not contain specific RoboRail content`);
          }
        }
      } else {
        console.log(`   ❌ Run failed with status: ${runStatus.status}`);
        if (runStatus.last_error) {
          console.log(`   Error: ${runStatus.last_error.message}`);
        }
      }

      // Cleanup
      await openai.beta.assistants.del(assistant.id);
    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
    }

    // Brief delay between tests
    if (i < TEST_QUESTIONS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 RoboRail Vector Store Test Complete');
}

// Run the test
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  testRoboRailVectorStore().catch(console.error);
}

export { testRoboRailVectorStore };
