import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCheck,
  User,
  Clock,
  RefreshCw,
  Inbox,
  FolderOpen,
} from 'lucide-react';
import { useSafety } from '../../safety/SafetyContext.tsx';
interface MessageItem {
  readonly id: string;
  readonly caseId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly content: string;
  readonly isRead: boolean;
  readonly sentAt: string;
  readonly senderAlias?: string;
  readonly senderRole?: string;
}

interface CaseOption {
  readonly id: string;
  readonly clientId: string;
  readonly sanitizedSummary: string;
  readonly status: string;
  readonly dangerLevel: string;
  readonly assignedAdvocateId?: string | null;
}

export const MessagesView: React.FC = () => {
  const { registerPurgeCallback } = useSafety();

  // State
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messageInput, setMessageInput] = useState<string>('');

  // UI state
  const [isLoadingCases, setIsLoadingCases] = useState<boolean>(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientIdOverride, setRecipientIdOverride] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pure purge callback to wipe volatile composer text
  const purgeComposerDraft = useCallback(() => {
    setMessageInput('');
    setError(null);
  }, []);

  // Register with Safety Core purge registry
  useEffect(() => {
    const unregister = registerPurgeCallback('messages-view', 'form_drafts', () => {
      purgeComposerDraft();
    });

    return () => {
      unregister();
    };
  }, [registerPurgeCallback, purgeComposerDraft]);

  // Fetch user accessible cases on mount
  const fetchAccessibleCases = useCallback(async () => {
    setIsLoadingCases(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/cases', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Case messaging is strictly restricted to clients and assigned advocates.');
        }
        throw new Error('Failed to load accessible case threads.');
      }

      const data = await res.json();
      const loadedCases: CaseOption[] = Array.isArray(data.cases) ? data.cases : [];
      setCases(loadedCases);

      if (loadedCases.length > 0 && !selectedCaseId) {
        setSelectedCaseId(loadedCases[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while loading case conversations.';
      setError(msg);
      setCases([]);
    } finally {
      setIsLoadingCases(false);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    fetchAccessibleCases();
  }, [fetchAccessibleCases]);

  // Fetch messages for selected case
  const fetchMessagesForCase = useCallback(async (caseId: string) => {
    if (!caseId) return;

    setIsLoadingMessages(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/messages/case/${encodeURIComponent(caseId)}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        throw new Error('Unable to retrieve encrypted message history.');
      }

      const data = await res.json();
      const messageList: MessageItem[] = Array.isArray(data.messages) ? data.messages : [];
      setMessages(messageList);

      // Auto-mark incoming unread messages as read
      messageList.forEach((msg) => {
        if (!msg.isRead) {
          fetch(`/api/v1/messages/${msg.id}/read`, {
            method: 'PATCH',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          }).catch(() => {
            // Silently swallow background mark-read errors
          });
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading message history.';
      setError(msg);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCaseId) {
      fetchMessagesForCase(selectedCaseId);
    }
  }, [selectedCaseId, fetchMessagesForCase]);

  // Auto-scroll to message bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle message dispatch
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || !messageInput.trim() || !selectedCaseId) return;

    setIsSending(true);
    setError(null);

    // Derive recipient ID from existing messages or fallback override
    let derivedRecipientId = recipientIdOverride.trim();
    if (!derivedRecipientId && messages.length > 0) {
      const otherMsg = messages.find((m) => m.senderId);
      if (otherMsg) {
        derivedRecipientId = otherMsg.senderId;
      }
    }

    try {
      const payload = {
        caseId: selectedCaseId,
        recipientId: derivedRecipientId || undefined,
        content: messageInput.trim(),
      };

      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Failed to transmit encrypted message.');
      }

      setMessageInput('');
      await fetchMessagesForCase(selectedCaseId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending message.';
      setError(msg);
    } finally {
      setIsSending(false);
    }
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <div className="space-y-6 text-slate-900 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Lock className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                AES-256 Encrypted Messaging Workspace
              </h1>
              <p className="text-xs text-slate-500">
                End-to-End Encrypted Casework Dialogue • Zero Persistent Browser Drafts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Authenticated Encryption Active
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed pt-1">
          Messages sent in this workspace are encrypted with unique IVs and authenticated tags. Only authorized clients and assigned case advocates can decrypt conversation content.
        </p>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => selectedCaseId && fetchMessagesForCase(selectedCaseId)}
              className="text-xs font-semibold text-rose-700 underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Case Selector Sidebar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-emerald-600" />
              Active Cases ({cases.length})
            </span>
            <button
              type="button"
              onClick={fetchAccessibleCases}
              disabled={isLoadingCases}
              className="text-slate-400 hover:text-slate-600 p-1"
              title="Refresh case list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCases ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoadingCases ? (
            <div className="space-y-2 py-4">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : cases.length === 0 ? (
            <div className="py-8 text-center space-y-2 text-slate-500">
              <Inbox className="mx-auto h-8 w-8 text-slate-400" />
              <p className="text-xs font-medium">No active cases found.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {cases.map((c) => {
                const isSelected = c.id === selectedCaseId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-semibold line-clamp-1">{c.sanitizedSummary}</div>
                    <div className="flex items-center justify-between pt-1 opacity-80 text-[11px]">
                      <span>Status: {c.status}</span>
                      <span className="uppercase font-mono font-bold text-[10px]">{c.dangerLevel}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Message Conversation Window */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 min-h-[450px]">
          {/* Active Header */}
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                {selectedCase ? selectedCase.sanitizedSummary : 'Select a Case'}
              </span>
              <span className="text-[11px] text-slate-500">
                {selectedCaseId ? `Case ID: ${selectedCaseId}` : 'No thread selected'}
              </span>
            </div>

            {selectedCaseId && (
              <button
                type="button"
                onClick={() => fetchMessagesForCase(selectedCaseId)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}
          </div>

          {/* Dialogue Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[320px]">
            {isLoadingMessages ? (
              <div className="space-y-3 py-6">
                <div className="h-12 bg-slate-100 rounded-2xl w-3/4 animate-pulse" />
                <div className="h-12 bg-slate-100 rounded-2xl w-2/3 ml-auto animate-pulse" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium">No encrypted messages in this thread yet.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-2xl border border-slate-150 bg-slate-50/80 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <User className="h-3 w-3 text-slate-500" />
                      <span>{msg.senderAlias || 'Participant'}</span>
                      {msg.senderRole && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.2 text-[10px] text-slate-700 font-medium uppercase">
                          {msg.senderRole}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.isRead && <CheckCheck className="h-3.5 w-3.5 text-emerald-600 ml-1" />}
                    </div>
                  </div>

                  <p className="text-xs text-slate-900 leading-relaxed font-normal whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Composer */}
          <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-100 space-y-2">
            <div className="relative">
              <textarea
                rows={3}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                maxLength={4000}
                placeholder="Type your encrypted message..."
                disabled={!selectedCaseId || isSending}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-colors"
              />
              <span className="absolute right-3 bottom-2.5 text-[10px] text-slate-400">
                {messageInput.length}/4000
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Pressing <strong>Esc</strong> purges composer draft instantly
              </span>

              <button
                type="submit"
                disabled={!selectedCaseId || !messageInput.trim() || isSending}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
              >
                {isSending ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Encrypting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Send Encrypted</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MessagesView;
