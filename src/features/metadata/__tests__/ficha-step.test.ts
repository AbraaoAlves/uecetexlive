import { describe, expect, it } from "vitest";
import manifest from "../../../../public/templates/uecetex2/manifest.json";
import { rejectFicha, TEMPLATE_FICHA_BYTES } from "../FichaStep";

const pdf = (size: number, magic = "%PDF-") => {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode(magic));
  return bytes;
};

describe("rejectFicha", () => {
  it("aceita um PDF de verdade", () => {
    expect(rejectFicha("ficha.pdf", pdf(2000))).toBeNull();
  });

  it("recusa outra extensão", () => {
    expect(rejectFicha("ficha.docx", pdf(2000))).toMatch(/PDF/i);
  });

  it("recusa arquivo que só tem nome de PDF", () => {
    expect(rejectFicha("ficha.pdf", pdf(2000, "<html"))).toMatch(/PDF/i);
  });

  it("recusa acima de 5 MB", () => {
    expect(rejectFicha("ficha.pdf", pdf(6 * 1024 * 1024))).toMatch(/5 MB/);
  });
});

describe("sentinela do modelo vendorado", () => {
  it("o tamanho da ficha de exemplo bate com o manifesto", () => {
    const entry = (manifest as { files: { path: string; size: number }[] }).files.find(
      (f) => f.path === "elementos-pre-textuais/ficha-catalografica.pdf",
    );
    expect(entry?.size).toBe(TEMPLATE_FICHA_BYTES);
  });
});
