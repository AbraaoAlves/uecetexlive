import { strings } from "@/lib/strings";

/**
 * Three-pane shell (§6.1): rail 240px / editor flex / preview 45%.
 * Phase 0 skeleton — panes get real content in later phases.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col" data-testid="app-shell">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-surface px-4">
        <span className="font-display text-lg">{strings.app.name}</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          className="w-60 shrink-0 overflow-y-auto border-r bg-surface"
          data-testid="project-rail"
        />
        <main className="min-w-0 flex-1 overflow-y-auto" data-testid="editor-pane" />
        <section
          className="w-[45%] shrink-0 border-l bg-surface"
          data-testid="preview-pane"
        />
      </div>
    </div>
  );
}
