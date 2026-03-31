import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ProductKey = 'task2do' | 'pocket-tracker';
export type WealthTheme = 'dark' | 'light';

export const DEFAULT_ROUTES: Record<ProductKey, string> = {
  task2do: '/task2do/ai-chat',
  'pocket-tracker': '/pocket-tracker/dashboard',
};

export const APP_SHELL_STORAGE_KEY = 'dual-dashboard-shell';

interface ShellState {
  currentProduct: ProductKey;
  lastRouteByProduct: Record<ProductKey, string>;
  wealthTheme: WealthTheme;
  mobileSidebarOpen: boolean;
  setCurrentProduct: (product: ProductKey) => void;
  rememberRoute: (product: ProductKey, route: string) => void;
  setWealthTheme: (theme: WealthTheme) => void;
  toggleWealthTheme: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      currentProduct: 'task2do',
      lastRouteByProduct: { ...DEFAULT_ROUTES },
      wealthTheme: 'dark',
      mobileSidebarOpen: false,
      setCurrentProduct: (product) => set({ currentProduct: product }),
      rememberRoute: (product, route) =>
        set((state) => ({
          currentProduct: product,
          lastRouteByProduct: {
            ...state.lastRouteByProduct,
            [product]: route,
          },
        })),
      setWealthTheme: (theme) => set({ wealthTheme: theme }),
      toggleWealthTheme: () =>
        set((state) => ({ wealthTheme: state.wealthTheme === 'dark' ? 'light' : 'dark' })),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
    }),
    {
      name: APP_SHELL_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentProduct: state.currentProduct,
        lastRouteByProduct: state.lastRouteByProduct,
        wealthTheme: state.wealthTheme,
      }),
    }
  )
);
