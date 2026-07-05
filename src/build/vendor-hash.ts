/**
 * Fingerprints the vendored LaTeX engines + template (public/wasm,
 * public/templates) so the service worker can rename its runtime cache
 * whenever any of them change (src/sw.ts, VITE_VENDOR_HASH). Without this,
 * a browser that already warmed up busytex/swiftlatex keeps serving the old
 * binaries forever after a deploy — the cache is CacheFirst with no TTL and
 * the filenames are static.
 *
 * Hashes every file's content directly (relative path + bytes) rather than
 * trusting the per-engine manifest.json sidecars — busytex's inject/
 * subtree (abnTeX2 patch files) is listed in its own plain-name manifest,
 * not the sha256 one, and swiftlatex has no manifest at all, so a
 * manifest-only fingerprint would silently miss real content changes. A
 * full walk of both trees (~320 MB) takes about a second, so there's no
 * need for the shortcut.
 */
import { createHash, type Hash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const VENDOR_DIRS = ["public/wasm", "public/templates"];

export function computeVendorHash(root: string): string {
  const hash = createHash("sha256");
  for (const dir of VENDOR_DIRS) {
    hashDirectory(root, join(root, dir), hash);
  }
  return hash.digest("hex").slice(0, 12);
}

function hashDirectory(root: string, dir: string, hash: Hash): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      hashDirectory(root, full, hash);
    } else {
      // Relative + POSIX-normalized so the fingerprint depends only on
      // vendored content, never on the absolute checkout path.
      hash.update(relative(root, full).split(sep).join("/"));
      hash.update(readFileSync(full));
    }
  }
}
