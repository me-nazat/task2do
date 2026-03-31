import type { List, Task } from '@/store/useStore';

export const DEMO_TASK2DO_USER = {
  id: 'demo-nazat',
  email: 'nazatal619@gmail.com',
  displayName: 'Nazat',
};

export function createDemoLists(): List[] {
  const createdAt = new Date('2026-03-01T09:00:00.000Z');

  return [
    {
      id: 'list-deep-work',
      userId: DEMO_TASK2DO_USER.id,
      name: 'Deep Work',
      color: '#6e56cf',
      isDefault: false,
      createdAt,
    },
    {
      id: 'list-health',
      userId: DEMO_TASK2DO_USER.id,
      name: 'Health',
      color: '#16a34a',
      isDefault: false,
      createdAt,
    },
    {
      id: 'list-family',
      userId: DEMO_TASK2DO_USER.id,
      name: 'Family',
      color: '#f97316',
      isDefault: false,
      createdAt,
    },
  ];
}

export function createDemoTasks(): Task[] {
  return [
    {
      id: 'task-demo-1',
      title: 'Draft April study plan',
      isCompleted: false,
      priority: 2,
      startDate: new Date('2026-03-31T10:00:00.000Z'),
      endDate: null,
      isAllDay: false,
      listId: 'list-deep-work',
      description: 'Map weekly targets for RUET coursework and the portfolio sprint.',
      quadrant: 'not-urgent-important',
      parentId: null,
      timezone: 'Asia/Dhaka',
      reminderAt: new Date('2026-03-31T09:30:00.000Z'),
      status: 'todo',
      recurrence: null,
    },
    {
      id: 'task-demo-2',
      title: 'Sunday football at 4pm',
      isCompleted: false,
      priority: 1,
      startDate: new Date('2026-04-05T10:00:00.000Z'),
      endDate: new Date('2026-04-05T12:00:00.000Z'),
      isAllDay: false,
      listId: 'list-health',
      description: 'Book the ground and ping the group chat.',
      quadrant: 'not-urgent-important',
      parentId: null,
      timezone: 'Asia/Dhaka',
      reminderAt: new Date('2026-04-05T09:00:00.000Z'),
      status: 'todo',
      recurrence: null,
    },
    {
      id: 'task-demo-3',
      title: 'Reply to Pocket Tracker product notes',
      isCompleted: false,
      priority: 3,
      startDate: new Date('2026-03-31T15:00:00.000Z'),
      endDate: null,
      isAllDay: false,
      listId: null,
      description: 'Turn the comments into a clean action plan before dinner.',
      quadrant: 'urgent-important',
      parentId: null,
      timezone: 'Asia/Dhaka',
      reminderAt: new Date('2026-03-31T14:30:00.000Z'),
      status: 'in-progress',
      recurrence: null,
    },
    {
      id: 'task-demo-4',
      title: 'Call Ammu',
      isCompleted: true,
      priority: 0,
      startDate: new Date('2026-03-30T14:00:00.000Z'),
      endDate: null,
      isAllDay: false,
      listId: 'list-family',
      description: 'Confirm Friday lunch timing.',
      quadrant: null,
      parentId: null,
      timezone: 'Asia/Dhaka',
      reminderAt: null,
      status: 'done',
      recurrence: null,
    },
  ];
}
