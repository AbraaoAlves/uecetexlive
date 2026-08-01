import type { DocumentIR } from "@papyru/inverse-core";
import { describe, expect, it } from "vitest";
import { assessConfidence } from "../confidence";

const ir = (
  fonts: { font: string; chars: number }[],
  outline: unknown[] = [{ title: "1 INTRODUÇÃO" }],
) =>
  ({
    sourceSha256: "x",
    pageCount: 10,
    metadata: {},
    outline,
    fonts,
    pages: [],
  }) as unknown as DocumentIR;

describe("assessConfidence", () => {
  it("aprova o PDF com corpo em Nimbus Roman e sumário", () => {
    const result = assessConfidence(
      ir([
        { font: "NimbusRomNo9L-Regu", chars: 8000 },
        { font: "NimbusSanL-Bold", chars: 500 },
      ]),
    );
    expect(result.ok).toBe(true);
    expect(result.bodyFraction).toBeGreaterThan(0.9);
  });

  it("reprova quando o corpo está em outra fonte", () => {
    const result = assessConfidence(
      ir([
        { font: "Arial", chars: 9000 },
        { font: "NimbusRomNo9L-Regu", chars: 200 },
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it("reprova sem sumário navegável", () => {
    expect(
      assessConfidence(ir([{ font: "NimbusRomNo9L-Regu", chars: 9000 }], [])).ok,
    ).toBe(false);
  });

  it("não divide por zero num PDF sem texto", () => {
    const result = assessConfidence(ir([]));
    expect(result.bodyFraction).toBe(0);
    expect(result.ok).toBe(false);
  });
});
