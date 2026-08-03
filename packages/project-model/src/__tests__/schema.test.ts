import { describe, expect, it } from "vitest";
import {
  CompileSettingsSchema,
  migrateUiSettings,
  ProjectFileSchema,
  ProjectSchema,
  TemplateManifestSchema,
  UiSettingsSchema,
} from "../schema";

const file = (over: Partial<Record<string, unknown>> = {}) => ({
  path: "elementos-textuais/introducao.tex",
  bytes: new Uint8Array([1, 2, 3]),
  kind: "tex",
  editable: true,
  ...over,
});

describe("ProjectFileSchema", () => {
  it("accepts a valid tex file", () => {
    expect(ProjectFileSchema.parse(file())).toMatchObject({
      path: "elementos-textuais/introducao.tex",
      kind: "tex",
    });
  });

  it("rejects path traversal", () => {
    expect(() => ProjectFileSchema.parse(file({ path: "../etc/passwd" }))).toThrow();
  });

  it("rejects absolute-ish weird paths", () => {
    expect(() => ProjectFileSchema.parse(file({ path: "a b/c.tex" }))).toThrow();
  });

  it("rejects string bytes (binary fidelity §3.8)", () => {
    expect(() => ProjectFileSchema.parse(file({ bytes: "not-bytes" }))).toThrow();
  });

  it("rejects unknown kind", () => {
    expect(() => ProjectFileSchema.parse(file({ kind: "docx" }))).toThrow();
  });
});

describe("ProjectSchema", () => {
  const project = {
    schemaVersion: 1,
    id: "uecetex2",
    name: "uecetex2",
    entry: "documento.tex",
    templateSource: "https://github.com/thiagodnf/uecetex2",
    files: [file()],
    updatedAt: 1234567890,
  };

  it("accepts a valid project", () => {
    expect(ProjectSchema.parse(project).entry).toBe("documento.tex");
  });

  it("rejects wrong schemaVersion", () => {
    expect(() => ProjectSchema.parse({ ...project, schemaVersion: 2 })).toThrow();
  });

  it("rejects non-url templateSource", () => {
    expect(() => ProjectSchema.parse({ ...project, templateSource: "nope" })).toThrow();
  });
});

describe("CompileSettingsSchema", () => {
  it("defaults to draft + no autocompile", () => {
    expect(CompileSettingsSchema.parse({})).toEqual({
      mode: "draft",
      autoCompile: false,
    });
  });
});

describe("UiSettingsSchema", () => {
  it("defaults to simple mode, expanded rail, wizard unseen, system theme", () => {
    expect(UiSettingsSchema.parse({})).toEqual({
      advancedMode: false,
      railCollapsed: false,
      collapsedSections: [],
      welcomeSeen: false,
      dismissedTemplateCommit: null,
      theme: "system",
      railTab: "files",
      sessionCount: 0,
      cumulativeEditMs: 0,
      backupReminderBaselineSession: 0,
      backupReminderBaselineEditMs: 0,
    });
  });

  it("accepts the three theme values and rejects others", () => {
    expect(UiSettingsSchema.parse({ theme: "dark" }).theme).toBe("dark");
    expect(UiSettingsSchema.parse({ theme: "light" }).theme).toBe("light");
    expect(UiSettingsSchema.safeParse({ theme: "sepia" }).success).toBe(false);
  });

  it("rejects legacy blobs with wrong types (falls back to defaults upstream)", () => {
    expect(UiSettingsSchema.safeParse({ advancedMode: "yes" }).success).toBe(false);
  });

  // O schema tem de continuar aceitando "references": um safeParse que falha
  // devolve os defaults inteiros lá em cima, o que apagaria tema, modo
  // avançado e as linhas-base do lembrete de backup junto com a aba.
  it("ainda aceita a aba legada, para não zerar o resto das preferências", () => {
    const parsed = UiSettingsSchema.safeParse({
      railTab: "references",
      theme: "dark",
      advancedMode: true,
      sessionCount: 12,
    });
    expect(parsed.success).toBe(true);
  });

  it("aceita a aba de conformidade", () => {
    expect(UiSettingsSchema.parse({ railTab: "compliance" }).railTab).toBe("compliance");
  });
});

describe("migrateUiSettings", () => {
  it("leva quem estava na aba Referências para a árvore de arquivos", () => {
    const loaded = UiSettingsSchema.parse({
      railTab: "references",
      theme: "dark",
      advancedMode: true,
      sessionCount: 12,
      backupReminderBaselineSession: 7,
    });
    const migrated = migrateUiSettings(loaded);
    expect(migrated.railTab).toBe("files");
    // ...sem levar junto nada mais.
    expect(migrated.theme).toBe("dark");
    expect(migrated.advancedMode).toBe(true);
    expect(migrated.sessionCount).toBe(12);
    expect(migrated.backupReminderBaselineSession).toBe(7);
  });

  it("não mexe em quem já está numa aba atual", () => {
    const files = UiSettingsSchema.parse({ railTab: "files" });
    expect(migrateUiSettings(files)).toBe(files);
    const compliance = UiSettingsSchema.parse({ railTab: "compliance" });
    expect(migrateUiSettings(compliance)).toBe(compliance);
  });
});

describe("TemplateManifestSchema", () => {
  it("parses the vendored manifest shape", () => {
    const manifest = {
      name: "uecetex2",
      entry: "documento.tex",
      source: "https://github.com/thiagodnf/uecetex2",
      commit: "39e8c8a0312788d72311e3b0157ff0564fb74eaf",
      files: [{ path: "documento.tex", size: 7784, sha256: "ab".repeat(32) }],
    };
    expect(TemplateManifestSchema.parse(manifest).files).toHaveLength(1);
  });

  it("rejects manifest entries with traversal paths", () => {
    const manifest = {
      name: "x",
      entry: "a.tex",
      source: "https://example.com",
      commit: "a".repeat(40),
      files: [{ path: "../x", size: 1, sha256: "ab".repeat(32) }],
    };
    expect(() => TemplateManifestSchema.parse(manifest)).toThrow();
  });
});
