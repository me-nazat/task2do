import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
console.log('TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL);

import { db } from '../db';
import { tasks, lists, habits, habitLogs, users } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { addDays, subDays, format } from 'date-fns';

async function seed() {
  console.log('Seeding database...');

  const userId = 'user_2b1c3d4e5f6g7h8i9j0k'; // Replace with a valid user ID if needed, or just use a dummy one for testing

  // 0. Create User
  try {
    await db.insert(users).values({
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
    });
    console.log('Created user.');
  } catch (e) {
    console.log('User already exists, skipping.');
  }

  // 1. Create Lists
  const listIds = [uuidv4(), uuidv4(), uuidv4()];
  await db.insert(lists).values([
    { id: listIds[0], userId, name: 'Work Projects', color: '#4285F4', createdAt: new Date() },
    { id: listIds[1], userId, name: 'Personal Goals', color: '#34A853', createdAt: new Date() },
    { id: listIds[2], userId, name: 'Groceries', color: '#FBBC05', createdAt: new Date() },
  ]);
  console.log('Created lists.');

  // 2. Create Tasks
  const today = new Date();
  const taskData = [
    // Inbox (no list, no date)
    { id: uuidv4(), userId, title: 'Review Q3 Marketing Strategy', description: 'Read through the document and leave comments.', isCompleted: false, priority: 3, quadrant: 'urgent-important', createdAt: today, updatedAt: today },
    { id: uuidv4(), userId, title: 'Call Mom', description: 'Catch up on weekend plans.', isCompleted: false, priority: 2, quadrant: 'not-urgent-important', createdAt: today, updatedAt: today },
    
    // Today
    { id: uuidv4(), userId, listId: listIds[0], title: 'Finish Q4 Report', description: 'Compile data from all departments.', isCompleted: false, priority: 3, startDate: today, quadrant: 'urgent-important', createdAt: today, updatedAt: today },
    { id: uuidv4(), userId, listId: listIds[1], title: 'Gym Session', description: 'Leg day.', isCompleted: true, priority: 1, startDate: today, quadrant: 'not-urgent-important', createdAt: today, updatedAt: today },
    { id: uuidv4(), userId, listId: listIds[2], title: 'Buy Milk', description: '2% milk.', isCompleted: false, priority: 1, startDate: today, quadrant: 'not-urgent-not-important', createdAt: today, updatedAt: today },

    // Upcoming
    { id: uuidv4(), userId, listId: listIds[0], title: 'Team Sync', description: 'Weekly sync with the dev team.', isCompleted: false, priority: 2, startDate: addDays(today, 2), quadrant: 'not-urgent-important', createdAt: today, updatedAt: today },
    { id: uuidv4(), userId, listId: listIds[1], title: 'Read 50 pages', description: 'Finish the current book.', isCompleted: false, priority: 1, startDate: addDays(today, 1), quadrant: 'not-urgent-important', createdAt: today, updatedAt: today },
    
    // Overdue
    { id: uuidv4(), userId, listId: listIds[0], title: 'Submit Expense Report', description: 'For the trip to NY.', isCompleted: false, priority: 3, startDate: subDays(today, 3), quadrant: 'urgent-important', createdAt: today, updatedAt: today },

    // Matrix specific
    { id: uuidv4(), userId, title: 'Urgent Client Email', description: 'Reply to Smith regarding the outage.', isCompleted: false, priority: 3, quadrant: 'urgent-important', createdAt: today, updatedAt: today },
    { id: uuidv4(), userId, title: 'Plan Vacation', description: 'Look at flights to Japan.', isCompleted: false, priority: 2, quadrant: 'not-urgent-important', createdAt: today, updatedAt: today },
    { id: uuidv4(), userId, title: 'Approve Timesheets', description: 'For the contractors.', isCompleted: false, priority: 1, quadrant: 'urgent-not-important', createdAt: today, updatedAt: today },
    { id: uuidv4(), userId, title: 'Browse Social Media', description: 'Doomscrolling.', isCompleted: false, priority: 1, quadrant: 'not-urgent-not-important', createdAt: today, updatedAt: today },
  ];

  await db.insert(tasks).values(taskData);
  console.log('Created tasks.');

  // 3. Create Habits
  const habitIds = [uuidv4(), uuidv4(), uuidv4()];
  await db.insert(habits).values([
    { id: habitIds[0], userId, name: 'Drink Water', frequency: 'daily', createdAt: today },
    { id: habitIds[1], userId, name: 'Read 30 mins', frequency: 'daily', createdAt: today },
    { id: habitIds[2], userId, name: 'Meditate', frequency: 'daily', createdAt: today },
  ]);
  console.log('Created habits.');

  // 4. Create Habit Logs
  const logs = [];
  for (let i = 0; i < 7; i++) {
    const date = format(subDays(today, i), 'yyyy-MM-dd');
    
    // Habit 1: mostly completed
    if (i !== 2) {
      logs.push({ id: uuidv4(), habitId: habitIds[0], date, status: 'completed' });
    }
    
    // Habit 2: half completed
    if (i % 2 === 0) {
      logs.push({ id: uuidv4(), habitId: habitIds[1], date, status: 'completed' });
    }

    // Habit 3: rarely completed
    if (i === 1 || i === 5) {
      logs.push({ id: uuidv4(), habitId: habitIds[2], date, status: 'completed' });
    }
  }

  await db.insert(habitLogs).values(logs);
  console.log('Created habit logs.');

  console.log('Seeding complete!');
}

seed().catch(console.error);
