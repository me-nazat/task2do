'use client';

import { useStore } from '@/store/useStore';
import { X, Calendar as CalendarIcon, Flag, Tag, AlignLeft, CheckSquare, Trash2, Plus, Circle, CheckCircle2, LayoutDashboard } from 'lucide-react';
import { updateTask, deleteTask, createTask } from '@/actions/task';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

export function RightPane() {
  const { selectedTaskId, setSelectedTaskId, tasks, updateTask: updateTaskState, deleteTask: deleteTaskState } = useStore();
  
  const task = tasks.find(t => t.id === selectedTaskId);
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (!selectedTaskId || !task) return null;

  const subtasks = tasks.filter(t => t.parentId === task.id);

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

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
    };

    useStore.getState().addTask(newSubtask);
    setNewSubtaskTitle('');

    try {
      const realId = await createTask({
        title: newSubtaskTitle,
        listId: task.listId || undefined,
        parentId: task.id,
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
      <div className="h-16 border-b-2 border-transparent flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-2 text-xs font-headline font-bold tracking-widest uppercase text-on-surface-variant">
          <CheckSquare className="w-4 h-4" />
          <span>Task Details</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleDelete}
            className="p-2 hover:bg-error-container hover:text-error rounded-none text-on-surface-variant transition-colors"
            title="Delete Task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSelectedTaskId(null)}
            className="p-2 hover:bg-surface-container-high rounded-none text-on-surface-variant transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-12">
        {/* Title */}
        <div>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-3xl font-black bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-outline font-headline tracking-tighter uppercase"
            placeholder="TASK TITLE"
          />
        </div>

        {/* Properties */}
        <div className="space-y-6 bg-surface-container-lowest p-6 border-l-4 border-tertiary-container shadow-sm">
          <div className="flex items-start gap-4 text-sm">
            <div className="w-24 text-on-surface-variant flex items-center gap-2 pt-1.5 font-headline font-bold text-xs tracking-widest uppercase">
              <CalendarIcon className="w-4 h-4" /> Date
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

          <div className="flex items-center gap-4 text-sm">
            <div className="w-24 text-on-surface-variant flex items-center gap-2 font-headline font-bold text-xs tracking-widest uppercase">
              <CheckCircle2 className="w-4 h-4" /> Status
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
                className="bg-surface-container-high hover:bg-surface-container-highest px-4 py-2 border-none transition-colors text-xs font-headline font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="w-24 text-on-surface-variant flex items-center gap-2 font-headline font-bold text-xs tracking-widest uppercase">
              <Flag className="w-4 h-4" /> Priority
            </div>
            <div className="flex-1 flex items-center gap-2">
              {[
                { value: 0, label: 'None', color: 'text-outline' },
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
                    "p-2 transition-colors hover:bg-surface-container-high",
                    task.priority === p.value ? "bg-surface-container-highest shadow-sm" : ""
                  )}
                  title={p.label}
                >
                  <Flag className={cn("w-4 h-4", p.color, task.priority === p.value ? "fill-current" : "")} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="w-24 text-on-surface-variant flex items-center gap-2 font-headline font-bold text-xs tracking-widest uppercase">
              <LayoutDashboard className="w-4 h-4" /> Quadrant
            </div>
            <div className="flex-1">
              <select
                value={task.quadrant || 'none'}
                onChange={async (e) => {
                  const quadrant = e.target.value === 'none' ? null : e.target.value;
                  updateTaskState(task.id, { quadrant });
                  await updateTask(task.id, { quadrant });
                }}
                className="bg-surface-container-high hover:bg-surface-container-highest px-4 py-2 border-none transition-colors text-xs font-headline font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="none">None</option>
                <option value="urgent-important">Urgent & Important</option>
                <option value="not-urgent-important">Not Urgent & Important</option>
                <option value="urgent-not-important">Urgent & Not Important</option>
                <option value="not-urgent-not-important">Not Urgent & Not Important</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="w-24 text-on-surface-variant flex items-center gap-2 font-headline font-bold text-xs tracking-widest uppercase">
              <Tag className="w-4 h-4" /> Tags
            </div>
            <div className="flex-1 px-4 py-2 hover:bg-surface-container-high cursor-pointer transition-colors text-outline font-headline font-bold text-xs tracking-widest uppercase">
              ADD TAGS...
            </div>
          </div>
        </div>

        {/* Subtasks */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-headline font-bold tracking-widest uppercase text-on-surface-variant">
            <CheckSquare className="w-4 h-4" /> Subtasks
          </div>
          
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-4 group px-4 py-3 bg-surface-container-lowest hover:bg-surface-container-high transition-colors border-l-2 border-tertiary-container">
                <button 
                  onClick={() => handleToggleSubtask(subtask.id, subtask.isCompleted)}
                  className={cn(
                    "w-5 h-5 border-2 flex items-center justify-center transition-colors",
                    subtask.isCompleted ? "bg-primary border-primary text-on-primary-fixed" : "border-outline hover:border-primary"
                  )}
                >
                  {subtask.isCompleted && <CheckSquare className="w-3.5 h-3.5" />}
                </button>
                <span className={cn(
                  "text-sm font-medium transition-all",
                  subtask.isCompleted ? "text-outline line-through" : "text-on-surface"
                )}>
                  {subtask.title}
                </span>
                <button 
                  onClick={async () => {
                    useStore.getState().deleteTask(subtask.id);
                    await deleteTask(subtask.id);
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 p-2 hover:bg-error-container text-on-surface-variant hover:text-error transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubtask} className="flex items-center gap-4 px-4 py-2 bg-surface-container-lowest border-l-2 border-transparent focus-within:border-primary transition-colors">
            <Plus className="w-5 h-5 text-outline" />
            <input 
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="ADD SUBTASK..."
              className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-headline font-bold tracking-widest uppercase placeholder:text-outline"
            />
          </form>
        </div>

        {/* Description */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-headline font-bold tracking-widest uppercase text-on-surface-variant">
            <AlignLeft className="w-4 h-4" /> Description
          </div>
          <div className="bg-surface-container-lowest p-4 border-l-4 border-tertiary-container">
            <RichTextEditor 
              content={description}
              onChange={setDescription}
              onBlur={handleDescriptionBlur}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t-2 border-transparent flex items-center justify-between shrink-0 bg-surface-container-low">
        <span className="text-[10px] font-headline font-bold tracking-[0.2em] uppercase text-outline">
          CREATED {task.id.startsWith('temp') ? 'JUST NOW' : 'RECENTLY'}
        </span>
      </div>
    </div>
  );
}
