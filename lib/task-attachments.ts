export const MAX_TASK_ATTACHMENT_FILES = 10;
export const MAX_TASK_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024;

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
