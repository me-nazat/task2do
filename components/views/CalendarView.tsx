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
  endOfDay,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Calendar as CalendarIcon,
  Tag,
  ChevronDown,
  Flag,
  LayoutDashboard,
  AlignLeft,
  Repeat,
  Search,
  Download,
  CalendarRange,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { createTask, updateTask } from '@/actions/task';
import { createCustomSchedule } from '@/actions/custom-schedule';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';
import { buildTaskCompletionUpdate, getTaskOccurrences } from '@/lib/recurrence';
import { exportScheduleGridToPdf } from '@/lib/export-schedule-pdf';

type CalendarDayItem = {
  task: Task;
  occurrenceDate: Date;
  occurrenceKey: string;
  isCompleted: boolean;
};

type CustomScheduleBuilderMode = 'month' | 'custom';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_VIEW_VALUE = '__month__';

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

const parseStoredDate = (value: string | Date | null | undefined, fallback: Date) => {
  if (!value) {
    return fallback;
  }

  const nextDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(nextDate.getTime()) ? fallback : nextDate;
};

const getDefaultMonthCursor = () => startOfMonth(new Date()).toISOString();

const formatScheduleTitle = (start: Date, end: Date) => {
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return format(start, 'MMMM d, yyyy');
  }

  if (format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
    return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
  }

  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
};

const buildSchedulePdfFileName = (start: Date, end: Date, isMonthView: boolean) => (
  isMonthView
    ? `task2do-schedule-${format(start, 'yyyy-MM')}.pdf`
    : `task2do-schedule-${format(start, 'yyyy-MM-dd')}-to-${format(end, 'yyyy-MM-dd')}.pdf`
);

export function CalendarView() {
  const {
    tasks,
    customSchedules,
    activeScheduleView,
    setActiveScheduleView,
    setSelectedTaskId,
    user,
    addTask,
    addCustomSchedule,
    updateTask: updateTaskState,
    deleteTask,
  } = useStore();
  const [builderMode, setBuilderMode] = useState<CustomScheduleBuilderMode>('month');
  const [draftStart, setDraftStart] = useState(() => startOfDay(new Date()));
  const [draftEnd, setDraftEnd] = useState(() => endOfDay(addDays(new Date(), 13)));
  const [customViewOffset, setCustomViewOffset] = useState(0);
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
  const lastMonthCursorRef = useRef(getDefaultMonthCursor());

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

  const normalizedDraftRange = useMemo(() => {
    const safeStart = startOfDay(draftStart);
    const safeEnd = endOfDay(draftEnd);

    if (safeStart.getTime() <= safeEnd.getTime()) {
      return { start: safeStart, end: safeEnd };
    }

    return {
      start: startOfDay(draftEnd),
      end: endOfDay(draftStart),
    };
  }, [draftEnd, draftStart]);

  const monthCursorValue = activeScheduleView.type === 'month'
    ? activeScheduleView.monthCursor
    : lastMonthCursorRef.current;

  const activeMonthCursor = useMemo(
    () => startOfMonth(parseStoredDate(monthCursorValue, startOfMonth(new Date()))),
    [monthCursorValue]
  );

  const activeCustomSchedule = useMemo(() => (
    activeScheduleView.type === 'custom'
      ? customSchedules.find((schedule) => schedule.id === activeScheduleView.scheduleId) ?? null
      : null
  ), [activeScheduleView, customSchedules]);

  const activeCustomBaseRange = useMemo(() => {
    if (!activeCustomSchedule) {
      return null;
    }

    return {
      start: startOfDay(new Date(activeCustomSchedule.startDate)),
      end: endOfDay(new Date(activeCustomSchedule.endDate)),
    };
  }, [activeCustomSchedule]);

  const activeCustomRangeLength = useMemo(() => (
    activeCustomBaseRange
      ? Math.max(
          differenceInCalendarDays(activeCustomBaseRange.end, activeCustomBaseRange.start) + 1,
          1
        )
      : 1
  ), [activeCustomBaseRange]);

  const activeCustomVisibleRange = useMemo(() => {
    if (!activeCustomBaseRange) {
      return null;
    }

    const offset = customViewOffset * activeCustomRangeLength;
    return {
      start: startOfDay(addDays(activeCustomBaseRange.start, offset)),
      end: endOfDay(addDays(activeCustomBaseRange.end, offset)),
    };
  }, [activeCustomBaseRange, activeCustomRangeLength, customViewOffset]);

  const isMonthScheduleView = activeScheduleView.type === 'month' || !activeCustomVisibleRange;

  const activeRangeStart = isMonthScheduleView
    ? startOfMonth(activeMonthCursor)
    : activeCustomVisibleRange.start;
  const activeRangeEnd = isMonthScheduleView
    ? endOfMonth(activeMonthCursor)
    : activeCustomVisibleRange.end;
  const rangeStart = startOfWeek(activeRangeStart);
  const rangeEnd = endOfWeek(activeRangeEnd);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: rangeStart,
    end: rangeEnd,
  }), [rangeEnd, rangeStart]);

  const scheduleTitle = isMonthScheduleView
    ? format(activeMonthCursor, 'MMMM yyyy')
    : formatScheduleTitle(activeRangeStart, activeRangeEnd);

  const activeScheduleViewKey = activeScheduleView.type === 'month'
    ? activeScheduleView.monthCursor
    : activeScheduleView.scheduleId;
  const activeScheduleSwitcherValue = activeScheduleView.type === 'custom'
    ? activeScheduleView.scheduleId
    : MONTH_VIEW_VALUE;

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

  const activateMonthView = useCallback((nextMonth = parseStoredDate(lastMonthCursorRef.current, new Date())) => {
    const monthCursor = startOfMonth(nextMonth).toISOString();
    lastMonthCursorRef.current = monthCursor;
    setCustomViewOffset(0);
    setActiveScheduleView({
      type: 'month',
      monthCursor,
    });
  }, [setActiveScheduleView]);

  const seedBuilderFromActiveView = useCallback(() => {
    setBuilderMode(isMonthScheduleView ? 'month' : 'custom');
    setDraftStart(startOfDay(activeRangeStart));
    setDraftEnd(endOfDay(activeRangeEnd));
  }, [activeRangeEnd, activeRangeStart, isMonthScheduleView]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (activeScheduleView.type === 'month') {
      lastMonthCursorRef.current = activeScheduleView.monthCursor;
    }
  }, [activeScheduleView]);

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

  useEffect(() => {
    if (activeScheduleView.type === 'custom' && !activeCustomSchedule && customSchedules.length > 0) {
      activateMonthView();
    }
  }, [activateMonthView, activeCustomSchedule, activeScheduleView.type, customSchedules.length]);

  useEffect(() => {
    setSelectedDate(null);
    resetDetails();
  }, [activeScheduleView.type, activeScheduleViewKey, customViewOffset]);

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

  const shiftVisibleRange = (direction: 'previous' | 'next') => {
    const step = direction === 'next' ? 1 : -1;

    if (isMonthScheduleView) {
      const nextMonth = direction === 'next'
        ? addMonths(activeMonthCursor, 1)
        : subMonths(activeMonthCursor, 1);
      activateMonthView(nextMonth);
      return;
    }

    setCustomViewOffset((current) => current + step);
  };

  const resetVisibleRange = () => {
    if (isMonthScheduleView) {
      activateMonthView(startOfMonth(new Date()));
      return;
    }

    setCustomViewOffset(0);
  };

  const handleCreateScheduleView = useCallback(async () => {
    if (builderMode === 'month') {
      activateMonthView(startOfMonth(normalizedDraftRange.start));
      setIsCustomScheduleOpen(false);
      return;
    }

    if (!user) {
      alert('Sign in to save custom schedules.');
      return;
    }

    try {
      const schedule = unwrapDatabaseResult(await createCustomSchedule({
        userId: user.id,
        label: formatScheduleTitle(normalizedDraftRange.start, normalizedDraftRange.end),
        startDate: normalizedDraftRange.start,
        endDate: normalizedDraftRange.end,
      }));

      addCustomSchedule(schedule);
      setCustomViewOffset(0);
      setActiveScheduleView({ type: 'custom', scheduleId: schedule.id });
      setIsCustomScheduleOpen(false);
    } catch (error) {
      console.error('Failed to create custom schedule', error);
      alert(getClientErrorMessage(error, 'Unable to create the custom schedule right now.'));
    }
  }, [
    activateMonthView,
    addCustomSchedule,
    builderMode,
    normalizedDraftRange.end,
    normalizedDraftRange.start,
    setActiveScheduleView,
    user,
  ]);

  const handleDownloadPdf = useCallback(async () => {
    if (!calendarCaptureRef.current) {
      return;
    }

    setIsExportingPdf(true);

    try {
      await exportScheduleGridToPdf(calendarCaptureRef.current, {
        title: `Task2Do Schedule - ${scheduleTitle}`,
        fileName: buildSchedulePdfFileName(activeRangeStart, activeRangeEnd, isMonthScheduleView),
        orientationPreference: 'landscape',
      });
    } catch (error) {
      console.error('Failed to export schedule as PDF', error);
      alert('Unable to download the schedule PDF right now.');
    } finally {
      setIsExportingPdf(false);
    }
  }, [activeRangeEnd, activeRangeStart, isMonthScheduleView, scheduleTitle]);

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
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-outline-variant/10 bg-white shadow-sm">
      <div className="relative border-b border-outline-variant/10 bg-white/60 backdrop-blur-md">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 lg:gap-6">
              <h2 className="text-2xl font-headline font-medium italic tracking-tight text-primary sm:text-3xl lg:text-4xl">
                {scheduleTitle}
              </h2>

              <div className="relative flex items-center rounded-full border border-primary/10 bg-white px-3 py-2 shadow-sm">
                <span className="pr-2 text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/45">
                  View
                </span>
                <select
                  value={isMonthScheduleView ? MONTH_VIEW_VALUE : activeScheduleSwitcherValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    if (nextValue === MONTH_VIEW_VALUE) {
                      activateMonthView(activeMonthCursor);
                      return;
                    }

                    setCustomViewOffset(0);
                    setActiveScheduleView({ type: 'custom', scheduleId: nextValue });
                  }}
                  className="appearance-none bg-transparent pr-6 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-primary/80 outline-none"
                >
                  <option value={MONTH_VIEW_VALUE}>Month View</option>
                  {customSchedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-outline/45" />
              </div>

              <div className="flex items-center gap-1 rounded-full border border-primary/10 bg-primary/5 p-1">
                <button
                  onClick={() => shiftVisibleRange('previous')}
                  className="touch-target flex items-center justify-center rounded-full p-2 text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <ChevronLeft className="h-5 w-5" />
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
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
              <button
                ref={customScheduleButtonRef}
                onClick={() => {
                  if (isCustomScheduleOpen) {
                    setIsCustomScheduleOpen(false);
                    return;
                  }

                  seedBuilderFromActiveView();
                  setIsCustomScheduleOpen(true);
                }}
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

          {!isMonthScheduleView && activeCustomSchedule && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/[0.03] px-4 py-2.5">
              <div>
                <p className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">
                  Saved Custom Schedule
                </p>
                <p className="mt-1 text-sm font-body font-medium text-primary">
                  {activeCustomSchedule.label}
                </p>
                {customViewOffset !== 0 && (
                  <p className="mt-1 text-[10px] font-body text-outline/60">
                    Viewing shifted window: {formatScheduleTitle(activeRangeStart, activeRangeEnd)}
                  </p>
                )}
              </div>
              <button
                onClick={() => activateMonthView(startOfMonth(activeRangeStart))}
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
              className="absolute left-4 right-4 top-full z-30 mt-3 sm:left-auto sm:right-6 sm:w-[27rem] lg:right-10"
            >
              <div className="rounded-3xl border border-outline-variant/20 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">
                      Schedule View
                    </p>
                    <h3 className="mt-1 text-lg font-headline font-medium italic text-primary">
                      Custom Schedule Builder
                    </h3>
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
                    onClick={() => setBuilderMode('month')}
                    className={cn(
                      'rounded-full px-3 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all duration-200',
                      builderMode === 'month'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-outline/60 hover:text-primary'
                    )}
                  >
                    Standard Month
                  </button>
                  <button
                    onClick={() => setBuilderMode('custom')}
                    className={cn(
                      'rounded-full px-3 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all duration-200',
                      builderMode === 'custom'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-outline/60 hover:text-primary'
                    )}
                  >
                    Custom Range
                  </button>
                </div>

                {builderMode === 'month' ? (
                  <div className="mt-4 space-y-4 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest/40 px-4 py-3.5">
                    <div>
                      <p className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/45">
                        Month Target
                      </p>
                      <p className="mt-1 text-sm font-body font-medium text-primary">
                        {format(startOfMonth(normalizedDraftRange.start), 'MMMM yyyy')}
                      </p>
                    </div>
                    <p className="text-[10px] font-body leading-relaxed text-outline/70">
                      Reopen the polished full-month schedule without saving a custom range.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3.5">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">
                          Start Date
                        </span>
                        <input
                          type="date"
                          value={toDateInputValue(normalizedDraftRange.start)}
                          onChange={(event) => {
                            const nextDate = parseDateInput(event.target.value);
                            if (nextDate) {
                              setDraftStart(nextDate);
                            }
                          }}
                          className="w-full rounded-2xl border border-outline-variant/15 bg-white px-4 py-2.5 text-sm font-body text-primary outline-none transition-all focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/50">
                          End Date
                        </span>
                        <input
                          type="date"
                          value={toDateInputValue(normalizedDraftRange.end)}
                          onChange={(event) => {
                            const nextDate = parseDateInput(event.target.value, true);
                            if (nextDate) {
                              setDraftEnd(nextDate);
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
                            const baseStart = startOfDay(normalizedDraftRange.start);
                            setBuilderMode('custom');
                            setDraftStart(baseStart);
                            setDraftEnd(endOfDay(addDays(baseStart, preset.days)));
                          }}
                          className="rounded-full border border-primary/10 bg-primary/5 px-3 py-2 text-[9px] font-label font-bold uppercase tracking-[0.16em] text-primary/75 transition-all duration-200 hover:border-primary/20 hover:bg-primary/10"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] px-4 py-3">
                      <p className="text-[8px] font-label font-bold uppercase tracking-[0.22em] text-outline/45">
                        Saved Label Preview
                      </p>
                      <p className="mt-1 text-sm font-body font-medium text-primary">
                        {formatScheduleTitle(normalizedDraftRange.start, normalizedDraftRange.end)}
                      </p>
                    </div>

                    <p className="text-[10px] font-body leading-relaxed text-outline/65">
                      The grid stays padded to full weeks so scanning remains effortless, while the saved schedule keeps its own isolated range and export state.
                    </p>
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={handleCreateScheduleView}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-on-primary shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <CalendarRange className="h-3.5 w-3.5" />
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div ref={calendarCaptureRef} className="flex min-h-full min-w-[44rem] flex-col bg-white md:min-w-0">
          <div className="grid grid-cols-7 border-b border-outline-variant/10 bg-white">
            {weekDays.map((day) => (
              <div key={day} className="py-4 text-center text-[9px] font-label font-bold uppercase tracking-[0.3em] text-outline/40 sm:py-5">
                {day}
              </div>
            ))}
          </div>

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
              const isInPrimaryRange = isMonthScheduleView
                ? isSameMonth(day, activeRangeStart)
                : day >= startOfDay(activeRangeStart) && day <= startOfDay(activeRangeEnd);
              const isCurrentDay = isToday(day);
              const isSearchMatch = doesDayMatchScheduleSearch(day, dayTasks);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => { setSelectedDate(day); resetDetails(); setNewTaskTitle(''); }}
                  className={cn(
                    'grid min-h-[5.75rem] cursor-pointer grid-rows-[auto_minmax(0,1fr)] gap-1 border-b border-r border-outline-variant/10 p-2 transition-all hover:bg-primary/[0.02] sm:min-h-[8rem] sm:p-2.5 lg:min-h-[13.5rem] lg:gap-2.5 lg:p-3.5',
                    !isInPrimaryRange && 'bg-primary/[0.01] opacity-35',
                    normalizedScheduleSearch && !isSearchMatch && 'opacity-45',
                    normalizedScheduleSearch && isSearchMatch && 'bg-primary/[0.04] shadow-[inset_0_0_0_1px_rgba(16,24,40,0.06)]',
                    idx % 7 === 6 && 'border-r-0'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-body font-bold transition-all sm:h-8 sm:w-8 sm:text-[12px]',
                      isCurrentDay ? 'bg-primary text-on-primary shadow-md' : 'text-primary/60',
                      normalizedScheduleSearch && isSearchMatch && !isCurrentDay && 'bg-primary/10 text-primary'
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
                              'h-1.5 w-1.5 rounded-full',
                              normalizedScheduleSearch ? 'bg-primary' : 'bg-primary/50'
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
                          'flex min-h-0 items-center overflow-hidden rounded-lg border px-2.5 py-1.5 text-[10px] font-body font-medium leading-[1.15] transition-all hover:shadow-sm',
                          item.isCompleted
                            ? 'border-transparent bg-primary/5 text-outline/60 line-through'
                            : 'border-primary/10 bg-primary/5 text-primary hover:border-primary/30',
                          normalizedScheduleSearch && doesTaskMatchScheduleSearch(item) && 'border-primary/25 bg-white shadow-sm'
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/10 p-0 backdrop-blur-[8px] sm:items-center sm:p-4"
            onClick={() => { setSelectedDate(null); resetDetails(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-outline-variant/20 bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl"
            >
              <div className="border-b border-outline-variant/10 bg-surface/50 p-5 sm:p-8">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant/40 sm:hidden" />
                <div className="mb-6 flex items-end justify-between sm:mb-8">
                  <div>
                    <h2 className="font-headline text-3xl font-medium tracking-tight text-primary sm:text-4xl">
                      {format(selectedDate, 'd')} {format(selectedDate, 'MMM')}
                    </h2>
                    <p className="mt-2 font-label text-[9px] font-bold uppercase tracking-[0.25em] text-outline opacity-60">
                      {format(selectedDate, 'EEEE')}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedDate(null); resetDetails(); }}
                    className="touch-target flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-outline transition-colors hover:bg-surface-container-high"
                  >
                    ×
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-white p-2 shadow-sm transition-all duration-500 focus-within:border-primary/20 focus-within:shadow-md sm:gap-4">
                  <div className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low sm:ml-4">
                    <Plus className="h-5 w-5 text-primary/60" />
                  </div>
                  <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={handleAddTask}
                    placeholder={`Capture a new objective for ${format(selectedDate, 'MMM d')}...`}
                    className="flex-1 bg-transparent py-4 font-body text-lg tracking-tight placeholder:text-outline/40 outline-none"
                  />
                  <div className="hidden gap-4 border-l border-outline-variant/20 px-6 sm:flex">
                    <CalendarIcon className="h-5 w-5 cursor-pointer text-primary transition-colors" />
                    <Tag className="h-5 w-5 cursor-pointer text-outline/40 transition-colors hover:text-primary" />
                  </div>
                </div>

                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-primary/60 transition-all duration-200 hover:bg-primary/5 hover:text-primary"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', showDetails && 'rotate-180')} />
                  {showDetails ? 'Hide Details' : 'Add Details'}
                </button>
              </div>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="overflow-hidden border-b border-outline-variant/10"
                  >
                    <div className="space-y-6 bg-surface-container-lowest/30 p-8">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[9px] font-label font-bold uppercase tracking-[0.25em] text-outline/50">Task Details</span>
                        <div className="h-px flex-1 bg-outline-variant/20" />
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex w-28 shrink-0 items-center gap-2.5 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-outline/70">
                          <Flag className="h-3.5 w-3.5" /> Priority
                        </div>
                        <div className="flex flex-1 items-center gap-3">
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
                                'rounded-full p-2.5 transition-all duration-200 hover:bg-surface-container-low active:scale-90',
                                calendarPriority === p.value ? 'scale-110 bg-surface-container-high shadow-sm' : ''
                              )}
                              title={p.label}
                            >
                              <Flag className={cn('h-4 w-4', p.color, calendarPriority === p.value ? 'fill-current' : '')} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex w-28 shrink-0 items-center gap-2.5 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-outline/70">
                          <Repeat className="h-3.5 w-3.5" /> Repeat
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
                            className="rounded-lg border-none bg-surface-container-low px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all duration-200 hover:bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary/20"
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
                                        setCalendarRecurrenceDays((prev) => {
                                          const newDays = prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx];
                                          if (prev.includes(idx)) {
                                            const newTimes = { ...calendarCustomTimes };
                                            delete newTimes[idx];
                                            setCalendarCustomTimes(newTimes);
                                          }
                                          return newDays;
                                        });
                                      }}
                                      className={cn(
                                        'h-7 w-7 rounded-full text-[10px] font-bold transition-all',
                                        isSelected
                                          ? 'bg-primary text-on-primary shadow-sm'
                                          : 'bg-surface-container-low text-outline/60 hover:bg-surface-container-high hover:text-primary'
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
                                    className="flex items-center gap-2 text-[9px] font-label font-bold uppercase tracking-[0.2em] text-primary/70 hover:text-primary"
                                  >
                                    <Plus className={cn('h-3 w-3 transition-transform', showCustomTimes && 'rotate-45')} />
                                    {showCustomTimes ? 'Hide custom times' : 'Add custom time also'}
                                  </button>

                                  {showCustomTimes && (
                                    <div className="space-y-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
                                      {calendarRecurrenceDays.sort().map((dayIdx) => (
                                        <div key={dayIdx} className="flex items-center justify-between gap-4">
                                          <span className="w-16 text-[10px] font-label font-bold uppercase tracking-wider text-outline/70">
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIdx]}
                                          </span>
                                          <input
                                            type="time"
                                            value={calendarCustomTimes[dayIdx] || '09:00'}
                                            onChange={(e) => setCalendarCustomTimes((prev) => ({ ...prev, [dayIdx]: e.target.value }))}
                                            className="rounded-lg border border-outline-variant/20 bg-white px-2 py-1 text-xs font-body outline-none focus:ring-1 focus:ring-primary/20"
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

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex w-28 shrink-0 items-center gap-2.5 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-outline/70">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Status
                        </div>
                        <div className="flex-1">
                          <select
                            value={calendarStatus}
                            onChange={(e) => setCalendarStatus(e.target.value as typeof calendarStatus)}
                            className="rounded-lg border-none bg-surface-container-low px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all duration-200 hover:bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary/20"
                          >
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex w-28 shrink-0 items-center gap-2.5 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-outline/70">
                          <LayoutDashboard className="h-3.5 w-3.5" /> Quadrant
                        </div>
                        <div className="flex-1">
                          <select
                            value={calendarQuadrant || 'none'}
                            onChange={(e) => setCalendarQuadrant(e.target.value === 'none' ? null : e.target.value)}
                            className="rounded-lg border-none bg-surface-container-low px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all duration-200 hover:bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary/20"
                          >
                            <option value="none">None</option>
                            <option value="urgent-important">Urgent & Important</option>
                            <option value="not-urgent-important">Not Urgent & Important</option>
                            <option value="urgent-not-important">Urgent & Not Important</option>
                            <option value="not-urgent-not-important">Not Urgent & Not Important</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex w-28 shrink-0 items-center gap-2.5 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-outline/70">
                          <Tag className="h-3.5 w-3.5" /> Tags
                        </div>
                        <div className="flex-1 cursor-pointer rounded-lg px-4 py-2.5 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-outline/50 transition-all duration-200 hover:bg-surface-container-low">
                          Add identifiers...
                        </div>
                      </div>

                      <div className="flex items-start gap-6 text-sm">
                        <div className="flex w-28 shrink-0 items-center gap-2.5 pt-2 text-[9px] font-label font-bold uppercase tracking-[0.15em] text-outline/70">
                          <AlignLeft className="h-3.5 w-3.5" /> Notes
                        </div>
                        <div className="flex-1">
                          <textarea
                            value={calendarDescription}
                            onChange={(e) => setCalendarDescription(e.target.value)}
                            placeholder="Add context, details, or notes..."
                            rows={3}
                            className="w-full resize-none rounded-xl border border-outline-variant/10 bg-surface-container-low/50 px-5 py-4 font-body text-[14px] leading-relaxed placeholder:text-outline/30 transition-all duration-200 hover:bg-surface-container-high/50 focus:border-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/10"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="safe-area-bottom space-y-3 overflow-y-auto bg-surface-container-lowest/30 p-5 sm:p-8">
                {normalizedScheduleSearch && selectedDayTasks.length > 0 && (
                  <div className="rounded-2xl border border-primary/10 bg-white/80 px-4 py-3">
                    <p className="text-[8px] font-label font-bold uppercase tracking-[0.2em] text-outline/50">Search Results</p>
                    <p className="mt-1 text-sm font-body font-medium text-primary">
                      Showing {selectedDayTasks.length} match{selectedDayTasks.length === 1 ? '' : 'es'} for “{scheduleSearchQuery.trim()}”
                    </p>
                  </div>
                )}

                {selectedDayTasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-16 text-center text-outline">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container">
                      <CheckCircle2 className="h-6 w-6 text-outline/40" />
                    </div>
                    <div>
                      <p className="text-xl font-headline italic text-primary">Clear Schedule</p>
                      <p className="mt-2 text-[9px] font-label font-bold uppercase tracking-[0.25em] opacity-60">
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
                        'group flex cursor-pointer items-center justify-between rounded-xl border border-outline-variant/10 bg-white p-5 transition-all hover:border-primary/20 hover:shadow-md',
                        item.isCompleted && 'opacity-60 grayscale-[0.5]'
                      )}
                    >
                      <div className="flex items-center gap-6">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(item);
                          }}
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant transition-all group-hover:border-primary',
                            item.isCompleted ? 'border-primary bg-primary' : 'bg-transparent'
                          )}
                        >
                          {item.isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-on-primary" />}
                        </button>
                        <div>
                          <p className={cn(
                            'text-[15px] font-body transition-all',
                            item.isCompleted ? 'text-outline line-through' : 'font-medium text-primary'
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
