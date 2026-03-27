import { create } from 'zustand';

export type ViewType = 'list' | 'calendar' | 'matrix' | 'kanban' | 'habits' | 'today' | 'upcoming';

export interface Task {
  id: string;
  title: string;
  isCompleted: boolean | null;
  priority: number | null;
  startDate: Date | null;
  endDate: Date | null;
  isAllDay: boolean | null;
  listId: string | null;
  description: string | null;
  quadrant: string | null;
  parentId: string | null;
  timezone: string | null;
  reminderAt: Date | null;
  status: 'todo' | 'in-progress' | 'done' | null;
}

export interface List {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  isDefault: boolean | null;
  createdAt: Date;
}

interface AppState {
  currentView: ViewType;
  selectedListId: string | null;
  selectedTaskId: string | null;
  isSidebarOpen: boolean;
  isRightPaneOpen: boolean;
  searchQuery: string;
  tasks: Task[];
  lists: List[];
  user: { id: string; email: string | null; displayName: string | null } | null;
  isAuthReady: boolean;
  
  setCurrentView: (view: ViewType) => void;
  setSelectedListId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  toggleSidebar: () => void;
  toggleRightPane: () => void;
  setSearchQuery: (query: string) => void;
  setTasks: (tasks: Task[]) => void;
  setLists: (lists: List[]) => void;
  setUser: (user: { id: string; email: string | null; displayName: string | null } | null) => void;
  setAuthReady: (ready: boolean) => void;
  addTask: (task: Task) => void;
  addList: (list: List) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  currentView: 'list',
  selectedListId: null,
  selectedTaskId: null,
  isSidebarOpen: true,
  isRightPaneOpen: false,
  searchQuery: '',
  tasks: [],
  lists: [],
  user: null,
  isAuthReady: false,

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedListId: (id) => set({ selectedListId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id, isRightPaneOpen: !!id }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleRightPane: () => set((state) => ({ isRightPaneOpen: !state.isRightPaneOpen })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setTasks: (tasks) => set({ tasks }),
  setLists: (lists) => set({ lists }),
  setUser: (user) => set({ user }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  addList: (list) => set((state) => ({ lists: [...state.lists, list] })),
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),
}));
