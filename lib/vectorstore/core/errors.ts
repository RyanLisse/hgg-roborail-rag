import type { ClassifiedError, ErrorType } from './types';
import { ErrorType as ErrorTypeEnum } from './types';

export class VectorStoreError extends Error {
  public readonly type: ErrorType;
  public readonly retryable: boolean;
  public readonly suggestedDelay?: number;

  constructor(
    message: string,
    type: ErrorType = ErrorTypeEnum.UNKNOWN,
    retryable = false,
    suggestedDelay?: number,
  ) {
    super(message);
    this.name = 'VectorStoreError';
    this.type = type;
    this.retryable = retryable;
    this.suggestedDelay = suggestedDelay;
  }
}

/**
 * Classifies an error based on its properties and message
 */
export function classifyError(error: Error): ClassifiedError {
  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  ) {
    return {
      type: ErrorTypeEnum.NETWORK,
      message: 'Network connection failed',
      originalError: error,
      retryable: true,
      suggestedDelay: 2000,
    };
  }

  // Authentication errors
  if (
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('authentication') ||
    message.includes('forbidden') ||
    error.message.includes('401') ||
    error.message.includes('403')
  ) {
    return {
      type: ErrorTypeEnum.AUTHENTICATION,
      message: 'Authentication failed - check API keys',
      originalError: error,
      retryable: false,
    };
  }

  // Rate limiting
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    error.message.includes('429')
  ) {
    return {
      type: ErrorTypeEnum.RATE_LIMIT,
      message: 'Rate limit exceeded',
      originalError: error,
      retryable: true,
      suggestedDelay: 60000, // 1 minute
    };
  }

  // Service unavailable
  if (
    message.includes('service unavailable') ||
    message.includes('internal server error') ||
    message.includes('bad gateway') ||
    error.message.includes('500') ||
    error.message.includes('502') ||
    error.message.includes('503')
  ) {
    return {
      type: ErrorTypeEnum.SERVICE_UNAVAILABLE,
      message: 'Service temporarily unavailable',
      originalError: error,
      retryable: true,
      suggestedDelay: 5000,
    };
  }

  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    error.name === 'ZodError'
  ) {
    return {
      type: ErrorTypeEnum.VALIDATION,
      message: 'Invalid request parameters',
      originalError: error,
      retryable: false,
    };
  }

  // Default to unknown
  return {
    type: ErrorTypeEnum.UNKNOWN,
    message: error.message || 'Unknown error occurred',
    originalError: error,
    retryable: false,
  };
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(error: ClassifiedError, operation: string) {
  return {
    success: false,
    message: `${operation} failed: ${error.message}`,
    error: {
      type: error.type,
      retryable: error.retryable,
      suggestedDelay: error.suggestedDelay,
    },
    executionTime: 0,
  };
}

/**
 * Determines if an error should trigger a retry
 */
export function shouldRetryError(
  error: ClassifiedError,
  attempt: number,
  maxRetries: number,
): boolean {
  if (!error.retryable || attempt >= maxRetries) {
    return false;
  }

  // Don't retry authentication errors
  if (error.type === ErrorTypeEnum.AUTHENTICATION) {
    return false;
  }

  // Don't retry validation errors
  if (error.type === ErrorTypeEnum.VALIDATION) {
    return false;
  }

  return true;
}

/**
 * Calculates retry delay with exponential backoff
 */
export function calculateRetryDelay(
  error: ClassifiedError,
  attempt: number,
  baseDelay: number,
): number {
  if (error.suggestedDelay) {
    return error.suggestedDelay;
  }

  // Exponential backoff: baseDelay * 2^attempt
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}

/**
 * Logs error with appropriate level and context
 */
export function logError(
  serviceName: string,
  operation: string,
  error: ClassifiedError,
  context?: Record<string, any>,
): void {
  const logData = {
    service: serviceName,
    operation,
    errorType: error.type,
    retryable: error.retryable,
    message: error.message,
    ...context,
  };

  switch (error.type) {
    case ErrorTypeEnum.AUTHENTICATION:
      console.error('🔐 Authentication Error:', logData);
      break;
    case ErrorTypeEnum.NETWORK:
      console.warn('🌐 Network Error:', logData);
      break;
    case ErrorTypeEnum.RATE_LIMIT:
      console.warn('⏱️  Rate Limit Error:', logData);
      break;
    case ErrorTypeEnum.SERVICE_UNAVAILABLE:
      console.warn('🚫 Service Unavailable:', logData);
      break;
    case ErrorTypeEnum.VALIDATION:
      console.error('✅ Validation Error:', logData);
      break;
    default:
      console.error('❓ Unknown Error:', logData);
  }
}

// Re-export functions for backward compatibility
export const VectorStoreErrorHandler = {
  classify: classifyError,
  createResponse: createErrorResponse,
  shouldRetry: shouldRetryError,
  calculateRetryDelay: calculateRetryDelay,
  logError: logError,
};