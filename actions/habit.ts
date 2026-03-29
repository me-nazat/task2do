'use server';

import { db } from '@/db';
import { DatabaseActionResult, errorResult, okResult } from '@/db/errors';
import { habits, habitLogs } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

type HabitWithLogs = typeof habits.$inferSelect & {
  logs: typeof habitLogs.$inferSelect[];
};

export async function getHabits(userId: string): Promise<DatabaseActionResult<HabitWithLogs[]>> {
  try {
    const allHabits = await db.select().from(habits).where(eq(habits.userId, userId));
    const habitIds = allHabits.map(h => h.id);
    
    if (habitIds.length === 0) return okResult([]);

    const allLogs = await db.select().from(habitLogs).where(inArray(habitLogs.habitId, habitIds));
    
    return okResult(allHabits.map(habit => ({
      ...habit,
      logs: allLogs.filter(log => log.habitId === habit.id)
    })));
  } catch (error) {
    console.error('Failed to get habits', error);
    return errorResult(error);
  }
}

export async function createHabit(data: { name: string; frequency: string; userId: string }): Promise<DatabaseActionResult<string>> {
  try {
    const id = uuidv4();
    
    await db.insert(habits).values({
      id,
      userId: data.userId,
      name: data.name,
      frequency: data.frequency,
      createdAt: new Date(),
    });
    
    revalidatePath('/');
    return okResult(id);
  } catch (error) {
    console.error('Failed to create habit', error);
    return errorResult(error);
  }
}

export async function toggleHabitLog(habitId: string, date: string, status: string): Promise<DatabaseActionResult<null>> {
  try {
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
    return okResult(null);
  } catch (error) {
    console.error('Failed to toggle habit log', error);
    return errorResult(error);
  }
}
