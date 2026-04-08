'use server';

import { revalidatePath } from 'next/cache';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/db';
import { DatabaseActionResult, errorResult, okResult } from '@/db/errors';
import { customSchedules, users } from '@/db/schema';

async function ensureCustomSchedulesTable() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS custom_schedules (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      label text NOT NULL,
      start_date integer NOT NULL,
      end_date integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

export async function getCustomSchedules(
  userId: string
): Promise<DatabaseActionResult<typeof customSchedules.$inferSelect[]>> {
  try {
    await ensureCustomSchedulesTable();
    const data = await db
      .select()
      .from(customSchedules)
      .where(eq(customSchedules.userId, userId))
      .orderBy(desc(customSchedules.createdAt));
    return okResult(data);
  } catch (error) {
    console.error('Failed to get custom schedules:', error);
    return errorResult(error);
  }
}

export async function createCustomSchedule(data: {
  userId: string;
  label: string;
  startDate: Date;
  endDate: Date;
}): Promise<DatabaseActionResult<typeof customSchedules.$inferSelect>> {
  try {
    await ensureCustomSchedulesTable();

    const existingUser = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: data.userId,
        email: 'user@example.com',
        name: 'User',
        createdAt: new Date(),
      });
    }

    const now = new Date();
    const schedule = {
      id: uuidv4(),
      userId: data.userId,
      label: data.label,
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: now,
      updatedAt: now,
    } satisfies typeof customSchedules.$inferInsert;

    await db.insert(customSchedules).values(schedule);
    revalidatePath('/');

    return okResult(schedule);
  } catch (error) {
    console.error('Failed to create custom schedule', error);
    return errorResult(error);
  }
}

export async function deleteCustomSchedule(id: string): Promise<DatabaseActionResult<null>> {
  try {
    await ensureCustomSchedulesTable();
    await db.delete(customSchedules).where(eq(customSchedules.id, id));
    revalidatePath('/');
    return okResult(null);
  } catch (error) {
    console.error('Failed to delete custom schedule', error);
    return errorResult(error);
  }
}
