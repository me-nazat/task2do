import { startOfMonth } from 'date-fns';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type AIProvider,
  ChatMessage,
  ChatSession,
  createLocalChatId,
  DEFAULT_AI_PROVIDER,
  DEFAULT_CHAT_TITLE,
  deriveChatSessionTitle,
} from '@/lib/ai/task2do-chat';

export type ViewType = 'list' | 'calendar' | 'matrix' | 'kanban' | 'habits' | 'pocket-tracker' | 'today' | 'upcoming' | 'ai-chat' | 'completed-reminders';

export interface CustomSchedule {
  id: string;
  userId: string;
  label: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ActiveScheduleView =
  | { type: 'month'; monthCursor: string }
  | { type: 'custom'; scheduleId: string };

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
  recurrence: string | null; // Can be simple string ("daily", "weekly") or JSON string for "custom"
  completedOccurrences: string | null;
  deletedOccurrences: string | null;
  createdAt?: Date;
  updatedAt?: Date;
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
  selectedTaskOccurrenceDate: string | null;
  isSidebarOpen: boolean;
  isMobileSidebarOpen: boolean;
  isRightPaneOpen: boolean;
  isCollapsed: boolean;
  searchQuery: string;
  tasks: Task[];
  lists: List[];
  customSchedules: CustomSchedule[];
  activeScheduleView: ActiveScheduleView;
  cachedTaskSnapshots: Record<string, { tasks: Task[]; lists: List[]; customSchedules: CustomSchedule[]; cachedAt: string }>;
  user: { id: string; email: string | null; displayName: string | null } | null;
  isAuthReady: boolean;
  isAuthModalOpen: boolean;
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  hasHydratedChat: boolean;
  selectedAIProvider: AIProvider;
  
  setCurrentView: (view: ViewType) => void;
  setSelectedListId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null, occurrenceDate?: Date | string | null) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setCurrentViewMobile: (view: ViewType, listId?: string | null) => void;
  toggleRightPane: () => void;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setTasks: (tasks: Task[]) => void;
  setLists: (lists: List[]) => void;
  setCustomSchedules: (customSchedules: CustomSchedule[]) => void;
  addCustomSchedule: (customSchedule: CustomSchedule) => void;
  deleteCustomSchedule: (id: string) => void;
  setActiveScheduleView: (view: ActiveScheduleView) => void;
  hydrateCachedData: (userId: string) => boolean;
  setUser: (user: { id: string; email: string | null; displayName: string | null } | null) => void;
  setAuthReady: (ready: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  setChatHydrated: (hydrated: boolean) => void;
  setSelectedAIProvider: (provider: AIProvider) => void;
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

const normalizeDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeTask = (task: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  id: task.id,
  title: task.title,
  isCompleted: task.isCompleted ?? false,
  priority: task.priority ?? 0,
  startDate: normalizeDate(task.startDate),
  endDate: normalizeDate(task.endDate),
  isAllDay: task.isAllDay ?? false,
  listId: task.listId ?? null,
  description: task.description ?? null,
  quadrant: task.quadrant ?? null,
  parentId: task.parentId ?? null,
  timezone: task.timezone ?? null,
  reminderAt: normalizeDate(task.reminderAt),
  status: task.status ?? 'todo',
  recurrence: task.recurrence ?? null,
  completedOccurrences: task.completedOccurrences ?? null,
  deletedOccurrences: task.deletedOccurrences ?? null,
  createdAt: normalizeDate(task.createdAt) ?? undefined,
  updatedAt: normalizeDate(task.updatedAt) ?? undefined,
});

const normalizeList = (list: Partial<List> & Pick<List, 'id' | 'userId' | 'name'>): List => ({
  id: list.id,
  userId: list.userId,
  name: list.name,
  color: list.color ?? null,
  isDefault: list.isDefault ?? false,
  createdAt: normalizeDate(list.createdAt) ?? new Date(),
});

const normalizeTasks = (tasks: Task[]) => tasks.map((task) => normalizeTask(task));

const normalizeLists = (lists: List[]) => lists.map((list) => normalizeList(list));

const normalizeTaskPatch = (updates: Partial<Task>): Partial<Task> => {
  const patch: Partial<Task> = { ...updates };

  if ('startDate' in updates) {
    patch.startDate = normalizeDate(updates.startDate);
  }

  if ('endDate' in updates) {
    patch.endDate = normalizeDate(updates.endDate);
  }

  if ('reminderAt' in updates) {
    patch.reminderAt = normalizeDate(updates.reminderAt);
  }

  if ('completedOccurrences' in updates) {
    patch.completedOccurrences = updates.completedOccurrences ?? null;
  }

  if ('deletedOccurrences' in updates) {
    patch.deletedOccurrences = updates.deletedOccurrences ?? null;
  }

  if ('createdAt' in updates) {
    patch.createdAt = normalizeDate(updates.createdAt) ?? undefined;
  }

  if ('updatedAt' in updates) {
    patch.updatedAt = normalizeDate(updates.updatedAt) ?? undefined;
  }

  return patch;
};

const normalizeOccurrenceDate = (occurrenceDate?: Date | string | null) => {
  const date = normalizeDate(occurrenceDate);
  return date ? date.toISOString() : null;
};

const getDefaultMonthCursor = () => startOfMonth(new Date()).toISOString();

const normalizeCustomSchedule = (
  customSchedule: Partial<CustomSchedule> & Pick<CustomSchedule, 'id' | 'userId' | 'label'>
): CustomSchedule => ({
  id: customSchedule.id,
  userId: customSchedule.userId,
  label: customSchedule.label,
  startDate: normalizeDate(customSchedule.startDate) ?? startOfMonth(new Date()),
  endDate: normalizeDate(customSchedule.endDate) ?? startOfMonth(new Date()),
  createdAt: normalizeDate(customSchedule.createdAt) ?? new Date(),
  updatedAt: normalizeDate(customSchedule.updatedAt) ?? new Date(),
});

const sortCustomSchedules = (customSchedules: CustomSchedule[]) => (
  [...customSchedules].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
);

const normalizeCustomSchedules = (customSchedules: CustomSchedule[]) => (
  sortCustomSchedules(customSchedules.map((customSchedule) => normalizeCustomSchedule(customSchedule)))
);

const withUserSnapshot = (state: AppState, updates: Partial<AppState>): Partial<AppState> => {
  if ('user' in updates && updates.user === null) {
    return updates;
  }

  const userId = updates.user?.id ?? state.user?.id;
  if (!userId) {
    return updates;
  }

  const nextTasks = 'tasks' in updates ? (updates.tasks as Task[]) : state.tasks;
  const nextLists = 'lists' in updates ? (updates.lists as List[]) : state.lists;
  const nextCustomSchedules = 'customSchedules' in updates
    ? (updates.customSchedules as CustomSchedule[])
    : state.customSchedules;

  return {
    ...updates,
    cachedTaskSnapshots: {
      ...state.cachedTaskSnapshots,
      [userId]: {
        tasks: normalizeTasks(nextTasks),
        lists: normalizeLists(nextLists),
        customSchedules: normalizeCustomSchedules(nextCustomSchedules),
        cachedAt: new Date().toISOString(),
      },
    },
  };
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: 'list',
      selectedListId: null,
      selectedTaskId: null,
      selectedTaskOccurrenceDate: null,
      isSidebarOpen: true,
      isMobileSidebarOpen: false,
      isRightPaneOpen: false,
      isCollapsed: false,
      searchQuery: '',
      tasks: [],
      lists: [],
      customSchedules: [],
      activeScheduleView: { type: 'month', monthCursor: getDefaultMonthCursor() },
      cachedTaskSnapshots: {},
      user: null,
      isAuthReady: false,
      isAuthModalOpen: false,
      chatSessions: [],
      activeChatSessionId: null,
      hasHydratedChat: false,
      selectedAIProvider: DEFAULT_AI_PROVIDER,

      setCurrentView: (view) => set({ currentView: view }),
      setSelectedListId: (id) => set({ selectedListId: id }),
      setSelectedTaskId: (id, occurrenceDate = null) => set({
        selectedTaskId: id,
        selectedTaskOccurrenceDate: id ? normalizeOccurrenceDate(occurrenceDate) : null,
        isRightPaneOpen: !!id,
      }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
      closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
      setCurrentViewMobile: (view, listId = null) => set({
        currentView: view,
        ...(listId !== undefined ? { selectedListId: listId } : {}),
        isMobileSidebarOpen: false,
      }),
      toggleRightPane: () => set((state) => ({ isRightPaneOpen: !state.isRightPaneOpen })),
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setTasks: (tasks) => set((state) => withUserSnapshot(state, { tasks: normalizeTasks(tasks) })),
      setLists: (lists) => set((state) => withUserSnapshot(state, { lists: normalizeLists(lists) })),
      setCustomSchedules: (customSchedules) => set((state) => withUserSnapshot(state, {
        customSchedules: normalizeCustomSchedules(customSchedules),
      })),
      addCustomSchedule: (customSchedule) => set((state) => withUserSnapshot(state, {
        customSchedules: normalizeCustomSchedules([...state.customSchedules, normalizeCustomSchedule(customSchedule)]),
      })),
      deleteCustomSchedule: (id) => set((state) => withUserSnapshot(state, {
        customSchedules: normalizeCustomSchedules(
          state.customSchedules.filter((customSchedule) => customSchedule.id !== id)
        ),
      })),
      setActiveScheduleView: (view) => set({ activeScheduleView: view }),
      hydrateCachedData: (userId) => {
        const snapshot = get().cachedTaskSnapshots[userId];
        if (!snapshot) {
          return false;
        }

        set((state) => withUserSnapshot(state, {
          tasks: normalizeTasks(snapshot.tasks),
          lists: normalizeLists(snapshot.lists),
          customSchedules: normalizeCustomSchedules(snapshot.customSchedules ?? []),
        }));
        return true;
      },
      setUser: (user) => set((state) => {
        if (!user) {
          return {
            user: null,
            tasks: [],
            lists: [],
            customSchedules: [],
            activeScheduleView: { type: 'month', monthCursor: getDefaultMonthCursor() },
            selectedTaskId: null,
            selectedTaskOccurrenceDate: null,
            isRightPaneOpen: false,
          };
        }

        if (state.user?.id && state.user.id !== user.id) {
          return {
            user,
            tasks: [],
            lists: [],
            customSchedules: [],
            activeScheduleView: { type: 'month', monthCursor: getDefaultMonthCursor() },
            selectedTaskId: null,
            selectedTaskOccurrenceDate: null,
            isRightPaneOpen: false,
          };
        }

        return { user };
      }),
      setAuthReady: (ready) => set({ isAuthReady: ready }),
      setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
      setChatHydrated: (hydrated) => set({ hasHydratedChat: hydrated }),
      setSelectedAIProvider: (provider) => set({ selectedAIProvider: provider }),
      addTask: (task) => set((state) => withUserSnapshot(state, {
        tasks: [...state.tasks, normalizeTask(task)],
      })),
      addList: (list) => set((state) => withUserSnapshot(state, {
        lists: [...state.lists, normalizeList(list)],
      })),
      updateTask: (id, updates) => set((state) => ({
        ...withUserSnapshot(state, {
          tasks: state.tasks.map((task) => (
            task.id === id
              ? normalizeTask({
                  ...task,
                  ...normalizeTaskPatch(updates),
                  id: normalizeTaskPatch(updates).id ?? task.id,
                  title: normalizeTaskPatch(updates).title ?? task.title,
                })
              : task
          )),
        }),
      })),
      deleteTask: (id) => set((state) => withUserSnapshot(state, {
        tasks: state.tasks.filter((task) => task.id !== id),
        ...(state.selectedTaskId === id
          ? {
              selectedTaskId: null,
              selectedTaskOccurrenceDate: null,
              isRightPaneOpen: false,
            }
          : {}),
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
        selectedAIProvider: state.selectedAIProvider,
        cachedTaskSnapshots: state.cachedTaskSnapshots,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setChatHydrated(true);
      },
    }
  )
);
