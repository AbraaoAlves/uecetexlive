import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGNED_APPROVAL_PATH } from "@/features/project/signed-approval";
import manifest from "../../../../public/templates/uecetex2/manifest.json";
import {
  type AttachmentItem,
  AttachmentsStep,
  FICHA_PATH,
  MAX_ATTACHMENT_BYTES,
  rejectAttachment,
  TEMPLATE_FICHA_BYTES,
} from "../AttachmentsStep";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const bytes = (size: number, magic = "%PDF-") => {
  const value = new Uint8Array(size);
  value.set(new TextEncoder().encode(magic));
  return value;
};

describe("rejectAttachment", () => {
  it("aceita PDF verdadeiro, imagem e código", () => {
    expect(rejectAttachment("documento.pdf", bytes(2_000))).toBeNull();
    expect(rejectAttachment("imagem.png", bytes(2_000, "imagem"))).toBeNull();
    expect(rejectAttachment("script.py", bytes(2_000, "print"))).toBeNull();
  });

  it("recusa tipo desconhecido, PDF falso, vazio e arquivo grande", () => {
    expect(rejectAttachment("texto.docx", bytes(2_000))).toMatch(/imagem|PDF/i);
    expect(rejectAttachment("falso.pdf", bytes(2_000, "<html"))).toMatch(/PDF/i);
    expect(rejectAttachment("vazio.ts", new Uint8Array())).toMatch(/vazio/i);
    expect(rejectAttachment("grande.jpg", bytes(MAX_ATTACHMENT_BYTES + 1))).toMatch(
      /10 MB/,
    );
  });

  it("exige a mesma extensão ao trocar um anexo referenciado", () => {
    expect(
      rejectAttachment("outra.png", bytes(2_000, "imagem"), {
        expectedExtension: "jpg",
      }),
    ).toMatch(/\.jpg/);
  });
});

describe("AttachmentsStep", () => {
  const ficha: AttachmentItem = {
    path: FICHA_PATH,
    sizeBytes: TEMPLATE_FICHA_BYTES,
    kind: "pdf",
    bytes: bytes(2_000),
  };
  const approval: AttachmentItem = {
    path: SIGNED_APPROVAL_PATH,
    sizeBytes: 2_000,
    kind: "pdf",
    bytes: bytes(2_000),
  };
  const image: AttachmentItem = {
    path: "figuras/grafico.png",
    sizeBytes: 3_000,
    kind: "image",
    bytes: bytes(3_000, "imagem"),
  };
  const code: AttachmentItem = {
    path: "figuras/analise.py",
    sizeBytes: 18,
    kind: "code",
    bytes: new TextEncoder().encode("print('resultado')\n"),
  };

  it("mostra os documentos institucionais e os demais anexos", () => {
    render(
      <AttachmentsStep
        attachments={[ficha, approval, image]}
        onAdd={vi.fn()}
        onReplace={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByTestId("attachment-state-ficha").textContent).toMatch(/modelo/i);
    expect(screen.getByTestId("attachment-state-aprovacao").textContent).toMatch(
      /enviado/i,
    );
    expect(screen.getByTestId(`attachment-row-${image.path}`).textContent).toContain(
      "grafico.png",
    );
  });

  it("envia a folha assinada para o caminho canônico", async () => {
    const onReplace = vi.fn();
    render(
      <AttachmentsStep
        attachments={[]}
        onAdd={vi.fn()}
        onReplace={onReplace}
        onDelete={vi.fn()}
      />,
    );

    const file = new File(["%PDF-1.7\n%%EOF"], "folha.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByTestId("attachment-input-aprovacao"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onReplace).toHaveBeenCalledOnce());
    expect(onReplace.mock.calls[0]?.[0]).toBe(SIGNED_APPROVAL_PATH);
  });

  it("exclui um anexo depois da confirmação", () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const onDelete = vi.fn();
    render(
      <AttachmentsStep
        attachments={[image]}
        onAdd={vi.fn()}
        onReplace={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByTestId(`attachment-delete-${image.path}`));
    expect(onDelete).toHaveBeenCalledWith(image.path);
  });

  it("seleciona um item e mostra sua prévia ao lado", () => {
    render(
      <AttachmentsStep
        attachments={[code]}
        onAdd={vi.fn()}
        onReplace={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByTestId("attachment-preview-empty")).toBeTruthy();
    fireEvent.click(screen.getByTestId(`attachment-select-${code.path}`));

    expect(screen.getByTestId(`attachment-row-${code.path}`).dataset.selected).toBe(
      "true",
    );
    expect(screen.getByTestId("attachment-preview-code").textContent).toContain(
      "print('resultado')",
    );
  });
});

describe("sentinela do modelo vendorado", () => {
  it("o tamanho da ficha de exemplo bate com o manifesto", () => {
    const entry = (manifest as { files: { path: string; size: number }[] }).files.find(
      (file) => file.path === FICHA_PATH,
    );
    expect(entry?.size).toBe(TEMPLATE_FICHA_BYTES);
  });
});
