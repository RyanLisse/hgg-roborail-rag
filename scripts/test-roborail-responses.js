#!/usr/bin/env node

/**
 * RoboRail Vector Store Test using OpenAI Responses API
 *
 * Tests file search functionality with the RoboRail vector store
 */

import OpenAI from 'openai';
import { config } from 'dotenv';

// Load environment variables
config();

const VECTOR_STORE_ID = 'vs_6849955367a88191bf89d7660230325f';
const TEST_QUESTIONS = [
  'How do I calibrate the RoboRail system?',
  'What are the safety procedures for RoboRail?',
  'What is the measurement accuracy of RoboRail?',
];

async function testRoboRailResponses() {
  console.log('🤖 Testing RoboRail Vector Store with Responses API');
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

  // Test 1: Verify vector store
  console.log('\n📁 Checking vector store...');
  try {
    const vectorStore = await openai.vectorStores.retrieve(VECTOR_STORE_ID);
    console.log(`✅ Vector Store found: ${vectorStore.name || 'Unnamed'}`);
    console.log(`   - Status: ${vectorStore.status}`);
    console.log(
      `   - File count: ${vectorStore.file_counts.completed} completed, ${vectorStore.file_counts.total} total`,
    );
  } catch (error) {
    console.error('❌ Failed to check vector store:', error.message);
    return;
  }

  // Test 2: Test responses API with file search
  console.log('\n🔍 Testing Responses API with file search...');

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const question = TEST_QUESTIONS[i];
    console.log(`\n${i + 1}. Testing: "${question}"`);

    try {
      const startTime = Date.now();

      const response = await openai.responses.create({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that answers questions about RoboRail based on the provided documentation. Be specific and cite relevant information from the documentation.',
          },
          {
            role: 'user',
            content: question,
          },
        ],
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [VECTOR_STORE_ID],
            max_num_results: 10,
          },
        ],
        temperature: 0.1,
      });

      const responseTime = Date.now() - startTime;

      console.log(`   📊 Response status: ${response?.status}`);

      if (response?.output) {
        console.log(
          `   📊 Output types: ${response.output.map((item) => item.type).join(', ')}`,
        );
      }

      if (
        response &&
        (response.text || response.output_text || response.output)
      ) {
        let answer = '';

        // Try to extract text from various response formats
        if (response.output && Array.isArray(response.output)) {
          // Look for message content first
          const messageItems = response.output.filter(
            (item) => item.type === 'message',
          );
          if (messageItems.length > 0) {
            const messageItem = messageItems[0];
            if (messageItem.content) {
              if (Array.isArray(messageItem.content)) {
                answer = messageItem.content
                  .map((c) => {
                    if (c.type === 'output_text' && c.output_text) {
                      return c.output_text;
                    }
                    return c.text || c.value || '';
                  })
                  .join(' ');
              } else if (typeof messageItem.content === 'string') {
                answer = messageItem.content;
              } else if (messageItem.content.text) {
                answer = messageItem.content.text;
              } else if (messageItem.content.output_text) {
                answer = messageItem.content.output_text;
              }
            }
          }

          // Fallback to text items
          if (!answer) {
            const textItems = response.output.filter(
              (item) => item.type === 'text',
            );
            if (textItems.length > 0) {
              answer = textItems
                .map((item) => item.text || item.content || '')
                .join(' ');
            }
          }

          // Log file search results for debugging
          const fileSearchItems = response.output.filter(
            (item) => item.type === 'file_search_call',
          );
          if (fileSearchItems.length > 0) {
            console.log(
              `   🔍 File search calls made: ${fileSearchItems.length}`,
            );
            fileSearchItems.forEach((item, index) => {
              console.log(
                `     Search ${index + 1}: queries = ${JSON.stringify(item.queries)}`,
              );
              if (item.results) {
                console.log(`     Found ${item.results.length} results`);
              }
            });
          }
        }

        // Fallback to other text fields
        if (!answer) {
          const textData = response.text || response.output_text;
          if (typeof textData === 'string') {
            answer = textData;
          } else if (textData?.value) {
            answer = textData.value;
          } else if (Array.isArray(textData) && textData.length > 0) {
            answer = textData
              .map((item) => item.text || item.value || item)
              .join(' ');
          } else {
            answer = JSON.stringify(textData);
          }
        }

        console.log(`   ✅ Response received (${responseTime}ms)`);
        console.log(
          `   📝 Answer: ${answer.substring(0, 300)}${answer.length > 300 ? '...' : ''}`,
        );

        // Check for RoboRail-specific content
        const roboRailKeywords = [
          'roborail',
          'measurement',
          'calibration',
          'accuracy',
          'safety',
          'system',
        ];
        const hasRoboRailContent = roboRailKeywords.some((keyword) =>
          answer.toLowerCase().includes(keyword),
        );

        console.log(
          `   🎯 Contains RoboRail content: ${hasRoboRailContent ? '✅' : '⚠️'}`,
        );

        // Check usage stats
        if (response.usage) {
          console.log(
            `   📊 Tokens used: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`,
          );
        }

        // Check if file search was used
        if (response.output && Array.isArray(response.output)) {
          const fileSearchUsed = response.output.some(
            (item) => item.type === 'file_search',
          );
          console.log(
            `   🔍 File search used: ${fileSearchUsed ? '✅' : '❌'}`,
          );
        }
      } else {
        console.log(`   ❌ No text response received`);
        if (response?.error) {
          console.log(`   Error: ${response.error}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
      if (error.status) {
        console.error(`   Status: ${error.status}`);
      }
    }

    // Brief delay between tests
    if (i < TEST_QUESTIONS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 RoboRail Responses API Test Complete');
}

// Run the test
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  testRoboRailResponses().catch(console.error);
}

export { testRoboRailResponses };
