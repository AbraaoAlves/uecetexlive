import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UECETEX2_STRUCTURE } from "../template-structure";
import {
  isAdvancedOnly,
  isSimpleModeVisible,
  isWysiwygEligible,
  railSectionOf,
} from "../vfs";

/**
 * Regressão da extração do pacote: para cada path do projeto seed, as
 * funções dirigidas por UECETEX2_STRUCTURE retornam exatamente o que a
 * implementação hardcoded retornava. O "legado" abaixo é a cópia literal
 * das regras removidas de src/features/project/vfs.ts.
 */

const PROSE_PRE_TEXTUALS = new Set([
  "elementos-pre-textuais/resumo.tex",
  "elementos-pre-textuais/abstract.tex",
  "elementos-pre-textuais/dedicatoria.tex",
  "elementos-pre-textuais/epigrafe.tex",
  "elementos-pre-textuais/agradecimentos.tex",
]);

function legacyIsWysiwygEligible(path: string): boolean {
  if (!path.endsWith(".tex")) return false;
  if (path.startsWith("elementos-textuais/")) return true;
  if (path.startsWith("elementos-pos-textuais/apendices/")) return true;
  if (path.startsWith("elementos-pos-textuais/anexos/")) return true;
  return PROSE_PRE_TEXTUALS.has(path);
}

function legacyRailSectionOf(path: string): string {
  if (path.startsWith("elementos-pre-textuais/")) return "preTextual";
  if (path.startsWith("elementos-textuais/")) return "chapters";
  if (path.startsWith("elementos-pos-textuais/")) return "postTextual";
  if (path.startsWith("lib/")) return "library";
  if (path.startsWith("figuras/")) return "figures";
  return "root";
}

function legacyIsAdvancedOnly(path: string): boolean {
  return path.startsWith("lib/") || path === "documento.tex";
}

function legacyIsSimpleModeVisible(path: string): boolean {
  if (legacyIsWysiwygEligible(path)) return true;
  if (path.endsWith(".bib")) return true;
  if (legacyRailSectionOf(path) === "figures") return true;
  return false;
}

const manifest = JSON.parse(
  readFileSync(
    join(__dirname, "../../../../public/templates/uecetex2/manifest.json"),
    "utf-8",
  ),
) as { files: { path: string }[] };

const seedPaths = manifest.files.map((f) => f.path);

// Paths sintéticos além do seed: subdiretórios, raiz, extensões variadas.
const extraPaths = [
  "documento.tex",
  "LICENSE",
  "referencias.bib",
  "elementos-textuais/sub/dir/capitulo.tex",
  "elementos-textuais/notas.md",
  "elementos-pos-textuais/apendices/a/b.tex",
  "elementos-pre-textuais/resumo.tex.bak",
  "figuras/sub/figura.png",
  "lib/sub/pacote.sty",
  "outra-coisa/arquivo.tex",
];

describe("UECETEX2_STRUCTURE ≡ comportamento hardcoded (byte-a-byte)", () => {
  it("cobre todos os paths do manifest do seed", () => {
    expect(seedPaths.length).toBeGreaterThan(0);
  });

  it.each([...seedPaths, ...extraPaths])("%s", (path) => {
    expect(isWysiwygEligible(UECETEX2_STRUCTURE, path)).toBe(
      legacyIsWysiwygEligible(path),
    );
    expect(railSectionOf(UECETEX2_STRUCTURE, path)).toBe(legacyRailSectionOf(path));
    expect(isAdvancedOnly(UECETEX2_STRUCTURE, path)).toBe(legacyIsAdvancedOnly(path));
    expect(isSimpleModeVisible(UECETEX2_STRUCTURE, path)).toBe(
      legacyIsSimpleModeVisible(path),
    );
  });
});
