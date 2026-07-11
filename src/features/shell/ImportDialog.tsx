import { AlertCircle, CheckCircle2, FileUp } from "lucide-react";
import { strings } from "@/lib/strings";

export type ImportDialogState =
  | { kind: "zip-ok"; fileCount: number; entry: string }
  | { kind: "zip-error"; message: string }
  | { kind: "bbl-ok"; sizeBytes: number };

export interface ImportDialogProps {
  state: ImportDialogState;
  onConfirm: () => void;
  onClose: () => void;
}

export function ImportDialog({ state, onConfirm, onClose }: ImportDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30"
      role="dialog"
      aria-modal="true"
      data-testid="import-dialog"
    >
      <div className="w-96 rounded-lg border bg-surface-elevated p-4 shadow-xl">
        {state.kind === "zip-ok" && (
          <>
            <div className="flex items-center gap-2 font-medium text-success">
              <CheckCircle2 className="size-4" /> ZIP válido
            </div>
            <p className="mt-2 text-ink-muted text-sm">
              {state.fileCount} arquivos; documento principal:{" "}
              <code className="font-mono text-xs">{state.entry}</code>
            </p>
            <p className="mt-2 text-sm text-warning">
              Importar substitui o projeto atual. O estado anterior permanece no histórico
              do navegador até a próxima importação.
            </p>
          </>
        )}
        {state.kind === "zip-error" && (
          <>
            <div className="flex items-center gap-2 font-medium text-danger">
              <AlertCircle className="size-4" /> ZIP inválido
            </div>
            <p className="mt-2 text-ink-muted text-sm">{state.message}</p>
          </>
        )}
        {state.kind === "bbl-ok" && (
          <>
            <div className="flex items-center gap-2 font-medium text-success">
              <FileUp className="size-4" /> .bbl importado
            </div>
            <p className="mt-2 text-ink-muted text-sm">
              {(state.sizeBytes / 1024).toFixed(1)} KB. {strings.shell.bblImportedNote}
            </p>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface"
            onClick={onClose}
            data-testid="import-cancel"
          >
            {state.kind === "zip-error" ? "Fechar" : "Cancelar"}
          </button>
          {state.kind !== "zip-error" && (
            <button
              type="button"
              className="rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong"
              onClick={onConfirm}
              data-testid="import-confirm"
            >
              {state.kind === "zip-ok" ? "Importar projeto" : "Usar .bbl"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
