/**
 * WYSIWYG Find & Replace (QA §A2) — a ProseMirror plugin that highlights
 * every match (inline decorations), tracks the active one, and rewrites
 * matches through regular transactions so undo/serialization behave like any
 * other edit. Matches are scanned per text node: a query can't cross a mark
 * boundary — the standard trade-off for rich-text search.
 */
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SearchCriteria {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchPluginState {
  criteria: SearchCriteria;
  matches: SearchMatch[];
  /** 0-based index into matches; -1 when nothing is active. */
  activeIndex: number;
}

export const EMPTY_CRITERIA: SearchCriteria = {
  query: "",
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

export const searchPluginKey = new PluginKey<SearchPluginState>("uecetexSearch");

type SearchMeta =
  | { type: "set"; criteria: SearchCriteria }
  | { type: "next" }
  | { type: "prev" }
  | { type: "clear" };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(criteria: SearchCriteria): RegExp | null {
  if (!criteria.query) return null;
  let pattern = criteria.regex ? criteria.query : escapeRegExp(criteria.query);
  if (criteria.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  try {
    return new RegExp(pattern, criteria.caseSensitive ? "g" : "gi");
  } catch {
    return null; // Malformed user regex → zero matches, never a crash.
  }
}

function findMatches(doc: PMNode, criteria: SearchCriteria): SearchMatch[] {
  const re = buildRegex(criteria);
  if (!re) return [];
  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m = re.exec(node.text);
    while (m !== null) {
      if (m[0].length === 0) {
        re.lastIndex++; // Zero-width regex match — step past to terminate.
      } else {
        matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      }
      m = re.exec(node.text);
    }
  });
  return matches;
}

function decorate(state: SearchPluginState, doc: PMNode): DecorationSet {
  if (state.matches.length === 0) return DecorationSet.empty;
  const decorations = state.matches.map((match, i) =>
    Decoration.inline(match.from, match.to, {
      class:
        i === state.activeIndex
          ? "uecetex-search-match uecetex-search-match-active"
          : "uecetex-search-match",
    }),
  );
  return DecorationSet.create(doc, decorations);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    uecetexSearch: {
      /** Set (or update) the search criteria; recomputes all matches. */
      setSearch: (criteria: SearchCriteria) => ReturnType;
      /** Move to the next match and scroll it into view. */
      findNext: () => ReturnType;
      /** Move to the previous match and scroll it into view. */
      findPrev: () => ReturnType;
      /** Replace the active match, keeping the search alive. */
      replaceActive: (replacement: string) => ReturnType;
      /** Replace every match in one transaction. */
      replaceAllMatches: (replacement: string) => ReturnType;
      /** Drop criteria and highlights. */
      clearSearch: () => ReturnType;
    };
  }
}

export const UecetexSearch = Extension.create({
  name: "uecetexSearch",

  addCommands() {
    return {
      setSearch:
        (criteria: SearchCriteria) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { type: "set", criteria }));
          return true;
        },
      findNext:
        () =>
        ({ state, tr, dispatch }) => {
          const search = searchPluginKey.getState(state);
          if (!search || search.matches.length === 0) return false;
          const next = (search.activeIndex + 1) % search.matches.length;
          const match = search.matches[next];
          if (dispatch && match) {
            tr.setMeta(searchPluginKey, { type: "next" });
            tr.setSelection(TextSelection.create(tr.doc, match.from, match.to));
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
      findPrev:
        () =>
        ({ state, tr, dispatch }) => {
          const search = searchPluginKey.getState(state);
          if (!search || search.matches.length === 0) return false;
          const prev =
            (search.activeIndex - 1 + search.matches.length) % search.matches.length;
          const match = search.matches[prev];
          if (dispatch && match) {
            tr.setMeta(searchPluginKey, { type: "prev" });
            tr.setSelection(TextSelection.create(tr.doc, match.from, match.to));
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
      replaceActive:
        (replacement: string) =>
        ({ state, tr, dispatch }) => {
          const search = searchPluginKey.getState(state);
          if (!search || search.matches.length === 0) return false;
          const active = search.matches[Math.max(0, search.activeIndex)];
          if (!active) return false;
          if (dispatch) {
            tr.insertText(replacement, active.from, active.to);
            dispatch(tr.scrollIntoView());
          }
          return true;
        },
      replaceAllMatches:
        (replacement: string) =>
        ({ state, tr, dispatch }) => {
          const search = searchPluginKey.getState(state);
          if (!search || search.matches.length === 0) return false;
          if (dispatch) {
            // Back to front so earlier positions stay valid.
            for (let i = search.matches.length - 1; i >= 0; i--) {
              const match = search.matches[i];
              if (match) tr.insertText(replacement, match.from, match.to);
            }
            dispatch(tr);
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { type: "clear" }));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchPluginState>({
        key: searchPluginKey,
        state: {
          init: () => ({ criteria: EMPTY_CRITERIA, matches: [], activeIndex: -1 }),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(searchPluginKey) as SearchMeta | undefined;
            if (meta?.type === "clear") {
              return { criteria: EMPTY_CRITERIA, matches: [], activeIndex: -1 };
            }
            if (meta?.type === "set") {
              const matches = findMatches(newState.doc, meta.criteria);
              return {
                criteria: meta.criteria,
                matches,
                activeIndex: matches.length > 0 ? 0 : -1,
              };
            }
            let { matches, activeIndex } = prev;
            if (tr.docChanged) {
              matches = findMatches(newState.doc, prev.criteria);
              activeIndex = Math.min(activeIndex, matches.length - 1);
              if (matches.length > 0 && activeIndex < 0) activeIndex = 0;
            }
            if (meta?.type === "next" && matches.length > 0) {
              activeIndex = (activeIndex + 1) % matches.length;
            } else if (meta?.type === "prev" && matches.length > 0) {
              activeIndex = (activeIndex - 1 + matches.length) % matches.length;
            }
            if (matches === prev.matches && activeIndex === prev.activeIndex) return prev;
            return { criteria: prev.criteria, matches, activeIndex };
          },
        },
        props: {
          decorations(state) {
            const search = searchPluginKey.getState(state);
            if (!search) return DecorationSet.empty;
            return decorate(search, state.doc);
          },
        },
      }),
    ];
  },
});
