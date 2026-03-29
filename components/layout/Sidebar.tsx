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

  const { currentView, setCurrentView, selectedListId, setSelectedListId, searchQuery, setSearchQuery, lists, user, addList, isCollapsed, toggleCollapsed, isAuthModalOpen, setAuthModalOpen } = useStore();
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
      "flex flex-col h-full py-6 bg-surface-container-low shrink-0 border-r border-outline-variant/30 relative transition-all duration-500 ease-in-out whitespace-nowrap overflow-x-hidden", 
      isCollapsed ? "px-4 w-20" : "px-8 w-[260px]"
    )}>
      <button 
        onClick={toggleCollapsed} 
        className="absolute top-4 right-4 p-1.5 hover:bg-surface-container-high rounded-md text-outline hover:text-primary transition-colors z-10"
      >
        {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>

      <div className={cn("mb-8 transition-all duration-500", isCollapsed ? "mt-6": "")}>
        <div className={cn("transition-all duration-500 ease-in-out font-headline italic text-primary", isCollapsed ? "text-xl text-center font-bold" : "text-3xl font-light tracking-tight")}>
          {isCollapsed ? "T" : "Task2Do"}
        </div>
        <div className={cn("font-label uppercase tracking-[0.25em] text-[8px] font-bold text-outline mt-1 transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-70 h-auto")}>
          Strategy & Focus
        </div>
      </div>

      <div className={cn("mb-6 relative transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 h-0 overflow-hidden mb-0" : "opacity-100 h-10")}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..." 
            className="w-full bg-surface-container-high/70 border border-outline-variant/30 rounded-md focus:ring-1 focus:ring-primary/20 text-xs font-body pl-10 pr-4 py-2.5 placeholder:text-on-surface-variant/70 placeholder:font-medium transition-all"
          />
        </div>

      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden hide-scrollbar">
        <div>
          <span className={cn("font-label uppercase tracking-[0.2em] text-[9px] font-bold text-outline/60 block transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 h-0 overflow-hidden mb-0" : "opacity-100 h-auto mb-3 px-4")}>Navigation</span>
          <div className="space-y-1 flex flex-col items-center w-full">
            {coreNav.map((item) => {
              const isActive = currentView === 'list' 
                ? (item.view === 'list' && selectedListId === item.id) 
                : (item.view === currentView);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    // Update state optimistically for snappy UI
                    if (item.view === 'list') {
                      setSelectedListId(item.id);
                    }
                    setCurrentView(item.view as any);
                    window.history.pushState(null, '', `/${item.id}`);
                  }}
                  className={cn(
                    "flex items-center gap-3 font-body text-sm rounded-lg group",
                    "transition-[background-color,color,font-weight,box-shadow,transform] duration-200 ease-out",
                    "active:scale-[0.97]",
                    isCollapsed ? "w-12 h-12 justify-center px-0 mb-0.5" : "w-full py-2 px-4",
                    isActive
                      ? "bg-primary text-on-primary font-medium shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                  )}
                >
                  <item.icon className={cn("shrink-0 transition-colors duration-200", isCollapsed ? "w-5 h-5" : "w-4 h-4", isActive ? "text-on-primary" : "text-outline group-hover:text-primary")} />
                  <span className={cn("truncate transition-all duration-300 ease-in-out", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto ml-1")}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center w-full">
          <div className={cn("flex items-center justify-between w-full transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 h-0 overflow-hidden mb-0" : "opacity-100 h-auto mb-3 px-4 mt-4")}>
            <span className="font-label uppercase tracking-[0.2em] text-[9px] font-bold text-outline/60">Collections</span>
            <button 
              onClick={() => setIsAddListModalOpen(true)}
              className="p-1 hover:bg-surface-container-high rounded-full text-outline hover:text-primary transition-colors"
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
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-4 font-body text-lg focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-primary text-on-primary py-4 rounded-xl font-label font-bold tracking-[0.2em] uppercase hover:bg-primary/90 transition-all shadow-md"
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
                onClick={() => {
                  setSelectedListId(list.id);
                  setCurrentView('list');
                  window.history.pushState(null, '', `/list/${list.id}`);
                }}
                className={cn(
                  "flex items-center gap-3 transition-all duration-500 text-sm font-body rounded-lg group",
                  isCollapsed ? "w-12 h-12 justify-center px-0 mb-1" : "w-full py-2 px-4",
                  selectedListId === list.id && currentView === 'list'
                    ? "text-primary font-semibold bg-surface-container-high"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                )}
              >
                <span className={cn("rounded-full shrink-0 transition-transform group-hover:scale-125", isCollapsed ? "w-3 h-3" : "w-2 h-2")} style={{ backgroundColor: list.color || 'var(--color-tertiary-container)' }}></span>
                <span className={cn("truncate transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto ml-1")}>{list.name}</span>
              </button>
            ))}
            {lists.length === 0 && (
              <div className={cn("py-2 text-[11px] font-body text-outline italic transition-all duration-500 ease-in-out w-full text-center", isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-auto px-4")}>
                No collections yet
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="mt-auto pt-8 border-t border-outline-variant/30 flex flex-col items-center">
        {user ? (
          <>
            <div className={cn("flex items-center transition-all duration-500 ease-in-out bg-surface-container-high/40 border border-outline-variant/10", isCollapsed ? "justify-center mb-6 w-12 h-12 rounded-full p-0" : "gap-4 px-4 py-3 mb-6 w-full rounded-lg h-16")}>
              <div className={cn("rounded-full bg-primary text-on-primary flex items-center justify-center font-headline shadow-sm overflow-hidden shrink-0 transition-all duration-500", isCollapsed ? "w-10 h-10 text-sm font-bold" : "w-10 h-10 font-medium text-sm")}>
                {user.displayName ? user.displayName[0] : 'U'}
              </div>
              <div className={cn("flex-1 min-w-0 transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto")}>
                 <div className="text-[11px] font-label font-bold tracking-tight truncate">{user.displayName || 'User'}</div>
                 <div className="text-[9px] font-label font-medium text-outline uppercase tracking-[0.15em]">Pro Member</div>
              </div>
              <Settings className={cn("text-outline hover:text-primary cursor-pointer shrink-0 transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 w-0 hidden" : "w-4 h-4 opacity-100 w-auto")} />
            </div>
            <button 
              onClick={handleLogout}
              className={cn("mt-4 flex items-center gap-3 text-on-surface-variant font-body uppercase tracking-[0.1em] text-[10px] font-semibold hover:text-primary transition-all duration-500 rounded-lg cursor-pointer", isCollapsed ? "w-12 h-12 justify-center px-0 mb-1" : "w-full py-3 px-4")}
            >
              <LogOut className={cn("shrink-0 transition-all duration-500", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
              <span className={cn("transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto")}>Logout</span>
            </button>
          </>
        ) : (
          <button 
            onClick={handleLogin}
            className={cn("flex items-center gap-3 text-primary font-body uppercase tracking-[0.1em] text-[10px] font-semibold hover:bg-primary/10 transition-all duration-500 rounded-lg cursor-pointer", isCollapsed ? "w-12 h-12 justify-center px-0" : "w-full py-3 px-4")}
          >
            <LogIn className={cn("shrink-0 transition-all duration-500", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
            <span className={cn("transition-all duration-500 ease-in-out", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto")}>Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );
}
