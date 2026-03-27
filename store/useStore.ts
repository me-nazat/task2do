import { create } from 'zustand';

export type ViewType = 'list' | 'calendar' | 'matrix' | 'kanban' | 'habits';

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
}

interface AppState {
  currentView: ViewType;
  selectedListId: string | null;
  selectedTaskId: string | null;
  isSidebarOpen: boolean;
  isRightPaneOpen: boolean;
  searchQuery: string;
  tasks: Task[];
  
  setCurrentView: (view: ViewType) => void;
  setSelectedListId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  toggleSidebar: () => void;
  toggleRightPane: () => void;
  setSearchQuery: (query: string) => void;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
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

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedListId: (id) => set({ selectedListId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id, isRightPaneOpen: !!id }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleRightPane: () => set((state) => ({ isRightPaneOpen: !state.isRightPaneOpen })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),
}));
