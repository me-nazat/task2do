export type FinanceTransactionType = 'expense' | 'earning';
export type FinanceViewFilter = 'all' | 'expenses' | 'earnings';
export type FinanceSortDirection = 'asc' | 'desc';
export type FinanceReportType = 'full-summary' | 'budget-breakdown' | 'expense-log';
export type FinanceReportFormat = 'both' | 'pdf' | 'excel';
export type FinanceDateRange = 'last-30-days';
export type FinanceTransactionIcon =
  | 'food'
  | 'savings'
  | 'education'
  | 'shopping'
  | 'other'
  | 'salary'
  | 'health'
  | 'housing'
  | 'transport'
  | 'business'
  | 'bills';

export interface FinanceTransaction {
  id: string;
  title: string;
  category: string;
  type: FinanceTransactionType;
  date: string;
  amount: number;
  icon: FinanceTransactionIcon;
}

export interface FinanceBudget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  periodLabel?: string;
}

export interface FinanceKpiSnapshot {
  totalBalance: number;
  monthlyEarnings: number;
  monthlyExpenses: number;
  netSavings: number;
}

export interface FinanceReportConfig {
  reportType: FinanceReportType;
  dateRange: FinanceDateRange;
  format: FinanceReportFormat;
}

export interface GeneratedReport {
  id: string;
  fileName: string;
  createdAt: string;
  format: FinanceReportFormat;
  reportType: FinanceReportType;
  periodLabel: string;
  transactions: FinanceTransaction[];
  summary: FinanceKpiSnapshot;
}

export interface FinanceToast {
  id: string;
  title: string;
  message: string;
}

export const FINANCE_MONTH_LABEL = 'March 2026';
export const FINANCE_RANGE_LABEL = 'Full Month';
export const POCKET_TRACKER_BRAND_NAME = 'Pocket Tracker';
export const POCKET_TRACKER_TAGLINE = 'Smart Finance';

export const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f97316',
  Shopping: '#4f46e5',
  Other: '#4b5563',
  Housing: '#3b82f6',
  Bills: '#6b7280',
  Health: '#10b981',
  Entertainment: '#ec4899',
  Education: '#22c55e',
  Transport: '#8b5cf6',
  Savings: '#14b8a6',
  Salary: '#16a34a',
  Business: '#0ea5e9',
};

export const FINANCE_INTELLIGENCE_FEED = [
  {
    id: 'intel-1',
    sentiment: 'positive',
    title: 'Global markets rally as rate-cut expectations cool volatility.',
    source: 'Financial Times',
    age: '2h ago',
  },
  {
    id: 'intel-2',
    sentiment: 'neutral',
    title: 'Analysts expect consumer spending to stay range-bound through April.',
    source: 'Reuters',
    age: '4h ago',
  },
  {
    id: 'intel-3',
    sentiment: 'negative',
    title: 'Oil prices dip as supply forecasts improve across the region.',
    source: 'Bloomberg',
    age: '5h ago',
  },
];

export const INITIAL_FINANCE_TRANSACTIONS: FinanceTransaction[] = [
  { id: 'txn-1', title: 'RUET 9th week', category: 'Education', type: 'expense', date: '2026-03-31', amount: 250, icon: 'education' },
  { id: 'txn-2', title: 'abbu', category: 'Savings', type: 'earning', date: '2026-03-28', amount: 550, icon: 'savings' },
  { id: 'txn-3', title: 'Muskan RU Pizza', category: 'Food', type: 'expense', date: '2026-03-25', amount: 1300, icon: 'food' },
  { id: 'txn-4', title: 'ada rosun', category: 'Food', type: 'expense', date: '2026-03-23', amount: 150, icon: 'food' },
  { id: 'txn-5', title: 'Muskan Callisto', category: 'Other', type: 'expense', date: '2026-03-23', amount: 1200, icon: 'other' },
  { id: 'txn-6', title: 'Mahi BBQ', category: 'Food', type: 'expense', date: '2026-03-23', amount: 450, icon: 'food' },
  { id: 'txn-7', title: 'Eidi Babul chachchu', category: 'Savings', type: 'earning', date: '2026-03-21', amount: 200, icon: 'savings' },
  { id: 'txn-8', title: 'Eidi Abbu', category: 'Savings', type: 'earning', date: '2026-03-21', amount: 500, icon: 'savings' },
  { id: 'txn-9', title: 'Salami', category: 'Other', type: 'expense', date: '2026-03-20', amount: 680, icon: 'other' },
  { id: 'txn-10', title: 'Eidi Shahadat uncle', category: 'Savings', type: 'earning', date: '2026-03-20', amount: 2000, icon: 'savings' },
  { id: 'txn-11', title: 'Panjabi', category: 'Shopping', type: 'expense', date: '2026-03-16', amount: 990, icon: 'shopping' },
  { id: 'txn-12', title: 'Omi', category: 'Other', type: 'expense', date: '2026-03-16', amount: 420, icon: 'other' },
  { id: 'txn-13', title: 'Freelance UI audit', category: 'Business', type: 'earning', date: '2026-03-15', amount: 1500, icon: 'business' },
  { id: 'txn-14', title: 'Freelance landing page', category: 'Business', type: 'earning', date: '2026-03-13', amount: 3500, icon: 'business' },
  { id: 'txn-15', title: 'Stylus pen', category: 'Other', type: 'expense', date: '2026-03-11', amount: 700, icon: 'other' },
  { id: 'txn-16', title: 'Ratul', category: 'Salary', type: 'earning', date: '2026-03-11', amount: 1500, icon: 'salary' },
  { id: 'txn-17', title: 'Muskan', category: 'Shopping', type: 'expense', date: '2026-03-10', amount: 3800, icon: 'shopping' },
  { id: 'txn-18', title: 'GST Safiya', category: 'Salary', type: 'earning', date: '2026-03-10', amount: 3500, icon: 'salary' },
  { id: 'txn-19', title: 'Leg Ultrasound', category: 'Health', type: 'expense', date: '2026-03-09', amount: 2400, icon: 'health' },
  { id: 'txn-20', title: 'Gold', category: 'Housing', type: 'expense', date: '2026-03-08', amount: 3200, icon: 'housing' },
  { id: 'txn-21', title: 'grocery', category: 'Food', type: 'expense', date: '2026-03-08', amount: 210, icon: 'food' },
  { id: 'txn-22', title: 'knee cap', category: 'Health', type: 'expense', date: '2026-03-08', amount: 1070, icon: 'health' },
  { id: 'txn-23', title: 'Ruhul', category: 'Business', type: 'earning', date: '2026-03-06', amount: 2550, icon: 'business' },
  { id: 'txn-24', title: 'Cycle repairing', category: 'Transport', type: 'expense', date: '2026-03-05', amount: 150, icon: 'transport' },
  { id: 'txn-25', title: 'Ganne ka juice', category: 'Food', type: 'expense', date: '2026-03-05', amount: 140, icon: 'food' },
  { id: 'txn-26', title: 'Catfood', category: 'Other', type: 'expense', date: '2026-03-05', amount: 200, icon: 'other' },
  { id: 'txn-27', title: 'March stipend', category: 'Salary', type: 'earning', date: '2026-03-04', amount: 4000, icon: 'salary' },
  { id: 'txn-28', title: 'Electric bill', category: 'Bills', type: 'expense', date: '2026-03-03', amount: 2100, icon: 'bills' },
  { id: 'txn-29', title: 'Internet package', category: 'Bills', type: 'expense', date: '2026-03-02', amount: 620, icon: 'bills' },
  { id: 'txn-30', title: 'Medicine refill', category: 'Health', type: 'expense', date: '2026-03-02', amount: 400, icon: 'health' },
  { id: 'txn-31', title: 'Rickshaw top-up', category: 'Transport', type: 'expense', date: '2026-03-01', amount: 1000, icon: 'transport' },
];

export const INITIAL_FINANCE_BUDGETS: FinanceBudget[] = [];

export const INITIAL_REPORT_CONFIG: FinanceReportConfig = {
  reportType: 'full-summary',
  dateRange: 'last-30-days',
  format: 'both',
};

export function inferFinanceIcon(category: string): FinanceTransactionIcon {
  const lower = category.toLowerCase();

  if (lower.includes('food')) return 'food';
  if (lower.includes('saving')) return 'savings';
  if (lower.includes('education')) return 'education';
  if (lower.includes('shopping')) return 'shopping';
  if (lower.includes('salary')) return 'salary';
  if (lower.includes('health')) return 'health';
  if (lower.includes('housing')) return 'housing';
  if (lower.includes('transport')) return 'transport';
  if (lower.includes('business')) return 'business';
  if (lower.includes('bill')) return 'bills';
  return 'other';
}
