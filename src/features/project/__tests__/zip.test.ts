import { describe, expect, it } from "vitest";
import type { Project } from "../schema";
import { textToBytes } from "../vfs";
import { exportProjectZip, importProjectZip } from "../zip";

const makeProject = (): Project => ({
  schemaVersion: 1,
  id: "uecetex2",
  name: "uecetex2",
  entry: "documento.tex",
  templateSource: "https://github.com/thiagodnf/uecetex2",
  updatedAt: 123,
  files: [
    {
      path: "documento.tex",
      bytes: textToBytes("\\documentclass{abntex2}\\begin{document}x\\end{document}"),
      kind: "tex",
      editable: false,
    },
    {
      path: "elementos-textuais/introducao.tex",
      bytes: textToBytes("\\chapter{Introdução}\n\nOlá çãõ."),
      kind: "tex",
      editable: true,
    },
    {
      path: "figuras/figura-1.jpg",
      // Binary fidelity: non-UTF8 bytes must survive (§3.8).
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x80, 0xfe]),
      kind: "image",
      editable: false,
    },
  ],
});

describe("zip round-trip (§5.4)", () => {
  it("export → import → deep-equal VFS", async () => {
    const project = makeProject();
    const zip = exportProjectZip(project);
    expect(zip.length).toBeGreaterThan(100);

    const imported = await importProjectZip(zip, "roundtrip");
    expect(imported.entry).toBe("documento.tex");
    expect(imported.files).toHaveLength(3);
    for (const original of project.files) {
      const restored = imported.files.find((f) => f.path === original.path);
      expect(restored, original.path).toBeDefined();
      expect(Array.from(restored?.bytes ?? [])).toEqual(Array.from(original.bytes));
      expect(restored?.kind).toBe(original.kind);
    }
  });

  it("import picks documento.tex as entry when present", async () => {
    const zip = exportProjectZip(makeProject());
    const imported = await importProjectZip(zip, "x");
    expect(imported.entry).toBe("documento.tex");
  });

  it("import falls back to the largest root .tex", async () => {
    const project = makeProject();
    project.files = [
      {
        path: "main.tex",
        bytes: textToBytes("\\documentclass{article}longer content here"),
        kind: "tex",
        editable: false,
      },
      {
        path: "tiny.tex",
        bytes: textToBytes("x"),
        kind: "tex",
        editable: false,
      },
    ];
    const zip = exportProjectZip(project);
    const imported = await importProjectZip(zip, "x");
    expect(imported.entry).toBe("main.tex");
  });

  it("rejects zips without any .tex", async () => {
    const project = makeProject();
    project.files = [project.files[2] as (typeof project.files)[number]];
    const zip = exportProjectZip(project);
    await expect(importProjectZip(zip, "x")).rejects.toThrow(/\.tex/);
  });

  it("sanitizes traversal paths away", async () => {
    const { zipSync } = await import("fflate");
    const evil = zipSync({
      "documento.tex": textToBytes("ola"),
      "../evil.txt": textToBytes("nope"),
    });
    const imported = await importProjectZip(evil, "x");
    expect(imported.files.map((f) => f.path)).toEqual(["documento.tex"]);
  });

  it("enforces the 50 MB cap", async () => {
    const big = new Uint8Array(51 * 1024 * 1024);
    await expect(importProjectZip(big, "x")).rejects.toThrow(/50/);
  });
});
