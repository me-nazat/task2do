'use client';

import { useState, useEffect, useRef } from 'react';
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
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Calendar as CalendarIcon, Tag, ChevronDown, Flag, LayoutDashboard, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createTask, updateTask } from '@/actions/task';

export function CalendarView() {
  const { tasks, setSelectedTaskId, user, addTask, updateTask: updateTaskState, deleteTask } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Expandable details state
  const [showDetails, setShowDetails] = useState(false);
  const [calendarPriority, setCalendarPriority] = useState<number>(0);
  const [calendarQuadrant, setCalendarQuadrant] = useState<string | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [calendarDescription, setCalendarDescription] = useState('');

  const resetDetails = () => {
    setShowDetails(false);
    setCalendarPriority(0);
    setCalendarQuadrant(null);
    setCalendarStatus('todo');
    setCalendarDescription('');
  };

  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTaskTitle.trim() && user && selectedDate) {
      const title = newTaskTitle.trim();
      setNewTaskTitle('');
      
      const tempId = `temp-${Date.now()}`;
      const newTask: Task = {
        id: tempId,
        title,
        isCompleted: calendarStatus === 'done',
        priority: showDetails ? calendarPriority : 0,
        startDate: selectedDate,
        endDate: null,
        isAllDay: false,
        listId: null,
        description: showDetails ? (calendarDescription || null) : null,
        quadrant: showDetails ? calendarQuadrant : null,
        parentId: null,
        timezone: null,
        reminderAt: null,
        status: showDetails ? calendarStatus : 'todo',
      };
      addTask(newTask);

      try {
        const id = await createTask({
          title,
          startDate: selectedDate,
          userId: user.id,
          priority: showDetails ? calendarPriority : undefined,
          quadrant: showDetails && calendarQuadrant ? calendarQuadrant : undefined,
          status: showDetails ? calendarStatus : undefined,
        });
        updateTaskState(tempId, { id });
      } catch (error) {
        console.error('Failed to create task', error);
        deleteTask(tempId);
      }

      if (showDetails) {
        resetDetails();
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
              onClick={() => { setSelectedDate(day); resetDetails(); setNewTaskTitle(''); }}
              className={cn(
                "min-h-[160px] p-4 border-r border-b border-outline-variant/10 flex flex-col gap-3 transition-all hover:bg-primary/[0.02] cursor-pointer",
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

      <AnimatePresence>
        {selectedDate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-[8px]"
            onClick={() => { setSelectedDate(null); resetDetails(); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-2xl border border-outline-variant/20 flex flex-col max-h-[85vh]"
            >
              {/* Date Header & Quick Add */}
              <div className="p-8 border-b border-outline-variant/10 bg-surface/50">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="font-headline font-medium text-4xl tracking-tight text-primary">
                      {format(selectedDate, 'd')} {format(selectedDate, 'MMM')}
                    </h2>
                    <p className="font-label text-[9px] uppercase tracking-[0.25em] text-outline mt-2 font-bold opacity-60">
                      {format(selectedDate, 'EEEE')}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setSelectedDate(null); resetDetails(); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-outline cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                {/* Customized Quick Add Bar for selected date */}
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-outline-variant/10 shadow-sm focus-within:shadow-md focus-within:border-primary/20 transition-all duration-500">
                  <div className="ml-4 w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary/60" />
                  </div>
                  <input 
                    ref={inputRef}
                    autoFocus
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={handleAddTask}
                    placeholder={`Capture a new objective for ${format(selectedDate, 'MMM d')}...`}
                    className="flex-1 bg-transparent border-none focus:ring-0 py-4 font-body text-lg tracking-tight placeholder:text-outline/40 outline-none"
                  />
                  <div className="flex gap-4 px-6 border-l border-outline-variant/20">
                    <CalendarIcon className="w-5 h-5 text-primary cursor-pointer transition-colors" />
                    <Tag className="w-5 h-5 text-outline/40 cursor-pointer hover:text-primary transition-colors" />
                  </div>
                </div>

                {/* Add Details Toggle */}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-2 mt-4 px-4 py-2 text-[10px] font-label font-bold tracking-[0.15em] uppercase text-primary/60 hover:text-primary hover:bg-primary/5 rounded-full transition-all duration-200"
                >
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", showDetails && "rotate-180")} />
                  {showDetails ? 'Hide Details' : 'Add Details'}
                </button>
              </div>

              {/* Expandable Details Section */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="overflow-hidden border-b border-outline-variant/10"
                  >
                    <div className="p-8 space-y-6 bg-surface-container-lowest/30">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-label font-bold tracking-[0.25em] uppercase text-outline/50">Task Details</span>
                        <div className="flex-1 h-px bg-outline-variant/20" />
                      </div>

                      {/* Priority */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                          <Flag className="w-3.5 h-3.5" /> Priority
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          {[
                            { value: 0, label: 'None', color: 'text-outline/40' },
                            { value: 1, label: 'Low', color: 'text-blue-500' },
                            { value: 2, label: 'Medium', color: 'text-amber-500' },
                            { value: 3, label: 'High', color: 'text-red-500' },
                          ].map((p) => (
                            <button
                              key={p.value}
                              onClick={() => setCalendarPriority(p.value)}
                              className={cn(
                                "p-2.5 rounded-full transition-all duration-200 hover:bg-surface-container-low active:scale-90",
                                calendarPriority === p.value ? "bg-surface-container-high shadow-sm scale-110" : ""
                              )}
                              title={p.label}
                            >
                              <Flag className={cn("w-4 h-4", p.color, calendarPriority === p.value ? "fill-current" : "")} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Status
                        </div>
                        <div className="flex-1">
                          <select
                            value={calendarStatus}
                            onChange={(e) => setCalendarStatus(e.target.value as any)}
                            className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 rounded-lg border-none transition-all duration-200 text-[10px] font-label font-bold tracking-[0.15em] uppercase focus:outline-none focus:ring-1 focus:ring-primary/20"
                          >
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>

                      {/* Quadrant */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                          <LayoutDashboard className="w-3.5 h-3.5" /> Quadrant
                        </div>
                        <div className="flex-1">
                          <select
                            value={calendarQuadrant || 'none'}
                            onChange={(e) => setCalendarQuadrant(e.target.value === 'none' ? null : e.target.value)}
                            className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 rounded-lg border-none transition-all duration-200 text-[10px] font-label font-bold tracking-[0.15em] uppercase focus:outline-none focus:ring-1 focus:ring-primary/20"
                          >
                            <option value="none">None</option>
                            <option value="urgent-important">Urgent & Important</option>
                            <option value="not-urgent-important">Not Urgent & Important</option>
                            <option value="urgent-not-important">Urgent & Not Important</option>
                            <option value="not-urgent-not-important">Not Urgent & Not Important</option>
                          </select>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                          <Tag className="w-3.5 h-3.5" /> Tags
                        </div>
                        <div className="flex-1 px-4 py-2.5 hover:bg-surface-container-low rounded-lg cursor-pointer transition-all duration-200 text-outline/50 font-label font-bold text-[9px] tracking-[0.15em] uppercase">
                          Add identifiers...
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="flex items-start gap-6 text-sm">
                        <div className="w-28 text-outline/70 flex items-center gap-2.5 pt-2 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                          <AlignLeft className="w-3.5 h-3.5" /> Notes
                        </div>
                        <div className="flex-1">
                          <textarea
                            value={calendarDescription}
                            onChange={(e) => setCalendarDescription(e.target.value)}
                            placeholder="Add context, details, or notes..."
                            rows={3}
                            className="w-full bg-surface-container-low/50 hover:bg-surface-container-high/50 border border-outline-variant/10 focus:border-primary/20 rounded-xl px-5 py-4 font-body text-[14px] leading-relaxed placeholder:text-outline/30 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-primary/10 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tasks for the date */}
              <div className="p-8 overflow-y-auto space-y-3 bg-surface-container-lowest/30">
                {(() => {
                  const dayTasks = tasks.filter(t => t.startDate && isSameDay(new Date(t.startDate), selectedDate));
                  
                  if (dayTasks.length === 0) {
                    return (
                      <div className="text-center py-16 text-outline flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-outline/40" />
                        </div>
                        <div>
                          <p className="text-xl font-headline italic text-primary">Clear Schedule</p>
                          <p className="text-[9px] font-label uppercase tracking-[0.25em] mt-2 font-bold opacity-60">No objectives logged for this exact date</p>
                        </div>
                      </div>
                    );
                  }

                  return dayTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(task.id);
                        setSelectedDate(null); // Optional: close modal when opening task details
                      }}
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
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
