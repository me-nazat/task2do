'use client';

import { useStore, Task } from '@/store/useStore';
import { updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { Circle, CheckCircle2 } from 'lucide-react';

const quadrants = [
  { id: 'urgent-important', title: 'Urgent & Important', color: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400' },
  { id: 'not-urgent-important', title: 'Not Urgent & Important', color: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400' },
  { id: 'urgent-not-important', title: 'Urgent & Not Important', color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  { id: 'not-urgent-not-important', title: 'Not Urgent & Not Important', color: 'bg-gray-500/10 border-gray-500/20 text-gray-700 dark:text-gray-400' },
];

export function MatrixView() {
  const { tasks, setSelectedTaskId, updateTask: updateTaskState } = useStore();

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
    <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full min-h-[600px]">
      {quadrants.map((quadrant) => {
        const quadrantTasks = tasks.filter(t => t.quadrant === quadrant.id && !t.parentId);
        
        return (
          <div 
            key={quadrant.id}
            onDrop={(e) => handleDrop(e, quadrant.id)}
            onDragOver={handleDragOver}
            className={cn("rounded-3xl border-2 p-5 flex flex-col transition-colors", quadrant.color)}
          >
            <h3 className="font-semibold mb-4 text-[15px] tracking-tight">{quadrant.title}</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {quadrantTasks.map(task => (
                <div 
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl bg-background border border-border/40 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-border/60 transition-all",
                    task.isCompleted && "opacity-60 bg-muted/10"
                  )}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(task.id, task.isCompleted);
                    }}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  <span className={cn("text-[15px] truncate text-foreground", task.isCompleted && "line-through text-muted-foreground")}>
                    {task.title}
                  </span>
                </div>
              ))}
              {quadrantTasks.length === 0 && (
                <div className="text-sm text-muted-foreground/50 text-center py-8 border-2 border-dashed border-muted-foreground/20 rounded-xl">
                  Drag tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
