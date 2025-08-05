import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
  integer,
  real,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enhanced enums for better type safety
export const userTypeEnum = pgEnum('user_type', ['user', 'admin', 'moderator']);
export const chatVisibilityEnum = pgEnum('chat_visibility', ['public', 'private']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system', 'tool']);
export const documentKindEnum = pgEnum('document_kind', ['text', 'code', 'image', 'sheet', 'pdf', 'csv']);
export const feedbackVoteEnum = pgEnum('feedback_vote', ['up', 'down']);
export const embeddingProviderEnum = pgEnum('embedding_provider', ['openai', 'cohere', 'google', 'custom']);

// Enhanced User table with Railway optimizations
export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  type: userTypeEnum('type').notNull().default('user'),
  displayName: varchar('display_name', { length: 100 }),
  avatar: text('avatar'),
  preferences: json('preferences').$type<{
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    notifications?: boolean;
  }>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  isActive: boolean('is_active').notNull().default(true),
}, (table) => ({
  emailIdx: index('idx_user_email').on(table.email),
  typeIdx: index('idx_user_type').on(table.type),
  activeIdx: index('idx_user_active').on(table.isActive),
  createdIdx: index('idx_user_created').on(table.createdAt),
}));

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

// Enhanced Chat table with better indexing
export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  title: text('title').notNull(),
  description: text('description'),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  visibility: chatVisibilityEnum('visibility').notNull().default('private'),
  tags: json('tags').$type<string[]>().default([]),
  messageCount: integer('message_count').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
}, (table) => ({
  userIdIdx: index('idx_chat_user_id').on(table.userId),
  createdIdx: index('idx_chat_created').on(table.createdAt.desc()),
  visibilityIdx: index('idx_chat_visibility').on(table.visibility),
  archivedIdx: index('idx_chat_archived').on(table.isArchived),
  userCreatedIdx: index('idx_chat_user_created').on(table.userId, table.createdAt.desc()),
}));

export type Chat = InferSelectModel<typeof chat>;
export type NewChat = InferInsertModel<typeof chat>;

// Enhanced Message table for better performance
export const message = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').$type<Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }>>().default([]),
  metadata: json('metadata').$type<{
    model?: string;
    tokens?: number;
    temperature?: number;
    maxTokens?: number;
    finishReason?: string;
  }>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  parentId: uuid('parent_id'),
  isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => ({
  chatIdIdx: index('idx_message_chat_id').on(table.chatId),
  roleIdx: index('idx_message_role').on(table.role),
  createdIdx: index('idx_message_created').on(table.createdAt.desc()),
  parentIdx: index('idx_message_parent').on(table.parentId),
  chatCreatedIdx: index('idx_message_chat_created').on(table.chatId, table.createdAt.desc()),
  deletedIdx: index('idx_message_deleted').on(table.isDeleted),
  parentFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
    name: 'message_parent_fk'
  }),
}));

export type DBMessage = InferSelectModel<typeof message>;
export type NewMessage = InferInsertModel<typeof message>;

// Enhanced Vote table with better constraints
export const vote = pgTable('Vote', {
  chatId: uuid('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id')
    .notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  isUpvoted: boolean('is_upvoted').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.chatId, table.messageId, table.userId] }),
  messageIdx: index('idx_vote_message').on(table.messageId),
  userIdx: index('idx_vote_user').on(table.userId),
  createdIdx: index('idx_vote_created').on(table.createdAt.desc()),
}));

export type Vote = InferSelectModel<typeof vote>;
export type NewVote = InferInsertModel<typeof vote>;

// Enhanced Document table with better categorization
export const document = pgTable('Document', {
  id: uuid('id').notNull().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  title: text('title').notNull(),
  content: text('content'),
  summary: text('summary'),
  kind: documentKindEnum('kind').notNull().default('text'),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSize: integer('file_size'),
  filePath: text('file_path'),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  tags: json('tags').$type<string[]>().default([]),
  metadata: json('metadata').$type<Record<string, any>>().default({}),
  isPublic: boolean('is_public').notNull().default(false),
  version: integer('version').notNull().default(1),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.createdAt] }),
  userIdx: index('idx_document_user').on(table.userId),
  kindIdx: index('idx_document_kind').on(table.kind),
  createdIdx: index('idx_document_created').on(table.createdAt.desc()),
  publicIdx: index('idx_document_public').on(table.isPublic),
  userCreatedIdx: index('idx_document_user_created').on(table.userId, table.createdAt.desc()),
}));

export type Document = InferSelectModel<typeof document>;
export type NewDocument = InferInsertModel<typeof document>;

// Enhanced Embedding table with provider support
export const embedding = pgTable('Embedding', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  documentId: uuid('document_id').notNull(),
  documentCreatedAt: timestamp('document_created_at').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI default
  cohereEmbedding: vector('cohere_embedding', { dimensions: 1024 }), // Cohere v4 
  provider: embeddingProviderEnum('provider').notNull().default('openai'),
  model: varchar('model', { length: 100 }).notNull().default('text-embedding-3-small'),
  metadata: json('metadata').$type<{
    chunkIndex?: number;
    totalChunks?: number;
    startOffset?: number;
    endOffset?: number;
    similarity?: number;
  }>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  documentRef: foreignKey({
    columns: [table.documentId, table.documentCreatedAt],
    foreignColumns: [document.id, document.createdAt],
  }),
  documentIdx: index('idx_embedding_document').on(table.documentId),
  providerIdx: index('idx_embedding_provider').on(table.provider),
  modelIdx: index('idx_embedding_model').on(table.model),
  createdIdx: index('idx_embedding_created').on(table.createdAt.desc()),
  // Vector similarity indexes will be created in migration
}));

export type Embedding = InferSelectModel<typeof embedding>;
export type NewEmbedding = InferInsertModel<typeof embedding>;

// Enhanced Suggestion table
export const suggestion = pgTable('Suggestion', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  documentId: uuid('document_id').notNull(),
  documentCreatedAt: timestamp('document_created_at').notNull(),
  originalText: text('original_text').notNull(),
  suggestedText: text('suggested_text').notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }),
  confidence: real('confidence'), // 0.0 to 1.0
  isResolved: boolean('is_resolved').notNull().default(false),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  reviewedBy: uuid('reviewed_by').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => ({
  documentRef: foreignKey({
    columns: [table.documentId, table.documentCreatedAt],
    foreignColumns: [document.id, document.createdAt],
  }),
  documentIdx: index('idx_suggestion_document').on(table.documentId),
  userIdx: index('idx_suggestion_user').on(table.userId),
  resolvedIdx: index('idx_suggestion_resolved').on(table.isResolved),
  categoryIdx: index('idx_suggestion_category').on(table.category),
  createdIdx: index('idx_suggestion_created').on(table.createdAt.desc()),
}));

export type Suggestion = InferSelectModel<typeof suggestion>;
export type NewSuggestion = InferInsertModel<typeof suggestion>;

// Enhanced Stream table
export const stream = pgTable('Stream', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id')
    .references(() => message.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  metadata: json('metadata').$type<{
    totalTokens?: number;
    completedTokens?: number;
    model?: string;
    temperature?: number;
  }>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  chatIdx: index('idx_stream_chat').on(table.chatId),
  messageIdx: index('idx_stream_message').on(table.messageId),
  statusIdx: index('idx_stream_status').on(table.status),
  createdIdx: index('idx_stream_created').on(table.createdAt.desc()),
}));

export type Stream = InferSelectModel<typeof stream>;
export type NewStream = InferInsertModel<typeof stream>;

// Enhanced Feedback table with better analytics support
export const feedback = pgTable('Feedback', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  runId: varchar('run_id', { length: 255 }).notNull(), // LangSmith run ID
  messageId: uuid('message_id')
    .notNull()
    .references(() => message.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  vote: feedbackVoteEnum('vote').notNull(),
  comment: text('comment'),
  category: varchar('category', { length: 50 }),
  severity: integer('severity'), // 1-5 scale
  metadata: json('metadata').$type<{
    model?: string;
    responseTime?: number;
    tokenCount?: number;
    context?: string;
  }>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isResolved: boolean('is_resolved').notNull().default(false),
}, (table) => ({
  runIdx: index('idx_feedback_run').on(table.runId),
  messageIdx: index('idx_feedback_message').on(table.messageId),
  userIdx: index('idx_feedback_user').on(table.userId),
  voteIdx: index('idx_feedback_vote').on(table.vote),
  categoryIdx: index('idx_feedback_category').on(table.category),
  createdIdx: index('idx_feedback_created').on(table.createdAt.desc()),
  resolvedIdx: index('idx_feedback_resolved').on(table.isResolved),
}));

export type Feedback = InferSelectModel<typeof feedback>;
export type NewFeedback = InferInsertModel<typeof feedback>;

// Enhanced Vector Documents table for RAG operations
export const vectorDocuments = pgTable('vector_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  title: varchar('title', { length: 500 }),
  summary: text('summary'),
  source: varchar('source', { length: 255 }), // URL, file path, etc.
  sourceType: varchar('source_type', { length: 50 }), // 'file', 'url', 'text', etc.
  metadata: json('metadata').$type<{
    author?: string;
    language?: string;
    tags?: string[];
    category?: string;
    contentType?: string;
    lastModified?: string;
    size?: number;
    checksum?: string;
  }>().default({}),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embeddings
  cohereEmbedding: vector('cohere_embedding', { dimensions: 1024 }), // Cohere v4
  embeddingProvider: embeddingProviderEnum('embedding_provider').notNull().default('openai'),
  embeddingModel: varchar('embedding_model', { length: 100 }).notNull().default('text-embedding-3-small'),
  chunkIndex: integer('chunk_index').notNull().default(0),
  totalChunks: integer('total_chunks').notNull().default(1),
  parentDocumentId: uuid('parent_document_id'), // For chunked documents
  userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
  isPublic: boolean('is_public').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  indexedAt: timestamp('indexed_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('idx_vector_documents_source').on(table.source),
  sourceTypeIdx: index('idx_vector_documents_source_type').on(table.sourceType),
  providerIdx: index('idx_vector_documents_provider').on(table.embeddingProvider),
  modelIdx: index('idx_vector_documents_model').on(table.embeddingModel),
  chunkIdx: index('idx_vector_documents_chunk').on(table.chunkIndex),
  parentIdx: index('idx_vector_documents_parent').on(table.parentDocumentId),
  userIdx: index('idx_vector_documents_user').on(table.userId),
  publicIdx: index('idx_vector_documents_public').on(table.isPublic),
  activeIdx: index('idx_vector_documents_active').on(table.isActive),
  createdIdx: index('idx_vector_documents_created').on(table.createdAt.desc()),
  indexedIdx: index('idx_vector_documents_indexed').on(table.indexedAt.desc()),
  
  // Composite indexes for common queries
  activePublicIdx: index('idx_vector_documents_active_public').on(table.isActive, table.isPublic),
  userActiveIdx: index('idx_vector_documents_user_active').on(table.userId, table.isActive),
  parentChunkIdx: index('idx_vector_documents_parent_chunk').on(table.parentDocumentId, table.chunkIndex),
}));

export type VectorDocument = InferSelectModel<typeof vectorDocuments>;
export type NewVectorDocument = InferInsertModel<typeof vectorDocuments>;

// Search Analytics table for tracking search performance
export const searchAnalytics = pgTable('search_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
  sessionId: varchar('session_id', { length: 255 }),
  query: text('query').notNull(),
  resultCount: integer('result_count').notNull().default(0),
  responseTime: integer('response_time'), // milliseconds
  searchType: varchar('search_type', { length: 50 }).notNull(), // 'vector', 'text', 'hybrid'
  threshold: real('threshold'), // similarity threshold used
  model: varchar('model', { length: 100 }), // embedding model used
  metadata: json('metadata').$type<{
    filters?: Record<string, any>;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_search_analytics_user').on(table.userId),
  sessionIdx: index('idx_search_analytics_session').on(table.sessionId),
  typeIdx: index('idx_search_analytics_type').on(table.searchType),
  createdIdx: index('idx_search_analytics_created').on(table.createdAt.desc()),
  responseTimeIdx: index('idx_search_analytics_response_time').on(table.responseTime),
}));

export type SearchAnalytics = InferSelectModel<typeof searchAnalytics>;
export type NewSearchAnalytics = InferInsertModel<typeof searchAnalytics>;

// Export all tables for Drizzle
export const schema = {
  user,
  chat,
  message,
  vote,
  document,
  embedding,
  suggestion,
  stream,
  feedback,
  vectorDocuments,
  searchAnalytics,
};

// Helper types for relationships
export type ChatWithMessages = Chat & {
  messages: DBMessage[];
  user: User;
};

export type MessageWithVotes = DBMessage & {
  votes: Vote[];
  chat: Chat;
};

export type DocumentWithEmbeddings = Document & {
  embeddings: Embedding[];
  user: User;
};

export type VectorDocumentWithAnalytics = VectorDocument & {
  searchCount?: number;
  lastSearched?: Date;
};

// Database utility types
export type DatabaseSchema = typeof schema;
export type TableNames = keyof DatabaseSchema;