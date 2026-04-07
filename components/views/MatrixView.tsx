'use client';

import { useStore, Task } from '@/store/useStore';
import { createTask, updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { Circle, CheckCircle2, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';

const quadrants = [
  { id: 'urgent-important', title: 'Urgent & Important', color: 'bg-red-50/80 border-red-200/40 text-red-700' },
  { id: 'not-urgent-important', title: 'Not Urgent & Important', color: 'bg-blue-50/80 border-blue-200/40 text-blue-700' },
  { id: 'urgent-not-important', title: 'Urgent & Not Important', color: 'bg-amber-50/80 border-amber-200/40 text-amber-700' },
  { id: 'not-urgent-not-important', title: 'Not Urgent & Not Important', color: 'bg-stone-50/80 border-stone-200/40 text-stone-500' },
];

export function MatrixView() {
  const { tasks, setSelectedTaskId, updateTask: updateTaskState, addTask, selectedListId, user } = useStore();
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeQuadrant, setActiveQuadrant] = useState<string | null>(null);

  const handleImportTask = async (taskId: string) => {
    if (!activeQuadrant) return;
    updateTaskState(taskId, { quadrant: activeQuadrant });
    setIsAddTaskModalOpen(false);
    setIsImporting(false);
    try {
      unwrapDatabaseResult(await updateTask(taskId, { quadrant: activeQuadrant }));
    } catch (error) {
      console.error('Failed to import task to matrix', error);
      alert(getClientErrorMessage(error, 'Unable to move that task into the matrix right now.'));
    }
  };

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
      recurrence: null,
      status: 'todo' as const,
      completedOccurrences: null,
      deletedOccurrences: null,
      userId: user.id,
    };
    addTask(newTask);
    setNewTaskTitle('');
    setIsAddTaskModalOpen(false);
    try {
      const id = unwrapDatabaseResult(await createTask({ title, listId: selectedListId || undefined, quadrant: quadrantId, userId: user.id }));
      updateTaskState(tempId, { id });
    } catch (error) {
      console.error('Failed to create task', error);
      useStore.getState().deleteTask(tempId);
      alert(getClientErrorMessage(error, 'Unable to create task right now.'));
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
      try {
        unwrapDatabaseResult(await updateTask(taskId, { quadrant: quadrantId }));
      } catch (error) {
        alert(getClientErrorMessage(error, 'Unable to move that task right now.'));
      }
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
    const task = tasks.find((item) => item.id === taskId);
    const updates = { isCompleted: newStatus, updatedAt: new Date() };
    updateTaskState(taskId, updates);
    try {
      unwrapDatabaseResult(await updateTask(taskId, updates));
    } catch (error) {
      updateTaskState(taskId, { isCompleted: currentStatus, updatedAt: task?.updatedAt });
      alert(getClientErrorMessage(error, 'Unable to update the task right now.'));
    }
  };

  return (
    <div className="grid h-auto grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 md:grid-rows-2 lg:gap-8 md:min-h-[700px]">
      {quadrants.map((quadrant) => {
        const quadrantTasks = tasks.filter(t => t.quadrant === quadrant.id && !t.parentId);
        
        return (
          <div 
            key={quadrant.id}
            onDrop={(e) => handleDrop(e, quadrant.id)}
            onDragOver={handleDragOver}
            className={cn("flex min-h-[18rem] flex-col rounded-2xl border bg-white/40 p-4 backdrop-blur-sm transition-all sm:min-h-[20rem] sm:p-6 lg:min-h-0 lg:p-8", quadrant.color)}>
            <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
              <h3 className="font-headline font-medium text-lg sm:text-xl lg:text-2xl tracking-tight italic">{quadrant.title}</h3>
              <button 
                onClick={() => openAddTaskModal(quadrant.id)}
                className="touch-target flex items-center justify-center rounded-full p-2 transition-colors active:scale-95 active:bg-black/5 lg:hover:bg-black/5"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <Modal 
              isOpen={isAddTaskModalOpen} 
              onClose={() => {
                setIsAddTaskModalOpen(false);
                setTimeout(() => setIsImporting(false), 200);
              }}
              title={isImporting ? "Import Existing Task" : "New Task"}
            >
              {isImporting ? (
                <div className="space-y-4">
                  <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 hide-scrollbar">
                    {(() => {
                      const availableTasks = tasks.filter(t => !t.quadrant && !t.isCompleted && !t.parentId);
                      if (availableTasks.length === 0) {
                        return <div className="text-center py-8 text-outline text-sm italic font-body">No pending unassigned tasks available in your Inbox</div>;
                      }
                      return availableTasks.map(task => (
                        <div 
                          key={task.id}
                          onClick={() => handleImportTask(task.id)}
                          className="group flex cursor-pointer items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container p-4 transition-all active:scale-[0.99] active:border-primary/30 active:shadow-sm lg:hover:border-primary/30 lg:hover:shadow-sm"
                        >
                          <span className="text-sm font-body font-medium text-primary truncate flex-1">{task.title}</span>
                          <Plus className="w-4 h-4 text-primary opacity-0 transition-opacity lg:group-hover:opacity-100" />
                        </div>
                      ));
                    })()}
                  </div>
                  <button 
                    onClick={() => setIsImporting(false)}
                    className="mt-2 w-full rounded-xl bg-surface-container py-3 font-label font-bold uppercase tracking-[0.2em] text-outline transition-all active:scale-[0.99] active:bg-surface-container-high lg:hover:bg-surface-container-high"
                  >
                    Back to Create New
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddTask} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-label font-bold tracking-[0.2em] uppercase text-outline/60">Task Title</label>
                    <input 
                      autoFocus
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="e.g. Finish quarterly report"
                      className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-5 py-4 font-body text-base outline-none transition-all focus:ring-2 focus:ring-primary/20 sm:text-lg"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsImporting(true)}
                      className="flex-1 rounded-xl bg-surface-container py-4 font-label font-bold uppercase tracking-[0.1em] text-outline transition-all active:scale-[0.99] active:bg-surface-container-high lg:hover:bg-surface-container-high"
                    >
                      Import Existing
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] rounded-xl bg-primary py-4 font-label font-bold uppercase tracking-[0.15em] text-on-primary shadow-md transition-all active:scale-[0.99] lg:hover:bg-primary/90"
                    >
                      Create Task
                    </button>
                  </div>
                </form>
              )}
            </Modal>
            <div className="hide-scrollbar max-h-[15rem] flex-1 space-y-4 overflow-y-auto pr-1 sm:max-h-[18rem] sm:pr-2 md:max-h-none">
              {quadrantTasks.map(task => (
                <div 
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "flex cursor-grab items-center gap-3 rounded-xl border border-outline-variant/10 bg-white p-4 shadow-sm transition-all active:cursor-grabbing active:scale-[0.99] sm:gap-4 sm:p-5 lg:hover:shadow-md",
                    task.isCompleted && "opacity-60 grayscale-[0.5]"
                  )}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(task.id, task.isCompleted);
                    }}
                    className={cn(
                      "touch-target flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                      task.isCompleted ? "border-primary bg-primary text-on-primary" : "border-outline-variant active:border-primary lg:hover:border-primary"
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
                <div className="text-[9px] font-label font-bold tracking-[0.25em] uppercase text-outline/40 text-center py-8 sm:py-12 lg:py-16 border border-dashed border-outline-variant/30 rounded-xl">
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
