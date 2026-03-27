'use client';

import * as React from 'react';
import { format, setHours, setMinutes, startOfDay, endOfDay, subMinutes, subHours, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Globe, ChevronDown, Bell } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import * as Popover from '@radix-ui/react-popover';
import * as Select from '@radix-ui/react-select';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Label from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

interface DateTimePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  isAllDay: boolean | null;
  timezone: string | null;
  reminderAt: Date | null;
  onChange: (updates: {
    startDate: Date | null;
    endDate: Date | null;
    isAllDay: boolean | null;
    timezone: string | null;
    reminderAt: Date | null;
  }) => void;
}

export function DateTimePicker({
  startDate,
  endDate,
  isAllDay,
  timezone,
  reminderAt,
  onChange,
}: DateTimePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(startDate || undefined);
  const [startTime, setStartTime] = React.useState(startDate ? format(startDate, 'HH:mm') : '09:00');
  const [endTime, setEndTime] = React.useState(endDate ? format(endDate, 'HH:mm') : '10:00');

  const [reminderOffset, setReminderOffset] = React.useState<number | null>(() => {
    if (startDate && reminderAt) {
      return Math.round((startDate.getTime() - reminderAt.getTime()) / 60000);
    }
    return null;
  });

  const timeOptions = Array.from({ length: 48 }).map((_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    const time = `${hour.toString().padStart(2, '0')}:${minute}`;
    return time;
  });

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
  ];

  const reminderOptions = [
    { label: 'None', value: null },
    { label: 'At time of event', value: 0 },
    { label: '5 minutes before', value: 5 },
    { label: '10 minutes before', value: 10 },
    { label: '15 minutes before', value: 15 },
    { label: '30 minutes before', value: 30 },
    { label: '1 hour before', value: 60 },
    { label: '2 hours before', value: 120 },
    { label: '1 day before', value: 1440 },
  ];

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      updateDates(newDate, startTime, endTime, isAllDay || false, reminderOffset);
    } else {
      onChange({ startDate: null, endDate: null, isAllDay: null, timezone: null, reminderAt: null });
    }
  };

  const updateDates = (baseDate: Date, start: string, end: string, allDay: boolean, offset: number | null) => {
    if (allDay) {
      const newStartDate = startOfDay(baseDate);
      onChange({
        startDate: newStartDate,
        endDate: endOfDay(baseDate),
        isAllDay: true,
        timezone: timezone,
        reminderAt: offset !== null ? subMinutes(newStartDate, offset) : null,
      });
      return;
    }

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const newStartDate = setMinutes(setHours(baseDate, startH), startM);
    const newEndDate = setMinutes(setHours(baseDate, endH), endM);

    onChange({
      startDate: newStartDate,
      endDate: newEndDate,
      isAllDay: false,
      timezone: timezone,
      reminderAt: offset !== null ? subMinutes(newStartDate, offset) : null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Picker */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 text-sm bg-muted/30 hover:bg-muted/50 rounded-full transition-colors border border-transparent hover:border-border/30">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              {date ? format(date, 'PPP') : 'Pick a date'}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="z-50 bg-popover text-popover-foreground p-4 rounded-3xl border shadow-xl animate-in fade-in zoom-in-95" sideOffset={8}>
              <DayPicker
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                className="p-0 m-0"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-full transition-colors",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                  day_hidden: "invisible",
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Time Selection (only if not all day) */}
        {!isAllDay && date && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/30 hover:bg-muted/50 px-3 py-2 rounded-full border border-transparent transition-colors">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <select
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  updateDates(date, e.target.value, endTime, false, reminderOffset);
                }}
                className="bg-transparent border-none focus:outline-none text-sm cursor-pointer"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-muted-foreground mx-1">-</span>
              <select
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  updateDates(date, startTime, e.target.value, false, reminderOffset);
                }}
                className="bg-transparent border-none focus:outline-none text-sm cursor-pointer"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Timezone */}
        {!isAllDay && date && (
          <div className="flex items-center gap-1 bg-muted/30 hover:bg-muted/50 px-3 py-2 rounded-full border border-transparent transition-colors">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <select
              value={timezone || 'UTC'}
              onChange={(e) => {
                onChange({ startDate, endDate, isAllDay, timezone: e.target.value, reminderAt });
              }}
              className="bg-transparent border-none focus:outline-none text-sm cursor-pointer max-w-[100px] truncate"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reminder */}
        {date && (
          <div className="flex items-center gap-1 bg-muted/30 hover:bg-muted/50 px-3 py-2 rounded-full border border-transparent transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <select
              value={reminderOffset === null ? 'null' : reminderOffset.toString()}
              onChange={(e) => {
                const val = e.target.value === 'null' ? null : parseInt(e.target.value, 10);
                setReminderOffset(val);
                updateDates(date, startTime, endTime, isAllDay || false, val);
              }}
              className="bg-transparent border-none focus:outline-none text-sm cursor-pointer max-w-[120px] truncate"
            >
              {reminderOptions.map((opt) => (
                <option key={opt.label} value={opt.value === null ? 'null' : opt.value.toString()}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* All Day Toggle */}
      {date && (
        <div className="flex items-center space-x-2">
          <Checkbox.Root
            id="all-day"
            checked={isAllDay || false}
            onCheckedChange={(checked) => {
              const isChecked = checked === true;
              updateDates(date, startTime, endTime, isChecked, reminderOffset);
            }}
            className="flex h-4 w-4 items-center justify-center rounded border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          >
            <Checkbox.Indicator>
              <ChevronDown className="h-3 w-3" />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <Label.Root htmlFor="all-day" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground">
            All day
          </Label.Root>
        </div>
      )}
    </div>
  );
}
