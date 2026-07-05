import { AlertCircle, Check, Loader2, Play } from "lucide-react";
import type { CompileStatus } from "@/features/compiler/useCompile";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

export interface CompileButtonProps {
  status: CompileStatus;
  /** Pass label while compiling, e.g. "Compilando (2/6): bibliografia…". */
  progressLabel?: string;
  onCompile: () => void;
}

export function CompileButton({ status, progressLabel, onCompile }: CompileButtonProps) {
  const busy = status === "warming" || status === "compiling";
  return (
    <Tooltip content={strings.topbar.compileHint}>
      <button
        type="button"
        data-testid="compile-button"
        data-status={status}
        disabled={busy}
        onClick={onCompile}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
          busy
            ? "cursor-wait bg-surface text-ink-muted"
            : "bg-accent text-accent-foreground hover:bg-accent-strong",
          status === "error" && "bg-danger text-white hover:bg-danger/90",
        )}
      >
        {status === "warming" && (
          <>
            <Loader2 className="size-4 animate-spin" />
            {strings.topbar.warming}
          </>
        )}
        {status === "compiling" && (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span className="max-w-64 truncate">
              {progressLabel ?? strings.topbar.compiling}
            </span>
          </>
        )}
        {status === "idle" && (
          <>
            <Play className="size-4" />
            {strings.topbar.compile}
          </>
        )}
        {status === "ok" && (
          <>
            <Check className="size-4" />
            {strings.topbar.compile}
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="size-4" />
            {strings.topbar.compile}
          </>
        )}
      </button>
    </Tooltip>
  );
}
