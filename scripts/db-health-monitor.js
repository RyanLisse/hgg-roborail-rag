#!/usr/bin/env node

/**
 * Database Health Monitoring Script
 * Continuously monitors database connection health and performance
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { performance } from 'perf_hooks';

// Load environment variables
config({ path: '.env.local' });

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_LATENCY_THRESHOLD = 1000; // 1 second
const CONNECTION_TIMEOUT = 10000; // 10 seconds

class DatabaseHealthMonitor {
  constructor() {
    this.connectionString = process.env.POSTGRES_URL;
    this.isRunning = false;
    this.stats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageLatency: 0,
      lastCheck: null,
      lastError: null,
    };
  }

  async performHealthCheck() {
    const startTime = performance.now();

    try {
      if (!this.connectionString) {
        throw new Error('POSTGRES_URL not found in environment');
      }

      const sql = postgres(this.connectionString, {
        max: 1,
        connect_timeout: CONNECTION_TIMEOUT / 1000,
        idle_timeout: 5,
      });

      // Simple health check query
      const result = await sql`
        SELECT 
          1 as healthy,
          current_database() as database,
          pg_database_size(current_database()) as db_size_bytes,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          now() as server_time
      `;

      await sql.end();

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      this.stats.totalChecks++;
      this.stats.successfulChecks++;
      this.stats.lastCheck = new Date().toISOString();
      this.stats.averageLatency = Math.round(
        (this.stats.averageLatency * (this.stats.successfulChecks - 1) +
          latency) /
          this.stats.successfulChecks,
      );

      const status = {
        status: 'healthy',
        latency,
        database: result[0].database,
        dbSizeMB: Math.round(result[0].db_size_bytes / 1024 / 1024),
        activeConnections: result[0].active_connections,
        serverTime: result[0].server_time,
        timestamp: this.stats.lastCheck,
      };

      this.logHealthStatus(status);
      return status;
    } catch (error) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      this.stats.totalChecks++;
      this.stats.failedChecks++;
      this.stats.lastError = error.message;
      this.stats.lastCheck = new Date().toISOString();

      const status = {
        status: 'unhealthy',
        latency,
        error: error.message,
        timestamp: this.stats.lastCheck,
      };

      this.logHealthStatus(status);
      return status;
    }
  }

  logHealthStatus(status) {
    const timestamp = new Date().toLocaleTimeString();

    if (status.status === 'healthy') {
      console.log(
        `✅ [${timestamp}] Database healthy - ${status.latency}ms | DB: ${status.database} (${status.dbSizeMB}MB) | Connections: ${status.activeConnections}`,
      );

      if (status.latency > MAX_LATENCY_THRESHOLD) {
        console.warn(
          `⚠️  [${timestamp}] High latency detected: ${status.latency}ms (threshold: ${MAX_LATENCY_THRESHOLD}ms)`,
        );
      }
    } else {
      console.error(`❌ [${timestamp}] Database unhealthy - ${status.error}`);

      // Check for specific error types
      if (status.error.includes('quota')) {
        console.error(
          `💳 [${timestamp}] QUOTA ISSUE: Consider upgrading your Neon DB plan`,
        );
      } else if (status.error.includes('timeout')) {
        console.error(
          `⏱️  [${timestamp}] TIMEOUT ISSUE: Network or server performance problems`,
        );
      } else if (status.error.includes('authentication')) {
        console.error(
          `🔐 [${timestamp}] AUTH ISSUE: Check database credentials`,
        );
      }
    }
  }

  printSummary() {
    const uptime =
      this.stats.totalChecks > 0
        ? Math.round(
            (this.stats.successfulChecks / this.stats.totalChecks) * 100,
          )
        : 0;

    console.log('\n📊 Health Monitor Summary:');
    console.log(`   Total Checks: ${this.stats.totalChecks}`);
    console.log(`   Successful: ${this.stats.successfulChecks}`);
    console.log(`   Failed: ${this.stats.failedChecks}`);
    console.log(`   Uptime: ${uptime}%`);
    console.log(`   Average Latency: ${this.stats.averageLatency}ms`);
    console.log(`   Last Check: ${this.stats.lastCheck || 'Never'}`);
    if (this.stats.lastError) {
      console.log(`   Last Error: ${this.stats.lastError}`);
    }
  }

  async start() {
    console.log('🔍 Starting Database Health Monitor...');
    console.log(
      `📡 Connection: ${this.connectionString?.replace(/:[^:@]*@/, ':***@') || 'Not configured'}`,
    );
    console.log(`⏰ Check Interval: ${HEALTH_CHECK_INTERVAL / 1000}s`);
    console.log(`🚨 Latency Threshold: ${MAX_LATENCY_THRESHOLD}ms\n`);

    this.isRunning = true;

    // Initial check
    await this.performHealthCheck();

    // Set up periodic checks
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      await this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down health monitor...');
      this.isRunning = false;
      clearInterval(interval);
      this.printSummary();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Terminating health monitor...');
      this.isRunning = false;
      clearInterval(interval);
      this.printSummary();
      process.exit(0);
    });
  }

  async runSingleCheck() {
    console.log('🔍 Running single database health check...\n');
    const result = await this.performHealthCheck();
    this.printSummary();
    return result;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new DatabaseHealthMonitor();

  const command = process.argv[2] || 'monitor';

  switch (command) {
    case 'check':
      monitor
        .runSingleCheck()
        .then((result) => {
          process.exit(result.status === 'healthy' ? 0 : 1);
        })
        .catch((error) => {
          console.error('💥 Fatal error:', error.message);
          process.exit(1);
        });
      break;

    case 'monitor':
    default:
      monitor.start().catch((error) => {
        console.error('💥 Monitor failed to start:', error.message);
        process.exit(1);
      });
      break;
  }
}

export { DatabaseHealthMonitor };
