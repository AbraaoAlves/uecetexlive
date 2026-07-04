import { Contrast, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

function isDarkTheme(): boolean {
  return (
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
}

export interface PdfPaneProps {
  pdf: Uint8Array | null;
  /** Stale-while-compiling overlay. */
  compiling: boolean;
}

interface PdfPage {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: unknown): { promise: Promise<void> };
  getTextContent(): Promise<{ items: unknown[] }>;
}

interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

/**
 * pdf.js teardown lives on the LOADING TASK, not the document proxy — in
 * pdfjs-dist v6 `PDFDocumentProxy` has no public `destroy()`. Keep the task
 * around to tear the worker down on the next compile (§12: proxies leak).
 */
interface PdfLoadingTask {
  promise: Promise<PdfDoc>;
  destroy(): Promise<void>;
}

/** Lazy pdf.js: loaded on first preview only (§11.5 budget). */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

const BASE_SCALE = 1.4;
const PAGE_GAP = 16;

export function PdfPane({ pdf, compiling }: PdfPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const taskRef = useRef<PdfLoadingTask | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  // Dark-comfort reading: default to inverted while the app is in dark theme.
  const [invert, setInvert] = useState(isDarkTheme);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const pdfjs = await loadPdfjs();
      // pdf.js transfers the buffer to its worker — hand it a copy.
      const data = new Uint8Array(pdf);
      const task = pdfjs.getDocument({ data }) as unknown as PdfLoadingTask;
      const doc = await task.promise;
      if (cancelled) {
        void task.destroy();
        return;
      }
      // Tear down the previous document's worker (§12) — destroy the loading
      // task, not the proxy (which has no public destroy in v6).
      if (taskRef.current) void taskRef.current.destroy();
      taskRef.current = task;
      docRef.current = doc;

      // Uniform layout sizing from page 1 (theses are single page size);
      // each canvas still renders at its own true viewport.
      const first = await doc.getPage(1);
      if (cancelled) return;
      const vp = first.getViewport({ scale: 1 });
      setBase({ w: vp.width, h: vp.height });
      setNumPages(doc.numPages);
      setCurrentPage(1);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;

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

  // Final teardown on unmount (the per-compile path destroys the previous
  // task; this catches the last one).
  useEffect(() => {
    return () => {
      void taskRef.current?.destroy();
      taskRef.current = null;
      docRef.current = null;
    };
  }, []);

  const scale = BASE_SCALE * zoom;
  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

  // Track the page nearest the viewport top for the indicator.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !base || numPages === 0) return;
    const pageHeight = base.h * scale + PAGE_GAP;
    const p = Math.floor(el.scrollTop / pageHeight) + 1;
    setCurrentPage(Math.min(Math.max(1, p), numPages));
  }, [base, scale, numPages]);

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
        <span data-testid="pdf-page-indicator">
          {Math.min(currentPage, numPages || 1)} / {numPages || 1}
        </span>
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
        <button
          type="button"
          data-testid="pdf-invert"
          aria-pressed={invert}
          title={strings.preview.invert}
          className={cn(
            "rounded p-1 hover:bg-accent-soft",
            invert && "bg-accent-soft text-accent-strong",
          )}
          onClick={() => setInvert((v) => !v)}
        >
          <Contrast className="size-4" />
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn(
          "flex flex-1 flex-col items-center overflow-auto bg-ink/5 p-4",
          compiling && "opacity-60",
        )}
        data-testid="pdf-scroll"
        style={{ gap: `${PAGE_GAP}px` }}
      >
        {base &&
          docRef.current &&
          pageNumbers.map((pageNum) => (
            <PdfPageCanvas
              key={pageNum}
              doc={docRef.current as PdfDoc}
              pageNum={pageNum}
              scale={scale}
              base={base}
              root={scrollRef.current}
              invert={invert}
            />
          ))}
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

/**
 * One PDF page, rendered lazily: a placeholder sized from page 1 holds scroll
 * height until the page nears the viewport (IntersectionObserver), then the
 * canvas paints at the true viewport. Leaving the viewport frees the bitmap
 * so a 47-page thesis never holds 47 live canvases.
 */
function PdfPageCanvas({
  doc,
  pageNum,
  scale,
  base,
  root,
  invert,
}: {
  doc: PdfDoc;
  pageNum: number;
  scale: number;
  base: { w: number; h: number };
  root: HTMLElement | null;
  invert: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedScale = useRef<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let cancelled = false;

    const renderPage = async () => {
      if (renderedScale.current === scale) return;
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      renderedScale.current = scale;
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void renderPage();
          } else if (renderedScale.current !== null) {
            const canvas = canvasRef.current;
            if (canvas) {
              canvas.width = 0;
              canvas.height = 0;
            }
            renderedScale.current = null;
          }
        }
      },
      { root, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [doc, pageNum, scale, root]);

  return (
    <div
      ref={wrapRef}
      data-testid={`pdf-page-${pageNum}`}
      className="shrink-0 bg-white shadow-md"
      style={{
        width: base.w * scale,
        height: base.h * scale,
        filter: invert ? "invert(1) hue-rotate(180deg)" : undefined,
      }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
