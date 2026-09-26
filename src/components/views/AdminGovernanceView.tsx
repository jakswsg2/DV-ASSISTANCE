import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  KeyRound,
  ScrollText,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Activity,
  Users,
  ShieldCheck,
  Clock,
  Filter,
} from 'lucide-react';

export interface AdminGovernanceViewProps {
  readonly initialTab?: 'overview' | 'users' | 'audit';
}

interface OverviewData {
  accounts: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    roleBreakdown: Record<string, number>;
  };
  securityAudit: {
    totalEvents: number;
    successEvents: number;
    deniedEvents: number;
    errorEvents: number;
  };
  systemHealth: string;
  serverTime: string;
}

interface GovernanceUser {
  id: string;
  role: string;
  status: string;
  safeAlias: string;
  createdAt: string;
}

interface SafeAuditEvent {
  id: string;
  timestamp: string;
  actorRole: string;
  action: string;
  resourceType: string;
  outcome: string;
  requestId: string | null;
}

export const AdminGovernanceView: React.FC<AdminGovernanceViewProps> = ({
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'audit'>(initialTab);

  // Tab 1: Overview State
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Tab 2: Users State
  const [users, setUsers] = useState<GovernanceUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userSuccessMsg, setUserSuccessMsg] = useState<string | null>(null);

  // Tab 3: Audit Logs State
  const [auditEvents, setAuditEvent] = useState<SafeAuditEvent[]>([]);
  const [totalAuditCount, setTotalAuditCount] = useState<number>(0);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Audit Filters & Pagination
  const [actionFilter, setActionFilter] = useState<string>('');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'success' | 'denied' | 'error'>('all');
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);

  // ---------------------------------------------------------------------------
  // TAB 1: FETCH OVERVIEW METRICS
  // ---------------------------------------------------------------------------
  const fetchOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError(null);

    try {
      const res = await fetch('/api/v1/admin/overview', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Access restricted. System administrator permission required.');
        }
        throw new Error('Unable to retrieve system governance overview.');
      }

      const data = await res.json();
      setOverview(data.overview || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load governance metrics.';
      setOverviewError(msg);
      setOverview(null);
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // TAB 2: FETCH USER DIRECTORY & STATUS TOGGLE
  // ---------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUsersError(null);

    try {
      const res = await fetch('/api/v1/admin/users', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Access restricted. User administration permission required.');
        }
        throw new Error('Failed to retrieve staff account directory.');
      }

      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading user account directory.';
      setUsersError(msg);
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const handleToggleUserStatus = async (user: GovernanceUser) => {
    const targetNewStatus = user.status === 'active' ? 'suspended' : 'active';
    setUpdatingUserId(user.id);
    setUsersError(null);
    setUserSuccessMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(user.id)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ status: targetNewStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Failed to update account status.');
      }

      setUserSuccessMsg(`User "${user.safeAlias}" status set to '${targetNewStatus}'.`);
      await fetchUsers();

      setTimeout(() => {
        setUserSuccessMsg(null);
      }, 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating user status.';
      setUsersError(msg);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 3: FETCH AUDIT LOGS
  // ---------------------------------------------------------------------------
  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingAudit(true);
    setAuditError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', limit.toString());
      queryParams.set('offset', offset.toString());

      if (actionFilter.trim()) {
        queryParams.set('action', actionFilter.trim());
      }
      if (outcomeFilter !== 'all') {
        queryParams.set('outcome', outcomeFilter);
      }

      const res = await fetch(`/api/v1/admin/audit-logs?${queryParams.toString()}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Access restricted. Security audit log permission required.');
        }
        throw new Error('Unable to query security audit trail.');
      }

      const data = await res.json();
      setAuditEvent(Array.isArray(data.events) ? data.events : []);
      setTotalAuditCount(typeof data.total === 'number' ? data.total : 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error querying security audit events.';
      setAuditError(msg);
      setAuditEvent([]);
    } finally {
      setIsLoadingAudit(false);
    }
  }, [actionFilter, outcomeFilter, limit, offset]);

  // Load appropriate data on active tab transition
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverview();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchOverview, fetchUsers, fetchAuditLogs]);

  // Handle audit filter resets
  const handleApplyAuditSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchAuditLogs();
  };

  return (
    <div className="space-y-6 text-slate-900 max-w-5xl mx-auto">
      {/* Governance Console Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldAlert className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                System Governance & Administration
              </h1>
              <p className="text-xs text-slate-500">
                Platform Health • Staff User RBAC • Forensic Security Audit Logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full self-start sm:self-auto">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Mandatory Admin Data Segregation Wall Active
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          System Administrators manage technical parameters, staff role allocations, and security audit verification. Under constitutional policy, Administrators are structurally restricted from viewing survivor case files or intake contents.
        </p>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Overview Metrics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'users'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>User Accounts & RBAC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <ScrollText className="h-4 w-4" />
            <span>Security Audit Trail</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SYSTEM OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {isLoadingOverview ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : overviewError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
              <p className="text-xs font-medium text-rose-900">{overviewError}</p>
              <button
                type="button"
                onClick={fetchOverview}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : overview ? (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Registered Accounts
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900 block">
                    {overview.accounts.totalUsers}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {overview.accounts.activeUsers} Active • {overview.accounts.suspendedUsers} Suspended
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Security Audit Volume
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900 block">
                    {overview.securityAudit.totalEvents}
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {overview.securityAudit.successEvents} Success • {overview.securityAudit.deniedEvents} Denied
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    System Health
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-600 block">
                    {overview.systemHealth}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    All Core Services Operational
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Server Clock Time
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-800 block truncate pt-1">
                    {new Date(overview.serverTime).toLocaleTimeString()}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium block truncate">
                    {new Date(overview.serverTime).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Role Distribution Breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  Account Role Allocations
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(overview.accounts.roleBreakdown || {}).map(([role, count]) => (
                    <div
                      key={role}
                      className="rounded-xl border border-slate-150 bg-slate-50/80 p-3.5 space-y-1"
                    >
                      <span className="text-xs font-bold text-slate-800 uppercase block">{role}</span>
                      <span className="text-lg font-bold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 2: USER GOVERNANCE */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-600" />
              Staff & System Account Directory ({users.length})
            </span>
            <button
              type="button"
              onClick={fetchUsers}
              disabled={isLoadingUsers}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              <span>Refresh Accounts</span>
            </button>
          </div>

          {usersError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{usersError}</span>
            </div>
          )}

          {userSuccessMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{userSuccessMsg}</span>
            </div>
          )}

          {isLoadingUsers ? (
            <div className="space-y-2 py-4">
              <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Safe Alias</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Governance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {users.map((user) => {
                    const isSuspended = user.status === 'suspended';
                    const isBusy = updatingUserId === user.id;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {user.safeAlias}
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            ID: {user.id}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold uppercase text-[11px]">
                          {user.role}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isSuspended
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isSuspended ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={isBusy}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              isSuspended
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100'
                            }`}
                          >
                            {isBusy ? (
                              <span className="h-3 w-3 rounded-full border-2 border-slate-400 border-t-slate-800 animate-spin" />
                            ) : isSuspended ? (
                              <>
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>Reactivate</span>
                              </>
                            ) : (
                              <>
                                <UserX className="h-3.5 w-3.5" />
                                <span>Suspend</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SECURITY AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Audit Filters */}
          <form
            onSubmit={handleApplyAuditSearch}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3"
          >
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder="Search by action name (e.g. admin:users_viewed)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value as 'all' | 'success' | 'denied' | 'error')}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-900"
              >
                <option value="all">All Outcomes</option>
                <option value="success">Success</option>
                <option value="denied">Denied</option>
                <option value="error">Error</option>
              </select>

              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Query Logs
              </button>
            </div>
          </form>

          {auditError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{auditError}</span>
            </div>
          )}

          {/* Table */}
          {isLoadingAudit ? (
            <div className="space-y-2 py-4">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor Role</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Resource Type</th>
                    <th className="py-3 px-4">Outcome</th>
                    <th className="py-3 px-4 text-right">Request ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {auditEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No security audit records match your query.
                      </td>
                    </tr>
                  ) : (
                    auditEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          <Clock className="h-3 w-3 inline mr-1 text-slate-400" />
                          {new Date(e.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold uppercase text-[10px] text-slate-700">
                          {e.actorRole}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-900 font-semibold text-[11px]">
                          {e.action}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{e.resourceType}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                              e.outcome === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : e.outcome === 'denied'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {e.outcome}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[10px] text-slate-400">
                          {e.requestId || 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination Bar */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Showing {offset + 1}–{Math.min(offset + limit, totalAuditCount)} of {totalAuditCount} total events
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                    disabled={offset === 0 || isLoadingAudit}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOffset((prev) => prev + limit)}
                    disabled={offset + limit >= totalAuditCount || isLoadingAudit}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminGovernanceView;
