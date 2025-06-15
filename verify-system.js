#!/usr/bin/env node

// System verification script
import fetch from 'node-fetch';

async function verifySystem() {
  console.log('🔍 System Verification Report');
  console.log('═'.repeat(50));

  const results = {
    health: false,
    vectorStores: false,
    models: false,
    auth: false,
    blob: false,
    redis: false,
    database: false,
  };

  // 1. Health Check
  console.log('\n1️⃣ Health Check...');
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();

    results.health = data.status === 'ok';
    results.database = data.services.database === 'connected';
    results.redis = data.services.redis === 'configured';
    results.blob = data.services.blob_storage === 'configured';

    console.log(`   ✅ Overall Status: ${data.status}`);
    console.log(`   📊 Database: ${data.services.database}`);
    console.log(`   📊 Redis: ${data.services.redis}`);
    console.log(`   📊 Blob Storage: ${data.services.blob_storage}`);
    console.log(`   ⚠️  Warnings: ${data.environment.warnings?.length || 0}`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
  }

  // 2. Vector Store Check
  console.log('\n2️⃣ Vector Store Check...');
  try {
    const response = await fetch(
      'http://localhost:3000/api/vectorstore/sources',
    );
    const data = await response.json();

    results.vectorStores = data.availableSources?.length > 0;

    console.log(
      `   ✅ Available Sources: ${data.availableSources?.join(', ')}`,
    );
    console.log(`   📊 Source Stats:`);
    Object.entries(data.sourceStats || {}).forEach(([key, value]) => {
      const status = value.enabled ? '✅' : '❌';
      const count = value.count ? ` (${value.count} docs)` : '';
      console.log(`      ${status} ${key}${count}`);
    });
  } catch (error) {
    console.log(`   ❌ Vector store check failed: ${error.message}`);
  }

  // 3. Authentication Check
  console.log('\n3️⃣ Authentication Check...');
  try {
    const response = await fetch('http://localhost:3000/api/auth/session');
    results.auth = response.status === 200 || response.status === 401; // Both are valid
    console.log(`   ✅ Auth endpoint responding (status: ${response.status})`);
  } catch (error) {
    console.log(`   ❌ Auth check failed: ${error.message}`);
  }

  // 4. Model Configuration Check
  console.log('\n4️⃣ Model Configuration...');
  try {
    // Check environment variables for model API keys
    const envVars = {
      OpenAI: process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing',
      Anthropic: process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing',
      Google:
        process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
          ? '✅ Configured'
          : '❌ Missing',
      Cohere: process.env.COHERE_API_KEY ? '✅ Configured' : '❌ Missing',
      xAI: process.env.XAI_API_KEY ? '✅ Configured' : '❌ Missing',
      Groq: process.env.GROQ_API_KEY ? '✅ Configured' : '❌ Missing',
    };

    Object.entries(envVars).forEach(([provider, status]) => {
      console.log(`   ${status}: ${provider}`);
    });

    results.models = Object.values(envVars).some((status) =>
      status.includes('✅'),
    );
  } catch (error) {
    console.log(`   ❌ Model config check failed: ${error.message}`);
  }

  // 5. Frontend Check
  console.log('\n5️⃣ Frontend Accessibility...');
  try {
    const response = await fetch('http://localhost:3000/', {
      redirect: 'manual',
      timeout: 5000,
    });
    console.log(`   ✅ Frontend responding (status: ${response.status})`);
  } catch (error) {
    console.log(`   ⚠️  Frontend check: ${error.message}`);
  }

  // Results Summary
  console.log('\n📋 VERIFICATION SUMMARY');
  console.log('═'.repeat(50));

  const totalChecks = Object.keys(results).length;
  const passedChecks = Object.values(results).filter(Boolean).length;

  console.log(`Overall Status: ${passedChecks}/${totalChecks} checks passed\n`);

  Object.entries(results).forEach(([check, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const description = {
      health: 'Health Endpoint',
      vectorStores: 'Vector Stores',
      models: 'Model API Keys',
      auth: 'Authentication',
      blob: 'Blob Storage',
      redis: 'Redis Cache',
      database: 'Database Connection',
    };
    console.log(`${status}: ${description[check]}`);
  });

  // System Readiness Assessment
  console.log('\n🎯 SYSTEM READINESS');
  console.log('═'.repeat(50));

  const criticalSystems = ['health', 'database', 'models', 'auth'];
  const criticalPassed = criticalSystems.every((sys) => results[sys]);

  if (criticalPassed) {
    console.log('🟢 SYSTEM READY FOR TESTING');
    console.log('   ✅ All critical systems operational');
    console.log('   ✅ Chat functionality should work');
    console.log('   ✅ Model switching should work');
    console.log('   ✅ Ready for manual testing');

    if (results.vectorStores) {
      console.log('   ✅ RAG functionality available');
    }
  } else {
    console.log('🔴 SYSTEM NOT READY');
    console.log('   ❌ Critical systems failing');
    console.log('   ❌ Chat may not work properly');

    criticalSystems.forEach((sys) => {
      if (!results[sys]) {
        console.log(`   🔧 Fix required: ${sys}`);
      }
    });
  }

  console.log('\n📖 Next Steps:');
  if (criticalPassed) {
    console.log('   • Open http://localhost:3000 to test chat');
    console.log('   • Follow manual-chat-test.md for comprehensive testing');
    console.log('   • Try different models and vector stores');
  } else {
    console.log('   • Fix failing systems above');
    console.log('   • Check .env.local configuration');
    console.log('   • Restart development server if needed');
  }

  return criticalPassed;
}

// Run verification
verifySystem()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
