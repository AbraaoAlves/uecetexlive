import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export interface PdfPaneProps {
  pdf: Uint8Array | null;
  /** Stale-while-compiling overlay. */
  compiling: boolean;
}

interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(opts: { scale: number }): { width: number; height: number };
    render(opts: unknown): { promise: Promise<void> };
    getTextContent(): Promise<{ items: unknown[] }>;
  }>;
  destroy(): Promise<void>;
}

/** Lazy pdf.js: loaded on first preview only (§11.5 budget). */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export function PdfPane({ pdf, compiling }: PdfPaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const pdfjs = await loadPdfjs();
      // pdf.js transfers the buffer to its worker — hand it a copy.
      const data = new Uint8Array(pdf);
      const doc = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDoc;
      if (cancelled) {
        void doc.destroy();
        return;
      }
      // Destroy the previous document (its worker leaks otherwise, §12).
      if (docRef.current) void docRef.current.destroy();
      docRef.current = doc;
      setNumPages(doc.numPages);
      setPageNum((prev) => Math.min(prev, doc.numPages) || 1);

      // e2e/debug hook: page count + text-layer extraction (Gate G2).
      (window as unknown as Record<string, unknown>).__uecetexPdf = {
        numPages: doc.numPages,
        getText: async () => {
          let text = "";
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            text += `${(content.items as { str?: string }[])
              .map((item) => item.str ?? "")
              .join(" ")}\n`;
          }
          return text;
        },
      };
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || numPages === 0) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(Math.min(pageNum, doc.numPages));
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1.4 * zoom });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, zoom, numPages]);

  if (!pdf) {
    return (
      <div
        className="flex h-full items-center justify-center text-ink-subtle"
        data-testid="pdf-pane-empty"
      >
        {strings.preview.empty}
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col"
      data-testid="pdf-pane"
      data-pages={numPages}
    >
      <div className="flex h-9 shrink-0 items-center justify-center gap-2 border-b bg-surface text-xs">
        <button
          type="button"
          className="rounded p-1 hover:bg-accent-soft disabled:opacity-40"
          onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          disabled={pageNum <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span data-testid="pdf-page-indicator">
          {Math.min(pageNum, numPages)} / {numPages}
        </span>
        <button
          type="button"
          className="rounded p-1 hover:bg-accent-soft disabled:opacity-40"
          onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
          disabled={pageNum >= numPages}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="mx-2 h-4 w-px bg-border" />
        <button
          type="button"
          className="rounded p-1 hover:bg-accent-soft"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
          aria-label="Reduzir zoom"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          type="button"
          className="rounded p-1 hover:bg-accent-soft"
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          aria-label="Aumentar zoom"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-ink/5 p-4">
        <canvas
          ref={canvasRef}
          className={cn("mx-auto shadow-md", compiling && "opacity-60")}
        />
      </div>
      {compiling && (
        <div className="absolute inset-x-0 top-9 flex justify-center">
          <span className="rounded-b bg-warning/90 px-3 py-1 text-xs">
            {strings.preview.stale}
          </span>
        </div>
      )}
    </div>
  );
}
