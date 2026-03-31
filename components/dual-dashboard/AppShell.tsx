'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, MoonStar, Search, Sparkles, SunMedium, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavItem } from '@/lib/navigation';
import { DEFAULT_ROUTES, ProductKey, WealthTheme, useShellStore } from '@/store/useShellStore';

export interface SidebarProfile {
  name: string;
  subtitle: string;
  badge?: string;
}

interface AppShellProps<RouteKey extends string> {
  product: ProductKey;
  theme: WealthTheme | 'light';
  activeKey: RouteKey;
  navItems: NavItem<RouteKey>[];
  logo: ReactNode;
  subtitle?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  sidebarSection?: ReactNode;
  sidebarFooter?: ReactNode;
  profile: SidebarProfile;
  children: ReactNode;
}

export function AppShell<RouteKey extends string>({
  product,
  theme,
  activeKey,
  navItems,
  logo,
  subtitle,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  sidebarSection,
  sidebarFooter,
  profile,
  children,
}: AppShellProps<RouteKey>) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    lastRouteByProduct,
    rememberRoute,
    setCurrentProduct,
    wealthTheme,
    toggleWealthTheme,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useShellStore();

  useEffect(() => {
    setCurrentProduct(product);
    rememberRoute(product, pathname);
    document.documentElement.dataset.product = product;
    document.documentElement.dataset.theme = theme;
    document.body.style.backgroundColor = 'var(--app-bg)';
  }, [pathname, product, rememberRoute, setCurrentProduct, theme]);

  const sidebar = (
    <aside className="flex h-full w-full flex-col rounded-none border-r border-[color:var(--app-border)] bg-[var(--app-sidebar)] px-5 py-5 text-[color:var(--app-text)] shadow-[0_18px_48px_rgba(15,23,42,0.08)] md:max-w-[280px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          {logo}
          {subtitle ? (
            <p className="mt-1 text-xs tracking-[0.12em] text-[color:var(--app-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="rounded-2xl p-2 text-[color:var(--app-muted)] transition hover:bg-[var(--app-hover)] md:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {searchPlaceholder ? (
        <label className="relative mb-6 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-muted)]" />
          <input
            value={searchValue ?? ''}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-input-bg)] py-3 pl-11 pr-4 text-sm text-[color:var(--app-text)] outline-none transition placeholder:text-[color:var(--app-muted)] focus:border-[color:var(--app-accent)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]"
          />
        </label>
      ) : null}

      <nav className="space-y-1">
        {navItems.map((item) => (
          <SidebarItem
            key={item.key}
            icon={item.icon}
            isActive={item.key === activeKey}
            label={item.label}
            onClick={() => {
              setMobileSidebarOpen(false);
              router.push(item.href);
            }}
            accent={product === 'pocket-tracker' ? 'wealth' : 'task2do'}
          />
        ))}
      </nav>

      {sidebarSection ? <div className="mt-8 flex-1">{sidebarSection}</div> : <div className="flex-1" />}

      {product === 'pocket-tracker' ? (
        <button
          type="button"
          onClick={toggleWealthTheme}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-panel)] px-4 py-3 text-sm font-medium text-[color:var(--app-text)] transition hover:bg-[var(--app-hover)]"
        >
          {wealthTheme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          <span>{wealthTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      ) : null}

      {sidebarFooter}

      <div className="mt-4 rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-panel)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-profile-chip)] text-sm font-semibold">
            {profile.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile.name}</p>
            <p className="truncate text-xs text-[color:var(--app-muted)]">{profile.subtitle}</p>
            {profile.badge ? (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-accent)]">
                {profile.badge}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[color:var(--app-text)]">
      <div className="flex min-h-screen">
        <div className="hidden h-screen w-[280px] shrink-0 md:block">{sidebar}</div>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm md:hidden" onClick={() => setMobileSidebarOpen(false)}>
            <div
              className="h-full w-[286px]"
              onClick={(event) => event.stopPropagation()}
            >
              {sidebar}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[color:var(--app-border)] bg-[color:var(--app-header)]/90 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 md:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-panel)] p-2.5 transition hover:bg-[var(--app-hover)] md:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--app-muted)]">
                  Premium Workspace
                </span>
              </div>

              <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[var(--app-panel)] p-1 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
                <button
                  type="button"
                  onClick={() => router.push(lastRouteByProduct.task2do || DEFAULT_ROUTES.task2do)}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
                    product === 'task2do'
                      ? 'bg-[var(--switcher-active-bg)] text-[var(--switcher-active-text)]'
                      : 'text-[color:var(--app-muted)] hover:bg-[var(--app-hover)]'
                  )}
                >
                  Task2Do
                </button>
                <button
                  type="button"
                  onClick={() => router.push(lastRouteByProduct['pocket-tracker'] || DEFAULT_ROUTES['pocket-tracker'])}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
                    product === 'pocket-tracker'
                      ? 'bg-[var(--switcher-active-bg)] text-[var(--switcher-active-text)]'
                      : 'text-[color:var(--app-muted)] hover:bg-[var(--app-hover)]'
                  )}
                >
                  Pocket Tracker
                </button>
              </div>

              <button
                type="button"
                className="hidden rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text)] transition hover:bg-[var(--app-hover)] md:inline-flex md:items-center md:gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Premium Demo
              </button>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  accent: 'wealth' | 'task2do';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition',
        isActive
          ? accent === 'wealth'
            ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] shadow-[0_14px_34px_rgba(37,99,235,0.18)]'
            : 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] shadow-[0_14px_34px_rgba(109,77,255,0.14)]'
          : 'text-[color:var(--app-text)] hover:bg-[var(--app-hover)]'
      )}
    >
      <Icon className={cn('h-4.5 w-4.5 shrink-0', isActive ? 'text-current' : 'text-[color:var(--app-muted)]')} />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function PanelCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-[color:var(--app-border)] bg-[var(--app-panel)] shadow-[0_22px_60px_rgba(15,23,42,0.08)]',
        className
      )}
    >
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  className,
  children,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <PanelCard className={cn('p-5', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-muted)]">
        {label}
      </p>
      <p className="mt-3 text-[clamp(28px,3vw,42px)] font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
        {value}
      </p>
      {delta ? (
        <span
          className={cn(
            'mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold',
            deltaTone === 'positive'
              ? 'bg-emerald-500/12 text-emerald-300 dark:text-emerald-300'
              : deltaTone === 'negative'
                ? 'bg-rose-500/12 text-rose-300 dark:text-rose-300'
                : 'bg-slate-500/12 text-[color:var(--app-muted)]'
          )}
        >
          {delta}
        </span>
      ) : null}
      {children}
    </PanelCard>
  );
}

export function EmptyPreview({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <PanelCard className="flex min-h-[360px] items-center justify-center p-10">
      <div className="max-w-lg text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
          {eyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--app-text-strong)]">
          {title}
        </h2>
        <p className="mt-4 text-base leading-7 text-[color:var(--app-muted)]">
          {description}
        </p>
      </div>
    </PanelCard>
  );
}
