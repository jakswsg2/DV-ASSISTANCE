/**
 * Backend Server Bootstrap & Dev/Prod Integrator
 * DV-Assistance Platform - Step 10
 *
 * Full-stack Express entry point running on port 3000.
 * In development: Integrates Vite development server via middlewareMode.
 * In production: Serves precompiled static assets from dist/ with SPA fallback.
 */

import express from 'express';
import path from 'node:path';
import { createApp } from './src/server/app.ts';
import { config } from './src/server/config.ts';

export async function startServer() {
  const app = createApp();

  if (config.isDev) {
    // Development mode: Mount Vite dev server in middleware mode
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve compiled assets from dist/
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(
      `[DV-Assistance] Server running in ${config.nodeEnv} on http://${config.host}:${config.port}`
    );
    console.log(`[DV-Assistance] API boundary mounted at ${config.apiPrefix}`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('[DV-Assistance] Shutting down gracefully...');
    server.close(() => {
      console.log('[DV-Assistance] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { app, server };
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[DV-Assistance] Fatal error during server startup:', err);
    process.exit(1);
  });
}
