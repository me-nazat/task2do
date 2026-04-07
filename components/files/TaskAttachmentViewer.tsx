/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CircleAlert,
  Download,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  LoaderCircle,
  Printer,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  type TaskAttachmentPreviewKind,
  type TaskAttachmentViewerMetadata,
} from '@/lib/task-attachments';

interface TaskAttachmentViewerProps {
  fileToken: string;
  taskName: string;
}

function getPreviewIcon(previewKind: TaskAttachmentPreviewKind) {
  switch (previewKind) {
    case 'image':
      return FileImage;
    case 'video':
      return FileVideo;
    case 'pdf':
      return FileText;
    default:
      return FileArchive;
  }
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

export function TaskAttachmentViewer({ fileToken, taskName }: TaskAttachmentViewerProps) {
  const router = useRouter();
  const pdfFrameRef = useRef<HTMLIFrameElement>(null);
  const [metadata, setMetadata] = useState<TaskAttachmentViewerMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMetadata = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/files/${fileToken}?meta=1`, {
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as
          | TaskAttachmentViewerMetadata
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload && 'error' in payload ? payload.error || 'Unable to open this file.' : 'Unable to open this file.');
        }

        if (!cancelled && payload && 'id' in payload) {
          setMetadata(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to open this file.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [fileToken]);

  const PreviewIcon = getPreviewIcon(metadata?.previewKind ?? 'unsupported');
  const title = metadata?.name ?? 'Attachment Viewer';
  const subtitle = metadata ? `${formatFileSize(metadata.size)} • ${taskName.replace(/-/g, ' ')}` : taskName.replace(/-/g, ' ');

  const handleClose = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/today');
  };

  const handlePrint = () => {
    if (!metadata?.printable) {
      return;
    }

    if (metadata.previewKind === 'pdf') {
      pdfFrameRef.current?.contentWindow?.print();
      return;
    }

    if (metadata.previewKind === 'image') {
      const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');

      if (!printWindow) {
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>${metadata.name}</title>
            <style>
              html, body {
                margin: 0;
                background: #0f172a;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              img {
                max-width: 100vw;
                max-height: 100vh;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="${metadata.viewUrl}" alt="${metadata.name}" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const preview = useMemo(() => {
    if (!metadata) {
      return null;
    }

    switch (metadata.previewKind) {
      case 'image':
        return (
          <div className="flex h-full items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <img
              src={metadata.viewUrl}
              alt={metadata.name}
              className="max-h-full max-w-full rounded-[1.5rem] object-contain shadow-[0_20px_70px_rgba(15,23,42,0.45)]"
            />
          </div>
        );
      case 'video':
        return (
          <div className="flex h-full items-center justify-center rounded-[2rem] border border-white/10 bg-black/30 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <video
              controls
              playsInline
              className="h-full max-h-full w-full rounded-[1.5rem] bg-black object-contain"
              src={metadata.viewUrl}
            />
          </div>
        );
      case 'pdf':
        return (
          <div className="h-full overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <iframe
              ref={pdfFrameRef}
              title={metadata.name}
              src={metadata.viewUrl}
              className="h-full w-full"
            />
          </div>
        );
      default:
        return (
          <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] px-8 py-10 text-center shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white/5 text-white/70">
              <PreviewIcon className="h-9 w-9" />
            </div>
            <h2 className="mt-6 text-xl font-medium tracking-tight text-white">Preview unavailable</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300/80">
              This file type is stored securely in your Task2Do workspace, but it can’t be rendered inline in the browser.
            </p>
            <a
              href={metadata.downloadUrl}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[11px] font-label font-bold uppercase tracking-[0.16em] text-slate-900 transition-all active:scale-95 active:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Download File
            </a>
          </div>
        );
    }
  }, [PreviewIcon, metadata]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_40%,#111827_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 pb-6 pt-safe sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-[10px] font-label font-bold uppercase tracking-[0.18em] text-slate-300 transition-all active:scale-95 active:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Task2Do
              </button>
              <div className="mt-2 min-w-0">
                <h1 className="truncate text-lg font-medium tracking-tight text-white sm:text-xl">{title}</h1>
                <p className="mt-1 truncate text-sm text-slate-300/70">{subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {metadata?.printable ? (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-white transition-all active:scale-95 active:bg-white/10"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              ) : null}

              {metadata ? (
                <a
                  href={metadata.downloadUrl}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-slate-950 transition-all active:scale-95 active:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex-1">
          {isLoading ? (
            <div className="flex min-h-[70vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading file preview...
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[70vh] items-center justify-center">
              <div className="w-full max-w-lg rounded-[2rem] border border-red-400/20 bg-red-500/10 px-6 py-7 text-center shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-red-500/15 text-red-200">
                  <CircleAlert className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-medium tracking-tight text-white">Unable to open this file</h2>
                <p className="mt-3 text-sm leading-relaxed text-red-100/80">{error}</p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-white transition-all active:scale-95 active:bg-white/5"
                  >
                    Go Back
                  </button>
                  <Link
                    href="/today"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2.5 text-[10px] font-label font-bold uppercase tracking-[0.16em] text-slate-950 transition-all active:scale-95 active:bg-slate-100"
                  >
                    Open Today
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className={cn('min-h-[70vh]', metadata?.previewKind === 'unsupported' ? 'flex items-center justify-center' : 'h-[calc(100vh-9rem)]')}>
              {preview}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
