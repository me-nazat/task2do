'use server';

import { db } from '@/db';
import { DatabaseActionResult, errorResult, okResult } from '@/db/errors';
import { lists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getLists(userId: string): Promise<DatabaseActionResult<typeof lists.$inferSelect[]>> {
  try {
    const data = await db.select().from(lists).where(eq(lists.userId, userId)).orderBy(lists.createdAt);
    return okResult(data);
  } catch (error: any) {
    console.error('Failed to get lists:', error);
    return errorResult(error);
  }
}

export async function createList(name: string, userId: string, color?: string): Promise<DatabaseActionResult<string>> {
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
    return okResult(id);
  } catch (error) {
    console.error('Failed to create list', error);
    return errorResult(error);
  }
}

export async function deleteList(id: string): Promise<DatabaseActionResult<null>> {
  try {
    await db.delete(lists).where(eq(lists.id, id));
    revalidatePath('/');
    return okResult(null);
  } catch (error) {
    console.error('Failed to delete list', error);
    return errorResult(error);
  }
}
