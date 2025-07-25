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
export function getUser(email: string): Promise<User[]> {
  const user = Array.from(mockUsers.values()).find((u) => u.email === email);
  return user ? [user] : [];
}

export function createUser(email: string, password: string) {
  const id = `user-${mockUserCounter++}`;
  const user: User = {
    id,
    email,
    password,
  };
  mockUsers.set(id, user);
  return { insertId: id };
}

export function createGuestUser() {
  const id = `guest-${mockUserCounter++}`;
  const email = `guest-${Date.now()}`;
  const user: User = {
    id,
    email,
    password: 'mock-password',
  };
  mockUsers.set(id, user);
  return [{ id, email }];
}

export function ensureUserExists(userId: string) {
  if (!mockUsers.has(userId)) {
    const user: User = {
      id: userId,
      email: `user-${userId}@test.com`,
      password: 'mock-password',
    };
    mockUsers.set(userId, user);
  }
  return mockUsers.get(userId);
}

export function saveChat({
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

export function getChatById({ id }: { id: string }) {
  return mockChats.get(id) || null;
}

export function saveMessages({ messages }: { messages: DBMessage[] }) {
  for (const message of messages) {
    const chatMessages = mockMessages.get(message.chatId) || [];
    chatMessages.push(message);
    mockMessages.set(message.chatId, chatMessages);
  }
}

export function getMessagesByChatId({ id }: { id: string }) {
  return mockMessages.get(id) || [];
}

export function getMessageCountByUserId(userId: string) {
  let count = 0;
  for (const [chatId, messages] of mockMessages.entries()) {
    const chat = mockChats.get(chatId);
    if (chat && chat.userId === userId) {
      count += messages.length;
    }
  }
  return count;
}

// Other mock functions for completeness
export function deleteChatById({ id }: { id: string }) {
  mockChats.delete(id);
  mockMessages.delete(id);
}

export function createStreamId() {
  return `stream-${Date.now()}`;
}

export function getStreamIdsByChatId({ id }: { id: string }) {
  return [`stream-${id}`];
}

export function getDb() {
  return null; // Mock DB instance
}
