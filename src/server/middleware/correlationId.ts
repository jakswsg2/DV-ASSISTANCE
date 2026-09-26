/**
 * Request Correlation Middleware
 * DV-Assistance Platform - Step 10
 *
 * Attaches a cryptographically secure, non-sensitive correlation ID to every incoming request.
 * Sets the 'X-Request-Id' response header and augments the Express request object for logging.
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Extend Express Request interface locally for TypeScript type safety
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Format validation regex for incoming request ID (alphanumeric, hyphens, 16-64 chars)
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{16,64}$/;

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header('x-request-id');

  // Accept incoming ID if safe and valid; otherwise generate a cryptographically random UUIDv4
  const requestId =
    incomingId && SAFE_REQUEST_ID_REGEX.test(incomingId) ? incomingId : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

export default correlationIdMiddleware;
