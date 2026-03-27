'use client';

import { useStore, Task } from '@/store/useStore';
import { createTask, updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { Circle, CheckCircle2, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui/Modal';

const quadrants = [
  { id: 'urgent-important', title: 'Urgent & Important', color: 'bg-error/5 border-error/20 text-error' },
  { id: 'not-urgent-important', title: 'Not Urgent & Important', color: 'bg-info/5 border-info/20 text-info' },
  { id: 'urgent-not-important', title: 'Urgent & Not Important', color: 'bg-warning/5 border-warning/20 text-warning' },
  { id: 'not-urgent-not-important', title: 'Not Urgent & Not Important', color: 'bg-surface-container-high/30 border-outline-variant/30 text-outline' },
];

export function MatrixView() {
  const { tasks, setSelectedTaskId, updateTask: updateTaskState, addTask, selectedListId, user } = useStore();
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeQuadrant, setActiveQuadrant] = useState<string | null>(null);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle.trim() || !activeQuadrant) return;
    
    const title = newTaskTitle.trim();
    const quadrantId = activeQuadrant;
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
      userId: user.uid,
    };
    addTask(newTask);
    setNewTaskTitle('');
    setIsAddTaskModalOpen(false);
    try {
      const id = await createTask({ title, listId: selectedListId || undefined, quadrant: quadrantId, userId: user.uid });
      updateTaskState(tempId, { id });
    } catch (error) {
      console.error('Failed to create task', error);
    }
  };

  const openAddTaskModal = (quadrantId: string) => {
    setActiveQuadrant(quadrantId);
    setIsAddTaskModalOpen(true);
  };

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
    <div className="grid grid-cols-2 grid-rows-2 gap-8 h-full min-h-[700px]">
      {quadrants.map((quadrant) => {
        const quadrantTasks = tasks.filter(t => t.quadrant === quadrant.id && !t.parentId);
        
        return (
          <div 
            key={quadrant.id}
            onDrop={(e) => handleDrop(e, quadrant.id)}
            onDragOver={handleDragOver}
            className={cn("p-8 flex flex-col transition-all rounded-2xl border bg-white/40 backdrop-blur-sm", quadrant.color)}
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-headline font-medium text-2xl tracking-tight italic">{quadrant.title}</h3>
              <button 
                onClick={() => openAddTaskModal(quadrant.id)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <Modal 
              isOpen={isAddTaskModalOpen} 
              onClose={() => setIsAddTaskModalOpen(false)}
              title="New Task"
            >
              <form onSubmit={handleAddTask} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-label font-bold tracking-[0.2em] uppercase text-outline/60">Task Title</label>
                  <input 
                    autoFocus
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. Finish quarterly report"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-4 font-body text-lg focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary text-on-primary py-4 rounded-xl font-label font-bold tracking-[0.2em] uppercase hover:bg-primary/90 transition-all shadow-md"
                >
                  Create Task
                </button>
              </form>
            </Modal>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 hide-scrollbar">
              {quadrantTasks.map(task => (
                <div 
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm border border-outline-variant/10 cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
                    task.isCompleted && "opacity-60 grayscale-[0.5]"
                  )}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(task.id, task.isCompleted);
                    }}
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                      task.isCompleted ? "bg-primary border-primary text-on-primary" : "border-outline-variant hover:border-primary"
                    )}
                  >
                    {task.isCompleted && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                  <span className={cn("text-[14px] font-body font-medium truncate", task.isCompleted ? "line-through text-outline" : "text-primary")}>
                    {task.title}
                  </span>
                </div>
              ))}
              {quadrantTasks.length === 0 && (
                <div className="text-[9px] font-label font-bold tracking-[0.25em] uppercase text-outline/40 text-center py-16 border border-dashed border-outline-variant/30 rounded-xl">
                  Awaiting Input
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
