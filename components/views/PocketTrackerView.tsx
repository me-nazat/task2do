'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subDays, subMonths } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgePercent,
  BriefcaseBusiness,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  Ellipsis,
  FileSpreadsheet,
  FileText,
  Landmark,
  PiggyBank,
  Plus,
  Trash2,
} from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

type TransactionType = 'expense' | 'earning';
type TransactionFilter = 'all' | 'expense' | 'earning';
type ReportType = 'summary' | 'budget-breakdown' | 'expense-log';
type ReportDateRange = 'this-month' | 'last-30-days' | 'quarter' | 'year-to-date' | 'all-time';
type ReportFormat = 'pdf' | 'excel' | 'both';

interface PocketTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface TransactionDraft {
  id: string | null;
  type: TransactionType;
  amount: string;
  category: string;
  date: string;
  description: string;
}

const STORAGE_PREFIX = 'task2do-pocket-tracker';
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Health', 'Utilities', 'Shopping', 'Travel', 'Subscriptions', 'Education', 'Other'];
const EARNING_CATEGORIES = ['Salary', 'Freelance', 'Business', 'Bonus', 'Investment', 'Refund', 'Gift', 'Other'];
const MONTHS_TO_SHOW = 6;

const filterTabs: Array<{ id: TransactionFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'earning', label: 'Earnings' },
];

const reportTypeOptions: Array<{ value: ReportType; label: string }> = [
  { value: 'summary', label: 'Full Summary' },
  { value: 'budget-breakdown', label: 'Budget Breakdown' },
  { value: 'expense-log', label: 'Expense Log' },
];

const reportRangeOptions: Array<{ value: ReportDateRange; label: string }> = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-30-days', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year-to-date', label: 'Year to Date' },
  { value: 'all-time', label: 'All Time' },
];

const reportFormatOptions: Array<{ value: ReportFormat; label: string }> = [
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel' },
  { value: 'both', label: 'Both' },
];

const defaultDraft = (): TransactionDraft => ({
  id: null,
  type: 'expense',
  amount: '',
  category: EXPENSE_CATEGORIES[0],
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
});

function createStorageKey(userId: string | null | undefined) {
  return `${STORAGE_PREFIX}:${userId ?? 'guest'}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatChangePercent(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return { label: '0%', positive: true };
    }

    return { label: 'New', positive: current >= 0 };
  }

  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return {
    label: `${percent >= 0 ? '+' : ''}${Math.round(percent)}%`,
    positive: percent >= 0,
  };
}

function getMonthBucket(date: Date) {
  return format(date, 'yyyy-MM');
}

function parseTransactionDate(value: string) {
  return parseISO(`${value}T00:00:00`);
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildReportInterval(range: ReportDateRange) {
  const now = new Date();

  switch (range) {
    case 'this-month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last-30-days':
      return { start: subDays(now, 30), end: now };
    case 'quarter':
      return { start: subMonths(now, 3), end: now };
    case 'year-to-date':
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    case 'all-time':
    default:
      return null;
  }
}

function createCsvRows(reportType: ReportType, transactions: PocketTransaction[]) {
  if (reportType === 'expense-log') {
    return [
      ['Date', 'Description', 'Category', 'Type', 'Amount'],
      ...transactions
        .filter((transaction) => transaction.type === 'expense')
        .map((transaction) => [
          transaction.date,
          transaction.description || transaction.category,
          transaction.category,
          transaction.type,
          transaction.amount.toFixed(2),
        ]),
    ];
  }

  if (reportType === 'budget-breakdown') {
    const grouped = transactions.reduce<Record<string, number>>((accumulator, transaction) => {
      if (transaction.type !== 'expense') {
        return accumulator;
      }

      accumulator[transaction.category] = (accumulator[transaction.category] ?? 0) + transaction.amount;
      return accumulator;
    }, {});

    return [
      ['Category', 'Spend'],
      ...Object.entries(grouped).map(([category, amount]) => [category, amount.toFixed(2)]),
    ];
  }

  const earnings = transactions
    .filter((transaction) => transaction.type === 'earning')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return [
    ['Metric', 'Amount'],
    ['Earnings', earnings.toFixed(2)],
    ['Expenses', expenses.toFixed(2)],
    ['Net Savings', (earnings - expenses).toFixed(2)],
  ];
}

export function PocketTrackerView() {
  const { user } = useStore();
  const storageKey = useMemo(() => createStorageKey(user?.id), [user?.id]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [transactions, setTransactions] = useState<PocketTransaction[]>([]);
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [draft, setDraft] = useState<TransactionDraft>(() => defaultDraft());
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [reportRange, setReportRange] = useState<ReportDateRange>('this-month');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setTransactions([]);
        setHasHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as PocketTransaction[];
      setTransactions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTransactions([]);
    } finally {
      setHasHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(transactions));
  }, [hasHydrated, storageKey, transactions]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const sortedTransactions = useMemo(
    () => [...transactions].sort((left, right) => {
      const leftTime = new Date(`${left.date}T00:00:00`).getTime();
      const rightTime = new Date(`${right.date}T00:00:00`).getTime();
      return rightTime - leftTime || right.createdAt.localeCompare(left.createdAt);
    }),
    [transactions]
  );

  const visibleTransactions = useMemo(
    () => sortedTransactions.filter((transaction) => activeFilter === 'all' || transaction.type === activeFilter),
    [activeFilter, sortedTransactions]
  );

  const recentTransactions = useMemo(() => sortedTransactions.slice(0, 5), [sortedTransactions]);
  const now = useMemo(() => new Date(), []);
  const currentMonthKey = getMonthBucket(now);
  const previousMonthKey = getMonthBucket(subMonths(now, 1));

  const summary = useMemo(() => {
    const totals = transactions.reduce(
      (accumulator, transaction) => {
        if (transaction.type === 'earning') {
          accumulator.earnings += transaction.amount;
        } else {
          accumulator.expenses += transaction.amount;
        }

        const bucket = getMonthBucket(parseTransactionDate(transaction.date));
        if (bucket === currentMonthKey) {
          if (transaction.type === 'earning') {
            accumulator.monthlyEarnings += transaction.amount;
          } else {
            accumulator.monthlyExpenses += transaction.amount;
          }
        }

        if (bucket === previousMonthKey) {
          if (transaction.type === 'earning') {
            accumulator.previousMonthEarnings += transaction.amount;
          } else {
            accumulator.previousMonthExpenses += transaction.amount;
          }
        }

        return accumulator;
      },
      {
        earnings: 0,
        expenses: 0,
        monthlyEarnings: 0,
        monthlyExpenses: 0,
        previousMonthEarnings: 0,
        previousMonthExpenses: 0,
      }
    );

    return {
      totalBalance: totals.earnings - totals.expenses,
      monthlyEarnings: totals.monthlyEarnings,
      monthlyExpenses: totals.monthlyExpenses,
      netSavings: totals.monthlyEarnings - totals.monthlyExpenses,
      totalBalanceChange: formatChangePercent(
        totals.monthlyEarnings - totals.monthlyExpenses,
        totals.previousMonthEarnings - totals.previousMonthExpenses
      ),
      monthlyEarningsChange: formatChangePercent(totals.monthlyEarnings, totals.previousMonthEarnings),
      monthlyExpensesChange: formatChangePercent(totals.monthlyExpenses, totals.previousMonthExpenses),
      netSavingsChange: formatChangePercent(
        totals.monthlyEarnings - totals.monthlyExpenses,
        totals.previousMonthEarnings - totals.previousMonthExpenses
      ),
    };
  }, [currentMonthKey, previousMonthKey, transactions]);

  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: MONTHS_TO_SHOW }, (_, index) => subMonths(now, MONTHS_TO_SHOW - index - 1));

    return months.map((month) => {
      const monthKey = getMonthBucket(month);
      const spend = transactions
        .filter((transaction) => transaction.type === 'expense' && getMonthBucket(parseTransactionDate(transaction.date)) === monthKey)
        .reduce((sum, transaction) => sum + transaction.amount, 0);

      return {
        label: format(month, 'MMM'),
        value: spend,
      };
    });
  }, [now, transactions]);

  const trendMax = Math.max(...monthlyTrend.map((item) => item.value), 1);

  const topCategories = useMemo(() => {
    const grouped = transactions.reduce<Record<string, number>>((accumulator, transaction) => {
      if (transaction.type !== 'expense') {
        return accumulator;
      }

      accumulator[transaction.category] = (accumulator[transaction.category] ?? 0) + transaction.amount;
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
  }, [transactions]);

  const totalTopCategorySpend = topCategories.reduce((sum, [, amount]) => sum + amount, 0);
  const categoryGradient = useMemo(() => {
    if (topCategories.length === 0 || totalTopCategorySpend === 0) {
      return 'conic-gradient(from 180deg, rgba(209,213,219,0.8) 0deg 360deg)';
    }

    const colors = ['#111827', '#3b82f6', '#0f766e', '#f59e0b', '#ef4444'];
    let currentAngle = 0;
    const segments = topCategories.map(([, amount], index) => {
      const angle = (amount / totalTopCategorySpend) * 360;
      const segment = `${colors[index % colors.length]} ${currentAngle}deg ${currentAngle + angle}deg`;
      currentAngle += angle;
      return segment;
    });

    return `conic-gradient(from 180deg, ${segments.join(', ')})`;
  }, [topCategories, totalTopCategorySpend]);

  const reportTransactions = useMemo(() => {
    const interval = buildReportInterval(reportRange);

    if (!interval) {
      return sortedTransactions;
    }

    return sortedTransactions.filter((transaction) => {
      const date = parseTransactionDate(transaction.date);
      return isWithinInterval(date, interval);
    });
  }, [reportRange, sortedTransactions]);

  const resetDraft = (type: TransactionType = 'expense') => {
    setDraft({
      id: null,
      type,
      amount: '',
      category: type === 'expense' ? EXPENSE_CATEGORIES[0] : EARNING_CATEGORIES[0],
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
    });
  };

  const openQuickAdd = (transaction?: PocketTransaction) => {
    if (transaction) {
      setDraft({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
        category: transaction.category,
        date: transaction.date,
        description: transaction.description,
      });
    } else {
      resetDraft();
    }

    setIsQuickAddOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveTransaction = () => {
    const amount = Number(draft.amount);
    if (!draft.date || !draft.category || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const timestamp = new Date().toISOString();
    const nextTransaction: PocketTransaction = {
      id: draft.id ?? crypto.randomUUID(),
      type: draft.type,
      amount,
      category: draft.category,
      date: draft.date,
      description: draft.description.trim(),
      createdAt: draft.id
        ? transactions.find((transaction) => transaction.id === draft.id)?.createdAt ?? timestamp
        : timestamp,
      updatedAt: timestamp,
    };

    setTransactions((current) => {
      if (draft.id) {
        return current.map((transaction) => transaction.id === draft.id ? nextTransaction : transaction);
      }

      return [nextTransaction, ...current];
    });

    setIsQuickAddOpen(false);
    resetDraft(draft.type);
  };

  const duplicateTransaction = (transaction: PocketTransaction) => {
    const timestamp = new Date().toISOString();
    setTransactions((current) => [{
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      date: format(new Date(), 'yyyy-MM-dd'),
    }, ...current]);
    setActiveMenuId(null);
  };

  const deleteTransaction = (transactionId: string) => {
    setTransactions((current) => current.filter((transaction) => transaction.id !== transactionId));
    setActiveMenuId(null);
  };

  const generateReport = async () => {
    const rows = createCsvRows(reportType, reportTransactions);
    const fileBase = `task2do-${reportType}-${reportRange}-${format(new Date(), 'yyyyMMdd-HHmm')}`;

    if (reportFormat === 'excel' || reportFormat === 'both') {
      const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadBlob(csvContent, `${fileBase}.csv`, 'text/csv;charset=utf-8');
    }

    if (reportFormat === 'pdf' || reportFormat === 'both') {
      const [{ jsPDF }] = await Promise.all([import('jspdf')]);
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const title = reportTypeOptions.find((option) => option.value === reportType)?.label ?? 'Report';
      let cursorY = 60;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text(`Task2Do ${title}`, 40, cursorY);
      cursorY += 24;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Range: ${reportRangeOptions.find((option) => option.value === reportRange)?.label ?? reportRange}`, 40, cursorY);
      cursorY += 18;
      pdf.text(`Generated: ${format(new Date(), 'PPP p')}`, 40, cursorY);
      cursorY += 26;

      rows.forEach((row) => {
        if (cursorY > 780) {
          pdf.addPage();
          cursorY = 50;
        }

        pdf.text(row.join('    '), 40, cursorY);
        cursorY += 16;
      });

      pdf.save(`${fileBase}.pdf`);
    }

    setReportStatus(
      reportFormat === 'both'
        ? 'PDF and Excel exports are ready.'
        : `${reportFormat.toUpperCase()} export generated successfully.`
    );
    window.setTimeout(() => setReportStatus(null), 3200);
  };

  const balanceCards = [
    {
      label: 'Total Balance',
      value: summary.totalBalance,
      change: summary.totalBalanceChange,
      icon: Landmark,
      tone: 'text-slate-900 bg-white',
    },
    {
      label: 'Monthly Earnings',
      value: summary.monthlyEarnings,
      change: summary.monthlyEarningsChange,
      icon: ArrowUpRight,
      tone: 'text-emerald-900 bg-emerald-50',
    },
    {
      label: 'Monthly Expenses',
      value: summary.monthlyExpenses,
      change: summary.monthlyExpensesChange,
      icon: ArrowDownLeft,
      tone: 'text-rose-900 bg-rose-50',
    },
    {
      label: 'Net Savings',
      value: summary.netSavings,
      change: summary.netSavingsChange,
      icon: PiggyBank,
      tone: 'text-blue-900 bg-blue-50',
    },
  ] as const;

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-outline-variant/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
                <CircleDollarSign className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-headline text-3xl font-medium tracking-tight text-primary sm:text-4xl lg:text-5xl">Pocket Tracker</h2>
                <p className="mt-1 text-[9px] font-label font-bold uppercase tracking-[0.22em] text-outline/55">Money flow, reports, and recent movement</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => openQuickAdd()}
              className="touch-target inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-on-primary shadow-md transition-all active:scale-95 lg:hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Quick Add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {balanceCards.map((card) => (
            <div key={card.label} className="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm', card.tone)}>
                  <card.icon className="h-5 w-5" />
                </span>
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-[9px] font-label font-bold uppercase tracking-[0.16em]',
                  card.change.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                )}>
                  {card.change.label}
                </span>
              </div>
              <p className="mt-5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/55">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-[2rem]">{formatCurrency(card.value)}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-label font-bold uppercase tracking-[0.16em] text-outline/55">Spending Trends</p>
                <h3 className="mt-1 text-lg font-medium tracking-tight text-primary">Last {MONTHS_TO_SHOW} months</h3>
              </div>
              <BadgePercent className="h-4 w-4 text-primary/55" />
            </div>

            <div className="mt-6 flex h-52 items-end gap-3">
              {monthlyTrend.map((item) => (
                <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                  <div className="flex h-40 w-full items-end">
                    <div
                      className="w-full rounded-t-[1rem] bg-[linear-gradient(180deg,rgba(17,24,39,0.95)_0%,rgba(59,130,246,0.45)_100%)] shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
                      style={{ height: `${Math.max(8, (item.value / trendMax) * 100)}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/60">{item.label}</p>
                    <p className="mt-1 text-xs font-medium text-primary">{formatCurrency(item.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-label font-bold uppercase tracking-[0.16em] text-outline/55">Top Categories</p>
                <h3 className="mt-1 text-lg font-medium tracking-tight text-primary">Expense mix</h3>
              </div>
              <BriefcaseBusiness className="h-4 w-4 text-primary/55" />
            </div>

            <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div
                className="relative h-40 w-40 rounded-full"
                style={{ backgroundImage: categoryGradient }}
              >
                <div className="absolute inset-[22%] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]" />
              </div>

              <div className="flex-1 space-y-2">
                {topCategories.length > 0 ? topCategories.map(([category, amount], index) => (
                  <div key={category} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: ['#111827', '#3b82f6', '#0f766e', '#f59e0b', '#ef4444'][index % 5] }}
                      />
                      <span className="text-sm font-medium text-primary">{category}</span>
                    </div>
                    <span className="text-xs font-semibold text-outline/70">{formatCurrency(amount)}</span>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-white/70 px-4 py-5 text-sm text-outline/55">
                    Add a few expenses to see category distribution.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-label font-bold uppercase tracking-[0.16em] text-outline/55">Recent Transactions</p>
                <h3 className="mt-1 text-lg font-medium tracking-tight text-primary">Latest activity</h3>
              </div>
              <CalendarRange className="h-4 w-4 text-primary/55" />
            </div>

            <div className="mt-5 space-y-2.5">
              {recentTransactions.length > 0 ? recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{transaction.description || transaction.category}</p>
                    <p className="mt-1 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/50">
                      {transaction.category} • {format(parseTransactionDate(transaction.date), 'MMM d')}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 text-sm font-semibold',
                    transaction.type === 'earning' ? 'text-emerald-600' : 'text-rose-600'
                  )}>
                    {transaction.type === 'earning' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-white/70 px-4 py-5 text-sm text-outline/55">
                  No transactions yet. Use Quick Add to start tracking.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="rounded-[2rem] border border-outline-variant/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 border-b border-outline-variant/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-medium tracking-tight text-primary">Transactions</h3>
              <p className="mt-1 text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Name, category, date, and amount in one stream</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-full border border-primary/10 bg-primary/5 p-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    'touch-target rounded-full px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.16em] transition-all',
                    activeFilter === tab.id
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-outline/55 active:text-primary lg:hover:text-primary'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-outline-variant/10">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_44px] gap-3 bg-surface-container-low px-4 py-3 text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55 sm:grid">
              <span>Name</span>
              <span>Category</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            <div className="divide-y divide-outline-variant/10 bg-white">
              {visibleTransactions.length > 0 ? visibleTransactions.map((transaction) => (
                <div key={transaction.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_44px] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{transaction.description || transaction.category}</p>
                    <p className="mt-1 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/50 sm:hidden">
                      {transaction.category} • {format(parseTransactionDate(transaction.date), 'MMM d, yyyy')}
                    </p>
                  </div>

                  <p className="hidden text-sm text-outline/70 sm:block">{transaction.category}</p>
                  <p className="hidden text-sm text-outline/70 sm:block">{format(parseTransactionDate(transaction.date), 'MMM d, yyyy')}</p>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className={cn(
                      'rounded-full px-2.5 py-1 text-[9px] font-label font-bold uppercase tracking-[0.16em] sm:hidden',
                      transaction.type === 'earning' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    )}>
                      {transaction.type}
                    </span>
                    <span className={cn(
                      'text-sm font-semibold',
                      transaction.type === 'earning' ? 'text-emerald-600' : 'text-rose-600'
                    )}>
                      {transaction.type === 'earning' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                  </div>

                  <div className="relative sm:justify-self-end" ref={activeMenuId === transaction.id ? menuRef : undefined}>
                    <button
                      onClick={() => setActiveMenuId((current) => current === transaction.id ? null : transaction.id)}
                      className="touch-target flex items-center justify-center rounded-full text-outline/55 transition-all active:scale-95 active:bg-primary/5 active:text-primary lg:hover:bg-primary/5 lg:hover:text-primary"
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>

                    {activeMenuId === transaction.id ? (
                      <div className="absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-outline-variant/15 bg-white shadow-xl">
                        <button
                          onClick={() => openQuickAdd(transaction)}
                          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[11px] font-label font-bold uppercase tracking-[0.14em] text-outline/70 transition-all active:bg-primary/5 active:text-primary lg:hover:bg-primary/5 lg:hover:text-primary"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => duplicateTransaction(transaction)}
                          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[11px] font-label font-bold uppercase tracking-[0.14em] text-outline/70 transition-all active:bg-primary/5 active:text-primary lg:hover:bg-primary/5 lg:hover:text-primary"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </button>
                        <button
                          onClick={() => deleteTransaction(transaction.id)}
                          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[11px] font-label font-bold uppercase tracking-[0.14em] text-rose-600 transition-all active:bg-rose-50 lg:hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )) : (
                <div className="px-4 py-10 text-center text-sm text-outline/55">
                  No transactions match this filter yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-outline-variant/10 bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 pb-4">
            <div>
              <h3 className="text-2xl font-medium tracking-tight text-primary">Reports</h3>
              <p className="mt-1 text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Full Summary, budget breakdown, or expense log</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary/70">
              <Download className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Report Type</span>
              <div className="relative">
                <select
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value as ReportType)}
                  className="w-full appearance-none rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                >
                  {reportTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline/45" />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Date Range</span>
              <div className="relative">
                <select
                  value={reportRange}
                  onChange={(event) => setReportRange(event.target.value as ReportDateRange)}
                  className="w-full appearance-none rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                >
                  {reportRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline/45" />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Export Format</span>
              <div className="relative">
                <select
                  value={reportFormat}
                  onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
                  className="w-full appearance-none rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                >
                  {reportFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline/45" />
              </div>
            </label>

            <div className="rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-low/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[9px] font-label font-bold uppercase tracking-[0.16em] text-outline/55">Export Scope</span>
                <span className="text-sm font-semibold text-primary">{reportTransactions.length} rows</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-outline/70">
                Generate a polished report from the currently selected date window without leaving Task2Do.
              </p>
            </div>

            <button
              onClick={() => void generateReport()}
              className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-on-primary shadow-md transition-all active:scale-[0.99] lg:hover:bg-primary/90"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Generate Report
            </button>

            {reportStatus ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {reportStatus}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          resetDraft();
        }}
        title={draft.id ? 'Edit Transaction' : 'Quick Add'}
        contentClassName="sm:max-w-2xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Type</span>
              <div className="relative">
                <select
                  value={draft.type}
                  onChange={(event) => {
                    const nextType = event.target.value as TransactionType;
                    setDraft((current) => ({
                      ...current,
                      type: nextType,
                      category: nextType === 'expense' ? EXPENSE_CATEGORIES[0] : EARNING_CATEGORIES[0],
                    }));
                  }}
                  className="w-full appearance-none rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="expense">Expense</option>
                  <option value="earning">Earning</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline/45" />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount}
                onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
                className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Category</span>
              <div className="relative">
                <select
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                  className="w-full appearance-none rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                >
                  {(draft.type === 'expense' ? EXPENSE_CATEGORIES : EARNING_CATEGORIES).map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-outline/45" />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Date</span>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">Description</span>
            <input
              type="text"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Description"
              className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setIsQuickAddOpen(false);
                resetDraft();
              }}
              className="touch-target inline-flex flex-1 items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/70 transition-all active:scale-[0.99] lg:hover:bg-surface-container-high"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTransaction}
              className="touch-target inline-flex flex-1 items-center justify-center rounded-2xl bg-primary px-4 py-3 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-on-primary shadow-md transition-all active:scale-[0.99] lg:hover:bg-primary/90"
            >
              {draft.id ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
