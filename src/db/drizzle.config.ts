/**
 * Drizzle Kit Configuration
 * DV-Assistance Platform - Step 11
 *
 * Configures Drizzle schema migrations and code generation.
 * Handles both Cloud SQL environment credentials and standard DATABASE_URL.
 */

import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlHost = process.env.SQL_HOST || 'localhost';
const sqlPort = parseInt(process.env.DB_PORT || '5432', 10);
const sqlDbName = process.env.SQL_DB_NAME || 'dv_assistance';
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'postgres';
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '';
const databaseUrl = process.env.DATABASE_URL;

/**
 * Builds the `dbCredentials` block required by Drizzle Kit.
 * Prefers a full DATABASE_URL connection string when present, otherwise
 * falls back to discrete Cloud SQL connection fields.
 */
const dbCredentials: Parameters<typeof defineConfig>[0]['dbCredentials'] = databaseUrl
  ? { url: databaseUrl }
  : {
      host: sqlHost,
      port: sqlPort,
      user: user,
      password: password,
      database: sqlDbName,
      ssl: false,
    };

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials,
  verbose: true,
  strict: true,
});
