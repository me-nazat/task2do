'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, Task } from '@/store/useStore';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  addMonths, 
  subMonths,
  addDays,
  differenceInCalendarDays,
  isToday,
  startOfDay,
  endOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Calendar as CalendarIcon, Tag, ChevronDown, Flag, LayoutDashboard, AlignLeft, Repeat, Search, Download, CalendarRange, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createTask, updateTask } from '@/actions/task';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';
import { buildTaskCompletionUpdate, getTaskOccurrences } from '@/lib/recurrence';

type CalendarDayItem = {
  task: Task;
  occurrenceDate: Date;
  occurrenceKey: string;
  isCompleted: boolean;
};

type CalendarRangeMode = 'month' | 'custom';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateInputValue = (value: Date) => format(value, 'yyyy-MM-dd');

const parseDateInput = (value: string, endOfSelectedDay = false) => {
  if (!value) {
    return null;
  }

  const nextDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(nextDate.getTime())) {
    return null;
  }

  return endOfSelectedDay ? endOfDay(nextDate) : startOfDay(nextDate);
};

const formatScheduleTitle = (start: Date, end: Date) => {
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return format(start, 'MMMM d, yyyy');
  }

  if (format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
    return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
  }

  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
};

export function CalendarView() {
  const { tasks, setSelectedTaskId, user, addTask, updateTask: updateTaskState, deleteTask } = useStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarRangeMode, setCalendarRangeMode] = useState<CalendarRangeMode>('month');
  const [customRangeStart, setCustomRangeStart] = useState(() => startOfDay(new Date()));
  const [customRangeEnd, setCustomRangeEnd] = useState(() => endOfDay(addDays(new Date(), 13)));
  const [isCustomScheduleOpen, setIsCustomScheduleOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const calendarCaptureRef = useRef<HTMLDivElement>(null);
  const customSchedulePanelRef = useRef<HTMLDivElement>(null);
  const customScheduleButtonRef = useRef<HTMLButtonElement>(null);

  // Expandable details state
  const [showDetails, setShowDetails] = useState(false);
  const [calendarPriority, setCalendarPriority] = useState<number>(0);
  const [calendarQuadrant, setCalendarQuadrant] = useState<string | null>(null);
  const [calendarRecurrence, setCalendarRecurrence] = useState<string>('none');
  const [calendarRecurrenceDays, setCalendarRecurrenceDays] = useState<number[]>([]);
  const [calendarCustomTimes, setCalendarCustomTimes] = useState<Record<number, string>>({});
  const [showCustomTimes, setShowCustomTimes] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [calendarDescription, setCalendarDescription] = useState('');

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isCustomScheduleOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        customSchedulePanelRef.current?.contains(target) ||
        customScheduleButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsCustomScheduleOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCustomScheduleOpen]);

  const resetDetails = () => {
    setShowDetails(false);
    setCalendarPriority(0);
    setCalendarQuadrant(null);
    setCalendarRecurrence('none');
    setCalendarRecurrenceDays([]);
    setCalendarCustomTimes({});
    setShowCustomTimes(false);
    setCalendarStatus('todo');
    setCalendarDescription('');
  };

  const handleAddTask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTaskTitle.trim() && user && selectedDate) {
      const title = newTaskTitle.trim();
      setNewTaskTitle('');
      
      const recurrenceValue = showDetails ? (
        calendarRecurrence === 'weekly' && calendarRecurrenceDays.length > 0 
          ? `weekly:${calendarRecurrenceDays.join(',')}` 
          : calendarRecurrence === 'custom'
            ? `custom:${JSON.stringify({ days: calendarRecurrenceDays, times: showCustomTimes ? calendarCustomTimes : {} })}`
            : calendarRecurrence === 'none' ? null : calendarRecurrence
      ) : null;

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
        recurrence: recurrenceValue,
        completedOccurrences: null,
        deletedOccurrences: null,
      };
      addTask(newTask);

      try {
        const id = unwrapDatabaseResult(await createTask({
          title,
          startDate: selectedDate,
          userId: user.id,
          priority: showDetails ? calendarPriority : 0,
          status: showDetails ? calendarStatus : undefined,
          quadrant: showDetails ? calendarQuadrant || undefined : undefined,
          recurrence: recurrenceValue || undefined,
        }));
        updateTaskState(tempId, { id });
      } catch (error) {
        console.error('Failed to create task', error);
        deleteTask(tempId);
        alert(getClientErrorMessage(error, 'Unable to create task right now.'));
      }

      if (showDetails) {
        resetDetails();
      }
    }
  };

  const normalizedScheduleSearch = scheduleSearchQuery.trim().toLowerCase();

  const getDayTaskItems = useCallback((day: Date) => (
    tasks
      .flatMap((task) => (
        getTaskOccurrences(task, startOfDay(day), endOfDay(day), {
          includeCompleted: true,
          includeDeleted: false,
        }).map((occurrence) => ({
          task,
          occurrenceDate: occurrence.date,
          occurrenceKey: occurrence.occurrenceKey,
          isCompleted: occurrence.isCompleted,
        }))
      ))
      .sort((a, b) => {
        const timeDifference = a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
        return timeDifference !== 0
          ? timeDifference
          : a.task.title.localeCompare(b.task.title);
      })
  ), [tasks]);

  const doesTaskMatchScheduleSearch = useCallback((item: CalendarDayItem) => {
    if (!normalizedScheduleSearch) {
      return true;
    }

    const searchableContent = [
      item.task.title,
      item.task.description ?? '',
      format(item.occurrenceDate, 'MMMM d EEEE'),
    ]
      .join(' ')
      .toLowerCase();

    return searchableContent.includes(normalizedScheduleSearch);
  }, [normalizedScheduleSearch]);

  const doesDayMatchScheduleSearch = useCallback((day: Date, dayItems: CalendarDayItem[]) => {
    if (!normalizedScheduleSearch) {
      return true;
    }

    return (
      format(day, 'MMMM d EEEE').toLowerCase().includes(normalizedScheduleSearch) ||
      dayItems.some(doesTaskMatchScheduleSearch)
    );
  }, [doesTaskMatchScheduleSearch, normalizedScheduleSearch]);

  const handleToggleComplete = async (item: CalendarDayItem) => {
    const previousState = {
      isCompleted: item.task.isCompleted,
      status: item.task.status,
      completedOccurrences: item.task.completedOccurrences,
      deletedOccurrences: item.task.deletedOccurrences,
      updatedAt: item.task.updatedAt,
    };
    const updates = {
      ...buildTaskCompletionUpdate(item.task, !item.isCompleted, item.occurrenceDate),
      updatedAt: new Date(),
    };

    updateTaskState(item.task.id, updates);
    try {
      unwrapDatabaseResult(await updateTask(item.task.id, updates));
    } catch (error) {
      console.error('Failed to update task', error);
      updateTaskState(item.task.id, previousState);
      alert(getClientErrorMessage(error, 'Unable to update the task right now.'));
    }
  };

  const normalizedCustomRange = useMemo(() => {
    const safeStart = startOfDay(customRangeStart);
    const safeEnd = endOfDay(customRangeEnd);

    if (safeStart.getTime() <= safeEnd.getTime()) {
      return { start: safeStart, end: safeEnd };
    }

    return {
      start: startOfDay(customRangeEnd),
      end: endOfDay(customRangeStart),
    };
  }, [customRangeEnd, customRangeStart]);

  const activeRangeStart = calendarRangeMode === 'month'
    ? startOfMonth(currentMonth)
    : normalizedCustomRange.start;
  const activeRangeEnd = calendarRangeMode === 'month'
    ? endOfMonth(activeRangeStart)
    : normalizedCustomRange.end;
  const rangeStart = startOfWeek(activeRangeStart);
  const rangeEnd = endOfWeek(activeRangeEnd);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: rangeStart,
    end: rangeEnd,
  }), [rangeEnd, rangeStart]);

  const customRangeLength = Math.max(
    differenceInCalendarDays(normalizedCustomRange.end, normalizedCustomRange.start) + 1,
    1
  );

  const scheduleTitle = calendarRangeMode === 'month'
    ? format(currentMonth, 'MMMM yyyy')
    : formatScheduleTitle(normalizedCustomRange.start, normalizedCustomRange.end);

  const shiftVisibleRange = (direction: 'previous' | 'next') => {
    const step = direction === 'next' ? 1 : -1;

    if (calendarRangeMode === 'month') {
      setCurrentMonth((current) => (
        direction === 'next' ? addMonths(current, 1) : subMonths(current, 1)
      ));
      return;
    }

    setCustomRangeStart((current) => startOfDay(addDays(current, customRangeLength * step)));
    setCustomRangeEnd((current) => endOfDay(addDays(current, customRangeLength * step)));
  };

  const resetVisibleRange = () => {
    if (calendarRangeMode === 'month') {
      setCurrentMonth(new Date());
      return;
    }

    const today = new Date();
    setCustomRangeStart(startOfDay(today));
    setCustomRangeEnd(endOfDay(addDays(today, customRangeLength - 1)));
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!calendarCaptureRef.current) {
      return;
    }

    setIsExportingPdf(true);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(calendarCaptureRef.current, {
        backgroundColor: '#ffffff',
        scale: Math.max(window.devicePixelRatio, 2),
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
        compress: true,
      });

      pdf.addImage(
        canvas.toDataURL('image/png', 1),
        'PNG',
        0,
        0,
        canvas.width,
        canvas.height,
        undefined,
        'FAST'
      );

      const filename = calendarRangeMode === 'month'
        ? `task2do-schedule-${format(currentMonth, 'yyyy-MM')}.pdf`
        : `task2do-schedule-${format(normalizedCustomRange.start, 'yyyy-MM-dd')}-to-${format(normalizedCustomRange.end, 'yyyy-MM-dd')}.pdf`;

      pdf.save(filename);
    } catch (error) {
      console.error('Failed to export schedule as PDF', error);
      alert('Unable to download the schedule PDF right now.');
    } finally {
      setIsExportingPdf(false);
    }
  }, [calendarRangeMode, currentMonth, normalizedCustomRange.end, normalizedCustomRange.start]);

  const selectedDayTasks = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const items = getDayTaskItems(selectedDate);
    if (!normalizedScheduleSearch) {
      return items;
    }

    const matchedItems = items.filter(doesTaskMatchScheduleSearch);
    if (matchedItems.length > 0) {
      return matchedItems;
    }

    return format(selectedDate, 'MMMM d EEEE').toLowerCase().includes(normalizedScheduleSearch)
      ? items
      : [];
  }, [doesTaskMatchScheduleSearch, getDayTaskItems, normalizedScheduleSearch, selectedDate]);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="relative border-b border-outline-variant/10 bg-white/60 backdrop-blur-md">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-medium tracking-tight text-primary italic">
                {scheduleTitle}
              </h2>
              <div className="flex items-center gap-1 rounded-full border border-primary/10 bg-primary/5 p-1">
                <button
                  onClick={() => shiftVisibleRange('previous')}
                  className="touch-target flex items-center justify-center rounded-full p-2 text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={resetVisibleRange}
                  className="touch-target rounded-full px-3 py-2 text-[9px] font-label font-bold uppercase tracking-[0.2em] text-primary/80 transition-colors hover:bg-primary/10 sm:px-5"
                >
                  Today
                </button>
                <button
                  onClick={() => shiftVisibleRange('next')}
                  className="touch-target flex items-center justify-center rounded-full p-2 text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
              <button
                ref={customScheduleButtonRef}
                onClick={() => setIsCustomScheduleOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3.5 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-primary/80 shadow-sm transition-all duration-200 hover:border-primary/20 hover:bg-primary/10"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Create Custom Schedule
              </button>

              <div className="flex items-center rounded-full border border-primary/10 bg-white shadow-sm">
                <button
                  onClick={() => {
                    if (isSearchOpen && !scheduleSearchQuery) {
                      setIsSearchOpen(false);
                      return;
                    }

                    setIsSearchOpen(true);
                  }}
                  className="touch-target flex items-center justify-center rounded-full p-2.5 text-primary/60 transition-colors hover:bg-primary/5 hover:text-primary"
                >
                  <Search className="h-4 w-4" />
                </button>

                <AnimatePresence initial={false}>
                  {isSearchOpen && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 208, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 pr-2">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={scheduleSearchQuery}
                          onChange={(event) => setScheduleSearchQuery(event.target.value)}
                          placeholder="Search tasks or days"
                          className="w-full bg-transparent py-2 text-sm font-body text-primary outline-none placeholder:text-outline/35"
                        />
                        {(scheduleSearchQuery || isSearchOpen) && (
                          <button
                            onClick={() => {
                              if (scheduleSearchQuery) {
                                setScheduleSearchQuery('');
                                searchInputRef.current?.focus();
                                return;
                              }

                              setIsSearchOpen(false);
                            }}
                            className="rounded-full p-1 text-outline/45 transition-colors hover:bg-primary/5 hover:text-primary"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-primary/80 shadow-sm transition-all duration-200 hover:border-primary/20 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {isExportingPdf ? 'Preparing PDF' : 'Download'}
              </button>
            </div>
          </div>

          {calendarRangeMode === 'custom' && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/[0.03] px-4 py-2.5">
              <div>
                <p className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">Custom Range Active</p>
                <p className="mt-1 text-sm font-body font-medium text-primary">{formatScheduleTitle(normalizedCustomRange.start, normalizedCustomRange.end)}</p>
              </div>
              <button
                onClick={() => setCalendarRangeMode('month')}
                className="rounded-full border border-primary/10 bg-white px-3 py-2 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-primary/70 transition-all hover:border-primary/20 hover:bg-primary/5"
              >
                Use Month View
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isCustomScheduleOpen && (
            <motion.div
              ref={customSchedulePanelRef}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="absolute left-4 right-4 top-full z-30 mt-3 sm:left-auto sm:right-6 sm:w-[26rem] lg:right-10"
            >
              <div className="rounded-3xl border border-outline-variant/20 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">Schedule View</p>
                    <h3 className="mt-1 text-lg font-headline font-medium italic text-primary">Custom Schedule Builder</h3>
                  </div>
                  <button
                    onClick={() => setIsCustomScheduleOpen(false)}
                    className="rounded-full p-2 text-outline/50 transition-colors hover:bg-primary/5 hover:text-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-full border border-primary/10 bg-primary/5 p-1">
                  <button
                    onClick={() => setCalendarRangeMode('month')}
                    className={cn(
                      "rounded-full px-3 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all duration-200",
                      calendarRangeMode === 'month'
                        ? "bg-white text-primary shadow-sm"
                        : "text-outline/60 hover:text-primary"
                    )}
                  >
                    Standard Month
                  </button>
                  <button
                    onClick={() => setCalendarRangeMode('custom')}
                    className={cn(
                      "rounded-full px-3 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all duration-200",
                      calendarRangeMode === 'custom'
                        ? "bg-white text-primary shadow-sm"
                        : "text-outline/60 hover:text-primary"
                    )}
                  >
                    Custom Range
                  </button>
                </div>

                {calendarRangeMode === 'month' ? (
                  <div className="mt-4 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest/40 px-4 py-3">
                    <p className="text-[10px] font-body leading-relaxed text-outline/70">
                      Stay in a clean month view, or switch to a non-standard date window for sprint planning, travel blocks, or launch weeks.
                    </p>
                  </div>
                ) : (
                    <div className="mt-4 space-y-3">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">Start Date</span>
                        <input
                          type="date"
                          value={toDateInputValue(normalizedCustomRange.start)}
                          onChange={(event) => {
                            const nextDate = parseDateInput(event.target.value);
                            if (nextDate) {
                              setCustomRangeStart(nextDate);
                            }
                          }}
                          className="w-full rounded-2xl border border-outline-variant/15 bg-white px-4 py-2.5 text-sm font-body text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">End Date</span>
                        <input
                          type="date"
                          value={toDateInputValue(normalizedCustomRange.end)}
                          onChange={(event) => {
                            const nextDate = parseDateInput(event.target.value, true);
                            if (nextDate) {
                              setCustomRangeEnd(nextDate);
                            }
                          }}
                          className="w-full rounded-2xl border border-outline-variant/15 bg-white px-4 py-2.5 text-sm font-body text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: '7 Days', days: 6 },
                        { label: '14 Days', days: 13 },
                        { label: '30 Days', days: 29 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => {
                            const today = new Date();
                            setCalendarRangeMode('custom');
                            setCustomRangeStart(startOfDay(today));
                            setCustomRangeEnd(endOfDay(addDays(today, preset.days)));
                          }}
                          className="rounded-full border border-primary/10 bg-primary/5 px-3 py-2 text-[9px] font-label font-bold uppercase tracking-[0.16em] text-primary/75 transition-all duration-200 hover:border-primary/20 hover:bg-primary/10"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] font-body leading-relaxed text-outline/65">
                      The grid stays padded to full weeks, so the calendar remains easy to scan while only your chosen range gets emphasis.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div ref={calendarCaptureRef} className="flex min-h-full min-w-[44rem] flex-col bg-white md:min-w-0">
          {/* Weekdays Header */}
          <div className="grid grid-cols-7 border-b border-outline-variant/10 bg-white">
            {weekDays.map((day) => (
              <div key={day} className="py-4 text-center text-[9px] font-label font-bold uppercase tracking-[0.3em] text-outline/40 sm:py-5">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="hide-scrollbar grid flex-1 grid-cols-7 auto-rows-fr overflow-y-auto bg-white">
            {calendarDays.map((day, idx) => {
            const dayTasks = getDayTaskItems(day);
            const dayLabelMatches = normalizedScheduleSearch
              ? format(day, 'MMMM d EEEE').toLowerCase().includes(normalizedScheduleSearch)
              : false;
            const matchedDayTasks = normalizedScheduleSearch
              ? dayTasks.filter(doesTaskMatchScheduleSearch)
              : dayTasks;
            const visibleDayTasks = normalizedScheduleSearch
              ? matchedDayTasks.length > 0
                ? matchedDayTasks.slice(0, 3)
                : dayLabelMatches
                  ? dayTasks.slice(0, 3)
                  : []
              : dayTasks.slice(0, 3);
            const matchingCount = normalizedScheduleSearch
              ? matchedDayTasks.length > 0
                ? matchedDayTasks.length
                : dayLabelMatches
                  ? dayTasks.length
                  : 0
              : dayTasks.length;
            const isInPrimaryRange = calendarRangeMode === 'month'
              ? isSameMonth(day, activeRangeStart)
              : day >= startOfDay(normalizedCustomRange.start) && day <= startOfDay(normalizedCustomRange.end);
            const isCurrentDay = isToday(day);
            const isSearchMatch = doesDayMatchScheduleSearch(day, dayTasks);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => { setSelectedDate(day); resetDetails(); setNewTaskTitle(''); }}
                  className={cn(
                    "grid min-h-[5.75rem] cursor-pointer grid-rows-[auto_minmax(0,1fr)] gap-1 border-b border-r border-outline-variant/10 p-2 transition-all hover:bg-primary/[0.02] sm:min-h-[8rem] sm:p-2.5 lg:min-h-[13.5rem] lg:p-3.5 lg:gap-2.5",
                    !isInPrimaryRange && "bg-primary/[0.01] opacity-35",
                    normalizedScheduleSearch && !isSearchMatch && "opacity-45",
                    normalizedScheduleSearch && isSearchMatch && "bg-primary/[0.04] shadow-[inset_0_0_0_1px_rgba(16,24,40,0.06)]",
                    idx % 7 === 6 && "border-r-0"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-body font-bold transition-all sm:h-8 sm:w-8 sm:text-[12px]",
                      isCurrentDay ? "bg-primary text-on-primary shadow-md" : "text-primary/60",
                      normalizedScheduleSearch && isSearchMatch && !isCurrentDay && "bg-primary/10 text-primary"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {matchingCount > 0 && (
                      <span className="hidden text-[7px] font-label font-bold uppercase tracking-[0.15em] text-outline/40 sm:block sm:text-[8px]">
                        {matchingCount}
                      </span>
                    )}
                    {visibleDayTasks.length > 0 && (
                      <div className="flex gap-0.5 sm:hidden">
                        {visibleDayTasks.map((item) => (
                          <div
                            key={`${item.task.id}-${item.occurrenceKey}`}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              normalizedScheduleSearch ? "bg-primary" : "bg-primary/50"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="hidden min-h-0 grid-rows-3 gap-1.5 overflow-hidden sm:grid lg:grid-rows-5">
                    {visibleDayTasks.map((item) => (
                      <motion.div
                        layoutId={`${item.task.id}-${item.occurrenceKey}`}
                        key={`${item.task.id}-${item.occurrenceKey}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedTaskId(item.task.id, item.occurrenceDate);
                        }}
                        className={cn(
                          "flex min-h-0 items-center overflow-hidden rounded-lg border px-2.5 py-1.5 text-[10px] font-body font-medium leading-[1.15] transition-all hover:shadow-sm",
                          item.isCompleted
                            ? "border-transparent bg-primary/5 text-outline/60 line-through"
                            : "border-primary/10 bg-primary/5 text-primary hover:border-primary/30",
                          normalizedScheduleSearch && doesTaskMatchScheduleSearch(item) && "border-primary/25 bg-white shadow-sm"
                        )}
                      >
                        <span className="block truncate">{item.task.title}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/10 backdrop-blur-[8px]"
            onClick={() => { setSelectedDate(null); resetDetails(); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl w-full sm:max-w-2xl border border-outline-variant/20 flex flex-col max-h-[90vh] sm:max-h-[85vh]"
            >
              {/* Date Header & Quick Add */}
              <div className="p-5 sm:p-8 border-b border-outline-variant/10 bg-surface/50">
                {/* Drag handle for mobile */}
                <div className="w-10 h-1 rounded-full bg-outline-variant/40 mx-auto mb-4 sm:hidden" />
                <div className="flex items-end justify-between mb-6 sm:mb-8">
                  <div>
                    <h2 className="font-headline font-medium text-3xl sm:text-4xl tracking-tight text-primary">
                      {format(selectedDate, 'd')} {format(selectedDate, 'MMM')}
                    </h2>
                    <p className="font-label text-[9px] uppercase tracking-[0.25em] text-outline mt-2 font-bold opacity-60">
                      {format(selectedDate, 'EEEE')}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setSelectedDate(null); resetDetails(); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-outline cursor-pointer touch-target"
                  >
                    ×
                  </button>
                </div>

                {/* Customized Quick Add Bar for selected date */}
                <div className="flex items-center gap-3 sm:gap-4 bg-white p-2 rounded-2xl border border-outline-variant/10 shadow-sm focus-within:shadow-md focus-within:border-primary/20 transition-all duration-500">
                  <div className="ml-2 sm:ml-4 w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
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
                  <div className="hidden sm:flex gap-4 px-6 border-l border-outline-variant/20">
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

                      {/* Repeat */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                          <Repeat className="w-3.5 h-3.5" /> Repeat
                        </div>
                        <div className="flex-1 space-y-3 pt-2">
                          <select
                            value={calendarRecurrence}
                            onChange={(e) => {
                              setCalendarRecurrence(e.target.value);
                              if (e.target.value !== 'weekly' && e.target.value !== 'custom') {
                                setCalendarRecurrenceDays([]);
                                setCalendarCustomTimes({});
                                setShowCustomTimes(false);
                              }
                            }}
                            className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 rounded-lg border-none transition-all duration-200 text-[10px] font-label font-bold tracking-[0.15em] uppercase focus:outline-none focus:ring-1 focus:ring-primary/20"
                          >
                            <option value="none">None</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly...</option>
                            <option value="monthly">Monthly</option>
                            <option value="custom">Custom...</option>
                          </select>
                          
                          {(calendarRecurrence === 'weekly' || calendarRecurrence === 'custom') && (
                            <div className="space-y-4 pt-2">
                              <div className="flex gap-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                                  const isSelected = calendarRecurrenceDays.includes(idx);
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        setCalendarRecurrenceDays(prev => {
                                          const newDays = prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx];
                                          // If deselecting a day, also clear its custom time
                                          if (prev.includes(idx)) {
                                            const newTimes = { ...calendarCustomTimes };
                                            delete newTimes[idx];
                                            setCalendarCustomTimes(newTimes);
                                          }
                                          return newDays;
                                        });
                                      }}
                                      className={cn(
                                        "w-7 h-7 rounded-full text-[10px] font-bold transition-all",
                                        isSelected 
                                          ? "bg-primary text-on-primary shadow-sm" 
                                          : "bg-surface-container-low text-outline/60 hover:bg-surface-container-high hover:text-primary"
                                      )}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>

                              {calendarRecurrence === 'custom' && calendarRecurrenceDays.length > 0 && (
                                <div className="space-y-3 pt-2">
                                  <button
                                    onClick={() => setShowCustomTimes(!showCustomTimes)}
                                    className="text-[9px] font-label font-bold tracking-[0.2em] uppercase text-primary/70 hover:text-primary flex items-center gap-2"
                                  >
                                    <Plus className={cn("w-3 h-3 transition-transform", showCustomTimes && "rotate-45")} />
                                    {showCustomTimes ? "Hide custom times" : "Add custom time also"}
                                  </button>

                                  {showCustomTimes && (
                                    <div className="space-y-3 bg-primary/5 p-4 rounded-xl border border-primary/10">
                                      {calendarRecurrenceDays.sort().map(dayIdx => (
                                        <div key={dayIdx} className="flex items-center justify-between gap-4">
                                          <span className="text-[10px] font-label font-bold uppercase tracking-wider text-outline/70 w-16">
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIdx]}
                                          </span>
                                          <input 
                                            type="time" 
                                            value={calendarCustomTimes[dayIdx] || "09:00"}
                                            onChange={(e) => setCalendarCustomTimes(prev => ({ ...prev, [dayIdx]: e.target.value }))}
                                            className="bg-white border border-outline-variant/20 rounded-lg px-2 py-1 text-xs font-body focus:ring-1 focus:ring-primary/20 outline-none"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
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

              <div className="p-5 sm:p-8 overflow-y-auto space-y-3 bg-surface-container-lowest/30 safe-area-bottom">
                {normalizedScheduleSearch && selectedDayTasks.length > 0 && (
                  <div className="rounded-2xl border border-primary/10 bg-white/80 px-4 py-3">
                    <p className="text-[8px] font-label font-bold uppercase tracking-[0.2em] text-outline/50">Search Results</p>
                    <p className="mt-1 text-sm font-body font-medium text-primary">
                      Showing {selectedDayTasks.length} match{selectedDayTasks.length === 1 ? '' : 'es'} for “{scheduleSearchQuery.trim()}”
                    </p>
                  </div>
                )}

                {selectedDayTasks.length === 0 ? (
                  <div className="text-center py-16 text-outline flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-outline/40" />
                    </div>
                    <div>
                      <p className="text-xl font-headline italic text-primary">Clear Schedule</p>
                      <p className="text-[9px] font-label uppercase tracking-[0.25em] mt-2 font-bold opacity-60">
                        {normalizedScheduleSearch
                          ? 'No matching objectives for this search'
                          : 'No objectives logged for this exact date'}
                      </p>
                    </div>
                  </div>
                ) : (
                  selectedDayTasks.map((item) => (
                    <div 
                      key={`${item.task.id}-${item.occurrenceKey}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskId(item.task.id, item.occurrenceDate);
                        setSelectedDate(null);
                      }}
                      className={cn(
                        "group flex items-center justify-between p-5 bg-white rounded-xl transition-all cursor-pointer border border-outline-variant/10 hover:border-primary/20 hover:shadow-md",
                        item.isCompleted && "opacity-60 grayscale-[0.5]"
                      )}
                    >
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(item);
                          }}
                          className={cn(
                            "w-6 h-6 rounded-full border border-outline-variant flex items-center justify-center transition-all group-hover:border-primary",
                            item.isCompleted ? "bg-primary border-primary" : "bg-transparent"
                          )}
                        >
                          {item.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-on-primary" />}
                        </button>
                        <div>
                          <p className={cn(
                            "text-[15px] font-body transition-all",
                            item.isCompleted ? "text-outline line-through" : "text-primary font-medium"
                          )}>
                            {item.task.title}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
