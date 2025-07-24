/**
 * Environment Variable Validation Utilities
 */

export interface EnvironmentStatus {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  availableProviders: string[];
}

/**
 * Check if the application has the minimum required environment variables
 */
export function checkEnvironment(): EnvironmentStatus {
  const errors: string[] = [];
  const warnings: string[] = [];
  const availableProviders: string[] = [];

  // In test mode, be more lenient with requirements
  const isTestMode =
    process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';

  // Check AI providers
  if (process.env.OPENAI_API_KEY) {
    availableProviders.push('OpenAI');
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    availableProviders.push('Google');
  }

  if (availableProviders.length === 0) {
    if (isTestMode) {
      warnings.push('Test mode: Using mock AI providers');
      availableProviders.push('MockAI');
    } else {
      errors.push(
        'No AI provider API keys found. Please set at least one: OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY',
      );
    }
  }

  // Check database
  if (!process.env.POSTGRES_URL) {
    warnings.push('POSTGRES_URL not set - using memory-only storage');
  }

  // Check auth secret
  if (!process.env.AUTH_SECRET) {
    if (isTestMode) {
      warnings.push('Test mode: Using default AUTH_SECRET');
    } else {
      errors.push('AUTH_SECRET is required for authentication');
    }
  }

  // Check optional but recommended services
  if (!process.env.COHERE_API_KEY) {
    warnings.push(
      'COHERE_API_KEY not set - vector search features may be limited',
    );
  }

  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set - using memory caching only');
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    warnings.push('BLOB_READ_WRITE_TOKEN not set - file uploads may not work');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    availableProviders,
  };
}

/**
 * Log environment status for debugging
 */
export function logEnvironmentStatus(): void {
  const status = checkEnvironment();

  if (status.errors.length > 0) {
    status.errors.forEach((_error) => {});
  }

  if (status.warnings.length > 0) {
    status.warnings.forEach((_warning) => {});
  }

  if (status.isValid) {
  } else {
  }
}
