import type { EngineId } from "@/features/compiler/useCompile";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export interface EngineToggleProps {
  engine: EngineId;
  onChange: (engine: EngineId) => void;
}

export function EngineToggle({ engine, onChange }: EngineToggleProps) {
  return (
    <div
      className="flex items-center rounded-md border bg-surface p-0.5 text-xs"
      role="radiogroup"
      aria-label="Modo de compilação"
      data-testid="engine-toggle"
    >
      <button
        type="button"
        role="radio"
        aria-checked={engine === "busytex-draft"}
        data-testid="engine-draft"
        title={strings.engine.draftHint}
        onClick={() => onChange("busytex-draft")}
        className={cn(
          "rounded px-2 py-1",
          engine === "busytex-draft"
            ? "bg-accent text-accent-foreground"
            : "text-ink-muted hover:text-foreground",
        )}
      >
        {strings.engine.draft}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={engine === "busytex-full"}
        data-testid="engine-full"
        title={strings.engine.fullHint}
        onClick={() => onChange("busytex-full")}
        className={cn(
          "rounded px-2 py-1",
          engine === "busytex-full"
            ? "bg-accent text-accent-foreground"
            : "text-ink-muted hover:text-foreground",
        )}
      >
        {strings.engine.full}
      </button>
    </div>
  );
}
