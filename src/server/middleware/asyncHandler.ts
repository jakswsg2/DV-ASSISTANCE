/**
 * Async Route Handler Wrapper
 * DV-Assistance Platform - Step 12
 *
 * Ensures errors thrown in async Express route handlers are forwarded to the
 * centralized apiErrorHandler middleware rather than triggering unhandled rejections.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
