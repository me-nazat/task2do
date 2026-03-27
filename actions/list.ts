'use server';

import { db } from '@/db';
import { lists } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getLists() {
  return await db.select().from(lists).orderBy(lists.createdAt);
}

export async function createList(name: string, color?: string) {
  const id = uuidv4();
  const userId = 'user_1'; // Dummy user ID

  await db.insert(lists).values({
    id,
    userId,
    name,
    color: color || '#3b82f6',
    createdAt: new Date(),
  });

  revalidatePath('/');
  return id;
}

export async function deleteList(id: string) {
  await db.delete(lists).where(eq(lists.id, id));
  revalidatePath('/');
}
