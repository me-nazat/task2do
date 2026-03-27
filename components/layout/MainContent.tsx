'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Menu, Plus, Circle, CheckCircle2, Calendar as CalendarIcon, Tag } from 'lucide-react';
import { createTask, updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, isAfter, isSameDay } from 'date-fns';

import { MatrixView } from '@/components/views/MatrixView';
import { KanbanView } from '@/components/views/KanbanView';
import { CalendarView } from '@/components/views/CalendarView';
import { HabitTrackerView } from '@/components/views/HabitTrackerView';

export function MainContent() {
  const { toggleSidebar, currentView, selectedListId, tasks, addTask, updateTask: updateTaskState, setSelectedTaskId, searchQuery } = useStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose focus function to window for sidebar button
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).focusQuickAdd = () => inputRef.current?.focus();
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).focusQuickAdd;
      }
    };
  }, []);

  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTaskTitle.trim()) {
      const title = newTaskTitle.trim();
      setNewTaskTitle('');
      
      // Optimistic update
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
        quadrant: null,
        parentId: null,
        timezone: null,
        reminderAt: null,
        status: 'todo' as const,
      };
      addTask(newTask);

      try {
        const id = await createTask({ title, listId: selectedListId || undefined });
        // Update the temp task with the real ID
        updateTaskState(tempId, { id });
      } catch (error) {
        console.error('Failed to create task', error);
        // Ideally, remove the temp task here if it failed
      }
    }
  };

  const handleToggleComplete = async (taskId: string, currentStatus: boolean | null) => {
    const newStatus = !currentStatus;
    updateTaskState(taskId, { isCompleted: newStatus });
    try {
      await updateTask(taskId, { isCompleted: newStatus });
    } catch (error) {
      console.error('Failed to update task', error);
      updateTaskState(taskId, { isCompleted: currentStatus }); // Revert
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (task.parentId) return false; // Hide subtasks from main list
    
    // Search filter
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (currentView === 'today') {
      return task.startDate && isSameDay(new Date(task.startDate), new Date());
    }
    if (currentView === 'upcoming') {
      return task.startDate && isAfter(startOfDay(new Date(task.startDate)), endOfDay(new Date()));
    }
    if (currentView === 'list') {
      if (selectedListId === 'someday') {
        return task.listId === 'someday';
      }
      if (selectedListId) {
        return task.listId === selectedListId;
      }
      return !task.listId; // Inbox shows tasks without a list
    }
    return true;
  });

  const getViewTitle = () => {
    if (currentView === 'today') return 'Today';
    if (currentView === 'upcoming') return 'Upcoming';
    if (currentView === 'list') return selectedListId || 'Inbox';
    return currentView.charAt(0).toUpperCase() + currentView.slice(1);
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <header className="h-16 flex items-center px-12 gap-4 shrink-0 md:hidden">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-surface-container-high rounded-none text-on-surface-variant transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto px-12 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Quick Add Bar */}
          <div className="mb-16">
            <div className="flex items-center gap-4 bg-surface-container-low p-1 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary transition-all duration-300">
              <Plus className="ml-4 w-5 h-5 text-outline" />
              <input 
                ref={inputRef}
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleAddTask}
                placeholder="CAPTURE NEW TASK..."
                className="flex-1 bg-transparent border-none focus:ring-0 py-4 font-headline text-lg tracking-tight uppercase placeholder:text-outline font-medium"
              />
              <div className="flex gap-2 px-4 border-l border-outline-variant">
                <CalendarIcon className="w-5 h-5 text-outline cursor-pointer hover:text-primary transition-colors" />
                <Tag className="w-5 h-5 text-outline cursor-pointer hover:text-primary transition-colors" />
              </div>
            </div>
          </div>

          {/* Render different views based on currentView */}
          {(currentView === 'list' || currentView === 'today' || currentView === 'upcoming') && (
            <div className="space-y-12">
              <div className="group-container">
                <div className="flex justify-between items-end mb-6">
                  <h2 className="font-headline font-black text-4xl tracking-tighter uppercase">{getViewTitle()}</h2>
                  <span className="font-headline text-[10px] tracking-[0.3em] text-outline font-bold uppercase">
                    {format(new Date(), 'MMM dd, yyyy')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {filteredTasks.map((task) => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={cn(
                        "group flex items-center justify-between p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer border-l-4",
                        task.isCompleted ? "border-primary bg-surface-container-low/50" : "border-tertiary-container"
                      )}
                    >
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(task.id, task.isCompleted);
                          }}
                          className={cn(
                            "w-5 h-5 border-2 border-primary flex items-center justify-center transition-colors",
                            task.isCompleted ? "bg-primary" : "hover:bg-surface-container-high"
                          )}
                        >
                          {task.isCompleted && <CheckCircle2 className="w-3 h-3 text-on-primary-fixed" />}
                        </button>
                        <div>
                          <p className={cn(
                            "text-sm font-medium tracking-tight",
                            task.isCompleted ? "text-outline line-through" : "text-primary"
                          )}>
                            {task.title}
                          </p>
                          {task.startDate && (
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[9px] font-headline uppercase tracking-widest text-on-surface-variant font-semibold">
                                {format(new Date(task.startDate), 'hh:mm a')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredTasks.length === 0 && (
                    <div className="text-center py-16 text-outline flex flex-col items-center gap-3">
                      <p className="text-lg font-headline font-bold uppercase tracking-widest">All caught up!</p>
                      <p className="text-xs font-medium uppercase tracking-widest">No tasks here yet. Add one above.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {currentView === 'calendar' && <CalendarView />}
          {currentView === 'matrix' && <MatrixView />}
          {currentView === 'kanban' && <KanbanView />}
          {currentView === 'habits' && <HabitTrackerView />}
        </div>
      </div>
    </div>
  );
}
