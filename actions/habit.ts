'use server';

import { db } from '@/db';
import { habits, habitLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

export async function getHabits() {
  const allHabits = await db.select().from(habits);
  const allLogs = await db.select().from(habitLogs);
  
  return allHabits.map(habit => ({
    ...habit,
    logs: allLogs.filter(log => log.habitId === habit.id)
  }));
}

export async function createHabit(data: { name: string; frequency: string }) {
  const id = uuidv4();
  const userId = 'user_1'; // Dummy user
  
  await db.insert(habits).values({
    id,
    userId,
    name: data.name,
    frequency: data.frequency,
    createdAt: new Date(),
  });
  
  revalidatePath('/');
  return id;
}

export async function toggleHabitLog(habitId: string, date: string, status: string) {
  const existing = await db.select().from(habitLogs).where(
    and(
      eq(habitLogs.habitId, habitId),
      eq(habitLogs.date, date)
    )
  ).limit(1);
  
  if (existing.length > 0) {
    if (existing[0].status === status) {
      await db.delete(habitLogs).where(eq(habitLogs.id, existing[0].id));
    } else {
      await db.update(habitLogs).set({ status }).where(eq(habitLogs.id, existing[0].id));
    }
  } else {
    await db.insert(habitLogs).values({
      id: uuidv4(),
      habitId,
      date,
      status,
    });
  }
  
  revalidatePath('/');
}
