/**
 * Express Application Factory
 * DV-Assistance Platform - Step 12
 *
 * Constructs and configures the Express application with foundational security middlewares,
 * JSON body limits, cookie parsing, request correlation, auth session resolution,
 * anti-CSRF guards, and API routing.
 */

import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.ts';
import { correlationIdMiddleware } from './middleware/correlationId.ts';
import { createSecurityHeadersMiddleware } from './middleware/securityHeaders.ts';
import { attachAuthSession, csrfProtection } from './middleware/auth.ts';
import { apiRouter } from './apiRouter.ts';
import { apiErrorHandler } from './middleware/errorHandler.ts';

export function createApp(): Express {
  const app = express();

  // 1. Request correlation ID
  app.use(correlationIdMiddleware);

  // 2. Foundational HTTP security headers
  app.use(createSecurityHeadersMiddleware());

  // 3. Conservative JSON body parsing limit
  app.use(express.json({ limit: config.maxJsonBodySize }));

  // 4. Secure cookie parser
  app.use(cookieParser(config.sessionSecret));

  // 5. Anti-CSRF protection for state-changing API mutations
  app.use(config.apiPrefix, csrfProtection);

  // 6. Session resolution (populates req.user if session cookie is present and valid)
  app.use(config.apiPrefix, attachAuthSession);

  // 7. Mount top-level /api/v1 router
  app.use(config.apiPrefix, apiRouter);

  // 8. Centralized API error handling boundary
  app.use(config.apiPrefix, apiErrorHandler);

  return app;
}

export default createApp;
