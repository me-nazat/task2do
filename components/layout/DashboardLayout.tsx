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
import { Settings, Bell, Search } from 'lucide-react';

export function DashboardLayout() {
  const { isSidebarOpen, isRightPaneOpen, setTasks, setLists, selectedTaskId } = useStore();

  useEffect(() => {
    getTasks().then((tasks) => {
      setTasks(tasks as Task[]);
    });
    getLists().then((lists) => {
      setLists(lists as List[]);
    });
  }, [setTasks, setLists]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface text-on-surface">
      <NotificationManager />
      
      {/* Left Sidebar */}
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out-expo flex-shrink-0 z-40",
          isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface-container-lowest">
        {/* Mobile Header */}
        <header className="md:hidden flex justify-between items-center w-full px-8 py-4 bg-surface-container-lowest z-50 border-b-2 border-transparent">
          <span className="text-2xl font-black tracking-tighter text-primary font-headline uppercase">TASK2DO</span>
          <div className="flex gap-4 items-center">
            <Bell className="w-5 h-5 text-primary cursor-pointer" />
            <div className="w-8 h-8 bg-primary text-on-primary-fixed flex items-center justify-center font-headline font-bold text-xs">
              T2
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
