'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { APP_SHELL_STORAGE_KEY, DEFAULT_ROUTES, ProductKey } from '@/store/useShellStore';

type PersistedProductKey = ProductKey | 'wealth-ai';

type PersistedShellState = {
  state?: {
    currentProduct?: PersistedProductKey;
    lastRouteByProduct?: Partial<Record<PersistedProductKey, string>>;
  };
};

function getInitialRoute() {
  if (typeof window === 'undefined') {
    return DEFAULT_ROUTES.task2do;
  }

  try {
    const raw = window.localStorage.getItem(APP_SHELL_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_ROUTES.task2do;
    }

    const parsed = JSON.parse(raw) as PersistedShellState;
    const rawProduct = parsed.state?.currentProduct;
    const currentProduct: ProductKey =
      rawProduct === 'wealth-ai' ? 'pocket-tracker' : (rawProduct ?? 'task2do');
    const rememberedRoute =
      parsed.state?.lastRouteByProduct?.[currentProduct] ??
      (rawProduct === 'wealth-ai' ? parsed.state?.lastRouteByProduct?.['wealth-ai'] : undefined);

    return rememberedRoute || DEFAULT_ROUTES[currentProduct];
  } catch {
    return DEFAULT_ROUTES.task2do;
  }
}

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getInitialRoute());
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-[color:var(--app-text)]">
      <div className="rounded-[32px] border border-[color:var(--app-border)] bg-[var(--app-panel)] px-8 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--app-muted)]">
          Opening workspace
        </p>
      </div>
    </main>
  );
}
