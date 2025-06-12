import { z } from 'zod';
import { getAllModelIds } from '@/lib/ai/models';

const textPartSchema = z.object({
  text: z.string().min(1).max(2000),
  type: z.enum(['text']),
});

// Get all available model IDs for validation with fallback
let modelIds: string[];
try {
  modelIds = getAllModelIds();
  if (modelIds.length === 0) {
    throw new Error('No model IDs available');
  }
} catch (error) {
  console.error('Failed to load model IDs:', error);
  // Fallback to basic model IDs to prevent schema creation failure
  modelIds = [
    'openai-gpt-4o',
    'openai-gpt-4o-mini',
    'chat-model',
    'chat-model-reasoning',
  ];
}

const chatModelSchema = z.enum(modelIds as [string, ...string[]]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    createdAt: z
      .union([
        z.string().datetime(),
        z.date(),
        z.string().transform((str) => new Date(str)),
      ])
      .refine((date) => {
        const d = date instanceof Date ? date : new Date(date);
        return !Number.isNaN(d.getTime());
      }, 'Invalid date format'),
    role: z.enum(['user']),
    content: z.string().min(1).max(2000),
    parts: z.array(textPartSchema),
    experimental_attachments: z
      .array(
        z.object({
          url: z.string().url(),
          name: z.string().min(1).max(2000),
          contentType: z.enum(['image/png', 'image/jpg', 'image/jpeg']),
        }),
      )
      .optional(),
  }),
  selectedChatModel: chatModelSchema,
  selectedVisibilityType: z.enum(['public', 'private']),
  selectedSources: z.array(z.enum(['memory', 'openai', 'neon'])).optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
