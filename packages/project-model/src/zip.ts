/**
 * ZIP import/export (§5.4) — the interop story with Overleaf/local TeX.
 * Export is byte-identical to what latexmk needs locally.
 */
import { unzipSync, zipSync } from "fflate";
import { type Project, ProjectFileSchema, ProjectSchema } from "./schema";
import type { TemplateStructure } from "./template-structure";
import { isWysiwygEligible, kindOf } from "./vfs";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export function exportProjectZip(project: Project): Uint8Array {
  const tree: Record<string, Uint8Array> = {};
  for (const file of project.files) tree[file.path] = file.bytes;
  return zipSync(tree);
}

export interface ImportProjectZipOptions {
  structure: TemplateStructure;
  /** Registrado no Project resultante como origem do template. */
  templateSource: string;
  /** Entry preferido quando presente no ZIP (ex.: "documento.tex"). */
  preferredEntry: string;
}

export async function importProjectZip(
  zipBytes: Uint8Array,
  id: string,
  options: ImportProjectZipOptions,
): Promise<Project> {
  if (zipBytes.length > MAX_ZIP_BYTES) {
    throw new Error("ZIP excede o limite de 50 MB");
  }
  const entries = unzipSync(zipBytes);

  const files = Object.entries(entries)
    .filter(([path, bytes]) => !path.endsWith("/") && bytes.length >= 0)
    .flatMap(([path, bytes]) => {
      const candidate = {
        path,
        bytes,
        kind: kindOf(path),
        editable: isWysiwygEligible(options.structure, path),
      };
      const parsed = ProjectFileSchema.safeParse(candidate);
      return parsed.success ? [parsed.data] : []; // drop unsafe paths
    });

  const texFiles = files.filter((f) => f.path.endsWith(".tex"));
  if (texFiles.length === 0) {
    throw new Error("O ZIP não contém nenhum arquivo .tex");
  }

  const entry =
    texFiles.find((f) => f.path === options.preferredEntry)?.path ??
    texFiles
      .filter((f) => !f.path.includes("/"))
      .sort((a, b) => b.bytes.length - a.bytes.length)[0]?.path ??
    texFiles[0]?.path;

  return ProjectSchema.parse({
    schemaVersion: 1,
    id,
    name: id,
    entry,
    templateSource: options.templateSource,
    files,
    updatedAt: Date.now(),
  });
}
