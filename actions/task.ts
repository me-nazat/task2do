'use server';

import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getTasks(userId: string) {
  try {
    return await db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(tasks.createdAt);
  } catch (error) {
    console.error('Failed to get tasks', error);
    return [];
  }
}

export async function createTask(data: { title: string; listId?: string; startDate?: Date; endDate?: Date; isAllDay?: boolean; parentId?: string; quadrant?: string; priority?: number; status?: string; reminderAt?: Date; userId: string }) {
  try {
    const id = uuidv4();
    const { userId, ...taskData } = data;
    
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
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      isAllDay: data.isAllDay || false,
      parentId: data.parentId || null,
      quadrant: data.quadrant || null,
      priority: data.priority ?? 0,
      status: (data.status as any) || 'todo',
      reminderAt: data.reminderAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/');
    return id;
  } catch (error) {
    console.error('Failed to create task', error);
    throw error;
  }
}

export async function updateTask(id: string, data: Partial<typeof tasks.$inferInsert>) {
  try {
    const smartLists = ['inbox', 'today', 'upcoming', 'someday', 'matrix'];
    const updateData = { ...data, updatedAt: new Date() };
    
    if (updateData.listId && smartLists.includes(updateData.listId)) {
      updateData.listId = null;
    }

    await db.update(tasks).set(updateData).where(eq(tasks.id, id));
    revalidatePath('/');
  } catch (error) {
    console.error('Failed to update task', error);
    throw error;
  }
}

export async function deleteTask(id: string) {
  try {
    await db.delete(tasks).where(eq(tasks.id, id));
    revalidatePath('/');
  } catch (error) {
    console.error('Failed to delete task', error);
    throw error;
  }
}
