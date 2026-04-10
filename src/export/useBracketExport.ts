import { useCallback, useState } from 'react';
import { toPng } from 'html-to-image';

type ExportStatus = 'idle' | 'working' | 'error';

export interface UseBracketExport {
  status: ExportStatus;
  error: string | null;
  exportNode: (node: HTMLElement | null, filename: string) => Promise<void>;
}

/**
 * Renders a DOM node to a high-DPI PNG and triggers a browser download.
 * Pads the capture so the bracket isn't flush against the edge and forces
 * the brand background colour so the export matches the on-screen look.
 */
export function useBracketExport(): UseBracketExport {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const exportNode = useCallback(
    async (node: HTMLElement | null, filename: string) => {
      if (!node) {
        setError('Nothing to export yet.');
        setStatus('error');
        return;
      }
      setStatus('working');
      setError(null);
      try {
        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#07070f',
          style: {
            // Strip animations / sticky offsets while we capture
            transform: 'none',
            animation: 'none',
          },
          filter: (el) => {
            // Skip elements explicitly opted out of the export
            if (el instanceof HTMLElement && el.dataset?.exportIgnore === 'true') {
              return false;
            }
            return true;
          },
        });

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        setStatus('idle');
      } catch (err) {
        console.error('[bracket-export] failed', err);
        setError(err instanceof Error ? err.message : 'Export failed');
        setStatus('error');
      }
    },
    [],
  );

  return { status, error, exportNode };
}
