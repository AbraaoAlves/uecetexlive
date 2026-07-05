/**
 * Template seeding (§5.5): first boot fetches the vendored manifest, loads
 * all files into a new Project.
 *
 * Onde o template mora (URL base) e como seus arquivos se comportam
 * (TemplateStructure) são decisões do app consumidor — nada de
 * import.meta.env aqui dentro.
 */

import { type Project, ProjectSchema, TemplateManifestSchema } from "./schema";
import type { TemplateStructure } from "./template-structure";
import { isWysiwygEligible, kindOf } from "./vfs";

export interface SeedTemplateOptions {
  /** Base URL onde manifest.json e files/ do template estão servidos. */
  templateBaseUrl: string;
  structure: TemplateStructure;
}

export async function seedTemplate(options: SeedTemplateOptions): Promise<Project> {
  const { templateBaseUrl, structure } = options;
  const manifestRes = await fetch(`${templateBaseUrl}/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`template manifest: HTTP ${manifestRes.status}`);
  }
  const manifest = TemplateManifestSchema.parse(await manifestRes.json());

  const files = await Promise.all(
    manifest.files.map(async (entry) => {
      const res = await fetch(`${templateBaseUrl}/files/${entry.path}`);
      if (!res.ok) {
        throw new Error(`template file ${entry.path}: HTTP ${res.status}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length !== entry.size) {
        throw new Error(
          `template file ${entry.path}: size ${bytes.length} != manifest ${entry.size}`,
        );
      }
      return {
        path: entry.path,
        bytes,
        kind: kindOf(entry.path),
        editable: isWysiwygEligible(structure, entry.path),
      };
    }),
  );

  return ProjectSchema.parse({
    schemaVersion: 1,
    id: manifest.name,
    name: manifest.name,
    entry: manifest.entry,
    templateSource: manifest.source,
    files,
    updatedAt: Date.now(),
  });
}
