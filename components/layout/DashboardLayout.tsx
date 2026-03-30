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
import { AlertTriangle, Bell, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PublicDatabaseError } from '@/db/errors';

export function DashboardLayout() {
  const pathname = usePathname();
  const { isSidebarOpen, isRightPaneOpen, toggleSidebar, isCollapsed, setTasks, setLists, selectedTaskId, user, isAuthReady, setCurrentView, setSelectedListId, tasks, lists } = useStore();
  const [databaseError, setDatabaseError] = useState<PublicDatabaseError | null>(null);

  // Fetch data only when auth is ready, user exists, and we don't already have cached data
  useEffect(() => {
    if (isAuthReady && user) {
      let isMounted = true;
      queueMicrotask(() => {
        if (isMounted) {
          setDatabaseError(null);
        }
      });

      // Only fetch tasks if we don't already have them cached
      if (tasks.length === 0) {
        getTasks(user.id)
          .then((result) => {
            if (!isMounted) return;

            if (!result.ok) {
              console.error('Failed to get tasks:', result.error);
              setTasks([]);
              setDatabaseError(result.error);
              return;
            }

            setTasks(result.data as Task[]);
          })
          .catch((error) => {
            if (!isMounted) return;
            console.error('Unhandled task fetching error:', error);
            setDatabaseError({
              code: 'DB_UNAVAILABLE',
              message: 'An unexpected connection error occurred. Please refresh the page.'
            });
          });
      }
      
      // Only fetch lists if we don't already have them cached
      if (lists.length === 0) {
        getLists(user.id)
          .then((result) => {
            if (!isMounted) return;

            if (!result.ok) {
              console.error('Failed to get lists:', result.error);
              setLists([]);
              setDatabaseError((currentError) => currentError ?? result.error);
              return;
            }

            setLists(result.data as List[]);
          })
          .catch((error) => {
            if (!isMounted) return;
            console.error('Unhandled list fetching error:', error);
            setDatabaseError((currentError) => currentError ?? {
              code: 'DB_UNAVAILABLE',
              message: 'An unexpected connection error occurred. Please refresh the page.'
            });
          });
      }

      return () => {
        isMounted = false;
      };
    } else if (isAuthReady && !user) {
      // Clear data when user logs out
      setTasks([]);
      setLists([]);
      queueMicrotask(() => {
        setDatabaseError(null);
      });
    }
  }, [setTasks, setLists, user, isAuthReady, tasks.length, lists.length]);

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface text-on-surface">
      <NotificationManager />
      
      {/* Left Sidebar */}
      <div
        className={cn(
          "h-full transition-all duration-500 ease-in-out flex-shrink-0 z-40",
          isSidebarOpen ? (isCollapsed ? "w-20 opacity-100" : "w-[260px] opacity-100") : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Mobile Header */}
        <header className="md:hidden flex justify-between items-center w-full px-8 py-6 bg-white z-50 border-b border-outline-variant/10">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
              <Menu className="w-5 h-5 text-outline/60" />
            </button>
            <span className="text-2xl font-light tracking-tight text-primary font-headline italic">Task2Do</span>
          </div>
          <div className="flex gap-5 items-center">
            <Bell className="w-5 h-5 text-outline/60 cursor-pointer hover:text-primary transition-colors" />
            <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline font-medium text-xs shadow-sm overflow-hidden">
              {user?.displayName ? user.displayName[0] : 'U'}
            </div>
          </div>
        </header>

        {/* Center Pane */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300">
          {databaseError && (
            <div className="px-6 pt-6 pb-0 md:px-10">
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

      {/* Right Pane */}
      <div
        className={cn(
          "h-full bg-surface-container-low border-l-2 border-transparent transition-all duration-300 ease-in-out-expo z-20 flex-shrink-0 overflow-hidden",
          isRightPaneOpen ? "w-96 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <RightPane key={selectedTaskId} />
      </div>
    </div>
  );
}
