/**
 * "Novo capítulo" modal (QA §M1) — replaces the native window.prompt with an
 * in-app dialog: empty titles never create (button disabled), Enter submits,
 * Escape/backdrop dismisses.
 *
 * O destino escolhe entre capítulo, apêndice e anexo: são a mesma operação
 * (criar arquivo + inserir o \input no bloco certo), com pastas e comandos
 * diferentes — ver `new-chapter.ts`.
 */
import { useEffect, useRef, useState } from "react";
import type { SectionTarget } from "@/features/project/new-chapter";
import { strings } from "@/lib/strings";

export interface NewChapterDialogProps {
  onCreate: (title: string, target: SectionTarget) => void;
  onClose: () => void;
}

const TARGETS: { value: SectionTarget; label: string }[] = [
  { value: "chapter", label: strings.rail.targetChapter },
  { value: "apendice", label: strings.rail.targetApendice },
  { value: "anexo", label: strings.rail.targetAnexo },
];

export function NewChapterDialog({ onCreate, onClose }: NewChapterDialogProps) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<SectionTarget>("chapter");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trimmed = title.trim();
  const submit = () => {
    if (trimmed) onCreate(trimmed, target);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="new-chapter-dialog"
      onClick={onClose}
      onKeyDown={() => {}}
    >
      <div
        className="w-[26rem] rounded-lg border bg-surface-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
        role="document"
      >
        <div className="font-display text-lg">{strings.rail.newChapter}</div>
        <label
          className="mt-3 block text-ink-muted text-xs"
          htmlFor="new-chapter-title-input"
        >
          {strings.rail.newChapterPrompt}
        </label>
        <input
          ref={inputRef}
          id="new-chapter-title-input"
          data-testid="new-chapter-title"
          type="text"
          value={title}
          placeholder={strings.rail.newChapterPlaceholder}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <label
          className="mt-3 block text-ink-muted text-xs"
          htmlFor="new-chapter-target-input"
        >
          {strings.rail.newChapterTarget}
        </label>
        <select
          id="new-chapter-target-input"
          data-testid="new-chapter-target"
          value={target}
          onChange={(e) => setTarget(e.target.value as SectionTarget)}
          className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        >
          {TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            data-testid="new-chapter-cancel"
            className="rounded px-3 py-1.5 text-ink-muted text-sm hover:bg-surface"
            onClick={onClose}
          >
            {strings.rail.newChapterCancel}
          </button>
          <button
            type="button"
            data-testid="new-chapter-create"
            disabled={!trimmed}
            className="rounded bg-accent px-3 py-1.5 text-accent-foreground text-sm hover:bg-accent-strong disabled:opacity-40"
            onClick={submit}
          >
            {strings.rail.newChapterCreate}
          </button>
        </div>
      </div>
    </div>
  );
}
