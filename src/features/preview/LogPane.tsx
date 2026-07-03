import type { CompileDiagnostic } from "@/features/compiler/types";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export interface LogPaneProps {
  log: string;
  diagnostics: CompileDiagnostic[];
  /** Draft-mode [?] notice (§6.3). */
  draftMode: boolean;
  onDiagnosticClick?: (diagnostic: CompileDiagnostic) => void;
}

export function LogPane({
  log,
  diagnostics,
  draftMode,
  onDiagnosticClick,
}: LogPaneProps) {
  return (
    <div className="flex h-full flex-col" data-testid="log-pane">
      {draftMode && (
        <div className="border-warning border-b bg-warning/15 px-3 py-2 text-xs">
          {strings.engine.draftBanner}
        </div>
      )}
      {diagnostics.length > 0 && (
        <ul
          className="max-h-48 shrink-0 overflow-y-auto border-b"
          data-testid="diagnostics-list"
        >
          {diagnostics.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics are replaced wholesale per compile, never reordered
            <li key={`${d.file}-${d.line}-${i}`}>
              <button
                type="button"
                onClick={() => onDiagnosticClick?.(d)}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent-soft/50",
                  d.severity === "error" ? "text-danger" : "text-warning",
                )}
              >
                <span className="font-medium uppercase">
                  {d.severity === "error" ? "erro" : "aviso"}
                </span>
                <span className="min-w-0 flex-1">
                  {d.file && (
                    <span className="text-ink-muted">
                      {d.file}
                      {d.line ? `:${d.line}` : ""}{" "}
                    </span>
                  )}
                  {d.message}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <pre
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-ink-muted"
        data-testid="raw-log"
      >
        {log || "—"}
      </pre>
    </div>
  );
}
