'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Menu, Plus, Circle, CheckCircle2 } from 'lucide-react';
import { createTask, updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';

import { MatrixView } from '@/components/views/MatrixView';

export function MainContent() {
  const { toggleSidebar, currentView, selectedListId, tasks, addTask, updateTask: updateTaskState, setSelectedTaskId } = useStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');

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
    if (selectedListId) {
      return task.listId === selectedListId;
    }
    return true; // Inbox shows all for now
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-16 flex items-center px-6 gap-4 shrink-0">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-muted/50 rounded-full text-muted-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-semibold capitalize font-heading tracking-tight">
          {selectedListId || currentView}
        </h1>
      </header>

      {/* Quick Add Bar */}
      <div className="px-6 py-2 shrink-0">
        <div className="relative flex items-center group">
          <Plus className="absolute left-4 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleAddTask}
            placeholder="Add a task... (e.g., 'Meeting tomorrow at 3 PM')"
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-muted/30 border-none shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Render different views based on currentView */}
        {currentView === 'list' && (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div 
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl bg-background border border-border/40 shadow-sm cursor-pointer hover:shadow-md hover:border-border/60 transition-all",
                  task.isCompleted && "opacity-60 bg-muted/10"
                )}
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleComplete(task.id, task.isCompleted);
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {task.isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </button>
                <span className={cn("flex-1 text-[15px]", task.isCompleted && "line-through text-muted-foreground")}>
                  {task.title}
                </span>
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No tasks here yet. Add one above.</p>
              </div>
            )}
          </div>
        )}
        {currentView === 'calendar' && <div>Calendar View (Coming Soon)</div>}
        {currentView === 'matrix' && <MatrixView />}
        {currentView === 'kanban' && <div>Kanban View (Coming Soon)</div>}
        {currentView === 'habits' && <div>Habit Tracker (Coming Soon)</div>}
      </div>
    </div>
  );
}
