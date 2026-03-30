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
    <div className="space-y-6 w-full max-w-full box-border">
      <div className="flex flex-wrap items-center gap-3 w-full max-w-full">
        {/* Date Picker */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="flex items-center gap-3 px-5 py-2.5 text-[13px] font-body font-medium bg-primary/5 hover:bg-primary/10 rounded-full transition-all border border-primary/5 hover:border-primary/20 text-primary">
              <CalendarIcon className="w-4 h-4 text-primary/60" />
              {date ? format(date, 'PPP') : 'Select Date'}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="z-50 bg-white p-6 rounded-3xl border border-outline-variant/10 shadow-2xl animate-in fade-in zoom-in-95" sideOffset={12}>
              <DayPicker
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                className="p-0 m-0"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-6",
                  caption: "flex justify-center pt-1 relative items-center mb-4",
                  caption_label: "text-[15px] font-headline font-medium italic text-primary",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-8 w-8 bg-primary/5 rounded-full p-0 opacity-60 hover:opacity-100 transition-all hover:bg-primary/10",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex",
                  head_cell: "text-outline/40 rounded-md w-10 font-body font-bold text-[10px] uppercase tracking-[0.1em]",
                  row: "flex w-full mt-2",
                  cell: "h-10 w-10 text-center text-[13px] p-0 relative focus-within:relative focus-within:z-20",
                  day: "h-10 w-10 p-0 font-body font-medium aria-selected:opacity-100 hover:bg-primary/5 hover:text-primary rounded-full transition-all",
                  day_selected: "bg-primary text-on-primary hover:bg-primary hover:text-on-primary focus:bg-primary focus:text-on-primary shadow-md",
                  day_today: "bg-primary/10 text-primary",
                  day_outside: "day-outside text-outline/20 opacity-50",
                  day_disabled: "text-outline/10 opacity-50",
                  day_hidden: "invisible",
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* Time Selection (only if not all day) */}
        {!isAllDay && date && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-full border border-primary/5 transition-all text-primary overflow-hidden">
              <Clock className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <select
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  updateDates(date, e.target.value, endTime, false, reminderOffset);
                }}
                className="bg-transparent border-none focus:outline-none text-[12px] font-body font-medium cursor-pointer appearance-none pr-0.5"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="text-primary/30 shrink-0">/</span>
              <select
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  updateDates(date, startTime, e.target.value, false, reminderOffset);
                }}
                className="bg-transparent border-none focus:outline-none text-[12px] font-body font-medium cursor-pointer appearance-none pr-0.5"
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
          <div className="flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-full border border-primary/5 transition-all text-primary overflow-hidden">
            <Globe className="w-3.5 h-3.5 text-primary/60 shrink-0" />
            <select
              value={timezone || 'UTC'}
              onChange={(e) => {
                onChange({ startDate, endDate, isAllDay, timezone: e.target.value, reminderAt });
              }}
              className="bg-transparent border-none focus:outline-none text-[12px] font-body font-medium cursor-pointer max-w-[80px] truncate appearance-none pr-0.5"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reminder */}
        {date && (
          <div className="flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-full border border-primary/5 transition-all text-primary overflow-hidden">
            <Bell className="w-3.5 h-3.5 text-primary/60 shrink-0" />
            <select
              value={reminderOffset === null ? 'null' : reminderOffset.toString()}
              onChange={(e) => {
                const val = e.target.value === 'null' ? null : parseInt(e.target.value, 10);
                setReminderOffset(val);
                updateDates(date, startTime, endTime, isAllDay || false, val);
              }}
              className="bg-transparent border-none focus:outline-none text-[13px] font-body font-medium cursor-pointer max-w-[140px] truncate appearance-none pr-1"
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
        <div className="flex items-center space-x-3 px-2">
          <Checkbox.Root
            id="all-day"
            checked={isAllDay || false}
            onCheckedChange={(checked) => {
              const isChecked = checked === true;
              updateDates(date, startTime, endTime, isChecked, reminderOffset);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-lg border border-primary/20 bg-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-on-primary"
          >
            <Checkbox.Indicator>
              <ChevronDown className="h-3.5 w-3.5" />
            </Checkbox.Indicator>
          </Checkbox.Root>
          <Label.Root htmlFor="all-day" className="text-[13px] font-body font-medium leading-none cursor-pointer text-primary/60 hover:text-primary transition-colors">
            All day event
          </Label.Root>
        </div>
      )}
    </div>
  );
}
