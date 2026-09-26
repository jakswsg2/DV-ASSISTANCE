/**
 * Database Configuration Module
 * DV-Assistance Platform - Step 11
 *
 * Centralizes database configuration parsing.
 * Supports Cloud SQL environment variables (SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME)
 * as well as standard DATABASE_URL for local development.
 * Never logs credentials or connection strings.
 */

import dotenv from 'dotenv';

dotenv.config();

export interface DbConfig {
  readonly host?: string;
  readonly user?: string;
  readonly password?: string;
  readonly database?: string;
  readonly port?: number;
  readonly connectionString?: string;
  readonly isConfigured: boolean;
  readonly maxPoolSize: number;
  readonly connectionTimeoutMillis: number;
}

export function getDbConfig(): DbConfig {
  const sqlHost = process.env.SQL_HOST;
  const sqlUser = process.env.SQL_USER;
  const sqlPassword = process.env.SQL_PASSWORD;
  const sqlDbName = process.env.SQL_DB_NAME;
  const databaseUrl = process.env.DATABASE_URL;

  const isCloudSqlConfigured = Boolean(sqlHost && sqlUser && sqlPassword && sqlDbName);
  const isUrlConfigured = Boolean(databaseUrl && databaseUrl.trim().length > 0);

  return Object.freeze({
    host: sqlHost || 'localhost',
    user: sqlUser || 'postgres',
    password: sqlPassword,
    database: sqlDbName || 'dv_assistance',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    connectionString: databaseUrl,
    isConfigured: isCloudSqlConfigured || isUrlConfigured,
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '15000', 10),
  });
}

export const dbConfig = getDbConfig();
export default dbConfig;
