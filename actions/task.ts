'use server';

import { db } from '@/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getTasks() {
  return await db.select().from(tasks).orderBy(tasks.createdAt);
}

export async function createTask(data: { title: string; listId?: string; startDate?: Date; isAllDay?: boolean; parentId?: string }) {
  const id = uuidv4();
  // Using a dummy user ID for now since auth is not implemented
  const userId = 'user_1'; 
  
  await db.insert(tasks).values({
    id,
    userId,
    title: data.title,
    listId: data.listId || null,
    startDate: data.startDate || null,
    isAllDay: data.isAllDay || false,
    parentId: data.parentId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath('/');
  return id;
}

export async function updateTask(id: string, data: Partial<typeof tasks.$inferInsert>) {
  await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id));
  revalidatePath('/');
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath('/');
}
