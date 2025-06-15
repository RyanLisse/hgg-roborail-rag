#!/usr/bin/env node

/**
 * Vector Store Testing Script
 *
 * This script tests the configuration and data availability of:
 * 1. OpenAI Vector Store (vs_6849955367a88191bf89d7660230325f)
 * 2. Neon/pgvector Database
 * 3. Unified Vector Store Service
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  pgTable,
  text,
  vector,
  timestamp,
  uuid,
  json,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

// Load environment variables from .env.local in project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

function subsection(title) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(`${title}`, 'blue');
  log(`${'-'.repeat(40)}`, 'blue');
}

// Vector documents schema (matching the Neon implementation)
const vectorDocuments = pgTable('vector_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  metadata: json('metadata'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

async function checkEnvironmentVariables() {
  section('ENVIRONMENT VARIABLES CHECK');

  const requiredVars = ['OPENAI_API_KEY', 'OPENAI_VECTORSTORE', 'POSTGRES_URL'];

  const optionalVars = ['DATABASE_URL', 'NEON_DATABASE_URL'];

  log('Required Variables:', 'bright');
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      const displayValue =
        varName.includes('KEY') || varName.includes('URL')
          ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
          : value;
      log(`✅ ${varName}: ${displayValue}`, 'green');
    } else {
      log(`❌ ${varName}: Not set`, 'red');
    }
  }

  log('\nOptional Variables:', 'bright');
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      const displayValue = `${value.substring(0, 10)}...${value.substring(value.length - 4)}`;
      log(`✅ ${varName}: ${displayValue}`, 'green');
    } else {
      log(`⚠️ ${varName}: Not set`, 'yellow');
    }
  }

  // Show specific vector store ID
  if (process.env.OPENAI_VECTORSTORE) {
    log(
      `\nConfigured Vector Store ID: ${process.env.OPENAI_VECTORSTORE}`,
      'magenta',
    );
  }
}

async function testOpenAIVectorStore() {
  section('OPENAI VECTOR STORE TEST');

  if (!process.env.OPENAI_API_KEY) {
    log('❌ OpenAI API key not found. Skipping OpenAI tests.', 'red');
    return;
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const vectorStoreId = process.env.OPENAI_VECTORSTORE;

  if (!vectorStoreId) {
    log('❌ OPENAI_VECTORSTORE environment variable not set.', 'red');
    return;
  }

  try {
    // Test 1: Check if vector store exists
    subsection('Vector Store Information');
    try {
      const vectorStore =
        await client.beta.vectorStores.retrieve(vectorStoreId);
      log('✅ Vector store found!', 'green');
      log(`Name: ${vectorStore.name || 'Unnamed'}`, 'bright');
      log(`Status: ${vectorStore.status}`, 'bright');
      log(
        `Created: ${new Date(vectorStore.created_at * 1000).toISOString()}`,
        'bright',
      );
      log(`Usage: ${Math.round(vectorStore.usage_bytes / 1024)} KB`, 'bright');
      log(`File counts:`, 'bright');
      log(`  Total: ${vectorStore.file_counts.total}`, 'bright');
      log(`  Completed: ${vectorStore.file_counts.completed}`, 'bright');
      log(`  In Progress: ${vectorStore.file_counts.in_progress}`, 'bright');
      log(`  Failed: ${vectorStore.file_counts.failed}`, 'bright');

      if (vectorStore.expires_at) {
        log(
          `Expires: ${new Date(vectorStore.expires_at * 1000).toISOString()}`,
          'yellow',
        );
      }

      if (vectorStore.last_active_at) {
        log(
          `Last Active: ${new Date(vectorStore.last_active_at * 1000).toISOString()}`,
          'bright',
        );
      }
    } catch (error) {
      log(`❌ Error retrieving vector store: ${error.message}`, 'red');
      return;
    }

    // Test 2: List files in the vector store
    subsection('Vector Store Files');
    let files;
    try {
      files = await client.beta.vectorStores.files.list(vectorStoreId);
      log(`Found ${files.data.length} files in vector store:`, 'green');

      if (files.data.length > 0) {
        for (const file of files.data.slice(0, 10)) {
          // Show first 10 files
          log(`  📄 ${file.id} - Status: ${file.status}`, 'bright');
          if (file.last_error) {
            log(`    ❌ Error: ${file.last_error.message}`, 'red');
          }
        }

        if (files.data.length > 10) {
          log(`  ... and ${files.data.length - 10} more files`, 'yellow');
        }
      } else {
        log('  No files found in vector store', 'yellow');
      }
    } catch (error) {
      log(`❌ Error listing files: ${error.message}`, 'red');
    }

    // Test 3: Try to get file details for the first file
    if (files && files.data.length > 0) {
      subsection('Sample File Details');
      try {
        const firstFile = files.data[0];
        const fileDetails = await client.files.retrieve(firstFile.id);
        log(`Sample file details:`, 'green');
        log(`  File ID: ${fileDetails.id}`, 'bright');
        log(`  Filename: ${fileDetails.filename}`, 'bright');
        log(`  Size: ${Math.round(fileDetails.bytes / 1024)} KB`, 'bright');
        log(`  Purpose: ${fileDetails.purpose}`, 'bright');
        log(
          `  Created: ${new Date(fileDetails.created_at * 1000).toISOString()}`,
          'bright',
        );
      } catch (error) {
        log(`⚠️ Error getting file details: ${error.message}`, 'yellow');
      }
    }

    // Test 4: Test the file_search tool configuration
    subsection('File Search Tool Configuration');
    const fileSearchTool = {
      type: 'file_search',
      file_search: {
        vector_store_ids: [vectorStoreId],
      },
    };
    log('File search tool configuration:', 'green');
    log(JSON.stringify(fileSearchTool, null, 2), 'bright');

    // Test 5: Try creating a temporary assistant with the vector store to verify access
    subsection('Vector Store Access Test');
    try {
      const testAssistant = await client.beta.assistants.create({
        name: 'Vector Store Test Assistant',
        instructions: 'You are a test assistant to verify vector store access.',
        model: 'gpt-4o-mini',
        tools: [fileSearchTool],
      });

      log('✅ Successfully created test assistant with vector store', 'green');
      log(`Assistant ID: ${testAssistant.id}`, 'bright');

      // Clean up the test assistant
      await client.beta.assistants.del(testAssistant.id);
      log('✅ Test assistant cleaned up', 'green');
    } catch (error) {
      log(
        `❌ Failed to create assistant with vector store: ${error.message}`,
        'red',
      );
      if (error.message.includes('vector_store')) {
        log(
          '  This might indicate the vector store ID is invalid or inaccessible',
          'yellow',
        );
      }
    }
  } catch (error) {
    log(`❌ OpenAI Vector Store test failed: ${error.message}`, 'red');
    console.error(error);
  }
}

async function testNeonDatabase() {
  section('NEON/PGVECTOR DATABASE TEST');

  if (!process.env.POSTGRES_URL) {
    log('❌ POSTGRES_URL not found. Skipping Neon tests.', 'red');
    return;
  }

  let client;
  let db;

  try {
    // Test 1: Database connection
    subsection('Database Connection');
    client = postgres(process.env.POSTGRES_URL);
    db = drizzle(client);
    log('✅ Connected to PostgreSQL database', 'green');

    // Test 2: Check if pgvector extension is installed
    subsection('pgvector Extension Check');
    try {
      const extensionCheck = await db.execute(sql`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname = 'vector';
      `);

      if (extensionCheck.length > 0) {
        log(
          `✅ pgvector extension installed (version: ${extensionCheck[0].extversion})`,
          'green',
        );
      } else {
        log('⚠️ pgvector extension not installed', 'yellow');
        // Try to install it
        try {
          await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
          log('✅ pgvector extension installed successfully', 'green');
        } catch (error) {
          log(`❌ Failed to install pgvector: ${error.message}`, 'red');
        }
      }
    } catch (error) {
      log(`❌ Error checking pgvector extension: ${error.message}`, 'red');
    }

    // Test 3: Check if vector_documents table exists
    subsection('Vector Documents Table');
    try {
      const tableCheck = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'vector_documents';
      `);

      if (tableCheck.length > 0) {
        log('✅ vector_documents table exists with columns:', 'green');
        for (const column of tableCheck) {
          log(`  - ${column.column_name}: ${column.data_type}`, 'bright');
        }
      } else {
        log('⚠️ vector_documents table does not exist', 'yellow');
      }
    } catch (error) {
      log(`❌ Error checking table structure: ${error.message}`, 'red');
    }

    // Test 4: Count documents in the table
    subsection('Document Count');
    try {
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM vector_documents;
      `);

      const count = countResult[0]?.count || 0;
      log(
        `📊 Total documents in vector store: ${count}`,
        count > 0 ? 'green' : 'yellow',
      );

      if (count > 0) {
        // Test 5: Sample documents
        subsection('Sample Documents');
        const sampleDocs = await db.execute(sql`
          SELECT id, content, metadata, created_at, updated_at
          FROM vector_documents 
          ORDER BY created_at DESC 
          LIMIT 5;
        `);

        log('Recent documents:', 'green');
        for (const doc of sampleDocs) {
          const preview =
            doc.content.length > 100
              ? `${doc.content.substring(0, 100)}...`
              : doc.content;
          log(`  📄 ${doc.id}`, 'bright');
          log(`     Content: ${preview}`, 'bright');
          log(`     Created: ${doc.created_at}`, 'bright');
          if (doc.metadata) {
            log(`     Metadata: ${JSON.stringify(doc.metadata)}`, 'bright');
          }
        }

        // Test 6: Check embeddings
        subsection('Embeddings Check');
        const embeddingCheck = await db.execute(sql`
          SELECT id, array_length(embedding, 1) as embedding_length
          FROM vector_documents 
          WHERE embedding IS NOT NULL 
          LIMIT 5;
        `);

        if (embeddingCheck.length > 0) {
          log('✅ Documents with embeddings found:', 'green');
          for (const doc of embeddingCheck) {
            log(`  📄 ${doc.id}: ${doc.embedding_length} dimensions`, 'bright');
          }
        } else {
          log('⚠️ No documents with embeddings found', 'yellow');
        }
      }
    } catch (error) {
      log(`❌ Error querying documents: ${error.message}`, 'red');
    }

    // Test 7: Check indexes for performance
    subsection('Performance Indexes');
    try {
      const indexCheck = await db.execute(sql`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'vector_documents' 
        AND indexname LIKE '%embedding%';
      `);

      if (indexCheck.length > 0) {
        log('✅ Vector indexes found:', 'green');
        for (const index of indexCheck) {
          log(`  🔍 ${index.indexname}`, 'bright');
        }
      } else {
        log(
          '⚠️ No vector indexes found - similarity search may be slow',
          'yellow',
        );
      }
    } catch (error) {
      log(`⚠️ Error checking indexes: ${error.message}`, 'yellow');
    }
  } catch (error) {
    log(`❌ Neon database test failed: ${error.message}`, 'red');
    console.error(error);
  } finally {
    if (client) {
      await client.end();
      log('🔌 Database connection closed', 'blue');
    }
  }
}

async function testVectorStoreConfiguration() {
  section('VECTOR STORE CONFIGURATION TEST');

  // Test configuration without importing server-only modules
  subsection('Service Configuration Check');

  log('OpenAI Vector Store Service Configuration:', 'green');
  const openaiEnabled = !!process.env.OPENAI_API_KEY;
  const openaiVectorStore = process.env.OPENAI_VECTORSTORE;
  log(
    `  API Key Available: ${openaiEnabled ? '✅' : '❌'}`,
    openaiEnabled ? 'green' : 'red',
  );
  log(
    `  Vector Store ID: ${openaiVectorStore || '❌ Not configured'}`,
    openaiVectorStore ? 'green' : 'red',
  );

  if (openaiEnabled && openaiVectorStore) {
    log('  ✅ OpenAI vector store service should be enabled', 'green');
    log(
      `  File search tool config: {"type": "file_search", "file_search": {"vector_store_ids": ["${openaiVectorStore}"]}}`,
      'bright',
    );
  } else {
    log('  ⚠️ OpenAI vector store service will be disabled', 'yellow');
  }

  log('\nNeon Vector Store Service Configuration:', 'green');
  const neonEnabled = !!process.env.POSTGRES_URL;
  log(
    `  Database URL Available: ${neonEnabled ? '✅' : '❌'}`,
    neonEnabled ? 'green' : 'red',
  );
  log(`  Default Embedding Model: text-embedding-3-small`, 'bright');

  if (neonEnabled) {
    log('  ✅ Neon vector store service should be enabled', 'green');
  } else {
    log('  ⚠️ Neon vector store service will be disabled', 'yellow');
  }

  log('\nUnified Vector Store Service:', 'green');
  const availableSources = [];
  if (openaiEnabled && openaiVectorStore) availableSources.push('openai');
  if (neonEnabled) availableSources.push('neon');
  availableSources.push('memory'); // Always available

  log(`  Available sources: ${availableSources.join(', ')}`, 'bright');
  log(`  Total sources configured: ${availableSources.length}`, 'bright');
}

async function runAllTests() {
  try {
    log('🚀 Starting Vector Store Tests...', 'bright');
    log(`Timestamp: ${new Date().toISOString()}`, 'blue');

    await checkEnvironmentVariables();
    await testOpenAIVectorStore();
    await testNeonDatabase();
    await testVectorStoreConfiguration();

    section('TEST SUMMARY');
    log('All tests completed!', 'green');
    log('Check the output above for any issues or warnings.', 'blue');
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(console.error);
