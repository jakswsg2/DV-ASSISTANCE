/**
 * Health Check Endpoint
 * DV-Assistance Platform - Step 10
 *
 * Implements GET /api/v1/health.
 * Provides a minimal, machine-readable indicator of basic HTTP service availability.
 * Strictly avoids exposing database connectivity (deferred to Step 11), credentials,
 * filesystem paths, or environment secrets.
 */

import { Router, type Request, type Response } from 'express';
import { config } from '../config.ts';
import { dbConfig } from '../../db/config.ts';
import { isFirebaseAdminConfigured } from '../auth/firebaseAdmin.ts';

export const healthRouter = Router();

export interface HealthResponse {
  readonly status: 'healthy';
  readonly service: 'dv-assistance-api';
  readonly version: '1.0.0';
  readonly timestamp: string;
  readonly environment: string;
}

export interface ReadinessResponse {
  readonly status: 'ready' | 'degraded';
  readonly service: 'dv-assistance-api';
  readonly timestamp: string;
  readonly environment: string;
  readonly databaseConfigured: boolean;
  readonly firebaseAdminConfigured: boolean;
  readonly devStoreActive: boolean;
}

healthRouter.get('/health', (_req: Request, res: Response<HealthResponse>) => {
  res.status(200).json({
    status: 'healthy',
    service: 'dv-assistance-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

healthRouter.get('/health/readiness', (_req: Request, res: Response<ReadinessResponse>) => {
  const dbReady = dbConfig.isConfigured;
  const firebaseReady = isFirebaseAdminConfigured();
  const isFullyReady = dbReady && firebaseReady;

  res.status(isFullyReady ? 200 : 200).json({
    status: isFullyReady ? 'ready' : 'degraded',
    service: 'dv-assistance-api',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    databaseConfigured: dbReady,
    firebaseAdminConfigured: firebaseReady,
    devStoreActive: !dbReady,
  });
});

export default healthRouter;
