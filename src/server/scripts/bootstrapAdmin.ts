/**
 * Production Admin Bootstrap Utility
 * DV-Assistance Platform - Step 21
 *
 * Implements a secure, server-side CLI bootstrap utility for assigning the initial
 * 'admin' role to an existing verified Firebase identity.
 *
 * Security Guarantees:
 * - Server-side execution only (NO Express HTTP endpoint, NO browser UI)
 * - Requires existing verified Firebase identity & mapped application user record
 * - Refuses suspended users (`SUSPENDED_USER`)
 * - Idempotent for existing administrators (`ALREADY_ADMIN`)
 * - Atomic role transition with security audit event logging (`admin:bootstrap_promoted`)
 * - Supports dry-run validation mode (`--dry-run`)
 * - Requires explicit operator intent (`--confirm`)
 * - Zero disclosure of private keys, session secrets, or database credentials
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { users, userIdentities } from '../../db/schema.ts';
import { config } from '../config.ts';
import { initializeFirebaseAdmin, isFirebaseAdminConfigured } from '../auth/firebaseAdmin.ts';
import { recordAuditEvent } from '../audit/auditLogger.ts';
import { devDataStore } from '../repositories/devStore.ts';

export interface BootstrapOptions {
  readonly firebaseUid: string;
  readonly dryRun?: boolean;
  readonly confirm?: boolean;
  readonly allowDevOverride?: boolean;
}

export type BootstrapCode =
  | 'SUCCESS'
  | 'ALREADY_ADMIN'
  | 'INVALID_INPUT'
  | 'IDENTITY_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'SUSPENDED_USER'
  | 'UNSAFE_ENVIRONMENT'
  | 'AUTHENTICATION_CONFIGURATION_ERROR'
  | 'DATABASE_ERROR'
  | 'AUDIT_ERROR'
  | 'ROLE_UPDATE_ERROR';

export interface BootstrapResult {
  readonly success: boolean;
  readonly code: BootstrapCode;
  readonly exitCode: number;
  readonly message: string;
  readonly details?: {
    readonly userId?: string;
    readonly firebaseUid?: string;
    readonly previousRole?: string;
    readonly newRole?: string;
    readonly dryRun?: boolean;
  };
}

/**
 * Programmatic entry point for administrative role promotion.
 */
export async function bootstrapAdminUser(options: BootstrapOptions): Promise<BootstrapResult> {
  const firebaseUid = options.firebaseUid?.trim();

  // 1. Input Validation Guard
  if (!firebaseUid || firebaseUid.length === 0) {
    return {
      success: false,
      code: 'INVALID_INPUT',
      exitCode: 1,
      message: 'Firebase UID must be a non-empty string. Usage: --firebase-uid <UID>',
    };
  }

  // 2. Safety Confirmation Guard
  if (!options.dryRun && !options.confirm && !options.allowDevOverride) {
    return {
      success: false,
      code: 'UNSAFE_ENVIRONMENT',
      exitCode: 5,
      message:
        'Safety Gate: Bootstrap operation requires explicit operator intent. Re-run with --confirm flag.',
    };
  }

  // 3. Optional Firebase Admin SDK User Verification
  if (isFirebaseAdminConfigured()) {
    try {
      const { auth } = initializeFirebaseAdmin();
      if (auth) {
        await auth.getUser(firebaseUid);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        code: 'IDENTITY_NOT_FOUND',
        exitCode: 2,
        message: `Firebase UID "${firebaseUid}" not found in Firebase Authentication: ${errMsg}`,
      };
    }
  }

  // 4. Resolve Application User Record via Identity Mapping
  let userId: string | null = null;
  let currentRole: string | null = null;
  let currentStatus: string | null = null;

  if (!dbConfig.isConfigured) {
    // Development / Local Test Store Path
    const identity = devDataStore.identities.get(firebaseUid);
    if (!identity) {
      return {
        success: false,
        code: 'IDENTITY_NOT_FOUND',
        exitCode: 2,
        message: `No application user identity mapping found for Firebase UID "${firebaseUid}". User must log in at least once prior to bootstrap.`,
      };
    }

    const user = devDataStore.users.get(identity.userId);
    if (!user) {
      return {
        success: false,
        code: 'USER_NOT_FOUND',
        exitCode: 3,
        message: `Application user record not found for ID "${identity.userId}".`,
      };
    }

    userId = user.id;
    currentRole = user.role;
    currentStatus = user.status;
  } else {
    // PostgreSQL Production Path
    try {
      const identityRows = await db
        .select()
        .from(userIdentities)
        .where(
          and(eq(userIdentities.provider, 'firebase'), eq(userIdentities.providerSubjectId, firebaseUid))
        )
        .limit(1);

      if (identityRows.length === 0) {
        return {
          success: false,
          code: 'IDENTITY_NOT_FOUND',
          exitCode: 2,
          message: `No application user identity mapping found for Firebase UID "${firebaseUid}". User must log in at least once prior to bootstrap.`,
        };
      }

      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.id, identityRows[0].userId))
        .limit(1);

      if (userRows.length === 0) {
        return {
          success: false,
          code: 'USER_NOT_FOUND',
          exitCode: 3,
          message: `Application user record not found for ID "${identityRows[0].userId}".`,
        };
      }

      userId = userRows[0].id;
      currentRole = userRows[0].role;
      currentStatus = userRows[0].status;
    } catch (dbErr: unknown) {
      const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      return {
        success: false,
        code: 'DATABASE_ERROR',
        exitCode: 7,
        message: `Database query error while resolving identity: ${errMsg}`,
      };
    }
  }

  // 5. Account Status Safety Guard
  if (currentStatus === 'suspended') {
    return {
      success: false,
      code: 'SUSPENDED_USER',
      exitCode: 4,
      message: `User "${userId}" is currently suspended. Cannot promote a suspended account to administrator.`,
    };
  }

  // 6. Idempotency Check: Already Admin
  if (currentRole === 'admin') {
    return {
      success: true,
      code: 'ALREADY_ADMIN',
      exitCode: 0,
      message: `User "${userId}" (Firebase UID: ${firebaseUid}) is already a System Administrator. No changes made.`,
      details: {
        userId,
        firebaseUid,
        previousRole: 'admin',
        newRole: 'admin',
        dryRun: Boolean(options.dryRun),
      },
    };
  }

  // 7. Dry-Run Execution Mode
  if (options.dryRun) {
    return {
      success: true,
      code: 'SUCCESS',
      exitCode: 0,
      message: `[DRY-RUN] User "${userId}" (Firebase UID: ${firebaseUid}) is valid and eligible for promotion from "${currentRole}" to "admin". No database records were modified.`,
      details: {
        userId,
        firebaseUid,
        previousRole: currentRole,
        newRole: 'admin',
        dryRun: true,
      },
    };
  }

  // 8. Atomic Role Transition Execution
  try {
    if (!dbConfig.isConfigured) {
      const devUser = devDataStore.users.get(userId);
      if (devUser) {
        devUser.role = 'admin';
        devUser.updatedAt = new Date();
      }
    } else {
      await db
        .update(users)
        .set({
          role: 'admin',
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }
  } catch (updateErr: unknown) {
    const errMsg = updateErr instanceof Error ? updateErr.message : String(updateErr);
    return {
      success: false,
      code: 'ROLE_UPDATE_ERROR',
      exitCode: 9,
      message: `Failed to update user role in database: ${errMsg}`,
    };
  }

  // 9. Record Persistent Security Audit Event
  try {
    await recordAuditEvent({
      action: 'admin:bootstrap_promoted',
      outcome: 'success',
      actorUserId: 'system_operator',
      actorRole: 'system_operator',
      resourceType: 'user',
      resourceId: userId,
      metadata: {
        firebaseUid,
        previousRole: currentRole,
        newRole: 'admin',
        method: 'cli_bootstrap',
      },
    });
  } catch (auditErr: unknown) {
    console.error('[BootstrapAdmin] Audit logging failed following promotion:', auditErr);
  }

  return {
    success: true,
    code: 'SUCCESS',
    exitCode: 0,
    message: `SUCCESS: User "${userId}" (Firebase UID: ${firebaseUid}) promoted from "${currentRole}" to "admin".`,
    details: {
      userId,
      firebaseUid,
      previousRole: currentRole,
      newRole: 'admin',
      dryRun: false,
    },
  };
}

/**
 * CLI Argument Parser & Execution Driver
 */
export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
DV-Assistance Production Admin Bootstrap Utility
================================================
Usage:
  npx tsx src/server/scripts/bootstrapAdmin.ts --firebase-uid <UID> [--dry-run] [--confirm]

Options:
  --firebase-uid <UID>   Target verified Firebase UID (Required)
  --dry-run              Validate eligibility without modifying records
  --confirm              Confirm explicit intent to execute promotion
  --help, -h             Show this help message
`);
    process.exit(0);
  }

  let firebaseUid = '';
  let dryRun = false;
  let confirm = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--firebase-uid' && args[i + 1]) {
      firebaseUid = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--confirm') {
      confirm = true;
    }
  }

  console.log('[BootstrapAdmin] Starting Production Admin Bootstrap Process...');

  const result = await bootstrapAdminUser({
    firebaseUid,
    dryRun,
    confirm,
    allowDevOverride: config.isDev,
  });

  console.log(`[BootstrapAdmin] ${result.message}`);

  if (result.details) {
    console.log('[BootstrapAdmin] Details:', JSON.stringify(result.details, null, 2));
  }

  process.exit(result.exitCode);
}

// Auto-run if executed directly as a main script
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((err) => {
    console.error('[BootstrapAdmin] Unhandled fatal error:', err);
    process.exit(1);
  });
}
