import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
} from 'ai';
import { NextResponse } from 'next/server';
import { auth, type UserType } from '@/app/(auth)/auth';
import { checkEnvironment } from '@/lib/utils/env-check';
import { initializeDI, isDIInitialized } from '@/lib/di';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { searchDocuments } from '@/lib/ai/tools/search-documents';
import { enhancedSearch } from '@/lib/ai/tools/enhanced-search';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';
import { resolve, ServiceTokens } from '@/lib/di/container';
import type { UIMessage } from 'ai';
import type { DBMessage } from '@/lib/db/schema';

export const maxDuration = 60;

// Type conversion utility for DBMessage[] to UIMessage[]
const convertToUIMessages = (dbMessages: DBMessage[]): UIMessage[] => {
  return dbMessages.map((msg) => ({
    id: msg.id,
    parts: msg.parts as UIMessage['parts'],
    role: msg.role as UIMessage['role'],
    content: '', // Note: content will soon be deprecated in @ai-sdk/react
    createdAt:
      msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt),
    experimental_attachments: (msg.attachments as any) || [],
  }));
};

function getStreamContext() {
  try {
    // Ensure DI is initialized
    if (!isDIInitialized()) {
      initializeDI();
    }
    return resolve(ServiceTokens.STREAM_CONTEXT);
  } catch (error) {
    console.error('Failed to resolve stream context service:', error);
    return null;
  }
}

export async function POST(request: Request) {
  // Check environment configuration
  const envStatus = checkEnvironment();
  if (!envStatus.isValid) {
    console.error('Environment validation failed:', envStatus.errors);
    return NextResponse.json(
      {
        error: 'Service unavailable - configuration issues',
        details: envStatus.errors,
      },
      { status: 503 },
    );
  }

  // Log any warnings for debugging
  if (envStatus.warnings.length > 0) {
    console.warn('Environment warnings:', envStatus.warnings);
  }

  // Initialize DI system if not already done (with error handling)
  try {
    if (!isDIInitialized()) {
      initializeDI();
    }
  } catch (error) {
    console.warn(
      'DI initialization failed, continuing with limited functionality:',
      error,
    );
  }

  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedSources,
    } = requestBody;

    // Validate and fallback model selection
    let modelToUse = selectedChatModel;
    try {
      // Test if the selected model is available
      const testModel = myProvider.languageModel(selectedChatModel);
    } catch (error) {
      console.warn(
        `Selected model ${selectedChatModel} unavailable, using fallback`,
      );
      modelToUse = 'openai-gpt-4.1-mini'; // Fast fallback model
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      // Ensure the message has the correct date type for title generation
      const messageForTitle = {
        ...message,
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt
            : new Date(message.createdAt),
      };

      const title = await generateTitleFromUserMessage({
        message: messageForTitle,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    // Ensure the message has the correct date type
    const normalizedMessage = {
      ...message,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt
          : new Date(message.createdAt),
    };

    const messages = appendClientMessage({
      messages: convertToUIMessages(previousMessages),
      message: normalizedMessage,
    });

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: normalizedMessage.id,
          role: 'user',
          parts: normalizedMessage.parts,
          attachments: normalizedMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createDataStream({
      execute: (dataStream) => {
        try {
          const result = streamText({
            model: myProvider.languageModel(modelToUse),
            system: systemPrompt({
              selectedChatModel: modelToUse,
              requestHints,
            }),
            messages,
            maxSteps: 5,
            experimental_activeTools:
              modelToUse === 'chat-model-reasoning'
                ? []
                : [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                    ...(selectedSources && selectedSources.length > 0
                      ? ['enhancedSearch' as const, 'searchDocuments' as const]
                      : []),
                  ],
            experimental_transform: smoothStream({ chunking: 'word' }),
            experimental_generateMessageId: generateUUID,
            tools: {
              getWeather,
              createDocument: createDocument({ session, dataStream }),
              updateDocument: updateDocument({ session, dataStream }),
              requestSuggestions: requestSuggestions({
                session,
                dataStream,
              }),
              searchDocuments: searchDocuments(
                selectedSources || ['memory'],
                // Pass recent conversation history for context-aware optimization
                messages
                  .filter(
                    (msg) => msg.role === 'user' || msg.role === 'assistant',
                  )
                  .slice(-10) // Last 10 messages for context
                  .map((msg) => ({
                    role: msg.role as 'user' | 'assistant',
                    content: Array.isArray(msg.content)
                      ? msg.content
                          .map((c) => (c.type === 'text' ? c.text : ''))
                          .join(' ')
                      : msg.content || '',
                    timestamp: Date.now(), // Use current time as approximation
                  })),
              ),
              enhancedSearch: enhancedSearch(selectedSources || ['memory']),
            },
            onFinish: async ({ response }) => {
              if (session.user?.id) {
                try {
                  const assistantId = getTrailingMessageId({
                    messages: response.messages.filter(
                      (message) => message.role === 'assistant',
                    ),
                  });

                  if (!assistantId) {
                    throw new Error('No assistant message found!');
                  }

                  const [, assistantMessage] = appendResponseMessages({
                    messages: [normalizedMessage],
                    responseMessages: response.messages,
                  });

                  await saveMessages({
                    messages: [
                      {
                        id: assistantId,
                        chatId: id,
                        role: assistantMessage.role,
                        parts: assistantMessage.parts,
                        attachments:
                          assistantMessage.experimental_attachments ?? [],
                        createdAt: new Date(),
                      },
                    ],
                  });
                } catch (_) {
                  console.error('Failed to save chat');
                }
              }
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'stream-text',
            },
          });

          result.consumeStream();

          result.mergeIntoDataStream(dataStream, {
            sendReasoning: true,
          });
        } catch (streamError) {
          console.error('Stream creation failed:', streamError);
          dataStream.writeData({
            type: 'error',
            content: 'Failed to initialize AI model. Please try again.',
          });
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    // Return the stream directly - resumableStream functionality removed for now
    return new Response(stream);
  } catch (error) {
    console.error('Chat API error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Handle all other errors with a generic 500 response
    return new Response(
      JSON.stringify({
        code: 'internal_server_error:chat',
        message: 'An unexpected error occurred. Please try again later.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  // Return the data stream directly - resumableStream functionality removed for now
  const stream = emptyDataStream;

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: 'append-message',
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(restoredStream, { status: 200 });
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
