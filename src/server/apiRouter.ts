/**
 * Top-Level API Router (/api/v1)
 * DV-Assistance Platform - Step 10
 *
 * Mounts foundational infrastructure routes and enforces a standard 404 response
 * for undefined API endpoints within the /api/v1 prefix.
 */

import { Router, type Request, type Response } from 'express';
import { healthRouter } from './routes/health.ts';
import { authRouter } from './routes/auth.ts';
import { intakeRouter } from './routes/intake.ts';
import { casesRouter } from './routes/cases.ts';
import { safetyPlansRouter } from './routes/safetyPlans.ts';
import { messagesRouter } from './routes/messages.ts';
import { documentsRouter } from './routes/documents.ts';
import { adminRouter } from './routes/admin.ts';
import { resourcesRouter } from './routes/resources.ts';
import { ApiError } from './middleware/errorHandler.ts';

export const apiRouter = Router();

// Mount foundational infrastructure endpoints
apiRouter.use(healthRouter);

// Mount authentication and session management endpoints (/api/v1/auth/*)
apiRouter.use('/auth', authRouter);

// Mount public emergency support directory
apiRouter.use('/resources', resourcesRouter);

// Mount system governance & administrative endpoints
apiRouter.use('/admin', adminRouter);

// Mount domain API routes with authoritative RBAC and resource scoping
apiRouter.use('/intake', intakeRouter);
apiRouter.use('/cases', casesRouter);
apiRouter.use('/safety-plans', safetyPlansRouter);
apiRouter.use('/messages', messagesRouter);
apiRouter.use('/documents', documentsRouter);

// Catch undefined API routes under /api/v1
apiRouter.all('*', (req: Request, _res: Response) => {
  throw new ApiError(
    404,
    'ROUTE_NOT_FOUND',
    `The requested API endpoint '${req.method} ${req.originalUrl}' does not exist.`
  );
});

export default apiRouter;
