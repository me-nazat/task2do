'use server';

import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getTasks() {
  return await db.select().from(tasks).orderBy(tasks.createdAt);
}

export async function createTask(data: { title: string; listId?: string; startDate?: Date; isAllDay?: boolean; parentId?: string; quadrant?: string }) {
  const id = uuidv4();
  // Using a dummy user ID for now since auth is not implemented
  const userId = 'user_1'; 
  
  // Ensure dummy user exists
  const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existingUser.length === 0) {
    await db.insert(users).values({
      id: userId,
      email: 'dummy@example.com',
      name: 'Dummy User',
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
    isAllDay: data.isAllDay || false,
    parentId: data.parentId || null,
    quadrant: data.quadrant || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath('/');
  return id;
}

export async function updateTask(id: string, data: Partial<typeof tasks.$inferInsert>) {
  const smartLists = ['inbox', 'today', 'upcoming', 'someday', 'matrix'];
  const updateData = { ...data, updatedAt: new Date() };
  
  if (updateData.listId && smartLists.includes(updateData.listId)) {
    updateData.listId = null;
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, id));
  revalidatePath('/');
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath('/');
}
