#!/usr/bin/env node

// Test script for OpenAI Responses API with source annotations
// Run with: node test-openai-responses.js

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testResponsesAPI() {
  console.log('🤖 Testing OpenAI Responses API with file search...\n');

  // Check if we have the required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    return;
  }

  const vectorStoreId = process.env.OPENAI_VECTORSTORE;
  if (!vectorStoreId) {
    console.error('❌ OPENAI_VECTORSTORE not found in environment variables');
    console.log('   Please set your vector store ID in .env.local');
    return;
  }

  try {
    console.log(`📚 Using vector store: ${vectorStoreId}`);
    
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: "What is deep research by OpenAI?",
      tools: [{
        type: "file_search",
        vector_store_ids: [vectorStoreId],
        max_num_results: 10,
      }],
      include: ["file_search_call.results"],
    });

    console.log('✅ Response received successfully!\n');
    
    // Display basic response info
    console.log('📄 Response Details:');
    console.log(`   ID: ${response.id}`);
    console.log(`   Model: ${response.model}`);
    if (response.created) {
      console.log(`   Created: ${new Date(response.created * 1000).toISOString()}`);
    }
    if (response.usage) {
      console.log(`   Usage: ${JSON.stringify(response.usage)}`);
    }
    console.log('');

    // Debug response structure
    console.log('🔍 Response structure:');
    console.log('   Text:', response.text);
    console.log('   Output text:', response.output_text);
    console.log('   Output:', response.output);
    console.log('');

    // Extract content and annotations from output
    let content = response.output_text || 'No content found';
    let annotations = [];
    let fileSearchResults = [];

    if (response.output && Array.isArray(response.output)) {
      // Find message content and file search results
      for (const item of response.output) {
        if (item.type === 'message' && item.content) {
          const textContent = item.content.find(c => c.type === 'text');
          if (textContent) {
            content = textContent.text || textContent.value || content;
            annotations = textContent.annotations || [];
          }
        }
        if (item.type === 'file_search_call' && item.results) {
          fileSearchResults = item.results;
        }
      }
    }

    // Display content
    console.log('📝 Content:');
    console.log(content);
    console.log('\n');
    console.log(`🔗 Annotations (${annotations.length}):`);
    
    if (annotations.length === 0) {
      console.log('   No annotations found');
    } else {
      annotations.forEach((annotation, index) => {
        console.log(`   [${index + 1}] Type: ${annotation.type}`);
        console.log(`       Text: "${annotation.text}"`);
        console.log(`       Range: ${annotation.start_index}-${annotation.end_index}`);
        
        if (annotation.file_citation) {
          console.log(`       File ID: ${annotation.file_citation.file_id}`);
          if (annotation.file_citation.quote) {
            console.log(`       Quote: "${annotation.file_citation.quote}"`);
          }
        }
        
        if (annotation.file_path) {
          console.log(`       File Path ID: ${annotation.file_path.file_id}`);
        }
        console.log('');
      });
    }

    // Get file information for citations
    const fileIds = new Set();
    annotations.forEach(annotation => {
      if (annotation.file_citation?.file_id) {
        fileIds.add(annotation.file_citation.file_id);
      }
      if (annotation.file_path?.file_id) {
        fileIds.add(annotation.file_path.file_id);
      }
    });

    if (fileIds.size > 0) {
      console.log(`📁 Source Files (${fileIds.size}):`);
      for (const fileId of fileIds) {
        try {
          const file = await openai.files.retrieve(fileId);
          console.log(`   • ${file.filename} (${fileId})`);
          console.log(`     Size: ${file.bytes} bytes`);
          if (file.created_at) {
            console.log(`     Created: ${new Date(file.created_at * 1000).toISOString()}`);
          }
        } catch (error) {
          console.log(`   • Error retrieving file ${fileId}: ${error.message}`);
        }
      }
    }

    // Display file search results if available
    if (fileSearchResults.length > 0) {
      console.log('\n🔍 File Search Results:');
      fileSearchResults.forEach((result, index) => {
        console.log(`   [${index + 1}] Score: ${result.score || 'N/A'}`);
        if (result.content) {
          const preview = typeof result.content === 'string' 
            ? `${result.content.substring(0, 200)}...`
            : `${JSON.stringify(result.content).substring(0, 200)}...`;
          console.log(`       Content: ${preview}`);
        }
        if (result.metadata) {
          console.log(`       Metadata: ${JSON.stringify(result.metadata)}`);
        }
        if (result.file_id) {
          console.log(`       File ID: ${result.file_id}`);
        }
        console.log('');
      });
    }

    // Demonstrate citation processing
    console.log('\n🏷️ Citation Processing Demo:');
    const processedContent = processContentWithCitations(
      response.body?.content || '', 
      annotations
    );
    console.log('   Processed content with numbered citations:');
    console.log(`   ${processedContent}`);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing Responses API:', error);
    
    if (error.status === 404) {
      console.log('   This might indicate that the vector store ID is invalid or not accessible');
    } else if (error.status === 401) {
      console.log('   This indicates an authentication error - check your API key');
    }
  }
}

/**
 * Process content to replace citation markers with numbered references
 */
function processContentWithCitations(content, annotations) {
  if (!annotations.length) return content;

  let processedContent = content;
  const citationMap = new Map();
  let citationCounter = 1;

  // Sort annotations by start_index in descending order to avoid index shifts
  const sortedAnnotations = [...annotations].sort((a, b) => b.start_index - a.start_index);

  sortedAnnotations.forEach(annotation => {
    if (annotation.type === 'file_citation' && annotation.file_citation?.file_id) {
      const fileId = annotation.file_citation.file_id;
      
      // Get or assign citation number
      if (!citationMap.has(fileId)) {
        citationMap.set(fileId, citationCounter++);
      }
      const citationNumber = citationMap.get(fileId);

      // Replace annotation text with numbered citation
      const before = processedContent.substring(0, annotation.start_index);
      const after = processedContent.substring(annotation.end_index);
      processedContent = `${before}[${citationNumber}]${after}`;
    }
  });

  return processedContent;
}

// Run the test
testResponsesAPI().catch(console.error);