/**
 * Builds EditorResources from the live project: object URLs for figures,
 * parsed bibliography for citation chips/picker, harvested labels.
 */

import { bytesToText, type Project } from "@papyru/project-model";
import { parse as parseBib } from "@retorquere/bibtex-parser";
import { useEffect, useMemo, useRef } from "react";
import type { BibEntry, EditorResources } from "./resources";
import { slugify } from "./utils";

/**
 * O que o editor precisa do include graph do projeto — subconjunto
 * estrutural; o app passa o IncludeGraph completo (§5.3) sem adaptação.
 */
export interface EditorResourceGraph {
  labels: string[];
  bibliography: string | null;
}

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
// PDF included (QA §A4): vector plots and fichas are legitimate figures —
// \includegraphics accepts them directly.
const UPLOAD_EXTENSIONS: Record<string, string> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  pdf: "pdf",
};

const NO_FILES: Project["files"] = [];

export function useEditorResources(
  project: Project | null,
  graph: EditorResourceGraph,
  addFile?: (path: string, bytes: Uint8Array) => void,
  /** Diretório de figuras do template (upload + picker) — uecetex2: figuras/. */
  figuresDir = "figuras",
): EditorResources {
  const urlCache = useRef(new Map<string, string>());

  // Revoke object URLs when the project changes/unmounts.
  useEffect(() => {
    const cache = urlCache.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  // Identity firewall (QA rodada 4 §R4): `project` and `graph` get a new
  // identity on every keystroke, but the *content* the resources depend on
  // rarely changes. Closures read the live refs; the memos key on cheap
  // value-equal strings so `resources` keeps its identity while typing —
  // otherwise every citation/figure node view re-renders per keystroke and
  // the whole .bib is re-parsed.
  const files = project?.files ?? NO_FILES;
  const filesRef = useRef(files);
  filesRef.current = files;
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const bibPath = graph.bibliography
    ? `${graph.bibliography.replace(/\.bib$/, "")}.bib`
    : null;
  const bibFile = bibPath ? files.find((f) => f.path === bibPath) : undefined;
  // Decoding ~KBs per render is negligible; equal content yields the same
  // string primitive, so the parse memo below holds while typing prose.
  const bibText = bibFile ? bytesToText(bibFile.bytes) : null;

  const bibEntries = useMemo<BibEntry[]>(() => {
    if (bibText === null) return [];
    const entries: BibEntry[] = [];
    try {
      const parsed = parseBib(bibText);
      for (const entry of parsed.entries) {
        const fields = entry.fields as Record<string, unknown>;
        const authors = (fields.author ?? fields.editor) as
          | { lastName?: string }[]
          | undefined;
        entries.push({
          key: entry.key,
          author: authors?.[0]?.lastName ?? "—",
          title: typeof fields.title === "string" ? fields.title : "",
          year: typeof fields.year === "string" ? fields.year : "s.d.",
        });
      }
    } catch {
      // Malformed bib → picker shows nothing; compile errors surface it.
    }
    return entries;
  }, [bibText]);

  const pathsKey = files.map((f) => `${f.kind}:${f.path}`).join("\n");
  const labelsKey = graph.labels.join("\n");

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathsKey/labelsKey are content stand-ins for the per-keystroke files/graph identities read via refs inside.
  return useMemo<EditorResources>(() => {
    const byKey = new Map(bibEntries.map((e) => [e.key, e]));
    const current = filesRef.current;

    return {
      imageUrl: (path) => {
        const cached = urlCache.current.get(path);
        if (cached) return cached;
        const file = filesRef.current.find(
          (f) =>
            f.path === path ||
            f.path === `${path}.png` ||
            f.path === `${path}.jpg` ||
            f.path === `${path}.jpeg` ||
            f.path === `${path}.pdf`,
        );
        if (!file) return null;
        const copy = new Uint8Array(file.bytes);
        const ext = file.path.split(".").pop()?.toLowerCase();
        const mime =
          ext === "png" ? "image/png" : ext === "pdf" ? "application/pdf" : "image/jpeg";
        const url = URL.createObjectURL(
          new Blob([copy.buffer as ArrayBuffer], { type: mime }),
        );
        urlCache.current.set(path, url);
        return url;
      },
      textFilePreview: (path, lines) => {
        const file = filesRef.current.find((f) => f.path === path);
        if (!file) return null;
        return bytesToText(file.bytes).split("\n").slice(0, lines).join("\n");
      },
      citationLabel: (keys) =>
        `(${keys
          .map((key) => {
            const entry = byKey.get(key);
            return entry ? `${entry.author.toUpperCase()}, ${entry.year}` : `${key}?`;
          })
          .join("; ")})`,
      bibEntries,
      labels: graphRef.current.labels,
      imageFiles: current
        .filter(
          (f) =>
            f.kind === "image" ||
            (f.kind === "pdf" && f.path.startsWith(`${figuresDir}/`)),
        )
        .map((f) => f.path),
      codeFiles: current.filter((f) => f.kind === "code").map((f) => f.path),
      uploadImage: async (file) => {
        const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
        const ext = UPLOAD_EXTENSIONS[rawExt];
        if (!addFile || !ext || file.size === 0 || file.size > UPLOAD_MAX_BYTES) {
          return null;
        }
        const base = slugify(file.name.replace(/\.[^.]*$/, "")) || "figura";
        let path = `${figuresDir}/${base}.${ext}`;
        for (let n = 2; filesRef.current.some((f) => f.path === path); n++) {
          path = `${figuresDir}/${base}-${n}.${ext}`;
        }
        addFile(path, new Uint8Array(await file.arrayBuffer()));
        return path;
      },
      // No-op defaults (v0.4 §2): searching external sources and resolving
      // library dedup are product concerns the consuming app owns — see
      // EditorArea.tsx in Papyru, which overrides both on top of this hook's
      // result. This package has no notion of CSL-JSON/DOI/ISBN.
      searchCitations: async () => [],
      confirmCitation: (key) => key,
    };
  }, [bibEntries, pathsKey, labelsKey, addFile, figuresDir]);
}
