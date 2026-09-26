/**
 * Staff & User Governance Repository
 * DV-Assistance Platform - Step 16
 *
 * Implements user management, status transitions, and system governance metrics.
 * Security Guarantees:
 * - Exposes only non-sensitive governance fields (id, role, status, safeAlias, createdAt)
 * - Zero access to survivor case records, passwords, or PII
 * - Safeguards against self-suspension and last-active-admin lockout
 * - Status transitions strictly limited to 'active' <-> 'suspended'
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { dbConfig } from '../../db/config.ts';
import { users } from '../../db/schema.ts';
import { devDataStore, type DevUser } from './devStore.ts';
import { ApiError } from '../middleware/errorHandler.ts';

export interface GovernanceUserSummary {
  id: string;
  role: string;
  status: string;
  safeAlias: string;
  createdAt: Date;
}

export interface UserSystemStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  roleBreakdown: Record<string, number>;
}

export class UserRepository {
  /**
   * Lists all system users for administrative review.
   */
  async listUsersForGovernance(): Promise<GovernanceUserSummary[]> {
    if (!dbConfig.isConfigured) {
      return Array.from(devDataStore.users.values())
        .map((u) => ({
          id: u.id,
          role: u.role,
          status: u.status,
          safeAlias: u.safeAlias,
          createdAt: u.createdAt,
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const rows = await db
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        safeAlias: users.safeAlias,
        createdAt: users.createdAt,
      })
      .from(users);

    return rows;
  }

  /**
   * Updates user account status with self-suspension and last-admin protections.
   */
  async updateUserStatus(
    targetUserId: string,
    newStatus: 'active' | 'suspended',
    actorUserId: string
  ): Promise<GovernanceUserSummary> {
    if (newStatus !== 'active' && newStatus !== 'suspended') {
      throw new ApiError(400, 'INVALID_INPUT', "Status must be either 'active' or 'suspended'.");
    }

    // 1. Protection: Self-suspension guard
    if (actorUserId === targetUserId && newStatus === 'suspended') {
      throw new ApiError(400, 'FORBIDDEN_SELF_SUSPENSION', 'Administrators cannot suspend their own active account.');
    }

    if (!dbConfig.isConfigured) {
      const user = devDataStore.users.get(targetUserId);
      if (!user) {
        throw new ApiError(404, 'NOT_FOUND', 'User account not found.');
      }

      // 2. Protection: Last active administrator guard
      if (user.role === 'admin' && newStatus === 'suspended') {
        const activeAdminCount = Array.from(devDataStore.users.values()).filter(
          (u) => u.role === 'admin' && u.status === 'active' && u.id !== targetUserId
        ).length;

        if (activeAdminCount === 0) {
          throw new ApiError(
            400,
            'LAST_ADMIN_PROTECTION',
            'Cannot suspend the last active administrator account.'
          );
        }
      }

      user.status = newStatus;
      user.updatedAt = new Date();
      devDataStore.users.set(targetUserId, user);

      return {
        id: user.id,
        role: user.role,
        status: user.status,
        safeAlias: user.safeAlias,
        createdAt: user.createdAt,
      };
    }

    // When PostgreSQL is configured
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'User account not found.');
    }

    // Check last active admin condition
    if (existing.role === 'admin' && newStatus === 'suspended') {
      const [adminCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            eq(users.role, 'admin'),
            eq(users.status, 'active')
          )
        );

      if (Number(adminCount?.count || 0) <= 1) {
        throw new ApiError(
          400,
          'LAST_ADMIN_PROTECTION',
          'Cannot suspend the last active administrator account.'
        );
      }
    }

    const [updated] = await db
      .update(users)
      .set({ status: newStatus })
      .where(eq(users.id, targetUserId))
      .returning({
        id: users.id,
        role: users.role,
        status: users.status,
        safeAlias: users.safeAlias,
        createdAt: users.createdAt,
      });

    return updated;
  }

  /**
   * Retrieves aggregate system user statistics for the administrative overview.
   */
  async getUserOverviewStats(): Promise<UserSystemStats> {
    if (!dbConfig.isConfigured) {
      const all = Array.from(devDataStore.users.values());
      const active = all.filter((u) => u.status === 'active').length;
      const suspended = all.filter((u) => u.status === 'suspended').length;
      const roleBreakdown: Record<string, number> = {};

      for (const u of all) {
        roleBreakdown[u.role] = (roleBreakdown[u.role] || 0) + 1;
      }

      return {
        totalUsers: all.length,
        activeUsers: active,
        suspendedUsers: suspended,
        roleBreakdown,
      };
    }

    const [total] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [active] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.status, 'active'));
    const [suspended] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.status, 'suspended'));

    const rows = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.role);

    const roleBreakdown: Record<string, number> = {};
    for (const r of rows) {
      roleBreakdown[r.role] = Number(r.count);
    }

    return {
      totalUsers: Number(total?.count || 0),
      activeUsers: Number(active?.count || 0),
      suspendedUsers: Number(suspended?.count || 0),
      roleBreakdown,
    };
  }
}

export const userRepository = new UserRepository();
export default userRepository;
