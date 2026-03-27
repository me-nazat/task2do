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
  LogOut,
  Search,
  Clock,
  Star,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { currentView, setCurrentView, selectedListId, setSelectedListId, searchQuery, setSearchQuery, lists } = useStore();

  const coreNav = [
    { id: 'inbox', label: 'INBOX', icon: Inbox, view: 'list' },
    { id: 'today', label: 'TODAY', icon: Clock, view: 'today' },
    { id: 'upcoming', label: 'UPCOMING', icon: Star, view: 'upcoming' },
    { id: 'someday', label: 'SOMEDAY', icon: Folder, view: 'list' },
    { id: 'matrix', label: 'MATRIX', icon: LayoutDashboard, view: 'matrix' },
    { id: 'kanban', label: 'KANBAN', icon: LayoutDashboard, view: 'kanban' },
    { id: 'habits', label: 'HABITS', icon: CheckSquare, view: 'habits' },
    { id: 'calendar', label: 'SCHEDULE', icon: Calendar, view: 'calendar' },
  ];

  return (
    <aside className="flex flex-col h-full py-12 px-6 bg-surface-container-low w-64 shrink-0 border-r-2 border-transparent">
      <div className="mb-12">
        <div className="text-lg font-bold tracking-widest text-primary font-headline uppercase">TASK2DO</div>
        <div className="font-headline uppercase tracking-[0.3em] text-[10px] font-medium text-outline">STRATEGY & FOCUS</div>
      </div>

      <div className="mb-8 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="SEARCH" 
          className="w-full bg-surface-container-high border-none focus:ring-1 focus:ring-primary text-[10px] tracking-[0.2em] font-headline pl-10 pr-4 py-2.5 uppercase placeholder:text-outline"
        />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto hide-scrollbar">
        <div className="mb-8">
          <span className="font-headline uppercase tracking-[0.3em] text-[9px] font-bold text-outline mb-4 block">CORE</span>
          {coreNav.map((item) => {
            const isActive = (item.view === 'list' && selectedListId === item.id) || (item.view !== 'list' && currentView === item.view);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.view === 'list') {
                    setSelectedListId(item.id);
                  }
                  setCurrentView(item.view as any);
                }}
                className={cn(
                  "w-full flex items-center px-4 py-3 gap-3 font-headline uppercase tracking-[0.3em] text-[10px] transition-all duration-300 ease-in-out-expo active:scale-95",
                  isActive
                    ? "bg-primary text-on-primary-fixed font-bold"
                    : "text-on-surface-variant font-medium hover:bg-surface-container-high"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          <span className="font-headline uppercase tracking-[0.3em] text-[9px] font-bold text-outline mb-4 block">COLLECTIONS</span>
          {lists.map((list) => (
            <button 
              key={list.id}
              onClick={() => {
                setSelectedListId(list.id);
                setCurrentView('list');
              }}
              className={cn(
                "w-full flex items-center px-4 py-2 gap-3 transition-colors text-[10px] font-headline uppercase tracking-[0.3em]",
                selectedListId === list.id && currentView === 'list'
                  ? "text-primary font-bold"
                  : "text-on-surface-variant hover:text-primary"
              )}
            >
              <span className="w-1.5 h-1.5" style={{ backgroundColor: list.color || 'var(--color-tertiary-container)' }}></span>
              <span>{list.name}</span>
            </button>
          ))}
          {lists.length === 0 && (
            <div className="px-4 py-2 text-[8px] font-headline uppercase tracking-[0.2em] text-outline italic">
              NO COLLECTIONS
            </div>
          )}
        </div>
      </nav>

      <div className="mt-auto pt-8 border-t border-outline-variant">
        <div className="flex items-center gap-4 px-4 py-4 mb-4 bg-surface-container-high">
          <div className="w-8 h-8 bg-primary text-on-primary-fixed flex items-center justify-center font-headline font-bold text-xs shrink-0">
            T2
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-headline font-black tracking-widest uppercase truncate">NAZATAL619</div>
            <div className="text-[8px] font-headline font-bold tracking-widest uppercase text-outline truncate">PRO PLAN</div>
          </div>
          <Settings className="w-4 h-4 text-outline hover:text-primary cursor-pointer transition-colors" />
        </div>
        <button 
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).focusQuickAdd) {
              (window as any).focusQuickAdd();
            }
          }}
          className="w-full bg-primary text-on-primary-fixed py-4 font-headline uppercase tracking-[0.4em] text-[10px] font-black hover:bg-primary-container transition-all duration-300 scale-100 hover:scale-[1.02] active:scale-95"
        >
          NEW TASK
        </button>
        <button className="w-full mt-4 flex items-center px-4 py-3 gap-3 text-on-surface-variant font-headline uppercase tracking-[0.3em] text-[10px] font-medium hover:text-primary transition-colors duration-200">
          <LogOut className="w-4 h-4" />
          <span>LOGOUT</span>
        </button>
      </div>
    </aside>
  );
}
