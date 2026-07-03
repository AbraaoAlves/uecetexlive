/**
 * Template seeding (§5.5): first boot fetches the vendored manifest, loads
 * all files into a new Project.
 */

import { type Project, ProjectSchema, TemplateManifestSchema } from "./schema";
import { isWysiwygEligible, kindOf } from "./vfs";

const TEMPLATE_BASE = "/templates/uecetex2";

export async function seedTemplate(): Promise<Project> {
  const manifestRes = await fetch(`${TEMPLATE_BASE}/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`template manifest: HTTP ${manifestRes.status}`);
  }
  const manifest = TemplateManifestSchema.parse(await manifestRes.json());

  const files = await Promise.all(
    manifest.files.map(async (entry) => {
      const res = await fetch(`${TEMPLATE_BASE}/files/${entry.path}`);
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
        editable: isWysiwygEligible(entry.path),
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
