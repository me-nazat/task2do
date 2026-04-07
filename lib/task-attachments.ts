export const MAX_TASK_ATTACHMENT_FILES = 10;
export const MAX_TASK_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024;

export type TaskAttachmentPreviewKind = 'image' | 'video' | 'pdf' | 'unsupported';

export interface TaskAttachmentRecord {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  webViewLink: string | null;
  webContentLink: string | null;
  iconLink: string | null;
  modifiedTime: string | null;
}

export interface TaskAttachmentsResponse {
  files: TaskAttachmentRecord[];
  folderUrl: string | null;
  taskFolderId: string | null;
  limit: {
    maxFiles: number;
    maxFileSizeBytes: number;
  };
}

export interface TaskAttachmentTokenPayload {
  taskId: string;
  fileId: string;
}

export interface TaskAttachmentViewerMetadata {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  modifiedTime: string | null;
  previewKind: TaskAttachmentPreviewKind;
  printable: boolean;
  viewUrl: string;
  downloadUrl: string;
}

function encodeBase64Url(value: string) {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    const encoded = window.btoa(
      Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join('')
    );

    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(value, 'base64url').toString('utf8');
}

export function encodeTaskAttachmentToken(payload: TaskAttachmentTokenPayload) {
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeTaskAttachmentToken(token: string): TaskAttachmentTokenPayload | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(token)) as Partial<TaskAttachmentTokenPayload>;

    if (!parsed.taskId || !parsed.fileId) {
      return null;
    }

    return {
      taskId: parsed.taskId,
      fileId: parsed.fileId,
    };
  } catch {
    return null;
  }
}

export function slugifyTaskSegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'objective';
}

export function buildTaskAttachmentViewerHref(taskTitle: string, taskId: string, fileId: string) {
  const taskSlug = slugifyTaskSegment(taskTitle);
  const fileToken = encodeTaskAttachmentToken({ taskId, fileId });

  return `/today/${taskSlug}/file/${fileToken}`;
}

export function inferTaskAttachmentPreviewKind(fileName: string, mimeType: string | null): TaskAttachmentPreviewKind {
  const lowerFileName = fileName.toLowerCase();
  const normalizedMimeType = mimeType?.toLowerCase() ?? null;

  if (
    normalizedMimeType?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerFileName)
  ) {
    return 'image';
  }

  if (
    normalizedMimeType?.startsWith('video/') ||
    /\.(mp4|webm|mov|m4v|ogg)$/i.test(lowerFileName)
  ) {
    return 'video';
  }

  if (normalizedMimeType?.includes('pdf') || /\.pdf$/i.test(lowerFileName)) {
    return 'pdf';
  }

  return 'unsupported';
}

export function isTaskAttachmentPrintable(fileName: string, mimeType: string | null) {
  const previewKind = inferTaskAttachmentPreviewKind(fileName, mimeType);
  return previewKind === 'image' || previewKind === 'pdf';
}
