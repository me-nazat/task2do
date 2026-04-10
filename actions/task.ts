'use server';

import { db } from '@/db';
import { DatabaseActionResult, errorResult, okResult, toPublicDatabaseError } from '@/db/errors';
import { tasks, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getTasks(userId: string): Promise<DatabaseActionResult<typeof tasks.$inferSelect[]>> {
  try {
    const data = await db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(tasks.createdAt);
    return okResult(data);
  } catch (error: any) {
    console.error('Failed to get tasks:', error);
    return errorResult(error);
  }
}

export async function createTask(data: {
  title: string;
  listId?: string;
  startDate?: Date;
  endDate?: Date;
  isAllDay?: boolean;
  parentId?: string;
  quadrant?: string;
  priority?: number;
  status?: string;
  reminderAt?: Date;
  description?: string;
  timezone?: string;
  isCompleted?: boolean;
  userId: string;
  customScheduleId?: string;
  recurrence?: string;
  completedOccurrences?: string;
  deletedOccurrences?: string;
}): Promise<DatabaseActionResult<string>> {
  try {
    const id = uuidv4();
    const { userId } = data;
    
    // Ensure user exists
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: userId,
        email: 'user@example.com', // We don't have the email here easily, but we can update it later
        name: 'User',
        createdAt: new Date(),
      });
    }

    // Handle smart lists
    const smartLists = ['inbox', 'today', 'upcoming', 'someday', 'matrix'];
    const actualListId = data.listId && !smartLists.includes(data.listId) ? data.listId : null;
    
    await db.insert(tasks).values({
      id,
      userId,
      title: data.title,
      listId: actualListId,
      description: data.description || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      isAllDay: data.isAllDay || false,
      timezone: data.timezone || null,
      parentId: data.parentId || null,
      customScheduleId: data.customScheduleId || null,
      quadrant: data.quadrant || null,
      priority: data.priority ?? 0,
      isCompleted: data.isCompleted ?? data.status === 'done',
      status: (data.status as any) || 'todo',
      reminderAt: data.reminderAt || null,
      recurrence: data.recurrence || null,
      completedOccurrences: data.completedOccurrences || null,
      deletedOccurrences: data.deletedOccurrences || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/');
    return okResult(id);
  } catch (error) {
    console.error('Failed to create task', error);
    return errorResult(error);
  }
}

export async function updateTask(id: string, data: Partial<typeof tasks.$inferInsert>): Promise<DatabaseActionResult<null>> {
  try {
    const smartLists = ['inbox', 'today', 'upcoming', 'someday', 'matrix'];
    const updateData = { ...data, updatedAt: new Date() };
    
    if (updateData.listId && smartLists.includes(updateData.listId)) {
      updateData.listId = null;
    }

    await db.update(tasks).set(updateData).where(eq(tasks.id, id));
    revalidatePath('/');
    return okResult(null);
  } catch (error) {
    console.error('Failed to update task', error);
    return errorResult(error);
  }
}

export async function deleteTask(id: string): Promise<DatabaseActionResult<null>> {
  try {
    await db.delete(tasks).where(eq(tasks.id, id));
    revalidatePath('/');
    return okResult(null);
  } catch (error) {
    console.error('Failed to delete task', error);
    return errorResult(error);
  }
}
