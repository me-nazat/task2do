'use server';

import { db } from '@/db';
import { lists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getLists(userId: string) {
  try {
    return await db.select().from(lists).where(eq(lists.userId, userId)).orderBy(lists.createdAt);
  } catch (error) {
    console.error('Failed to get lists', error);
    return [];
  }
}

export async function createList(name: string, userId: string, color?: string) {
  try {
    const id = uuidv4();

    await db.insert(lists).values({
      id,
      userId,
      name,
      color: color || '#3b82f6',
      createdAt: new Date(),
    });

    revalidatePath('/');
    return id;
  } catch (error) {
    console.error('Failed to create list', error);
    throw error;
  }
}

export async function deleteList(id: string) {
  try {
    await db.delete(lists).where(eq(lists.id, id));
    revalidatePath('/');
  } catch (error) {
    console.error('Failed to delete list', error);
    throw error;
  }
}
