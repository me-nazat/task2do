'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { LogOut, Plus } from 'lucide-react';
import { AIChatView } from '@/components/views/AIChatView';
import { AppShell, EmptyPreview, PanelCard, StatCard } from '@/components/dual-dashboard/AppShell';
import { Task2DoBootstrap } from '@/components/task2do/Task2DoBootstrap';
import { normalizeTask2DoRoute, TASK2DO_NAV_ITEMS } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { createDemoLists } from '@/lib/demo/task2do-data';
import { useStore } from '@/store/useStore';

export function Task2DoApp({ slug }: { slug?: string[] }) {
  const activeRoute = normalizeTask2DoRoute(slug);
  const {
    searchQuery,
    setSearchQuery,
    lists,
    tasks,
    addList,
    chatSessions,
    activeChatSessionId,
    isDemoMode,
    selectedAIProvider,
    setSelectedAIProvider,
  } = useStore();

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => !query || task.title.toLowerCase().includes(query));
  }, [searchQuery, tasks]);

  const openTasks = filteredTasks.filter((task) => !task.isCompleted);
  const scheduledTasks = filteredTasks.filter((task) => !!task.startDate);
  const completedTasks = filteredTasks.filter((task) => task.isCompleted);

  const pageContent = activeRoute === 'ai-chat'
    ? <AIChatView />
    : (
      <Task2DoPreviewPage
        route={activeRoute}
        tasks={filteredTasks}
        openTasks={openTasks.length}
        scheduledTasks={scheduledTasks.length}
        completedTasks={completedTasks.length}
      />
    );

  const activeSession = chatSessions.find((session) => session.id === activeChatSessionId) ?? null;

  return (
    <>
      <Task2DoBootstrap />
      <AppShell
        product="task2do"
        theme="light"
        activeKey={activeRoute}
        navItems={TASK2DO_NAV_ITEMS}
        logo={<h1 className="font-headline text-[34px] font-semibold italic tracking-[-0.04em] text-[color:var(--app-text-strong)]">Task2Do</h1>}
        subtitle="Strategy & Focus"
        searchPlaceholder="Search tasks..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        profile={{ name: 'Nazat', subtitle: 'nazatal619@gmail.com', badge: 'Pro Member' }}
        sidebarSection={
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                Collections
              </p>
              <button
                type="button"
                onClick={() => {
                  const palette = createDemoLists();
                  const nextList = palette[(lists.length + 1) % palette.length];
                  addList({
                    ...nextList,
                    id: `list-${Date.now()}`,
                    name: `Collection ${lists.length + 1}`,
                    createdAt: new Date(),
                  });
                }}
                className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-panel)] p-2 text-[color:var(--app-muted)] transition hover:bg-[var(--app-hover)]"
                aria-label="Add collection"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-panel)] px-4 py-3 text-sm"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: list.color || '#6d4dff' }} />
                  <span className="truncate">{list.name}</span>
                </div>
              ))}
            </div>
          </div>
        }
        sidebarFooter={
          <button
            type="button"
            onClick={async () => {
              if (isDemoMode) {
                sessionStorage.removeItem('task2do-chat-initialized');
                useStore.setState({
                  activeChatSessionId: null,
                  chatSessions: [],
                });
                window.location.reload();
                return;
              }

              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.reload();
            }}
            className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-panel)] px-4 py-3 text-sm font-medium text-[color:var(--app-text)] transition hover:bg-[var(--app-hover)]"
          >
            <LogOut className="h-4 w-4 text-[color:var(--app-muted)]" />
            Logout
          </button>
        }
      >
        <div className="space-y-6">
          {activeRoute === 'ai-chat' ? null : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                  Task2Do Preview
                </p>
                <h1 className="mt-3 font-headline text-[46px] italic tracking-[-0.04em] text-[color:var(--app-text-strong)]">
                  {PREVIEW_COPY[activeRoute].title}
                </h1>
                <p className="mt-2 max-w-2xl text-base leading-7 text-[color:var(--app-muted)]">
                  {PREVIEW_COPY[activeRoute].description}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[var(--app-panel)] p-1">
                {(['gemini', 'mimo'] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setSelectedAIProvider(provider)}
                    className={cn(
                      'rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition',
                      selectedAIProvider === provider
                        ? 'bg-[var(--switcher-active-bg)] text-[var(--switcher-active-text)]'
                        : 'text-[color:var(--app-muted)] hover:bg-[var(--app-hover)]'
                    )}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeRoute === 'ai-chat' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                    Assistant Memory
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--app-muted)]">
                    {activeSession?.title ? `Current chat: ${activeSession.title}` : 'Start with a suggestion or ask Task2Do to plan your day.'}
                  </p>
                </div>
              </div>
              {pageContent}
            </>
          ) : (
            pageContent
          )}
        </div>
      </AppShell>
    </>
  );
}

const PREVIEW_COPY: Record<Exclude<ReturnType<typeof normalizeTask2DoRoute>, 'ai-chat'>, { title: string; description: string }> = {
  inbox: {
    title: 'Inbox',
    description: 'A gentle triage view for every unsorted task, with enough structure to show the premium shell without rebuilding the full legacy list manager.',
  },
  today: {
    title: 'Today',
    description: 'A focused daily lineup showing what matters now, surfaced from the same seeded task dataset used by the assistant.',
  },
  upcoming: {
    title: 'Upcoming',
    description: 'A forward view that previews scheduled work and keeps the app flow intact when moving beyond the AI assistant.',
  },
  schedule: {
    title: 'Schedule',
    description: 'A high-level scheduling surface that previews calendar-first planning without replacing the legacy calendar editor yet.',
  },
  kanban: {
    title: 'Kanban',
    description: 'A styled project board preview that keeps navigation complete while preserving the overall premium Task2Do aesthetic.',
  },
  matrix: {
    title: 'Matrix',
    description: 'A quadrant-based prioritization preview that reflects the assistant’s focus language and the seeded task priorities.',
  },
  habits: {
    title: 'Habits',
    description: 'A light-touch progress preview that keeps the habits destination present and visually aligned with the rest of the dashboard.',
  },
  'completed-alerts': {
    title: 'Completed & Alerts',
    description: 'A tidy review surface for done tasks and near-term reminders so the sidebar remains functional end to end.',
  },
};

function Task2DoPreviewPage({
  route,
  tasks,
  openTasks,
  scheduledTasks,
  completedTasks,
}: {
  route: Exclude<ReturnType<typeof normalizeTask2DoRoute>, 'ai-chat'>;
  tasks: ReturnType<typeof useStore.getState>['tasks'];
  openTasks: number;
  scheduledTasks: number;
  completedTasks: number;
}) {
  const highlightedTasks = tasks.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard label="Open Tasks" value={String(openTasks)} className="bg-[color:rgba(255,255,255,0.76)]" />
        <StatCard label="Scheduled" value={String(scheduledTasks)} className="bg-[color:rgba(255,255,255,0.76)]" />
        <StatCard label="Completed" value={String(completedTasks)} className="bg-[color:rgba(255,255,255,0.76)]" />
      </div>

      {highlightedTasks.length === 0 ? (
        <EmptyPreview
          eyebrow="Preview"
          title="No matching tasks yet."
          description="This destination stays live inside the new shell, and it will surface your seeded or real Task2Do data as the full redesign continues."
        />
      ) : (
        <PanelCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                Highlighted Tasks
              </p>
              <h2 className="mt-3 font-headline text-[34px] italic tracking-[-0.04em] text-[color:var(--app-text-strong)]">
                {PREVIEW_COPY[route].title} snapshot
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {highlightedTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[color:var(--app-border)] bg-[color:rgba(255,255,255,0.62)] px-5 py-4"
              >
                <div>
                  <p className="text-base font-semibold text-[color:var(--app-text-strong)]">{task.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--app-muted)]">
                    {task.description || 'Task2Do preview item'}
                  </p>
                </div>
                <div className="text-right text-sm text-[color:var(--app-muted)]">
                  <p>{task.startDate ? format(new Date(task.startDate), 'MMM d, yyyy') : 'Unscheduled'}</p>
                  <p className="mt-1 uppercase tracking-[0.18em] text-[11px]">{task.status || 'todo'}</p>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </div>
  );
}
