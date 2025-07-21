import { Client as LangSmithClient } from "langsmith";
import { z } from "zod";
import { langSmithConfig } from "../env";

// Configuration schema
export const LangSmithConfig = z.object({
  apiKey: z.string(),
  projectName: z.string(),
  baseUrl: z.string().optional(),
});

// User feedback schema
export const UserFeedback = z.object({
  runId: z.string(),
  score: z.number().min(0).max(1), // 0 for negative, 1 for positive
  value: z.enum(["thumbs_up", "thumbs_down"]),
  comment: z.string().optional(),
  userId: z.string(),
  metadata: z.record(z.any()).optional(),
});

// RAG generation data schema
export const RagGenerationData = z.object({
  question: z.string(),
  answer: z.string(),
  sources: z.array(
    z.object({
      documentId: z.string(),
      content: z.string(),
      score: z.number(),
      metadata: z.record(z.any()).optional(),
    }),
  ),
  model: z.string(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

// Types
export type LangSmithConfig = z.infer<typeof LangSmithConfig>;
export type UserFeedback = z.infer<typeof UserFeedback>;
export type RagGenerationData = z.infer<typeof RagGenerationData>;

export interface LangSmithService {
  client: LangSmithClient;
  isEnabled: boolean;
  projectName: string;
}

// Create LangSmith service
export function createLangSmithService(
  config: LangSmithConfig,
): LangSmithService {
  const validatedConfig = LangSmithConfig.parse(config);

  if (!validatedConfig.apiKey) {
    console.warn("LangSmith API key not provided. Observability disabled.");
    return {
      client: null as any,
      isEnabled: false,
      projectName: validatedConfig.projectName,
    };
  }

  try {
    const client = new LangSmithClient({
      apiKey: validatedConfig.apiKey,
      apiUrl: validatedConfig.baseUrl,
    });

    return {
      client,
      isEnabled: true,
      projectName: validatedConfig.projectName,
    };
  } catch (error) {
    console.error("Failed to initialize LangSmith client:", error);
    return {
      client: null as any,
      isEnabled: false,
      projectName: validatedConfig.projectName,
    };
  }
}

// Track RAG generation
export async function trackRagGeneration(
  service: LangSmithService,
  data: RagGenerationData,
): Promise<string | null> {
  if (!service.isEnabled) {
    return null;
  }

  try {
    const validatedData = RagGenerationData.parse(data);

    // Generate a unique run ID for tracking
    const runId = crypto.randomUUID();

    await service.client.createRun({
      id: runId,
      name: "rag_generation",
      run_type: "chain",
      inputs: {
        question: validatedData.question,
        sources: validatedData.sources,
        model: validatedData.model,
      },
      outputs: {
        answer: validatedData.answer,
      },
      extra: {
        metadata: {
          sources_count: validatedData.sources.length,
          model: validatedData.model,
          usage: validatedData.usage,
          timestamp: Date.now(),
        },
        tags: ["rag", "generation"],
      },
      project_name: service.projectName,
    });

    return runId;
  } catch (error) {
    console.error("Failed to track RAG generation:", error);
    return null;
  }
}

// Submit user feedback
export async function submitUserFeedback(
  service: LangSmithService,
  feedback: UserFeedback,
): Promise<string | null> {
  if (!service.isEnabled) {
    return null;
  }

  try {
    const validatedFeedback = UserFeedback.parse(feedback);

    await service.client.createFeedback(
      validatedFeedback.runId,
      "user_feedback",
      {
        score: validatedFeedback.score,
        value: validatedFeedback.value,
        comment: validatedFeedback.comment,
      },
    );

    return validatedFeedback.runId;
  } catch (error) {
    console.error("Failed to submit user feedback:", error);
    return null;
  }
}

// Update run with additional metadata
export async function updateRunMetadata(
  service: LangSmithService,
  runId: string,
  metadata: Record<string, any>,
): Promise<boolean> {
  if (!service.isEnabled) {
    return false;
  }

  try {
    await service.client.updateRun(runId, {
      extra: {
        metadata: {
          ...metadata,
          updated_at: Date.now(),
        },
      },
    });

    return true;
  } catch (error) {
    console.error("Failed to update run metadata:", error);
    return false;
  }
}

// Singleton service instance
let langSmithService: LangSmithService | null = null;

export function getLangSmithService(): LangSmithService {
  if (!langSmithService) {
    langSmithService = createLangSmithService({
      apiKey: langSmithConfig.apiKey,
      projectName: langSmithConfig.projectName,
      baseUrl: langSmithConfig.baseUrl,
    });
  }

  return langSmithService;
}

// Export for testing
export { LangSmithClient };
