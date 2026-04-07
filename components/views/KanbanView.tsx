'use client';

import { useState } from 'react';
import { useStore, Task } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { GripVertical, MoreHorizontal, Plus, ArrowRight, CheckCircle2, Clock, Play } from 'lucide-react';
import { updateTask } from '@/actions/task';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';


type KanbanStatus = 'todo' | 'in-progress' | 'done';

const statusConfig: Record<KanbanStatus, { 
  label: string; 
  sublabel: string; 
  gradientFrom: string; 
  gradientTo: string; 
  borderColor: string; 
  iconColor: string; 
  badgeBg: string; 
  icon: typeof Clock;
}> = {
  'todo': { label: 'TO DO', sublabel: 'Pending Objectives', gradientFrom: 'from-primary/5', gradientTo: 'to-transparent', borderColor: 'border-primary/15', iconColor: 'text-primary/60', badgeBg: 'bg-primary/10', icon: Clock },
  'in-progress': { label: 'IN PROGRESS', sublabel: 'Active Execution', gradientFrom: 'from-amber-500/5', gradientTo: 'to-transparent', borderColor: 'border-amber-500/15', iconColor: 'text-amber-600/60', badgeBg: 'bg-amber-500/10', icon: Play },
  'done': { label: 'DONE', sublabel: 'Accomplished', gradientFrom: 'from-emerald-500/5', gradientTo: 'to-transparent', borderColor: 'border-emerald-500/15', iconColor: 'text-emerald-600/60', badgeBg: 'bg-emerald-500/10', icon: CheckCircle2 },
};

const columnOrder: KanbanStatus[] = ['todo', 'in-progress', 'done'];

// Today filter helpers
const isTodayOrBefore = (task: Task) => {
  if (!task.startDate) return true;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return new Date(task.startDate) <= today;
};

export function KanbanView() {
  const { tasks, setSelectedTaskId, updateTask: updateTaskState } = useStore();
  const [showTodayOnly, setShowTodayOnly] = useState(true);

  const tasksByStatus = columnOrder.reduce((acc, status) => {
    let filtered = tasks.filter(t => (t.status || 'todo') === status);
    if (status === 'todo' && showTodayOnly) {
      filtered = filtered.filter(isTodayOrBefore);
    }
    acc[status] = filtered;
    return acc;
  }, {} as Record<KanbanStatus, Task[]>);

  const handleMoveTask = async (task: Task, newStatus: KanbanStatus) => {
    const isNowDone = newStatus === 'done';
    const previousState = { status: task.status, isCompleted: task.isCompleted, updatedAt: task.updatedAt };
    const updates = { status: newStatus, isCompleted: isNowDone, updatedAt: new Date() };
    updateTaskState(task.id, updates);
    try {
      unwrapDatabaseResult(await updateTask(task.id, updates));
    } catch (error) {
      updateTaskState(task.id, previousState);
      alert(getClientErrorMessage(error, 'Unable to move this task right now.'));
    }
  };

  const getNextStatus = (status: KanbanStatus): KanbanStatus | null => {
    const idx = columnOrder.indexOf(status);
    return idx < columnOrder.length - 1 ? columnOrder[idx + 1] : null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Column page indicator for mobile */}
      <div className="flex items-center justify-center gap-2 py-3 lg:hidden">
        {columnOrder.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === 'todo' ? "bg-primary/60" : status === 'in-progress' ? "bg-amber-500/60" : "bg-emerald-500/60"
            )} />
            <span className="text-[8px] font-label font-bold uppercase tracking-[0.15em] text-outline/40">
              {statusConfig[status].label}
            </span>
          </div>
        ))}
      </div>

      {/* Kanban container: horizontal scroll on mobile, flex on desktop */}
      <div className="hide-scrollbar flex flex-1 gap-4 overflow-x-auto snap-x snap-mandatory px-2 pb-4 sm:gap-6 sm:px-1 lg:overflow-x-visible lg:px-0 lg:pb-4 lg:snap-none lg:gap-8">
        {columnOrder.map((status) => {
          const config = statusConfig[status];
          const columnTasks = tasksByStatus[status];
          const IconComponent = config.icon;

          return (
            <div
              key={status}
              className={cn(
                "flex flex-col bg-surface-container-lowest border shadow-sm overflow-hidden",
                /* Mobile: snap-to column, near-full width */
                "min-w-[85vw] max-w-[85vw] snap-center sm:min-w-[72vw] sm:max-w-[72vw]",
                /* Desktop: equal flex columns */
                "lg:min-w-0 lg:max-w-none lg:flex-1 lg:snap-none",
                "rounded-2xl lg:rounded-3xl",
                config.borderColor
              )}
            >
              {/* Column Header */}
              <div className={cn("px-5 sm:px-8 py-5 sm:py-6 border-b bg-gradient-to-b", config.borderColor, config.gradientFrom, config.gradientTo)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center", config.badgeBg)}>
                      <IconComponent className={cn("w-4 h-4 sm:w-5 sm:h-5", config.iconColor)} />
                    </div>
                    <div>
                      <h3 className="text-[10px] sm:text-[11px] font-label font-black tracking-[0.2em] uppercase text-on-surface">
                        {config.label}
                      </h3>
                      <p className="text-[8px] sm:text-[9px] font-label font-bold tracking-[0.15em] uppercase text-outline/50 mt-0.5">
                        {config.sublabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Today filter for todo column */}
                    {status === 'todo' && (
                      <button
                        onClick={() => setShowTodayOnly(!showTodayOnly)}
                        className={cn(
                          "touch-target flex items-center justify-center rounded-full px-3 py-1.5 text-[9px] font-label font-bold uppercase tracking-[0.1em] transition-all active:scale-95",
                          showTodayOnly 
                            ? "bg-primary text-on-primary" 
                            : "bg-primary/5 text-primary/60 active:bg-primary/10 lg:hover:bg-primary/10"
                        )}
                      >
                        {showTodayOnly ? "Today" : "All"}
                      </button>
                    )}
                    <span className={cn("flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-headline font-bold", config.badgeBg, config.iconColor)}>
                      {columnTasks.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column Content */}
              <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto p-3 sm:space-y-3 sm:p-4">
                <AnimatePresence>
                  {columnTasks.map((task) => {
                    const nextStatus = getNextStatus(status);
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                        onClick={() => {
                          setSelectedTaskId(task.id, task.startDate ?? null);
                        }}
                        className={cn(
                          "group p-4 bg-white rounded-xl border border-outline-variant/10 cursor-pointer",
                          "active:scale-[0.98] lg:hover:border-primary/20 lg:hover:shadow-md",
                          "transition-[border-color,box-shadow,transform] duration-200"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-body font-medium tracking-tight text-on-surface leading-snug",
                              task.isCompleted && "line-through text-outline/60"
                            )}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-outline/50 mt-1.5 line-clamp-2 leading-relaxed">{task.description.replace(/<[^>]*>/g, '')}</p>
                            )}
                          </div>
                          {task.priority && task.priority > 0 && (
                            <span className={cn(
                              "shrink-0 mt-0.5 w-2 h-2 rounded-full",
                              task.priority === 3 ? "bg-red-500" : task.priority === 2 ? "bg-amber-500" : "bg-blue-400"
                            )} />
                          )}
                        </div>
                        {/* Quick action: move to next status */}
                        {nextStatus && (
                          <div className="flex items-center justify-end mt-3 pt-2 border-t border-outline-variant/10">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMoveTask(task, nextStatus); }}
                              className={cn(
                                "touch-target flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-label font-bold uppercase tracking-[0.1em] transition-all",
                                "text-primary/50 active:scale-95 active:bg-primary/5 active:text-primary lg:hover:bg-primary/5 lg:hover:text-primary"
                              )}
                            >
                              {statusConfig[nextStatus].label}
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {columnTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                    <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-4", config.badgeBg)}>
                      <IconComponent className={cn("w-5 h-5 sm:w-6 sm:h-6", config.iconColor)} />
                    </div>
                    <p className="text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/40">
                      {status === 'todo' && showTodayOnly ? 'Nothing for today' : 'Empty'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
