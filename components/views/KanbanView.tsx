'use client';

import { useStore, Task } from '@/store/useStore';
import { updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { MoreHorizontal, Plus, Circle, CheckCircle2 } from 'lucide-react';

const COLUMNS: { id: 'todo' | 'in-progress' | 'done', title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
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
    <div className="flex h-full gap-10 overflow-x-auto pb-12 hide-scrollbar">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter(t => (t.status || 'todo') === column.id && !t.parentId);
        
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
              <button className="p-2 hover:bg-primary/5 rounded-full transition-colors text-outline/60">
                <MoreHorizontal className="w-5 h-5" />
              </button>
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
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextStatus = task.isCompleted ? 'todo' : 'done';
                          handleStatusChange(task.id, nextStatus as any);
                        }}
                        className={cn(
                          "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                          task.isCompleted ? "bg-primary border-primary text-on-primary" : "border-outline-variant hover:border-primary"
                        )}
                      >
                        {task.isCompleted && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <span className={cn(
                        "text-[14px] font-body font-medium leading-relaxed",
                        task.isCompleted ? "line-through text-outline" : "text-primary"
                      )}>
                        {task.title}
                      </span>
                    </div>
                    
                    {task.priority && task.priority > 0 && (
                      <div className="flex items-center gap-2 pl-9">
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

                    <div className="flex items-center justify-between mt-2 pl-9">
                      <div className="flex -space-x-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[9px] font-label font-bold uppercase">
                          {task.title[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <select
                          value={task.status || 'todo'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                          className="text-[8px] font-label font-bold tracking-[0.15em] uppercase bg-primary/5 border-none rounded-lg px-2.5 py-1.5 focus:ring-0 text-primary/60 cursor-pointer"
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
