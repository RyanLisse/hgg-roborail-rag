import 'server-only';
import postgres from 'postgres';
import { POSTGRES_URL } from '../env';

export interface DatabaseHealthStatus {
  isConnected: boolean;
  status: 'healthy' | 'degraded' | 'unavailable';
  error?: string;
  details: {
    connectionString: string;
    isTestMode: boolean;
    hasCredentials: boolean;
    lastChecked: string;
    responseTime?: number;
  };
  recommendations: string[];
}

/**
 * Comprehensive database health check for troubleshooting
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  const isTestMode =
    process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';

  const baseStatus: DatabaseHealthStatus = {
    isConnected: false,
    status: 'unavailable',
    details: {
      connectionString: POSTGRES_URL ? 'configured' : 'missing',
      isTestMode,
      hasCredentials: !!POSTGRES_URL,
      lastChecked: new Date().toISOString(),
    },
    recommendations: [],
  };

  // Test mode - return healthy but with test mode indicator
  if (isTestMode) {
    return {
      ...baseStatus,
      isConnected: true,
      status: 'healthy',
      details: {
        ...baseStatus.details,
        connectionString: 'test-mode (sqlite memory)',
        responseTime: Date.now() - startTime,
      },
      recommendations: ['Running in test mode with in-memory database'],
    };
  }

  // No connection string
  if (!POSTGRES_URL) {
    return {
      ...baseStatus,
      error: 'POSTGRES_URL environment variable not set',
      recommendations: [
        'Set POSTGRES_URL in your .env.local file',
        'Ensure the connection string includes all required parameters',
        'Check that the database server is accessible',
      ],
    };
  }

  // Attempt connection
  let client: any = null;
  try {
    client = postgres(POSTGRES_URL, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 10,
    });

    // Test basic connectivity
    await client`SELECT 1 as test, version() as db_version`;

    const responseTime = Date.now() - startTime;

    return {
      ...baseStatus,
      isConnected: true,
      status: 'healthy',
      details: {
        ...baseStatus.details,
        responseTime,
      },
      recommendations: ['Database connection is healthy'],
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    // Analyze specific error types
    const errorMessage = error.message || 'Unknown database error';
    let status: 'degraded' | 'unavailable' = 'unavailable';
    const recommendations: string[] = [];

    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      status = 'unavailable';
      recommendations.push(
        '🚨 Database quota exceeded',
        '💰 Upgrade your NeonDB plan to increase limits',
        '🔄 Consider using a different database provider',
        '📊 Monitor your database usage patterns',
      );
    } else if (errorMessage.includes('connection')) {
      status = 'degraded';
      recommendations.push(
        '🔌 Database connection failed',
        '🌐 Check your network connectivity',
        '🔑 Verify database credentials',
        '🔒 Ensure SSL/TLS configuration is correct',
      );
    } else if (errorMessage.includes('timeout')) {
      status = 'degraded';
      recommendations.push(
        '⏰ Database connection timeout',
        '🌐 Check network latency to database server',
        '📈 Monitor database server performance',
        '⚙️ Consider adjusting connection timeout settings',
      );
    } else {
      recommendations.push(
        '💥 Unexpected database error',
        '📋 Check database server logs',
        '🔍 Review connection string format',
        '📞 Contact database provider support if needed',
      );
    }

    return {
      ...baseStatus,
      status,
      error: errorMessage,
      details: {
        ...baseStatus.details,
        responseTime,
      },
      recommendations,
    };
  } finally {
    // Clean up connection
    if (client) {
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Quick database status check (for API endpoints)
 */
export async function quickDatabaseStatus(): Promise<{
  status: string;
  connected: boolean;
}> {
  try {
    const health = await checkDatabaseHealth();
    return {
      status: health.status,
      connected: health.isConnected,
    };
  } catch {
    return {
      status: 'error',
      connected: false,
    };
  }
}

/**
 * Format health check results for console output
 */
export function formatHealthCheckResults(health: DatabaseHealthStatus): string {
  const { status, isConnected, error, details, recommendations } = health;

  let output = '\n📊 Database Health Check Results\n';
  output += '═'.repeat(40) + '\n';

  // Status indicator
  const statusIcon =
    status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
  output += `${statusIcon} Status: ${status.toUpperCase()}\n`;
  output += `🔗 Connected: ${isConnected ? 'YES' : 'NO'}\n`;

  // Connection details
  output += `\n📋 Connection Details:\n`;
  output += `  • Connection String: ${details.connectionString}\n`;
  output += `  • Test Mode: ${details.isTestMode ? 'YES' : 'NO'}\n`;
  output += `  • Has Credentials: ${details.hasCredentials ? 'YES' : 'NO'}\n`;
  output += `  • Last Checked: ${details.lastChecked}\n`;
  if (details.responseTime) {
    output += `  • Response Time: ${details.responseTime}ms\n`;
  }

  // Error details
  if (error) {
    output += `\n❌ Error: ${error}\n`;
  }

  // Recommendations
  if (recommendations.length > 0) {
    output += `\n💡 Recommendations:\n`;
    recommendations.forEach((rec) => {
      output += `  • ${rec}\n`;
    });
  }

  output += '═'.repeat(40) + '\n';

  return output;
}
