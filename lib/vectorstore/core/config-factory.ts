import type { BaseServiceConfig, ConfigFactory } from './types';
import { BaseServiceConfig as BaseConfigSchema } from './types';
import { z } from 'zod';

/**
 * Generic configuration factory for vector store services
 */
export class VectorStoreConfigFactory<TConfig extends BaseServiceConfig> 
  implements ConfigFactory<TConfig> {
  
  private readonly schema: z.ZodSchema<TConfig>;
  private readonly envKeyMappings: Record<string, string>;
  private readonly serviceName: string;

  constructor(
    serviceName: string,
    schema: z.ZodSchema<TConfig>,
    envKeyMappings: Record<string, string>
  ) {
    this.serviceName = serviceName;
    this.schema = schema;
    this.envKeyMappings = envKeyMappings;
  }

  /**
   * Create configuration from environment variables
   */
  create(env: Record<string, string | undefined>): TConfig {
    const configData: Partial<TConfig> = {};

    // Map environment variables to config properties
    for (const [configKey, envKey] of Object.entries(this.envKeyMappings)) {
      const envValue = env[envKey];
      if (envValue !== undefined) {
        // Handle boolean conversion
        if (envValue === 'true' || envValue === 'false') {
          (configData as any)[configKey] = envValue === 'true';
        }
        // Handle number conversion
        else if (!Number.isNaN(Number(envValue))) {
          (configData as any)[configKey] = Number(envValue);
        }
        // String value
        else {
          (configData as any)[configKey] = envValue;
        }
      }
    }

    return this.validate(configData);
  }

  /**
   * Validate configuration object
   */
  validate(config: Partial<TConfig>): TConfig {
    try {
      return this.schema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        
        throw new Error(
          `${this.serviceName} configuration validation failed: ${issues}`
        );
      }
      throw error;
    }
  }

  /**
   * Create a disabled configuration with helpful message
   */
  createDisabled(reason: string): TConfig {
    console.warn(`⚠️  ${this.serviceName} service disabled: ${reason}`);
    
    const baseConfig = {
      ...BaseConfigSchema.parse({}),
      isEnabled: false,
    };

    return this.schema.parse(baseConfig);
  }

  /**
   * Helper method to check if required environment variables are present
   */
  checkRequiredEnvVars(env: Record<string, string | undefined>, required: string[]): string[] {
    const missing: string[] = [];
    
    for (const envKey of required) {
      if (!env[envKey]) {
        missing.push(envKey);
      }
    }
    
    return missing;
  }

  /**
   * Helper method to get default configuration for development
   */
  getDefaultConfig(): Partial<TConfig> {
    return BaseConfigSchema.parse({}) as Partial<TConfig>;
  }
}

/**
 * Factory function to create service configuration factories
 */
export function createConfigFactory<TConfig extends BaseServiceConfig>(
  serviceName: string,
  schema: z.ZodSchema<TConfig>,
  envKeyMappings: Record<string, string>
): VectorStoreConfigFactory<TConfig> {
  return new VectorStoreConfigFactory(serviceName, schema, envKeyMappings);
}

/**
 * Standard environment key mappings for common configuration
 */
export const CommonEnvMappings = {
  timeout: 'VECTOR_STORE_TIMEOUT',
  maxRetries: 'VECTOR_STORE_MAX_RETRIES',
  retryDelay: 'VECTOR_STORE_RETRY_DELAY',
};

/**
 * Helper to merge common mappings with service-specific ones
 */
export function mergeEnvMappings(
  serviceMappings: Record<string, string>
): Record<string, string> {
  return {
    ...CommonEnvMappings,
    ...serviceMappings,
  };
}