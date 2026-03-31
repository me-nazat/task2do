import {
  AlarmClock,
  BarChart3,
  Bell,
  Calendar,
  CheckCheck,
  CircleDollarSign,
  Goal,
  Grid2x2,
  History,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  RefreshCcw,
  Settings,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProductKey } from '@/store/useShellStore';

export type Task2DoRouteKey =
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'ai-chat'
  | 'schedule'
  | 'kanban'
  | 'matrix'
  | 'habits'
  | 'completed-alerts';

export type WealthRouteKey =
  | 'dashboard'
  | 'ai-chat'
  | 'transactions'
  | 'budgets'
  | 'reports'
  | 'chat-history'
  | 'net-worth'
  | 'goals'
  | 'recurring'
  | 'alerts'
  | 'settings';

export interface NavItem<RouteKey extends string = string> {
  key: RouteKey;
  label: string;
  href: string;
  icon: LucideIcon;
  preview?: boolean;
}

export const TASK2DO_NAV_ITEMS: NavItem<Task2DoRouteKey>[] = [
  { key: 'inbox', label: 'Inbox', href: '/task2do/inbox', icon: Inbox, preview: true },
  { key: 'today', label: 'Today', href: '/task2do/today', icon: Calendar, preview: true },
  { key: 'upcoming', label: 'Upcoming', href: '/task2do/upcoming', icon: AlarmClock, preview: true },
  { key: 'ai-chat', label: 'AI Chat', href: '/task2do/ai-chat', icon: Sparkles },
  { key: 'schedule', label: 'Schedule', href: '/task2do/schedule', icon: Calendar, preview: true },
  { key: 'kanban', label: 'Kanban', href: '/task2do/kanban', icon: KanbanSquare, preview: true },
  { key: 'matrix', label: 'Matrix', href: '/task2do/matrix', icon: Grid2x2, preview: true },
  { key: 'habits', label: 'Habits', href: '/task2do/habits', icon: CheckCheck, preview: true },
  { key: 'completed-alerts', label: 'Completed & Alerts', href: '/task2do/completed-alerts', icon: Bell, preview: true },
];

export const WEALTH_NAV_ITEMS: NavItem<WealthRouteKey>[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/pocket-tracker/dashboard', icon: LayoutDashboard },
  { key: 'ai-chat', label: 'AI Chat', href: '/pocket-tracker/ai-chat', icon: Sparkles },
  { key: 'transactions', label: 'Transactions', href: '/pocket-tracker/transactions', icon: ReceiptText },
  { key: 'budgets', label: 'Budgets', href: '/pocket-tracker/budgets', icon: PiggyBank },
  { key: 'reports', label: 'Reports', href: '/pocket-tracker/reports', icon: BarChart3 },
  { key: 'chat-history', label: 'Chat History', href: '/pocket-tracker/chat-history', icon: History, preview: true },
  { key: 'net-worth', label: 'Net Worth', href: '/pocket-tracker/net-worth', icon: CircleDollarSign, preview: true },
  { key: 'goals', label: 'Goals', href: '/pocket-tracker/goals', icon: Goal, preview: true },
  { key: 'recurring', label: 'Recurring', href: '/pocket-tracker/recurring', icon: RefreshCcw, preview: true },
  { key: 'alerts', label: 'Alerts', href: '/pocket-tracker/alerts', icon: Bell, preview: true },
  { key: 'settings', label: 'Settings', href: '/pocket-tracker/settings', icon: Settings, preview: true },
];

export function normalizeTask2DoRoute(slug?: string[]): Task2DoRouteKey {
  const route = slug?.[0] as Task2DoRouteKey | undefined;

  if (!route) {
    return 'ai-chat';
  }

  return TASK2DO_NAV_ITEMS.some((item) => item.key === route) ? route : 'ai-chat';
}

export function normalizeWealthRoute(slug?: string[]): WealthRouteKey {
  const route = slug?.[0] as WealthRouteKey | undefined;

  if (!route) {
    return 'dashboard';
  }

  return WEALTH_NAV_ITEMS.some((item) => item.key === route) ? route : 'dashboard';
}

export function getProductNavItems(product: ProductKey) {
  return product === 'task2do' ? TASK2DO_NAV_ITEMS : WEALTH_NAV_ITEMS;
}
