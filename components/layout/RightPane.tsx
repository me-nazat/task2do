'use client';

import { type ReactNode, useState } from 'react';

import { useStore, type Task as StoreTask } from '@/store/useStore';
import {
  X,
  Calendar as CalendarIcon,
  Flag,
  Tag,
  AlignLeft,
  CheckSquare,
  Trash2,
  Plus,
  CheckCircle2,
  LayoutDashboard,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import { updateTask, deleteTask, createTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';
import { buildTaskCompletionUpdate, buildTaskOccurrenceDeleteUpdate, isTaskOccurrenceCompleted, isTaskRecurring } from '@/lib/recurrence';
import { format } from 'date-fns';
import { TaskAttachmentsSection } from '@/components/layout/TaskAttachmentsSection';

interface MetadataRowProps {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  align?: 'start' | 'center';
}

function MetadataRow({ icon: Icon, label, children, align = 'start' }: MetadataRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-y-1.5 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-4',
        align === 'center' ? 'items-center' : 'items-start'
      )}
    >
      <div className="flex items-center gap-2 pt-0.5 text-[9px] font-label font-bold uppercase tracking-[0.16em] text-outline/70">
        <Icon className="h-3.5 w-3.5 text-primary/55" />
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const metadataSelectClassName =
  'w-full max-w-full rounded-xl border border-outline-variant/10 bg-surface-container-low px-3.5 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-primary/85 transition-all focus:outline-none focus:ring-1 focus:ring-primary/20 active:bg-surface-container-high lg:hover:bg-surface-container-high';

export function RightPane() {
  const { selectedTaskId, selectedTaskOccurrenceDate, tasks } = useStore();
  const task = tasks.find(t => t.id === selectedTaskId);
  const selectedOccurrenceDate = selectedTaskOccurrenceDate ? new Date(selectedTaskOccurrenceDate) : null;

  if (!selectedTaskId || !task) return null;

  return (
    <RightPaneTaskDetails
      key={`${task.id}:${selectedTaskOccurrenceDate ?? 'default'}`}
      task={task}
      selectedOccurrenceDate={selectedOccurrenceDate}
    />
  );
}

function RightPaneTaskDetails({
  task,
  selectedOccurrenceDate,
}: {
  task: StoreTask;
  selectedOccurrenceDate: Date | null;
}) {
  const {
    setSelectedTaskId,
    tasks,
    updateTask: updateTaskState,
    deleteTask: deleteTaskState,
    user,
  } = useStore();
  const isOccurrenceScopedRecurringTask = Boolean(task && selectedOccurrenceDate && isTaskRecurring(task));
  const selectedOccurrenceCompleted = task && selectedOccurrenceDate
    ? isTaskOccurrenceCompleted(task, selectedOccurrenceDate)
    : Boolean(task?.isCompleted);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showCustomTimes, setShowCustomTimes] = useState(false);

  const subtasks = tasks.filter(t => t.parentId === task.id);

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !user) return;

    const tempId = `temp-${Date.now()}`;
    const newSubtask = {
      id: tempId,
      title: newSubtaskTitle,
      isCompleted: false,
      priority: 0,
      startDate: null,
      endDate: null,
      isAllDay: false,
      listId: task.listId,
      description: null,
      quadrant: null,
      parentId: task.id,
      timezone: null,
      reminderAt: null,
      status: 'todo' as const,
      userId: user.id,
      recurrence: null,
      completedOccurrences: null,
      deletedOccurrences: null,
    };

    useStore.getState().addTask(newSubtask);
    setNewSubtaskTitle('');

    try {
      const realId = unwrapDatabaseResult(await createTask({
        title: newSubtaskTitle,
        listId: task.listId || undefined,
        parentId: task.id,
        userId: user.id,
      }));
      useStore.getState().updateTask(tempId, { id: realId });
    } catch (error) {
      console.error('Failed to create subtask', error);
      useStore.getState().deleteTask(tempId);
      alert(getClientErrorMessage(error, 'Unable to create subtask right now.'));
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentStatus: boolean | null) => {
    const newStatus = !currentStatus;
    const subtask = subtasks.find((item) => item.id === subtaskId);
    updateTaskState(subtaskId, { isCompleted: newStatus, updatedAt: new Date() });
    try {
      unwrapDatabaseResult(await updateTask(subtaskId, { isCompleted: newStatus, updatedAt: new Date() }));
    } catch (error) {
      updateTaskState(subtaskId, { isCompleted: currentStatus, updatedAt: subtask?.updatedAt });
      alert(getClientErrorMessage(error, 'Unable to update subtask right now.'));
    }
  };

  const handleTitleBlur = async () => {
    if (title !== task.title) {
      updateTaskState(task.id, { title });
      try {
        unwrapDatabaseResult(await updateTask(task.id, { title }));
      } catch (error) {
        alert(getClientErrorMessage(error, 'Unable to rename task right now.'));
      }
    }
  };

  const handleDescriptionBlur = async () => {
    if (description !== (task.description || '')) {
      updateTaskState(task.id, { description });
      try {
        unwrapDatabaseResult(await updateTask(task.id, { description }));
      } catch (error) {
        alert(getClientErrorMessage(error, 'Unable to save notes right now.'));
      }
    }
  };

  const handleDelete = async () => {
    if (isOccurrenceScopedRecurringTask && selectedOccurrenceDate) {
      const previousState = {
        isCompleted: task.isCompleted,
        completedOccurrences: task.completedOccurrences,
        deletedOccurrences: task.deletedOccurrences,
      };
      const updates = buildTaskOccurrenceDeleteUpdate(task, selectedOccurrenceDate);

      updateTaskState(task.id, updates);
      setSelectedTaskId(null);

      try {
        unwrapDatabaseResult(await updateTask(task.id, updates));
      } catch (error) {
        updateTaskState(task.id, previousState);
        alert(getClientErrorMessage(error, 'Unable to remove this occurrence right now.'));
      }
      return;
    }

    deleteTaskState(task.id);
    setSelectedTaskId(null);
    try {
      unwrapDatabaseResult(await deleteTask(task.id));
    } catch (error) {
      alert(getClientErrorMessage(error, 'Unable to delete task right now.'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low overflow-hidden">
      {/* Header */}
      <div className="h-16 sm:h-20 border-b border-outline-variant/30 flex items-center justify-between px-4 sm:px-6 lg:px-10 shrink-0">
        <div className="flex items-center gap-3 text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/70">
          <CheckSquare className="w-4 h-4 text-primary/60" />
          <span>Objective Details</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDelete}
            className="p-2.5 hover:bg-error/10 hover:text-error rounded-full text-outline/60 transition-all touch-target flex items-center justify-center"
            title={isOccurrenceScopedRecurringTask ? 'Remove This Occurrence' : 'Archive Objective'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSelectedTaskId(null)}
            className="p-2.5 hover:bg-surface-container-high rounded-full text-outline/60 transition-all touch-target flex items-center justify-center hidden lg:flex"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-7 lg:space-y-8 safe-area-bottom">
        {/* Title */}
        <div>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-2xl sm:text-3xl lg:text-4xl font-light bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-outline/30 font-headline tracking-tight text-primary italic"
            placeholder="Objective Title"
          />
        </div>

        {/* Properties */}
        <div className="space-y-4 rounded-[1.75rem] border border-outline-variant/10 bg-white p-4 shadow-sm sm:space-y-4.5 sm:p-5 lg:p-6">
          <MetadataRow icon={CalendarIcon} label="Schedule">
            <DateTimePicker
              startDate={task.startDate ? new Date(task.startDate) : null}
              endDate={task.endDate ? new Date(task.endDate) : null}
              isAllDay={task.isAllDay}
              timezone={task.timezone}
              reminderAt={task.reminderAt ? new Date(task.reminderAt) : null}
              onChange={async (updates) => {
                updateTaskState(task.id, updates);
                try {
                  unwrapDatabaseResult(await updateTask(task.id, updates));
                } catch (error) {
                  alert(getClientErrorMessage(error, 'Unable to update the schedule right now.'));
                }
              }}
            />
          </MetadataRow>

          <MetadataRow icon={Repeat} label="Repeat">
            <div className="space-y-2.5">
              <select
                value={task.recurrence?.startsWith('custom:') ? 'custom' : (task.recurrence?.startsWith('weekly:') ? 'weekly' : (task.recurrence || 'none'))}
                onChange={async (e) => {
                  const val = e.target.value;
                  let newVal: string | null = val === 'none' ? null : val;
                  if (val === 'weekly') newVal = 'weekly:1,2,3,4,5';
                  if (val === 'custom') newVal = `custom:${JSON.stringify({ days: [], times: {} })}`;

                  updateTaskState(task.id, { recurrence: newVal });
                  try {
                    unwrapDatabaseResult(await updateTask(task.id, { recurrence: newVal }));
                  } catch (error) {
                    alert(getClientErrorMessage(error, 'Unable to update the recurrence right now.'));
                  }
                }}
                className={metadataSelectClassName}
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly...</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom...</option>
              </select>

              {(task.recurrence?.startsWith('weekly:') || task.recurrence?.startsWith('custom:')) && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                      let isSelected = false;
                      let currentConfig: { days: number[]; times?: Record<number, string> } = { days: [] };

                      if (task.recurrence?.startsWith('weekly:')) {
                        isSelected = task.recurrence.split(':')[1].split(',').map(Number).includes(idx);
                      } else if (task.recurrence?.startsWith('custom:')) {
                        try {
                          currentConfig = JSON.parse(task.recurrence.slice(7)) as { days: number[]; times?: Record<number, string> };
                          isSelected = currentConfig.days.includes(idx);
                        } catch {}
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={async () => {
                            let newVal = task.recurrence;

                            if (task.recurrence?.startsWith('weekly:')) {
                              const days = task.recurrence.split(':')[1].split(',').map(Number);
                              const newDays = days.includes(idx) ? days.filter((dayIndex) => dayIndex !== idx) : [...days, idx];
                              newVal = `weekly:${newDays.sort().join(',')}`;
                            } else if (task.recurrence?.startsWith('custom:')) {
                              try {
                                const config = JSON.parse(task.recurrence.slice(7)) as { days: number[]; times: Record<number, string> };
                                const newDays = config.days.includes(idx)
                                  ? config.days.filter((dayIndex) => dayIndex !== idx)
                                  : [...config.days, idx];
                                const newTimes = { ...(config.times || {}) };

                                if (config.days.includes(idx)) {
                                  delete newTimes[idx];
                                }

                                newVal = `custom:${JSON.stringify({ days: newDays.sort(), times: newTimes })}`;
                              } catch {}
                            }

                            updateTaskState(task.id, { recurrence: newVal });
                            try {
                              unwrapDatabaseResult(await updateTask(task.id, { recurrence: newVal }));
                            } catch (error) {
                              alert(getClientErrorMessage(error, 'Unable to update recurrence days.'));
                            }
                          }}
                          className={cn(
                            'touch-target flex h-8 w-8 items-center justify-center rounded-full text-[9px] font-label font-bold uppercase tracking-[0.14em] transition-all active:scale-95',
                            isSelected
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'bg-surface-container-low text-outline/60 active:bg-surface-container-high active:text-primary lg:hover:bg-surface-container-high lg:hover:text-primary'
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {task.recurrence?.startsWith('custom:') && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomTimes(!showCustomTimes)}
                        className="inline-flex items-center gap-1.5 text-[9px] font-label font-bold uppercase tracking-[0.18em] text-primary/70 transition-colors active:text-primary lg:hover:text-primary"
                      >
                        <Plus className={cn('h-3 w-3 transition-transform', showCustomTimes && 'rotate-45')} />
                        {showCustomTimes ? 'Hide Custom Times' : 'Add Custom Time Also'}
                      </button>

                      {showCustomTimes && (
                        <div className="space-y-2 rounded-2xl border border-primary/10 bg-primary/5 p-2.5">
                          {(() => {
                            try {
                              const config = JSON.parse(task.recurrence.slice(7)) as { days: number[]; times: Record<number, string> };

                              if (config.days.length === 0) {
                                return <div className="py-1 text-[10px] italic text-outline/40">Select days above first.</div>;
                              }

                              return config.days.sort().map((dayIdx: number) => (
                                <div key={dayIdx} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
                                  <span className="w-14 text-[9px] font-label font-bold uppercase tracking-[0.16em] text-outline/65">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIdx]}
                                  </span>
                                  <input
                                    type="time"
                                    value={config.times?.[dayIdx] || '09:00'}
                                    onChange={async (e) => {
                                      const newTimes = { ...(config.times || {}), [dayIdx]: e.target.value };
                                      const newVal = `custom:${JSON.stringify({ ...config, times: newTimes })}`;
                                      updateTaskState(task.id, { recurrence: newVal });
                                      try {
                                        unwrapDatabaseResult(await updateTask(task.id, { recurrence: newVal }));
                                      } catch {}
                                    }}
                                    className="h-9 rounded-xl border border-outline-variant/15 bg-white px-2.5 text-[12px] text-primary outline-none transition-all focus:ring-1 focus:ring-primary/20"
                                  />
                                </div>
                              ));
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </MetadataRow>

          <MetadataRow icon={CheckCircle2} label="Status" align="center">
            <select
              value={
                isOccurrenceScopedRecurringTask
                  ? (selectedOccurrenceCompleted ? 'done' : (task.status === 'done' ? 'todo' : (task.status || 'todo')))
                  : (task.status || 'todo')
              }
              onChange={async (e) => {
                const status = e.target.value as typeof task.status;

                if (isOccurrenceScopedRecurringTask && selectedOccurrenceDate) {
                  const previousState = {
                    status: task.status,
                    isCompleted: task.isCompleted,
                    completedOccurrences: task.completedOccurrences,
                    deletedOccurrences: task.deletedOccurrences,
                    updatedAt: task.updatedAt,
                  };
                  const completionUpdates = {
                    ...buildTaskCompletionUpdate(task, status === 'done', selectedOccurrenceDate),
                    updatedAt: new Date(),
                  };
                  const updates = status === 'done'
                    ? completionUpdates
                    : { ...completionUpdates, status };

                  updateTaskState(task.id, updates);
                  try {
                    unwrapDatabaseResult(await updateTask(task.id, updates));
                  } catch (error) {
                    updateTaskState(task.id, previousState);
                    alert(getClientErrorMessage(error, 'Unable to update that occurrence right now.'));
                  }
                  return;
                }

                const isCompleted = status === 'done';
                const updates = { status, isCompleted, updatedAt: new Date() };
                updateTaskState(task.id, updates);
                try {
                  unwrapDatabaseResult(await updateTask(task.id, updates));
                } catch (error) {
                  alert(getClientErrorMessage(error, 'Unable to update the task status right now.'));
                }
              }}
              className={metadataSelectClassName}
            >
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </MetadataRow>

          <MetadataRow icon={Flag} label="Priority" align="center">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 0, label: 'None', color: 'text-outline/40' },
                { value: 1, label: 'Low', color: 'text-info' },
                { value: 2, label: 'Medium', color: 'text-warning' },
                { value: 3, label: 'High', color: 'text-error' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={async () => {
                    updateTaskState(task.id, { priority: p.value });
                    try {
                      unwrapDatabaseResult(await updateTask(task.id, { priority: p.value }));
                    } catch (error) {
                      alert(getClientErrorMessage(error, 'Unable to update the task priority right now.'));
                    }
                  }}
                  className={cn(
                    'touch-target inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-label font-bold uppercase tracking-[0.14em] transition-all active:scale-95',
                    task.priority === p.value
                      ? 'bg-surface-container-high text-primary shadow-sm'
                      : 'bg-surface-container-low text-outline/55 active:bg-surface-container-high active:text-primary lg:hover:bg-surface-container-high lg:hover:text-primary'
                  )}
                  title={p.label}
                >
                  <Flag className={cn('h-3.5 w-3.5', p.color, task.priority === p.value && 'fill-current')} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </MetadataRow>

          <MetadataRow icon={LayoutDashboard} label="Quadrant" align="center">
            <select
              value={task.quadrant || 'none'}
              onChange={async (e) => {
                const quadrant = e.target.value === 'none' ? null : e.target.value;
                updateTaskState(task.id, { quadrant });
                try {
                  unwrapDatabaseResult(await updateTask(task.id, { quadrant }));
                } catch (error) {
                  alert(getClientErrorMessage(error, 'Unable to update the matrix quadrant right now.'));
                }
              }}
              className={metadataSelectClassName}
            >
              <option value="none">None</option>
              <option value="urgent-important">Urgent & Important</option>
              <option value="not-urgent-important">Not Urgent & Important</option>
              <option value="urgent-not-important">Urgent & Not Important</option>
              <option value="not-urgent-not-important">Not Urgent & Not Important</option>
            </select>
          </MetadataRow>

          <MetadataRow icon={Tag} label="Tags" align="center">
            <button
              type="button"
              className="touch-target flex w-full items-center rounded-xl border border-dashed border-outline-variant/20 px-3.5 py-2 text-left text-[10px] font-label font-bold uppercase tracking-[0.15em] text-outline/45 transition-all active:border-primary/20 active:bg-primary/5 active:text-primary lg:hover:border-primary/20 lg:hover:bg-primary/5 lg:hover:text-primary"
            >
              Add identifiers...
            </button>
          </MetadataRow>
        </div>

        <TaskAttachmentsSection taskId={task.id} />

        {/* Description / Context & Notes */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/70 px-2">
            <AlignLeft className="w-4 h-4 text-primary/60" />
            <span>Context & Notes</span>
          </div>
          <div className="bg-white rounded-2xl border border-outline-variant/10 overflow-hidden shadow-sm">
            <RichTextEditor 
              content={description}
              onChange={setDescription}
              onBlur={handleDescriptionBlur}
            />
          </div>
        </div>

        {/* Subtasks */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/70 px-2">
            <CheckSquare className="w-4 h-4 text-primary/60" />
            <span>Sub-Objectives</span>
          </div>
          
          <div className="space-y-3">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-5 group px-6 py-4 bg-white rounded-xl border border-outline-variant/10 hover:border-primary/20 hover:shadow-sm transition-all">
                <button 
                  onClick={() => handleToggleSubtask(subtask.id, subtask.isCompleted)}
                  className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                    subtask.isCompleted ? "bg-primary border-primary text-on-primary" : "border-outline-variant hover:border-primary"
                  )}
                >
                  {subtask.isCompleted && <CheckCircle2 className="w-3 h-3" />}
                </button>
                <span className={cn(
                  "text-[14px] font-body transition-all",
                  subtask.isCompleted ? "text-outline line-through" : "text-primary font-medium"
                )}>
                  {subtask.title}
                </span>
                <button 
                  onClick={async () => {
                    useStore.getState().deleteTask(subtask.id);
                    try {
                      unwrapDatabaseResult(await deleteTask(subtask.id));
                    } catch (error) {
                      alert(getClientErrorMessage(error, 'Unable to delete subtask right now.'));
                    }
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 p-2 hover:bg-error/10 text-outline/40 hover:text-error transition-all rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubtask} className="flex items-center gap-4 px-6 py-3 bg-white/50 rounded-xl border border-dashed border-outline-variant/30 focus-within:border-primary/40 focus-within:bg-white transition-all">
            <Plus className="w-5 h-5 text-outline/40" />
            <input 
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add sub-objective..."
              className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-body placeholder:text-outline/40"
            />
          </form>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-8 border-t border-outline-variant/30 flex items-center justify-between shrink-0 bg-surface-container-low/50">
        <span className="text-[8px] font-label font-bold tracking-[0.25em] uppercase text-outline/40 italic">
          {isOccurrenceScopedRecurringTask && selectedOccurrenceDate
            ? `Viewing ${format(selectedOccurrenceDate, 'MMM d, yyyy')} occurrence`
            : `Initiated ${task.id.startsWith('temp') ? 'just now' : 'in recent history'}`}
        </span>
      </div>
    </div>
  );
}
