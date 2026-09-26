/**
 * Baseline HTTP Security Headers Middleware
 * DV-Assistance Platform - Step 10
 *
 * Configures foundational HTTP protection using Helmet.
 * Distinguishes production strictness from Vite development workflow requirements.
 * Ensures HSTS is only active in production TLS environments.
 */

import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { config } from '../config.ts';

export function createSecurityHeadersMiddleware(): RequestHandler {
  if (config.isDev) {
    // Development configuration: permissive CSP to prevent breaking Vite development and inline styles
    return helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: false, // Do not claim HSTS in non-TLS local development
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    });
  }

  // Production configuration: Strict security headers
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind CSS uses inline style injects
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

export default createSecurityHeadersMiddleware;
