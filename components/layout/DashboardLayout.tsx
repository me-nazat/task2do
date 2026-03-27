'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { RightPane } from './RightPane';
import { cn } from '@/lib/utils';
import { getTasks } from '@/actions/task';
import { getLists } from '@/actions/list';
import { NotificationManager } from '@/components/NotificationManager';
import { Task, List } from '@/store/useStore';
import { Settings, Bell, Search, Menu } from 'lucide-react';

export function DashboardLayout() {
  const { isSidebarOpen, isRightPaneOpen, toggleSidebar, setTasks, setLists, selectedTaskId, user, isAuthReady } = useStore();

  useEffect(() => {
    if (isAuthReady && user) {
      getTasks(user.id)
        .then((tasks) => {
          setTasks(tasks as Task[]);
        })
        .catch((error) => {
          console.error('Failed to get tasks', error);
          setTasks([]);
        });
      getLists(user.id)
        .then((lists) => {
          setLists(lists as List[]);
        })
        .catch((error) => {
          console.error('Failed to get lists', error);
          setLists([]);
        });
    } else if (isAuthReady && !user) {
      setTasks([]);
      setLists([]);
    }
  }, [setTasks, setLists, user, isAuthReady]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface text-on-surface">
      <NotificationManager />
      
      {/* Left Sidebar */}
      <div
        className={cn(
          "h-full transition-all duration-500 ease-in-out flex-shrink-0 z-40",
          isSidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 overflow-hidden"
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
