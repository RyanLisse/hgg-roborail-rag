#!/usr/bin/env node

/**
 * Vector Store Summary Report
 * Comprehensive report of all vector store configurations and data
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

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
  // biome-ignore lint/suspicious/noConsole: This is a CLI tool
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

async function checkConfiguration() {
  section('1. CONFIGURATION STATUS');

  const openaiKey = process.env.OPENAI_API_KEY;
  const vectorStoreId = process.env.OPENAI_VECTORSTORE;
  const postgresUrl = process.env.POSTGRES_URL;

  log('OpenAI Vector Store:', 'bright');
  log(
    openaiKey
      ? `  ✅ API Key: ${openaiKey.substring(0, 8)}...`
      : '  ❌ API Key: Not configured',
    openaiKey ? 'green' : 'red',
  );
  log(
    vectorStoreId
      ? `  ✅ Store ID: ${vectorStoreId}`
      : '  ❌ Store ID: Not configured',
    vectorStoreId ? 'green' : 'red',
  );

  log('\nNeon/pgvector:', 'bright');
  log(
    postgresUrl
      ? '  ✅ Connection URL: Configured'
      : '  ❌ Connection URL: Not configured',
    postgresUrl ? 'green' : 'red',
  );

  return { openaiKey, vectorStoreId, postgresUrl };
}

async function fetchOpenAIVectorStoreFiles(openaiKey, vectorStoreId) {
  const filesResponse = await fetch(
    `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
    {
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    },
  );

  if (!filesResponse.ok) {
    throw new Error(`Failed to fetch files: ${filesResponse.statusText}`);
  }

  return filesResponse.json();
}

async function displayFileDetails(file, openaiKey) {
  try {
    const fileResponse = await fetch(
      `https://api.openai.com/v1/files/${file.id}`,
      {
        headers: { Authorization: `Bearer ${openaiKey}` },
      },
    );

    if (fileResponse.ok) {
      const fileDetails = await fileResponse.json();
      log(`  📄 ${fileDetails.filename}`, 'green');
      log(`     Size: ${Math.round(fileDetails.bytes / 1024)} KB`, 'bright');
      log(
        `     Status: ${file.status}`,
        file.status === 'completed' ? 'green' : 'yellow',
      );
      log(
        `     Created: ${new Date(file.created_at * 1000).toISOString()}`,
        'bright',
      );
    }
  } catch (_error) {
    log(`  📄 ${file.id} (details unavailable)`, 'yellow');
  }
}

async function checkOpenAIVectorStore(openaiKey, vectorStoreId) {
  section('2. OPENAI VECTOR STORE DATA');

  if (!(openaiKey && vectorStoreId)) {
    log('❌ Cannot access - missing configuration', 'red');
    return;
  }

  try {
    // Get vector store details
    const storeResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
      {
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      },
    );

    if (storeResponse.ok) {
      const storeData = await storeResponse.json();
      log(`✅ Vector Store: ${storeData.name || 'Unnamed'}`, 'green');
      log(
        `   Created: ${new Date(storeData.created_at * 1000).toISOString()}`,
        'bright',
      );

      // Get files - fetch all files in parallel
      const filesData = await fetchOpenAIVectorStoreFiles(
        openaiKey,
        vectorStoreId,
      );
      log('\n📋 Files in Vector Store:', 'bright');

      // Process files in parallel
      const filePromises = filesData.data.map((file) =>
        displayFileDetails(file, openaiKey),
      );
      await Promise.all(filePromises);
    }
  } catch (error) {
    log(`❌ Error accessing OpenAI vector store: ${error.message}`, 'red');
  }
}

async function checkPgvectorDatabase(postgresUrl) {
  section('3. NEON/PGVECTOR DATABASE DATA');

  if (!postgresUrl) {
    log('❌ Cannot access - missing configuration', 'red');
    return;
  }

  try {
    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { sql } = await import('drizzle-orm');

    const client = postgres(postgresUrl);
    const db = drizzle(client);

    // Check pgvector extension
    const extensionCheck = await db.execute(sql`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
    `);

    if (extensionCheck.length > 0) {
      log(`✅ pgvector extension: v${extensionCheck[0].extversion}`, 'green');
    } else {
      log('❌ pgvector extension not installed', 'red');
    }

    // Check table existence
    const tableCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'vector_documents';
    `);

    if (tableCheck[0].count > 0) {
      log('✅ vector_documents table exists', 'green');

      // Get document count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM vector_documents;
      `);

      const docCount = countResult[0]?.count || 0;
      log(`📊 Total documents: ${docCount}`, docCount > 0 ? 'green' : 'yellow');

      if (docCount > 0) {
        // Get sample documents
        const sampleDocs = await db.execute(sql`
          SELECT id, title, metadata, created_at
          FROM vector_documents 
          ORDER BY created_at DESC 
          LIMIT 5;
        `);

        log('\n📑 Recent documents:', 'bright');
        for (const doc of sampleDocs) {
          log(`  • ${doc.title || 'Untitled'}`, 'green');
          log(`    ID: ${doc.id}`, 'bright');
          log(
            `    Created: ${new Date(doc.created_at).toISOString()}`,
            'bright',
          );
        }

        // Get embedding statistics
        const embeddingStats = await db.execute(sql`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings
          FROM vector_documents;
        `);

        const stats = embeddingStats[0];
        log('\n📈 Embedding Statistics:', 'bright');
        log(
          `  Total documents: ${stats.total}`,
          stats.total > 0 ? 'green' : 'yellow',
        );
        log(
          `  With embeddings: ${stats.with_embeddings} (${Math.round(
            (stats.with_embeddings / stats.total) * 100,
          )}%)`,
          stats.with_embeddings === stats.total ? 'green' : 'yellow',
        );
      }
    } else {
      log('❌ vector_documents table does not exist', 'red');
    }

    await client.end();
  } catch (error) {
    log(`❌ Error accessing database: ${error.message}`, 'red');
  }
}

function displayMemoryStoreInfo() {
  section('4. MEMORY VECTOR STORE (FALLBACK)');
  log('📝 Memory store is used as fallback when other stores are unavailable');
  log('📊 Status: Always available', 'green');
  log('⚠️  Note: Data is lost on restart', 'yellow');
}

function displaySummary() {
  section('5. SUMMARY & RECOMMENDATIONS');

  log('\n📋 Key Points:', 'bright');
  log('• The app uses a multi-tier vector store architecture', 'green');
  log('• OpenAI Vector Store for file-based search', 'green');
  log('• Neon/pgvector for custom embeddings', 'green');
  log('• Memory store as fallback', 'green');

  log('\n💡 Recommendations:', 'bright');
  log('• Ensure all environment variables are configured', 'blue');
  log('• Monitor embedding generation for all documents', 'blue');
  log('• Regularly check vector store synchronization', 'blue');
}

async function generateReport() {
  section('VECTOR STORE SUMMARY REPORT');
  log(`Generated: ${new Date().toISOString()}`, 'blue');

  const config = await checkConfiguration();
  await checkOpenAIVectorStore(config.openaiKey, config.vectorStoreId);
  await checkPgvectorDatabase(config.postgresUrl);
  await displayMemoryStoreInfo();
  await displaySummary();

  log('\n✅ Report generation complete!', 'green');
}

// Run the report
generateReport().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: This is a CLI tool
  console.error('Failed to generate report:', error);
  process.exit(1);
});
