import type { jsPDF as JsPdfInstance } from 'jspdf';

type ExportScheduleGridOptions = {
  title: string;
  fileName: string;
  orientationPreference?: 'auto' | 'portrait' | 'landscape';
};

const waitForNextPaint = async () => {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
};

const markOverflowContainers = (root: HTMLElement) => {
  const markedElements: HTMLElement[] = [];
  const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

  for (const element of candidates) {
    const styles = window.getComputedStyle(element);
    const hasScrollableOverflow =
      ['auto', 'scroll', 'hidden'].includes(styles.overflow) ||
      ['auto', 'scroll', 'hidden'].includes(styles.overflowX) ||
      ['auto', 'scroll', 'hidden'].includes(styles.overflowY);
    const hasClippedContent =
      element.scrollHeight > element.clientHeight ||
      element.scrollWidth > element.clientWidth;

    if (!hasScrollableOverflow && !hasClippedContent) {
      continue;
    }

    element.dataset.exportOverflow = 'true';
    markedElements.push(element);
  }

  return () => {
    for (const element of markedElements) {
      delete element.dataset.exportOverflow;
    }
  };
};

const renderCanvasPage = (
  sourceCanvas: HTMLCanvasElement,
  offsetY: number,
  sliceHeight: number
) => {
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = sourceCanvas.width;
  pageCanvas.height = sliceHeight;

  const context = pageCanvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare the PDF canvas context.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  context.drawImage(
    sourceCanvas,
    0,
    offsetY,
    sourceCanvas.width,
    sliceHeight,
    0,
    0,
    sourceCanvas.width,
    sliceHeight
  );

  return pageCanvas;
};

const addCanvasToPdf = (
  pdf: JsPdfInstance,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  isFirstPage: boolean
) => {
  if (!isFirstPage) {
    pdf.addPage();
  }

  const renderedHeight = canvas.height * (pageWidth / canvas.width);
  const offsetY = Math.max((pageHeight - renderedHeight) / 2, 0);

  pdf.addImage(
    canvas.toDataURL('image/png', 1),
    'PNG',
    0,
    offsetY,
    pageWidth,
    renderedHeight,
    undefined,
    'FAST'
  );
};

export async function exportScheduleGridToPdf(
  element: HTMLElement,
  {
    title,
    fileName,
    orientationPreference = 'auto',
  }: ExportScheduleGridOptions
) {
  const markerId = `schedule-export-${Date.now()}`;
  element.dataset.exportRoot = markerId;
  const restoreOverflowMarkers = markOverflowContainers(element);

  try {
    if ('fonts' in document) {
      await document.fonts.ready;
    }
    await waitForNextPaint();

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: Math.min(Math.max(window.devicePixelRatio, 2), 3),
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: Math.max(document.documentElement.clientWidth, element.scrollWidth),
      windowHeight: Math.max(document.documentElement.clientHeight, element.scrollHeight),
      onclone: (clonedDocument) => {
        const clonedRoot = clonedDocument.querySelector<HTMLElement>(`[data-export-root="${markerId}"]`);
        if (!clonedRoot) {
          return;
        }

        clonedRoot.style.width = `${element.scrollWidth}px`;
        clonedRoot.style.minWidth = `${element.scrollWidth}px`;
        clonedRoot.style.height = 'auto';
        clonedRoot.style.maxHeight = 'none';
        clonedRoot.style.overflow = 'visible';
        clonedRoot.style.background = '#ffffff';

        clonedRoot.querySelectorAll<HTMLElement>('[data-export-overflow="true"]').forEach((node) => {
          node.style.overflow = 'visible';
          node.style.overflowX = 'visible';
          node.style.overflowY = 'visible';
          node.style.maxHeight = 'none';
          node.style.height = 'auto';
        });
      },
    });

    const orientation = orientationPreference === 'auto'
      ? canvas.width > canvas.height ? 'landscape' : 'portrait'
      : orientationPreference;

    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: 'a4',
      compress: true,
      hotfixes: ['px_scaling'],
    });

    pdf.setProperties({
      title,
      subject: title,
      creator: 'Task2Do',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const sliceHeight = Math.max(Math.floor((pageHeight / pageWidth) * canvas.width), 1);

    let pageIndex = 0;
    for (let offsetY = 0; offsetY < canvas.height; offsetY += sliceHeight) {
      const remainingHeight = canvas.height - offsetY;
      const currentSliceHeight = Math.min(sliceHeight, remainingHeight);
      const pageCanvas = renderCanvasPage(canvas, offsetY, currentSliceHeight);
      addCanvasToPdf(pdf, pageCanvas, pageWidth, pageHeight, pageIndex === 0);
      pageIndex += 1;
    }

    pdf.save(fileName);
  } finally {
    delete element.dataset.exportRoot;
    restoreOverflowMarkers();
  }
}
