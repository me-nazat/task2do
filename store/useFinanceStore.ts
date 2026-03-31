import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  AIProvider,
  PocketTrackerChatMessage,
  PocketTrackerChatSession,
  createLocalChatId,
  DEFAULT_AI_PROVIDER,
  deriveChatSessionTitle,
} from '@/lib/ai/pocket-tracker-chat';
import {
  FINANCE_MONTH_LABEL,
  FINANCE_RANGE_LABEL,
  FinanceBudget,
  FinanceDateRange,
  FinanceReportConfig,
  FinanceReportFormat,
  FinanceReportType,
  FinanceSortDirection,
  FinanceToast,
  FinanceTransaction,
  FinanceTransactionType,
  FinanceViewFilter,
  GeneratedReport,
  INITIAL_REPORT_CONFIG,
  inferFinanceIcon,
} from '@/lib/finance/mock-data';

interface QuickAddDraft {
  type: FinanceTransactionType;
  amount: string;
  category: string;
  date: string;
  description: string;
}

interface FinanceState {
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
  hasLoadedWorkspace: boolean;
  isWorkspaceLoading: boolean;
  workspaceOwnerId: string | null;
  monthLabel: string;
  rangeLabel: string;
  filter: FinanceViewFilter;
  sortDirection: FinanceSortDirection;
  isQuickAddOpen: boolean;
  quickAddDraft: QuickAddDraft;
  editingTransactionId: string | null;
  reportConfig: FinanceReportConfig;
  generatedReports: GeneratedReport[];
  toasts: FinanceToast[];
  financeChatSessions: PocketTrackerChatSession[];
  activeFinanceChatSessionId: string | null;
  hasHydratedAI: boolean;
  selectedAIProvider: AIProvider;
  setWorkspaceLoading: (loading: boolean) => void;
  loadWorkspace: (ownerId: string, payload: { transactions: FinanceTransaction[]; budgets: FinanceBudget[] }) => void;
  setTransactions: (transactions: FinanceTransaction[]) => void;
  setBudgets: (budgets: FinanceBudget[]) => void;
  setMonthLabel: (label: string) => void;
  setRangeLabel: (label: string) => void;
  setFilter: (filter: FinanceViewFilter) => void;
  setSortDirection: (direction: FinanceSortDirection) => void;
  setQuickAddOpen: (open: boolean) => void;
  updateQuickAddDraft: (updates: Partial<QuickAddDraft>) => void;
  resetQuickAddDraft: () => void;
  appendTransactionLocal: (input: QuickAddDraft & { id?: string }) => FinanceTransaction | null;
  replaceTransactionLocal: (transactionId: string, updates: Partial<FinanceTransaction>) => void;
  removeTransactionLocal: (transactionId: string) => void;
  openEditTransaction: (transactionId: string) => void;
  closeEditTransaction: () => void;
  addBudgetLocal: (budget: FinanceBudget) => void;
  replaceBudgetLocal: (budgetId: string, updates: Partial<FinanceBudget>) => void;
  removeBudgetLocal: (budgetId: string) => void;
  setReportType: (reportType: FinanceReportType) => void;
  setReportFormat: (format: FinanceReportFormat) => void;
  setReportDateRange: (dateRange: FinanceDateRange) => void;
  addGeneratedReport: (report: GeneratedReport) => void;
  addToast: (toast: FinanceToast) => void;
  dismissToast: (toastId: string) => void;
  setFinanceChatHydrated: (hydrated: boolean) => void;
  setSelectedAIProvider: (provider: AIProvider) => void;
  ensureFinanceChatSession: (ownerId: string) => string;
  startNewFinanceChat: (ownerId: string) => string;
  setActiveFinanceChatSession: (id: string) => void;
  appendFinanceChatMessage: (sessionId: string, message: PocketTrackerChatMessage) => void;
  updateFinanceChatMessage: (sessionId: string, messageId: string, updates: Partial<PocketTrackerChatMessage>) => void;
}

const createDefaultDraft = (): QuickAddDraft => ({
  type: 'expense',
  amount: '',
  category: 'Food',
  date: '2026-03-31',
  description: '',
});

const sortFinanceChatSessions = (sessions: PocketTrackerChatSession[]) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const createFinanceChatSession = (ownerId: string): PocketTrackerChatSession => {
  const now = new Date().toISOString();

  return {
    id: createLocalChatId('finance-chat'),
    ownerId,
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      transactions: [],
      budgets: [],
      hasLoadedWorkspace: false,
      isWorkspaceLoading: false,
      workspaceOwnerId: null,
      monthLabel: FINANCE_MONTH_LABEL,
      rangeLabel: FINANCE_RANGE_LABEL,
      filter: 'all',
      sortDirection: 'desc',
      isQuickAddOpen: true,
      quickAddDraft: createDefaultDraft(),
      editingTransactionId: null,
      reportConfig: INITIAL_REPORT_CONFIG,
      generatedReports: [],
      toasts: [],
      financeChatSessions: [],
      activeFinanceChatSessionId: null,
      hasHydratedAI: false,
      selectedAIProvider: DEFAULT_AI_PROVIDER,
      setWorkspaceLoading: (isWorkspaceLoading) => set({ isWorkspaceLoading }),
      loadWorkspace: (workspaceOwnerId, payload) =>
        set({
          workspaceOwnerId,
          transactions: payload.transactions,
          budgets: payload.budgets,
          hasLoadedWorkspace: true,
          isWorkspaceLoading: false,
        }),
      setTransactions: (transactions) => set({ transactions }),
      setBudgets: (budgets) => set({ budgets }),
      setMonthLabel: (monthLabel) => set({ monthLabel }),
      setRangeLabel: (rangeLabel) => set({ rangeLabel }),
      setFilter: (filter) => set({ filter }),
      setSortDirection: (sortDirection) => set({ sortDirection }),
      setQuickAddOpen: (isQuickAddOpen) => set({ isQuickAddOpen }),
      updateQuickAddDraft: (updates) =>
        set((state) => ({ quickAddDraft: { ...state.quickAddDraft, ...updates } })),
      resetQuickAddDraft: () => set({ quickAddDraft: createDefaultDraft() }),
      appendTransactionLocal: (input) => {
        const amount = Number(input.amount);

        if (!Number.isFinite(amount) || amount <= 0 || !input.description.trim()) {
          return null;
        }

        const nextTransaction: FinanceTransaction = {
          id: input.id || `txn-${Date.now()}`,
          title: input.description.trim(),
          category: input.category,
          type: input.type,
          date: input.date,
          amount,
          icon: inferFinanceIcon(input.category),
        };

        set((state) => ({
          transactions: [nextTransaction, ...state.transactions],
          quickAddDraft: createDefaultDraft(),
        }));

        return nextTransaction;
      },
      replaceTransactionLocal: (transactionId, updates) =>
        set((state) => ({
          transactions: state.transactions.map((transaction) =>
            transaction.id === transactionId ? { ...transaction, ...updates } : transaction
          ),
        })),
      removeTransactionLocal: (transactionId) =>
        set((state) => ({
          transactions: state.transactions.filter((transaction) => transaction.id !== transactionId),
          editingTransactionId:
            state.editingTransactionId === transactionId ? null : state.editingTransactionId,
        })),
      openEditTransaction: (editingTransactionId) => set({ editingTransactionId }),
      closeEditTransaction: () => set({ editingTransactionId: null }),
      addBudgetLocal: (budget) =>
        set((state) => ({
          budgets: [...state.budgets, budget],
        })),
      replaceBudgetLocal: (budgetId, updates) =>
        set((state) => ({
          budgets: state.budgets.map((budget) =>
            budget.id === budgetId ? { ...budget, ...updates } : budget
          ),
        })),
      removeBudgetLocal: (budgetId) =>
        set((state) => ({
          budgets: state.budgets.filter((budget) => budget.id !== budgetId),
        })),
      setReportType: (reportType) =>
        set((state) => ({ reportConfig: { ...state.reportConfig, reportType } })),
      setReportFormat: (format) =>
        set((state) => ({ reportConfig: { ...state.reportConfig, format } })),
      setReportDateRange: (dateRange) =>
        set((state) => ({ reportConfig: { ...state.reportConfig, dateRange } })),
      addGeneratedReport: (report) =>
        set((state) => ({
          generatedReports: [report, ...state.generatedReports].slice(0, 8),
        })),
      addToast: (toast) =>
        set((state) => ({
          toasts: [...state.toasts, toast],
        })),
      dismissToast: (toastId) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== toastId),
        })),
      setFinanceChatHydrated: (hasHydratedAI) => set({ hasHydratedAI }),
      setSelectedAIProvider: (selectedAIProvider) => set({ selectedAIProvider }),
      ensureFinanceChatSession: (ownerId) => {
        const state = get();
        const activeSession = state.financeChatSessions.find((session) => session.id === state.activeFinanceChatSessionId);

        if (activeSession?.ownerId === ownerId) {
          return activeSession.id;
        }

        const existingSession = sortFinanceChatSessions(
          state.financeChatSessions.filter((session) => session.ownerId === ownerId)
        )[0];

        if (existingSession) {
          set({ activeFinanceChatSessionId: existingSession.id });
          return existingSession.id;
        }

        return get().startNewFinanceChat(ownerId);
      },
      startNewFinanceChat: (ownerId) => {
        const state = get();
        const activeSession = state.financeChatSessions.find((session) => session.id === state.activeFinanceChatSessionId);

        if (activeSession?.ownerId === ownerId && activeSession.messages.length === 0) {
          return activeSession.id;
        }

        const session = createFinanceChatSession(ownerId);

        set((currentState) => ({
          financeChatSessions: sortFinanceChatSessions([session, ...currentState.financeChatSessions]),
          activeFinanceChatSessionId: session.id,
        }));

        return session.id;
      },
      setActiveFinanceChatSession: (id) =>
        set((state) => {
          const exists = state.financeChatSessions.some((session) => session.id === id);
          return exists ? { activeFinanceChatSessionId: id } : state;
        }),
      appendFinanceChatMessage: (sessionId, message) =>
        set((state) => {
          const updatedSessions = state.financeChatSessions.map((session) => {
            if (session.id !== sessionId) {
              return session;
            }

            const messages = [...session.messages, message];

            return {
              ...session,
              messages,
              title: deriveChatSessionTitle(messages),
              updatedAt: message.timestamp,
            };
          });

          return {
            financeChatSessions: sortFinanceChatSessions(updatedSessions),
            activeFinanceChatSessionId: sessionId,
          };
        }),
      updateFinanceChatMessage: (sessionId, messageId, updates) =>
        set((state) => {
          const updatedAt = new Date().toISOString();
          const updatedSessions = state.financeChatSessions.map((session) => {
            if (session.id !== sessionId) {
              return session;
            }

            const messages = session.messages.map((message) =>
              message.id === messageId ? { ...message, ...updates } : message
            );

            return {
              ...session,
              messages,
              title: deriveChatSessionTitle(messages),
              updatedAt,
            };
          });

          return {
            financeChatSessions: sortFinanceChatSessions(updatedSessions),
          };
        }),
    }),
    {
      name: 'pocket-tracker-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        monthLabel: state.monthLabel,
        rangeLabel: state.rangeLabel,
        filter: state.filter,
        sortDirection: state.sortDirection,
        isQuickAddOpen: state.isQuickAddOpen,
        quickAddDraft: state.quickAddDraft,
        reportConfig: state.reportConfig,
        generatedReports: state.generatedReports,
        financeChatSessions: state.financeChatSessions,
        activeFinanceChatSessionId: state.activeFinanceChatSessionId,
        selectedAIProvider: state.selectedAIProvider,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setFinanceChatHydrated(true);
      },
    }
  )
);
