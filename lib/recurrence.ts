import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  format,
  getDay,
  isSameDay,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import { Task } from '@/store/useStore';

export interface RecurrenceOccurrence {
  date: Date;
  occurrenceKey: string;
  time?: string;
  isBaseOccurrence: boolean;
  isCompleted: boolean;
  isDeleted: boolean;
}

interface OccurrenceQueryOptions {
  includeCompleted?: boolean;
  includeDeleted?: boolean;
}

const DEFAULT_LOOKAHEAD_YEARS = 2;

const normalizeDate = (value: Date | string | number | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const applyTimeFromSource = (targetDay: Date, sourceDate: Date) =>
  setMilliseconds(
    setSeconds(
      setMinutes(setHours(targetDay, sourceDate.getHours()), sourceDate.getMinutes()),
      sourceDate.getSeconds()
    ),
    sourceDate.getMilliseconds()
  );

const parseOccurrenceSet = (value: string | null | undefined) => {
  if (!value) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    );
  } catch (error) {
    console.error('Failed to parse occurrence exception set', error);
    return new Set<string>();
  }
};

export const serializeOccurrenceSet = (occurrenceKeys: Iterable<string>) => {
  const values = Array.from(new Set(occurrenceKeys)).sort();
  return values.length > 0 ? JSON.stringify(values) : null;
};

const updateOccurrenceSet = (
  value: string | null | undefined,
  occurrenceKey: string,
  enabled: boolean
) => {
  const next = parseOccurrenceSet(value);

  if (enabled) {
    next.add(occurrenceKey);
  } else {
    next.delete(occurrenceKey);
  }

  return serializeOccurrenceSet(next);
};

export const isTaskRecurring = (task: Task) => Boolean(task.recurrence && task.recurrence !== 'none');

export const getOccurrenceKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const isTaskOccurrenceDeleted = (task: Task, occurrenceDate: Date | string) => {
  if (!isTaskRecurring(task)) {
    return false;
  }

  const occurrenceKey = typeof occurrenceDate === 'string' ? occurrenceDate : getOccurrenceKey(occurrenceDate);
  return parseOccurrenceSet(task.deletedOccurrences).has(occurrenceKey);
};

export const isTaskOccurrenceCompleted = (task: Task, occurrenceDate: Date | string) => {
  const occurrenceKey = typeof occurrenceDate === 'string' ? occurrenceDate : getOccurrenceKey(occurrenceDate);

  if (!isTaskRecurring(task)) {
    return Boolean(task.isCompleted);
  }

  const baseStart = normalizeDate(task.startDate);
  const baseKey = baseStart ? getOccurrenceKey(baseStart) : null;

  if (parseOccurrenceSet(task.completedOccurrences).has(occurrenceKey)) {
    return true;
  }

  return Boolean(baseKey && baseKey === occurrenceKey && task.isCompleted);
};

const shouldIncludeOccurrence = (
  occurrence: RecurrenceOccurrence,
  options: OccurrenceQueryOptions
) => {
  if (occurrence.isDeleted && !options.includeDeleted) {
    return false;
  }

  if (occurrence.isCompleted && !options.includeCompleted) {
    return false;
  }

  return true;
};

export function getTaskOccurrences(
  task: Task,
  rangeStart: Date,
  rangeEnd: Date,
  options: OccurrenceQueryOptions = {}
): RecurrenceOccurrence[] {
  const resolvedOptions = {
    includeCompleted: true,
    includeDeleted: false,
    ...options,
  };

  const taskStart = normalizeDate(task.startDate);
  if (!taskStart) {
    return [];
  }

  const occurrences: RecurrenceOccurrence[] = [];
  const startDay = startOfDay(taskStart);
  const baseKey = getOccurrenceKey(taskStart);

  const addOccurrence = (date: Date, time?: string) => {
    const occurrence: RecurrenceOccurrence = {
      date,
      time,
      occurrenceKey: getOccurrenceKey(date),
      isBaseOccurrence: getOccurrenceKey(date) === baseKey,
      isCompleted: isTaskOccurrenceCompleted(task, date),
      isDeleted: isTaskOccurrenceDeleted(task, date),
    };

    if (shouldIncludeOccurrence(occurrence, resolvedOptions)) {
      occurrences.push(occurrence);
    }
  };

  if (taskStart >= rangeStart && taskStart <= rangeEnd) {
    addOccurrence(taskStart);
  }

  const recurrence = task.recurrence;
  if (!recurrence || recurrence === 'none') {
    return occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const maybeAddRecurringOccurrence = (date: Date, time?: string) => {
    if (date <= taskStart || date < rangeStart || date > rangeEnd) {
      return;
    }

    addOccurrence(date, time);
  };

  if (recurrence === 'daily') {
    let currentDay = addDays(startDay, 1);
    while (currentDay <= rangeEnd) {
      maybeAddRecurringOccurrence(applyTimeFromSource(currentDay, taskStart));
      currentDay = addDays(currentDay, 1);
    }
  } else if (recurrence.startsWith('weekly:')) {
    const allowedDays = recurrence
      .split(':')[1]
      .split(',')
      .map((entry) => Number(entry))
      .filter((entry) => !Number.isNaN(entry));

    let currentDay = addDays(startDay, 1);
    while (currentDay <= rangeEnd) {
      if (allowedDays.includes(getDay(currentDay))) {
        maybeAddRecurringOccurrence(applyTimeFromSource(currentDay, taskStart));
      }
      currentDay = addDays(currentDay, 1);
    }
  } else if (recurrence === 'weekly') {
    let currentDay = addWeeks(startDay, 1);
    while (currentDay <= rangeEnd) {
      maybeAddRecurringOccurrence(applyTimeFromSource(currentDay, taskStart));
      currentDay = addWeeks(currentDay, 1);
    }
  } else if (recurrence === 'monthly') {
    let currentDay = addMonths(startDay, 1);
    while (currentDay <= rangeEnd) {
      maybeAddRecurringOccurrence(applyTimeFromSource(currentDay, taskStart));
      currentDay = addMonths(currentDay, 1);
    }
  } else if (recurrence.startsWith('custom:')) {
    try {
      const config = JSON.parse(recurrence.slice(7));
      const allowedDays = Array.isArray(config.days) ? config.days : [];
      const perDayTimes = typeof config.times === 'object' && config.times ? config.times : {};

      let currentDay = addDays(startDay, 1);
      while (currentDay <= rangeEnd) {
        const dayIndex = getDay(currentDay);
        if (allowedDays.includes(dayIndex)) {
          const time = perDayTimes[dayIndex.toString()];
          const occurrenceDate = typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)
            ? setMinutes(setHours(currentDay, Number(time.split(':')[0])), Number(time.split(':')[1]))
            : applyTimeFromSource(currentDay, taskStart);
          maybeAddRecurringOccurrence(occurrenceDate, typeof time === 'string' ? time : undefined);
        }
        currentDay = addDays(currentDay, 1);
      }
    } catch (error) {
      console.error('Failed to parse custom recurrence', error);
    }
  }

  return occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const getTaskOccurrenceForDate = (
  task: Task,
  date: Date,
  options: OccurrenceQueryOptions = {}
) =>
  getTaskOccurrences(task, startOfDay(date), endOfDay(date), options).find((occurrence) =>
    isSameDay(occurrence.date, date)
  ) ?? null;

export const getNextTaskOccurrence = (
  task: Task,
  rangeStart: Date,
  rangeEnd = endOfDay(addYears(rangeStart, DEFAULT_LOOKAHEAD_YEARS)),
  options: OccurrenceQueryOptions = {}
) => getTaskOccurrences(task, rangeStart, rangeEnd, options)[0] ?? null;

export const buildTaskCompletionUpdate = (
  task: Task,
  isCompleted: boolean,
  occurrenceDate?: Date | null
): Partial<Task> => {
  if (isTaskRecurring(task) && occurrenceDate) {
    const occurrenceKey = getOccurrenceKey(occurrenceDate);
    const baseStart = normalizeDate(task.startDate);
    const baseKey = baseStart ? getOccurrenceKey(baseStart) : null;

    return {
      completedOccurrences: updateOccurrenceSet(task.completedOccurrences, occurrenceKey, isCompleted),
      deletedOccurrences: updateOccurrenceSet(task.deletedOccurrences, occurrenceKey, false),
      ...(baseKey === occurrenceKey ? { isCompleted: false } : {}),
    };
  }

  return {
    isCompleted,
    status: isCompleted ? 'done' : (task.status === 'done' ? 'todo' : task.status),
  };
};

export const buildTaskOccurrenceDeleteUpdate = (
  task: Task,
  occurrenceDate: Date
): Partial<Task> => {
  const occurrenceKey = getOccurrenceKey(occurrenceDate);
  const baseStart = normalizeDate(task.startDate);
  const baseKey = baseStart ? getOccurrenceKey(baseStart) : null;

  return {
    deletedOccurrences: updateOccurrenceSet(task.deletedOccurrences, occurrenceKey, true),
    completedOccurrences: updateOccurrenceSet(task.completedOccurrences, occurrenceKey, false),
    ...(baseKey === occurrenceKey ? { isCompleted: false } : {}),
  };
};
