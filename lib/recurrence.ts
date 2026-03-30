import { 
  addDays, 
  addWeeks, 
  addMonths, 
  isSameDay, 
  startOfDay, 
  setHours, 
  setMinutes,
  getDay,
  getDate
} from 'date-fns';
import { Task } from '@/store/useStore';

export interface RecurrenceOccurrence {
  date: Date;
  time?: string; // HH:mm format
}

export function getTaskOccurrences(task: Task, rangeStart: Date, rangeEnd: Date): RecurrenceOccurrence[] {
  if (!task.startDate) return [];
  
  const occurrences: RecurrenceOccurrence[] = [];
  const taskStart = new Date(task.startDate);
  const startDay = startOfDay(taskStart);
  
  // If the task itself is within the range, add it
  if (taskStart >= rangeStart && taskStart <= rangeEnd) {
    occurrences.push({ date: taskStart });
  }

  const recurrence = task.recurrence;
  if (!recurrence || recurrence === 'none') return occurrences;

  // Helper to add occurrence if within range
  const addIfInRange = (date: Date, time?: string) => {
    if (date > taskStart && date >= rangeStart && date <= rangeEnd) {
      occurrences.push({ date, time });
    }
  };

  // 1. Simple Daily
  if (recurrence === 'daily') {
    let current = addDays(startDay, 1);
    while (current <= rangeEnd) {
      addIfInRange(current);
      current = addDays(current, 1);
    }
  }

  // 2. Simple Weekly (Legacy format: weekly:0,2,4)
  else if (recurrence.startsWith('weekly:')) {
    const daysStr = recurrence.split(':')[1];
    const allowedDays = daysStr.split(',').map(Number); // 0-6 (Sun-Sat)
    
    let current = addDays(startDay, 1);
    while (current <= rangeEnd) {
      if (allowedDays.includes(getDay(current))) {
        addIfInRange(current);
      }
      current = addDays(current, 1);
    }
  }
  
  // 3. Simple Weekly (No specific days, same day of week as start)
  else if (recurrence === 'weekly') {
    let current = addWeeks(startDay, 1);
    while (current <= rangeEnd) {
      addIfInRange(current);
      current = addWeeks(current, 1);
    }
  }

  // 4. Simple Monthly
  else if (recurrence === 'monthly') {
    let current = addMonths(startDay, 1);
    while (current <= rangeEnd) {
      // Logic for same day of month
      addIfInRange(current);
      current = addMonths(current, 1);
    }
  }

  // 5. Custom (JSON format: custom:{"days":[1,3],"times":{"1":"10:00","3":"14:00"}})
  else if (recurrence.startsWith('custom:')) {
    try {
      const config = JSON.parse(recurrence.slice(7));
      const allowedDays = config.days || [];
      const perDayTimes = config.times || {};

      let current = addDays(startDay, 1);
      while (current <= rangeEnd) {
        const dayIdx = getDay(current);
        if (allowedDays.includes(dayIdx)) {
          const time = perDayTimes[dayIdx.toString()];
          const occurrenceDate = time 
            ? setMinutes(setHours(current, parseInt(time.split(':')[0])), parseInt(time.split(':')[1]))
            : current;
          addIfInRange(occurrenceDate, time);
        }
        current = addDays(current, 1);
      }
    } catch (e) {
      console.error('Failed to parse custom recurrence', e);
    }
  }

  return occurrences;
}
