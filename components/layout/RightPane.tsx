'use client';

import { useStore } from '@/store/useStore';
import { X, Calendar as CalendarIcon, Flag, Tag, AlignLeft, CheckSquare, Trash2, Plus, Circle } from 'lucide-react';
import { updateTask, deleteTask, createTask } from '@/actions/task';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DateTimePicker } from '@/components/ui/DateTimePicker';

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
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="h-16 border-b border-border/40 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <CheckSquare className="w-4 h-4" />
          <span>Task Details</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleDelete}
            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-full text-muted-foreground transition-colors"
            title="Delete Task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setSelectedTaskId(null)}
            className="p-2 hover:bg-muted/50 rounded-full text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Title */}
        <div>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-2xl font-semibold bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50 font-heading tracking-tight"
            placeholder="Task Title"
          />
        </div>

        {/* Properties */}
        <div className="space-y-4 bg-muted/20 p-4 rounded-2xl border border-border/30">
          <div className="flex items-start gap-4 text-sm">
            <div className="w-24 text-muted-foreground flex items-center gap-2 pt-1.5 font-medium">
              <CalendarIcon className="w-4 h-4" /> Date
            </div>
            <div className="flex-1">
              <DateTimePicker
                startDate={task.startDate ? new Date(task.startDate) : null}
                endDate={task.endDate ? new Date(task.endDate) : null}
                isAllDay={task.isAllDay}
                timezone={task.timezone}
                onChange={async (updates) => {
                  updateTaskState(task.id, updates);
                  await updateTask(task.id, updates);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="w-24 text-muted-foreground flex items-center gap-2 font-medium">
              <Flag className="w-4 h-4" /> Priority
            </div>
            <div className="flex-1 flex items-center gap-2">
              {[
                { value: 0, label: 'None', color: 'text-gray-400' },
                { value: 1, label: 'Low', color: 'text-blue-500' },
                { value: 2, label: 'Medium', color: 'text-yellow-500' },
                { value: 3, label: 'High', color: 'text-red-500' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={async () => {
                    updateTaskState(task.id, { priority: p.value });
                    await updateTask(task.id, { priority: p.value });
                  }}
                  className={cn(
                    "p-2 rounded-full transition-colors hover:bg-muted/50",
                    task.priority === p.value ? "bg-muted/80 shadow-sm" : ""
                  )}
                  title={p.label}
                >
                  <Flag className={cn("w-4 h-4", p.color, task.priority === p.value ? "fill-current" : "")} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="w-24 text-muted-foreground flex items-center gap-2 font-medium">
              <Tag className="w-4 h-4" /> Tags
            </div>
            <div className="flex-1 px-3 py-2 hover:bg-muted/50 rounded-xl cursor-pointer transition-colors text-muted-foreground">
              Add tags...
            </div>
          </div>
        </div>

        {/* Subtasks */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <CheckSquare className="w-4 h-4" /> Subtasks
          </div>
          
          <div className="space-y-1">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-3 group px-3 py-2 hover:bg-muted/30 rounded-xl transition-colors">
                <button 
                  onClick={() => handleToggleSubtask(subtask.id, subtask.isCompleted)}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    subtask.isCompleted ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 hover:border-primary"
                  )}
                >
                  {subtask.isCompleted && <CheckSquare className="w-3.5 h-3.5" />}
                </button>
                <span className={cn(
                  "text-[15px] transition-all",
                  subtask.isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                )}>
                  {subtask.title}
                </span>
                <button 
                  onClick={async () => {
                    useStore.getState().deleteTask(subtask.id);
                    await deleteTask(subtask.id);
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded-full hover:text-destructive transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubtask} className="flex items-center gap-3 px-3 py-1">
            <Plus className="w-5 h-5 text-muted-foreground" />
            <input 
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add subtask"
              className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[15px] placeholder:text-muted-foreground/50"
            />
          </form>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <AlignLeft className="w-4 h-4" /> Description
          </div>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            className="w-full min-h-[180px] p-5 rounded-2xl border border-border/40 bg-muted/10 hover:bg-muted/20 focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all duration-300 resize-y text-[15px] leading-relaxed placeholder:text-muted-foreground/40 text-foreground/90"
            placeholder="Add notes or description..."
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border/40 flex items-center justify-between shrink-0">
        <span className="text-xs text-muted-foreground font-medium">
          Created {task.id.startsWith('temp') ? 'just now' : 'recently'}
        </span>
      </div>
    </div>
  );
}
