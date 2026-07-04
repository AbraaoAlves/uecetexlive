/**
 * Builds EditorResources from the live project: object URLs for figures,
 * parsed bibliography for citation chips/picker, harvested labels.
 */
import { parse as parseBib } from "@retorquere/bibtex-parser";
import { useEffect, useMemo, useRef } from "react";
import type { IncludeGraph } from "@/features/project/include-graph";
import type { Project } from "@/features/project/schema";
import { bytesToText } from "@/features/project/vfs";
import { slugify } from "@/lib/utils";
import type { BibEntry, EditorResources } from "./resources";

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_EXTENSIONS: Record<string, string> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
};

export function useEditorResources(
  project: Project | null,
  graph: IncludeGraph,
  addFile?: (path: string, bytes: Uint8Array) => void,
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

  return useMemo<EditorResources>(() => {
    const files = project?.files ?? [];

    const bibEntries: BibEntry[] = [];
    const bibPath = graph.bibliography
      ? `${graph.bibliography.replace(/\.bib$/, "")}.bib`
      : null;
    const bibFile = files.find((f) => f.path === bibPath);
    if (bibFile) {
      try {
        const parsed = parseBib(bytesToText(bibFile.bytes));
        for (const entry of parsed.entries) {
          const fields = entry.fields as Record<string, unknown>;
          const authors = (fields.author ?? fields.editor) as
            | { lastName?: string }[]
            | undefined;
          bibEntries.push({
            key: entry.key,
            author: authors?.[0]?.lastName ?? "—",
            title: typeof fields.title === "string" ? fields.title : "",
            year: typeof fields.year === "string" ? fields.year : "s.d.",
          });
        }
      } catch {
        // Malformed bib → picker shows nothing; compile errors surface it.
      }
    }
    const byKey = new Map(bibEntries.map((e) => [e.key, e]));

    return {
      imageUrl: (path) => {
        const cached = urlCache.current.get(path);
        if (cached) return cached;
        const file = files.find(
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
        const file = files.find((f) => f.path === path);
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
      labels: graph.labels,
      imageFiles: files.filter((f) => f.kind === "image").map((f) => f.path),
      codeFiles: files.filter((f) => f.kind === "code").map((f) => f.path),
      uploadImage: async (file) => {
        const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
        const ext = UPLOAD_EXTENSIONS[rawExt];
        if (!addFile || !ext || file.size === 0 || file.size > UPLOAD_MAX_BYTES) {
          return null;
        }
        const base = slugify(file.name.replace(/\.[^.]*$/, "")) || "figura";
        let path = `figuras/${base}.${ext}`;
        for (let n = 2; files.some((f) => f.path === path); n++) {
          path = `figuras/${base}-${n}.${ext}`;
        }
        addFile(path, new Uint8Array(await file.arrayBuffer()));
        return path;
      },
    };
  }, [project, graph, addFile]);
}
