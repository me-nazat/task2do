import { TaskAttachmentViewer } from '@/components/files/TaskAttachmentViewer';

interface FileViewerPageProps {
  params: Promise<{
    taskName: string;
    fileToken: string;
  }>;
}

export default async function FileViewerPage({ params }: FileViewerPageProps) {
  const { taskName, fileToken } = await params;

  return <TaskAttachmentViewer fileToken={fileToken} taskName={taskName} />;
}
