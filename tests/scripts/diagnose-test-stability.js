#!/usr/bin/env node

/**
 * Diagnostic script for E2E test stability issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing E2E Test Stability Issues...\n');

const diagnostics = {
  system: {},
  dependencies: {},
  environment: {},
  issues: [],
  recommendations: [],
};

// 1. Check system dependencies
console.log('1️⃣ Checking system dependencies...');
try {
  // Check for required system packages
  const requiredPackages = [
    'libnspr4',
    'libnss3',
    'libatk1.0-0',
    'libatk-bridge2.0-0',
    'libcups2',
    'libxkbcommon0',
    'libxcomposite1',
    'libxdamage1',
    'libxfixes3',
    'libxrandr2',
    'libgbm1',
    'libgtk-3-0',
    'libpango-1.0-0',
    'libasound2',
  ];

  const missingPackages = [];
  for (const pkg of requiredPackages) {
    try {
      execSync(`dpkg -l | grep -E "^ii\\s+${pkg}"`, { stdio: 'pipe' });
    } catch {
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length > 0) {
    diagnostics.issues.push({
      severity: 'critical',
      message: `Missing system packages: ${missingPackages.join(', ')}`,
    });
    diagnostics.recommendations.push(
      `Run: sudo apt-get install ${missingPackages.join(' ')}`
    );
  } else {
    console.log('  ✅ All system dependencies installed');
  }

  // Check Playwright browsers
  try {
    execSync('npx playwright --version', { stdio: 'pipe' });
    console.log('  ✅ Playwright CLI available');
  } catch {
    diagnostics.issues.push({
      severity: 'critical',
      message: 'Playwright CLI not found',
    });
  }

} catch (error) {
  diagnostics.issues.push({
    severity: 'warning',
    message: `System check failed: ${error.message}`,
  });
}

// 2. Check Node.js and pnpm versions
console.log('\n2️⃣ Checking Node.js environment...');
try {
  const nodeVersion = process.version;
  const [major] = nodeVersion.slice(1).split('.').map(Number);
  
  if (major < 18) {
    diagnostics.issues.push({
      severity: 'critical',
      message: `Node.js version ${nodeVersion} is too old`,
    });
    diagnostics.recommendations.push('Upgrade to Node.js 18 or higher');
  } else {
    console.log(`  ✅ Node.js version: ${nodeVersion}`);
  }

  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  console.log(`  ✅ pnpm version: ${pnpmVersion}`);

} catch (error) {
  diagnostics.issues.push({
    severity: 'critical',
    message: 'Failed to check Node.js/pnpm versions',
  });
}

// 3. Check Playwright installation
console.log('\n3️⃣ Checking Playwright installation...');
try {
  const playwrightPath = path.join(process.cwd(), 'node_modules', '@playwright', 'test');
  
  if (fs.existsSync(playwrightPath)) {
    console.log('  ✅ Playwright installed');
    
    // Check browser binaries
    const output = execSync('npx playwright install --dry-run', { encoding: 'utf8' });
    if (output.includes('nothing to install')) {
      console.log('  ✅ All browser binaries installed');
    } else {
      diagnostics.issues.push({
        severity: 'critical',
        message: 'Browser binaries not installed',
      });
      diagnostics.recommendations.push('Run: pnpm exec playwright install');
    }
  } else {
    diagnostics.issues.push({
      severity: 'critical',
      message: 'Playwright not installed',
    });
    diagnostics.recommendations.push('Run: pnpm install');
  }

} catch (error) {
  diagnostics.issues.push({
    severity: 'warning',
    message: `Playwright check failed: ${error.message}`,
  });
}

// 4. Check port availability
console.log('\n4️⃣ Checking port availability...');
const portsToCheck = [3000, 3001, 4983];

for (const port of portsToCheck) {
  try {
    const result = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
    if (result) {
      diagnostics.issues.push({
        severity: 'warning',
        message: `Port ${port} is in use by process ${result}`,
      });
      diagnostics.recommendations.push(`Kill process using port ${port}: kill -9 ${result}`);
    } else {
      console.log(`  ✅ Port ${port} is available`);
    }
  } catch {
    console.log(`  ✅ Port ${port} is available`);
  }
}

// 5. Check environment variables
console.log('\n5️⃣ Checking environment variables...');
const requiredEnvVars = ['POSTGRES_URL'];
const recommendedEnvVars = ['REDIS_URL', 'XAI_API_KEY', 'COHERE_API_KEY'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    diagnostics.issues.push({
      severity: 'critical',
      message: `Missing required environment variable: ${envVar}`,
    });
    diagnostics.recommendations.push(`Set ${envVar} in .env.test file`);
  } else {
    console.log(`  ✅ ${envVar} is set`);
  }
}

for (const envVar of recommendedEnvVars) {
  if (!process.env[envVar]) {
    diagnostics.issues.push({
      severity: 'warning',
      message: `Missing recommended environment variable: ${envVar}`,
    });
  }
}

// 6. Check test file structure
console.log('\n6️⃣ Checking test file structure...');
const testDirs = ['tests/e2e', 'tests/pages', 'tests/utils'];

for (const dir of testDirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    console.log(`  ✅ ${dir}: ${files.length} files`);
  } else {
    diagnostics.issues.push({
      severity: 'critical',
      message: `Missing test directory: ${dir}`,
    });
  }
}

// 7. Generate report
console.log('\n📊 Diagnostic Summary:');
console.log('='.repeat(50));

if (diagnostics.issues.length === 0) {
  console.log('✅ No issues found! Tests should run successfully.');
} else {
  console.log(`Found ${diagnostics.issues.length} issues:\n`);
  
  // Group by severity
  const critical = diagnostics.issues.filter(i => i.severity === 'critical');
  const warnings = diagnostics.issues.filter(i => i.severity === 'warning');
  
  if (critical.length > 0) {
    console.log('🔴 CRITICAL ISSUES:');
    critical.forEach(issue => console.log(`  - ${issue.message}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    warnings.forEach(issue => console.log(`  - ${issue.message}`));
  }
  
  if (diagnostics.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    diagnostics.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
}

// 8. Quick fix script
if (diagnostics.issues.some(i => i.severity === 'critical')) {
  console.log('\n🔧 Quick Fix Commands:');
  console.log('='.repeat(50));
  console.log('#!/bin/bash');
  console.log('# Run these commands to fix critical issues:\n');
  
  if (diagnostics.issues.some(i => i.message.includes('system packages'))) {
    console.log('# Install system dependencies');
    console.log('sudo apt-get update');
    console.log('sudo apt-get install -y \\');
    console.log('  libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 \\');
    console.log('  libcups2 libxkbcommon0 libxcomposite1 libxdamage1 \\');
    console.log('  libxfixes3 libxrandr2 libgbm1 libgtk-3-0 \\');
    console.log('  libpango-1.0-0 libasound2\n');
  }
  
  if (diagnostics.issues.some(i => i.message.includes('browser binaries'))) {
    console.log('# Install Playwright browsers');
    console.log('pnpm exec playwright install\n');
  }
  
  if (diagnostics.issues.some(i => i.message.includes('Port'))) {
    console.log('# Kill processes on test ports');
    console.log('lsof -ti:3000,3001,4983 | xargs kill -9 2>/dev/null || true\n');
  }
  
  console.log('# Run tests');
  console.log('pnpm test:e2e');
}

// Save diagnostic report
const reportPath = 'test-results/diagnostic-report.json';
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(diagnostics, null, 2));
console.log(`\n📄 Full report saved to: ${reportPath}`);

// Exit with appropriate code
process.exit(diagnostics.issues.filter(i => i.severity === 'critical').length > 0 ? 1 : 0);