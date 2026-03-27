import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  color: text('color'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  listId: text('list_id').references(() => lists.id),
  title: text('title').notNull(),
  description: text('description'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
  priority: integer('priority').default(0), // 0: None, 1: Low, 2: Medium, 3: High
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  isAllDay: integer('is_all_day', { mode: 'boolean' }).default(false),
  timezone: text('timezone'),
  reminderAt: integer('reminder_at', { mode: 'timestamp' }),
  status: text('status').default('todo'), // 'todo', 'in-progress', 'done'
  quadrant: text('quadrant'), // 'urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'
  parentId: text('parent_id'), // Self-referencing for subtasks
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  color: text('color'),
});

export const taskTags = sqliteTable('task_tags', {
  taskId: text('task_id').notNull().references(() => tasks.id),
  tagId: text('tag_id').notNull().references(() => tags.id),
});

export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  frequency: text('frequency').notNull(), // e.g., 'daily', 'weekly'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const habitLogs = sqliteTable('habit_logs', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull().references(() => habits.id),
  date: text('date').notNull(), // YYYY-MM-DD
  status: text('status').notNull(), // 'completed', 'skipped', 'failed'
});
