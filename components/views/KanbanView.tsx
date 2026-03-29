'use client';

import { useStore, Task } from '@/store/useStore';
import { updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { MoreHorizontal, Plus, Circle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { isSameDay, isThisWeek } from 'date-fns';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';

const COLUMNS: { id: 'todo' | 'in-progress' | 'done', title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

export function KanbanView() {
  const { tasks, updateTask: updateTaskState, setSelectedTaskId } = useStore();
  const [filterType, setFilterType] = useState<'today' | 'week' | 'all'>('all');

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    const isCompleted = newStatus === 'done';
    updateTaskState(taskId, { status: newStatus, isCompleted });
    try {
      unwrapDatabaseResult(await updateTask(taskId, { status: newStatus, isCompleted }));
    } catch (error) {
      console.error('Failed to update task status', error);
      alert(getClientErrorMessage(error, 'Unable to update the task status right now.'));
    }
  };

  return (
    <div className="flex h-full gap-10 overflow-x-auto pb-12 hide-scrollbar">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter(t => 
          (t.status || 'todo') === column.id && 
          !t.parentId &&
          (column.id === 'todo' && filterType === 'today' ? (t.startDate && isSameDay(new Date(t.startDate), new Date())) :
           column.id === 'todo' && filterType === 'week' ? (t.startDate && isThisWeek(new Date(t.startDate))) : true)
        );
        
        return (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-8">
            <div className="flex items-center justify-between px-4 pb-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-4">
                <h3 className="font-headline font-medium text-2xl tracking-tight text-primary italic">
                  {column.title}
                </h3>
                <span className="bg-primary/5 px-2.5 py-0.5 rounded-full text-[9px] font-label font-bold tracking-[0.15em] text-primary/60">
                  {columnTasks.length}
                </span>
              </div>
              {column.id === 'todo' ? (
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="text-[10px] mx-1 appearance-none outline-none font-label font-bold tracking-[0.1em] uppercase text-white bg-black/80 hover:bg-black px-4 py-1.5 rounded-full cursor-pointer transition-all shadow-sm pr-8"
                  >
                    <option value="today">Today's Tasks</option>
                    <option value="week">Weekly Tasks</option>
                    <option value="all">All Tasks</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-center text-white/70">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              ) : (
                <button className="p-2 hover:bg-primary/5 rounded-full transition-colors text-outline/60">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-5 p-4 bg-white/30 backdrop-blur-sm rounded-2xl border border-outline-variant/10 min-h-[400px] shadow-sm">
              {columnTasks.map((task) => (
                <motion.div
                  layout
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "group p-5 bg-white rounded-xl shadow-sm border border-outline-variant/5 hover:shadow-md transition-all cursor-pointer",
                    task.isCompleted && "opacity-60 grayscale-[0.5]"
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <span className={cn(
                        "text-[14px] font-body font-medium leading-relaxed",
                        task.isCompleted ? "line-through text-outline" : "text-primary"
                      )}>
                        {task.title}
                      </span>
                    </div>
                    
                    {task.priority && task.priority > 0 && (
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[8px] px-2.5 py-1 rounded-full font-label font-bold uppercase tracking-[0.2em]",
                          task.priority === 3 ? "bg-error/10 text-error" :
                          task.priority === 2 ? "bg-warning/10 text-warning" :
                          "bg-info/10 text-info"
                        )}>
                          {task.priority === 3 ? 'High' : task.priority === 2 ? 'Medium' : 'Low'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end mt-2">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(task.status || 'todo') === 'todo' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'in-progress'); }}
                              className="text-[9px] font-label font-bold tracking-[0.1em] uppercase bg-primary/10 hover:bg-primary/20 transition-colors rounded-lg px-4 py-2 text-primary"
                            >
                              Start Progress
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'done'); }}
                              className="text-[9px] font-label font-bold tracking-[0.1em] uppercase bg-primary/10 hover:bg-primary/20 transition-colors rounded-lg px-4 py-2 text-primary"
                            >
                              Done
                            </button>
                          </div>
                        )}
                        {(task.status || 'todo') === 'in-progress' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'todo'); }}
                              className="text-[9px] font-label font-bold tracking-[0.1em] uppercase bg-outline-variant/10 hover:bg-outline-variant/20 transition-colors rounded-lg px-4 py-2 text-outline/60"
                            >
                              Reset
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'done'); }}
                              className="text-[9px] font-label font-bold tracking-[0.1em] uppercase bg-primary/10 hover:bg-primary/20 transition-colors rounded-lg px-4 py-2 text-primary"
                            >
                              Done
                            </button>
                          </div>
                        )}
                        {(task.status || 'todo') === 'done' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'in-progress'); }}
                            className="text-[9px] font-label font-bold tracking-[0.1em] uppercase bg-outline-variant/10 hover:bg-outline-variant/20 transition-colors rounded-lg px-4 py-2 text-outline/60"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
