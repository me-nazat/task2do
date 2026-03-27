'use client';

import { useStore } from '@/store/useStore';
import { X, Calendar as CalendarIcon, Flag, Tag, AlignLeft, CheckSquare, Trash2, Plus, Circle, CheckCircle2, LayoutDashboard } from 'lucide-react';
import { updateTask, deleteTask, createTask } from '@/actions/task';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

export function RightPane() {
  const { selectedTaskId, setSelectedTaskId, tasks, updateTask: updateTaskState, deleteTask: deleteTaskState, user } = useStore();
  
  const task = tasks.find(t => t.id === selectedTaskId);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (!selectedTaskId || !task) return null;

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
    };

    useStore.getState().addTask(newSubtask);
    setNewSubtaskTitle('');

    try {
      const realId = await createTask({
        title: newSubtaskTitle,
        listId: task.listId || undefined,
        parentId: task.id,
        userId: user.id,
      });
      useStore.getState().updateTask(tempId, { id: realId });
    } catch (error) {
      console.error('Failed to create subtask', error);
      useStore.getState().deleteTask(tempId);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentStatus: boolean | null) => {
    const newStatus = !currentStatus;
    updateTaskState(subtaskId, { isCompleted: newStatus });
    try {
      await updateTask(subtaskId, { isCompleted: newStatus });
    } catch (error) {
      updateTaskState(subtaskId, { isCompleted: currentStatus });
    }
  };

  const handleTitleBlur = async () => {
    if (title !== task.title) {
      updateTaskState(task.id, { title });
      await updateTask(task.id, { title });
    }
  };

  const handleDescriptionBlur = async () => {
    if (description !== (task.description || '')) {
      updateTaskState(task.id, { description });
      await updateTask(task.id, { description });
    }
  };

  const handleDelete = async () => {
    deleteTaskState(task.id);
    setSelectedTaskId(null);
    await deleteTask(task.id);
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low">
      {/* Header */}
      <div className="h-20 border-b border-outline-variant/30 flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-3 text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/70">
          <CheckSquare className="w-4 h-4 text-primary/60" />
          <span>Objective Details</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDelete}
            className="p-2.5 hover:bg-error/10 hover:text-error rounded-full text-outline/60 transition-all"
            title="Archive Objective"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSelectedTaskId(null)}
            className="p-2.5 hover:bg-surface-container-high rounded-full text-outline/60 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-10 space-y-16">
        {/* Title */}
        <div>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-4xl font-light bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-outline/30 font-headline tracking-tight text-primary italic"
            placeholder="Objective Title"
          />
        </div>

        {/* Properties */}
        <div className="space-y-8 bg-white p-8 rounded-2xl border border-outline-variant/10 shadow-sm">
          <div className="flex items-start gap-6 text-sm">
            <div className="w-28 text-outline/70 flex items-center gap-2.5 pt-1.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase">
              <CalendarIcon className="w-3.5 h-3.5" /> Schedule
            </div>
            <div className="flex-1">
              <DateTimePicker
                startDate={task.startDate ? new Date(task.startDate) : null}
                endDate={task.endDate ? new Date(task.endDate) : null}
                isAllDay={task.isAllDay}
                timezone={task.timezone}
                reminderAt={task.reminderAt ? new Date(task.reminderAt) : null}
                onChange={async (updates) => {
                  updateTaskState(task.id, updates);
                  await updateTask(task.id, updates);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase">
              <CheckCircle2 className="w-3.5 h-3.5" /> Status
            </div>
            <div className="flex-1">
              <select
                value={task.status || 'todo'}
                onChange={async (e) => {
                  const status = e.target.value as any;
                  const isCompleted = status === 'done';
                  updateTaskState(task.id, { status, isCompleted });
                  await updateTask(task.id, { status, isCompleted });
                }}
                className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 rounded-lg border-none transition-all text-[10px] font-label font-bold tracking-[0.15em] uppercase focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase">
              <Flag className="w-3.5 h-3.5" /> Priority
            </div>
            <div className="flex-1 flex items-center gap-3">
              {[
                { value: 0, label: 'None', color: 'text-outline/40' },
                { value: 1, label: 'Low', color: 'text-info' },
                { value: 2, label: 'Medium', color: 'text-warning' },
                { value: 3, label: 'High', color: 'text-error' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={async () => {
                    updateTaskState(task.id, { priority: p.value });
                    await updateTask(task.id, { priority: p.value });
                  }}
                  className={cn(
                    "p-2.5 rounded-full transition-all hover:bg-surface-container-low",
                    task.priority === p.value ? "bg-surface-container-high shadow-sm scale-110" : ""
                  )}
                  title={p.label}
                >
                  <Flag className={cn("w-4 h-4", p.color, task.priority === p.value ? "fill-current" : "")} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase">
              <LayoutDashboard className="w-3.5 h-3.5" /> Quadrant
            </div>
            <div className="flex-1">
              <select
                value={task.quadrant || 'none'}
                onChange={async (e) => {
                  const quadrant = e.target.value === 'none' ? null : e.target.value;
                  updateTaskState(task.id, { quadrant });
                  await updateTask(task.id, { quadrant });
                }}
                className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 rounded-lg border-none transition-all text-[10px] font-label font-bold tracking-[0.15em] uppercase focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="none">None</option>
                <option value="urgent-important">Urgent & Important</option>
                <option value="not-urgent-important">Not Urgent & Important</option>
                <option value="urgent-not-important">Urgent & Not Important</option>
                <option value="not-urgent-not-important">Not Urgent & Not Important</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase">
              <Tag className="w-3.5 h-3.5" /> Tags
            </div>
            <div className="flex-1 px-4 py-2.5 hover:bg-surface-container-low rounded-lg cursor-pointer transition-all text-outline/50 font-label font-bold text-[9px] tracking-[0.15em] uppercase">
              Add identifiers...
            </div>
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
                    await deleteTask(subtask.id);
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

        {/* Description */}
        <div className="space-y-6">
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
      </div>

      {/* Footer Actions */}
      <div className="p-8 border-t border-outline-variant/30 flex items-center justify-between shrink-0 bg-surface-container-low/50">
        <span className="text-[8px] font-label font-bold tracking-[0.25em] uppercase text-outline/40 italic">
          Initiated {task.id.startsWith('temp') ? 'just now' : 'in recent history'}
        </span>
      </div>
    </div>
  );
}
