// Test mocks for database queries
import type { Chat, DBMessage, User } from './schema';

// Mock data stores
const mockUsers: Map<string, User> = new Map();
const mockChats: Map<string, Chat> = new Map();
const mockMessages: Map<string, DBMessage[]> = new Map();

// Mock user data
let mockUserCounter = 1;
let mockChatCounter = 1;

// Reset mocks between tests
export function resetMocks() {
  mockUsers.clear();
  mockChats.clear();
  mockMessages.clear();
  mockUserCounter = 1;
  mockChatCounter = 1;
}

// Mock implementations
export async function getUser(email: string): Promise<Array<User>> {
  const user = Array.from(mockUsers.values()).find((u) => u.email === email);
  return user ? [user] : [];
}

export async function createUser(email: string, password: string) {
  const id = `user-${mockUserCounter++}`;
  const user: User = {
    id,
    email,
    password,
    type: 'free',
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
      type: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
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
    updatedAt: new Date(),
    visibility: 'private',
  };
  mockChats.set(id, chat);
  return chat;
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

export async function getMessageCountByUserId(userId: string) {
  let count = 0;
  for (const messages of mockMessages.values()) {
    count += messages.filter((m) => m.userId === userId).length;
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
