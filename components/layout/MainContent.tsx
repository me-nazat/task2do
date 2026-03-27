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
  const { toggleSidebar, currentView, selectedListId, tasks, addTask, updateTask: updateTaskState, deleteTask, setSelectedTaskId, searchQuery, user } = useStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ... (useEffect remains the same)

  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTaskTitle.trim() && user) {
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
        userId: user.id,
      };
      addTask(newTask);

      try {
        const id = await createTask({ title, listId: selectedListId || undefined, userId: user.id });
        // Update the temp task with the real ID
        updateTaskState(tempId, { id });
      } catch (error) {
        console.error('Failed to create task', error);
        // Remove the temp task if it failed
        deleteTask(tempId);
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
      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto px-16 py-16">
        <div className="max-w-5xl mx-auto">
          
          {/* Quick Add Bar */}
          <div className="mb-20">
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-outline-variant/10 shadow-sm focus-within:shadow-md focus-within:border-primary/20 transition-all duration-500">
              <div className="ml-4 w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary/60" />
              </div>
              <input 
                ref={inputRef}
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleAddTask}
                placeholder="Capture a new objective..."
                className="flex-1 bg-transparent border-none focus:ring-0 py-4 font-body text-lg tracking-tight placeholder:text-outline/40"
              />
              <div className="flex gap-4 px-6 border-l border-outline-variant/20">
                <CalendarIcon className="w-5 h-5 text-outline/40 cursor-pointer hover:text-primary transition-colors" />
                <Tag className="w-5 h-5 text-outline/40 cursor-pointer hover:text-primary transition-colors" />
              </div>
            </div>
          </div>

          {/* Render different views based on currentView */}
          {(currentView === 'list' || currentView === 'today' || currentView === 'upcoming') && (
            <div className="space-y-16">
              <div className="group-container">
                <div className="flex justify-between items-end mb-10 border-b border-outline-variant/30 pb-6">
                  <div>
                    <h2 className="font-headline font-medium text-5xl tracking-tight text-primary">{getViewTitle()}</h2>
                    <p className="font-label text-[9px] uppercase tracking-[0.25em] text-outline mt-3 font-bold opacity-60">Current Focus & Trajectory</p>
                  </div>
                  <span className="font-label text-[10px] tracking-[0.15em] text-outline font-semibold uppercase opacity-70">
                    {format(new Date(), 'EEEE, MMMM do')}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={cn(
                        "group flex items-center justify-between p-5 bg-white rounded-xl transition-all cursor-pointer border border-outline-variant/10 hover:border-primary/20 hover:shadow-md",
                        task.isCompleted && "opacity-60 grayscale-[0.5]"
                      )}
                    >
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(task.id, task.isCompleted);
                          }}
                          className={cn(
                            "w-6 h-6 rounded-full border border-outline-variant flex items-center justify-center transition-all group-hover:border-primary",
                            task.isCompleted ? "bg-primary border-primary" : "bg-transparent"
                          )}
                        >
                          {task.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-on-primary" />}
                        </button>
                        <div>
                          <p className={cn(
                            "text-[15px] font-body transition-all",
                            task.isCompleted ? "text-outline line-through" : "text-primary font-medium"
                          )}>
                            {task.title}
                          </p>
                          {task.startDate && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <CalendarIcon className="w-3 h-3 text-outline/60" />
                              <span className="text-[9px] font-label uppercase tracking-[0.15em] text-outline font-bold opacity-60">
                                {format(new Date(task.startDate), 'hh:mm a')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tag className="w-4 h-4 text-outline/40 hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                  {filteredTasks.length === 0 && (
                    <div className="text-center py-24 text-outline flex flex-col items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-outline/40" />
                      </div>
                      <div>
                        <p className="text-xl font-headline italic text-primary">All is in order</p>
                        <p className="text-[9px] font-label uppercase tracking-[0.25em] mt-2 font-bold opacity-60">No pending actions in this view</p>
                      </div>
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
