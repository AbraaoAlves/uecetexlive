import { useEffect, useState } from "react";
import { strings } from "@/lib/strings";

export interface SourceEditorProps {
  path: string;
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
}

/**
 * Plain monospace source view (§4.6 — YAGNI: CodeMirror only if pain is
 * proven). Local state mirrors the prop so typing stays responsive while
 * autosave debounces upstream.
 */
export function SourceEditor({ path, text, readOnly, onChange }: SourceEditorProps) {
  const [value, setValue] = useState(text);

  // Re-sync when switching files (path change) or external updates land.
  // biome-ignore lint/correctness/useExhaustiveDependencies: path is the reset key
  useEffect(() => {
    setValue(text);
  }, [path]);

  return (
    <textarea
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
