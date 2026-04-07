'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileArchive,
  FileIcon,
  FileImage,
  FileText,
  FileVideo,
  LoaderCircle,
  Paperclip,
  UploadCloud,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { cn } from '@/lib/utils';
import {
  MAX_TASK_ATTACHMENT_FILES,
  MAX_TASK_ATTACHMENT_SIZE_BYTES,
  type TaskAttachmentRecord,
  type TaskAttachmentsResponse,
  buildTaskAttachmentViewerHref,
} from '@/lib/task-attachments';

interface TaskAttachmentsSectionProps {
  taskId: string;
  taskTitle: string;
}

type NoticeTone = 'error' | 'success' | 'info';

interface UploadNotice {
  tone: NoticeTone;
  message: string;
}

interface UploadProgressState {
  current: number;
  total: number;
  fileName: string;
}

const noticeStyles: Record<NoticeTone, string> = {
  error: 'border-red-200/70 bg-red-50/90 text-red-700',
  success: 'border-emerald-200/70 bg-emerald-50/90 text-emerald-700',
  info: 'border-blue-200/70 bg-blue-50/90 text-blue-700',
};

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)}KB`;
  }

  return `${size}B`;
}

function pickFileIcon(mimeType: string | null, fileName: string) {
  if (mimeType?.startsWith('image/')) {
    return FileImage;
  }

  if (mimeType?.startsWith('video/')) {
    return FileVideo;
  }

  if (
    mimeType?.includes('pdf') ||
    mimeType?.includes('document') ||
    mimeType?.includes('text') ||
    fileName.match(/\.(docx?|pdf|txt|md|rtf)$/i)
  ) {
    return FileText;
  }

  if (
    mimeType?.includes('zip') ||
    mimeType?.includes('compressed') ||
    fileName.match(/\.(zip|rar|7z|tar|gz)$/i)
  ) {
    return FileArchive;
  }

  return FileIcon;
}

function mergeAttachments(nextFiles: TaskAttachmentRecord[], currentFiles: TaskAttachmentRecord[]) {
  const deduped = new Map<string, TaskAttachmentRecord>();

  [...nextFiles, ...currentFiles].forEach((file) => {
    deduped.set(file.id, file);
  });

  return Array.from(deduped.values()).sort((left, right) => {
    const leftTime = left.modifiedTime ? new Date(left.modifiedTime).getTime() : 0;
    const rightTime = right.modifiedTime ? new Date(right.modifiedTime).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function TaskAttachmentsSection({ taskId, taskTitle }: TaskAttachmentsSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<TaskAttachmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);

  const remainingSlots = Math.max(0, MAX_TASK_ATTACHMENT_FILES - attachments.length);

  const constraintsCopy = useMemo(
    () => `Max ${Math.round(MAX_TASK_ATTACHMENT_SIZE_BYTES / (1024 * 1024))}MB per file • Max ${MAX_TASK_ATTACHMENT_FILES} files • All formats supported`,
    []
  );

  const showNotice = useCallback((tone: NoticeTone, message: string) => {
    setNotice({ tone, message });
  }, []);

  const fetchAttachments = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }

      try {
        const response = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as TaskAttachmentsResponse | { error?: string } | null;

        if (!response.ok) {
          throw new Error(payload && 'error' in payload ? payload.error || 'Unable to load attachments.' : 'Unable to load attachments.');
        }

        if (payload && 'files' in payload) {
          setAttachments(payload.files);
        }
      } catch (error) {
        showNotice('error', error instanceof Error ? error.message : 'Unable to load attachments right now.');
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [showNotice, taskId]
  );

  useEffect(() => {
    setAttachments([]);
    setNotice(null);
    setUploadProgress(null);
    void fetchAttachments();
  }, [fetchAttachments, taskId]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const uploadFiles = useCallback(
    async (candidateFiles: File[]) => {
      if (!candidateFiles.length) {
        return;
      }

      const oversizedFiles = candidateFiles.filter((file) => file.size > MAX_TASK_ATTACHMENT_SIZE_BYTES);
      const validFiles = candidateFiles.filter((file) => file.size <= MAX_TASK_ATTACHMENT_SIZE_BYTES);

      if (oversizedFiles.length > 0) {
        showNotice(
          'error',
          oversizedFiles.length === 1
            ? `"${oversizedFiles[0].name}" exceeds the 100MB limit.`
            : `${oversizedFiles.length} files exceed the 100MB limit and were skipped.`
        );
      }

      if (validFiles.length === 0) {
        return;
      }

      if (attachments.length + validFiles.length > MAX_TASK_ATTACHMENT_FILES) {
        showNotice('error', `You can attach up to ${MAX_TASK_ATTACHMENT_FILES} files to this objective.`);
        return;
      }

      setIsUploading(true);
      const uploadedFiles: TaskAttachmentRecord[] = [];
      const failedUploads: string[] = [];

      for (const [index, file] of validFiles.entries()) {
        setUploadProgress({
          current: index,
          total: validFiles.length,
          fileName: file.name,
        });

        const formData = new FormData();
        formData.append('files', file);

        try {
          const response = await fetch(`/api/tasks/${taskId}/attachments`, {
            method: 'POST',
            body: formData,
          });
          const payload = (await response.json().catch(() => null)) as
            | (TaskAttachmentsResponse & { error?: string })
            | { error?: string }
            | null;

          if (!response.ok) {
            throw new Error(payload && 'error' in payload ? payload.error || `Unable to upload ${file.name}.` : `Unable to upload ${file.name}.`);
          }

          if (payload && 'files' in payload) {
            const nextFiles = payload.files.slice(0, 1);
            uploadedFiles.push(...nextFiles);
            setAttachments((currentFiles) => mergeAttachments(nextFiles, currentFiles));
          }

          setUploadProgress({
            current: index + 1,
            total: validFiles.length,
            fileName: file.name,
          });
        } catch (error) {
          failedUploads.push(error instanceof Error ? error.message : `Unable to upload ${file.name}.`);
        }
      }

      setIsUploading(false);
      setUploadProgress(null);

      if (uploadedFiles.length > 0) {
        await fetchAttachments({ silent: true });
      }

      if (uploadedFiles.length > 0 && failedUploads.length === 0) {
        showNotice(
          'success',
          uploadedFiles.length === 1 ? '1 file attached to this objective.' : `${uploadedFiles.length} files attached to this objective.`
        );
        return;
      }

      if (uploadedFiles.length > 0 && failedUploads.length > 0) {
        showNotice('info', `Uploaded ${uploadedFiles.length} files, but ${failedUploads.length} could not be attached.`);
        return;
      }

      if (failedUploads.length > 0) {
        showNotice('error', failedUploads[0]);
      }
    },
    [attachments.length, fetchAttachments, showNotice, taskId]
  );

  const handleFileSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = '';
      await uploadFiles(selectedFiles);
    },
    [uploadFiles]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[9px] font-label font-bold tracking-[0.2em] uppercase text-outline/70 px-2">
        <Paperclip className="w-4 h-4 text-primary/60" />
        <span>Attach Files</span>
      </div>

      <div className="rounded-[1.75rem] border border-outline-variant/10 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium tracking-tight text-primary">Attach Files</h3>
                <span className="rounded-full bg-primary/5 px-2 py-1 text-[9px] font-label font-bold uppercase tracking-[0.16em] text-primary/70">
                  {attachments.length}/{MAX_TASK_ATTACHMENT_FILES}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:justify-end">
              <p className="text-[11px] text-outline/50 sm:max-w-[17rem] sm:text-right">{constraintsCopy}</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading || remainingSlots === 0}
                className={cn(
                  'touch-target inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] transition-all',
                  isUploading || remainingSlots === 0
                    ? 'cursor-not-allowed border-outline-variant/10 bg-surface-container-low text-outline/35'
                    : 'border-primary/10 bg-primary/5 text-primary/80 active:scale-95 active:bg-primary/10 lg:hover:border-primary/20 lg:hover:bg-primary/10'
                )}
              >
                {isUploading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                {isUploading ? 'Uploading...' : 'Attach Files'}
              </button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleFileSelection}
            className="hidden"
          />

          <div
            role="presentation"
            onDragOver={(event) => {
              event.preventDefault();
              if (!isUploading) {
                setIsDragging(true);
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isUploading) {
                setIsDragging(true);
              }
            }}
            onDragLeave={(event) => {
              event.preventDefault();

              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);

              if (isUploading) {
                return;
              }

              const droppedFiles = Array.from(event.dataTransfer.files ?? []);
              void uploadFiles(droppedFiles);
            }}
            className={cn(
              'relative overflow-hidden rounded-2xl border border-dashed px-4 py-4 transition-all sm:px-5',
              isDragging
                ? 'border-primary/35 bg-primary/5 shadow-sm'
                : 'border-outline-variant/20 bg-surface-container-low/35'
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(191,219,254,0.24),transparent_50%)]" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[13px] font-medium text-primary">
                  <UploadCloud className="w-4 h-4 text-primary/70" />
                  <span>Drop files here or use the picker</span>
                </div>
                <p className="text-[11px] leading-relaxed text-outline/50">
                  Files stay inside this objective’s private workspace and never leave Task2Do while viewing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading || remainingSlots === 0}
                className={cn(
                  'touch-target inline-flex items-center justify-center rounded-2xl px-4 py-2 text-[10px] font-label font-bold uppercase tracking-[0.16em] transition-all',
                  isUploading || remainingSlots === 0
                    ? 'cursor-not-allowed bg-white/80 text-outline/35'
                    : 'bg-white text-primary shadow-sm active:scale-95 active:bg-primary/5 lg:hover:bg-primary/5'
                )}
              >
                {remainingSlots === 0 ? 'Limit Reached' : 'Browse Files'}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={cn('flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm shadow-sm', noticeStyles[notice.tone])}
              >
                {notice.tone === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <CircleAlert className="w-4 h-4 shrink-0" />
                )}
                <span className="text-[12px] font-medium leading-relaxed">{notice.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {isUploading && uploadProgress && (
            <div className="space-y-2 rounded-2xl border border-primary/10 bg-primary/5 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-primary/70">
                <span>Uploading</span>
                <span>
                  {Math.min(uploadProgress.current + 1, uploadProgress.total)}/{uploadProgress.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${Math.max(8, (Math.min(uploadProgress.current, uploadProgress.total) / uploadProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <p className="truncate text-[12px] text-primary/75">{uploadProgress.fileName}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/45">
                Attached Files
              </p>
              <p className="text-[10px] font-label font-bold uppercase tracking-[0.16em] text-outline/35">
                {remainingSlots} slots left
              </p>
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/30 px-4 py-4 text-[12px] text-outline/45">
                Loading files...
              </div>
            ) : attachments.length === 0 ? (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/30 px-4 py-4 text-[12px] leading-relaxed text-outline/45">
                Nothing is attached yet. Your personal Drive folder is synced from your account, and the first upload will create this objective’s task folder automatically.
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((file) => {
                  const FileTypeIcon = pickFileIcon(file.mimeType, file.name);
                  const viewerHref = buildTaskAttachmentViewerHref(taskTitle, taskId, file.id);

                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-3 py-2.5 shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/6 text-primary/70">
                        <FileTypeIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-primary">{file.name}</p>
                        <p className="mt-0.5 text-[10px] text-outline/45">
                          {formatFileSize(file.size)}
                          {file.modifiedTime
                            ? ` • Updated ${formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}`
                            : ''}
                        </p>
                      </div>
                      <Link
                        href={viewerHref}
                        className="touch-target inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-label font-bold uppercase tracking-[0.15em] text-outline/55 transition-all active:scale-95 active:bg-primary/5 active:text-primary lg:hover:bg-primary/5 lg:hover:text-primary"
                      >
                        Open
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
