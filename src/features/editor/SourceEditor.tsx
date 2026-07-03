import { useEffect, useRef, useState } from "react";
import { strings } from "@/lib/strings";

export interface SourceEditorProps {
  path: string;
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
  /** 1-based line to select/scroll to (compile-error mapping, §4.7). */
  focusLine?: number | null;
}

/**
 * Plain monospace source view (§4.6 — YAGNI: CodeMirror only if pain is
 * proven). Local state mirrors the prop so typing stays responsive while
 * autosave debounces upstream.
 */
export function SourceEditor({
  path,
  text,
  readOnly,
  onChange,
  focusLine,
}: SourceEditorProps) {
  const [value, setValue] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Re-sync when switching files (path change) or external updates land.
  // biome-ignore lint/correctness/useExhaustiveDependencies: path is the reset key
  useEffect(() => {
    setValue(text);
  }, [path]);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea || !focusLine) return;
    const lines = textarea.value.split("\n");
    const start =
      lines.slice(0, focusLine - 1).join("\n").length + (focusLine > 1 ? 1 : 0);
    const end = start + (lines[focusLine - 1]?.length ?? 0);
    textarea.focus();
    textarea.setSelectionRange(start, end);
    // Rough scroll: line height ~20px at 13px mono.
    textarea.scrollTop = Math.max(0, (focusLine - 5) * 20);
  }, [focusLine]);

  return (
    <textarea
      ref={ref}
      data-testid="source-editor"
      className="h-full w-full resize-none bg-background p-6 font-mono text-[13px] leading-relaxed outline-none"
      value={value}
      spellCheck={false}
      readOnly={readOnly}
      placeholder={strings.editor.placeholder}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}
