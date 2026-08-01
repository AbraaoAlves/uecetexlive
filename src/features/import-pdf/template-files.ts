/**
 * Esqueleto do modelo como mapa de bytes, para alimentar o worker.
 *
 * Reaproveita o mesmo caminho do seed: manifesto + arquivos servidos de
 * `public/templates/uecetex2/`, já cacheados pelo service worker.
 */
import { fetchTemplateManifest } from "@/features/project/seed";

const TEMPLATE_BASE = `${import.meta.env.BASE_URL}templates/uecetex2`;

export async function fetchTemplateFiles(): Promise<Map<string, Uint8Array>> {
  const manifest = await fetchTemplateManifest();
  const entries = await Promise.all(
    manifest.files.map(async (entry) => {
      const res = await fetch(`${TEMPLATE_BASE}/files/${entry.path}`);
      if (!res.ok) throw new Error(`${entry.path}: HTTP ${res.status}`);
      return [entry.path, new Uint8Array(await res.arrayBuffer())] as const;
    }),
  );
  return new Map(entries);
}
