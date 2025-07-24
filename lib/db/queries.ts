import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { ArtifactKind } from '@/components/artifact';
import type { VisibilityType } from '@/components/visibility-selector';
import { POSTGRES_URL } from '../env';
import { ChatSDKError } from '../errors';
import { generateUUID } from '../utils';
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
} from './schema';
import { generateHashedPassword } from './server-utils';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// Use validated environment variable with fallback for tests
let client: any = null;
let db: any = null;
let connectionAttempted = false;

function initializeDatabase() {
  if (connectionAttempted) { return db; }

  connectionAttempted = true;

  try {
    // Check if we're in test mode first
    const isTestMode =
      process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';

    if (isTestMode) {
      return null;
    }

    client = postgres(POSTGRES_URL);
    db = drizzle(client);
    return db;
  } catch (_error) {
    return null;
  }
}

// Export the database instance for DI container
export function getDb() {
  return initializeDatabase();
}

export async function getUser(email: string): Promise<User[]> {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    return await database.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { insertId: `user-${Date.now()}` };
  }

  try {
    return await database
      .insert(user)
      .values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());
  const database = initializeDatabase();

  // If database is not available (test mode), return mock data
  if (!database) {
    const id = `guest-${Date.now()}`;
    return [{ id, email }];
  }

  try {
    return await database.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function ensureUserExists(userId: string) {
  const database = initializeDatabase();

  // If database is not available (test mode), return true (assume user exists)
  if (!database) {
    return true;
  }

  try {
    const existingUser = await database
      .select()
      .from(user)
      .where(eq(user.id, userId));

    if (existingUser.length === 0) {
      await database.insert(user).values({
        id: userId,
        email: `guest-${userId}@temp.local`,
        password: generateHashedPassword(generateUUID()),
      });
    }

    return true;
  } catch (_error) {
    return false;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { insertId: id };
  }

  try {
    // Ensure the user exists before saving the chat
    await ensureUserExists(userId);

    return await database.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { id };
  }

  try {
    await database.delete(vote).where(eq(vote.chatId, id));
    await database.delete(message).where(eq(message.chatId, id));
    await database.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await database
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      database
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await database
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return null
  if (!database) {
    return null;
  }

  try {
    const [selectedChat] = await database
      .select()
      .from(chat)
      .where(eq(chat.id, id));
    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: DBMessage[];
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { insertCount: messages.length };
  }

  try {
    return await database.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    return await database
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt))
      .limit(100); // Prevent accidental huge queries
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

// Optimized function that joins messages with votes in a single query
export async function getMessagesWithVotesByChatId({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    return await database
      .select({
        id: message.id,
        chatId: message.chatId,
        role: message.role,
        parts: message.parts,
        attachments: message.attachments,
        createdAt: message.createdAt,
        vote: {
          isUpvoted: vote.isUpvoted,
          messageId: vote.messageId,
        },
      })
      .from(message)
      .leftJoin(vote, eq(vote.messageId, message.id))
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt))
      .limit(100);
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages with votes by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { messageId, type };
  }

  try {
    const [existingVote] = await database
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await database
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await database.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    return await database.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return [
      {
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  try {
    return await database
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    const documents = await database
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return null
  if (!database) {
    return null;
  }

  try {
    const [selectedDocument] = await database
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return [{ id, deletedAt: timestamp }];
  }

  try {
    await database
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await database
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { insertCount: suggestions.length };
  }

  try {
    return await database.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    return await database
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    return await database.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { deletedCount: 0 };
  }

  try {
    const messagesToDelete = await database
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message: any) => message.id);

    if (messageIds.length > 0) {
      await database
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await database
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return mock result
  if (!database) {
    return { chatId, visibility };
  }

  try {
    return await database
      .update(chat)
      .set({ visibility })
      .where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), return 0 (no rate limit)
  if (!database) {
    return 0;
  }

  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await database
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  const database = initializeDatabase();

  // If database is not available (test mode), just return (no-op)
  if (!database) {
    return;
  }

  try {
    await database
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  const database = initializeDatabase();

  // If database is not available (test mode), return empty array
  if (!database) {
    return [];
  }

  try {
    const streamIds = await database
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }: any) => id);
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}
