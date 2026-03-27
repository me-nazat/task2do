'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { isBefore, isAfter, subMinutes, addMinutes } from 'date-fns';

export function NotificationManager() {
  const { tasks } = useStore();

  useEffect(() => {
    // Request permission for notifications if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkReminders = () => {
      const now = new Date();
      
      tasks.forEach(task => {
        if (task.reminderAt && !task.isCompleted) {
          const reminderTime = new Date(task.reminderAt);
          // Check if the reminder time is within the last minute to avoid duplicate notifications
          // and ensure we don't miss it if the interval fires slightly off
          if (isBefore(reminderTime, now) && isAfter(reminderTime, subMinutes(now, 1))) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Task Reminder', {
                body: task.title,
                icon: '/favicon.ico', // You can add a custom icon
              });
            }
          }
        }
      });
    };

    // Check every minute
    const intervalId = setInterval(checkReminders, 60000);
    
    // Initial check
    checkReminders();

    return () => clearInterval(intervalId);
  }, [tasks]);

  return null; // This component doesn't render anything
}
