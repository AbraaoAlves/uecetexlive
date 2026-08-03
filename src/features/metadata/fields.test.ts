import { describe, expect, it } from "vitest";
import type { MetadataField } from "@/features/project/metadata";
import { WIZARD_STEPS } from "./fields";

const banca = WIZARD_STEPS.find((step) => step.id === "banca");

function shown(macro: string, fields: ReadonlyMap<string, MetadataField>): boolean {
  const field = banca?.fields.find((candidate) => candidate.macro === macro);
  return field?.showWhen?.("tccgraduacao", fields) ?? true;
}

function values(
  ...entries: Array<[macro: string, value?: string]>
): Map<string, MetadataField> {
  return new Map(
    entries.map(([macro, value = "Pessoa"]) => [
      macro,
      { macro, value, start: 0, end: value.length },
    ]),
  );
}

describe("campos da banca", () => {
  it("revela o terceiro membro somente depois do segundo", () => {
    expect(shown("membrodabancatres", values())).toBe(false);
    expect(
      shown("membrodabancatres", values(["membrodabancadois", "Membro da Banca Dois"])),
    ).toBe(false);
    expect(shown("membrodabancatres", values(["membrodabancadois"]))).toBe(true);
    expect(shown("membrodabancatres", values(["membrodabancatres"]))).toBe(true);
  });
});
