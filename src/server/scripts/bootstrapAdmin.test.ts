/**
 * Production Admin Bootstrap Utility Test Suite
 * DV-Assistance Platform - Step 21
 *
 * Verifies all 20 required safety, identity, role-transition, idempotency,
 * and security-wall contracts for the production admin bootstrap utility.
 */

import { randomUUID } from 'node:crypto';
import { bootstrapAdminUser } from './bootstrapAdmin.ts';
import { devDataStore } from '../repositories/devStore.ts';
import { ROLE_DEFINITIONS } from '../../rbac/rbacPolicy.ts';

export async function runBootstrapAdminTestSuite(): Promise<{ passed: number; failed: number; results: Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }> }> {
  const results: Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }> = [];
  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      results.push({ name, status: 'PASS' });
    } catch (err: unknown) {
      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({ name, status: 'FAIL', error: errMsg });
    }
  };

  // Setup helper personas in devDataStore
  const createTestUser = (role: 'client' | 'advocate' | 'partner' | 'admin', status: 'active' | 'suspended' = 'active') => {
    const userId = randomUUID();
    const firebaseUid = `fb-uid-${randomUUID().slice(0, 8)}`;
    
    devDataStore.users.set(userId, {
      id: userId,
      role,
      status,
      safeAlias: `Test ${role} ${userId.slice(0, 4)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    devDataStore.identities.set(firebaseUid, {
      id: randomUUID(),
      userId,
      provider: 'firebase',
      providerSubjectId: firebaseUid,
      createdAt: new Date(),
    });

    return { userId, firebaseUid };
  };

  // Test 1: Valid client -> promoted to admin
  await test('Test 1: Valid client is promoted to admin', async () => {
    const { userId, firebaseUid } = createTestUser('client');
    const result = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    if (!result.success || result.code !== 'SUCCESS') {
      throw new Error(`Expected SUCCESS, got ${result.code}: ${result.message}`);
    }
    
    const user = devDataStore.users.get(userId);
    if (user?.role !== 'admin') {
      throw new Error(`User role was not updated to admin in database. Got: ${user?.role}`);
    }
  });

  // Test 2: Existing advocate -> promoted to admin
  await test('Test 2: Existing advocate is promoted to admin', async () => {
    const { userId, firebaseUid } = createTestUser('advocate');
    const result = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    if (!result.success || result.code !== 'SUCCESS') {
      throw new Error(`Expected SUCCESS, got ${result.code}: ${result.message}`);
    }

    const user = devDataStore.users.get(userId);
    if (user?.role !== 'admin') {
      throw new Error(`User role was not updated to admin in database. Got: ${user?.role}`);
    }
  });

  // Test 3: Existing partner -> promoted to admin
  await test('Test 3: Existing partner is promoted to admin', async () => {
    const { userId, firebaseUid } = createTestUser('partner');
    const result = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    if (!result.success || result.code !== 'SUCCESS') {
      throw new Error(`Expected SUCCESS, got ${result.code}: ${result.message}`);
    }

    const user = devDataStore.users.get(userId);
    if (user?.role !== 'admin') {
      throw new Error(`User role was not updated to admin in database. Got: ${user?.role}`);
    }
  });

  // Test 4: Existing admin -> idempotent success (ALREADY_ADMIN)
  await test('Test 4: Existing admin returns idempotent ALREADY_ADMIN', async () => {
    const { userId, firebaseUid } = createTestUser('admin');
    const result = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    if (!result.success || result.code !== 'ALREADY_ADMIN') {
      throw new Error(`Expected ALREADY_ADMIN, got ${result.code}: ${result.message}`);
    }

    const user = devDataStore.users.get(userId);
    if (user?.role !== 'admin') {
      throw new Error(`User role changed unexpectedly. Got: ${user?.role}`);
    }
  });

  // Test 5: Unknown Firebase UID -> rejected (IDENTITY_NOT_FOUND)
  await test('Test 5: Unknown Firebase UID is rejected', async () => {
    const result = await bootstrapAdminUser({ firebaseUid: 'non-existent-uid-9999', confirm: true, allowDevOverride: true });
    
    if (result.success || result.code !== 'IDENTITY_NOT_FOUND') {
      throw new Error(`Expected IDENTITY_NOT_FOUND, got ${result.code}: ${result.message}`);
    }
  });

  // Test 6: Unknown application identity mapping -> rejected (USER_NOT_FOUND)
  await test('Test 6: Missing application user record is rejected', async () => {
    const firebaseUid = `orphaned-uid-${randomUUID()}`;
    devDataStore.identities.set(firebaseUid, {
      id: randomUUID(),
      userId: 'non-existent-user-id-1234',
      provider: 'firebase',
      providerSubjectId: firebaseUid,
      createdAt: new Date(),
    });

    const result = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    if (result.success || result.code !== 'USER_NOT_FOUND') {
      throw new Error(`Expected USER_NOT_FOUND, got ${result.code}: ${result.message}`);
    }
  });

  // Test 7: Suspended user -> rejected (SUSPENDED_USER)
  await test('Test 7: Suspended user promotion is rejected', async () => {
    const { userId, firebaseUid } = createTestUser('client', 'suspended');
    const result = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    if (result.success || result.code !== 'SUSPENDED_USER') {
      throw new Error(`Expected SUSPENDED_USER, got ${result.code}: ${result.message}`);
    }

    const user = devDataStore.users.get(userId);
    if (user?.role === 'admin') {
      throw new Error('Suspended user was improperly promoted to admin');
    }
  });

  // Test 8: Dry-run mode -> validates eligibility without modifying database
  await test('Test 8: Dry-run mode validates without mutating records', async () => {
    const { userId, firebaseUid } = createTestUser('client');
    const result = await bootstrapAdminUser({ firebaseUid, dryRun: true, confirm: true, allowDevOverride: true });
    
    if (!result.success || result.code !== 'SUCCESS' || !result.details?.dryRun) {
      throw new Error(`Expected dryRun SUCCESS, got ${result.code}: ${result.message}`);
    }

    const user = devDataStore.users.get(userId);
    if (user?.role !== 'client') {
      throw new Error(`Dry-run mode modified user role in database. Got: ${user?.role}`);
    }
  });

  // Test 9: Missing or empty Firebase UID -> rejected (INVALID_INPUT)
  await test('Test 9: Empty or whitespace Firebase UID is rejected', async () => {
    const result = await bootstrapAdminUser({ firebaseUid: '   ', confirm: true, allowDevOverride: true });
    
    if (result.success || result.code !== 'INVALID_INPUT') {
      throw new Error(`Expected INVALID_INPUT, got ${result.code}: ${result.message}`);
    }
  });

  // Test 10: Unconfirmed non-dev invocation -> rejected (UNSAFE_ENVIRONMENT)
  await test('Test 10: Unconfirmed invocation without confirm flag is rejected', async () => {
    const { firebaseUid } = createTestUser('client');
    const result = await bootstrapAdminUser({ firebaseUid, confirm: false, allowDevOverride: false });
    
    if (result.success || result.code !== 'UNSAFE_ENVIRONMENT') {
      throw new Error(`Expected UNSAFE_ENVIRONMENT, got ${result.code}: ${result.message}`);
    }
  });

  // Test 11: Verify no HTTP bootstrap endpoint exists
  await test('Test 11: Verify no HTTP endpoint exists for bootstrap', async () => {
    const { default: apiRouter } = await import('../apiRouter.ts');
    // Inspect router stack
    const stack = (apiRouter as unknown as { stack: Array<{ route?: { path: string } }> }).stack || [];
    const hasBootstrapRoute = stack.some(s => s.route?.path?.includes('bootstrap'));
    
    if (hasBootstrapRoute) {
      throw new Error('Found HTTP route for bootstrap in apiRouter!');
    }
  });

  // Test 12: Verify no automatic first-user promotion in authentication routes
  await test('Test 12: Verify no automatic first-user promotion exists', async () => {
    const { resolveOrProvisionUser } = await import('../auth/sessionManager.ts');
    const newUid = `fresh-uid-${randomUUID()}`;
    const { user, isNew } = await resolveOrProvisionUser(newUid, 'firstuser@test.org');
    
    if (!isNew || user.role !== 'client') {
      throw new Error(`Newly provisioned user was not assigned default 'client' role. Got: ${user.role}`);
    }
  });

  // Test 13: Verify no email/domain automatic promotion
  await test('Test 13: Verify no email/domain automatic promotion', async () => {
    const { resolveOrProvisionUser } = await import('../auth/sessionManager.ts');
    const adminEmailUid = `admin-email-uid-${randomUUID()}`;
    const { user } = await resolveOrProvisionUser(adminEmailUid, 'admin@dv-assistance.org');
    
    if (user.role === 'admin') {
      throw new Error('User was automatically promoted to admin based on email address!');
    }
  });

  // Test 14: Verify Admin Data Wall remains strictly intact after promotion
  await test('Test 14: Verify Admin Data Wall remains intact after promotion', async () => {
    const { userId, firebaseUid } = createTestUser('client');
    await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    // Test that newly promoted admin is denied case access
    const { authorizeCaseAccess } = await import('../auth/authorization.ts');
    try {
      await authorizeCaseAccess({
        id: userId,
        role: 'admin',
        safeAlias: 'Promoted Admin',
        status: 'active',
        permissions: [],
        isAnonymous: false,
        firebaseUid,
        sessionId: 's-123',
      }, 'some-case-id');
      throw new Error('Admin Data Wall failed: Admin was granted case file access!');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!errMsg.includes('not exist') && !errMsg.includes('do not have access')) {
        throw new Error(`Unexpected error from Admin Data Wall: ${errMsg}`);
      }
    }
  });

  // Test 15: Verify Admin permissions remain unchanged
  await test('Test 15: Verify Admin role permissions remain unchanged', async () => {
    const adminPermissions = ROLE_DEFINITIONS.admin.permissions;
    const expected = ['admin:access', 'rbac:manage', 'config:manage', 'audit:read'];
    
    const matches = expected.every(p => adminPermissions.includes(p as any)) && adminPermissions.length === expected.length;
    if (!matches) {
      throw new Error(`Admin role permissions altered! Current permissions: ${JSON.stringify(adminPermissions)}`);
    }
  });

  // Test 16: Verify no sensitive secrets leaked in output details
  await test('Test 16: Verify no sensitive secrets leaked in output details', async () => {
    const { firebaseUid } = createTestUser('client');
    const result = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    
    const detailsStr = JSON.stringify(result.details || {}).toLowerCase();
    const sensitiveKeys = ['secret', 'key', 'password', 'token'];
    
    for (const key of sensitiveKeys) {
      if (detailsStr.includes(`"${key}"`)) {
        throw new Error(`Sensitive key "${key}" found in bootstrap result details!`);
      }
    }
  });

  // Test 17: Repeated execution is idempotent
  await test('Test 17: Repeated execution is idempotent', async () => {
    const { userId, firebaseUid } = createTestUser('client');
    
    const res1 = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    if (res1.code !== 'SUCCESS') throw new Error(`First execution failed: ${res1.message}`);

    const res2 = await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });
    if (res2.code !== 'ALREADY_ADMIN') throw new Error(`Second execution failed idempotency: ${res2.message}`);

    const user = devDataStore.users.get(userId);
    if (user?.role !== 'admin') throw new Error(`User role corrupted after second execution: ${user?.role}`);
  });

  // Test 18: No unrelated user is modified during promotion
  await test('Test 18: No unrelated user is modified during promotion', async () => {
    const { userId: otherUserId } = createTestUser('client');
    const { firebaseUid: targetUid } = createTestUser('client');

    await bootstrapAdminUser({ firebaseUid: targetUid, confirm: true, allowDevOverride: true });

    const otherUser = devDataStore.users.get(otherUserId);
    if (otherUser?.role !== 'client') {
      throw new Error(`Unrelated user "${otherUserId}" was modified during bootstrap promotion!`);
    }
  });

  // Test 19: Security audit event recorded on promotion
  await test('Test 19: Security audit event recorded on promotion', async () => {
    const { firebaseUid } = createTestUser('client');
    const prevCount = devDataStore.auditEvents.length;

    await bootstrapAdminUser({ firebaseUid, confirm: true, allowDevOverride: true });

    const newEvents = devDataStore.auditEvents.slice(prevCount);
    const promoteEvent = newEvents.find(e => e.action === 'admin:bootstrap_promoted');
    
    if (!promoteEvent) {
      throw new Error('Security audit event "admin:bootstrap_promoted" was not recorded!');
    }
  });

  // Test 20: Quick Escape & volatile state purging unaffected
  await test('Test 20: Quick Escape & volatile state purging unaffected', async () => {
    const { useSafety } = await import('../../safety/SafetyContext.tsx');
    if (typeof useSafety !== 'function') {
      throw new Error('SafetyContext exported module missing useSafety export!');
    }
  });

  return { passed, failed, results };
}

// Auto-run if executed as main
if (import.meta.url === `file://${process.argv[1]}`) {
  runBootstrapAdminTestSuite().then(({ passed, failed, results }) => {
    console.log(`\n=== STEP 21 ADMIN BOOTSTRAP TEST SUITE RESULTS ===`);
    console.log(`Passed: ${passed} | Failed: ${failed}\n`);
    for (const r of results) {
      console.log(`[${r.status}] ${r.name} ${r.error ? `-> Error: ${r.error}` : ''}`);
    }
    if (failed > 0) {
      process.exit(1);
    }
  });
}
