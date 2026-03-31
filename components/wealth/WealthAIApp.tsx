'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  BadgeAlert,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  EllipsisVertical,
  FileSpreadsheet,
  FileText,
  Forklift,
  HandCoins,
  House,
  Landmark,
  Minus,
  PencilLine,
  PiggyBank,
  Pill,
  Plus,
  ShieldPlus,
  Sparkles,
  TramFront,
  Trash2,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import { AppShell, EmptyPreview, PanelCard, StatCard } from '@/components/dual-dashboard/AppShell';
import { normalizeWealthRoute, WEALTH_NAV_ITEMS } from '@/lib/navigation';
import {
  CATEGORY_COLORS,
  FinanceBudget,
  FinanceReportFormat,
  FinanceReportType,
  FinanceTransaction,
  FinanceViewFilter,
  FINANCE_INTELLIGENCE_FEED,
  FINANCE_MONTH_LABEL,
  POCKET_TRACKER_BRAND_NAME,
  POCKET_TRACKER_TAGLINE,
} from '@/lib/finance/mock-data';
import {
  buildExcelLikeDocument,
  calculateFinanceSummary,
  createGeneratedReport,
  downloadTextFile,
  formatCurrencyBDT,
  formatReportDate,
  getSignedAmountValue,
  getTransactionAmount,
} from '@/lib/finance/reporting';
import { cn } from '@/lib/utils';
import {
  createPocketTrackerBudget,
  createPocketTrackerTransaction,
  deletePocketTrackerTransaction,
  updatePocketTrackerTransaction,
} from '@/actions/pocket-tracker';
import { DEMO_TASK2DO_USER } from '@/lib/demo/task2do-data';
import { PocketTrackerAIChat } from '@/components/wealth/PocketTrackerAIChat';
import { PocketTrackerBootstrap } from '@/components/wealth/PocketTrackerBootstrap';
import { useStore } from '@/store/useStore';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useShellStore } from '@/store/useShellStore';

export function WealthAIApp({ slug }: { slug?: string[] }) {
  const activeRoute = normalizeWealthRoute(slug);
  const wealthTheme = useShellStore((state) => state.wealthTheme);
  const router = useRouter();
  const user = useStore((state) => state.user);
  const transactions = useFinanceStore((state) => state.transactions);
  const budgets = useFinanceStore((state) => state.budgets);
  const hasLoadedWorkspace = useFinanceStore((state) => state.hasLoadedWorkspace);
  const isWorkspaceLoading = useFinanceStore((state) => state.isWorkspaceLoading);
  const monthLabel = useFinanceStore((state) => state.monthLabel);
  const rangeLabel = useFinanceStore((state) => state.rangeLabel);
  const filter = useFinanceStore((state) => state.filter);
  const sortDirection = useFinanceStore((state) => state.sortDirection);
  const isQuickAddOpen = useFinanceStore((state) => state.isQuickAddOpen);
  const quickAddDraft = useFinanceStore((state) => state.quickAddDraft);
  const editingTransactionId = useFinanceStore((state) => state.editingTransactionId);
  const reportConfig = useFinanceStore((state) => state.reportConfig);
  const generatedReports = useFinanceStore((state) => state.generatedReports);
  const toasts = useFinanceStore((state) => state.toasts);
  const setFilter = useFinanceStore((state) => state.setFilter);
  const setSortDirection = useFinanceStore((state) => state.setSortDirection);
  const setQuickAddOpen = useFinanceStore((state) => state.setQuickAddOpen);
  const updateQuickAddDraft = useFinanceStore((state) => state.updateQuickAddDraft);
  const appendTransactionLocal = useFinanceStore((state) => state.appendTransactionLocal);
  const openEditTransaction = useFinanceStore((state) => state.openEditTransaction);
  const closeEditTransaction = useFinanceStore((state) => state.closeEditTransaction);
  const replaceTransactionLocal = useFinanceStore((state) => state.replaceTransactionLocal);
  const deleteTransactionLocal = useFinanceStore((state) => state.removeTransactionLocal);
  const addBudgetLocal = useFinanceStore((state) => state.addBudgetLocal);
  const setReportType = useFinanceStore((state) => state.setReportType);
  const setReportFormat = useFinanceStore((state) => state.setReportFormat);
  const addGeneratedReport = useFinanceStore((state) => state.addGeneratedReport);
  const addToast = useFinanceStore((state) => state.addToast);
  const dismissToast = useFinanceStore((state) => state.dismissToast);

  const [menuTransactionId, setMenuTransactionId] = useState<string | null>(null);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState('Food');
  const [budgetLimit, setBudgetLimit] = useState('');
  const workspaceUser = user ?? DEMO_TASK2DO_USER;

  const financeSummary = useMemo(() => calculateFinanceSummary(transactions), [transactions]);
  const filteredTransactions = useMemo(() => {
    const nextTransactions = transactions.filter((transaction) => {
      if (filter === 'expenses') {
        return transaction.type === 'expense';
      }

      if (filter === 'earnings') {
        return transaction.type === 'earning';
      }

      return true;
    });

    return [...nextTransactions].sort((left, right) => {
      const comparison = new Date(left.date).getTime() - new Date(right.date).getTime();
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [filter, sortDirection, transactions]);

  const latestReport = generatedReports[0] ?? null;
  const editingTransaction = transactions.find((transaction) => transaction.id === editingTransactionId) ?? null;

  const largestExpense = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.type === 'expense')
      .sort((left, right) => right.amount - left.amount)[0];
  }, [transactions]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    transactions
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount);
      });

    const orderedCategories = [
      'Food',
      'Shopping',
      'Other',
      'Housing',
      'Bills',
      'Health',
      'Entertainment',
      'Education',
      'Transport',
    ];

    return orderedCategories.map((category) => ({
      category,
      total: totals.get(category) ?? 0,
      color: CATEGORY_COLORS[category],
    }));
  }, [transactions]);

  const barSeries = useMemo(() => {
    const buckets = new Map<number, { expenses: number; earnings: number }>();

    for (let day = 1; day <= 31; day += 1) {
      buckets.set(day, { expenses: 0, earnings: 0 });
    }

    transactions.forEach((transaction) => {
      const day = new Date(`${transaction.date}T12:00:00`).getDate();
      const bucket = buckets.get(day);
      if (!bucket) return;

      if (transaction.type === 'expense') {
        bucket.expenses += transaction.amount;
      } else {
        bucket.earnings += transaction.amount;
      }
    });

    return Array.from(buckets.entries()).map(([day, values]) => ({
      day,
      ...values,
    }));
  }, [transactions]);

  useEffect(() => {
    if (!toasts.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      dismissToast(toasts[0].id);
    }, 3600);

    return () => window.clearTimeout(timeout);
  }, [dismissToast, toasts]);

  const handleQuickAddSave = async () => {
    const amount = Number(quickAddDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !quickAddDraft.description.trim()) {
      return;
    }

    const result = await createPocketTrackerTransaction({
      userId: workspaceUser.id,
      email: workspaceUser.email,
      name: workspaceUser.displayName,
      title: quickAddDraft.description.trim(),
      category: quickAddDraft.category,
      type: quickAddDraft.type,
      date: quickAddDraft.date,
      amount,
    });

    if (!result.ok) {
      addToast({
        id: `toast-${Date.now()}`,
        title: 'Save failed',
        message: result.error.message,
      });
      return;
    }

    const nextTransaction = appendTransactionLocal({
      ...quickAddDraft,
      amount: String(amount),
      id: result.data.id,
    });

    addToast({
      id: `toast-${Date.now()}`,
      title: 'Transaction saved',
      message: `${nextTransaction?.title || result.data.title} was added to ${monthLabel}.`,
    });
  };

  const handleExportTransactions = () => {
    const rows = filteredTransactions
      .map((transaction) => `${transaction.date},${transaction.type},${transaction.category},${transaction.title},${getSignedAmountValue(transaction.amount, transaction.type)}`)
      .join('\n');

    downloadTextFile(
      'pocket_tracker_transactions_march_2026.csv',
      `Date,Type,Category,Description,Amount\n${rows}`,
      'text/csv;charset=utf-8'
    );
    addToast({
      id: `toast-${Date.now()}`,
      title: 'Export ready',
      message: 'pocket_tracker_transactions_march_2026.csv was created.',
    });
  };

  const handleGenerateReport = () => {
    const report = createGeneratedReport(reportConfig, filteredTransactions);
    addGeneratedReport(report);
    addToast({
      id: `toast-${Date.now()}`,
      title: 'Report generated',
      message: `${report.fileName} is ready.`,
    });

    if (reportConfig.format === 'excel' || reportConfig.format === 'both') {
      const spreadsheetName = report.fileName.replace(/\.pdf$/, '.xls');
      downloadTextFile(spreadsheetName, buildExcelLikeDocument(report), 'application/vnd.ms-excel');
    }

    if (reportConfig.format === 'pdf' || reportConfig.format === 'both') {
      router.push('/pocket-tracker/reports/preview');
    }
  };

  const content = (() => {
    switch (activeRoute) {
      case 'dashboard':
        return (
          <DashboardPage
            summary={financeSummary}
            monthLabel={monthLabel}
            rangeLabel={rangeLabel}
            barSeries={barSeries}
            categoryTotals={categoryTotals}
            transactions={filteredTransactions.slice(0, 6)}
          />
        );
      case 'transactions':
        return (
          <TransactionsPage
            summary={financeSummary}
            monthLabel={monthLabel}
            rangeLabel={rangeLabel}
            filter={filter}
            filteredTransactions={filteredTransactions}
            quickAddDraft={quickAddDraft}
            isQuickAddOpen={isQuickAddOpen}
            editingTransaction={editingTransaction}
            menuTransactionId={menuTransactionId}
            largestExpense={largestExpense}
            onSetQuickAddOpen={setQuickAddOpen}
            onUpdateQuickAddDraft={updateQuickAddDraft}
            onSaveQuickAdd={handleQuickAddSave}
            onExport={handleExportTransactions}
            onSetFilter={setFilter}
            onToggleSort={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
            onOpenMenu={setMenuTransactionId}
            onCloseMenu={() => setMenuTransactionId(null)}
            onOpenEdit={openEditTransaction}
            onCloseEdit={closeEditTransaction}
            onUpdateTransaction={async (transactionId, updates) => {
              const result = await updatePocketTrackerTransaction({
                userId: workspaceUser.id,
                transactionId,
                title: updates.title,
                category: updates.category,
                type: updates.type,
                date: updates.date,
                amount: updates.amount,
              });

              if (!result.ok) {
                addToast({
                  id: `toast-${Date.now()}`,
                  title: 'Update failed',
                  message: result.error.message,
                });
                return;
              }

              replaceTransactionLocal(transactionId, result.data);
              addToast({
                id: `toast-${Date.now()}`,
                title: 'Transaction updated',
                message: `${result.data.title} was saved.`,
              });
            }}
            onDeleteTransaction={async (transactionId) => {
              const result = await deletePocketTrackerTransaction(transactionId);
              if (!result.ok) {
                addToast({
                  id: `toast-${Date.now()}`,
                  title: 'Delete failed',
                  message: result.error.message,
                });
                return;
              }

              deleteTransactionLocal(transactionId);
              addToast({
                id: `toast-${Date.now()}`,
                title: 'Transaction deleted',
                message: 'The record was removed from Pocket Tracker.',
              });
            }}
          />
        );
      case 'budgets':
        return (
          <BudgetsPage
            budgets={budgets}
            budgetModalOpen={budgetModalOpen}
            budgetCategory={budgetCategory}
            budgetLimit={budgetLimit}
            onOpenBudgetModal={() => setBudgetModalOpen(true)}
            onCloseBudgetModal={() => setBudgetModalOpen(false)}
            onSetBudgetCategory={setBudgetCategory}
            onSetBudgetLimit={setBudgetLimit}
            onSubmitBudget={async (event) => {
              event.preventDefault();
              const limit = Number(budgetLimit);
              if (!Number.isFinite(limit) || limit <= 0) {
                return;
              }

              const result = await createPocketTrackerBudget({
                userId: workspaceUser.id,
                email: workspaceUser.email,
                name: workspaceUser.displayName,
                category: budgetCategory,
                limit,
                periodLabel: FINANCE_MONTH_LABEL,
              });

              if (!result.ok) {
                addToast({
                  id: `toast-${Date.now()}`,
                  title: 'Budget failed',
                  message: result.error.message,
                });
                return;
              }

              addBudgetLocal({
                ...result.data,
                spent: categoryTotals.find((item) => item.category === result.data.category)?.total ?? 0,
              });
              addToast({
                id: `toast-${Date.now()}`,
                title: 'Budget added',
                message: `${result.data.category} budget is now being tracked.`,
              });
              setBudgetLimit('');
              setBudgetModalOpen(false);
            }}
          />
        );
      case 'reports':
        return (
          <ReportsPage
            reportConfig={reportConfig}
            latestReport={latestReport}
            onSetReportType={setReportType}
            onSetReportFormat={setReportFormat}
            onGenerateReport={handleGenerateReport}
          />
        );
      case 'ai-chat':
        return <PocketTrackerAIChat />;
      default:
        return <PocketTrackerPreviewPage route={activeRoute} summary={financeSummary} />;
    }
  })();

  return (
    <>
      <PocketTrackerBootstrap />
      <AppShell
      product="pocket-tracker"
      theme={wealthTheme}
      activeKey={activeRoute}
      navItems={WEALTH_NAV_ITEMS}
      logo={
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
            {POCKET_TRACKER_BRAND_NAME}
          </h1>
        </div>
      }
      subtitle={POCKET_TRACKER_TAGLINE}
      profile={{
        name: workspaceUser.displayName ?? 'Nazat',
        subtitle: workspaceUser.email ?? 'nazatal619@gmail.com',
      }}
    >
      {!hasLoadedWorkspace && isWorkspaceLoading ? <PocketTrackerLoadingState /> : content}
      <ToastViewport toasts={toasts} />
    </AppShell>
    </>
  );
}

function DashboardPage({
  summary,
  monthLabel,
  rangeLabel,
  barSeries,
  categoryTotals,
  transactions,
}: {
  summary: ReturnType<typeof calculateFinanceSummary>;
  monthLabel: string;
  rangeLabel: string;
  barSeries: Array<{ day: number; expenses: number; earnings: number }>;
  categoryTotals: Array<{ category: string; total: number; color: string }>;
  transactions: FinanceTransaction[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(38px,5vw,54px)] font-semibold tracking-[-0.05em] text-[color:var(--app-text-strong)]">
            Good evening, Nazat <span className="align-middle">👋</span>
          </h1>
          <p className="mt-3 text-base text-[color:var(--app-muted)]">
            Here&apos;s what&apos;s happening with your money.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SelectPill label={monthLabel} icon={<CalendarDays className="h-4 w-4" />} />
          <SelectPill label={rangeLabel} icon={<Forklift className="h-4 w-4" />} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <WealthStatCard label="Total Balance" value={formatCurrencyBDT(summary.totalBalance)} delta="+0.0%" tone="positive" tint="blue" />
        <WealthStatCard label="Monthly Earnings" value={formatCurrencyBDT(summary.monthlyEarnings)} delta="+0.0%" tone="positive" tint="green" />
        <WealthStatCard label="Monthly Expenses" value={formatCurrencyBDT(summary.monthlyExpenses)} delta="+218.6%" tone="positive" tint="peach" />
        <WealthStatCard label="Net Savings" value={formatCurrencyBDT(summary.netSavings)} delta="-5.0%" tone="negative" tint="violet" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.9fr_0.9fr]">
        <SpendingTrendCard barSeries={barSeries} />
        <div className="space-y-4">
          <PanelCard className="p-6">
            <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">Budget Alerts</h2>
            <div className="mt-10 flex min-h-[172px] flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[color:var(--app-border)] text-[color:var(--app-muted)]">
                <BadgeAlert className="h-5 w-5" />
              </div>
              <p className="mt-4 max-w-[220px] text-sm leading-6 text-[color:var(--app-muted)]">
                No budget alerts. Set budgets to track spending.
              </p>
            </div>
          </PanelCard>
          <TopCategoriesCard categoryTotals={categoryTotals} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr_0.95fr]">
        <RecentTransactionsCard transactions={transactions} />
        <IntelligenceHubCard />
      </div>
    </div>
  );
}

function TransactionsPage({
  summary,
  monthLabel,
  rangeLabel,
  filter,
  filteredTransactions,
  quickAddDraft,
  isQuickAddOpen,
  editingTransaction,
  menuTransactionId,
  largestExpense,
  onSetQuickAddOpen,
  onUpdateQuickAddDraft,
  onSaveQuickAdd,
  onExport,
  onSetFilter,
  onToggleSort,
  onOpenMenu,
  onCloseMenu,
  onOpenEdit,
  onCloseEdit,
  onUpdateTransaction,
  onDeleteTransaction,
}: {
  summary: ReturnType<typeof calculateFinanceSummary>;
  monthLabel: string;
  rangeLabel: string;
  filter: FinanceViewFilter;
  filteredTransactions: FinanceTransaction[];
  quickAddDraft: { type: 'expense' | 'earning'; amount: string; category: string; date: string; description: string };
  isQuickAddOpen: boolean;
  editingTransaction: FinanceTransaction | null;
  menuTransactionId: string | null;
  largestExpense?: FinanceTransaction;
  onSetQuickAddOpen: (open: boolean) => void;
  onUpdateQuickAddDraft: (updates: Partial<{ type: 'expense' | 'earning'; amount: string; category: string; date: string; description: string }>) => void;
  onSaveQuickAdd: () => void;
  onExport: () => void;
  onSetFilter: (filter: FinanceViewFilter) => void;
  onToggleSort: () => void;
  onOpenMenu: (transactionId: string | null) => void;
  onCloseMenu: () => void;
  onOpenEdit: (transactionId: string) => void;
  onCloseEdit: () => void;
  onUpdateTransaction: (transactionId: string, updates: Partial<FinanceTransaction>) => void | Promise<void>;
  onDeleteTransaction: (transactionId: string) => void | Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(38px,5vw,54px)] font-semibold tracking-[-0.05em] text-[color:var(--app-text-strong)]">Transactions</h1>
          <p className="mt-3 text-base text-[color:var(--app-muted)]">
            View and manage your expenses and earnings.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onSetQuickAddOpen(!isQuickAddOpen)}
            className={cn(
              'inline-flex items-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold shadow-[0_18px_36px_rgba(37,99,235,0.2)] transition',
              isQuickAddOpen
                ? 'bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] text-white'
                : 'border border-[color:var(--app-border)] bg-[var(--app-panel)] text-[color:var(--app-text-strong)] hover:bg-[var(--app-hover)]'
            )}
          >
            {isQuickAddOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isQuickAddOpen ? 'Cancel' : 'Quick Add'}
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/16"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.6fr]">
        <WealthStatCard label="Earnings" value={formatCurrencyBDT(summary.monthlyEarnings)} tint="green" />
        <WealthStatCard label="Expenses" value={formatCurrencyBDT(summary.monthlyExpenses)} tint="peach" />
        <WealthStatCard label="Net" value={formatCurrencyBDT(summary.netSavings, { signed: true })} tint="blue" />
        <PanelCard className="flex items-center justify-between gap-4 p-5">
          <MetricBlurb title="Largest Expense" value={`${formatCurrencyBDT(largestExpense?.amount ?? 0)} (${largestExpense?.title ?? 'Muskan'})`} accent="violet" />
          <div className="h-12 w-px bg-[color:var(--app-border)]" />
          <MetricBlurb title="Frequent Category" value="Food (10x)" accent="pink" />
        </PanelCard>
      </div>

      {isQuickAddOpen ? (
        <PanelCard className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[color:var(--app-accent)]">
              <Plus className="h-4 w-4" />
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
              Quick Add Transaction
            </h2>
          </div>
          <div className="grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr_1.1fr_auto]">
            <InlineSelect
              value={quickAddDraft.type}
              options={[
                { label: 'Expense', value: 'expense' },
                { label: 'Earning', value: 'earning' },
              ]}
              onChange={(value) => onUpdateQuickAddDraft({ type: value as 'expense' | 'earning' })}
            />
            <InlineInput
              value={quickAddDraft.amount}
              placeholder="Amount"
              onChange={(value) => onUpdateQuickAddDraft({ amount: value })}
            />
            <InlineSelect
              value={quickAddDraft.category}
              options={CATEGORY_OPTIONS.map((option) => ({ label: option, value: option }))}
              onChange={(value) => onUpdateQuickAddDraft({ category: value })}
            />
            <InlineInput
              value={toDisplayDate(quickAddDraft.date)}
              placeholder="31/03/2026"
              onChange={(value) => onUpdateQuickAddDraft({ date: fromDisplayDate(value) })}
            />
            <InlineInput
              value={quickAddDraft.description}
              placeholder="Description"
              onChange={(value) => onUpdateQuickAddDraft({ description: value })}
            />
            <button
              type="button"
              onClick={onSaveQuickAdd}
              className="rounded-[18px] bg-[linear-gradient(135deg,#7fb5ff,#94bfff)] px-7 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
            >
              Save
            </button>
          </div>
        </PanelCard>
      ) : null}

      <PanelCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SelectPill label={monthLabel} icon={<CalendarDays className="h-4 w-4" />} />
          <SelectPill label={rangeLabel} icon={<Forklift className="h-4 w-4" />} />
          <div className="inline-flex items-center gap-1 rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] p-1">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSetFilter(option.value)}
                className={cn(
                  'rounded-[14px] px-4 py-2 text-sm font-medium transition',
                  filter === option.value
                    ? 'bg-[var(--switcher-active-bg)] text-[var(--switcher-active-text)]'
                    : 'text-[color:var(--app-muted)] hover:bg-[var(--app-hover)]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </PanelCard>

      <PanelCard className="overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_0.9fr_0.7fr_44px] border-b border-[color:var(--app-border)] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
          <span>Transaction</span>
          <span>Category</span>
          <button type="button" onClick={onToggleSort} className="inline-flex items-center gap-2 text-left">
            Date
            <Minus className="h-3.5 w-3.5 rotate-90 text-[color:var(--app-accent)]" />
          </button>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <div className="divide-y divide-[color:var(--app-border)]">
          {filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="relative grid grid-cols-[1.5fr_1fr_0.9fr_0.7fr_44px] items-center gap-4 px-6 py-5">
              <div className="flex items-center gap-4">
                <TransactionIcon icon={transaction.icon} />
                <span className="text-base font-semibold text-[color:var(--app-text-strong)]">{transaction.title}</span>
              </div>
              <span className="inline-flex w-fit rounded-full bg-[var(--app-hover)] px-3 py-1 text-sm text-[color:var(--app-text)]">
                {transaction.category}
              </span>
              <span className="text-sm text-[color:var(--app-muted)]">{formatReportDate(transaction.date)}</span>
              <span
                className={cn(
                  'text-right text-base font-semibold',
                  transaction.type === 'expense' ? 'text-rose-400' : 'text-emerald-400'
                )}
              >
                {formatCurrencyBDT(getTransactionAmount(transaction), { signed: true })}
              </span>
              <div className="relative flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenMenu(menuTransactionId === transaction.id ? null : transaction.id)}
                  className="rounded-full p-2 text-[color:var(--app-muted)] transition hover:bg-[var(--app-hover)]"
                  aria-label={`Open actions for ${transaction.title}`}
                >
                  <EllipsisVertical className="h-4 w-4" />
                </button>
                {menuTransactionId === transaction.id ? (
                  <div className="absolute right-0 top-11 z-20 min-w-[172px] rounded-[20px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenEdit(transaction.id);
                        onCloseMenu();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-[color:var(--app-text)] transition hover:bg-[var(--app-hover)]"
                    >
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteTransaction(transaction.id);
                        onCloseMenu();
                      }}
                      className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      <TransactionEditModal
        transaction={editingTransaction}
        onClose={onCloseEdit}
        onSave={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          if (!editingTransaction) return;

          onUpdateTransaction(editingTransaction.id, {
            type: formData.get('type') as 'expense' | 'earning',
            amount: Number(formData.get('amount')),
            category: String(formData.get('category')),
            date: fromDisplayDate(String(formData.get('date'))),
            title: String(formData.get('description')),
          });
          onCloseEdit();
        }}
      />
    </div>
  );
}

function BudgetsPage({
  budgets,
  budgetModalOpen,
  budgetCategory,
  budgetLimit,
  onOpenBudgetModal,
  onCloseBudgetModal,
  onSetBudgetCategory,
  onSetBudgetLimit,
  onSubmitBudget,
}: {
  budgets: FinanceBudget[];
  budgetModalOpen: boolean;
  budgetCategory: string;
  budgetLimit: string;
  onOpenBudgetModal: () => void;
  onCloseBudgetModal: () => void;
  onSetBudgetCategory: (value: string) => void;
  onSetBudgetLimit: (value: string) => void;
  onSubmitBudget: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(38px,5vw,54px)] font-semibold tracking-[-0.05em] text-[color:var(--app-text-strong)]">
            Monthly Budget Planner
          </h1>
          <p className="mt-3 text-base text-[color:var(--app-muted)]">
            Set spending limits for March 2026.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenBudgetModal}
          className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#2563eb,#4f46e5)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.24)]"
        >
          <Plus className="h-4 w-4" />
          Add Budget
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <WealthStatCard label="Total Budget" value={formatCurrencyBDT(totalBudget)} tint="blue" />
        <WealthStatCard label="Total Spent" value={formatCurrencyBDT(totalSpent)} tint="peach" />
        <WealthStatCard label="Remaining" value={formatCurrencyBDT(totalBudget - totalSpent)} tint="green" />
      </div>

      {budgets.length === 0 ? (
        <PanelCard className="flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <PiggyBank className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-[34px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
            No budgets set.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-[color:var(--app-muted)]">
            Click &quot;Add Budget&quot; to get started.
          </p>
        </PanelCard>
      ) : (
        <PanelCard className="p-6">
          <div className="space-y-4">
            {budgets.map((budget) => (
              <div key={budget.id} className="rounded-[24px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--app-text-strong)]">{budget.category}</p>
                    <p className="mt-2 text-sm text-[color:var(--app-muted)]">
                      Limit {formatCurrencyBDT(budget.limit)} • Spent {formatCurrencyBDT(budget.spent)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-sm font-semibold text-[color:var(--app-accent)]">
                    {formatCurrencyBDT(budget.limit - budget.spent)} left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )}

      <FinanceModal
        isOpen={budgetModalOpen}
        title="Add Budget"
        onClose={onCloseBudgetModal}
      >
        <form className="space-y-4" onSubmit={onSubmitBudget}>
          <ModalField label="Category">
            <InlineSelect
              value={budgetCategory}
              options={CATEGORY_OPTIONS.map((option) => ({ label: option, value: option }))}
              onChange={onSetBudgetCategory}
            />
          </ModalField>
          <ModalField label="Monthly Limit">
            <InlineInput value={budgetLimit} placeholder="2500" onChange={onSetBudgetLimit} />
          </ModalField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCloseBudgetModal} className="flex-1 rounded-[18px] bg-[var(--app-hover)] px-4 py-3 text-sm font-semibold text-[color:var(--app-text)]">
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-[18px] bg-[linear-gradient(135deg,#2563eb,#4f46e5)] px-4 py-3 text-sm font-semibold text-white">
              Save Budget
            </button>
          </div>
        </form>
      </FinanceModal>
    </div>
  );
}

function ReportsPage({
  reportConfig,
  latestReport,
  onSetReportType,
  onSetReportFormat,
  onGenerateReport,
}: {
  reportConfig: { reportType: FinanceReportType; format: FinanceReportFormat };
  latestReport: ReturnType<typeof useFinanceStore.getState>['generatedReports'][number] | null;
  onSetReportType: (type: FinanceReportType) => void;
  onSetReportFormat: (format: FinanceReportFormat) => void;
  onGenerateReport: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[clamp(38px,5vw,54px)] font-semibold tracking-[-0.05em] text-[color:var(--app-text-strong)]">
          Reports &amp; Exports
        </h1>
        <p className="mt-3 text-base text-[color:var(--app-muted)]">
          Generate detailed financial reports. Select parameters below.
        </p>
      </div>

      <PanelCard className="p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <Check className="h-4 w-4" />
          </div>
          <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
            Report Configuration
          </h2>
        </div>

        <div className="mt-8 space-y-8">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
              Report Type
            </p>
            <div className="grid gap-4 xl:grid-cols-3">
              {REPORT_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSetReportType(option.value)}
                  className={cn(
                    'rounded-[26px] border p-5 text-left transition',
                    reportConfig.reportType === option.value
                      ? 'border-[color:var(--app-accent)] bg-[var(--app-accent-soft)]'
                      : 'border-[color:var(--app-border)] bg-[var(--app-input-bg)] hover:bg-[var(--app-hover)]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {option.value === 'full-summary' ? <FileText className="h-5 w-5 text-[color:var(--app-accent)]" /> : option.value === 'budget-breakdown' ? <Wallet className="h-5 w-5 text-[color:var(--app-accent)]" /> : <FileSpreadsheet className="h-5 w-5 text-[color:var(--app-accent)]" />}
                    <p className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--app-text-strong)]">{option.label}</p>
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--app-muted)]">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                Date Range
              </p>
              <SelectPill label="Last 30 Days" icon={<CalendarDays className="h-4 w-4" />} />
            </div>
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                Format
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {REPORT_FORMATS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onSetReportFormat(option.value)}
                    className={cn(
                      'rounded-[18px] border px-4 py-3 text-sm font-semibold transition',
                      reportConfig.format === option.value
                        ? 'border-[color:var(--app-accent)] bg-[var(--app-accent-soft)] text-[color:var(--app-text-strong)]'
                        : 'border-[color:var(--app-border)] bg-[var(--app-input-bg)] text-[color:var(--app-muted)] hover:bg-[var(--app-hover)]'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--app-border)] pt-6">
          <div className="text-sm text-[color:var(--app-muted)]">
            {latestReport ? `Latest file: ${latestReport.fileName}` : 'Generate a report to create a downloadable file.'}
          </div>
          <button
            type="button"
            onClick={onGenerateReport}
            className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#7fb5ff,#94bfff)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
          >
            <Download className="h-4 w-4" />
            Generate Report
          </button>
        </div>
      </PanelCard>
    </div>
  );
}

function PocketTrackerPreviewPage({
  route,
  summary,
}: {
  route: Exclude<ReturnType<typeof normalizeWealthRoute>, 'dashboard' | 'transactions' | 'budgets' | 'reports' | 'ai-chat'>;
  summary: ReturnType<typeof calculateFinanceSummary>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
          Pocket Tracker Preview
        </p>
        <h1 className="mt-3 text-[clamp(38px,5vw,54px)] font-semibold tracking-[-0.05em] text-[color:var(--app-text-strong)]">
          {POCKET_TRACKER_PREVIEW_COPY[route].title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--app-muted)]">
          {POCKET_TRACKER_PREVIEW_COPY[route].description}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <WealthStatCard label="Earnings" value={formatCurrencyBDT(summary.monthlyEarnings)} tint="green" />
        <WealthStatCard label="Expenses" value={formatCurrencyBDT(summary.monthlyExpenses)} tint="peach" />
        <WealthStatCard label="Net" value={formatCurrencyBDT(summary.netSavings, { signed: true })} tint="blue" />
      </div>

      <EmptyPreview
        eyebrow="Preview State"
        title={`${POCKET_TRACKER_PREVIEW_COPY[route].title} is route-complete.`}
        description="This destination intentionally ships as a polished preview in this pass so the sidebar remains fully navigable without inventing non-recorded workflows."
      />
    </div>
  );
}

function WealthStatCard({
  label,
  value,
  delta,
  tone = 'neutral',
  tint,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: 'positive' | 'negative' | 'neutral';
  tint: 'green' | 'peach' | 'blue' | 'violet';
}) {
  const tintClass =
    tint === 'green'
      ? 'bg-[linear-gradient(180deg,rgba(16,185,129,0.12),transparent)]'
      : tint === 'peach'
        ? 'bg-[linear-gradient(180deg,rgba(249,115,22,0.12),transparent)]'
        : tint === 'violet'
          ? 'bg-[linear-gradient(180deg,rgba(139,92,246,0.12),transparent)]'
          : 'bg-[linear-gradient(180deg,rgba(37,99,235,0.12),transparent)]';

  return (
    <StatCard
      label={label}
      value={value}
      delta={delta}
      deltaTone={tone}
      className={cn('p-5', tintClass)}
    />
  );
}

function SpendingTrendCard({
  barSeries,
}: {
  barSeries: Array<{ day: number; expenses: number; earnings: number }>;
}) {
  const maxValue = Math.max(...barSeries.map((entry) => Math.max(entry.expenses, entry.earnings)), 1);

  return (
    <PanelCard className="p-6">
      <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
        Spending Trends
      </h2>
      <p className="mt-2 text-sm text-[color:var(--app-muted)]">Income vs Expenses over time</p>
      <div className="mt-6">
        <div className="mb-4 flex items-center justify-center gap-6 text-sm text-[color:var(--app-muted)]">
          <LegendSwatch color="#4f8cff" label="Expenses" />
          <LegendSwatch color="#62d7a2" label="Earnings" />
        </div>
        <div className="grid h-[320px] grid-cols-11 items-end gap-2 border-t border-[color:var(--app-border)] pt-6">
          {barSeries
            .filter((entry) => [1, 3, 5, 6, 8, 10, 11, 13, 14, 17, 19, 21, 24, 28].includes(entry.day))
            .map((entry) => (
              <div key={entry.day} className="flex flex-col items-center gap-3">
                <div className="flex h-[240px] items-end gap-1">
                  <span
                    className="w-4 rounded-full bg-[#4f8cff]"
                    style={{ height: `${Math.max(6, (entry.expenses / maxValue) * 220)}px` }}
                  />
                  <span
                    className="w-4 rounded-full bg-[#62d7a2]"
                    style={{ height: `${Math.max(6, (entry.earnings / maxValue) * 220)}px` }}
                  />
                </div>
                <span className="text-xs text-[color:var(--app-muted)]">Mar {entry.day}</span>
              </div>
            ))}
        </div>
      </div>
    </PanelCard>
  );
}

function TopCategoriesCard({
  categoryTotals,
}: {
  categoryTotals: Array<{ category: string; total: number; color: string }>;
}) {
  const total = categoryTotals.reduce((sum, item) => sum + item.total, 0) || 1;
  const segments = categoryTotals
    .filter((item) => item.total > 0)
    .reduce<Array<{ category: string; total: number; color: string; start: number; end: number }>>((accumulator, item) => {
      const previousEnd = accumulator[accumulator.length - 1]?.end ?? 0;
      const nextEnd = previousEnd + item.total / total;
      accumulator.push({
        ...item,
        start: previousEnd,
        end: nextEnd,
      });
      return accumulator;
    }, []);

  return (
    <PanelCard className="p-6">
      <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">Top Categories</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-[160px_1fr] md:items-center">
        <svg viewBox="0 0 42 42" className="mx-auto h-40 w-40 -rotate-90">
          <circle cx="21" cy="21" r="14" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="6" />
          {segments.map((segment) => (
            <circle
              key={segment.category}
              cx="21"
              cy="21"
              r="14"
              fill="none"
              stroke={segment.color}
              strokeWidth="6"
              strokeDasharray={`${(segment.end - segment.start) * 87.96} ${87.96}`}
              strokeDashoffset={-segment.start * 87.96}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {categoryTotals.map((item) => (
            <div key={item.category} className="flex items-center gap-2 text-[color:var(--app-text)]">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.category}</span>
            </div>
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

function RecentTransactionsCard({ transactions }: { transactions: FinanceTransaction[] }) {
  return (
    <PanelCard className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
          Recent Transactions
        </h2>
        <span className="text-sm font-semibold text-[color:var(--app-accent)]">View All →</span>
      </div>
      <div className="mt-6 divide-y divide-[color:var(--app-border)]">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="grid grid-cols-[1.5fr_1fr_0.9fr_0.7fr] items-center gap-4 py-4">
            <div className="flex items-center gap-3">
              <TransactionIcon icon={transaction.icon} />
              <span className="font-semibold text-[color:var(--app-text-strong)]">{transaction.title}</span>
            </div>
            <span className="inline-flex w-fit rounded-full bg-[var(--app-hover)] px-3 py-1 text-sm text-[color:var(--app-text)]">
              {transaction.category}
            </span>
            <span className="text-sm text-[color:var(--app-muted)]">{formatReportDate(transaction.date)}</span>
            <span className={cn('text-right font-semibold', transaction.type === 'expense' ? 'text-rose-400' : 'text-emerald-400')}>
              {formatCurrencyBDT(getTransactionAmount(transaction), { signed: true })}
            </span>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

function IntelligenceHubCard() {
  return (
    <PanelCard className="overflow-hidden">
      <div className="border-b border-[color:var(--app-border)] bg-[linear-gradient(90deg,rgba(147,51,234,0.12),transparent)] px-6 py-5">
        <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
          Intelligence Hub
        </h2>
      </div>
      <div className="grid grid-cols-3 border-b border-[color:var(--app-border)] text-center text-sm text-[color:var(--app-muted)]">
        <span className="py-3">Rates</span>
        <span className="border-b-2 border-[color:var(--app-accent)] py-3 font-semibold text-[color:var(--app-accent)]">News</span>
        <span className="py-3">Growth</span>
      </div>
      <div className="space-y-4 px-6 py-5">
        {FINANCE_INTELLIGENCE_FEED.map((item) => (
          <IntelligenceItem
            key={item.id}
            tone={item.sentiment as 'positive' | 'neutral' | 'negative'}
            title={item.title}
            source={item.source}
            age={item.age}
          />
        ))}
      </div>
    </PanelCard>
  );
}

function PocketTrackerLoadingState() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-[color:var(--app-border)] bg-[linear-gradient(135deg,var(--app-panel),var(--app-input-bg))] p-8 shadow-[0_24px_70px_rgba(15,23,42,0.1)]">
        <div className="max-w-2xl">
          <div className="h-3 w-32 rounded-full bg-[var(--app-hover)]" />
          <div className="mt-4 h-12 w-[min(520px,80%)] rounded-full bg-[var(--app-hover)]" />
          <div className="mt-4 h-4 w-[min(640px,92%)] rounded-full bg-[var(--app-hover)]" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <PanelCard key={index} className="p-5">
            <div className="h-3 w-24 rounded-full bg-[var(--app-hover)]" />
            <div className="mt-4 h-10 w-36 rounded-full bg-[var(--app-hover)]" />
            <div className="mt-4 h-6 w-16 rounded-full bg-[var(--app-hover)]" />
          </PanelCard>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <PanelCard className="h-[320px] bg-[linear-gradient(180deg,var(--app-panel),var(--app-input-bg))]">
          <span className="sr-only">Loading spending chart</span>
        </PanelCard>
        <div className="space-y-4">
          <PanelCard className="h-[152px] bg-[linear-gradient(180deg,var(--app-panel),var(--app-input-bg))]">
            <span className="sr-only">Loading budget panel</span>
          </PanelCard>
          <PanelCard className="h-[152px] bg-[linear-gradient(180deg,var(--app-panel),var(--app-input-bg))]">
            <span className="sr-only">Loading category panel</span>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

function IntelligenceItem({
  tone,
  title,
  source,
  age,
}: {
  tone: 'positive' | 'neutral' | 'negative';
  title: string;
  source: string;
  age: string;
}) {
  return (
    <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
            tone === 'positive'
              ? 'bg-emerald-500/12 text-emerald-300'
              : tone === 'negative'
                ? 'bg-rose-500/12 text-rose-300'
                : 'bg-slate-500/12 text-[color:var(--app-muted)]'
          )}
        >
          {tone}
        </span>
        <span className="text-xs text-[color:var(--app-muted)]">{age}</span>
      </div>
      <p className="mt-3 text-base font-semibold leading-6 text-[color:var(--app-text-strong)]">{title}</p>
      <p className="mt-2 text-sm text-[color:var(--app-muted)]">{source}</p>
    </div>
  );
}

function TransactionEditModal({
  transaction,
  onClose,
  onSave,
}: {
  transaction: FinanceTransaction | null;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <FinanceModal isOpen={!!transaction} title="Edit Transaction" onClose={onClose}>
      {transaction ? (
        <form key={transaction.id} className="space-y-4" onSubmit={onSave}>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalField label="Type">
              <InlineSelect
                defaultValue={transaction.type}
                options={[
                  { label: 'Expense', value: 'expense' },
                  { label: 'Earning', value: 'earning' },
                ]}
                name="type"
              />
            </ModalField>
            <ModalField label="Amount">
              <InlineInput name="amount" defaultValue={String(transaction.amount)} />
            </ModalField>
          </div>
          <ModalField label="Category">
            <InlineSelect
              defaultValue={transaction.category}
              name="category"
              options={CATEGORY_OPTIONS.map((option) => ({ label: option, value: option }))}
            />
          </ModalField>
          <ModalField label="Date">
            <InlineInput name="date" defaultValue={toDisplayDate(transaction.date)} />
          </ModalField>
          <ModalField label="Description">
            <InlineInput name="description" defaultValue={transaction.title} />
          </ModalField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-[18px] bg-[var(--app-hover)] px-4 py-3 text-sm font-semibold text-[color:var(--app-text)]">
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-[18px] bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] px-4 py-3 text-sm font-semibold text-white">
              Save Changes
            </button>
          </div>
        </form>
      ) : null}
    </FinanceModal>
  );
}

function FinanceModal({
  isOpen,
  title,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-[30px] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[color:var(--app-muted)] transition hover:bg-[var(--app-hover)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SelectPill({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[var(--app-hover)]"
    >
      <span className="text-[color:var(--app-muted)]">{icon}</span>
      {label}
      <ChevronDown className="h-4 w-4 text-[color:var(--app-muted)]" />
    </button>
  );
}

function InlineSelect({
  value,
  defaultValue,
  options,
  onChange,
  name,
}: {
  value?: string;
  defaultValue?: string;
  options: Array<{ label: string; value: string }>;
  onChange?: (value: string) => void;
  name?: string;
}) {
  return (
    <select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
      className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)] outline-none focus:border-[color:var(--app-accent)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function InlineInput({
  value,
  defaultValue,
  onChange,
  placeholder,
  name,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
}) {
  return (
    <input
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[18px] border border-[color:var(--app-border)] bg-[var(--app-input-bg)] px-4 py-3 text-sm text-[color:var(--app-text-strong)] outline-none placeholder:text-[color:var(--app-muted)] focus:border-[color:var(--app-accent)]"
    />
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function MetricBlurb({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: 'violet' | 'pink';
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className={cn('text-[11px] font-semibold uppercase tracking-[0.28em]', accent === 'violet' ? 'text-violet-300' : 'text-fuchsia-300')}>
        {title}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function TransactionIcon({ icon }: { icon: FinanceTransaction['icon'] }) {
  const colorMap: Record<FinanceTransaction['icon'], string> = {
    food: 'bg-rose-500/12 text-rose-300',
    savings: 'bg-emerald-500/12 text-emerald-300',
    education: 'bg-fuchsia-500/12 text-fuchsia-300',
    shopping: 'bg-pink-500/12 text-pink-300',
    other: 'bg-violet-500/12 text-violet-300',
    salary: 'bg-cyan-500/12 text-cyan-300',
    health: 'bg-sky-500/12 text-sky-300',
    housing: 'bg-amber-500/12 text-amber-300',
    transport: 'bg-purple-500/12 text-purple-300',
    business: 'bg-blue-500/12 text-blue-300',
    bills: 'bg-slate-500/12 text-slate-300',
  };

  const Icon =
    icon === 'food' ? Utensils :
    icon === 'savings' ? PiggyBank :
    icon === 'education' ? Sparkles :
    icon === 'shopping' ? HandCoins :
    icon === 'salary' ? Wallet :
    icon === 'health' ? ShieldPlus :
    icon === 'housing' ? House :
    icon === 'transport' ? TramFront :
    icon === 'business' ? Landmark :
    icon === 'bills' ? Pill :
    Wallet;

  return (
    <span className={cn('flex h-11 w-11 items-center justify-center rounded-full', colorMap[icon])}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

function ToastViewport({
  toasts,
}: {
  toasts: Array<{ id: string; title: string; message: string }>;
}) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-[24px] border border-[color:var(--app-border)] bg-[var(--app-panel)] px-5 py-4 shadow-[0_18px_46px_rgba(15,23,42,0.18)]"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-[color:var(--app-text-strong)]">{toast.title}</p>
          <p className="mt-1 text-sm text-[color:var(--app-muted)]">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

const CATEGORY_OPTIONS = [
  'Food',
  'Shopping',
  'Other',
  'Housing',
  'Bills',
  'Health',
  'Entertainment',
  'Education',
  'Transport',
  'Savings',
  'Salary',
  'Business',
];

const FILTER_OPTIONS: Array<{ label: string; value: FinanceViewFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Expenses', value: 'expenses' },
  { label: 'Earnings', value: 'earnings' },
];

const REPORT_TYPES: Array<{ label: string; value: FinanceReportType; description: string }> = [
  { label: 'Full Summary', value: 'full-summary', description: 'Complete financial overview' },
  { label: 'Budget Breakdown', value: 'budget-breakdown', description: 'Spending vs. Limits' },
  { label: 'Expense Log', value: 'expense-log', description: 'Detailed history' },
];

const REPORT_FORMATS: Array<{ label: string; value: FinanceReportFormat }> = [
  { label: 'Both', value: 'both' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Excel', value: 'excel' },
];

const POCKET_TRACKER_PREVIEW_COPY = {
  'chat-history': {
    title: 'Chat History',
    description: 'A polished archive surface for earlier Pocket Tracker AI sessions, ready for deeper conversation history in the next pass.',
  },
  'net-worth': {
    title: 'Net Worth',
    description: 'A premium preview for future balance-sheet tracking, anchored by the same March 2026 Pocket Tracker data.',
  },
  goals: {
    title: 'Goals',
    description: 'A styled preview for savings goals and milestones, keeping the Pocket Tracker information architecture consistent.',
  },
  recurring: {
    title: 'Recurring',
    description: 'A route-complete preview for recurring payments and subscriptions inside the Pocket Tracker shell.',
  },
  alerts: {
    title: 'Alerts',
    description: 'A preview destination for future spending and balance notifications, using the same card language and tracker data.',
  },
  settings: {
    title: 'Settings',
    description: 'A polished placeholder for finance preferences so the Pocket Tracker navigation still feels intentional and complete.',
  },
} as const;

function toDisplayDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function fromDisplayDate(value: string) {
  if (value.includes('-')) {
    return value;
  }

  const [day, month, year] = value.split('/');
  if (!day || !month || !year) {
    return '2026-03-31';
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
