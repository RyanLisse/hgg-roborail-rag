#!/usr/bin/env node

/**
 * Test Database Connection
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function testDatabase() {
  const connectionString = process.env.POSTGRES_URL;
  
  console.log('🧪 Testing Database Connection...');
  console.log(`Connection: ${connectionString ? 'Configured' : 'Missing'}`);
  
  if (!connectionString) {
    console.error('❌ Missing POSTGRES_URL');
    return;
  }
  
  try {
    const sql = postgres(connectionString);
    
    // Test basic connection
    console.log('\n📊 Testing database connection...');
    const result = await sql`SELECT version()`;
    console.log('✅ Database connected successfully');
    console.log(`✅ Version: ${result[0].version.split(' ').slice(0, 2).join(' ')}`);
    
    // Test tables existence
    console.log('\n📂 Testing required tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('User', 'Chat', 'Message', 'vector_documents')
    `;
    
    const tableNames = tables.map(t => t.table_name);
    console.log(`✅ Found tables: ${tableNames.join(', ')}`);
    
    // Test User table structure  
    if (tableNames.includes('User')) {
      const userColumns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'User'
      `;
      console.log('✅ User table columns:', userColumns.map(c => `${c.column_name}(${c.data_type})`).join(', '));
    }
    
    // Test Chat table structure
    if (tableNames.includes('Chat')) {
      const chatColumns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Chat'
      `;
      console.log('✅ Chat table columns:', chatColumns.map(c => `${c.column_name}(${c.data_type})`).join(', '));
      
      // Test a simple insert (and rollback)
      try {
        await sql.begin(async sql => {
          const testUserId = `test-user-${Date.now()}`;
          const testChatId = `test-chat-${Date.now()}`;
          
          // This will fail if there's a schema issue
          await sql`
            INSERT INTO "User" (id, email) 
            VALUES (${testUserId}, 'test@example.com')
          `;
          
          await sql`
            INSERT INTO "Chat" (id, "createdAt", title, "userId", visibility) 
            VALUES (${testChatId}, NOW(), 'Test Chat', ${testUserId}, 'private')
          `;
          
          console.log('✅ Test insert/rollback successful');
          
          // Force rollback
          throw new Error('rollback');
        });
      } catch (error) {
        if (error.message !== 'rollback') {
          console.error('❌ Test insert failed:', error.message);
        }
      }
    }
    
    // Test vector extension
    if (tableNames.includes('vector_documents')) {
      const vectorExt = await sql`SELECT * FROM pg_extension WHERE extname = 'vector'`;
      console.log(`✅ Vector extension: ${vectorExt.length > 0 ? 'installed' : 'missing'}`);
    }
    
    await sql.end();
    console.log('\n🎯 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testDatabase();