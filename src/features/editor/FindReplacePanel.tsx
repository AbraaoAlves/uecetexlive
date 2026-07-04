/**
 * Shared Find & Replace panel (QA §A2/§B1) — one UI for both editors: the
 * WYSIWYG surface (ProseMirror search extension) and the LaTeX source view
 * (CodeMirror custom panel). Purely presentational; engines wire callbacks.
 */
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

export interface FindReplaceOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface FindReplacePanelProps {
  query: string;
  onQueryChange: (q: string) => void;
  replaceValue: string;
  onReplaceChange: (r: string) => void;
  options: FindReplaceOptions;
  onOptionsChange: (opts: FindReplaceOptions) => void;
  /** 1-based index of the active match; 0 when none is active. */
  current: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export function FindReplacePanel({
  query,
  onQueryChange,
  replaceValue,
  onReplaceChange,
  options,
  onOptionsChange,
  current,
  total,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplacePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const counter =
    query === ""
      ? ""
      : total === 0
        ? strings.editor.findNoMatches
        : `${Math.min(current || 1, total)} de ${total}`;

  return (
    <div
      className="flex shrink-0 flex-col gap-1.5 border-b bg-surface px-2 py-1.5 text-xs"
      data-testid="find-panel"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          data-testid="find-input"
          placeholder={strings.editor.findPlaceholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.shiftKey ? onPrev : onNext)();
            if (e.key === "Escape") onClose();
          }}
          className="w-44 rounded border bg-background px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
        />
        <span
          className="min-w-16 text-center text-ink-subtle tabular-nums"
          data-testid="find-count"
        >
          {counter}
        </span>
        <PanelButton testid="find-prev" onClick={onPrev} disabled={total === 0}>
          {strings.editor.findPrev}
        </PanelButton>
        <PanelButton testid="find-next" onClick={onNext} disabled={total === 0}>
          {strings.editor.findNext}
        </PanelButton>
        <OptionToggle
          testid="find-case"
          label={strings.editor.findCase}
          short="Aa"
          active={options.caseSensitive}
          onClick={() =>
            onOptionsChange({ ...options, caseSensitive: !options.caseSensitive })
          }
        />
        <OptionToggle
          testid="find-word"
          label={strings.editor.findWord}
          short="ab"
          active={options.wholeWord}
          onClick={() => onOptionsChange({ ...options, wholeWord: !options.wholeWord })}
        />
        <OptionToggle
          testid="find-regex"
          label={strings.editor.findRegex}
          short=".*"
          active={options.regex}
          onClick={() => onOptionsChange({ ...options, regex: !options.regex })}
        />
        <button
          type="button"
          data-testid="find-close"
          title={strings.editor.findClose}
          aria-label={strings.editor.findClose}
          onClick={onClose}
          className="ml-auto rounded p-1 text-ink-muted hover:bg-accent-soft"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          data-testid="find-replace-input"
          placeholder={strings.editor.findReplacePlaceholder}
          value={replaceValue}
          onChange={(e) => onReplaceChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onReplace();
            if (e.key === "Escape") onClose();
          }}
          className="w-44 rounded border bg-background px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
        />
        <PanelButton testid="find-replace" onClick={onReplace} disabled={total === 0}>
          {strings.editor.findReplace}
        </PanelButton>
        <PanelButton
          testid="find-replace-all"
          onClick={onReplaceAll}
          disabled={total === 0}
        >
          {strings.editor.findReplaceAll}
        </PanelButton>
      </div>
    </div>
  );
}

function PanelButton({
  testid,
  onClick,
  disabled,
  children,
}: {
  testid: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      className="rounded border px-2 py-0.5 text-ink-muted hover:bg-accent-soft disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function OptionToggle({
  testid,
  label,
  short,
  active,
  onClick,
}: {
  testid: string;
  label: string;
  short: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-ink-muted",
        active && "border-accent bg-accent-soft text-accent-strong",
      )}
    >
      {short}
    </button>
  );
}
