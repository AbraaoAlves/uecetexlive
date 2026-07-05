import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  openSearchPanel,
  replaceAll,
  replaceNext,
  SearchQuery,
  search,
  searchKeymap,
  setSearchQuery,
} from "@codemirror/search";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type Panel,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { type FindReplaceOptions, FindReplacePanel } from "./FindReplacePanel";
import { type EditorStrings, useEditorStrings } from "./strings";

export interface SourceEditorProps {
  path: string;
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
  /** 1-based line to select/scroll to (compile-error mapping, §4.7). */
  focusLine?: number | null;
}

/** Marks doc replacements the component makes itself (file switch / external
 * update) so the update listener does not echo them back through onChange. */
const External = Annotation.define<boolean>();

/**
 * CodeMirror search panel replaced by the shared FindReplacePanel (QA §B1):
 * same UI as the WYSIWYG surface, plus the "n de m" occurrence counter the
 * built-in panel lacks. Local state drives a SearchQuery effect; counting
 * runs against the live doc on every doc/selection change (`version`).
 */
function CMSearchPanel({
  view,
  version,
  strings,
}: {
  view: EditorView;
  version: number;
  strings: EditorStrings;
}) {
  const [query, setQuery] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [options, setOptions] = useState<FindReplaceOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });

  const buildQuery = (replace: string) =>
    new SearchQuery({
      search: query,
      caseSensitive: options.caseSensitive,
      regexp: options.regex,
      wholeWord: options.wholeWord,
      replace,
    });

  // Keep CM's search state (highlights, replace source) in sync.
  // biome-ignore lint/correctness/useExhaustiveDependencies: buildQuery derives from these deps
  useEffect(() => {
    view.dispatch({ effects: setSearchQuery.of(buildQuery(replaceValue)) });
  }, [view, query, options, replaceValue]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version tracks doc/selection changes
  const counts = useMemo(() => {
    if (!query) return { current: 0, total: 0 };
    let cursor: Iterator<{ from: number; to: number }>;
    try {
      cursor = buildQuery(replaceValue).getCursor(view.state) as Iterator<{
        from: number;
        to: number;
      }>;
    } catch {
      return { current: 0, total: 0 }; // malformed user regex
    }
    const sel = view.state.selection.main;
    let total = 0;
    let current = 0;
    for (let r = cursor.next(); !r.done && total < 10_000; r = cursor.next()) {
      total++;
      if (r.value.from === sel.from && r.value.to === sel.to) current = total;
    }
    return { current, total };
  }, [view, version, query, options, replaceValue]);

  return (
    <FindReplacePanel
      strings={strings}
      query={query}
      onQueryChange={setQuery}
      replaceValue={replaceValue}
      onReplaceChange={setReplaceValue}
      options={options}
      onOptionsChange={setOptions}
      current={counts.current}
      total={counts.total}
      onNext={() => findNext(view)}
      onPrev={() => findPrevious(view)}
      onReplace={() => replaceNext(view)}
      onReplaceAll={() => replaceAll(view)}
      onClose={() => {
        closeSearchPanel(view);
        view.focus();
      }}
    />
  );
}

/** CM panel host: one React root, re-rendered when doc/selection change.
 * A copy atravessa por argumento — context não cruza a fronteira de roots. */
function createFindPanel(view: EditorView, strings: EditorStrings): Panel {
  const dom = document.createElement("div");
  const root = createRoot(dom);
  let version = 0;
  const render = () =>
    root.render(<CMSearchPanel view={view} version={version} strings={strings} />);
  return {
    dom,
    top: true,
    mount: render,
    update: (update) => {
      if (update.docChanged || update.selectionSet) {
        version++;
        render();
      }
    },
    destroy: () => queueMicrotask(() => root.unmount()),
  };
}

const uecetexTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    lineHeight: "1.6",
    padding: "0.5rem 0",
  },
  ".cm-content": { padding: "0 1rem" },
  "&.cm-focused": { outline: "none" },
});

/**
 * LaTeX source view (§4.6): CodeMirror 6 with stex highlighting, line
 * numbers and a pt-BR find/replace panel (Ctrl+F). Ground truth stays the
 * project store — local edits flow up through onChange; external updates
 * (surgical metadata writes, file switch) are re-seeded without an echo.
 */
export function SourceEditor({
  path,
  text,
  readOnly,
  onChange,
  focusLine,
}: SourceEditorProps) {
  const strings = useEditorStrings();
  const stringsRef = useRef(strings);
  stringsRef.current = strings;
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const readOnlyComp = useRef(new Compartment());
  const loadedPath = useRef(path);
  // Full document mirror for e2e/value assertions — CodeMirror virtualizes
  // lines, so the DOM never holds the whole source at once.
  const [mirror, setMirror] = useState(text);

  // Create the view once per mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only setup
  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current ?? undefined,
      state: EditorState.create({
        doc: text,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          search({
            top: true,
            createPanel: (panelView) => createFindPanel(panelView, stringsRef.current),
          }),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          StreamLanguage.define(stex),
          placeholderExt(strings.editor.placeholder),
          EditorView.lineWrapping,
          uecetexTheme,
          readOnlyComp.current.of(EditorState.readOnly.of(readOnly)),
          EditorView.contentAttributes.of({ "data-testid": "source-editor-input" }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const value = update.state.doc.toString();
            setMirror(value);
            const external = update.transactions.some((t) => t.annotation(External));
            if (!external) onChangeRef.current(value);
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Re-seed on file switch or external update (e.g. surgical metadata write);
  // never on our own onChange echoes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === text) {
      if (loadedPath.current !== path) loadedPath.current = path;
      return;
    }
    loadedPath.current = path;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: text },
      annotations: External.of(true),
    });
    setMirror(text);
  }, [path, text]);

  // Reconfigure read-only without rebuilding the view.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyComp.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Compile-error mapping (§4.7): select + scroll to a 1-based line.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !focusLine) return;
    const line = view.state.doc.line(Math.min(focusLine, view.state.doc.lines));
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
  }, [focusLine]);

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
      data-testid="source-editor"
    >
      <div className="flex h-8 shrink-0 items-center justify-end border-b bg-surface px-2">
        <button
          type="button"
          data-testid="source-find"
          title={strings.editor.findHint}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-ink-muted text-xs hover:bg-accent-soft"
          onClick={() => {
            const view = viewRef.current;
            if (!view) return;
            openSearchPanel(view);
          }}
        >
          <Search className="size-3.5" />
          {strings.editor.find}
        </button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
      <textarea
        data-testid="source-editor-value"
        aria-hidden="true"
        tabIndex={-1}
        readOnly
        value={mirror}
        onChange={() => {}}
        className="sr-only"
      />
    </div>
  );
}
