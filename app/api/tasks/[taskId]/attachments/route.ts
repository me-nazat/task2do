import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { getAuthenticatedSession } from '@/lib/auth/session';
import {
  listTaskAttachments,
  uploadFilesToTaskFolder,
} from '@/lib/google-drive';
import {
  MAX_TASK_ATTACHMENT_FILES,
  MAX_TASK_ATTACHMENT_SIZE_BYTES,
  type TaskAttachmentsResponse,
} from '@/lib/task-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    taskId: string;
  }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthorizedTask(taskId: string, userId: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      userId: tasks.userId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  return task ?? null;
}

async function getTaskOwner(taskUserId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, taskUserId))
    .limit(1);

  return user ?? null;
}

async function resolveUploadContext(taskId: string, userId: string, fallbackIdentity: { name: string | null; email: string | null }) {
  const task = await getAuthorizedTask(taskId, userId);

  if (!task) {
    return null;
  }

  const owner = await getTaskOwner(task.userId);

  return {
    task,
    owner: {
      userId: task.userId,
      name: owner?.name ?? fallbackIdentity.name,
      email: owner?.email ?? fallbackIdentity.email,
    },
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthenticatedSession();

  if (!session) {
    return jsonError('Please sign in to view attachments.', 401);
  }

  const { taskId } = await context.params;
  const uploadContext = await resolveUploadContext(taskId, session.userId, {
    name: session.name,
    email: session.email,
  });

  if (!uploadContext) {
    return jsonError('Task not found.', 404);
  }

  try {
    const result = await listTaskAttachments({
      userId: uploadContext.owner.userId,
      userName: uploadContext.owner.name,
      userEmail: uploadContext.owner.email,
      taskTitle: uploadContext.task.title,
    });
    const payload: TaskAttachmentsResponse = result;

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to list task attachments', error);
    return jsonError(
      error instanceof Error ? error.message : 'Unable to load attachments right now.',
      500
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthenticatedSession();

  if (!session) {
    return jsonError('Please sign in to attach files.', 401);
  }

  const { taskId } = await context.params;
  const uploadContext = await resolveUploadContext(taskId, session.userId, {
    name: session.name,
    email: session.email,
  });

  if (!uploadContext) {
    return jsonError('Task not found.', 404);
  }

  const formData = await request.formData();
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return jsonError('Choose at least one file to upload.', 400);
  }

  const oversizedFile = files.find((file) => file.size > MAX_TASK_ATTACHMENT_SIZE_BYTES);

  if (oversizedFile) {
    return jsonError(`"${oversizedFile.name}" exceeds the 100MB limit.`, 400);
  }

  try {
    const existingAttachments = await listTaskAttachments({
      userId: uploadContext.owner.userId,
      userName: uploadContext.owner.name,
      userEmail: uploadContext.owner.email,
      taskTitle: uploadContext.task.title,
    });

    if (existingAttachments.files.length + files.length > MAX_TASK_ATTACHMENT_FILES) {
      return jsonError(`You can attach up to ${MAX_TASK_ATTACHMENT_FILES} files per objective.`, 400);
    }

    const result = await uploadFilesToTaskFolder({
      userId: uploadContext.owner.userId,
      userName: uploadContext.owner.name,
      userEmail: uploadContext.owner.email,
      taskTitle: uploadContext.task.title,
      files,
    });

    return NextResponse.json({
      ...result,
      limit: {
        maxFiles: MAX_TASK_ATTACHMENT_FILES,
        maxFileSizeBytes: MAX_TASK_ATTACHMENT_SIZE_BYTES,
      },
    });
  } catch (error) {
    console.error('Failed to upload task attachments', error);
    return jsonError(
      error instanceof Error ? error.message : 'Unable to upload files right now.',
      500
    );
  }
}
