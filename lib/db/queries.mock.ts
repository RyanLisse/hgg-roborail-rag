// Test mocks for database queries
import type { Chat, DBMessage, User } from './schema';

// Mock data stores
const mockUsers: Map<string, User> = new Map();
const mockChats: Map<string, Chat> = new Map();
const mockMessages: Map<string, DBMessage[]> = new Map();

// Mock user data
let mockUserCounter = 1;
let _mockChatCounter = 1;

// Reset mocks between tests
export function resetMocks() {
  mockUsers.clear();
  mockChats.clear();
  mockMessages.clear();
  mockUserCounter = 1;
  _mockChatCounter = 1;
}

// Mock implementations
export async function getUser(email: string): Promise<User[]> {
  const user = Array.from(mockUsers.values()).find((u) => u.email === email);
  return user ? [user] : [];
}

export async function createUser(email: string, password: string) {
  const id = `user-${mockUserCounter++}`;
  const user: User = {
    id,
    email,
    password,
    type: 'user',
  };
  mockUsers.set(id, user);
  return { insertId: id };
}

export async function createGuestUser() {
  const id = `guest-${mockUserCounter++}`;
  const email = `guest-${Date.now()}`;
  const user: User = {
    id,
    email,
    password: 'mock-password',
    type: 'guest',
  };
  mockUsers.set(id, user);
  return [{ id, email }];
}

export async function ensureUserExists(userId: string) {
  if (!mockUsers.has(userId)) {
    const user: User = {
      id: userId,
      email: `user-${userId}@test.com`,
      password: 'mock-password',
      type: 'user',
    };
    mockUsers.set(userId, user);
  }
  return mockUsers.get(userId);
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  const chat: Chat = {
    id,
    userId,
    title,
    createdAt: new Date(),
    visibility: 'private',
  };
  mockChats.set(id, chat);
  return chat;
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
  // Create some mock chat data for testing
  const userChats = Array.from(mockChats.values()).filter(chat => chat.userId === id);
  
  // If no chats exist for user, create some mock data
  if (userChats.length === 0) {
    const mockChat1: Chat = {
      id: `chat-${Date.now()}-1`,
      userId: id,
      title: 'Test Chat 1',
      createdAt: new Date(Date.now() - 86400000), // 1 day ago
      visibility: 'private',
    };
    const mockChat2: Chat = {
      id: `chat-${Date.now()}-2`,
      userId: id,
      title: 'Test Chat 2',
      createdAt: new Date(Date.now() - 172800000), // 2 days ago
      visibility: 'private',
    };
    
    mockChats.set(mockChat1.id, mockChat1);
    mockChats.set(mockChat2.id, mockChat2);
    userChats.push(mockChat1, mockChat2);
  }
  
  // Sort by creation date descending
  userChats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  // Apply pagination logic
  let filteredChats = userChats;
  
  if (startingAfter) {
    const startIndex = userChats.findIndex(chat => chat.id === startingAfter);
    if (startIndex >= 0) {
      filteredChats = userChats.slice(startIndex + 1);
    }
  } else if (endingBefore) {
    const endIndex = userChats.findIndex(chat => chat.id === endingBefore);
    if (endIndex >= 0) {
      filteredChats = userChats.slice(0, endIndex);
    }
  }
  
  const hasMore = filteredChats.length > limit;
  const chats = hasMore ? filteredChats.slice(0, limit) : filteredChats;
  
  return {
    chats,
    hasMore,
  };
}

export async function getChatById({ id }: { id: string }) {
  return mockChats.get(id) || null;
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  for (const message of messages) {
    const chatMessages = mockMessages.get(message.chatId) || [];
    chatMessages.push(message);
    mockMessages.set(message.chatId, chatMessages);
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  return mockMessages.get(id) || [];
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  let count = 0;
  const cutoffTime = new Date(Date.now() - differenceInHours * 60 * 60 * 1000);

  for (const [chatId, messages] of mockMessages.entries()) {
    const chat = mockChats.get(chatId);
    if (chat && chat.userId === id) {
      count += messages.filter(
        (m) => m.createdAt > cutoffTime && m.role === 'user',
      ).length;
    }
  }
  return count;
}

// Other mock functions for completeness
export async function deleteChatById({ id }: { id: string }) {
  mockChats.delete(id);
  mockMessages.delete(id);
}

export async function createStreamId() {
  return `stream-${Date.now()}`;
}

export async function getStreamIdsByChatId({ id }: { id: string }) {
  return [`stream-${id}`];
}

export function getDb() {
  return null; // Mock DB instance
}
