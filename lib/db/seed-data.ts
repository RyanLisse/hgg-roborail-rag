import 'server-only';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { nanoid } from 'nanoid';
import { hash } from 'bcrypt-ts';
import {
  user,
  chat,
  message,
  vote,
  document,
  embedding,
  vectorDocuments,
  feedback,
  searchAnalytics,
  type NewUser,
  type NewChat,
  type NewMessage,
  type NewVectorDocument,
} from './schema-enhanced';
import { railwayConfig } from '../env';

config({ path: '.env.local' });

/**
 * Database seeding utility for Railway PostgreSQL
 * Creates test data for development and testing environments
 */
export class DatabaseSeeder {
  private connection: any = null;
  private db: any = null;

  constructor() {
    const connectionUrl = railwayConfig.databaseUrl || process.env.POSTGRES_URL || '';
    
    if (!connectionUrl) {
      throw new Error('No database connection URL found for seeding');
    }

    this.connection = postgres(connectionUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 30,
    });
    
    this.db = drizzle(this.connection);
  }

  /**
   * Create test users
   */
  private async seedUsers(): Promise<{ users: any[], adminUser: any }> {
    console.log('🌱 Seeding users...');

    const testUsers: NewUser[] = [
      {
        email: 'admin@roborail.ai',
        password: await hash('admin123!', 12),
        type: 'admin',
        displayName: 'RoboRail Admin',
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: true,
        },
        isActive: true,
      },
      {
        email: 'john.doe@example.com',
        password: await hash('password123!', 12),
        type: 'user',
        displayName: 'John Doe',
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: true,
        },
        isActive: true,
      },
      {
        email: 'jane.smith@example.com',
        password: await hash('password123!', 12),
        type: 'user',
        displayName: 'Jane Smith',
        preferences: {
          theme: 'system',
          language: 'en',
          notifications: false,
        },
        isActive: true,
      },
      {
        email: 'developer@roborail.ai',
        password: await hash('dev123!', 12),
        type: 'moderator',
        displayName: 'RoboRail Developer',
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: true,
        },
        isActive: true,
      },
    ];

    const insertedUsers = await this.db.insert(user).values(testUsers).returning();
    console.log(`✅ Created ${insertedUsers.length} test users`);

    return {
      users: insertedUsers,
      adminUser: insertedUsers.find((u: any) => u.type === 'admin')!,
    };
  }

  /**
   * Create test chats and messages
   */
  private async seedChatsAndMessages(users: any[]): Promise<any[]> {
    console.log('💬 Seeding chats and messages...');

    const testChats: NewChat[] = [
      {
        title: 'Getting Started with RoboRail',
        description: 'Introduction to RoboRail AI Assistant capabilities',
        userId: users[1].id, // John Doe
        visibility: 'public',
        tags: ['introduction', 'getting-started'],
        messageCount: 0,
      },
      {
        title: 'Advanced AI Features',
        description: 'Exploring advanced features like vector search and RAG',
        userId: users[2].id, // Jane Smith
        visibility: 'private',
        tags: ['advanced', 'vector-search', 'rag'],
        messageCount: 0,
      },
      {
        title: 'Technical Documentation Chat',
        description: 'Discussion about technical documentation and API usage',
        userId: users[0].id, // Admin
        visibility: 'public',
        tags: ['documentation', 'api', 'technical'],
        messageCount: 0,
      },
    ];

    const insertedChats = await this.db.insert(chat).values(testChats).returning();

    // Create messages for each chat
    const messagesToInsert: NewMessage[] = [];

    for (const chatRecord of insertedChats) {
      // Welcome message from user
      messagesToInsert.push({
        chatId: chatRecord.id,
        role: 'user',
        content: `Hello! I'd like to learn more about ${chatRecord.title}.`,
        parts: [{
          type: 'text',
          text: `Hello! I'd like to learn more about ${chatRecord.title}.`,
        }],
        attachments: [],
        metadata: {},
      });

      // Response from assistant
      messagesToInsert.push({
        chatId: chatRecord.id,
        role: 'assistant',
        content: `Welcome to ${chatRecord.title}! I'm here to help you with any questions you have. What would you like to know?`,
        parts: [{
          type: 'text',
          text: `Welcome to ${chatRecord.title}! I'm here to help you with any questions you have. What would you like to know?`,
        }],
        attachments: [],
        metadata: {
          model: 'gpt-4',
          tokens: 145,
          temperature: 0.7,
        },
      });

      // Follow-up user message
      messagesToInsert.push({
        chatId: chatRecord.id,
        role: 'user',
        content: 'Can you explain the key features and how to get started?',
        parts: [{
          type: 'text',
          text: 'Can you explain the key features and how to get started?',
        }],
        attachments: [],
        metadata: {},
      });
    }

    const insertedMessages = await this.db.insert(message).values(messagesToInsert).returning();
    console.log(`✅ Created ${insertedChats.length} chats with ${insertedMessages.length} messages`);

    return insertedChats;
  }

  /**
   * Create test vector documents for RAG functionality
   */
  private async seedVectorDocuments(users: any[]): Promise<any[]> {
    console.log('📄 Seeding vector documents...');

    const sampleDocuments: NewVectorDocument[] = [
      {
        content: 'RoboRail is an advanced AI assistant designed to help with railway operations, logistics, and management. It provides intelligent insights, predictive analytics, and automated decision-making capabilities for modern railway systems.',
        title: 'RoboRail Introduction',
        summary: 'Overview of RoboRail AI assistant capabilities',
        source: 'documentation',
        sourceType: 'text',
        metadata: {
          author: 'RoboRail Team',
          language: 'en',
          tags: ['introduction', 'overview', 'ai-assistant'],
          category: 'documentation',
          contentType: 'text/plain',
        },
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        chunkIndex: 0,
        totalChunks: 1,
        userId: users[0].id,
        isPublic: true,
        isActive: true,
      },
      {
        content: 'Vector search in RoboRail uses advanced embedding techniques to find semantically similar content. The system supports multiple embedding providers including OpenAI and Cohere, with automatic similarity scoring and ranking.',
        title: 'Vector Search Features',
        summary: 'How vector search works in RoboRail',
        source: 'technical-docs',
        sourceType: 'text',
        metadata: {
          author: 'Technical Team',
          language: 'en',
          tags: ['vector-search', 'embeddings', 'similarity'],
          category: 'technical',
          contentType: 'text/plain',
        },
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        chunkIndex: 0,
        totalChunks: 1,
        userId: users[0].id,
        isPublic: true,
        isActive: true,
      },
      {
        content: 'Railway operations require real-time monitoring of train schedules, track conditions, passenger flow, and maintenance requirements. RoboRail provides comprehensive dashboards and alerts for optimal railway management.',
        title: 'Railway Operations Management',
        summary: 'Real-time monitoring and management features',
        source: 'operations-manual',
        sourceType: 'text',
        metadata: {
          author: 'Operations Team',
          language: 'en',
          tags: ['operations', 'monitoring', 'management'],
          category: 'operations',
          contentType: 'text/plain',
        },
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        chunkIndex: 0,
        totalChunks: 1,
        userId: users[3].id,
        isPublic: true,
        isActive: true,
      },
      {
        content: 'Safety protocols in railway operations include regular track inspections, signal system monitoring, emergency response procedures, and compliance with international railway safety standards. RoboRail helps automate safety checks and alerts.',
        title: 'Railway Safety Protocols',
        summary: 'Safety procedures and automated monitoring',
        source: 'safety-manual',
        sourceType: 'text',
        metadata: {
          author: 'Safety Department',
          language: 'en',
          tags: ['safety', 'protocols', 'compliance'],
          category: 'safety',
          contentType: 'text/plain',
        },
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        chunkIndex: 0,
        totalChunks: 1,
        userId: users[0].id,
        isPublic: true,
        isActive: true,
      },
      {
        content: 'API integration with RoboRail allows external systems to access AI capabilities, submit queries, retrieve insights, and manage railway data. The RESTful API supports authentication, rate limiting, and comprehensive documentation.',
        title: 'RoboRail API Integration',
        summary: 'How to integrate with RoboRail APIs',
        source: 'api-docs',
        sourceType: 'text',
        metadata: {
          author: 'Development Team',
          language: 'en',
          tags: ['api', 'integration', 'development'],
          category: 'technical',
          contentType: 'text/plain',
        },
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        chunkIndex: 0,
        totalChunks: 1,
        userId: users[3].id,
        isPublic: true,
        isActive: true,
      },
    ];

    // Generate mock embeddings (in real use, these would come from actual embedding APIs)
    const documentsWithEmbeddings = sampleDocuments.map(doc => ({
      ...doc,
      embedding: this.generateMockEmbedding(1536), // OpenAI dimensions
      cohereEmbedding: this.generateMockEmbedding(1024), // Cohere dimensions
    }));

    const insertedDocs = await this.db.insert(vectorDocuments).values(documentsWithEmbeddings).returning();
    console.log(`✅ Created ${insertedDocs.length} vector documents`);

    return insertedDocs;
  }

  /**
   * Create sample search analytics data
   */
  private async seedSearchAnalytics(users: any[]): Promise<void> {
    console.log('📊 Seeding search analytics...');

    const sampleQueries = [
      'How does vector search work in RoboRail?',
      'Railway safety protocols and procedures',
      'API integration documentation',
      'Real-time monitoring features',
      'Getting started with RoboRail',
      'Train schedule management',
      'Emergency response procedures',
      'Maintenance requirements tracking',
    ];

    const analyticsData = sampleQueries.map(query => ({
      userId: users[Math.floor(Math.random() * users.length)].id,
      sessionId: nanoid(),
      query,
      resultCount: Math.floor(Math.random() * 10) + 1,
      responseTime: Math.floor(Math.random() * 500) + 50, // 50-550ms
      searchType: ['vector', 'text', 'hybrid'][Math.floor(Math.random() * 3)] as 'vector' | 'text' | 'hybrid',
      threshold: 0.7 + Math.random() * 0.2, // 0.7-0.9
      model: 'text-embedding-3-small',
      metadata: {
        filters: {},
        sortBy: 'similarity',
        limit: 10,
        offset: 0,
      },
    }));

    await this.db.insert(searchAnalytics).values(analyticsData);
    console.log(`✅ Created ${analyticsData.length} search analytics entries`);
  }

  /**
   * Generate mock embedding vector for testing
   */
  private generateMockEmbedding(dimensions: number): number[] {
    const embedding = [];
    for (let i = 0; i < dimensions; i++) {
      embedding.push((Math.random() - 0.5) * 2); // Values between -1 and 1
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Clear all existing test data (use with caution!)
   */
  private async clearTestData(): Promise<void> {
    console.log('🧹 Clearing existing test data...');

    // Order matters due to foreign key constraints
    const tables = [
      'search_analytics',
      'Feedback',
      'Stream',
      'Suggestion',
      'Embedding',
      'vector_documents',
      'Document',
      'Vote',
      'Message',
      'Chat',
      'User',
    ];

    for (const tableName of tables) {
      try {
        await this.connection.unsafe(`DELETE FROM "${tableName}" WHERE email LIKE '%@example.com' OR email LIKE '%@roborail.ai'`);
      } catch (error) {
        // Some tables might not have email column, that's OK
        try {
          await this.connection.unsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
        } catch {
          console.warn(`⚠️ Could not clear table ${tableName}`);
        }
      }
    }

    console.log('✅ Test data cleared');
  }

  /**
   * Run the complete seeding process
   */
  async seed(options: {
    clearExisting?: boolean;
    skipVectorDocuments?: boolean;
    skipAnalytics?: boolean;
  } = {}): Promise<{
    success: boolean;
    error?: string;
    summary: {
      usersCreated: number;
      chatsCreated: number;
      messagesCreated: number;
      vectorDocsCreated: number;
      analyticsCreated: number;
    };
  }> {
    console.log('🌱 Starting database seeding process...');
    
    try {
      // Clear existing data if requested
      if (options.clearExisting) {
        await this.clearTestData();
      }

      // Seed users
      const { users } = await this.seedUsers();

      // Seed chats and messages
      const chats = await this.seedChatsAndMessages(users);

      // Seed vector documents
      let vectorDocs: any[] = [];
      if (!options.skipVectorDocuments) {
        vectorDocs = await this.seedVectorDocuments(users);
      }

      // Seed search analytics
      if (!options.skipAnalytics) {
        await this.seedSearchAnalytics(users);
      }

      const summary = {
        usersCreated: users.length,
        chatsCreated: chats.length,
        messagesCreated: chats.length * 3, // 3 messages per chat
        vectorDocsCreated: vectorDocs.length,
        analyticsCreated: options.skipAnalytics ? 0 : 8,
      };

      console.log('\n🎉 Database seeding completed successfully!');
      console.log('📊 Summary:', summary);

      return {
        success: true,
        summary,
      };

    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown seeding error',
        summary: {
          usersCreated: 0,
          chatsCreated: 0,
          messagesCreated: 0,
          vectorDocsCreated: 0,
          analyticsCreated: 0,
        },
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Create specific test scenarios
   */
  async createTestScenario(scenario: 'minimal' | 'full' | 'vector-only'): Promise<void> {
    console.log(`🎭 Creating test scenario: ${scenario}`);

    switch (scenario) {
      case 'minimal':
        await this.seed({
          clearExisting: true,
          skipVectorDocuments: true,
          skipAnalytics: true,
        });
        break;

      case 'full':
        await this.seed({
          clearExisting: true,
          skipVectorDocuments: false,
          skipAnalytics: false,
        });
        break;

      case 'vector-only':
        const { users } = await this.seedUsers();
        await this.seedVectorDocuments(users);
        break;
    }
  }

  /**
   * Clean up database connections
   */
  private async cleanup(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        console.log('✅ Database seeding connection closed');
      } catch (error) {
        console.warn('⚠️ Error closing seeding connection:', error);
      }
    }
  }
}

/**
 * CLI runner for database seeding
 */
export async function runDatabaseSeeding(): Promise<void> {
  const seeder = new DatabaseSeeder();

  try {
    const scenario = process.argv[2] as 'minimal' | 'full' | 'vector-only' || 'full';
    
    console.log(`🚀 Running database seeding with scenario: ${scenario}`);
    
    await seeder.createTestScenario(scenario);
    
    console.log('✅ Database seeding completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseSeeding();
}