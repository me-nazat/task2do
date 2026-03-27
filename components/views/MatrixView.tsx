'use client';

import { useStore, Task } from '@/store/useStore';
import { createTask, updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { Circle, CheckCircle2, Plus } from 'lucide-react';
import { useCallback } from 'react';

const quadrants = [
  { id: 'urgent-important', title: 'URGENT & IMPORTANT', color: 'bg-error-container/20 border-error text-error' },
  { id: 'not-urgent-important', title: 'NOT URGENT & IMPORTANT', color: 'bg-info-container/20 border-info text-info' },
  { id: 'urgent-not-important', title: 'URGENT & NOT IMPORTANT', color: 'bg-warning-container/20 border-warning text-warning' },
  { id: 'not-urgent-not-important', title: 'NOT URGENT & NOT IMPORTANT', color: 'bg-surface-container-high border-outline text-on-surface-variant' },
];

export function MatrixView() {
  const { tasks, setSelectedTaskId, updateTask: updateTaskState, addTask, selectedListId } = useStore();

  const handleAddTask = useCallback(async (quadrantId: string) => {
    const title = prompt('Enter task title:');
    if (title) {
      const tempId = `temp-${Date.now()}`;
      const newTask = {
        id: tempId,
        title,
        isCompleted: false,
        priority: 0,
        startDate: null,
        endDate: null,
        isAllDay: false,
        listId: selectedListId,
        description: null,
        quadrant: quadrantId,
        parentId: null,
        timezone: null,
        reminderAt: null,
        status: 'todo' as const,
      };
      addTask(newTask);
      try {
        const id = await createTask({ title, listId: selectedListId || undefined, quadrant: quadrantId });
        updateTaskState(tempId, { id });
      } catch (error) {
        console.error('Failed to create task', error);
      }
    }
  }, [addTask, selectedListId, updateTaskState]);

  const handleDrop = async (e: React.DragEvent, quadrantId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      updateTaskState(taskId, { quadrant: quadrantId });
      await updateTask(taskId, { quadrant: quadrantId });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleToggleComplete = async (taskId: string, currentStatus: boolean | null) => {
    const newStatus = !currentStatus;
    updateTaskState(taskId, { isCompleted: newStatus });
    try {
      await updateTask(taskId, { isCompleted: newStatus });
    } catch (error) {
      updateTaskState(taskId, { isCompleted: currentStatus });
    }
  };

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-6 h-full min-h-[600px]">
      {quadrants.map((quadrant) => {
        const quadrantTasks = tasks.filter(t => t.quadrant === quadrant.id && !t.parentId);
        
        return (
          <div 
            key={quadrant.id}
            onDrop={(e) => handleDrop(e, quadrant.id)}
            onDragOver={handleDragOver}
            className={cn("border-l-4 p-6 flex flex-col transition-colors shadow-sm", quadrant.color)}
          >
            <h3 className="font-headline font-black text-lg tracking-tighter uppercase mb-6">{quadrant.title}</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {quadrantTasks.map(task => (
                <div 
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "flex items-center gap-4 p-4 bg-surface border-l-4 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
                    task.isCompleted ? "border-primary bg-surface-container-low/50" : "border-transparent hover:border-outline-variant"
                  )}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(task.id, task.isCompleted);
                    }}
                    className={cn(
                      "w-5 h-5 border-2 flex items-center justify-center transition-colors shrink-0",
                      task.isCompleted ? "bg-primary border-primary text-on-primary-fixed" : "border-outline hover:border-primary"
                    )}
                  >
                    {task.isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <span className={cn("text-sm font-medium truncate", task.isCompleted ? "line-through text-outline" : "text-on-surface")}>
                    {task.title}
                  </span>
                </div>
              ))}
              {quadrantTasks.length === 0 && (
                <div className="text-xs font-headline font-bold tracking-widest uppercase text-outline text-center py-12 border-2 border-dashed border-outline-variant">
                  DRAG TASKS HERE
                </div>
              )}
            </div>
            <button 
              onClick={() => handleAddTask(quadrant.id)}
              className="mt-6 flex items-center gap-3 text-xs font-headline font-bold tracking-widest uppercase text-outline hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" />
              ADD TASK
            </button>
          </div>
        );
      })}
    </div>
  );
}
