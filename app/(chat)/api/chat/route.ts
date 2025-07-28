import { geolocation } from "@vercel/functions";
import type { UIMessage } from "ai";
import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
} from "ai";
import { differenceInSeconds } from "date-fns";
import { NextResponse } from "next/server";
import { auth, type UserType } from "@/app/(auth)/auth";
import type { Session } from "next-auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { enhancedSearch } from "@/lib/ai/tools/enhanced-search";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { searchDocuments } from "@/lib/ai/tools/search-documents";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import type { Chat, DBMessage } from "@/lib/db/schema";
import { initializeDI, isDIInitialized } from "@/lib/di";
import { resolve, ServiceTokens } from "@/lib/di/container";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID, getTrailingMessageId } from "@/lib/utils";
import { checkEnvironment } from "@/lib/utils/env-check";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import type { VisibilityType } from "@/components/visibility-selector";

export const maxDuration = 60;

// Type conversion utility for DBMessage[] to UIMessage[]
const convertToUIMessages = (dbMessages: DBMessage[]): UIMessage[] => {
  return dbMessages.map((msg) => ({
    id: msg.id,
    parts: msg.parts as UIMessage["parts"],
    role: msg.role as UIMessage["role"],
    content: "", // Note: content will soon be deprecated in @ai-sdk/react
    createdAt:
      msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt),
    experimental_attachments:
      (msg.attachments as UIMessage["experimental_attachments"]) || [],
  }));
};

function getStreamContext() {
  try {
    // Ensure DI is initialized
    if (!isDIInitialized()) {
      initializeDI();
    }
    return resolve(ServiceTokens.STREAM_CONTEXT);
  } catch (_error) {
    return null;
  }
}

// Helper function to validate environment and initialize DI
function validateEnvironmentAndInitDI(): NextResponse | null {
  const envStatus = checkEnvironment();
  if (!envStatus.isValid) {
    return NextResponse.json(
      {
        error: "Service unavailable - configuration issues",
        details: envStatus.errors,
      },
      { status: 503 },
    );
  }

  try {
    if (!isDIInitialized()) {
      initializeDI();
    }
  } catch (_error) {
    // DI initialization errors are handled silently
  }

  return null;
}

// Helper function to parse and validate request body
async function parseRequestBody(request: Request): Promise<PostRequestBody> {
  const json = await request.json();
  return postRequestBodySchema.parse(json);
}

// Helper function to validate model and provide fallback
function validateAndFallbackModel(selectedChatModel: string): string {
  try {
    // Test if the selected model is available
    const _testModel = myProvider.languageModel(selectedChatModel);
    return selectedChatModel;
  } catch (_error) {
    return "openai-gpt-4.1-mini"; // Fast fallback model
  }
}

// Helper function to check rate limits with caching
async function checkRateLimit(user: {
  id: string;
  type: UserType;
}): Promise<Response | null> {
  // Performance optimization: Use cache for rate limit checks
  try {
    const { getSmartCache } = await import("@/lib/cache");
    const smartCache = await getSmartCache();

    const cacheKey = `rate-limit:${user.id}:${new Date().toDateString()}`;
    let messageCount = await smartCache.getCachedHealthCheck(
      "rate-limit",
      cacheKey,
    );

    if (messageCount === null) {
      messageCount = await getMessageCountByUserId({
        id: user.id,
        differenceInHours: 24,
      });

      // Cache for 5 minutes to avoid repeated DB queries
      await smartCache.cacheHealthCheck(
        "rate-limit",
        cacheKey,
        messageCount,
        5 * 60 * 1000,
      );
    }

    if (messageCount > entitlementsByUserType[user.type].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    return null;
  } catch {
    // Fallback to direct DB query if cache fails
    const messageCount = await getMessageCountByUserId({
      id: user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[user.type].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    return null;
  }
}

// Helper function to initialize or validate chat
async function initializeOrValidateChat(
  id: string,
  message: UIMessage,
  userId: string,
  selectedVisibilityType: VisibilityType,
): Promise<Response | null> {
  const chat = await getChatById({ id });

  if (chat) {
    if (chat.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }
  } else {
    // Ensure the message has the correct date type for title generation
    let messageCreatedAt: Date;
    if (message.createdAt instanceof Date) {
      messageCreatedAt = message.createdAt;
    } else if (message.createdAt) {
      messageCreatedAt = new Date(message.createdAt);
    } else {
      messageCreatedAt = new Date();
    }

    const messageForTitle = {
      ...message,
      createdAt: messageCreatedAt,
    };

    const title = await generateTitleFromUserMessage({
      message: messageForTitle,
    });

    await saveChat({
      id,
      userId,
      title,
      visibility: selectedVisibilityType,
    });
  }

  return null;
}

// Helper function to setup messages and context
async function setupMessagesAndContext(
  id: string,
  message: UIMessage,
  request: Request,
): Promise<{
  messages: UIMessage[];
  normalizedMessage: UIMessage;
  requestHints: RequestHints;
}> {
  const previousMessages = await getMessagesByChatId({ id });

  // Ensure the message has the correct date type
  let normalizedMessageCreatedAt: Date;
  if (message.createdAt instanceof Date) {
    normalizedMessageCreatedAt = message.createdAt;
  } else if (message.createdAt) {
    normalizedMessageCreatedAt = new Date(message.createdAt);
  } else {
    normalizedMessageCreatedAt = new Date();
  }

  const normalizedMessage = {
    ...message,
    createdAt: normalizedMessageCreatedAt,
  };

  const rawMessages = appendClientMessage({
    messages: convertToUIMessages(previousMessages),
    message: normalizedMessage,
  });

  // Convert Message[] to UIMessage[] by ensuring parts is not undefined
  const messages: UIMessage[] = rawMessages.map((msg) => ({
    ...msg,
    parts: msg.parts || [],
  }));

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
        role: "user",
        parts: normalizedMessage.parts || [],
        attachments: normalizedMessage.experimental_attachments ?? [],
        createdAt: new Date(),
      },
    ],
  });

  return { messages, normalizedMessage, requestHints };
}

// Helper function to create stream configuration
function createStreamForChat(
  modelToUse: string,
  requestHints: RequestHints,
  messages: UIMessage[],
  selectedSources: string[] | undefined,
  session: Session,
  id: string,
  normalizedMessage: UIMessage,
) {
  return createDataStream({
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
            modelToUse === "chat-model-reasoning"
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                  ...(selectedSources && selectedSources.length > 0
                    ? ["enhancedSearch" as const, "searchDocuments" as const]
                    : []),
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
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
              (selectedSources as (
                | "openai"
                | "neon"
                | "memory"
                | "unified"
              )[]) || ["memory"],
              // Pass recent conversation history for context-aware optimization
              messages
                .filter(
                  (msg) => msg.role === "user" || msg.role === "assistant",
                )
                .slice(-10) // Last 10 messages for context
                .map((msg) => ({
                  role: msg.role as "user" | "assistant",
                  content: Array.isArray(msg.content)
                    ? msg.content
                        .map((c) => (c.type === "text" ? c.text : ""))
                        .join(" ")
                    : msg.content || "",
                  timestamp: Date.now(), // Use current time as approximation
                })),
            ),
            enhancedSearch: enhancedSearch(
              (selectedSources as (
                | "openai"
                | "neon"
                | "memory"
                | "unified"
              )[]) || ["memory"],
            ),
          },
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (msg) => msg.role === "assistant",
                  ),
                });

                if (!assistantId) {
                  throw new Error("No assistant message found!");
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
                // Failed to save messages - continue streaming
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      } catch (_streamError) {
        dataStream.writeData({
          type: "error",
          content: "Failed to initialize AI model. Please try again.",
        });
      }
    },
    onError: () => {
      return "Oops, an error occurred!";
    },
  });
}

export async function POST(request: Request) {
  // Validate environment and initialize DI
  const envError = validateEnvironmentAndInitDI();
  if (envError) {
    return envError;
  }

  let requestBody: PostRequestBody;

  try {
    requestBody = await parseRequestBody(request);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedSources,
    } = requestBody;

    // Validate model and get session
    const modelToUse = validateAndFallbackModel(selectedChatModel);
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Check rate limits
    const rateLimitError = await checkRateLimit(session.user);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Normalize message createdAt to Date before function calls
    let normalizedCreatedAt: Date;
    if (message.createdAt instanceof Date) {
      normalizedCreatedAt = message.createdAt;
    } else if (message.createdAt) {
      normalizedCreatedAt = new Date(message.createdAt);
    } else {
      normalizedCreatedAt = new Date();
    }

    const normalizedMessageForCalls: UIMessage = {
      ...message,
      createdAt: normalizedCreatedAt,
    };

    // Handle chat initialization
    const chatError = await initializeOrValidateChat(
      id,
      normalizedMessageForCalls,
      session.user.id,
      selectedVisibilityType,
    );
    if (chatError) {
      return chatError;
    }

    // Setup messages and geolocation
    const { messages, normalizedMessage, requestHints } =
      await setupMessagesAndContext(id, normalizedMessageForCalls, request);

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createStreamForChat(
      modelToUse,
      requestHints,
      messages,
      selectedSources,
      session,
      id,
      normalizedMessage,
    );

    // Return the stream directly - resumableStream functionality removed for now
    return new Response(stream);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Handle all other errors with a generic 500 response
    return new Response(
      JSON.stringify({
        code: "internal_server_error:chat",
        message: "An unexpected error occurred. Please try again later.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Helper function to validate stream resume request
async function validateStreamResumeRequest(
  request: Request,
): Promise<{ chatId: string; session: Session } | Response> {
  const streamContext = getStreamContext();
  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  return { chatId, session };
}

// Helper function to validate chat access
async function validateChatAccess(
  chatId: string,
  userId: string,
): Promise<Chat | Response> {
  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (!chat) {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (chat.visibility === "private" && chat.userId !== userId) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  return chat;
}

// Helper function to create restored stream from recent message
function createRestoredStreamFromMessage(
  chatId: string,
  resumeRequestedAt: Date,
  emptyDataStream: ReadableStream,
): Promise<Response> {
  return getMessagesByChatId({ id: chatId }).then((messages) => {
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);
    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: "append-message",
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(restoredStream, { status: 200 });
  });
}

export async function GET(request: Request) {
  const resumeRequestedAt = new Date();

  // Validate stream resume request
  const validationResult = await validateStreamResumeRequest(request);
  if (validationResult instanceof Response) {
    return validationResult;
  }
  const { chatId, session } = validationResult;

  // Validate chat access
  const chatResult = await validateChatAccess(chatId, session.user.id);
  if (chatResult instanceof Response) {
    return chatResult;
  }

  // Check for valid stream
  const streamIds = await getStreamIdsByChatId({ chatId });
  if (!(streamIds.length && streamIds.at(-1))) {
    return new ChatSDKError("not_found:stream").toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {
      // Empty data stream for resume endpoint
    },
  });

  const stream = emptyDataStream;

  // Handle streaming during SSR
  if (!stream) {
    return createRestoredStreamFromMessage(
      chatId,
      resumeRequestedAt,
      emptyDataStream,
    );
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
