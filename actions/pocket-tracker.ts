'use server';

import { v4 as uuidv4 } from 'uuid';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { DatabaseActionResult, errorResult, okResult } from '@/db/errors';
import {
  pocketTrackerBudgets,
  pocketTrackerTransactions,
  users,
} from '@/db/schema';
import type { FinanceBudget, FinanceTransaction, FinanceTransactionIcon, FinanceTransactionType } from '@/lib/finance/mock-data';
import {
  FINANCE_MONTH_LABEL,
  INITIAL_FINANCE_TRANSACTIONS,
  inferFinanceIcon,
} from '@/lib/finance/mock-data';

export interface PocketTrackerWorkspace {
  transactions: FinanceTransaction[];
  budgets: FinanceBudget[];
}

interface EnsureWorkspaceInput {
  userId: string;
  email?: string | null;
  name?: string | null;
}

interface CreatePocketTrackerTransactionInput extends EnsureWorkspaceInput {
  title: string;
  category: string;
  type: FinanceTransactionType;
  date: string;
  amount: number;
}

interface UpdatePocketTrackerTransactionInput {
  userId: string;
  transactionId: string;
  title?: string;
  category?: string;
  type?: FinanceTransactionType;
  date?: string;
  amount?: number;
}

interface CreatePocketTrackerBudgetInput extends EnsureWorkspaceInput {
  category: string;
  limit: number;
  periodLabel?: string;
}

interface UpdatePocketTrackerBudgetInput {
  userId: string;
  budgetId: string;
  category?: string;
  limit?: number;
  periodLabel?: string;
}

async function ensureUserExists({ userId, email, name }: EnsureWorkspaceInput) {
  const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (existingUser.length > 0) {
    return;
  }

  await db.insert(users).values({
    id: userId,
    email: email?.trim().toLowerCase() || `${userId}@pocket-tracker.local`,
    name: name?.trim() || 'Nazat',
    createdAt: new Date(),
  });
}

function toFinanceTransaction(record: typeof pocketTrackerTransactions.$inferSelect): FinanceTransaction {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    type: record.type as FinanceTransactionType,
    date: record.date,
    amount: record.amountCents / 100,
    icon: record.icon as FinanceTransactionIcon,
  };
}

function buildBudgetsWithSpent(
  budgetRows: Array<typeof pocketTrackerBudgets.$inferSelect>,
  transactions: FinanceTransaction[]
): FinanceBudget[] {
  return budgetRows.map((budget) => ({
    id: budget.id,
    category: budget.category,
    limit: budget.limitCents / 100,
    spent: transactions
      .filter((transaction) => transaction.type === 'expense' && transaction.category === budget.category)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    periodLabel: budget.periodLabel,
  }));
}

async function seedPocketTrackerData(userId: string) {
  const now = new Date();

  await db.insert(pocketTrackerTransactions).values(
    INITIAL_FINANCE_TRANSACTIONS.map((transaction) => ({
      id: transaction.id,
      userId,
      title: transaction.title,
      category: transaction.category,
      type: transaction.type,
      date: transaction.date,
      amountCents: Math.round(transaction.amount * 100),
      icon: transaction.icon,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

export async function getPocketTrackerWorkspace(
  input: EnsureWorkspaceInput
): Promise<DatabaseActionResult<PocketTrackerWorkspace>> {
  try {
    await ensureUserExists(input);

    let transactionRows = await db
      .select()
      .from(pocketTrackerTransactions)
      .where(eq(pocketTrackerTransactions.userId, input.userId))
      .orderBy(desc(pocketTrackerTransactions.date), desc(pocketTrackerTransactions.updatedAt));

    const budgetRows = await db
      .select()
      .from(pocketTrackerBudgets)
      .where(eq(pocketTrackerBudgets.userId, input.userId))
      .orderBy(desc(pocketTrackerBudgets.updatedAt));

    if (transactionRows.length === 0) {
      await seedPocketTrackerData(input.userId);
      transactionRows = await db
        .select()
        .from(pocketTrackerTransactions)
        .where(eq(pocketTrackerTransactions.userId, input.userId))
        .orderBy(desc(pocketTrackerTransactions.date), desc(pocketTrackerTransactions.updatedAt));
    }

    const transactions = transactionRows.map(toFinanceTransaction);
    const budgets = buildBudgetsWithSpent(budgetRows, transactions);

    return okResult({ transactions, budgets });
  } catch (error) {
    console.error('Failed to get pocket tracker workspace:', error);
    return errorResult(error);
  }
}

export async function createPocketTrackerTransaction(
  input: CreatePocketTrackerTransactionInput
): Promise<DatabaseActionResult<FinanceTransaction>> {
  try {
    await ensureUserExists(input);

    const id = uuidv4();
    const now = new Date();
    const icon = inferFinanceIcon(input.category);

    await db.insert(pocketTrackerTransactions).values({
      id,
      userId: input.userId,
      title: input.title.trim(),
      category: input.category,
      type: input.type,
      date: input.date,
      amountCents: Math.round(input.amount * 100),
      icon,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath('/pocket-tracker');
    return okResult({
      id,
      title: input.title.trim(),
      category: input.category,
      type: input.type,
      date: input.date,
      amount: input.amount,
      icon,
    });
  } catch (error) {
    console.error('Failed to create pocket tracker transaction:', error);
    return errorResult(error);
  }
}

export async function updatePocketTrackerTransaction(
  input: UpdatePocketTrackerTransactionInput
): Promise<DatabaseActionResult<FinanceTransaction>> {
  try {
    const existing = await db
      .select()
      .from(pocketTrackerTransactions)
      .where(eq(pocketTrackerTransactions.id, input.transactionId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Pocket Tracker transaction not found.');
    }

    const current = existing[0];
    const category = input.category ?? current.category;
    const nextRecord = {
      title: input.title?.trim() || current.title,
      category,
      type: input.type ?? (current.type as FinanceTransactionType),
      date: input.date ?? current.date,
      amountCents: Math.round((input.amount ?? current.amountCents / 100) * 100),
      icon: inferFinanceIcon(category),
      updatedAt: new Date(),
    };

    await db
      .update(pocketTrackerTransactions)
      .set(nextRecord)
      .where(eq(pocketTrackerTransactions.id, input.transactionId));

    revalidatePath('/pocket-tracker');
    return okResult({
      id: current.id,
      title: nextRecord.title,
      category: nextRecord.category,
      type: nextRecord.type,
      date: nextRecord.date,
      amount: nextRecord.amountCents / 100,
      icon: nextRecord.icon,
    });
  } catch (error) {
    console.error('Failed to update pocket tracker transaction:', error);
    return errorResult(error);
  }
}

export async function deletePocketTrackerTransaction(
  transactionId: string
): Promise<DatabaseActionResult<null>> {
  try {
    await db.delete(pocketTrackerTransactions).where(eq(pocketTrackerTransactions.id, transactionId));
    revalidatePath('/pocket-tracker');
    return okResult(null);
  } catch (error) {
    console.error('Failed to delete pocket tracker transaction:', error);
    return errorResult(error);
  }
}

export async function createPocketTrackerBudget(
  input: CreatePocketTrackerBudgetInput
): Promise<DatabaseActionResult<FinanceBudget>> {
  try {
    await ensureUserExists(input);

    const id = uuidv4();
    const now = new Date();
    const periodLabel = input.periodLabel || FINANCE_MONTH_LABEL;

    await db.insert(pocketTrackerBudgets).values({
      id,
      userId: input.userId,
      category: input.category,
      limitCents: Math.round(input.limit * 100),
      periodLabel,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath('/pocket-tracker');
    return okResult({
      id,
      category: input.category,
      limit: input.limit,
      spent: 0,
      periodLabel,
    });
  } catch (error) {
    console.error('Failed to create pocket tracker budget:', error);
    return errorResult(error);
  }
}

export async function updatePocketTrackerBudget(
  input: UpdatePocketTrackerBudgetInput
): Promise<DatabaseActionResult<FinanceBudget>> {
  try {
    const existing = await db
      .select()
      .from(pocketTrackerBudgets)
      .where(eq(pocketTrackerBudgets.id, input.budgetId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Pocket Tracker budget not found.');
    }

    const current = existing[0];
    const nextRecord = {
      category: input.category ?? current.category,
      limitCents: Math.round((input.limit ?? current.limitCents / 100) * 100),
      periodLabel: input.periodLabel ?? current.periodLabel,
      updatedAt: new Date(),
    };

    await db
      .update(pocketTrackerBudgets)
      .set(nextRecord)
      .where(eq(pocketTrackerBudgets.id, input.budgetId));

    revalidatePath('/pocket-tracker');
    return okResult({
      id: current.id,
      category: nextRecord.category,
      limit: nextRecord.limitCents / 100,
      spent: 0,
      periodLabel: nextRecord.periodLabel,
    });
  } catch (error) {
    console.error('Failed to update pocket tracker budget:', error);
    return errorResult(error);
  }
}

export async function deletePocketTrackerBudget(
  budgetId: string
): Promise<DatabaseActionResult<null>> {
  try {
    await db.delete(pocketTrackerBudgets).where(eq(pocketTrackerBudgets.id, budgetId));
    revalidatePath('/pocket-tracker');
    return okResult(null);
  } catch (error) {
    console.error('Failed to delete pocket tracker budget:', error);
    return errorResult(error);
  }
}
