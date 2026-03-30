import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ChatMessage, ChatSession, createLocalChatId, DEFAULT_CHAT_TITLE, deriveChatSessionTitle } from '@/lib/ai/task2do-chat';

export type ViewType = 'list' | 'calendar' | 'matrix' | 'kanban' | 'habits' | 'today' | 'upcoming' | 'ai-chat' | 'completed-reminders';

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
  recurrence: string | null;
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
  isCollapsed: boolean;
  searchQuery: string;
  tasks: Task[];
  lists: List[];
  user: { id: string; email: string | null; displayName: string | null } | null;
  isAuthReady: boolean;
  isAuthModalOpen: boolean;
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  hasHydratedChat: boolean;
  
  setCurrentView: (view: ViewType) => void;
  setSelectedListId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  toggleSidebar: () => void;
  toggleRightPane: () => void;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setTasks: (tasks: Task[]) => void;
  setLists: (lists: List[]) => void;
  setUser: (user: { id: string; email: string | null; displayName: string | null } | null) => void;
  setAuthReady: (ready: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  setChatHydrated: (hydrated: boolean) => void;
  addTask: (task: Task) => void;
  addList: (list: List) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  ensureChatSession: (ownerId: string) => string;
  startNewChat: (ownerId: string) => string;
  setActiveChatSession: (id: string) => void;
  appendChatMessage: (sessionId: string, message: ChatMessage) => void;
  updateChatMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void;
}

const sortChatSessions = (sessions: ChatSession[]) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const createChatSession = (ownerId: string): ChatSession => {
  const now = new Date().toISOString();

  return {
    id: createLocalChatId('chat'),
    ownerId,
    title: DEFAULT_CHAT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: 'list',
      selectedListId: null,
      selectedTaskId: null,
      isSidebarOpen: true,
      isRightPaneOpen: false,
      isCollapsed: false,
      searchQuery: '',
      tasks: [],
      lists: [],
      user: null,
      isAuthReady: false,
      isAuthModalOpen: false,
      chatSessions: [],
      activeChatSessionId: null,
      hasHydratedChat: false,

      setCurrentView: (view) => set({ currentView: view }),
      setSelectedListId: (id) => set({ selectedListId: id }),
      setSelectedTaskId: (id) => set({ selectedTaskId: id, isRightPaneOpen: !!id }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleRightPane: () => set((state) => ({ isRightPaneOpen: !state.isRightPaneOpen })),
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setTasks: (tasks) => set({ tasks }),
      setLists: (lists) => set({ lists }),
      setUser: (user) => set({ user }),
      setAuthReady: (ready) => set({ isAuthReady: ready }),
      setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
      setChatHydrated: (hydrated) => set({ hasHydratedChat: hydrated }),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      addList: (list) => set((state) => ({ lists: [...state.lists, list] })),
      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id ? { ...task, ...updates } : task)
      })),
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== id)
      })),
      ensureChatSession: (ownerId) => {
        const state = get();
        const activeSession = state.chatSessions.find((session) => session.id === state.activeChatSessionId);

        if (activeSession?.ownerId === ownerId) {
          return activeSession.id;
        }

        const existingSession = sortChatSessions(
          state.chatSessions.filter((session) => session.ownerId === ownerId)
        )[0];

        if (existingSession) {
          set({ activeChatSessionId: existingSession.id });
          return existingSession.id;
        }

        return get().startNewChat(ownerId);
      },
      startNewChat: (ownerId) => {
        const state = get();
        const activeSession = state.chatSessions.find((session) => session.id === state.activeChatSessionId);

        if (activeSession?.ownerId === ownerId && activeSession.messages.length === 0) {
          return activeSession.id;
        }

        const session = createChatSession(ownerId);

        set((currentState) => ({
          chatSessions: sortChatSessions([session, ...currentState.chatSessions]),
          activeChatSessionId: session.id,
        }));

        return session.id;
      },
      setActiveChatSession: (id) => set((state) => {
        const exists = state.chatSessions.some((session) => session.id === id);
        return exists ? { activeChatSessionId: id } : state;
      }),
      appendChatMessage: (sessionId, message) => set((state) => {
        const updatedSessions = state.chatSessions.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          const messages = [...session.messages, message];

          return {
            ...session,
            messages,
            title: deriveChatSessionTitle(messages),
            updatedAt: message.timestamp,
          };
        });

        return {
          chatSessions: sortChatSessions(updatedSessions),
          activeChatSessionId: sessionId,
        };
      }),
      updateChatMessage: (sessionId, messageId, updates) => set((state) => {
        const updatedAt = new Date().toISOString();
        const updatedSessions = state.chatSessions.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          const messages = session.messages.map((message) => (
            message.id === messageId ? { ...message, ...updates } : message
          ));

          return {
            ...session,
            messages,
            title: deriveChatSessionTitle(messages),
            updatedAt,
          };
        });

        return {
          chatSessions: sortChatSessions(updatedSessions),
        };
      }),
    }),
    {
      name: 'task2do-chat-sessions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        chatSessions: state.chatSessions,
        activeChatSessionId: state.activeChatSessionId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setChatHydrated(true);
      },
    }
  )
);
