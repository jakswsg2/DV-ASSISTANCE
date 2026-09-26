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
const sqlDbName = process.env.SQL_DB_NAME || 'dv_assistance';
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'postgres';
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '';
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: databaseUrl
    ? { url: databaseUrl }
    : {
        host: sqlHost,
        user: user,
        password: password,
        database: sqlDbName,
        ssl: false,
      },
  verbose: true,
  strict: true,
});
