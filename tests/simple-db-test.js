import { config } from 'dotenv';
import postgres from 'postgres';

// Load environment variables
config({ path: '.env.test' });

const testConnection = async () => {
  console.log('🔍 Starting simple database connection test...');
  
  const connectionString = 'postgresql://neondb_owner:npg_09TNDHWMZhzi@ep-late-boat-a8biqbk3-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require';
  
  console.log('📡 Connection string:', connectionString.replace(/:[^:@]*@/, ':***@'));
  
  try {
    const sql = postgres(connectionString, {
      max: 1,
      connect_timeout: 15,
      idle_timeout: 5
    });

    console.log('⏱️  Testing connection...');
    const result = await sql`SELECT 
      1 as test_value,
      version() as pg_version, 
      current_database() as db_name,
      current_user as user_name,
      now() as current_time
    `;

    console.log('✅ Connection successful!');
    console.log('📊 Results:', result[0]);
    
    await sql.end();
    console.log('🔌 Connection closed cleanly');
    
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('🔍 Error details:', error);
    return false;
  }
};

testConnection()
  .then(success => {
    console.log(success ? '🎉 Test completed successfully!' : '💥 Test failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });