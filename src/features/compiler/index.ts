/**
 * Lazy factory per engine id (§3.2). Engine modules are client-only, loaded
 * via dynamic import() from event handlers — never from route module graphs.
 */
import type { PdfCompiler } from "./types";

const cache = new Map<string, Promise<PdfCompiler>>();

export function getCompiler(
  id: "busytex-full" | "swiftlatex-draft",
): Promise<PdfCompiler> {
  let cached = cache.get(id);
  if (!cached) {
    cached =
      id === "busytex-full"
        ? import("./busytex/BusytexFullCompiler").then((m) => new m.BusytexFullCompiler())
        : import("./swiftlatex/SwiftLatexDraftCompiler").then(
            (m) => new m.SwiftLatexDraftCompiler(),
          );
    cache.set(id, cached);
  }
  return cached;
}

export type * from "./types";
