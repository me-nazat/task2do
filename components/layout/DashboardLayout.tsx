'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { RightPane } from './RightPane';
import { cn } from '@/lib/utils';
import { getTasks } from '@/actions/task';
import { getLists } from '@/actions/list';
import { NotificationManager } from '@/components/NotificationManager';
import { Task, List } from '@/store/useStore';
import { AlertTriangle, Bell, Calendar, Clock, Inbox, Menu, MoreHorizontal, Plus, Sparkles, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PublicDatabaseError } from '@/db/errors';
import { AnimatePresence, motion } from 'motion/react';

export function DashboardLayout() {
  const pathname = usePathname();
  const {
    isSidebarOpen,
    isRightPaneOpen,
    toggleSidebar,
    isCollapsed,
    setTasks,
    setLists,
    selectedListId,
    selectedTaskId,
    selectedTaskOccurrenceDate,
    user,
    isAuthReady,
    setCurrentView,
    setSelectedListId,
    hydrateCachedData,
    isMobileSidebarOpen,
    toggleMobileSidebar,
    closeMobileSidebar,
    currentView,
    setCurrentViewMobile,
    setSelectedTaskId,
  } = useStore();
  const [databaseError, setDatabaseError] = useState<PublicDatabaseError | null>(null);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    let isMounted = true;

    if (!user) {
      setTasks([]);
      setLists([]);
      queueMicrotask(() => {
        setDatabaseError(null);
      });
      return () => {
        isMounted = false;
      };
    }

    const hasCachedData = hydrateCachedData(user.id);

    queueMicrotask(() => {
      if (isMounted) {
        setDatabaseError(null);
      }
    });

    Promise.all([getTasks(user.id), getLists(user.id)])
      .then(([taskResult, listResult]) => {
        if (!isMounted) {
          return;
        }

        if (!taskResult.ok) {
          console.error('Failed to get tasks:', taskResult.error);
          if (!hasCachedData) {
            setTasks([]);
          }
          setDatabaseError(taskResult.error);
        } else {
          setTasks(taskResult.data as Task[]);
        }

        if (!listResult.ok) {
          console.error('Failed to get lists:', listResult.error);
          if (!hasCachedData) {
            setLists([]);
          }
          setDatabaseError((currentError) => currentError ?? listResult.error);
        } else {
          setLists(listResult.data as List[]);
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error('Unhandled dashboard data fetching error:', error);
        if (!hasCachedData) {
          setTasks([]);
          setLists([]);
        }
        setDatabaseError({
          code: 'DB_UNAVAILABLE',
          message: 'An unexpected connection error occurred. Please refresh the page.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [hydrateCachedData, isAuthReady, setLists, setTasks, user]);

  useEffect(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
      setCurrentView('list');
      setSelectedListId('inbox');
    } else if (parts[0] === 'list' && parts[1]) {
      setCurrentView('list');
      setSelectedListId(parts[1]);
    } else {
      const viewId = parts[0];
      if (viewId === 'inbox') {
        setCurrentView('list');
        setSelectedListId('inbox');
      } else {
        const validViews = ['list', 'calendar', 'matrix', 'kanban', 'habits', 'today', 'upcoming', 'ai-chat', 'completed-reminders'];
        if (validViews.includes(viewId)) {
          setCurrentView(viewId as any);
        } else {
          // fallback to inbox if invalid path
          setCurrentView('list');
          setSelectedListId('inbox');
        }
      }
    }
  }, [pathname, setCurrentView, setSelectedListId]);

  const bottomTabs = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, view: 'list' as const, listId: 'inbox' },
    { id: 'today', label: 'Today', icon: Clock, view: 'today' as const, listId: null },
    { id: 'calendar', label: 'Schedule', icon: Calendar, view: 'calendar' as const, listId: null },
    { id: 'ai-chat', label: 'AI', icon: Sparkles, view: 'ai-chat' as const, listId: null },
  ];

  const isBottomTabActive = (tab: typeof bottomTabs[0]) => {
    if (tab.view === 'list') {
      return currentView === 'list' && (!selectedListId || selectedListId === 'inbox');
    }
    return currentView === tab.view;
  };

  return (
    <div className="flex h-[100svh] w-full overflow-hidden bg-surface text-on-surface">
      <NotificationManager />
      
      {/* ===== DESKTOP: Persistent Left Sidebar ===== */}
      <div
        className={cn(
          "h-full transition-all duration-500 ease-in-out flex-shrink-0 z-40",
          "hidden lg:block",
          isSidebarOpen ? (isCollapsed ? "w-20 opacity-100" : "w-[260px] opacity-100") : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <Sidebar />
      </div>

      {/* ===== MOBILE: Off-canvas drawer overlay ===== */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 mobile-drawer-backdrop lg:hidden"
              onClick={closeMobileSidebar}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 0.8 }}
              className="fixed inset-y-0 left-0 z-50 w-[min(23rem,88vw)] lg:hidden pl-safe pt-safe pb-safe pr-3 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-outline-variant/10 bg-white/85 px-4 py-3 backdrop-blur-xl pt-safe sm:px-6 lg:hidden">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={toggleMobileSidebar} className="touch-target flex items-center justify-center rounded-full p-2.5 text-outline/60 transition-colors active:scale-95 active:bg-surface-container-high lg:hover:bg-surface-container-high">
              <Menu className="w-5 h-5 text-outline/60" />
            </button>
            <div>
              <span className="block text-xl font-light tracking-tight text-primary font-headline italic sm:text-2xl">Task2Do</span>
              <span className="mt-0.5 block text-[9px] font-label font-bold uppercase tracking-[0.18em] text-outline/55">
                {currentView === 'calendar'
                  ? 'Schedule'
                  : currentView === 'today'
                    ? 'Today'
                    : currentView === 'ai-chat'
                      ? 'AI Chat'
                      : currentView === 'list' && (!selectedListId || selectedListId === 'inbox')
                        ? 'Inbox'
                        : 'Task2Do'}
              </span>
            </div>
          </div>
          <div className="flex gap-3 sm:gap-5 items-center">
            <button className="touch-target flex items-center justify-center rounded-full p-2.5 text-outline/60 transition-colors active:scale-95 active:bg-surface-container-high lg:hover:bg-surface-container-high">
              <Bell className="w-5 h-5 text-outline/60" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline font-medium text-xs shadow-sm overflow-hidden">
              {user?.displayName ? user.displayName[0] : 'U'}
            </div>
          </div>
        </header>

        {/* Center Pane */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300">
          {databaseError && (
            <div className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6 md:px-10">
              <AlertBanner
                title="Database connection issue"
                subtitle={databaseError.code.replace('DB_', '').replace('_', ' ')}
                icon={AlertTriangle}
                colorScheme="red"
              >
                <p className="text-sm font-body text-red-900/80 leading-relaxed">
                  {databaseError.message}
                </p>
                <p className="text-[10px] font-label font-bold uppercase tracking-[0.18em] text-red-700/70">
                  Refresh after updating the Turso and Vercel configuration.
                </p>
              </AlertBanner>
            </div>
          )}
          <MainContent />
        </div>
      </main>

      {/* ===== DESKTOP: Right Pane (side panel) ===== */}
      <div
        className={cn(
          "h-full bg-surface-container-low border-l-2 border-transparent transition-all duration-300 ease-in-out-expo z-20 flex-shrink-0 overflow-hidden",
          "hidden lg:block",
          isRightPaneOpen ? "w-96 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <RightPane key={`${selectedTaskId ?? 'none'}-${selectedTaskOccurrenceDate ?? 'series'}`} />
      </div>

      {/* ===== MOBILE: Right Pane (full-screen overlay) ===== */}
      <AnimatePresence>
        {isRightPaneOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 z-50 bg-surface-container-low lg:hidden pt-safe pb-safe"
          >
            {/* Mobile close header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
              <span className="text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/60">Details</span>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="touch-target flex items-center justify-center rounded-full p-2.5 text-outline/60 transition-all active:scale-95 active:bg-surface-container-high lg:hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden h-[calc(100%-52px)]">
              <RightPane key={`mobile-${selectedTaskId ?? 'none'}-${selectedTaskOccurrenceDate ?? 'series'}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MOBILE: Bottom Tab Bar ===== */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-100 bg-white/80 backdrop-blur-md pb-safe px-safe shadow-[0_-12px_40px_rgba(15,23,42,0.08)] lg:hidden">
        <div className="flex h-16 items-center justify-around px-2 sm:h-[4.5rem]">
          {bottomTabs.map((tab) => {
            const active = isBottomTabActive(tab);
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.listId) {
                    setCurrentViewMobile(tab.view, tab.listId);
                  } else {
                    setCurrentViewMobile(tab.view);
                  }
                  window.history.pushState(null, '', `/${tab.id}`);
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1 transition-all duration-200 touch-target no-select active:scale-95",
                  active
                    ? "text-primary"
                    : "text-outline/50 active:text-primary/70"
                )}
              >
                <tab.icon className={cn("w-5 h-5 transition-transform duration-200", active && "scale-110")} />
                <span className={cn("text-[9px] font-label font-bold tracking-[0.1em] uppercase", active && "text-primary")}>{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="bottomTabIndicator"
                    className="absolute bottom-1 w-5 h-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                  />
                )}
              </button>
            );
          })}
          {/* More button — opens the drawer */}
          <button
            onClick={toggleMobileSidebar}
            className="relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1 transition-all duration-200 touch-target no-select text-outline/50 active:scale-95 active:text-primary/70"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-label font-bold tracking-[0.1em] uppercase">More</span>
          </button>
        </div>
      </nav>

      {/* ===== MOBILE: Floating Action Button (FAB) ===== */}
      {currentView !== 'ai-chat' && currentView !== 'calendar' && (
        <button
          onClick={() => {
            // Find and click the quick add modal trigger
            const event = new CustomEvent('openAddModal');
            window.dispatchEvent(event);
          }}
          className="fixed right-5 bottom-[5.75rem] z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/25 transition-transform duration-150 active:scale-95 lg:hidden"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
