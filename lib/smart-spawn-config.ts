/**
 * Smart-Spawn Configuration for NeonDB Optimization
 * Environment-aware database configuration with enhanced reliability features
 */

import { smartSpawnConfig } from './env';

export interface SmartSpawnDatabaseConfig {
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  fallbackMode: 'graceful' | 'strict';
  testMode: boolean;
  connectionPooling: {
    idleTimeout: number;
    connectTimeout: number;
    statementTimeout: number;
    idleInTransactionTimeout: number;
  };
  optimizations: {
    disablePreparedStatements: boolean;
    transformUndefinedToNull: boolean;
    suppressNotices: boolean;
    enableDebugMode: boolean;
  };
  monitoring: {
    enableHealthChecks: boolean;
    healthCheckInterval: number;
    enableMetrics: boolean;
    logConnections: boolean;
  };
}

/**
 * Get optimized smart-spawn configuration based on environment
 */
export function getSmartSpawnConfig(): SmartSpawnDatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test' || smartSpawnConfig.testMode;

  return {
    // Basic configuration from environment
    maxConnections: smartSpawnConfig.maxConnections,
    connectionTimeout: smartSpawnConfig.connectionTimeout,
    retryAttempts: smartSpawnConfig.retryAttempts,
    retryDelay: smartSpawnConfig.retryDelay,
    fallbackMode: smartSpawnConfig.fallbackMode,
    testMode: smartSpawnConfig.testMode,

    // Connection pooling optimizations
    connectionPooling: {
      idleTimeout: isTest ? 15 : 60, // Shorter timeouts for tests
      connectTimeout: isTest ? 15 : 30, // Faster connection attempts for tests
      statementTimeout: isTest ? 15_000 : 30_000, // Query timeout in milliseconds
      idleInTransactionTimeout: isTest ? 30_000 : 60_000, // Transaction timeout
    },

    // NeonDB-specific optimizations
    optimizations: {
      disablePreparedStatements: true, // Better NeonDB compatibility
      transformUndefinedToNull: true, // PostgreSQL compatibility
      suppressNotices: !isProduction, // Reduce noise in development
      enableDebugMode: !(isProduction || isTest), // Debug only in development
    },

    // Monitoring and health checks
    monitoring: {
      enableHealthChecks: true,
      healthCheckInterval: isTest ? 10_000 : 30_000, // Health check frequency
      enableMetrics: isProduction || process.env.ENABLE_DB_METRICS === 'true',
      logConnections: !isProduction, // Log connections in development
    },
  };
}

/**
 * Get PostgreSQL connection configuration for smart-spawn
 */
export function getPostgresConfig(url: string) {
  const config = getSmartSpawnConfig();

  return {
    max: config.maxConnections,
    idle_timeout: config.connectionPooling.idleTimeout,
    connect_timeout: config.connectionPooling.connectTimeout,
    prepare: !config.optimizations.disablePreparedStatements,
    transform: config.optimizations.transformUndefinedToNull
      ? {
          undefined: null,
        }
      : undefined,
    onnotice: config.optimizations.suppressNotices ? () => {} : undefined,
    debug: config.optimizations.enableDebugMode,
    connection: {
      statement_timeout: config.connectionPooling.statementTimeout,
      idle_in_transaction_session_timeout:
        config.connectionPooling.idleInTransactionTimeout,
    },
  };
}

/**
 * Validate smart-spawn configuration
 */
export function validateSmartSpawnConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const config = getSmartSpawnConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate basic configuration
  if (config.maxConnections < 1 || config.maxConnections > 100) {
    errors.push('maxConnections must be between 1 and 100');
  }

  if (config.connectionTimeout < 1000 || config.connectionTimeout > 120_000) {
    errors.push('connectionTimeout must be between 1000ms and 120000ms');
  }

  if (config.retryAttempts < 0 || config.retryAttempts > 10) {
    errors.push('retryAttempts must be between 0 and 10');
  }

  if (config.retryDelay < 100 || config.retryDelay > 10_000) {
    errors.push('retryDelay must be between 100ms and 10000ms');
  }

  // Environment-specific warnings
  if (process.env.NODE_ENV === 'production') {
    if (config.maxConnections < 5) {
      warnings.push(
        'Consider increasing maxConnections for production (recommended: 10+)',
      );
    }

    if (config.connectionTimeout < 15_000) {
      warnings.push(
        'Consider increasing connectionTimeout for production (recommended: 30000ms+)',
      );
    }
  }

  // NeonDB-specific recommendations
  if (process.env.POSTGRES_URL?.includes('neon.tech')) {
    if (!config.optimizations.disablePreparedStatements) {
      warnings.push(
        'Consider disabling prepared statements for better NeonDB compatibility',
      );
    }

    if (config.connectionPooling.statementTimeout > 60_000) {
      warnings.push(
        'NeonDB may timeout long-running queries (recommended: <60000ms)',
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Smart-spawn database health check
 */
export async function smartSpawnHealthCheck(client: any): Promise<{
  isHealthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    await client`SELECT 1 as health_check`;
    const latency = Date.now() - startTime;

    return {
      isHealthy: true,
      latency,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;

    return {
      isHealthy: false,
      latency,
      error: error.message,
    };
  }
}

/**
 * Enhanced error handling for smart-spawn database operations
 */
export function handleSmartSpawnError(error: any): {
  shouldRetry: boolean;
  fallbackMode: boolean;
  userMessage: string;
} {
  const config = getSmartSpawnConfig();
  const errorMessage = error.message?.toLowerCase() || '';

  // NeonDB quota exceeded
  if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
    return {
      shouldRetry: false,
      fallbackMode: config.fallbackMode === 'graceful',
      userMessage:
        'Database quota exceeded. Operations will use fallback mode.',
    };
  }

  // Connection timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('connect')) {
    return {
      shouldRetry: true,
      fallbackMode: config.fallbackMode === 'graceful',
      userMessage:
        'Database connection timeout. Retrying with smart-spawn optimization.',
    };
  }

  // Network issues
  if (errorMessage.includes('network') || errorMessage.includes('enotfound')) {
    return {
      shouldRetry: true,
      fallbackMode: config.fallbackMode === 'graceful',
      userMessage: 'Network connectivity issue. Attempting reconnection.',
    };
  }

  // SSL/TLS issues
  if (errorMessage.includes('ssl') || errorMessage.includes('tls')) {
    return {
      shouldRetry: false,
      fallbackMode: config.fallbackMode === 'graceful',
      userMessage: 'SSL/TLS configuration issue. Check connection settings.',
    };
  }

  // Default handling
  return {
    shouldRetry: true,
    fallbackMode: config.fallbackMode === 'graceful',
    userMessage:
      'Database operation failed. Smart-spawn will attempt recovery.',
  };
}

export default {
  getSmartSpawnConfig,
  getPostgresConfig,
  validateSmartSpawnConfig,
  smartSpawnHealthCheck,
  handleSmartSpawnError,
};
