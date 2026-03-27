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
    <div className="flex flex-col h-full bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-10 py-8 border-b border-outline-variant/10 bg-white/50 backdrop-blur-md">
        <div className="flex items-center gap-8">
          <h2 className="text-4xl font-headline font-medium tracking-tight text-primary italic">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1 bg-primary/5 rounded-full p-1 border border-primary/10">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-primary/10 rounded-full transition-colors text-primary/60 hover:text-primary"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentMonth(new Date())}
              className="px-5 py-2 text-[9px] font-label font-bold tracking-[0.2em] uppercase hover:bg-primary/10 rounded-full transition-colors text-primary/80"
            >
              Today
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-primary/10 rounded-full transition-colors text-primary/60 hover:text-primary"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 border-b border-outline-variant/10 bg-white">
        {weekDays.map(day => (
          <div key={day} className="py-5 text-center text-[9px] font-label font-bold uppercase tracking-[0.3em] text-outline/40">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto bg-white hide-scrollbar">
        {calendarDays.map((day, idx) => {
          const dayTasks = tasks.filter(t => t.startDate && isSameDay(new Date(t.startDate), day));
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isCurrentDay = isToday(day);

          return (
            <div 
              key={day.toString()}
              className={cn(
                "min-h-[160px] p-4 border-r border-b border-outline-variant/10 flex flex-col gap-3 transition-all hover:bg-primary/[0.02]",
                !isCurrentMonth && "bg-primary/[0.01] opacity-30",
                idx % 7 === 6 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-[13px] font-body font-bold w-9 h-9 flex items-center justify-center rounded-full transition-all",
                  isCurrentDay ? "bg-primary text-on-primary shadow-md" : "text-primary/60"
                )}>
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[8px] font-label font-bold tracking-[0.15em] uppercase text-outline/40">
                    {dayTasks.length} {dayTasks.length === 1 ? 'Objective' : 'Objectives'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-[140px] hide-scrollbar">
                {dayTasks.map(task => (
                  <motion.div
                    layoutId={task.id}
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      "text-[11px] px-3.5 py-2.5 rounded-lg border truncate cursor-pointer transition-all hover:shadow-sm font-body font-medium leading-tight",
                      task.isCompleted 
                        ? "bg-primary/5 text-outline/60 line-through border-transparent" 
                        : "bg-primary/5 text-primary border-primary/10 hover:border-primary/30"
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
