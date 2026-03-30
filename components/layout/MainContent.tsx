'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { Plus, CheckCircle2, Calendar as CalendarIcon, Tag, ChevronDown, Bell, Flag, LayoutDashboard, X, AlignLeft, Clock, AlertTriangle, Repeat } from 'lucide-react';
import { createTask, updateTask } from '@/actions/task';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, isAfter, isSameDay, isBefore, addDays, addMonths, addWeeks, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { MatrixView } from '@/components/views/MatrixView';
import { KanbanView } from '@/components/views/KanbanView';
import { CalendarView } from '@/components/views/CalendarView';
import { HabitTrackerView } from '@/components/views/HabitTrackerView';
import { AIChatView } from '@/components/views/AIChatView';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { getClientErrorMessage, unwrapDatabaseResult } from '@/lib/database-client';

// Animation presets for consistent, smooth micro-interactions
const viewTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { type: 'spring', damping: 30, stiffness: 350, mass: 0.8 },
} as const;

const listItemTransition = {
  initial: { opacity: 0, y: -8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95, x: -20 },
  transition: { type: 'spring', damping: 28, stiffness: 400, mass: 0.6 },
} as const;

const dropdownTransition = {
  initial: { opacity: 0, y: -6, scale: 0.95, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -6, scale: 0.95, filter: 'blur(4px)' },
  transition: { type: 'spring', damping: 25, stiffness: 500, mass: 0.5 },
} as const;

export function MainContent() {
  const { toggleSidebar, currentView, selectedListId, tasks, addTask, updateTask: updateTaskState, deleteTask, setSelectedTaskId, searchQuery, user, setAuthModalOpen } = useStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Inbox filter state — default to 'week'
  const [inboxFilter, setInboxFilter] = useState<'all' | 'day' | 'week' | 'month'>('week');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Upcoming filter state — default to 'all' (everything except today)
  const [upcomingFilter, setUpcomingFilter] = useState<'all' | 'this-week' | 'this-month'>('all');
  const [isUpcomingFilterOpen, setIsUpcomingFilterOpen] = useState(false);

  // Modal form state
  const [modalTaskTitle, setModalTaskTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalStatus, setModalStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [modalPriority, setModalPriority] = useState<number>(0);
  const [modalQuadrant, setModalQuadrant] = useState<string | null>(null);
  const [modalStartDate, setModalStartDate] = useState<Date | null>(null);
  const [modalEndDate, setModalEndDate] = useState<Date | null>(null);
  const [modalIsAllDay, setModalIsAllDay] = useState<boolean>(false);
  const [modalTimezone, setModalTimezone] = useState<string | null>(null);
  const [modalReminderAt, setModalReminderAt] = useState<Date | null>(null);
  const [modalRecurrence, setModalRecurrence] = useState<string>('none');
  const [modalRecurrenceDays, setModalRecurrenceDays] = useState<number[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddModalOpen && modalInputRef.current) {
      setTimeout(() => modalInputRef.current?.focus(), 100);
    }
  }, [isAddModalOpen]);

  const resetModalForm = useCallback(() => {
    setModalTaskTitle('');
    setModalDescription('');
    setModalStatus('todo');
    setModalPriority(0);
    setModalQuadrant(null);
    setModalStartDate(null);
    setModalEndDate(null);
    setModalIsAllDay(false);
    setModalTimezone(null);
    setModalReminderAt(null);
    setModalRecurrence('none');
    setModalRecurrenceDays([]);
  }, []);

  // Context-aware modal opening
  const handleOpenAddModal = useCallback(() => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    resetModalForm();

    // Pre-fill based on current view
    if (currentView === 'today') {
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      setModalStartDate(today);
    } else if (currentView === 'kanban') {
      setModalStatus('todo');
    }

    setIsAddModalOpen(true);
  }, [currentView, resetModalForm, user, setAuthModalOpen]);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    resetModalForm();
  }, [resetModalForm]);

  const handleModalAddTask = async () => {
    if (!modalTaskTitle.trim() || !user) return;

    const title = modalTaskTitle.trim();
    const tempId = `temp-${Date.now()}`;
    const newTask = {
      id: tempId,
      title,
      isCompleted: modalStatus === 'done',
      priority: modalPriority,
      startDate: modalStartDate,
      endDate: modalEndDate,
      isAllDay: modalIsAllDay,
      listId: selectedListId,
      description: modalDescription || null,
      quadrant: modalQuadrant,
      parentId: null,
      timezone: modalTimezone,
      reminderAt: modalReminderAt,
      recurrence: (modalRecurrence === 'weekly' || modalRecurrence === 'custom') && modalRecurrenceDays.length > 0 
        ? `${modalRecurrence}:${modalRecurrenceDays.join(',')}` 
        : modalRecurrence === 'none' ? null : modalRecurrence,
      status: modalStatus as 'todo' | 'in-progress' | 'done',
    };
    addTask(newTask);
    handleCloseAddModal();

    try {
      const id = unwrapDatabaseResult(await createTask({
        title,
        listId: selectedListId || undefined,
        userId: user.id,
        startDate: modalStartDate || undefined,
        endDate: modalEndDate || undefined,
        priority: modalPriority,
        status: modalStatus,
        quadrant: modalQuadrant || undefined,
        recurrence: (modalRecurrence === 'weekly' || modalRecurrence === 'custom') && modalRecurrenceDays.length > 0 
          ? `${modalRecurrence}:${modalRecurrenceDays.join(',')}` 
          : modalRecurrence === 'none' ? undefined : modalRecurrence,
      }));
      updateTaskState(tempId, { id });
    } catch (error) {
      console.error('Failed to create task', error);
      deleteTask(tempId);
      alert(getClientErrorMessage(error, 'Unable to create task right now.'));
    }
  };

  const handleToggleComplete = async (taskId: string, currentStatus: boolean | null) => {
    const newStatus = !currentStatus;
    updateTaskState(taskId, { isCompleted: newStatus });
    try {
      unwrapDatabaseResult(await updateTask(taskId, { isCompleted: newStatus }));
    } catch (error) {
      console.error('Failed to update task', error);
      updateTaskState(taskId, { isCompleted: currentStatus });
      alert(getClientErrorMessage(error, 'Unable to update the task right now.'));
    }
  };

  // ======= FIXED FILTERING LOGIC =======
  // Memoize the "now" value per render to keep consistency
  const now = useMemo(() => new Date(), [tasks, currentView, upcomingFilter, inboxFilter, searchQuery]);

  const isTaskToday = useCallback((task: typeof tasks[0]) => {
    return task.startDate && isSameDay(new Date(task.startDate), now);
  }, [now]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.parentId) return false;
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      if (currentView === 'today') {
        return isTaskToday(task);
      }

      if (currentView === 'upcoming') {
        // "Upcoming" = everything EXCEPT today's tasks
        if (isTaskToday(task)) return false;
        // Completed tasks are hidden from upcoming
        if (task.isCompleted) return false;

        if (upcomingFilter === 'all') {
          // Show ALL tasks that are not scheduled for today
          return true;
        }
        if (upcomingFilter === 'this-week') {
          // Tasks dated within the next 7 days (not today) + undated tasks
          if (!task.startDate) return false; // undated goes to "All Tasks" or "This Month"
          const taskDate = new Date(task.startDate);
          return isWithinInterval(taskDate, { start: endOfDay(now), end: endOfDay(addDays(now, 7)) });
        }
        if (upcomingFilter === 'this-month') {
          // Tasks dated within the next 30 days (not today) + tasks with NO date
          if (!task.startDate) return true; // undated tasks go to "This Month"
          const taskDate = new Date(task.startDate);
          return isWithinInterval(taskDate, { start: endOfDay(now), end: endOfDay(addMonths(now, 1)) });
        }
        return true;
      }

      if (currentView === 'list') {
        // FIX: treat 'inbox' selectedListId as null (the actual inbox)
        const isInboxSelected = !selectedListId || selectedListId === 'inbox';

        if (!isInboxSelected && selectedListId) {
          // A specific collection/list is selected
          return task.listId === selectedListId;
        }

        // Inbox view: show tasks without a listId (or listId === 'inbox')
        const isInboxTask = !task.listId || task.listId === 'inbox';
        if (!isInboxTask) return false;

        if (inboxFilter === 'day') {
          return task.startDate && isSameDay(new Date(task.startDate), now);
        }
        if (inboxFilter === 'week') {
          if (!task.startDate) return true;
          return isWithinInterval(new Date(task.startDate), { start: startOfDay(now), end: endOfDay(addDays(now, 7)) });
        }
        if (inboxFilter === 'month') {
          if (!task.startDate) return true;
          return isWithinInterval(new Date(task.startDate), { start: startOfDay(now), end: endOfDay(addMonths(now, 1)) });
        }
        return true; // 'all'
      }
      return true;
    });
  }, [tasks, currentView, selectedListId, searchQuery, inboxFilter, upcomingFilter, now, isTaskToday]);

  // Get tasks with upcoming reminders (used in Inbox view Reminders Box)
  const reminderTasks = useMemo(() => tasks.filter(task => {
    if (task.parentId || task.isCompleted) return false;
    if (!task.reminderAt) return false;
    const reminderDate = new Date(task.reminderAt);
    return isBefore(reminderDate, addDays(now, 1));
  }), [tasks, now]);

  // Due Today / Overdue / Tight Deadline tasks for Inbox Reminders Box
  const urgentTasks = useMemo(() => tasks.filter(task => {
    if (task.parentId || task.isCompleted) return false;
    if (!task.startDate) return false;
    const taskDate = new Date(task.startDate);
    return isBefore(taskDate, endOfDay(now)) || isSameDay(taskDate, now);
  }), [tasks, now]);

  // Combine reminder tasks and urgent tasks for the Inbox Reminders Box
  const inboxAlertTasks = useMemo(() => [...new Map(
    [...urgentTasks, ...reminderTasks].map(t => [t.id, t])
  ).values()], [urgentTasks, reminderTasks]);

  // Completed tasks for the Completed & Reminders view
  const completedTasks = useMemo(() => tasks.filter(task => {
    if (task.parentId) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return task.isCompleted;
  }), [tasks, searchQuery]);

  const getViewTitle = () => {
    if (currentView === 'today') return 'Today';
    if (currentView === 'upcoming') return 'Upcoming';
    if (currentView === 'completed-reminders') return 'Completed & Alerts';
    if (currentView === 'list') {
      if (!selectedListId || selectedListId === 'inbox') return 'Inbox';
      return selectedListId;
    }
    return currentView.charAt(0).toUpperCase() + currentView.slice(1);
  };

  const isInboxView = currentView === 'list' && (!selectedListId || selectedListId === 'inbox');

  const filterLabels: Record<string, string> = {
    all: 'All Tasks',
    day: 'Day',
    week: 'Week',
    month: 'Month',
  };

  const upcomingFilterLabels: Record<string, string> = {
    'all': 'All Tasks',
    'this-week': 'This Week',
    'this-month': 'This Month',
  };

  const getUrgencyLabel = (task: typeof tasks[0]) => {
    if (!task.startDate) return null;
    const taskDate = new Date(task.startDate);
    if (isBefore(taskDate, startOfDay(now))) return 'Overdue';
    if (isSameDay(taskDate, now)) return 'Due Today';
    if (task.reminderAt && isBefore(new Date(task.reminderAt), now)) return 'Reminder Overdue';
    return 'Due Soon';
  };

  const getUrgencyColor = (label: string | null) => {
    switch (label) {
      case 'Overdue': return 'text-red-600 bg-red-50 border-red-200/60';
      case 'Reminder Overdue': return 'text-red-500 bg-red-50/50 border-red-200/40';
      case 'Due Today': return 'text-amber-700 bg-amber-50 border-amber-200/50';
      default: return 'text-orange-600 bg-orange-50 border-orange-200/40';
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto px-16 py-16">
        <div className="max-w-5xl mx-auto">
          
          {/* Quick Add Bar */}
          {currentView !== 'calendar' && currentView !== 'ai-chat' && currentView !== 'completed-reminders' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="mb-20"
            >
              <div 
                onClick={handleOpenAddModal}
                className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 ease-out cursor-pointer group"
              >
                <div className="ml-4 w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
                  <Plus className="w-5 h-5 text-primary/60 group-hover:text-primary group-hover:scale-110 transition-all duration-300" />
                </div>
                <span className="flex-1 py-4 font-body text-lg tracking-tight text-outline/40 group-hover:text-outline/60 transition-colors duration-300">
                  Capture a new objective...
                </span>
                <div className="flex gap-4 px-6 border-l border-outline-variant/20 group-hover:border-primary/10 transition-colors duration-300">
                  <CalendarIcon className="w-5 h-5 text-outline/40 group-hover:text-primary/50 transition-colors duration-300" />
                  <Tag className="w-5 h-5 text-outline/40 group-hover:text-primary/50 transition-colors duration-300" />
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== View Content with Animated Transitions ===== */}
          <AnimatePresence mode="wait">
            {/* List / Today / Upcoming Views */}
            {(currentView === 'list' || currentView === 'today' || currentView === 'upcoming') && (
              <motion.div
                key={`view-${currentView}-${selectedListId}`}
                {...viewTransition}
                className="space-y-16"
              >

                {/* Inbox Reminders / Urgency Box — Only on Inbox view */}
                {isInboxView && inboxAlertTasks.length > 0 && (
                  <AlertBanner
                    title="Attention Required"
                    subtitle={`${inboxAlertTasks.length} ${inboxAlertTasks.length === 1 ? 'item needs' : 'items need'} your attention`}
                    icon={AlertTriangle}
                    colorScheme="red"
                  >
                        {inboxAlertTasks.map((task, index) => {
                          const urgency = getUrgencyLabel(task);
                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => setSelectedTaskId(task.id)}
                              className="group flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-red-200/20 hover:border-red-300/50 hover:shadow-md hover:bg-white transition-all duration-200 cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                {urgency === 'Overdue' || urgency === 'Reminder Overdue' ? (
                                  <AlertTriangle className="w-4 h-4 text-red-600" />
                                ) : (
                                  <Clock className="w-4 h-4 text-amber-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-body font-medium text-on-surface truncate">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {urgency && (
                                    <span className={cn("text-[8px] font-label font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border", getUrgencyColor(urgency))}>
                                      {urgency}
                                    </span>
                                  )}
                                  {task.startDate && (
                                    <span className="text-[9px] font-label font-bold tracking-[0.1em] uppercase text-outline/50">
                                      {format(new Date(task.startDate), 'MMM d, hh:mm a')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <span className="text-[9px] font-label font-bold tracking-[0.1em] uppercase text-red-500">View →</span>
                              </div>
                            </motion.div>
                          );
                        })}
                  </AlertBanner>
                )}

                {/* Reminders Section — for non-Inbox views */}
                {!isInboxView && reminderTasks.length > 0 && (
                  <AlertBanner
                    title="Reminders"
                    subtitle={`${reminderTasks.length} pending ${reminderTasks.length === 1 ? 'alert' : 'alerts'}`}
                    icon={Bell}
                    colorScheme="amber"
                  >
                        {reminderTasks.map((task, index) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="group flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-amber-200/30 hover:border-amber-300/60 hover:shadow-md hover:bg-white transition-all duration-200 cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                              <Bell className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-body font-medium text-amber-900 truncate">{task.title}</p>
                              {task.reminderAt && (
                                <p className="text-[9px] font-label font-bold tracking-[0.15em] uppercase text-amber-600/60 mt-0.5">
                                  {isBefore(new Date(task.reminderAt), now) ? 'Overdue' : format(new Date(task.reminderAt), 'hh:mm a')}
                                </p>
                              )}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <span className="text-[9px] font-label font-bold tracking-[0.1em] uppercase text-amber-500">View →</span>
                            </div>
                          </motion.div>
                        ))}
                  </AlertBanner>
                )}

                <div className="group-container">
                  <div className="flex justify-between items-end mb-10 border-b border-outline-variant/30 pb-6">
                    <div>
                      <div className="flex items-center gap-4">
                        <h2 className="font-headline font-medium text-5xl tracking-tight text-primary">{getViewTitle()}</h2>
                        
                        {/* Inbox filter dropdown */}
                        {isInboxView && (
                          <div className="relative">
                            <button
                              onClick={() => setIsFilterOpen(!isFilterOpen)}
                              className="flex items-center gap-2 px-4 py-2 bg-primary/5 hover:bg-primary/10 rounded-full transition-all duration-200 border border-primary/10 hover:border-primary/20 active:scale-95"
                            >
                              <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-primary/70">{filterLabels[inboxFilter]}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-primary/50 transition-transform duration-300", isFilterOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isFilterOpen && (
                                <motion.div
                                  {...dropdownTransition}
                                  className="absolute top-full left-0 mt-2 w-44 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-outline-variant/20 overflow-hidden z-30"
                                >
                                  {(['all', 'day', 'week', 'month'] as const).map((filter) => (
                                    <button
                                      key={filter}
                                      onClick={() => { setInboxFilter(filter); setIsFilterOpen(false); }}
                                      className={cn(
                                        "w-full text-left px-5 py-3 text-[11px] font-label font-bold tracking-[0.1em] uppercase transition-all duration-150",
                                        inboxFilter === filter
                                          ? "bg-primary/10 text-primary"
                                          : "text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                                      )}
                                    >
                                      {filterLabels[filter]}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Upcoming filter dropdown */}
                        {currentView === 'upcoming' && (
                          <div className="relative">
                            <button
                              onClick={() => setIsUpcomingFilterOpen(!isUpcomingFilterOpen)}
                              className="flex items-center gap-2 px-4 py-2 bg-primary/5 hover:bg-primary/10 rounded-full transition-all duration-200 border border-primary/10 hover:border-primary/20 active:scale-95"
                            >
                              <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-primary/70">{upcomingFilterLabels[upcomingFilter]}</span>
                              <ChevronDown className={cn("w-3.5 h-3.5 text-primary/50 transition-transform duration-300", isUpcomingFilterOpen && "rotate-180")} />
                            </button>
                            
                            <AnimatePresence>
                              {isUpcomingFilterOpen && (
                                <motion.div
                                  {...dropdownTransition}
                                  className="absolute top-full left-0 mt-2 w-44 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-outline-variant/20 overflow-hidden z-30"
                                >
                                  {(['all', 'this-week', 'this-month'] as const).map((filter) => (
                                    <button
                                      key={filter}
                                      onClick={() => { setUpcomingFilter(filter); setIsUpcomingFilterOpen(false); }}
                                      className={cn(
                                        "w-full text-left px-5 py-3 text-[11px] font-label font-bold tracking-[0.1em] uppercase transition-all duration-150",
                                        upcomingFilter === filter
                                          ? "bg-primary/10 text-primary"
                                          : "text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                                      )}
                                    >
                                      {upcomingFilterLabels[filter]}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                      <p className="font-label text-[9px] uppercase tracking-[0.25em] text-outline mt-3 font-bold opacity-60">Current Focus & Trajectory</p>
                    </div>
                    <span className="font-label text-[10px] tracking-[0.15em] text-outline font-semibold uppercase opacity-70">
                      {format(new Date(), 'EEEE, MMMM do')}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                    {filteredTasks.map((task, index) => (
                      <motion.div 
                        layout
                        {...listItemTransition}
                        transition={{ ...listItemTransition.transition, delay: index * 0.03 }}
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={cn(
                          "group flex items-center justify-between p-5 bg-white rounded-xl cursor-pointer border border-outline-variant/10 hover:border-primary/20 hover:shadow-md active:scale-[0.99]",
                          "transition-[border-color,box-shadow,transform] duration-200",
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
                              "w-6 h-6 rounded-full border border-outline-variant flex items-center justify-center transition-all duration-200 group-hover:border-primary active:scale-90",
                              task.isCompleted ? "bg-primary border-primary" : "bg-transparent hover:bg-primary/5"
                            )}
                          >
                            {task.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-on-primary" />}
                          </button>
                          <div>
                            <p className={cn(
                              "text-[15px] font-body transition-all duration-200",
                              task.isCompleted ? "text-outline line-through" : "text-primary font-medium"
                            )}>
                              {task.title}
                            </p>
                            {task.startDate && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <CalendarIcon className="w-3 h-3 text-outline/60" />
                                <span className="text-[9px] font-label uppercase tracking-[0.15em] text-outline font-bold opacity-60">
                                  {format(new Date(task.startDate), 'MMM d · hh:mm a')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Tag className="w-4 h-4 text-outline/40 hover:text-primary transition-colors duration-200" />
                        </div>
                      </motion.div>
                    ))}
                    </AnimatePresence>
                    {filteredTasks.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring', damping: 25, stiffness: 300 }}
                        className="text-center py-24 text-outline flex flex-col items-center gap-4"
                      >
                        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-outline/40" />
                        </div>
                        <div>
                          <p className="text-xl font-headline italic text-primary">All is in order</p>
                          <p className="text-[9px] font-label uppercase tracking-[0.25em] mt-2 font-bold opacity-60">No pending actions in this view</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Completed & Reminders View */}
            {currentView === 'completed-reminders' && (
              <motion.div key="view-completed" {...viewTransition} className="space-y-16">
                {/* Success Banner */}
                <div className="mb-6">
                  <AlertBanner
                    title="Success Summary"
                    subtitle={`${tasks.filter(t => t.isCompleted).length} total objectives completed`}
                    icon={CheckCircle2}
                    colorScheme="green"
                  />
                </div>

                {/* Active Reminders Section */}
                {reminderTasks.length > 0 && (
                  <AlertBanner
                    title="Active Alerts"
                    subtitle={`${reminderTasks.length} pending`}
                    icon={Bell}
                    colorScheme="amber"
                  >
                        {reminderTasks.map((task, index) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="group flex items-center gap-4 p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-amber-200/30 hover:border-amber-300/60 hover:shadow-md hover:bg-white transition-all duration-200 cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                              <Bell className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-body font-medium text-amber-900 truncate">{task.title}</p>
                              {task.reminderAt && (
                                <p className="text-[9px] font-label font-bold tracking-[0.15em] uppercase text-amber-600/60 mt-0.5">
                                  {isBefore(new Date(task.reminderAt), now) ? 'Overdue' : format(new Date(task.reminderAt), 'MMM d, hh:mm a')}
                                </p>
                              )}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <span className="text-[9px] font-label font-bold tracking-[0.1em] uppercase text-amber-500">View →</span>
                            </div>
                          </motion.div>
                        ))}
                  </AlertBanner>
                )}

                {/* Completed Tasks Section */}
                <div className="group-container">
                  <div className="flex justify-between items-end mb-10 border-b border-outline-variant/30 pb-6">
                    <div>
                      <h2 className="font-headline font-medium text-5xl tracking-tight text-primary">Completed</h2>
                      <p className="font-label text-[9px] uppercase tracking-[0.25em] text-outline mt-3 font-bold opacity-60">Accomplished Objectives</p>
                    </div>
                    <span className="font-label text-[10px] tracking-[0.15em] text-outline font-semibold uppercase opacity-70">
                      {completedTasks.length} {completedTasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                    {completedTasks.map((task, index) => (
                      <motion.div 
                        layout
                        {...listItemTransition}
                        transition={{ ...listItemTransition.transition, delay: index * 0.03 }}
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="group flex items-center justify-between p-5 bg-white rounded-xl cursor-pointer border border-outline-variant/10 hover:border-primary/20 hover:shadow-md opacity-70 transition-[border-color,box-shadow,opacity] duration-200 active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleComplete(task.id, task.isCompleted);
                            }}
                            className="w-6 h-6 rounded-full bg-primary border-primary flex items-center justify-center transition-all duration-200 active:scale-90"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-on-primary" />
                          </button>
                          <div>
                            <p className="text-[15px] font-body text-outline line-through">{task.title}</p>
                            {task.startDate && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <CalendarIcon className="w-3 h-3 text-outline/60" />
                                <span className="text-[9px] font-label uppercase tracking-[0.15em] text-outline font-bold opacity-60">
                                  {format(new Date(task.startDate), 'MMM d, yyyy')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    </AnimatePresence>
                    {completedTasks.length === 0 && reminderTasks.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-24 text-outline flex flex-col items-center gap-4"
                      >
                        <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-outline/40" />
                        </div>
                        <div>
                          <p className="text-xl font-headline italic text-primary">Nothing here yet</p>
                          <p className="text-[9px] font-label uppercase tracking-[0.25em] mt-2 font-bold opacity-60">Completed tasks and alerts will appear here</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Other views */}
            {currentView === 'calendar' && (
              <motion.div key="view-calendar" {...viewTransition}>
                <CalendarView />
              </motion.div>
            )}
            {currentView === 'matrix' && (
              <motion.div key="view-matrix" {...viewTransition}>
                <MatrixView />
              </motion.div>
            )}
            {currentView === 'kanban' && (
              <motion.div key="view-kanban" {...viewTransition}>
                <KanbanView />
              </motion.div>
            )}
            {currentView === 'habits' && (
              <motion.div key="view-habits" {...viewTransition}>
                <HabitTrackerView />
              </motion.div>
            )}
            {currentView === 'ai-chat' && (
              <motion.div key="view-ai-chat" {...viewTransition}>
                <AIChatView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Global Capture Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-[8px]"
            onClick={handleCloseAddModal}
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-2xl border border-outline-variant/20 flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-outline-variant/10 bg-surface/50">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <h2 className="font-headline font-medium text-3xl tracking-tight text-primary italic">New Objective</h2>
                    <p className="font-label text-[9px] uppercase tracking-[0.25em] text-outline mt-2 font-bold opacity-60">Capture your intent</p>
                  </div>
                  <button
                    onClick={handleCloseAddModal}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors duration-200 text-outline cursor-pointer active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Title Input */}
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-outline-variant/10 shadow-sm focus-within:shadow-md focus-within:border-primary/20 transition-all duration-300">
                  <div className="ml-4 w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary/60" />
                  </div>
                  <input
                    ref={modalInputRef}
                    type="text"
                    value={modalTaskTitle}
                    onChange={(e) => setModalTaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && modalTaskTitle.trim()) handleModalAddTask(); }}
                    placeholder="What do you want to accomplish?"
                    className="flex-1 bg-transparent border-none focus:ring-0 py-4 font-body text-lg tracking-tight placeholder:text-outline/40 outline-none"
                  />
                </div>
              </div>

              {/* Optional Details */}
              <div className="flex-1 min-h-0 p-8 overflow-y-auto space-y-8 bg-surface-container-lowest/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-label font-bold tracking-[0.25em] uppercase text-outline/50">Optional Details</span>
                  <div className="flex-1 h-px bg-outline-variant/20" />
                </div>

                {/* Schedule */}
                <div className="flex items-start gap-6 text-sm">
                  <div className="w-28 text-outline/70 flex items-center gap-2.5 pt-1.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                    <CalendarIcon className="w-3.5 h-3.5" /> Schedule
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <DateTimePicker
                      startDate={modalStartDate}
                      endDate={modalEndDate}
                      isAllDay={modalIsAllDay}
                      timezone={modalTimezone}
                      reminderAt={modalReminderAt}
                      onChange={(updates) => {
                        setModalStartDate(updates.startDate);
                        setModalEndDate(updates.endDate);
                        setModalIsAllDay(updates.isAllDay ?? false);
                        setModalTimezone(updates.timezone);
                        setModalReminderAt(updates.reminderAt);
                      }}
                    />
                  </div>
                </div>

                {/* Repeat */}
                <div className="flex items-start gap-6 text-sm">
                  <div className="w-28 text-outline/70 flex items-center gap-2.5 pt-1.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                    <Repeat className="w-3.5 h-3.5" /> Repeat
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <select
                      value={modalRecurrence}
                      onChange={(e) => {
                        setModalRecurrence(e.target.value);
                        if (e.target.value !== 'weekly') setModalRecurrenceDays([]);
                      }}
                      className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 rounded-lg border-none transition-all duration-200 text-[10px] font-label font-bold tracking-[0.15em] uppercase focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom...</option>
                    </select>
                    
                    {modalRecurrence === 'custom' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col gap-3">
                          <span className="text-[8px] font-label font-bold tracking-[0.1em] uppercase text-outline/40">Select Occurrence Days</span>
                          <div className="flex gap-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                              const isSelected = modalRecurrenceDays.includes(idx);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setModalRecurrenceDays(prev => 
                                      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                                    );
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
                        </div>

                        <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="w-3 h-3 text-primary/40" />
                                <span className="text-[9px] font-label font-bold tracking-[0.05em] uppercase text-primary/60">Starting Date</span>
                            </div>
                            <span className="text-[10px] font-body font-medium text-primary">
                                {modalStartDate ? format(modalStartDate, 'MMMM d, yyyy') : 'No date set'}
                            </span>
                        </div>
                      </div>
                    )}

                    {modalRecurrence === 'weekly' && (
                      <div className="text-[9px] font-label font-bold tracking-[0.1em] uppercase text-outline/40 py-1 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary/40" />
                        Repeats every week on {modalStartDate ? format(modalStartDate, 'EEEE') : 'scheduled day'}
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
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value as any)}
                      className="bg-surface-container-low hover:bg-surface-container-high px-4 py-2.5 rounded-lg border-none transition-all duration-200 text-[10px] font-label font-bold tracking-[0.15em] uppercase focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                    <Flag className="w-3.5 h-3.5" /> Priority
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    {[
                      { value: 0, label: 'None', color: 'text-outline/40' },
                      { value: 1, label: 'Low', color: 'text-info' },
                      { value: 2, label: 'Medium', color: 'text-warning' },
                      { value: 3, label: 'High', color: 'text-error' },
                    ].map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setModalPriority(p.value)}
                        className={cn(
                          "p-2.5 rounded-full transition-all duration-200 hover:bg-surface-container-low active:scale-90",
                          modalPriority === p.value ? "bg-surface-container-high shadow-sm scale-110" : ""
                        )}
                        title={p.label}
                      >
                        <Flag className={cn("w-4 h-4", p.color, modalPriority === p.value ? "fill-current" : "")} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quadrant */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="w-28 text-outline/70 flex items-center gap-2.5 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                    <LayoutDashboard className="w-3.5 h-3.5" /> Quadrant
                  </div>
                  <div className="flex-1">
                    <select
                      value={modalQuadrant || 'none'}
                      onChange={(e) => setModalQuadrant(e.target.value === 'none' ? null : e.target.value)}
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

                {/* Description / Context & Notes */}
                <div className="flex items-start gap-6 text-sm">
                  <div className="w-28 text-outline/70 flex items-center gap-2.5 pt-2 font-label font-bold text-[9px] tracking-[0.15em] uppercase shrink-0">
                    <AlignLeft className="w-3.5 h-3.5" /> Notes
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={modalDescription}
                      onChange={(e) => setModalDescription(e.target.value)}
                      placeholder="Add context, details, or notes for this objective..."
                      rows={4}
                      className="w-full bg-surface-container-low/50 hover:bg-surface-container-high/50 border border-outline-variant/10 focus:border-primary/20 rounded-xl px-5 py-4 font-body text-[14px] leading-relaxed placeholder:text-outline/30 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-primary/10 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-outline-variant/10 flex items-center justify-end gap-4 bg-white">
                <button
                  onClick={handleCloseAddModal}
                  className="px-6 py-3 text-[10px] font-label font-bold tracking-[0.15em] uppercase text-outline/60 hover:text-primary hover:bg-primary/5 rounded-xl transition-all duration-200 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalAddTask}
                  disabled={!modalTaskTitle.trim()}
                  className={cn(
                    "px-8 py-3 text-[10px] font-label font-bold tracking-[0.2em] uppercase rounded-xl transition-all duration-200 shadow-md active:scale-95",
                    modalTaskTitle.trim()
                      ? "bg-primary text-on-primary hover:bg-primary/90"
                      : "bg-outline-variant/20 text-outline/40 cursor-not-allowed shadow-none"
                  )}
                >
                  Create Objective
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away for filter dropdowns */}
      {(isFilterOpen || isUpcomingFilterOpen) && (
        <div className="fixed inset-0 z-20" onClick={() => { setIsFilterOpen(false); setIsUpcomingFilterOpen(false); }} />
      )}
    </div>
  );
}
