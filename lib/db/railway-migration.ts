import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Simple Railway config for migration script
const railwayConfig = {
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  environment: process.env.RAILWAY_ENVIRONMENT || 'production',
  isEnabled: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL),
  isRailwayManaged: !!process.env.RAILWAY_ENVIRONMENT,
};

config({
  path: '.env.local',
});

interface MigrationResult {
  success: boolean;
  error?: string;
  migrationsApplied: number;
  duration: number;
}

interface ExtensionStatus {
  name: string;
  installed: boolean;
  version?: string;
}

/**
 * Railway-specific database migration handler
 * Handles PostgreSQL setup and schema migrations for Railway deployment
 */
export class RailwayMigration {
  private connectionUrl: string;
  private connection: any = null;
  private db: any = null;

  constructor() {
    // Use Railway configuration with fallback
    this.connectionUrl = railwayConfig.databaseUrl || process.env.POSTGRES_URL || '';
    
    if (!this.connectionUrl) {
      throw new Error('No database connection URL found. Check Railway environment variables.');
    }
  }

  /**
   * Initialize database connection with Railway-specific settings
   */
  private async initializeConnection(): Promise<void> {
    try {
      this.connection = postgres(this.connectionUrl, {
        max: 10, // Railway optimized connection pool
        idle_timeout: 20,
        connect_timeout: 30,
        ssl: railwayConfig.environment === 'production' ? 'require' : 'prefer',
        // Railway-specific connection options
        connection: {
          application_name: 'RRA-Railway-Migration',
          search_path: 'public',
        },
      });

      this.db = drizzle(this.connection);
      console.log('✅ Railway database connection initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Railway database connection:', error);
      throw error;
    }
  }

  /**
   * Check and install required PostgreSQL extensions
   */
  private async setupExtensions(): Promise<ExtensionStatus[]> {
    const requiredExtensions = [
      'uuid-ossp',
      'pgcrypto', 
      'vector',
      'pg_stat_statements'
    ];

    const extensionStatus: ExtensionStatus[] = [];

    for (const extensionName of requiredExtensions) {
      try {
        // Check if extension exists
        const [existingExtension] = await this.connection`
          SELECT extname, extversion 
          FROM pg_extension 
          WHERE extname = ${extensionName}
        `;

        if (existingExtension) {
          extensionStatus.push({
            name: extensionName,
            installed: true,
            version: existingExtension.extversion,
          });
          console.log(`✅ Extension ${extensionName} already installed (v${existingExtension.extversion})`);
        } else {
          // Install extension
          await this.connection`CREATE EXTENSION IF NOT EXISTS ${this.connection(extensionName)}`;
          
          // Verify installation
          const [newExtension] = await this.connection`
            SELECT extname, extversion 
            FROM pg_extension 
            WHERE extname = ${extensionName}
          `;

          extensionStatus.push({
            name: extensionName,
            installed: !!newExtension,
            version: newExtension?.extversion,
          });

          if (newExtension) {
            console.log(`✅ Extension ${extensionName} installed successfully (v${newExtension.extversion})`);
          } else {
            console.warn(`⚠️ Failed to install extension ${extensionName}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error with extension ${extensionName}:`, error);
        extensionStatus.push({
          name: extensionName,
          installed: false,
        });
      }
    }

    return extensionStatus;
  }

  /**
   * Apply Railway-specific database optimizations
   */
  private async applyRailwayOptimizations(): Promise<void> {
    const optimizations = [
      'ALTER SYSTEM SET shared_preload_libraries = \'pg_stat_statements\'',
      'ALTER SYSTEM SET pg_stat_statements.track = \'all\'',
      'ALTER SYSTEM SET max_connections = 100',
      'ALTER SYSTEM SET shared_buffers = \'128MB\'',
      'ALTER SYSTEM SET effective_cache_size = \'512MB\'',
      'ALTER SYSTEM SET maintenance_work_mem = \'32MB\'',
      'ALTER SYSTEM SET checkpoint_completion_target = 0.9',
      'ALTER SYSTEM SET wal_buffers = \'8MB\'',
      'ALTER SYSTEM SET default_statistics_target = 100',
      'ALTER SYSTEM SET random_page_cost = 1.1',
      'ALTER SYSTEM SET effective_io_concurrency = 200',
    ];

    console.log('🔧 Applying Railway database optimizations...');

    for (const optimization of optimizations) {
      try {
        await this.connection.unsafe(optimization);
        console.log(`✅ Applied: ${optimization}`);
      } catch (error) {
        // Some optimizations might require superuser privileges
        console.warn(`⚠️ Skipped optimization (may require superuser): ${optimization}`);
      }
    }

    // Reload configuration
    try {
      await this.connection`SELECT pg_reload_conf()`;
      console.log('✅ Database configuration reloaded');
    } catch (error) {
      console.warn('⚠️ Could not reload configuration (may require superuser)');
    }
  }

  /**
   * Create Railway-specific monitoring functions
   */
  private async setupMonitoringFunctions(): Promise<void> {
    console.log('📊 Setting up Railway monitoring functions...');

    const monitoringFunctions = [
      // Health check function
      `
      CREATE OR REPLACE FUNCTION railway_health_check()
      RETURNS json AS $$
      DECLARE
          result json;
      BEGIN
          SELECT json_build_object(
              'database', 'healthy',
              'timestamp', now(),
              'version', version(),
              'connections', (SELECT count(*) FROM pg_stat_activity),
              'railway_environment', '${railwayConfig.environment}',
              'extensions', (
                  SELECT json_agg(extname)
                  FROM pg_extension
                  WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector', 'pg_stat_statements')
              )
          ) INTO result;
          
          RETURN result;
      END;
      $$ LANGUAGE plpgsql;
      `,
      
      // Performance monitoring view
      `
      CREATE OR REPLACE VIEW railway_performance_stats AS
      SELECT
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_live_tup,  
          n_dead_tup,
          vacuum_count,
          autovacuum_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY seq_scan DESC, idx_scan DESC;
      `,

      // Connection monitoring view
      `
      CREATE OR REPLACE VIEW railway_connection_stats AS
      SELECT
          state,
          count(*) as connection_count,
          max(now() - query_start) as longest_query_time,
          max(now() - state_change) as longest_idle_time
      FROM pg_stat_activity
      WHERE state IS NOT NULL
      GROUP BY state
      ORDER BY connection_count DESC;
      `,
    ];

    for (const func of monitoringFunctions) {
      try {
        await this.connection.unsafe(func);
        console.log('✅ Monitoring function/view created');
      } catch (error) {
        console.error('❌ Failed to create monitoring function:', error);
      }
    }
  }

  /**
   * Run Drizzle migrations with Railway-specific handling
   */
  private async runMigrations(): Promise<MigrationResult> {
    const startTime = Date.now();
    let migrationsApplied = 0;

    try {
      console.log('🚀 Running database migrations...');
      
      // Run Drizzle migrations
      const migrations = await migrate(this.db, { 
        migrationsFolder: './lib/db/migrations',
        migrationsTable: '__drizzle_migrations__',
      });

      // Count applied migrations
      try {
        const migrationCount = await this.connection`
          SELECT COUNT(*) as count 
          FROM __drizzle_migrations__ 
          WHERE success = true
        `;
        migrationsApplied = parseInt(migrationCount[0]?.count || '0');
      } catch {
        // Migration table might not exist yet
        migrationsApplied = 0;
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Migrations completed successfully in ${duration}ms`);
      console.log(`📊 Total migrations applied: ${migrationsApplied}`);

      return {
        success: true,
        migrationsApplied,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ Migration failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown migration error',
        migrationsApplied,
        duration,
      };
    }
  }

  /**
   * Validate schema after migration
   */
  private async validateSchema(): Promise<boolean> {
    console.log('🔍 Validating database schema...');

    const requiredTables = [
      'User',
      'Chat', 
      'Message',
      'Vote',
      'Document',
      'Embedding',
      'Suggestion',
      'Stream',
      'Feedback',
      'vector_documents',
    ];

    try {
      for (const tableName of requiredTables) {
        const tableExists = await this.connection`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )
        `;

        if (!tableExists[0]?.exists) {
          console.error(`❌ Required table missing: ${tableName}`);
          return false;
        }
        console.log(`✅ Table validated: ${tableName}`);
      }

      // Validate vector extension functionality
      try {
        await this.connection`SELECT '[1,2,3]'::vector`;
        console.log('✅ Vector extension working correctly');
      } catch {
        console.error('❌ Vector extension not functioning properly');
        return false;
      }

      console.log('✅ Schema validation completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Schema validation failed:', error);
      return false;
    }
  }

  /**
   * Complete Railway database migration process
   */
  async migrate(): Promise<{
    success: boolean;
    error?: string;
    details: MigrationResult & {
      extensions: ExtensionStatus[];
      schemaValid: boolean;
    };
  }> {
    console.log('🚀 Starting Railway database migration...');
    console.log(`📍 Railway Environment: ${railwayConfig.environment}`);
    console.log(`🔗 Database URL configured: ${!!this.connectionUrl}`);

    try {
      // Initialize connection
      await this.initializeConnection();

      // Setup extensions
      const extensions = await this.setupExtensions();

      // Apply optimizations
      await this.applyRailwayOptimizations();

      // Setup monitoring
      await this.setupMonitoringFunctions();

      // Run migrations
      const migrationResult = await this.runMigrations();

      // Validate schema
      const schemaValid = await this.validateSchema();

      const result = {
        success: migrationResult.success && schemaValid,
        error: migrationResult.success && schemaValid ? undefined : (migrationResult.error || 'Schema validation failed'),
        details: {
          ...migrationResult,
          extensions,
          schemaValid,
        },
      };

      if (result.success) {
        console.log('🎉 Railway database migration completed successfully!');
      } else {
        console.error('❌ Railway database migration failed');
      }

      return result;

    } catch (error) {
      console.error('❌ Railway migration process failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown migration error',
        details: {
          success: false,
          migrationsApplied: 0,
          duration: 0,
          extensions: [],
          schemaValid: false,
        },
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test database connectivity and basic operations
   */
  async testConnection(): Promise<{
    connected: boolean;
    error?: string;
    details: any;
  }> {
    try {
      await this.initializeConnection();

      // Test basic queries
      const version = await this.connection`SELECT version() as version`;
      const currentTime = await this.connection`SELECT now() as current_time`;
      const extensionCheck = await this.connection`
        SELECT extname 
        FROM pg_extension 
        WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector')
      `;

      return {
        connected: true,
        details: {
          version: version[0]?.version,
          currentTime: currentTime[0]?.current_time,
          extensions: extensionCheck.map((ext: { extname: string }) => ext.extname),
          railwayConfig: {
            environment: railwayConfig.environment,
            isEnabled: railwayConfig.isEnabled,
            isRailwayManaged: railwayConfig.isRailwayManaged,
          },
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        details: null,
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Clean up database connections
   */
  private async cleanup(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        console.log('✅ Database connection closed');
      } catch (error) {
        console.warn('⚠️ Error closing database connection:', error);
      }
    }
  }
}

/**
 * Standalone migration runner for CLI/script usage
 */
export async function runRailwayMigration(): Promise<void> {
  const migration = new RailwayMigration();

  try {
    const result = await migration.migrate();
    
    if (result.success) {
      console.log('✅ Railway migration completed successfully');
      process.exit(0);
    } else {
      console.error('❌ Railway migration failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Railway migration process error:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRailwayMigration();
}