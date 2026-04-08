import { Readable } from 'node:stream';

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { tasks, users } from '@/db/schema';
import { getAuthenticatedSession } from '@/lib/auth/session';
import { getTaskAttachmentContent, getTaskAttachmentMetadata } from '@/lib/google-drive';
import { decodeTaskAttachmentToken } from '@/lib/task-attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function buildContentDisposition(fileName: string, mode: 'inline' | 'attachment') {
  const encodedFileName = encodeURIComponent(fileName);
  return `${mode}; filename*=UTF-8''${encodedFileName}`;
}

async function getAuthorizedTaskContext(taskId: string, userId: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      userId: tasks.userId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task) {
    return null;
  }

  const [owner] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, task.userId))
    .limit(1);

  return {
    task,
    owner: {
      userId: task.userId,
      name: owner?.name ?? null,
      email: owner?.email ?? null,
    },
  };
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession();

  if (!session) {
    return jsonError('Please sign in to view files.', 401);
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return jsonError('Invalid file link.', 400);
  }

  const decodedToken = decodeTaskAttachmentToken(token);

  if (!decodedToken) {
    return jsonError('Invalid file link.', 400);
  }

  const taskContext = await getAuthorizedTaskContext(decodedToken.taskId, session.userId);

  if (!taskContext) {
    return jsonError('File not found.', 404);
  }

  const isMetadataRequest = searchParams.get('meta') === '1';
  const isDownloadRequest = searchParams.get('download') === '1';

  try {
    if (isMetadataRequest) {
      const metadata = await getTaskAttachmentMetadata({
        userId: taskContext.owner.userId,
        userName: taskContext.owner.name ?? session.name,
        userEmail: taskContext.owner.email ?? session.email,
        taskTitle: taskContext.task.title,
        fileId: decodedToken.fileId,
      });

      return NextResponse.json({
        id: metadata.file.id,
        name: metadata.file.name,
        mimeType: metadata.file.mimeType,
        size: metadata.file.size,
        modifiedTime: metadata.file.modifiedTime,
        previewKind: metadata.previewKind,
        printable: metadata.printable,
        viewUrl: `/api/files/view?token=${encodeURIComponent(token)}`,
        downloadUrl: `/api/files/view?token=${encodeURIComponent(token)}&download=1`,
      });
    }

    const content = await getTaskAttachmentContent({
      userId: taskContext.owner.userId,
      userName: taskContext.owner.name ?? session.name,
      userEmail: taskContext.owner.email ?? session.email,
      taskTitle: taskContext.task.title,
      fileId: decodedToken.fileId,
      range: request.headers.get('range'),
    });

    const headers = new Headers();
    headers.set('Cache-Control', 'private, no-store, max-age=0');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Type', content.contentType);
    headers.set(
      'Content-Disposition',
      buildContentDisposition(content.file.name, isDownloadRequest ? 'attachment' : 'inline')
    );

    if (content.contentLength) {
      headers.set('Content-Length', content.contentLength);
    }

    if (content.contentRange) {
      headers.set('Content-Range', content.contentRange);
    }

    if (content.etag) {
      headers.set('ETag', content.etag);
    }

    if (content.lastModified) {
      headers.set('Last-Modified', content.lastModified);
    }

    return new Response(Readable.toWeb(content.stream) as ReadableStream, {
      status: content.status,
      headers,
    });
  } catch (error) {
    console.error('Failed to serve attachment', error);
    return jsonError(
      error instanceof Error ? error.message : 'Unable to load this file right now.',
      500
    );
  }
}
