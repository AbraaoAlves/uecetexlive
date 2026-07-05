/**
 * Best-effort, informational check: is the bundled uecetex2 template newer
 * than the commit this project was seeded from? Never touches project
 * files — a mismatch only surfaces a dismissible banner (AppShell).
 */
import { useEffect, useState } from "react";
import { fetchTemplateManifest } from "./seed";

export function useTemplateUpdateNotice(seededCommit: string | undefined): {
  latestCommit: string | null;
} {
  const [latestCommit, setLatestCommit] = useState<string | null>(null);

  useEffect(() => {
    // No recorded baseline (legacy project, or a ZIP import) — nothing to
    // compare against, so never show the banner.
    if (!seededCommit) return;
    let cancelled = false;
    fetchTemplateManifest()
      .then((manifest) => {
        if (!cancelled && manifest.commit !== seededCommit) {
          setLatestCommit(manifest.commit);
        }
      })
      .catch(() => {
        // Offline, SPA-fallback HTML, schema drift — stay silent.
      });
    return () => {
      cancelled = true;
    };
  }, [seededCommit]);

  return { latestCommit };
}
