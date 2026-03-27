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
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthModal } from '@/components/AuthModal';
import { useState } from 'react';
import { createList } from '@/actions/list';
import { Modal } from '@/components/ui/Modal';

export function Sidebar() {
  const { currentView, setCurrentView, selectedListId, setSelectedListId, searchQuery, setSearchQuery, lists, user, addList } = useStore();
  const [isAddListModalOpen, setIsAddListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newListName.trim()) return;
    
    const id = await createList(newListName.trim(), user.id);
    addList({ id, name: newListName.trim(), userId: user.id, color: '#3b82f6', isDefault: false, createdAt: new Date() });
    setNewListName('');
    setIsAddListModalOpen(false);
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  };

  const coreNav = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, view: 'list' },
    { id: 'today', label: 'Today', icon: Clock, view: 'today' },
    { id: 'upcoming', label: 'Upcoming', icon: Star, view: 'upcoming' },
    { id: 'someday', label: 'Someday', icon: Folder, view: 'list' },
    { id: 'matrix', label: 'Matrix', icon: LayoutDashboard, view: 'matrix' },
    { id: 'kanban', label: 'Kanban', icon: LayoutDashboard, view: 'kanban' },
    { id: 'habits', label: 'Habits', icon: CheckSquare, view: 'habits' },
    { id: 'calendar', label: 'Schedule', icon: Calendar, view: 'calendar' },
  ];

  return (
    <aside className="flex flex-col h-full py-12 px-8 bg-surface-container-low w-72 shrink-0 border-r border-outline-variant/30">
      <div className="mb-16">
        <div className="text-3xl font-light tracking-tight text-primary font-headline italic">Task2Do</div>
        <div className="font-label uppercase tracking-[0.25em] text-[8px] font-bold text-outline mt-1 opacity-70">Strategy & Focus</div>
      </div>

      <div className="mb-10 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline/60" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks..." 
          className="w-full bg-surface-container-high/50 border border-outline-variant/20 rounded-md focus:ring-1 focus:ring-primary/20 text-xs font-body pl-10 pr-4 py-2.5 placeholder:text-outline/50 transition-all"
        />
      </div>

      <nav className="flex-1 space-y-8 overflow-y-auto hide-scrollbar">
        <div>
          <span className="font-label uppercase tracking-[0.2em] text-[9px] font-bold text-outline/60 mb-5 block px-4">Navigation</span>
          <div className="space-y-1">
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
                    "w-full flex items-center px-4 py-2.5 gap-3 font-body text-sm transition-all duration-300 rounded-md group",
                    isActive
                      ? "bg-primary text-on-primary font-medium shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                  )}
                >
                  <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-on-primary" : "text-outline group-hover:text-primary")} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-5 px-4">
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
          <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
          <div className="space-y-1">
            {lists.map((list) => (
              <button 
                key={list.id}
                onClick={() => {
                  setSelectedListId(list.id);
                  setCurrentView('list');
                }}
                className={cn(
                  "w-full flex items-center px-4 py-2 gap-3 transition-all text-sm font-body rounded-md group",
                  selectedListId === list.id && currentView === 'list'
                    ? "text-primary font-semibold bg-surface-container-high"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                )}
              >
                <span className="w-2 h-2 rounded-full transition-transform group-hover:scale-125" style={{ backgroundColor: list.color || 'var(--color-tertiary-container)' }}></span>
                <span>{list.name}</span>
              </button>
            ))}
            {lists.length === 0 && (
              <div className="px-4 py-2 text-[11px] font-body text-outline italic">
                No collections yet
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="mt-auto pt-8 border-t border-outline-variant/30">
        {user ? (
          <>
            <div className="flex items-center gap-4 px-4 py-5 mb-6 bg-surface-container-high/40 rounded-lg border border-outline-variant/10">
              <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline font-medium text-sm shrink-0 shadow-sm overflow-hidden">
                {user.displayName ? user.displayName[0] : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-label font-bold tracking-tight truncate">{user.displayName || 'User'}</div>
                <div className="text-[9px] font-label font-medium text-outline uppercase tracking-[0.15em]">Pro Member</div>
              </div>
              <Settings className="w-4 h-4 text-outline hover:text-primary cursor-pointer transition-colors" />
            </div>
            <button 
              onClick={handleLogout}
              className="w-full mt-4 flex items-center px-4 py-3 gap-3 text-on-surface-variant font-body uppercase tracking-[0.1em] text-[10px] font-semibold hover:text-primary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <button 
            onClick={handleLogin}
            className="w-full flex items-center px-4 py-3 gap-3 text-primary font-body uppercase tracking-[0.1em] text-[10px] font-semibold hover:bg-primary/10 transition-all rounded-lg"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );
}
