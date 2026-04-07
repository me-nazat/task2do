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
  User,
  LogIn,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  CircleCheckBig
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';
import { AuthModal } from '@/components/AuthModal';
import { useState } from 'react';
import { createList } from '@/actions/list';
import { Modal } from '@/components/ui/Modal';


export function Sidebar() {

  const { currentView, setCurrentView, selectedListId, setSelectedListId, searchQuery, setSearchQuery, lists, user, addList, isCollapsed, toggleCollapsed, isAuthModalOpen, setAuthModalOpen, closeMobileSidebar } = useStore();
  const [isAddListModalOpen, setIsAddListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newListName.trim()) return;

    try {
      const id = unwrapDatabaseResult(await createList(newListName.trim(), user.id));
      addList({ id, name: newListName.trim(), userId: user.id, color: '#3b82f6', isDefault: false, createdAt: new Date() });
      setNewListName('');
      setIsAddListModalOpen(false);
    } catch (error) {
      alert(getClientErrorMessage(error, 'Unable to create collection right now.'));
    }
  };

  const handleLogin = () => {
    setAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  const handleNavClick = (viewId: string, view: string) => {
    if (view === 'list') {
      setSelectedListId(viewId);
    }
    setCurrentView(view as any);
    window.history.pushState(null, '', `/${viewId}`);
    // Close drawer on mobile
    closeMobileSidebar();
  };

  const handleListClick = (listId: string) => {
    setSelectedListId(listId);
    setCurrentView('list');
    window.history.pushState(null, '', `/list/${listId}`);
    closeMobileSidebar();
  };

  const coreNav = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, view: 'list' },
    { id: 'today', label: 'Today', icon: Clock, view: 'today' },
    { id: 'upcoming', label: 'Upcoming', icon: Star, view: 'upcoming' },
    { id: 'ai-chat', label: 'AI Chat', icon: Sparkles, view: 'ai-chat' },
    { id: 'calendar', label: 'Schedule', icon: Calendar, view: 'calendar' },
    { id: 'kanban', label: 'Kanban', icon: LayoutDashboard, view: 'kanban' },
    { id: 'matrix', label: 'Matrix', icon: LayoutDashboard, view: 'matrix' },
    { id: 'habits', label: 'Habits', icon: CheckSquare, view: 'habits' },
    { id: 'completed-reminders', label: 'Completed & Alerts', icon: CircleCheckBig, view: 'completed-reminders' },
  ];

  return (
    <aside className={cn(
      "relative flex h-full shrink-0 flex-col whitespace-nowrap overflow-x-hidden border-r transition-all duration-500 ease-in-out",
      "rounded-r-[2rem] border-white/50 bg-white/80 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl pt-safe pb-safe",
      "lg:rounded-none lg:border-outline-variant/30 lg:bg-surface-container-low lg:shadow-none lg:backdrop-blur-none",
      /* Mobile: always expanded full-width */
      "w-full px-4 sm:px-6",
      /* Desktop: respect collapsed state */
      "lg:w-auto",
      isCollapsed ? "lg:px-4 lg:w-20" : "lg:px-8 lg:w-[260px]"
    )}>
      {/* Collapse button — desktop only */}
      <button 
        onClick={toggleCollapsed} 
        className="absolute top-4 right-4 z-10 hidden rounded-md p-1.5 text-outline transition-colors lg:flex lg:hover:bg-surface-container-high lg:hover:text-primary"
      >
        {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>

      <div className={cn("mb-8 transition-all duration-500", isCollapsed ? "lg:mt-6": "")}>
        <div className={cn("transition-all duration-500 ease-in-out font-headline italic text-primary", isCollapsed ? "lg:text-xl lg:text-center lg:font-bold text-3xl font-light tracking-tight" : "text-3xl font-light tracking-tight")}>
          <span className="lg:hidden">Task2Do</span>
          <span className="hidden lg:inline">{isCollapsed ? "T" : "Task2Do"}</span>
        </div>
        <div className={cn("font-label uppercase tracking-[0.25em] text-[8px] font-bold text-outline mt-1 transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:h-0 lg:overflow-hidden opacity-70 h-auto" : "opacity-70 h-auto")}>
          Strategy & Focus
        </div>
      </div>

      <div className={cn("mb-6 relative transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:h-0 lg:overflow-hidden lg:mb-0 opacity-100 h-10" : "opacity-100 h-10")}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..." 
            className="w-full rounded-md border border-outline-variant/30 bg-white/70 py-2.5 pl-10 pr-4 font-body text-base transition-all placeholder:font-medium placeholder:text-on-surface-variant/70 focus:ring-1 focus:ring-primary/20 sm:text-sm lg:bg-surface-container-high/70 lg:text-xs"
          />
        </div>

      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden hide-scrollbar">
        <div>
          <span className={cn("font-label uppercase tracking-[0.2em] text-[9px] font-bold text-outline/60 block transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:h-0 lg:overflow-hidden lg:mb-0 opacity-100 h-auto mb-3 px-4" : "opacity-100 h-auto mb-3 px-4")}>Navigation</span>
          <div className="space-y-1 flex flex-col items-center w-full">
            {coreNav.map((item) => {
              const isActive = currentView === 'list' 
                ? (item.view === 'list' && selectedListId === item.id) 
                : (item.view === currentView);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id, item.view)}
                  className={cn(
                    "flex items-center gap-3 font-body text-sm rounded-lg group touch-target",
                    "transition-[background-color,color,font-weight,box-shadow,transform] duration-200 ease-out",
                    "active:scale-[0.97]",
                    /* Mobile: always full width */
                    "w-full py-2.5 px-4",
                    /* Desktop: respect collapsed state */
                    isCollapsed ? "lg:w-12 lg:h-12 lg:justify-center lg:px-0 lg:mb-0.5" : "lg:w-full lg:py-2 lg:px-4",
                    isActive
                      ? "bg-primary text-on-primary font-medium shadow-sm"
                      : "text-on-surface-variant active:bg-surface-container-high active:text-primary lg:hover:bg-surface-container-high lg:hover:text-primary"
                  )}
                >
                  <item.icon className={cn("shrink-0 transition-colors duration-200", isCollapsed ? "lg:w-5 lg:h-5 w-4 h-4" : "w-4 h-4", isActive ? "text-on-primary" : "text-outline group-hover:text-primary")} />
                  <span className={cn("truncate transition-all duration-300 ease-in-out", isCollapsed ? "lg:opacity-0 lg:w-0 lg:hidden opacity-100 w-auto ml-1" : "opacity-100 w-auto ml-1")}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center w-full">
          <div className={cn("flex items-center justify-between w-full transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:h-0 lg:overflow-hidden lg:mb-0 opacity-100 h-auto mb-3 px-4 mt-4" : "opacity-100 h-auto mb-3 px-4 mt-4")}>
            <span className="font-label uppercase tracking-[0.2em] text-[9px] font-bold text-outline/60">Collections</span>
            <button 
              onClick={() => setIsAddListModalOpen(true)}
              className="touch-target rounded-full p-1 text-outline transition-colors active:bg-surface-container-high active:text-primary lg:hover:bg-surface-container-high lg:hover:text-primary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <Modal 
            isOpen={isAddListModalOpen} 
            onClose={() => setIsAddListModalOpen(false)}
            title="New Collection"
          >
            <form onSubmit={handleAddList} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-label font-bold tracking-[0.2em] uppercase text-outline/60">Collection Name</label>
                <input 
                  autoFocus
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Personal Projects"
                  className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-5 py-4 font-body text-base transition-all focus:ring-2 focus:ring-primary/20 sm:text-lg"
                />
              </div>
              <button 
                type="submit"
                className="w-full rounded-xl bg-primary py-4 font-label font-bold uppercase tracking-[0.2em] text-on-primary shadow-md transition-all active:scale-[0.99] lg:hover:bg-primary/90"
              >
                Create Collection
              </button>
            </form>
          </Modal>
          <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />
          <div className="space-y-1 w-full flex flex-col items-center">
            {lists.map((list) => (
              <button 
                key={list.id}
                onClick={() => handleListClick(list.id)}
                className={cn(
                  "flex items-center gap-3 transition-all duration-500 text-sm font-body rounded-lg group touch-target",
                  /* Mobile: always full width */
                  "w-full py-2.5 px-4",
                  /* Desktop: respect collapsed state */
                  isCollapsed ? "lg:w-12 lg:h-12 lg:justify-center lg:px-0 lg:mb-1" : "lg:w-full lg:py-2 lg:px-4",
                  selectedListId === list.id && currentView === 'list'
                    ? "text-primary font-semibold bg-surface-container-high"
                    : "text-on-surface-variant active:bg-surface-container-high active:text-primary lg:hover:bg-surface-container-high lg:hover:text-primary"
                )}
              >
                <span className={cn("rounded-full shrink-0 transition-transform group-hover:scale-125", isCollapsed ? "lg:w-3 lg:h-3 w-2 h-2" : "w-2 h-2")} style={{ backgroundColor: list.color || 'var(--color-tertiary-container)' }}></span>
                <span className={cn("truncate transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:w-0 lg:hidden opacity-100 w-auto ml-1" : "opacity-100 w-auto ml-1")}>{list.name}</span>
              </button>
            ))}
            {lists.length === 0 && (
              <div className={cn("py-2 text-[11px] font-body text-outline italic transition-all duration-500 ease-in-out w-full text-center", isCollapsed ? "lg:opacity-0 lg:h-0 lg:overflow-hidden opacity-100 h-auto px-4" : "opacity-100 h-auto px-4")}>
                No collections yet
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="mt-auto pt-8 border-t border-outline-variant/30 flex flex-col items-center">
        {user ? (
          <>
            <div className={cn("flex items-center transition-all duration-500 ease-in-out bg-surface-container-high/40 border border-outline-variant/10", isCollapsed ? "lg:justify-center lg:mb-6 lg:w-12 lg:h-12 lg:rounded-full lg:p-0 gap-4 px-4 py-3 mb-6 w-full rounded-lg h-16" : "gap-4 px-4 py-3 mb-6 w-full rounded-lg h-16")}>
              <div className={cn("rounded-full bg-primary text-on-primary flex items-center justify-center font-headline shadow-sm overflow-hidden shrink-0 transition-all duration-500", isCollapsed ? "lg:w-10 lg:h-10 lg:text-sm lg:font-bold w-10 h-10 font-medium text-sm" : "w-10 h-10 font-medium text-sm")}>
                {user.displayName ? user.displayName[0] : 'U'}
              </div>
              <div className={cn("flex-1 min-w-0 transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:w-0 lg:hidden opacity-100 w-auto" : "opacity-100 w-auto")}>
                 <div className="text-[11px] font-label font-bold tracking-tight truncate">{user.displayName || 'User'}</div>
                 <div className="text-[9px] font-label font-medium text-outline uppercase tracking-[0.15em]">Pro Member</div>
              </div>
              <Settings className={cn("cursor-pointer shrink-0 text-outline transition-all duration-500 ease-in-out active:text-primary lg:hover:text-primary", isCollapsed ? "lg:opacity-0 lg:w-0 lg:hidden w-4 h-4 opacity-100" : "w-4 h-4 opacity-100")} />
            </div>
            <button 
              onClick={handleLogout}
              className={cn("mt-4 flex items-center gap-3 rounded-lg font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant transition-all duration-500 cursor-pointer touch-target active:text-primary lg:hover:text-primary", isCollapsed ? "lg:w-12 lg:h-12 lg:justify-center lg:px-0 lg:mb-1 w-full py-3 px-4" : "w-full py-3 px-4")}
            >
              <LogOut className={cn("shrink-0 transition-all duration-500", isCollapsed ? "lg:w-5 lg:h-5 w-4 h-4" : "w-4 h-4")} />
              <span className={cn("transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:w-0 lg:hidden opacity-100 w-auto" : "opacity-100 w-auto")}>Logout</span>
            </button>
          </>
        ) : (
          <button 
            onClick={handleLogin}
            className={cn("flex items-center gap-3 rounded-lg font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-primary transition-all duration-500 cursor-pointer touch-target active:bg-primary/10 lg:hover:bg-primary/10", isCollapsed ? "lg:w-12 lg:h-12 lg:justify-center lg:px-0 w-full py-3 px-4" : "w-full py-3 px-4")}
          >
            <LogIn className={cn("shrink-0 transition-all duration-500", isCollapsed ? "lg:w-5 lg:h-5 w-4 h-4" : "w-4 h-4")} />
            <span className={cn("transition-all duration-500 ease-in-out", isCollapsed ? "lg:opacity-0 lg:w-0 lg:hidden opacity-100 w-auto" : "opacity-100 w-auto")}>Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );
}
