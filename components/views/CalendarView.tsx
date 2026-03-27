'use client';

import { useState } from 'react';
import { useStore, Task } from '@/store/useStore';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  startOfDay,
  endOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function CalendarView() {
  const { tasks, setSelectedTaskId } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full bg-surface-container-lowest border-2 border-transparent shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b-2 border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-black font-headline tracking-tighter uppercase text-on-surface">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2 bg-surface-container-high rounded-none p-1 border-2 border-outline-variant">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentMonth(new Date())}
              className="px-4 py-2 text-xs font-headline font-bold tracking-widest uppercase hover:bg-surface-container-highest transition-colors text-on-surface"
            >
              TODAY
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-on-surface"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <button className="flex items-center gap-3 px-6 py-3 bg-primary text-on-primary-fixed text-xs font-headline font-bold tracking-widest uppercase hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          NEW EVENT
        </button>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 border-b-2 border-outline-variant bg-surface-container-lowest">
        {weekDays.map(day => (
          <div key={day} className="py-4 text-center text-[10px] font-headline font-bold uppercase tracking-[0.2em] text-outline">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto bg-surface-container-lowest">
        {calendarDays.map((day, idx) => {
          const dayTasks = tasks.filter(t => t.startDate && isSameDay(new Date(t.startDate), day));
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isCurrentDay = isToday(day);

          return (
            <div 
              key={day.toString()}
              className={cn(
                "min-h-[140px] p-3 border-r-2 border-b-2 border-outline-variant flex flex-col gap-2 transition-colors hover:bg-surface-container-low",
                !isCurrentMonth && "bg-surface-container-low opacity-50",
                idx % 7 === 6 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-sm font-headline font-bold w-8 h-8 flex items-center justify-center transition-all",
                  isCurrentDay ? "bg-primary text-on-primary-fixed shadow-sm" : "text-on-surface-variant"
                )}>
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] font-headline font-bold tracking-widest uppercase text-outline">
                    {dayTasks.length} {dayTasks.length === 1 ? 'TASK' : 'TASKS'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[120px] hide-scrollbar">
                {dayTasks.map(task => (
                  <motion.div
                    layoutId={task.id}
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      "text-xs px-3 py-2 border-2 truncate cursor-pointer transition-all hover:shadow-sm font-headline font-bold tracking-wide",
                      task.isCompleted 
                        ? "bg-surface-container-high text-outline line-through border-transparent" 
                        : "bg-primary/10 text-primary border-primary/30 hover:border-primary"
                    )}
                  >
                    {task.title}
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
