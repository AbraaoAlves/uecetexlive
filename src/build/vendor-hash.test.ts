import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeVendorHash } from "./vendor-hash";

describe("computeVendorHash", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vendor-hash-"));
    mkdirSync(join(root, "public/wasm/busytex/inject"), { recursive: true });
    mkdirSync(join(root, "public/wasm/swiftlatex/texlive"), { recursive: true });
    mkdirSync(join(root, "public/templates/uecetex2/files"), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("is stable for identical content", () => {
    writeFileSync(join(root, "public/wasm/busytex/manifest.json"), '{"files":[]}');
    writeFileSync(join(root, "public/wasm/swiftlatex/PdfTeXEngine.js"), "// engine");

    expect(computeVendorHash(root)).toBe(computeVendorHash(root));
  });

  it("changes when a manifest changes", () => {
    writeFileSync(join(root, "public/wasm/busytex/manifest.json"), '{"files":[]}');
    const before = computeVendorHash(root);

    writeFileSync(join(root, "public/wasm/busytex/manifest.json"), '{"files":["x"]}');
    expect(computeVendorHash(root)).not.toBe(before);
  });

  it("changes when a swiftlatex file (no manifest at all) changes", () => {
    writeFileSync(join(root, "public/wasm/swiftlatex/PdfTeXEngine.js"), "// v1");
    const before = computeVendorHash(root);

    writeFileSync(join(root, "public/wasm/swiftlatex/PdfTeXEngine.js"), "// v2");
    expect(computeVendorHash(root)).not.toBe(before);
  });

  it("changes when a busytex inject/ file changes (not covered by the sha256 manifest)", () => {
    writeFileSync(join(root, "public/wasm/busytex/inject/abntex2.cls"), "% v1");
    const before = computeVendorHash(root);

    writeFileSync(join(root, "public/wasm/busytex/inject/abntex2.cls"), "% v2");
    expect(computeVendorHash(root)).not.toBe(before);
  });

  it("changes when a template file changes", () => {
    writeFileSync(join(root, "public/templates/uecetex2/files/documento.tex"), "v1");
    const before = computeVendorHash(root);

    writeFileSync(join(root, "public/templates/uecetex2/files/documento.tex"), "v2");
    expect(computeVendorHash(root)).not.toBe(before);
  });

  it("picks up nested texlive/ files", () => {
    const before = computeVendorHash(root);
    writeFileSync(join(root, "public/wasm/swiftlatex/texlive/cmr12.tfm"), "font-bytes");
    expect(computeVendorHash(root)).not.toBe(before);
  });

  it("does not depend on the absolute checkout path", () => {
    writeFileSync(
      join(root, "public/wasm/swiftlatex/PdfTeXEngine.js"),
      "// same content",
    );

    const other = mkdtempSync(join(tmpdir(), "vendor-hash-elsewhere-"));
    try {
      mkdirSync(join(other, "public/wasm/swiftlatex"), { recursive: true });
      writeFileSync(
        join(other, "public/wasm/swiftlatex/PdfTeXEngine.js"),
        "// same content",
      );
      expect(computeVendorHash(root)).toBe(computeVendorHash(other));
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it("does not throw when vendor directories are entirely absent", () => {
    const empty = mkdtempSync(join(tmpdir(), "vendor-hash-empty-"));
    try {
      expect(() => computeVendorHash(empty)).not.toThrow();
      expect(computeVendorHash(empty)).toMatch(/^[0-9a-f]{12}$/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("is unaffected by an unrelated file outside public/wasm and public/templates", () => {
    writeFileSync(join(root, "public/wasm/busytex/manifest.json"), '{"files":[]}');
    const before = computeVendorHash(root);

    mkdirSync(join(root, "public/unrelated"), { recursive: true });
    writeFileSync(join(root, "public/unrelated/note.txt"), "hello");
    expect(computeVendorHash(root)).toBe(before);
  });
});
