'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { History, Loader2, RotateCcw, Send, Sparkles, Trash2, Wallet, X } from 'lucide-react';
import {
  AIProvider,
  PocketTrackerActionProposal,
  PocketTrackerChatApiResponse,
  PocketTrackerChatMessage,
  createLocalChatId,
  getAIProviderDescription,
  getAIProviderLabel,
} from '@/lib/ai/pocket-tracker-chat';
import { DEMO_TASK2DO_USER } from '@/lib/demo/task2do-data';
import { FinanceBudget, FinanceTransaction } from '@/lib/finance/mock-data';
import { formatCurrencyBDT } from '@/lib/finance/reporting';
import { cn } from '@/lib/utils';
import {
  createPocketTrackerBudget,
  createPocketTrackerTransaction,
  deletePocketTrackerBudget,
  deletePocketTrackerTransaction,
  updatePocketTrackerBudget,
  updatePocketTrackerTransaction,
} from '@/actions/pocket-tracker';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useStore } from '@/store/useStore';

const suggestions = [
  'Where did most of my money go this month?',
  'Set a Food budget of ৳5000 for March 2026',
  'Change "ada rosun" to ৳180 on March 23, 2026',
  'Summarize my March earnings vs expenses and suggest one improvement',
];

export function PocketTrackerAIChat() {
  const user = useStore((state) => state.user);
  const transactions = useFinanceStore((state) => state.transactions);
  const budgets = useFinanceStore((state) => state.budgets);
  const financeChatSessions = useFinanceStore((state) => state.financeChatSessions);
  const activeFinanceChatSessionId = useFinanceStore((state) => state.activeFinanceChatSessionId);
  const hasHydratedAI = useFinanceStore((state) => state.hasHydratedAI);
  const selectedAIProvider = useFinanceStore((state) => state.selectedAIProvider);
  const ensureFinanceChatSession = useFinanceStore((state) => state.ensureFinanceChatSession);
  const startNewFinanceChat = useFinanceStore((state) => state.startNewFinanceChat);
  const setSelectedAIProvider = useFinanceStore((state) => state.setSelectedAIProvider);
  const setActiveFinanceChatSession = useFinanceStore((state) => state.setActiveFinanceChatSession);
  const appendFinanceChatMessage = useFinanceStore((state) => state.appendFinanceChatMessage);
  const updateFinanceChatMessage = useFinanceStore((state) => state.updateFinanceChatMessage);
  const appendTransactionLocal = useFinanceStore((state) => state.appendTransactionLocal);
  const replaceTransactionLocal = useFinanceStore((state) => state.replaceTransactionLocal);
  const removeTransactionLocal = useFinanceStore((state) => state.removeTransactionLocal);
  const addBudgetLocal = useFinanceStore((state) => state.addBudgetLocal);
  const replaceBudgetLocal = useFinanceStore((state) => state.replaceBudgetLocal);
  const removeBudgetLocal = useFinanceStore((state) => state.removeBudgetLocal);
  const addToast = useFinanceStore((state) => state.addToast);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [submittingMessageId, setSubmittingMessageId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const workspaceUser = user ?? DEMO_TASK2DO_USER;

  const sessions = useMemo(
    () =>
      financeChatSessions
        .filter((session) => session.ownerId === workspaceUser.id)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [financeChatSessions, workspaceUser.id]
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeFinanceChatSessionId) ?? sessions[0] ?? null,
    [activeFinanceChatSessionId, sessions]
  );
  const historySessions = useMemo(() => sessions.filter((session) => session.messages.length > 0), [sessions]);
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession]);
  const activeProviderLabel = getAIProviderLabel(selectedAIProvider);
  const activeProviderDescription = getAIProviderDescription(selectedAIProvider);

  useEffect(() => {
    if (!hasHydratedAI) {
      return;
    }

    ensureFinanceChatSession(workspaceUser.id);
  }, [ensureFinanceChatSession, hasHydratedAI, workspaceUser.id]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeFinanceChatSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHistoryOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !hasHydratedAI) {
      return;
    }

    const sessionId = activeSession?.id ?? ensureFinanceChatSession(workspaceUser.id);
    const content = inputValue.trim();
    const userMessage: PocketTrackerChatMessage = {
      id: createLocalChatId('user'),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    appendFinanceChatMessage(sessionId, userMessage);
    setInputValue('');
    setIsLoading(true);
    setIsHistoryOpen(false);

    try {
      const response = await fetch('/api/pocket-tracker/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAIProvider,
          messages: [...messages, userMessage].map((message) => ({
            role: message.role,
            content: message.content,
            proposal: message.proposal ?? null,
            proposalStatus: message.proposalStatus ?? null,
          })),
          transactions,
          budgets,
        }),
      });

      const data = (await response.json()) as PocketTrackerChatApiResponse & { error?: string };
      appendFinanceChatMessage(sessionId, {
        id: createLocalChatId('assistant'),
        role: 'assistant',
        content: data.message || 'Pocket Tracker AI is ready.',
        timestamp: new Date().toISOString(),
        assistantProvider: data.provider ?? selectedAIProvider,
        assistantLabel: data.providerLabel ?? activeProviderLabel,
        proposal: data.proposal ?? null,
        proposalStatus: data.proposal ? 'pending' : null,
      });
    } catch (error) {
      appendFinanceChatMessage(sessionId, {
        id: createLocalChatId('assistant'),
        role: 'assistant',
        content: 'Pocket Tracker AI hit a temporary connection issue. Please try again in a moment.',
        timestamp: new Date().toISOString(),
        assistantProvider: selectedAIProvider,
        assistantLabel: activeProviderLabel,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyProposal = async (
    messageId: string,
    proposal: PocketTrackerActionProposal,
    status: 'approved' | 'edited'
  ) => {
    if (!activeSession) {
      return;
    }

    setSubmittingMessageId(messageId);

    try {
      switch (proposal.action) {
        case 'create-transaction': {
          const result = await createPocketTrackerTransaction({
            userId: workspaceUser.id,
            email: workspaceUser.email,
            name: workspaceUser.displayName,
            title: proposal.title || 'Pocket Tracker entry',
            category: proposal.category || 'Other',
            type: proposal.type || 'expense',
            date: proposal.date || '2026-03-31',
            amount: proposal.amount || 0,
          });

          if (!result.ok) throw new Error(result.error.message);
          appendTransactionLocal({
            id: result.data.id,
            type: result.data.type,
            amount: String(result.data.amount),
            category: result.data.category,
            date: result.data.date,
            description: result.data.title,
          });
          addToast({
            id: `toast-${Date.now()}`,
            title: 'AI action applied',
            message: `${result.data.title} was added to Pocket Tracker.`,
          });
          break;
        }
        case 'update-transaction': {
          if (!proposal.targetId) throw new Error('No transaction was selected for editing.');
          const result = await updatePocketTrackerTransaction({
            userId: workspaceUser.id,
            transactionId: proposal.targetId,
            title: proposal.title || undefined,
            category: proposal.category || undefined,
            type: proposal.type || undefined,
            date: proposal.date || undefined,
            amount: proposal.amount || undefined,
          });

          if (!result.ok) throw new Error(result.error.message);
          replaceTransactionLocal(proposal.targetId, result.data);
          addToast({
            id: `toast-${Date.now()}`,
            title: 'AI action applied',
            message: `${result.data.title} was updated.`,
          });
          break;
        }
        case 'delete-transaction': {
          if (!proposal.targetId) throw new Error('No transaction was selected for deletion.');
          const result = await deletePocketTrackerTransaction(proposal.targetId);
          if (!result.ok) throw new Error(result.error.message);
          removeTransactionLocal(proposal.targetId);
          addToast({
            id: `toast-${Date.now()}`,
            title: 'AI action applied',
            message: 'The selected transaction was removed.',
          });
          break;
        }
        case 'create-budget': {
          const result = await createPocketTrackerBudget({
            userId: workspaceUser.id,
            email: workspaceUser.email,
            name: workspaceUser.displayName,
            category: proposal.category || 'Other',
            limit: proposal.limit || 0,
            periodLabel: proposal.periodLabel || 'March 2026',
          });

          if (!result.ok) throw new Error(result.error.message);
          addBudgetLocal({
            ...result.data,
            spent: getBudgetSpent(result.data.category, transactions),
          });
          addToast({
            id: `toast-${Date.now()}`,
            title: 'AI action applied',
            message: `${result.data.category} budget was created.`,
          });
          break;
        }
        case 'update-budget': {
          if (!proposal.targetId) throw new Error('No budget was selected for editing.');
          const result = await updatePocketTrackerBudget({
            userId: workspaceUser.id,
            budgetId: proposal.targetId,
            category: proposal.category || undefined,
            limit: proposal.limit || undefined,
            periodLabel: proposal.periodLabel || undefined,
          });

          if (!result.ok) throw new Error(result.error.message);
          replaceBudgetLocal(proposal.targetId, {
            ...result.data,
            spent: getBudgetSpent(result.data.category, transactions),
          });
          addToast({
            id: `toast-${Date.now()}`,
            title: 'AI action applied',
            message: `${result.data.category} budget was updated.`,
          });
          break;
        }
        case 'delete-budget': {
          if (!proposal.targetId) throw new Error('No budget was selected for deletion.');
          const result = await deletePocketTrackerBudget(proposal.targetId);
          if (!result.ok) throw new Error(result.error.message);
          removeBudgetLocal(proposal.targetId);
          addToast({
            id: `toast-${Date.now()}`,
            title: 'AI action applied',
            message: 'The selected budget was removed.',
          });
          break;
        }
      }

      updateFinanceChatMessage(activeSession.id, messageId, {
        proposal,
        proposalStatus: status,
      });
    } catch (error) {
      addToast({
        id: `toast-${Date.now()}`,
        title: 'AI action failed',
        message: error instanceof Error ? error.message : 'Unable to apply that Pocket Tracker action.',
      });
    } finally {
      setSubmittingMessageId(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    startNewFinanceChat(workspaceUser.id);
    setInputValue('');
    setIsHistoryOpen(false);
  };

  if (!hasHydratedAI) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-[32px] border border-[color:var(--app-border)] bg-[var(--app-panel)]">
        <div className="flex items-center gap-3 text-[color:var(--app-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-semibold uppercase tracking-[0.24em]">Loading AI workspace</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
            Pocket Tracker AI
          </p>
          <h1 className="mt-3 text-[clamp(38px,5vw,54px)] font-semibold tracking-[-0.05em] text-[color:var(--app-text-strong)]">
            Pocket insights, edits, and decisions.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--app-muted)]">
            {activeProviderLabel} is connected to your Pocket Tracker data and can analyze spending, suggest improvements, or prepare safe edits for approval. {activeProviderDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[var(--app-panel)] p-1">
            {(['gemini', 'mimo'] as AIProvider[]).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => setSelectedAIProvider(provider)}
                className={cn(
                  'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
                  selectedAIProvider === provider
                    ? 'bg-[var(--switcher-active-bg)] text-[var(--switcher-active-text)]'
                    : 'text-[color:var(--app-muted)] hover:bg-[var(--app-hover)]'
                )}
              >
                {getAIProviderLabel(provider)}
              </button>
            ))}
          </div>

          <div ref={historyRef} className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[var(--app-panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-muted)]"
            >
              <History className="h-4 w-4" />
              History
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[var(--app-panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-muted)]"
            >
              <RotateCcw className="h-4 w-4" />
              New Chat
            </button>

            {isHistoryOpen ? (
              <div className="absolute right-0 top-[calc(100%+12px)] z-20 w-[340px] rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-3 shadow-[0_18px_48px_rgba(15,23,42,0.24)]">
                {historySessions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[color:var(--app-muted)]">
                    No Pocket Tracker chats yet.
                  </div>
                ) : (
                  historySessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        setActiveFinanceChatSession(session.id);
                        setIsHistoryOpen(false);
                      }}
                      className={cn(
                        'mb-2 w-full rounded-[22px] border px-4 py-3 text-left transition',
                        session.id === activeSession?.id
                          ? 'border-[color:var(--app-accent)] bg-[var(--app-accent-soft)]'
                          : 'border-transparent bg-[var(--app-input-bg)] hover:border-[color:var(--app-border)]'
                      )}
                    >
                      <p className="truncate text-sm font-semibold text-[color:var(--app-text-strong)]">{session.title}</p>
                      <p className="mt-1 truncate text-xs text-[color:var(--app-muted)]">
                        {session.messages[session.messages.length - 1]?.content || 'Untitled conversation'}
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[32px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
          {messages.length === 0 ? (
            <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#2563eb,#22c55e)] text-white shadow-[0_24px_60px_rgba(37,99,235,0.25)]">
                <Sparkles className="h-10 w-10" />
              </div>
              <h2 className="mt-8 text-[40px] font-semibold tracking-[-0.05em] text-[color:var(--app-text-strong)]">
                What do you want to move forward financially?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--app-muted)]">
                Ask for a summary, a budget suggestion, or a safe edit to any transaction or budget. Pocket Tracker AI will analyze your data first, then prepare any changes for approval.
              </p>
              <div className="mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInputValue(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-5 py-3 text-sm font-medium text-[color:var(--app-text)] transition hover:-translate-y-0.5 hover:bg-[var(--app-hover)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <div key={message.id} className={cn('flex gap-4', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {message.role === 'assistant' ? (
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#22c55e)] text-white">
                      <Sparkles className="h-5 w-5" />
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      'max-w-[82%] rounded-[26px] px-5 py-4',
                      message.role === 'user'
                        ? 'bg-[var(--switcher-active-bg)] text-[var(--switcher-active-text)]'
                        : 'border border-[color:var(--app-border)] bg-[var(--app-input-bg)]'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--app-panel)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-muted)]">
                          <span className="h-2 w-2 rounded-full bg-[color:var(--app-accent)]" />
                          {message.assistantLabel || activeProviderLabel}
                        </div>
                        <p className="text-sm leading-7 text-[color:var(--app-text)]">{message.content}</p>
                        {message.proposal ? (
                          <PocketTrackerProposalCard
                            proposal={message.proposal}
                            status={message.proposalStatus}
                            isSubmitting={submittingMessageId === message.id}
                            transactions={transactions}
                            onApprove={(proposal) => handleApplyProposal(message.id, proposal, 'approved')}
                            onApproveEdited={(proposal) => handleApplyProposal(message.id, proposal, 'edited')}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm leading-7">{message.content}</p>
                    )}
                  </div>

                  {message.role === 'user' ? (
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <Wallet className="h-5 w-5" />
                    </div>
                  ) : null}
                </div>
              ))}

              {isLoading ? (
                <div className="flex gap-4">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#22c55e)] text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="rounded-[26px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-5 py-4 text-sm text-[color:var(--app-muted)]">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {activeProviderLabel} is reviewing your tracker data...
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <InsightCard title="Live context" value={`${transactions.length} transactions`} subtitle={`${budgets.length} budgets in Pocket Tracker`} />
          <InsightCard title="AI safety" value="Approval first" subtitle="Edits are proposed before anything changes in your data." />
          <InsightCard title="Best prompt" value="Ask for one action" subtitle="Example: update a transaction, create a budget, or summarize this month." />
        </div>
      </div>

      <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-3 shadow-[0_18px_54px_rgba(15,23,42,0.08)]">
        <div className="flex items-end gap-3">
          <div className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${activeProviderLabel} to analyze, edit, or plan something in Pocket Tracker...`}
            rows={1}
            className="min-h-[48px] max-h-36 flex-1 resize-none bg-transparent py-2 text-[15px] text-[color:var(--app-text-strong)] outline-none placeholder:text-[color:var(--app-muted)]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition',
              inputValue.trim() && !isLoading
                ? 'bg-[linear-gradient(135deg,#2563eb,#22c55e)] text-white shadow-[0_18px_36px_rgba(37,99,235,0.28)]'
                : 'cursor-not-allowed bg-[var(--app-hover)] text-[color:var(--app-muted)]'
            )}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
          Shared pocket tracker memory, polished analysis, and approval-based edits
        </p>
      </div>
    </div>
  );
}

function PocketTrackerProposalCard({
  proposal,
  status,
  isSubmitting,
  transactions,
  onApprove,
  onApproveEdited,
}: {
  proposal: PocketTrackerActionProposal;
  status?: 'pending' | 'approved' | 'edited' | null;
  isSubmitting: boolean;
  transactions: FinanceTransaction[];
  onApprove: (proposal: PocketTrackerActionProposal) => Promise<void> | void;
  onApproveEdited: (proposal: PocketTrackerActionProposal) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(proposal);

  useEffect(() => {
    setDraft(proposal);
  }, [proposal]);

  const isComplete = status === 'approved' || status === 'edited';
  const transactionTarget = draft.targetId ? transactions.find((item) => item.id === draft.targetId) : null;
  const isTransactionAction = draft.action.includes('transaction');
  const isDeleteAction = draft.action.startsWith('delete');

  return (
    <div className="mt-4 rounded-[24px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
            Pocket Tracker Action
          </p>
          <h4 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--app-text-strong)]">
            {friendlyActionLabel(draft.action)}
          </h4>
          {draft.rationale ? (
            <p className="mt-2 text-sm leading-6 text-[color:var(--app-muted)]">{draft.rationale}</p>
          ) : null}
        </div>
        <span className={cn(
          'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
          isComplete ? 'bg-emerald-500/12 text-emerald-300' : 'bg-amber-500/12 text-amber-300'
        )}>
          {isComplete ? 'Applied' : 'Review'}
        </span>
      </div>

      {isDeleteAction ? (
        <div className="mt-5 rounded-[20px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] p-4 text-sm text-[color:var(--app-text)]">
          {transactionTarget ? `Target: ${transactionTarget.title} • ${formatCurrencyBDT(transactionTarget.amount)} • ${transactionTarget.date}` : draft.summary || 'This action will remove the selected record.'}
        </div>
      ) : isTransactionAction ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <EditableField label="Type">
            <select
              value={draft.type || 'expense'}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as 'expense' | 'earning' }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            >
              <option value="expense">Expense</option>
              <option value="earning">Earning</option>
            </select>
          </EditableField>
          <EditableField label="Amount">
            <input
              value={draft.amount ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value) }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            />
          </EditableField>
          <EditableField label="Category">
            <input
              value={draft.category ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            />
          </EditableField>
          <EditableField label="Date">
            <input
              value={draft.date ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            />
          </EditableField>
          <EditableField label="Description">
            <input
              value={draft.title ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            />
          </EditableField>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <EditableField label="Category">
            <input
              value={draft.category ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            />
          </EditableField>
          <EditableField label="Limit">
            <input
              value={draft.limit ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, limit: Number(event.target.value) }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            />
          </EditableField>
          <EditableField label="Period">
            <input
              value={draft.periodLabel ?? 'March 2026'}
              onChange={(event) => setDraft((current) => ({ ...current, periodLabel: event.target.value }))}
              className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)]"
            />
          </EditableField>
        </div>
      )}

      {!isComplete ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onApprove(draft)}
            disabled={isSubmitting}
            className="rounded-full bg-[linear-gradient(135deg,#2563eb,#22c55e)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white"
          >
            {isSubmitting ? 'Applying...' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => onApproveEdited(draft)}
            disabled={isSubmitting}
            className="rounded-full border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text)]"
          >
            Save Edited Version
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EditableField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function InsightCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">{title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--app-muted)]">{subtitle}</p>
    </div>
  );
}

function getBudgetSpent(category: string, transactions: FinanceTransaction[]) {
  return transactions
    .filter((transaction) => transaction.type === 'expense' && transaction.category === category)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function friendlyActionLabel(action: PocketTrackerActionProposal['action']) {
  switch (action) {
    case 'create-transaction':
      return 'Create transaction';
    case 'update-transaction':
      return 'Update transaction';
    case 'delete-transaction':
      return 'Delete transaction';
    case 'create-budget':
      return 'Create budget';
    case 'update-budget':
      return 'Update budget';
    case 'delete-budget':
      return 'Delete budget';
    default:
      return 'Pocket Tracker action';
  }
}
