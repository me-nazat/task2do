'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { RightPane } from './RightPane';
import { cn } from '@/lib/utils';
import { getTasks } from '@/actions/task';

export function DashboardLayout() {
  const { isSidebarOpen, isRightPaneOpen, setTasks, selectedTaskId } = useStore();

  useEffect(() => {
    getTasks().then((tasks) => {
      setTasks(tasks);
    });
  }, [setTasks]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground p-3 gap-3">
      {/* Left Sidebar */}
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out flex-shrink-0",
          isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <Sidebar />
      </div>

      {/* Center Pane */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-card rounded-3xl shadow-sm border border-border/40 overflow-hidden transition-all duration-300">
        <MainContent />
      </div>

      {/* Right Pane */}
      <div
        className={cn(
          "h-full bg-card rounded-3xl shadow-sm border border-border/40 transition-all duration-300 ease-in-out z-20 flex-shrink-0 overflow-hidden",
          isRightPaneOpen ? "w-80 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <RightPane key={selectedTaskId} />
      </div>
    </div>
  );
}
