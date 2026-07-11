import type { CompileDiagnostic } from "@papyru/compiler";
import {
  type TranslateContext,
  translateDiagnostic,
} from "@/features/compiler/error-translations";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export interface DiagnosticsListProps {
  diagnostics: CompileDiagnostic[];
  ctx: TranslateContext;
}

/**
 * Tradução PT-BR dos erros/avisos de compilação (§1.5 UI_UX_PLAN), com o
 * texto original do pdfTeX sempre disponível (não escondido) num <details>.
 */
export function DiagnosticsList({ diagnostics, ctx }: DiagnosticsListProps) {
  if (diagnostics.length === 0) return null;
  return (
    <ul
      className="max-h-64 shrink-0 overflow-y-auto border-b"
      data-testid="diagnostics-list"
    >
      {diagnostics.map((d, i) => {
        const translated = translateDiagnostic(d, ctx);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics are replaced wholesale per compile, never reordered
          <li key={`${d.file}-${d.line}-${i}`} className="px-3 py-2 text-xs">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "font-medium uppercase",
                  d.severity === "error" ? "text-danger" : "text-warning",
                )}
              >
                {d.severity === "error"
                  ? strings.diagnostics.error
                  : strings.diagnostics.warning}
              </span>
              <div className="min-w-0 flex-1">
                {d.file && (
                  <span className="text-ink-muted">
                    {d.file}
                    {d.line ? `:${d.line}` : ""}{" "}
                  </span>
                )}
                <span>{translated.message}</span>
                {translated.action && (
                  <button
                    type="button"
                    className="ml-2 text-accent underline hover:no-underline"
                    onClick={translated.action.onClick}
                  >
                    {translated.action.label}
                  </button>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-ink-subtle">
                    {strings.diagnostics.rawExcerpt}
                  </summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-ink-muted">
                    {d.rawLogExcerpt}
                  </pre>
                </details>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
