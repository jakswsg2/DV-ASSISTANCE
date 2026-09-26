/**
 * Database Client & Connection Manager
 * DV-Assistance Platform - Step 11
 *
 * Exposes the centralized Drizzle ORM client with PostgreSQL connection pooling.
 * Conforms to Cloud SQL best practices:
 * - Lazy connection (no eager startup probes or while(true) reconnect loops)
 * - Object-based Pool configuration
 * - Global pool caching to prevent connection leaks across hot-reloads
 * - Generic transaction helper for infrastructure-level atomicity
 * - Safe query error sanitization
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from './schema.ts';
import { dbConfig } from './config.ts';

declare global {
  // eslint-disable-next-line no-var
  var _dvPostgresPool: Pool | undefined;
}

/**
 * Creates or retrieves the singleton PostgreSQL connection pool.
 * Uses lazy connection: connections are only opened when an actual query runs.
 */
export function getOrCreatePool(): Pool {
  if (!global._dvPostgresPool) {
    if (dbConfig.connectionString) {
      global._dvPostgresPool = new Pool({
        connectionString: dbConfig.connectionString,
        max: dbConfig.maxPoolSize,
        connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
      });
    } else {
      global._dvPostgresPool = new Pool({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        port: dbConfig.port,
        max: dbConfig.maxPoolSize,
        connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
      });
    }

    // Handle pool-level idle client errors without crashing the server
    global._dvPostgresPool.on('error', (err: Error) => {
      // Log sanitized error without leaking credentials or query strings
      console.error('[Database:Pool] Unexpected idle client error:', err.message);
    });
  }

  return global._dvPostgresPool;
}

export const pool = getOrCreatePool();

// Initialize Drizzle ORM instance with typed schema and relations
export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

/**
 * Generic Database Transaction Helper
 * Executes operations inside a database transaction with automatic rollback on error.
 */
export async function withTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await callback(tx);
  });
}

/**
 * Safe database health check helper (for future health checks when DB is configured).
 * Returns status without leaking credentials, hostnames, or internal stack traces.
 */
export async function checkDatabaseConnection(): Promise<{
  readonly connected: boolean;
  readonly message: string;
}> {
  if (!dbConfig.isConfigured) {
    return {
      connected: false,
      message: 'Database is not configured in this environment.',
    };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return {
      connected: true,
      message: 'PostgreSQL connection verified successfully.',
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Unknown connection error';
    return {
      connected: false,
      message: `Database connection unavailable: ${errMessage}`,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

export default db;
