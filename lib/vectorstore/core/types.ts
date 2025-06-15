import { z } from 'zod';

// Base configuration for all vector store services
export const BaseServiceConfig = z.object({
  isEnabled: z.boolean().default(false),
  timeout: z.number().positive().default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
  retryDelay: z.number().positive().default(1000),
});

export type BaseServiceConfig = z.infer<typeof BaseServiceConfig>;

// Base search request schema
export const BaseSearchRequest = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  maxResults: z.number().min(1).max(100).default(10),
  metadata: z.record(z.any()).optional(),
  threshold: z.number().min(0).max(1).default(0.3),
});

export type BaseSearchRequest = z.infer<typeof BaseSearchRequest>;

// Base search result schema
export const BaseSearchResult = z.object({
  id: z.string(),
  content: z.string(),
  score: z.number().min(0).max(1),
  metadata: z.record(z.any()).optional(),
});

export type BaseSearchResult = z.infer<typeof BaseSearchResult>;

// Base response schema
export const BaseResponse = z.object({
  success: z.boolean(),
  message: z.string(),
  executionTime: z.number(),
  totalResults: z.number().optional(),
});

export type BaseResponse = z.infer<typeof BaseResponse>;

// Health check result
export const HealthCheckResult = z.object({
  isHealthy: z.boolean(),
  message: z.string(),
  responseTime: z.number(),
  error: z.string().optional(),
  lastChecked: z.date(),
});

export type HealthCheckResult = z.infer<typeof HealthCheckResult>;

// Error classification
export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN = 'unknown',
}

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  originalError: Error;
  retryable: boolean;
  suggestedDelay?: number;
}

// Service status
export enum ServiceStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
  INITIALIZING = 'initializing',
}

// Monitoring metrics
export interface ServiceMetrics {
  operationName: string;
  success: boolean;
  duration: number;
  errorType?: ErrorType;
  timestamp: Date;
  serviceName: string;
}

// Generic service interface
export interface VectorStoreService<
  TSearchRequest = BaseSearchRequest,
  TSearchResult = BaseSearchResult,
> {
  readonly serviceName: string;
  readonly isEnabled: boolean;
  readonly status: ServiceStatus;

  search(request: TSearchRequest): Promise<TSearchResult[]>;
  healthCheck(): Promise<HealthCheckResult>;
  getMetrics?(): Promise<ServiceMetrics[]>;
}

// Configuration factory interface
export interface ConfigFactory<TConfig> {
  create(env: Record<string, string | undefined>): TConfig;
  validate(config: Partial<TConfig>): TConfig;
}

// Service factory interface
export interface ServiceFactory<TConfig, TService> {
  create(config: TConfig): TService;
  createDisabled(reason: string): TService;
}
