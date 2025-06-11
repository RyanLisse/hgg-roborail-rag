import { z } from 'zod';

// Environment validation schema with logical grouping
const envSchema = z.object({
  // Node.js Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Authentication & Security
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required for NextAuth.js'),
  
  // Database Configuration
  POSTGRES_URL: z.string().url('POSTGRES_URL must be a valid PostgreSQL connection string'),
  
  // AI Provider API Keys (at least one required)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  
  // Vector Store Configuration
  OPENAI_VECTORSTORE: z.string().optional().describe('Default OpenAI vector store ID (starts with vs_)'),
  
  // Storage & File Upload
  BLOB_READ_WRITE_TOKEN: z.string().optional().describe('Vercel Blob storage token for file uploads'),
  
  // Observability & Monitoring (Optional)
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),
  LANGSMITH_PROJECT_NAME: z.string().optional(),
  LANGSMITH_BASE_URL: z.string().url().optional(),
  LANGSMITH_TRACING: z.enum(['true', 'false']).optional().default('false'),
  
  // Redis for resumable streams (Optional)
  REDIS_URL: z.string().url().optional().describe('Redis URL for resumable streaming functionality'),
  
  // Testing & Playwright
  PLAYWRIGHT_TEST_BASE_URL: z.string().url().optional(),
  PLAYWRIGHT: z.string().optional(),
  CI_PLAYWRIGHT: z.string().optional(),
});

// Custom refinement to ensure at least one AI provider API key is provided
const envSchemaWithRefinements = envSchema.refine(
  (data) => {
    const hasAtLeastOneProvider = !!(
      data.OPENAI_API_KEY ||
      data.ANTHROPIC_API_KEY ||
      data.GOOGLE_GENERATIVE_AI_API_KEY ||
      data.COHERE_API_KEY ||
      data.GROQ_API_KEY ||
      data.XAI_API_KEY
    );
    return hasAtLeastOneProvider;
  },
  {
    message: 'At least one AI provider API key must be provided (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, COHERE_API_KEY, GROQ_API_KEY, or XAI_API_KEY)',
    path: ['AI_PROVIDERS'],
  }
).refine(
  (data) => {
    // Validate OpenAI API key format if provided
    if (data.OPENAI_API_KEY && !data.OPENAI_API_KEY.startsWith('sk-')) {
      return false;
    }
    return true;
  },
  {
    message: 'OPENAI_API_KEY must start with "sk-" if provided',
    path: ['OPENAI_API_KEY'],
  }
).refine(
  (data) => {
    // Validate OpenAI vector store ID format if provided
    if (data.OPENAI_VECTORSTORE && !data.OPENAI_VECTORSTORE.startsWith('vs_')) {
      return false;
    }
    return true;
  },
  {
    message: 'OPENAI_VECTORSTORE must start with "vs_" if provided',
    path: ['OPENAI_VECTORSTORE'],
  }
).refine(
  (data) => {
    // If LangSmith tracing is enabled, API key is required
    if (data.LANGSMITH_TRACING === 'true' && !data.LANGSMITH_API_KEY) {
      return false;
    }
    return true;
  },
  {
    message: 'LANGSMITH_API_KEY is required when LANGSMITH_TRACING is enabled',
    path: ['LANGSMITH_API_KEY'],
  }
);

// Infer TypeScript type from schema
export type Env = z.infer<typeof envSchemaWithRefinements>;

// Validation function with detailed error reporting
export function validateEnv(): Env {
  try {
    const result = envSchemaWithRefinements.safeParse(process.env);
    
    if (!result.success) {
      const errorMessages = result.error.errors.map((error) => {
        const path = error.path.join('.');
        return `  - ${path}: ${error.message}`;
      });
      
      throw new Error(
        `Environment variable validation failed:\n${errorMessages.join('\n')}\n\nPlease check your .env.local file and ensure all required environment variables are set correctly.`
      );
    }
    
    return result.data;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // This shouldn't happen due to safeParse, but handle just in case
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      });
      
      throw new Error(
        `Environment variable validation failed:\n${errorMessages.join('\n')}\n\nPlease check your .env.local file and ensure all required environment variables are set correctly.`
      );
    }
    throw error;
  }
}

// Validate environment variables at module load
let env: Env;

// Function to initialize env
function initializeEnv(): Env {
  try {
    return validateEnv();
  } catch (error) {
    // In development or when not all vars are available yet (like during migration), log the error but don't crash
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined) {
      console.warn('Environment validation warning during initialization:', error);
      // Create a partial env object with defaults for development
      return {
        NODE_ENV: (process.env.NODE_ENV as any) || 'development',
        AUTH_SECRET: process.env.AUTH_SECRET || 'dev-secret-change-in-production',
        POSTGRES_URL: process.env.POSTGRES_URL || '',
        LANGSMITH_TRACING: (process.env.LANGSMITH_TRACING as any) || 'false',
        // Include other available vars
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        COHERE_API_KEY: process.env.COHERE_API_KEY,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        XAI_API_KEY: process.env.XAI_API_KEY,
        OPENAI_VECTORSTORE: process.env.OPENAI_VECTORSTORE,
        BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
        LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY,
        LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT,
        LANGSMITH_PROJECT_NAME: process.env.LANGSMITH_PROJECT_NAME,
        LANGSMITH_BASE_URL: process.env.LANGSMITH_BASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        PLAYWRIGHT_TEST_BASE_URL: process.env.PLAYWRIGHT_TEST_BASE_URL,
        PLAYWRIGHT: process.env.PLAYWRIGHT,
        CI_PLAYWRIGHT: process.env.CI_PLAYWRIGHT,
      } as Env;
    } else {
      // In production, crash immediately
      throw error;
    }
  }
}

// Initialize env lazily
env = initializeEnv();

// Export validated environment variables with type safety
export default env;

// Helper functions for common environment checks
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

// Check if specific features are enabled
export const isLangSmithEnabled = env.LANGSMITH_TRACING === 'true' && !!env.LANGSMITH_API_KEY;
export const isRedisEnabled = !!env.REDIS_URL;
export const isBlobStorageEnabled = !!env.BLOB_READ_WRITE_TOKEN;

// AI Provider availability checks
export const availableAIProviders = {
  openai: !!env.OPENAI_API_KEY,
  anthropic: !!env.ANTHROPIC_API_KEY,
  google: !!env.GOOGLE_GENERATIVE_AI_API_KEY,
  cohere: !!env.COHERE_API_KEY,
  groq: !!env.GROQ_API_KEY,
  xai: !!env.XAI_API_KEY,
} as const;

// Vector store configuration
export const vectorStoreConfig = {
  openaiVectorStoreId: env.OPENAI_VECTORSTORE || null,
  isOpenAIVectorStoreConfigured: !!env.OPENAI_VECTORSTORE,
} as const;

// LangSmith configuration
export const langSmithConfig = {
  apiKey: env.LANGSMITH_API_KEY || '',
  projectName: env.LANGSMITH_PROJECT || env.LANGSMITH_PROJECT_NAME || 'rra-rag-chatbot',
  baseUrl: env.LANGSMITH_BASE_URL,
  isEnabled: isLangSmithEnabled,
} as const;

// Testing configuration
export const testConfig = {
  isPlaywrightTest: !!(
    env.PLAYWRIGHT_TEST_BASE_URL ||
    env.PLAYWRIGHT ||
    env.CI_PLAYWRIGHT
  ),
  playwrightBaseUrl: env.PLAYWRIGHT_TEST_BASE_URL,
} as const;

// Export individual environment variables with proper typing
export const {
  NODE_ENV,
  AUTH_SECRET,
  POSTGRES_URL,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY,
  COHERE_API_KEY,
  GROQ_API_KEY,
  XAI_API_KEY,
  OPENAI_VECTORSTORE,
  BLOB_READ_WRITE_TOKEN,
  LANGSMITH_API_KEY,
  LANGSMITH_PROJECT,
  LANGSMITH_PROJECT_NAME,
  LANGSMITH_BASE_URL,
  LANGSMITH_TRACING,
  REDIS_URL,
  PLAYWRIGHT_TEST_BASE_URL,
  PLAYWRIGHT,
  CI_PLAYWRIGHT,
} = env;