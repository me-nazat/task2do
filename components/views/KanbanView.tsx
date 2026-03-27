'use client';

import { useStore, Task } from '@/store/useStore';
import { updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { MoreHorizontal, Plus, Circle, CheckCircle2 } from 'lucide-react';

const COLUMNS: { id: 'todo' | 'in-progress' | 'done', title: string }[] = [
  { id: 'todo', title: 'TO DO' },
  { id: 'in-progress', title: 'IN PROGRESS' },
  { id: 'done', title: 'DONE' },
];

export function KanbanView() {
  const { tasks, updateTask: updateTaskState, setSelectedTaskId } = useStore();

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    const isCompleted = newStatus === 'done';
    updateTaskState(taskId, { status: newStatus, isCompleted });
    try {
      await updateTask(taskId, { status: newStatus, isCompleted });
    } catch (error) {
      console.error('Failed to update task status', error);
    }
  };

  return (
    <div className="flex h-full gap-8 overflow-x-auto pb-8">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter(t => (t.status || 'todo') === column.id && !t.parentId);
        
        return (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-6">
            <div className="flex items-center justify-between px-2 border-b-2 border-outline-variant pb-2">
              <div className="flex items-center gap-3">
                <h3 className="font-headline font-black text-xl uppercase tracking-tighter text-on-surface">
                  {column.title}
                </h3>
                <span className="bg-surface-container-high px-2 py-1 text-[10px] font-headline font-bold tracking-widest text-on-surface-variant">
                  {columnTasks.length}
                </span>
              </div>
              <button className="p-2 hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-4 p-4 bg-surface-container-lowest border-l-4 border-tertiary-container min-h-[200px] shadow-sm">
              {columnTasks.map((task) => (
                <motion.div
                  layout
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "group p-5 bg-surface border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer",
                    task.isCompleted ? "border-primary bg-surface-container-low/50" : "border-transparent hover:border-outline-variant"
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextStatus = task.isCompleted ? 'todo' : 'done';
                          handleStatusChange(task.id, nextStatus as any);
                        }}
                        className={cn(
                          "mt-0.5 w-5 h-5 border-2 flex items-center justify-center transition-colors shrink-0",
                          task.isCompleted ? "bg-primary border-primary text-on-primary-fixed" : "border-outline hover:border-primary"
                        )}
                      >
                        {task.isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                      <span className={cn(
                        "text-sm font-medium leading-tight",
                        task.isCompleted ? "line-through text-outline" : "text-on-surface"
                      )}>
                        {task.title}
                      </span>
                    </div>
                    
                    {task.priority && task.priority > 0 && (
                      <div className="flex items-center gap-2 pl-9">
                        <span className={cn(
                          "text-[9px] px-2 py-1 font-headline font-bold uppercase tracking-widest",
                          task.priority === 3 ? "bg-error-container text-error" :
                          task.priority === 2 ? "bg-warning-container text-warning" :
                          "bg-info-container text-info"
                        )}>
                          {task.priority === 3 ? 'HIGH' : task.priority === 2 ? 'MEDIUM' : 'LOW'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 pl-9">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 bg-primary text-on-primary-fixed flex items-center justify-center text-[10px] font-headline font-bold uppercase">
                          {task.title[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <select
                          value={task.status || 'todo'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                          className="text-[9px] font-headline font-bold tracking-widest uppercase bg-surface-container-high border-none px-2 py-1 focus:ring-0 text-on-surface-variant cursor-pointer"
                        >
                          {COLUMNS.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              <button className="flex items-center gap-3 p-4 text-xs font-headline font-bold tracking-widest uppercase text-outline hover:text-primary hover:bg-surface-container-high transition-all border-2 border-dashed border-outline-variant mt-auto">
                <Plus className="w-4 h-4" />
                ADD TASK
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
