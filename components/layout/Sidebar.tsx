'use client';

import { useStore } from '@/store/useStore';
import { 
  Calendar, 
  CheckSquare, 
  Inbox, 
  LayoutDashboard, 
  ListTodo, 
  Settings, 
  Trash2, 
  Folder,
  Plus,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { currentView, setCurrentView, selectedListId, setSelectedListId } = useStore();

  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, view: 'list' },
    { id: 'today', label: 'Today', icon: Calendar, view: 'list' },
    { id: 'next-7-days', label: 'Next 7 Days', icon: Calendar, view: 'list' },
  ];

  const views = [
    { id: 'list', label: 'List View', icon: ListTodo },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'matrix', label: 'Matrix', icon: LayoutDashboard },
    { id: 'kanban', label: 'Kanban', icon: LayoutDashboard },
    { id: 'habits', label: 'Habits', icon: CheckSquare },
  ];

  return (
    <div className="flex flex-col h-full py-4 px-3">
      {/* User Profile / Search */}
      <div className="flex items-center gap-2 mb-6 px-2">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
          T2
        </div>
        <span className="font-semibold flex-1">Task2Do</span>
        <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground">
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Smart Lists */}
      <div className="space-y-1 mb-6">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setSelectedListId(item.id);
              setCurrentView(item.view as any);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors",
              selectedListId === item.id 
                ? "bg-primary/15 text-primary" 
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <item.icon className={cn("w-4 h-4", selectedListId === item.id ? "fill-primary/20" : "")} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Views */}
      <div className="mb-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Views
      </div>
      <div className="space-y-1 mb-6">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setCurrentView(view.id as any)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors",
              currentView === view.id 
                ? "bg-primary/15 text-primary" 
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <view.icon className={cn("w-4 h-4", currentView === view.id ? "fill-primary/20" : "")} />
            {view.label}
          </button>
        ))}
      </div>

      {/* Custom Lists */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Lists
          </span>
          <button className="p-1 hover:bg-muted/50 rounded-full text-muted-foreground transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          {/* Placeholder for custom lists */}
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <Folder className="w-4 h-4" />
            Work
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            <Folder className="w-4 h-4" />
            Personal
          </button>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto pt-4 space-y-1">
        <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
          <Trash2 className="w-4 h-4" />
          Trash
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
}
