import { Link } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import type { SaveState } from "@/features/project/store";
import { strings } from "@/lib/strings";

export interface TopBarProps {
  projectName: string;
  saveState: SaveState;
  /** Compile controls slot — filled from Phase 2 on. */
  children?: React.ReactNode;
}

export function TopBar({ projectName, saveState, children }: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-surface px-4">
      <span className="font-display text-lg">{strings.app.name}</span>
      <span className="text-ink-subtle text-sm">{projectName}</span>
      <span
        className="flex items-center gap-1 text-ink-subtle text-xs"
        data-testid="save-state"
        data-state={saveState}
      >
        {saveState === "saving" ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            {strings.topbar.saving}
          </>
        ) : (
          <>
            <Check className="size-3" />
            {strings.topbar.saved}
          </>
        )}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <Link to="/sobre" className="text-ink-muted text-sm hover:text-foreground">
          {strings.topbar.about}
        </Link>
      </div>
    </header>
  );
}
