import type { EngineId } from "@/features/compiler/useCompile";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export interface EngineToggleProps {
  engine: EngineId;
  /** Full engine assets already in cache? Drives the size warning. */
  fullReady: boolean;
  onChange: (engine: EngineId) => void;
}

export function EngineToggle({ engine, fullReady, onChange }: EngineToggleProps) {
  const pick = (next: EngineId) => {
    if (next === "busytex-full" && engine !== "busytex-full" && !fullReady) {
      if (!window.confirm(strings.engine.fullWarning)) return;
    }
    onChange(next);
  };

  return (
    <div
      className="flex items-center rounded-md border bg-surface p-0.5 text-xs"
      role="radiogroup"
      aria-label="Motor de compilação"
      data-testid="engine-toggle"
    >
      <button
        type="button"
        role="radio"
        aria-checked={engine === "swiftlatex-draft"}
        data-testid="engine-draft"
        onClick={() => pick("swiftlatex-draft")}
        className={cn(
          "rounded px-2 py-1",
          engine === "swiftlatex-draft"
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
        onClick={() => pick("busytex-full")}
        title={fullReady ? undefined : strings.engine.fullWarning}
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
